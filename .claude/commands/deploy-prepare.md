---
description: Pre-deployment checklist — tests, security, CDK diff, migration review, runbook
agent: devops-engineer
subtask: true
---

# Deployment Preparation

## Input

$ARGUMENTS (environment: dev | staging | prod)
Default: dev

## Process

### 1. Environment Config

```bash
!`echo "Preparing deployment to: $ARGUMENTS"`
!`git log --oneline -5`
!`git status`
```

### 2. Run Full Test Suite

```bash
!`pnpm turbo test --filter='!e2e'`
!`pnpm turbo build`
```

STOP if any tests fail. Do not proceed.

### 3. Security Scan

```bash
!`pnpm audit --audit-level=high`
```

STOP if critical/high CVEs found unmitigated.

### 4. CDK Diff

```bash
!`pnpm --filter @repo/infra cdk diff 2>&1`
```

Review and summarise:

- Resources being added
- Resources being modified
- Resources being destroyed (flag as HIGH RISK)
- IAM changes (flag for security review)

### 5. Migration Review

```bash
!`pnpm prisma migrate status 2>&1 | head -30`
```

For each pending migration:

- Verify it is backward compatible
- Check for missing indexes, PII columns

### 6. Pre-Deployment Checklist

```
Environment: {env}
Date: {date}
Deployer: {git config user.name}

Quality Gates:
- [ ] All tests passing (unit + integration + E2E)
- [ ] Test coverage ≥ 80%
- [ ] Security scan: no critical/high CVEs
- [ ] Code review approved
- [ ] CDK diff reviewed

Database:
- [ ] Migrations are backward compatible (`prisma migrate status`)
- [ ] No pending migrations without review
- [ ] PII columns identified
- [ ] No breaking schema changes

Infrastructure:
- [ ] No destructive CDK changes (unless planned)
- [ ] IAM changes reviewed
- [ ] CloudWatch alarms configured
- [ ] DirectConnect connectivity verified

Security:
- [ ] PingID auth on all new endpoints
- [ ] No secrets in code
- [ ] CORS restricted to PPCC domains
- [ ] Rate limiting configured

Rollback Plan:
- [ ] Rollback steps documented
- [ ] Previous version tag known: !`git describe --tags --abbrev=0`
- [ ] DB migration rollback script ready
```

### 7. Deployment Instructions

For **dev**:

```bash
# Automated via GitHub Actions on push to main
git push origin feature/branch
# Create PR → merge → GitHub Actions deploys to dev
```

For **staging/prod**:

```bash
# Requires GitHub Actions environment approval
# Go to GitHub Actions → Select workflow run → Approve deployment
# Monitor: CloudWatch dashboard, X-Ray traces
```

### 8. Post-Deployment Verification

```bash
# Health check
curl -H "X-Correlation-Id: deploy-verify-001" \
  https://api-{env}.ppcc.com.au/api/v1/health

# Check CloudWatch for errors in first 5 minutes
# Check X-Ray for trace anomalies
```

## Cross-References

- Pipeline: `/deploy-pipeline`
- Monitoring: `/monitor-setup`
- Rollback: `/rollback-plan`
- Standards: `@.claude/workflows/deployment.md`
