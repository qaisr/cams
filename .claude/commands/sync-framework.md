---
name: sync-framework
description: >
  Standalone framework sync command. Synchronizes alignment between the
  .claude framework (standards, agents, workflows, commands) and the actual
  codebase. Can sync in either direction: update the framework to match the
  codebase, or generate a gap report showing where the codebase diverges
  from the framework. Can also be run after manual refactors.
version: 1.0.0
requires:
  workflows:
    - .claude/workflows/framework-sync.md
  agents:
    - .claude/agents/ai-strategist.md
interaction: conversational
phases: 4
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# 🔄 Sync Framework Command

Keeps your `.claude` framework and your codebase aligned.
Run this after any significant refactor, after manual changes,
or to audit how well the codebase follows the documented standards.

**Ground Rules for Claude:**
- Surgical updates only — never rewrite whole framework files without reason
- Be specific about what is misaligned and exactly why
- In codebase → framework direction: describe what IS, not what SHOULD BE
- In framework → codebase direction: show gaps, don't make changes without confirmation
- Always quote the specific text being changed, before and after

---

## PHASE 1 — SYNC DIRECTION & CONFIGURATION

```
🔄 Framework Sync

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Which direction do you want to sync?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 [1]  Codebase → .claude framework
      ─────────────────────────────────────
      Use this when:
        → You just implemented new patterns in the codebase
        → You did a manual refactor and want the framework to reflect it
        → The codebase has evolved and the framework is stale
        → After running /implement-best-practices

      What happens:
        → I scan the codebase to understand what patterns are actually used
        → I compare against the current .claude framework
        → I suggest framework updates to document what was implemented
        → The framework becomes an accurate reflection of the codebase

 [2]  .claude framework → Codebase
      ─────────────────────────────────────
      Use this when:
        → You updated the .claude standards and want to find gaps in the code
        → You want to audit how well the codebase follows documented standards
        → You onboarded new standards and want to see what needs updating
        → You want a compliance report against your own framework

      What happens:
        → I read the .claude framework as the source of truth
        → I scan the codebase for deviations and gaps
        → I produce a prioritized gap report
        → I offer to implement the gaps (or report only)

 [3]  Bidirectional audit
      ─────────────────────────────────────
      Use this when:
        → You want a full picture of alignment in both directions
        → First run on a codebase to establish baseline

      What happens:
        → Both directions are analyzed
        → Conflicts between framework and codebase are surfaced
        → You decide which is authoritative for each conflict

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**[WAIT FOR USER INPUT]**

```
STEP 2 — Scope

Which parts of the .claude framework should be included?

 [1]  Full framework          (.claude/ — all files)
 [2]  Standards only          (.claude/standards/)
 [3]  Agents only             (.claude/agents/)
 [4]  Workflows only          (.claude/workflows/)
 [5]  Commands only           (.claude/commands/)
 [6]  Specific files          — I'll list them
 [7]  Everything except       — I'll specify exclusions

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
STEP 3 — Codebase scope

 [1]  Full codebase
 [2]  Backend only
 [3]  Frontend only
 [4]  Recently changed files  — specify commits
 [5]  Specific modules        — I'll specify

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
STEP 4 — What triggered this sync?
  (Helps me understand context — or type  routine )
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
✅ Sync configured:
   Direction  : [DIRECTION]
   Framework  : [SCOPE]
   Codebase   : [SCOPE]
   Trigger    : [ANSWER]

Type  go  to begin analysis.
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

---

## PHASE 2 — ALIGNMENT ANALYSIS

### If Direction = Codebase → .claude framework

Scan the codebase and identify patterns actually in use:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CODEBASE PATTERN INVENTORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Patterns detected in codebase:

  Architecture : [detected patterns]
  Security     : [detected approach]
  Error handling: [detected pattern]
  Testing      : [detected patterns]
  Database     : [detected patterns]
  Frontend     : [detected patterns]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Then compare to framework:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRAMEWORK SYNC ANALYSIS — Codebase → .claude
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each framework file that needs updating:

──────────────────────────────────────────
FILE: .claude/[path/filename].md
Status: [OUTDATED / INCOMPLETE / CONFLICTING / MISSING FILE]
──────────────────────────────────────────
Why    : [specific reason with evidence from codebase]

Change type: [UPDATE SECTION / ADD SECTION / REPLACE EXAMPLE / CREATE FILE]

Current text:
  "[quoted current text from framework file]"

Proposed update:
  "[proposed new text]"

Reason: [one-line explanation]

Apply? [Y / N / M]
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT per file]**

### If Direction = .claude framework → Codebase

Read framework as source of truth and scan for gaps:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRAMEWORK COMPLIANCE ANALYSIS — .claude → Codebase
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Standard: [framework standard name and file]
Required : [what the framework requires]
Status   : [✅ COMPLIANT / ❌ VIOLATION / ⚠️ PARTIAL / ⬜ NOT APPLICABLE]

If VIOLATION or PARTIAL:
  Location   : [file path, line]
  Found      :
    ```ts / tsx
    [actual code that violates the standard]
    ```
  Expected   :
    ```ts / tsx
    [what it should look like per the framework]
    ```
  Severity   : [🔴 CRITICAL / 🟠 IMPORTANT / 🟡 MINOR]

──────────────────────────────────────────

[Repeat for each standard]

──────────────────────────────────────────
COMPLIANCE SUMMARY
  Compliant   : [n] standards
  Violations  : [n] standards
  Partial     : [n] standards
  N/A         : [n] standards

Compliance score: [n]%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**[WAIT FOR USER INPUT]**

### If Direction = Bidirectional

Run both analyses above, then:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONFLICTS — Where framework and codebase disagree
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
These items conflict — you need to decide which is authoritative:

CONFLICT [n]:
  Framework says : [what the framework documents]
  Codebase does  : [what the code actually does]
  In file        : [framework file] vs [code file]

  Which is correct?
   [F]  Framework is right — update the codebase
   [C]  Codebase is right  — update the framework
   [D]  Neither — I'll specify the correct approach
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT per conflict]**

---

## PHASE 3 — IMPLEMENTATION

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SYNC PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Framework updates : [n] files to update / [n] to create
Codebase updates  : [n] violations to fix
Conflicts resolved: [n]

Proceed with implementation?
  [A]  Apply all agreed changes
  [F]  Framework changes only
  [C]  Codebase changes only
  [R]  Report only — I'll apply manually
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**[WAIT FOR USER INPUT]**

Apply changes using the same per-change confirmation pattern from
`implement-best-practices.md` Phase 5.

---

## PHASE 4 — SYNC SUMMARY

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SYNC COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Direction  : [DIRECTION]

Framework updates:
  [list of .claude files changed]

Codebase updates:
  [list of code files changed]

Deferred items:
  [list anything not applied with reason]

Your .claude framework and codebase are now in sync.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Agent

This command delegates deep framework analysis to the `ai-strategist` agent.
Load `@.claude/agents/ai-strategist.md` during Phase 2 to run the alignment audit
and produce targeted diffs. Unload after the sync summary is produced.
