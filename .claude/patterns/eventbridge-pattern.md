# EventBridge Pattern — NestJS

Replaces SNS direct topic pattern. EventBridge gives schema registry,
cross-account routing, and replay. The NestJS app publishes events from the
Fargate service; subscribers are long-lived Fargate workers polling dedicated
SQS queues (EventBridge → SQS → Fargate poller).

## Publisher Service
```typescript
// src/events/eventbridge.service.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  EventBridgeClient,
  PutEventsCommand,
  type PutEventsRequestEntry,
} from '@aws-sdk/client-eventbridge';
import { ConfigService } from '@nestjs/config';

export interface DomainEvent<T = Record<string, unknown>> {
  detailType: string;       // e.g. 'user.created'
  detail: T;
  source?: string;          // defaults to service name
  correlationId?: string;
}

@Injectable()
export class EventBridgeService {
  private readonly logger = new Logger(EventBridgeService.name);
  private readonly client: EventBridgeClient;
  private readonly busName: string;
  private readonly source: string;

  constructor(private readonly config: ConfigService) {
    this.client = new EventBridgeClient({
      region: config.get('AWS_REGION', 'ap-southeast-2'),
      // LocalStack endpoint for local dev
      ...(config.get('AWS_ENDPOINT_URL') && {
        endpoint: config.get('AWS_ENDPOINT_URL'),
      }),
    });
    this.busName = config.getOrThrow('EVENT_BUS_NAME');
    this.source = config.getOrThrow('SERVICE_NAME');
  }

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    const entry: PutEventsRequestEntry = {
      EventBusName: this.busName,
      Source: event.source ?? this.source,
      DetailType: event.detailType,
      Detail: JSON.stringify({
        ...event.detail,
        correlationId: event.correlationId,
        timestamp: new Date().toISOString(),
      }),
    };

    this.logger.log({
      action: 'publishEvent',
      detailType: event.detailType,
      correlationId: event.correlationId,
    });

    try {
      const res = await this.client.send(new PutEventsCommand({ Entries: [entry] }));
      if (res.FailedEntryCount && res.FailedEntryCount > 0) {
        this.logger.error({
          action: 'publishEvent',
          status: 'failed',
          entries: res.Entries,
        });
        throw new Error(`EventBridge publish failed: ${event.detailType}`);
      }
    } catch (error) {
      this.logger.error({
        action: 'publishEvent',
        status: 'error',
        detailType: event.detailType,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async publishMany<T>(events: DomainEvent<T>[]): Promise<void> {
    // EventBridge max 10 entries per call
    const chunks = [];
    for (let i = 0; i < events.length; i += 10) {
      chunks.push(events.slice(i, i + 10));
    }
    await Promise.all(chunks.map((chunk) =>
      this.client.send(new PutEventsCommand({
        Entries: chunk.map((e) => ({
          EventBusName: this.busName,
          Source: e.source ?? this.source,
          DetailType: e.detailType,
          Detail: JSON.stringify(e.detail),
        })),
      }))
    ));
  }
}
````

## Consumer (Fargate SQS Poller)

EventBridge routes events to an SQS queue; a long-lived NestJS Fargate worker
polls the queue and processes messages.

```typescript
// src/events/handlers/user-created-worker.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';

interface UserCreatedDetail {
  id: string;
  email: string;
  correlationId: string;
}

@Injectable()
export class UserCreatedWorkerService implements OnModuleInit {
  private readonly logger = new Logger(UserCreatedWorkerService.name);
  private readonly sqs = new SQSClient({});
  private readonly queueUrl = process.env.USER_EVENTS_QUEUE_URL!;

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

        for (const msg of res.Messages ?? []) {
          try {
            const detail: UserCreatedDetail = JSON.parse(msg.Body!);
            await this.handle(detail);
            await this.sqs.send(new DeleteMessageCommand({
              QueueUrl: this.queueUrl,
              ReceiptHandle: msg.ReceiptHandle!,
            }));
          } catch (err) {
            this.logger.error({ action: 'processEvent', status: 'error', err });
            // Message returns to queue → DLQ after maxReceiveCount
          }
        }
      } catch (err) {
        this.logger.error({ action: 'sqsPoll', status: 'error', err });
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  private async handle(detail: UserCreatedDetail): Promise<void> {
    // process event...
    this.logger.log({ action: 'handleUserCreated', id: detail.id });
  }
}
```

## Local Dev (LocalStack)

```yaml
# docker-compose.yml
localstack:
  environment:
    SERVICES: events,sqs,s3,secretsmanager
```

```bash
# Create local event bus
awslocal events create-event-bus --name local-app-bus

# Put test event
awslocal events put-events --entries '[{
  "EventBusName": "local-app-bus",
  "Source": "api-service",
  "DetailType": "user.created",
  "Detail": "{\"id\": \"test-123\"}"
}]'
```

## Unit Testing

```typescript
const mockEvents = {
  publish: jest.fn().mockResolvedValue(undefined),
  publishMany: jest.fn().mockResolvedValue(undefined),
};

// Verify event published
expect(mockEvents.publish).toHaveBeenCalledWith(
  expect.objectContaining({
    detailType: "user.created",
    detail: expect.objectContaining({ id: expect.any(String) }),
  })
);
```

## Cross-References

- Service template: `@.claude/templates/nestjs-service.ts`
- Observability: `@.claude/standards/observability-standards.md`

## Token Optimization

**Load when** wiring EventBridge rules, schemas, or Fargate SQS-poller consumers. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
