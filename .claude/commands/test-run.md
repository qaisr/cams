---
description: Run test suite with coverage reporting, identify failures and gaps
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# Run Tests

## Input

$ARGUMENTS (optional scope)
Examples:

- `/test-run` — full suite
- `/test-run api` — API tests only
- `/test-run frontend` — frontend tests only
- `/test-run @apps/api/src/modules/orders/orders.service.ts` — specific module/service
- `/test-run coverage-report` — run and produce coverage gap report

## Process

### Step 1: Determine Scope

If $ARGUMENTS is empty → run everything.
If `api` → run API/backend tests only.
If `frontend` → run frontend tests only.
If `@path` → run tests for that specific module/component.

### Step 2: Run Tests

**API Tests**

```bash
!`pnpm --filter @repo/api test --passWithNoTests 2>&1 | tail -30`
```

**API Integration Tests**

```bash
!`pnpm --filter @repo/api test:integration 2>&1 | tail -20`
```

**Frontend Tests**

```bash
!`pnpm --filter @repo/web test --coverage --watchAll=false --ci 2>&1 | tail -30`
```

**Both (default)**

```bash
!`pnpm turbo test --filter='!e2e' 2>&1 | tail -30`
```

### Step 3: Parse Results

From test output, extract:

- Total tests run
- Passed / failed / skipped
- Any failing test names
- Any error messages

### Step 4: Coverage Analysis

**API Coverage (Istanbul/c8)**

```bash
!`cat apps/api/coverage/coverage-summary.json 2>/dev/null | \
  node -e "const d=require('/dev/stdin'); const t=d.total; \
  console.log('Lines:',t.lines.pct+'%, Branches:',t.branches.pct+'%, Functions:',t.functions.pct+'%')" \
  2>/dev/null || echo "Run pnpm test --coverage first"`
```

**Frontend Coverage (Istanbul)**

```bash
!`cat apps/web/coverage/coverage-summary.json 2>/dev/null | \
  node -e "const d=require('/dev/stdin'); const t=d.total; \
  console.log('Lines:',t.lines.pct+'%, Branches:',t.branches.pct+'%, Functions:',t.functions.pct+'%')" \
  2>/dev/null || echo "Coverage summary not available"`
```

### Step 5: Report Results

Output a structured test report:

```
## Test Run Report
**Date**: {date}
**Duration**: {time}

### Results Summary
| Suite | Run | Pass | Fail | Skip | Coverage |
|---|---|---|---|---|---|
| API Unit | {N} | {N} | {N} | {N} | {X}% |
| API Integration | {N} | {N} | {N} | {N} | — |
| Web Unit | {N} | {N} | {N} | {N} | {X}% |
| E2E (if run) | {N} | {N} | {N} | {N} | — |

### Overall Coverage
| Layer | Line Coverage | Branch Coverage | Target | Status |
|---|---|---|---|---|
| NestJS Services | {X}% | {X}% | 80% | ✅/⚠️/❌ |
| NestJS Controllers | {X}% | {X}% | 80% | |
| React Components | {X}% | {X}% | 80% | |

### ❌ Failing Tests
{list each failing test with:}
- Test name
- Error message (condensed)
- File and line

### ⚠️ Coverage Gaps (below 80%)
{list classes/components below threshold}
```

### Step 6: Diagnose Failures

For each failing test:

1. Read the test file and the source file
2. Identify root cause (code bug? test issue? env issue?)
3. Categorise: code bug / test bug / config issue / flaky

Offer to fix:

```
Found {N} failing tests:
1. {TestName} — root cause: {diagnosis}
   Fix: {specific suggestion}

Would you like me to fix these? (yes/no/specific number)
```

### Step 7: Coverage Gap Report (if requested)

If `coverage-report` in arguments or coverage < 80%:

```
## Coverage Gap Analysis

### Modules Below 80%
| Module | Coverage | Uncovered Methods | Suggested Tests |
|---|---|---|---|
| OrderService | 65% | cancelOrder, refund | Add: cancelOrder happy path, refund edge cases |

Run `/add-unit-test for [module] in @[path]` for each gap.
```

## Cross-References

- Unit tests: `/add-unit-test`
- Integration tests: `/add-integration-test`
- E2E tests: `/add-e2e-test`
- Testing standards: `@.claude/standards/testing-standards.md`
