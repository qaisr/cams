# Workflow: Hotfix Workflow

> **Operating Discipline (always applies).** Follow `@.claude/CLAUDE.md` → Operating Discipline throughout this workflow: never hallucinate paths/APIs/versions, never assume intent to fill a gap, never implement unrequested scope, clarify ambiguities before acting, and get **explicit human approval** before anything hard-to-reverse or beyond the stated request. Report faithfully what was done, skipped, or failed.


## Purpose
Fast-track critical production fixes while maintaining quality gates.

## When to Use
- Production error rate > 5%
- Data integrity issue affecting users
- Security vulnerability (CVSS > 7.0)
- Complete feature outage

## Do NOT Use For
- Performance improvements (use normal release)
- Minor UI bugs (use normal release)
- Non-urgent feature fixes (use normal release)

## Agents
- `tech-lead` (owns the process)
- `security-auditor` (if security-related)
- `devops-engineer` (deployment)

## Process

### Step 1: Create Hotfix Branch (< 5 minutes)
```bash
git checkout main
git pull origin main
git checkout -b hotfix/YYYY-MM-DD-short-description
```

### Step 2: Implement Fix
- Change MUST be minimal — no refactoring
- Change MUST include: fix + unit test that proves the fix
- Change MUST NOT include unrelated changes

### Step 3: Fast-Track Quality Gates (run locally)
```bash
# Non-negotiable — must all pass
pnpm turbo run typecheck
pnpm turbo run lint
pnpm turbo run test:unit
pnpm turbo run build
```

Run targeted integration/E2E test for affected area:
```bash
pnpm playwright test --grep "affected-feature"
```

### Step 4: PR + Emergency Review
- Open PR to `main`
- Add label: `hotfix` + `priority:critical`
- Request 1 reviewer (not 2 — time sensitive)
- Include in PR description:
  - Root cause
  - Fix description
  - Test evidence
  - Rollback plan

### Step 5: Merge + Auto-deploy to Staging
```bash
# Squash merge to main
# CI runs full pipeline (parallel, ~10min)
# Auto-deploys to staging on success
```

### Step 6: Staging Smoke Test (< 5 minutes)
```bash
pnpm playwright test --project=smoke --base-url=https://staging.app.com
```

### Step 7: Production Deploy
```bash
# Tag for production release
git tag v$(cat package.json | jq -r .version)-hotfix-$(date +%Y%m%d%H%M)
git push origin --tags

# CI deploys to production automatically on tag
# Monitor CloudWatch dashboard for 15 minutes
```

### Step 8: Post-Hotfix
Within 48 hours:
- [ ] Write incident report (`docs/incidents/YYYY-MM-DD-title.md`)
- [ ] Create backlog ticket for proper fix if hotfix was workaround
- [ ] Update runbook if new failure mode discovered
- [ ] Schedule post-mortem if P1 incident

## Rollback (if hotfix makes it worse)
```bash
# Immediate: revert to previous ECS task definition revision
# (ECS circuit breaker may have already triggered this automatically)
aws ecs update-service \
  --cluster app-prod \
  --service api-service \
  --task-definition app-api-prod:$PREVIOUS_REVISION \
  --force-new-deployment

# Then revert in code
git revert HEAD
git push origin main
```

## Incident Report Template
```markdown
# Incident: [Title]
**Date:** YYYY-MM-DD
**Severity:** P1/P2
**Duration:** Xh Ym
**Impact:** [Users affected, features impacted]

## Timeline
- HH:MM - Issue detected
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Issue resolved

## Root Cause
[Technical explanation]

## Fix
[What was changed and why it works]

## Prevention
[What will we do to prevent recurrence]
```

## Token Optimization

- **Load when**: critical production incident requiring fast-track fix.
- **Load only**: this workflow + the standards directly relevant to the failing area (e.g., security-standards for auth incidents). Skip everything else for speed.
- **Minimal quality gates by design** — full quality gate runs in the follow-up regular release.
- **Unload after**: hotfix deployed and post-incident review scheduled.
- **Hand-off to**: `tech-lead` for post-incident review, `devops-engineer` for any infra changes, originating agent for follow-up regression tests.
