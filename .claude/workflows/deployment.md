# Deployment Workflow

> **Operating Discipline (always applies).** Follow `@.claude/CLAUDE.md` → Operating Discipline throughout this workflow: never hallucinate paths/APIs/versions, never assume intent to fill a gap, never implement unrequested scope, clarify ambiguities before acting, and get **explicit human approval** before anything hard-to-reverse or beyond the stated request. Report faithfully what was done, skipped, or failed.


## Overview

Deployment pipeline for PPCC enterprise application.
All deployments via GitHub Actions — no manual AWS console changes in production.
All AWS connectivity via DirectConnect.

Scope note for this framework: use this workflow to design and validate deployment code/configuration readiness. Live environment deployment execution is out of default scope and only occurs when explicitly requested.

Canonical platform note:

- Backend deployment target: AWS Fargate (NestJS Fastify long-lived service) behind an internal ALB, deployed via AWS CDK v2 (`ecsPatterns.ApplicationLoadBalancedFargateService`).
- Authentication and authorization: in-app NestJS `JwtAuthGuard` (passport-jwt + PingID RS256/JWKS). No API Gateway, no external authorizer.
- Prefer `infra/lib/` CDK stacks for deployment implementation.

## Environments

| Environment | Branch | Approval | URL Pattern |
|---|---|---|---|
| Local | any | none | localhost |
| Dev | main (auto) | none | api-dev.ppcc.com.au |
| Staging | main (manual) | 1 approver | api-staging.ppcc.com.au |
| Production | main (manual) | 2 approvers | api.ppcc.com.au |

---

## 1. Local Development Setup

### Prerequisites

```bash
# Required tools
node --version          # 20+
pnpm --version          # 9+
docker --version        # 24+ (for Testcontainers + LocalStack)
aws --version           # AWS CLI v2
cdk --version           # AWS CDK v2

# PPCC DirectConnect — ensure VPN/DirectConnect active before:
# - Any AWS CLI commands
# - Any CDK commands
# - Any Secrets Manager access
```

### Local AWS Services (LocalStack)

```bash
# Start LocalStack for local AWS development
docker compose up localstack -d

# Verify services available
aws --endpoint-url=http://localhost:4566 secretsmanager list-secrets

# Note: DirectConnect not required for LocalStack (local only)
# LocalStack simulates: Secrets Manager, SSM, EventBridge, CloudWatch Logs, SQS, SNS
```

### Run Locally

```bash
# Terminal 1: Database (real PostgreSQL)
docker compose up postgres -d

# Terminal 2: API (NestJS local)
cd apps/api
cp .env.example .env.local
# Set DATABASE_URL, PING_JWKS_URI etc.
pnpm dev
# Or: pnpm start:local (uses NODE_ENV=local with MockJwtAuthGuard)

# Terminal 3: Frontend
cd apps/web
cp .env.example .env.local
# Set NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
pnpm dev
```

---

## 2. CI Pipeline (Pull Requests)

### Triggered by: PR to `main` or `develop`

```yaml
# .github/workflows/ci.yml
Jobs:
  api-test:
    - Checkout
    - Setup Node 20 + pnpm 9
    - Install: pnpm install --frozen-lockfile
    - Type check: pnpm --filter @repo/api type-check
    - Lint: pnpm --filter @repo/api lint
    - Unit tests: pnpm --filter @repo/api test --coverage
    - Integration tests: pnpm --filter @repo/api test:integration (Testcontainers)
    - Dependency scan: pnpm audit --audit-level=high
    - Upload: test results + coverage report

  frontend-test:
    - Checkout
    - Setup Node 20 + pnpm 9
    - Run: pnpm install --frozen-lockfile
    - Run: pnpm --filter @repo/web lint
    - Run: npm test -- --coverage --ci
    - Run: npm audit --audit-level=high
    - Run: npm run build (TypeScript compile check)
    - Upload: coverage report

  security-scan:
    - Run: Trivy container scan (if Docker image built)
    - Run: GitLeaks (secret detection in git history)
    - Report: results as PR comment
```

### CI Quality Gate — Blocks Merge

- All tests passing
- No TypeScript errors
- No ESLint errors
- No CVEs (severity: high+) unless risk-accepted
- No secrets detected in commits

---

## 3. Dev Deployment

### Triggered by: merge to `main`

```yaml
# .github/workflows/deploy-dev.yml
Jobs:
  deploy-api:
    - Configure AWS via OIDC (no long-lived keys):
        role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_DEV }}
        aws-region: ap-southeast-2
    - Install: pnpm install --frozen-lockfile
    - Build container image: pnpm --filter @repo/api build
    - CDK Deploy (pushes new task definition + triggers ECS rolling update):
        pnpm --filter @repo/infra cdk deploy --all -c env=dev
    - Force new deployment if image-only change:
        aws ecs update-service --cluster app-dev --service api-service --force-new-deployment
    - Wait for ECS service to stabilize:
        aws ecs wait services-stable --cluster app-dev --services api-service
    - Verify ALB target health:
        aws elbv2 describe-target-health --target-group-arn $TARGET_GROUP_ARN

  deploy-frontend:
    - Build: pnpm --filter @repo/web build
    - CDK Deploy:
        pnpm --filter @repo/infra cdk deploy --all -c env=dev (CloudFront + S3)

  smoke-test:
    needs: [deploy-api, deploy-frontend]
    - Health check: curl https://api-dev.ppcc.com.au/api/v1/health
    - Verify CloudWatch: no spike in ECS service errors post-deploy
    - Notify: Slack/Teams on success or failure
```

---

## 4. Staging Deployment

### Triggered by: manual approval in GitHub Actions

```yaml
# .github/workflows/deploy-staging.yml
environment: staging   # Requires 1 approver in GitHub settings

Steps (same as dev but with staging config):
  - CDK Deploy to staging account
  - Run E2E tests against staging:
      npx playwright test --project=chromium
  - Performance baseline check:
      k6 run tests/performance/baseline.js
  - Notify approval channel
```

### Staging Checklist (Before Approving)

```
- [ ] Dev deployment successful and stable (24h)
- [ ] All CI checks passing on merge commit
- [ ] DB migration reviewed by DBA (if schema changes)
- [ ] Performance baseline acceptable
- [ ] Security scan clean
- [ ] Release notes prepared
```

---

## 5. Production Deployment

### Triggered by: manual approval (2 approvers required)

```yaml
# .github/workflows/deploy-prod.yml
environment: production   # Requires 2 approvers in GitHub settings

Steps:
  1. Final security scan
  2. CDK diff review (auto-comment on approval request)
  3. DB migration dry-run (if applicable)
  4. CDK Deploy — pushes new ECS task definition revision
  5. ECS rolling update: new tasks start, ALB drains old tasks (minimum healthy 50%, circuit breaker enabled)
  6. Wait for ECS service stable: aws ecs wait services-stable
  7. ALB target-group health check: all registered targets healthy
  8. ECS deployment circuit-breaker auto-rollback if new tasks fail health checks
  9. CloudWatch ALB 5xx rate + ECS CPU/memory monitoring throughout
  10. Post-deploy smoke tests
  11. Update deployment log
```

### Production Deployment Checklist

```
Pre-deployment:
- [ ] Staging deployment successful and stable (48h+)
- [ ] 2 approvals obtained (tech lead + product owner)
- [ ] Change request raised (PPCC change management)
- [ ] Deployment window confirmed (avoid peak hours 9am-5pm AEST)
- [ ] On-call engineer notified
- [ ] Rollback plan confirmed

Database:
- [ ] Migration is backward compatible
  (old code + new schema must work simultaneously)
- [ ] Migration tested on staging with production data volume
- [ ] Undo script tested on staging

During deployment:
- [ ] Monitor CloudWatch error dashboard
- [ ] Monitor X-Ray trace anomalies
- [ ] Monitor RDS CPU and connections
- [ ] Keep deployment window open for 30 min post-deploy

Post-deployment:
- [ ] Smoke tests passing
- [ ] Error rate baseline normal
- [ ] Business metrics normal (Observe dashboard)
- [ ] Close change request
- [ ] Update deployment log
```

---

## 6. Infrastructure as Code (CDK)

### Stack Structure

```
infra/
├── bin/
│   └── app.ts              # CDK app entry point
├── lib/
│   ├── api-stack.ts        # Fargate + internal ALB (ApplicationLoadBalancedFargateService)
│   ├── frontend-stack.ts   # CloudFront + S3
│   ├── database-stack.ts   # RDS + RDS Proxy
│   ├── network-stack.ts    # VPC + DirectConnect attachment
│   ├── monitoring-stack.ts # CloudWatch + alarms
│   └── shared/
│       ├── vpc-config.ts   # VPC lookup (shared across stacks)
│       └── iam-config.ts   # Common IAM patterns
└── test/
    └── *.test.ts           # CDK snapshot tests
```

### CDK Deployment Commands

```bash
# Always via DirectConnect — ensure active before running
# Verify connectivity first:
aws sts get-caller-identity

# Synthesize (no AWS calls)
cd infra && cdk synth

# Review changes (calls AWS — requires DirectConnect)
cd infra && cdk diff ApiStack-dev

# Deploy single stack
cd infra && cdk deploy ApiStack-dev --require-approval never

# Deploy all stacks (in dependency order)
cd infra && cdk deploy --all --require-approval never

# NEVER run in production manually — use GitHub Actions pipeline
```

### CDK Best Practices

```typescript
// Always tag all resources
cdk.Tags.of(app).add('Project', 'my-app');
cdk.Tags.of(app).add('Environment', props.environment);
cdk.Tags.of(app).add('ManagedBy', 'CDK');
cdk.Tags.of(app).add('CostCentre', props.costCentre);

// Always use removal policy RETAIN for stateful resources in prod
new rds.DatabaseInstance(this, 'DB', {
  removalPolicy: isProd
    ? cdk.RemovalPolicy.RETAIN
    : cdk.RemovalPolicy.DESTROY,
});

// Always enable termination protection in prod
new cdk.Stack(scope, id, {
  terminationProtection: isProd,
});
```

---

## 7. Database Migration Deployment

### Migration Execution Flow

```
GitHub Actions builds container image, pushes to ECR
       ↓
CDK Deploy: registers new ECS task definition revision
       ↓
Prisma migrate deploy runs as a one-off ECS RunTask (migration task)
       ↓
Prisma checks _prisma_migrations table
       ↓
Applies pending migrations in order
       ↓
ECS rolling update: new service tasks start (using updated task definition)
       ↓
ALB health check: GET /api/v1/health returns 200 on new tasks
       ↓
ALB drains and deregisters old tasks
```

### Migration Safety Rules

```
1. Never modify a committed migration file
2. New migration must be backward compatible:
   - Old service tasks + new schema: must work (during ECS rolling update, old tasks drain while new ones start)
   - New service tasks + old schema: must work (migration runs before new task definition is promoted)
3. If NOT backward compatible:
   - Phase 1: Add new column (nullable, no constraint)
   - Phase 2: Deploy new code (writes to both old + new)
   - Phase 3: Migrate data
   - Phase 4: Make column NOT NULL
   - Phase 5: Remove old column reference from code
4. Large table changes (>1M rows): schedule maintenance window
```

### Rollback a Migration

```sql
-- Prisma does not support automatic rollback.
-- Write a new migration to reverse the change:
-- prisma migrate dev --name rollback_xxx
-- Deploy as a forward migration.
-- Do NOT manually edit _prisma_migrations rows.
```

---

## 8. Rollback Procedures

### ECS / Fargate Rollback (Fast — < 5 minutes)

```bash
# Option 1 (preferred): re-run previous successful GitHub Actions deployment workflow

# Option 2: force ECS to roll back to the previous stable task definition revision
# ECS deployment circuit breaker handles this automatically when new tasks fail health checks.
# To trigger manually:
aws ecs update-service \
  --cluster app-prod \
  --service api-service \
  --task-definition app-api-prod:{PREVIOUS_REVISION} \
  --force-new-deployment \
  --region ap-southeast-2

# Option 3: via CDK — redeploy the previous known-good git tag
# git checkout <previous-tag> && pnpm --filter @repo/infra cdk deploy --all -c env=prod
```

### Frontend Rollback (Fast — < 2 minutes)

```bash
# Re-deploy previous CloudFront distribution or S3 version
# Trigger previous GitHub Actions workflow run
```

### Database Rollback (Slow — plan required)

```bash
# Option 1: Execute undo SQL manually (if migration is reversible)
# Option 2: Restore from RDS automated snapshot
#   - RDS snapshots taken every 1h in production
#   - Point-in-time recovery available

# CRITICAL: Coordinate with team — data written after migration may be lost
```

### Rollback Decision Tree

```
Error detected post-deploy
        ↓
Is it API service code issue?
  Yes → ECS rollback: re-run previous deployment or update-service to previous task definition revision
        (circuit breaker may have already triggered automatically)
        ↓
Is it DB migration issue?
  Yes → Is data loss acceptable?
    No data written yet → Write a new reverting Prisma migration and deploy
    Data written → Restore from RDS snapshot + redeploy previous task definition revision
        ↓
Is it Frontend issue?
  Yes → Redeploy previous frontend build to CloudFront/S3
```

---

## 9. Post-Deployment Monitoring

### First 30 Minutes

```bash
# Watch CloudWatch ALB 5xx error metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_Target_5XX_Count \
  --dimensions Name=TargetGroup,Value={target-group-arn-suffix} \
  --start-time $(date -u -v-30M +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum

# Watch ECS service running task count (should equal desired count)
aws ecs describe-services --cluster app-prod --services api-service \
  --query 'services[0].{desired:desiredCount,running:runningCount,pending:pendingCount}'

# Check X-Ray for error traces
# CloudWatch Dashboard: [environment]-service-dashboard
# Log group: /app/${stage}/api

# Observe: verify business events flowing
```

### Automated Rollback Triggers (CDK)

```typescript
// ECS deployment circuit breaker — auto-rollback if new tasks fail health checks
const svc = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'ApiService', {
  // ...
  circuitBreaker: { rollback: true },
});

// CloudWatch alarm — triggers manual rollback decision if 5xx rate spikes post-deploy
new cloudwatch.Alarm(this, 'ApiErrorRateAlarm', {
  metric: svc.targetGroup.metrics.httpCodeTarget(
    elbv2.HttpCodeTarget.TARGET_5XX_COUNT,
    { period: cdk.Duration.minutes(1) }
  ),
  threshold: 5,
  evaluationPeriods: 2,
  alarmDescription: 'API 5xx rate high — consider ECS rollback',
}).addAlarmAction(new cwActions.SnsAction(alertTopic));
```

---

## 10. Environment Variables and Secrets

### Never in Code or Pipeline Env Vars

```
✅ Use: AWS Secrets Manager (sensitive — DB passwords, API keys)
✅ Use: AWS Parameter Store (non-sensitive — feature flags, config)
✅ Use: GitHub Actions OIDC (AWS authentication — no long-lived keys)
❌ Never: GitHub Actions secrets for AWS credentials
❌ Never: .env files committed to git
❌ Never: Hardcoded in application.yml
```

### Accessing at Runtime

```typescript
// NestJS Fargate service — Secrets Manager via SDK, resolved at container startup
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
// Resolved in SecretsService.onModuleInit() (or injected via ECS task definition secretsFrom)
// See: apps/api/src/config/secrets.service.ts
process.env.DATABASE_URL = buildDatabaseUrl(resolvedSecret);
```

## Cross-References

- CI/CD commands: `/deploy-pipeline`, `/deploy-prepare`
- CI/CD standards: `@.claude/standards/cicd-standards.md`
- Git workflow standards: `@.claude/standards/git-workflow-standards.md`
- Production release checklist: `@.claude/workflows/production-release-checklist.md`
- Hotfix workflow: `@.claude/workflows/hotfix-workflow.md`
- Infrastructure agents: `@.claude/agents/devops-engineer.md`
- Monitoring: `@.claude/standards/observability-standards.md`
- Security: `@.claude/standards/security-standards.md`
- Feature workflow: `@.claude/workflows/feature-development.md`
- Deployment runbook template: `@.claude/templates/deployment-runbook-template.md`
- Release notes template: `@.claude/templates/release-notes-template.md`

## Token Optimization

- **Load when**: `/deploy-prepare`, `/deploy-pipeline`, release prep, or rollout planning.
- **Load only**: this workflow + `cicd-standards.md` + `deployment-runbook-template.md`. Add `observability-standards.md` only when wiring new alarms.
- **Unload after**: pipeline configured / runbook generated. Framework scope is config-readiness — live deploy execution is out of scope.
- **Hand-off to**: `devops-engineer` for pipeline tuning, `tech-lead` for release sign-off.
