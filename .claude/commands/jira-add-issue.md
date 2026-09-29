---
description: >
  Idempotently mirror a single JIRA issue (or an epic, optionally with its children) into the
  local `jira/` tree — writing `{KEY}.md` (verbatim body, region-marked), the `{KEY}.json`
  sidecar (authoritative per-item sync state), and the `.manifest.json` entry. Refreshes an
  existing mirror without clobbering hand-edits, and updates `lastSyncedAt` because it is a real
  remote pull. Also the ingest step chained by `/reconcile-requirements <url>`.
agent: build
subtask: true
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: medium
---

# Add JIRA Issue

## Input

`$ARGUMENTS` — `<key|url> [--with-children]`

- `EON-123` or `https://commbank.atlassian.net/browse/EON-123`
- `EON-21 --with-children` — an epic plus every child (delegates to the `/jira pull` path, §4.3)

## What this writes (plan 01a §2.1, §4.2)

| Path | Content |
|---|---|
| `jira/<type-folder>/{KEY}.md` | verbatim body: `## Status` / `## Description` / `## Acceptance Criteria` / `## Links` / `## Comments`, with the load-bearing `<!-- pushable -->` / `<!-- pull-only -->` markers |
| `jira/<type-folder>/{KEY}.json` | the sidecar (§2.1) — authoritative per-item sync state |
| `jira/.manifest.json` | adds/updates this item's pointer |
| `jira/_index.json` | reindexed for the affected item (derived; gitignored) |

Type→folder map comes from `artifactFolders` in `.claude/config/jira-sync.config.yml`
(Epic→`epics`, Story→`stories`, Task→`tasks`, Bug→`bugs`, Dependency→`tasks`; unknown→`tasks`).

## Contract

Uses `MCP_CONTRACT.getIssue` → `mcp__atlassian__getJiraIssue`
`{ cloudId, issueIdOrKey, fields: ["*all"], expand: "renderedFields" }`. Connection facts from
`CONNECTION` in `scripts/jira/mcp-client.ts`. The JIRA→disk transform is
`scripts/jira/converter.ts` (`convertItem` / `convertEpic`); the change-detection hashes are
`scripts/jira/hash.ts` (`hashBody`, `hashPushable`, `hashRoster`). This command does not re-implement
that logic — it feeds the raw MCP payload into the converter and writes the result.

## Process

### Step 1 — Preconditions

1. Require `jira/` to be initialized (`jira/.manifest.json` exists). If not, tell the user to run
   `/jira-init` first and STOP.
2. Parse the key from the arg (accept a browse URL). Confirm the project prefix matches
   `config.project` (EON); a foreign-project key STOPs with a clear message.

### Step 2 — Fetch

Call `mcp__atlassian__getJiraIssue` for the key with `fields: ["*all"]`, `expand: "renderedFields"`.
Read the description + comments as ADF (the converter hand-parses ADF→Markdown — no third-party ADF
library is added). Parse the **sprint** field using `config.fields.sprint.{id,shape}` (run
`/jira-discover-fields` first if those are null).

### Step 3 — Convert

Feed the raw issue into `converter.ts`:
- `convertItem` for Story/Task/Bug/Dependency → `{ md, sidecar }`.
- `convertEpic` for an Epic → the per-epic manifest body; children are only fetched when
  `--with-children` is set (then hand off to `/jira pull <KEY>`, §4.3, and STOP here).

The converter emits `contentHash === localEditsHash` and `status_sync: "clean"` for a fresh item.

### Step 4 — Idempotent write (never clobber a hand-edit)

If `{KEY}.md` already exists on disk:
1. Recompute `localEditsHash` from the **on-disk** body and compare to the sidecar's stored
   `localEditsHash`.
2. **If they differ**, the human hand-edited the mirror. Do **not** overwrite. Instead:
   - Recompute the remote body hash. If remote also changed → mark `status_sync: "diverged"`;
     if only local changed → `local-ahead`; if only remote → `remote-ahead`.
   - Report the situation and the exact diff, and offer `--force-pull <KEY>` (overwrite from remote)
     or defer to `/jira-sync`. Write **only** the sidecar's `status_sync` + `remoteUpdatedAt`, not
     the body.
3. **If they match** (no local edits), overwrite `.md` + `.json` from the freshly converted content;
   set both hashes equal again and `status_sync: "clean"`.

For a brand-new key, write both files directly.

### Step 5 — Manifest + timestamps + reindex

1. Upsert the item in `jira/.manifest.json`.
2. Set the sidecar `localSyncedAt` = now; a successful remote pull **updates `_index.json.lastSyncedAt`**
   (§3.2 — `/jira-add-issue` is one of the three pull operations that legitimately move the clock).
3. Append any newly-seen assignee/reporter handle to `.claude/config/people.json` with empty
   `aliases: []` (additive, matching on the `jira` handle; §3.3/§3.6) — never rewrite an existing
   person.
4. Reindex the affected item into `jira/_index.json` (or run the `/jira reindex` rollup).

### Step 6 — Report

One-line summary: `KEY (Type) → jira/<folder>/KEY.md  [clean|remote-ahead|local-ahead|diverged]`,
plus the `--with-children` handoff note when applicable.

## Guardrails

- **Idempotent.** Re-running on an unchanged issue is a no-op beyond timestamp refresh.
- **Never clobber** a hand-edited body — Step 4 is the safety gate (§2.2).
- **Verbatim** import — no de-identification (R1).
- **No secrets**; MCP session brokers auth.
- Writes only under `jira/` + `.claude/config/people.json`. It does
  **not** touch `specs/` — that is `/create-specifications` / `/reconcile-requirements` (§4.4).
