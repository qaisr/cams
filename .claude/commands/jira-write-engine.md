---
description: >
  Shared reference — the ONE 8-step, human-gated, dry-run-first mutation pipeline that `/jira-push`
  (A), `/jira-create` (B), and `/jira-enhance` (C) all enter. Not a standalone command: it is the
  reusable instruction prose those three commands reference so the engine is authored once. Steps
  4 (version re-check / lost-update guard) and 7 (reconcile) are the correctness core; the idempotency
  guarantee for ALL THREE paths is the dual-hash + version re-check, NOT the `[CANS-SYNC]` comment.
agent: build
subtask: true
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: medium
---

# jira-write-engine — the shared 8-step mutation pipeline

> **Referenced by** `/jira-push` (A), `/jira-create` (B), `/jira-enhance` (C). Do not invoke directly;
> a caller enters at Step 1 with its own DIFF/DRAFT source, runs the identical Steps 2–8, and applies
> its own extra guard. This file is the single definition of the engine — the three commands describe
> only their distinct **step 1** and their distinct guard, then point here.

## The one idempotency truth (read first — §8.2 / §8.6)

**Idempotency for A, B, and C is the dual-hash + version re-check (Steps 4 + 7) — NOT the
`[CANS-SYNC]` comment marker.**

- Step 4 re-fetches the remote `version`. If it advanced past the sidecar's stored version since the
  last sync ⇒ **STOP** and show a 3-way diff (local edit / mirror-base / remote). This is the
  lost-update guard.
- Step 7 sets `contentHash = localEditsHash` and bumps the stored `version`. A repeat of the same
  operation then computes an **empty diff ⇒ no-op**, no duplicate write.
- The `[CANS-SYNC|epic=…|version=…|run=…]` comment is an **audit breadcrumb** in the issue timeline.
  It cannot live in the `description` field Feature A writes without polluting human-visible text, so
  **A must not rely on it for re-run safety.** Drop it as a trail only.

## Contract (reuse Phase-0 scripts + router paths — do NOT re-implement)

Connection + MCP tool mapping — `scripts/jira/mcp-client.ts`:
`CONNECTION` (cloudId `998e78d7-2a66-4fc0-809b-b43b4232d4b8`, site `commbank.atlassian.net`, project
`EON`), `MCP_CONTRACT` (`editIssue`, `createIssue`, `getIssue`, `discoverFields`, `addComment`,
`getTransitions`).

Transform — `scripts/jira/converter.ts`: `convertItem`, `convertEpic`, `adfToMarkdown`, `mdBody`,
`parseSprint`.

Hashing / regions — `scripts/jira/hash.ts`: `partitionRegions`, `pushablePayload`, `hashPushable`,
`hashBody`, `hashRoster`, `sha256`.

Config — `.claude/config/jira-sync.config.yml`: `project`, `epicLinkStrategy: parent`,
`artifactFolders` (Epic→epics/ Story→stories/ Task→tasks/ Bug→bugs/ Dependency→tasks/), `fields.*`
(sprint `customfield_10900` object, storyPoints `customfield_10908`, acceptanceCriteria
`customfield_11500`), `statusCategory` map, `board.id: 78047`, `stalenessHours: 24`.

MCP mutation tools (Claude invokes directly; **auth brokered by the session — no secrets**, cloudId
is the pinned `CONNECTION` value):
`mcp__atlassian__editJiraIssue`, `mcp__atlassian__createJiraIssue`, `mcp__atlassian__getJiraIssue`,
`mcp__atlassian__getJiraIssueTypeMetaWithFields`, `mcp__atlassian__addCommentToJiraIssue`.

**Reuse, don't duplicate:**
- Single-item idempotent local write + never-clobber gate = **`/jira-add-issue` Step 4**. Every
  mirror body/sidecar the engine writes goes through that gate.
- Epic + children re-pull = **`/jira pull <EPIC>`** (`jira.md` §4.3).
- Offline index rollup = **`/jira reindex`** (runs `node_modules/.bin/tsx scripts/jira/reindex.ts` if
  present; else the inline rollup).

### Hashing note (critical — must match the converter)

`localEditsHash` = `hashBody(mdBody(<on-disk .md>))`. The converter strips the H1 title via `mdBody()`
**before** `hashBody()`. When recomputing from disk you MUST apply `mdBody()` first, then `hashBody()`,
or a title rename reads as a false local edit. The **push-diff key** is `hashPushable(body)` — the
hash of only the pushable slice (`pushablePayload(partitionRegions(body))`).

---

## The 8 steps

### Step 1 — DIFF / DRAFT (caller-specific — the only step that differs)

The single point of variation between A, B, and C. Each caller produces, for each intended change, a
normalized **change intent**: `{ key?, issueType?, summary?, parent?, pushablePayload, pull_only_edits[] }`.

- **A (`/jira-push`)** — source is an edited `jira/<type>/KEY.md`. Compute the diff over the
  **pushable slice only**: `partitionRegions(md)` → `pushablePayload(...)` → new `## Description` +
  in-description AC checklist. Capture any edits confined to pull-only regions separately as
  `pull_only_edits[]` (reported-and-skipped downstream).
- **B (`/jira-create`)** — source is a free-text brief (no file). Draft `{ issueType, summary,
  description, parent }` after the ambiguity review + parent confirmation the command owns.
- **C (`/jira-enhance`)** — source is gap-analysis over a batch. Each proposed edit decomposes into
  an **A-edit** (description/AC on an existing key) or a **B-create** (child task), then re-enters this
  engine per change.

If the resulting pushable diff is empty **and** there is no create intent ⇒ this change is a
**no-op**; report it (for A, list any `pull_only_edits[]` that will not travel) and skip Steps 2–8 for it.

### Step 2 — DRY-RUN PLAN (nothing has touched JIRA)

Render the change without mutating anything:
- **A-edit:** `KEY` · field `description` · old→new unified diff · added/removed AC bullets · and an
  explicit **"pull-only edits skipped"** list if any.
- **B-create:** target `issueType` · `summary` · rendered `description` · resolved `parent (key + title)`
  · required fields discovered in Step 4.
Group per change (A/B) or per ticket (C). This is presentation only.

### Step 3 — APPROVE (human)

Per-change (A/B) or per-ticket (C) approval via `AskUserQuestion`:
**[Apply / Skip / Edit]**. `Edit` loops back to Step 1 for that change with the human's revision.
**Nothing proceeds without an explicit Apply.** No batch-wide "apply all" — each change is its own gate
(C's run-manifest records the per-ticket decision).

### Step 4 — RE-CHECK (the lost-update guard — get this exactly right)

Immediately before any mutation, for each approved change targeting an existing key:
1. `getJiraIssue { cloudId: CONNECTION.cloudId, issueIdOrKey: KEY, fields: ["*all"],
   expand: "renderedFields" }` (`MCP_CONTRACT.getIssue`) — read the **current** `version` /
   `fields.updated`.
2. Compare against the sidecar's stored `version` / `remoteUpdatedAt`.
   - **Unchanged** (remote version == sidecar version) ⇒ safe to mutate; continue to Step 5.
   - **Advanced** (remote version > sidecar version) ⇒ someone changed the issue since the last sync.
     **STOP this change. Do NOT mutate.** Show a 3-way diff — **local** (the edited mirror /
     drafted body) · **mirror-base** (sidecar `contentHash` body) · **remote** (just-fetched
     authoritative body). Offer: pull remote first (route to `/jira pull` / `/jira-add-issue` gate) or
     abandon this change. Never silently overwrite.

For **B-create** there is no existing key; Step 4 instead re-checks the **crash-safe intent record**
(brief+parent+nonce SHA-256 in `jira/.manifest.json`) — if this brief already became a real key,
resume at Step 6 for that key (no second create). The parent epic's version is not a lost-update
concern for a create.

### Step 5 — MUTATE (the only step that writes to JIRA)

- **A-edit:** `mcp__atlassian__editJiraIssue { cloudId, issueIdOrKey: KEY, fields: { description },
  contentFormat: "markdown" }` (`MCP_CONTRACT.editIssue`). Description-only — **never** push
  status/labels/links (pull-only).
- **B-create:** `mcp__atlassian__createJiraIssue { cloudId, projectKey: "EON", issueTypeName, summary,
  description, parent }` (`MCP_CONTRACT.createIssue`, `contentFormat: "markdown"`). The real key comes
  from the response — **never fabricate a key**; write nothing locally until it returns.
- **Audit breadcrumb (both):** one `mcp__atlassian__addCommentToJiraIssue { cloudId, issueIdOrKey,
  commentBody: "[CANS-SYNC|epic=<E>|version=<v>|run=<run_id>]" }` per applied change — trail only,
  never the re-run guard.

### Step 6 — RE-PULL (fetch the authoritative body)

`getJiraIssue { cloudId, issueIdOrKey: <edited-or-created KEY>, fields: ["*all"],
expand: "renderedFields" }`. The remote is now source of truth for what to mirror — do not assume the
write landed byte-identical (JIRA re-renders ADF).

### Step 7 — RECONCILE (write the mirror; make the next run a no-op)

Convert the re-pulled issue with `convertItem` (or `convertEpic` for an epic) and write via the
**`/jira-add-issue` Step-4 write gate**. The fresh sidecar MUST set:
- `contentHash = localEditsHash` (recomputed as `hashBody(mdBody(newBody))`) — **so a repeat push is
  an empty diff**;
- `version` = the bumped remote version from Step 6; `remoteUpdatedAt` = remote `updated`;
- `status_sync = "clean"`; `localSyncedAt = now`.

Then:
- update `jira/.manifest.json` (item pointer / for B, resolve the intent record to the real key);
- update `specs/<name>/jira-mapping.json` if this artifact traces to a spec (durable local↔remote join);
- run **`/jira reindex`** to regenerate `_index.json` (never hand-edit the index).

`lastSyncedAt` moves only on a genuine remote pull; a write-back reconcile writes `localSyncedAt` on the
sidecar and lets reindex refresh `generatedAt` — it does not need to move `_index.json.lastSyncedAt`.

### Step 8 — SUGGEST (never auto-run — R3)

If the reconciled mirror artifact feeds a spec — look it up in `specs/sources/manifest.json` (if that
file is absent, there is no mapping ⇒ skip silently) — **PRINT** a suggestion, e.g.:

> This change touched `EON-123`, which sources `specs/<name>/…`. Consider running
> `/reconcile-requirements @specs/<name>` to realign the requirement docs.

**Never run `/reconcile-requirements` automatically.** C emits **one** consolidated suggestion for the
whole batch; A/B emit one per applied change.

---

## Guardrails (apply on every path)

- **Dry-run first, always** — nothing touches JIRA before an explicit human Apply (Step 3).
- **Lost-update guard = Steps 4 + 7** (version re-check + reconcile). The `[CANS-SYNC]` comment is an
  audit trail, not the re-run guard.
- **Description-only writes** — Status / Links / Comments are pull-only, reported-and-skipped.
- **Never fabricate a JIRA key** — B writes locally only from the `createJiraIssue` response.
- **Never auto-place a parent** — B always confirms (its own guard).
- **Skip Done/Closed** unless explicitly named (C's own guard).
- **Never auto-run `/reconcile-requirements`** — Step 8 only suggests.
- **Declined — do not re-introduce:** whole-issue write (mirror is lossy ADF→MD ⇒ description-only);
  status transitions in the write path (`transitionJiraIssue` is a separate surface — status stays
  pull-only); auto-place parent; auto-reconcile after push.
- **No secrets** — MCP brokers auth; cloudId is the pinned `CONNECTION` value. Writes land only under
  `jira/` and the `specs/` supporting-state paths (`specs/<name>/jira-mapping.json`,
  `specs/.push-runs/`), **never** into `specs/` requirement docs.
