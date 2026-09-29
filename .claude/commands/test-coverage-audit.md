---
name: test-coverage-audit
description: >
  Analyse test coverage across the monorepo. Identifies untested branches,
  missing scenarios, false-confidence tests, and generates a prioritised
  improvement plan. Combines coverage report analysis with source code
  inspection — not just numbers.
version: 1.0.0
requires:
  agents:
    - .claude/agents/test-strategist.md
arguments:
  - name: SCOPE
    required: false
    default: "all"
    examples:
      - "apps/api/src/modules/users"
      - "apps/web/src/components"
      - "all"
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# Test Coverage Audit

## Input
$ARGUMENTS (default: all)

---

## Phase 1 — Collect Coverage Data

```bash
# Backend coverage
pnpm --filter @repo/api test \
  --coverage \
  --coverageReporters=json-summary \
  --coverageReporters=text \
  --silent 2>&1 | tee /tmp/api-coverage.txt

# Frontend coverage
pnpm --filter @repo/web test \
  --coverage \
  --coverageReporters=json-summary \
  --coverageReporters=text \
  --silent 2>&1 | tee /tmp/web-coverage.txt

# Count test files per layer
echo "=== TEST FILE COUNTS ==="
echo "Backend unit:        $(find apps/api/src -name '*.spec.ts' ! -name '*.integration.spec.ts' | wc -l)"
echo "Backend integration: $(find apps/api/src -name '*.integration.spec.ts' | wc -l)"
echo "API contract:        $(find apps/api/src/test/api -name '*.api.spec.ts' 2>/dev/null | wc -l)"
echo "Frontend unit:       $(find apps/web/src -name '*.test.tsx' -o -name '*.test.ts' | wc -l)"
echo "E2E:                 $(find apps/web/e2e -name '*.spec.ts' | wc -l)"
```

---

## Phase 2 — Invoke Test Strategist

Delegate to `@.claude/agents/test-strategist.md` for deep analysis.

Pass:
- Coverage report output
- Test file counts
- Scope from $ARGUMENTS

---

## Phase 3 — Source Gap Analysis

Find source files with no corresponding test file:

```bash
# Backend services with no spec
find apps/api/src -name "*.service.ts" ! -name "*.spec.ts" | while read f; do
  spec="${f%.service.ts}.service.spec.ts"
  if [ ! -f "$spec" ]; then
    echo "MISSING UNIT TEST: $f"
  fi
done

# Backend controllers with no spec
find apps/api/src -name "*.controller.ts" ! -name "*.spec.ts" | while read f; do
  spec="${f%.controller.ts}.controller.spec.ts"
  if [ ! -f "$spec" ]; then
    echo "MISSING UNIT TEST: $f"
  fi
done

# Frontend components with no test
find apps/web/src/components -name "*.tsx" ! -name "*.stories.tsx" | while read f; do
  test="${f%.tsx}.test.tsx"
  if [ ! -f "$test" ]; then
    echo "MISSING COMPONENT TEST: $f"
  fi
done

# Integration tests missing
find apps/api/src/modules -maxdepth 1 -type d | while read d; do
  if ! find "$d" -name "*.integration.spec.ts" | grep -q .; then
    echo "MISSING INTEGRATION TEST: $d"
  fi
done
```

---

## Phase 4 — Generate Report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST COVERAGE AUDIT REPORT
Date: {DATE}
Scope: {SCOPE}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEST PYRAMID
                  ╱ E2E ╲
                 ╱  [n]  ╲      [%] of total
                ╱──────────╲
               ╱Integration ╲
              ╱     [n]      ╲  [%] of total
             ╱────────────────╲
            ╱  Unit Tests      ╲
           ╱    [n] back / [n] front ╲ [%] of total
          ╲────────────────────────╱

Shape: [IDEAL / TOP-HEAVY / INVERTED / MISSING LAYERS]

COVERAGE NUMBERS
┌─────────────────────┬──────────┬──────────┬──────────┬──────────┐
│ Package             │ Lines    │ Branches │ Functions│ Status   │
├─────────────────────┼──────────┼──────────┼──────────┼──────────┤
│ apps/api (unit)     │ [n]%     │ [n]%     │ [n]%     │ ✅/🔴   │
│ apps/api (integ)    │ [n]%     │ [n]%     │ [n]%     │ ✅/🔴   │
│ apps/web            │ [n]%     │ [n]%     │ [n]%     │ ✅/🔴   │
└─────────────────────┴──────────┴──────────┴──────────┴──────────┘
Thresholds: 80% branches / 85% lines — from testing-standards.md

MISSING TEST FILES
🔴 [file] — [why critical]
🟠 [file] — [why important]

LOWEST COVERAGE MODULES (Bottom 10)
1. [module] — [n]% branches — [why it matters]
2. ...

CRITICAL GAPS (False Confidence — Fix First)
🔴 [test name] in [file]
   Problem: [what false confidence this creates]

HIGH GAPS (Missing Scenarios)
🟠 [untested scenario] in [module]
   What's missing: [specific branch/path]

MEDIUM GAPS (Quality / Maintainability)
🟡 [issue]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECOMMENDED ACTIONS (Priority Order)
1. [Action] — [command to run] — [estimated impact]
2. ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Phase 5 — Interactive Improvement

```
Would you like me to:
[G]  Generate missing test files (highest priority first)
[F]  Fix false-confidence tests
[P]  Print a prioritised backlog only (no changes)
[Q]  Quit
```

**[WAIT FOR USER INPUT]**

If G or F: invoke `/add-unit-test` or `/add-integration-test` for each gap.

---

## Cross-References
- Standards: `@.claude/standards/testing-standards.md`
- Agent: `@.claude/agents/test-strategist.md`
- Unit tests: `/add-unit-test`
- Integration tests: `/add-integration-test`
