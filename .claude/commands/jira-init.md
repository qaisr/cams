---
description: >
  Bootstrap (or drift-check) the local JIRA mirror for the configured project. On a fresh repo:
  confirm project/site/cloudId, resolve the canonical board + active sprint, run
  /jira-discover-fields, scaffold the `jira/` tree + JSON schema + empty manifest/index, seed
  people.json from live EON assignees, then preview the mirrorable epics/children and
  ask which to pull. If `jira/` already exists, run a report-only drift diff instead. Writes NO
  issue bodies itself — pulling content is `/jira pull` / `/jira-add-issue`.
agent: build
subtask: true
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# JIRA Init

## Input

`$ARGUMENTS` — none required. Reads `.claude/config/jira-sync.config.yml`.

## What this does (plan 01a §4.1)

Two branches, decided by whether `jira/.manifest.json` already exists:

- **Fresh** → scaffold everything the mirror needs, discover live facts, seed identity, preview.
- **Drift** (already initialized) → **report-only** diff of config vs. live JIRA (new epics, board/
  sprint changes, field re-configs). Never mutates the mirror; suggests the exact follow-up command.

## Contract

`MCP_CONTRACT` entries in `scripts/jira/mcp-client.ts`: `resolveCloudId` →
`mcp__atlassian__getAccessibleAtlassianResources`, `whoAmI` → `mcp__atlassian__atlassianUserInfo`,
`projectMeta` → `mcp__atlassian__getVisibleJiraProjects`, `search` →
`mcp__atlassian__searchJiraIssuesUsingJql`. Connection facts (`CONNECTION`) are pinned there. This
command scaffolds structure and seeds identity; it does **not** convert issue bodies (that is the
converter, invoked by the pull commands).

## Process — Fresh branch

### Step 1 — Confirm connection

1. Read `project`, `site`, `cloudId` from the config.
2. Call `mcp__atlassian__getAccessibleAtlassianResources` and confirm the pinned `cloudId` matches
   the `site`. If it does not resolve, STOP and report (do not guess a new cloudId).
3. Call `mcp__atlassian__getVisibleJiraProjects { cloudId, searchString: EON, expandIssueTypes: true }`
   to confirm the project exists and capture `projectTypeKey` + `simplified` (grounding:
   `software` / `simplified:false`).

### Step 2 — Resolve canonical board + active sprint (§6.3b)

1. Find the project's board(s). If exactly one, record `{ board.id, board.name }`.
2. If **more than one** board exists, STOP and ask the human to pick — do not assume. Record the
   chosen board.
3. If the board is **Kanban / has no active sprint**, note it: `currentSprint` degrades to a
   backlog view (record `currentSprint: null` in the index later).
4. Identify the active sprint via `sprint in openSprints()` scoped to the board; record its
   `{ id, name, state, startDate, endDate }` for the index's `currentSprint`.

### Step 3 — Discover fields

Invoke **`/jira-discover-fields`** (its own command). It fills `fields.{sprint{id,shape},storyPoints,
epicLink,rank}` and RE-CONFIRMS `epicLinkStrategy` (expected `parent` for EON) in the config. If it
reports `epic-link` unexpectedly, STOP — the scope JQL must be regenerated before any pull.

### Step 4 — Scaffold the `jira/` tree

Create (idempotently — never overwrite an existing populated file):

```
jira/
  epics/        stories/        tasks/        bugs/
  .manifest.json      ← domain manifest: { project, epics: {}, lastSyncedAt: null, schema ref }
  manifest.schema.json ← already created in Phase 0; ensure present
  _index.json         ← empty derived index: counts all 0, items [], tree {}, backlog [], orphans []
```

`_index.json` starts with `lastSyncedAt: null` and `generatedAt: <now>`; it is **gitignored**
(derived). `.manifest.json` is the authoritative, committed root pointer.

### Step 5 — Seed identity (§3.6)

1. Ensure `.claude/config/people.json` exists (Phase 0 seeded it with the authenticated user).
2. Run the three scope queries (via `scopeQueries` in `mcp-client.ts`) with
   `fields: ["assignee","reporter"]` **only**, to enumerate the distinct people on EON without
   pulling bodies.
3. For each JIRA account handle not already present in `people.json`, **append** a person with
   `displayName` from JIRA, `aliases: []`, and `jira: <handle>` (additive only — never rewrite an
   existing entry; `unresolvedAliasPolicy: "ask"` governs later alias resolution).
4. Write the fully-populated `.claude/config/people.json`. This is the single identity store. `people.json` is gitignored and regenerated here.

### Step 6 — Preview (no bodies pulled)

Run `epicsAndChildrenJql` (summary fields only) and print a table: each epic key + summary + child
count, plus backlog size and the resolved current sprint. Then ask the human **which epic(s) to
pull**, pointing at `/jira pull <EPIC>` (or `/jira-add-issue <KEY>` for a single issue). STOP —
do not pull automatically.

### Step 7 — Report

Summarize: cloudId confirmed, project type, board + sprint, discovered field ids, people seeded
(N new), and the exact next command(s). Note that `_index.json.lastSyncedAt` is still `null` until
the first real pull.

## Process — Drift branch (already initialized)

1. Detect `jira/.manifest.json` present → **report-only**.
2. Re-run Steps 1–2 read-only and diff against the committed config:
   - New epics on the board not in `epics:` → list them, suggest adding + `/jira pull`.
   - Board/sprint changed → show old vs new.
   - Field ids changed (re-run discovery in report mode) → flag, suggest `/jira-discover-fields`.
3. Compare `_index.json.lastSyncedAt` against `stalenessHours` (24h) → if stale, suggest
   `/jira-sync --dry-run`.
4. Print the diff and the suggested follow-up commands. **Mutate nothing.**

## Guardrails

- **Fresh vs drift is decided by `jira/.manifest.json` presence** — the drift branch is strictly
  report-only.
- **No bodies pulled here** — Step 6 previews summaries only; content comes from `/jira pull` /
  `/jira-add-issue`.
- **`lastSyncedAt` stays null** until a real pull (timestamp invariant).
- **Identity is additive** — people.json entries are appended, never rewritten. Agents read `people.json` directly.
- **No secrets** — MCP session brokers auth; the pinned cloudId is confirmed, never re-invented.
- **>1 board or unexpected `epic-link` ⇒ STOP and ask/report** rather than assume.
