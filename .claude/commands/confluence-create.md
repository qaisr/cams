---
description: >
  Verb B of the Confluence write-back engine — create a NEW Confluence page from local Markdown. Thin
  entry: runs an ambiguity review + parent confirmation, writes a crash-safe pre-create intent record
  (SHA-256 + per-invocation nonce), then funnels through the shared 8-step pipeline in
  `.claude/commands/confluence-write-engine.md`. Never fabricates a pageId (writes locally only from
  the createConfluencePage response); never auto-places a parent. Twin of
  `.claude/commands/jira-create.md`.
agent: build
subtask: true
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: medium
---

# /confluence create — verb B (create a new page)

## Input

`$ARGUMENTS`:
- `<SPACE>` — target space key (must be one of `confluence-sync.config.yml.spaces[]`, currently
  SEC / PCON; if not, STOP and say so).
- `--title "<title>"` — required page title.
- `--parent <pageId>` — optional; the page under which to nest. If omitted, resolve + **confirm** a
  parent (Step 1 below) — never silently create at the space root.
- `--from <local.md>` — optional Markdown body file. If omitted, draft the body from the prompt and
  confirm it in the dry-run.
- optional `--blogpost` — create a blogpost instead of a page (no parent).

## Step 0 — ambiguity review

Before drafting, run the `ambiguity-analyst` over the brief (title + body + intended placement) at
medium/high complexity. Surface unclear scope, a title that collides with an existing page in the
space (search first), or a body that references restricted content. Resolve via `AskUserQuestion`
before proceeding. Cheap here, expensive after a page exists.

## Step 1 — parent resolution + confirmation (this verb's distinct guard)

Unless `--blogpost`:
1. If `--parent <id>` was given, fetch it (`getConfluencePage`) to confirm it exists in `<SPACE>` and
   show its title.
2. If no `--parent`, **rank candidate parents** — search the space (`searchConfluenceUsingCql` scoped
   by `spaceScopeCql`) for pages whose title/labels/ancestry best match the new page's topic; present
   the top few.
3. **ALWAYS confirm placement via `AskUserQuestion`** — `[Use <candidate> / Pick another / Create at
   space root / Cancel]`. **Never auto-place.** Record the chosen `parentId` (or explicit root).

## Step 1b — draft body + pre-create intent record

1. **Draft the body.** From `--from <local.md>` (read verbatim) or drafted from the prompt. Structure
   it with the mirror's region convention so the round-trip is stable: authored prose is
   pushable-by-default; do not author a `## Comments` region (remote-owned). Preserve any macro the
   user supplied as a `` ```macro `` fence.
2. **Generate the per-invocation `run_uuid` ONCE** and the intent record
   `intentKey = sha256(spaceKey + " " + title + " " + parentId + " " + run_uuid)`. Write it to
   `confluence/.push-runs/<run_id>.json` with `verb:"create"`, `state:"pending"`,
   `resolvedPageId:null`, `target.pageId:null`, `target.fromVersion:null`,
   `marker:"[CANS-SYNC|page=new|version=0|run=<run_uuid>]"`. This is written **before** any create call
   so a crash is recoverable. A genuine **retry re-uses the same `run_uuid`** (dedupe); a new
   intentional create gets a fresh one.
3. **Emit the change intent** the engine consumes:
   `{ spaceKey, title, parentId, pushablePayload, pull_only_edits: [], fromVersion: null }`.

Then run the shared engine Steps 2–8:
- **Step 2 dry-run** shows target `spaceKey`, `title`, resolved `parent (id + title)`, the rendered
  body, and that this is a create (no version lock).
- **Step 3** approval `[Apply / Edit selection / Cancel]`.
- **Step 4 (create variant)** — no existing page to version-lock; instead re-check the intent record:
  if this brief already became a real page (search the space for the title, or a `mutated` record
  carries a `resolvedPageId`), resume at Step 6/7 for that page — **never a second create**.
- **Step 5** `createConfluencePage { cloudId, spaceId, title, body, parentId?, contentFormat:"markdown" }`.
  Take the real `pageId` from the response — **never fabricate one**; write nothing locally until it
  returns. Immediately persist `resolvedPageId` into the intent record; set `state:"mutated"`. The
  `[CANS-SYNC|page={newId}|version={n}|run={run_uuid}]` marker rides in the version message.
- **Steps 6–7** re-pull the created page (+ comments if configured), `convertItem`, and write the mirror
  through the pull do-not-clobber gate. This **seeds the first mirror item** for the page: new sidecar
  (`contentHash=localEditsHash`, `status_sync=clean`, `lastSyncedAt=now`), a new
  `confluence/.manifest.json.items[{SPACE}-{id}]` pointer, the space roster + `treeHash`, additive
  author append, then reindex.
- **Step 8** SUGGEST (one, for this page) — only if it maps to a spec; a brand-new page usually does
  not, so this is typically silent.

## Guardrails

- **Never fabricate a pageId** — the local mirror is written only from the `createConfluencePage`
  response; nothing on disk before the page exists remotely.
- **Never auto-place a parent** — Step 1 always confirms placement (or explicit root).
- **Crash-safe** — pre-create SHA-256 intent record with per-invocation nonce; a retry with the same
  nonce dedupes, resuming at re-pull/reconcile rather than creating a duplicate page.
- **Section discipline** — authored prose is pushable; do not seed a `## Comments` region; macros are
  fenced and inviolate.
- **No secrets; R3** — mutate Confluence only; the created page's mirror lands under `confluence/`,
  never `specs/`. Step 8 suggests, never runs, `/reconcile-requirements`.

## Cross-references

- Shared engine: `.claude/commands/confluence-write-engine.md` (Steps 2–8; create variant of Step 4)
- Converter / roster / manifest: `scripts/confluence/converter.ts`, `confluence/manifest.schema.json`
- Config (spaces, cloudId): `.claude/config/confluence-sync.config.yml`
- Proven twin: `.claude/commands/jira-create.md`
