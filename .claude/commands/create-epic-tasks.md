---
description: Break down a generated epic into self-contained task files under specs/epic-tasks with a 0-tasks-index tracker aligned to the epic tracker.
agent: build
subtask: false
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# Create Epic Tasks

## Input

$ARGUMENTS (required epic file path or epic file name)

Allowed input must resolve to a file under:

```text
specs/epics/**
```

## Purpose

Break a generated epic into smaller, independently executable task files that can be run directly without a slash command.

This command is the preferred path for large or complex epics that would likely overflow context if implemented directly with `/implement-epic`.

## Token Policy

This is a **generation** command. Token-efficiency rules are **relaxed** while
breaking down an epic: read the source epic file, the epic tracker, the task
template, DoD, any implemented summaries for dependencies, and all UI assets
**in full**. If the source epic references the detailed `specs/*.md` specs for
technical detail or diagrams beyond what the epic file itself carries, read
those detailed specs too — they are the single source of truth (there is no
concise variant). Per-epic decomposition is a batching strategy, not a
summarisation strategy — each generated task file must be self-contained and
fully traceable to the source epic. See `@.claude/docs/context-optimization.md`
(Generation Phase Exception).

**Context extraction (soft optimization):** extract the scoped slice each task
needs — the relevant entities, flows, endpoints, permissions, and diagrams —
from the source epic (and, where needed, the detailed FSD/BRD) plus the tracker
and implemented summaries. Once that scoped context is captured into the task
files, you **may** unload the large detailed specs to keep context focused — but
only if it helps and only after extraction is complete. Context overflow is
**not** a concern, so never trade completeness or traceability for a smaller
context.

## Guardrails

- Reject inputs outside `specs/epics/**`
- If the epic tracker entry is still `pending`, update it to `epic-generated` once the task set is created
- If the task folder already exists, treat the run as task-set maintenance rather than full regeneration

## Canonical Task Status Values

Use these exact lowercase task statuses:

- `pending`
- `complete`

## Output Location

For epic:

```text
specs/epics/epic-008-business-rules-engine-foundation.md
```

create:

```text
specs/epic-tasks/epic-008-business-rules-engine-foundation/
```

with:

- `0-tasks-index.md`
- numbered task files

## Pre-Flight

Load lazily:

- source epic file
- `specs/epics/0-epics-index.md`
- `@.claude/CLAUDE.md`
- `@.claude/workflows/epic-based-development.md`
- only the standards needed for the epic scope
- relevant implemented context from `specs/epics-implemented/*.md`
- **the sibling spec docs the epic depends on** — where the source epic points at
  (rather than inlines) the data model, diagrams, strategy, RTM, or a preserved
  source artefact, read the referenced doc so the task files can inline the detail
  and satisfy the Self-Contained Contract (Step 5):
  - `specs/data-dictionary.md` — for entity/column detail (single file; delegate a sub-agent to extract the relevant section)
  - `specs/architecture-diagrams.md` — for master diagrams to extract scoped slices from (single file)
  - `specs/strategy.md` / `specs/requirements-traceability-matrix.md` — for constraining decisions and requirement IDs
  - `specs/reference/**` — the only surviving copy of preserved source artefacts (the input folder is deleted)
  - `specs/business-requirements.md` / `specs/functional-specifications.md` — the source-of-truth single files; delegate a sub-agent to read and extract the scoped slice when the epic defers technical detail to them

**MANDATORY — UI Asset Discovery (for UI epics/tasks):**
If the epic has any UI scope, before generating task files scan and record:

1. **Wireframes** — scan `.claude/wireframes/` for relevant wireframe files:
   - HTML wireframe mockups (e.g. built with DaisyUI components)
   - wireframe description / layout-notes docs
   Note which pages, flows, or sections within each file are relevant to individual tasks.

2. **Existing components** — scan `apps/web/src/components/` across all subfolders:
   - `apps/web/src/components/ui/` — primitive and base UI elements
   - `apps/web/src/components/composite/` — composed multi-part widgets (tables, cards, modals, etc.)
   - `apps/web/src/components/features/` — domain-specific feature components
   - `apps/web/src/components/layouts/` — page shells, sidebars, navigation

3. **Storybook catalogue** — read `.claude/standards/component-usage.md` for catalogue entries, documented variants, and approved import paths.

4. **Storybook stories** — identify `apps/web/src/components/**/*.stories.tsx` files covering components relevant to each task's UI scope.

Map discovered assets to individual tasks. Embed references in task files (Step 5).

## Process

### Step 1: Validate Epic Input

Before reading the epic body:

- ensure the path is inside `specs/epics/`
- resolve the target folder name from the exact epic file stem
- derive output folder:
  - `specs/epic-tasks/<epic-file-stem>/`

### Step 2: Read Epic and Context

Read the epic to extract:

- epic title and dependencies
- requirements and acceptance criteria
- architecture and data model
- test requirements
- definition of done

Also read:

- `specs/epics/0-epics-index.md`
- any existing implemented summaries relevant to dependencies
- `@.claude/templates/epic-task-index-template.md`

### Step 3: Analyze Task Breakdown

Break the epic into tasks that are:

- coherent
- dependency-aware
- independently executable
- sized to reduce token pressure

Guidance:

- if there would be more than 10 tasks, group adjacent work into larger, phase-based tasks
- keep backend, frontend, tests, and final verification explicit where relevant
- preserve natural implementation order

### Step 4: Create 0-Tasks-Index

Always create:

```text
specs/epic-tasks/<epic-file-stem>/0-tasks-index.md
```

Include:

- epic reference
- how to use the file
- task status legend
- task queue table
- guidance on which tasks can be run in parallel by agents when dependencies do not conflict
- implemented functionality log
- guidance on updating both task files and the index when a task completes
- instruction to automatically continue to the next task after completion steps

### Step 5: Generate Task Files

#### Self-Contained / Autonomous Document Contract (MANDATORY)

Each task file must carry the **complete picture** an implementer needs to
execute it with **no other document open** — not the source epic, not the BRD/FS,
not the data-dictionary. Task files are frequently run in fresh, isolated agent
contexts (including in parallel), so a bare "see the epic" or "see the FS" is not
sufficient. Carry the references **down** from the epic into each task:
duplication **or** referencing is acceptable, but a reference is only enough when
the referenced content is small and stable — otherwise **inline** it.

For the slice each task covers, pull in from the source epic (and, where the epic
itself only pointed at them, from the detailed specs):

- the exact **business rules / acceptance criteria** governing the task,
- the **FS behaviour** — endpoints, request/response, status codes, validation,
  RBAC, domain events, error/edge cases, state transitions,
- the **data-dictionary** entries — tables, columns
  (type/nullable/default/FK/index), enums, JSONB shapes, and **data ownership /
  system-of-record** for entities the task touches,
- the **scoped Mermaid diagrams** (see below), extracted — not linked,
- for any preserved source artefact the task depends on, the exact
  `specs/reference/<category>/<file>` path (restate schema-only column layouts the
  task needs). The transient input folder is gone; every `specs/reference/` pointer
  must resolve **inside `specs/reference/`**.

A task that can only be completed correctly by also opening the epic or the specs
has **failed** this contract. Keep it terse and structured — the consumer is an
AI agent — but keep it **complete and standalone**.

Each task file must include:

- frontmatter with `status: pending`
- source epic reference
- task index reference
- overview, context, requirements, implementation guidance, validation
- **Technical completeness** — the requirements/implementation-guidance sections
  must carry every technical detail an AI agent needs to implement this task
  without guessing: entities and fields (type, nullability, constraints),
  relationships, endpoints (method, path, request/response, status codes),
  DTO/validation rules, RBAC permissions per operation, domain events and
  payloads, and error/edge-case handling relevant to this task. Keep it terse
  and structured (tables, bullet lists), not verbose prose — the consumer is an
  AI agent. Extract these from the source epic and, where needed, the detailed
  FSD/BRD.
- **Scoped design diagrams** — embed **Mermaid** diagrams covering only the
  entities and flows this task touches, extracted from the epic's (or FSD's)
  master diagrams. Include only the diagram types that make sense for this task
  (candidates: data model / ER / class / object, sequence, state, component,
  activity, data flow, use case); multiples are allowed; omit a type if it adds
  nothing. Diagrams let a human verify the task before code is written. Every
  diagram MUST follow the binding standard
  `@.claude/standards/mermaid-standards.md` (portable syntax, sparing emoji,
  `classDef` theme, `subgraph` boundaries, `accTitle`/`accDescr`); see
  `.claude/commands/diagram-create.md` for authoring examples.
- **UI tasks only — `## UI Assets` section** (include if the task has any UI scope; omit if backend-only):
  - **Wireframes**: list relevant wireframe file paths from `.claude/wireframes/` and the specific page, flow, or section within that file that applies to this task (e.g., `.claude/wireframes/<wireframe>.html` — table rows / status badge states)
  - **Existing components to reuse**: for each applicable component found in `apps/web/src/components/`, list:
    - exact import path (e.g., `apps/web/src/components/composite/DataTable/DataTable.tsx`)
    - Storybook story file (e.g., `apps/web/src/components/composite/DataTable/DataTable.stories.tsx`)
    - relevant documented variants, props, or visual states to leverage
    - catalogue entry in `.claude/standards/component-usage.md` (section heading or component name)
  - Instruction: the implementing agent **must** inspect all listed wireframes before writing any UI code and **must** reuse or extend listed components rather than creating new equivalents. Reviewed Storybook stories must inform prop choices and visual states.
- **UI tasks only — MANDATORY protocol notice** (include for every task with UI scope):

  > **MANDATORY**: Before writing any UI code for this task, you MUST follow `.claude/workflows/frontend-ui-protocol.md` in full. This protocol is non-negotiable and supersedes ad-hoc UI decisions.

  Reference: `.claude/workflows/frontend-ui-protocol.md`
- **MANDATORY — Definition of Done** (include in EVERY task file, adapted to the task's scope):

  > Reference **`@.claude/docs/definition-of-done.md`** for full checklists. Include only relevant sections:
  > - UI tasks → §1 (UI DoD) | Backend/API tasks → §2 (Backend DoD) | All tasks → §6 (Code Quality)

  For **UI tasks** the DoD MUST include:
  ```markdown
  ## Definition of Done
  See: @.claude/docs/definition-of-done.md §1
  - [ ] `.claude/workflows/frontend-ui-protocol.md` followed in full
  - [ ] `pnpm inspect:ui` clean: zero console errors, zero network failures, screenshot verified
  - [ ] Accessibility: aria-label, role, keyboard navigation verified
  - [ ] Component unit tests added/updated (all visual states + interactions covered)
  - [ ] Playwright E2E tests added/updated (happy path + error + auth guard)
  - [ ] `/playwright-ui-audit` run — zero critical violations
  - [ ] `pnpm --filter @repo/web test` passes
  - [ ] `pnpm lint` and `pnpm type-check` clean
  ```

  For **backend/API tasks** the DoD MUST include:
  ```markdown
  ## Definition of Done
  See: @.claude/docs/definition-of-done.md §2
  - [ ] Service unit tests covering all branches, EventBridge assertions, error paths
  - [ ] Controller unit tests — HTTP codes, DTO passthrough, guard delegation
  - [ ] Integration tests (if DB or auth behaviour changed)
  - [ ] `pnpm test` (and `pnpm test:integration --runInBand` if applicable) passes
  - [ ] Coverage ≥ 80% branches, ≥ 85% lines
  - [ ] `pnpm lint` and `pnpm type-check` clean
  ```
- explicit completion instructions to:
  1. update the task file status to `complete`
  2. update `0-tasks-index.md` status to `complete`
  3. append implemented functionality to `0-tasks-index.md`
  4. Run `/compact` command if the current session context is getting too big and might cause overflow
  5. automatically start the next task in the queue without asking the user

For the final task in the queue, completion instructions must additionally require the implementing agent to automatically:

1. update the source epic file status to `complete`
2. update the source epic row in `specs/epics/0-epics-index.md` to `complete` with a concise delivered summary
3. create or update `specs/epics-implemented/<same-epic-file-name>.md`
4. do all of the above without asking the user whether the summary should be created

Do not instruct deletion of task files.

### Step 6: Sync Epic Tracker

After creating the task set:

- update the source epic row in `specs/epics/0-epics-index.md` to `epic-generated` if it is still `pending`
- note in the epic tracker summary or notes column that this epic is now tracked via `specs/epic-tasks/<epic-file-stem>/0-tasks-index.md`

### Step 7: Final Task Behavior

The final task must describe how, after all tasks are complete:

- the task index rolls up the implemented functionality for the epic
- the source epic must then be marked `complete` automatically
- an implementation summary must be created or updated automatically in:
  - `specs/epics-implemented/<same-epic-file-name>.md`
- the source epic row in `specs/epics/0-epics-index.md` must be updated to `complete` with a concise delivered summary
- none of these completion actions should ask the user for confirmation
- if needed, `/mark-epic-completed` can reconcile completion state

## 0-TASKS-INDEX Template Requirements

```markdown
# Epic Task Index

**Epic Reference**: `specs/epics/epic-008-business-rules-engine-foundation.md`

## How to Use This File

1. Execute task files in sequence unless dependencies explicitly allow parallel work
2. After completing a task, update the task file status to `complete`
3. Update this file from `pending` to `complete`
4. Append the functionality implemented by that task
5. Compact the current session context
6. Automatically continue with the next task in the queue without asking the user
7. When the final task completes, automatically finalize the epic by marking the source epic and epic tracker row `complete` and creating or updating `specs/epics-implemented/<same-epic-file-name>.md` without asking the user

## Parallel Execution Guidance

1. Identify tasks whose dependencies are already complete and do not overlap on the same files, APIs, schemas, or shared test fixtures
2. Run those tasks in parallel using separate agents when doing so will not create conflicting edits or ambiguous ownership
3. Keep dependent tasks sequential until the prerequisite work is complete and reflected in this index

## Task Status Legend

- `pending`
- `complete`

## Task Queue

| # | Task File | Status | Depends On | Summary |
|---|---|---|---|---|
| 1 | 1-backend-foundation.md | pending | - | - |
| 2 | 2-backend-api.md | pending | 1 | - |

## Implemented Functionality Log

### Task 1 — YYYY-MM-DD
- [implemented items]
```

## Quality Checklist

- [ ] Input restricted to `specs/epics/**`
- [ ] Task folder name matches epic file stem exactly
- [ ] `0-tasks-index.md` created first
- [ ] All task files are self-contained
- [ ] Each task satisfies the Self-Contained / Autonomous Document Contract — inlines (or, for small/stable content, references) the business rules, FS behaviour, data-dictionary entries, scoped diagrams, and `specs/reference/` pointers needed to execute it with no other doc open
- [ ] Every `specs/reference/` pointer in a task resolves inside `specs/reference/` — no task depends on the deleted source input folder
- [ ] Where the source epic deferred technical detail to a sibling spec, the referenced sibling was read and the detail carried down into the task files
- [ ] Each task's requirements/implementation guidance are implementation-ready (entities/fields, endpoints, DTO/validation, permissions, events, error handling) and terse/structured
- [ ] Each task embeds scoped Mermaid design diagrams (only the diagram types that make sense for the task), extracted from the epic/FSD master diagrams
- [ ] Task completion updates both task file and index status
- [ ] Task completion instructions enforce context compaction and automatic next-task continuation
- [ ] Final task instructions enforce automatic epic completion and automatic implementation-summary creation
- [ ] Task index includes safe parallel-execution guidance for non-conflicting tasks
- [ ] Large epic is reduced to manageable task count
- [ ] For UI epics, `.claude/wireframes/` was scanned and each relevant wireframe mapped to the specific task(s) it informs
- [ ] For UI epics, `apps/web/src/components/` (all four subfolders) and `.claude/standards/component-usage.md` were checked for reusable components
- [ ] Each UI task file includes a `## UI Assets` section when wireframes, reusable components, or Storybook stories were found
- [ ] Component references in task files include exact import paths, corresponding `.stories.tsx` paths, and relevant variants/props
- [ ] Task `## UI Assets` sections instruct the implementing agent to inspect wireframes and reuse listed components
- [ ] Every UI task file includes a MANDATORY notice to follow `.claude/workflows/frontend-ui-protocol.md` before writing any UI code
- [ ] Every task file (UI and backend) includes a MANDATORY `## Definition of Done` checklist appropriate to the task's scope
- [ ] UI task DoD includes: UI protocol, browser inspection, component tests, Playwright E2E tests, lint/type-check
- [ ] Backend task DoD includes: unit tests (service + controller), integration tests, coverage thresholds, lint/type-check

## Cross-References

- Epic planning: `/create-epics`
- Direct epic implementation: `/implement-epic`
- Completion recovery: `/mark-epic-completed`
- Epic task tracker template: `@.claude/templates/epic-task-index-template.md`
- Epic workflow: `@.claude/workflows/epic-based-development.md`
