---
description: Plan and generate sequenced epics from business and functional specifications using a tracker-first workflow with incremental epic generation.
agent: build
subtask: false
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# Create Epics from Specifications

## Input

$ARGUMENTS (optional path to functional specifications document)
Default: `@specs/functional-specifications.md`

## Purpose

Create and manage a staged epic-delivery workflow that avoids context overflow on large projects.

This command works in two modes:

1. **Tracker bootstrap mode**
   - If `specs/epics/0-epics-index.md` does not exist, create it first.
   - Do **not** generate individual epic files on the first run.
   - Build a full epic plan with all epics marked `pending`.

2. **Incremental epic generation mode**
   - If `specs/epics/0-epics-index.md` exists, read it.
   - Recommend generating the next 3 `pending` epics.
   - Ask the user how many epics to generate.
   - Generate only the selected pending epics.
   - Mark generated epics as `epic-generated`.

## Token Policy

This is a **generation** command. Token-efficiency rules are **relaxed** while
generating epics: read `specs/business-requirements.md`,
`specs/functional-specifications.md`, the sibling docs produced by
`/create-specifications` (`specs/strategy.md`, `specs/data-dictionary.md`,
`specs/architecture-diagrams.md`, `specs/requirements-traceability-matrix.md`, and
`specs/reference/**`), the epic template, DoD, authorization patterns, and any UI
assets **in full**. These detailed specs are the single source of truth — there
is no concise variant. Tracker-first / incremental
generation is a batching strategy — not a summarisation strategy. Within each
batch, read source documents completely so the generated epic files are
self-contained and fully traceable. See
`@.claude/docs/context-optimization.md` (Generation Phase Exception).

**Context extraction (soft optimization):** the detailed BRD/FSD are large. For
each incremental batch, extract the scoped slice the batch needs — the relevant
entities, flows, endpoints, permissions, and diagrams — from the detailed specs
plus `specs/epics/0-epics-index.md` and `specs/epics-implemented/*.md`. Once that
scoped context is captured into the epic files being generated, you **may**
unload the large detailed specs to keep context focused — but only if it helps
and only once extraction is complete. Context overflow is **not** a concern, so
do not force this: never trade completeness or traceability for a smaller
context.

## MCP Access — Hard Prohibition

> **HARD RULE**: `/create-epics` **MUST NOT** call any remote JIRA, Confluence, or Figma MCP
> tool (no `mcp__atlassian__*`, `mcp__figma__*`, or any other live-API tool). All content is
> read from local files only — `specs/`, `jira/`, `confluence/`, `figma/` on disk. If a local
> mirror is stale or missing, report it and stop; do NOT refresh it inline. The user runs
> `/jira-sync` or `/confluence pull` separately before re-running this command.

## Canonical Epic Status Values

Use these exact lowercase status values in `specs/epics/0-epics-index.md`:

- `pending` — epic is planned in the queue, but the epic file has not been generated yet
- `epic-generated` — epic file exists in `specs/epics/`, but implementation is not yet complete
- `complete` — epic is fully implemented, tested, and recorded in the epic tracker and implementation summary

## Pre-Flight

Load required context lazily. Read **both** primary specs **and** all sibling
documents produced by `/create-specifications` — an epic cannot be self-contained
if the epic writer never saw the data model, diagrams, strategy, or preserved
source. All spec documents are **single files** (no split directories):

- `@specs/business-requirements.md` — business source of truth; delegate a sub-agent to extract the scoped slice for the epic(s) in hand
- `@specs/functional-specifications.md` — technical source of truth; delegate a sub-agent to extract the scoped slice for the epic(s) in hand
- `@specs/strategy.md` — guiding principles, key decisions, ADRs, phasing
- `@specs/data-dictionary.md` — tables, columns, ownership, enums, ER
- `@specs/architecture-diagrams.md` — context/container/component/sequence/state/DFD
- `@specs/requirements-traceability-matrix.md` — requirement → FS → epic mapping
- `specs/reference/README.md` and `specs/reference/**` — verbatim / schema-only preserved source artefacts (the transient input folder is gone; this is the only surviving copy)
- `@.claude/workflows/epic-based-development.md`
- `@.claude/docs/authorization-patterns-and-architecture.md`
- `@.claude/standards/database-standards.md`

Any of the sibling docs may be absent for a small project (`/create-specifications`
generates them only when warranted). Read every one that exists; do not fail if a
sibling is missing.

**MANDATORY — UI Asset Discovery (for UI epics):**
Before generating any UI epic files, scan and record all relevant UI assets:

1. **Wireframes** — scan `.claude/wireframes/` for wireframe files (e.g., HTML mockups or wireframe docs) and read `.claude/wireframes/.generated-manifest.json` if present. List each file, note which pages/flows/features it covers, and record its manifest status (`wireframeType` + whether it is `converted`). This status drives Wireframe Precedence when embedding references (Step 11).
2. **Existing components** — scan `apps/web/src/components/` across all four subfolders:
   - `apps/web/src/components/ui/` — primitive and base UI elements
   - `apps/web/src/components/composite/` — composed multi-part widgets (tables, cards, modals, etc.)
   - `apps/web/src/components/features/` — domain-specific feature components
   - `apps/web/src/components/layouts/` — page shells, sidebars, navigation
3. **Storybook catalogue** — read `.claude/standards/component-usage.md` for the current Storybook component catalogue entries, documented variants, and approved import paths.
4. **Storybook stories** — note any `apps/web/src/components/**/*.stories.tsx` files that document usage examples and visual states for components relevant to this epic.

Record the mapping of wireframes, components, and stories to each epic. This mapping is used in Step 5 to embed UI asset references into relevant epic files.

When relevant:

- Read `@.claude/docs/component-library.md` before frontend sizing decisions
- Query design system MCP for UI complexity signals (if configured)
- Query Context7 MCP for framework/library sizing patterns
- Query CEB MCP for PPCC-specific constraints

## Workflow

### Step 1: Read Specifications and Existing Delivery State

Read the requirements and establish:

- feature areas and priorities
- domain entities and relationships
- expected delivery phases
- likely epic boundaries
- already-implemented context from:
  - `specs/epics/0-epics-index.md` (if present)
  - `specs/epics-implemented/*.md` summaries

Use implemented summaries to avoid generating epics that duplicate completed work.

### Step 2: Analyze and Propose Epic Sequence

Create a sequenced epic plan that:

- starts with foundations
- groups related domain slices together
- keeps dependency order explicit
- marks large epics as candidates for `/create-epic-tasks`

Use size guidance:

- **S** — directly suitable for `/implement-epic`
- **M** — usually suitable for `/implement-epic`
- **L** — recommend `/create-epic-tasks`
- **XL** — must recommend `/create-epic-tasks`, and split more aggressively if needed

### Step 3: Tracker Bootstrap Mode

If `specs/epics/0-epics-index.md` does not exist:

Create it with:

- project name
- creation date
- concise workflow instructions
- epic status legend
- implementation order
- dependency mapping
- planned epic table with all epics marked `pending`
- concise phase summary
- instructions for how to mark epics `complete`
- structure aligned to `@.claude/templates/epic-index-template.md`
- implemented-context note telling future runs to consult:
  - `specs/business-requirements.md`
  - `specs/functional-specifications.md`
  - `specs/epics/0-epics-index.md`
  - `specs/epics-implemented/*.md`

Do **not** generate individual epic files in this mode.

### Step 4: Incremental Epic Generation Mode

If `specs/epics/0-epics-index.md` already exists:

1. Read the tracker.
2. Find epics with status `pending`.
3. Recommend the next 3 in queue.
4. Ask the user how many to generate.
5. Run ambiguity review if the epic boundaries or priorities are unclear.
6. Generate only the selected pending epic files under `specs/epics/`.
7. Update those epics in the tracker from `pending` to `epic-generated`.

### Step 5: Epic File Requirements

#### Self-Contained / Autonomous Document Contract (MANDATORY)

Each epic file must carry the **complete picture** an implementer needs to build
its slice with **no other document open**. The source specs are the single source
of truth, but the implementing agent may run in a fresh context with none of them
loaded — so the epic must stand alone. Duplication **or** referencing is
acceptable; a bare cross-reference is only sufficient when the referenced content
is small and stable. When in doubt, **inline** it.

For every slice the epic touches, pull the relevant material out of the specs and
into the epic file:

- **BRD** — the specific business rules, user stories (Gherkin), and acceptance
  criteria that govern this slice (inline the exact rule text, not "see BRD").
- **FS** — the behaviour: endpoints, request/response shapes, status codes,
  validation, RBAC, domain events, error/edge cases, state transitions.
- **Data-dictionary** — the exact tables, columns (type/nullable/default/FK/index),
  enums, JSONB shapes, and **data ownership / system-of-record** for the entities
  this epic writes or reads.
- **Architecture-diagrams** — the scoped Mermaid slice (see item 5) extracted from
  the master diagrams, not a pointer to the master file.
- **`specs/reference/`** — for any preserved source artefact this slice depends on,
  cite the exact `specs/reference/<category>/<file>` path (and, for schema-only
  artefacts, restate the column layout the epic needs). The transient input folder
  no longer exists; `specs/reference/` is the only surviving copy, so a pointer must
  resolve **inside `specs/reference/`**, never to the original source folder.
- **Strategy/RTM** — the guiding principles, key decisions, and requirement IDs
  that constrain or trace this slice.

An epic that can only be implemented correctly by also opening the BRD/FS/data-
dictionary has **failed** this contract. Keep it terse and structured (tables,
bullet lists) — the consumer is an AI agent — but keep it **complete**.

Each generated epic file must be self-contained and include:

1. title, priority, dependency, estimated scope
2. application state before this epic
3. what this epic delivers
4. functional, non-functional, and technical requirements — the technical
   requirements must be **implementation-ready**: every detail an AI agent needs
   to build this slice without guessing (entities and fields with type,
   nullability, and constraints; relationships; endpoints with method, path,
   request/response, and status codes; DTO/validation rules; RBAC permissions
   per operation; domain events and payloads; error and edge-case handling).
   Keep it terse and structured (tables, bullet lists), not verbose prose — the
   consumer is an AI agent. Extract these details from the detailed FSD/BRD.
5. architecture and data model notes, including **scoped design diagrams** —
   embed **Mermaid** diagrams covering only the entities and flows this epic
   touches, extracted from the master diagrams in the FSD. Include only the
   diagram types that make sense for this slice (candidates: data model / ER /
   class / object, sequence, state, component, activity, data flow, use case);
   multiples are allowed; omit a type if it adds nothing. Diagrams let a human
   verify the slice before code is written. Every diagram MUST follow the
   binding standard `@.claude/standards/mermaid-standards.md` (portable syntax,
   sparing emoji, `classDef` theme, `subgraph` boundaries, `accTitle`/`accDescr`);
   see `.claude/commands/diagram-create.md` for authoring examples.
6. acceptance criteria in testable form
7. test requirements
8. definition of done (reference `@.claude/docs/definition-of-done.md` §4 with scope-appropriate sections)
9. implementation recommendation:
   - `Recommended Execution Path: /implement-epic`
   - or `Recommended Execution Path: /create-epic-tasks`
10. explicit completion instructions stating that, once implementation is verified complete, the implementing agent must automatically:
   - update the epic file status to `complete`
   - update `specs/epics/0-epics-index.md` to `complete` with a concise delivered summary
   - create or update `specs/epics-implemented/<same-epic-file-name>.md`
   - do all of the above without asking the user whether to create the summary
11. **MANDATORY — Wireframe References (if applicable):**
    - After the UI asset scan in Pre-Flight, check whether any discovered wireframes are pertinent to this epic (e.g., cover a page, flow, or component the epic will deliver).
    - If pertinent wireframes exist, add a dedicated `## Wireframes` section to the epic file listing each relevant wireframe path and the specific section or view within that file that applies (e.g., `.claude/wireframes/<wireframe>.html` — the relevant page or view).
    - Apply **Wireframe Precedence** (see `@.claude/standards/component-usage.md`) using the manifest status recorded in Pre-Flight:
      - For **page/screen/layout** wireframes, state that the implementing agent **must** inspect the wireframe before building any UI and convert it to the configured **UI Library** in `CLAUDE.md` while preserving layout, hierarchy, spacing, states, and interaction intent.
      - For **component/pattern** wireframes already marked `converted`, point the implementing agent at the **generated component** in `apps/web/src/components/` as an **equal-weight** reference — reuse and extend it, and reconcile/flag any drift from the wireframe rather than re-deriving from the raw wireframe.
    - If no wireframes are relevant to this epic, omit the section entirely.

12. **MANDATORY — Existing Component and Storybook References (if UI epic):**
    - After the UI asset scan in Pre-Flight, check whether any components found in `apps/web/src/components/` are reusable or extendable for this epic.
    - Cross-reference `.claude/standards/component-usage.md` for catalogue entries — if an entry exists for a relevant component, note its documented variants and approved usage.
    - Check `apps/web/src/components/**/*.stories.tsx` for Storybook usage examples and documented visual states relevant to this epic's UI scope.
    - If reusable components or relevant Storybook examples are found, add a dedicated `## Existing Components` section to the epic file that lists:
      - component name and exact import path (e.g., `apps/web/src/components/composite/DataTable/DataTable.tsx`)
      - the corresponding Storybook story file (e.g., `apps/web/src/components/composite/DataTable/DataTable.stories.tsx`)
      - relevant documented states, variants, or props to leverage
      - the section in `.claude/standards/component-usage.md` that covers this component (if present)
    - State explicitly that the implementing agent **must** reuse or extend these components rather than creating new equivalents, and must review the Storybook stories for documented props and visual states before writing any UI code.
    - If no reusable components apply to this epic, omit the section entirely.

13. **MANDATORY — Frontend UI Protocol (all UI epics):**
    - If the epic has any UI scope, add the following note to the epic file in a clearly visible position (e.g., directly under the epic title or in an `## Implementation Notes` section):

      > **MANDATORY**: When implementing any part of this epic that involves UI components, pages, or layout, you MUST follow `.claude/workflows/frontend-ui-protocol.md` in full before writing any UI code. This protocol is non-negotiable and supersedes ad-hoc UI decisions.

    - Include the file reference: `.claude/workflows/frontend-ui-protocol.md`
    - This instruction applies whether the epic is executed via `/implement-epic` or broken into tasks via `/create-epic-tasks`.

For large epics, explicitly tell the user to prefer `/create-epic-tasks <EPIC_FILE>`.

### Step 6: Tracker Update Rules

`specs/epics/0-epics-index.md` must remain concise but actionable.

For each epic row, track at minimum:

- epic id
- title
- status (`pending`, `epic-generated`, `complete`)
- priority
- size
- dependencies
- implementation order
- execution recommendation (`implement-epic` or `create-epic-tasks`)
- completion summary column or notes section for implemented outcomes

When an epic becomes `complete`, the tracker should summarize:

- what was delivered
- where the implementation summary lives in `specs/epics-implemented/`

Completion updates and implemented-summary creation must happen automatically during epic completion; do not require a separate user confirmation step for writing `specs/epics-implemented/`.

### Step 6a: Context Optimization – Archive Strategy (For Large Projects)

**Trigger: When `0-epics-index.md` contains implementation details for more than 9 completed epics**

To keep the main tracker lean and token-efficient on long-running projects:

1. **Count completed epic rows** with full implementation summaries (not "See old-implemented-epics.md")
2. **If count > 9**, proceed with archival:
   - Identify the 4 oldest completed epics (by Epic ID)
   - Copy their **complete rows** (ID, Title, Status, Priority, Size, Dependencies, Impl Order, Recommended Path, **full Summary**)
   - Append them to `specs/epics/old-implemented-epics.md` (creating if needed)
   - In `0-epics-index.md`, replace those 4 rows' Summary column with: `See old-implemented-epics.md.`
   - Add a note in `## Notes` section documenting the archive action (e.g., "Archived Epic-001 through Epic-004 to old-implemented-epics.md on [DATE]")

3. **Result**: Main tracker returns to ~5–9 recent completed epics with details, archive grows incrementally

**Maintenance Rule**: Each time a new epic becomes `complete`, re-check the count. If now > 9, move 4 oldest immediately.

**Archive Benefits**:
- Main tracker stays under ~150 KB
- Incremental `/create-epics` generation reads only relevant context
- Full implementation history remains searchable in archive
- No information is lost; patterns can still be referenced if needed

**References**:
- Archive file: `specs/epics/old-implemented-epics.md`
- Strategy guide: `specs/epics/EPICS-CONTEXT-OPTIMIZATION-GUIDE.md`

### Step 7: Clarification Questions

If requirements are ambiguous, ask the user before generating epic files.

Mandatory clarification areas include:

- missing priorities
- unclear mutation permissions
- missing integration details
- epic boundaries that may be too large

### Step 8: Output Summary

If bootstrap mode ran, report:

- tracker created
- total planned epics
- next recommended epics to generate on the next run

If incremental generation mode ran, report:

- epics generated this run
- tracker rows updated to `epic-generated`
- which epics remain `pending`
- whether any generated epic should be executed directly with `/implement-epic` or broken down with `/create-epic-tasks`

## Epic Tracker Template Requirements

`specs/epics/0-epics-index.md` should follow this shape:

```markdown
# Epic Implementation Index

## How to Use This File

1. Generate the tracker first using `/create-epics`
2. Re-run `/create-epics` to generate the next pending epics
3. Use `/implement-epic` for S/M epics
4. Use `/create-epic-tasks` for L/XL epics
5. When implementation is complete, mark the epic `complete`
6. Record concise implemented outcomes and reference `specs/epics-implemented/<epic-file>.md`

## Epic Status Legend

- `pending`
- `epic-generated`
- `complete`

## Epic Queue

| Epic | Title | Status | Priority | Size | Dependencies | Impl Order | Recommended Path | Summary |
|---|---|---|---|---|---|---|---|---|
| Epic-007 | Agreement Structure & Versioning | complete | Must Have | L | 005a,005b,006 | 7 | create-epic-tasks | Agreement CRUD, versioning, parties, state history |
| Epic-008 | Business Rules Engine Foundation | pending | Must Have | L | 006 | 8 | create-epic-tasks | - |
```

## Quality Checklist

- [ ] Tracker exists before incremental epic generation
- [ ] Statuses use lowercase canonical values
- [ ] Generated epics are marked `epic-generated`
- [ ] Completed epics point to `specs/epics-implemented/`
- [ ] Large epics recommend `/create-epic-tasks`
- [ ] Token optimization is preserved by reading only the tracker plus relevant specs and summaries
- [ ] Only the detailed `docs/*.md` specs are referenced — no concise-spec references remain
- [ ] Pre-Flight read BRD + FS **and** every sibling single-file that exists (strategy, data-dictionary, architecture-diagrams, RTM, `specs/reference/`)
- [ ] Each epic satisfies the Self-Contained / Autonomous Document Contract — inlines (or, for small/stable content, references) the BRD rules, FS behaviour, data-dictionary entries, scoped diagrams, and `specs/reference/` pointers needed to implement it with no other doc open
- [ ] Every `specs/reference/` pointer in an epic resolves inside `specs/reference/` — no epic depends on the deleted source input folder
- [ ] Each epic's technical requirements are implementation-ready (entities/fields, endpoints, DTO/validation, permissions, events, error handling) and terse/structured
- [ ] Each epic embeds scoped Mermaid design diagrams (only the diagram types that make sense for the slice), extracted from the FSD master diagrams
- [ ] If count of completed epics > 9, archive 4 oldest to `old-implemented-epics.md` (Step 6a)
- [ ] Archive file includes full implementation details for each archived epic
- [ ] Main index rows for archived epics now reference archive: "See old-implemented-epics.md"
- [ ] `.claude/wireframes/` and `.claude/wireframes/.generated-manifest.json` were scanned before generating any UI epic files
- [ ] Each UI-related epic includes a `## Wireframes` section if pertinent wireframes exist (with specific section references, not just file paths)
- [ ] Wireframe sections apply Wireframe Precedence: page/layout wireframes instruct conversion to the configured UI Library; `converted` component/pattern wireframes point the agent at the equal-weight generated component to reuse/reconcile
- [ ] `apps/web/src/components/` (all four subfolders: `ui/`, `composite/`, `features/`, `layouts/`) was scanned for reusable components
- [ ] `.claude/standards/component-usage.md` was checked for Storybook catalogue entries
- [ ] Each UI-related epic includes an `## Existing Components` section if reusable components or relevant Storybook stories were found
- [ ] Component references include exact import paths, corresponding `.stories.tsx` file paths, and relevant documented variants
- [ ] Every UI epic includes a MANDATORY instruction to follow `.claude/workflows/frontend-ui-protocol.md` before writing any UI code
- [ ] Every UI epic references `@.claude/docs/definition-of-done.md` §1 (UI DoD) + §4.1 (Epic UI gate)
- [ ] Every API/backend epic references `@.claude/docs/definition-of-done.md` §2 (Backend DoD) + §4.2 (Epic API gate)
- [ ] Every full-stack epic references both §1 and §2 and the §4.3 final gate

## Cross-References

- Epic workflow: `@.claude/workflows/epic-based-development.md`
- Agent (story writing): `@.claude/agents/product-owner.md` — activate for user story generation, acceptance criteria, and Gherkin format. Unload after story writing is complete.
- Epic tracker template: `@.claude/templates/epic-index-template.md`
- **Context optimization strategy**: `specs/epics/EPICS-CONTEXT-OPTIMIZATION-GUIDE.md`
- **Archive file**: `specs/epics/old-implemented-epics.md`
- Direct epic implementation: `/implement-epic`
- Epic task breakdown: `/create-epic-tasks`
- Completion recovery: `/mark-epic-completed`
