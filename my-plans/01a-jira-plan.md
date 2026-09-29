# Plan 1a — JIRA Integration (Local-Copy Mirror + Derived Index + NL Query Engine)

> **Status:** Proposed · **Author:** AI Tools Expert / Frameworks Designer
> session · **Date:** 2026-08-01 **Supersedes:** the JIRA half of
> `my-plans/01-confluence-jira-plan.md` (now deleted) and
> `docs/jira-confluence-plan.md` **Sibling plans:**
> `my-plans/01b-confluence-plan.md` · `my-plans/02-figma-lumen-plan.md`
> **Project grounding:** JIRA project **EON** on `commbank.atlassian.net`
> (cloudId `998e78d7-2a66-4fc0-809b-b43b4232d4b8`)

---

## 0. What this plan is, and what changed

This plan splits the JIRA track out of the combined Confluence+JIRA plan and
**substantially expands** it into three cooperating capabilities:

1. **A local mirror** of EON issues (the proven local-copy + manifest model —
   carried forward).
2. **A derived, regenerable index** (`jira/_index.json`) that turns the mirror
   into something an AI agent can reason over natively — gap analysis, search,
   relationship mapping, sprint/backlog queries.
3. **A natural-language command family** (`/jira …`) backed by a **`jira-helper`
   subagent**, so a human can ask vague questions ("what are abbas's pending
   tasks this sprint?") and get precise answers, with clarifying multi-choice
   questions when the prompt is ambiguous.

### 0.1 Carried forward unchanged (proven, do not re-litigate)

| #                     | Decision                                                                                                                                                                                                                                                                                   | Rationale                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **R1**                | **No de-identification.** Import content **verbatim**.                                                                                                                                                                                                                                     | Private, org-staff-only repo; the same names already live in Confluence/JIRA. De-id added cost + drift for zero real gain. |
| **R2**                | **Store local copies** (`.md` body + `.meta.json` sidecar), synced by a manifest with **version + dual-hash timestamp comparison**.                                                                                                                                                        | Reviewable git diffs, deterministic reconciliation, greppable Markdown bodies.                                             |
| **R3**                | **Separation of concerns.** Sync ≠ generate ≠ reconcile ≠ push. Ingest touches only `jira/` + manifest; `/create-specifications` only reads it; `/reconcile-requirements` is the only path from a changed mirror to `specs/`.                                                              | Prevents surprise spec churn and runaway token cost.                                                                       |
| **R4**                | `/create-specifications` accepts N inputs, e.g. `/create-specifications raw-requirements/req.md confluence jira figma`.                                                                                                                                                                    | One entry point produces the initial `specs/`.                                                                             |
| **Write-back engine** | Features **A (push edited mirror)**, **B (create from brief)**, **C (batch enhance)** are **three entry points into one mutation pipeline** — dry-run → approve → lost-update re-check → mutate (marker + idempotency key) → re-pull → reconcile → **suggest** (never run) spec reconcile. | One marker convention, one conflict guard, one manifest-reconcile step, one place a JIRA write can happen.                 |

### 0.2 New in this plan (the enhancements requested)

| #       | Enhancement                                                                                                     | Section            |
| ------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| **N1**  | Folder-by-type tree (`epics/ stories/ tasks/ bugs/`) replacing the flat `jira/EON-27.md` layout                 | §2                 |
| **N2**  | **Hybrid per-item format resolved** — `.md` body + `.json` sidecar (NOT single-JSON)                            | §2.1, Challenge #2 |
| **N3**  | Per-epic manifest `jira/epics/{EPIC}.json` capturing epic + children roster + comment history                   | §2.3               |
| **N4**  | **Derived** global index `jira/_index.json` (regenerable rollup — the "third source of truth" trap defused)     | §3, Challenge #1   |
| **N5**  | Hand-authored identity in `.claude/config/people.json` — user list + aliases, never overwritten by regeneration | §3.3, Challenge #1 |
| **N6**  | `/jira-sync` gains **remote-epic discovery** + **empty-mirror preview**                                         | §4.2               |
| **N7**  | `/jira pull {EPIC_ID}` — epic + all children in one structured pull                                             | §4.3               |
| **N8**  | `/jira-init` — first-time setup + drift report if already initialized                                           | §4.1               |
| **N9**  | **`jira-helper` subagent** + thin **`/jira` router** command family for NL queries                              | §5                 |
| **N10** | **24-hour staleness check** on any `/jira` query, driven by `_index.json.lastSyncedAt`                          | §5.4               |
| **N11** | **Backlog-aware JQL scope** (widened beyond `parent in (...)` so backlog items are captured)                    | §6.2, Challenge #5 |
| **N12** | **Local search + relationship mapping** over the index (no DB needed until ~hundreds of issues)                 | §5.2, §7           |

---

## 1. The model in one picture

```
  REMOTE (system of record)        LOCAL MIRROR (git-tracked)                DERIVED (regenerable)
  ┌──────────────────────┐         ┌────────────────────────────────┐       ┌──────────────────────┐
  │ JIRA project EON     │ ingest  │ jira/epics/EON-21.json (per-epic │ roll  │ jira/_index.json      │
  │  EON-21 (epic)       │────────▶│   manifest: epic + children set) │──up──▶│  (global index:       │
  │   ├ EON-123 (story)  │ (pull)  │ jira/stories/EON-123.md + .json  │       │   tree, assignees,    │
  │   ├ EON-124 (task)   │         │ jira/tasks/EON-124.md + .json    │       │   statuses, summaries)│
  │   └ EON-121 (bug)    │         │ jira/bugs/EON-121.md + .json     │       └──────────────────────┘
  │                      │  push   │ jira/.manifest.json (sync state) │       ┌──────────────────────┐
  └──────────────────────┘ (gated) │ .claude/config/people.json       │       │ specs/  (via          │
            ▲                       └────────────────────────────────┘       │  /create-specs, R3)   │
            └──────── write-back engine (dry-run → approve → apply) ──────────┴──────────────────────┘
                                              ▲
                       /jira "<natural language>" ─► jira-helper subagent ─► reads _index.json (+ drills to files)
```

**Four state layers, each with ONE owner** (this is the core of the "third
source of truth" fix):

| Layer                      | File(s)                                           | Authoritative for                                            | Written by                                                                  |
| -------------------------- | ------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| **Sync state**             | `jira/.manifest.json` + per-item `.json` sidecars | status/hashes/versions/timestamps                            | sync + write-back engine                                                    |
| **Per-epic roster**        | `jira/epics/{EPIC}.json`                          | epic body, comment history, children list                    | `/jira pull`, `/jira-sync`                                                  |
| **Global index** (DERIVED) | `jira/_index.json`                                | relationships, assignees, summaries, statuses — a **rollup** | **regenerated** from the two layers above on every sync — never hand-edited |
| **Users/aliases** (HAND)   | `.claude/config/people.json` (§3.6)               | real usernames ↔ friendly aliases                            | humans only — regeneration never touches it                                 |

---

## 2. On-disk layout (the local mirror)

```
jira/
├── .manifest.json              # domain sync manifest — one entry per mirrored issue (status/hash/version)
├── manifest.schema.json        # JSON Schema for .manifest.json + per-item .json sidecars (validation)
├── _index.json                 # DERIVED global index (regenerable rollup — §3)
├── epics/
│   ├── EON-21.json             # per-epic manifest: epic detail + comment history + children roster
│   └── EON-23.json
├── stories/
│   ├── EON-123.md              # human body: summary, description, ACs, comments (verbatim)
│   ├── EON-123.json            # sidecar: assignee, status, points, sprint, links, hashes, sync status
│   └── EON-125.md
├── tasks/
│   ├── EON-124.md
│   └── EON-124.json
└── bugs/
    ├── EON-121.md
    └── EON-121.json
```

> **Resolution of Challenge #2 (`.json` vs `.md + .meta.json`).** The user's
> tree showed `stories/EON-123.json`. If the _description and comments_ live
> inside JSON, git diffs become noisy escaped-string blobs and lose the
> human-readability that justifies the whole local-copy model. **Decision (N2):
> keep the hybrid** — `EON-123.md` for the human body + `EON-123.json` sidecar
> for structured metadata. We **adopt the folder-by-type layout**
> (`epics/ stories/ tasks/ bugs/`) from the user's tree (a genuine improvement
> over the old flat `jira/EON-27.md`), and we **drop the `.meta.json` suffix**
> in favour of a plain `.json` sidecar sharing the item's basename. Epics are
> the one exception: an epic's `jira/epics/{EPIC}.json` is a richer _per-epic
> manifest_ (§2.3) that also carries the children roster; the epic's human body
> still lives in `jira/epics/{EPIC}.md`.

### 2.1 Per-item files (stories / tasks / bugs)

**`{KEY}.md`** — the human-readable body, **verbatim** (no redaction).
Normalized template. Each `##` heading is a **stable anchor** and the file is
partitioned into exactly two region classes (see §2.4) — **pushable**
(`## Description`, `## Acceptance Criteria`) and **pull-only** (`## Status`,
`## Links`, `## Comments`). The `<!-- pull-only -->` / `<!-- pushable -->` HTML
comments are load-bearing markers the diff engine keys on; they are invisible in
rendered Markdown and MUST NOT be removed on hand-edit.

```markdown
# EON-123: Wire PingID JWKS rotation into the auth guard

<!-- pull-only: mirrors JIRA; edits here are reported-and-skipped on push (§8.2) -->

## Status

In Progress · Sprint: EON Sprint 24 · Points: 5 · Assignee: abbasqa (abbas)

<!-- pushable: Feature A pushes this region to the JIRA description field (§8.2) -->

## Description

<verbatim ADF→Markdown of the issue description>

## Acceptance Criteria

- [ ] JWKS keys refresh on 401 without a full restart
- [ ] Unit + integration coverage for rotation path

<!-- pull-only -->

## Links

- Parent: EON-21 (epic)
- Blocks: EON-140
- Relates: EON-201

<!-- pull-only -->

## Comments (verbatim, chronological)

- **abbasqa** 2026-07-29: "Rotation cache TTL should be 10m, confirmed with
  platform."
```

**`{KEY}.json`** — machine sidecar for sync + query (the authoritative per-item
sync state):

```json
{
  "source": "jira",
  "key": "EON-123",
  "type": "Story",
  "url": "https://commbank.atlassian.net/browse/EON-123",
  "summary": "Wire PingID JWKS rotation into the auth guard",
  "status": "In Progress",
  "statusCategory": "In Progress",
  "assignee": "abbasqa",
  "reporter": "j.smith",
  "storyPoints": 5,
  "priority": "High",
  "sprint": "EON Sprint 24",
  "labels": ["auth", "security"],
  "parent": "EON-21",
  "links": { "blocks": ["EON-140"], "relates": ["EON-201"], "blockedBy": [] },
  "remoteUpdatedAt": "2026-07-29T04:12:33.000Z",
  "localSyncedAt": "2026-08-01T09:00:00.000Z",
  "contentHash": "sha256:ab12…",
  "localEditsHash": "sha256:ab12…",
  "status_sync": "clean"
}
```

`status_sync` ∈ `clean` | `remote-ahead` | `local-ahead` | `diverged` | `new` |
`orphaned`. (Named `status_sync` so it never collides with JIRA's own workflow
`status`.)

### 2.2 Why both `contentHash` and `localEditsHash` (carried forward)

- `contentHash` = hash of the body **as last written by an ingest/sync**.
- `localEditsHash` = hash of the body **as it currently sits on disk**.
- Differ → a human hand-edited the mirror → sync must not clobber it
  (`local-ahead`/`diverged`). This "never clobber user-modified content" guard +
  SHA-256 idempotency (§8.5) keeps the mirror safe across re-runs.

### 2.4 Region partitioning — how one flat `.md` stays half-pushable, half-pull-only

The mirror `.md` mixes fields JIRA lets us write (description, ACs) with fields
the write path deliberately does **not** touch (status, links, comments — §8.6
declined-ideas). Because a human edits the _whole_ file, the diff engine must
partition it so a stray edit under `## Links` is never silently pushed, and a
description edit is never blocked by an unrelated status change. The rule
(borrowed from the Confluence plan's section-scoped write, `01b` §8.1):

| Region (by `##` heading anchor)            | Class         | On push (Feature A)                                |
| ------------------------------------------ | ------------- | -------------------------------------------------- |
| `## Description`, `## Acceptance Criteria` | **pushable**  | diffed and pushed to the JIRA description field    |
| `## Status`, `## Links`, `## Comments`     | **pull-only** | **reported-and-skipped** — never written to remote |

- **Parsing is anchor-based, not line-based.** The engine splits the file on the
  `##` headings and their preceding `<!-- pushable -->` / `<!-- pull-only -->`
  markers; unknown/extra `##` sections default to **pull-only** (fail safe —
  never push something we don't recognise).
- **`contentHash` / `localEditsHash` cover the whole body** (change
  _detection_), but the push **payload** is computed from the **pushable regions
  only**. So a status-only hand-edit still marks the item `local-ahead`
  (something changed on disk) yet produces an **empty pushable diff** → Feature
  A reports "1 pull-only edit skipped, nothing to push" instead of a confusing
  no-op.
- **Round-trip stability.** The JIRA→MD converter (Phase 0) emits the markers;
  the MD→JIRA push reads only the pushable slice. AC checkboxes live inside
  `## Acceptance Criteria` and travel with the description as the plan already
  specifies (§8.2).

### 2.3 Per-epic manifest (`jira/epics/{EPIC}.json`) — N3

An epic is special: it owns a subtree. Its per-epic manifest captures the epic
itself **and** a roster of its children, so an epic pull/sync can detect "a
child was added/modified in remote":

```json
{
  "source": "jira",
  "key": "EON-21",
  "type": "Epic",
  "summary": "Entity onboarding — auth & session foundation",
  "status": "In Progress",
  "assignee": "abbasqa",
  "descriptionRef": "jira/epics/EON-21.md",
  "comments": [
    {
      "author": "j.smith",
      "at": "2026-07-20T02:00:00Z",
      "body": "Split session mgmt into its own story."
    }
  ],
  "children": [
    {
      "key": "EON-123",
      "type": "Story",
      "file": "jira/stories/EON-123.md",
      "status": "In Progress",
      "assignee": "abbasqa",
      "remoteUpdatedAt": "2026-07-29T04:12:33Z"
    },
    {
      "key": "EON-124",
      "type": "Task",
      "file": "jira/tasks/EON-124.md",
      "status": "To Do",
      "assignee": "j.smith",
      "remoteUpdatedAt": "2026-07-25T08:00:00Z"
    },
    {
      "key": "EON-121",
      "type": "Bug",
      "file": "jira/bugs/EON-121.md",
      "status": "Done",
      "assignee": "abbasqa",
      "remoteUpdatedAt": "2026-07-18T10:00:00Z"
    }
  ],
  "childrenHash": "sha256:…",
  "remoteUpdatedAt": "2026-07-29T04:12:33.000Z",
  "localSyncedAt": "2026-08-01T09:00:00.000Z"
}
```

`childrenHash` is a hash of the sorted `(key, remoteUpdatedAt)` roster. On an
epic sync, if the freshly-queried roster hash ≠ stored `childrenHash`, a child
was added/removed/updated remotely → surface it (see `/jira-sync` remote-epic
discovery, §4.2).

> **The children roster deliberately lives in the per-epic manifest AND is
> mirrored into `_index.json`.** That looks like duplication — it isn't, because
> `_index.json` is **derived** (§3): the per-epic manifest is authoritative; the
> index is a rebuilt rollup. There is one writer of truth per fact. This is the
> concrete fix for Challenge #1.

---

## 3. The derived global index (`jira/_index.json`) — N4, and the fix for Challenge #1

### 3.1 The problem the user identified

Three overlapping state files (`.manifest.json`, `_index.json`, per-epic
`{EPIC}.json`) would put children metadata in three places — a drift trap,
exactly the problem dual-hashing solved for content.

### 3.2 The resolution — `_index.json` is a **derived, regenerable rollup**

- **Never hand-authored.** Rebuilt from the per-item `.json` sidecars + per-epic
  manifests on **every sync** (and on demand via `/jira reindex`).
- **Authoritative sync state stays in the per-item `.json` sidecars** and
  `.manifest.json`.
- If `_index.json` and a sidecar ever disagree, the **sidecar wins** and a
  reindex fixes the index.
- **Two distinct timestamps, never conflated (the reindex invariant):**
  - `generatedAt` = when this `_index.json` was last **rebuilt** from sidecars.
    A **reindex updates `generatedAt`** (and only `generatedAt`).
  - `lastSyncedAt` = when the mirror last **pulled from remote JIRA**. Only a
    successful pull (`/jira-sync --pull`, `/jira pull`, `/jira-add-issue`)
    updates it. **`/jira reindex` MUST NOT touch `lastSyncedAt`** — it is an
    offline, local-only operation (§6.4). Were reindex to bump `lastSyncedAt`, a
    purely local reshuffle would reset the 24h staleness clock (§5.4) and make a
    3-day-stale mirror look fresh. This invariant is the guard against that.
- Being derived, `_index.json` is **`.gitignore`d** — see §3.5 for why
  committing a per-sync regenerated rollup is the wrong call.

Shape (compact by design — this is what the `jira-helper` agent loads into
context):

```json
{
  "project": "EON",
  "generatedAt": "2026-08-01T09:00:05.000Z",
  "lastSyncedAt": "2026-08-01T09:00:00.000Z",
  "currentSprint": {
    "id": 4021,
    "name": "EON Sprint 24",
    "state": "active",
    "startDate": "2026-07-28",
    "endDate": "2026-08-11"
  },
  "counts": {
    "epics": 7,
    "stories": 34,
    "tasks": 21,
    "bugs": 9,
    "backlog": 18
  },
  "items": [
    {
      "key": "EON-123",
      "type": "Story",
      "summary": "Wire PingID JWKS rotation into the auth guard",
      "status": "In Progress",
      "statusCategory": "In Progress",
      "assignee": "abbasqa",
      "points": 5,
      "priority": "High",
      "sprint": "EON Sprint 24",
      "parent": "EON-21",
      "links": { "blocks": ["EON-140"], "relates": ["EON-201"] },
      "file": "jira/stories/EON-123.md"
    }
  ],
  "tree": {
    "EON-21": {
      "type": "Epic",
      "summary": "Entity onboarding — auth & session foundation",
      "children": ["EON-123", "EON-124", "EON-121"]
    }
  },
  "backlog": ["EON-160", "EON-161"],
  "orphans": []
}
```

Each `items[]` entry is a **one-line summary** (the full detail lives in the
`.md`). The agent loads one `_index.json` and answers nearly every example
prompt directly, drilling into an `.md` only when it needs full body/ACs. **This
is more powerful for an AI agent than SQL** — it reasons over structured JSON
natively.

### 3.3 Identity — `.claude/config/people.json` — N5

Identity is stored in a single shared hand-authored file
`.claude/config/people.json` (gitignored, regenerated by `/jira-init`). The
shape:

```json
{
  "people": [
    {
      "id": "qaiser.abbas",
      "displayName": "Qaiser Abbas",
      "aliases": ["abbas", "qa", "qaiser"],
      "jira": "abbasqa",
      "confluence": "qaiser.abbas",
      "figma": "qaiser.abbas@ppcc.com.au"
    },
    {
      "id": "j.smith",
      "displayName": "John Smith",
      "aliases": ["john", "js"],
      "jira": "j.smith"
    }
  ],
  "unresolvedAliasPolicy": "ask"
}
```

- Aliases live **only locally** (never pushed to JIRA) — pure convenience for NL
  queries.
- When a query says "abbas", the agent resolves `abbas → abbasqa` before
  filtering the index.
- New assignees discovered on sync are **appended with empty `aliases: []`**
  (additive, non-destructive). `unresolvedAliasPolicy: "ask"` means an ambiguous
  alias triggers a clarifying question rather than a guess.

### 3.4 Escalation path (deferred, not built now)

If the mirror grows past **a few hundred issues**, `_index.json` may get large
for a single context load. The escalation is a `scripts/jira-index.ts` that (a)
emits `_index.json` and (b) optionally emits a SQLite/`.ndjson` search sidecar
for `/jira search`. **Deferred** — the JSON index is sufficient at EON's current
scale, and premature DB machinery is cost without benefit (§7).

### 3.5 `_index.json` is gitignored — and why (concurrency)

This reverses an earlier lean toward committing the index. The mirror is
git-tracked in a **shared, org-staff repo** (R1), so several people run
`/jira-sync --pull` on their own branches.

| File                                                             | Git            | Reasoning                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jira/**/*.md`, `jira/**/*.json` (sidecars), `jira/epics/*.json` | **committed**  | The real content + authoritative sync state. Reviewable diffs; this is the point of the local-copy model.                                                                                                                                                                                                                                                                                                                                                            |
| `jira/_index.json`                                               | **gitignored** | Derived + regenerated on **every** sync, and stamped with `generatedAt`, so it produces a diff on every sync even when nothing changed. Committing it means (a) constant index churn, and (b) **merge conflicts on machine-generated JSON** between two people who both synced — pure noise with no reviewer value. Anyone can rebuild it in seconds with `/jira reindex`. The "reviewable snapshot" benefit is already delivered by the committed `.md` + sidecars. |
| `.manifest.json`                                                 | **committed**  | Authoritative sync scope + per-item pointers; low-churn; genuine review value.                                                                                                                                                                                                                                                                                                                                                                                       |

**Concurrency posture (stated, not left implicit).** Sidecars and
`.manifest.json` can still collide if two people pull overlapping items on
divergent branches. Because the mirror is a **cache of a remote system of
record**, the resolution is cheap: on conflict, **re-run `/jira-sync --pull`
after merge** — the puller re-derives every sidecar from remote JIRA, so "theirs
vs mine" is settled by _what JIRA currently says_, not by manual JSON merging.
Recommended operating rule for the guide (§12): **treat mirror sync as a
fast-forward operation on `main`** (sync → commit → push promptly), and never
hand-resolve a sidecar merge conflict — re-pull instead.

### 3.6 Cross-tool identity — a single shared `people.json` (adopted, was deferred)

The sibling plans (`01b`, `02`) each had separate per-tool identity files and
deferred unifying them. That contradicts this plan's own core thesis —
**hand-synced duplicated state is the drift trap** the whole four-layer model
exists to kill.

**Decision: adopt one shared, hand-authored identity file** —
`.claude/config/people.json`, keyed by a canonical id with per-tool handles:

```json
{
  "people": [
    {
      "id": "qaiser.abbas",
      "displayName": "Qaiser Abbas",
      "aliases": ["abbas", "qa", "qaiser"],
      "jira": "abbasqa",
      "confluence": "qaiser.abbas",
      "figma": "qaiser.abbas@ppcc.com.au"
    }
  ],
  "unresolvedAliasPolicy": "ask"
}
```

- The JIRA layer reads `people.json` directly — `abbas → abbasqa` resolves from
  the shared file.
- This is _less_ machinery than parallel per-tool files, not more.
- Sync's "append unknown assignee with empty `aliases: []`" behaviour (§3.3)
  appends to `people.json` (matching on the tool handle), still additive and
  non-destructive.

---

## 4. Commands — ingest / sync / pull / init (writes `jira/` + manifest ONLY, R3)

### 4.1 `/jira-init` — first-time setup, or drift report — N8

The one-time bootstrap. Behaviour branches on whether `jira/` is already
initialized:

**Not initialized (fresh):**

1. Prompt for / confirm **Project ID** (`EON`), site, cloudId.
2. **Resolve the canonical board** (§6.3b): if EON has exactly one board, record
   it; if >1, list them and ask the human to pick — store `board: { id, name }`
   in `jira-sync.config.yml`. Then detect the **current sprint** = that board's
   active sprint → write `_index.json.currentSprint` (or `null` if the board is
   Kanban / has no active sprint).
3. Run **`/jira-discover-fields`** (enumerate `customfield_*` ids →
   `.claude/config/jira-sync.config.yml`), which also records `fields.sprint`
   (id + shape, §6.3a) and `epicLinkStrategy` (parent vs "Epic Link", §6.2).
4. Scaffold `jira/` tree, `manifest.schema.json`, an empty `.manifest.json`, and
   an empty `_index.json`.
5. **Empty-mirror preview (N6):** query the EON project and **show a list of
   epics/stories/tasks/bugs that would be added**, grouped by epic, with counts
   — then ask which epics to pull now (all / pick a subset / none-yet). Nothing
   is written to item files until the human chooses.

**Already initialized (drift report):**

- Compare local ↔ remote **without writing**: report stale items (remote-ahead),
  current-sprint change, `people.json` gaps (new assignees not aliased),
  field-schema changes (re-run `/jira-discover-fields`?), and any epics present
  remotely but missing locally.
- Ends with a suggested next command (`/jira-sync --pull`, `/jira reindex`,
  etc.).

### 4.2 Ingest / sync family

| Command                                                | Input          | Writes                                                                        | Notes                                                                                                                      |
| ------------------------------------------------------ | -------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `/jira-discover-fields`                                | project key    | `fields:` block of `.claude/config/jira-sync.config.yml`                      | Enumerates EON `customfield_*` (name→id→type) via `getJiraIssueTypeMetaWithFields`. One-off; feeds the create path (§8.1). |
| `/jira-add-issue <key\|url> [--with-children]`         | one issue/epic | `jira/<type>/<KEY>.md` + `.json` + manifest entry (+ children if epic & flag) | Adds/refreshes one issue. Idempotent.                                                                                      |
| `/jira pull <EPIC_ID>`                                 | one epic       | epic manifest + all children files + manifest + reindex                       | **N7 — see §4.3.**                                                                                                         |
| `/jira-sync [--pull] [--dry-run] [--force-pull <key>]` | JQL scope      | updated `.md`/`.json` + per-epic manifests + `_index.json` + `.manifest.json` | Dual-hash timestamp diff (§6). **Default dry-run.** Regenerates `_index.json` at the end.                                  |

**`/jira-sync` enhancements (N6):**

- **Remote-epic discovery.** Any epic matching the project scope that is **not**
  in the local mirror is reported as `new`, with its title + child count, and
  the human is **asked whether to add it locally** (one confirmation adds it via
  the `/jira pull` path). This directly answers _"if there are epics in remote
  JIRA that are not local, identify them and ask whether to add."_
- **Empty-/missing-mirror preview.** If `jira/` doesn't exist or is empty,
  `/jira-sync` shows the same epic/story/task/bug preview list `/jira-init`
  shows, rather than silently doing nothing.
- **Per-epic child discovery.** For each mirrored epic, if the remote children
  roster hash ≠ stored `childrenHash` (§2.3), the added/modified/removed
  children are listed and offered for pull.

### 4.3 `/jira pull <EPIC_ID>` — epic + all children, structured — N7

```
/jira pull EON-21
```

1. Fetch the epic **and all its children** (stories, tasks, bugs, sub-tasks) via
   a single scoped JQL, templated from the `epicLinkStrategy` flag (§6.2) —
   `key = EON-21 OR parent = EON-21` for team-managed,
   `key = EON-21 OR "Epic Link" = EON-21` for classic — **not both clauses
   blindly**.
2. Write/update `jira/epics/EON-21.json` (per-epic manifest, §2.3) +
   `jira/epics/EON-21.md` (epic body
   - comment history).
3. Write each child under its type folder: `jira/stories/…`, `jira/tasks/…`,
   `jira/bugs/…` (`.md` body + `.json` sidecar each).
4. If the epic manifest already exists, **compute the child roster diff** (added
   / modified / removed children in remote) and **show the diff for approval
   before overwriting** the epic body and any changed child.
5. Regenerate `_index.json` for the affected subtree.

> `/jira pull` is the **read** counterpart of the write-back engine; it never
> mutates remote JIRA. It relates to §8.4 (push) only in that both share the
> mirror as the exchange surface.

### 4.4 Generate & reconcile (reads `jira/`, R3 — unchanged in intent)

| Command                                   | Behaviour                                                                                                                                                                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/create-specifications <file> <folder…>` | **R4:** accept `jira` as a folder arg. Reads each `.md` (+ `.json` for status/relationships) as a requirement source; seeds `specs/sources/manifest.json` + the RTM **Source** column (§9). Never calls an ingest command. |
| `/reconcile-requirements <path\|url>`     | Runs the 6-phase drift engine using the **local diff** as the delta signal, updating `specs/` + epics + traceability. The `<url>` form chains `/jira-add-issue` first (the only place an ingest is chained).               |

---

## 5. The natural-language layer — `jira-helper` subagent + `/jira` router — N9

> **Decision (confirmed):** the helper is a **subagent in the roster**,
> delegated to by a thin `/jira` command family — **not** a startup mode that
> locks the session. `claude --agent jira-helper` remains available for a
> dedicated deep-work session, but is optional, not the primary path. Rationale:
> keeps JIRA reasoning isolated (own context, own loaded standards) without
> hijacking the session (Challenge #4).

### 5.1 `jira-helper` subagent (new roster entry)

**Purpose:** answer NL questions and perform analyses over the JIRA mirror. On
invocation it:

1. Loads `jira/_index.json` (compact — the whole project in one structured
   blob) + `.claude/config/people.json`.
2. Checks `_index.json.lastSyncedAt` for the **24-hour staleness rule** (§5.4).
3. Resolves any user aliases in the query (`abbas → abbasqa`).
4. Answers from the index; **drills into individual `.md` files only when full
   detail is needed** (e.g. reading/improving descriptions and ACs).
5. For **vague prompts, asks multi-choice clarifying questions** before
   answering (via the `AskUserQuestion` mechanism) — e.g. "Which sprint —
   current (EON Sprint 24) or next?", "All assignees or just abbas?".

**Tools:** read/query focused (Read, Grep, Glob, the Atlassian MCP for live
drill-through when the mirror is stale and the human opts to sync). Write-back
is delegated to the §8 engine, never done inline by the helper.

### 5.2 The `/jira` router command family — thin routing over vague prompts

`/jira "<anything>"` is the single entry point; it classifies intent and
delegates to `jira-helper` (read/analyze) or, for mutations, hands off to the
write-back engine (§8) with all its gates. Explicit sub-verbs exist for power
users and disambiguation:

| Command                                | Intent                                               | Backed by                            |
| -------------------------------------- | ---------------------------------------------------- | ------------------------------------ |
| `/jira "<natural language>"`           | anything — router classifies                         | jira-helper, then engine if mutation |
| `/jira search <query>`                 | local search over `_index.json` (+ drill)            | jira-helper                          |
| `/jira sprint [current\|next\|<name>]` | sprint board view                                    | jira-helper                          |
| `/jira backlog`                        | backlog-aware listing + prioritization help          | jira-helper (needs N11 scope)        |
| `/jira who <alias>`                    | one person's items                                   | jira-helper + `people.json`          |
| `/jira gap <KEY>`                      | gap analysis on one item                             | jira-helper                          |
| `/jira map [<KEY>]`                    | relationship/tree map (Mermaid)                      | jira-helper (§7)                     |
| `/jira reindex`                        | rebuild `_index.json` from sidecars + epic manifests | deterministic rollup                 |
| `/jira pull <EPIC>`                    | epic + children pull                                 | §4.3                                 |

### 5.3 Worked examples (the user's prompts, mapped)

| Human prompt                                                                    | Router →        | How it's answered                                                                                                                    |
| ------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| "What are the pending tasks and who they're assigned to this sprint?"           | sprint + filter | Filter `_index.json.items` where `type=Task`, `sprint=current`, `statusCategory≠Done`; join assignee via `people.json`.              |
| "What are the pending backlog items? Help me choose the next 3 sprints' work."  | backlog + plan  | Needs **N11 backlog scope**; rank by priority + points + blockedBy readiness; propose a 3-sprint slice, ask points-capacity.         |
| "Improve the descriptions of john's work items; suggest ACs and testing tasks." | who + enhance   | Resolve `john → j.smith`; list items; **hand to `/jira-enhance` (Feature C, §8.5)** — read-analyze-suggest, per-ticket approve.      |
| "List pending tasks this sprint and who they're assigned to."                   | same as row 1   | index filter.                                                                                                                        |
| "What are abbas's pending tasks this sprint?"                                   | who + sprint    | Resolve `abbas → abbasqa`; filter index.                                                                                             |
| "Help me identify the high-priority work items."                                | search/filter   | `priority in (High, Highest)` + not Done; group by epic.                                                                             |
| "Do a gap analysis on EON-123."                                                 | gap             | Read `jira/stories/EON-123.md`; check for thin description, missing ACs, no testing task, dangling links; report + offer `/enhance`. |
| "Identify work items that can be broken down or given sub-tasks."               | analyze         | Heuristics over index (points ≥ 8, multi-verb summaries, no children) → candidate list.                                              |
| "Suggest backlog items from @specs/ with epics, priority, story points."        | plan            | Cross-reference `specs/` against the index tree; propose net-new backlog items mapped to epics; offer `/jira-create` per item.       |
| "Add a task for email-received notification."                                   | create          | Route to **`/jira-create` (Feature B, §8.4)** — ambiguity review → parent confirm → dry-run → create.                                |

### 5.4 24-hour staleness check — N10

Any `/jira` query first reads `_index.json.lastSyncedAt`:

- If **> 24h old**: _"The JIRA mirror was last synced 3 days ago (2026-07-29).
  Results may be stale. Sync now? [Sync & answer / Answer from mirror anyway /
  Cancel]"_.
- If the human declines, answer from the mirror **with a one-line staleness
  banner** on the result so the caveat rides along with the answer.
- A **sync** (any successful `/jira-sync --pull` or `/jira pull`) refreshes
  `lastSyncedAt`. That is the single defined "what counts as a sync" timestamp
  (Challenge #3).

---

## 6. Sync algorithm & JQL scope

### 6.1 The dual-hash timestamp diff (carried forward)

```
1. Read .manifest.json → scope (JQL) + known items.
2. Query remote cheaply: searchJiraIssuesUsingJql fields=[updated,status,assignee,parent,sprint,priority,points]
3. Per item, compute status_sync:
     remote.updated > local.remoteUpdatedAt AND localEditsHash == contentHash → remote-ahead (pull)
     remote.updated > local.remoteUpdatedAt AND localEditsHash != contentHash → diverged     (flag)
     remote.updated == local.remoteUpdatedAt AND localEditsHash != contentHash → local-ahead  (flag; push candidate)
     remote key not in manifest  → new       (pull/offer)
     manifest key not in remote  → orphaned  (flag → resolve per §6.5: archive / delete / re-check)
     else                        → clean     (skip)
4. Fetch FULL body ONLY for remote-ahead | new (token discipline — never re-pull clean).
5. Write body + refresh sidecar + per-epic manifest + .manifest.json. Regenerate _index.json.
6. Print change report (status table + git-style summary). NEVER touch specs/ (R3).
```

`--dry-run` (default first run of a session) prints the table and stops.
`--pull` applies. `--force-pull <key>` overrides a `diverged`/`local-ahead`
guard after confirmation.

### 6.2 Backlog-aware JQL scope — N11, fix for Challenge #5

The old scope `project = EON AND parent in (EON-21, …)` captures only issues
**under known epics** — it silently misses backlog items not yet parented to an
epic. Split the scope into **two saved queries** in the manifest:

> **Epic-link field caveat (resolve at init).** Company-managed (classic)
> projects use the `"Epic Link"` field to tie a story to its epic; team-managed
> / next-gen projects use `parent`. The two are **not** interchangeable, and a
> JQL literal that assumes the wrong one silently returns nothing.
> `/jira-discover-fields` detects EON's project type and records
> `epicLinkStrategy: parent | epic-link` in `jira-sync.config.yml`; the scope
> queries and the §4.3 pull JQL are templated from that flag rather than
> hard-coding both clauses. Below both are shown for illustration — the
> generated JQL uses **one**.

```yaml
# .claude/config/jira-sync.config.yml  → scope block
scope:
  epics_and_children: >
    project = EON AND (issuetype = Epic OR parent in
    (EON-21,EON-23,EON-27,EON-28,EON-29,EON-30,EON-31,EON-32)) ORDER BY updated
    DESC
  backlog: >
    project = EON AND statusCategory != Done AND sprint is EMPTY ORDER BY
    priority DESC, rank ASC
  current_sprint: >
    project = EON AND sprint in openSprints() ORDER BY rank ASC
```

`/jira-sync` unions the three; each item's sidecar records `sprint` (or null →
backlog) and JIRA **rank** where available, so `/jira backlog` and the 3-sprint
planning prompt have status + sprint + rank/priority to work with. Epics
discovered by the `epics_and_children` query but absent locally drive the
**remote-epic discovery** prompt (§4.2).

### 6.3 Sprint mechanics (resolved) — how "sprint" and "current sprint" are actually derived

Sprint is the single most load-bearing field in the NL layer (it drives ~40% of
the §5.3 prompts), and it is also the most awkward field JIRA exposes. This
sub-section pins down the three things the rest of the plan assumes but did not
specify.

**(a) Sprint is a custom field — parse it, don't read it raw.** On a Jira Cloud
issue, sprint is a `customfield_100XX` array whose entries are either structured
objects (`{ id, name, state, boardId, startDate, endDate }` on modern Cloud) or,
on older instances, the legacy serialized `GreenHopper` string
(`...Sprint@1a2b[id=4021,name=EON Sprint 24,state=ACTIVE,...]`).

- **Resolution.** `/jira-discover-fields` (§4.2) records the sprint field's
  discovered id **and its return shape** into
  `.claude/config/jira-sync.config.yml`
  (`fields.sprint: { id, shape: object|greenhopper }`).
- The JIRA→MD/sidecar converter parses per the recorded shape into the clean
  `"sprint": "EON Sprint 24"` (name of the issue's single **active** sprint,
  else the most recent future sprint, else `null` → backlog). The raw field is
  never surfaced in the mirror.
- An issue in **multiple** sprints (carried over) records the **active** one in
  `sprint` and the full list in `sprints: [...]` on the sidecar so history isn't
  lost.

**(b) "Current sprint" is board-scoped — name the board.** `openSprints()` in
the §6.2 JQL returns issues in _any_ open sprint across _every_ board that
touches EON. If EON has more than one board, "current" is ambiguous.

- **Resolution.** `/jira-init` resolves and records a single **`boardId`** (the
  EON team board) into `jira-sync.config.yml` (`board: { id, name }`). "Current
  sprint" is defined as **the active sprint of that board**, fetched via the
  Agile board-sprints endpoint, and written to `_index.json.currentSprint` (the
  `{ id, name, state, startDate, endDate }` object already shown in §3.2).
- **Multi-board case (explicit).** If init detects >1 board for EON, it **lists
  them and asks the human to pick the canonical board** (stored as `board.id`);
  the choice is re-confirmable via `/jira-init` (drift branch). The
  `current_sprint` JQL is then scoped to that board
  (`sprint in openSprints() AND ...` narrowed by the board's saved filter)
  rather than the project-wide `openSprints()`.
- **No-board / no-active-sprint case.** If EON has no board or no active sprint
  (e.g. a Kanban team), `currentSprint` is `null`; `/jira sprint current`
  degrades gracefully to "EON has no active sprint — showing the backlog view
  instead" rather than erroring.

**(c) Who computes it.** Sprint parsing lives in the Phase-0 converter;
`currentSprint` resolution lives in `/jira-init` (write) and is refreshed by
every `/jira-sync --pull` (so a sprint rollover is picked up on the next sync).
`/jira reindex` copies the existing `currentSprint` through unchanged — it never
re-queries the board (reindex is offline; §5.4/§6.4).

### 6.4 `/jira reindex` is strictly offline (the timestamp invariant, operationally)

`/jira reindex` rebuilds `_index.json` **purely from local sidecars + per-epic
manifests** — it never calls JIRA. Consequences, stated so they can't be
violated:

- It updates **`generatedAt`** and nothing else time-related; it **never**
  writes `lastSyncedAt` (§3.2 invariant), so it cannot reset the 24h staleness
  clock.
- It **copies `currentSprint` through unchanged** (no board query — §6.3c).
- On any sidecar ↔ index disagreement, the **sidecar wins** (§3.2); reindex is
  how you repair an index after a local hand-edit or a merge.

### 6.5 Resolving `orphaned` items (manifest key absent from remote)

`status_sync: orphaned` (§2.1, computed in §6.1 step 3 — the issue was deleted,
or moved to another project) was previously only _detected_. Left unresolved it
rots the mirror: a dangling `.md`, a `tree` parent pointing at a deleted child,
and a false "mirror feeding no requirement" traceability flag (§9). Disposition:

- `/jira-sync` **lists orphans explicitly** in its change report (never
  silently) and offers, per orphan: **(a) archive** → move the `.md` + `.json`
  to `jira/_orphaned/<KEY>.*` and drop it from `.manifest.json` (kept for
  history, excluded from the index/tree); **(b) delete** → remove the files +
  manifest entry; **(c) keep & re-check** → leave as-is for one cycle (the issue
  may be a transient permission/visibility blip, not a real deletion).
- Archived/deleted orphans are **removed from `_index.json.tree` and `items[]`**
  on the next reindex, and any parent that referenced the child has its
  `children[]` pruned — so no dangling tree edge survives.
- The §9 traceability check treats an **archived** orphan as an expected
  non-source (no "orphaned source" flag), but a still-**live** orphaned mirror
  file that feeds a spec is surfaced as a real problem to reconcile.
- **Never auto-delete.** Deletion is a human choice per orphan — a moved (not
  deleted) issue is recoverable by re-pulling under its new project, and silent
  deletion would lose local hand-edits.

---

## 7. Relationship mapping & search (no DB yet) — N12

- **`/jira map [<KEY>]`** emits a **Mermaid** graph from `_index.json.tree` +
  `links` (epic→story→task, blocks/relates edges). Whole-project map, or a
  subtree from `<KEY>`. Follows `@.claude/standards/mermaid-standards.md`
  (portable syntax, `classDef` theme, `accTitle`/`accDescr`).
- **`/jira search <query>`** is index-native: substring/field match over
  `items[]` summaries + sidecar fields, with the agent free-text-ranking
  results. Drills into `.md` bodies only for the top hits. No external index
  needed at EON scale.
- **Escalation (deferred):** past a few hundred issues, `scripts/jira-index.ts`
  can emit an `.ndjson`/SQLite sidecar for `/jira search`. Not built now —
  flagged in §3.4.

---

## 8. Write-back engine (reverse sync — local → JIRA, human-gated)

> **Delivered read-first (confirmed):** all read/query/index/search/map features
> (§4–§7) ship and stabilize in Phases 1–4. The write-back features below are
> **Phase 5+**, clearly gated.

Features **A / B / C** are **three entry points into one mutation pipeline** —
carried forward verbatim from the proven plan. One marker convention, one
conflict guard, one manifest-reconcile step.

```
  ENTRY                          SHARED ENGINE
  A: edited jira/<type>/KEY.md ─┐  1. DIFF / DRAFT   (A: field-scoped diff · B: draft from brief · C: gap-analysis → A-edits + B-creates)
  B: "brief" (no file)         ─┤  2. DRY-RUN PLAN   (interactive; nothing has touched JIRA yet)
  C: batch over index/subset   ─┘  3. APPROVE        (human; per-change / per-ticket)
                                    4. RE-CHECK       (universal re-run guard: re-fetch version; if advanced past sidecar → STOP, show 3-way)
                                    5. MUTATE         (createJiraIssue/editJiraIssue; B's SHA-256 key guards create; [CANS-SYNC] comment = audit trail, not A's re-run guard — §8.6)
                                    6. RE-PULL        (getJiraIssue → authoritative body)
                                    7. RECONCILE      (write mirror; contentHash=localEditsHash; bump version; status→clean; update manifest + reindex)
                                    8. SUGGEST        (if mirror feeds a spec/epic per specs/sources/manifest.json → PRINT suggestion to run /reconcile-requirements — never auto-run, R3)
```

### 8.1 Supporting state (carried forward)

1. **`specs/<name>/jira-mapping.json`** — durable per-spec local↔remote join
   (which local artifact became which EON key).
2. **`.claude/config/jira-sync.config.yml`** — policy: artifact→issue-type
   mapping, relationship types, status map, discovered `fields:` (from
   `/jira-discover-fields`), and the §6.2 `scope` block.
3. **`[CANS-SYNC|epic=…|version=…|run=…]` comment marker** — idempotent
   update-in-place; only the human-approved apply step mutates remote.

### 8.2 Feature A — push edited mirror → JIRA (`/jira-push <mirror-file>`)

**Description-only write** (§8.6): pushes the **pushable regions** —
`## Description` + the in-description AC checklist — and never
status/labels/links, which are **pull-only** (§2.4). The push payload is
computed from the pushable slice only; a hand-edit confined to a pull-only
region yields an empty pushable diff and is **reported-and-skipped** (§2.4), so
the human is told exactly which of their edits will not travel. Field-scoped
diff; interactive per-change plan; sub-task-vs-checklist choice for
testing/verification items.

**Idempotency for A is dual-hash + version, not the comment marker.** A writes
the JIRA **description field**, which cannot carry the `[CANS-SYNC]` comment
marker without polluting human-visible text, so A does **not** rely on the
marker for re-run safety (contrast Feature B, whose create path does —
§8.4/§8.6). A's re-run guard is the pipeline's own state:

1. Step 4 (RE-CHECK) re-fetches the issue `version` (and `remoteUpdatedAt`); if
   it advanced past the sidecar since the mirror was last synced, STOP and show
   a 3-way (local / mirror-base / remote) — the lost-update guard.
2. Step 7 (RECONCILE) sets `contentHash = localEditsHash` and bumps the stored
   version after a successful write. A **second** `/jira-push` on an unchanged
   file therefore computes an empty pushable diff
   (`localEditsHash == contentHash` for the pushable slice) → no-op, no
   duplicate write. A drops a **single audit comment** carrying
   `[CANS-SYNC|…|run=…]` per apply (for the human's timeline), but that comment
   is an audit trail, **not** the idempotency mechanism.

### 8.3 Feature A/B split — the "unit tests + a11y as ACs" case

A request like _"build the backend API; add unit tests and accessibility as
ACs"_ is **not one operation**. The dry-run offers the choice per clause:

- **requirement** → appended to `## Description`.
- **a11y as AC** → an AC checklist bullet (verification criterion).
- **unit tests** → **offer both**: (a) an AC bullet, or (b) a child testing
  **sub-task** (Feature B create path). Human picks per item.

### 8.4 Feature B — create from brief (`/jira-create "<brief>"`)

1. **Ambiguity review first** (`ambiguity-analyst`) — surfaces clarifying
   questions before drafting.
2. **Parent-epic resolution — suggest, but ALWAYS confirm.** Rank candidate
   epics by semantic match against `_index.json.tree`; **present the ranked list
   (key + title); human must pick.** Never auto-place — a wrong parent is
   expensive to move in JIRA.
3. **Issue type + required fields** via `getJiraIssueTypeMetaWithFields` (uses
   discovered `fields:`).
4. **Create from the returned key, never before:** dry-run → approve →
   `createJiraIssue` → real key → `getJiraIssue` → write
   `jira/<type>/<KEY>.md` + `.json` + manifest + reindex + marker.
5. **Crash-safe idempotency:** a pre-create **intent record** (manifest entry
   carrying a SHA-256 key derived from
   `brief + parent + a per-invocation nonce`) lets a retry detect "this brief
   already became EON-XXX" and resume at the local-write step. **The nonce is
   essential:** without it, two _legitimately distinct_ tasks drafted from
   near-identical briefs under the same parent would hash equal, and the second
   create would be wrongly suppressed as a "retry". The nonce is generated once
   when the intent record is written and threaded through the crash-recovery
   record, so a genuine retry re-uses the _same_ nonce (dedupes) while a new
   intentional create gets a _fresh_ one (proceeds). Never fabricate a JIRA key.
6. **Spec impact suggested** (offer to add to `specs/sources/manifest.json` +
   RTM Source) — never edited.

### 8.5 Feature C — batch enhance (`/jira-enhance [KEY, …]`)

C invents no new primitive — it is **A + B, batched**, with bulk guards:

1. **Read-analyze-suggest, never auto-apply.** Per-ticket approve/reject/edit.
   Strictest gate.
2. **Whole-picture context.** Suggestions consider whether `specs/` exists: if a
   ticket traces to a spec/epic (via `specs/sources/manifest.json`), align to
   that spec's language + DoD; else stay ticket-local.
3. **Decomposition** → each edit routes to A (description) or B (child task).
4. **Staleness + terminal-state safety:** per-ticket lost-update re-check;
   **skip Done/Closed** unless named.
5. **Run-manifest** `specs/.push-runs/<run_id>.json` for audit/rollback of a
   batch.
6. **Consolidated spec impact** — one reconcile suggestion for the whole batch.

### 8.6 Mutation-safety scoping & deliberately-declined ideas (carried forward)

| Guard                                          | Lives in                                  | Why there — and why NOT the universal re-run guard                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dual-hash + version re-check** (steps 4 + 7) | **all three entry points**                | The _actual_ universal re-run guard. Every write path re-checks `version` before mutating (lost-update) and reconciles `contentHash = localEditsHash` after, so a repeat of the same operation is a no-op. This — not the comment marker — is what makes every path idempotent.                                                         |
| SHA-256 idempotency key                        | `/jira-create` crash-safety (Feature B)   | Only a **create** can duplicate a whole issue, and only a create has no prior sidecar `version` to re-check against — so B needs a pre-create intent key on top of the dual-hash guard.                                                                                                                                                 |
| Run-manifest                                   | `/jira-enhance` bulk audit (Feature C)    | Only a **batch** has rollback-worthy blast radius.                                                                                                                                                                                                                                                                                      |
| `[CANS-SYNC]` comment marker                   | **B (create-stamp) + audit trail on A/C** | Lives in a **comment**, so it can annotate a create (B) and leave an audit breadcrumb on any apply, but it is **NOT** the re-run guard for Feature A — A writes the description field, which the marker cannot occupy without polluting human text (§8.2). Treat the marker as an audit/traceability aid, not an idempotency primitive. |

**Declined (reasoning preserved):** whole-issue write (mirror is lossy ADF→MD →
description-only); status transitions in write path (`transitionJiraIssue` is a
separate API surface → status stays pull-only); auto-place parent
(suggest-but-confirm); auto-run reconcile after push (violates R3 — suggest
only).

---

## 9. Traceability (`specs/sources/manifest.json`) + RTM Source column

Unchanged in intent. Each spec section/epic links back to the **local mirror
file** (and via its `.json` to remote key+version):

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

**RTM Source column — MANDATORY.** Every requirement derived from a JIRA issue
MUST record its originating mirror file (`jira/<type>/<KEY>.md`, remote key in
parentheses) in the RTM Source column. `/create-specifications` populates it on
first gen; `/reconcile-requirements` keeps it current. Consistency flags: mirror
feeding no requirement → **orphaned source**; requirement with no source (not
from a raw file) → **untraced requirement**.

---

## 10. Phased delivery (read-first — confirmed)

| Phase                         | Scope                                                                                                                                                                                                                                                                                                                                                              | Exit criteria                                                                                                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0 — Foundations**           | `manifest.schema.json` (domain + per-item sidecar + per-epic manifest + `_index.json` + shared `people.json` schemas); JIRA→MD converter **emitting the §2.4 region markers**; hash util (whole-body detect + pushable-slice payload); `.claude/config/jira-sync.config.yml` skeleton with §6.2 scope; **gitignore `jira/_index.json` (§3.5)**. **No de-id (R1).** | Schemas checked in; converter unit-tested on EON-27 + one epic, **including round-trip of the pushable/pull-only markers**.                                                                                                                           |
| **1 — Init & ingest**         | `/jira-init` (fresh + drift branches, **board resolution + sprint-shape + `epicLinkStrategy` discovery**, empty-mirror preview), `/jira-discover-fields`, `/jira-add-issue`, `/jira pull <EPIC>`.                                                                                                                                                                  | `/jira-init` scaffolds tree, resolves the canonical board + current sprint, seeds `people.json`; `/jira pull EON-21` mirrors epic + all children into type folders with correct sidecars + per-epic manifest.                                         |
| **2 — Sync & index**          | `/jira-sync` (dual-hash diff, remote-epic discovery, per-epic child discovery, backlog-aware scope, **orphan disposition §6.5**), `/jira reindex` → derived `_index.json` (**offline; `generatedAt` only, §6.4**).                                                                                                                                                 | A remote edit shows `remote-ahead`; a local edit `local-ahead`; a new remote epic prompts add; an orphan offers archive/delete/re-check; a reindex leaves `lastSyncedAt` untouched; `_index.json` regenerates deterministically and matches sidecars. |
| **3 — NL query layer**        | `jira-helper` subagent + `/jira` router family (`search`, `sprint`, `backlog`, `who`, `gap`, `map`), alias resolution, 24h staleness check.                                                                                                                                                                                                                        | All §5.3 example prompts answered from `_index.json`; vague prompts trigger multi-choice clarification; stale mirror prompts a sync. `claude --agent jira-helper` works as optional mode.                                                             |
| **4 — Generate & reconcile**  | `jira` folder wired into `/create-specifications` (R4); `/reconcile-requirements <path\|url>`; RTM Source column.                                                                                                                                                                                                                                                  | Multi-folder gen consumes `jira/` + seeds traceability; a mirror edit + reconcile updates exactly the traced epics.                                                                                                                                   |
| **5 — Push (specs→JIRA)**     | `/jira-push [--spec]` — builds the shared engine (§8). Dry-run-first.                                                                                                                                                                                                                                                                                              | Dry-run shows create/update plan; apply creates EON issues; re-run updates, no dupes.                                                                                                                                                                 |
| **5A — Push (edited mirror)** | **Feature A** `/jira-push <mirror-file>` — description-only.                                                                                                                                                                                                                                                                                                       | Hand-edit `jira/stories/EON-123.md` → description-only diff → in-place update; sidecar reconciled; pull-only edits reported-and-skipped.                                                                                                              |
| **5B — Create (brief)**       | **Feature B** `/jira-create "<brief>"` — ambiguity → confirm parent → create → mirror.                                                                                                                                                                                                                                                                             | Brief creates one EON issue under a human-picked parent; crash-then-retry resumes at local-write (no dupe).                                                                                                                                           |
| **5C — Enhance (batch)**      | **Feature C** `/jira-enhance [KEY,…]` — spec-aware gap analysis → A + B, guarded.                                                                                                                                                                                                                                                                                  | Batch over ≥2 tickets: per-ticket approval, Done/Closed skipped, run-manifest lists every key, one consolidated reconcile suggestion.                                                                                                                 |
| **6 — Docs**                  | **Produce `docs/JIRA-OPERATING-GUIDE.md`** (see §12) + cadence/cost notes.                                                                                                                                                                                                                                                                                         | Guide covers commands, the `jira-helper` agent, the write-back engine's 8 steps + A/B/C entry points, staleness, aliases, and worked scenarios.                                                                                                       |

---

## 11. Critical review — gaps & fixes (this plan's additions on top of the carried-forward set)

| Gap / flaw                                                     | Consequence                                                                                                                  | Fix                                                                                                                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Third-source-of-truth drift** (Challenge #1)                 | Children metadata in 3 files diverges                                                                                        | `_index.json` is **derived/regenerable** (§3.2); per-item sidecars authoritative; identity in `people.json`, never regenerated.                                 |
| **Single-JSON per item** (Challenge #2)                        | Noisy escaped-string git diffs; lost human-readability                                                                       | **Hybrid `.md` + `.json`** (§2.1); folder-by-type layout adopted.                                                                                               |
| **Undefined "what counts as a sync"** (Challenge #3)           | Staleness check has no anchor                                                                                                | `_index.json.lastSyncedAt` is the single defined timestamp; refreshed by any successful pull (§5.4).                                                            |
| **Session-locking startup agent** (Challenge #4)               | Heavyweight; hijacks session                                                                                                 | Subagent + thin `/jira` router; `claude --agent` optional (§5).                                                                                                 |
| **Backlog invisible to JQL** (Challenge #5)                    | "pending backlog" queries miss unparented items                                                                              | Backlog-aware split scope (§6.2, N11).                                                                                                                          |
| **Index staleness after a local hand-edit**                    | `_index.json` shows old summary                                                                                              | `/jira reindex` (and every `/jira-sync`) rebuilds from sidecars; sidecar wins on disagreement.                                                                  |
| **New assignee not in identity file**                          | Alias query "who is X" fails                                                                                                 | Sync appends unknown assignees with empty `aliases: []` (additive, non-destructive) to the shared `people.json` (§3.6); human fills aliases.                    |
| **`_index.json` grows too large**                              | Single-context load strains tokens                                                                                           | Deferred escalation to `scripts/jira-index.ts` + search sidecar (§3.4) — flagged, not premature.                                                                |
| **Feature A idempotency mis-attributed to the comment marker** | The `[CANS-SYNC]` marker can't live in the description field A writes → the claimed "universal re-run guard" doesn't cover A | Idempotency for **all** paths is the **dual-hash + version re-check** (steps 4+7); the marker is an audit trail, not A's guard (§8.2, §8.6 table corrected).    |
| **Flat `.md` mixes pushable + pull-only fields**               | A stray edit under `## Links`/`## Status` could be silently pushed, or block a description push                              | **Region partitioning** on stable heading anchors + HTML markers (§2.4): pushable = Description/ACs; pull-only = Status/Links/Comments, reported-and-skipped.   |
| **Sprint mechanics hand-waved**                                | Sprint drives ~40% of prompts but parsing, board scope, and multi-board were unspecified                                     | **§6.3 resolved:** parse the custom field by discovered shape; "current sprint" = a single canonical board's active sprint; multi-board/no-board cases defined. |
| **`reindex` vs `pull` timestamp conflation**                   | A local reindex could reset the 24h staleness clock                                                                          | **Invariant (§3.2, §6.4):** reindex updates `generatedAt` only; `lastSyncedAt` moves on pull alone.                                                             |
| **Committed derived index → churn + merge conflicts**          | Every sync diffs the index; two syncers conflict on machine JSON                                                             | **Gitignore `_index.json`** (§3.5); rebuild with `/jira reindex`. Committed `.md` + sidecars keep review value.                                                 |
| **Duplicated identity across 3 plans**                         | `abbasqa`/`abbas` defined in 3 hand-synced files → drift                                                                     | **One shared `.claude/config/people.json`** (§3.6); agents read it directly.                                                                                    |
| **`orphaned` detected but never resolved**                     | Dangling `.md`, broken tree edges, false traceability flags                                                                  | **§6.5 disposition:** archive / delete / re-check per orphan; never auto-delete; index/tree pruned on reindex.                                                  |
| **Multi-user mirror sync on a shared repo**                    | Sidecar/manifest merge conflicts between branches                                                                            | **§3.5 posture:** mirror is a remote cache → re-pull after merge (JIRA settles the truth); never hand-merge a sidecar.                                          |
| **Classic vs team-managed epic-link JQL**                      | Wrong field literal silently returns nothing                                                                                 | `epicLinkStrategy` flag discovered at init (§6.2); JQL templated from it (§4.3).                                                                                |

---

## 12. MANDATORY final deliverable — `docs/JIRA-OPERATING-GUIDE.md`

> **After implementing the JIRA features (Phase 6), create
> `docs/JIRA-OPERATING-GUIDE.md`.** It is the human's single reference for
> operating the JIRA integration. It MUST cover:

1. **Overview** — the four state layers (§1) and the ingest ≠ generate ≠
   reconcile ≠ push rule.
2. **The `jira-helper` agent** — what it does, what it loads (`_index.json` +
   `people.json`), when it drills into `.md` files, and how to run it as an
   optional `claude --agent jira-helper` session.
3. **Every command** — one row each: what it does, inputs, what it writes,
   whether it mutates remote. Group as: init/ingest (`/jira-init`,
   `/jira-add-issue`, `/jira pull`, `/jira-discover-fields`), sync/index
   (`/jira-sync`, `/jira reindex`), query (`/jira`, `search`, `sprint`,
   `backlog`, `who`, `gap`, `map`), write-back (`/jira-push`, `/jira-create`,
   `/jira-enhance`).
4. **Aliases & identity** — how the shared `.claude/config/people.json` works
   (§3.6) and how to add an alias.
5. **Staleness & the timestamp invariant** — the 24h rule, what "counts as a
   sync", and why `/jira reindex` never resets it (§6.4).
6. **Scenarios & examples** — walk through the §5.3 prompts end-to-end (input →
   clarifying questions → answer/action), plus a full "create a ticket",
   "enhance john's tickets", and "gap-analyze EON-123" walkthrough, and the
   recommended daily/weekly sync cadence.
7. **Write-back safety** — dry-run-first, lost-update guard (version+dual-hash —
   the real idempotency mechanism, §8.2/§8.6), terminal-state skip,
   run-manifest, and the **region rule** (§2.4: only Description + ACs push;
   Status/Links/Comments are pull-only and reported-and-skipped) — so a human
   knows exactly what a mutation will and won't touch.

---

## 13. Decision log (this plan)

- **D1** Hybrid per-item format: `.md` body + `.json` sidecar; folder-by-type
  tree (N1/N2).
- **D2** `_index.json` is a **derived, regenerable rollup**; per-item sidecars
  are authoritative (N4, Challenge #1).
- **D3** Identity is in `.claude/config/people.json`; aliases are local-only
  (N5).
- **D4** Per-epic manifest `jira/epics/{EPIC}.json` carries the children
  roster + `childrenHash` for child-drift detection (N3).
- **D5** `jira-helper` is a **subagent** + thin `/jira` router; startup mode
  optional (N9, Challenge #4).
- **D6** 24h staleness anchored on `_index.json.lastSyncedAt`; any successful
  pull refreshes it (N10, Challenge #3).
- **D7** Backlog-aware split JQL scope (epics+children / backlog /
  current-sprint) (N11, Challenge #5).
- **D8** Read/query/index/search delivered **first** (Phases 1–4); write-back
  gated to Phase 5+ (confirmed).
- **D9** Write-back engine, description-only write, mutation-safety scoping, and
  declined ideas carried forward verbatim from the proven plan (§8).
- **D10** Relationship map + search are index-native now; DB/search-sidecar
  escalation deferred (N12, §3.4).
- **D11** Final deliverable: `docs/JIRA-OPERATING-GUIDE.md` (§12).

### Post-review additions (this revision — resolving the critical review)

- **D12** **Region partitioning (§2.4).** The mirror `.md` is split by stable
  `##` heading anchors + `<!-- pushable -->` / `<!-- pull-only -->` markers into
  pushable (Description, ACs) and pull-only (Status, Links, Comments) regions;
  unknown sections default to pull-only (fail safe).
- **D13** **Idempotency is dual-hash + version, not the marker (§8.2, §8.6).**
  The universal re-run guard across A/B/C is the RE-CHECK/RECONCILE version+hash
  cycle. The `[CANS-SYNC]` comment is an audit trail; Feature A does not (and
  cannot) rely on it. Feature B's create adds a SHA-256 intent key **with a
  per-invocation nonce** so near-identical briefs don't false-dedupe (§8.4).
- **D14** **Sprint mechanics resolved (§6.3).** Sprint parsed from the
  discovered custom field by recorded shape; "current sprint" = the active
  sprint of a single canonical **board** resolved at init; multi-board and
  no-active-sprint cases defined.
- **D15** **Reindex is strictly offline; timestamp invariant (§3.2, §6.4).**
  `/jira reindex` updates `generatedAt` only and copies `currentSprint` through;
  `lastSyncedAt` moves on a remote pull alone.
- **D16** **`_index.json` is gitignored (§3.5)** (reverses the earlier "commit
  it" lean) to avoid per-sync churn and machine-JSON merge conflicts; rebuilt on
  demand. Mirror sync treated as a fast-forward-on-`main` cache operation —
  re-pull to resolve conflicts, never hand-merge a sidecar.
- **D17** **Single shared identity file (§3.6)** — `.claude/config/people.json`,
  canonical id + per-tool handles; agents read it directly. Reverses the
  cross-plan "defer + hand-sync" choice. **Requires coordinated adoption across
  `01a`/`01b`/`02` (see cross-plan note).**
- **D18** **`orphaned` disposition (§6.5)** — per-orphan archive / delete /
  re-check; never auto-delete; index + tree pruned on reindex. Plus
  `epicLinkStrategy` (parent vs "Epic Link") discovered at init and used to
  template all epic-scoped JQL (§6.2/§4.3).

> **Cross-plan coordination (D17).** The shared `people.json` and the "gitignore
> the derived index" decision (D16) both have analogues in `01b` (Confluence
> `confluence/_index.json`) and `02` (Figma `figma/_index.json`). Those plans
> currently defer/commit the opposite way. **These three decisions must land
> together** or the drift they're meant to prevent reappears across tools.
> Recommend a short follow-up pass to align `01b` and `02` to D16/D17.

## 14. Recommended first step

Implement Phase 0 + `/jira-init` (fresh branch) against project EON and run
`/jira pull EON-21` to validate the converter, the hybrid `.md`+`.json` shape,
the per-epic manifest, and the derived `_index.json` on real content before
building the sync diff engine and the NL layer.
