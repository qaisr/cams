---
description: Generate rollback plan for an upcoming deployment — steps, triggers, and decision tree
agent: devops-engineer
subtask: true
---

# Rollback Plan

## Input

$ARGUMENTS (deployment description)
Examples:

- `/rollback-plan for v1.2.0 deployment`
- `/rollback-plan for order management feature deployment`
- `/rollback-plan` (reads recent git log and CDK diff)

## Process

### Step 1: Understand the Deployment

```bash
!`git log --oneline -10`
!`find packages/database/prisma/migrations -name "*.sql" | sort | tail -20`
!`cd infra && cdk diff 2>/dev/null | grep -E "^\[|\+|\-" | head -30`
```

Identify:

- New Fargate task definition revision
- New DB migrations (most complex rollback)
- New CDK infrastructure changes
- New environment variables / container config

### Step 2: Generate Rollback Plan

```markdown
# Rollback Plan: {Deployment Name}

**Date**: {date}
**Deployment**: {description}
**Rollback Window**: 30 minutes post-deploy
**Decision Owner**: {[TECH-LEAD] placeholder}

---

## Pre-Deployment Baselines

Record these BEFORE deploying:
```bash
# Current Fargate task definition revision
aws ecs describe-services \
  --cluster {app-name}-cluster \
  --services {app-name}-api \
  --region ap-southeast-2 \
  --query 'services[0].{TaskDef:taskDefinition,Desired:desiredCount,Running:runningCount}' --output table

# Current DB migration version
# Run against production DB:
SELECT migration_name, started_at, finished_at
FROM _prisma_migrations
ORDER BY finished_at DESC
LIMIT 3;

# Current error rate baseline (last 30 min)
# Note value from CloudWatch dashboard before deploying
```

---

## Rollback Triggers (Auto-Rollback)

The deployment will automatically rollback if:

- Error rate > 1% within 5 minutes of deployment
- P99 latency > 3× baseline within 5 minutes
- Health check fails 3 consecutive times

---

## Rollback Triggers (Manual Decision)

Consider manual rollback if within 30 minutes of deployment:

| Signal | Threshold | Action |
|---|---|---|
| Error rate | > 2% (sustained 5 min) | Rollback immediately |
| P99 latency | > 2500ms (sustained 5 min) | Rollback if not resolved |
| DLQ messages | > 10 messages | Investigate, rollback if code issue |
| Business metric drop | > 10% below baseline | Investigate |

---

## Step-by-Step Rollback

### Step 1: Fargate Service Rollback (< 5 minutes)

```bash
# Via GitHub Actions (preferred):
# Go to Actions → deploy-prod → Re-run previous successful run

# Via AWS CLI (backup — requires DirectConnect + permissions):
# Roll back to previous task definition revision:
aws ecs update-service \
  --cluster {app-name}-cluster \
  --service {app-name}-api \
  --task-definition {app-name}-api:{PREVIOUS_REVISION} \
  --region ap-southeast-2
```

**Verify**:

```bash
# ECS service should drain old tasks and start new ones within 1-2 minutes
# Check: aws ecs describe-services --cluster {app-name}-cluster --services {app-name}-api
# ECS error rate should return to baseline — check CloudWatch ALB + ECS dashboard
```

### Step 2: Frontend Rollback (if frontend deployed)

```bash
# Via GitHub Actions: re-run previous deploy-prod workflow
# This redeploys previous frontend build to CloudFront/S3
```

### Step 3: Database Migration Rollback

{For each new migration, generate specific rollback steps}

**Migration: 00N-{description}.sql (Prisma)**

```sql
-- Execute rollback steps manually (Prisma Migrate does not auto-rollback data).
-- Typically: DROP new columns, DROP new tables, or restore data from RDS snapshot.
{rollback SQL for this migration}

-- After rolling back schema, mark migration as rolled back:
-- Resolve migration state using Prisma migration commands or restore from snapshot.

-- IMPORTANT: This removes data written since migration
-- Coordinate with team and confirm data impact before running
```

**Backward compatibility**: {YES/NO — explain if NO}

**Data risk**: {None / Low (only new columns) / High (data written)}

### Step 4: Config / Secrets Rollback

If new environment variables were added to the Fargate task definition:

```bash
# Re-deploy previous task definition revision (which carries the old env vars):
aws ecs update-service \
  --cluster {app-name}-cluster \
  --service {app-name}-api \
  --task-definition {app-name}-api:{PREVIOUS_REVISION} \
  --region ap-southeast-2

# Or: re-deploy previous CDK stack version via GitHub Actions
```

---

## Post-Rollback Verification

After rollback:

1. Confirm error rate returns to baseline (< 0.1%)
2. Confirm P99 returns to baseline (< 1000ms)
3. Run smoke tests:

   ```bash
   curl -H "X-Correlation-Id: rollback-verify-001" \
     https://api.ppcc.com.au/api/v1/health
   ```

4. Check business metrics in Observe (order rate, etc.)
5. Notify stakeholders of rollback

---

## Root Cause Analysis

After rollback is stable:

1. Export X-Ray traces from the failed deployment window
2. Export CloudWatch logs filtered by error time window
3. Identify the specific commit that caused the issue:

   ```bash
   git log --oneline {previous_version}..{failed_version}
   ```

4. Raise incident report within 24 hours
5. Add regression test before re-deploying

---

## Contacts

| Role | Contact | When to Call |
|---|---|---|
| Tech Lead | [TECH-LEAD-CONTACT] | Any rollback decision |
| DBA | [DBA-CONTACT] | DB migration rollback |
| On-Call | [ONCALL-CONTACT] | P1 incidents |

```

## Cross-References
- Deploy workflow: `@.claude/workflows/deployment.md`
- Monitoring: `@.claude/standards/observability-standards.md`
- Runbook: `/docs-runbook`
- CDK infra: `@.claude/agents/devops-engineer.md`
