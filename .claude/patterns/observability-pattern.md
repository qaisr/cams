# Observability Pattern

## Three Pillars: Logs + Metrics + Traces

### NestJS: Request Lifecycle Interceptor
```typescript
// apps/api/src/common/interceptors/observability.interceptor.ts
@Injectable()
export class ObservabilityInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, headers } = request;
    const traceId = headers['x-trace-id'] ?? randomUUID();
    const start = Date.now();

    // Attach to request for downstream use
    request['traceId'] = traceId;

    return next.handle().pipe(
      tap({
        next: (data) => {
          const response = context.switchToHttp().getResponse<Response>();
          this.logger.log({
            message: 'Request completed',
            method,
            url,
            statusCode: response.statusCode,
            durationMs: Date.now() - start,
            traceId,
          });
          // Emit CloudWatch metric
          this.emitLatencyMetric(url, method, Date.now() - start);
        },
        error: (err) => {
          this.logger.error({
            message: 'Request failed',
            method,
            url,
            durationMs: Date.now() - start,
            traceId,
            error: { name: err.name, message: err.message },
          });
        },
      })
    );
  }

  private emitLatencyMetric(path: string, method: string, ms: number) {
    // CloudWatch EMF (Embedded Metric Format) — zero additional cost
    console.log(JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [{
          Namespace: 'App/API',
          Dimensions: [['Path', 'Method']],
          Metrics: [{ Name: 'Latency', Unit: 'Milliseconds' }],
        }],
      },
      Path: path,
      Method: method,
      Latency: ms,
    }));
  }
}
```

### Database Query Observability
```typescript
// prisma/extensions/query-logger.ts
export const queryLoggerExtension = Prisma.defineExtension({
  query: {
    async $allOperations({ operation, model, args, query }) {
      const start = Date.now();
      const result = await query(args);
      const duration = Date.now() - start;

      if (duration > 500) {
        logger.error({
          message: 'Slow query detected',
          model,
          operation,
          durationMs: duration,
        });
      } else if (duration > 100) {
        logger.warn({
          message: 'Slow query warning',
          model,
          operation,
          durationMs: duration,
        });
      }

      return result;
    },
  },
});
```

### Frontend: Error Boundary + Logging
```typescript
// apps/web/src/components/error-boundary.tsx
'use client';
import { Component, type ReactNode } from 'react';
import { logger } from '@repo/observability';

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean; errorId: string }
> {
  state = { hasError: false, errorId: '' };

  static getDerivedStateFromError() {
    return { hasError: true, errorId: randomUUID() };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error('ui.error.boundary', {
      error: { name: error.name, message: error.message },
      componentStack: info.componentStack,
      errorId: this.state.errorId,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert">
          {this.props.fallback}
          <small>Error ID: {this.state.errorId}</small>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### CloudWatch Dashboard (AWS CDK v2)
```typescript
// infra/lib/monitoring-stack.ts
new aws_cloudwatch.Dashboard(this, 'AppDashboard', {
  widgets: [
    [
      new aws_cloudwatch.GraphWidget({
        title: 'API Latency p50/p95/p99',
        left: [
          new aws_cloudwatch.Metric({
            namespace: 'App/API',
            metricName: 'Latency',
            statistic: 'p50',
          }),
          // ... p95, p99
        ],
      }),
      new aws_cloudwatch.GraphWidget({
        title: 'Error Rate',
        left: [errorRateMetric],
      }),
    ],
  ],
});
```

## Health Check Endpoint
```typescript
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: PrismaHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }
}
```

## Token Optimization

**Load when** when adding logs/metrics/traces; correlation-ID propagation. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
