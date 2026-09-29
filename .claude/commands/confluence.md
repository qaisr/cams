---
description: >
  Single entry point for Confluence. Classifies a natural-language prompt and delegates to the
  `confluence-search` subagent (discover / read / summarize / synthesize) or, for mutations, hands
  off to the shared write-back engine with its human gates. Also exposes explicit sub-verbs:
  search / read / summary / glossary (live now) and space / who / tree / gap / stale / pull / reindex
  (mirror) and push / create / enhance (write-back, LIVE). Rovo `search` is the org-wide primary
  engine; the local mirror is a citation cache. Discovery / read / summary are LIVE and NEVER
  staleness-gated; the 24-hour staleness check applies to mirror-derived answers ONLY.
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: medium
---

# /confluence — router

## Input

`$ARGUMENTS` — either a bare natural-language prompt
(`/confluence "how do we create temporary credentials for an NTB POBO?"`) or a sub-verb form from
the routing table below.

## Preconditions (every invocation)

1. **Live verbs need no mirror.** `search` / `read` / `summary` (and the bare NL discovery/read/
   summary forms) run against **live Rovo via the Atlassian MCP** — they do **not** require
   `confluence/.manifest.json` to hold any items, and they are **never blocked by staleness**.
2. **Mirror verbs require a populated mirror (Phase 3).** If a sub-verb needs the local cache
   (`space` / `who` / `tree` / `gap` / `stale` / `reindex` / `pull`) and `confluence/.manifest.json`
   has no items yet → say so and **STOP**, offering the live `search` / `read` / `summary`
   equivalent instead.
3. **Staleness applies to mirror-derived answers ONLY (Phase 3+).** When a mirror verb runs, read
   `confluence/_index.json.lastSyncedAt`; if older than `stalenessHours` (24h, from
   `confluence-sync.config.yml`), offer via `AskUserQuestion`:
   *"The Confluence mirror was last synced {when}. Results may be stale. Sync now?"* →
   **[Sync & answer / Answer from mirror anyway / Cancel]**. A pull/sync is the only thing that moves
   `lastSyncedAt`; `reindex` does not. **Never gate `search` / `read` / `summary`.**

## Routing table

| Form | Intent | Phase | Delegates to |
|---|---|---|---|
| `/confluence "<natural language>"` | classify → discover/read/summary; a mutation is handed to the write-back verb | 1 (classify) / 4 (mutate) | `confluence-search`; then `/confluence push\|create\|enhance` if the intent is a mutation |
| `/confluence search <query>` | live Rovo org-wide search | **1** | `confluence-search` |
| `/confluence read <url\|pageId>` | fetch + digest a page (live) | **1** | `confluence-search` |
| `/confluence summary <SPACE> [--since <window>]` | space change summary | **1** (live) / 3 (mirror diff) | `confluence-search` |
| `/confluence glossary show <term>` | print a glossary entry | **2** | `confluence-search` (§2a) |
| `/confluence glossary harvest [<SPACE>\|<pageId>]` | batch-propose terms from mirrored bodies | **2** | `confluence-search` (§2a) |
| `/confluence space\|who\|tree\|gap\|stale` | mirror-analytic ops over the cache | 3 | `confluence-search` (mirror-scoped) |
| `/confluence pull <space\|page>` | cache pull into `confluence/` | 3 | pull pipeline (Phase 3) |
| `/confluence reindex` | rebuild `confluence/_index.json` from sidecars (OFFLINE) | 3 | deterministic rollup (Phase 3) |
| `/confluence push <pageId\|url>` | push local mirror edits back (verb A) | **4** | `/confluence push` → shared write-back engine |
| `/confluence create <SPACE> --title …` | create a new page from local Markdown (verb B) | **4** | `/confluence create` → shared write-back engine |
| `/confluence enhance <pageId\|SPACE>` | AI-proposed improvements to pushable sections (verb C) | **4** | `/confluence enhance` → shared write-back engine |
| `/confluence relationship-map [<pageId\|EON-key>]` | Confluence↔JIRA cross-link graph + gap list (mirror-only) | **5** | `.claude/commands/confluence-relationship-map.md` |
| `/confluence design-sync <pageId\|url>` | doc-vs-code drift report (mirror + codebase grep) | **5** | `.claude/commands/confluence-design-sync.md` |
| `/confluence comment-triage [<pageId\|SPACE>]` | classify footer+inline comments → actionable digest | **5** | `.claude/commands/confluence-comment-triage.md` |

### Intent classification for the bare NL form

Delegate the prompt to `confluence-search` (its own subagent context reads
`.claude/config/confluence-sync.config.yml`, runs the glossary placeholder, picks a live engine,
and asks multiple-choice clarifying questions for vague prompts). If the classified intent is a
**mutation** — "create a page…", "push my edits…", "improve/enhance this page…" — the agent does
**not** mutate. The router hands off to the correct write-back verb, each of which funnels through the
shared 8-step engine (`.claude/commands/confluence-write-engine.md`) with its dry-run + approval +
version-guard gates:

| Mutation intent | Hand off to |
|---|---|
| create a new Confluence page | `/confluence create` (verb B) |
| push a local mirror edit back | `/confluence push` (verb A) |
| enhance / improve an existing page | `/confluence enhance` (verb C) |

Read-only intents (search, read, summary, "find…", "summarize the changes…", "synthesize a doc…")
are answered by `confluence-search` live via the MCP, cited per the citation contract. Synthesized
documents are written under **`docs/`**, never `specs/` (R3).

**Phase-5 analytical verbs** — when the classified intent matches one of the below patterns,
delegate directly to the named command (all are mirror-read + codebase-grep, no remote write):

| NL signal | Route to |
|---|---|
| "relationship map", "cross-link", "jira connections", "linked issues", "page-issue graph" | `/confluence relationship-map` |
| "design sync", "doc vs code", "drift", "is the doc up to date", "what has changed in the code" | `/confluence design-sync` |
| "comment triage", "open comments", "unresolved comments", "action items in comments", "classify comments" | `/confluence comment-triage` |

## `/confluence pull <SPACE | pageId | url>` (Phase 3 §5 — deterministic, read-only)

The **read** counterpart of the write-back engine — never mutates remote Confluence. It is the ONLY
verb that advances `lastSyncedAt`. Contract lives in `scripts/confluence/{mcp-client,converter,hash,
reindex}.ts`; this section is the orchestration prose Claude follows. Invoked identically whether
called by a top-level session, `/confluence-sync`, or a `confluence-pull-batch` subagent (one batch
of a large-scale batched sync).

1. **Resolve the target.**
   - `SPACE` (e.g. `PCON`) → build the scope-aware roster CQL with `spaceScopeCql(scope, sinceWindow)`
     from `scripts/confluence/mcp-client.ts`, where `scope` comes from `confluence-sync.config.yml`
     (`spaces[]` + optional `labels[]` / `ancestors[]`) and `sinceWindow` from config (default `30d`).
   - `pageId` or a `…/pages/{id}/…` url → `pageByIdCql(pageId)`; add its subtree via
     `getConfluencePageDescendants` only when the user passes `--descendants`.
   - **Never issue an unbounded query** ("all of Confluence") — the window bound is mandatory
     (token-blowout guard). The pinned `cloudId` is `CONNECTION.cloudId`.
2. **Page the roster (cursor).** Call `mcp__atlassian__searchConfluenceUsingCql`
   `{ cloudId, cql, limit: 50, cursor? }`, following the cursor to completion. For each hit fetch the
   body with `mcp__atlassian__getConfluencePage { cloudId, pageId, contentFormat: "markdown" }` (R1
   verbatim), and — when `config.pullComments` — footer + inline comments via
   `getConfluencePageFooterComments` / `getConfluencePageInlineComments` (markdown).
3. **Convert.** Feed each raw page through `convertItem(page, cfg, nowIso)` (`converter.ts`) → the
   `{SPACE}-{id}.md` body (region markers + macro fences + normalized `##` anchors) and the `.json`
   sidecar. Attachments (if any) → `confluence/attachments/{id}/`.
4. **Roster diff BEFORE overwrite (do-not-clobber gate).** For the space, compute added / modified /
   removed vs the stored `confluence/spaces/{SPACE}.json` roster and **show it for approval before
   writing any body.** For every candidate, apply the Step-7 diff below:
   - Recompute `localEditsHash` = `hashBody(mdBody(on-disk .md))` for the page as it currently sits on
     disk. If it **differs from the sidecar's `contentHash`**, the body was **hand-edited** →
     **do NOT clobber it.** Mark the item `local-ahead` (or `diverged` if remote also advanced),
     write only the refreshed sidecar metadata, and **withhold the body**, reporting it.
   - Otherwise the on-disk body equals the last pull → safe to overwrite with the freshly-converted
     body + sidecar.
5. **Additive author append.** Resolve live comment/version authors; append any newly-seen person to
   `.claude/config/people.json` **additively** (`aliases: []`, `confluence: <handle>` only when the
   MCP returns one — **never invent** an accountId; a null Confluence handle means "no identity
   recorded yet"). Agents read `.claude/config/people.json` directly for all identity resolution.
6. **Advance the sync clock + reindex.** A real pull **advances `lastSyncedAt`** (it is written into
   each new/updated sidecar as `nowIso`). Rebuild the per-space `spaces/{SPACE}.json` roster and
   recompute its `treeHash` via `hashTree(roster)` (`hash.ts`), then run the offline rollup
   (`reindex` below) so `_index.json` reflects the pull — its `lastSyncedAt` becomes the newest
   sidecar pull time (via `newestLastSynced`).
7. **Report.** N bodies written, roster changes (added / modified / removed), and any pages
   **withheld for divergence** (hand-edited → `local-ahead` / `diverged`), plus the new `treeHash`.

**Scope-aware CQL (mandatory shape — from `spaceScopeCql`):**

```
space = PCON
  AND (label in ("party-credentials","admin-hub") OR ancestor = 1332713924)
  AND lastmodified >= now("-30d")
ORDER BY lastmodified DESC
```

When neither `labels[]` nor `ancestors[]` is configured for a space, the middle group is omitted and
the space is taken whole — **still window-bounded**, never unbounded.

## Diff algorithm — `status_sync` (Phase 3 §7)

Applied per item on every pull (and reflected by `reindex` from the sidecars). `version.number` is
the remote-change signal (reliable, unlike `updated` timestamps); the two hashes detect local edits:

| Condition | `status_sync` |
|---|---|
| `remote.version.number > sidecar.version.number` (and body not hand-edited) | `remote-ahead` |
| `localEditsHash(on-disk) ≠ sidecar.contentHash` (body hand-edited) | `local-ahead` |
| both of the above | `diverged` (Phase-4 lost-update guard) |
| remote page gone from scope | `orphaned` (excluded from rollup; edge pruned) |
| new remote page in scope, not yet mirrored | `new` |
| otherwise | `clean` |

A freshly-converted item is `clean` with `contentHash === localEditsHash` (the on-disk body IS the
last-pulled body until a human edits it).

## `/confluence reindex` (Phase 3 §6 — OFFLINE, prove the invariant)

Deterministic rollup, no network:

1. Run `node_modules/.bin/tsx scripts/confluence/reindex.ts` (optionally `--now <iso>` for a
   deterministic timestamp; env `CONFLUENCE_REINDEX_NOW` also honoured). It reads every item sidecar
   under `confluence/{pages,blogposts}/*.json` + every per-space manifest under
   `confluence/spaces/*.json`, runs the pure `rollup`, and rewrites `confluence/_index.json`
   (`{ generatedAt, lastSyncedAt, counts, items[], tree{}, orphans[] }`).
2. **Two-timestamp invariant:** `generatedAt = now`; **`lastSyncedAt` is carried through unchanged**
   (= the newest real-pull time across the mirror, never `now()`). **Sidecars win** on any
   disagreement; `orphaned` items are excluded from `items` and their tree edges pruned.
3. Report counts + `generatedAt`, and explicitly note that **`lastSyncedAt` is unchanged** by
   reindex — only a `pull` moves it.

## Mirror-analytic verbs (Phase 3 §9 — answer from the cache, staleness-gated)

All five run **only against the mirror** (Precondition 2 requires a populated
`confluence/.manifest.json`; Precondition 3's 24h staleness gate applies). They **never** hit the
network — for a live answer the user runs `search` / `read` / `summary` instead. All delegate to
`confluence-search` (mirror-scoped).

| Verb | Behaviour |
|---|---|
| `/confluence space <SPACE>` | Tree/roster view from `confluence/spaces/{SPACE}.json` — page count, `treeHash`, root pages and their children, per-item `version` + `status_sync`. |
| `/confluence who <alias>` | Resolve `<alias>` via `.claude/config/people.json` (`confluenceAccountId` / `confluence` handle); list the mirrored pages that person authored/commented on (from sidecar `version.byId` + pulled comment authors). If the alias is unresolved, apply `unresolvedAliasPolicy` (`ask`). |
| `/confluence tree [<pageId>]` | Ancestry/descendant map from `_index.json.tree` (space `roots[]` + per-page `children[]`); render as a Mermaid diagram per `@.claude/standards/mermaid-standards.md`. With no `pageId`, show the space roots; with one, show its subtree. |
| `/confluence gap <pageId>` | Doc-rot / thinness heuristics over the mirrored body: stale `version.when`, thin `## Body`, unresolved macros, missing owners/labels. Read-only findings; suggests (never runs) a Phase-4 `enhance`. |
| `/confluence stale` | List mirrored pages drifted vs remote — items whose `status_sync` is `remote-ahead` or `diverged` — so the user knows what a `pull` would refresh. This reports **per-item** drift; it is distinct from the mirror-wide 24h staleness banner. |

## Glossary verbs (Phase 2)

The glossary (`.claude/config/glossary.json`) is the framework's learned bank vocabulary — shared
cross-tool with JIRA. Term resolution runs automatically on every discovery prompt (the agent's §2a
glossary pass). These verbs are the explicit, on-demand entry points; both delegate to
`confluence-search`.

| Verb | Behaviour |
|---|---|
| `/confluence glossary show <term>` | Look `<term>` up in `glossary.json` (case-insensitive, by key or alias). Print `expansion`, `definition`, `provenance` (pointers), and `relatedTerms`. If absent, say so and offer to resolve it now via the §2a algorithm (glossary → `specs/` → mirrors → ask), persisting **only on explicit confirmation**. |
| `/confluence glossary harvest [<SPACE>\|<pageId>]` | Scan mirrored bodies (`confluence/**/*.md`, optionally scoped to a space or a page) for first-use-expansion patterns (`"POBO (Payment On Behalf Of)"`) and glossary/definition macros. Present a **batch** of proposed terms for one-click **confirm/reject per item**; write **only the confirmed ones** (`confirmedBy: "human"`, `confirmedAt`). Reads the mirror, so it finds nothing until Phase 3 has pulled pages — the verb and its confirm loop work now; content arrives later. |

**Human-confirmed on write — no exceptions.** No term enters `glossary.json` without an explicit
approval, whether from `show` (single) or `harvest` (batch). Nothing is ever guessed and silently
persisted. Provenance is stored as **pointers only** — never secrets or restricted body text.

## Guardrails

- **Read vs write is enforced at the router.** `confluence-search` discovers / reads / summarizes /
  synthesizes only; every mutation goes through a write-back verb
  (`/confluence push|create|enhance`) → the shared 8-step engine, with its dry-run + approval +
  version-guard gates. The one exception is `.claude/config/glossary.json`, which the agent may write
  **only after explicit human confirmation** (never a remote mutation).
- **Glossary writes are human-confirmed, pointers-only.** No term is guessed or silently persisted;
  provenance stores pointers, never secrets or restricted body text.
- **Live discovery is never staleness-gated.** Staleness gates only Phase-3+ mirror-derived answers.
- **`pull` moves `lastSyncedAt`; `reindex` never does** (two-timestamp invariant).
- **Never auto-run `/reconcile-requirements`** — a write-back may *suggest* it (R3); routing does not
  trigger it. Synthesis targets `docs/`, not `specs/`.
- **No secrets** — the MCP session brokers auth; `cloudId` is the pinned `confluence-sync.config.yml`
  value, never hardcoded.
- Any Mermaid diagram emitted downstream follows `@.claude/standards/mermaid-standards.md`.

## Cross-references

- Agent: `.claude/agents/confluence-search.md` (term resolution §2a)
- Write-back engine: `.claude/commands/confluence-write-engine.md` (shared 8-step pipeline)
- Write-back verbs: `.claude/commands/confluence-push.md` (A) · `confluence-create.md` (B) · `confluence-enhance.md` (C)
- Phase-5 analytical verbs: `.claude/commands/confluence-relationship-map.md` · `confluence-design-sync.md` · `confluence-comment-triage.md`
- Config: `.claude/config/confluence-sync.config.yml`
- Glossary: `.claude/config/glossary.json` (+ `.claude/config/glossary.schema.json`) — shared cross-tool
- Proven twin: `.claude/commands/jira.md`
