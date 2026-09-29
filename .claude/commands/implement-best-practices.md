---
name: implement-best-practices
description: >
  Interactive, multi-phase command for analyzing, evaluating, and implementing
  enterprise best practices across the full-stack codebase with risk assessment,
  alternative solutions, and framework sync.
version: 2.0.0
requires:
  agents:
    - .claude/agents/security-auditor.md
    - .claude/agents/architecture-reviewer.md
    - .claude/agents/test-strategist.md
    - .claude/agents/database-analyst.md
  workflows:
    - .claude/workflows/best-practices-analysis.md
    - .claude/workflows/best-practices-refactor.md
    - .claude/workflows/framework-sync.md
  standards:
    - .claude/standards/security-standards.md
    - .claude/standards/testing-standards.md
    - .claude/standards/api-standards.md
    - .claude/standards/frontend-standards.md
    - .claude/standards/architecture-design-standards.md
    - .claude/standards/database-standards.md
interaction: conversational
phases: 6
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# 🏗️ Best Practices Implementation Command

This is a multi-phase interactive session. Claude will guide you through each phase,
wait for your responses, and never proceed to the next phase without your confirmation.

**Ground Rules for Claude:**
- ALWAYS wait for user input before proceeding to the next phase
- NEVER make code changes without explicit user confirmation in Phase 5
- Present HONEST trade-offs — do not recommend everything as "must-do"
- Distinguish between CRITICAL issues, IMPORTANT improvements, and NICE-TO-HAVE
- Show real code from the scanned codebase, not generic examples
- Think hard and deeply before presenting findings — surface non-obvious issues
- If a phase produces a lot of output, paginate and ask user to continue

---

## PHASE 1 — CATEGORY SELECTION
> *Goal: Understand what areas the user wants to focus on*

---

Start with this exact message:

```
👋 Welcome to the Best Practices Implementation Command.

I'll guide you through a structured process:
  Phase 1 → Select categories
  Phase 2 → Configure scope and depth
  Phase 3 → Codebase scan and analysis
  Phase 4 → Risk evaluation and solution options
  Phase 5 → Systematic implementation
  Phase 6 → Framework (.claude) sync

Let's begin.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 of 2 — Which categories do you want to review?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 [1]  🔒  Security & Authorization
         NestJS Guards, OWASP Top 10, JWT/PingID validation, Zod input
         validation, secret management, CORS, CSP, rate limiting

 [2]  🏗️  Architecture & Design Principles
         SOLID, SoC, clean architecture, declarative style, DRY,
         layer boundaries, NestJS module organisation

 [3]  🪩  Backend — NestJS / TypeScript
         Exception filters, Prisma transactions, DTOs vs entities, thin
         controllers, service layer design, async patterns, caching,
         Zod-first validation, OpenAPI spec generation

 [4]  ⚛️  Frontend — Next.js
         Server vs client components, data fetching, TanStack Query,
         orval-generated hooks, state management, error boundaries,
         performance, SEO, env variable handling

 [5]  🧪  Testing Strategy
         Test pyramid, AAA pattern, mocking strategy, MSW handlers,
         Supertest integration tests, coverage quality, naming

 [6]  🗄️  Database & Data Management
         Prisma schema design, migrations, N+1 prevention,
         indexing, transactions, soft deletes, audit trails

 [7]  📝  Error Handling & Observability
         Centralized exception filters, HTTP status codes, structured
         logging (Pino), correlation IDs, PII in logs, health checks

 [8]  ⚡  Performance & Scalability
         Prisma query optimization, connection pooling (RDS Proxy),
         caching layers, Fargate autoscaling, pagination, async patterns

 [9]  ✨  Code Quality & Maintainability
         Code smells, duplication, naming, dead code, complexity,
         documentation, technical debt mapping

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Type numbers separated by commas   →  e.g. 1,3,5
  Type  all                          →  full review (all 9 categories)
  Type  critical                     →  auto-select 1, 5, 7 (highest risk)
  Type  quick                        →  1 category of your choice, fast scan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**[WAIT FOR USER INPUT — do not continue]**

After user responds, confirm selection and ask Step 2:

```
✅ Got it. You selected: [LIST SELECTED CATEGORIES]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 of 2 — What outcome are you looking for today?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 [A]  Full implementation
      Scan → Evaluate → Make all agreed changes → Sync .claude framework

 [B]  Analysis only
      Scan → Evaluate → Get full report → Decide later

 [C]  Targeted fix
      I already know what I want fixed — skip deep scan, go straight to
      implementation of a specific issue

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**[WAIT FOR USER INPUT — do not continue]**

---

## PHASE 2 — SCOPE CONFIGURATION
> *Goal: Define what to scan and how deep to go*

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2 — Scope Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Q1 — What should I scan?

 [1]  Full codebase (recommended for first run)
 [2]  Backend only  (apps/api/src)
 [3]  Frontend only (apps/web/src)
 [4]  Specific module or package — I'll tell you which
 [5]  Recently changed files — specify number of commits

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
Q2 — How deep should the analysis go?

 [1]  Surface scan
      Quick wins, obvious violations, low effort (15-30 min)

 [2]  Standard scan    ← recommended
      Balanced depth, covers most critical issues (45-90 min)

 [3]  Deep scan
      Architectural patterns, cross-cutting concerns, subtle issues,
      performance implications, security edge cases (90-180 min)

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
Q3 — Any areas to explicitly EXCLUDE from this review?
      (e.g. legacy modules, third-party integrations, generated code)

  Type paths or module names, or type  none  to include everything.
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
Q4 — Are there any KNOWN issues or constraints I should be aware of before scanning?
      (e.g. "we intentionally use X pattern", "we can't change the DB schema",
       "we're mid-migration from Y to Z")

  Describe them or type  none.
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

Confirm and proceed:

```
✅ Scope confirmed:
   Categories : [LIST]
   Scan target: [ANSWER]
   Depth      : [ANSWER]
   Exclusions : [ANSWER]
   Constraints: [ANSWER]

Ready to begin the scan. This may take a moment.
Type  go  to start, or  back  to adjust anything.
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

---

## PHASE 3 — CODEBASE SCAN & ANALYSIS
> *Goal: Deep systematic analysis — show real findings with evidence*

---

**Instructions for Claude during this phase:**

When user types `go`, perform the following:

### 3.1 — Structural Inventory

Before diving into issues, build a picture of the codebase:

```
🔍 Scanning codebase...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CODEBASE SNAPSHOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Backend
  Framework    : NestJS [detected version]
  Structure    : [detected — layered / hexagonal / modular / mixed]
  Key packages : [list main packages]
  DB migrations: [Prisma Migrate / none detected]
  Security     : [NestJS guards + passport-jwt detected / not detected]
  Test coverage: [detected test types — unit/integration/e2e]

Frontend
  Framework    : Next.js [detected version] — [App Router / Pages Router]
  Structure    : [detected organization]
  State mgmt   : [detected — Zustand / Redux / Context / none]
  Auth pattern : [detected — NextAuth / custom / none]
  Test setup   : [Jest / Vitest / Playwright / none]

⚠️  Red flags spotted before deep scan:
  → [list any immediately obvious high-risk findings]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3.2 — Category-by-Category Findings

For each selected category, produce a findings report using this exact structure:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINDINGS — [CATEGORY NAME]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 CRITICAL  — Must fix. Security risk, data integrity risk, or production instability.
🟠 IMPORTANT — Should fix. Affects maintainability, reliability, or scalability.
🟡 SUGGESTED — Nice to have. Improves quality but low immediate risk.
🟢 GOOD      — Already well implemented. Call out what's working.

──────────────────────────────────────────
[Issue #1 Title]                          [🔴/🟠/🟡]
──────────────────────────────────────────
Location   : [file path, line numbers]
What       : [what the issue is — be specific]
Why        : [why it matters — real consequences]
Evidence   :
  ```ts / tsx
  [ACTUAL CODE FROM THE SCANNED CODEBASE — not a generic example]
  ```
Impact     : [performance / security / maintainability / testability]
Effort     : [low / medium / high]
──────────────────────────────────────────
```

Repeat for all findings in this category, then:

```
Category Summary
  Critical  : [n]
  Important : [n]
  Suggested : [n]
  Healthy   : [n]

Type  next  to see the next category, or  summary  to jump to the full overview.
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT between categories]**

### 3.3 — Cross-Cutting Observations

After all categories:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CROSS-CUTTING OBSERVATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
These are issues that span multiple categories or layers and are
often the hardest to spot but highest value to fix.

[List cross-cutting concerns found — e.g. "Authorization logic is
scattered across controllers AND services AND filters — centralization
needed", or "Validation happens at 3 different layers inconsistently"]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Type  continue  to move to Phase 4 — Risk Evaluation & Solutions.
Type  compact   to summarise context before Phase 4 (saves token space for large codebases).
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

> **Context Compaction**: If context is getting long after Phase 3, type `compact` instead of `continue`.
> Before compacting, preserve: (a) categories selected, (b) all findings with their severity ratings,
> (c) any findings already deferred. Then continue from Phase 4 with that summary.

---

## PHASE 4 — RISK EVALUATION & SOLUTION OPTIONS
> *Goal: Think hard, present honest trade-offs, let the user decide*

---

**Instructions for Claude during this phase:**

This is the most important phase. Do NOT just list fixes. For each significant finding,
present multiple approaches with real trade-offs. Be honest about complexity and risk.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 4 — Risk Evaluation & Solution Options
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
I'll now present solution options for each significant finding.
For each one, you'll choose:
  [A]  Implement the recommended solution
  [B]  Implement an alternative solution (I'll show options)
  [C]  Accept the risk and skip for now (I'll note the trade-off)
  [D]  Needs more discussion before deciding
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

For each CRITICAL and IMPORTANT finding, use this format:

```
──────────────────────────────────────────
FINDING [#] — [Title]                     [🔴/🟠]
──────────────────────────────────────────
Risk if unaddressed:
  [Specific, honest risk — e.g. "Any authenticated user can access
  other users' data by changing the ID in the URL — IDOR vulnerability"]

━━━  OPTION 1 — [Recommended Approach Name]  ★ RECOMMENDED
  What it does    : [clear description]
  How it works    :
    ```ts / tsx
    [Concrete before/after code example based on your actual codebase]
    ```
  Pros            : [specific benefits]
  Cons / Risks    : [honest downsides — don't hide complexity]
  Effort          : [Low / Medium / High] — approx [time estimate]
  Side effects    : [what else might need to change as a result]

━━━  OPTION 2 — [Alternative Approach Name]
  What it does    : [clear description]
  When to prefer  : [specific conditions where this is better]
  Pros            : [benefits]
  Cons / Risks    : [downsides]
  Effort          : [Low / Medium / High]
  Side effects    : [what else might change]

━━━  OPTION 3 — Accept the Risk (Skip for now)
  What you're accepting : [specific risk statement]
  Mitigations available : [anything that reduces risk without full fix]
  When to revisit       : [clear trigger — e.g. "before going to production",
                           "when user base exceeds X", "next sprint"]

Your choice for this finding? [A / B / C / D]
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT for each finding]**

After all findings are addressed:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPLEMENTATION PLAN SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Here's what you've decided to implement:

 ✅  Will implement  : [n findings]
     [list each with chosen option and effort]

 ⏭️  Skipped         : [n findings]
     [list each with accepted risk noted]

 💬  Needs discussion: [n findings]
     [list each]

Total estimated effort: [Low / Medium / High / X hours]

Suggested implementation order (by dependency and risk):
  1. [finding] — reason for doing this first
  2. [finding]
  3. [finding]
  ...

⚠️  Before I start making changes:
  → I will make changes incrementally, one finding at a time
  → I will show you what I'm about to change before changing it
  → You can stop at any point by typing  pause
  → Type  reorder  to change the sequence
  → Type  go  to begin implementation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**[WAIT FOR USER INPUT]**

---

## PHASE 5 — SYSTEMATIC IMPLEMENTATION
> *Goal: Make changes methodically, with visibility and control*

---

**Instructions for Claude during this phase:**

- Work through findings ONE AT A TIME in the agreed order
- Show a clear before/after diff for every change
- After each change, confirm before moving to the next
- If a change causes unexpected complexity, STOP and explain before continuing
- Track progress visibly

For each implementation step:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPLEMENTING [n of total] — [Finding Title]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Files affected:
  → [file path 1]
  → [file path 2]

Changes:
──────────────────────────────────────────
[file path 1]
──────────────────────────────────────────
BEFORE:
  ```ts / tsx
  [original code]
  ```

AFTER:
  ```ts / tsx
  [new code]
  ```

Reason: [one-line explanation of why this specific change]

──────────────────────────────────────────
[Repeat for each file affected]
──────────────────────────────────────────

⚠️  Side effects from this change:
  → [any other files that need updating as a result]
  → [any tests that need updating]
  → [any config changes needed]

Shall I apply this change?
  [Y]  Yes, apply it
  [N]  No, skip this one
  [M]  Modify — I want to adjust something first
  [P]  Pause — stop here for now
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**[WAIT FOR USER INPUT for each change]**

After all changes:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  IMPLEMENTATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Applied   : [n] changes across [n] files
Skipped   : [n] changes
Modified  : [n] changes (user-adjusted)

Files changed:
  [list all modified files]

Summary of what was implemented:
  [brief bullet list of each change made]

⚠️  Recommended next steps:
  → Run your test suite — some tests may need updating
  → [any specific tests to check]
  → [any manual verification steps]
  → [any configuration or environment changes needed]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Type  continue  to move to Phase 6 — Framework Sync.
Type  compact   to summarise context before Phase 6 (recommended after many changes).
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

> **Context Compaction**: If context is heavy after Phase 5, type `compact` before Phase 6.
> Before compacting, preserve: (a) all confirmed changes with file paths, (b) skipped items,
> (c) any new patterns introduced. Then continue with Phase 6 framework sync using that summary.

---

## PHASE 6 — FRAMEWORK SYNC (.claude folder)
> *Goal: Keep the .claude framework aligned with what was just implemented*

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 6 — Framework Sync
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Based on the changes just implemented, I've identified .claude
framework files that may need updating to stay aligned.

This ensures future code generation follows the patterns you
just established.

Do you want me to scan the .claude folder and suggest updates?

  [Y]  Yes — scan and show suggested updates
  [N]  No — I'll update the framework manually later
  [S]  Selective — only update specific files (I'll tell you which)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**[WAIT FOR USER INPUT]**

If Y or S, scan `.claude/` and produce:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
.CLAUDE FRAMEWORK — SYNC ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scanned: .claude/
Found  : [n] files that need updating
         [n] files that are already aligned
         [n] new files that should be created

──────────────────────────────────────────
FILE: .claude/standards/[filename].md
Status: NEEDS UPDATE
──────────────────────────────────────────
Why    : [specific reason — what was implemented that this
          file doesn't yet reflect]
Change :
  Current section:
    "[current text from the framework file]"

  Suggested update:
    "[proposed new text]"

  Apply this update? [Y / N / M]
──────────────────────────────────────────

[Repeat for each file]

──────────────────────────────────────────
NEW FILE SUGGESTION: .claude/standards/[new-file].md
──────────────────────────────────────────
Why    : [this pattern was established in the codebase but
          has no corresponding standard documented]
Content:
  [proposed content for the new file]

  Create this file? [Y / N]
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT for each file]**

After all framework updates:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉  SESSION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Session Summary
  Codebase changes  : [n] findings implemented across [n] files
  Framework updates : [n] .claude files updated, [n] created
  Skipped / deferred: [n] findings (noted for future review)

What was improved:
  [bullet list summary by category]

Deferred items to revisit:
  [list with suggested revisit triggers]

Recommended follow-up commands:
  /review-tests         — Verify test coverage after changes
  /security-audit       — Deep security pass on the changes made
  /implement-best-practices — Run again on remaining categories

Thank you. Your codebase and framework are now in sync. 🚀
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
