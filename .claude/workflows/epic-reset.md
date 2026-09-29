---
name: epic-reset
description: >
  Destructive rollback workflow for resetting selected epics back to pending,
  deleting their generated artifacts, removing their implemented code, and
  optionally renumbering the epic queue so completed epics remain first and
  numbering stays sequential.
version: 1.0.0
invoked_by:
  - .claude/commands/reset.md
agents:
  - ambiguity-analyst
  - tech-lead
---


> **Operating Discipline (always applies).** Follow `@.claude/CLAUDE.md` → Operating Discipline throughout this workflow: never hallucinate paths/APIs/versions, never assume intent to fill a gap, never implement unrequested scope, clarify ambiguities before acting, and get **explicit human approval** before anything hard-to-reverse or beyond the stated request. Report faithfully what was done, skipped, or failed.

# Epic Reset Workflow

## Philosophy

This workflow handles intentional rollback of already-generated or already-implemented
epics when the team decides to step back delivery state without introducing a new
requirements-reconciliation flow.

Reset is destructive by design:

- selected epics are moved back to `pending`
- generated epic files and task folders are deleted
- implemented summaries for reset epics are deleted
- code introduced solely by reset epics is removed
- tracker order is normalised so completed epics stay first
- epic numbering may be renumbered sequentially after confirmation

Git history is the durable audit trail for removed implementation.

---

## Supported Modes

### Mode 1 — Reset Everything After an Anchor

Example:

```text
/reset --after epic-004
```

Optional variant:

```text
/reset --after epic-004 --no-renumber
```

Behavior:

- keep the anchor epic and everything before it unchanged
- reset every epic after the anchor
- set all reset epics to `pending`
- delete generated/implemented artifacts for the reset scope
- ask whether to renumber if the resulting tracker contains gaps or suffixes

If `--no-renumber` is passed, the reset executes without renumbering even if gaps or suffixes remain.

### Mode 2 — Reset Specific Epics

Examples:

```text
/reset 4,5b,6
/reset epic-004,epic-005b,epic-006
/reset 4,5b,6 --no-renumber
```

Behavior:

- reset only the specified epics
- delete generated/implemented artifacts for those epics
- keep non-reset completed epics at the front of the tracker
- after reset, normalise queue order so `complete` epics come first, followed by
  `epic-generated`, then `pending`
- ask whether to renumber sequentially after the new order is finalised

If `--no-renumber` is passed, keep the resulting order but do not renumber IDs.

### Mode 3 — Renumber Only

Example:

```text
/reset --epic-numbers
```

Behavior:

- do not reset any epic
- keep existing order and statuses
- renumber the epic queue sequentially
- rename surviving epic files, task folders, and implemented summaries to match the
  new epic IDs

---

## Pre-Flight Checklist

Before starting this workflow verify:

1. `specs/epics/0-epics-index.md` exists
2. The reset mode is unambiguous: use exactly one of `--after`, `--epic-numbers`, or explicit epic list, and allow `--no-renumber` only with `--after` or explicit epic list
3. Epic identifiers are normalised, for example `4` → `epic-004` and `5b` → `epic-005b`
4. For resets affecting completed epics, load implementation evidence from `specs/epics-implemented/`, `specs/epic-tasks/`, and targeted code analysis if needed
5. Ask for confirmation before any destructive action or renumbering action

---

## Phase 1 — Resolve Reset Scope

**Goal**: Determine exactly which epics are being reset and whether renumbering is requested.

### 1.1 Parse Mode

Allowed invocation forms:

| Form | Meaning |
| --- | --- |
| `--after epic-004` | reset all epics after the anchor |
| `4,5b,6` | reset only the listed epics |
| `--epic-numbers` | renumber only |

Reject ambiguous input such as:

- `--after` plus explicit epic list
- `--after` plus `--epic-numbers` in the same run
- `--epic-numbers` plus `--no-renumber`
- missing anchor after `--after`

### 1.2 Build Reset Set

For `--after <epic-id>`:

- resolve the anchor row in `0-epics-index.md`
- select every row after that anchor as the reset set

For explicit epic list:

- resolve each requested epic
- reset only those rows
- preserve the remaining rows

For `--epic-numbers`:

- reset set is empty
- renumbering target is the entire queue

### 1.3 Predict Tracker Order

If the run resets epics:

- keep remaining `complete` epics first
- then keep remaining `epic-generated` epics
- then place all reset epics as `pending`
- then keep the remaining `pending` epics

Within each group, preserve relative order unless the user explicitly requests a different order.

---

## Phase 2 — Impact Analysis

**Goal**: Identify every artifact and code area that will be affected.

### 2.1 Documentation Artifact Discovery

For each epic in scope, resolve:

- epic file: `specs/epics/<epic-file>.md`
- task folder: `specs/epic-tasks/<epic-stem>/`
- implemented summary: `specs/epics-implemented/<same-epic-file-name>.md`

Task-folder deletion is reset-scope-only: delete the entire `specs/epic-tasks/<epic-stem>/`
folder only when that epic itself is being reset.

### 2.2 Implementation Evidence Discovery

For reset epics with status `complete`, collect evidence in this order:

1. `specs/epics-implemented/<same-epic-file-name>.md`
2. `specs/epic-tasks/<epic-stem>/0-tasks-index.md`
3. targeted codebase analysis of files mentioned in the summary or epic

Use this evidence to determine:

- files introduced solely by the reset epic and safe to delete
- shared files that require selective removal rather than deletion
- tests that should be deleted or updated
- configuration, schema, or contract changes that belong only to reset epics

### 2.3 Renumber Impact Discovery

If renumbering is requested or recommended, determine the artifacts that must be renamed:

- rows in `specs/epics/0-epics-index.md`
- existing epic files in `specs/epics/`
- surviving task folders in `specs/epic-tasks/`
- surviving implemented summaries in `specs/epics-implemented/`
- internal references to those file names within tracker notes or summaries

---

## Phase 3 — Confirmation Gate

**Goal**: Show the exact reset plan before any destructive change.

Present a summary like:

```text
Reset plan ready.

  Mode:                  [after-anchor | explicit-list | renumber-only]
  Epics to reset:        [list]
  Complete epics kept:   [list]
  Epic files deleted:    [N]
  Task folders deleted:  [N]
  Implemented summaries deleted: [N]
  Code files deleted:    [N]
  Code files edited:     [N]
  Renumber recommended:  Yes / No

[A] Execute reset, keep current epic IDs
[B] Execute reset and renumber sequentially   ← RECOMMENDED when gaps/suffixes remain
[C] Cancel
```

If `--no-renumber` is set, present:

```text
[A] Execute reset, keep current epic IDs
[B] Cancel
```

For `--epic-numbers` runs, the options become:

```text
[A] Renumber queue now
[B] Cancel
```

---

## Phase 4 — Execute Reset

**Goal**: Remove reset epics and their implementation state.

### 4.1 Delete Reset Artifacts

For each epic in the reset set:

- delete the epic file if it exists
- delete the task folder if it exists
- delete the implemented summary if it exists

Do not delete task folders for epics outside the reset set.

### 4.2 Remove Implemented Code

For each reset epic with status `complete`:

- delete files owned solely by that epic
- selectively remove epic-specific code from shared files
- remove tests, routes, contracts, config, migrations, or fixtures that belong only to the reset scope

Do not delete shared code still required by retained epics.

### 4.3 Reset Tracker State

Update `specs/epics/0-epics-index.md`:

- every reset epic becomes `pending`
- summary/notes reflect only the current state after reset
- references to deleted implemented summaries are removed

---

## Phase 5 — Reorder and Renumber

**Goal**: Keep the queue readable and sequential after reset.

### 5.1 Reorder Rules

After a reset, order the tracker as follows:

1. all remaining `complete` epics
2. all remaining `epic-generated` epics
3. all `pending` epics, including the reset epics

Within each status group, preserve relative order from before the reset.

### 5.2 Renumber Rules

If the user confirms renumbering:

- assign sequential IDs from top to bottom of the reordered tracker
- preserve suffix-free numbering for all rows
- rename any surviving artifact paths to match the new IDs

If the user declines renumbering:

- keep existing IDs even if gaps or suffixes remain

If `--no-renumber` is set, treat that as an explicit decline and skip any renumber prompt.

---

## Phase 6 — Final Alignment

**Goal**: Ensure the workspace and tracker describe the same post-reset state.

Before finishing, verify:

- reset epic files no longer exist
- reset task folders no longer exist
- reset implemented summaries no longer exist
- code belonging only to reset epics has been removed
- `0-epics-index.md` reflects the final order, status, and numbering
- any retained epic files or summaries renamed during renumbering are aligned with tracker IDs

---

## Guard Rails

1. Never run reset destructively without explicit user confirmation
2. Never reset epics outside the resolved scope
3. Never delete shared code still required by retained epics
4. Never renumber automatically without confirmation except in `--epic-numbers` mode
5. Use implemented summaries as the primary rollback evidence for completed epics
6. If ownership of code cannot be determined confidently, stop and ask before deleting shared files
7. Reset does not alter business requirements or functional specifications
8. Git history is the audit trail for removed artifacts and implementation

---

## Output Contract

| Artifact | Path | Phase |
| --- | --- | --- |
| Deleted reset epic files | `specs/epics/{epic}.md` | 4 |
| Deleted reset task folders | `specs/epic-tasks/{epic-stem}/` | 4 |
| Deleted reset implemented summaries | `specs/epics-implemented/{epic}.md` | 4 |
| Removed or edited application code | workspace source files | 4 |
| Updated and reordered epic tracker | `specs/epics/0-epics-index.md` | 4-5 |
| Renamed surviving epic artifacts | `specs/epics/`, `specs/epic-tasks/`, `specs/epics-implemented/` | 5 |

## Token Optimization

- **Load when**: `/reset` invoked to roll back delivered or generated epics.
- **Load only**: this workflow + the epic tracker (`specs/epics/0-epics-index.md`) + targeted epic/task files.
- **Destructive workflow** — always confirm with the user before running.
- **Unload after**: tracker reflects new state; deleted artifacts gone; renumbering (if any) committed.
- **Hand-off to**: `product-owner` for fresh epic generation, `requirements-impact-analyzer` if reset stems from requirements drift.
