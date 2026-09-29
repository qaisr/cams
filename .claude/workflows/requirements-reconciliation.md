---
name: requirements-reconciliation
description: >
  Six-phase reconciliation workflow for aligning specifications, epics, tasks,
  and code implementation with corrected or evolved requirements. Designed for
  mid-workflow recovery where requirements drift is discovered after implementation
  has begun. Produces surgical diffs, evidence-based preserve/rework analysis,
  and revision records in `specs/epics-revised/` as the only durable record of
  obsolete or replaced implementation scope.
version: 1.0.0
invoked_by:
  - .claude/commands/reconcile-requirements.md
agents:
  - requirements-impact-analyzer
  - ambiguity-analyst
  - tech-lead
---


> **Operating Discipline (always applies).** Follow `@.claude/CLAUDE.md` → Operating Discipline throughout this workflow: never hallucinate paths/APIs/versions, never assume intent to fill a gap, never implement unrequested scope, clarify ambiguities before acting, and get **explicit human approval** before anything hard-to-reverse or beyond the stated request. Report faithfully what was done, skipped, or failed.

# Requirements Reconciliation Workflow

## Philosophy

Requirements change. This workflow treats that as a **reconciliation operation** — evidence-based
alignment of specifications, epics, and implementation — rather than a destructive reset.
Git history is the historical record for replaced specifications and code.
Application code is never modified directly; only targeted migration guidance is produced.

**Core principles:**
- Surgical diffs over full rewrites — change only what changed
- Evidence-first — consult `specs/epics-implemented/` before any rework recommendation
- Interactive gates — user confirms before each file-modifying phase
- Migration guidance, not migration execution — code changes are guided, not automated
- Obsolete or replaced implementation details live only in `specs/epics-revised/`
- Non-completed epics and tasks are deleted and regenerated instead of being reconciled in place
- Preserve what can be preserved; rework only what must change

---

## Pre-Flight Checklist

Before starting this workflow verify:

1. The corrected requirements source is readable and complete
2. `specs/epics/0-epics-index.md` exists — if not, run `/create-epics` first
3. `specs/functional-specifications.md` and `specs/business-requirements.md` exist
4. The `--dry-run`, `--docs-only`, or `--epic-scope=` flags are noted (from command args)
5. Load `@.claude/agents/requirements-impact-analyzer.md` before Phase 1

---

## Phase 1 — Change Analysis & Impact Assessment

**Goal**: Understand exactly what changed, which epics are affected, and whether implemented
code needs to change.

**Trigger**: Always runs first, regardless of flags.

### 1.1 Load Sources

Load in this order:

| Source | Path | Purpose |
|---|---|---|
| Corrected requirements | `$ARGUMENTS` source path | The changed or corrected requirements |
| Current business requirements | `specs/business-requirements.md` | Diff baseline + update target |
| Current functional spec | `specs/functional-specifications.md` | Diff baseline + update target |
| Epic tracker | `specs/epics/0-epics-index.md` | Epic status source |
| Implementation evidence | `specs/epics-implemented/*.md` | What was actually built |

If `--epic-scope=` is set, load only the specified epic files; otherwise scan all epics
with status `epic-generated` or `complete`.

### 1.2 Delta Extraction

Invoke `requirements-impact-analyzer` (Phase A) to produce a structured delta table.

For each delta, classify by **Change Type**:

| Change Type | Definition |
|---|---|
| `BREAKING` | Requirement fundamentally changes existing behavior; code implementing the old requirement is now incorrect |
| `ADDITIVE` | New requirement not previously captured; existing code may be valid but incomplete |
| `CORRECTIVE` | Specification error corrected — wording, scope, or constraint clarified without behavioral change |
| `COSMETIC` | Language or formatting change only; no implementation impact |

And by **Severity**:

| Severity | Definition |
|---|---|
| `HIGH` | Multiple epics or core domain entities affected; significant rework likely |
| `MEDIUM` | One or two epics affected; targeted changes required |
| `LOW` | Docs-only or isolated impact; no expected code change |

### 1.3 Epic Impact Mapping

For each delta, invoke `requirements-impact-analyzer` (Phase B) to identify affected epics.

The agent cross-references delta areas against:
1. Epic file body content (keyword and AC matching)
2. Epic scope descriptions in `0-epics-index.md`
3. Implementation evidence in `specs/epics-implemented/`

For each affected epic, the agent assesses:
- **Current status** from `0-epics-index.md`
- **Implementation status**: not started / partially started / complete
- **Match confidence**: Direct / Indirect / None

### 1.4 Clarification Pass

If the corrected requirements contain ambiguous language or internal conflicts, the
`requirements-impact-analyzer` raises Clarification Flags in the ambiguity-analyst
format — named options with a recommendation marker. Surface these to the user before
proceeding. A misread delta can cascade incorrect updates across all downstream phases.

### 1.5 Produce Analysis Summary

Produce an in-session analysis summary covering the delta table, affected epics,
and impact summary (preserved / to extend / to rework counts).

Do **not** create a durable change record file. Historical diffs belong in git;
obsolete implementation detail belongs only in `specs/epics-revised/` if the epic
was already completed.

**Interactive Gate — Phase 1 Complete**

Present the change analysis summary and ask:

```
Phase 1 complete. Change analysis ready.

  Deltas found:     [N] BREAKING  [N] ADDITIVE  [N] CORRECTIVE  [N] COSMETIC
  Epics affected:   [N] complete  [N] epic-generated  [N] pending
  Impact severity:  HIGH / MEDIUM / LOW

[A] Proceed to Phase 2 — apply spec updates          ← RECOMMENDED
[B] Stop here — dry-run complete, use this summary for manual review
[C] Adjust scope — provide --epic-scope= to narrow before continuing
```

Stop automatically if `--dry-run` is set (do not ask, just stop).

---

## Phase 2 — Specification Reconciliation

**Goal**: Update `specs/business-requirements.md` and `specs/functional-specifications.md`
with surgical diffs from Phase 1.

**Trigger**: Runs unless `--dry-run` is set.

### 2.1 Update Mode

Update the four specification files in place.

Do **not** create reconciliation backup files. Git history is the source of truth for
old or corrected specifications, and obsolete requirement text must not be retained in
the working documentation set.

### 2.2 Surgical Diff Rules

When updating spec files:

1. Change **only the sections** identified in the Phase 1 delta table
2. Preserve surrounding context, headings, numbering, and document tone
3. Add a reconciliation marker above each changed section:
  `<!-- reconciled on YYYY-MM-DD -->`
4. Do NOT restructure the document hierarchy
5. Do NOT remove sections flagged `ADDITIVE` from the new requirements
   (those are new additions, not replacements)
6. For BREAKING deltas: replace the old content; for ADDITIVE: insert new content in the
   appropriate section

### 2.3 No Durable Audit Record

Do not create or update any external audit record for spec reconciliation.
Once the spec files are corrected, the old requirement wording should no longer exist
in the working documentation set.

**Interactive Gate — Phase 2 Complete**

```
Phase 2 complete. Spec files updated with surgical diffs.
  Updated: specs/business-requirements.md ([N] sections)
  Updated: specs/functional-specifications.md ([N] sections)

[A] Proceed to Phase 3 — reconcile epics              ← RECOMMENDED
[B] Stop here — specs updated; epics not yet reconciled
```

Stop automatically if `--docs-only` is set.

---

## Phase 3 — Epic Reconciliation

**Goal**: Reconcile each affected epic's status and content to reflect the corrected requirements.

**Trigger**: Runs unless `--dry-run` or `--docs-only` is set.

**Core Strategy**: For non-completed epics, delete the files and reset status to `pending` so they can be
regenerated cleanly when implementing. For completed epics, preserve the implementation record and update
the epic tracker with revision status and links to evidence.

### 3.1 Reconciliation-Specific Completed Epic Statuses

Only completed epics receive reconciliation-specific statuses. Non-completed epics are reset
to `pending` after deletion so they can be regenerated cleanly.

These statuses are written into `specs/epics/0-epics-index.md` and reflected in the
revision record for the completed epic:

| Status | Meaning |
|---|---|
| `complete-amended` | Implementation is substantially valid; minor amendments documented in revision record |
| `complete-requires-revision` | Implementation needs significant rework; triggers Phase 5 |

### 3.2 Epic Deletion Rules (Non-Completed Epics)

For affected epics with status `pending` or `epic-generated`:

1. **Confirm with user** — present a list of epics to be deleted and ask for confirmation before proceeding
2. **Delete epic files** — remove the misaligned epic files from `specs/epics/`
3. **Delete associated task folders** — if `specs/epic-tasks/<epic-stem>/` exists, remove the entire folder
4. **Reset status in tracker** — change status to `pending` in `specs/epics/0-epics-index.md`

These epics will be regenerated later via `/create-epics` and, if required,
`/create-epic-tasks`.

**Rationale**: Regeneration is always cleaner than trying to surgically update incomplete files.
No implementation evidence is lost (these epics were not complete).

### 3.3 Completed Epic Reconciliation

For affected epics with status `complete`:

Apply the preserve-vs-rework analysis (formerly 3.2 table) based on delta severity:

| Delta Severity | New Status | Action |
|---|---|---|
| COSMETIC / CORRECTIVE | `complete-amended` | Create Epic Revision Record (note only); no code rework required |
| ADDITIVE (small gap) | `complete-amended` | Note extension needed; document low rework effort in revision record |
| ADDITIVE (large gap) or BREAKING | `complete-requires-revision` | Preserve/rework analysis; triggers Phase 5 |

Update the completed epic file in `specs/epics/` so it contains only the current valid scope,
acceptance criteria, and revision status. Do not leave obsolete or replaced scope in the epic file;
that detail belongs only in `specs/epics-revised/`.

### 3.4 Status Transition Matrix (Completed Epics Only)

| Previous Status | Delta Severity | New Status | Action |
|---|---|---|---|
| `complete` | COSMETIC / CORRECTIVE | `complete-amended` | Create Epic Revision Record (note only); no rework required |
| `complete` | ADDITIVE (small gap) | `complete-amended` | Note extension needed; low rework effort documented in revision record |
| `complete` | ADDITIVE (large gap) or BREAKING | `complete-requires-revision` | Preserve/rework analysis; triggers Phase 5 |

### 3.5 Epic Revision Records (Completed Epics Only)

For any epic with a `complete-*` revision status, create:
```
specs/epics-revised/{epic-file-stem}-revision-record.md
```

Using the template at: `@.claude/templates/epic-revision-record.md`

Include:
- Summary of what changed
- Per-component preserve / extend / rework classification
- Options with effort estimates (follows ambiguity-analyst format)
- Revised acceptance criteria table
- Any obsolete or replaced implementation details that must be retained during reconciliation

This is the **only** durable place where obsolete or replaced implementation details should
be recorded.

### 3.6 Preserve vs. Rework Decision Rules

Apply the `requirements-impact-analyzer` Phase C decision tree for each complete epic.

The key principle: **always examine implementation evidence before recommending rework**.

```
If specs/epics-implemented/{epic-file}.md exists:
  → Use as primary evidence of what was built

Else if specs/epic-tasks/{epic-stem}/0-tasks-index.md exists:
  → Use completed tasks as secondary evidence

Else:
  → Analyse codebase files related to the epic scope
  → Note in revision record: "evidence inferred from codebase analysis"
```

**Interactive Gate — Phase 3 Complete**

After deletion of non-completed epic/task files:

```
Phase 3 complete. Epic reconciliation summary:

  Deletions:
    pending epics deleted:     [N]
    epic-generated epics deleted: [N]
    task folders deleted:      [N]

  Completed epics reconciled:
    complete-amended:          [N] epics
    complete-requires-revision:[N] epics
    Epic Revision Records:     specs/epics-revised/ ([N] files)

[A] Proceed to Phase 4 — reconcile tasks (completed epics only)  ← RECOMMENDED if task folders exist
[B] Skip Phase 4 — no task breakdowns for completed affected epics
[C] Stop here — review revision records before continuing
```

---

## Phase 4 — Task Reconciliation

**Goal**: For completed affected epics that have task breakdown files under `specs/epic-tasks/`,
ensure task artifacts reflect only currently valid work.

**Trigger**: Only runs if at least one completed affected epic has a folder under `specs/epic-tasks/`.

### 4.1 Task Classification for Completed Epics

For each task in an affected completed epic's `specs/epic-tasks/<epic-stem>/` folder:

| Classification | Meaning | Action |
|---|---|---|
| `preserved` | Task scope is fully valid under new requirements | Keep the task file as-is |
| `needs-extension` | Task is valid but incomplete; revised requirements add scope | Update the task file to reflect only the new valid scope |
| `revision-required` | Task scope conflicts with new requirements | Capture obsolete scope in the epic revision record, delete the old task file, and replace with a new pending task if needed |
| `superseded` | Task is made obsolete by the requirements change | Capture obsolete scope in the epic revision record, then delete the task file and remove or replace its tracker entry |

### 4.2 Task Index Updates for Completed Epics

Update `specs/epic-tasks/<epic-stem>/0-tasks-index.md` so it reflects only currently valid tasks.

- Keep `preserved` and `needs-extension` tasks in the index
- Remove obsolete `revision-required` and `superseded` task entries once their replacement plan is
  captured in the epic revision record
- Add new pending task entries for replacement work where required

Do not keep obsolete task scope, notes, or acceptance criteria in the task index.

### 4.3 New Task Proposals for Gaps

If ADDITIVE deltas require new implementation work not covered by existing tasks:
- Propose new task additions in the task index (status: `pending`)
- Create placeholder task files with the new scope and ACs
- Do not carry forward obsolete wording from the replaced tasks

**Interactive Gate — Phase 4 Complete**

```
Phase 4 complete.

  preserved:         [N] tasks
  needs-extension:   [N] tasks
  revision-required: [N] tasks
  superseded:        [N] tasks
  obsolete task files deleted: [N]
  new proposals:     [N] tasks

[A] Proceed to Phase 5 — generate code migration guidance   ← RECOMMENDED if complete-requires-revision epics exist
[B] Skip Phase 5 — no code migration needed
[C] Stop here — review task updates before continuing
```

---

## Phase 5 — Code Migration Guidance In Revision Records

**Goal**: For `complete-requires-revision` epics, record targeted, file-level migration guidance
inside `specs/epics-revised/`.

**Trigger**: Only runs if at least one epic is `complete-requires-revision`.

**IMPORTANT**: This phase updates revision records only. It never modifies application code.

### 5.1 Evidence Gathering

For each `complete-requires-revision` epic, gather implementation evidence in order:

1. `specs/epics-implemented/{epic-file}.md` — primary
2. `specs/epic-tasks/{epic-stem}/0-tasks-index.md` — secondary
3. Codebase analysis for files matching the epic scope — fallback

Explicitly note which evidence source was used in the epic revision record so that the
migration guidance credibility can be assessed by the reviewer.

### 5.2 File-Level Impact Mapping

Produce a table per epic:

| File | Layer | What Exists | What Needs to Change | Change Type | Effort |
|---|---|---|---|---|---|
| `apps/api/src/...` | API | current behavior | required behavior | add/modify/remove | S/M/L/XL |

Layer abbreviations: `API` | `DB` | `Frontend` | `Config` | `Test`

### 5.3 Options Presentation

For each affected component, present options in the ambiguity-analyst format:

```
Component: [component name / file path]
Layer:      [API / DB / Frontend / Config / Test]
Current:    [what currently exists]
Required:   [what the new requirement demands]

[A] Extend existing implementation                          ← RECOMMENDED (when applicable)
    [specific addition]. Effort: M, Risk: Low

[B] Refactor targeted section
    [specific method or component to rewrite]. Effort: M, Risk: Medium

[C] Full rewrite aligned to new requirements
    [justification]. Effort: L, Risk: Medium

[D] Describe a different approach    ← plain text fallback
```

User selects an option per component. The selection is recorded in the migration document.
User selects an option per component. The selection is recorded in the epic revision record.

### 5.4 Finalise Revision Records

Update each relevant `specs/epics-revised/{epic-file-stem}-revision-record.md` with:

- Full context of what changed for that epic
- Selected option per component
- File-by-file change instructions
- New or revised acceptance criteria
- Test scenarios for newly required behavior (unit + integration + E2E where applicable)

This revision record is the durable reconciliation artifact and the primary handoff
document for any subsequent `/refactor`, `/enhance-code`, or feature implementation work.

**Interactive Gate — Phase 5 Complete**

```
Phase 5 complete. Revision records updated with migration guidance:
  specs/epics-revised/

[A] Proceed to Phase 6 — update trackers and create summary   ← RECOMMENDED
[B] Review revision records before finalising
```

---

## Phase 6 — Tracker And Implemented Summary Alignment

**Goal**: Update `specs/epics/0-epics-index.md` and align completed implementation summaries to the
current valid state.

**Trigger**: Always runs as the final phase.

### 6.1 Epic Index Update Rules

For each affected epic in `specs/epics/0-epics-index.md`, update:
- **Status** column to the new reconciliation status
- For deleted non-completed epics: set status to `pending`
- **Summary** column: reflect only the current valid scope
- **Notes**: link to Epic Revision Record if one was created

Do not change the epic file names or epic IDs — those are immutable once created.

### 6.2 Implemented Epic Summary Alignment

For each affected completed epic in `specs/epics-implemented/`:

- Remove obsolete or replaced implementation details from the summary
- Update the summary to reflect only the currently valid delivered or target-delivered scope
- If the code revision has not yet been implemented, keep the summary focused on the valid baseline
  and add a concise note that the epic is under revision, with a link to the epic revision record

Do not duplicate obsolete implementation details here. Those details belong only in
`specs/epics-revised/`.

### 6.3 Final Completion Check

Before ending the reconciliation:

- Ensure `specs/business-requirements.md` and `specs/functional-specifications.md` contain only the
  corrected requirements
- Ensure deleted non-completed epics and obsolete task files no longer exist
- Ensure obsolete implementation details are retained only in `specs/epics-revised/`
- Ensure `specs/epics-implemented/` files describe only the current valid implemented state

---

## Guard Rails

These rules apply unconditionally throughout all phases:

1. **Never rewrite spec files from scratch** — surgical section-level diffs only
2. **Do not create reconciliation backup files** — git history is sufficient
3. **Never modify application code** — produce migration guidance documents only
4. **Interactive gates before every file-modifying phase** — user must confirm
5. `--dry-run` → stops after Phase 1 (analysis only)
6. `--docs-only` → stops after Phase 2 (spec updates only)
7. `--epic-scope=` → limits Phase 3-5 to the specified epics only
8. **Obsolete requirement or implementation details must not be retained outside `specs/epics-revised/`**
9. **Epic IDs and file names are immutable** — reconciliation deletes or regenerates files; it does not rename IDs
10. **Git history is the historical trace** for removed or replaced requirements, epics, tasks, and code

---

## Output Contract

| Artifact | Path | Phase |
|---|---|---|
| Updated spec files | `specs/business-requirements.md`, `specs/functional-specifications.md` | 2 |
| Deleted non-completed epic files | `specs/epics/{epic}.md` | 3 |
| Updated completed epic files | `specs/epics/{epic}.md` | 3 |
| Epic Revision Records | `specs/epics-revised/{epic-stem}-revision-record.md` | 3 |
| Updated task indexes and replacement tasks | `specs/epic-tasks/{stem}/0-tasks-index.md` | 4 |
| Updated epic index | `specs/epics/0-epics-index.md` | 6 |
| Updated implemented epic summaries | `specs/epics-implemented/{epic}.md` | 6 |

### Durable Reconciliation Directory

This directory is the only durable reconciliation artifact directory owned by
`/reconcile-requirements`:

```
specs/epics-revised/          — per-epic revision records, obsolete scope notes, and migration guidance
```

## Token Optimization

- **Load when**: `/reconcile-requirements` runs after corrected requirements arrive mid-workflow.
- **Load only**: this workflow + `requirements-impact-analyzer` agent + corrected requirements doc + current epic tracker.
- **Unload after**: revised epics committed under `specs/epics-revised/`; impacted in-flight epics deleted/regenerated.
- **Hand-off to**: `product-owner` for fresh epic specs, `requirements-impact-analyzer` for delta classification, then the regular epic implementation flow.
