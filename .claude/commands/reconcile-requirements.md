---
description: Reconcile updated or corrected requirements against existing specifications, epics, tasks, and code — keeping obsolete scope only in specs/epics-revised and regenerating incomplete work instead of preserving it.
agent: build
subtask: false
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# Reconcile Requirements

## Input

$ARGUMENTS

Examples:

- `/reconcile-requirements @requirements/corrected/`
- `/reconcile-requirements @docs/requirements-v2.md`
- `/reconcile-requirements @docs/requirements-v2.md --docs-only`
- `/reconcile-requirements @docs/requirements-v2.md --epic-scope=epic-003,epic-005`
- `/reconcile-requirements @docs/requirements-v2.md --dry-run`
- `/reconcile-requirements jira/stories/EON-123.md`  ← changed local mirror file (path form)
- `/reconcile-requirements https://commbank.atlassian.net/browse/EON-123`  ← URL form (refreshes mirror first)

## Argument Flags

| Flag | Effect |
|---|---|
| `<path>` (required*) | File or directory containing the corrected requirements, **or** a changed local-mirror file (e.g. `jira/stories/EON-123.md`) |
| `<url>` (required*) | A JIRA browse URL (e.g. `https://commbank.atlassian.net/browse/EON-123`) — refreshes the mirror via `/jira-add-issue` first, then reconciles from the refreshed local copy |
| `--dry-run` | Phase 1 analysis only — no files are modified; use for impact preview |
| `--docs-only` | Phases 1-2 only — spec files updated; no epic, task, or code changes |
| `--epic-scope=<ids>` | Comma-separated epic IDs to constrain scope, e.g. `epic-003,epic-005` |

\* Exactly one of `<path>` or `<url>` is required. See "Input Form Detection" in Pre-Flight.

---

## Purpose

Requirements change during development. This command handles mid-workflow requirements
drift systematically — for any point in the epic-based workflow where the team discovers
that requirements were wrong, miscaptured, or have legitimately evolved.

**What this command does:**
1. Analyzes what changed between the corrected requirements and current specifications
2. Updates specification documents in place with surgical diffs (never full rewrites)
3. Deletes non-completed (pending/epic-generated) epics and tasks, marks as `pending` for regeneration
4. Reconciles completed epics' statuses and stores obsolete/replaced scope only in `specs/epics-revised/`
5. Updates completed-epic task indexes so they retain only valid current tasks
6. Records code migration guidance inside epic revision records for completed epics that need rework
7. Updates `specs/epics/0-epics-index.md` and aligns relevant `specs/epics-implemented/` summaries when needed
8. Keeps `specs/sources/manifest.json` and the RTM **Source** column current as scope shifts

**This command is the ONLY mirror → specs path (R3).** `/create-specifications` only *reads*
the local JIRA mirror and never ingests. This command is where a changed mirror flows into
`specs/`, and its **`<url>` form is the ONLY place an ingest (`/jira-add-issue`) is chained**.
Nothing here mutates remote JIRA.

**What this command does NOT do:**
- Rewrite entire documents from scratch
- Modify application source code directly
- Preserve non-completed epic/task files that conflict with new requirements
  (they will be regenerated cleanly via `/create-epics` and `/create-epic-tasks`)
- Create durable reconciliation history outside `specs/epics-revised/`
- Keep obsolete requirement or implementation detail in specs, epics, tasks, or implemented summaries
- Proceed destructively without user confirmation at each phase

**Philosophy**: Evidence-based reconciliation, not destructive overwrite.

- For **non-completed** work: delete misaligned files and reset to `pending` — they regenerate cleanly
- For **completed** work: preserve implementation evidence, update trackers, and capture obsolete scope only in `specs/epics-revised/`
- Code is never touched — migration guidance is recorded in epic revision records instead
- The `specs/epics-implemented/` directory is the primary source of truth for completed work

---

## Pre-Flight

### Input Form Detection (run FIRST)

Classify the non-flag argument into exactly one of four forms:

| Form | Looks like | Delta signal | Ingest? |
|---|---|---|---|
| **Corrected-doc path** | a file/dir under `requirements/`, `docs/`, etc. | diff corrected doc ↔ current specs | no |
| **Mirror-file path** | a path under `confluence/` / `jira/` / `figma/nodes/` (e.g. `jira/stories/EON-123.md`, `figma/nodes/mid-fi-e2e-flow.md`) | **local mirror diff** (mirror file ↔ what the specs currently reflect) | no — reads mirror as-is |
| **JIRA URL** | `http(s)://…/browse/<KEY>` (a JIRA browse URL) | local mirror diff **after refresh** | **yes — chain `/jira-add-issue <url>` first** |
| **Figma URL** | `http(s)://…figma.com/design/…?node-id=…` (a Figma `/design/` URL) | local mirror diff **after pull** | **yes — chain `/add-figma-node <url>` first** |

**`<jira-url>` form — the one and only JIRA ingest chain (R3):**

1. Run `/jira-add-issue <url>` to refresh the local mirror for that issue (this is the
   only JIRA ingest chained anywhere in the spec/reconcile flow — explicitly allowed here).
2. Resolve the refreshed local file (`jira/<type>/{KEY}.md`) from the key in the URL.
3. Continue as the **mirror-file path** form, reconciling from the refreshed local copy.

**`<figma-url>` form — the one and only Figma ingest chain (R3, §4.5):**

1. Run `/add-figma-node <url>` to pull the node into the mirror (this is the only Figma
   ingest chained here — `/add-figma-node` owns the pull, diff, and divergence gates and is
   the only place that moves `lastSyncedAt`). Convert the hyphenated URL node id to the
   colon form (D5) to resolve the on-disk file.
2. Resolve the refreshed local file (`figma/nodes/<slug>.md`) for that node id.
3. Continue as the **mirror-file path** form, reconciling from the refreshed local copy.
4. This command itself **never** calls a Figma MCP tool — `/add-figma-node` performs the
   only permitted pull, then reconcile reads the mirror as-is.

**Mirror-file path form — delta signal is the LOCAL diff (no re-pull):**

- Read the mirror file **as it is on disk** — do **not** re-pull, and do **not** call any
  ingest command. (A `<url>` form already did the one permitted refresh above.)
- **JIRA / Confluence:** the delta is the change between the mirror file's requirement
  regions (`## Description` + `## Acceptance Criteria`) and what the current specs / RTM
  reflect for that source.
- **Figma (`figma/nodes/<slug>.md`) — structure vs render-only routing (§4.5):** the delta
  is the change between the node's **structure** (`figma/nodes/<slug>.md` layer/text/
  component/flow content + `<slug>.flow.mmd`) and what the specs / RTM reflect. Classify it:
  - A **structure** change (new/removed/renamed frames, changed flow steps, new fields or
    controls, changed navigation) → route to the **spec-reconciliation** path: run the
    6-phase drift engine, update the traced epics / spec sections, and update the RTM
    **Source** row for that node. This is the normal reconcile path.
  - A **render-only** change (visual styling, color, spacing, token values — no change to
    structure, flow, fields, or controls) → route to the **visual-diff gate**, **not** spec
    reconciliation. Make **no** spec change and **no** RTM change; report that the change is
    render-only and hand it to `/figma-to-lumen`'s visual-diff gate (Part 2) for the built
    screen. Detect this via the node's `renderHash` moving while `structureHash` is
    unchanged (see `figma/nodes/<slug>.meta.json`); if ambiguous, ask the user which path.
- Use `specs/sources/manifest.json` to find which spec sections / epics that mirror file
  `feeds` — that `feeds` set **is** the delta scope for a structure change (reconcile exactly
  those, nothing wider).
- **Never** mutate remote JIRA or remote Figma from this command.

### Load

Load the following before starting:

```
@.claude/workflows/requirements-reconciliation.md
@.claude/agents/requirements-impact-analyzer.md
@.claude/templates/epic-revision-record.md
```

If the input is a JIRA URL, a Figma URL, or a `jira/` / `figma/nodes/` mirror path, also
load `@.claude/templates/requirements-traceability-matrix.md` (for the exact Source-column
format) and read `specs/sources/manifest.json` (for the `feeds` join).

Validate inputs:

1. `$ARGUMENTS` must contain exactly one of: a readable file/directory path, a local-mirror
   file path (`confluence/…` / `jira/…` / `figma/nodes/…`), a JIRA browse URL, or a Figma
   `/design/` URL. If only flags are detected (no path/url), stop and ask the user for the
   source. For the **JIRA URL form**, perform the `/jira-add-issue <url>` refresh; for the
   **Figma URL form**, perform the `/add-figma-node <url>` pull (both per Input Form
   Detection) before continuing. If that refresh/pull fails, stop and report — do not
   reconcile from a stale/absent mirror file.

2. `specs/epics/0-epics-index.md` must exist
   If not: _"Run `/create-epics` to generate the epic tracker before reconciling."_

3. `specs/functional-specifications.md` must exist
   If not: _"Run `/create-specifications` to generate spec documents before reconciling."_

4. `specs/business-requirements.md` must exist
   Same as above.

Report all missing documents at once, not one at a time.

---

## Process

Follow the six phases defined in `@.claude/workflows/requirements-reconciliation.md`.

The workflow file is the authoritative source for phase logic. This command file
provides the orchestration entry points, flags, interaction rules, and output summary.

---

### Phase 1 — Change Analysis & Impact Assessment

Invoke `requirements-impact-analyzer` to compare the corrected requirements against
the current specifications and produce a structured delta report.

**Delta source depends on the input form** (see Input Form Detection):
- **Corrected-doc path** → diff the corrected doc against current specs (existing behaviour).
- **JIRA / Confluence mirror-file or URL form** → the delta signal is the **local mirror
  diff**: compare the mirror file's requirement regions (`## Description` +
  `## Acceptance Criteria`) against what the current specs / RTM reflect for that source.
  Constrain the affected scope to the `feeds` set recorded for that `ref` in
  `specs/sources/manifest.json` — reconcile **exactly the traced epics / spec sections**,
  nothing wider. (The URL form has already refreshed the mirror; the mirror-file form reads
  it as-is — no re-pull either way.)
- **Figma mirror-file or URL form** → apply the **structure vs render-only routing** from
  Input Form Detection **before** running the drift engine:
  - **render-only** (renderHash moved, structureHash unchanged) → **do not** run Phase 2+.
    Report the node as render-only and route it to the `/figma-to-lumen` visual-diff gate
    (Part 2). No spec change, no RTM change, no epic change.
  - **structure** (structureHash moved) → run the drift engine as normal, constrained to the
    node's `feeds` set in `specs/sources/manifest.json`, and update the RTM **Source** row
    for that `figma/nodes/<slug>.md (nodeId)` in Phase 5.

Catalog:
- Each delta, its Change Type (BREAKING / ADDITIVE / CORRECTIVE / COSMETIC), and Severity
- Each affected epic, its current status, and the recommended reconciliation status
- Per-component preserve / extend / rework analysis for `complete` epics
- Any clarification flags (presented in options format; user must resolve before continuing)
- For mirror-sourced input: the `feeds` scope resolved from `specs/sources/manifest.json`
  (the exact epics / spec anchors this source traces to)

**Output**: Produce an in-session delta and impact summary.

Present the impact summary and ask the user to confirm before proceeding.

**Stop here if `--dry-run` is set.**

---

### Phase 2 — Specification Reconciliation

Apply surgical section-level updates directly to:

- `specs/business-requirements.md`
- `specs/functional-specifications.md`

Mark each changed section with: `<!-- reconciled on YYYY-MM-DD -->`

**Never rewrite entire documents.** Change only the sections identified in Phase 1.

Do **not** create reconciliation backup files. Git history is the historical record.

**Traceability maintenance (mirror-sourced input, MANDATORY):** keep the source join
current alongside the spec edits:

- `specs/requirements-traceability-matrix.md` — update the **Source** column for every
  affected requirement. JIRA sources use the exact `` `jira/<type>/{KEY}.md` (KEY) `` format
  (folder-by-type; never flat `jira/{KEY}.md`). Figma sources use the exact
  `` `figma/nodes/<slug>.md` (nodeId) `` format (folder-by-type, colon node id; never flat
  `figma/<slug>.md`, never the hyphenated URL form). **Render-only** Figma changes update no
  RTM row (they never reach this phase — they routed to the visual-diff gate in Phase 1).
- `specs/sources/manifest.json` — update the entry for the changed `ref`: keep `remoteId`
  correct and update `feeds` to reflect the current spec sections / epics it feeds
  (add new anchors, remove ones the reconciliation dropped). If a new source was introduced,
  add an entry; if a source no longer feeds anything, leave the entry but flag it.
- Run the **consistency flags**: **orphaned source** (a live mirror file — not an archived
  `jira/_orphaned/…` file — feeding nothing after this change) and **untraced requirement**
  (a mirror-scope requirement left with no Source). Surface any in the Output Summary.

**Stop here if `--docs-only` is set.**

---

### Phase 3 — Epic Reconciliation

**Deletion step** (non-completed epics):

1. Identify affected epics with status `pending` or `epic-generated`
2. Confirm with user — present list and ask for approval before deletion
3. Delete epic files from `specs/epics/` and associated task folders from `specs/epic-tasks/`
4. Update `0-epics-index.md` — set status to `pending` for regeneration

**Reconciliation step** (completed epics):

For each affected epic with status `complete`, apply the status transition from the workflow.
Update the active epic file so it reflects only the corrected current scope and acceptance criteria.
Do not retain obsolete scope in the epic file; keep that detail only in the revision record.

**Completed epic statuses available for this phase** (extend the canonical set):

| Status | When Used |
|---|---|
| `complete-amended` | Implementation is valid; minor amendments documented |
| `complete-requires-revision` | Implementation needs rework; triggers Phase 5 |

For any `complete-*` epic, create an Epic Revision Record at:
`specs/epics-revised/{epic-stem}-revision-record.md`

The revision record contains the preserve / extend / rework options for each component.
Present options to the user and record their selections in the revision record.

This revision record is the only durable place to retain obsolete or replaced implementation detail.

---

### Phase 4 — Task Reconciliation

**Runs only if** at least one completed affected epic has a folder under `specs/epic-tasks/`.


(Task folders for non-completed epics were deleted in Phase 3.)

Classify each task in completed epics' breakdowns as `preserved` / `needs-extension` / `revision-required` / `superseded`.
Delete obsolete `revision-required` or `superseded` task files after their obsolete scope is captured in the epic revision record.
Update the task index so it contains only valid current tasks and any replacement pending tasks.

---

### Phase 5 — Code Migration Guidance

**Runs only if** at least one epic is `complete-requires-revision`.

Gather implementation evidence per epic, produce a file-level impact table, and present
preserve / extend / rework / full-rewrite options per component. Record user selections
in the epic revision record.

The updated revision record can then be passed to follow-up implementation work as the
primary specification for the epic revision.

---

### Phase 6 — Tracker And Implemented Summary Alignment

Update `specs/epics/0-epics-index.md` with new statuses for all affected epics.

For relevant completed epics, update `specs/epics-implemented/<same-epic-file-name>.md`
so it reflects only the current valid implemented scope.

Do not retain obsolete implementation detail there; keep that detail only in
`specs/epics-revised/`.

---

## Output Summary Table

Present this at the end of each completed reconciliation:

| Artifact | Path | Status |
|---|---|---|
| Updated spec files | `specs/business-requirements.md` + 3 others | updated |
| Epic Revision Records | `specs/epics-revised/` | [N] created |
| Deleted non-completed epics | `specs/epics/` | [N] deleted |
| Updated completed epic files | `specs/epics/` | [N] updated |
| Updated task indexes and replacement tasks | `specs/epic-tasks/` | [N] updated |
| Updated implemented epic summaries | `specs/epics-implemented/` | [N] updated |
| Epic tracker | `specs/epics/0-epics-index.md` | updated |
| Traceability join | `specs/sources/manifest.json` | updated / n/a |
| RTM Source column | `specs/requirements-traceability-matrix.md` | updated / n/a |

For a **mirror-sourced** reconciliation (`jira/` path, `figma/nodes/` path, JIRA
URL, or Figma `/design/` URL form), also report:

```
Mirror-Source Traceability
  Input form:            mirror-file path | JIRA URL (refreshed via /jira-add-issue) | Figma /design/ URL (pulled via /add-figma-node)
  Delta scope (feeds):   [epic-003, specs/functional-specifications.md#FS-7, …]
  Change class (Figma):  structure | render-only | n/a   (render-only → routed to visual-diff gate, no spec/RTM change)
  Manifest entries updated: [N]
  RTM Source rows updated:  [N]  (exact format — JIRA: `jira/<type>/{KEY}.md` (KEY);  Figma: `figma/nodes/<slug>.md` (nodeId), colon node id e.g. (299:12006))
  Orphaned sources:      [list, or none]   (archived jira/_orphaned/… excluded)
  Untraced requirements: [list, or none]
  Ingest invoked:        none | /jira-add-issue <url> (JIRA URL form) | /add-figma-node <url> (Figma URL form)
```

Conclude with:

```
Reconciliation complete.

  Epics affected:                [N]
  Epics requiring code rework:   [N]
  Specs updated:                 Yes / No

Recommended next step:
  [based on what was found — see Post-Reconciliation Actions below]
```

### EDR Bridge — Confluence Evidence Suggestion (Phase 5, suggestion only)

After printing the reconciliation summary, **offer** relevant mirrored Confluence pages as
supporting evidence for the changed requirements. This is a **suggestion** — the human decides
whether any page's content belongs in `specs/`. Never auto-inject and never trigger
`/reconcile-requirements` recursively.

**When to offer:** if `confluence/_index.json` exists and `items` is non-empty.

**How to offer:**

1. Identify the changed requirement scope (the `feeds` set from `specs/sources/manifest.json`
   for the reconciled source, or the top-level subject of the corrected-doc path).
2. Grep `confluence/_index.json.items[*].title` and the affected Confluence page `.md` headings
   for pages with keyword overlap with the changed requirement's domain terms.
3. Present a compact cited shortlist (max 5 pages):

   ```
   ## Confluence Evidence Available (suggestion — Phase 5)

   These mirrored pages may contain supporting evidence for the reconciled requirements.
   Review them and copy relevant context manually into specs/ if useful.
   None of this is injected automatically (R3).

   | # | Page | Space | Version | Relevance hint |
   |---|---|---|---|---|
   | 1 | [PCON-2042342654 v14] "NTB POBO — Temporary Credentials" | PCON | v14 | overlap: "temporary credentials" |
   …

   To read a page: `/confluence read <pageId>`
   To see Confluence↔JIRA cross-links: `/confluence relationship-map <pageId|EON-key>`
   To check doc-vs-code drift: `/confluence design-sync <pageId>`
   ```

4. Do NOT write any Confluence body text into `specs/`. Do NOT trigger `/reconcile-requirements`.
5. If `confluence/_index.json` is absent or empty, skip silently.

---

## Cross-References

- **`/jira-add-issue <url>`** — the ingest command chained **only** by this command's `<url>`
  form to refresh a single mirror file before reconciling. Never invoked by the path forms.
- **`/create-specifications`** — seeds `specs/sources/manifest.json` and the RTM **Source**
  column on first generation (read-only over the mirror; never ingests). This command keeps
  both current as scope shifts. Together they are the two ends of the R3 contract:
  generate reads, reconcile is the only mirror → specs write path.
- **`@.claude/templates/requirements-traceability-matrix.md`** — canonical RTM Source-column
  format and consistency-flag rules (orphaned source / untraced requirement; archived-orphan
  exclusion).
- **Phase-5 Confluence evidence verbs** (EDR bridge — suggestion only, never auto-inject):
  - `/confluence read <pageId>` — fetch + digest a page live
  - `/confluence relationship-map <pageId|EON-key>` — cross-link graph + gap list
  - `/confluence design-sync <pageId>` — doc-vs-code drift report

---

## Post-Reconciliation Actions

| Scenario | Recommended Follow-Up |
|---|---|
| Dry-run completed | Review the impact summary; re-run without `--dry-run` when ready |
| Docs-only run completed | Run `/create-epics` to regenerate deleted non-completed epics |
| Epics reset to `pending` | Run `/create-epics`, then `/create-epic-tasks` if required |
| Epics marked `complete-requires-revision` | Use the relevant file in `specs/epics-revised/` with `/refactor` or `/enhance-code` |
| Many epics affected (HIGH severity) | Run `/design-architecture` to re-validate architecture alignment |
| Auth or security requirements changed | Run `/security-audit` after migration |
| Multiple complete epics need rework | Consider `/tech-debt-map` to prioritise the rework backlog |
