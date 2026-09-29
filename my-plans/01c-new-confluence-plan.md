# Plan 1c — Confluence Integration, Reimagined (Rovo-First Discovery + Citation-Cache Mirror + Glossary-Aware NL Engine)

> **Status:** Proposed · **Author:** AI Tools Expert / Frameworks Designer
> session · **Date:** 2026-08-02 **Supersedes (as the plan of record):**
> `my-plans/01b-confluence-plan.md` — this is a complete re-design, not an edit.
> 01b's local-mirror model is folded in wholesale; the pivot is that **Rovo
> Search becomes the org-wide primary discovery engine and the local mirror
> becomes a citation/cache layer**, plus a new **glossary/term-resolution
> capability** and a set of "outside-the-box" features drawn from how other PPCC
> teams actually use Confluence. **Sibling plans:** `my-plans/01a-jira-plan.md`
> (proven twin — mirror the patterns) · `my-plans/02-figma-lumen-plan.md`
> **Project grounding:** Confluence on `commbank.atlassian.net` (cloudId
> `998e78d7-2a66-4fc0-809b-b43b4232d4b8`). Home space **SEC** ("CITB Solution —
> Entity onboarding", pages `2097876103`, `2127187669`). User-referenced space
> **PCON** (page `2042342654` "CommBiz Reinvented — Admin Hub 2.0 — Party
> Credentials Management"; related page `1332713924` "CommBiz User Onboarding").
> Related JIRA project **EON**; issue `XLUV-2866`.

---

## 0. What this plan is, and why it is a re-design

`01b` designed Confluence as a **JIRA-twin**: a git-tracked local mirror with a
derived index, and "search" meant substring matching over that local index. That
is the right model for _citation and change-tracking_, but it is the **wrong
model for discovery**. During grounding, the user's real question —

> _"Search Confluence for a solution to implement temporary account credentials
> creation for someone new-to-bank (NTB) acting as a POBO"_

— was run through the Atlassian **Rovo** `search` tool and returned the _exact_
SEC + PCON pages **and** the related EON/XLUV JIRA issues, ranked semantically,
across spaces and across products, with **zero prior local mirror**. A substring
index over a partial local copy cannot do that. So:

**The pivot (this plan's thesis):**

| Concern                    | 01b answer                               | 01c answer                                                                                                                                                     |
| -------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Discovery / "find me…"** | substring match over local `_index.json` | **Rovo `search`, org-wide, semantic, cross-product** — the mirror is not consulted for discovery                                                               |
| **Local mirror**           | the search index                         | a **citation cache**: authoritative for _what we pulled, when, and whether it drifted_ — the durable, greppable, git-reviewable copy of pages we chose to keep |
| **Staleness (24h)**        | gates _all_ answers                      | gates **only mirror-derived answers** (summaries/diffs over the local copy). **Never gates live Rovo search** — Rovo is always current                         |
| **Terms/abbreviations**    | not addressed                            | **glossary + term-resolution algorithm** (scan `specs/` → local `confluence/`+`jira/` → ask human), recorded in `.claude/config/glossary.json`                 |

Everything else that made 01a/01b strong — verbatim import (R1), separation of
concerns (R3), version + dual-hash diffing, the two-timestamp invariant, shared
`people.json`, the gated write-back engine, the mandatory operating guide — is
**kept and mirrored to 01a's proven shape**.

### 0.1 Carried forward unchanged (proven — do not re-litigate)

| #                           | Decision                                                                                                                                                                                                                                                                       | Rationale                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **R1**                      | **No de-identification.** Import content **verbatim**.                                                                                                                                                                                                                         | Private, org-staff-only repo; identical names already live in Confluence/JIRA. De-id = cost + drift for zero gain. |
| **R2**                      | **Store local copies** (`.md` body + `.json` sidecar), synced by a manifest with **version + dual-hash comparison**.                                                                                                                                                           | Reviewable git diffs, deterministic reconciliation, greppable Markdown bodies.                                     |
| **R3**                      | **Separation of concerns.** Sync ≠ generate ≠ reconcile ≠ push. Ingest touches only `confluence/` + manifest; `/create-specifications` only reads it; `/reconcile-requirements` is the only path from a changed mirror to `specs/`; **never auto-run reconcile after a push.** | Prevents surprise spec churn and runaway token cost.                                                               |
| **R4**                      | `/create-specifications` accepts N inputs, e.g. `/create-specifications raw-requirements/req.md confluence jira figma`.                                                                                                                                                        | One entry point produces the initial `specs/`.                                                                     |
| **Write-back engine**       | Features **A (push edited mirror)**, **B (create from brief)**, **C (batch enhance)** = three entry points into **one** gated mutation pipeline.                                                                                                                               | One marker convention, one lost-update guard, one reconcile step, one place a Confluence write can happen.         |
| **Two-timestamp invariant** | `generatedAt` (every reindex) ≠ `lastSyncedAt` (only a pull). Reindex is strictly offline and copies `lastSyncedAt` through — never `now()`.                                                                                                                                   | The whole staleness contract depends on this.                                                                      |
| **Shared identity**         | One canonical `.claude/config/people.json`; agents read it directly. `unresolvedAliasPolicy: "ask"`.                                                                                                                                                                           | JIRA/Confluence/Figma resolve the same humans; aliases hand-authored once.                                         |

### 0.2 New in this plan (the enhancements — indexed for traceability)

| #        | Enhancement                                                                                                                                                                                                                                           | Section |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **CN1**  | **Rovo-first discovery**: `search` is the org-wide primary engine; the mirror is a citation cache                                                                                                                                                     | §1, §5  |
| **CN2**  | **`confluence-search` agent** — activates when the user asks to search Confluence, follows a Rovo link, or requests a space summary; NL in, cited answers out                                                                                         | §5      |
| **CN3**  | **Thin `/confluence` router** — sub-verbs `search / read / summary / space / who / tree / stale / gap / glossary / pull / reindex`; classifies bare NL; hands mutations to the write-back engine                                                      | §5.1    |
| **CN4**  | **Glossary + term-resolution algorithm** — `.claude/config/glossary.json`, human-confirmed on write, cross-tool, git-tracked                                                                                                                          | §4      |
| **CN5**  | **Three worked scenarios** as acceptance tests: NTB/POBO NL search; link+task → technical doc; PCON space change summary                                                                                                                              | §6      |
| **CN6**  | **Citation contract** — every answer cites `spaceKey / pageId / title / version / url`, and marks each source `live-rovo` or `mirror(lastSyncedAt=…)`                                                                                                 | §5.4    |
| **CN7**  | **Folder-by-type mirror** (`pages/ blogposts/ attachments/`) + per-item `.md` + `.json` sidecar; per-space manifest with `treeHash`                                                                                                                   | §2      |
| **CN8**  | **Derived, gitignored `confluence/_index.json`** (regenerable rollup)                                                                                                                                                                                 | §3      |
| **CN9**  | **Version + dual-hash diff** with `status_sync ∈ clean\|remote-ahead\|local-ahead\|diverged\|new\|orphaned`; scope-aware CQL                                                                                                                          | §7      |
| **CN10** | **Gated write-back engine** (A/B/C) — section-scoped writes on stable heading anchors; version.number optimistic lock; crash-safe intent record                                                                                                       | §8      |
| **CN11** | **"Outside-the-box" feature set** — EDR/ADR templates, design-doc-synced-to-code, doc-rot finder, page→spec/technical-doc synthesis, cross-space relationship maps, meeting-note & runbook capture, glossary auto-harvest, link-graph, comment triage | §9      |
| **CN12** | **Hooks** — glossary-harvest hook, stale-citation warning hook, source-manifest updater hook                                                                                                                                                          | §9.10   |
| **CN13** | **Traceability** — `specs/sources/manifest.json` + RTM Source column ("nothing lost, nothing dangling"), shared with JIRA                                                                                                                             | §10     |
| **CN14** | **Challenges & mitigations** — the critical analysis the user asked for                                                                                                                                                                               | §12     |

---

## 1. The model in one picture

```
  REMOTE (systems of record)          DISCOVERY (always live)              LOCAL MIRROR = CITATION CACHE (git-tracked)
  ┌───────────────────────────┐       ┌───────────────────────────┐       ┌─────────────────────────────────────────┐
  │ Confluence (all spaces)   │       │ Rovo `search`  (semantic,  │       │ confluence/pages/SEC-2097876103.md +.json │
  │  SEC · PCON · … + JIRA     │◀──────│  cross-space, cross-       │       │ confluence/blogposts/…                     │
  │  (Rovo indexes both)      │ query │  product, ALWAYS CURRENT)  │       │ confluence/spaces/SEC.json (tree+roster)   │
  └───────────────────────────┘       └────────────┬──────────────┘       │ confluence/.manifest.json (sync state)     │
            ▲                                        │ cite                 └────────────────────┬────────────────────┘
            │ pull (chosen pages only)               ▼
            │                          ┌───────────────────────────┐                             │ roll-up
            │                          │ confluence-search agent    │                             ▼
            │                          │  • glossary-aware NL       │       ┌─────────────────────────────────────────┐
            │                          │  • cites live-rovo OR      │       │ confluence/_index.json (DERIVED, gitignored)│
            │                          │    mirror(lastSyncedAt)    │       └─────────────────────────────────────────┘
            │                          └────────────┬──────────────┘                             │
            │                                        │ term unknown?                              ▼ read-only
            │                          scan specs/ → local mirrors → ASK        specs/ (via /create-specs · /reconcile, R3)
            │                                        │                                            ▲
            │                                        ▼                                            │
            │                          .claude/config/glossary.json  (human-confirmed, cross-tool)│
            └──────── write-back engine (DIFF→DRY-RUN→APPROVE→lost-update RE-CHECK→MUTATE→RE-PULL→RECONCILE→SUGGEST) ┘
```

**Five state layers, each with ONE owner** (the "third source of truth" trap,
defused as in 01a):

| Layer                         | File(s)                                                 | Authoritative for                                    | Written by                                                |
| ----------------------------- | ------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| **Discovery**                 | _(none — Rovo is remote)_                               | "what exists / what's relevant, org-wide, right now" | nobody local; queried live                                |
| **Sync state**                | `confluence/.manifest.json` + per-item `.json` sidecars | status/hashes/versions/timestamps of _pulled_ pages  | pull + write-back engine                                  |
| **Per-space roster**          | `confluence/spaces/{SPACE}.json`                        | space tree, page roster, `treeHash`                  | `/confluence pull`, `/confluence-sync`                    |
| **Global index** (DERIVED)    | `confluence/_index.json`                                | rollup: titles, spaces, ancestry, labels, one-liners | **regenerated** offline — never hand-edited; gitignored   |
| **Users/aliases** (HAND)      | `.claude/config/people.json`                            | real usernames ↔ friendly aliases                    | humans only; regeneration never touches it                |
| **Glossary** (HAND-CONFIRMED) | `.claude/config/glossary.json`                          | term/abbreviation → meaning + provenance             | `confluence-search` **proposes**; human **confirms** (§4) |

---

## 2. On-disk layout (the citation-cache mirror)

```
confluence/
├── .manifest.json               # domain sync manifest — one entry per mirrored item (status/hash/version)
├── manifest.schema.json         # JSON Schema for .manifest.json + per-item sidecars (validation)
├── _index.json                  # DERIVED global index (regenerable rollup — §3) — GITIGNORED
├── spaces/
│   ├── SEC.json                 # per-space manifest: page tree + roster + treeHash + space metadata
│   └── PCON.json
├── pages/
│   ├── SEC-2097876103.md        # human body: verbatim page content, Confluence→Markdown (§2.2)
│   ├── SEC-2097876103.json      # sidecar: spaceKey, ancestors, labels, version, hashes, status_sync, url
│   └── PCON-2042342654.md
├── blogposts/
│   ├── SEC-3311xxxx.md
│   └── SEC-3311xxxx.json
└── attachments/
    └── SEC-2097876103/          # binaries referenced by a page, keyed by parent pageId
        └── admin-hub-flow.png
```

> **Naming.** Items are keyed `{SPACE}-{pageId}` so the space is legible on disk
> and two spaces can never collide. The `pageId` is the stable Confluence
> identity (titles change; ids don't).

### 2.1 Per-item sidecar (`{SPACE}-{id}.json`)

```jsonc
{
  "pageId": "2042342654",
  "spaceKey": "PCON",
  "type": "page", // page | blogpost
  "title": "CommBiz Reinvented - Admin Hub 2.0 - Party Credentials Management",
  "url": "https://commbank.atlassian.net/wiki/spaces/PCON/pages/2042342654/...",
  "ancestors": ["1332713924"], // parent chain (root-last), for tree + breadcrumbs
  "labels": ["party-credentials", "admin-hub"],
  "version": {
    "number": 14,
    "when": "2026-07-30T04:11:00Z",
    "byId": "acc:...",
  },
  "contentHash": "sha256:…", // hash of the LAST-PULLED normalized body (remote truth)
  "localEditsHash": "sha256:…", // hash of the on-disk body NOW (detects hand edits)
  "status_sync": "clean", // clean|remote-ahead|local-ahead|diverged|new|orphaned (§7)
  "lastSyncedAt": "2026-08-02T09:00:00Z",
  "commentsPulled": true,
  "sourceRef": "confluence:PCON:2042342654", // stable id used by specs/sources/manifest.json (§10)
}
```

### 2.2 Body normalization (`{SPACE}-{id}.md`)

- Pulled via `getConfluencePage(contentFormat:"markdown")` → verbatim, no
  redaction (R1).
- Each Confluence heading becomes a `##` **stable anchor**; body is partitioned
  into **pushable** (`## …` authored prose) vs **pull-only** (`## Comments`,
  `## Metadata`) regions with load-bearing `<!-- pushable -->` /
  `<!-- pull-only -->` HTML-comment markers the diff engine keys on (identical
  discipline to 01a §2.4). **Unconvertible macros** (e.g. Jira-issue macros,
  includes, page properties) are preserved as opaque `<!-- macro:… -->` fenced
  blocks and are **never** rewritten by a section-scoped push (§8) — this is why
  writes are section-scoped, not whole-page.

### 2.3 Per-space manifest (`spaces/{SPACE}.json`)

```jsonc
{
  "spaceKey": "PCON",
  "spaceName": "CommBiz Reinvented",
  "homepageId": "1332713924",
  "roster": [
    {
      "pageId": "2042342654",
      "title": "…",
      "version": 14,
      "parentId": "1332713924",
    },
  ],
  "treeHash": "sha256:…", // hash of the ordered (pageId,parentId,version) roster — cheap change signal
  "lastSyncedAt": "2026-08-02T09:00:00Z",
}
```

`treeHash` lets `/confluence space PCON --changed-since` detect _structural_
change (page added / moved / bumped) without re-pulling every body.

---

## 3. The derived index & the users projection

### 3.1 `confluence/_index.json` (DERIVED, gitignored)

A compact rollup an agent can load in one read to answer _mirror-scoped_
questions:

```jsonc
{
  "generatedAt": "2026-08-02T09:05:00Z", // set on EVERY reindex (offline-safe)
  "lastSyncedAt": "2026-08-02T09:00:00Z", // copied from newest pull — reindex NEVER sets now()
  "counts": { "pages": 12, "blogposts": 1, "spaces": 2 },
  "items": [
    {
      "key": "PCON-2042342654",
      "space": "PCON",
      "title": "…",
      "labels": ["…"],
      "parent": "1332713924",
      "version": 14,
      "status_sync": "clean",
      "sourceRef": "confluence:PCON:2042342654",
    },
  ],
  "spaces": {
    "PCON": { "tree": { "1332713924": ["2042342654"] }, "treeHash": "…" },
  },
  "orphans": [], // mirrored pages whose remote page no longer exists (§7)
}
```

### 3.2 Regeneration rule (the invariant that makes staleness trustworthy)

`/confluence reindex` is **strictly offline**: read every sidecar + per-space
manifest, rebuild `_index.json`, set `generatedAt = now`, **carry `lastSyncedAt`
through unchanged**. Sidecars win on any disagreement. Only a real pull
(`/confluence pull`, `/confluence-sync`) advances `lastSyncedAt`.

### 3.3 Identity — `.claude/config/people.json`

Identity is stored in the single shared file `.claude/config/people.json`
(canonical `id` + per-tool handles `jira` / `confluence` / `figma` +
`aliases[]`). `unresolvedAliasPolicy: "ask"` — an unknown alias triggers a
clarifying question, never a guess. Newly-seen authors on a pull are appended
**additively** with empty `aliases:[]`.

### 3.4 `.gitignore` posture (must land atomically across 01a/01b/01c — decision D16/D17)

```
confluence/_index.json      # derived, regenerable — do not commit
jira/_index.json            # (same rule, 01a)
```

Everything else under `confluence/` **is** committed — the whole point of a
citation cache is a reviewable git history of what we pulled and how it drifted.

### 3.5 Scripts inventory (`scripts/confluence/`)

Five TypeScript scripts, all invoked via `node_modules/.bin/tsx` (no compiled
install step):

| Script          | Purpose                                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init.ts`       | Phase-0 scaffold: creates `confluence/` skeleton, empty `.manifest.json`; when re-run, emits a drift report (stale/new/moved/orphaned pages) without writing anything                    |
| `converter.ts`  | Converts Confluence storage/ADF → normalised Markdown body with `<!-- pushable -->` / `<!-- pull-only -->` region markers and opaque ` ```macro ` fences for unconvertible macros        |
| `hash.ts`       | SHA-256 utilities — `mdBody()` (normalise before hashing) + `hashBody()` (content hash) + `hashPushable()` (pushable-region hash); used by pull, reindex, and the write-back engine      |
| `mcp-client.ts` | Thin wrapper over the Atlassian MCP tools (`getConfluencePage`, `searchConfluenceUsingCql`, etc.) for use within scripts; keeps MCP call patterns DRY across init, pull, and write-back  |
| `reindex.ts`    | Offline `_index.json` rollup — reads all sidecars + per-space manifests, rebuilds the index, sets `generatedAt = now`, copies `lastSyncedAt` through unchanged (two-timestamp invariant) |

---

## 4. Glossary & term-resolution (CN4)

The single highest-leverage "new to Confluence" feature: the framework should
_learn the bank's vocabulary_ as it goes, so that a query like _"NTB acting as a
POBO"_ is understood, not fumbled.

### 4.1 `.claude/config/glossary.json` (cross-tool, git-tracked, human-confirmed)

```jsonc
{
  "terms": {
    "POBO": {
      "expansion": "Payment On Behalf Of",
      "definition": "A party initiating payments on behalf of another legal entity …",
      "provenance": [
        { "source": "confluence:PCON:2042342654", "quote": "…", "confidence": "high" }
      ],
      "aliases": ["pobo", "payment-on-behalf-of"],
      "relatedTerms": ["NTB", "delegated-authority"],
      "confirmedBy": "human", "confirmedAt": "2026-08-02T09:10:00Z"
    },
    "NTB": { "expansion": "New To Bank", "definition": "…", "provenance": [...], "confirmedBy": "human" }
  }
}
```

Why a **shared** config file, not a `confluence/`-local one: terms are
bank-wide, appear in JIRA and specs too, and the JIRA plan's `jira-helper`
benefits equally. It sits beside `people.json`.

### 4.2 The term-resolution algorithm (deterministic, ask-last)

When `confluence-search` meets an unknown token in a query (a capitalised
acronym, or a term not in `glossary.json`):

1. **Glossary hit?** → resolve, expand the query, proceed. (Fast path.)
2. **Scan `specs/`** (business-requirements, functional-specifications,
   data-dictionary, RTM) for a definition or an unambiguous usage. If found →
   **propose** a glossary entry with that provenance.
3. **Scan local mirrors** — `confluence/**/*.md` then `jira/**/*.md` — for a
   defining sentence (`"POBO (Payment On Behalf Of)"`, glossary macros,
   first-use expansions). If found → **propose**.
4. **Ask the human** via `AskUserQuestion` (multi-choice: candidate expansions
   found in steps 2–3, plus "Something else"). Never guess silently.
5. On any of 2–4 producing an answer, **write is human-confirmed** (Q2
   decision): show the proposed `{expansion, definition, provenance}` and only
   persist to `glossary.json` on explicit approval.

> **Guardrail:** the glossary stores _meaning + provenance_, never secrets. A
> term whose only source is a restricted page still records the `sourceRef` (a
> pointer), not restricted body text.

### 4.3 Auto-harvest (opt-in, still human-confirmed)

A `/confluence glossary harvest [<SPACE>|<pageId>]` verb scans mirrored bodies
for first-use-expansion patterns and glossary/definition macros, and presents a
**batch** of proposed terms for one-click confirm/reject. This is how the
registry fills quickly without ever guessing.

---

## 5. Discovery — the `confluence-search` agent + `/confluence` router (CN2, CN3)

### 5.1 `/confluence` router (thin, mirrors `/jira`)

`$ARGUMENTS` — a bare NL prompt
(`/confluence "how do we do temporary credentials for an NTB POBO?"`) or a
sub-verb.

**Preconditions (every invocation):**

1. If a sub-verb needs the mirror (`summary`, `tree`, `who`, `gap`, `reindex`,
   `pull`) and `confluence/.manifest.json` is absent → tell the user to run
   `/confluence-init` and STOP.
2. **Staleness applies to mirror-derived answers ONLY** (CN1). `search` /
   `read <url>` are **live Rovo** and are never gated. For a mirror-derived
   verb, if `_index.json.lastSyncedAt` is older than `stalenessHours` (24),
   offer `AskUserQuestion` → **[Sync & answer / Answer from mirror anyway
   (banner) / Cancel]**. A pull moves `lastSyncedAt`; `reindex` does not.

| Form                                             | Intent                                 | Engine                                      |
| ------------------------------------------------ | -------------------------------------- | ------------------------------------------- |
| `/confluence "<natural language>"`               | classify                               | `confluence-search`; write-back if mutation |
| `/confluence search <query>`                     | **live Rovo** org-wide semantic search | `confluence-search` → `search`              |
| `/confluence read <url\|pageId>`                 | fetch + digest a specific page (live)  | `confluence-search` → `getConfluencePage`   |
| `/confluence summary <SPACE> [--since <window>]` | space change summary                   | `confluence-search` (Rovo + mirror diff)    |
| `/confluence space <SPACE>`                      | space tree / roster view               | `confluence-search` (mirror or live)        |
| `/confluence who <alias>`                        | pages authored/edited by a person      | `confluence-search` + `people.json`         |
| `/confluence tree [<pageId>]`                    | ancestry/descendant map (Mermaid)      | `confluence-search` (§9.7)                  |
| `/confluence gap <pageId>`                       | doc-rot / staleness / thinness check   | `confluence-search` (§9.3)                  |
| `/confluence glossary [harvest\|show <term>]`    | glossary ops (§4)                      | `confluence-search`                         |
| `/confluence stale`                              | list mirrored pages drifted vs remote  | `confluence-search` (version diff)          |
| `/confluence pull <SPACE\|pageId\|url>`          | pull page(s) into the cache            | §7 deterministic pull                       |
| `/confluence reindex`                            | rebuild `_index.json` (OFFLINE)        | deterministic rollup                        |

### 5.2 `confluence-search` agent — shape (mirrors `jira-helper`)

```yaml
name: confluence-search
description: >
  Discover and synthesize Confluence content. Rovo `search` is the org-wide
  primary engine; the local mirror is a citation cache consulted only for
  mirror-scoped answers (summaries, drift, tree). Glossary-aware: resolves
  unknown terms via specs → mirrors → ask, and PROPOSES glossary entries (human
  confirms). Cites every source as live-rovo or mirror(lastSyncedAt).
  READ/ANALYZE ONLY — never mutates Confluence and never writes back inline;
  mutation intents are named and returned to the /confluence router, which hands
  off to the /confluence-* write-back engine. Activates when the user asks to
  search Confluence, follows a Confluence URL, or asks for a space summary.
  Delegated to by /confluence; runnable via `claude --agent confluence-search`.
mode: subagent
model: anthropic/claude-sonnet-4-5
temperature: 0.1
tools:
  Read, Grep, Glob, mcp__atlassian__search,
  mcp__atlassian__searchConfluenceUsingCql, mcp__atlassian__getConfluencePage,
  mcp__atlassian__getConfluencePageDescendants,
  mcp__atlassian__getConfluencePageFooterComments,
  mcp__atlassian__getConfluencePageInlineComments
```

**On invocation:**

1. **Classify** the prompt: _discovery_ (find/what/how/where), _read_ (a
   URL/pageId is present), _summary_ (a space + a time window),
   _mirror-analytic_ (who/tree/gap/stale), or _mutation_.
2. **Glossary pass** (§4.2) — resolve unknown terms _before_ searching; expand
   the query with confirmed expansions (e.g. `POBO` → also search "Payment On
   Behalf Of").
3. **Route to the right engine** (§5.3). Discovery/read/summary → **live
   Rovo/CQL/page fetch, never staleness-gated.** Mirror-analytic → honour the
   24h banner.
4. **Cite** every source (§5.4).
5. **Clarify vague prompts first** via `AskUserQuestion` (which space? which
   time window? whole space or one subtree?) — deliberately vague prompts always
   get a question, never a guessed answer.
6. **Mutation intents** are named and returned to the router (never performed
   here).

### 5.3 Engine selection

| Situation                                  | Primary tool                                                                                              | Fallback / refine                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| "find / where is / how do we…" (discovery) | `mcp__atlassian__search` (Rovo, org-wide)                                                                 | `searchConfluenceUsingCql` for space/label/date-scoped precision |
| A Confluence URL or pageId is given        | `getConfluencePage(contentFormat:"markdown")` (+ descendants/comments as needed)                          | —                                                                |
| "summary of latest changes in SPACE"       | `searchConfluenceUsingCql` (`space=SPACE AND lastmodified >= …`) for the changed set, then per-page fetch | diff vs mirror if pages are cached                               |
| "who wrote / edited …"                     | `people.json` + CQL `creator`/`contributor`                                                               | Rovo if not mirrored                                             |
| tree / drift / gap / stale                 | **mirror** (`_index.json`, sidecars, `treeHash`)                                                          | live re-pull if user opts in                                     |

### 5.4 Citation contract (CN6) — non-negotiable output discipline

Every answer that uses Confluence content **must** cite, per source:

```
[PCON:2042342654 v14] "CommBiz Reinvented — Admin Hub 2.0 — Party Credentials Management"
  https://commbank.atlassian.net/wiki/spaces/PCON/pages/2042342654/...
  source: live-rovo (fetched 2026-08-02T09:00Z)      # or: mirror (lastSyncedAt 2026-08-01T…, may be stale)
```

- **Provenance tag** — `live-rovo` (always current) or `mirror(lastSyncedAt=…)`.
  A mixed answer lists each source's tag; if _any_ mirror source is stale,
  prepend the one-line staleness banner — but **never** withhold a live-Rovo
  answer for staleness.
- No source, no claim. Synthesized technical docs (§6.2) carry a **Sources**
  section with this block per cited page, so the reader can verify every
  assertion.

---

## 6. The three worked scenarios (CN5 — these are acceptance tests)

### 6.1 NTB/POBO natural-language search

> _"Search Confluence for a solution to implement temporary account credentials
> creation for someone new-to-bank (NTB) acting as a POBO"_

1. Glossary pass: `NTB`, `POBO` unknown → resolve via §4.2 (scan `specs/` →
   mirrors → confirmed propose). Query expands to include "New To Bank",
   "Payment On Behalf Of".
2. `mcp__atlassian__search` org-wide → ranked pages across SEC/PCON + related
   EON/XLUV issues.
3. Answer = ranked, **cited** shortlist with a 1–2 line "why relevant" each;
   offer _"pull the top N into the cache?"_ and _"synthesize a technical doc
   from these? (→ §6.2)"_.
4. **Not** staleness-gated (live Rovo). New confirmed terms are now in
   `glossary.json` for next time.

### 6.2 Link + task → detailed technical document

> _"Read `https://…/PCON/pages/2042342654/…` and create a detailed technical
> document on how temporary credentials can be created for a user in identity
> onboarding"_

1. `getConfluencePage(2042342654, markdown)` + `getConfluencePageDescendants` +
   footer/inline comments (design caveats often live in comments).
2. Rovo `search` for adjacent context (the "CommBiz User Onboarding" parent
   `1332713924`, related EON issues) — synthesis, not just transcription.
3. Emit a **technical document** to
   `docs/technical/temporary-credentials-ntb-pobo.md` with: context, as-is flow,
   proposed design mapped to _this_ repo's stack (PingID, NestJS/Fastify,
   Prisma, Zod, CDK), sequence diagram (Mermaid, per
   `@.claude/standards/mermaid-standards.md`), open questions, and a **Sources**
   section (§5.4). **R3 holds:** this writes to `docs/`, _not_ `specs/`; turning
   it into requirements is a separate, explicit `/reconcile-requirements` /
   `/create-specifications`.
4. Offer to `/confluence pull` the cited pages so the doc's citations become
   durable + diffable.

### 6.3 Space-scoped change summary

> _"Create a summary of the latest changes made to the PCON space on
> Confluence"_

1. Clarify window if absent (`AskUserQuestion`: last 7d / 30d / since last
   sync).
2. `searchConfluenceUsingCql`:
   `space = PCON AND lastmodified >= now("-30d") ORDER BY lastmodified DESC`.
3. If PCON is mirrored, **diff** the changed set against sidecar
   `version.number` → "what actually changed" (new pages, version bumps, moves
   via `treeHash`), not just "what was touched".
4. Cited, grouped-by-page summary; offer to pull the changed pages to refresh
   the cache.

---

## 7. Sync mechanics — version + dual-hash diff, scope-aware CQL (CN9)

### 7.1 Change detection

Confluence's `version.number` is the **reliable** change signal (far better than
`updated` timestamps, which move on trivial re-saves). Diff algorithm per
mirrored page:

- `remote.version.number > sidecar.version.number` → **remote-ahead**.
- `localEditsHash(on-disk) ≠ sidecar.contentHash` → **local-ahead**
  (hand-edited).
- both → **diverged** (needs the write-back lost-update guard, §8).
- remote page id gone → **orphaned**; brand-new remote page in scope → **new**;
  else **clean**.

### 7.2 Scope-aware CQL

Pulls and change-scans are **scoped** — never "all of Confluence":

```
space = PCON
  AND (label in ("party-credentials","admin-hub") OR ancestor = 1332713924)
  AND lastmodified >= now("-30d")
ORDER BY lastmodified DESC
```

Scope is declared per pull in `.claude/config/confluence-sync.config.yml`
(`spaces[]`, optional `labels[]`, `ancestors[]`, `stalenessHours: 24`,
`pullComments: true`).

### 7.3 `/confluence pull` (deterministic, read-only — never mutates remote)

1. Resolve target (`SPACE` → CQL roster; `pageId`/`url` → single page + optional
   descendants).
2. Page through `searchConfluenceUsingCql` (cursor) →
   `getConfluencePage(markdown)` per hit; `getConfluencePageDescendants` for
   subtree pulls; comments if `pullComments`.
3. Convert → `pages/{SPACE}-{id}.md` + `.json` sidecar; attachments →
   `attachments/{id}/`.
4. **Roster diff before overwrite:** compute added/modified/removed vs
   `spaces/{SPACE}.json.roster`; **show for approval** before overwriting
   bodies. For any page with `localEditsHash` ≠ stored (hand-edited) → **do not
   clobber**; mark `remote-ahead`/`diverged` and report.
5. Append newly-seen authors to `people.json` (additive).
6. **This is a real pull → advance `lastSyncedAt`** + reindex the affected
   subtree; recompute `treeHash`.
7. Report: N written, roster changes, any pages withheld for divergence.

### 7.4 `/confluence reindex` (OFFLINE)

Read sidecars + per-space manifests → rebuild `_index.json`;
`generatedAt = now`; **`lastSyncedAt` untouched**. Sidecars win. Report counts +
`generatedAt`; note `lastSyncedAt` unchanged.

---

## 8. Write-back engine (CN10) — three entry points, one gated pipeline

Identical philosophy to 01a §8. **Read-first discipline: no live remote
mutations during design/planning.** Section-scoped writes protect unconvertible
macros (§2.2).

**The 8-step pipeline (all three features share it):**
`DIFF/DRAFT → DRY-RUN (show exact ADF/section change) → APPROVE (human) → RE-CHECK lost-update (re-fetch version.number; abort if bumped since draft) → MUTATE (update only the targeted stable heading section) → RE-PULL (refresh sidecar+body+version) → RECONCILE (manifest, treeHash) → SUGGEST (never run) /reconcile-requirements if specs may be affected (R3)`.

| Entry                      | Trigger                                                   | What it writes                                                                |
| -------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **A — push edited mirror** | user hand-edited a mirrored `pages/*.md` and asks to push | section-scoped `updateConfluencePage` on the changed pushable heading(s) only |
| **B — create from brief**  | "create a Confluence page from this brief/doc under PCON" | `createConfluencePage` (title, space, parent, labels) then pull it back       |
| **C — batch enhance**      | "improve/expand these pages' … sections"                  | per-page section-scoped updates, each individually dry-run + approved         |

- **Marker:** `[CANS-SYNC|page={id}|version={n}|run={uuid}]` in the version
  message (not the body) — provenance without polluting content.
- **Optimistic lock:** `version.number` at draft time; re-checked immediately
  before mutate.
- **Crash-safe intent record:** the approved diff + target section + `run` uuid
  persisted to a SHA-256-named intent file before the write, so a crashed run is
  resumable/auditable, never double-applied.
- **Never** auto-run `/reconcile-requirements` (R3); the engine only _suggests_
  it.

---

## 9. "Outside-the-box" feature set (CN11) — what other PPCC teams actually do with Confluence

Grounded in ceb-MCP findings on PPCC Confluence usage (Engineering Decision
Records, design docs synced to production, technical specs, experimentation
templates, and an active Confluence→Markdown conversion effort). Each is a
small, composable command/template/hook — not a monolith.

| #        | Feature                             | What it does                                                                                                                                                                                                                                                                                                                                                                                                             | Command / artifact                              |
| -------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| **9.1**  | **EDR/ADR bridge**                  | Pull a Confluence Engineering Decision Record and reconcile it with the repo's `.claude/templates/adr-template.md`; or push a repo ADR up as an EDR page (Feature B). Keeps decisions in both places without hand-copying.                                                                                                                                                                                               | `/confluence edr <pageId\|adr-file>`            |
| **9.2**  | **Design-doc ↔ code sync**          | Given a synced design page, generate/refresh a `docs/design/*.md` and flag where code has drifted from the documented design (heuristic: referenced modules/endpoints that no longer exist).                                                                                                                                                                                                                             | `/confluence design-sync <pageId>`              |
| **9.3**  | **Doc-rot / staleness finder**      | Over the mirror + Rovo: pages not edited in N months, pages that reference decommissioned systems, pages whose linked JIRA issues are all Done (candidate: archive). Report, never mutate.                                                                                                                                                                                                                               | `/confluence gap`, `/confluence stale`          |
| **9.4**  | **Page → technical-doc synthesis**  | The §6.2 engine, generalized: any page(set) → a stack-aware technical doc in `docs/technical/`.                                                                                                                                                                                                                                                                                                                          | `/confluence read … && synthesize`              |
| **9.5**  | **Cross-space relationship map**    | Mermaid graph of page ancestry + inter-page links + page↔JIRA-issue links, scoped to a space or subtree. Reveals how PCON/SEC/EON interconnect.                                                                                                                                                                                                                                                                          | `/confluence tree`, `/confluence map`           |
| **9.6**  | **Meeting-note & decision capture** | Template + Feature-B push: turn a session's decisions into a structured Confluence meeting-notes/decision page (with `decision-list` macro), cited back to the driving JIRA/spec.                                                                                                                                                                                                                                        | `.claude/templates/confluence-meeting-notes.md` |
| **9.7**  | **Runbook capture**                 | Reconcile `.claude/templates/deployment-runbook-template.md` ⇄ a Confluence runbook page — one source, two homes.                                                                                                                                                                                                                                                                                                        | `/confluence runbook <pageId\|runbook-file>`    |
| **9.8**  | **Glossary auto-harvest**           | §4.3 — batch-propose terms from mirrored bodies; human-confirm.                                                                                                                                                                                                                                                                                                                                                          | `/confluence glossary harvest`                  |
| **9.9**  | **Comment triage**                  | Pull footer+inline comments on a page, cluster into "open question / decision / action", and (optionally) draft matching JIRA issues via the JIRA plan's `/jira-create` (cross-plan handoff).                                                                                                                                                                                                                            | `/confluence comments <pageId>`                 |
| **9.10** | **Hooks (CN12)**                    | (a) **glossary-harvest hook** — on `/confluence pull`, scan the new bodies and _queue_ candidate terms for confirmation; (b) **stale-citation hook** — when a doc under `docs/` cites a mirrored page whose remote `version.number` advanced, warn on next `/confluence` invocation; (c) **source-manifest hook** — on pull, keep `specs/sources/manifest.json` (§10) in sync. All hooks **propose**, never auto-mutate. | `.claude/hooks/`                                |

> **Scope discipline:** 9.1–9.9 are _thin_ verbs over the same agent +
> write-back engine + templates — they add capability, not a second
> architecture. Phase them (§11); do not build all at once.

---

## 10. Traceability (CN13) — shared with JIRA

- `specs/sources/manifest.json` records every ingested source with a stable
  `sourceRef` (`confluence:PCON:2042342654`, `jira:EON-21`, …), its local path,
  version, and `lastSyncedAt`.
- The **RTM** (`@.claude/templates/requirements-traceability-matrix.md`)
  gains/uses a **Source** column keyed on `sourceRef` — every requirement traces
  to the Confluence/JIRA source it came from ("nothing lost"), and every
  ingested source is either cited by a requirement or explicitly marked
  out-of-scope ("nothing dangling").
- The source-manifest hook (§9.10c) keeps this current on every pull.

---

## 11. Phased delivery

| Phase                   | Deliverable                                                                                                                                                                                                 | Gate                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **0 — Foundations**     | `.claude/config/confluence-sync.config.yml`, `.gitignore` lines (D16/D17, atomic w/ 01a), `confluence/` skeleton + `manifest.schema.json`; `scripts/confluence/init.ts` (first-run scaffold + drift report) | `/confluence-init` runs; drift report if re-run                                  |
| **1 — Discovery**       | `confluence-search` agent + `/confluence` router (`search`/`read`/`summary` — the live-Rovo verbs); citation contract (§5.4)                                                                                | The three §6 scenarios pass end-to-end                                           |
| **2 — Glossary**        | `.claude/config/glossary.json` + term-resolution algorithm (§4.2) + `glossary show`/`harvest`                                                                                                               | NTB/POBO resolves; human-confirmed writes only                                   |
| **3 — Citation cache**  | `/confluence pull` + sidecars + per-space manifest + version/dual-hash diff + `reindex` (offline) + staleness (mirror-only)                                                                                 | `stale`/`tree`/`who`/`gap` answer from the mirror; two-timestamp invariant holds |
| **4 — Write-back**      | `/confluence-push` (A) → `/confluence-create` (B) → `/confluence-enhance` (C), one gated pipeline (§8)                                                                                                      | dry-run + approve + lost-update guard demonstrated; macros preserved             |
| **5 — Outside-the-box** | §9 verbs + hooks, phased by value (EDR bridge, design-sync, comment triage, relationship map first)                                                                                                         | each verb is a thin layer over Phases 1–4                                        |
| **6 — Operating guide** | **Mandatory** `docs/CONFLUENCE-OPERATING-GUIDE.md` (§13)                                                                                                                                                    | guide exists, matches shipped behavior                                           |

---

## 12. Challenges & mitigations (CN14 — the critical analysis)

| #       | Challenge                               | Why it bites                                                                                                                                 | Mitigation                                                                                                                                                                                         |
| ------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1**  | **Rovo recall vs. permissions**         | Rovo only returns what the _authed user_ can see; two operators get different results; a "not found" may be a permission gap, not an absence | Always surface the auth identity in citations; when a referenced page is inaccessible, say "restricted/none-visible", never "does not exist"; the mirror preserves what _was_ visible at pull time |
| **C2**  | **Stale mirror masquerading as truth**  | A cached page can be N versions behind and read authoritatively                                                                              | Two-timestamp invariant + `status_sync` + citation provenance tag; staleness banner on any stale mirror source; **Rovo (live) is always preferred for discovery**                                  |
| **C3**  | **Macro/format loss on round-trip**     | Confluence storage format ≠ Markdown; page-properties/includes/Jira macros don't survive naïvely                                             | Preserve unconvertible macros as opaque blocks (§2.2); **section-scoped writes only** (§8) so a push never rewrites a region it can't faithfully represent                                         |
| **C4**  | **Lost-update on write-back**           | Someone edits the page in the browser between draft and push                                                                                 | Optimistic lock on `version.number`, re-checked immediately pre-mutate; abort + re-diff on bump; crash-safe intent record                                                                          |
| **C5**  | **Glossary poisoning / wrong meaning**  | An acronym has different meanings across domains; a bad auto-guess propagates                                                                | **Human-confirmed on write** (Q2); provenance + confidence per term; `relatedTerms` disambiguation; ask-last algorithm never guesses silently                                                      |
| **C6**  | **Scope explosion / token blowout**     | "Summarize Confluence" could try to pull thousands of pages                                                                                  | Scope-aware CQL (§7.2) is mandatory; pulls are space/label/ancestor/date-bounded; discovery is Rovo (ranked, capped), not bulk pull                                                                |
| **C7**  | **Spec churn from casual reads**        | A synthesized doc silently rewrites `specs/`                                                                                                 | R3 hard boundary: synthesis writes to `docs/`; only `/reconcile-requirements` touches `specs/`; write-back _suggests_, never runs, reconcile                                                       |
| **C8**  | **Identity drift across tools**         | Same human, different handles in Confluence vs JIRA                                                                                          | Single `people.json`; agents read it directly; `unresolvedAliasPolicy: ask`                                                                                                                        |
| **C9**  | **Derived index committed by accident** | `_index.json` in git → merge conflicts, false "third source of truth"                                                                        | `.gitignore` it (D17); rebuild via offline `reindex`; sidecars win                                                                                                                                 |
| **C10** | **Secrets in content**                  | Pages may contain tokens/keys                                                                                                                | Verbatim import into a **private** repo (R1) is the accepted posture; gitleaks pre-commit still runs; glossary/citations store pointers, not restricted bodies; never echo secrets into `docs/`    |

---

## 13. Mandatory deliverable — `docs/CONFLUENCE-OPERATING-GUIDE.md`

A hand-written operator guide (mirrors `docs/JIRA-OPERATING-GUIDE.md`) covering:
when to use Rovo search vs the mirror; the citation contract; the glossary
workflow (how confirmations work); how to pull/reindex and what the two
timestamps mean; the write-back gates; the R3 boundary; and the three worked
scenarios as copy-pasteable examples. **No phase is "done" until this guide
matches shipped behavior.**

---

## 14. Decision log

| #        | Decision                                                                                          | Status            |
| -------- | ------------------------------------------------------------------------------------------------- | ----------------- |
| **CD1**  | Rovo `search` is the org-wide primary discovery engine; the mirror is a citation cache            | ✅ confirmed (Q1) |
| **CD2**  | Staleness (24h) gates **mirror-derived answers only**, never live Rovo                            | ✅ confirmed (Q1) |
| **CD3**  | Glossary at `.claude/config/glossary.json`, cross-tool, **human-confirmed on write**              | ✅ confirmed (Q2) |
| **CD4**  | This is a **new plan** (`01c`), superseding 01b as plan of record — not an edit                   | ✅ confirmed (Q3) |
| **CD5**  | Term-resolution order: glossary → `specs/` → local mirrors → ask (never guess)                    | proposed          |
| **CD6**  | Item keying `{SPACE}-{pageId}`; folder-by-type (`pages/ blogposts/ attachments/`)                 | proposed          |
| **CD7**  | `version.number` + dual-hash is the change signal; `treeHash` for structural change               | proposed          |
| **CD8**  | Section-scoped writes on stable heading anchors; macros preserved as opaque blocks                | proposed          |
| **CD9**  | `_index.json` gitignored + offline `reindex`; two-timestamp invariant (shared D16/D17 w/ 01a/01b) | proposed          |
| **CD10** | Synthesis → `docs/`; `specs/` only via `/reconcile-requirements` (R3)                             | proposed          |
| **CD11** | `confluence-search` is read/analyze only; mutations go through the gated write-back engine        | proposed          |
| **CD12** | Hooks propose, never auto-mutate                                                                  | proposed          |

---

## 15. Recommended first step

Implement **Phase 0 + Phase 1** together: scaffold `confluence/`, the config,
and the `.gitignore` lines (atomically with 01a/01b), then ship the
`confluence-search` agent + `/confluence` router with the three live-Rovo verbs
(`search` / `read` / `summary`) and the citation contract. That single increment
makes all three §6 scenarios work **before** any local mirror exists — proving
the Rovo-first thesis — with the citation cache (Phase 3) and write-back
(Phase 4) layered on afterward.
