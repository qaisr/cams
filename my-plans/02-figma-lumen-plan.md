# Plan 2 — Figma Ingestion & Lumen Adoption (Local-Copy Mirror + Derived Index + NL Query Engine)

> **Status:** Proposed · **Author:** AI Tools Expert / Frameworks Designer
> session · **Date:** 2026-07-31 **Updated:** 2026-08-01 — Dev seat confirmed;
> node IDs corrected; hi-fi node clarified as not yet designed. **Updated:**
> 2026-08-01 (rev 2) — **Ported the power features from `01a-jira-plan.md` /
> `01b-confluence-plan.md`**: derived `figma/_index.json`, `figma-helper`
> subagent + thin `/figma` router, per-file grouping manifest, 24h staleness,
> designer/alias list, remote-node discovery, and a code-side write-back (Code
> Connect) engine. See §0.3 + §3, §5, §8. **Updated:** 2026-08-02 (rev 3) —
> folded in Code Connect template-file direction (parser EOL 2026-08-17),
> semantic>global token preference, Figma↔code naming asymmetry, Design
> Handshake/a11y gate, and DTCG/Style Dictionary token-drift; **new
> research-driven artifacts split into companion plan
> `my-plans/02b-figma-lumen-plan.md`**. **Supersedes:**
> `docs/lumen-figma-plan.md` (reverses de-identification; adds local-copy Figma
> mirror — see §0) **Sibling plans:** `my-plans/01a-jira-plan.md` ·
> `my-plans/01b-confluence-plan.md` · `my-plans/02b-figma-lumen-plan.md`

---

## 0. What changed from the previous plan (`docs/lumen-figma-plan.md`)

The prior plan is thorough and its **Lumen adoption** half is essentially
correct — carried forward almost verbatim. What changes is the
**Figma-ingestion** half, to match the two user reversals plus
separation-of-concerns and multi-folder generation, so this track mirrors Plan
1's model exactly.

| #      | Prior plan decided                                                                                                  | **This plan decides**                                                                                                                                                                                      | Why                                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | **De-identify** Figma labels/sample data before landing anything in git/manifest ("de-identify before landing").    | **No de-identification.** Store Figma exports **verbatim**.                                                                                                                                                | Same reasoning as Plan 1: private, org-only repo; names already in Confluence/Figma. The de-id step added cost and drift for no real gain.                                                                      |
| **R2** | Figma ingested **on demand**, manifest stores only pointers (fileKey/node/version); content pulled fresh each time. | Figma nodes are **mirrored to a local `figma/` folder** as `.svg` / `.png` / `.md` / `.mmd`, synced by a manifest with **version/timestamp comparison** — exactly like `confluence/` and `jira/`.          | A local copy makes design drift **inspectable in git**: a re-exported PNG/SVG shows as a real diff, and the extracted `.md` structure diffs cleanly. Reconciliation becomes deterministic instead of a re-pull. |
| **R3** | Ingest commands enrich `specs/*` directly (Pipeline A/B write spec sections).                                       | **Separation of concerns:** ingest commands write **only** the `figma/` folder + manifest. Spec generation/reconciliation reads that folder.                                                               | Matches Plan 1 R3. `/create-specifications` and `/reconcile-requirements` are the only writers of `specs/`.                                                                                                     |
| **R4** | n/a                                                                                                                 | `figma/` is one of the folders `/create-specifications raw-requirements/req.md confluence jira figma` consumes.                                                                                            | Matches Plan 1 R4.                                                                                                                                                                                              |
| **R5** | Pipeline C gated behind Dev seat (previously unavailable).                                                          | **Dev seat confirmed** on PPCC Enterprise plan — all Pipeline C tools (`get_design_context`, `get_variable_defs`, `download_assets`) are fully operational. Pipeline C is **no longer gated or deferred**. | MCP connection verified: `seat: "Dev"` on `organization::938225424961209890`.                                                                                                                                   |

**Everything else from the prior plan is retained**: Lumen replaces DaisyUI,
Tailwind stays for layout, HTML-wireframe pipeline removed, three Figma
pipelines priced by cost/seat, node-scoped + depth-capped + lazy fetch,
system-first hi-fi codegen with a visual-diff gate, Code Connect as later
polish, `.mcp.json` creation, `LumenProvider` at the app root, verified seeded
nodes.

The one deletion vs prior plan: **remove the "Sensitive-data guard (mode C) —
de-identify" row** from the constraints table and the "de-identified labels
only" notes on the manifest entries (R1).

---

## 0.1 Confirmed Figma MCP capabilities (verified 2026-08-01)

| Capability                | Tool                                                                                 | Status       | Notes                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------- |
| View seat — structure     | `get_metadata`                                                                       | ✅ Confirmed | Node `299:12006` returned full layer tree                                                            |
| View seat — screenshots   | `get_screenshot`                                                                     | ✅ Confirmed | Returns PNG render URL; short-lived                                                                  |
| Dev seat — design context | `get_design_context`                                                                 | ✅ Confirmed | Returns code + asset URLs; output is very large for big nodes — use depth caps + child-node drilling |
| Dev seat — design tokens  | `get_variable_defs`                                                                  | ✅ Confirmed | Returns full PPCC token map (colors, spacing, typography, shadows)                                   |
| Dev seat — asset export   | `download_assets`                                                                    | Available    | Not yet tested against this file; confirmed tool present                                             |
| Code Connect (read)       | `get_code_connect_map`, `get_code_connect_suggestions`                               | ✅ Available | Powers the code-side write-back engine (§8)                                                          |
| Code Connect (write)      | `add_code_connect_map`, `send_code_connect_mappings`                                 | ✅ Available | Human-gated mapping push (§8)                                                                        |
| Diagram generation        | `generate_diagram`                                                                   | ✅ Available | MCP server present                                                                                   |
| Lumen MCP                 | `list-lumen-components`, `get-lumen-component-documentation`, `get-lumen-css-tokens` | ✅ Available | Present in MCP roster                                                                                |

**Account**: `qaiser.abbas@ppcc.com.au` · **Seat**: Dev · **Plan**: PPCC
Enterprise

---

## 0.2 Seeded node IDs

> **Node IDs in Figma URLs use hyphens (`node-id=299-12006`) but the MCP API
> requires colons (`299:12006`).** All commands and manifest entries MUST use
> the colon form.

| Slug                   | Node ID (colon form) | Status                           | Pipeline | Description                                                                                                                                                                                                                                                                                            |
| ---------------------- | -------------------- | -------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mid-fi-e2e-flow`      | `299:12006`          | ✅ Confirmed exists              | A + B    | "Mid-fi end-to-end flow" section — large multi-frame canvas                                                                                                                                                                                                                                            |
| `entity-onboarding-v2` | TBD                  | ⏳ Not yet designed              | C        | The **real** hi-fi screens — not yet created by the designer. The Phase-5 production run is deferred until the designer delivers this node.                                                                                                                                                            |
| `hifi-fixture-login`   | (fixture — own file) | 🧪 Throwaway scaffold (Option B) | C        | A small, disposable hi-fi **fixture** authored in its **own new Figma file** to exercise the whole Pipeline C pipeline **now**, before the real node exists. Kept clearly separate from `entity-onboarding-v2`; **deleted** once the real node lands. Built in Phase 4 (see §4.6 + the phase-4 brief). |

**When the hi-fi node is ready**: The designer will share a Figma URL like
`https://www.figma.com/design/2MbwX0rxNA1uhgDwlC7Z6G/...?node-id=XXX-YYYY`.
Convert `XXX-YYYY` → `XXX:YYYY`, add it to the manifest scope, and proceed with
Phase 5. Until then, the **real** Phase 5 run is deferred — no blocker on Phases
0–4.

> **The deferral is content-driven, not a seat gate (Dev seat is confirmed —
> D7/R5).** Because the only thing missing is a hi-fi node in the mirror — not
> any Pipeline C capability — the whole Pipeline C pipeline (token-mapping →
> system-first Lumen composition → visual-diff gate → handshake gate →
> token-drift → Code Connect → visual-regression) can be validated **now**
> against a throwaway **hi-fi fixture** (`hifi-fixture-login`,
> `handshakeStatus: not-required`) authored in its own file. The fixture
> **proves the machinery**; it does **not** satisfy the Phase 5 exit criterion
> of a **real** hi-fi screen built and visual-diff-approved. See §4.6 (codegen),
> §11 Phase 5, and the `my-plans/02-phases/phase-4-*` brief for the
> step-by-step. Delete the fixture when the real node arrives.

---

## 0.3 What this revision ports from the JIRA/Confluence plans (the power features)

The mirror model in this plan was already correct; what it lacked were the
**usability and feature-rich** layers that make `01a`/`01b` feel like a live
system rather than a file dump. This revision adds each, adapted to Figma's
realities (design is **designer-owned** — so the "write-back" direction is
code-side Code Connect + component sync, **not** editing the designer's file):

| #        | Ported feature                                                                                                                       | Figma adaptation                                                                                                                                                                                         | Section    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **FN1**  | **Derived global index** (`figma/_index.json`)                                                                                       | Regenerable rollup of nodes: title, pipeline, page, frame tree, component inventory, token refs, hashes, which Lumen component each maps to.                                                             | §3.3       |
| **FN2**  | **`figma/_designers.json`** — **projection of the shared `.claude/config/people.json`**                                              | Local-only aliases (`sarah → s.designer`); "who designed / owns this node".                                                                                                                              | §3.4, §3.6 |
| **FN11** | **`_index.json` is `.gitignore`d** (derived, per-sync churn); `/figma reindex` strictly offline, never touches `lastSyncedAt`        | §3.5, §6.1                                                                                                                                                                                               |
| **FN12** | **Shared identity** — one repo-level `.claude/config/people.json`; `_designers.json` demoted to a projection (reverses the deferral) | §3.6                                                                                                                                                                                                     |
| **FN3**  | **`figma-helper` subagent + thin `/figma` router** for NL queries                                                                    | "which screens aren't built yet", "what changed since I last synced", "find the login frame", "which Lumen components does the hi-fi flow use"                                                           | §5         |
| **FN4**  | **24-hour staleness check** on any `/figma` query                                                                                    | Anchored on `_index.json.lastSyncedAt`; offers a sync.                                                                                                                                                   | §5.4       |
| **FN5**  | **Per-file grouping manifest** (`figma/files/{fileKey}.json`)                                                                        | The Figma analogue of the per-epic / per-space manifest: file-level node roster + `nodeTreeHash` for **remote-node discovery**.                                                                          | §3.2       |
| **FN6**  | **Remote-node discovery + empty-mirror preview** in `/sync-figma`                                                                    | Detects frames added in the file that aren't mirrored; if `figma/` is empty, previews the node tree that would be added.                                                                                 | §4.2       |
| **FN7**  | **`/figma pull <fileKey\|node>`** — node + descendants, structured                                                                   | One structured pull of a frame and its child frames into the mirror + per-file manifest.                                                                                                                 | §4.3       |
| **FN8**  | **`/figma-init`** — first-time setup, or drift report                                                                                | Confirms fileKey/scope, seeds `_designers.json`, previews the node tree; drift report if already initialized.                                                                                            | §4.1       |
| **FN9**  | **Code-side write-back engine** (Code Connect + component sync)                                                                      | The safe, human-gated "reverse" direction: publish `apps/web/src/components/` ↔ Figma component **mappings** (Code Connect), and a **build-status** back-annotation — never edits the designer's canvas. | §8         |
| **FN10** | **Build-coverage map + gap analysis**                                                                                                | "which mirrored frames have a corresponding Lumen screen/component, and which don't" — the design-to-code analogue of JIRA gap analysis.                                                                 | §7         |

---

## 1. The model in one picture

```
  REMOTE (system of record)          LOCAL MIRROR (git-tracked)                 DERIVED (regenerable)
  ┌────────────────────────┐         ┌───────────────────────────┐             ┌────────────────────┐
  │ Figma file             │ ingest  │ figma/files/<key>.json(tree)│  roll-up   │ figma/_index.json  │
  │  2MbwX0rxNA1uhgDwlC7Z6G│────────▶│ figma/nodes/<slug>.png      │────────────▶│ (nodes, pipelines, │
  │  node 299:12006 (mid)  │(export) │ figma/nodes/<slug>.svg      │             │  frame tree, comp  │
  │  node TBD (hi-fi)      │         │ figma/nodes/<slug>.flow.mmd │             │  inventory, →Lumen │
  │                        │         │ figma/nodes/<slug>.md       │  read (gen) │  build coverage)   │
  │                        │         │ figma/nodes/<slug>.tokens…  │────────────▶├────────────────────┤
  │                        │         │ figma/nodes/<slug>.meta.json│             │ specs/ (flows,     │
  │                        │         │ figma/_designers.json (PROJ)│  code       │  structure)        │
  │                        │  Code   │ figma/.manifest.json        │────────────▶│ apps/web/src/      │
  │  Code Connect mappings │◀Connect─│ figma/assets/<node>/…       │             │  components (Lumen)│
  └────────────────────────┘ (gated) └───────────────────────────┘             └────────────────────┘
            ▲ code-side write-back (mappings + build status only)     visual-diff gate: Playwright ⟷ .png
            │
  /figma "<natural language>" ─► figma-helper ─► reads _index.json (+ drills to .md / screenshot)
```

Same shape as Plan 1: **ingest ≠ generate ≠ reconcile ≠ codegen ≠ (code-side)
write-back.** Each is its own command. **Four state layers, each with one
owner** (mirroring JIRA/Confluence):

| Layer                             | File(s)                                                                                                              | Authoritative for            | Written by                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------- |
| **Sync state**                    | `figma/.manifest.json` + per-node `.meta.json`                                                                       | status/hashes/versions       | sync                                              |
| **Per-file tree**                 | `figma/files/{fileKey}.json`                                                                                         | node hierarchy roster        | `/figma pull`, `/sync-figma`                      |
| **Global index** (DERIVED)        | `figma/_index.json` (**`.gitignore`d** — §3.5)                                                                       | node rollup + build coverage | **regenerated** each sync                         |
| **Identity** (SHARED / PROJECTED) | `.claude/config/people.json` (hand-owned, committed) → `figma/_designers.json` (**`.gitignore`d** projection — §3.6) | designer names ↔ aliases     | humans edit `people.json`; projection regenerated |

---

## 2. On-disk layout (the Figma local mirror)

```
figma/
├── .manifest.json                      # domain manifest: one entry per mirrored node
├── manifest.schema.json                # JSON Schema: manifest + per-node meta + per-file manifest + _index
├── _index.json                         # DERIVED global index (regenerable rollup — §3.3) — .gitignore'd (§3.5)
├── _designers.json                     # projection of shared .claude/config/people.json (§3.6) — .gitignore'd (§3.5)
├── files/
│   └── 2MbwX0rxNA1uhgDwlC7Z6G.json     # per-file manifest: node tree + roster + nodeTreeHash (§3.2)
├── nodes/
│   ├── mid-fi-e2e-flow.png             # exported render (Pipeline B — node 299:12006)
│   ├── mid-fi-e2e-flow.flow.mmd        # Mermaid flow distilled from the journey (Pipeline A)
│   ├── mid-fi-e2e-flow.md              # extracted structure: layer tree, text, component inventory
│   └── mid-fi-e2e-flow.meta.json       # sync metadata (fileKey/node/version/hashes/status)
│   # --- hi-fi files added here when designer delivers the node (Phase 5) ---
│   # entity-onboarding-v2.png / .svg / .md / .tokens.json / .meta.json  (Pipeline C — not yet available)
└── assets/
    └── 299_12006/hero.png              # raw images pulled from download_assets (rawImages[])
```

> **Alignment note.** The flat layout of rev 1 (`figma/<slug>.*`) is replaced by
> the **folder-by-type** layout (`files/ nodes/ assets/`) mirroring JIRA's
> `epics/ stories/…` and Confluence's `pages/ blogposts/…`. The `assets/`
> subfolder uses `<node>` with the colon replaced by `_` (`299_12006`) since `:`
> is illegal in path segments on some filesystems.

### 2.1 What each artifact is (Pipeline → files)

| Pipeline                 | MCP source                                                                     | Local files written                                                  | Seat                   | Status                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **A. Flows/journeys**    | `get_metadata` (+ `generate_diagram`)                                          | `nodes/<slug>.flow.mmd` (+ `.md` notes)                              | View ✅                | Fully testable now                                                                                                          |
| **B. Wireframes/mid-fi** | `get_metadata`, `get_screenshot`                                               | `nodes/<slug>.png`, `nodes/<slug>.md` (structure/inventory)          | View ✅                | Fully testable now                                                                                                          |
| **C. Hi-fi screens**     | `get_design_context`, `get_screenshot`, `get_variable_defs`, `download_assets` | `nodes/<slug>.png`, `.svg`, `.md`, `.tokens.json`, `assets/<node>/*` | **Dev ✅ (confirmed)** | Unblocked — **testable now** via the `hifi-fixture-login` fixture (§0.2); real-node run awaits the designer's hi-fi node ID |

> **Note on `get_design_context` output size**: Node `299:12006` produces ~930k
> characters. Use **child-node drilling** (call `get_metadata` first, pick a
> specific sub-frame ID, pass that to `get_design_context`) rather than calling
> it on the top-level section node. This avoids token overflow and matches the
> "depth-capped" discipline described in §6.

`get_figjam` only for genuine `/board/` URLs — the seeded link is `/design/`, so
use `get_metadata`/`get_screenshot`/`get_design_context` (carried from prior
§2.2 caveat).

### 2.2 `<slug>.meta.json`

```json
{
  "source": "figma",
  "fileKey": "2MbwX0rxNA1uhgDwlC7Z6G",
  "nodeId": "299:12006",
  "url": "https://www.figma.com/design/2MbwX0rxNA1uhgDwlC7Z6G/Future-State-Exploration?node-id=299-12006",
  "title": "Mid-fi end-to-end flow",
  "pipeline": "B",
  "page": "Future State Exploration",
  "designer": "s.designer",
  "remoteVersion": "figma:lastModified:2026-07-27T22:10:00Z",
  "renderHash": "sha256:…",
  "structureHash": "sha256:…",
  "localEditsHash": "sha256:…",
  "localSyncedAt": "2026-08-01T09:00:00.000Z",
  "status_sync": "clean",
  "buildStatus": "not-built",
  "seatRequired": "view"
}
```

> Node IDs in `.meta.json` and `.manifest.json` always use **colon form**
> (`299:12006`), never hyphens.

- `renderHash` — hash of the exported `.png`/`.svg` bytes → detects **visual**
  change.
- `structureHash` — hash of extracted `.md` structure → detects **structural**
  change (layers/text).
- `localEditsHash` — current on-disk hash of the `.md` → guards human edits
  (same as Plan 1).
- `status_sync` — renamed from `status` to match JIRA's naming (avoids clashing
  with a design/build status). ∈ `clean` | `render-ahead` | `structure-ahead` |
  `diverged` | `new` | `orphaned`.
- `buildStatus` — `not-built` | `partial` | `built` — feeds the build-coverage
  map (§7).

Splitting render vs structure hash lets the sync say _"pixels changed but
structure didn't"_ (a restyle → visual-diff gate re-run) vs _"structure
changed"_ (a layout change → likely a spec/epic reconcile).

---

## 3. Manifest, per-file grouping, derived index & designers

### 3.1 Domain manifest (`figma/.manifest.json`)

```json
{
  "domain": "figma",
  "fileKey": "2MbwX0rxNA1uhgDwlC7Z6G",
  "scope": { "nodes": ["299:12006"] },
  "note": "Hi-fi node to be added when designer delivers it (Phase 5)",
  "lastSyncStartedAt": "2026-08-01T09:00:00.000Z",
  "items": [
    {
      "nodeId": "299:12006",
      "file": "nodes/mid-fi-e2e-flow",
      "pipeline": "B",
      "remoteVersion": "2026-07-26T11:00:00Z",
      "renderHash": "sha256:…",
      "status_sync": "clean"
    }
  ]
}
```

> Once the user supplies the hi-fi node ID, add it to `scope.nodes` and create
> its item entry.

### 3.2 Per-file grouping manifest (`figma/files/{fileKey}.json`) — FN5

The Figma analogue of the per-epic (JIRA) / per-space (Confluence) manifest. A
file owns a node tree; this manifest captures the roster so a sync can detect
_"a frame was added/moved/updated in the file"_:

```json
{
  "source": "figma",
  "fileKey": "2MbwX0rxNA1uhgDwlC7Z6G",
  "fileName": "Future State Exploration",
  "pages": [
    {
      "id": "0:1",
      "name": "Future State Exploration",
      "frames": [
        {
          "id": "299:12006",
          "name": "Mid-fi end-to-end flow",
          "file": "figma/nodes/mid-fi-e2e-flow.md",
          "lastModified": "2026-07-27T22:10:00Z"
        }
      ]
    }
  ],
  "nodeTreeHash": "sha256:…",
  "remoteLastModified": "2026-07-27T22:10:00.000Z",
  "localSyncedAt": "2026-08-01T09:00:00.000Z"
}
```

`nodeTreeHash` hashes the sorted `(id, lastModified)` roster of mirrored-scope
frames; a mismatch on sync means a frame was added/moved/removed → drives the
**remote-node discovery** prompt (§4.2). The per-file manifest is authoritative
for the tree; `_index.json` mirrors it as a **derived** rollup.

### 3.3 Derived global index (`figma/_index.json`) — FN1

**Derived, regenerable, never hand-authored** — same discipline as
JIRA/Confluence. Rebuilt from the per-node `.meta.json` + `.md` + per-file
manifests on **every sync** (and on demand via `/figma reindex`). The per-node
sidecar wins any disagreement.

> **Two-timestamp staleness invariant (FN11).** The index carries two
> independent clocks that must never be conflated:
>
> - **`generatedAt`** — when the index rollup was last rebuilt. Updated by
>   **every** reindex, whether it followed a remote pull (online) or was a pure
>   offline recompute.
> - **`lastSyncedAt`** — when the mirror was last pulled from Figma. Updated by
>   a **pull and nothing else**. `/figma reindex` is **strictly offline** and
>   copies `lastSyncedAt` through **verbatim** — if an offline reindex bumped
>   it, a stale mirror would silently pass the 24h staleness check (§5.4).
>
> Because `_index.json` is regenerated on every sync and churns on
> `generatedAt`, it is **`.gitignore`d** (§3.5) and rebuilt locally rather than
> committed.

```json
{
  "generatedAt": "2026-08-01T09:00:05.000Z",
  "lastSyncedAt": "2026-08-01T09:00:00.000Z",
  "files": ["2MbwX0rxNA1uhgDwlC7Z6G"],
  "counts": { "nodes": 1, "built": 0, "not-built": 1 },
  "items": [
    {
      "nodeId": "299:12006",
      "slug": "mid-fi-e2e-flow",
      "pipeline": "B",
      "page": "Future State Exploration",
      "title": "Mid-fi end-to-end flow",
      "designer": "s.designer",
      "file": "figma/nodes/mid-fi-e2e-flow.md",
      "components": ["Button", "TextField", "Stepper", "Card"],
      "tokens": ["color/primary/default", "Foundation/Body"],
      "buildStatus": "not-built",
      "mapsTo": [],
      "summary": "Mid-fi walkthrough of entity onboarding: auth → details → netting eligibility → confirm."
    }
  ],
  "frameTree": {
    "299:12006": {
      "title": "Mid-fi end-to-end flow",
      "children": ["299:12100", "299:12200"]
    }
  },
  "componentUsage": { "Button": ["299:12006"], "Stepper": ["299:12006"] },
  "buildCoverage": { "built": [], "partial": [], "not-built": ["299:12006"] }
}
```

Each `items[]` entry is the one-line summary `figma-helper` loads to answer most
queries; it drills into the `.md` (structure) or requests a fresh
`get_screenshot` only when it needs pixels. `mapsTo` lists the Lumen
component(s)/route(s) that realize the node (populated from Code Connect + a
convention scan — §7).

### 3.4 `figma/_designers.json` — a projection of shared identity — FN2

**No longer hand-authored here.** This file is a **materialized projection** of
the shared repo-level `.claude/config/people.json` (§3.6), filtered to the
people with a `figma` handle. It is regenerated (and therefore **`.gitignore`d**
— §3.5), never edited directly; the `_projectionOf` pointer records its source.

```json
{
  "_projectionOf": ".claude/config/people.json",
  "designers": [
    {
      "figma": "s.designer",
      "displayName": "Sarah Designer",
      "aliases": ["sarah", "sd"]
    },
    {
      "figma": "abbasqa",
      "displayName": "Qaiser Abbas",
      "aliases": ["abbas", "qa"]
    }
  ],
  "unresolvedAliasPolicy": "ask"
}
```

A Figma contributor handle discovered on sync that has no match in `people.json`
surfaces as an **unresolved handle** (per `unresolvedAliasPolicy: "ask"`) —
prompting a `people.json` entry — rather than being silently appended to a
per-tool file that then drifts out of step with `jira` / `confluence`.

### 3.5 What is committed vs `.gitignore`d, and the concurrency posture — FN11

The mirror is a **remote cache**. State that a pull or reindex regenerates is
derived and stays out of git; only the hand-owned bodies and durable sync
bookkeeping are committed.

| Committed to git                                                                      | `.gitignore`d (regenerated locally)                          |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `.md` structure, `.flow.mmd`, `.png`/`.svg` renders, `assets/**` raw images           | `_index.json` (derived rollup; churns on `generatedAt`)      |
| `*.meta.json` per-node sidecars, per-file manifest (`files/*.json`), `.manifest.json` | `_designers.json` (projection of `people.json` — §3.4, §3.6) |
| `manifest.schema.json`, `.claude/config/people.json` (shared identity)                |                                                              |

**Concurrency posture.** Treat sync as **fast-forward on `main`**: pull,
rebase-forward, push. A machine-authored sidecar or index must **never be
hand-merged** — on a conflict, discard the local copy and **re-pull the affected
node(s)** so the sidecar/manifest is rebuilt from Figma, then reindex. The only
artifacts a human ever hand-merges are `.md` bodies and
`.claude/config/people.json`.

### 3.6 Shared identity — `.claude/config/people.json` — FN12

One repo-level roster is the **single source of truth for identity across all
three mirrors** (`jira`, `confluence`, `figma`). Each person is keyed by a
canonical `id`, carries `aliases[]`, and lists the per-tool handles. Agents read
this file directly. This **reverses** the earlier "defer the shared people file"
decision — the drift risk of three independent alias lists outweighs the setup
cost.

```json
{
  "people": [
    {
      "id": "s.designer",
      "displayName": "Sarah Designer",
      "aliases": ["sarah", "sd"],
      "jira": null,
      "confluence": "s.designer",
      "figma": "s.designer"
    },
    {
      "id": "abbasqa",
      "displayName": "Qaiser Abbas",
      "aliases": ["abbas", "qa"],
      "jira": "abbasqa",
      "confluence": "abbasqa",
      "figma": "abbasqa"
    }
  ],
  "unresolvedAliasPolicy": "ask"
}
```

An unresolved handle from any tool prompts a new `people.json` entry (or an
added handle on an existing entry) rather than a per-tool append. `people.json`
is committed and hand-merged; the projections are regenerated and `.gitignore`d.

### 3.7 Escalation (deferred)

Past a large multi-hundred-frame file, `_index.json` may strain a single context
load → a `scripts/figma-index.ts` can emit an `.ndjson`/SQLite search sidecar.
Deferred; JSON suffices at the seeded file's scale.

---

## 4. Commands (separation of concerns — R3)

### 4.1 `/figma-init` — first-time setup, or drift report — FN8

**Not initialized (fresh):**

1. Confirm **fileKey** (`2MbwX0rxNA1uhgDwlC7Z6G`), account seat, and initial
   scope (which nodes).
2. Scaffold `figma/` tree, `manifest.schema.json`, empty `.manifest.json`; seed
   the shared `.claude/config/people.json` from file contributors (or add
   `figma` handles to existing entries), then **project** it to
   `_designers.json`; empty `_index.json`. Both `_index.json` and
   `_designers.json` are `.gitignore`d (§3.5).
3. **Empty-mirror preview (FN6):** shallow `get_metadata` on the file → **show
   the page/frame tree that would be added** (name + child count +
   last-modified), then ask which frames to pull now (whole file scope / pick
   frames / none-yet). Nothing is written to node files until chosen.

**Already initialized (drift report):**

- Compare local ↔ remote **without writing**: report render-ahead /
  structure-ahead nodes, frames present in the file but missing locally (new),
  moved frames (parent page changed), `_designers.json` gaps, and orphaned local
  nodes (deleted remotely). Ends with a suggested next command.

### 4.2 Ingest / sync family (writes `figma/` + manifest ONLY)

| Command                                                    | Input          | Pipeline                | Writes                                                                   | Seat                                 |
| ---------------------------------------------------------- | -------------- | ----------------------- | ------------------------------------------------------------------------ | ------------------------------------ |
| `/add-figma-node <url\|fileKey+node> [--pipeline A\|B\|C]` | one node       | auto-detect or explicit | `figma/nodes/<slug>.*` + meta + manifest                                 | A/B: View · C: Dev ✅                |
| `/figma pull <fileKey\|node> [--descendants]`              | file or frame  | all                     | per-file manifest + node files + reindex                                 | **FN7 — see §4.3**                   |
| `/sync-figma [--pull] [--dry-run] [--force-pull <node>]`   | manifest scope | all                     | updated exports/structure + per-file manifest + `_index.json` + manifest | View (C nodes use Dev for structure) |

`/add-figma-node` is the **single-node mirror writer**; the pipeline decides
_which_ artifacts get written. It never writes specs (R3).

**`/sync-figma` enhancements (FN6):**

- **Remote-node discovery.** Any frame in the file matching scope but not
  mirrored is reported as `new` (name + page + last-modified) and the human is
  **asked whether to add it** — the design-side analogue of "epics/pages present
  in remote but not local".
- **Empty-/missing-mirror preview.** If `figma/nodes/` is empty, `/sync-figma`
  shows the same node tree `/figma-init` previews rather than silently doing
  nothing.
- **Moved-frame detection.** If a mirrored frame's page/parent changed, report
  the move; update the per-file tree on pull.

**Implementation note for `--pipeline C`**: Use `get_variable_defs` on the node
to write `<slug>.tokens.json`. For `get_design_context`, drill to a child frame
to stay under token limits.

### 4.3 `/figma pull <fileKey|node>` — node + descendants, structured — FN7

1. Fetch the target frame (or file) **and its child frames** via `get_metadata`
   (depth-capped).
2. Write/update `figma/files/{fileKey}.json` (per-file tree, §3.2).
3. Write each frame under `figma/nodes/…`
   (`.png`/`.svg`/`.md`/`.mmd`/`.tokens.json` per pipeline), assets under
   `figma/assets/<node>/`.
4. If the per-file manifest exists, **compute the tree diff** (added / moved /
   updated / removed frames) and **show it for approval before overwriting**.
5. Regenerate `_index.json` for the affected subtree.

`/figma pull` is a pure **read**; it never mutates the Figma file.

### 4.4 Generate (reads `figma/`, writes specs)

| Command                                   | Change                                                                                                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/create-specifications <file> <folder…>` | **R4:** `figma` is a valid folder arg. Reads `figma/nodes/*.md` (structure) + `*.flow.mmd` (flows) as design-requirement sources; seeds `specs/sources/manifest.json` with the Figma entries. Does not call any ingest command. |

**RTM Source column — MANDATORY (Figma → specs traceability).** Every business
requirement derived from a Figma node **MUST** record its originating mirror
file in the **Source** column of the RTM — `figma/nodes/<slug>.md` with the
`nodeId` in parentheses (e.g. `figma/nodes/mid-fi-e2e-flow.md (299:12006)`).
`/create-specifications` populates the column on first gen;
`/reconcile-requirements` (§4.5) updates it on every **structure** change
(render-only changes route to the visual-diff gate and do not alter the RTM). A
Figma node feeding no requirement is an **orphaned source**; a design-derived
requirement with no `figma/` source is an **untraced requirement** — both
flagged. Shares one `specs/sources/manifest.json` + one RTM with JIRA and
Confluence.

### 4.5 Reconcile (reads a changed Figma mirror file, updates specs/epics)

| Command                                                  | Behaviour                                                                                                                                                                                                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/reconcile-requirements figma/nodes/mid-fi-e2e-flow.md` | Uses the local `.md`/`.flow.mmd` diff as the delta signal → 6-phase drift engine updates specs/epics + traceability. A **structure** change reconciles specs; a **render-only** change routes to the visual-diff gate instead (no spec change). |
| `/reconcile-requirements <figma-url>`                    | Convenience: `/add-figma-node <url>` first, then reconcile.                                                                                                                                                                                     |

### 4.6 Codegen (reads hi-fi mirror, writes Lumen — the fidelity gate)

| Command                                                          | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/figma-to-lumen figma/nodes/<hi-fi-slug>.md [--node <node-id>]` | Pipeline C. **System-first:** compose existing Lumen components (Lumen MCP) mapping `<slug>.tokens.json` PPCC design tokens → Lumen tokens (`get-lumen-css-tokens`); create a new component only when Lumen lacks an equivalent (→ Storybook library). **Visual-diff gate:** Playwright screenshot of the built screen ⟷ `figma/nodes/<slug>.png`; human approves. On success, set the node's `buildStatus` and record `mapsTo` in the index (§7). Dev seat confirmed — no seat gate. **Validate the full pipeline now** against the throwaway `hifi-fixture-login` fixture (§0.2, `handshakeStatus: not-required`; built in Phase 4 — see the phase-4 brief); the **real** first run still awaits the designer's `entity-onboarding-v2` node. The fixture proves the machinery but does **not** satisfy the Phase 5 real-screen exit criterion (§11). |

**Token preference order:** When mapping Figma tokens to Lumen tokens, prefer
**semantic tokens** over global/primitive tokens; use global tokens only when no
semantic equivalent exists. The full token preference hierarchy and mapping
table are defined in `my-plans/02b-figma-lumen-plan.md` (D21).

**Design Handshake + Accessibility spec gate:** PPCC requires a formal Design
Handshake (squad designers + Lumen designers + platform reps) and an
Accessibility spec from the PPCC Accessibility team before a component is
finalized for engineering. `/figma-to-lumen` should respect this gate — the full
command/checklist is defined in `my-plans/02b-figma-lumen-plan.md`.

**DTCG / Style Dictionary token-drift detection:** A token-drift pipeline
(`get_variable_defs` → DTCG W3C format → Style Dictionary transform → compare vs
Lumen tokens) detects token divergence between Figma and the Lumen library.
Pipeline definition and hook are in `my-plans/02b-figma-lumen-plan.md`.

> **PPCC token map available**: `get_variable_defs` on node `299:12006` returned
> the full PPCC token set including `color/primary/default: #1e1e1e`,
> `color/tertiary/default: #faec20` (brand yellow),
> `color/surface/default: #ffffff`,
> `Foundation/Body: PPCC Beacon Sans Regular 16px`, spacing and border-radius
> tokens. These map directly to Lumen tokens via `get-lumen-css-tokens`.

---

## 5. The natural-language layer — `figma-helper` subagent + `/figma` router — FN3

> **Same decision as JIRA/Confluence:** a **subagent in the roster**, delegated
> to by a thin `/figma` command family — not a session-locking startup mode.
> `claude --agent figma-helper` remains an optional dedicated-session path.

### 5.1 `figma-helper` subagent (new roster entry)

**Purpose:** answer NL questions and perform analyses over the Figma mirror. On
invocation it:

1. Loads `figma/_index.json` + `figma/_designers.json`.
2. Checks `_index.json.lastSyncedAt` for the **24h staleness rule** (§5.4).
3. Resolves designer aliases (`sarah → s.designer`).
4. Answers from the index; drills into `.md` structure or requests a fresh
   `get_screenshot` only when pixels/detail are needed.
5. For **vague prompts, asks multi-choice clarifying questions**
   (`AskUserQuestion`) — e.g. "Which file/page?", "Flows only, or hi-fi screens
   too?".

**Tools:** read/query focused (Read, Grep, Glob, Figma MCP for live
drill-through when stale and the human opts to sync). Codegen and Code-Connect
write-back are delegated to §4.6 / §8, never done inline.

### 5.2 The `/figma` router command family

| Command                       | Intent                                                                                                            | Backed by                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `/figma "<natural language>"` | anything — router classifies                                                                                      | figma-helper, then codegen/§8 if it's an action |
| `/figma search <query>`       | local search over `_index.json` (title/component/token, + drill)                                                  | figma-helper                                    |
| `/figma tree [<node>]`        | frame hierarchy view (Mermaid)                                                                                    | figma-helper (§7)                               |
| `/figma who <alias>`          | nodes designed/owned by a person                                                                                  | figma-helper + `_designers.json`                |
| `/figma coverage`             | build-coverage map: built / partial / not-built frames                                                            | figma-helper (§7)                               |
| `/figma changed [<since>]`    | nodes render-/structure-ahead of the mirror                                                                       | figma-helper                                    |
| `/figma uses <ComponentName>` | which frames use a given component                                                                                | figma-helper (`componentUsage`)                 |
| `/figma reindex`              | rebuild `_index.json` from meta + per-file manifests — **offline; copies `lastSyncedAt` through verbatim** (§6.1) | deterministic rollup                            |
| `/figma pull <fileKey\|node>` | node + descendants pull                                                                                           | §4.3                                            |

### 5.3 Worked examples

| Human prompt                                           | Router →   | How it's answered                                                                               |
| ------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------- |
| "Which screens haven't been built in Lumen yet?"       | coverage   | `_index.json.buildCoverage.not-built` → titles + node IDs.                                      |
| "What changed in the mid-fi flow since I last synced?" | changed    | Compare live `get_metadata`/`lastModified` vs mirror hashes; classify render-only vs structure. |
| "Find the netting-eligibility frame."                  | search     | Match over `items[]` titles/summaries; drill `.md`; offer a screenshot.                         |
| "Show the frame tree under the mid-fi flow."           | tree       | Emit Mermaid from `_index.json.frameTree` rooted at the node.                                   |
| "What did sarah design in this file?"                  | who        | Resolve `sarah → s.designer`; filter `designer`.                                                |
| "Which frames use the Stepper component?"              | uses       | `componentUsage["Stepper"]`.                                                                    |
| "Which specs does the mid-fi flow feed?"               | trace      | Reverse-lookup `specs/sources/manifest.json` for the node ID.                                   |
| "Build the confirm screen from the hi-fi node."        | codegen    | Route to `/figma-to-lumen` (§4.6) — system-first + visual-diff gate.                            |
| "Map our Button component to its Figma component."     | write-back | Route to §8 Code Connect mapping — dry-run → approve → push mapping.                            |

### 5.4 24-hour staleness check — FN4

Any `/figma` query first reads `_index.json.lastSyncedAt`:

- If **> 24h old**: _"The Figma mirror was last synced 3 days ago. Designs may
  have moved on. Sync now? [Sync & answer / Answer from mirror anyway /
  Cancel]"_.
- Declining answers from the mirror **with a one-line staleness banner**.
- Any successful `/sync-figma --pull` or `/figma pull` refreshes `lastSyncedAt`
  — the single defined "what counts as a sync" timestamp.

---

## 6. Sync algorithm (mirrors Plan 1, adapted to Figma's version model)

Figma has no per-node version integer like Confluence, so the cheap
change-signal is `get_metadata` (layer tree) + file `lastModified`, compared by
**hash**, not just timestamp:

```
1. Read figma/.manifest.json → scope nodes + figma/files/<key>.json → known roster.
2. Shallow file-level get_metadata → diff roster vs per-file manifest:
     frame in file, not in manifest → new (remote-node discovery, §4.2)
     frame in manifest, not in file → orphaned
     frame moved page/parent        → moved
3. For each in-scope node: get_metadata (depth-capped) → hash the tree.
     tree hash == structureHash AND file lastModified unchanged → clean (skip)
     else → candidate-changed
4. For candidate-changed nodes only:
     re-export render (get_screenshot / download_assets) → compare renderHash → render-ahead
     re-extract structure (get_metadata full / get_design_context for C) → structureHash → structure-ahead
     guard: localEditsHash != structureHash on the .md → diverged (flag; --force-pull to override)
5. Write changed .png/.svg/.md/.tokens.json + refresh meta + per-file manifest + manifest.
   Regenerate _index.json. Print change report.
6. NEVER touch specs/ or apps/web/ — that's /reconcile-requirements and /figma-to-lumen.
```

Because renders are on disk, a re-export produces a **real binary diff in git**
(and the `.md` structure a text diff) — the whole point of R2 for design assets.
`--dry-run` default; `--pull` applies; `--force-pull <node>` overrides a
diverged guard.

**Output size discipline**: For Pipeline C nodes, always drill to a specific
child frame first via `get_metadata`; never call `get_design_context` on a
section-level node directly. The hi-fi node's children should each be under
~100k characters.

### 6.1 `/figma reindex` is strictly offline (the timestamp invariant) — FN11

`/figma reindex` recomputes the derived `_index.json` from what is **already on
disk** — the per-node `.meta.json`, `.md`, and per-file manifests. It performs
**no Figma reads**. Concretely it:

- **updates** `generatedAt` to now and refreshes the rollup fields (`counts`,
  `frameTree`, `componentUsage`, `buildCoverage`, `items[]`);
- **copies `lastSyncedAt` through verbatim** from the prior index — a reindex is
  not a pull, so it must not advance the mirror-freshness clock, or a stale
  mirror would silently pass the 24h check (§5.4);
- treats the per-node sidecar as authoritative on any disagreement (the index
  never invents state).

Only a real pull (`/sync-figma --pull`, `/figma pull`) advances `lastSyncedAt`.
This two-clock split (`generatedAt` = rebuild time, `lastSyncedAt` = pull time)
is the same invariant enforced in `01a` (D16) and `01b` (CD14).

---

## 7. Build-coverage map, frame-tree mapping & search — FN10 / FN12

- **`/figma coverage`** renders the design-to-code gap: for every mirrored
  frame, `built` / `partial` / `not-built` from `_index.json.buildCoverage`,
  plus its `mapsTo` Lumen target(s). This is the design analogue of JIRA gap
  analysis — _"what has the designer produced that we haven't built yet, and
  vice-versa"_.
  - `buildStatus`/`mapsTo` are populated two ways: (a) **Code Connect** mappings
    pulled via `get_code_connect_map` (authoritative), and (b) a **convention
    scan** of `apps/web/src/` for a component/route whose name matches the frame
    slug (heuristic, flagged as inferred).
- **`/figma tree [<node>]`** emits a **Mermaid** graph from
  `_index.json.frameTree`, following `@.claude/standards/mermaid-standards.md`.
- **`/figma search`** / **`/figma uses`** are index-native over `items[]` /
  `componentUsage`, drilling into `.md` or a screenshot for top hits. No
  external index at the seeded file's scale (§3.5).

> **Naming asymmetry — name matching must go through a glossary.** Figma
> component names and Lumen code names diverge in PPCC (e.g. Figma
> `TopNavigationBars` maps to code `DefaultTopAppBarScaffold`). A raw slug/name
> match in the convention scan (used to populate `mapsTo` and `buildCoverage`)
> is therefore **unreliable on its own** and will miss matches. Name matching
> MUST be routed through the **name-mapping glossary** defined in
> `my-plans/02b-figma-lumen-plan.md`. See D22 in §13.

---

## 8. Code-side write-back engine (Code Connect + build-status — human-gated) — FN9

> **The critical Figma asymmetry:** in JIRA/Confluence the write-back edits the
> **system of record**. In Figma the system of record is the **designer's
> canvas** — AI must **never** edit it. So the "reverse" direction here is
> strictly **code-side**: publishing **Code Connect mappings**
> (`apps/web/src/components/*` ↔ Figma components) and back-annotating **build
> status**, so the designer's Dev Mode shows "this component is built here". The
> canvas itself is untouched.

> **IMPORTANT — Code Connect parser EOL (2026-08-17).** The framework-specific
> React parser (and all other framework parsers) reach end-of-support on
> 2026-08-17. The engine in §8.1–8.3 **MUST use template-file Code Connect**
> (framework-agnostic, fully maintained) — NOT the React parser path. Full
> template-file approach, prop-mapping conventions, and the
> `add_code_connect_map` / `send_code_connect_mappings` call shapes for template
> files are defined in companion plan `my-plans/02b-figma-lumen-plan.md`. See
> also D20 in §13.

Same shared pipeline shape as JIRA/Confluence (dry-run → approve → apply →
reconcile), three entry points, adapted:

```
  ENTRY                                     SHARED ENGINE
  A: one component ↔ Figma node mapping ─┐   1. DIFF / DRAFT  (A: single mapping · B: suggest-all unmapped · C: batch over a subtree)
  B: "suggest mappings for this file"   ─┤   2. DRY-RUN PLAN  (show each proposed mapping; nothing pushed yet)
  C: batch over a page/subtree          ─┘   3. APPROVE        (human; per-mapping)
                                             4. RE-CHECK       (get_code_connect_map — skip mappings that already exist / conflict)
                                             5. PUSH           (add_code_connect_map / send_code_connect_mappings — mappings only)
                                             6. RE-PULL        (get_code_connect_map → authoritative mapping set)
                                             7. RECONCILE      (write mapsTo + buildStatus into meta + _index.json)
                                             8. SUGGEST        (offer /figma coverage refresh; never auto-run reconcile — R3)
```

### 8.1 Feature A — map one component (`/figma-map-component <ComponentPath> <node-id>`)

Propose a single Code Connect mapping; dry-run shows the component ↔ node pair;
on approval push via `add_code_connect_map`; record `mapsTo` +
`buildStatus:"built"` in the index.

### 8.2 Feature B — suggest mappings for a file (`/figma-suggest-mappings [<fileKey>]`)

Uses `get_code_connect_suggestions` to propose mappings for unmapped
components/nodes; human reviews the list; approved subset pushed via
`send_code_connect_mappings`.

### 8.3 Feature C — batch map a subtree (`/figma-map-subtree <node>`)

B batched over a frame subtree, with bulk guards: per-mapping approval, skip
already-mapped nodes, run-manifest `figma/.map-runs/<run_id>.json`, one
consolidated `/figma coverage` refresh.

### 8.4 Deliberately declined (reasoning preserved)

| Idea                                                           | Why declined                                                                                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **AI edits the designer's Figma canvas**                       | The canvas is designer-owned; editing it would overwrite intentional design work. Write-back is code-side only.                                                    |
| **Auto-create Code Connect mappings without approval**         | A wrong mapping misleads the designer's Dev Mode → always dry-run + per-mapping approval.                                                                          |
| **Auto-run `/reconcile-requirements` after codegen**           | Violates R3 → suggest only.                                                                                                                                        |
| **Pushing generated components back into Figma as components** | Round-tripping code→design is lossy and fights the designer's system → declined; use `generate_figma_design`/`use_figma` only on explicit, separate human request. |
| **Framework-specific React parser for Code Connect**           | EOL 2026-08-17; template-file Code Connect is the only maintained path (D20).                                                                                      |

---

## 9. Lumen adoption (carried forward from prior plan — unchanged except no de-id)

Retained in full from `docs/lumen-figma-plan.md` §2.1, §4.1–4.3, Phases 0–2:

- **DaisyUI removed, not layered.** Flip the "UI Library" critical constraint to
  **Lumen** in both `CLAUDE.md` files; remove `"daisyui"` dep from
  `apps/web/package.json` and `@plugin 'daisyui';` from `globals.css` (Tailwind
  v4 CSS-first — no `tailwind.config.*`). **Keep Tailwind** for layout.
- **HTML wireframe pipeline removed** — `.claude/wireframes/`,
  `/wireframes-to-components`, `/wireframes-to-storybook`, and
  wireframe-precedence rules; the functional-spec template's "Wireframe" column
  → **Figma-node reference** (pointing at `figma/nodes/<slug>` mirror files).
- **`design-tokens.md`** re-sourced from Lumen (`get-lumen-css-tokens`); sever
  wireframe-command auto-augmentation.
- **`LumenProvider`** wraps the app root (Phase 0 prerequisite).
- **`.mcp.json`** created at repo root registering **Figma + Lumen** (+
  consolidate CEB/Context7/Playwright).
- **`.claude/patterns/figma-to-lumen-pattern.md`** — canonical: node-scoped +
  depth-capped fetch, persisted-output discipline, **local-mirror-first** (read
  `figma/nodes/<slug>.*`, don't re-pull), Figma-token→Lumen-token mapping
  (`get_variable_defs` output → `get-lumen-css-tokens` mapping), system-first
  composition, visual-diff gate, `/board/`-only `get_figjam`, Dev-seat now
  confirmed.
- **Discovery sweep** first: `grep -rli daisyui .`, `grep -rli wireframe .` →
  authoritative removal list before edits.
- Build `apps/web/src/components/` on Lumen from scratch (directory is empty —
  greenfield, not a migration).

The one deletion vs prior plan: **remove the "Sensitive-data guard (mode C) —
de-identify" row** from the constraints table and the "de-identified labels
only" notes on the manifest entries (R1).

---

## 10. Critical review — gaps, flaws & fixes (updated)

Local-copy for **binary design assets** raises issues text mirrors don't.
Addressed:

| Gap / flaw                                             | Consequence                                                                                          | Fix                                                                                                                                                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Binary PNG/SVG diffs are opaque in git**             | "What changed" isn't readable from the diff text                                                     | Pair each render with the extracted **`.md` structure** + split **renderHash vs structureHash**; the `.md` diff is human-readable, the hashes classify the change.                     |
| **Figma has no clean per-node version number**         | Timestamp-only is unreliable                                                                         | Use `get_metadata` **tree hash** + file `lastModified` as the cheap change-signal before any expensive export/`get_design_context`.                                                    |
| **Repo bloat from committed PNGs**                     | Large binaries in git history                                                                        | Keep renders **node-scoped + one export per node** (not full-file); prefer SVG where the layer is vector; document a size budget; optionally Git LFS for `figma/**/*.png` if it grows. |
| **Ingest writing specs** (violates R3)                 | Surprise spec churn on every re-export                                                               | Hard separation: `/add-figma-node`/`/sync-figma`/`/figma pull` write only `figma/`; `/reconcile-requirements` is the only path to specs.                                               |
| **Render-only restyle triggers a full spec reconcile** | Wasted reconciliation on cosmetic change                                                             | Route **render-only** changes to the visual-diff gate; only **structure** changes reach `/reconcile-requirements`.                                                                     |
| **Hi-fi node / large section ~930k chars**             | Token blow-up on `get_design_context`                                                                | **Drill to child frame first**: `get_metadata` → pick a sub-frame → `get_design_context` on that child. Never on a top-level section node.                                             |
| ~~**Dev-seat gate on `get_design_context`**~~          | ~~Pipeline C blocked~~                                                                               | **Resolved** — Dev seat confirmed. All Pipeline C tools operational.                                                                                                                   |
| **Node ID format mismatch**                            | Commands fail silently with wrong IDs                                                                | MCP API requires **colon form** (`299:12006`); URLs use hyphens. All manifests/commands/patterns use colon form.                                                                       |
| **Third-source-of-truth drift** (tree in 3 files)      | Roster metadata diverges                                                                             | `_index.json` **derived/regenerable** (§3.3); per-node `.meta.json` authoritative; `_designers.json` a projection (§3.4).                                                              |
| **Undefined "what counts as a sync"**                  | Staleness has no anchor                                                                              | `_index.json.lastSyncedAt`, refreshed by any successful pull (§5.4).                                                                                                                   |
| **Remote frame added by designer undetected**          | Missed screen                                                                                        | Per-file `nodeTreeHash` mismatch → remote-node discovery (§4.2); adding is one confirmation.                                                                                           |
| **AI could clobber the designer's canvas**             | Destroys intentional design                                                                          | Write-back is **code-side only** (Code Connect mappings + build status); canvas edits declined (§8.4).                                                                                 |
| **`/figma reindex` advances the staleness clock**      | An offline recompute masks a stale mirror → 24h check never fires                                    | Reindex is **strictly offline**: bumps `generatedAt`, **copies `lastSyncedAt` through verbatim**; only a pull advances it (§6.1).                                                      |
| **Committed derived index churns / merge-conflicts**   | `_index.json` regenerates every sync (new `generatedAt`) → constant machine-JSON diffs and conflicts | `_index.json` (and the `_designers.json` projection) are **`.gitignore`d** and rebuilt locally; only bodies + sidecars + `people.json` are committed (§3.5).                           |
| **Concurrent syncs clobber sidecars / renders**        | Two machines pull → conflicting `.meta.json` / binary renders that can't be hand-merged              | **Fast-forward on `main`**; never hand-merge a machine sidecar/index/binary — discard local and **re-pull the affected node** so it rebuilds from Figma, then reindex (§3.5).          |
| **Per-tool alias files drift**                         | Same person, inconsistent alias sets across tools                                                    | Single shared `.claude/config/people.json`; agents read it directly — an unresolved handle prompts a `people.json` entry, never a per-tool append (§3.6).                              |

**Recommended cadence:** `/sync-figma --dry-run` → review render/structure
change report → `--pull` changed nodes (commit the mirror diff) →
`/reconcile-requirements` only for **structure** changes → `/figma-to-lumen` +
visual-diff gate for hi-fi screens → `/figma coverage` to see the gap → optional
`/figma-suggest-mappings` to publish Code Connect. Keep mirror-sync and
spec-reconcile as separate commits (R3).

---

## 11. Phased delivery (updated — power features + Pipeline C unblocked)

| Phase                                         | Scope                                                                                                                                                                                                                                                                                                                                                                                     | Seat                 | Exit criteria                                                                                                                                                                                                                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0 — Discovery + foundation**                | grep sweep; create `.mcp.json` (Figma+Lumen); install Lumen + `LumenProvider`; manifest schema (domain + per-node meta + **per-file manifest** + **`_index.json`** + **`_designers.json`** + shared **`.claude/config/people.json`**); `.gitignore` `figma/_index.json` + `figma/_designers.json`; hash util. **No de-id (R1).**                                                          | View                 | `.mcp.json` present; Lumen renders; schemas checked in; `.gitignore` excludes the derived index + designer projection.                                                                                                                                                |
| **1 — Remove DaisyUI + HTML wireframes**      | Execute removal list; rewrite UI standards/protocol/themes to Lumen; flip constraint in both `CLAUDE.md`.                                                                                                                                                                                                                                                                                 | —                    | `grep -ri daisyui/wireframe` only intentional; build/lint/type-check green.                                                                                                                                                                                           |
| **2 — Lumen component library**               | Build `apps/web/src/components/` on Lumen + Storybook + a11y.                                                                                                                                                                                                                                                                                                                             | View                 | Library Lumen-based; a11y + component tests pass.                                                                                                                                                                                                                     |
| **3 — Figma mirror + init (Pipelines A & B)** | `/figma-init` (fresh + drift + empty-mirror preview), `/add-figma-node`, `/figma pull`, `/sync-figma` (hash diff, **remote-node discovery**, moved-frame detection); mirror `299:12006` verbatim; per-file manifest.                                                                                                                                                                      | View                 | `figma/nodes/mid-fi-e2e-flow.*` mirrored; re-export shows a git diff; per-file manifest + manifest correct; a new file frame prompts add.                                                                                                                             |
| **3b — Index + NL query layer**               | `figma-helper` subagent + `/figma` router (`search`, `tree`, `who`, `coverage`, `changed`, `uses`, `reindex`); seed shared `people.json` + **project** `_designers.json`; derived `_index.json`; alias resolution; **24h staleness**; **offline reindex** (copies `lastSyncedAt` verbatim).                                                                                               | View                 | All §5.3 example prompts answered from `_index.json`; vague prompts trigger clarification; stale mirror prompts a sync; `/figma reindex` bumps `generatedAt` but **leaves `lastSyncedAt` untouched**; an unresolved contributor handle prompts a `people.json` entry. |
| **4 — Generate + reconcile**                  | `figma` folder wired into `/create-specifications` (R4); `/reconcile-requirements figma/…`; RTM Source column.                                                                                                                                                                                                                                                                            | View                 | Multi-folder gen consumes `figma/`; structure edit + reconcile updates traced epics + RTM Source.                                                                                                                                                                     |
| **5 — Hi-fi → Lumen (Pipeline C)**            | `/figma-to-lumen` system-first + visual-diff gate; mirror + generate hi-fi node once designer delivers it. `get_variable_defs` → PPCC token map → Lumen mapping. Sets `buildStatus`/`mapsTo`. The pipeline itself is validated earlier in Phase 4 against the `hifi-fixture-login` fixture (§0.2, §4.6) — that fixture proves the machinery but **does not** satisfy this exit criterion. | **Dev ✅ (no gate)** | ≥1 **real** hi-fi screen (the designer's `entity-onboarding-v2`, **not** the fixture) in Lumen, visual-diff approved; `/figma coverage` reflects it as built.                                                                                                         |
| **5b — Code-side write-back**                 | Code Connect engine (§8): `/figma-map-component`, `/figma-suggest-mappings`, `/figma-map-subtree`; build-coverage map from Code Connect + convention scan.                                                                                                                                                                                                                                | Dev                  | A component maps to its node (dry-run → approve → push); `/figma coverage` shows built vs not-built accurately.                                                                                                                                                       |
| **6 — Docs**                                  | **Produce `docs/FIGMA-OPERATING-GUIDE.md`** (see §12) + cadence/token/cost notes.                                                                                                                                                                                                                                                                                                         | —                    | Guide lets a designer/dev mirror a node → query it → produce a Lumen screen → publish a mapping.                                                                                                                                                                      |

---

## 12. MANDATORY final deliverable — `docs/FIGMA-OPERATING-GUIDE.md`

> **After implementing the Figma features (Phase 6), create
> `docs/FIGMA-OPERATING-GUIDE.md`.** It is the human's single reference for
> operating the Figma↔Lumen integration. It MUST cover:

1. **Overview** — the four state layers (§1), the three pipelines (A/B/C), and
   the ingest ≠ generate ≠ reconcile ≠ codegen ≠ code-side-write-back rule.
2. **The `figma-helper` agent** — what it does, what it loads (`_index.json` +
   `_designers.json`), when it drills into `.md`/screenshots, optional
   `claude --agent figma-helper` session.
3. **Every command** — one row each (what it does, inputs, what it writes,
   whether it mutates anything remote). Group: init/ingest (`/figma-init`,
   `/add-figma-node`, `/figma pull`), sync/index (`/sync-figma`,
   `/figma reindex`), query (`/figma`, `search`, `tree`, `who`, `coverage`,
   `changed`, `uses`), codegen (`/figma-to-lumen`), write-back
   (`/figma-map-component`, `/figma-suggest-mappings`, `/figma-map-subtree`).
4. **Aliases & identity** — the shared `.claude/config/people.json` (canonical
   id + per-tool handles), `_designers.json` as its regenerated `.gitignore`d
   projection, and how an unresolved handle prompts a `people.json` entry — the
   one place JIRA/Confluence/Figma aliases stay consistent.
5. **Staleness & the timestamp invariant** — the 24h rule, what "counts as a
   sync" (only a pull advances `lastSyncedAt`), why `/figma reindex` is offline
   and never resets that clock, and why the derived `_index.json` +
   `_designers.json` projection are `.gitignore`d (regenerated, not committed).
6. **Node-ID convention** — colon form in the API, hyphens only in URLs; the
   URL→API conversion.
7. **Scenarios & examples** — walk the §5.3 prompts end-to-end, plus full
   "mirror a node → build a Lumen screen with the visual-diff gate",
   "coverage/gap analysis", and "publish a Code Connect mapping" walkthroughs,
   and the recommended cadence.
8. **Write-back safety** — code-side only, canvas never edited, dry-run +
   per-mapping approval.
9. **Cross-references** — point to `docs/JIRA-OPERATING-GUIDE.md` +
   `docs/CONFLUENCE-OPERATING-GUIDE.md` for the shared `specs/`, RTM, and
   sync-cadence story, so all three guides read as one system.

---

## 12.1 Companion plan — `02b`

`my-plans/02b-figma-lumen-plan.md` holds the **new research-driven artifacts**
that are additive to this plan. They depend on the mirror/index foundation
established in §§1–8 and do not change anything above; they extend it.

| Artifact                                         | One-line description                                                                                                                                                                                                                   |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name-mapping glossary**                        | Bidirectional Figma component name ↔ Lumen code name table (e.g. `TopNavigationBars` ↔ `DefaultTopAppBarScaffold`); used by the convention scan in §7 and by Code Connect template authoring.                                          |
| **Design Handshake + a11y-spec gate command**    | Command + checklist enforcing the PPCC Design Handshake (squad + Lumen + platform reps) and Accessibility spec sign-off before a hi-fi node proceeds to `/figma-to-lumen` codegen.                                                     |
| **DTCG / Style Dictionary token-drift pipeline** | Script + hook: `get_variable_defs` → DTCG W3C token format → Style Dictionary transform → diff against Lumen tokens; surfaces drift before it reaches production.                                                                      |
| **Template-file Code Connect**                   | Full template-file approach for the Code Connect engine in §8; prop-mapping conventions, `add_code_connect_map`/`send_code_connect_mappings` call shapes, and the migration path away from the EOL React parser (deadline 2026-08-17). |
| **Design-QA / visual-regression hooks**          | CI hooks and Playwright-based visual-regression fixtures for the visual-diff gate in §4.6/§5, integrated with the build-coverage map in §7.                                                                                            |

> `02b` is **additive and non-breaking**: nothing in this plan (02) needs to be
> retracted or renumbered to accommodate it. Implement `02b` artifacts after the
> Phase 3–5b foundation is stable.

---

## 13. Decision log (this plan)

- **D1** Figma nodes mirrored locally as
  `.png`/`.svg`/`.md`/`.mmd`/`.tokens.json` + manifest (R2).
- **D2** No de-identification (R1).
- **D3** Ingest/sync, generate, reconcile, codegen, code-side write-back are
  separate command families (R3); `figma` is a `/create-specifications` folder
  (R4).
- **D4** Change detection = `get_metadata` tree-hash + `lastModified`, split
  into renderHash/structureHash; guards human edits via localEditsHash.
- **D5** Lumen replaces DaisyUI, Tailwind kept, HTML wireframes removed (carried
  from prior plan).
- **D6** System-first hi-fi codegen with Playwright↔local-render visual-diff
  gate; local mirror decouples codegen from live Dev-seat access.
- **D7** Dev seat confirmed — Pipeline C fully operational; no deferral.
- **D8** Node IDs use **colon form** everywhere except URLs.
- **D9** `get_design_context` never called on large section-level nodes directly
  — drill to a child frame first.
- **D10** Hi-fi screens not yet designed — the **real** Phase 5 run is deferred
  until the designer delivers the node. **The deferral is content-driven, not a
  seat gate (Dev seat confirmed — D7/R5).** To validate the whole Pipeline C
  pipeline before the real node exists, Phase 4 authors a throwaway **hi-fi
  fixture** (`hifi-fixture-login`, its own Figma file,
  `handshakeStatus: not-required`, deletable) and runs `/figma-to-lumen` + the
  visual-diff gate against it (§0.2, §4.6, phase-4 brief). The fixture **proves
  the machinery**; it does **not** satisfy the Phase 5 exit criterion, which
  still requires the designer's real `entity-onboarding-v2` node (§11).
- **D11** Folder-by-type layout (`files/ nodes/ assets/`); hybrid
  render+`.md`+`.meta.json` per node (FN adoption).
- **D12** `_index.json` derived/regenerable; per-node `.meta.json`
  authoritative; `_designers.json` a **projection** of shared `people.json`
  (FN1/FN2; superseded on identity by D18).
- **D13** `figma-helper` subagent + thin `/figma` router; startup mode optional
  (FN3); 24h staleness on `lastSyncedAt` (FN4).
- **D14** Per-file manifest + `nodeTreeHash` for remote-node discovery
  (FN5/FN6); `/figma pull` structured node+descendants (FN7); `/figma-init`
  fresh+drift (FN8).
- **D15** Write-back is **code-side only** — Code Connect mappings +
  build-status; the designer's canvas is never edited (FN9, §8.4).
- **D16** Build-coverage/gap map from Code Connect + convention scan (FN10);
  shares one `specs/sources/manifest.json` + RTM with JIRA/Confluence.
- **D17** Final deliverable: `docs/FIGMA-OPERATING-GUIDE.md`, cross-referencing
  the JIRA + Confluence guides (§12).
- **D18** **Shared identity** — one repo-level `.claude/config/people.json`
  (canonical `id` + per-tool handles) is the single source of truth across all
  three mirrors; `_designers.json` is demoted to a **regenerated, `.gitignore`d
  projection** (§3.4, §3.6). Reverses the earlier "defer the shared people file"
  deferral (was noted alongside D12). Unresolved handles prompt a `people.json`
  entry, never a per-tool append.
- **D19** **Gitignore the derived index + offline reindex** — `_index.json` (and
  the `_designers.json` projection) are `.gitignore`d and rebuilt locally
  (churn/conflict-prone machine JSON); `/figma reindex` is **strictly offline**,
  updating `generatedAt` only and **copying `lastSyncedAt` through verbatim**
  (the two-timestamp staleness invariant, §3.3/§6.1). Concurrency posture:
  fast-forward on `main`, re-pull the affected node after a conflict, never
  hand-merge a machine sidecar/index/binary (§3.5).
- **D20** **Template-file Code Connect (parser EOL 2026-08-17)** — All
  framework-specific Code Connect parsers (including the React parser) reach
  end-of-support on 2026-08-17. The §8 engine MUST use **template-file Code
  Connect** (framework-agnostic, maintained path) rather than any parser-based
  approach. Full specification in `02b`. This supersedes any implicit "React
  parser" assumption in §8.1–8.3.
- **D21** **Semantic tokens preferred over global/primitive tokens** — When
  mapping Figma design tokens to Lumen tokens in §4.6 codegen, semantic tokens
  take priority; global/primitive tokens are a fallback when no semantic
  equivalent exists. Token mapping table and preference hierarchy are in `02b`.
- **D22** **Name-mapping glossary required for convention scan** — Figma
  component names and Lumen code names diverge in PPCC (e.g. `TopNavigationBars`
  ↔ `DefaultTopAppBarScaffold`). The §7 convention scan MUST route name matches
  through the name-mapping glossary in `02b`; raw slug matching alone will
  produce false negatives in `buildCoverage` and `mapsTo`.
- **D23** **Companion plan split** — New research-driven artifacts (name-mapping
  glossary, Design Handshake + a11y-spec gate, DTCG/Style Dictionary token-drift
  pipeline, template-file Code Connect, design-QA/visual-regression hooks) are
  placed in `my-plans/02b-figma-lumen-plan.md` rather than expanding this plan
  (§12.1). `02b` is additive; it depends on the mirror/index foundation here and
  does not alter any existing section.

> **Cross-plan coordination.** D18/D19 mirror the same two decisions in the
> sibling plans and **must land together**: `01a`'s **D16** (gitignore derived
> index / offline reindex / concurrency) + **D17** (shared `people.json`), and
> `01b`'s **CD13** (shared identity), **CD14** (gitignore index + offline
> reindex), and **CD15** (concurrency posture). All three mirrors share one
> `.claude/config/people.json` and one gitignore/reindex discipline; changing
> one without the others reintroduces alias drift and the two-timestamp
> staleness hole.

## 14. Recommended first step

Phases 0–2 (no seat gate) remove the biggest framework drift; then Phase 3
mirrors node `299:12006` on the View seat and runs `/figma-init` +
`/figma pull 299:12006 --descendants` to validate the export/hash/meta shape,
the **per-file manifest**, and the derived **`_index.json`** on real content
before wiring the NL layer and generation. The Pipeline C pipeline
(`/figma-to-lumen` + visual-diff gate) can be validated in **Phase 4** against
the throwaway `hifi-fixture-login` fixture (§4.6, D10) without waiting for the
designer. Phase 5 (hi-fi → Lumen, the **real** run) and 5b (Code Connect
write-back) then start naturally when the designer delivers the hi-fi node.
