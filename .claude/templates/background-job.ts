/**
 * Background Job Template — NestJS Fargate Worker
 *
 * Two shapes:
 *   1. Scheduled batch task  — container starts, runs job to completion, exits.
 *      Entry point: apps/api/src/main.ts with BATCH_JOB env var set.
 *   2. SQS-polling worker    — long-lived NestJS service, polls SQS continuously.
 *      Registered as an OnModuleInit service within the NestJS app.
 *
 * This template shows the SQS-polling pattern.
 * For the scheduled batch shape, implement OnApplicationBootstrap, run the job, then process.exit(0).
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
// Import `z` from the shared validation package, never from 'zod' directly —
// extendZodWithOpenApi(z) is called once in packages/validation/src/zod.ts.
import { z } from '@repo/validation';

// === Job Schema ===
const YourJobSchema = z.object({
  type: z.literal('YOUR_JOB_TYPE'),
  payload: z.object({
    // Define payload structure
    userId: z.string().uuid(),
    data: z.record(z.unknown()),
  }),
  metadata: z.object({
    requestId: z.string(),
    timestamp: z.string().datetime(),
  }),
});

type YourJob = z.infer<typeof YourJobSchema>;

// === SQS-Polling Fargate Worker ===
@Injectable()
export class YourJobWorkerService implements OnModuleInit {
  private readonly logger = new Logger(YourJobWorkerService.name);
  private readonly sqs = new SQSClient({});
  private readonly queueUrl = process.env.JOB_QUEUE_URL!;

  onModuleInit() {
    void this.poll();
  }

  private async poll(): Promise<void> {
    this.logger.log('SQS poller started', { queue: this.queueUrl });

    while (true) {
      try {
        const res = await this.sqs.send(new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20, // long-poll — reduces empty receives
        }));

        for (const record of res.Messages ?? []) {
          const startTime = Date.now();

          try {
            // Parse job
            const job = YourJobSchema.parse(JSON.parse(record.Body!));

            this.logger.log('Processing job', {
              jobType: job.type,
              userId: job.payload.userId,
              requestId: job.metadata.requestId,
            });

            // === PROCESS JOB HERE ===
            await this.processJob(job);

            // Delete only after successful processing
            await this.sqs.send(new DeleteMessageCommand({
              QueueUrl: this.queueUrl,
              ReceiptHandle: record.ReceiptHandle!,
            }));

            this.logger.log('Job completed', {
              jobType: job.type,
              userId: job.payload.userId,
              duration: Date.now() - startTime,
            });
          } catch (error) {
            this.logger.error('Job failed', {
              error: error instanceof Error ? error.message : String(error),
              body: record.Body,
            });
            // Do NOT delete — message returns to queue after visibility timeout,
            // routes to DLQ after maxReceiveCount retries.
          }
        }
      } catch (err) {
        this.logger.error('SQS poll error — backing off', { err });
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  // === Job Processing Logic ===
  private async processJob(job: YourJob): Promise<void> {
    // TODO: Implement job processing logic
    // Example: Send email, generate report, sync data, etc.

    // Idempotency check (use Prisma to track processed job keys)
    const alreadyProcessed = await this.checkIdempotency(job.metadata.requestId);
    if (alreadyProcessed) {
      this.logger.log('Job already processed (idempotent)', { requestId: job.metadata.requestId });
      return;
    }

    // Process job
    // ...

    // Mark as processed
    await this.markAsProcessed(job.metadata.requestId);
  }

  // === Idempotency (backed by Prisma — no DynamoDB dependency) ===
  private async checkIdempotency(requestId: string): Promise<boolean> {
    // TODO: query prisma.processedJob.findUnique({ where: { key: requestId } })
    return false;
  }

  private async markAsProcessed(requestId: string): Promise<void> {
    // TODO: prisma.processedJob.create({ data: { key: requestId, processedAt: new Date() } })
  }
}
