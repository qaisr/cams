---
description: >-
  Create sequenced, non-destructive implementation tasks for non-functional work — cosmetic
  changes, refactoring, performance tuning, accessibility improvements, configuration updates,
  documentation, and other tasks that do not add or change application functionality. Routes
  functional feature requests to /add-feature automatically.
agent: build
subtask: false
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# Create Implementation Tasks

## Input

$ARGUMENTS (one of two input modes):

1. **Plain text description** of the work to be done
2. **Path to a requirements or specification file**

## Scope Classifier — Read This First

Before doing anything else, determine whether the request is **functional** or **non-functional**.

### Route to `/add-feature` if the request involves:

- Adding a new API endpoint, page, form, or user-facing capability
- Changing business logic, data model, or domain behaviour
- Adding or modifying user roles, permissions, or authorization rules
- Integrating with an external service or downstream system
- Any change that a business stakeholder would describe as a "new feature" or "change in behaviour"

If any of the above apply, stop and tell the user:

```
This looks like a functional change — it adds or modifies application behaviour.
Use /add-feature instead:

  /add-feature <your description or requirements file>

/add-feature will auto-detect the scope (API / UI / full-stack), run an ambiguity
review, create epics in specs/epics/, and follow the epic-based workflow.
```

### Proceed with `/create-tasks` if the request is non-functional, such as:

- UI cosmetics — spacing, colours, typography, animation, layout polish
- Code refactoring or clean-up with no behaviour change
- Performance optimisation (caching, query tuning, bundle size reduction)
- Accessibility improvements (WCAG compliance, aria attributes, keyboard navigation)
- Non-functional requirements — logging verbosity, error message wording, code organisation
- Configuration or environment changes (env vars, feature flags, infrastructure config)
- Documentation, README updates, architectural decision records
- Test coverage improvements without adding new tested behaviour
- Tooling and developer experience changes (lint rules, CI tweaks, scripts)

---

## Guardrail

If `$ARGUMENTS` points to `specs/epics/**`, stop and tell the user to use:

```text
/create-epic-tasks <EPIC_FILE>
```

## Purpose

Create sequenced, self-contained task files for non-functional work with a persistent
`0-tasks-index.md` tracker. Task files are **not self-destructive** — they are retained
after completion as a delivery log.

## Token Policy

This is a **generation** command. Token-efficiency rules are **relaxed** while
generating task files: read the input description or requirements file and any
relevant standards **in full**. Each generated task file must be self-contained
and fully reference its source context. See
`@.claude/docs/context-optimization.md` (Generation Phase Exception).

## Purpose

Bridge between quick feature additions and epic planning by creating self-contained task files plus a persistent task tracker.

Unlike the old behavior, generated task files are **not self-destructive**.

## Workflow Overview

```text
INPUT (description or requirements file)
  ↓
SCOPE CLASSIFIER → functional? → redirect to /add-feature
  ↓ non-functional
ANALYZE & CLARIFY
  ↓
CONFIRM DESTINATION
  ↓
CREATE 0-TASKS-INDEX
  ↓
GENERATE SELF-CONTAINED TASK FILES
  ↓
TRACK TASK COMPLETION IN BOTH TASK FILES AND 0-TASKS-INDEX
```

## Process

### Step 1: Identify Input Type and Classify Scope

Apply the Scope Classifier above. If the request is functional, redirect immediately.

If non-functional, determine input type:

- plain text → use as-is
- file path → read it and extract the scope, constraints, and acceptance criteria

### Step 2: Load Context Lazily

Load only what is relevant to the non-functional scope:

- `@.claude/CLAUDE.md`
- Relevant standards for the work type:
  - UI cosmetics: `@.claude/standards/ui-design-standards.md`
  - Performance: `@.claude/standards/api-standards.md` (backend) or `@.claude/standards/frontend-standards.md` (frontend)
  - Accessibility: `@.claude/standards/frontend-standards.md`
  - Testing: `@.claude/standards/testing-standards.md`
- `@specs/functional-specifications.md` (for context only — do not treat as scope to implement)

### Step 3: Run Ambiguity Review

If scope or task boundaries are unclear, surface questions before generating tasks.
For non-functional work, apply the ambiguity analyst flow lightly — focus on:
- Where in the codebase the change applies
- Whether any behaviour change is a risk (if so, redirect to `/add-feature`)
- Expected outcome and definition of done

### Step 4: Confirm Destination Folder

Create tasks under:

```text
specs/tasks/<feature-folder>/
```

The first file must always be:

```text
specs/tasks/<feature-folder>/0-tasks-index.md
```

### Step 5: Create 0-Tasks-Index

The task tracker must include:

- feature name
- source requirements/spec reference
- concise instructions for how to use the task set
- task status legend
- task table
- implemented functionality log

Canonical task status values:

- `pending`
- `complete`

### Step 6: Generate Task Files

Each task file must be:

- self-contained
- independently executable
- linked to `0-tasks-index.md`
- linked back to the source requirements/spec
- tagged with frontmatter status `pending`

Suggested frontmatter:

```yaml
---
task_name: [name]
task_sequence: [N/total]
depends_on: [task ids]
execution_mode: direct-task
fallback_executor: add-feature
status: pending
created_at: [date]
task_index: specs/tasks/<feature-folder>/0-tasks-index.md
source_context: [path or description]
---
```

### Step 7: Completion Instructions in Each Task File

Each task file must end with explicit instructions to:

1. update the task file status from `pending` to `complete`
2. update `0-tasks-index.md` from `pending` to `complete`
3. append a concise summary of implemented functionality to `0-tasks-index.md`
4. ask the user whether the next task in the queue should be started

Do **not** instruct the user to delete the task file.

### Step 8: Final Task Requirements

The final task should:

- verify that all prior tasks are complete
- perform end-to-end verification
- describe any specification updates needed
- update `0-tasks-index.md` with a final delivery summary

**MANDATORY final task DoD checklist** (include in the final task file, adapted to scope):

> Reference **`@.claude/docs/definition-of-done.md`** for the full checklists. Include only the sections applicable to the task set scope:
> - UI work → §1 (UI DoD) and §6 (Code Quality)
> - Backend/API work → §2 (Backend DoD) and §6 (Code Quality)
> - Component work → §3 (Component DoD)
> - All tasks → §6 (Code Quality Gate)

Abbreviated checklist for inclusion in task files:

For any task set that includes UI work:
```markdown
## Definition of Done — UI
See: @.claude/docs/definition-of-done.md §1
- [ ] `.claude/workflows/frontend-ui-protocol.md` followed in full
- [ ] `pnpm inspect:ui` — zero console errors, zero network failures, screenshot verified
- [ ] Accessibility attributes present and keyboard navigation works
- [ ] Component unit tests added/updated (all visual states + interactions)
- [ ] Playwright E2E tests added/updated for new pages/features
- [ ] `/playwright-ui-audit` run — zero critical violations
- [ ] `pnpm --filter @repo/web test` passes
```

For any task set that includes backend/API work:
```markdown
## Definition of Done — Backend
See: @.claude/docs/definition-of-done.md §2
- [ ] Service unit tests — all branches, EventBridge, error paths
- [ ] Controller unit tests — HTTP codes, guards, DTO passthrough
- [ ] Integration tests (Testcontainers) if any DB or auth behaviour changed
- [ ] `pnpm test` and (if applicable) `pnpm test:integration --runInBand` pass
- [ ] Coverage ≥ 80% branches, ≥ 85% lines
```

For all task sets:
```markdown
## Definition of Done — Code Quality
- [ ] `pnpm lint` — zero warnings
- [ ] `pnpm type-check` — zero TypeScript errors
```

## 0-TASKS-INDEX Template Requirements

```markdown
# Task Implementation Index

## How to Use This File

1. Execute task files in sequence unless dependencies allow safe parallel work
2. After completing a task, update the task file status to `complete`
3. Update this file with status = `complete`
4. Append the functionality implemented by that task
5. Ask the user if the next task in the queue should be started

## Task Status Legend

- `pending`
- `complete`

## Task Queue

| # | Task File | Status | Depends On | Summary |
|---|---|---|---|---|
| 1 | 1-backend-api.md | pending | - | - |
| 2 | 2-frontend-ui.md | pending | 1 | - |

## Implemented Functionality Log

### Task 1 — 2026-04-30
- Added backend endpoint X
- Added tests Y
```

## Quality Checklist

- [ ] Scope classifier ran — request confirmed as non-functional
- [ ] Functional requests redirected to `/add-feature`
- [ ] Epic paths rejected and routed to `/create-epic-tasks`
- [ ] `0-tasks-index.md` is always created
- [ ] Tasks are non-destructive
- [ ] Task file and tracker file share the same completion status
- [ ] Implemented changes are appended to the index on completion

## Cross-References

- Functional feature work: `/add-feature`
- Epic task creation: `/create-epic-tasks`
- Epic workflow: `@.claude/workflows/epic-based-development.md`
