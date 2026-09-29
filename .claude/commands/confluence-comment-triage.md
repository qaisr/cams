---
description: >
  Composes: mirror read (confluence/_index.json + per-page footer/inline comments) +
  .claude/config/people.json (author resolution). Classifies each comment as question /
  decision / action-item / stale → actionable digest, each item cited to its comment.
  READ-ONLY. Thin Phase-5 verb over Phase-1–4 primitives.
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# /confluence comment-triage

> **Composes:** `confluence/_index.json` (mirror) + per-page `## Comments` regions in
> `confluence/pages/{SPACE}-{id}.md` + `.claude/config/people.json` (author resolution).
> Falls back to **live** `getConfluencePageFooterComments` /
> `getConfluencePageInlineComments` MCP calls when comments were not pulled into the mirror
> (i.e. the sidecar shows `pullComments: false` or the `## Comments` region is absent).
> **Read-only.** Cites every item to its comment.

## Input

`$ARGUMENTS` — one of:

- `<pageId>` or a Confluence page URL — triage comments for that single page.
- `<SPACE>` (e.g. `PCON`, `SEC`) — triage comments across all mirrored pages in that space.
- No argument — triage all pages in all mirrored spaces (may be long; group by space).

## Pre-flight

1. **Mirror check.** Read `confluence/_index.json`. If `items` is empty or the file is absent,
   stop: _"Mirror is empty — run `/confluence pull <SPACE>` first."_
2. **Staleness gate.** Read `confluence/_index.json.lastSyncedAt`. If older than 24 h, offer:
   _"Mirror last synced {when}. Comment triage may be stale. Sync now?"_
   → **[Sync & answer / Answer from mirror anyway / Cancel]**.
3. **Comment source selection (per page).** For each page in scope:
   - Read the corresponding `.md` body. If a `## Comments` region exists with non-empty
     content → use it (mirror-sourced, no network call needed).
   - If the `## Comments` region is absent or empty, and the page sidecar shows
     `"pullComments": false` or the region is missing → make a **live** MCP call:
     `mcp__atlassian__getConfluencePageFooterComments` + `mcp__atlassian__getConfluencePageInlineComments`
     (both with `cloudId` from `.claude/config/confluence-sync.config.yml`,
     `contentFormat: "markdown"`). Cite live MCP results as `source: live-mcp (fetched <ISO>)`.

## Algorithm

### Step 1 — Collect comments

For each page in scope, produce a flat list of comments:

```
{ page_id, page_title, page_version, comment_id, comment_type (footer|inline),
  author_id, author_display, body_text, created_at, resolved (bool), inline_anchor? }
```

**Author resolution.** Look up each `author_id` in `.claude/config/people.json`
(`confluenceAccountId` or `confluence` handle). Use `displayName` if available, otherwise `author_id`.
If `unresolvedAliasPolicy` is `ask` (from config) and an author is unresolvable, surface
a clarifying question via `AskUserQuestion` — do not silently drop the comment.

Skip comments that are already marked `resolved: true` unless the `--include-resolved`
flag is passed.

### Step 2 — Classify each comment

Apply the following classification rules (in order — first match wins):

| Class | Signals |
|---|---|
| **question** | Body ends with `?`, starts with "How", "What", "Should we", "Can we", "Is this", or contains "unclear", "not sure", "confused", "wondering" |
| **decision** | Body contains "decided", "agreed", "approved", "we will", "going with", "resolution:", or starts with "Decision:" |
| **action-item** | Body contains "@mention" of a person + a verb ("please", "can you", "need to", "should", "TODO", "will"), or starts with "Action:" / "Follow-up:" / "TODO:" |
| **stale** | Comment is unresolved AND `created_at` is older than 90 days AND does not match `decision` or `action-item` (these are preserved regardless of age) |
| **informational** | Anything that does not match the above — general context, acknowledgements, observations |

Record the class and the signal phrase that triggered it.

### Step 3 — Produce the digest

Group by page, then by class within each page. For each comment emit:

```
## [SPACE-{id}] "{Page title}" ({n} open comments)

### Questions ({n})
- **[{comment_id}]** {author_display} ({created_at}): "{body_text excerpt}"
  _Signal: ends with ?_

### Decisions ({n})
- **[{comment_id}]** {author_display} ({created_at}): "{body_text excerpt}"
  _Signal: "agreed"_

### Action items ({n})
- **[{comment_id}]** {author_display} ({created_at}): "{body_text excerpt}"
  _Assigned to: @{mention}_

### Stale ({n})
- **[{comment_id}]** {author_display} ({created_at}): "{body_text excerpt — first 120 chars}"
  _(Unresolved since {age})_
```

Omit a class section if it has 0 items. Add a page-level summary line:
`{n_question} questions · {n_decision} decisions · {n_action} action items · {n_stale} stale`

At the end of all pages, emit a **totals row**:
```
## Summary
Total: {N} pages · {N} questions · {N} decisions · {N} action items · {N} stale
```

### Step 4 — Owner hints (action items only)

For each **action-item** comment that contains an `@mention`, look up the mentioned handle in
`.claude/config/people.json`. If resolved, add:
`Owner: {displayName} ({email if present})`. If unresolved, add:
`Owner: @{mention} (unresolved — not in people.json)`.

### Step 5 — Citations

After the digest, emit a **Sources** block:

```
## Sources

- [{SPACE}-{id} v{n}] "{Page title}" — confluence mirror (pulled {lastSyncedAt ISO})
  OR: live-mcp (fetched {ISO})
  {n} footer comments · {n} inline comments
…
```

## Guardrails

- **Read-only.** No mutations — comments are classified, not resolved or deleted.
- **Citation contract** — every item cites its `comment_id` + page + source.
- **Staleness gate applies** (mirror-derived answers). Live MCP fallback is used
  transparently per page when comments are not in the mirror.
- **Author resolution** follows `unresolvedAliasPolicy` from config (`ask` → surface via
  `AskUserQuestion`; do not silently drop unresolvable authors).
- **No auto-resolve** — resolution of comments must be done by a human on Confluence, not
  by this verb.

## Cross-references

- Router: `.claude/commands/confluence.md`
- Confluence mirror: `confluence/_index.json` + `confluence/pages/*.md`
- Author resolution: `.claude/config/people.json` (single source of truth)
- Config: `.claude/config/confluence-sync.config.yml` (`cloudId`, `unresolvedAliasPolicy`)
- Live MCP fallback: `mcp__atlassian__getConfluencePageFooterComments` + `getConfluencePageInlineComments`
