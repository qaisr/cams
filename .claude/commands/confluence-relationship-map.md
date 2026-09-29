---
description: >
  Composes: mirror read (confluence/_index.json + jira/_index.json) + sidecar link traversal.
  Emits a Mermaid relationship graph of Confluence pages ↔ JIRA issues with typed edges,
  plus a gap list (status mismatches, dangling links, page-references-closed-issue).
  READ-ONLY — no remote calls beyond what the mirrors already hold. Thin Phase-5 verb
  over Phase-1–4 primitives.
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# /confluence relationship-map

> **Composes:** `confluence/_index.json` (mirror) + `jira/_index.json` (mirror) + per-item
> sidecars (`confluence/pages/*.json`, `jira/**/*.json`) + sidecar `links[]` arrays.
> **No new remote primitives.** All data comes from the two local mirrors.
> **Read-only.** Cites every node to its source (page version / issue key).

## Input

`$ARGUMENTS` — one of:

- `<pageId>` or a Confluence page URL (`…/pages/{id}/…`) — Confluence-anchored: show all
  JIRA issues linked from that page and the reciprocal page references from those issues.
- `<EON-key>` (e.g. `EON-123`) — JIRA-anchored: show all Confluence pages linked from that
  issue and walk the reciprocal page → issue links.
- No argument — show the full cross-tool relationship graph for all mirrored items that carry
  at least one cross-tool link (may be large; summarise by space/project if > 40 nodes).

## Pre-flight

1. **Mirror check.** Read `confluence/_index.json`. If `items` is empty or the file is absent,
   stop: _"Confluence mirror is empty — run `/confluence pull <SPACE>` first."_
   Read `jira/_index.json`. If `items` is empty or the file is absent, stop:
   _"JIRA mirror is empty — run `/jira-init` then `/jira-sync` first."_
2. **Staleness gate (mirror-derived answers only).** Read `confluence/_index.json.lastSyncedAt`.
   If older than `stalenessHours` (24 h, from `.claude/config/confluence-sync.config.yml`),
   offer via `AskUserQuestion`:
   _"Mirror last synced {when}. Results may be stale. Sync now?"_
   → **[Sync & answer / Answer from mirror anyway / Cancel]**.
   If JIRA mirror `lastSyncedAt` is also stale, surface both warnings together.
3. **Resolve anchor.** If a pageId / URL was given, look it up in
   `confluence/_index.json.items`; if an EON-key was given, look it up in
   `jira/_index.json.items`. If not found in the mirror, say so and offer the live
   `/confluence read <url>` alternative (does not depend on the mirror).

## Algorithm

### Step 1 — Collect the link graph

Build a bipartite in-memory graph: nodes are Confluence pages and JIRA issues; edges are
typed cross-tool links.

**Confluence → JIRA edges** (from Confluence sidecars):

Read each in-scope `confluence/pages/{SPACE}-{id}.json` (or all items if no anchor). From
each sidecar, extract:
- `links.jiraIssues[]` — explicit Jira-issue smart links recorded at pull time.
- `body` text scan via grep for bare `EON-[0-9]+` patterns in the corresponding `.md` file
  (picks up inline text references the sidecar did not macro-classify).
  Deduplicate with the explicit list; tag each found key as `edge_type: "text-reference"`.

**JIRA → Confluence edges** (from JIRA sidecars):

Read each in-scope `jira/**/{KEY}.json`. From each sidecar, extract:
- `remoteLinks[]` whose URL contains `commbank.atlassian.net/wiki` → parse out the `pageId`
  (the numeric suffix after `/pages/`).
- `description` + `comments[].body` text in the corresponding `.md` — grep for bare
  `confluence.atlassian.net/wiki/…` or `PCON-` / `SEC-` page ref patterns.
  Tag as `edge_type: "text-reference"`.

**Edge types:**

| Type | Source |
|---|---|
| `smart-link` | explicit sidecar `links.jiraIssues` / `remoteLinks` entry |
| `text-reference` | grep hit in the body (not in the explicit link list) |
| `parent-epic` | JIRA `parent` pointer where the parent is referenced in a Confluence page title |

### Step 2 — Filter to anchor (if given)

If an anchor was provided, keep only the subgraph reachable within **2 hops** from the
anchor node (anchor → direct neighbours → their cross-tool neighbours). This keeps the
graph readable.

### Step 3 — Compute the gap list

Traverse every edge and classify:

| Gap type | Condition |
|---|---|
| **status-mismatch** | The page body mentions a JIRA issue status (e.g. "In Progress", "Planned") that differs from the issue's current `status` in the JIRA sidecar. Detect by grepping the page `.md` for `EON-{key}.*\b(In Progress|To Do|Done|Closed|Blocked|Planned)\b` and comparing to `jira sidecar.status`. |
| **closed-issue-referenced** | Page references an issue whose `status` is `Done` or `Closed` but the page does not use a past-tense or "implemented" context. |
| **dangling-confluence-link** | JIRA sidecar lists a Confluence remote link whose `pageId` is NOT in `confluence/_index.json.items` (the page was not pulled or no longer exists in scope). |
| **dangling-jira-ref** | Confluence sidecar or body references an EON-key that is NOT in `jira/_index.json.items`. |
| **orphaned-page** | Confluence page has no JIRA edges at all (isolated node) — informational, not always a gap. |

### Step 4 — Emit the Mermaid graph

Follow `@.claude/standards/mermaid-standards.md`. Use a `graph LR` layout.

Node shapes:
- Confluence page → `rectangle` with label `[SPACE-id] "Page title (v{n})"`
- JIRA issue → `stadium` shape `([EON-key] "Summary (Status)")`

Edge labels carry the `edge_type` abbreviated: `--"smart-link"-->`, `--"text-ref"-->`.

Apply `classDef` theme:

```
classDef confluencePage fill:#0052CC,color:#fff,stroke:#0052CC
classDef jiraIssue fill:#1D7AFC,color:#fff,stroke:#1D7AFC
classDef gapNode fill:#DE350B,color:#fff,stroke:#DE350B
```

Nodes that appear in the gap list get `:::gapNode` applied.

Add `accTitle` and `accDescr`.

Cap the diagram at **60 nodes** — if the full graph exceeds this, emit the most-connected
subgraph and note the truncation.

### Step 5 — Emit the gap list

After the diagram, emit a structured **Gap Report** table:

```
## Gap Report

| # | Gap type | Confluence page | JIRA issue | Detail |
|---|---|---|---|---|
| 1 | status-mismatch | [PCON-2042342654 v14] "NTB POBO…" | EON-234 (Done) | Page says "In Progress" |
…
```

If no gaps found: _"No cross-tool status gaps detected in the mirrored data."_

### Step 6 — Citations

After the gap report, emit a **Sources** block:

```
## Sources

- [PCON-2042342654 v14] "…" — confluence mirror (pulled <lastSyncedAt ISO>)
- [EON-234] "…" — jira mirror (synced <lastSyncedAt ISO>)
…
```

Every node cited to its sidecar version + the mirror's `lastSyncedAt`.

## Guardrails

- **Read-only.** No MCP write calls, no mirror mutations.
- **Mirror-only.** No live Rovo/CQL calls — for a live view use `/confluence search`.
- **Staleness gate applies** (mirror-derived). Live discovery is never blocked.
- **Mermaid per `@.claude/standards/mermaid-standards.md`** — portable syntax, classDef,
  accTitle/accDescr, no AWS icon packs.
- **Citation contract** — every node cited to sidecar version + mirror pull time.
- **Gap list is informational** — no auto-edit of pages or issues; suggest
  `/confluence enhance <pageId>` or `/jira-push <KEY>` as appropriate.

## Cross-references

- Router: `.claude/commands/confluence.md`
- Confluence mirror: `confluence/_index.json` + `confluence/pages/*.json`
- JIRA mirror: `jira/_index.json` + `jira/**/*.json`
- Write-back (if gaps need fixing): `/confluence enhance` (Phase 4) or `/jira-push`
- Mermaid rules: `@.claude/standards/mermaid-standards.md`
