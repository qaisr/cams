# CI/CD Standards

## Pipeline Stages (in order)
```
1. validate     → lint, typecheck, format-check
2. test         → unit, integration (with testcontainers)
3. build        → turbo build (all apps/packages)
4. security     → Snyk SCA, Sonar SAST, secret scanning
5. e2e          → Playwright against built app
6. deploy-stg   → CDK deploy to staging (main branch only)
7. smoke-stg    → Playwright smoke suite against staging
8. deploy-prod  → CDK deploy to production (tag only)
9. smoke-prod   → Playwright smoke suite against production
```

## Branch Strategy
| Branch | Deploys To | Rules |
|--------|-----------|-------|
| `feature/*` | None | PR required, 1 approval |
| `main` | Staging | Squash merge only, all checks pass |
| `release/v*` | Production | Tag triggers deploy, 2 approvals |
| `hotfix/*` | Staging → Production | See hotfix workflow |

## Quality Gates (Block Merge)
- [ ] ESLint: zero errors, zero warnings (policy: error)
- [ ] TypeScript: zero type errors (`tsc --noEmit`)
- [ ] Unit tests: 100% pass, coverage ≥ 80% lines
- [ ] Integration tests: 100% pass
- [ ] Snyk: no critical vulnerabilities
- [ ] Sonar Quality Gate: passed
- [ ] Bundle size within budget (`size-limit` check)
- [ ] No secrets detected (`git-secrets` / `trufflehog`)

## Environment Variables
- Secrets in AWS Secrets Manager — never in `.env` committed to repo
- `.env.example` committed with all keys, no values
- CI reads from GitHub Actions secrets → injected at build time
- Runtime reads from CDK context / AWS SSM Parameter Store

## Deployment Rules
- Zero-downtime ECS Fargate deployments via rolling update (`circuitBreaker: { rollback: true }`)
- Deploy with `cdk deploy app-{stage}-api` then `aws ecs update-service --force-new-deployment` to drain old tasks
- Database migrations run as pre-deploy step with rollback on failure
- Feature flags used for risky features (never deploy dark code)
- Rollback: redeploy last known-good tag (`git checkout <tag> && cdk deploy --all`) — CloudFormation auto-rolls-back failed deploys

## Artifact Standards
- Docker images tagged with git SHA (never `latest` in production)
- CDK output (`cdk.out`) and CloudFormation state stored in S3 with versioning enabled
- Build artifacts retained 30 days in CI

## Notifications
- Slack alert on: deploy failure, Snyk critical, Sonar gate fail
- PagerDuty on: production deploy failure, smoke test failure

## Token Optimization
Load for: CI/CD pipeline work, GitHub Actions, deployment tasks,
quality gate configuration. Unload for feature development.
