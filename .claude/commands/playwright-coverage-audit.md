---
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# Command: playwright-coverage-audit

Identify which application pages and features lack E2E test coverage,
then generate a prioritised coverage roadmap.

## Usage

```
/playwright-coverage-audit [path]
```

**Default:** `apps/web`

---

## Agent Role

You are a **Test Strategist**. You map the application surface area against
existing tests and produce an actionable, prioritised gap analysis.

---

## EXECUTION PROTOCOL

### PHASE 1 — Map Application Surface

Collect all application routes:
```bash
# App Router pages
find apps/web/app -name "page.tsx" | sort

# Extract route paths from file structure
# apps/web/app/(protected)/users/page.tsx → /users
# apps/web/app/(protected)/users/[id]/page.tsx → /users/:id
```

For each route, extract:
- Route path
- Primary entity/feature name
- Interactive elements count (buttons, forms, inputs)
- Has authentication guard? (check for auth HOC/middleware)
- Is it a list, detail, form, or dashboard page?

### PHASE 2 — Map Existing Test Coverage

```bash
find apps/web/e2e -name "*.spec.ts" | sort
```

For each spec file, extract:
- Which routes are visited (`page.goto()` calls)
- Which features are tested (by describe block name)
- Test count and tags

### PHASE 3 — Gap Analysis

Produce a coverage matrix:

```
COVERAGE MATRIX
───────────────────────────────────────────────────────────────
Route                    | Type   | Tests | Smoke | A11y | Priority
─────────────────────────|────────|────---|-------|------|─────────
/users                   | List   |  12   |  ✅   |  ✅  | ✅ Done
/users/[id]              | Detail |   0   |  ❌   |  ❌  | 🔴 HIGH
/users/new               | Form   |   3   |  ✅   |  ❌  | 🟡 MED
/invoices                | List   |   0   |  ❌   |  ❌  | 🔴 HIGH
/invoices/[id]           | Detail |   0   |  ❌   |  ❌  | 🔴 HIGH
/pipeline                | Custom |   5   |  ✅   |  ❌  | 🟡 MED
/settings                | Form   |   0   |  ❌   |  ❌  | 🟡 MED
/dashboard               | View   |   2   |  ✅   |  ❌  | 🟢 LOW
───────────────────────────────────────────────────────────────
Coverage: 22/56 tests across 3/8 routes (38%)
```

### PHASE 4 — Priority Scoring

Score each uncovered route (1-10) based on:
- **Business criticality** (CRUD for primary entities = high)
- **User traffic** (infer from route name/type)
- **Complexity** (form with validation > read-only display)
- **Risk** (auth-guarded + write operations = highest risk)

### PHASE 5 — Output Roadmap

```markdown
# E2E Coverage Roadmap

## Current Coverage: 38% (3/8 routes)

## Priority Queue (run /add-e2e-test for each)

### 🔴 HIGH PRIORITY (Week 1)
1. /invoices        → /add-e2e-test apps/web/src/features/invoices --coverage=full
2. /invoices/[id]   → /add-e2e-test apps/web/src/features/invoices/detail --coverage=full
3. /users/[id]      → /add-e2e-test apps/web/src/features/users/detail --coverage=smoke

### 🟡 MEDIUM PRIORITY (Week 2)
4. /users/new       → /add-e2e-test apps/web/src/features/users/form --coverage=accessibility
5. /settings        → /add-e2e-test apps/web/src/features/settings --coverage=smoke

### 🟢 LOW PRIORITY (Week 3+)
6. /dashboard       → add accessibility tests to existing spec

## Estimated test count to reach 80% coverage: ~85 new tests
```

Save roadmap to: `apps/web/e2e/COVERAGE-ROADMAP.md`
