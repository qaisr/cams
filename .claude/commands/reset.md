---
description: Reset selected epics back to pending by deleting their generated artifacts, removing their implemented code, and optionally renumbering the epic queue.
agent: build
subtask: false
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# Reset Epics

## Input

$ARGUMENTS

Examples:

- `/reset --after epic-004`
- `/reset --after 4`
- `/reset --after epic-004 --no-renumber`
- `/reset 4,5b,6`
- `/reset epic-004,epic-005b,epic-006`
- `/reset --epic-numbers`
- `/reset --after epic-004 --dry-run`

## Argument Flags

| Flag | Effect |
| --- | --- |
| `--after <epic-id>` | Reset every epic after the specified anchor epic |
| `<epic-list>` | Reset only the specified epics, e.g. `4,5b,6` |
| `--epic-numbers` | Renumber the queue only; do not reset or delete anything |
| `--no-renumber` | Execute the reset but keep existing epic IDs even if gaps or suffixes remain |
| `--dry-run` | Analyze and present the reset plan without making changes |

Exactly one of `--after`, `<epic-list>`, or `--epic-numbers` must be supplied.

`--no-renumber` is valid only with `--after` or `<epic-list>`.

---

## Purpose

Use `/reset` when the team wants to deliberately step back delivery progress for one or more epics
without introducing new requirements.

Typical reasons:

- delivered work after a certain epic should be rolled back
- a completed epic should be undone so the scope can be rebuilt differently
- generated epics/tasks should be removed and re-generated from a cleaner point
- epic numbering has become inconsistent and needs to be normalised

**What this command does:**

1. Resolves the reset scope from an anchor, explicit epic list, or renumber-only request
2. Analyzes tracker state, generated artifacts, implemented summaries, and code ownership
3. Deletes the selected epic files, task folders, and implemented summaries
4. Removes or edits implementation code belonging to reset epics
5. Updates `specs/epics/0-epics-index.md` so reset epics become `pending`
6. Reorders the tracker so remaining `complete` epics stay first
7. Optionally renumbers the queue and renames surviving epic artifacts to match

**What this command does NOT do:**

- Change business requirements or functional specifications
- Preserve reset epic documentation or implemented summaries after the reset completes
- Renumber automatically without confirmation, except in `--epic-numbers` mode
- Delete shared code still required by retained epics
- Delete task folders for epics outside the reset scope

**Philosophy**: Reset is an intentional rollback tool.

- reset epics return to `pending`
- reset-generated artifacts are removed, not archived
- reset implementation is removed, not preserved in a separate audit folder
- git history is the rollback/audit trail

---

## Pre-Flight

Load the following before starting:

```text
@.claude/workflows/epic-reset.md
@.claude/project-structure.md
```

Validate inputs:

1. `specs/epics/0-epics-index.md` must exist
2. The mode must be unambiguous: use exactly one of `--after`, explicit epic list, or `--epic-numbers`, and do not combine `--no-renumber` with `--epic-numbers`.
3. All referenced epic IDs must exist in the tracker
4. If reset affects completed epics, load implementation evidence from `specs/epics-implemented/`, `specs/epic-tasks/`, and targeted code analysis as needed

Normalize epic identifiers before matching:

- `4` → `epic-004`
- `5b` → `epic-005b`
- `epic-4` → `epic-004`

---

## Process

Follow the phases defined in `@.claude/workflows/epic-reset.md`.

The workflow file is the authoritative source for reset ordering, deletion rules,
renumbering rules, and confirmation behavior. This command file provides the entry
contract, examples, and execution summary.

---

### Mode 1 — `/reset --after epic-004`

Interpret this as:

- keep `epic-004` and everything before it unchanged
- reset every later epic
- set every reset epic to `pending`
- delete their epic files, task folders, implemented summaries, and implementation code

If this leaves gaps or suffixes in numbering, ask whether to renumber sequentially.

If the user passes `--no-renumber`, skip that renumber recommendation and keep the existing IDs.

Worked example:

Assume the tracker starts as:

| Epic | Title | Status |
| --- | --- | --- |
| Epic-001 | AWS Infrastructure & Database Setup | complete |
| Epic-002 | Application Scaffolding | complete |
| Epic-003 | User & Role Management | complete |
| Epic-004 | Notifications & Messaging | complete |
| Epic-005 | RBAC Authorization | complete |
| Epic-005b | Agreement Structure & Versioning | complete |
| Epic-006 | Business Rules Engine Foundation | epic-generated |
| Epic-007 | Reporting & Analytics | pending |

After `/reset --after epic-004`, the reset scope is `epic-005`, `epic-005b`, `epic-006`, and `epic-007`.

If the user confirms renumbering, the tracker becomes:

| Epic | Title | Status |
| --- | --- | --- |
| Epic-001 | AWS Infrastructure & Database Setup | complete |
| Epic-002 | Application Scaffolding | complete |
| Epic-003 | User & Role Management | complete |
| Epic-004 | Notifications & Messaging | complete |
| Epic-005 | RBAC Authorization | pending |
| Epic-006 | Agreement Structure & Versioning | pending |
| Epic-007 | Business Rules Engine Foundation | pending |
| Epic-008 | Reporting & Analytics | pending |

If the user chooses `--no-renumber`, the tracker statuses are reset but the original IDs remain.

### Mode 2 — `/reset 4,5b,6`

Interpret this as:

- reset only the listed epics
- keep non-reset completed epics ahead of non-complete epics in the tracker
- move reset epics into the `pending` section
- ask whether to renumber sequentially after the new order is established

If the user passes `--no-renumber`, skip that renumber recommendation and keep the existing IDs.

This mode is how the tracker can end up with remaining complete epics compacted to the top,
for example keeping `RBAC Authorization` complete while resetting `Notifications & Messaging`,
`Agreement Structure & Versioning`, and later epics.

Worked example:

Assume the tracker starts as:

| Epic | Title | Status |
| --- | --- | --- |
| Epic-001 | AWS Infrastructure & Database Setup | complete |
| Epic-002 | Application Scaffolding | complete |
| Epic-003 | User & Role Management | complete |
| Epic-004 | Notifications & Messaging | complete |
| Epic-005 | RBAC Authorization | complete |
| Epic-005b | Agreement Structure & Versioning | complete |
| Epic-006 | Business Rules Engine Foundation | epic-generated |
| Epic-007 | Reporting & Analytics | pending |

After `/reset 4,5b,6`, the completed epic retained is `RBAC Authorization`, so the complete section stays first.

If the user confirms renumbering, the tracker becomes:

| Epic | Title | Status |
| --- | --- | --- |
| Epic-001 | AWS Infrastructure & Database Setup | complete |
| Epic-002 | Application Scaffolding | complete |
| Epic-003 | User & Role Management | complete |
| Epic-004 | RBAC Authorization | complete |
| Epic-005 | Notifications & Messaging | pending |
| Epic-006 | Agreement Structure & Versioning | pending |
| Epic-007 | Business Rules Engine Foundation | pending |
| Epic-008 | Reporting & Analytics | pending |

If the user chooses `--no-renumber`, the order still changes to keep complete epics first,
but the original epic IDs remain in place.

### Mode 3 — `/reset --epic-numbers`

Interpret this as:

- do not reset any epic
- keep the existing order and statuses
- renumber the tracker sequentially
- rename surviving epic files, task folders, and implemented summaries to match the new IDs

### Renaming During Renumbering

When renumbering is confirmed, rename surviving artifacts so the filesystem matches the
new tracker IDs:

1. Epic files in `specs/epics/`
  Example: `specs/epics/epic-005b-agreement-structure-versioning.md` → `specs/epics/epic-006-agreement-structure-versioning.md`
2. Task folders in `specs/epic-tasks/`
  Example: `specs/epic-tasks/epic-005b-agreement-structure-versioning/` → `specs/epic-tasks/epic-006-agreement-structure-versioning/`
3. Implemented summaries in `specs/epics-implemented/`
  Example: `specs/epics-implemented/epic-005b-agreement-structure-versioning.md` → `specs/epics-implemented/epic-006-agreement-structure-versioning.md`

Update tracker references and any surviving internal references to those artifact names
at the same time.

---

## Confirmation Gate

Before any destructive change, present a plan like:

```text
Reset plan ready.

  Mode:                       [after-anchor | explicit-list | renumber-only]
  Epics to reset:             [list]
  Complete epics retained:    [list]
  Epic files deleted:         [N]
  Task folders deleted:       [N]
  Implemented summaries deleted: [N]
  Code files deleted:         [N]
  Code files edited:          [N]
  Renumber recommended:       Yes / No

[A] Execute reset, keep current epic IDs
[B] Execute reset and renumber sequentially   ← RECOMMENDED when numbering has gaps/suffixes
[C] Cancel
```

If `--no-renumber` is set, do not offer option `[B]`; the reset plan should present only:

```text
[A] Execute reset, keep current epic IDs
[B] Cancel
```

If `--dry-run` is set, stop after presenting the plan.

---

## Output Summary Table

Present this at the end of each completed reset:

| Artifact | Path | Status |
| --- | --- | --- |
| Deleted epic files | `specs/epics/` | [N] deleted |
| Deleted task folders | `specs/epic-tasks/` | [N] deleted |
| Deleted implemented summaries | `specs/epics-implemented/` | [N] deleted |
| Removed or edited implementation code | workspace source files | [N] changed |
| Updated epic tracker | `specs/epics/0-epics-index.md` | updated |
| Renamed surviving epic artifacts | `specs/epics/`, `specs/epic-tasks/`, `specs/epics-implemented/` | [N] renamed |

Conclude with:

```text
Reset complete.

  Epics reset:              [N]
  Epics still complete:     [N]
  Queue renumbered:         Yes / No
  Code rollback applied:    Yes / No

Recommended next step:
  [e.g. run /create-epics, /create-epic-tasks, or resume implementation from the new frontier]
```

---

## Post-Reset Actions

| Scenario | Recommended Follow-Up |
| --- | --- |
| `--after` reset completed | Resume planning from the new frontier with `/create-epics` |
| Explicit epic reset completed | Re-run `/create-epics` and `/create-epic-tasks` for the reset scope as needed |
| Queue renumbered only | Continue normal delivery using the new epic IDs |
| Code rollback touched shared files | Run `/review-code` or `/verify-quality` before resuming implementation |
| Reset removed delivered backend/frontend scope | Re-run the relevant tests before proceeding |
