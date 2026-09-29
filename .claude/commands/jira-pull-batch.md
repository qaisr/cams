---
description: >
  Subtask worker for ONE batch of a batched `/jira-sync --pull` run. Twin of
  `.claude/commands/confluence-pull-batch.md` — same worker boundary, same compact-JSON return, same
  hard prohibitions; only the batch unit (epic / backlog / sprint) and the delegated verb differ. The
  `/jira-sync` orchestrator spawns one fresh instance per batch with a self-contained
  `{ batchId, unit, epic, keys[] }` payload so no single Claude context holds every issue body. It
  pulls its slice via the existing `/jira pull <EPIC>` verb (epic batches) or the per-issue read path
  (backlog/sprint/chunk batches), then returns ONLY counts. MUST NOT reindex, MUST NOT touch specs/,
  MUST NOT call any MCP tool beyond the JIRA read tools its issues need.
agent: build
subtask: true
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# jira-pull-batch — one-batch subtask worker

> **Twin of `.claude/commands/confluence-pull-batch.md`** — read that file for the full worker
> rationale, the compact-JSON boundary, and the hard prohibitions. This file states **only the JIRA
> deltas**: the batch unit and the verb this worker delegates to. Everything else — no reindex, no
> `specs/`, no out-of-batch issues, no force / clobber override, compact-JSON-only return, idempotent
> re-spawn — is identical to the Confluence worker.

> **Spawned by** `/jira-sync` (its "Batched large-scale sync" §10 orchestration loop), never invoked
> by a human. The orchestrator discards this worker's context on return.

## Input (self-contained — the ONLY context this worker gets)

```json
{
  "batchId": "epic:EON-21",
  "unit": "epic",
  "epic": "EON-21",
  "keys": ["EON-21", "EON-34", "EON-35"],
  "config": { "cloudId": "…", "project": "EON", "epicLinkStrategy": "parent" }
}
```

- `batchId` — opaque label echoed back to the tracker (`epic:EON-21` / `chunk:EON-21-2` / `backlog` /
  `sprint`); not otherwise interpreted.
- `unit` — `epic` | `chunk` | `backlog` | `sprint` (from `scripts/jira/plan-batches.ts`).
- `epic` — the parent epic key for `epic` / `chunk` batches, or `null` for `backlog` / `sprint`.
- `keys[]` — the exact issue keys to pull, and the ONLY issues this worker may touch.
- `config` — pinned `cloudId`, `project`, `epicLinkStrategy` (also readable from
  `.claude/config/jira-sync.config.yml`). No secrets — MCP auth is session-brokered.

## Contract — the ONE JIRA delta from the Confluence twin

Choose the delegated verb by `unit`:

- **`unit: "epic"`** (batch carries a whole epic + all its children, `keys[]` = the full child set) →
  run **exactly `/jira pull <epic>`** (router `.claude/commands/jira.md` §"`/jira pull <EPIC>`",
  Steps 1–7): scoped JQL from `epicLinkStrategy`, `convertEpic` + `convertItem`, the
  **roster-diff-before-overwrite** and **do-not-clobber gate** (Step 4), additive `people.json`. Do
  NOT re-implement it.
- **`unit: "chunk"`** (one slice of an epic too big for a single batch) or **`unit: "backlog"` /
  `"sprint"`** (parent-less items) → these are **loose issue sets**, not a whole epic, so a full
  `/jira pull <epic>` would over-fetch. Pull **each key individually** through the same read + write
  gate the router uses per child: `mcp__atlassian__getJiraIssue { fields:["*all"],
  expand:"renderedFields" }` → `scripts/jira/converter.ts` `convertItem` → the `/jira-add-issue`
  Step-4 write gate (the same do-not-clobber hash check `/jira pull` applies to each child). Never
  clobber a hand-edited body; withhold and report it.

Classify each key's outcome exactly as the Confluence twin does — **pulled** (body written),
**withheld** (Step-4 gate fired: `local-ahead` / `diverged`), or **failed** (errored). All other
rules (hard prohibitions, MCP scope, idempotency) are identical to the twin, with JIRA tools:

- **MCP scope:** only the JIRA **read** set its issues need —
  `mcp__atlassian__{searchJiraIssuesUsingJql, getJiraIssue}` (plus the epic-children search the
  `/jira pull` verb already issues). **No** Confluence / Figma / write MCP calls. Runs inside the
  permitted `/jira-sync` context (Access Control Policy), which is what licenses these read calls.
- **MUST NOT** `/jira reindex` or touch `jira/_index.json` — the orchestrator reindexes once at the
  end.
- **MUST NOT** touch `specs/` (R3), pull any key outside `keys[]`, or override any clobber / force
  gate.

## Output (the ONLY thing returned — compact JSON, no prose, no bodies)

```json
{
  "batchId": "epic:EON-21",
  "pulled": 3,
  "withheld": 0,
  "failed": 0,
  "withheldKeys": [],
  "failedKeys": []
}
```

- Counts sum to `keys.length`. `withheldKeys[]` = `"EON-34 (diverged)"`; `failedKeys[]` =
  `"EON-35 (error: <one-line reason>)"`. **No issue body text, ADF, or diffs** ever appear.

## Guardrails

Identical to `.claude/commands/confluence-pull-batch.md`'s Guardrails, with JIRA read MCP tools:
delegation-only writes; idempotent re-spawn; JIRA read MCP only inside a `/jira*` context; no
reindex, no `specs/`, no out-of-batch keys, no force override; no secrets.

## Cross-references

- Orchestrator: `.claude/commands/jira-sync.md` (§ "Batched large-scale sync")
- Pull verb (epic batches): `/jira pull <EPIC>` (`.claude/commands/jira.md`)
- Per-issue write gate (chunk/backlog/sprint batches): `.claude/commands/jira-add-issue.md` (Step 4)
- Planner: `scripts/jira/plan-batches.ts`
- Config: `.claude/config/jira-sync.config.yml`
- Twin worker: `.claude/commands/confluence-pull-batch.md`
