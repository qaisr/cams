---
description: >
  Subtask worker for ONE batch of a batched `/confluence-sync --pull` run. Not a standalone command:
  the `/confluence-sync` orchestrator spawns one fresh instance per batch with a self-contained
  `{ batchId, spaceKey, pageIds[] }` payload, so no single Claude context ever holds every page body
  (the 44-page overflow this fixes). It pulls exactly its assigned pageIds via the existing
  `/confluence pull <pageId>` verb (fetch → convert → roster-diff → do-not-clobber gate), then returns
  ONLY a compact JSON summary — never a body or diff. It MUST NOT reindex, MUST NOT touch specs/, and
  MUST NOT call any MCP tool beyond the Confluence read tools its pages need.
agent: build
subtask: true
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# confluence-pull-batch — one-batch subtask worker

> **Spawned by** `/confluence-sync` (its "Batched large-scale sync" §5 orchestration loop), never
> invoked by a human. Twin of `.claude/commands/jira-pull-batch.md`. The orchestrator hands this
> worker a single batch and discards the worker's context on return — the worker's whole job is to
> pull its slice through the already-correct `/confluence pull` verb and report tiny counts back.
> This file does **not** re-implement any fetch / convert / hash / clobber logic; it is 100%
> delegation to `/confluence pull`.

## Input (self-contained — the ONLY context this worker gets)

The orchestrator passes a payload; there is **no** orchestrator history, no roster, no prior batch
state. Everything needed is in the payload plus the two config files this worker may read:

```json
{
  "batchId": "ancestor:2091234567",
  "spaceKey": "SEC",
  "pageIds": ["2091234567", "2091234580"],
  "config": { "cloudId": "…", "pullComments": true }
}
```

- `batchId` — opaque label, echoed back for the orchestrator's tracker (not otherwise interpreted).
- `spaceKey` — the Confluence space these pages belong to (for reporting/keys).
- `pageIds[]` — the exact set of pages to pull, and the ONLY pages this worker may touch.
- `config` — the pinned `cloudId` and `pullComments` (also readable from
  `.claude/config/confluence-sync.config.yml`). No secrets — MCP auth is session-brokered.

## Contract

For **each** `pageId` in `pageIds[]`, in array order:

1. Run **exactly `/confluence pull <pageId>`** — the router verb at `.claude/commands/confluence.md`
   §"`/confluence pull`", Steps 1–7: scope-aware fetch, `convertItem`, **roster-diff-before-overwrite**,
   the **do-not-clobber gate** (Step 4), and additive `people.json` author append. **Do NOT
   re-implement** any of these — invoke the verb and let it apply its own gates.
2. Classify the outcome for this page from what `/confluence pull` reports:
   - **pulled** — body written (page was `remote-ahead` or `new`, on-disk body was the last pull).
   - **withheld** — the Step-4 do-not-clobber gate fired (`local-ahead` / `diverged`, i.e. a
     hand-edited body). The verb refreshed only sidecar metadata and withheld the body. Record the
     key + reason.
   - **failed** — the pull errored (MCP error, conversion failure, page not found). Record the key +
     a one-line reason.

### Hard prohibitions (every one is load-bearing)

- **MUST NOT** call `/confluence reindex` or write / touch `confluence/_index.json`. The rollup runs
  **once**, by the orchestrator, after the whole queue drains (two-timestamp invariant depends on a
  single end-of-run reindex). A per-batch reindex would be wrong and wasteful.
- **MUST NOT** touch `specs/` (R3) — never synthesize, never run `/reconcile-requirements`.
- **MUST NOT** pull any page not in `pageIds[]` — no `--descendants` expansion, no roster discovery,
  no "while I'm here" neighbours. The orchestrator already planned the full queue; this worker owns
  only its slice.
- **MUST NOT** invoke `--force-pull` or override any do-not-clobber gate. A withheld page is reported,
  never clobbered — only a top-level human `--force-pull <target>` can override, and a subagent
  cannot issue it.
- **MUST NOT** call any MCP tool outside the Confluence **read** set its pages need:
  `mcp__atlassian__{getConfluencePage, getConfluencePageFooterComments,
  getConfluencePageInlineComments, searchConfluenceUsingCql}`. This worker runs inside the permitted
  `/confluence-sync` context (Access Control Policy) — that is what licenses these read calls; it may
  make **no** JIRA, Figma, or Confluence-write MCP calls.

## Output (the ONLY thing returned — compact JSON, no prose, no bodies)

Return a single JSON object and nothing else. This is the worker's entire return value; the
orchestrator parses it, records it as the batch's `subagentSummary`, and discards everything else:

```json
{
  "batchId": "ancestor:2091234567",
  "pulled": 2,
  "withheld": 0,
  "failed": 0,
  "withheldKeys": [],
  "failedKeys": []
}
```

- `pulled` / `withheld` / `failed` — counts over this batch's `pageIds` (they sum to `pageIds.length`).
- `withheldKeys[]` — `"SEC-123 (diverged)"` / `"SEC-124 (local-ahead)"` entries for the report's
  withheld list + `--force-pull` hint.
- `failedKeys[]` — `"SEC-456 (error: <one-line reason>)"` entries so the orchestrator can retry
  (subject to its retry cap) or surface as needs-manual.

**No body text, no diffs, no page prose** ever appears in the return value — that is the whole point
of the worker boundary (it keeps the orchestrator's context small).

## Guardrails

- **Delegation only** — every write happens inside `/confluence pull`; this worker adds no write path.
- **Idempotent** — `/confluence pull` recomputes hashes every run, so re-spawning a batch (crash
  resume) is always safe; the worker need not track prior attempts.
- **Confluence read MCP only, inside a `/confluence*` context** — no JIRA/Figma, no write tools.
- **No reindex, no `specs/`, no out-of-batch pages, no force-pull.**
- **No secrets** — `cloudId` is the pinned config value; MCP auth is session-brokered.

## Cross-references

- Orchestrator: `.claude/commands/confluence-sync.md` (§ "Batched large-scale sync")
- Pull verb this delegates to: `/confluence pull <pageId>` (`.claude/commands/confluence.md`)
- Planner: `scripts/confluence/plan-batches.ts`
- Config: `.claude/config/confluence-sync.config.yml`
- Twin worker: `.claude/commands/jira-pull-batch.md`
