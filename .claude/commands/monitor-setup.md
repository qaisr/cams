---
description: Set up CloudWatch dashboards, alarms, X-Ray tracing, and Observe events
agent: devops-engineer
subtask: true
---

# Monitoring Setup

## Input

$ARGUMENTS (service or feature name)

## Process

### 1. Read Context

- Read CDK stack files in `infra/`
- Read Fargate service and internal ALB definitions
- Query CEB MCP: "PPCC Observe integration patterns"
- Load: `@.claude/standards/observability-standards.md`

### 2. CloudWatch Alarms (per ECS service + ALB target group)

Generate CDK code for standard alarms:

- ECS service CPU utilisation alarm (threshold: 80% over 5 min)
- ECS service memory utilisation alarm (threshold: 85% over 5 min)
- ECS running task count alarm (threshold: below desired count for 5 min)
- ALB 5xx error rate alarm (threshold: 1% over 5 min)
- ALB target response time P99 alarm (threshold: 2500ms)

### 3. CloudWatch Dashboard

Generate CDK dashboard with:

- ALB requests + 5xx errors + latency P50/P99 (side by side)
- ECS CPU + memory utilisation + running task count
- RDS connections + CPU utilisation
- Custom business metrics (if applicable)

### 4. X-Ray Tracing

Verify Fargate task definition has X-Ray daemon sidecar or SDK tracing enabled in CDK:

```typescript
// Add X-Ray daemon as a sidecar container, or enable AWS Distro for OpenTelemetry
taskDefinition.addContainer('XRayDaemon', {
  image: ecs.ContainerImage.fromRegistry('public.ecr.aws/xray/aws-xray-daemon:latest'),
  // ...
});
```

Verify Fargate task role has `xray:PutTraceSegments` and `xray:PutTelemetryRecords` permissions (included in `AWSXRayDaemonWriteAccess` managed policy).

Add custom subsegments for critical operations.

### 5. Observe Events (PPCC Platform)

Query CEB MCP for Observe integration specifics.
Identify business events to publish:

- Resource created/modified/deleted
- User permission denied
- Data export events
- Admin actions

Generate ObserveEventPublisher bean following PPCC standards.

### 6. Log Insights Queries

Generate saved CloudWatch Insights queries:

```
# Error rate by endpoint
fields @timestamp, correlationId, action, status
| filter level = "ERROR"
| stats count() as errorCount by action
| sort errorCount desc

# Slow requests (P99)
fields @timestamp, correlationId, action, duration
| filter ispresent(duration)
| stats percentile(duration, 99) as p99 by action
| sort p99 desc
```

### 7. Runbook Entry

Add monitoring section to runbook:

```markdown
## Monitoring: {service}
- Dashboard: [CloudWatch link]
- Alarms: [SNS topic]
- Traces: [X-Ray service map link]
- Business events: [Observe link]
### Alert Response
- Error rate high: Check X-Ray traces → CloudWatch logs (/app/${stage}/api) → correlationId
- P99 latency high: Check RDS slow query log → X-Ray subsegments → ECS task metrics
- ECS task count low: Review ECS events → check autoscaling policy → scale-out lag
- ALB 5xx: Check ECS service logs → X-Ray for downstream failures
```

## Cross-References

- Observability standards (logging, metrics, tracing, alarms, dashboards): `@.claude/standards/observability-standards.md`
- Observability pattern: `@.claude/patterns/observability-pattern.md`
- Deployment: `/deploy-prepare`
- Infrastructure: `@.claude/workflows/deployment.md`
- Runbook: `/docs-runbook`
