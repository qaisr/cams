---
name: pre-release-check
description: >
  Fast, focused pre-release quality gate. Runs critical categories only —
  Security, Error Handling, and Database integrity. Designed to be run
  before every release without being exhaustive. Produces a clear
  GO / NO-GO recommendation.
version: 1.0.0
requires:
  agents:
    - .claude/agents/security-auditor.md
    - .claude/agents/database-analyst.md
  workflows:
    - .claude/workflows/best-practices-analysis.md
interaction: conversational
phases: 3
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# 🚀 Pre-Release Check Command

A fast, opinionated pre-release gate. Not a full audit — a targeted check
of the highest-risk areas before shipping.

For major/high-risk releases, also run the full gate using:
- `@.claude/standards/quality-gate-standards.md`
- `/verify-quality` (full profile)

**Ground Rules for Claude:**
- Speed matters here — be focused, not exhaustive
- Be decisive: every finding gets a BLOCKER / WARNING / NOTE classification
- A BLOCKER means "do not release until fixed"
- Produce a clear GO / NO-GO recommendation at the end
- Do not surface nice-to-haves — only things that matter for this release

---

## PHASE 1 — RELEASE CONTEXT

```
🚀 Pre-Release Check

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quick questions before I start:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Q1 — What changed in this release?
     (Brief description of features/fixes — helps me focus the scan)
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
Q2 — Release type?

 [1]  Major release         (significant new features)
 [2]  Minor release         (small features, improvements)
 [3]  Patch / hotfix        (bug fixes only)
 [4]  Infrastructure change (no app code changes)

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
Q3 — Any areas of elevated risk in this release?
     (e.g. "we touched the auth flow", "new DB migrations",
      "new external API integration")

  Describe or type  none.
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
Q4 — Have all tests passed?

 [Y]  Yes — all tests green
 [N]  No  — some failures (describe)
 [S]  Skipped some tests (describe which)

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
✅ Context captured. Starting pre-release check.
   This focuses on: Security | Error Handling | Database | Test Gate

Type  go  to start.
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

---

## PHASE 2 — CRITICAL CHECKS

### Check 1 — Security Gate

Invoke security-auditor.md for CRITICAL and HIGH severity only.

Focus specifically on:
- Auth bypass possibilities in changed code
- New endpoints missing authorization
- New inputs missing validation
- Secrets accidentally introduced
- CORS/CSP changes

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 SECURITY GATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[findings in blocker/warning/note format]

Security Gate: ✅ PASS / ❌ FAIL / ⚠️ WARNINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Check 2 — Error Handling Gate

Scan for:
- Unhandled exceptions that could crash the application
- Stack traces exposed to clients
- Missing error boundaries (frontend)
- Uncaught promise rejections (frontend)
- Missing transaction rollback on errors

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 ERROR HANDLING GATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[findings]

Error Handling Gate: ✅ PASS / ❌ FAIL / ⚠️ WARNINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Check 3 — Database Gate

Invoke database-analyst.md focused on:
- New migrations — syntax and safety
- Reversibility of schema changes
- Missing indexes on new query patterns
- Data integrity risks in new migrations
- No direct schema changes bypassing migrations

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗄️  DATABASE GATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[findings]

Database Gate: ✅ PASS / ❌ FAIL / ⚠️ WARNINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Check 4 — Test Gate

Quick test quality check on changed files:
- New code has corresponding tests
- Critical paths have test coverage
- No tests disabled with @Disabled / .skip

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 TEST GATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[findings]

Test Gate: ✅ PASS / ❌ FAIL / ⚠️ WARNINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## PHASE 3 — GO / NO-GO DECISION

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRE-RELEASE DECISION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Security Gate      : [✅ PASS / ❌ FAIL / ⚠️ WARNING]
  Error Handling Gate: [✅ PASS / ❌ FAIL / ⚠️ WARNING]
  Database Gate      : [✅ PASS / ❌ FAIL / ⚠️ WARNING]
  Test Gate          : [✅ PASS / ❌ FAIL / ⚠️ WARNING]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [✅ GO]      All gates pass — release is clear

  [⚠️  GO WITH CAUTION]
               Warnings present — proceed with awareness:
               [list warnings]

  [❌ NO-GO]   Blockers must be resolved before release:
               [list each blocker with location and fix]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?
  [F]  Fix blockers now     → hands off to /implement-best-practices
  [R]  Save report to file  → specify path
  [D]  Override and release → document the accepted risk (requires reason)
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

If [D]:
```
You're choosing to release with known blockers.
Please provide the business justification:
(This will be saved to the release report for audit purposes)
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

## Cross-References

- Full production checklist: `@.claude/workflows/production-release-checklist.md`
- Hotfix workflow (critical fixes): `@.claude/workflows/hotfix-workflow.md`
- Security review workflow: `@.claude/workflows/security-review-workflow.md`
- Security auditor agent: `@.claude/agents/security-auditor.md`
- Database analyst agent: `@.claude/agents/database-analyst.md`
- Best practices analysis: `@.claude/workflows/best-practices-analysis.md`
- Quality gate standards: `@.claude/standards/quality-gate-standards.md`
