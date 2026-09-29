---
name: review-tests
description: >
  Targeted test quality review. Evaluates test pyramid balance, test quality
  signals, mocking correctness, coverage meaningfulness, and missing scenarios.
  Run after implementation changes or as a standalone quality gate.
version: 1.0.0
requires:
  agents:
    - .claude/agents/test-strategist.md
interaction: conversational
phases: 4
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# 🧪 Test Review Command

A focused, interactive review of your test suite quality — not just coverage numbers,
but whether your tests actually give you confidence.

**Ground Rules for Claude:**
- Coverage numbers alone are not quality — always look at what is actually tested
- Show real test code from the codebase when identifying issues
- Distinguish between "tests that give false confidence" (worse than no tests) and
  "tests that are simply missing" (gap, not danger)
- Never suggest adding tests just to increase coverage metrics

---

## PHASE 1 — REVIEW CONFIGURATION

```
🧪 Test Quality Review

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — What do you want to review?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 [1]  Full test suite           (API + frontend + E2E)
 [2]  Backend tests only        (Jest, Supertest integration tests)
 [3]  Frontend tests only       (Jest, React Testing Library, MSW)
 [4]  E2E tests only            (Playwright)
 [5]  Specific feature or module tests — I'll specify

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
STEP 2 — What aspect concerns you most?

 [1]  Test pyramid balance      (too many E2E? not enough unit tests?)
 [2]  Test quality              (are tests actually testing the right things?)
 [3]  Mocking strategy          (over-mocked? under-mocked?)
 [4]  Missing coverage          (what critical paths have no tests?)
 [5]  Test data management      (builders? factories? fixtures? none?)
 [6]  Test performance          (slow test suite?)
 [7]  All of the above

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
STEP 3 — Context

  What recently changed that prompted this review?
  (or type  routine  if this is a standard quality check)
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
STEP 4 — Do you have a coverage report available?

 [Y]  Yes — I'll paste or reference it
 [N]  No  — analyze test files directly

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

---

## PHASE 2 — TEST ANALYSIS

Invoke `.claude/agents/test-strategist.md`.

### 2.1 — Test Pyramid Snapshot

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST PYRAMID SNAPSHOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  ╱ E2E ╲
                 ╱  [n]  ╲
                ╱──────────╲
               ╱Integration ╲
              ╱     [n]      ╲
             ╱────────────────╲
            ╱    Unit Tests    ╲
           ╱       [n]          ╲
          ╲────────────────────╱

  Backend  : [n] unit / [n] integration (Supertest) / [n] E2E
  Frontend : [n] unit / [n] integration (MSW) / [n] E2E

Pyramid shape: [IDEAL / TOP-HEAVY / BOTTOM-HEAVY / INVERTED / MISSING LAYERS]
Assessment  : [honest analysis of what this means]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2.2 — Quality Signal Analysis

For each issue found, use this format:

```
──────────────────────────────────────────
[Issue Title]                             [🔴/🟠/🟡]
──────────────────────────────────────────
Signal     : [BAD SIGNAL TYPE — e.g. "Tests implementation detail"]
Location   : [file path, test method name]
Test code  :
  ```ts
  [ACTUAL TEST CODE from codebase]
  ```
Problem    : [specific explanation of what's wrong with this test]
Risk       : [what false confidence this creates, or what gap this leaves]

Improved version:
  ```ts
  [refactored test]
  ```
──────────────────────────────────────────
```

### 2.3 — Missing Scenario Identification

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MISSING TEST SCENARIOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
These critical paths exist in the codebase but have no tests:

 🔴 [scenario] — [why critical]    [file with untested code]
 🟠 [scenario] — [why important]   [file]
 🟡 [scenario] — [nice to have]    [file]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

After full analysis:

```
Type  continue  to see improvement options.
```

**[WAIT FOR USER INPUT]**

---

## PHASE 3 — IMPROVEMENT OPTIONS

For each significant finding:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPROVEMENT — [Issue Title]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Option A — Fix existing test
  [refactored test with explanation]

Option B — Replace with different test type
  [e.g. "this unit test would be more valuable as an integration test"]

Option C — Delete test (if it gives false confidence)
  [explanation of why deleting is better than keeping]

Option D — Skip for now
  [what gap remains and when to revisit]

Your choice? [A / B / C / D]
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT per finding]**

---

## PHASE 4 — IMPLEMENTATION

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST IMPROVEMENT PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Will implement : [n] test improvements
New tests      : [n] missing scenarios to add
Tests to delete: [n] false-confidence tests

Shall I implement these now?
  [Y]  Yes — implement with confirmation per change
  [R]  Report only
  [P]  Partial — only the critical ones
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**[WAIT FOR USER INPUT]**

Follow Phase 5 implementation pattern from `implement-best-practices.md`.

After completion:
```
Do you want me to update the .claude framework to reflect 
any new testing standards established in this review?
  [Y]  Yes — run framework sync
  [N]  No
```

**[WAIT FOR USER INPUT]**

If Y: Invoke `.claude/workflows/framework-sync.md`.

Reusable templates:
- `@.claude/templates/navigation-test-cases-template.md`
- `@.claude/templates/pagination-test-cases-template.md`
- `@.claude/templates/accessibility-test-cases-template.md`
