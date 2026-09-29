---
description: Generate operational runbook for a service — incident response, monitoring, escalation, common fixes
agent: devops-engineer
subtask: true
---

# Generate Runbook

## Input

$ARGUMENTS (service name)
Examples:

- `/docs-runbook order-service`
- `/docs-runbook for @infra/lib/api-stack.ts`
- `/docs-runbook all services`

## Process

### Step 1: Read Context

- Read CDK stacks: `@infra/lib/`
- Read monitoring config if exists
- Read `@.claude/standards/observability-standards.md`
- Query CEB MCP: "PPCC runbook standards"

```bash
!`find infra/lib -name "*.ts" | head -10`
!`find .github/workflows -name "*.yml" | head -5`
```

### Step 2: Generate Runbook

```markdown
# Runbook: {Service Name}

**Version**: 1.0
**Last Updated**: {date}
**Owner**: {team — use [TEAM-NAME] placeholder}
**On-Call**: {[ON-CALL-CONTACT] placeholder}

---

## 1. Service Overview

### What It Does
{from functional spec — what this service is responsible for}

### Dependencies
| Dependency | Type | Impact if Down |
|---|---|---|
| RDS PostgreSQL | Database | Service unavailable |
| SNS {topic} | Async messaging | Events not published |
| PingID | Authentication | All requests fail |
| {upstream} | API | {feature} degraded |

### SLOs
| Metric | Target | Alert Threshold |
|---|---|---|
| Availability | 99.9% | < 99.5% |
| API P99 | < 1000ms | > 2500ms |
| Error rate | < 0.1% | > 1% |

---

## 2. Access and Links

| Resource | Link | Notes |
|---|---|---|
| CloudWatch Dashboard | [dashboard-link] | Replace with actual URL |
| X-Ray Service Map | [xray-link] | |
| CloudWatch Log Group | `/app/{env}/api` | |
| GitHub Actions | [actions-link] | |
| CDK Stack | `{StackName}-{env}` | |

---

## 3. Common Alerts and Responses

### Alert: ECS Service Error Rate High
**Alarm**: `{service}-error-alarm`
**Threshold**: >1% errors over 5 minutes

**Response steps**:
1. Check X-Ray for error traces:
   - Filter by `fault = true` in last 15 minutes
   - Identify failing operation from subsegment names
2. Check CloudWatch Logs (`/app/${stage}/api`):
   ```

   fields @timestamp, action, status, correlationId, error
   | filter level = "ERROR"
   | sort @timestamp desc
   | limit 20

   ```
3. Check recent deployments:
   - GitHub Actions: any deploy in last 30 minutes?
   - If yes → consider rollback (see Section 5)
4. Check downstream dependencies:
   - RDS: connections normal? CPU normal?
   - SNS: delivery failures?
5. Escalate if not resolved in 15 minutes → [ESCALATION-CONTACT]

### Alert: ECS Service P99 Duration High
**Alarm**: `{service}-duration-alarm`
**Threshold**: P99 > 2500ms

**Response steps**:
1. Check X-Ray for slow traces
2. Check RDS slow query log:
   ```sql
   SELECT query, calls, mean_exec_time
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

1. Check RDS CPU and connections in CloudWatch
2. Check ECS service CPU/memory utilisation and running task count in CloudWatch
3. If RDS connections exhausted — check Prisma connection pool config; review `datasource.pool` settings if needed

### Alert: DLQ Messages

**Alarm**: `{service}-dlq-alarm`
**Threshold**: ≥1 message in DLQ

**Response steps**:

1. Identify failed messages:

   ```bash
   aws sqs receive-message \
     --queue-url {dlq-url} \
     --attribute-names All \
     --region ap-southeast-2
   ```

2. Parse message body for error details
3. If fixable code issue:
   a. Fix and deploy
   b. Replay from DLQ
4. If bad data:
   a. Log the message details
   b. Delete from DLQ
   c. Raise incident for data investigation

### Alert: RDS CPU High

**Threshold**: >80% for 5 minutes

**Response steps**:

1. Identify top queries:

   ```sql
   SELECT query, calls, total_exec_time, mean_exec_time
   FROM pg_stat_statements
   ORDER BY total_exec_time DESC
   LIMIT 5;
   ```

2. Check for missing indexes (EXPLAIN ANALYZE on slow queries)
3. Check for N+1 query patterns in recent deployments
4. Consider: increase RDS instance size if load is expected growth

---

## 4. Deployment Procedures

### Deploy to Dev (Automatic)

- Triggered by: merge to `main` branch
- Monitor: GitHub Actions → CloudWatch error rate
- Rollback: re-run previous workflow

### Deploy to Staging (Manual)

1. Go to GitHub Actions → `deploy-staging` workflow
2. Click "Run workflow"
3. Approve in GitHub environment gate
4. Monitor for 15 minutes post-deploy
5. Run smoke tests

### Deploy to Production (Manual)

1. Raise change request: [CHANGE-MGMT-LINK]
2. Get 2 approvals (tech lead + product owner)
3. Schedule during low-traffic window (avoid 9am-5pm AEST)
4. GitHub Actions → `deploy-prod` → approve both gates
5. Monitor CloudWatch for 30 minutes
6. Close change request

---

## 5. Rollback Procedures

### Fargate Service Rollback (< 5 minutes)

```bash
# Re-run previous successful GitHub Actions workflow (preferred)
# OR manually via AWS CLI (requires DirectConnect):
aws ecs update-service \
   --cluster {app-name}-cluster \
   --service {app-name}-api \
   --task-definition {app-name}-api:{PREVIOUS_REVISION} \
   --region ap-southeast-2
```

### Database Migration Rollback

```sql
-- Prisma Migrate does not auto-rollback data; apply reverse migration manually.
-- Typically: DROP new columns, DROP new tables, or restore data from RDS snapshot.
-- CAUTION: Data written since migration may be lost
-- Coordinate with DBA and team before executing
```

### Rollback Decision Criteria

| Symptom | Action |
|---|---|
| Error rate > 5% immediately after deploy | Rollback immediately |
| P99 > 5s after deploy | Rollback if not fixed in 15 min |
| DLQ spike after deploy | Investigate first, rollback if root cause is deploy |
| Data corruption | Restore from RDS snapshot (involve DBA) |

---

## 6. Maintenance Procedures

### Database Connection Reset

If Fargate tasks have stale RDS Proxy connections:

```bash
# Force Fargate tasks to recycle connections by redeploying:
aws ecs update-service \
   --cluster {app-name}-cluster \
   --service {app-name}-api \
   --force-new-deployment \
   --region ap-southeast-2
```

### Clear Stuck SQS Messages

```bash
# Purge queue (loses all messages — use carefully)
aws sqs purge-queue \
  --queue-url {queue-url} \
  --region ap-southeast-2
```

### Prisma Migration Recovery

If migration state is inconsistent:

```bash
# Resolve failed migration:
pnpm --filter @repo/api prisma migrate resolve --applied {migration-name}
# OR mark as rolled back:
pnpm --filter @repo/api prisma migrate resolve --rolled-back {migration-name}
# See: https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining
```

---

## 7. Escalation Path

| Severity | Response Time | Escalate To |
|---|---|---|
| P1 (service down) | 15 minutes | [P1-CONTACT] |
| P2 (degraded) | 1 hour | [P2-CONTACT] |
| P3 (warning) | Next business day | [TEAM-CONTACT] |

---

## 8. Useful Queries

### Find requests by correlation ID

```
fields @timestamp, action, status, level, error
| filter correlationId = "REPLACE-WITH-CORRELATION-ID"
| sort @timestamp asc
```

### Error rate by endpoint (last hour)

```
fields @timestamp, action, status
| filter level = "ERROR" and ispresent(action)
| stats count() as errors by action
| sort errors desc
```

### Slow requests (P99 by action)

```
fields @timestamp, action, durationMs
| filter ispresent(durationMs)
| stats percentile(durationMs, 99) as p99 by action
| sort p99 desc
```

```

## Cross-References
- Monitoring: `/monitor-setup`
- Deployment: `@.claude/workflows/deployment.md`
- Observability: `@.claude/standards/observability-standards.md`
- CDK infra: `@.claude/agents/devops-engineer.md`
