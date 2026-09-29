---
description: >
  Shared reference — the ONE 8-step, human-gated, dry-run-first mutation pipeline that
  `/confluence push` (A), `/confluence create` (B), and `/confluence enhance` (C) all enter. Not a
  standalone command: it is the reusable instruction prose those three verbs reference so the engine
  is authored once. Steps 4 (version re-check / lost-update guard) and 7 (reconcile) are the
  correctness core; the idempotency guarantee for ALL THREE paths is the dual-hash + version
  re-check, NOT the `[CANS-SYNC]` version-message marker. This is the FIRST surface that mutates
  remote Confluence — every write is section-scoped, dry-run-first, and lost-update-guarded.
agent: build
subtask: true
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: medium
---

# confluence-write-engine — the shared 8-step mutation pipeline

> **Referenced by** `/confluence push` (A), `/confluence create` (B), `/confluence enhance` (C). Do
> not invoke directly; a caller enters at Step 1 with its own DIFF/DRAFT source, runs the identical
> Steps 2–8, and applies its own extra guard. This file is the single definition of the engine — the
> three verbs describe only their distinct **step 1** and their distinct guard, then point here.
> Twin of `.claude/commands/jira-write-engine.md`; same pipeline, Confluence tools + semantics.

## The one idempotency truth (read first)

**Idempotency for A, B, and C is the dual-hash + version re-check (Steps 4 + 7) — NOT the
`[CANS-SYNC]` version-message marker.**

- Step 4 re-fetches the remote `version.number`. If it advanced past the sidecar's stored version
  since the last pull ⇒ **STOP** and show a 3-way diff (local edit / mirror-base / remote). This is
  the lost-update guard.
- Step 7 sets `contentHash = localEditsHash` and stores the bumped remote `version.number`. A repeat
  of the same operation then computes an **empty pushable diff ⇒ no-op**, no duplicate write.
- The `[CANS-SYNC|page={id}|version={n}|run={uuid}]` marker rides in the **version message** (the
  edit-comment field of `updateConfluencePage`/`createConfluencePage`), **never in the page body** —
  putting it in the body would pollute human-visible prose and travel on the next push. It is an
  **audit breadcrumb** in the page's version history, not the re-run guard.

## Contract (reuse Phase 0–3 scripts + router paths — do NOT re-implement)

Connection + MCP tool mapping — `scripts/confluence/mcp-client.ts`:
`CONNECTION` (cloudId `998e78d7-2a66-4fc0-809b-b43b4232d4b8`, site `commbank.atlassian.net`),
`MCP_CONTRACT` (`getPage`, `descendants`, `footerComments`, `inlineComments`, `searchCql`, and the
write steps `createPage`, `updatePage`), `spaceScopeCql`, `pageByIdCql`, `cqlStr`.

Transform — `scripts/confluence/converter.ts`: `convertItem`, `mdBody`, `preserveMacros`,
`normalizeHeadings`, `rosterItem`, `bodyRelPath`, `itemKey`, `typeFolder`.

Hashing / regions — `scripts/confluence/hash.ts`: `partitionRegions`, `pushablePayload`,
`hashPushable`, `hashBody`, `hashTree`, `cmpNumericKey`, `sha256`.

Config — `.claude/config/confluence-sync.config.yml`: `cloudId`, `site`, `stalenessHours` (24),
`pullComments` (true), `unresolvedAliasPolicy` (`ask`), `spaces[]` (SEC, PCON).

MCP mutation tools (Claude invokes directly; **auth brokered by the session — no secrets**, cloudId
is the pinned `CONNECTION.cloudId`):
`mcp__atlassian__updateConfluencePage`, `mcp__atlassian__createConfluencePage`,
`mcp__atlassian__getConfluencePage`, `mcp__atlassian__getConfluencePageDescendants`.

**Reuse, don't duplicate:**
- Single-item idempotent local write + never-clobber gate = **`/confluence pull` Step 4** (the
  do-not-clobber gate in `confluence.md`). Every mirror body/sidecar the engine writes goes through
  that gate (recompute `localEditsHash = hashBody(mdBody(on-disk .md))`; a hand-edit is never
  clobbered).
- Page + subtree re-pull = **`/confluence pull <pageId>`** (`confluence.md` §pull).
- Offline index rollup = **`/confluence reindex`** (`node_modules/.bin/tsx scripts/confluence/reindex.ts`).

### Hashing note (critical — must match the converter)

`localEditsHash` = `hashBody(mdBody(<on-disk .md>))`. The converter strips the H1 title via
`mdBody()` **before** `hashBody()`. When recomputing from disk you MUST apply `mdBody()` first, then
`hashBody()`, or a title rename reads as a false local edit. The **push-diff key** is
`hashPushable(mdBody(body))` — the hash of only the pushable slice
(`pushablePayload(partitionRegions(...))`).

### Section-anchor rewrite rule (the load-bearing write discipline)

A push rewrites **only** the `## ` sections inside `<!-- pushable -->` regions, on their stable
heading anchors. Concretely:

1. `partitionRegions(mdBody(md))` classifies every `##` region as `pushable` or `pull-only`
   (`hash.ts`). Confluence is **pushable-by-default** for authored prose; `## Comments` and
   `## Metadata` are pull-only; `<!-- pull-only -->` / `<!-- pushable -->` markers are authoritative.
2. The body sent to Confluence is rebuilt from the **pushable regions only** (`pushablePayload`),
   re-mapped onto the live page so pull-only regions and opaque `` ```macro `` fences are preserved
   **byte-for-byte** — the write never touches them. `## Comments` and `## Metadata` are mirror
   projections of remote state; they are never authored back.
3. Because `getConfluencePage`/`updateConfluencePage` operate on `contentFormat:"markdown"` and the
   converter is round-trip safe (macros fenced, headings normalized), the pushable slice round-trips
   without disturbing the untouched regions. If a pushable edit cannot be expressed without rewriting
   a macro fence, **STOP and report** — never rewrite a macro.

### Crash-safe intent record (written BEFORE any mutation)

The `confluence/.manifest.json` schema is `additionalProperties:false`, so intent records live in a
sibling run store, **not** in the manifest: `confluence/.push-runs/<run_id>.json`. Written **before**
Step 5, fsync-durable, so a crash mid-push is recoverable and idempotent. Schema:

```json
{
  "run_id": "<timestamped id>",
  "run_uuid": "<uuid, generated once this invocation>",
  "verb": "push | create | enhance",
  "startedAt": "<iso>",
  "target": {
    "pageId": "<id | null for a create>",
    "spaceKey": "<SPACE>",
    "fromVersion": "<sidecar version.number | null for a create>",
    "sectionAnchors": ["## Body", "..."],
    "pushableHashBefore": "sha256:…"
  },
  "intentKey": "sha256:…",
  "marker": "[CANS-SYNC|page=<id|new>|version=<n|0>|run=<run_uuid>]",
  "resolvedPageId": "<id once created — null until the create returns>",
  "state": "pending | mutated | reconciled | aborted",
  "finishedAt": "<iso | null>"
}
```

- **A / C (existing page):** `intentKey = sha256(pageId + " " + fromVersion + " " + pushableHashBefore)`.
  On re-entry, a matching **`state:"mutated"`** record ⇒ the write landed; resume at **Step 6**
  (re-pull) — no second write. A matching **`state:"pending"`** record ⇒ redo Step 4's re-check
  (the write may or may not have landed; the version re-check + pushable diff decide).
- **B (create):** `intentKey = sha256(spaceKey + " " + title + " " + parentId + " " + run_uuid)`. The
  `run_uuid` (generated **once** this invocation, threaded through the record) is what distinguishes
  two near-identical create briefs under the same parent. A **genuine retry** re-uses the same
  `run_uuid` (dedupe); a **new intentional create** gets a fresh one. On re-entry: `state:"mutated"`
  with a `resolvedPageId` ⇒ resume at **Step 7** local-write; `state:"pending"` ⇒ query whether the
  create landed (search the space for the title) before re-issuing.

---

## The 8 steps

### Step 1 — DIFF / DRAFT (caller-specific — the only step that differs)

The single point of variation between A, B, and C. Each caller produces, for each intended change, a
normalized **change intent**:
`{ pageId?, spaceKey, title?, parentId?, pushablePayload, pull_only_edits[], fromVersion? }`.

- **A (`/confluence push`)** — source is a hand-edited `confluence/{pages,blogposts}/{SPACE}-{id}.md`.
  Compute the diff over the **pushable slice only**: `partitionRegions(mdBody(md))` →
  `pushablePayload(...)`. Capture any edits confined to pull-only regions (`## Comments`,
  `## Metadata`) separately as `pull_only_edits[]` (reported-and-skipped downstream).
- **B (`/confluence create`)** — source is a local Markdown body (`--from <file>`) or a drafted body.
  Draft `{ spaceKey, title, parentId, pushablePayload }` after the ambiguity review + parent
  confirmation the command owns. No `fromVersion` (new page).
- **C (`/confluence enhance`)** — source is AI-proposed improvements confined to `pushable` sections.
  Generate the proposed prose first, splice it into the mirrored body's pushable regions, then diff
  it exactly as an **A-edit** (existing page) — enhancement is *proposal → same gated pipeline*, never
  a direct write.

If the resulting pushable diff is empty **and** there is no create intent ⇒ this change is a
**no-op**; report it (for A/C, list any `pull_only_edits[]` that will not travel) and skip Steps 2–8.

### Step 2 — DRY-RUN PLAN (nothing has touched Confluence)

Render the change without mutating anything:
- **A/C-edit:** `pageId` + title · per-section **before/after** unified diff for each **pushable**
  `##` anchor · the exact Markdown body that will be sent to `updateConfluencePage` · an explicit
  **"untouched (preserved)"** list naming every pull-only region and every `` ```macro `` fence that
  will survive byte-for-byte · a **"pull-only edits skipped"** list if the human also edited a
  mirror-only region.
- **B-create:** target `spaceKey` · `title` · resolved `parent (id + title)` · the rendered body ·
  the fact that this is a create (no version lock).
This is presentation only — no MCP write tool is called.

### Step 3 — APPROVE (human)

Per-change (A/B) or per-page (C) approval via `AskUserQuestion`: **[Apply / Edit selection / Cancel]**.
`Edit` loops back to Step 1 for that change with the human's revision. **Nothing proceeds without an
explicit Apply.** No batch-wide "apply all" — each change is its own gate (C's run-manifest records
the per-page decision).

### Step 4 — RE-CHECK (the lost-update guard — get this exactly right)

Immediately before any mutation, for each approved change targeting an **existing** page:
1. `mcp__atlassian__getConfluencePage { cloudId: CONNECTION.cloudId, pageId, contentFormat: "markdown" }`
   (`MCP_CONTRACT.getPage`) — read the **current** `version.number` and body.
2. Compare against the sidecar's stored `version.number`.
   - **Unchanged** (remote version == sidecar version) ⇒ safe to mutate; continue to Step 5.
   - **Advanced** (remote version > sidecar version) ⇒ someone changed the page since the last pull.
     **STOP this change. Do NOT mutate.** Show a 3-way diff — **local** (the edited/enhanced mirror
     body) · **mirror-base** (sidecar `contentHash` body) · **remote** (just-fetched authoritative
     body). Offer: pull remote first (route to `/confluence pull <pageId>`) then re-diff + re-approve,
     or abandon this change. **Never silently overwrite** — this is the `diverged` case in the
     `status_sync` table.

For **B-create** there is no existing page; Step 4 instead re-checks the **crash-safe intent record**
(above) — if this brief already became a real page (search the space for the title, or a `mutated`
record carries a `resolvedPageId`), resume at Step 6/7 for that page (no second create). A create has
no version to lock.

### Step 5 — MUTATE (the only step that writes to Confluence)

Write the intent record (`state:"pending"`) **before** this call, then:

- **A/C-edit:** `mcp__atlassian__updateConfluencePage { cloudId, pageId, title, body,
  contentFormat: "markdown", versionMessage: "<marker>" }` (`MCP_CONTRACT.updatePage`). `body` is the
  section-scoped rewrite (pushable regions rebuilt, pull-only + macro fences preserved). The MCP
  supplies the required `version.number` bump (locked to the Step-4-verified current version + 1);
  pass the current version if the tool requires it explicitly. **Section-scoped only** — never rewrite
  a pull-only region or a macro fence.
- **B-create:** `mcp__atlassian__createConfluencePage { cloudId, spaceId, title, body, parentId?,
  contentFormat: "markdown" }` (`MCP_CONTRACT.createPage`). The real `pageId` comes from the response
  — **never fabricate a pageId**; write nothing locally until it returns. Immediately persist the
  `resolvedPageId` into the intent record.
- **Marker (both):** the `[CANS-SYNC|page={id}|version={n}|run={run_uuid}]` string goes in the
  **version message / edit comment** — never the body. Trail only, never the re-run guard. On success,
  set the intent record `state:"mutated"`.

### Step 6 — RE-PULL (fetch the authoritative body)

`mcp__atlassian__getConfluencePage { cloudId, pageId: <edited-or-created id>,
contentFormat: "markdown" }` — and, when `config.pullComments`, the footer + inline comments via
`getConfluencePageFooterComments` / `getConfluencePageInlineComments`. The remote is now the source of
truth for what to mirror — do not assume the write landed byte-identical (Confluence re-renders
storage format on save).

### Step 7 — RECONCILE (write the mirror; make the next run a no-op)

Convert the re-pulled page with `convertItem(page, cfg, nowIso)` (`converter.ts`) and write via the
**`/confluence pull` Step-4 do-not-clobber gate**. The fresh sidecar MUST set:
- `contentHash = localEditsHash` (both = `hashBody(mdBody(newBody))`) — **so a repeat push is an empty
  pushable diff**;
- `version.number` = the bumped remote version from Step 6; `version.when` / `version.byId` from remote;
- `status_sync = "clean"`; `lastSyncedAt = nowIso` (a genuine remote re-pull happened in Step 6).

Then:
- update `confluence/.manifest.json` `items[{SPACE}-{id}]` pointer (for B, add the new item; the
  manifest schema is `additionalProperties:false` — write only the allowed pointer fields);
- rebuild the per-space `confluence/spaces/{SPACE}.json` roster + recompute `treeHash` via
  `hashTree(roster)` (`hash.ts`);
- append any newly-seen comment/version author to `.claude/config/people.json` **additively**
  (`aliases: []`, `confluence: <handle>` only when the MCP returns one — **never invent** an
  accountId);
- run **`/confluence reindex`** to regenerate `_index.json` (never hand-edit the index). Reindex sets
  `generatedAt = now` and carries `lastSyncedAt` through unchanged from the newest sidecar (the
  Step-6 pull time) — the two-timestamp invariant holds.

Finally set the intent record `state:"reconciled"`, `finishedAt = now`.

### Step 8 — SUGGEST (never auto-run — R3)

If the reconciled page feeds a spec — look it up in `specs/sources/manifest.json` (if that file is
absent, there is no mapping ⇒ skip silently) — **PRINT** a suggestion, e.g.:

> This change touched `PCON-2042342654` (*NTB POBO — temporary credentials*), which sources
> `specs/<name>/…`. Consider running `/reconcile-requirements @specs/<name>` to realign the
> requirement docs.

**Never run `/reconcile-requirements` automatically.** C emits **one** consolidated suggestion for the
whole batch; A/B emit one per applied change. Synthesized/enhanced content is a Confluence page — it is
**never** written to `specs/`; the mirror boundary is `confluence/` (+ `confluence/.push-runs/`).

---

## Guardrails (apply on every path)

- **Dry-run first, always** — nothing touches Confluence before an explicit human Apply (Step 3), and
  the dry-run shows the exact per-section before/after plus the preserved (untouched) regions.
- **Lost-update guard = Steps 4 + 7** (version re-check + reconcile). The `[CANS-SYNC]` version-message
  marker is an audit trail, not the re-run guard. A remote version advance ⇒ 3-way diff, re-pull,
  re-approve; **never blind-overwrite**.
- **Section-scoped writes only** — only `pushable` `##` sections are rewritten. `## Comments`,
  `## Metadata`, `<!-- pull-only -->` regions, and `` ```macro `` fences are **inviolate** and survive
  every round-trip byte-for-byte.
- **Never fabricate a pageId** — B writes locally only from the `createConfluencePage` response.
- **Never auto-place a parent** — B always confirms (its own guard).
- **Crash-safe** — intent record in `confluence/.push-runs/<run_id>.json` written before every mutate;
  a retry resumes at re-pull/reconcile with no duplicate page or double write.
- **R3 — mutate Confluence only** — writes land under `confluence/` (mirror + `.push-runs/`),
  `.claude/config/people.json` (additive); **never** into `specs/`.
  Step 8 only **suggests** `/reconcile-requirements` — never runs it.
- **No secrets** — the MCP session brokers auth; cloudId is the pinned `CONNECTION.cloudId`. Never echo
  a secret into a page body or a version message.
- **Declined — do not re-introduce:** whole-page overwrite (writes are section-scoped, pull-only +
  macros preserved); rewriting a macro fence to express a pushable edit (STOP + report instead);
  auto-place parent; auto-reconcile after push.
