# SNS Event Pattern

## Overview

Async communication between services via AWS SNS.
All SNS topics in VPC — accessible via DirectConnect only.
Used for: domain events, notifications, cross-service integration.

## Architecture

```

NestJS service (publisher)
  │  publishes OrderCreatedEvent
  ▼
SNS Topic (orders-events-{env})
    ├──▶ SQS Queue → Fargate worker (inventory consumer)
    ├──▶ SQS Queue → Fargate worker (notification consumer)
    └──▶ SQS Queue → Fargate worker (billing consumer, with DLQ)

All via VPC endpoints — no public internet

```

---

## 1. Event Schema Design

```typescript
// packages/events/src/domain-event.ts

/** Base envelope for all domain events */
export interface DomainEvent<T> {
  eventId:       string;   // UUID — idempotency key
  eventType:     string;   // 'order.created', 'order.cancelled'
  aggregateId:   string;   // Domain object ID (order ID, customer ID)
  aggregateType: string;   // 'Order', 'Customer'
  publishedBy:   string;   // Service name
  occurredAt:    string;   // ISO-8601 timestamp
  correlationId: string;   // Request correlation ID
  tenantId:      string;   // PPCC tenant
  payload:       T;        // Event-specific data
}

/** Domain-specific event payloads */
export interface OrderCreatedPayload {
  orderId:       string;
  customerId:    string;
  customerEmail: string;   // Needed by notification service
  items:         OrderItemPayload[];
  totalAmount:   number;
  currency:      string;   // 'AUD'
  status:        string;
}

export interface OrderItemPayload {
  productId:   string;
  productName: string;
  quantity:    number;
  unitPrice:   number;
}

/** Event type constants — prevent typos */
export const EventTypes = {
  ORDER_CREATED:   'order.created',
  ORDER_UPDATED:   'order.status_changed',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_SHIPPED:   'order.shipped',
} as const;
```

---

## 2. Publisher Implementation

```ts
// config/sns.config.ts
@Injectable()
export class SnsConfig {

    @Bean
    public SnsClient snsClient(
            @Value("${aws.region:ap-southeast-2}") String region) {
        return SnsClient.builder()
            .region(Region.of(region))
            // DirectConnect — uses VPC endpoint, no public internet
            .endpointOverride(URI.create(
                System.getenv("SNS_ENDPOINT_URL") != null
                    ? System.getenv("SNS_ENDPOINT_URL")   // LocalStack local dev
                    : "https://sns." + region + ".amazonaws.com"  // VPC endpoint
            ))
            .build();
    }
}

// events/domain-event.publisher.ts
@Injectable()
export class DomainEventPublisher {

    private final SnsClient snsClient;
    private final ObjectMapper objectMapper;

    @Value("${sns.topic.orders-events}")
    private String ordersTopicArn;

    /**
     * Publishes a domain event to SNS.
     * Idempotent — uses eventId as SNS message deduplication ID.
     * Correlation ID propagated for distributed tracing.
     */
    public <T> void publish(String topicArn, DomainEvent<T> event) {
        try {
            String payload = objectMapper.writeValueAsString(event);

            var request = PublishRequest.builder()
                .topicArn(topicArn)
                .message(payload)
                .subject(event.eventType())
                // Message attributes for SNS filtering
                .messageAttributes(Map.of(
                    "eventType", MessageAttributeValue.builder()
                        .dataType("String")
                        .stringValue(event.eventType())
                        .build(),
                    "tenantId", MessageAttributeValue.builder()
                        .dataType("String")
                        .stringValue(event.tenantId())
                        .build()
                ))
                .build();

            var response = snsClient.publish(request);

            log.info("action=publishEvent status=success eventType={} " +
                "aggregateId={} messageId={} correlationId={}",
                event.eventType(), event.aggregateId(),
                response.messageId(), event.correlationId());

        } catch (SnsException e) {
            log.error("action=publishEvent status=error eventType={} " +
                "aggregateId={} correlationId={} error={}",
                event.eventType(), event.aggregateId(),
                event.correlationId(), e.getMessage());
            // Re-throw — let caller handle (e.g., retry or DLQ)
            throw new EventPublishException(
                "Failed to publish " + event.eventType(), e);
        }
    }

    // ─── Convenience Methods ──────────────────────────────────────────────────

    public void publishOrderCreated(
            Order order, String userId, String correlationId) {
        var event = new DomainEvent<>(
            UUID.randomUUID().toString(),
            EventTypes.ORDER_CREATED,
            order.getId().toString(),
            "Order",
            "order-service",
            Instant.now(),
            correlationId,
            order.getTenantId().toString(),
            new OrderCreatedPayload(
                order.getId(),
                order.getCustomerId(),
                order.getCustomerEmail(),
                mapItems(order.getItems()),
                order.getTotalAmount(),
                "AUD",
                order.getStatus()
            )
        );
        publish(ordersTopicArn, event);
    }
}
```

---

## 3. Consumer Implementation

Consumers run as long-lived NestJS Fargate workers that poll an SQS queue.
SNS delivers messages to SQS; the Fargate worker processes them at its own pace.

```typescript
// apps/api/src/events/order-event-worker.service.ts
// Fargate SQS poller — long-lived NestJS service polling the notification queue.
// Partial batch failure: delete only successfully processed messages; failed
// messages return to queue and route to DLQ after maxReceiveCount.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import { NotificationService } from '../notifications/notification.service';
import { SnsEnvelope, DomainEvent, OrderCreatedPayload, OrderCancelledPayload } from './events.types';

@Injectable()
export class OrderEventWorkerService implements OnModuleInit {
  private readonly logger = new Logger(OrderEventWorkerService.name);
  private readonly sqs = new SQSClient({});
  private readonly queueUrl = process.env.NOTIFICATION_QUEUE_URL!;

  constructor(private readonly notificationService: NotificationService) {}

  onModuleInit() {
    void this.poll();
  }

  private async poll(): Promise<void> {
    while (true) {
      try {
        const res = await this.sqs.send(new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20,
        }));

        for (const record of res.Messages ?? []) {
          const correlationId = record.MessageAttributes?.['correlationId']?.StringValue ?? record.MessageId!;
          try {
            // SNS wraps message in envelope when SQS subscribes to SNS topic
            const envelope: SnsEnvelope = JSON.parse(record.Body!);
            const eventType = envelope.MessageAttributes['eventType'].Value;

            switch (eventType) {
              case 'ORDER_CREATED': {
                const domainEvent: DomainEvent<OrderCreatedPayload> = JSON.parse(envelope.Message);
                await this.notificationService.sendOrderConfirmation(domainEvent.payload, correlationId);
                break;
              }
              case 'ORDER_CANCELLED': {
                const domainEvent: DomainEvent<OrderCancelledPayload> = JSON.parse(envelope.Message);
                await this.notificationService.sendCancellationNotification(domainEvent.payload, correlationId);
                break;
              }
              default:
                // Unknown event type — acknowledge to avoid retry loop; log for investigation
                this.logger.warn({ action: 'processEvent', status: 'unknownEventType', eventType, correlationId });
            }

            // Delete only after successful processing
            await this.sqs.send(new DeleteMessageCommand({
              QueueUrl: this.queueUrl,
              ReceiptHandle: record.ReceiptHandle!,
            }));
          } catch (err) {
            // Leave message in queue — SQS retries it (up to maxReceiveCount → DLQ)
            this.logger.error({ action: 'processEvent', status: 'error', messageId: record.MessageId, correlationId, err });
          }
        }
      } catch (err) {
        this.logger.error({ action: 'sqsPoll', status: 'error', err });
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
}
```

---

## 4. CDK — SNS + SQS + DLQ Setup

```typescript
// infra/lib/events-stack.ts

import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';

// ─── SNS Topic ────────────────────────────────────────────────────────────────

const ordersTopic = new sns.Topic(this, 'OrdersTopic', {
  topicName:          `orders-events-${props.environment}`,
  displayName:        'Orders Domain Events',
  // KMS encryption for data at rest
  masterKey:          props.kmsKey,
});

// ─── SQS + DLQ per consumer ───────────────────────────────────────────────────

function createConsumerQueue(
    id: string,
    visibilityTimeout: cdk.Duration = cdk.Duration.seconds(90)
): { queue: sqs.Queue; dlq: sqs.Queue } {

  const dlq = new sqs.Queue(this, `${id}Dlq`, {
    queueName:         `${id}-dlq-${props.environment}`,
    retentionPeriod:   cdk.Duration.days(14),
    encryption:        sqs.QueueEncryption.KMS_MANAGED,
  });

  const queue = new sqs.Queue(this, `${id}Queue`, {
    queueName:         `${id}-${props.environment}`,
    visibilityTimeout,
    // Retry 3 times before sending to DLQ
    deadLetterQueue:   { queue: dlq, maxReceiveCount: 3 },
    encryption:        sqs.QueueEncryption.KMS_MANAGED,
    // Long-poll window — collect messages for up to 20 seconds
    receiveMessageWaitTime: cdk.Duration.seconds(20),
  });

  // Alarm on DLQ — messages in DLQ = processing failure
  new cloudwatch.Alarm(this, `${id}DlqAlarm`, {
    metric:             dlq.metricApproximateNumberOfMessagesVisible(),
    threshold:          1,
    evaluationPeriods:  1,
    alarmDescription:   `${id} DLQ has messages — processing failures detected`,
  }).addAlarmAction(new cwActions.SnsAction(props.alertTopic));

  return { queue, dlq };
}

// ─── Subscribe consumers ──────────────────────────────────────────────────────

const { queue: notificationQueue } =
  createConsumerQueue('notification-consumer');
const { queue: inventoryQueue } =
  createConsumerQueue('inventory-consumer');

// SNS → SQS subscriptions with filter policies
ordersTopic.addSubscription(new subs.SqsSubscription(notificationQueue, {
  filterPolicy: {
    eventType: sns.SubscriptionFilter.stringFilter({
      allowlist: [
        EventTypes.ORDER_CREATED,
        EventTypes.ORDER_CANCELLED,
        EventTypes.ORDER_SHIPPED,
      ],
    }),
  },
  rawMessageDelivery: false,  // Keep SNS envelope for metadata
}));

ordersTopic.addSubscription(new subs.SqsSubscription(inventoryQueue, {
  filterPolicy: {
    eventType: sns.SubscriptionFilter.stringFilter({
      allowlist: [EventTypes.ORDER_CREATED, EventTypes.ORDER_CANCELLED],
    }),
  },
}));

// Grant Fargate worker task roles permission to consume each queue
notificationQueue.grantConsumeMessages(props.notificationWorkerTaskRole);
inventoryQueue.grantConsumeMessages(props.inventoryWorkerTaskRole);

// Pass queue URLs as Fargate task env vars:
// NOTIFICATION_QUEUE_URL = notificationQueue.queueUrl
// INVENTORY_QUEUE_URL    = inventoryQueue.queueUrl
```

---

## 5. Idempotency Pattern

```typescript
// apps/worker/src/services/idempotency.service.ts
import { Injectable } from '@nestjs/common';
// Injectable PrismaService is provided by the app's own DatabaseModule
// (mirrors apps/api/src/database), which wraps the connection-safe getPrismaClient() singleton.
import { PrismaService } from '../database';

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns true if event should be processed (not a duplicate).
   * Marks event as processed atomically via Prisma upsert.
   * Prevents duplicate processing when SNS retries delivery.
   */
  async shouldProcess(eventId: string, eventType: string): Promise<boolean> {
    const result = await this.prisma.processedEvent.upsert({
      where:  { eventId },
      update: {},
      create: { eventId, eventType, processedAt: new Date() },
      select: { createdAt: true },
    });
    // If createdAt is recent (just inserted), it's new
    const isNew = Date.now() - result.createdAt.getTime() < 5000;
    if (!isNew) {
      // Already processed — log and skip
      return false;
    }
    return true;
  }
}

// Usage in Fargate worker consumer
async function processRecord(body: string, correlationId: string): Promise<void> {
  const event = parseEvent(body);
  if (!(await idempotencyService.shouldProcess(event.eventId, event.eventType))) {
    logger.info({ eventId: event.eventId }, 'Duplicate event — skipping');
    return;
  }
  // Process event...
}
```

---

## Rules (Never Break These)

- All SNS topics: KMS encrypted, VPC endpoint only
- All SQS queues: DLQ configured, DLQ alarm set
- Consumers: Fargate workers long-polling SQS; delete only successfully processed messages
- Events: idempotency check before processing
- Correlation ID: propagated through event payload
- PII in events: minimise — use IDs not raw personal data

## Cross-References

- Observability: `@.claude/standards/observability-standards.md`
- Security: `@.claude/standards/security-standards.md`
- CDK infra: `@.claude/agents/devops-engineer.md`
- API standards: `@.claude/standards/api-standards.md`

## Token Optimization

**Load when** designing SNS fanout / topic-subscriber communication. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
