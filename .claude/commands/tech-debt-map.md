---
name: tech-debt-map
description: >
  Maps all deferred findings, known issues, and technical debt across 
  the codebase into a prioritized, actionable backlog. Aggregates findings
  from previous best-practices sessions and adds newly discovered debt.
  Outputs a structured debt register with effort/impact scoring.
version: 1.0.0
requires:
  agents:
    - .claude/agents/architecture-reviewer.md
    - .claude/agents/security-auditor.md
    - .claude/agents/test-strategist.md
    - .claude/agents/database-analyst.md
interaction: conversational
phases: 3
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# 📊 Technical Debt Map Command

Builds a comprehensive, prioritized technical debt register for your codebase.
Aggregates deferred findings, surfaces new debt, and produces an actionable backlog.

**Ground Rules for Claude:**
- Technical debt is not always bad — some is intentional and acceptable
- Be honest about the REAL cost of debt, not just theoretical
- Distinguish between debt that is GROWING (compounding) vs STABLE
- Do not recommend rewriting everything — prioritize ruthlessly

---

## PHASE 1 — DEBT MAPPING CONFIGURATION

```
📊 Technical Debt Map

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — What sources should I include?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 [1]  Full discovery          (scan codebase fresh — comprehensive)
 [2]  Previous session output (I'll paste deferred findings from 
                               a previous /implement-best-practices run)
 [3]  Both                    (merge existing + fresh discovery)

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

If [2] or [3]:
```
Please paste the deferred findings from your previous session
(the "Skipped / deferred" section from the session summary).

Paste findings or type  done  when finished.
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
STEP 2 — Debt categories to include

 [1]  All categories
 [2]  Select specific:
       [A] Security debt
       [B] Architecture debt
       [C] Test debt
       [D] Database debt
       [E] Performance debt
       [F] Code quality debt
       [G] Dependency / upgrade debt

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
STEP 3 — Output format

 [1]  Interactive session      (review and score each item together)
 [2]  Generate debt register   (full document output to a file)
 [3]  Both

Where should I save the debt register? (e.g.  docs/tech-debt.md )
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

---

## PHASE 2 — DEBT DISCOVERY & SCORING

### 2.1 — Scan or ingest findings

If fresh scan: invoke relevant agents based on selected categories.
If pasted findings: parse and normalize into standard format.

### 2.2 — Score each debt item

For each debt item, apply this scoring matrix:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEBT ITEM — [Title]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Category  : [Security / Architecture / Test / DB / Performance / Quality]
Location  : [file paths]
Age       : [estimated — new / months / years / unknown]

Scoring:
  Impact if fixed    : [1-5]  [Low → Critical]
  Effort to fix      : [1-5]  [Trivial → Major refactor]
  Compounding?       : [Yes — getting worse over time / Stable / No]
  Blocks other work? : [Yes — describe what / No]
  Risk if ignored    : [Low / Medium / High / Critical]

Priority score       : [calculated — Impact × Compounding × Risk / Effort]
Recommended tier     : [NOW / NEXT SPRINT / BACKLOG / ACCEPT]

Justification: [1-2 sentences explaining the priority recommendation]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2.3 — Debt Register Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TECHNICAL DEBT REGISTER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 NOW — Fix before next release
  [n] items | Total effort: [Low/Medium/High]
  ┌─────────────────────────────────────────────────────────┐
  │ # │ Item          │ Category │ Effort │ Risk if ignored  │
  ├───┼───────────────┼──────────┼────────┼─────────────────┤
  │ 1 │ [title]       │ Security │ Low    │ Critical        │
  └─────────────────────────────────────────────────────────┘

🟠 NEXT SPRINT — Plan for upcoming sprint
  [n] items | Total effort: [Low/Medium/High]
  [table]

🟡 BACKLOG — Schedule within quarter
  [n] items | Total effort: [Low/Medium/High]
  [table]

⚪ ACCEPT — Conscious decision to live with
  [n] items
  [table with accepted risk documented]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEBT SUMMARY
  Total items     : [n]
  Compounding debt: [n] items actively getting worse
  Blocking debt   : [n] items blocking other work
  Quick wins      : [n] items — high impact, low effort

Overall debt level: [CRITICAL / HIGH / MANAGEABLE / HEALTHY]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**[WAIT FOR USER INPUT — confirm or adjust priorities]**

> **Context Compaction**: After Phase 2, context can be large. If needed, compact before Phase 3.
> Before compacting, preserve: (a) the scored debt register table, (b) overall debt level rating,
> (c) top-5 priority items. Then continue from Phase 3 with that preserved summary.

---

## PHASE 3 — ACTIONABLE OUTPUT

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3 — What do you want to do next?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 [1]  Start fixing NOW items   
      → Hands off to /implement-best-practices with pre-loaded findings

 [2]  Save debt register to file
      → Generates docs/tech-debt.md (or your specified path)

 [3]  Export as sprint tickets
      → Formats each item as a user story / ticket description

 [4]  Both [2] and [3]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**[WAIT FOR USER INPUT]**

If [3] or [4], format each debt item as:

```markdown
## [Debt Item Title]

**Type:** Technical Debt — [Category]
**Priority:** [NOW / NEXT SPRINT / BACKLOG]
**Effort:** [Low / Medium / High]

### Problem
[What the issue is and why it matters]

### Acceptance Criteria
- [ ] [specific, testable criterion 1]
- [ ] [specific, testable criterion 2]
- [ ] Tests updated to cover the fix
- [ ] No regression in existing tests

### Files to Change
- [file path]

### Notes
[Any constraints, alternatives considered, or related debt items]
```
