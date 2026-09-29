---
description: Run the full quality checklist before PR or deployment — tests, lint, security, coverage, standards
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# Checklist Verify

## Input

$ARGUMENTS (optional scope: pre-pr | pre-deploy | security | full)
Default: pre-pr

## Purpose

Single command that runs all quality gates in the correct order.
Use before raising a PR or deploying to any environment.

## Process

### Step 1: Determine Scope

| Argument | Checks Run |
|---|---|
| `pre-pr` (default) | lint + tests + coverage + code review |
| `pre-deploy` | all pre-pr + security scan + CDK diff + migration check |
| `security` | security scan only |
| `full` | everything |

### Step 2: Run Checks in Order

#### Check 1: TypeScript Compile

```bash
!`pnpm --filter @repo/web type-check 2>&1 | tail -20`
```

❌ STOP if TypeScript errors found — they indicate broken code.

#### Check 2: Lint

```bash
!`pnpm turbo lint 2>&1 | tail -20`
```

⚠️ Report warnings, ❌ STOP on errors.

#### Check 3: Unit Tests + Coverage

```bash
!`pnpm turbo test --filter='!e2e' 2>&1 | tail -20`
```

❌ STOP if any tests fail.
⚠️ WARN if coverage < 80%.

#### Check 4: Build

```bash
!`pnpm turbo build 2>&1 | tail -10`
```

❌ STOP if build fails.

#### Check 5: Dependency Security Scan

```bash
!`pnpm audit --audit-level=high 2>&1 | tail -15`
```

❌ STOP on critical/high CVEs (unless risk-accepted).

#### Check 6: Secret Detection (basic)

```bash
!`grep -rn "password\s*=\s*['\"][^'\"]\+['\"]" \
  --include="*.ts" --include="*.tsx" \
  --include="*.yml" --include="*.yaml" \
  . 2>/dev/null | grep -v test | grep -v example | grep -v "TODO" | head -10`
```

❌ STOP if real secrets found in non-test code.

#### Check 7: CDK Diff (pre-deploy only)

```bash
!`pnpm --filter @repo/infra cdk diff 2>&1 | head -40`
```

⚠️ FLAG destructive changes for manual review.

#### Check 8: Migration Safety (pre-deploy only)

```bash
!`pnpm prisma migrate status 2>&1 | head -20`
```

For each pending migration, verify:

- Is backward compatible (column additions, new tables, nullable changes)
- Does not drop columns unless coordinated with a prior release

#### Check 9: Code Review (subagent)

```
@tech-lead
Quick review of staged changes:
!`git diff --name-only HEAD 2>/dev/null || git diff --name-only --cached`
Flag only Critical and Security findings.
```

### Step 3: Produce Report

```
## Quality Checklist Report
**Scope**: {pre-pr / pre-deploy / full}
**Date**: {date}
**Branch**: !`git branch --show-current`

### Results
| Check | Status | Details |
|---|---|---|
| TypeScript compile | ✅/❌ | {N errors} |
| Lint | ✅/⚠️/❌ | {N warnings, N errors} |
| Unit tests | ✅/❌ | {N pass, N fail} |
| Test coverage | ✅/⚠️ | API {X}%, Web {X}% |
| Build | ✅/❌ | |
| Dependency scan | ✅/⚠️/❌ | {N high, N critical CVEs} |
| Secret detection | ✅/❌ | |
| CDK diff | ✅/⚠️ | {destructive: Y/N} |
| Migration safety | ✅/⚠️ | {N pending migrations} |
| Code review | ✅/⚠️/❌ | {N critical, N major} |

### Overall: ✅ READY / ⚠️ READY WITH WARNINGS / ❌ NOT READY

### Blocking Issues (must fix before proceeding)
{list any ❌ items with specific fix instructions}

### Warnings (review but not blocking)
{list any ⚠️ items}
```

### Step 4: Offer Fixes

For common fixable issues:

```
Some issues can be auto-fixed. Would you like me to:
- [ ] Fix lint errors automatically (pnpm turbo lint:fix)
- [ ] Format code (pnpm format)
- [ ] Generate types from OpenAPI (pnpm generate:types)

Reply with numbers to run fixes (e.g., "1 2") or "skip"
```

## Cross-References

- Pre-deployment: `/deploy-prepare`
- Tests: `/test-run`
- Security: `/security-audit`
- Code review: `/review-code`
