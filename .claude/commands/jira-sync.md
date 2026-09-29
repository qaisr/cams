---
description: >
  Scoped, multi-item reconciliation of the local JIRA mirror against remote EON. Runs a cheap
  cheap-fields scan over the three saved scope queries, computes each item's `status_sync` via the
  dual-hash + timestamp diff, fetches full bodies ONLY for `remote-ahead | new`, discovers new remote
  epics and per-epic child roster changes, offers per-orphan disposition, regenerates `_index.json`,
  and prints a change report. Default run is DRY-RUN — nothing is written until `--pull`. Never
  touches `specs/` (R3); never auto-deletes an orphan; only a real `--pull` moves `lastSyncedAt`.
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# /jira-sync — scoped reconciliation

## Input

`$ARGUMENTS` — `[--pull] [--dry-run] [--force-pull <key>] [--resume [<run_id>]]
[--max-batch-size <N>] [--batch-by epic|chunk]`

- **no flags → dry-run**: print the status table + discovery findings and STOP. Nothing written.
- `--dry-run`: explicit form of the default. When batched mode would trigger (§ "Batched large-scale
  sync"), also prints the **planned batch table** (no tracker written, nothing spawned).
- `--pull`: apply — fetch full bodies for `remote-ahead | new`, write bodies + sidecars + per-epic
  manifests, regenerate `_index.json`, move `lastSyncedAt`. **Auto-routes to batched mode** when the
  pending count exceeds `largeSyncThreshold` (§ "Batched large-scale sync").
- `--force-pull <key>`: override the `diverged` / `local-ahead` guard for ONE key, after a confirmation
  showing a 3-way (local / mirror-base / remote) diff. Implies `--pull` for that key only.
- `--resume [<run_id>]`: resume the newest (or named) incomplete `jira/.pull-runs/*.json` batched run.
  Implies `--pull`. See § "Batched large-scale sync" → Resume.
- `--max-batch-size <N>`: override `maxBatchPages` for this run only (no config write).
- `--batch-by epic|chunk`: force the planner unit (default `epic`); `chunk` forces flat chunking.

## What this writes (only on `--pull`; §2.2 of the phase plan)

| Path | When |
|---|---|
| `jira/<type>/{KEY}.md` + `.json` | each `remote-ahead` / `new` item pulled |
| `jira/epics/{EPIC}.json` (+ `.md`) | per-epic manifest refresh incl. recomputed `childrenHash` |
| `jira/.manifest.json` | scope block + per-item pointers; orphan removals |
| `jira/_index.json` | regenerated at the end (derived; gitignored) |
| `jira/_orphaned/{KEY}.*` | only when the human chooses **archive** for an orphan |
| `.claude/config/people.json` | append newly-seen assignees (`aliases: []`) |

**Never** writes `specs/`.

## Contract (reuse Phase-0 scripts + existing router paths — do NOT re-implement)

Connection facts + JQL builders — `scripts/jira/mcp-client.ts`:
`CONNECTION` (cloudId/site/project), `scopeQueries(project, epics, strategy)`,
`epicsAndChildrenJql`, `backlogJql`, `currentSprintJql`, `epicChildrenJql`, `MCP_CONTRACT`.

Transform — `scripts/jira/converter.ts`: `convertItem`, `convertEpic`, `parseSprint(value, shape)`,
`adfToMarkdown`, `mdBody`.

Hashing — `scripts/jira/hash.ts`: `hashBody`, `hashPushable`, `hashRoster`, `partitionRegions`,
`pushablePayload`, `sha256`.

Config — `.claude/config/jira-sync.config.yml`: `project`, `epicLinkStrategy`, `scope.*`, `epics[]`,
`fields.*`, `board`, `artifactFolders`, `stalenessHours`.

MCP tools (Claude invokes directly; auth brokered by the session — no secrets):
- cheap scan → `mcp__atlassian__searchJiraIssuesUsingJql` (`MCP_CONTRACT.search`), page via
  `nextPageToken`, `maxResults: 100`.
- full body → `mcp__atlassian__getJiraIssue` `{ cloudId, issueIdOrKey, fields: ["*all"],
  expand: "renderedFields" }` (`MCP_CONTRACT.getIssue`).

**Reuse, don't duplicate:**
- The full-body pull + roster-diff-before-overwrite for an epic subtree **is exactly `/jira pull
  <EPIC>`** (jira.md §4.3). When sync needs to pull an epic and its children, **delegate to that
  path** — do not re-write the roster diff or the per-child clobber guard.
- The single-item idempotent write + never-clobber gate **is exactly `/jira-add-issue` Step 4**. When
  sync pulls a lone `remote-ahead|new` non-epic item, follow that same write gate.
- The offline rollup **is `/jira reindex`** — run it (Step 7) rather than re-implementing the index
  shape. If `scripts/jira/reindex.ts` exists, `/jira reindex` uses it; otherwise the inline rollup.

### Hashing note (critical — must match the converter)

`localEditsHash` in a sidecar is `hashBody(mdBody(<on-disk .md>))` — the converter strips the H1 title
via `mdBody()` **before** `hashBody()`. When recomputing `localEditsHash` from disk, apply `mdBody()`
first, then `hashBody()`, or a title rename will read as a false local edit.

## Process

### Step 1 — Preconditions

1. Require `jira/.manifest.json`. If absent → tell the user to run `/jira-init` and STOP.
2. Read `_index.json` for `lastSyncedAt` + `currentSprint`. Load `jira-sync.config.yml`.
3. **Empty-/missing-mirror preview.** If `jira/.manifest.json` has an empty `items[]` **and** no epic
   manifests exist under `jira/epics/`, the mirror is effectively empty. Run the same preview
   `/jira-init` shows: query EON via the `epics_and_children` scope, list epics → children grouped
   with counts, and ask (via `AskUserQuestion`) which epics to pull now — all / a subset / none. The
   actual pull is the `/jira pull <EPIC>` path (route each chosen epic there). Then STOP — a
   first-population is a pull, not a reconciliation.

### Step 2 — Cheap remote scan (bodies NOT fetched)

Build the three scope queries via `scopeQueries(project, config.epics, config.epicLinkStrategy)` (they
equal `config.scope.*`). **Union** the three result sets, de-duped by issue key. Request cheap fields
only:

```
fields: ["updated", "status", "assignee", "parent", "priority",
         "<config.fields.sprint.id>", "<config.fields.storyPoints.id>"]
```

Page each query with `nextPageToken`. For each unique issue capture
`{ key, updated, status, statusCategory, assignee, parent, priority, sprint, points }`. Parse sprint
with `parseSprint(raw, config.fields.sprint.shape)`. No `getJiraIssue` calls in this step.

### Step 3 — Per-item diff (§6.1 algorithm)

For every key in `union(remote) ∪ manifest`, read the sidecar (if any), recompute
`localEditsHash = hashBody(mdBody(onDiskMd))`, and classify:

```
remote.updated  >  sidecar.remoteUpdatedAt  AND  localEditsHash == sidecar.contentHash  → remote-ahead (pull)
remote.updated  >  sidecar.remoteUpdatedAt  AND  localEditsHash != sidecar.contentHash  → diverged     (flag)
remote.updated == sidecar.remoteUpdatedAt   AND  localEditsHash != sidecar.contentHash  → local-ahead  (flag)
remote key NOT in manifest                                                              → new          (offer pull)
manifest key NOT in remote                                                              → orphaned     (§6.5 disposition)
otherwise                                                                               → clean        (skip)
```

`contentHash` is the sidecar's stored value (body as last written by ingest). Timestamps compared as
ISO instants.

**Threshold check (routes Step 5).** After the diff, count the **pending** items —
`pendingCount = |{ status_sync ∈ {remote-ahead, new} }|` (pure arithmetic on data already scanned —
no extra MCP calls). If `pendingCount > config.largeSyncThreshold` (default 15), Step 5 runs in
**batched mode** (§ "Batched large-scale sync"); otherwise the existing single-context flow. Threshold
is on **pending** work, not raw scope size.

### Step 4 — Discovery passes

- **Remote-epic discovery (N6).** Any Epic surfaced by the `epics_and_children` scan that has no
  manifest under `jira/epics/` → list `{key, title, childCount}` and offer to add (via
  `AskUserQuestion`). On accept: route to `/jira pull <EPIC>`, **and** append the key to `epics:` in
  `jira-sync.config.yml` and into `scope.epics_and_children` (keep the two in sync).
- **Per-epic child discovery.** For each mirrored epic, build the roster from the scan's children of
  that epic as `{ key, remoteUpdatedAt }`, sort, and compute `hashRoster(roster)`. Compare to the
  stored `childrenHash` in `jira/epics/{EPIC}.json`. If different → list added / modified / removed
  children and offer to pull (again the `/jira pull <EPIC>` path, which does the safe roster-diff).

### Step 5 — Apply (only on `--pull`)

**If `pendingCount > largeSyncThreshold` (Step 3 threshold check), run the § "Batched large-scale
sync" orchestration loop instead of this single-context flow, then continue at Step 7 (reindex).**
Otherwise:

- Fetch full bodies via `getJiraIssue` **only** for `remote-ahead | new` (token discipline — never
  re-pull `clean`). Convert with `convertItem` / `convertEpic`; write body + sidecar following the
  `/jira-add-issue` Step-4 write gate; refresh the per-epic manifest (recomputed `childrenHash`).
  Fresh sidecar: `contentHash = localEditsHash`, `status_sync: "clean"`, `remoteUpdatedAt` from
  remote, `localSyncedAt = now`.
- `diverged` / `local-ahead` are **withheld** — never auto-pulled. They move only when named by
  `--force-pull <key>`, and then only after a confirmed 3-way (local / mirror-base / remote) diff.

### Step 6 — Orphan disposition (§6.5)

For each `orphaned` key, ask per-orphan via `AskUserQuestion`:
- **archive** → move `.md` + `.json` to `jira/_orphaned/{KEY}.*`, drop the `.manifest.json` entry;
- **delete** → remove the files + manifest entry;
- **keep & re-check** → leave in place for one cycle (may be a transient remote-visibility blip).

**Never auto-delete.** Archived/deleted orphans are pruned from `_index.json.tree` + `items[]` on the
Step-7 reindex, and any parent's `children[]` referencing them is pruned.

### Step 7 — Reindex + timestamps

Run the `/jira reindex` rollup to regenerate `_index.json` (`counts`, `items[]` one-liners, `tree{}`,
`backlog[]`, `orphans[]`). `currentSprint` is refreshed from the board only on a real `--pull`;
reindex/dry-run carry it through unchanged. Set `generatedAt = now`.

- On `--pull`: **move `lastSyncedAt = now`** (a real remote pull happened).
- On dry-run: **do NOT move `lastSyncedAt`** (timestamp invariant — §3.2).

People append is additive only (never rewrite an existing person).

### Step 8 — Report

Print:
1. A status table — `KEY · Type · status_sync · summary`.
2. A git-style summary line — `N remote-ahead · N local-ahead · N diverged · N new · N orphaned · N clean`.
3. Discovery findings — new remote epics; per-epic child add/modify/remove.
4. Orphan choices made (or, on dry-run, the pending list).
5. **Batched run summary (batched mode only)** — `run_id`, batch counts (`N done · N withheld · N
   failed` of `M`), the withheld-key list with the `--force-pull` hint, and any `failed` batches
   surfaced as needs-manual. On a batched **dry-run**, print the planned batch table instead.

On a dry-run, end with the exact command to apply, e.g. `/jira-sync --pull`. When batched mode would
trigger, the dry-run preview ends with:
`Run /jira-sync --pull to execute this plan (one fresh subagent per batch, resumable).`

## Batched large-scale sync

> **Twin of `/confluence-sync`'s "Batched large-scale sync" section** — same tracker shape, same
> sequential orchestration loop, same resume contract, same reindex-once invariant, same
> compact-JSON worker boundary. Read that section for the full rationale and the loop steps. Only the
> deltas below differ.

**Engages when** the Step-3 threshold check finds `pendingCount > config.largeSyncThreshold`
(default 15). Below threshold, Step 5's single-context flow runs unchanged.

**Deltas from the Confluence section:**

- **Batch unit = epic.** The planner is `scripts/jira/plan-batches.ts`
  (`planBatches(pendingRoster, { maxBatchPages })`): each epic (+ its pending children) → one
  `epic:<EPIC>` batch; parent-less items → synthetic `backlog` / `sprint` batches; any epic (or
  bucket) larger than `maxBatchPages` splits into stable `chunk:<EPIC>-<n>` (or `chunk:backlog-<n>` /
  `chunk:sprint-<n>`) batches. `--batch-by chunk` forces flat chunking.
- **Worker = `.claude/commands/jira-pull-batch.md`** (`subtask: true`, Haiku-tier). For an `epic`
  batch it delegates to `/jira pull <EPIC>` (jira.md §4.3); for a `chunk` / `backlog` / `sprint`
  batch it pulls each key through the `/jira-add-issue` Step-4 write gate (the same per-child
  do-not-clobber hash check `/jira pull` applies). It returns ONLY compact JSON counts.
- **Tracker path** `jira/.pull-runs/<run_id>.json`; `batchId` prefixes `epic:` / `chunk:` /
  `backlog` / `sprint`. Tracker shape, `status` / `overallStatus` enums, and per-batch
  `subagentSummary` are identical to the Confluence twin.
- **Reindex once** — the orchestrator runs `/jira reindex` at **Step 7** after the queue drains
  (workers are forbidden to reindex); `lastSyncedAt` is moved by the real per-issue pulls inside the
  workers, carried through by the single end-of-run reindex.
- **Orphan disposition** stays a human choice at **Step 6**, in the orchestrator's context, AFTER the
  batch queue drains — never delegated to a subagent, never part of any batch's `keys[]`.
- **Withheld** (`diverged` / `local-ahead`) items are reported in `withheldKeys[]`, never
  auto-clobbered, never retried on resume; overridden only by a top-level `--force-pull <key>` (a
  subagent cannot invoke it). Resume skips `done` + `withheld`, re-drives `pending`, re-drives
  `failed` under a 2-attempt cap, and treats a crashed `in-progress` batch as `pending` (per-issue
  pulls are idempotent).

Config keys (`largeSyncThreshold`, `maxBatchPages`) live in `.claude/config/jira-sync.config.yml`.

## Guardrails

- **Default dry-run.** Nothing is written until `--pull`.
- **Never clobber a hand-edited body** — `diverged` / `local-ahead` are withheld; only `--force-pull`
  + a confirmed 3-way overrides, one key at a time.
- **Token discipline** — cheap cheap-fields scan first; full bodies only for `remote-ahead | new`;
  never re-fetch `clean`.
- **Never auto-delete an orphan** — always a per-orphan human choice.
- **Never touch `specs/`** (R3). A sync may *note* that a changed mirror feeds a spec, but must not
  run `/reconcile-requirements`.
- **Timestamp invariant** — only a real `--pull` moves `lastSyncedAt`; reindex and dry-run never do.
- **Reuse the router paths** — epic pulls and single-item writes delegate to `/jira pull` and
  `/jira-add-issue`'s gates; the rollup delegates to `/jira reindex`. No duplicated pull/write/index
  logic.
- **Batched mode is threshold-driven, sequential, and resumable** — engages only when
  `pendingCount > largeSyncThreshold`; one fresh `jira-pull-batch` subagent per batch (context
  discarded on return); tracker persisted after every batch; a single end-of-run `/jira reindex`. It
  changes only *how* Step 5 applies the pending set — never the pull/clobber/reindex logic.
- **No secrets** — the MCP session brokers auth; cloudId is the pinned `CONNECTION` value.
