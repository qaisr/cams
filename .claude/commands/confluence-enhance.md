---
description: >
  Verb C of the Confluence write-back engine — AI-proposed improvements to an EXISTING page, confined
  to its pushable sections, then pushed via the same gated pipeline. Enhancement is proposal → the
  shared 8-step engine (`.claude/commands/confluence-write-engine.md`), never a direct write. Runs a
  per-page [Apply/Reject/Edit] gate; records a run-manifest; emits ONE consolidated reconcile
  suggestion at close. Twin of `.claude/commands/jira-enhance.md`.
agent: build
subtask: true
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: medium
---

# /confluence enhance — verb C (AI-proposed improvements)

## Input

`$ARGUMENTS`:
- `<pageId>` / url — a single page to enhance, **or**
- `<SPACE>` — enhance a batch of pages in a space (bounded — see below), **or**
- a mirror-analytic feed (e.g. the output of `/confluence gap <pageId>`, which suggests but never runs
  an enhance).
- optional `--dry-run` — stop after the per-page Step-2 plan.

## What "enhance" means (and does not)

Enhancement generates improved prose for a page's **pushable** regions only — clearer structure,
filled-in thin sections, fixed dangling references, better headings — then runs it through the
**exact same** verb-A push pipeline. It **never**:
- rewrites a `## Comments` / `## Metadata` region or a `` ```macro `` fence (inviolate);
- invents facts, owners, links, or accountIds not present in the source or a cited mirror;
- writes to `specs/`.

## Preconditions

1. **Pages must be mirrored** (batch or single). An unmirrored page → route to `/confluence pull` first.
2. **Skip terminal/locked pages by default.** In batch mode, skip pages whose `status_sync` is
   `diverged` (route to pull) and any page the user has not authored/does not own — unless explicitly
   named. Report every skip.
3. In batch mode the set is **bounded** — take the space roster window (never "all of Confluence"); if
   the candidate set is large, confirm the count via `AskUserQuestion` before proposing.

## Batch driver (over verb A + the create-like proposal step)

For each candidate page, independently:

1. **Propose (this verb's distinct Step 1).** Read the mirrored body; generate improved prose spliced
   **into the existing pushable `##` regions** (same anchors — a splice, not a re-layout, unless the
   user asked for restructuring). Then diff it **exactly as an A-edit**:
   `partitionRegions(mdBody(...))` → `pushablePayload(...)` → `pushableHashBefore = hashPushable(...)`.
   Empty pushable diff (proposal changed nothing material) ⇒ skip this page as a no-op.
2. **Per-page gate.** `AskUserQuestion` → `[Apply / Reject / Edit]`. `Edit` loops back to (1) with the
   human's steer; `Reject` records the skip and moves on.
3. **Run engine Steps 2–7 for the applied page** — dry-run (per-section before/after + preserved list),
   Step-4 live version re-check (a bump ⇒ 3-way diff, STOP **this page only**, batch continues),
   `updateConfluencePage` with the section-scoped body + `[CANS-SYNC|…|run={run_uuid}]` marker,
   re-pull, reconcile the mirror to `clean`, reindex.
   - **Step 8 is NOT run per-page** in batch mode.

**Run-manifest:** write `confluence/.push-runs/<run_id>.json` for the batch (verb `"enhance"`),
recording per-page state (`proposed / applied / rejected / stopped-diverged / no-op`) and each page's
intent sub-record. A per-page lost-update STOP marks that page `stopped-diverged` and the batch
continues — never aborts the whole run.

## Batch close — ONE consolidated suggestion (Step 8, once)

After the batch, emit a **single** consolidated Step-8 suggestion: list the applied pages that map to
specs (via `specs/sources/manifest.json`) and suggest **one** `/reconcile-requirements @specs/<…>` per
affected spec. **Never auto-run it.** Also print the run summary: applied / rejected / skipped /
stopped counts, and the new `treeHash` per touched space.

## Single-page mode

Identical, minus the batch loop: propose → per-page gate → engine Steps 2–7 → **do** run Step 8 for
that one page (one suggestion). This is the path `/confluence gap` hands to when a user accepts its
enhance suggestion.

## Guardrails

- **Proposal, not direct write** — every enhancement goes through the dry-run + approval + version-guard
  gates; no silent writes.
- **Confined to pushable sections** — `## Comments`, `## Metadata`, pull-only regions, and macro fences
  are never touched; a proposal that needs to rewrite a macro ⇒ STOP + report.
- **Per-page isolation** — a lost-update or reject stops only that page; the batch continues.
- **No fabrication** — improvements draw only on the source body + cited mirror content; never invent
  facts or identities.
- **No secrets; R3** — mutate Confluence only; never write `specs/`; ONE consolidated
  `/reconcile-requirements` **suggestion** at close, never an auto-run.

## Cross-references

- Shared engine: `.claude/commands/confluence-write-engine.md` (Steps 2–8; C reuses the A-edit path)
- Verb A: `.claude/commands/confluence-push.md`
- Doc-rot feed: `.claude/commands/confluence.md` (§`/confluence gap`)
- Proven twin: `.claude/commands/jira-enhance.md`
