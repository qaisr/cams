---
description: Generate or update GitHub Actions CI/CD pipeline
agent: devops-engineer
subtask: true
---

# CI/CD Pipeline Setup

## Input

$ARGUMENTS (pipeline type: full | api-only | frontend-only | update)

## Process

### 1. Read Context

- Read existing `.github/workflows/` if any
- Read `infra/` CDK structure
- Query CEB MCP: "PPCC GitHub Actions standards"
- Load: `@.claude/workflows/deployment.md`

### 2. Generate Pipeline

Full pipeline structure:

```

.github/workflows/
├── ci.yml          # PR checks (test + lint + security scan)
├── deploy-dev.yml  # Auto-deploy to dev on merge to main
├── deploy-staging.yml  # Manual approval → staging
└── deploy-prod.yml     # Manual approval → prod

```

### 3. CI Pipeline (ci.yml)

```yaml
name: CI
on:
  pull_request:
    branches: [main, develop]
permissions:
  id-token: write
  contents: read
  pull-requests: write

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo type-check
      - run: pnpm turbo lint
      - run: pnpm turbo test --filter='!e2e'
      - run: pnpm audit --audit-level=high
      - run: pnpm turbo build
```

### 4. Deploy Pipeline

Follow pattern from `@.claude/agents/devops-engineer.md`:

- OIDC authentication (no long-lived keys)
- Environment-specific approval gates
- CDK deploy (`cdk deploy`) with context `--context env={env}`
- Post-deploy health check via API Gateway endpoint

### 5. Required GitHub Secrets/Variables

```
Secrets (per environment):
  AWS_DEPLOY_ROLE_ARN    — OIDC role ARN for CDK deployment

Variables (per environment):
  AWS_REGION             — ap-southeast-2
  API_BASE_URL           — environment API URL
  E2E_BASE_URL           — environment frontend URL
```

### 6. Branch Protection Rules

Document required settings:

```
main branch:
- Require PR reviews: 1 minimum
- Require status checks: ci / api-test, ci / frontend-test
- Require branches up to date
- No direct pushes (admins included for prod)
```

## Output Files

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-dev.yml`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-prod.yml`

## Cross-References

- Deploy prep: `/deploy-prepare`
- CI/CD standards: `@.claude/standards/cicd-standards.md`
- Git workflow standards: `@.claude/standards/git-workflow-standards.md`
- Production release checklist: `@.claude/workflows/production-release-checklist.md`
- Hotfix workflow: `@.claude/workflows/hotfix-workflow.md`
- Deployment workflow: `@.claude/workflows/deployment.md`
- Infrastructure: `@.claude/agents/devops-engineer.md`
- Secrets: `@.claude/standards/security-standards.md`
- CI pipeline template: `@.claude/templates/github-actions-ci.yml`
- Deploy pipeline template: `@.claude/templates/github-actions-deploy.yml`

```
