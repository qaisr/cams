# Deployment Runbook: {{Feature/Release Name}}

**Version:** 1.0
**Date:** YYYY-MM-DD
**Release Type:** `Feature` | `Hotfix` | `Schema Migration` | `Infrastructure`
**Risk Level:** `LOW` | `MEDIUM` | `HIGH`
**Estimated Deployment Time:** XX minutes
**Rollback Time:** XX minutes

---

## Pre-Deployment Checklist

### Code & Build
- [ ] PR merged to `main` / release branch
- [ ] All CI checks green (lint, typecheck, test, build)
- [ ] Security scan (Snyk) no new HIGH/CRITICAL issues
- [ ] SonarCloud quality gate passed
- [ ] OpenAPI spec up to date (`pnpm generate` was run)
- [ ] Version bumped in `package.json`

### Database
- [ ] Migration reviewed for zero-downtime compatibility
- [ ] Migration tested on staging with production-like data volume
- [ ] RDS snapshot taken (pre-deployment)
- [ ] Rollback SQL prepared and tested

### Environment
- [ ] All env vars set in AWS Parameter Store for target environment
- [ ] Feature flags configured (if applicable)
- [ ] Notify stakeholders of maintenance window (if required)

---

## Deployment Steps

### 1. Database Migration (if applicable)
```bash
# On staging first
DATABASE_URL=$STAGING_DB_URL npx prisma migrate deploy

# Verify
DATABASE_URL=$STAGING_DB_URL npx prisma migrate status

# Production (only after staging passes smoke tests)
DATABASE_URL=$PROD_DB_URL npx prisma migrate deploy
```

### 2. Backend Deployment (NestJS on Fargate — internal ALB — via AWS CDK v2)
```bash
# Deploy to staging
pnpm --filter @repo/infra cdk deploy --all -c env=staging

# Smoke test staging (see Smoke Tests section)

# Deploy to production
pnpm --filter @repo/infra cdk deploy --all -c env=prod
```

### 3. Frontend Deployment (Next.js)
```bash
# Triggered automatically by GitHub Actions on merge to main
# Monitor: GitHub Actions > Deploy workflow
```

### 4. Post-Deployment Verification
```bash
# Health check
curl https://api.example.com/health

# Key endpoint smoke test
curl -H "Authorization: Bearer $TEST_TOKEN" https://api.example.com/documents?limit=1
```

---

## Smoke Tests

| Test | Command / URL | Expected | Pass/Fail |
|------|--------------|----------|-----------|
| API Health | `GET /health` | `{ "status": "ok" }` | ⬜ |
| Auth | Login via PingID | Redirect to dashboard | ⬜ |
| List documents | `GET /documents` | 200, paginated response | ⬜ |
| Create document | `POST /documents` | 201, document object | ⬜ |
| [Feature-specific test] | [Steps] | [Expected result] | ⬜ |

---

## Rollback Procedure

### Trigger Conditions
- API error rate > 5% for 5 minutes
- P95 latency > 5s for 5 minutes
- Critical smoke test failure
- On-call engineer decision

### Rollback Steps
```bash
# 1. Revert Fargate service — the ECS circuit breaker auto-rolls-back a failed deploy.
# For a successfully deployed but misbehaving release:
# git checkout <previous-tag> && pnpm --filter @repo/infra cdk deploy --all -c env=prod
# Or force a new deployment to the previous task definition revision:
# aws ecs update-service --cluster app-prod --service ApiService --force-new-deployment

# 2. Revert database migration (if required)
# Run pre-prepared rollback SQL:
psql $PROD_DB_URL -f migrations/rollback/{{migration_name}}.sql

# 3. Verify rollback
curl https://api.example.com/health

# 4. Notify stakeholders
```

---

## Monitoring

| Dashboard | URL | What to Watch |
|-----------|-----|---------------|
| CloudWatch API | [URL] | ECS service errors, target response time, ALB 5xx |
| CloudWatch DB | [URL] | RDS CPU, connections, slow queries |
| GitHub Actions | [URL] | Deployment status |

**Alert during deployment:** Monitor for 15 minutes post-deployment.

---

## Contacts

| Role | Name | Contact |
|------|------|---------|
| Deployment Owner | [Name] | [Slack/Email] |
| On-Call Engineer | [Name] | [PagerDuty] |
| DBA | [Name] | [Slack] |
| Product Owner | [Name] | [Slack] |

---

## Post-Deployment Sign-off
- [ ] All smoke tests passed
- [ ] No error spike in CloudWatch (15min observation)
- [ ] Stakeholders notified of completion
- [ ] Runbook updated with any deviations

**Deployed by:** [Name]
**Actual deployment time:** XX minutes
**Notes:** [Any deviations or observations]
