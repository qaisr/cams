---
description: >
  Full-file, multi-node reconciliation of the local Figma mirror against remote Figma. Runs a cheap
  shallow `get_metadata` roster diff over the in-scope file(s), classifies each node's `status_sync`
  via the split render/structure/localEdits hashes, re-exports + re-extracts ONLY the candidate-changed
  nodes, discovers new / orphaned / moved frames, and regenerates `_index.json`. Default run is
  DRY-RUN — nothing is written until `--pull`. Never touches `specs/` or `apps/web/` (R3); never
  clobbers a hand-edited body; only a real `--pull` moves `lastSyncedAt`. Twin of `/jira-sync`.
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# /figma-sync — full-file reconciliation

## Input

`$ARGUMENTS` — `[--pull] [--dry-run] [--force-pull <node>]`

- **no flags → dry-run**: print the `status_sync` table + discovery findings and STOP. Nothing written.
- `--dry-run`: explicit form of the default.
- `--pull`: apply — re-export/re-extract the candidate-changed nodes, write changed artifacts +
  sidecars + per-file manifests, regenerate `_index.json`, move `lastSyncedAt`.
- `--force-pull <node>`: override the `diverged` guard for ONE node, after a confirmation showing the
  render/structure/local delta. Implies `--pull` for that node only.

Node ids follow the mirror's **colon** convention on disk (`299:12006`); a `/design/…?node-id=299-12006`
URL's hyphen form is normalized to a colon (guide §6).

## What this writes (only on `--pull`; plan 02 §6 step 5)

| Path | When |
|---|---|
| `figma/nodes/{slug}.png` / `.svg` / `.md` / `.tokens.json` | each candidate-changed node re-exported/re-extracted |
| `figma/nodes/{slug}.meta.json` | refreshed render/structure/localEdits hashes per changed node |
| `figma/files/{fileKey}.json` | per-file frame roster + recomputed `nodeTreeHash` |
| `figma/.manifest.json` | scope block + per-node pointers; orphan removals |
| `figma/_index.json` | regenerated at the end (derived; gitignored) |
| `figma/_designers.json` | reprojected from `people.json` (Figma-bearing people only) |
| `.claude/config/people.json` | append newly-seen designer handles (`aliases: []`) |

**Never** writes `specs/` or `apps/web/`.

## Contract (reuse existing router paths + `scripts/figma/*` — do NOT re-implement)

Config — `.claude/config/figma-sync.config.yml`: `fileKey`, `fileName`, `seat`, `stalenessHours`,
`unresolvedAliasPolicy`, `maxDesignContextChars`.

Hashing — `scripts/figma/hash.ts`: the render/structure/localEdits hash helpers (the same functions
`/figma pull` uses when it writes a meta sidecar). Recompute `localEditsHash` from the on-disk `.md`
with the same helper the converter uses, or a hand edit will read as a false negative.

Reindex — `scripts/figma/reindex.ts`, invoked via `/figma reindex` (offline rollup).

Figma MCP tools (Claude invokes directly; auth brokered by the session — no secrets):
- shallow roster scan → `mcp__figma__get_metadata` (depth-capped) per in-scope file.
- per-node tree hash → `mcp__figma__get_metadata` on the node (depth-capped).
- candidate-changed re-export → `mcp__figma__get_screenshot` / `mcp__figma__download_assets`
  (render) and `mcp__figma__get_metadata` full / `mcp__figma__get_design_context` +
  `mcp__figma__get_variable_defs` (structure, Pipeline C), per the node's pipeline.

**Reuse, don't duplicate:**
- The per-node/subtree pull + tree-diff-before-overwrite + do-not-clobber gate **is exactly `/figma
  pull <node> [--descendants]`** (figma.md §4.3). When sync needs to pull a changed or new node,
  **delegate to that path** — do not re-write the roster diff or the clobber guard.
- The offline rollup **is `/figma reindex`** — run it (Step 5) rather than re-implementing the index
  shape.

## Process (plan 02 §6)

### Step 1 — Preconditions

1. Require `figma/.manifest.json`. If absent → tell the user to run `/figma-init` and STOP.
2. Read `figma/_index.json` for `lastSyncedAt`. Load `figma-sync.config.yml` (`fileKey`, `seat`,
   `stalenessHours`).
3. **Seat check.** If any in-scope node uses Pipeline C (hi-fi) and `config.seat` is not `dev`, note
   that structure re-extraction for those nodes needs a Dev seat; scan and report them but do not
   attempt `get_design_context` without the seat.

### Step 2 — Shallow file-level roster diff (bodies NOT re-exported)

For each in-scope file, call `get_metadata` (depth-capped) and diff the frame roster against the
per-file manifest `figma/files/{fileKey}.json` (plan 02 §6 step 2):

```
frame in file, not in manifest → new       (remote-node discovery, §4.2)
frame in manifest, not in file → orphaned
frame moved page/parent        → moved
```

Compare the file's `nodeTreeHash` to the stored value to short-circuit an unchanged file. No
per-node re-export in this step.

### Step 3 — Per-node classification (plan 02 §6 steps 3–4)

For each in-scope node, `get_metadata` (depth-capped) → hash the tree:

```
tree hash == meta.structureHash AND file lastModified unchanged                      → clean (skip)
else → candidate-changed, then:
  renderHash(re-export)   != meta.renderHash    (and not hand-edited)                → render-ahead
  structureHash(re-extract) != meta.structureHash (and not hand-edited)              → structure-ahead
  both of the above                                                                  → (both flagged)
  localEditsHash(on-disk .md) != meta.structureHash-basis (body hand-edited)         → diverged (flag)
  frame not previously mirrored                                                      → new
  frame gone from file                                                               → orphaned
```

Only `clean` nodes are skipped from re-export (token discipline). `diverged` is withheld — never
auto-pulled.

### Step 4 — Discovery findings

- **New-node discovery (§4.2).** Frames present in the file but not the manifest → list
  `{ node, name, page }` and offer to add (via `AskUserQuestion`). On accept, route to
  `/figma pull <node>` (which applies its own diff + clobber gates).
- **Moved frames.** Report page/parent moves; a move alone is a manifest-pointer refresh, not a
  re-export, unless the tree hash also changed.

### Step 5 — Apply (only on `--pull`)

- For each `render-ahead | structure-ahead | new` node, **delegate to `/figma pull <node>`** — it
  re-exports/re-extracts per the node's pipeline, writes `.png/.svg/.md/.tokens.json`, refreshes the
  meta sidecar and per-file manifest (recomputed `nodeTreeHash`), and appends newly-seen designers to
  `people.json`. A freshly-pulled node's meta has `renderHash`/`structureHash` matching disk and
  `status_sync: "clean"`.
- `diverged` nodes are **withheld** — they move only when named by `--force-pull <node>`, and then
  only after a confirmed render/structure/local delta.
- Then run `/figma reindex` (Step 6). On dry-run, skip all writes.

### Step 6 — Reindex + timestamps

Run `/figma reindex` to regenerate `figma/_index.json` (`counts`, `items[]`, `frameTree`,
`componentUsage`, `buildCoverage`, `mapsTo`, `by*` buckets) and reproject `figma/_designers.json`.
Set `generatedAt = now`.

- On `--pull`: **move `lastSyncedAt = now`** (a real remote re-export happened).
- On dry-run: **do NOT move `lastSyncedAt`** (two-timestamp invariant — plan 02 §6.1 / FN11).

`/figma reindex` itself always carries `lastSyncedAt` through verbatim; the `--pull` advance is
written into the meta/per-file manifests by the pull path in Step 5, which the reindex then rolls up.

### Step 7 — Report

Print:
1. A status table — `node · name · status_sync · page`.
2. A git-style summary line —
   `N render-ahead · N structure-ahead · N diverged · N new · N moved · N orphaned · N clean`.
3. Discovery findings — new frames; moved frames.
4. On `--pull`: nodes written + any withheld for divergence. On dry-run: the pending list.

On a dry-run, end with the exact command to apply, e.g. `/figma-sync --pull`.

## Guardrails

- **Default dry-run.** Nothing is written until `--pull`.
- **Never clobber a hand-edited body** — `diverged` is withheld; only `--force-pull <node>` + a
  confirmed delta overrides, one node at a time.
- **Token discipline** — shallow `get_metadata` roster scan first; re-export/re-extract only
  candidate-changed nodes; never re-pull `clean`. For Pipeline C, drill to a child sub-frame before
  `get_design_context` (never a ~930k-char section node); honour `maxDesignContextChars`.
- **Real binary diff** — because renders live on disk, a re-export is a real git diff (R2).
- **Never touch `specs/` or `apps/web/`** (R3). Codegen and Code Connect write-back are Phase 4 — a
  sync may *note* a changed mirror feeds a spec/build, but must not run `/reconcile-requirements` or
  `/figma-to-lumen`.
- **Timestamp invariant** — only a real `--pull` moves `lastSyncedAt`; reindex and dry-run never do.
- **Reuse the router paths** — node pulls delegate to `/figma pull`; the rollup delegates to
  `/figma reindex`. No duplicated pull/write/index logic.
- **Figma MCP tools are called ONLY inside the `/figma*` family** — never during
  specs/epics/implement/add-*/CI.
- **No secrets** — the MCP session brokers auth; `fileKey` is the pinned config value.

## Cross-references

- Router + `/figma pull` / `/figma reindex` detail: `.claude/commands/figma.md` (§4.3, §6.1)
- Config: `.claude/config/figma-sync.config.yml`
- Helpers: `scripts/figma/hash.ts` · `scripts/figma/reindex.ts`
- Operating guide: `docs/FIGMA-OPERATING-GUIDE.md` (§3 sync/index, §5 staleness invariant)
- Proven twin: `.claude/commands/jira-sync.md`
