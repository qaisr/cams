# Background Job Pattern

## Overview

Asynchronous job processing on AWS Fargate using two shapes:

- **Scheduled batch jobs** — EventBridge Scheduler → ECS RunTask (run-to-completion Fargate tasks)
- **Event-driven workers** — EventBridge → SQS → long-lived Fargate poller (NestJS service polling SQS)

## Architecture

### Scheduled batch (cron work)
```
EventBridge Scheduler → ECS RunTask (Fargate task)
                          └── run-to-completion → exit
```

### Event-driven worker (SQS polling)
```
API Handler → SQS Queue → Fargate worker (NestJS SQS poller) → Database
                ↓ (failed messages)
             Dead Letter Queue → Alert
```

## Implementation — SQS-Polling Fargate Worker

```typescript
// apps/api/src/jobs/job.service.ts
import { Injectable } from '@nestjs/common';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { z } from '@repo/validation'; // OpenAPI-extended z

const SendEmailJobSchema = z.object({
  type: z.literal('SEND_EMAIL'),
  payload: z.object({
    to: z.string().email(),
    template: z.enum(['welcome', 'reset-password']),
    data: z.record(z.unknown()),
  }),
  metadata: z.object({
    userId: z.string().uuid(),
    requestId: z.string(),
  }),
});

type SendEmailJob = z.infer<typeof SendEmailJobSchema>;

@Injectable()
export class JobService {
  private sqs = new SQSClient({});
  private queueUrl = process.env.JOB_QUEUE_URL!;

  async enqueueJob(job: SendEmailJob): Promise<void> {
    const validated = SendEmailJobSchema.parse(job);

    await this.sqs.send(new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(validated),
      MessageAttributes: {
        jobType: { DataType: 'String', StringValue: validated.type },
        userId: { DataType: 'String', StringValue: validated.metadata.userId },
      },
    }));
  }
}

// apps/workers/src/email-worker.service.ts
// Long-lived NestJS service that polls SQS — runs as a Fargate worker container.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

@Injectable()
export class EmailWorkerService implements OnModuleInit {
  private readonly logger = new Logger(EmailWorkerService.name);
  private sqs = new SQSClient({});
  private queueUrl = process.env.JOB_QUEUE_URL!;

  onModuleInit() {
    void this.poll();
  }

  private async poll(): Promise<void> {
    while (true) {
      try {
        const res = await this.sqs.send(new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20, // long-poll
        }));

        for (const record of res.Messages ?? []) {
          try {
            const job = SendEmailJobSchema.parse(JSON.parse(record.Body!));
            await sendEmail(job.payload);
            await this.sqs.send(new DeleteMessageCommand({
              QueueUrl: this.queueUrl,
              ReceiptHandle: record.ReceiptHandle!,
            }));
            this.logger.log('Job completed', { jobType: job.type, userId: job.metadata.userId });
          } catch (error) {
            this.logger.error('Job failed', { error, body: record.Body });
            // Message returns to queue after visibility timeout → DLQ after maxReceiveCount
          }
        }
      } catch (err) {
        this.logger.error('SQS poll error', { err });
        await new Promise(r => setTimeout(r, 5000)); // back-off before retry
      }
    }
  }
}

async function sendEmail(payload: SendEmailJob['payload']): Promise<void> {
  // Email sending logic
}
```

## CDK Configuration (AWS CDK v2)

### SQS queues with DLQ

```typescript
// infra/lib/job-stack.ts
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';

export class JobStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const dlq = new sqs.Queue(this, 'JobDLQ', {
      retentionPeriod: Duration.days(14),
    });

    const queue = new sqs.Queue(this, 'JobQueue', {
      visibilityTimeout: Duration.minutes(6),
      retentionPeriod: Duration.days(4),
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3, // Retry 3 times before DLQ
      },
    });

    // Alert on DLQ messages
    new cloudwatch.Alarm(this, 'DLQAlarm', {
      metric: dlq.metricApproximateNumberOfMessagesVisible(),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });
  }
}
```

### Scheduled Fargate batch task (EventBridge Scheduler → RunTask)

```typescript
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as schedulerTargets from 'aws-cdk-lib/aws-scheduler-targets';
import * as ecs from 'aws-cdk-lib/aws-ecs';

// Task definition for the batch job (separate from the API task)
const batchTaskDef = new ecs.FargateTaskDefinition(this, 'BatchTaskDef', {
  cpu: 512,
  memoryLimitMiB: 1024,
  taskRole,
});

batchTaskDef.addContainer('BatchContainer', {
  image: ecs.ContainerImage.fromAsset('apps/api'),
  environment: { BATCH_JOB: 'murex-eod-export', NODE_ENV: props.stage },
  logging: ecs.LogDrivers.awsLogs({ streamPrefix: `app-${props.stage}-batch` }),
});

// Schedule: nightly at 22:00 AEST
new scheduler.Schedule(this, 'MurexEodSchedule', {
  schedule: scheduler.ScheduleExpression.cron({ hour: '12', minute: '0' }), // UTC
  target: new schedulerTargets.EcsRunTask({
    cluster: props.cluster,
    taskDefinition: batchTaskDef,
    launchType: ecs.LaunchType.FARGATE,
    subnetIds: props.vpc.privateSubnets.map(s => s.subnetId),
  }),
});
```

## Idempotency

```typescript
// Use idempotency key tracked in the application database via Prisma
import { PrismaService } from '../database';

async function processJobIdempotent(job: SendEmailJob, prisma: PrismaService): Promise<void> {
  const idempotencyKey = `${job.type}:${job.metadata.userId}:${job.metadata.requestId}`;

  const existing = await prisma.processedJob.findUnique({ where: { key: idempotencyKey } });
  if (existing) {
    console.log('Job already processed (idempotent)', { idempotencyKey });
    return;
  }

  await prisma.processedJob.create({ data: { key: idempotencyKey, processedAt: new Date() } });
  await sendEmail(job.payload);
}
```

## Monitoring

Emit custom CloudWatch metrics using the AWS SDK directly from the NestJS worker service:

```typescript
// apps/workers/src/email-worker.service.ts
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cw = new CloudWatchClient({});

async function emitMetric(metricName: string, value: number, unit: 'Count' | 'Milliseconds') {
  await cw.send(new PutMetricDataCommand({
    Namespace: 'BackgroundJobs',
    MetricData: [{ MetricName: metricName, Value: value, Unit: unit }],
  }));
}

// Inside poll loop:
const startTime = Date.now();
try {
  await processJob(record);
  await emitMetric('JobSuccess', 1, 'Count');
  await emitMetric('JobDuration', Date.now() - startTime, 'Milliseconds');
} catch (error) {
  await emitMetric('JobFailure', 1, 'Count');
  throw error;
}
```

## Best Practices

1. **Idempotency**: Track processed job keys in the application database
2. **Retries**: Configure `maxReceiveCount` (3-5 retries) on the SQS queue
3. **Visibility Timeout**: Set to > processing time + buffer
4. **Batch Processing**: Receive up to 10 messages per SQS poll
5. **Dead Letter Queue**: Alert on DLQ messages, investigate failures
6. **Structured Logging**: Include jobType, userId, requestId
7. **Worker isolation**: Run batch workers as separate Fargate task definitions — do not share the API task definition

## Related

- `.claude/templates/background-job.ts`
- `.claude/patterns/eventbridge-pattern.md`

## Token Optimization

**Load when** implementing async SQS-polling Fargate workers, DLQs, or scheduled Fargate batch tasks. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
