---
description: >
  Single entry point for the JIRA mirror. Classifies a natural-language prompt and delegates to the
  `jira-helper` subagent (read/analyze) or, for mutations, hands off to the write-back engine (§8)
  with all its human gates. Also exposes explicit sub-verbs: search / sprint / backlog / who / gap /
  map / reindex / pull. Every query first applies the 24-hour staleness check against
  `_index.json.lastSyncedAt`.
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: medium
---

# /jira — router

## Input

`$ARGUMENTS` — either a bare natural-language prompt (`/jira "what are abbas's pending stories?"`) or
a sub-verb form from the table below.

## Preconditions (every invocation)

1. Require the mirror to be initialized (`jira/.manifest.json` present). If not → tell the user to
   run `/jira-init` and STOP.
2. **Staleness check (§5.4).** Read `_index.json.lastSyncedAt`. If older than `stalenessHours` (24h,
   from `jira-sync.config.yml`), offer, via `AskUserQuestion`:
   *"The JIRA mirror was last synced {when}. Results may be stale. Sync now?"* →
   **[Sync & answer / Answer from mirror anyway / Cancel]**. If the user answers from the mirror
   anyway, prepend a one-line staleness banner to the result. A pull/sync is the only thing that
   moves `lastSyncedAt`; `/jira reindex` does not.

## Routing table (§5.2)

| Form | Intent | Delegates to |
|---|---|---|
| `/jira "<natural language>"` | classify intent | `jira-helper`; then the write-back engine if the intent is a mutation |
| `/jira search <query>` | local search over `_index.json` (+ drill into `.md`) | `jira-helper` |
| `/jira sprint [current\|next\|<name>]` | sprint board view | `jira-helper` |
| `/jira backlog` | backlog listing + prioritization help | `jira-helper` |
| `/jira who <alias>` | one person's items | `jira-helper` + `people.json` |
| `/jira gap <KEY>` | gap analysis on one item | `jira-helper` |
| `/jira map [<KEY>]` | relationship/tree map (Mermaid) | `jira-helper` (§7) |
| `/jira reindex` | rebuild `_index.json` from sidecars + epic manifests (OFFLINE) | deterministic rollup (below) |
| `/jira pull <EPIC>` | epic + all children pull | §4.3 (below) |

### Intent classification for the bare NL form

Delegate the prompt to `jira-helper` (its own subagent context loads `_index.json` +
`.claude/config/people.json`, resolves aliases, and asks multi-choice clarifying questions for vague prompts). If the classified
intent is a **mutation** — "add a task…", "create…", "improve the descriptions…", "push my edits…" —
the helper does **not** mutate. The router hands off to the correct write-back command with its gates:

| Mutation intent | Hand off to |
|---|---|
| improve/enhance existing tickets (descriptions, ACs, testing tasks) | `/jira-enhance` (Feature C, §8.5) |
| create a new issue | `/jira-create` (Feature B, §8.4) |
| push local mirror edits back | `/jira-push` (Feature A, §8.2) |

Read-only intents (search, sprint, backlog, who, gap, map, "identify…", "help me choose…") are
answered by `jira-helper` from the index, drilling into individual `.md` files only when full detail
is needed.

## `/jira pull <EPIC>` (§4.3)

The **read** counterpart of the write-back engine — never mutates remote JIRA. Invoked identically
whether called by a top-level session, `/jira-sync`, or a `jira-pull-batch` subagent (one epic batch
of a large-scale batched sync).

1. Build the scoped JQL from `epicLinkStrategy` using `epicChildrenJql(project, EPIC, strategy)` in
   `scripts/jira/mcp-client.ts` (EON = `parent = EON-21`; the `epic-link` branch templates
   `"Epic Link" = EON-21`). Also fetch the epic itself.
2. Page `mcp__atlassian__searchJiraIssuesUsingJql` (`nextPageToken`) with the discovered fields, then
   `mcp__atlassian__getJiraIssue { fields:["*all"], expand:"renderedFields" }` per issue for full
   ADF bodies + comments.
3. Feed each issue through `scripts/jira/converter.ts`:
   - `convertEpic` → `jira/epics/EON-21.json` (per-epic manifest, §2.3, incl. `childrenHash` via
     `hashRoster`) + `jira/epics/EON-21.md` (epic body + comment history).
   - `convertItem` → each child under its type folder (`stories/` `tasks/` `bugs/`; `Dependency`→
     `tasks/`) as `.md` + `.json` sidecar.
4. **Roster diff before overwrite (§2.3).** If `jira/epics/EON-21.json` already exists, compute the
   child roster diff (added / modified / removed vs. the stored roster) and **show it for approval
   before overwriting** the epic body and any changed child. For any child whose on-disk
   `localEditsHash` ≠ stored (hand-edited), do **not** clobber — mark `remote-ahead`/`diverged` and
   report (same safety gate as `/jira-add-issue` Step 4).
5. Append any newly-seen assignee/reporter to `people.json` (additive, `aliases:[]`).
6. **This is a real pull → update `_index.json.lastSyncedAt`** and reindex the affected subtree.
7. Report: epic + N children written, roster changes, any items withheld for divergence.

## `/jira reindex` (OFFLINE — §6.4)

Deterministic rollup, no network:

1. Read every sidecar (`jira/**/*.json`) + per-epic manifest.
2. Rebuild `_index.json` (§3.2 shape): `counts`, `items[]` one-liners, `tree{}`, `backlog[]`,
   `orphans[]`, carrying `currentSprint` through unchanged.
3. Set **`generatedAt` = now**; leave **`lastSyncedAt` untouched** (reindex is not a sync — timestamp
   invariant). Sidecars win on any disagreement.
4. If `scripts/jira/reindex.ts` exists, run it via `node_modules/.bin/tsx scripts/jira/reindex.ts`;
   otherwise perform the rollup inline. Report counts + `generatedAt`, and note `lastSyncedAt` is
   unchanged.

## Guardrails

- **Read vs write is enforced at the router.** `jira-helper` answers/analyzes only; every mutation
  goes through a Phase-5 write-back command with its dry-run + approval + version-guard gates.
- **`/jira pull` moves `lastSyncedAt`; `/jira reindex` never does.**
- **Never clobber a hand-edited mirror body** on pull — divergent children are withheld and reported.
- **Never auto-run `/reconcile-requirements`** — a write-back may *suggest* it (R3), routing does not
  trigger it.
- **No secrets** — MCP session brokers auth; cloudId is the pinned `CONNECTION` value.
