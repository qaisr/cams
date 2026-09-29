# Observability Standards — NestJS Fargate + CloudWatch + X-Ray

> Canonical reference for logging, metrics, tracing, alarms, dashboards, and
> health checks. This file absorbs the former `logging-standards.md` and
> `monitoring-alerting-standards.md` — do not recreate those.

## Three Pillars
| Pillar | Tool | Purpose |
|---|---|---|
| Logs | CloudWatch Logs (Pino JSON) | Structured application events |
| Metrics | CloudWatch Metrics + EMF | Performance and business SLIs |
| Traces | AWS X-Ray + ADOT | Distributed request tracing |

## Log Levels
| Level | When to Use |
|---|---|
| `error` | Unhandled exceptions, data-loss risk, integration failures |
| `warn`  | Recoverable errors, slow queries (>100ms), deprecated usage |
| `info`  | Request/response lifecycle, key business events (login, resource created) |
| `debug` | Detailed flow, query params — disabled in production |

## 1. Structured Logging (Pino + NestJS)
```typescript
// packages/common/src/logger/pino.config.ts
import pino from 'pino';

export const pinoLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: process.env.SERVICE_NAME,
    environment: process.env.NODE_ENV,
  },
  redact: {
    paths: ['*.password', '*.token', '*.secret', '*.authorization', '*.email'],
    censor: '[REDACTED]',
  },
});

// Required fields in every log entry:
// timestamp, level, service, correlationId, action, status
// NEVER log: tokens, passwords, PAN, raw email/PII
````

```typescript
// Usage in service
this.logger.log({
  action: "createUser",
  status: "success",
  id: user.id,
  correlationId,
  durationMs: Date.now() - startTime,
});

this.logger.error({
  action: "createUser",
  status: "error",
  correlationId,
  error: err.message, // message only — no stack in production
  errorCode: err.errorCode,
});
```

### Canonical Log Entry Contract
Every structured log entry uses these field names (do not invent variants such
as `traceId`/`requestId`/`operation` — those were retired in the merge):

```typescript
interface LogEntry {
  timestamp: string;        // ISO 8601 (Pino adds automatically)
  level: 'error' | 'warn' | 'info' | 'debug';
  service: string;          // e.g. 'api', 'web' (Pino `base`)
  environment: string;      // NODE_ENV
  correlationId: string;    // cross-service request correlation (from x-correlation-id)
  action: string;           // operation name, e.g. 'createUser'
  status: 'success' | 'error';
  userId?: string;          // authenticated user id — never email/PII
  tenantId?: string;        // multi-tenancy scoping
  durationMs?: number;      // operation timing
  error?: string;           // message only — NEVER stack traces in production
  errorCode?: string;       // domain error code
}
```

### What NEVER to Log
- Passwords, tokens, API keys, secrets, `Authorization` headers
- Full PAN / credit-card numbers, SSNs, raw email or other PII
- Complete request bodies containing sensitive fields
- Stack traces in production (log message + errorCode only)

### Frontend Logging
```typescript
// apps/web/src/lib/logger.ts — structured client logger
import { logger } from '@repo/common/logger';

logger.info('document.view', { documentId, source: 'list', correlationId });
logger.error('api.call.failed', {
  endpoint: '/v1/documents',
  status: error.status,
  correlationId,
});
// ❌ Never use console.log in production code — use the structured logger
```

## 2. AWS X-Ray Tracing

```typescript
// Fargate service — X-Ray auto-instruments with ADOT sidecar
// Add custom subsegments for critical operations

import AWSXRay from "aws-xray-sdk-core";

export class UserService {
  async findById(id: string, correlationId?: string) {
    const segment = AWSXRay.getSegment();
    const sub = segment?.addNewSubsegment("UserService.findById");
    sub?.addAnnotation("userId", id);
    sub?.addAnnotation("correlationId", correlationId ?? "");

    try {
      const result = await this.prisma.user.findFirst({
        where: { id, deletedAt: null },
      });
      sub?.close();
      return result;
    } catch (err) {
      sub?.addError(err as Error);
      sub?.close();
      throw err;
    }
  }
}
```

## 3. CloudWatch Embedded Metric Format (EMF)

```typescript
// Emit custom metrics from the Fargate service without separate metric API calls
import { createMetricsLogger, Unit } from "aws-embedded-metrics";

export class UserService {
  async create(dto: CreateUserDtoType, correlationId?: string) {
    const metrics = createMetricsLogger();
    metrics.setNamespace("MyApp/Users");
    metrics.setDimensions({ Environment: process.env.NODE_ENV! });

    const start = Date.now();
    try {
      const user = await this.prisma.user.create({ data: dto });
      metrics.putMetric("UserCreated", 1, Unit.Count);
      metrics.putMetric(
        "UserCreateDuration",
        Date.now() - start,
        Unit.Milliseconds
      );
      await metrics.flush();
      return user;
    } catch (err) {
      metrics.putMetric("UserCreateError", 1, Unit.Count);
      await metrics.flush();
      throw err;
    }
  }
}
```

## 4. CloudWatch Alarms (CDK)

```typescript
// infra/lib/alarms.ts
const alarms = {
  albTargetErrors: new cloudwatch.Alarm(this, "AlbTargetErrors", {
    metric: alb.metricHttpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT, {
      period: Duration.minutes(1),
    }),
    threshold: 5,
    evaluationPeriods: 2,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  }),
  ecsServiceLatency: new cloudwatch.Alarm(this, "EcsServiceLatency", {
    metric: alb.metricTargetResponseTime({
      statistic: "p99",
      period: Duration.minutes(5),
    }),
    threshold: 2.5, // 2.5s P99
    evaluationPeriods: 3,
  }),
  dbConnections: new cloudwatch.Alarm(this, "DbConnections", {
    metric: rdsProxy.metricDatabaseConnections({ period: Duration.minutes(1) }),
    threshold: 80, // % of max_connections
    evaluationPeriods: 2,
  }),
};
// All alarms → SNS → PagerDuty (prod) / Email (non-prod)
```

### Alert Severity Levels
| Severity | Response Time | Channel | Example |
|---|---|---|---|
| P0 — Critical | Immediate | PagerDuty + SMS | Production down, data loss |
| P1 — High | < 15 min | PagerDuty + Slack | API error rate > 5%, P99 > 2.5s sustained |
| P2 — Medium | < 1 hour | Slack + Email | Error rate > 1%, cache hit rate < 50% |
| P3 — Low | Next business day | Email | Disk/connection usage > 80% |

### CloudWatch Dashboard (CDK)
```typescript
// infra/lib/monitoring-stack.ts
const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
  dashboardName: `${serviceName}-${environment}`,
});

dashboard.addWidgets(
  new cloudwatch.GraphWidget({
    title: 'API Latency (p95, p99)',
    left: [
      new cloudwatch.Metric({ namespace: 'MyApp', metricName: 'ApiDuration', statistic: 'p95' }),
      new cloudwatch.Metric({ namespace: 'MyApp', metricName: 'ApiDuration', statistic: 'p99' }),
    ],
  }),
  new cloudwatch.GraphWidget({
    title: 'Error Rate (5xx)',
    left: [new cloudwatch.Metric({ namespace: 'MyApp', metricName: 'ApiStatus5xx', statistic: 'Sum' })],
  }),
);
```

## 5. Performance Baselines

| Metric                 | Target  | Alert Threshold |
| ---------------------- | ------- | --------------- |
| API P50 latency        | < 150ms | > 500ms         |
| API P99 latency        | < 800ms | > 2500ms        |
| Fargate scale-out time | < 60s   | > 120s          |
| DB query P99           | < 50ms  | > 200ms         |
| Error rate             | < 0.1%  | > 1%            |
| ECS task failures      | 0       | > 5/min         |

## 6. Correlation ID Flow

```
Client → [generates x-correlation-id] → internal ALB
ALB → [forwards headers] → Fargate service (NestJS)
NestJS → CorrelationIdMiddleware → [auto-generates if missing]
  └─► All log entries include correlationId
  └─► X-Ray annotation: correlationId
  └─► Response header: x-correlation-id
  └─► RFC 7807 errors include correlationId
```

## 7. Health Check

```typescript
// src/health/health.controller.ts
@Get('health')
@Public() // No auth required
async health(): Promise<HealthStatus> {
  const dbOk = await this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  return {
    status: dbOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      database: dbOk ? 'ok' : 'error',
    },
  };
}
```

## 8. Log Retention (CDK)

```typescript
new logs.LogGroup(this, "ApiLogGroup", {
  logGroupName: `/app/${environment}/api`,
  retention: logs.RetentionDays.THREE_MONTHS,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
});
```

## Monitoring Checklist
- [ ] Structured logging in JSON (Pino) with the canonical `LogEntry` fields
- [ ] `correlationId` propagated and present on every log entry + response header
- [ ] EMF metrics emitted for key operations (counts + durations)
- [ ] CloudWatch alarms configured (errors, latency, DB connections)
- [ ] Alarms wired to SNS → PagerDuty (prod) / Email (non-prod)
- [ ] Health check endpoint implemented (`GET /health`, `@Public()`)
- [ ] Dashboard published with latency + error-rate widgets
- [ ] No PII, secrets, or production stack traces in logs
- [ ] Alerting tested (trigger a test alarm)

## Cross-References

- API standards: `@.claude/standards/api-standards.md`
- Security (PII log rules): `@.claude/standards/security-standards.md`
- Error handling: `@.claude/patterns/error-handling-pattern.md`
- Observability pattern (implementation): `@.claude/patterns/observability-pattern.md`
- Monitor setup command: `@.claude/commands/monitor-setup.md`

## Token Optimization

- **Load when**: instrumenting endpoints/services, logging review, correlation-ID propagation, alarm/dashboard wiring, SLO definition, tracing work.
- **Load only**: this standard + `observability-pattern.md`.
- **Unload after**: instrumentation merged and verified in CloudWatch / X-Ray.
