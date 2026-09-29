---
description: Generate detailed business and functional specifications — with implementation-ready technical detail, sibling reference docs, and design diagrams — from source files or folders, then harden them through sequential expert-agent review gates.
agent: build
subtask: false
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# Create Specifications

## Input

$ARGUMENTS

Examples:

- `/create-specifications @requirements/input/business-case.md`
- `/create-specifications @requirements/input/`
- `/create-specifications @requirements/phase-1/`
- `/create-specifications raw-requirements/req.md confluence jira figma`

The first argument is the primary source path (file or directory). Any **additional**
arguments are **local-mirror source folders** — one or more of `confluence`, `jira`,
`figma` — that are consumed as **read-only requirement sources** alongside the primary
input. See "Local-Mirror Source Folders" under Argument Handling.

---

## Purpose

Generate an aligned, self-contained specification **set** from one source input.
**Every document is a single file — no split directories, ever.** Regardless of
size or complexity, each artefact below is generated as exactly one Markdown file:

1. Detailed Business Requirements: `specs/business-requirements.md` — **source of truth**
2. Detailed Functional Specifications: `specs/functional-specifications.md` — **source of truth**
3. Strategy & key decisions (ADRs live **inside** this file): `specs/strategy.md`
4. Data dictionary: `specs/data-dictionary.md`
5. Architecture diagrams: `specs/architecture-diagrams.md`
6. Requirements traceability matrix: `specs/requirements-traceability-matrix.md`
7. Source artefact library: `specs/reference/` (+ `specs/reference/README.md` consumption map) — copied files stay separate

**`specs/business-requirements.md` and `specs/functional-specifications.md` are
the two source-of-truth documents.** They are ALWAYS generated. Every section of
the supporting single-file documents (`strategy.md`, `data-dictionary.md`,
`architecture-diagrams.md`, `requirements-traceability-matrix.md`) and every
preserved artefact under `specs/reference/` MUST be **referenced by a relative
link from the relevant place** in `business-requirements.md` and/or
`functional-specifications.md` (see the mandatory cross-reference rule in Step 4).
Downstream commands open the two source-of-truth files first and follow those
links to reach supporting detail.

These documents together are the single source of truth for **all** downstream
commands (planning, design, and implementation alike). There is no separate
concise variant, and there are no `00-index.md` / sub-file split sets. Downstream
generation commands (`/create-epics`, `/create-epic-tasks`) extract the scoped
slice they need — delegating a sub-agent to read the relevant single file and
pull only the sections required for the epic or task in hand.

The set must be **implementation-ready**: it carries every technical detail an
AI agent needs to build the solution, plus design diagrams that let a human
verify the plan before any code is written (see Step 4), and it is **hardened**
by a sequence of expert-agent review gates before it is considered final (see
Step 5).

> **Two execution modes.** When local-mirror source folders
> (`confluence`/`jira`/`figma`) are present, this command runs as a **resumable,
> one-phase-per-invocation pipeline** — see the Phase Router — to keep each
> session's context bounded. With no mirror folders present, it runs the
> original single-pass workflow unchanged (the degenerate monolithic path, Steps
> 1–7 below).

---

## HARD REQUIREMENT — Complete Capture (read first)

> **The `$ARGUMENTS` source folder is TRANSIENT. A human will delete it once the
> specifications are generated.** Anything not captured into `specs/` is lost
> **forever**. This is the single most important rule of this command.

Therefore, **every** piece of information needed to build the solution correctly
MUST land somewhere in `specs/` before this command reports success — every
requirement, business rule, taxonomy, workflow, field, enum, interface contract,
numeric threshold, edge case, and regulatory checklist item. Nothing may be left
resolvable only in the source folder, summarised away, or left implicit.

Each source artefact must be preserved by exactly one of three modes:

| Mode | When to use | What happens |
|---|---|---|
| **A — Transform into prose** | Requirements, narratives, rules that belong in professionally-written specs | Rewritten and **expanded** into BRD/FS/strategy/data-dictionary prose + tables. Add a section rather than dropping any detail. |
| **B — Verbatim copy** | Non-sensitive specification / rule / taxonomy / workflow / checklist / interface documents | Copied **byte-for-byte** into `specs/reference/<category>/`, referenced by `_Source:_` pointers from BRD/FS. |
| **C — Schema-only** | **Sensitive** bulk production extracts: real counterparty/legal names, regulated identifiers (e.g. CRIS codes), large row dumps (25k+ rows) | Preserve **only** the column layout, cardinality, provenance, and a handful of **anonymised** sample rows into `specs/reference/`. **Never** copy the raw rows. |

**Sensitive-data guard (mode C is mandatory, not optional):** production data
carrying real legal/counterparty names or regulated identifiers must be
preserved schema-only. Copying raw rows into the repo violates legal-content and
data-mastering governance (the CANS constraints C-001 legal-content governance,
C-020 counterparties are never mastered locally, C-021 only approved identifiers
are stored). The interface contract is fully specified by the column layout —
that **is** preserved; the raw rows are not. When in doubt whether an artefact is
sensitive, treat it as sensitive and use mode C, then flag it in the Review
Required output.

The **capture-completeness gate** in Step 6 enforces this: every discovered
source artefact must be accounted for as A, B, or C, or the command loops back.

> **In phased mode**, A/B/C assignment happens at `extract:*` time (the extract
> phase writes any mode-B/C artefacts into `specs/reference/` immediately), and
> merge NEVER changes a preservation mode. The `finalize` phase's
> Capture-Completeness Gate reconciles against the
> `extracted/*.reqs.json` + `requirements-ledger.json` provenance (each entry
> carries its mode and any `referencePointer`) instead of a single-pass source
> scan.

---

## Token Policy

This is a **generation** command. The framework's token-efficiency rules are
**relaxed**: read the source input (business case, requirements files, folders)
and both templates **in full**. Do not summarise or truncate inputs to save
tokens — incomplete extraction here cascades into broken epics and lost
traceability downstream. Optimise the generated documents for completeness,
fidelity to the source, and traceability — not for token count.

See the Generation Phase Exception in `@.claude/docs/context-optimization.md`.

> **In phased mode** this policy applies **per-phase**: each phase loads only ITS
> OWN sources in full and writes its own artefact — this is **batching, not
> summarising**. The Generation Phase Exception in
> `@.claude/docs/context-optimization.md` explicitly blesses this
> tracker-first/incremental batching and names `/create-specifications`. Bounding
> the per-session working set to one phase is the whole point of the pipeline; it
> never licenses dropping detail.

---

## Argument Handling

Interpret `$ARGUMENTS` as a **primary source path** followed by zero or more
**local-mirror source folder** names.

- **Primary source path** (first argument):
  - If it is a file path: analyze that file only.
  - If it is a directory path: recursively analyze all supported files inside it.
  - If no argument is provided at all: ask the user for a file or directory path.
- **Local-mirror source folders** (any additional arguments): each must be one of
  `confluence`, `jira`, `figma`. These name repo-root mirror directories that are read
  **read-only** as additional requirement sources — see "Local-Mirror Source Folders"
  below. Order does not matter; duplicates are ignored. Any additional argument that is
  not a recognised folder name and not a path → stop and ask the user to clarify.

Supported source formats (readable directly by this command):

- Markdown: `.md`
- Text: `.txt`
- CSV: `.csv`
- JSON/YAML: `.json`, `.yaml`, `.yml`

**Binary Office/PDF formats are NOT read directly.** `.docx`, `.pptx`, `.xlsx`,
`.xlsm`, `.xls`, `.pdf`, and similar must be converted to Markdown first with
`/convert-to-markdown` (see the Conversion Guard below). This command reads the
converted `.md` files, never the binary originals.

### Local-Mirror Source Folders (`confluence` / `jira` / `figma`)

When one or more of these folder names is passed as an additional argument, treat the
named local mirror as a **read-only requirement source** of the same shape as the primary
input — its content is extracted, transformed, and preserved by the same modes (A/B/C) and
must be captured into `specs/` exactly like any other source. The mirror is consumed
**as-is on disk**; this command **never** refreshes, ingests, or pulls it.

#### `jira` — the JIRA local mirror (read-only)

The `jira/` mirror is a folder-by-type set of per-issue files plus a derived index:

- `jira/_index.json` — derived rollup: project, `lastSyncedAt`, current sprint, `counts`,
  `items`, `tree`, `backlog`, `orphans`. **Read this first** to get the tree/roster
  cheaply, then drill into the item bodies for the items in scope.
- `jira/<type>/{KEY}.md` — the **requirement content** (verbatim human body). `<type>` ∈
  `epics` / `stories` / `tasks` / `bugs`. The `## Description` and `## Acceptance Criteria`
  regions are the requirement text; the `## Status` / `## Links` / `## Comments` regions are
  pull-only context, not requirement text.
- `jira/<type>/{KEY}.json` — machine sidecar: status, type, parent, links — relationship
  and status context (not requirement text).
- `jira/_orphaned/…` — archived orphans; these are **not** requirement sources.

Consumption rules for `jira`:

1. Read `jira/_index.json` first for the tree/roster. **Staleness / emptiness check:**
   - If `jira/_index.json` is missing, or `items` is empty, or `lastSyncedAt` is `null`
     → the mirror is empty. **Report this and tell the user to run `/jira-init` then
     `/jira-sync` first, then STOP.**
   - If `lastSyncedAt` is older than 24h → the mirror is stale. **Report this and tell
     the user to run `/jira-sync` first, then STOP.**
2. For each in-scope item, read `jira/<type>/{KEY}.md` (Description + Acceptance Criteria =
   requirement content) and its `{KEY}.json` sidecar (status/type/parent/links).
3. Use the sidecar `parent`/`links` and `_index.json.tree` to reconstruct the epic → story
   → task hierarchy so requirements are captured with their relationships intact.
4. Seed `specs/sources/manifest.json` (see "Traceability Join" below) and populate the RTM
   **Source** column (see "RTM Source Column" below) as `` `jira/<type>/{KEY}.md` (KEY) ``.

> **HARD RULE (R3 — separation of concerns): generation reads, it never ingests.**
> `/create-specifications` **MUST NOT** call `/jira-add-issue`, `/jira-sync`,
> `/jira-init`, or any other ingest/mutation command, and **MUST NOT** call any remote
> JIRA, Confluence, or Figma MCP tool (no `mcp__atlassian__*`, `mcp__figma__*`, or
> any other live-API tool). If the mirror is empty or stale, it reports and STOPS (per
> the check above) — it does **not** refresh the mirror itself. All content is read
> exclusively from the local mirror files on disk (`jira/`, `confluence/`, `figma/`).
> Refreshing the mirror is the user's job (`/jira-init` / `/jira-sync` / `/confluence pull`);
> pulling on a URL is `/reconcile-requirements <url>`'s job. Nothing here calls any remote system.

#### `confluence` — unchanged

`confluence/<slug>.md` mirrors are consumed exactly as before: read each mirror `.md` as a
requirement source, capture it via modes A/B/C, and record its `Source` in the RTM +
`specs/sources/manifest.json`. `jira` is an **additional** source of the same shape — it
does not change how `confluence` / raw files are handled.

#### `figma` — the Figma local mirror (read-only)

The `figma/` mirror is a folder-by-type set of per-node files plus a derived index — it is
**not** a flat set of `figma/<slug>.md` files. Consume it as a design-requirement source:

- `figma/_index.json` — derived rollup (gitignored): `items[]` one-liners (`nodeId`,
  `fileKey`, `name`, `pipeline`, `designer`, `status_sync`, `buildStatus`), `frameTree`,
  `by*` buckets, `lastSyncedAt`. **Read this first** for the roster cheaply, then drill into
  the node bodies for the nodes in scope.
- `figma/nodes/<slug>.md` — the **design-requirement content** (structure: layer tree, text
  inventory, component inventory, screen intent). This is the requirement text.
- `figma/nodes/<slug>.flow.mmd` — the **flow** for that node (Mermaid): screen-to-screen
  navigation / step order. Treat this as requirement content (it defines the required flow).
- `figma/nodes/<slug>.meta.json` — machine sidecar: `nodeId`, `fileKey`, `pipeline`,
  `designer`, `status_sync`, `buildStatus`, hashes — relationship/status context, not
  requirement text.
- `figma/nodes/<slug>.tokens.json`, `.png`, `assets/<node-underscore>/*` — design tokens and
  render/assets (Pipeline C); supporting context, not requirement text.

Consumption rules for `figma`:

1. Read `figma/_index.json` first for the roster. **Staleness / emptiness check:**
   - If `figma/_index.json` is missing, or `items` is empty, or `lastSyncedAt` is `null`
     → the mirror is empty / never pulled. **Report this and tell the user to run
     `/figma-init` then `/figma pull` (or `/figma-sync --pull`) first, then STOP.**
   - If `lastSyncedAt` is older than 24h → the mirror is stale. **Report this and tell the
     user to run `/figma pull` / `/figma-sync --pull` first, then STOP.**
2. For each in-scope node, read `figma/nodes/<slug>.md` (structure = requirement content) and
   `figma/nodes/<slug>.flow.mmd` (flow = requirement content), plus its `<slug>.meta.json`
   sidecar for `nodeId` / `pipeline` / relationships.
3. Use `_index.json.frameTree` to reconstruct the page → frame hierarchy so a screen and its
   sub-frames are captured with their structural relationships intact.
4. Seed `specs/sources/manifest.json` (see "Traceability Join" below) and populate the RTM
   **Source** column (see "RTM Source Column" below) as
   `` `figma/nodes/<slug>.md` (nodeId) `` — the `nodeId` in the **colon** form (D5), e.g.
   `` `figma/nodes/mid-fi-e2e-flow.md` (299:12006) ``.

> **Mirror-on-disk only (R3 + MCP gating).** As with `jira` / `confluence`, this command
> reads the `figma/` mirror **as-is on disk** and **MUST NOT** call any Figma MCP tool
> (`mcp__figma__*`) or any Figma ingest command (`/figma-init`, `/figma pull`, `/figma-sync`,
> `/add-figma-node`). Refreshing the Figma mirror is the user's job; pulling on a URL is
> `/reconcile-requirements <figma-url>`'s job. If the mirror is empty or stale, report and
> STOP (per the check above).

---

## Phase Router (top-level dispatcher — run FIRST)

This is the **entry point** for every invocation. It decides whether the run is
**monolithic** (original single-pass workflow, unchanged) or **phased** (a
resumable, one-phase-per-invocation pipeline driven by an on-disk tracker), then
dispatches. Run this **before** any other Pre-Flight step (before the Conversion
Guard).

### Step R1 — Detect mirror folders (D1)

For each of `jira/`, `confluence/`, `figma/` at the repo root, a mirror is
**present** iff **the directory exists AND it contains an `_index.json`** (even
if that index is stale). A folder that exists but is empty, or that has no
`_index.json`, is treated as **ABSENT** — a stray empty folder does NOT trip
phased mode.

### Step R2 — Degenerate case: no mirrors present → monolithic

If **none** of `jira/`/`confluence/`/`figma/` are present (per R1), this run is
**monolithic**:

- Do **NOT** create `specs/sources/_pipeline.json`.
- Skip the rest of the Router.
- Proceed to the original **Pre-Flight → Process Steps 1–7** below **verbatim** —
  a single run, no phases, no tracker.

This is the **only** path that runs the original monolithic flow, and it is
byte-for-byte the pre-pipeline behaviour. Existing single-source users see zero
change.

### Step R3 — Phased case: ≥1 mirror present

If at least one mirror is present, this run is **phased**. Branch on whether the
tracker already exists.

#### R3a — Bootstrap (if `specs/sources/_pipeline.json` does NOT exist)

1. Compute `sourcesPresent` from folder presence (R1) — a boolean per mirror.
   This value is **frozen** here and never recomputed mid-pipeline (D3).
2. Build the phase list in this fixed order:
   - `extract:raw` — **always** `pending`.
   - `extract:jira`, `extract:confluence`, `extract:figma` — in that fixed
     order; each is `pending` if its mirror is present, otherwise a
     `status: "skipped"` **row** (never omitted — the phase array shape is
     identical across all phased runs).
   - `merge` — `pending`.
   - `generate` — `pending`.
   - The seven `review:*` phases in fixed order (`review:ambiguity-analyst`,
     `review:architecture-reviewer`, `review:security-auditor`,
     `review:db-designer`, `review:backend-engineer`, `review:test-strategist`,
     `review:integration-engineer`) — each `pending`.
   - `finalize` — `pending`.
3. Write `specs/sources/_pipeline.json` (schema below) with `mode: "phased"`,
   the frozen `sourcesPresent`, `reqIdCounter: 0`, every executable phase
   `pending`, absent-mirror extracts `skipped`, and `currentPhase` set to the
   first pending phase (`extract:raw`).
4. **Report and STOP (D2):**
   > Pipeline initialized. {N} phases planned ({E} executable, {S} skipped).
   > Next: re-run `/create-specifications` to execute `extract:raw`.

   Do **NOT** run `extract:raw` in the bootstrap run.

#### R3b — Resume (if `specs/sources/_pipeline.json` exists)

1. Read the tracker.
2. **Recompute** the first `pending` phase in array order. Ignore the stored
   `currentPhase` as truth — it is a convenience cache only (this matters after a
   batched review run).
3. If **no phase is pending** (all `complete`/`skipped`) → the pipeline is done.
   Reprint the final Output Summary (idempotent) and STOP.
4. Otherwise **dispatch to that ONE phase's contract** (see Phase Contracts
   below). Load and run **only** that phase's Pre-Flight + steps — do **NOT** load
   templates/agents/docs belonging to other phases.
5. **On success:** mark the phase `complete`, set `updatedAt`, update
   `reqIdCounter`/artifact fields as the phase requires, print the phase's
   end-of-run report, and print:
   > Phase `<name>` complete. Next: run `/create-specifications` again to run
   > `<next-phase-name>`.
6. **On a hard-stop condition** (e.g. staleness, missing template, unresolved
   pipeline defect): mark the phase `failed` with a `reason` in the tracker,
   print the exact remediation, and STOP.
7. **Exactly one phase per invocation. Never cascade** into the next phase
   automatically. Batched review gates are the sole, explicit-opt-in exception —
   see the `review:<agent>` contract.

### Phase artifact schemas

The phased path reads and writes three JSON artefacts under `specs/sources/`.
All three are **throwaway staging** — they are never read by any other command
(the durable join is `specs/sources/manifest.json` + the RTM, produced by
`generate`/`finalize`).

#### `specs/sources/_pipeline.json` — the phase tracker (throwaway staging)

```json
{
  "schemaVersion": 1,
  "mode": "phased",
  "createdAt": "2026-08-03T10:00:00Z",
  "updatedAt": "2026-08-03T10:00:00Z",
  "primaryInput": { "path": "raw-requirements/", "type": "directory" },
  "sourcesPresent": { "jira": true, "confluence": false, "figma": true },
  "reqIdCounter": 47,
  "currentPhase": "extract:figma",
  "phases": [
    {
      "name": "extract:raw",
      "status": "complete",
      "artifact": "specs/sources/extracted/raw.reqs.json",
      "completedAt": "2026-08-03T10:12:00Z"
    },
    {
      "name": "extract:jira",
      "status": "complete",
      "artifact": "specs/sources/extracted/jira.reqs.json",
      "completedAt": "2026-08-03T10:31:00Z"
    },
    {
      "name": "extract:confluence",
      "status": "skipped",
      "artifact": null,
      "reason": "confluence/ not present or empty"
    },
    {
      "name": "extract:figma",
      "status": "pending",
      "artifact": "specs/sources/extracted/figma.reqs.json"
    },
    {
      "name": "merge",
      "status": "pending",
      "artifact": "specs/sources/requirements-ledger.json"
    },
    {
      "name": "generate",
      "status": "pending",
      "artifact": "specs/business-requirements.md (+5 more) + manifest.json + reference/"
    },
    {
      "name": "review:ambiguity-analyst",
      "status": "pending",
      "artifact": null
    },
    {
      "name": "review:architecture-reviewer",
      "status": "pending",
      "artifact": null
    },
    {
      "name": "review:security-auditor",
      "status": "pending",
      "artifact": null
    },
    { "name": "review:db-designer", "status": "pending", "artifact": null },
    {
      "name": "review:backend-engineer",
      "status": "pending",
      "artifact": null
    },
    { "name": "review:test-strategist", "status": "pending", "artifact": null },
    {
      "name": "review:integration-engineer",
      "status": "pending",
      "artifact": null
    },
    {
      "name": "finalize",
      "status": "pending",
      "artifact": "specs/sources/manifest.json + RTM finalized"
    }
  ]
}
```

**Field rules:**

- `mode` — always `"phased"` in practice (the monolithic path never writes a
  tracker). The field documents how a leftover tracker was created.
- `sourcesPresent` — computed ONCE at bootstrap from folder
  existence-AND-non-emptiness (D1). Never recomputed mid-pipeline (D3).
- `reqIdCounter` — single high-water mark for stable `REQ-####` assignment across
  ALL extract phases + merge, so IDs never collide across sessions. Each extract
  phase reads it, assigns the next IDs, and writes back the new max. A race is
  impossible by construction (one phase per invocation, always sequential).
- `status` vocabulary — `pending` / `complete` / `skipped` (mirror absent) /
  `failed` (STOPped mid-phase, e.g. staleness). Lowercase.
- `currentPhase` — convenience cache meaning "next pending phase to run";
  **recomputed fresh each Router invocation, never trusted as stored fact**
  (matters after a batched review run).

#### `specs/sources/extracted/<source>.reqs.json` — one per source (`raw`, `jira`, `confluence`, `figma`)

```json
{
  "schemaVersion": 1,
  "source": "jira",
  "extractedAt": "2026-08-03T10:31:00Z",
  "sourceSnapshot": {
    "mirrorIndex": "jira/_index.json",
    "lastSyncedAt": "2026-08-02T09:00:00Z",
    "itemCount": 34
  },
  "requirements": [
    {
      "reqId": "REQ-0012",
      "kind": "functional",
      "title": "Applicant must complete KYC step before submission",
      "prose": "Full requirement narrative, verbatim-derived, unabridged — the complete prose, NOT a summary.",
      "entities": ["Applicant", "KycCheck"],
      "enums": [
        { "name": "KycStatus", "values": ["PENDING", "PASSED", "FAILED"] }
      ],
      "thresholds": [{ "name": "kycTimeoutHours", "value": 24 }],
      "relationships": [
        { "from": "Applicant", "to": "KycCheck", "cardinality": "1:N" }
      ],
      "sourceRef": { "ref": "jira/stories/EON-123.md", "remoteId": "EON-123" },
      "preservationMode": "A",
      "referencePointer": null
    },
    {
      "reqId": "REQ-0013",
      "kind": "data",
      "title": "Counterparty extract — schema-only (sensitive)",
      "prose": "Column layout and cardinality description; NO raw rows.",
      "entities": ["Counterparty"],
      "enums": [],
      "thresholds": [],
      "relationships": [],
      "sourceRef": {
        "ref": "raw-requirements/counterparty-extract.csv",
        "remoteId": null
      },
      "preservationMode": "C",
      "referencePointer": "specs/reference/data/counterparty-extract-SCHEMA.md"
    }
  ],
  "conflicts": [],
  "unresolvedGaps": []
}
```

**Field rules:**

- Every requirement carries BOTH structured fields AND full `prose` (D6
  fidelity). Nothing is summarized.
- `preservationMode` A/B/C is assigned **at extract time**. For B/C,
  `referencePointer` points at the `specs/reference/...` file written **during
  this extract run**.
- `sourceRef` carries enough to populate `manifest.json` + RTM later without
  re-reading the mirror.
- `conflicts[]` / `unresolvedGaps[]` — per-source flags the extract noticed,
  carried into `merge`.

#### `specs/sources/requirements-ledger.json` — the merge output (throwaway staging)

```json
{
  "schemaVersion": 1,
  "mergedAt": "2026-08-03T11:05:00Z",
  "inputs": [
    "specs/sources/extracted/raw.reqs.json",
    "specs/sources/extracted/jira.reqs.json",
    "specs/sources/extracted/figma.reqs.json"
  ],
  "requirements": [
    {
      "reqId": "REQ-0012",
      "kind": "functional",
      "title": "Applicant must complete KYC step before submission",
      "prose": "...",
      "entities": ["Applicant", "KycCheck"],
      "enums": [
        { "name": "KycStatus", "values": ["PENDING", "PASSED", "FAILED"] }
      ],
      "thresholds": [{ "name": "kycTimeoutHours", "value": 24 }],
      "relationships": [
        { "from": "Applicant", "to": "KycCheck", "cardinality": "1:N" }
      ],
      "sources": [
        {
          "ref": "jira/stories/EON-123.md",
          "remoteId": "EON-123",
          "preservationMode": "A"
        }
      ],
      "duplicateOf": null,
      "conflictFlag": null
    },
    {
      "reqId": "REQ-0031",
      "kind": "functional",
      "title": "Applicant KYC step deadline (duplicate, merged)",
      "prose": "...",
      "sources": [
        {
          "ref": "raw-requirements/req.md",
          "remoteId": null,
          "preservationMode": "A"
        },
        {
          "ref": "jira/stories/EON-123.md",
          "remoteId": "EON-123",
          "preservationMode": "A"
        }
      ],
      "duplicateOf": "REQ-0012",
      "conflictFlag": null
    },
    {
      "reqId": "REQ-0044",
      "kind": "nonfunctional",
      "title": "KYC timeout: 24h (raw) vs 48h (JIRA) — CONFLICT",
      "sources": [
        {
          "ref": "raw-requirements/req.md",
          "remoteId": null,
          "preservationMode": "A"
        },
        {
          "ref": "jira/stories/EON-140.md",
          "remoteId": "EON-140",
          "preservationMode": "A"
        }
      ],
      "duplicateOf": null,
      "conflictFlag": "threshold-mismatch: kycTimeoutHours 24 vs 48"
    }
  ],
  "referencePointers": ["specs/reference/data/counterparty-extract-SCHEMA.md"]
}
```

**Field rules:**

- Every entry keeps its own `reqId` even when a duplicate (`duplicateOf` → the
  canonical survivor). Never drop/renumber an ID (it may already be cited in RTM
  drafts / prior conversation).
- `conflictFlag` is non-null only on a genuine content contradiction (not mere
  duplication) → becomes a `generate`-phase gap question.
- `referencePointers` — flat rollup of every `specs/reference/...` file written
  by any extract phase; `generate` reads this list directly (no re-scan of
  `specs/reference/`).

---

## Phase Contracts

Each contract below defines exactly one phase. The Router (R3b) dispatches to
**one** of these per invocation and loads **only** that phase's inputs. These
contracts apply in **phased mode only** — the monolithic path (R2) never enters
them and runs the original Pre-Flight → Steps 1–7 verbatim.

### Phase Contract: `extract:<source>` (parameterised — one contract, four instances)

Runs once per source. `<source>` ∈ `raw` / `jira` / `confluence` / `figma`. The
body is identical across sources; only the per-source parameters differ (table
below).

- **Reads (per-source parameter table):**

  | `<source>` | Reads | Requirement-text regions | Hierarchy source | Staleness/emptiness check | RTM Source format |
  |---|---|---|---|---|---|
  | `raw` | the primary input path from Argument Handling | all supported source content | (n/a) | run the Conversion Guard, cross-reference resolution map, and Excel-index handling (raw only) | empty (authored from primary input) |
  | `jira` | `jira/_index.json` + in-scope `jira/<type>/{KEY}.md` + `{KEY}.json` sidecars | `## Description` + `## Acceptance Criteria` | sidecar `parent`/`links` + `_index.json.tree` | apply the "jira" staleness/emptiness check from Argument Handling | `` `jira/<type>/{KEY}.md` (KEY) `` |
  | `confluence` | `confluence/<slug>.md` files (+ `confluence/_index.json` where present) | full page body | (page hierarchy where present) | apply the "confluence" mirror check | `` `confluence/<slug>.md` (remoteId vNN) `` |
  | `figma` | `figma/_index.json` + in-scope `figma/nodes/<slug>.md` + `.flow.mmd` + `.meta.json` | node `.md` structure + `.flow.mmd` flow | `_index.json.frameTree` | apply the "figma" staleness/emptiness check from Argument Handling | `` `figma/nodes/<slug>.md` (nodeId) `` colon form |

  Also reads `specs/sources/_pipeline.json` for the current `reqIdCounter`.

- **Steps (shared):**
  1. **Discovery** scoped to this ONE source (Step 1 logic, scoped): for `raw`,
     inventory the primary folder; for a mirror, roster from its `_index.json`.
  2. **Extract** requirements (Step 2 logic): for each in-scope item, derive the
     structured fields (entities, enums, thresholds, relationships) AND the full
     unabridged `prose` (D6 — never a summary). Assign `reqId`s from
     `reqIdCounter`, incrementing.
  3. **Assign preservation mode A/B/C at extract time.** For every mode-B or
     mode-C artefact, write the `specs/reference/<category>/...` file NOW and set
     the requirement's `referencePointer` to it. Sensitive production data →
     mode C, schema-only, never raw rows (the sensitive-data guard applies here).
  4. **Per-source gaps** (Step 3 logic, scoped): record ambiguities/missing data
     in `unresolvedGaps[]` and surface them in this phase's end-of-run report —
     ask the human immediately (a human is in this session). Cross-source
     conflicts are NOT resolved here; they are `merge`'s job.
  5. **Write** `specs/sources/extracted/<source>.reqs.json` (schema above), roll
     `referencePointer`s into the requirement rows, and update
     `_pipeline.json.reqIdCounter` to the new max.
- **Must NOT:** call any remote MCP tool or ingest command (**R3**); read any
  OTHER source's mirror or the primary input; write any of the 6 spec docs; touch
  `requirements-ledger.json`.
- **Staleness/emptiness STOP:** apply the exact check from Argument Handling for
  this source. On STOP → mark the phase `failed` with a `reason` in
  `_pipeline.json`, print the exact remediation message from Argument Handling,
  and halt.
- **Overwrite (D4):** if a partial `extracted/<source>.reqs.json` exists from a
  crashed run, **overwrite it silently.** This is a documented exception to the
  default backup-then-overwrite policy — partial extract JSON has no salvageable
  value and phases are atomic (no sub-checkpointing).
- **End-of-run report:**
  ```
  Phase extract:<source> complete.
    Requirements extracted: {N}   (A: {a} / B: {b} / C: {c})
    Reference artefacts written: {list, or none}
    Conflicts/gaps flagged for merge: {N}
    reqIdCounter now: {N}
  Next: run `/create-specifications` again to run `<next-phase-name>`.
  ```

> **Parameterisation is sound (implementation check).** The Figma consumption
> rules (`frameTree`, colon `nodeId`) and the JIRA rules (`tree`,
> `parent`/`links`) both fit this one shared contract: each reads its
> `_index.json` first, applies its staleness/emptiness STOP, drills into in-scope
> item bodies + sidecars, reconstructs hierarchy from its index tree field, and
> writes the same `<source>.reqs.json` shape. The only differences — which index
> tree field, which body regions are requirement text, the RTM Source format —
> are captured by the parameter table above, not by divergent logic. No leaky
> abstraction; do not split into per-source contracts.

### Phase Contract: `merge`

- **Reads:** every existing `specs/sources/extracted/<source>.reqs.json` (one per
  present source, per `sourcesPresent`) — compact JSON only, never the raw
  sources / mirrors again. Reads `_pipeline.json` for `reqIdCounter`.
- **Writes:** `specs/sources/requirements-ledger.json` (schema above); updates
  `_pipeline.json` (`reqIdCounter` if any IDs assigned, phase row).
- **Behaviour:**
  1. Concatenate all `requirements[]`.
  2. **Dedup (semantic, not string):** the same business rule / entity /
     threshold from different sources → keep both `reqId`s, set `duplicateOf` on
     the non-canonical one. Prefer the raw/primary-input version as canonical when
     raw + a mirror both state it.
  3. **Conflict-flag:** the same requirement with a different value
     (threshold / enum / cardinality) → set `conflictFlag` with a human-readable
     reason. Do **NOT** resolve here; it surfaces as a `generate`-phase gap.
  4. Assign any still-missing `REQ-ID`s from `reqIdCounter`.
  5. Preserve mode A/B/C + `referencePointer`s **verbatim** — merge NEVER changes
     a preservation mode.
  6. Roll up `referencePointers[]` (flat union of every extract phase's reference
     files).
- **Must NOT:** read `jira/`/`confluence/`/`figma/` or the primary input
  directly; write any spec doc; re-classify any preservation mode; call any MCP
  tool or ingest command (**R3**).
- **End-of-run report:** merged total / duplicates resolved / conflicts flagged /
  reference pointers carried forward / "Next: run `generate`."

### Phase Contract: `generate`

Body = the original **Step 4: Generate the Specification Set** (below), applied
**verbatim** — Doc Structure single-file rule, MANDATORY cross-reference rule,
Technical completeness, Design diagrams, the Traceability Join `manifest.json`
shape, and the RTM Source Column — with these phased-mode deltas:

- **Reads:** `specs/sources/requirements-ledger.json` **in full** (generation
  exception) + the 6 templates + `@.claude/standards/mermaid-standards.md`. Never
  reads the raw sources / `extracted/*` again.
- **Source Preservation subsection is deleted from this phase** (mode A/B/C
  assignment already happened at extract). Replace it with: *for every ledger
  entry with `preservationMode` B or C, confirm its `referencePointer` resolves
  inside `specs/reference/`. If missing → this is a pipeline defect: do NOT
  re-derive here — stop, mark this phase `failed`, and report which `extract:*`
  phase to re-run.*
- **Traceability Join / RTM Source Column:** populate from each ledger entry's
  `sources[]` (`ref` + `remoteId`), **not** by re-reading the mirror. The
  `manifest.json` shape and the RTM Source formats stay **exactly** as specified
  in Step 4 — only their population source changes to "read the ledger."
- **Conflicts:** any ledger entry with a non-null `conflictFlag` → a Step-3-style
  gap question to the human (same options-style flow) **before** finalizing the
  docs.
- **Also writes:** seeds `specs/sources/manifest.json` + `specs/reference/`
  (README consumption map) — verbatim per the Step 4 rules.
- **Loads templates here** (the "Load templates" Pre-Flight step belongs to this
  phase in phased mode). If any template is missing, mark the phase `failed` and
  ask the user to restore templates first.
- **End-of-run report:** documents written / cross-reference coverage /
  manifest entries seeded / open conflict-gaps / "Next: run
  `review:ambiguity-analyst`."

### Phase Contract: `review:<agent>` (parameterised — one contract, seven instances)

Fixed order (one phase row each):
`ambiguity-analyst → architecture-reviewer → security-auditor → db-designer → backend-engineer → test-strategist → integration-engineer`.

- **Reads:** the current spec set **only** — `specs/business-requirements.md`,
  `specs/functional-specifications.md`, `specs/strategy.md`,
  `specs/data-dictionary.md`, `specs/architecture-diagrams.md`,
  `specs/requirements-traceability-matrix.md`, `specs/reference/README.md` — plus
  this one agent's file `@.claude/agents/<agent>.md`. Nothing from any other
  phase's working set (no `extracted/*`, no ledger, no raw sources, no other
  agent's file).
- **Writes:** in-place edits to the 6 spec docs (fold-in per the Step 5 "How each
  gate runs" steps 1–5, verbatim) + this phase's row in `_pipeline.json`.
- **Behaviour:** verbatim per the original **Step 5** (below) — load → review from
  this agent's angle → ask the human options-style (ambiguity-analyst Universal
  Options Presentation) → hard-stop gate (wait for answers) → fold in. The
  human-in-the-loop options-gate is preserved exactly.
- **Batching allowance (D8):** independent, non-overlapping gates MAY be combined
  into ONE run **only when the user explicitly asks** to move faster (e.g.
  `review:test-strategist` + `review:integration-engineer`). A gate that depends
  on a prior gate's output may **never** merge with that prior gate. When batched,
  mark **both** rows `complete` in the same invocation and report both in one
  combined message. This is the sole exception to "one phase per invocation."
- **End-of-run report:** findings folded in / open `REVIEW` markers / "Next: run
  `<next-phase-name>`."

### Phase Contract: `finalize`

Body = the original **Step 6 (Consistency Check + Capture-Completeness Gate)** +
**Step 7 (Usage Mapping)** + the full **Output Summary** + the **EDR Bridge**
(all below), applied **verbatim**, with these phased-mode deltas:

- The **Capture-Completeness Gate** builds its completeness ledger by walking
  `requirements-ledger.json.requirements[]` (each entry carries its mode) UNION
  `referencePointers[]`, cross-checked against `specs/reference/` — **NOT** a live
  raw re-scan. This is provably equivalent in phased mode and remains correct even
  if `raw-requirements/` was already deleted.
- **Exception path:** raw sources are typically still on disk at `finalize`
  (deletion happens after pipeline success), so if the gate finds a gap it MAY
  re-open the relevant `extract:*` Pre-Flight to re-read the raw source. This is
  the exception, not the norm.
- On success, mark `finalize` `complete` — the last tracker write. The tracker
  becomes historical/inert; it is **NOT** deleted (the "no file is deleted by this
  command" rule extends to the tracker).
- Print the full original **Output Summary** verbatim, plus one new line:
  > Pipeline: N/N phases complete. specs/sources/_pipeline.json retained as a
  > historical record (not read again unless you force a re-run — see Overwrite
  > Policy).

---

## Pre-Flight

> **Applies to the monolithic path (R2) as a combined pre-flight.** In phased
> mode these steps are split: the Conversion Guard / cross-reference resolution
> map / Excel-index handling belong to `extract:raw` only (only `raw` touches the
> primary input); "Load templates" belongs to `generate` only.

### Conversion Guard (run BEFORE anything else)

Scan the input path for source files whose extension is **not** `.md` or `.csv`.

1. **Unconverted binary/office/pdf sources present** — if any file has an
   extension outside `{.md, .csv, .txt, .json, .yaml, .yml}` (e.g. `.docx`,
   `.pptx`, `.xlsx`, `.xlsm`, `.xls`, `.pdf`):
   - Check whether a converted sibling exists: for a source `X.ext`, look for a
     Markdown file whose `source_file:` frontmatter equals `X.ext` (typically
     `X.md` alongside it).
   - If **any** such source has **no** corresponding converted `.md` → **STOP**.
     List the unconverted files and tell the user:
     > Run `/convert-to-markdown @<folder>` first, then re-run
     > `/create-specifications`.
   - Do not attempt to read the binary originals yourself.

2. **Stale conversions** — for every converted `.md` that carries
   `source_file: X.ext` frontmatter, compare modification times of the original
   `X.ext` and the `X.md`:
   - If the original `X.ext` is **newer** than its `.md` → the conversion is
     stale. **STOP**, list the stale pairs, and tell the user to re-run
     `/convert-to-markdown` so the Markdown reflects the latest source.
   - Suggested check per pair:
     `[ "<X.ext>" -nt "<X.md>" ] && echo STALE`

3. **Clear** — if every non-`.md`/`.csv` source has a fresh conversion (or there
   are none), continue.

> Only proceed past this guard when all sources are either natively readable
> (`.md`/`.csv`/text/json/yaml) or have a **fresh** converted `.md`.

### Cross-reference resolution map

Some documents reference others by their **original** filename (e.g.
`CBA_CANS_Business_Requirements` says "see ISDA_Product_Mapping.xlsx"). Because
converted files use clean names, build a `source_file → converted .md` map from
the frontmatter of every converted document, and use it to resolve such
references to the correct `.md` while extracting requirements. Always ingest the
converted `.md`, never the binary original.

### Excel indexes → per-sheet CSVs

A converted Excel file is **not** a single Markdown document. It is a small
Markdown **index** (frontmatter includes `format: csv-per-sheet` and `csv_dir:`)
that links to one CSV per sheet in a sibling `<stem>/` directory. When ingesting
an Excel source:

1. Read the index `.md` first — it lists every sheet, its CSV path, and row/col
   counts.
2. Read the individual CSVs you actually need. **Do not blindly load every
   CSV** — some sheets can be very large (tens of thousands of rows, multi-MB).
   Use the index's row counts to decide: load the requirement-bearing sheets,
   and for a huge raw-data sheet, sample or extract only the columns/rows the
   specification needs rather than the whole file.
3. Preserve traceability: cite the sheet name (from the index) and original
   workbook (`source_file:`) when a requirement derives from Excel data.

### Load templates

Load the full specification-set templates:

- `@.claude/templates/business-requirements.md`
- `@.claude/templates/functional-specifications.md`
- `@.claude/templates/strategy.md`
- `@.claude/templates/data-dictionary-template.md`
- `@.claude/templates/architecture-diagrams.md`
- `@.claude/templates/requirements-traceability-matrix.md`

If any template is missing, stop and ask the user to restore template files
first. Also load the binding diagram standard
`@.claude/standards/mermaid-standards.md` before emitting any diagram.

---

## Process

> **Monolithic path (R2) runs Steps 1–7 as a single continuous workflow.** In
> phased mode these steps are the bodies of the Phase Contracts above: Step 1 +
> Step 2 + Step 3 → `extract:*`; Step 4 → `generate`; Step 5 → `review:<agent>`;
> Steps 6 + 7 → `finalize`. The step text below is authoritative for both modes.

### Step 1: Source Discovery

If `$ARGUMENT` is a directory, build a source inventory table:

| File | Type | Included | Notes |
|---|---|---|---|
| path | md/csv/etc | Yes/No | reason |

Exclude binary/non-readable files and list them under "Not Processed".

### Step 2: Extract Requirements

From source content, extract and normalize:

- Business goals, outcomes, KPIs
- Stakeholders, user personas, operating model
- Capability map and scope boundaries
- Functional requirements and workflows
- Non-functional requirements and compliance constraints
- Domain entities and integration points
- Risks, assumptions, dependencies, open questions

### Step 3: Resolve Gaps

Create a gap list for missing critical data:

- Ambiguous personas/roles
- Missing NFR targets
- Missing compliance/security constraints
- Missing integration ownership/contracts

Ask user whether to proceed with defaults and explicit `REVIEW` markers.

### Step 4: Generate the Specification Set

Generate the full, self-contained document set, each as a **single file** from
its template. **There are no split directories, no `00-index.md`, and no
`NN-*.md` sub-files.** Every document is one Markdown file no matter how large.

| Document | Template | File (always single) |
|---|---|---|
| `specs/business-requirements.md` (**source of truth**) | `@.claude/templates/business-requirements.md` | single file |
| `specs/functional-specifications.md` (**source of truth**) | `@.claude/templates/functional-specifications.md` | single file |
| `specs/strategy.md` (ADRs live inside) | `@.claude/templates/strategy.md` | single file |
| `specs/data-dictionary.md` | `@.claude/templates/data-dictionary-template.md` | single file |
| `specs/architecture-diagrams.md` | `@.claude/templates/architecture-diagrams.md` | single file |
| `specs/requirements-traceability-matrix.md` | `@.claude/templates/requirements-traceability-matrix.md` | single file |
| `specs/sources/manifest.json` | (see §Traceability Join below) | single JSON file — seeded when a local-mirror source folder is passed |
| `specs/reference/` + `specs/reference/README.md` | (see §Source Preservation below) | one file per copied artefact (stay separate) |

#### Doc Structure — single-file rule (no splitting)

Emit **exactly one file per document**, regardless of size or complexity. Even
for large banking/finance programs with many features, a rich domain model, and
many decisions, do **not** split into an `index + NN-*.md` directory. Use clear
in-file headings (`##`/`###`) and stable section anchors so other documents can
deep-link to a section (e.g. `functional-specifications.md#feature-07-…`).

Rationale: `business-requirements.md` and `functional-specifications.md` are the
two source-of-truth files consumed by `/create-epics` and `/create-epic-tasks`.
Keeping every document single-file (and reference-linked from those two) means
downstream commands have one canonical path per concern and can delegate a
sub-agent to read a single file and extract only the sections needed for the
current epic/task — rather than walking an index and a fan-out of sub-files.

#### MANDATORY cross-reference rule (source-of-truth wiring)

`business-requirements.md` and `functional-specifications.md` are the source of
truth, so every supporting document and preserved artefact MUST be reachable from
them by relative link:

- Every **section** of `strategy.md`, `data-dictionary.md`,
  `architecture-diagrams.md`, and `requirements-traceability-matrix.md` that is
  relevant to a requirement or feature MUST be linked from the relevant place in
  `business-requirements.md` and/or `functional-specifications.md` — e.g.
  `[data model](data-dictionary.md#feature-03-entities)`,
  `[ADR-0002](strategy.md#adr-0002-orchestration-model)`,
  `[data flow](architecture-diagrams.md#post-fulfilment-data-flow)`,
  `[traceability](requirements-traceability-matrix.md#fr-010)`.
- Every preserved `specs/reference/` artefact MUST be cited with a `_Source:_`
  relative link from the consuming place in the BRD or FS (this is also the
  mode-B/mode-C requirement below).
- Links are **relative** and use in-file section anchors (kebab-cased heading
  text) — never `00-index.md` paths.
- The Step 6 Consistency Check verifies these links resolve (file + anchor).

#### Source Preservation (the HARD REQUIREMENT, applied)

> **In phased mode this subsection does NOT run in `generate`** — mode A/B/C
> assignment and all `specs/reference/` writes happen at `extract:*` time. The
> `generate` phase instead verifies each ledger entry's `referencePointer`
> resolves inside `specs/reference/` (see the `generate` contract). The text
> below is authoritative for the **monolithic** path.

For **every** discovered source artefact, apply mode A, B, or C from the
HARD REQUIREMENT section above:

- **A (transform):** fold into `business-requirements.md`, `functional-specifications.md`,
  `strategy.md`, or `data-dictionary.md` prose + tables.
- **B (verbatim):** copy byte-for-byte into `specs/reference/<category>/<file>`
  and add a `_Source:_` relative link from the consuming place in the BRD or FS.
- **C (schema-only):** for sensitive bulk/production data, write a
  `*-SCHEMA.md` into `specs/reference/` capturing column layout, cardinality,
  provenance, and anonymised samples only — never the raw rows. Add a `_Source:_`
  relative link to the schema file from the consuming place in the BRD or FS.

Then generate `specs/reference/README.md` as a **consumption map**: for each
copied/preserved artefact, list which `specs/` file and section consumes it
(artefact → consuming doc + anchor), and record its preservation mode (verbatim
vs schema-only) with the governance reason for any schema-only choice. Model it
on the structure a reader needs to trace any `_Source:_` pointer back to its
artefact and the reverse.

> **CRITICAL — treat these as the single durable record.** Capture **every
> single detail** needed to build the actual app — EVERY LITTLE DETAIL. Nothing
> from the source may be lost, summarised away, or left implicit. If a detail
> exists in the source but has no obvious home in a template, add a section for
> it rather than dropping it. After writing, re-read the source and confirm
> nothing is missing (enforced by the Step 6 capture-completeness gate).
>
> **No file is deleted by this command.** It never removes or moves any source
> or converted file. The human deletes the raw originals themselves once they
> are confident the generated set is complete and correct — which is exactly why
> capture must be exhaustive **before** that deletion happens.

#### Traceability Join — `specs/sources/manifest.json` (seed when a mirror folder is passed)

When any local-mirror source folder (`confluence` / `jira` / `figma`) is passed, **create
and seed** `specs/sources/manifest.json`. This is the machine-readable join between each
local mirror file and the spec sections / epics it feeds — the durable record downstream
commands use to answer "which specs does this source feed?" and the join the Phase-5 JIRA
write-back engine reads to decide whether a mutated mirror file feeds a spec.

> **In phased mode**, populate every field from the merge ledger's `sources[]`
> per requirement (`ref` + `remoteId`), **not** by re-reading the mirror. The
> shape below is unchanged.

Shape:

```json
{
  "sources": [
    {
      "ref": "jira/stories/EON-123.md",
      "remoteId": "EON-123",
      "feeds": ["epic-003", "specs/functional-specifications.md#FS-7"]
    }
  ]
}
```

Rules:

- One entry per **local mirror file** consumed as a requirement source.
- `ref` — the repo-relative mirror path. For JIRA use the folder-by-type path
  `jira/<type>/{KEY}.md`; for Confluence `confluence/<slug>.md`; for Figma the folder-by-type
  path `figma/nodes/<slug>.md` (never a flat `figma/<slug>.md`).
- `remoteId` — the remote identifier read from the sidecar / mirror (JIRA key, Confluence
  page id, Figma node id in **colon** form, e.g. `299:12006`).
- `feeds` — the spec anchors and/or epic ids this source contributes to. At
  `/create-specifications` time this is at minimum the FS/BR section anchors that captured
  the requirement (e.g. `specs/functional-specifications.md#FS-7`); epic ids are added by
  `/create-epics` / kept current by `/reconcile-requirements`.
- This file is **seeded** here and **kept current** by `/reconcile-requirements`. Keep it
  consistent with the RTM Source column (they are two views of the same join).

#### RTM Source Column (populate for every mirror-derived requirement)

For every requirement derived from a local mirror source, populate the **Source** column of
`specs/requirements-traceability-matrix.md` per
`@.claude/templates/requirements-traceability-matrix.md`. The formats are **exact**:

```
JIRA:   `jira/<type>/{KEY}.md` (KEY)      e.g.  `jira/stories/EON-123.md` (EON-123)
Figma:  `figma/nodes/<slug>.md` (nodeId)  e.g.  `figma/nodes/mid-fi-e2e-flow.md` (299:12006)
```

Never use a flat `jira/{KEY}.md` or flat `figma/<slug>.md` path. For Figma, the `nodeId` is
the **colon** form (D5), matching `_index.json.items[].nodeId`. Requirements authored
directly from the primary raw input file (no external source) leave Source empty.

**Consistency flags** (surface in the Output Summary's "Review Required" list):

- A mirror file that feeds **no** requirement → **orphaned source**. For Figma, a
  `figma/nodes/<slug>.md` node that produced no requirement is an **orphaned Figma source**.
- A requirement with **no** source that is **not** from the raw input file →
  **untraced requirement**. A design-derived requirement (traceable to a screen/flow) that
  carries no `figma/nodes/…` source is an **untraced design requirement**.
- An **archived** JIRA orphan under `jira/_orphaned/…` is an expected non-source — do
  **not** flag it. A still-**live** orphaned mirror file (under `jira/<type>/…` or
  `figma/nodes/…`, feeding nothing) **is** flagged.

They must also satisfy the following two requirements.

#### Technical completeness (implementation-ready)

Every functional and non-functional requirement in the functional
specification must carry the technical detail an AI agent needs to implement it **without guessing**:

- domain entities and their fields (name, type, nullability, constraints)
- entity relationships and cardinalities
- API endpoints with HTTP method, path, request/response shape, and status codes
- DTO / validation rules (Zod-level: min/max, formats, enums, refinements)
- RBAC permissions per operation (which role/scope may do what)
- domain events published/consumed, and their payloads
- error and edge-case handling (what fails, what the caller sees)
- state transitions and invariants where entities have a lifecycle

Keep this **terse and structured** (tables and bullet lists), not verbose
prose — the primary consumer is an AI agent. Depth over eloquence.

#### Design diagrams (for human verification)

Embed **Mermaid** diagrams inline in the specification documents (in dedicated
diagram sections) so a human reviewer can verify — in one place — that what is
planned matches intent, before any code is written.

- Include only the diagram types that make sense for this application; a type
  may be omitted entirely if it adds nothing, and multiple diagrams of the same
  type are allowed (e.g. one sequence diagram per major flow).
- Diagrams should be derived from **this application's own domain model**,
  **scoped to its modules/requirements**, modular, and easy to modify to fit PPCC
  requirements. Where a domain uses an industry vocabulary (e.g. the ISDA CDM as
  a **vocabulary reference only** — see the CANS ADR-0001), borrow terminology
  for shared understanding, but never treat the external model as the schema
  backbone.
- Candidate diagram types (choose what fits):
  - Data model / ER / class / object diagram (from the domain model)
  - Flowchart
  - State diagram (for entities with a lifecycle)
  - Component diagram
  - Activity diagram
  - User journey map
  - Use case diagram
  - Architecture diagram / C4 (context, container, component)
  - Data flow diagram
  - Sequence diagram (per key flow — auth, primary use cases, integrations)

Full-system / master scope belongs here; downstream `/create-epics` and
`/create-epic-tasks` extract **scoped** diagrams per slice from these masters.
Every diagram MUST follow the binding standard
`@.claude/standards/mermaid-standards.md` (portable syntax, sparing emoji,
`classDef` theme, `subgraph` boundaries, `accTitle`/`accDescr`); see
`.claude/commands/diagram-create.md` for authoring examples.

### Step 5: Expert Review Gates (sequential, human-in-the-loop)

After the first-draft set exists, **harden it** by running a sequence of expert
agents. This step is what turns a first draft into an enterprise-grade
specification. It is **dynamic and interactive**: each agent reviews the current
specs from its own angle, then talks to the human — asking targeted
clarification questions and presenting recommended options — before its findings
are folded in. **The enhanced spec set produced by one gate is the input to the
next gate.**

#### How each gate runs

For each agent in the sequence:

1. **Load** the agent file and give it the current spec set:
   `specs/business-requirements.md`, `specs/functional-specifications.md`,
   `specs/strategy.md`, `specs/data-dictionary.md`, `specs/architecture-diagrams.md`,
   `specs/requirements-traceability-matrix.md`, and `specs/reference/README.md`.
2. **Review** from the agent's angle (see sequence below). Produce findings:
   ambiguities, gaps, risks, conflicts, and improvement opportunities.
3. **Ask the human, options-style.** Present questions and recommendations using
   the **ambiguity-analyst Universal Options Presentation** rules
   (`@.claude/agents/ambiguity-analyst.md`): present 2–5 concrete options per
   decision, mark **exactly one** as Recommended/Default, show the implication of
   each, and always offer a plain-text free-form fallback option **last**. Batch
   related questions so the human answers a coherent set per gate, not a trickle.
4. **Gate (hard stop).** Wait for the human's answers. Do **not** advance to the
   next agent until this gate's questions are resolved (answered, deferred with
   an explicit `REVIEW` marker, or explicitly waived by the human).
5. **Fold in.** Update the spec set (single files) with the answers and the
   agent's accepted recommendations. Record notable decisions as ADR-style
   sections in `specs/strategy.md` and update `specs/requirements-traceability-matrix.md`.
   Ensure new cross-references added during fold-in comply with the mandatory
   cross-reference rule (Step 4). The updated single-file set becomes the input
   to the next gate.

> **Default pacing is sequential per agent** — one gate at a time, so the human
> is never overwhelmed and each agent builds on the previous gate's improvements.
> Independent, non-overlapping review angles (e.g. test-strategist and
> integration-engineer) **may** be batched into a single combined gate when the
> human asks to move faster — but never merge a gate that depends on a prior
> gate's output. (In phased mode this is the D8 batching allowance in the
> `review:<agent>` contract.)

#### Review sequence

Run these gates in order (each reads the output of the previous):

1. **`ambiguity-analyst`** — unresolved ambiguities, conflicting statements,
   hidden assumptions, missing "obvious" requirements. (Broadest first — clears
   noise before specialists dig in.)
2. **`architecture-reviewer`** — solution shape, layer boundaries, module
   decomposition, SOLID/design concerns, cross-cutting concerns. Feeds decisions
   into `specs/strategy.md`.
3. **`security-auditor`** — data sensitivity classification, auth/authorization
   model, PII handling, compliance posture, and (critically) that sensitive
   source data was preserved **schema-only** per the HARD REQUIREMENT.
4. **`db-designer`** — entities, keys, relationships, cardinalities, ownership /
   system-of-record boundaries, and correctness of the data dictionary + ER
   diagram.
5. **`backend-engineer`** — API/domain feasibility, endpoint/DTO/validation
   completeness, event model, error handling — is the FS truly
   implementation-ready?
6. **`test-strategist`** — testability: are acceptance criteria measurable, is
   every requirement traceable to a test in the RTM, what scenarios are missing?
7. **`integration-engineer`** — external systems, event/message contracts,
   retries, idempotency, failure modes, DLQ expectations.

Each agent is invoked in its **Spec-Review Mode** (see the agent files); if an
agent lacks that section, apply the ambiguity-analyst options rules generically.

#### After the final gate

- Re-run the **Consistency Check** and the **Capture-Completeness Gate**
  (Step 6) — the review may have added or moved detail.
- Summarise, per gate, what changed and what remains `REVIEW` — surface this in
  the Output Summary's "Review Required" list.

### Step 6: Consistency Check & Capture-Completeness Gate

#### Consistency Check

Validate:

- Terminology consistency across all six documents in the set
- Role names and permissions alignment
- Feature names and priorities alignment
- NFR baselines alignment
- Diagrams in `architecture-diagrams.md` agree with the textual requirements and domain model
- Data-dictionary tables/enums match the entities named in BRD/FS
- RTM rows exist for every feature and story, each with a linked test
- No contradictions between `business-requirements.md`, `functional-specifications.md`,
  and `strategy.md`
- **Mandatory cross-reference check:** every section of `strategy.md`,
  `data-dictionary.md`, `architecture-diagrams.md`, and `requirements-traceability-matrix.md`
  that is relevant to a requirement or feature is linked from `business-requirements.md`
  and/or `functional-specifications.md`. Every `specs/reference/` artefact has a
  `_Source:_` link from the BRD or FS. All relative links (file + anchor) resolve.
- **Mirror-source traceability check** (only when a local-mirror source folder was passed):
  - `specs/sources/manifest.json` exists and every consumed mirror file has an entry with
    `ref`, `remoteId`, and a non-empty `feeds`.
  - Every RTM row whose requirement came from a mirror carries a **Source** value; JIRA
    sources use the exact `` `jira/<type>/{KEY}.md` (KEY) `` format.
  - The RTM Source column and the manifest `ref`s agree (two views of one join).
  - Run the consistency flags: **orphaned source** (mirror file feeding nothing — but not
    an archived `jira/_orphaned/…` file), **untraced requirement** (mirror-scope
    requirement with no Source). Surface any hits in "Review Required".

#### Capture-Completeness Gate (enforces the HARD REQUIREMENT)

Build a **completeness ledger**: enumerate **every** source artefact discovered
in Step 1, and assert each is accounted for by exactly one mode:

| Source artefact | Mode (A transform / B verbatim / C schema-only) | Where it landed in `specs/` |
|---|---|---|

> **In phased mode (the `finalize` phase)** build this ledger by walking
> `specs/sources/requirements-ledger.json.requirements[]` (each entry carries its
> mode) UNION its `referencePointers[]`, cross-checked against `specs/reference/`
> — NOT a live raw re-scan. This is provably equivalent to the enumeration below
> and remains correct even if `raw-requirements/` was already deleted. If the gate
> finds a gap it MAY (exception, not norm) re-open the relevant `extract:*`
> Pre-Flight to re-read the raw source, since raw sources are usually still on
> disk at `finalize`.

- If **any** artefact is unaccounted for → **do not report success**. Loop back:
  capture the missing artefact (mode A/B/C as appropriate), then re-run this gate.
- Confirm every `_Source:_` pointer in `business-requirements.md` /
  `functional-specifications.md` resolves to a file **inside `specs/reference/`** —
  never into the temporary input folder.
- Confirm sensitive artefacts used mode C (schema-only) — flag any that were
  copied verbatim as a governance defect and fix before success.

Only when the ledger is complete and every pointer resolves may the command
report success.

### Step 7: Usage Mapping

Include this guidance at the end of the FS (and index docs):

- Recommend running `/create-epics` next.
- The full set is the source of truth for **all** downstream commands:
  `/create-epics`, `/create-epic-tasks`, `/implement-epic`, `/add-feature`,
  `/add-endpoint`, `/add-component`, `/add-e2e-test`, `/add-integration-test`,
  `/docs-technical`, `/story-create`, `/design-api`, `/design-architecture`,
  `/design-database`, `/deploy-pipeline`.
- Downstream generation commands extract the scoped context they need from these
  documents (and their `specs/reference/` sources); there is no separate concise
  variant to maintain.

---

## Overwrite Policy

Before writing, check if each target file exists.

If any exist, ask once and apply the selected action to both files:

1. Overwrite all
2. Backup existing then overwrite
3. Merge missing sections only
4. Cancel

Default: `2` (backup then overwrite).

Backup naming convention:

- `{original-name}.backup-YYYYMMDD-HHMM.md`

### Re-running a phase (phased mode)

This subsection applies only when a `specs/sources/_pipeline.json` tracker exists
(phased mode). It is **manual/explicit only** — nothing here happens
automatically.

- **Re-running a `complete` phase.** If the user explicitly asks (e.g. "redo
  `extract:jira`"), set that phase's row back to `pending` **AND** set every phase
  **after** it in array order back to `pending` too — later phases consumed its
  output and are now stale. Then apply the Overwrite Policy above (ask once:
  overwrite / backup / merge / cancel) to that phase's artifact(s). **Exception:**
  extract artifacts (`extracted/<source>.reqs.json`) default straight to
  overwrite per D4 (partial/old extract JSON has no salvageable value).
- **Raw sources changed mid-pipeline.** The recommended recovery is "re-run from
  extract": reset the affected `extract:<source>` (and everything after it) to
  `pending`, then re-run. Do **NOT** partial-patch `extracted/*` or the ledger —
  they are throwaway staging, cheap to regenerate, and partial patching risks
  silent drift. For a change that arrives **after** the pipeline has reached
  `finalize`, use `/reconcile-requirements` instead — the pipeline's job ends once
  `specs/` is generated.
- **Mirror appeared/disappeared mid-pipeline (D3).** `sourcesPresent` is frozen at
  bootstrap and this command never auto-detects mirror drift. To pick up a changed
  mirror, delete `specs/sources/_pipeline.json` and re-run to re-bootstrap. See the
  recovery section of `docs/CREATING-SPECS.md`.

---

## Output Summary

After completion, print:

```markdown
## Specification Set Generated

### Files Written
1. specs/business-requirements.md           (source of truth)
2. specs/functional-specifications.md       (source of truth)
3. specs/strategy.md                        (ADRs + principles)
4. specs/data-dictionary.md
5. specs/architecture-diagrams.md
6. specs/requirements-traceability-matrix.md
7. specs/sources/manifest.json              (seeded only when a mirror folder was passed)
8. specs/reference/ (+ README.md consumption map) — {N} artefacts preserved

### Cross-Reference Coverage
- Sections of strategy/data-dictionary/architecture-diagrams/RTM linked from BRD or FS: {N}/{N}
- specs/reference/ artefacts with _Source:_ pointers in BRD or FS: {N}/{N}
- Broken relative links (file + anchor): 0

### Source
- Mode: file or directory
- Input path: {path}
- Local-mirror source folders: {none | confluence, jira, figma}
- Files analyzed: {count}

### Mirror-Source Traceability (only when a mirror folder was passed)
- specs/sources/manifest.json entries: {N}   (ref / remoteId / feeds)
- RTM Source column populated for mirror-derived requirements: {N}/{N}
- JIRA sources in exact `jira/<type>/{KEY}.md (KEY)` format: yes/no
- Orphaned sources (live mirror file feeding nothing): {list — empty if none}
- Untraced requirements (mirror-scope, no Source): {list — empty if none}
- Ingest commands invoked during generation: none  (R3 — generation reads, never ingests)

### Capture Completeness
- Artefacts accounted for: {N}/{N}   (A transform / B verbatim / C schema-only)
- Schema-only (sensitive) artefacts: {list}
- All `_Source:_` pointers resolve inside specs/reference/: yes

### Expert Review Gates
- ambiguity-analyst: {resolved / open items}
- architecture-reviewer: {…}
- security-auditor: {…}
- db-designer: {…}
- backend-engineer: {…}
- test-strategist: {…}
- integration-engineer: {…}

### Review Required (deferred / REVIEW markers)
- {item 1}
- {item 2}

### Recommended Next Steps
1. Run `/create-epics` to generate sequenced epics from the spec set
2. Review generated epics and dependencies
3. Implement epics via `/implement-epic`
```

> **In phased mode** this full Output Summary is the `finalize` phase's
> end-of-run report; append the one extra pipeline-status line specified in the
> `finalize` contract. In monolithic mode it is printed verbatim at the end of the
> single run.

---

## EDR Bridge — Confluence Evidence Suggestion (Phase 5, suggestion only)

After the spec set is written and the Output Summary is printed, **offer** relevant mirrored
Confluence pages as supporting evidence. This is a **suggestion**, not an automatic injection —
the human decides whether any page's content belongs in the spec. (In phased mode this runs
as the last step of the `finalize` phase.)

**When to offer:** if `confluence/_index.json` exists and `items` is non-empty.

**How to offer:**

1. For the primary subject of the spec (inferred from the source input's title or top-level
   topic), grep `confluence/_index.json.items[*].title` and `confluence/pages/*.md` headings
   for pages that look topically relevant (keyword overlap with the spec's main domain terms).
2. Present a compact, cited shortlist (max 5 pages):

   ```
   ## Confluence Evidence Available (suggestion — Phase 5)

   The following mirrored Confluence pages may contain supporting evidence for this spec.
   Review them and copy relevant context manually into specs/ if useful.
   None of this is injected automatically (R3).

   | # | Page | Space | Version | Relevance hint |
   |---|---|---|---|---|
   | 1 | [PCON-2042342654 v14] "NTB POBO — Temporary Credentials" | PCON | v14 | title overlap: "temporary credentials", "NTB" |
   …

   To read a page: `/confluence read <pageId>`
   To see Confluence↔JIRA cross-links: `/confluence relationship-map <pageId>`
   To check doc-vs-code drift on a design page: `/confluence design-sync <pageId>`
   ```

3. **Do NOT** write any Confluence body text into `specs/`. The human copies what they want.
4. **Do NOT** trigger `/reconcile-requirements`. This is informational only.
5. If `confluence/_index.json` is absent or empty, skip silently — do not report an error.

---

## Cross-References

- Prerequisite: `@.claude/commands/convert-to-markdown.md` — converts binary
  Office/PDF sources to Markdown; must be run before this command when the input
  folder contains non-`.md`/`.csv` files
- Agent: `@.claude/agents/product-owner.md` — activate to drive requirements extraction, personas, and gap analysis
- Review-gate agents (Step 5, in sequence):
  - `@.claude/agents/ambiguity-analyst.md`
  - `@.claude/agents/architecture-reviewer.md`
  - `@.claude/agents/security-auditor.md`
  - `@.claude/agents/db-designer.md`
  - `@.claude/agents/backend-engineer.md`
  - `@.claude/agents/test-strategist.md`
  - `@.claude/agents/integration-engineer.md`
- Diagram standard (binding): `@.claude/standards/mermaid-standards.md`
- Diagram authoring examples: `@.claude/commands/diagram-create.md`
- Complements: `/create-functional-spec` for functional-only workflows
- Local JIRA mirror (read-only source): populated by `/jira-init` + `/jira-sync`; this
  command consumes it but **never** refreshes it (R3 — generation reads, never ingests).
  Refreshing from a URL is `/reconcile-requirements <url>`'s job.
- Traceability join kept current by: `@.claude/commands/reconcile-requirements.md`
  (`specs/sources/manifest.json` + RTM Source column)
- Phase tracker (phased mode, throwaway staging): `specs/sources/_pipeline.json`
- Operating guide (phased vs monolithic modes, file shapes, recovery):
  `@docs/CREATING-SPECS.md`
- Templates (the full set):
  - `@.claude/templates/business-requirements.md`
  - `@.claude/templates/functional-specifications.md`
  - `@.claude/templates/strategy.md`
  - `@.claude/templates/data-dictionary-template.md`
  - `@.claude/templates/architecture-diagrams.md`
  - `@.claude/templates/requirements-traceability-matrix.md`
