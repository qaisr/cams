---
description: >
  Scoped, multi-space reconciliation of the local Confluence citation-cache against remote. Runs a
  cheap version-only roster scan over the configured spaces, computes each page's `status_sync` via
  the `version.number` + dual-hash diff, fetches full bodies ONLY for `remote-ahead | new`, discovers
  new in-scope pages and per-space roster changes, offers per-orphan disposition, regenerates
  `_index.json`, and prints a change report. A thin wrapper: it delegates every body pull to
  `/confluence pull` and the rollup to `/confluence reindex` — it re-implements neither. Default run
  is DRY-RUN — nothing is written until `--pull`. Never touches `specs/` (R3); never auto-deletes an
  orphan; only a real `--pull` moves `lastSyncedAt`.
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# /confluence-sync — scoped reconciliation

> **Wrapper, not a new pipeline.** `/confluence pull` (router §"`/confluence pull`") is already the
> only verb that fetches bodies and advances `lastSyncedAt`, with its own scope-aware CQL,
> roster-diff-before-overwrite, and do-not-clobber gate. `/confluence reindex` is already the offline
> rollup. This command adds a **whole-scope, dry-run-first reconciliation loop across all configured
> spaces at once** on top of those verbs — it never fetches, writes, or indexes on its own. Twin of
> `/jira-sync`; its Confluence counterparts are the pull + reindex verbs on `.claude/commands/confluence.md`.

## Input

`$ARGUMENTS` — `[--pull] [--dry-run] [--force-pull <SPACE|pageId>] [--resume [<run_id>]]
[--max-batch-size <N>] [--batch-by subtree|chunk]`

- **no flags → dry-run**: print the status table + discovery findings and STOP. Nothing written.
- `--dry-run`: explicit form of the default. When batched mode would trigger (see § "Batched
  large-scale sync"), also prints the **planned batch table** (no tracker written, nothing spawned).
- `--pull`: apply — delegate to `/confluence pull` for each space/page with pending changes, then run
  `/confluence reindex`. This is what moves `lastSyncedAt`. **Auto-routes to batched mode** when the
  pending count exceeds `largeSyncThreshold` (§ "Batched large-scale sync").
- `--force-pull <SPACE|pageId>`: override the `diverged` / `local-ahead` do-not-clobber guard for ONE
  target, after a confirmation showing the on-disk vs remote body diff. Implies `--pull` for that
  target only, routed through `/confluence pull` (whose gate the force overrides for that one item).
- `--resume [<run_id>]`: resume the newest (or named) incomplete `.pull-runs/*.json` batched run.
  Implies `--pull`. See § "Batched large-scale sync" → Resume.
- `--max-batch-size <N>`: override `maxBatchPages` for this run only (no config write).
- `--batch-by subtree|chunk`: force the planner unit (default `subtree`); `chunk` forces flat
  chunking (to debug/test the fallback path).

## What this writes (only on `--pull`; all writes happen inside the delegated verbs)

| Path | When | Written by |
|---|---|---|
| `confluence/{pages,blogposts}/{SPACE}-{id}.md` + `.json` | each `remote-ahead` / `new` page pulled | `/confluence pull` |
| `confluence/spaces/{SPACE}.json` (roster + `treeHash`) | per-space roster refresh | `/confluence pull` |
| `confluence/attachments/{id}/` | when a pulled page has attachments | `/confluence pull` |
| `confluence/_index.json` | regenerated at the end (derived; gitignored) | `/confluence reindex` |
| `.claude/config/people.json` | append newly-seen authors/commenters (`aliases: []`) | `/confluence pull` |

**Never** writes `specs/`. **Never** mutates remote Confluence (this is the read counterpart).

## Contract (reuse Phase-3 scripts + existing router verbs — do NOT re-implement)

Connection + CQL builders — `scripts/confluence/mcp-client.ts`: `CONNECTION` (cloudId/site),
`spaceScopeCql(scope, sinceWindow)`, `pageByIdCql(pageId)`.

Transform — `scripts/confluence/converter.ts`: `convertItem(page, cfg, nowIso)`, `mdBody`.

Hashing — `scripts/confluence/hash.ts`: `hashBody`, `mdBody`, `hashTree`, `newestLastSynced`, `sha256`.

Offline rollup — `scripts/confluence/reindex.ts` (invoked via `/confluence reindex`).

Config — `.claude/config/confluence-sync.config.yml`: `cloudId`, `site`, `spaces[]` (each with optional
`labels[]` / `ancestors[]`), `pullComments`, `unresolvedAliasPolicy`, `stalenessHours`. The `sinceWindow`
for the roster CQL comes from config (default `30d`).

MCP tools (Claude invokes directly; auth brokered by the session — no secrets):
- cheap roster scan → `mcp__atlassian__searchConfluenceUsingCql`
  `{ cloudId, cql: spaceScopeCql(...), limit: 50, cursor? }`, following the cursor to completion.
- full body → **not called here** — the body fetch (`getConfluencePage` + optional comment fetch) is
  `/confluence pull`'s job; this command only reads `version.number` from the roster scan.

**Reuse, don't duplicate:**
- The full-body pull + roster-diff-before-overwrite + do-not-clobber gate for a space or page **is
  exactly `/confluence pull <SPACE|pageId>`** (router §"`/confluence pull`", Steps 1–7). When sync
  needs to pull, **delegate to that verb per target** — do not re-write the CQL, the roster diff, or
  the clobber guard.
- The offline rollup **is `/confluence reindex`** — run it (Step 6) rather than re-implementing the
  index shape or the two-timestamp invariant.

### Hashing note (critical — must match the converter)

`localEditsHash` for an on-disk page is `hashBody(mdBody(<on-disk .md>))` — the converter strips the
H1 title via `mdBody()` **before** `hashBody()`. When recomputing `localEditsHash` from disk to detect
a hand edit, apply `mdBody()` first, then `hashBody()`, or a title rename reads as a false local edit.
This is the same gate `/confluence pull` Step 4 applies; the sync classification must agree with it.

## Process

### Step 1 — Preconditions

1. Require `confluence/.manifest.json` with at least one item **or** a populated `confluence/spaces/`.
   If the mirror is un-initialized (no manifest), tell the user to run `/confluence pull <SPACE>` to
   seed it (there is no separate init verb — the first pull populates the cache) and STOP.
2. Read `confluence/_index.json` for `lastSyncedAt`. Load `confluence-sync.config.yml`
   (`cloudId`, `spaces[]`, `sinceWindow`, `stalenessHours`).
3. **Empty-mirror preview.** If no per-space manifests exist under `confluence/spaces/` and
   `.manifest.json` has an empty `items[]`, the cache is effectively empty. This is a first-population,
   not a reconciliation: route each configured space to `/confluence pull <SPACE>` (with the user's
   confirmation of which spaces to seed via `AskUserQuestion`), then STOP.

### Step 2 — Cheap remote roster scan (bodies NOT fetched)

For each space in `config.spaces[]`, build the scope-aware roster CQL via
`spaceScopeCql({ key, labels?, ancestors? }, sinceWindow)` (the same shape `/confluence pull` uses —
window-bounded, never unbounded). Page each query with the cursor to completion, requesting only the
cheap fields needed to classify — page `id`, `title`, `version.number`, `space`, and ancestry. Capture
per page `{ pageId, space, title, remoteVersion }`. **No `getConfluencePage` body fetch in this step.**

### Step 3 — Per-page diff (router "Diff algorithm — `status_sync`")

For every page in `union(remote-roster) ∪ mirrored-pages`, read the sidecar (if any), recompute
`localEditsHash = hashBody(mdBody(onDiskMd))`, and classify with `version.number` as the remote-change
signal (reliable, unlike `updated` timestamps):

```
remote.version.number > sidecar.version.number  AND  localEditsHash == sidecar.contentHash  → remote-ahead (pull)
remote.version.number > sidecar.version.number  AND  localEditsHash != sidecar.contentHash  → diverged     (flag)
remote.version.number == sidecar.version.number AND  localEditsHash != sidecar.contentHash  → local-ahead  (flag)
remote pageId NOT in mirror                                                                  → new          (offer pull)
mirrored pageId NOT in remote scope                                                          → orphaned     (disposition)
otherwise                                                                                    → clean        (skip)
```

`contentHash` is the sidecar's stored value (body as last written by the pull). A freshly-pulled page
is `clean` with `contentHash === localEditsHash` until a human edits it.

**Threshold check (routes Step 5).** After the diff, count the **pending** pages —
`pendingCount = |{ status_sync ∈ {remote-ahead, new} }|`. This is pure arithmetic on data already
fetched — **no extra MCP calls**. If `pendingCount > config.largeSyncThreshold` (default 15), Step 5
runs in **batched mode** (§ "Batched large-scale sync"); otherwise Step 5 is the existing
single-context flow. The threshold is on **pending** work, not raw roster size — a 44-page folder
where only 3 pages changed pulls those 3 inline, exactly as today.

### Step 4 — Discovery passes

- **New in-scope page discovery.** Any page surfaced by the roster scan with no sidecar under
  `confluence/{pages,blogposts}/` → list `{ pageId, space, title }` and offer to add (via
  `AskUserQuestion`). On accept: route to `/confluence pull <pageId>`.
- **Per-space roster discovery.** For each mirrored space, build the roster from the scan
  (`{ pageId, remoteVersion }`, sorted) and compute `hashTree(roster)`. Compare to the stored
  `treeHash` in `confluence/spaces/{SPACE}.json`. If different → list added / modified / removed pages
  and offer to pull the space (the `/confluence pull <SPACE>` path, which does the safe roster diff +
  clobber guard).

### Step 5 — Apply (only on `--pull`)

**If `pendingCount > largeSyncThreshold` (Step 3 threshold check), run the § "Batched large-scale
sync" orchestration loop instead of this single-context flow, then continue at Step 6.** Otherwise:

- For each space (or lone page) with `remote-ahead | new` items, **delegate to `/confluence pull
  <SPACE|pageId>`**. That verb fetches bodies for exactly those items, applies its
  roster-diff-before-overwrite + do-not-clobber gate, appends new authors to `people.json`
  additively, and refreshes the per-space `treeHash`. Do not fetch or write bodies here.
- `diverged` / `local-ahead` pages are **withheld** — `/confluence pull`'s Step-4 gate already refuses
  to clobber a hand-edited body. They move only when named by `--force-pull <SPACE|pageId>`, and then
  only after a confirmed on-disk vs remote diff, routed through `/confluence pull` for that one target.

### Step 6 — Reindex + timestamps

Run **`/confluence reindex`** (the offline rollup, `scripts/confluence/reindex.ts`) to regenerate
`_index.json` (`counts`, `items[]`, `tree{}`, `orphans[]`). Set `generatedAt = now`.

- On `--pull`: `lastSyncedAt` advances **inside the delegated `/confluence pull`** (written into each
  new/updated sidecar as `nowIso`; reindex then reads the newest via `newestLastSynced`). This command
  does not set `lastSyncedAt` itself.
- On dry-run: **nothing is written** — no `/confluence pull`, no reindex, no timestamp change
  (two-timestamp invariant).

### Step 7 — Orphan disposition

For each `orphaned` page (mirrored but gone from remote scope), ask per-orphan via `AskUserQuestion`:
- **archive** → move `.md` + `.json` to `confluence/_orphaned/{SPACE}-{id}.*`, drop the manifest entry;
- **delete** → remove the files + manifest entry;
- **keep & re-check** → leave in place for one cycle (may be a scope/visibility blip, or a page moved
  out of the configured `labels[]`/`ancestors[]` window).

**Never auto-delete.** Archived/deleted orphans are pruned from `_index.json.tree` + `items[]` and any
parent's `children[]` on the Step-6 reindex.

### Step 8 — Report

Print:
1. A status table — `pageId · SPACE · status_sync · title`.
2. A git-style summary line — `N remote-ahead · N local-ahead · N diverged · N new · N orphaned · N clean`.
3. Discovery findings — new in-scope pages; per-space roster add/modify/remove.
4. Orphan choices made (or, on dry-run, the pending list).
5. **Batched run summary (batched mode only).** When Step 5 ran batched: `run_id`, batch counts
   (`N done · N withheld · N failed` of `M`), the withheld-page list with the `--force-pull` hint,
   and any `failed` batches surfaced as needs-manual. On a batched **dry-run**, print the planned
   batch table instead (batch count, pageIds/batch, unit, est. subagent count) — see § "Batched
   large-scale sync" → Dry-run.

On a dry-run, end with the exact command to apply, e.g. `/confluence-sync --pull`. When batched mode
would trigger, the dry-run preview ends with:
`Run /confluence-sync --pull to execute this plan (one fresh subagent per batch, resumable).`

## Batched large-scale sync

> **Why this exists.** `/confluence-sync --pull` normally pulls every pending page inside **one**
> Claude context. On a large scope (the 44-page "EON Squad" folder) the accumulated bodies overflow
> the context window. Batched mode splits the pending set into bounded batches, persists a durable
> tracker, and spawns **one fresh subagent per batch** — each subagent's heavy body context is
> discarded on return, so this orchestrator's own context stays small. It is a wrapper over the
> existing verbs: the subagent still pulls via `/confluence pull`, and reindex still runs once at the
> end. No fetch / convert / diff / clobber / rollup logic is reinvented.

**Engages when** the Step-3 threshold check finds `pendingCount > config.largeSyncThreshold`
(default 15). Below threshold, Step 5's single-context flow runs unchanged.

### Batch planning

Run the pure planner `scripts/confluence/plan-batches.ts` (`planBatches(roster, { scopeAncestors,
maxBatchPages })`) over the **pending** pages only (`remote-ahead | new`):

- Batch **unit = subtree/ancestor branch**: each top-level branch under the configured
  `spaces[].ancestors[]` scope root becomes one `ancestor:<branchRoot>` batch carrying that branch's
  pending pages.
- **Chunk fallback**: any branch with more than `maxBatchPages` pages splits into stable
  `chunk:<branchRoot>-<n>` batches of ≤ `maxBatchPages` (one-pass guarantee — no emitted batch ever
  exceeds the cap, so no nested re-batching).
- Pages with no in-scope branch fall into a final `flat:<n>` chunk pass.
- `--max-batch-size <N>` overrides `maxBatchPages` for this run; `--batch-by chunk` forces flat
  chunking (debug/test the fallback).

The planner is pure/deterministic — a re-plan of an unchanged roster is byte-identical, which is what
makes resume safe.

### Tracker — `confluence/.pull-runs/<run_id>.json`

Sibling of the write-engines' `.push-runs/<run_id>.json` crash-safe run-manifest. Shape:

```json
{
  "run_id": "20260805T093000Z-confluence-pull",
  "verb": "confluence-sync --pull",
  "scope": { "spaces": [{ "key": "SEC", "ancestors": ["2083293743"] }], "pendingCount": 44 },
  "createdAt": "…", "startedAt": "…", "finishedAt": null,
  "planner": { "unit": "subtree", "maxBatchPages": 8 },
  "overallStatus": "in-progress",
  "batches": [
    { "batchId": "ancestor:2091234567", "unit": "ancestor", "branchRoot": "2091234567",
      "pageIds": ["2091234567", "2091234580"], "status": "done",
      "subagentSummary": { "pulled": 2, "withheld": 0, "failed": 0, "withheldKeys": [], "failedKeys": [], "finishedAt": "…" } },
    { "batchId": "chunk:2091235000-1", "unit": "chunk", "branchRoot": "2091235000",
      "pageIds": ["…≤8 ids…"], "status": "pending", "subagentSummary": null }
  ]
}
```

- Batch `status`: `pending | in-progress | done | withheld | failed`. A batch is **`withheld`** (not
  `done`) if ≥ 1 of its pages hit the do-not-clobber gate.
- `overallStatus`: `planned | in-progress | done | done-with-withholds | failed`.
- `subagentSummary` (counts + status keys only) is the **only** per-batch thing the orchestrator
  retains — never a body or diff.
- `.pull-runs/` is gitignored — transient run-state, reconstructable from sidecars.

### Orchestration loop (replaces Step 5 when batched)

The orchestrator is this command's own context (not a subagent). Sequentially:

1. **Plan** (fresh run): `planBatches()` → write the tracker (all batches `pending`,
   `overallStatus: planned`). On `--resume`, read the existing tracker instead — do **not** re-plan.
2. Set `overallStatus: in-progress` and **persist before spawning anything** (crash-safe intent
   record).
3. For each batch with status `pending | failed | in-progress`, in array order:
   a. Set the batch `in-progress`; **persist**.
   b. Spawn ONE fresh subagent — the `confluence-pull-batch` subtask command
      (`.claude/commands/confluence-pull-batch.md`) — with the self-contained
      `{ batchId, spaceKey, pageIds[], config }` payload. The subagent gets **no** orchestrator
      history.
   c. On return: parse the compact-JSON summary → set `done` (all clean) | `withheld` (≥1 withheld) |
      `failed` (errored/malformed). Store `subagentSummary`.
   d. **Persist the tracker after every batch** — this is the resume guarantee.
   e. Print ONE progress line: `Batch 3/9 (ancestor:2091234567): 3 pulled, 0 withheld.` The
      orchestrator's context grows only by these lines + tiny summaries — never by page bodies.
4. Set the final `overallStatus` + `finishedAt`.
5. Continue at **Step 6 (reindex)** — a single `/confluence reindex` after the queue drains.

**Concurrency = sequential (one subagent at a time).** `/confluence pull`'s roster-diff + `treeHash`
rewrite is on the per-space `confluence/spaces/{SPACE}.json`; two concurrent same-space batches would
race that file (no lock exists). Context overflow — the actual problem — is already solved by
sequential batches, since each subagent's context is discarded on return. (Parallel fan-out across
*disjoint* spaces is a possible future evolution — explicitly deferred.)

### Reindex + two-timestamp invariant

Reindex runs **exactly once**, by the orchestrator, after the loop drains (Step 6) — enforced both by
the worker prompt (forbidden there) and by this loop being the sole call site. Each subagent writes
sidecars through the unmodified `/confluence pull` Step 6 (`lastSyncedAt = nowIso`); `reindex`'s
`newestLastSynced` then picks up the newest across every batch's sidecars. So `generatedAt = now`
(once) and `lastSyncedAt` = newest real pull — invariant unchanged.

### Resume

- `--pull` with an incomplete `.pull-runs/*.json` present → prompt via `AskUserQuestion`:
  **[Resume <run_id> (N/M done) / Fresh plan / Cancel]**.
- `--resume <run_id>` → resume that run; `--resume` (bare) → newest tracker by `createdAt`.
- **Skip `done` and `withheld` batches** (withheld is terminal — it needs `--force-pull`; retrying
  just re-hits the gate). Re-drive `pending`. Re-drive `failed` with a **retry cap** (2 attempts per
  `batchId`, then surface as needs-manual). A batch found `in-progress` (orchestrator crashed
  mid-batch) is treated as `pending` and re-spawned — `/confluence pull` is idempotent per page
  (recomputes hashes every run), so re-running its pageIds is always safe.

### Withheld & orphans (guardrails preserved)

- **Withheld** (`diverged` / `local-ahead`): the EXISTING `/confluence pull` Step-4 do-not-clobber
  gate fires inside the subagent exactly as at top level; the subagent only *reports* it in
  `withheldKeys[]`. Never auto-clobbered, never retried on resume, overridden only by a top-level
  `--force-pull <target>` (one target, confirmed diff) — a subagent cannot invoke `--force-pull`.
- **Orphan disposition** stays a human choice, **outside** the batch loop: it runs in Step 7, in the
  orchestrator's context, AFTER the queue drains and reindex runs (so the orphan set is final).
  Orphans are never part of any batch's `pageIds`, never delegated to a subagent, never auto-run.

### Dry-run (batched mode)

When batched mode *would* trigger under `--dry-run` (or no flag), print the **planned batch table**
from the in-memory roster scan — batch count, pageIds per batch, unit, estimated subagent count —
**writing no tracker and spawning nothing**. End with
`Run /confluence-sync --pull to execute this plan (one fresh subagent per batch, resumable).`

## Guardrails

- **Default dry-run.** Nothing is written until `--pull`.
- **Wrapper only** — never fetch a body, write a sidecar, or build the index inline. Body pulls
  delegate to `/confluence pull`; the rollup delegates to `/confluence reindex`. No duplicated
  pull/write/index logic.
- **Never clobber a hand-edited body** — `diverged` / `local-ahead` are withheld by `/confluence
  pull`'s do-not-clobber gate; only `--force-pull` + a confirmed diff overrides, one target at a time.
- **Token discipline** — cheap version-only roster scan first (`searchConfluenceUsingCql`); full
  bodies fetched only inside `/confluence pull` for `remote-ahead | new`; never re-fetch `clean`.
- **Never auto-delete an orphan** — always a per-orphan human choice.
- **Never touch `specs/`** (R3). A sync may *note* that a changed page feeds a spec, but must not run
  `/reconcile-requirements` or synthesize into `specs/`.
- **Timestamp invariant** — only a real `--pull` (via `/confluence pull`) moves `lastSyncedAt`;
  reindex and dry-run never do.
- **Batched mode is threshold-driven, sequential, and resumable** — engages only when
  `pendingCount > largeSyncThreshold`; one fresh subagent per batch (context discarded on return);
  tracker persisted after every batch; a single end-of-run reindex. It changes only *how* Step 5
  applies the pending set — never the pull/clobber/reindex logic.
- **Live discovery is not what this is.** `search` / `read` / `summary` are the live Rovo verbs and are
  never staleness-gated; `/confluence-sync` reconciles the *cache*, and its whole point is to refresh
  what those citations point at.
- **Confluence MCP only inside a `/confluence*` context** (Access Control Policy) — this command
  qualifies; it never runs during specs/epics/implement/add-* or CI.
- **No secrets** — the MCP session brokers auth; `cloudId` is the pinned `confluence-sync.config.yml`
  value, never hardcoded.

## Cross-references

- Router (owns the pull + reindex verbs this wraps): `.claude/commands/confluence.md`
- Pull verb: `/confluence pull <SPACE|pageId|url>` (router §"`/confluence pull`")
- Reindex verb: `/confluence reindex` (router §"`/confluence reindex`")
- Scripts: `scripts/confluence/{mcp-client,converter,hash,reindex}.ts`
- Batch planner: `scripts/confluence/plan-batches.ts` (pure `planBatches()`)
- Batch worker (subtask): `.claude/commands/confluence-pull-batch.md`
- Config: `.claude/config/confluence-sync.config.yml` (`largeSyncThreshold`, `maxBatchPages`)
- Identity: `.claude/config/people.json`
- Proven twin: `.claude/commands/jira-sync.md`
