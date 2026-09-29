---
description: >
  Verb A of the Confluence write-back engine — push hand-edited local mirror content back to an
  EXISTING Confluence page. Thin entry: builds the Step-1 diff over the pushable slice only, then
  funnels through the shared 8-step pipeline in `.claude/commands/confluence-write-engine.md`
  (dry-run → approve → version re-check → mutate → re-pull → reconcile → suggest). Section-scoped,
  lost-update-guarded, never blind-overwrites. `## Comments` / `## Metadata` / macro fences never
  travel. Twin of `.claude/commands/jira-push.md`.
agent: build
subtask: true
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: medium
---

# /confluence push — verb A (push local mirror edits back)

## Input

`$ARGUMENTS`:
- `<pageId>` or a `…/pages/{id}/…` **url** — the page whose hand-edited mirror body to push. Resolve a
  url to its `pageId`; both map to `confluence/{pages,blogposts}/{SPACE}-{id}.md` + its `.json` sidecar.
- optional `--dry-run` — stop after the Step-2 plan (never mutate); the pipeline is dry-run-first
  regardless, so this only suppresses the approval prompt.

## Preconditions

1. **The page must already be mirrored.** Look up `{SPACE}-{id}` in `confluence/.manifest.json.items`.
   If absent → this is not a push target; STOP and tell the user to `/confluence pull <pageId>` first
   (or, if they meant a *new* page, `/confluence create`).
2. **Something must be pushable.** Recompute the sidecar diff (below). If `status_sync` resolves to
   `clean` (on-disk pushable slice == last-pulled) → **no-op**; report "nothing to push" and STOP.
3. **`diverged` needs a human resolve first.** If `status_sync` is `diverged` (remote advanced AND the
   body was hand-edited), do NOT attempt a push — route to `/confluence pull <pageId>` to rebase, then
   re-run push. Push proceeds only when `status_sync ∈ {local-ahead}` at entry (the engine's Step 4
   still re-checks the live version, catching a race).

## Step 1 — build the diff (this verb's only distinct step)

This is the caller-specific **Step 1** the shared engine expects; Steps 2–8 are identical to
`confluence-write-engine.md` — enter it immediately after.

1. **Read the on-disk body** `confluence/{pages,blogposts}/{SPACE}-{id}.md` and its sidecar.
2. **Recompute the local hash** — `localEditsHash = hashBody(mdBody(md))` (`hash.ts` + `converter.ts`).
   Apply `mdBody()` **before** `hashBody()` so a title rename is not read as a false edit.
3. **Partition + take the pushable slice** — `partitionRegions(mdBody(md))` classifies each `##`
   region; `pushablePayload(...)` yields the authored regions only. Confluence is
   **pushable-by-default**; `## Comments` and `## Metadata` are pull-only.
4. **Compute the push-diff key** — `pushableHashBefore = hashPushable(mdBody(md))`. Compare against the
   pushable hash of the sidecar's last-pulled body (recompute it from the sidecar's stored body, or
   fall back to the sidecar `contentHash` slice). Equal ⇒ empty pushable diff ⇒ **no-op** (Precondition 2).
5. **Separate the pull-only edits.** If the human also edited a `## Comments` / `## Metadata` region,
   collect those as `pull_only_edits[]` — they will be **reported and skipped** (never authored back to
   Confluence; they are mirror projections of remote state).
6. **Emit the change intent** the engine consumes:
   `{ pageId, spaceKey, title, pushablePayload, pull_only_edits[], fromVersion: sidecar.version.number }`.

Then run the shared engine Steps 2–8:
- **Step 2 dry-run** shows the per-`##`-anchor before/after for each pushable section, the exact
  Markdown body that will be sent, an explicit **"untouched (preserved)"** list (every pull-only region
  + every `` ```macro `` fence), and a **"pull-only edits skipped"** list from `pull_only_edits[]`.
- **Step 3** single-change approval `[Apply / Edit selection / Cancel]`.
- **Step 4** re-fetch the live `version.number`; if it moved past `fromVersion` ⇒ 3-way diff + STOP
  (route to `/confluence pull`), never overwrite.
- **Step 5** `updateConfluencePage` with the section-scoped body + marker
  `[CANS-SYNC|page={id}|version={n}|run={run_uuid}]` in the **version message**. Intent record written
  first.
- **Steps 6–7** re-pull, convert, write the mirror through the pull do-not-clobber gate; sidecar becomes
  `contentHash = localEditsHash`, bumped `version.number`, `status_sync=clean`, `lastSyncedAt=now`;
  manifest pointer + space roster `treeHash` refreshed; reindex.
- **Step 8** SUGGEST `/reconcile-requirements` if the page sources a spec (never auto-run).

## `--spec` mode (push a spec-sourced page)

If the target page is recorded in `specs/sources/manifest.json` as the source of a requirement doc, the
diff in Step 1 still operates over the **mirror body only** — `/confluence push` never reads or writes
`specs/`. It just means Step 8's suggestion is near-certain to fire. The push mutates Confluence; any
`specs/` realignment is a separate, human-invoked `/reconcile-requirements`.

## Guardrails

- **Section-scoped only** — only pushable `##` sections travel; `## Comments`, `## Metadata`,
  `<!-- pull-only -->`, and `` ```macro `` fences are preserved byte-for-byte. A pushable edit that
  cannot be expressed without rewriting a macro ⇒ STOP + report.
- **Empty pushable diff ⇒ no-op** — never issue a write that changes nothing; list any skipped
  pull-only edits so the user knows why their comment edit didn't travel.
- **Lost-update guard** — the engine's Step 4 re-check is authoritative; `diverged` at entry is routed
  to a pull first. Never blind-overwrite.
- **No secrets; R3** — mutate Confluence only; never touch `specs/`; Step 8 suggests, never runs,
  `/reconcile-requirements`.

## Cross-references

- Shared engine: `.claude/commands/confluence-write-engine.md` (Steps 2–8)
- Do-not-clobber gate + `status_sync` table: `.claude/commands/confluence.md` (§pull Step 4, diff table)
- Scripts: `scripts/confluence/{hash,converter,mcp-client}.ts`
- Proven twin: `.claude/commands/jira-push.md`
