# Production Release Checklist

## Overview
Comprehensive checklist for deploying features to production ensuring quality, security, and reliability.

## Pre-Release Checklist

### 1. Code Quality
**Agent**: `tech-lead`

- [ ] All code reviewed and approved
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code coverage > 80% (`npm run test:coverage`)
- [ ] No console.log statements in production code
- [ ] No commented-out code blocks
- [ ] All TODOs resolved or tracked in issues

### 2. Testing
**Agent**: `test-engineer`

- [ ] Unit tests pass (`npm run test:unit`)
- [ ] Integration tests pass (`npm run test:integration`)
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] Contract tests pass (API matches OpenAPI spec)
- [ ] Load tests pass (performance within budget)
- [ ] Accessibility tests pass (axe-core, Lighthouse)
- [ ] Browser compatibility tested (Chrome, Firefox, Safari, Edge)

### 3. Security
**Agent**: `security-auditor`

- [ ] Snyk scan passes (no critical/high vulnerabilities)
- [ ] SonarQube quality gate passes
- [ ] No hardcoded secrets or credentials
- [ ] Environment variables validated
- [ ] OWASP Top 10 checks completed
- [ ] Authentication/authorization tested
- [ ] Input validation implemented (Zod schemas)
- [ ] Rate limiting configured
- [ ] CORS policy reviewed

### 4. Database
**Agent**: `database-analyst`, `data-migration-specialist`

- [ ] Database migrations tested on production-like data
- [ ] Rollback script tested
- [ ] Indexes added for new queries
- [ ] No breaking schema changes (or API version bumped)
- [ ] Data integrity checks pass
- [ ] Database backup created

### 5. Documentation
**Agent**: `tech-lead`

- [ ] API documentation updated (OpenAPI spec)
- [ ] README updated
- [ ] Changelog updated (release notes)
- [ ] Migration guide created (if breaking changes)
- [ ] Deployment notes documented
- [ ] Rollback procedure documented

### 6. Infrastructure
**Agent**: `devops-engineer`

- [ ] CDK stacks deploy successfully (`cdk deploy`)
- [ ] Environment variables configured (staging + prod)
- [ ] CloudWatch alarms configured
- [ ] Fargate task CPU/memory sized correctly; autoscaling policy reviewed
- [ ] RDS Proxy configured (if needed)
- [ ] CDN cache invalidation plan (if needed)

### 7. Monitoring & Alerting
**Agent**: `devops-engineer`

- [ ] CloudWatch dashboard created
- [ ] Alerts configured (errors, latency, DLQ)
- [ ] Health check endpoint responding
- [ ] Error tracking configured (Sentry)
- [ ] Metrics emitted for key operations
- [ ] Logging validated (structured JSON logs)

### 8. Feature Flags
**Agent**: `backend-engineer`

- [ ] Feature flags configured (if applicable)
- [ ] Gradual rollout plan defined
- [ ] Kill switch tested (can disable feature)

## Deployment Steps

### 1. Pre-Deployment
```bash
# 1. Create database backup
aws rds create-db-snapshot \
  --db-instance-identifier myapp-prod \
  --db-snapshot-identifier pre-release-$(date +%Y%m%d-%H%M%S)

# 2. Create git tag
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0

# 3. Generate release notes
npm run release:notes
```

### 2. Deploy to Staging
```bash
# 1. Deploy infrastructure
npm run deploy:staging

# 2. Apply database migrations
npx prisma migrate deploy --schema=./prisma/schema.prisma

# 3. Run smoke tests
npm run test:smoke -- --env=staging

# 4. Manual QA testing
# - Test critical user flows
# - Verify new features
# - Check for regressions
```

### 3. Deploy to Production
```bash
# 1. Deploy infrastructure
npm run deploy:production

# 2. Apply database migrations
npx prisma migrate deploy --schema=./prisma/schema.prisma

# 3. Invalidate CDN cache (if needed)
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION_ID \
  --paths "/*"

# 4. Monitor deployment
# - Check CloudWatch logs for errors
# - Verify health check endpoint
# - Monitor error rates and latency
```

### 4. Post-Deployment Validation
```bash
# 1. Run smoke tests
npm run test:smoke -- --env=production

# 2. Verify critical flows
# - User login/logout
# - Data CRUD operations
# - Payment flows (if applicable)

# 3. Check metrics
# - API error rate < 1%
# - API latency p95 < 500ms
# - No DLQ messages
```

## Post-Release Checklist

### 1. Monitoring (First 24 Hours)
**Agent**: `devops-engineer`

- [ ] No critical errors in CloudWatch logs
- [ ] Error rate < 1%
- [ ] API latency within budget (p95 < 500ms)
- [ ] No DLQ messages
- [ ] Health check endpoint responding
- [ ] Database performance normal

### 2. Communication
**Agent**: `product-owner`

- [ ] Release notes published
- [ ] Stakeholders notified
- [ ] Customer support briefed
- [ ] Marketing team notified (if user-facing features)

### 3. Cleanup (After 1 Week)
**Agent**: `tech-lead`

- [ ] Remove old feature flags (if full rollout)
- [ ] Archive old API versions (if deprecated)
- [ ] Delete old database columns (after migration validation)
- [ ] Update documentation (remove deprecated features)

## Rollback Procedure

### When to Rollback
- Critical bug affecting users
- Error rate > 5%
- API latency degradation > 100%
- Database corruption
- Security vulnerability

### Rollback Steps
```bash
# 1. Revert application deployment
npm run deploy:production -- --stage=prod --rollback

# 2. Revert database migration (if needed)
npx prisma migrate rollback

# 3. Invalidate CDN cache
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION_ID \
  --paths "/*"

# 4. Notify stakeholders
# - Send incident notification
# - Update status page

# 5. Investigate root cause
# - Review CloudWatch logs
# - Analyze metrics
# - Document findings
```

## Release Approval

### Approvers
- [ ] Tech Lead: Code quality, architecture
- [ ] QA Lead: Testing completed
- [ ] Security Lead: Security scan passes
- [ ] DevOps Lead: Infrastructure ready
- [ ] Product Owner: Feature acceptance

### Approval Criteria
- All checklists completed
- Critical bugs resolved
- Performance within budget
- Security scan passes

## Release Schedule

### Regular Releases
- **Frequency**: Every 2 weeks (Sprint cycle)
- **Day**: Wednesday (mid-week)
- **Time**: 10 AM UTC (avoid peak traffic)
- **Duration**: 1-2 hours (including validation)

### Hotfix Releases
- **Frequency**: As needed (critical bugs only)
- **Approval**: Tech Lead + Product Owner
- **Communication**: Immediate notification to stakeholders

## Rollback Success Criteria
- [ ] Application responding (health check)
- [ ] Error rate < 1%
- [ ] API latency normal
- [ ] No data corruption
- [ ] All tests passing

## Related
- `.claude/workflows/deployment.md`
- `.claude/templates/release-notes-template.md`
- `.claude/workflows/database-migration-workflow.md`
- `.claude/standards/quality-gate-standards.md`

## Token Optimization

- **Load when**: `/pre-release-check` or final release-gate review.
- **Load only**: this checklist + `quality-gate-standards.md`. Other standards are referenced by name only — load them only if a gate fails.
- **Read-only verification** — checklist drives GO/NO-GO; this workflow does not implement changes.
- **Unload after**: GO/NO-GO recorded. Failed gates hand off to specialist agents.
- **Hand-off to**: `tech-lead` for final sign-off, originating agents to fix failed gates.
