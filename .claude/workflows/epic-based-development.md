# Epic-Based Development Workflow

> **Operating Discipline (always applies).** Follow `@.claude/CLAUDE.md` → Operating Discipline throughout this workflow: never hallucinate paths/APIs/versions, never assume intent to fill a gap, never implement unrequested scope, clarify ambiguities before acting, and get **explicit human approval** before anything hard-to-reverse or beyond the stated request. Report faithfully what was done, skipped, or failed.


## Overview

Systematic AI-driven development of enterprise applications from specifications to epics to implementation, with two execution paths:

1. **Direct epic implementation** for small/medium epics
2. **Epic-to-task breakdown** for large/complex epics

This workflow is designed to reduce token pressure by using tracker files and lazy loading rather than repeatedly loading all epic or task files.

## Entry Points

This workflow has two entry points depending on context:

### Full Application Build (Greenfield or Major Phase)

Use when building a whole application or a major planned phase from specifications:

```text
/create-specifications
  → /create-epics (first run creates specs/epics/0-epics-index.md only)
  → /create-epics (subsequent runs generate next pending epics)
```

### Single Feature Addition (Existing Application)

Use when adding a feature to an existing application, whether API-only, UI-only, or full-stack:

```text
/add-feature <description | story-id | requirements-doc | requirements-folder>
  → auto-detects feature type (API / UI / Full-Stack)
  → runs ambiguity review if scope or permissions are unclear
  → checks alignment with existing and queued epics
  → estimates size and proposes epic breakdown
  → creates epic(s) in specs/epics/ and updates 0-epics-index.md
```

Both entry points converge at the same implementation and completion steps below.

## Canonical Flow

```text
[entry point: /create-epics or /add-feature]
  → ambiguity review (if scope, permissions, or boundaries are unclear)
  → epic breakdown confirmed
  → epic files generated in specs/epics/
  → 0-epics-index.md updated
  → choose per epic:
      - /implement-epic <EPIC_FILE>        for S/M epics
      - /create-epic-tasks <EPIC_FILE>     for L/XL epics
  → implement and verify
  → update tracker(s)
  → write specs/epics-implemented/<epic-file>.md
  → mark epic complete
```

## Tracker Model

### Epic Tracker

Location: `specs/epics/0-epics-index.md`

Canonical epic statuses:

- `pending`
- `epic-generated`
- `complete`

Purpose:

- planned epic queue
- generated epic tracking
- concise implemented summary of completed epics
- dependency-aware implementation order
- implemented-context handoff for future runs

### Task Tracker

Location: `specs/epic-tasks/<epic-file-stem>/0-tasks-index.md`

Canonical task statuses:

- `pending`
- `complete`

Purpose:

- task sequencing
- implemented functionality log per task
- handoff between independent task executions

## Execution Path Selection

### Use /implement-epic when:

- epic size is S or M
- context comfortably fits in a direct implementation pass
- the epic does not need decomposition into many independent slices

### Use /create-epic-tasks when:

- epic size is L or XL
- epic spans multiple layers and many acceptance criteria
- token pressure or context overflow is likely
- the user wants independently executable task files

## Completion Artifacts

### Implemented Epic Summary

Primary summary location:

- `specs/epics-implemented/<EXACT_FILE_NAME_AS_ORIGINAL_EPIC_FILE_NAME>.md`

This is the preferred evidence source for later completion reconciliation and future planning context.

### Recovery Path

If implementation finished but tracker state was not updated, use:

- `/mark-epic-completed <EPIC_FILE>`

This command resolves evidence in this order:

1. `specs/epics-implemented/<epic-file>.md`
2. `specs/epic-tasks/<epic-file-stem>/0-tasks-index.md`
3. current workspace changes
4. targeted code analysis

## Token Optimization Principles

- Create the epic tracker first, before generating individual epics
- On later `/create-epics` runs, read the tracker first and generate only the next pending epics
- Prefer implemented summaries in `specs/epics-implemented/` over re-reading many old epic files
- For large epics, prefer task breakdown to reduce active context size per implementation step
- Load standards and workflows lazily based on the active scope only

### Generation Phase Exception

During epic and epic-task generation (`/create-epics`, `/create-epic-tasks`,
`/add-feature` epic-planning phase) the token-efficiency rules above are
**relaxed**:

- Tracker-first and incremental generation are *batching* strategies, not
  summarisation strategies. Within each batch, read source documents (business
  requirements, functional specifications, wireframes, user-supplied inputs)
  **in full**.
- Do not skip, truncate, or summarise sections of `specs/business-requirements.md`,
  `specs/functional-specifications.md`, or input requirements folders to save
  tokens — completeness and traceability take precedence.
- Generated epic and task files may be long. Prefer completeness over brevity.

Normal token discipline resumes once epics/tasks are generated and the workflow
moves into `/implement-epic`. Full carve-out: `@.claude/docs/context-optimization.md`
(Generation Phase Exception).

## Cross-References

- Feature intake (single feature): `/add-feature`
- Epic creation (full project): `/create-epics`
- Epic task creation: `/create-epic-tasks`
- Direct epic implementation: `/implement-epic`
- Completion recovery: `/mark-epic-completed`
- Ambiguity review: `@.claude/agents/ambiguity-analyst.md`
- General tasks (deprecated — use /add-feature): `/create-tasks`
