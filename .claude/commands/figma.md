---
description: >
  Single entry point for the Figma mirror. Classifies a natural-language prompt and delegates to the
  `figma-helper` subagent (read/analyze) or, for sync/ingest, hands off to the ingest commands
  (`/figma pull`, `/figma-sync`, `/add-figma-node`) with their diff + approval gates. Also exposes
  explicit sub-verbs: search / tree / who / coverage / changed / uses / reindex / pull. Every query
  first applies the 24-hour staleness check against `_index.json.lastSyncedAt`. Figma MCP tools are
  called ONLY inside this `/figma*` command family — never during specs/epics/implement/add-*/CI.
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: medium
---

# /figma — router

## Input

`$ARGUMENTS` — either a bare natural-language prompt (`/figma "what frames has abbas designed?"`)
or a sub-verb form from the table below.

## Preconditions (every invocation)

1. Require the mirror to be initialized (`figma/.manifest.json` present). If not → tell the user to
   run `/figma-init` and STOP.
2. Require `figma/_index.json` (derived + gitignored). If missing → tell the user to run
   `/figma reindex` (offline rollup) and STOP. Do not fabricate an answer from a missing index.
3. **Staleness check (§5.4).** Read `_index.json.lastSyncedAt`. If older than `stalenessHours` (24h,
   from `.claude/config/figma-sync.config.yml`) — or `null` (never pulled) — offer, via
   `AskUserQuestion`: *"The Figma mirror was last synced {when}. Results may be stale. Sync now?"* →
   **[Sync & answer / Answer from mirror anyway / Cancel]**. If the user answers from the mirror
   anyway, prepend a one-line staleness banner to the result. A pull/sync is the only thing that
   moves `lastSyncedAt`; `/figma reindex` does not.

## Routing table (§5.2)

| Form | Intent | Delegates to |
|---|---|---|
| `/figma "<natural language>"` | classify intent | `figma-helper`; then an ingest command if the intent is sync/ingest |
| `/figma search <query>` | local search over `_index.json.items[]` (+ drill into `<slug>.md`) | `figma-helper` |
| `/figma tree [<node>]` | frame hierarchy → Mermaid | `figma-helper` (§8) |
| `/figma who <alias>` | one designer's frames | `figma-helper` + `_designers.json` |
| `/figma coverage` | design→code built/partial/not-built map + `mapsTo`, names resolved through the Figma↔Lumen glossary, with `handshakeStatus` surfaced (`built (⚠ handshake pending)` when the gate has not cleared) | `figma-helper` (§9) |
| `/figma changed [<since>]` | render-/structure-ahead / diverged nodes | `figma-helper` |
| `/figma uses <ComponentName>` | frames using a component (`componentUsage`) | `figma-helper` |
| `/figma reindex` | rebuild `_index.json` + `_designers.json` from sidecars + manifests (OFFLINE) | deterministic rollup (below) |
| `/figma pull <fileKey\|node> [--descendants]` | node/subtree pull | §4.3 (below) |

### Intent classification for the bare NL form

Delegate the prompt to `figma-helper` (its own subagent context loads `figma/_index.json` +
`figma/_designers.json`, resolves aliases, and asks multi-choice clarifying questions for vague
prompts). If the classified intent is a **sync/ingest** intent — "pull the latest for…", "sync the
mirror", "add this frame…" — the helper does **not** write. The router hands off to the correct
ingest command with its gates:

| Sync/ingest intent | Hand off to |
|---|---|
| pull a node/subtree fresh from Figma | `/figma pull <node> [--descendants]` (§4.3) |
| run drift detection / apply changes across the mirror | `/figma-sync [--pull] [--dry-run]` (§6) |
| add a brand-new frame to the mirror scope | `/add-figma-node <url\|fileKey+node> [--pipeline A\|B\|C]` |

**Codegen / Code Connect write-back are Phase 4**, not routed here. If the NL intent is
"turn this into a Lumen component" / "wire up Code Connect", the helper names it as Phase 4 and
stops — the router does not invent a codegen path.

Read-only intents (search, tree, who, coverage, changed, uses, "which designs aren't built…",
"who owns…") are answered by `figma-helper` from the index, drilling into individual `<slug>.md`
files or a fresh `get_screenshot` only when detail/pixels are needed.

## `/figma pull <fileKey|node> [--descendants]` (§4.3)

The **read** counterpart of the ingest family — pure read from Figma, never mutates remote Figma.

1. Resolve the target from `$ARGUMENTS` (a `/design/` URL → colon node id + fileKey; or a bare
   `fileKey`/`node`). `fileKey` defaults to the pinned value in `figma-sync.config.yml`.
2. **Output-size discipline.** `get_metadata` first (depth-capped); for a hi-fi frame, pick a child
   sub-frame before any `get_design_context` — never dump a ~930k-char top frame. `get_figjam` only
   for `/board/` URLs; the seeded link is `/design/`.
3. Per the node's **pipeline** (A/B/C from the meta sidecar / `--pipeline`), fetch and write its
   artifacts via `scripts/figma/*` helpers:
   - **A (Flows):** `get_metadata` (+ `generate_diagram`) → `<slug>.flow.mmd` (+ `.md` notes).
   - **B (Wireframes/mid-fi):** `get_metadata`, `get_screenshot` → `<slug>.png`, `<slug>.md`.
   - **C (Hi-fi):** `get_design_context`, `get_screenshot`, `get_variable_defs`, `download_assets`
     → `.png`, `.svg`, `.md`, `.tokens.json`, `assets/<node-underscore>/*` (Dev seat).
4. Write/update the per-file manifest `figma/files/{fileKey}.json` (frame roster + `nodeTreeHash`)
   and the meta sidecar (render/structure/localEdits hashes via `scripts/figma/hash.ts`).
5. **Tree diff before overwrite (§4.3/§6).** If the per-file manifest already exists, compute the
   roster diff (added / moved / updated / removed) and **show it for approval before overwriting**.
   For any node whose on-disk `localEditsHash` ≠ stored (hand-edited), do **not** clobber — mark
   `diverged` and report (`--force-pull` overrides, mirroring `/figma-sync`).
6. Append any newly-seen designer handle to `people.json` (additive, `aliases:[]`); reproject
   `_designers.json`.
7. **This is a real pull → update `lastSyncedAt`** (meta + per-file manifest) and regenerate
   `_index.json` for the affected subtree.
8. Report: node(s) written, roster changes, any items withheld for divergence.
9. **NEVER touch `specs/` or `apps/web/`.**

## `/figma reindex` (OFFLINE — §6.1)

Deterministic rollup, **no Figma reads**:

1. Read every meta sidecar (`figma/nodes/*.meta.json`) + per-file manifests
   (`figma/files/*.json`) + `.claude/config/people.json`.
2. Rebuild `figma/_index.json` (counts, `items[]`, `frameTree`, `componentUsage`, `buildCoverage`,
   `mapsTo`, `by*` buckets) and reproject `figma/_designers.json` from `people.json` (Figma-bearing
   people only, D8/FN12).
3. Set **`generatedAt` = now**; carry **`lastSyncedAt` through verbatim** from the file manifests
   (reindex is not a sync — two-timestamp invariant, D4/FN11). Per-node sidecar wins any
   disagreement; the index never invents state.
4. Run it via `node_modules/.bin/tsx scripts/figma/reindex.ts` (pass `--root .` — the REPO ROOT;
   the script appends `figma/` itself, so `--root figma` resolves to `figma/figma/` and fails with
   ENOENT. Inject the clock via `--now`/`FIGMA_REINDEX_NOW` only for tests). Report counts +
   `generatedAt`, and note `lastSyncedAt` is unchanged.

## Guardrails

- **Read vs write is enforced at the router.** `figma-helper` answers/analyzes only; every
  sync/ingest goes through an ingest command (`/figma pull`, `/figma-sync`, `/add-figma-node`) with
  its diff + approval + divergence gates.
- **`/figma pull` and `/figma-sync --pull` move `lastSyncedAt`; `/figma reindex` never does.**
- **Never clobber a hand-edited mirror body** on pull — divergent nodes are withheld and reported.
- **Codegen and Code Connect write-back are Phase 4** — never routed or performed here.
- **No `specs/` or `apps/web/` writes** — this phase is ingest/sync only (R3).
- **Figma MCP tools are called ONLY inside this `/figma*` family** — never during
  specs/epics/implement/add-*/CI.
- **No secrets** — the MCP session brokers auth; `fileKey` is the pinned config value.
