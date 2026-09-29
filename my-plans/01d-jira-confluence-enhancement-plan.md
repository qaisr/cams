# Plan 1d — JIRA/Confluence Integration Enhancements (Relationship-Type Vocabulary + Honest Roadmap)

> **Status:** Proposed · **Author:** AI Tools Expert / Frameworks Designer
> session · **Date:** 2026-08-05 **Depends on (already built):**
> `my-plans/01a-jira-plan.md` (JIRA mirror + index + NL layer + write-back), the
> Confluence integration (`docs/CONFLUENCE-OPERATING-GUIDE.md`), and the shared
> write engines. **Sibling plans:** `my-plans/01a-jira-plan.md` ·
> `my-plans/01b-confluence-plan.md` · `my-plans/02-figma-lumen-plan.md`
> **Project grounding:** JIRA project **EON** + Confluence spaces
> **SEC**/**PCON** on `commbank.atlassian.net` (cloudId
> `998e78d7-2a66-4fc0-809b-b43b4232d4b8`) **Origin:** the two portable wins
> identified in `docs/jira-confluence-vs-speckit-comparison.md` (spec-kit-jira's
> configurable relationship-type semantics + spec-kit's honest CHANGELOG
> roadmap).

---

## 0. What this plan is, and why it exists

The comparison in `docs/jira-confluence-vs-speckit-comparison.md` concluded that
the `.claude/` JIRA/Confluence integration **exceeds** spec-kit on bidirectional
sync, conflict safety, batching, governance, and MCP access-control.
spec-kit-jira has exactly **two** portable strengths worth importing, and this
plan brings across **both** — deliberately, and **without** adopting any of the
things that would be a downgrade (spec-kit-confluence's plaintext-secret backup,
broad-scope PAT collection, or a less-safe sync model — all explicitly
rejected).

| #      | Enhancement                                                                                                                                  | Shape                                            | Risk                                  |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------- |
| **E1** | **Relationship-type vocabulary** surfaced as a **doc-only config block** in `.claude/config/jira-sync.config.yml`                            | Config + docs only. Read as instruction context. | **Zero** — no code, no engine change. |
| **E2** | **Honest known-gaps / roadmap** — a "Supported / Deliberately Not Supported / Planned" section for **both** JIRA and Confluence integrations | New docs sections only.                          | **Zero** — documentation.             |

### 0.1 The two design decisions already made (do not re-litigate)

| #        | Decision                                                                                                                                                                                  | Rationale                                                                                                                                                                                                                                                                                                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **D-E1** | **E1 is doc-only.** Add a `relationships:` block to `jira-sync.config.yml` declaring the recognized link-type vocabulary + hierarchy mode. **No converter change, no write-path change.** | The config files are **"READ AS INSTRUCTION CONTEXT"** — not parsed by any TS runtime (see the header comment in every `.claude/config/*.config.yml`). Declaring the vocabulary documents intent for the agent + humans at zero engine risk. The lossy link-flattening in `scripts/jira/converter.ts` and the deliberately-declined link-write path are **NOT** touched. |
| **D-E2** | **The roadmap tells the truth, including the non-goals.** Link-writing stays a **declared non-goal**, not a "Planned" item.                                                               | `jira-write-engine.md` already lists whole-issue write, status transitions, and link-writing as **"Declined — do not re-introduce."** The roadmap must reinforce that, not contradict it. An honest roadmap names what will _never_ be built as loudly as what might.                                                                                                    |

### 0.2 What this plan explicitly does NOT do (rejected, with reasons)

| Rejected idea                                                                                                             | Why rejected                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fix the lossy link flattening in `converter.ts` (lines ~296–302 flatten non-`blocks` outward/inward links into `relates`) | Out of scope; the user declined it. Links are **pull-only** and read-for-display; the flattening is cosmetic to a region no command pushes. Fixing it is engine risk for no functional gain.                |
| Add a link-**write** path (push parent/blocks/relates back to JIRA)                                                       | Already a **deliberate non-goal** in `jira-write-engine.md` (§8.6). `createIssueLink` is a separate API surface; writes stay description-only. The roadmap will document this as _declined_, not _planned_. |
| Adopt spec-kit-confluence's plaintext-secret backup / broad-scope GitHub PAT collection                                   | **Security anti-pattern.** The integration has **no secrets** — the MCP session brokers auth; cloudId is a pinned config value. Never introduce a secret to store.                                          |
| Add a YAML parser / make configs runtime-parsed                                                                           | The configs are instruction context by design; adding a parser is unrequested scope and reverses a core architectural decision.                                                                             |

---

## 1. Ground truth this plan is built on (verified, not assumed)

A fresh session implementing this plan should re-read these before touching
anything. Every claim below was verified against the actual files.

| Fact                                                                                                                                                                   | Source (verify)                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Configs are **read as instruction context**, NOT parsed by a compiled TS pipeline                                                                                      | Header comment in `.claude/config/jira-sync.config.yml` and `confluence-sync.config.yml` |
| `jira-sync.config.yml` already carries `epicLinkStrategy: parent` and a `fields.epicLink` entry                                                                        | `.claude/config/jira-sync.config.yml`                                                    |
| Links are **read** into a `## Links` region (`- Parent:`, `- Blocks:`, `- Blocked by:`, `- Relates:`) but the collector flattens all non-`blocks` types into `relates` | `scripts/jira/converter.ts` `collectLinks` (~lines 281–506)                              |
| `## Links` (and `## Status`, `## Comments`) are **pull-only** — never pushed                                                                                           | `jira-write-engine.md` §8.6 / `docs/JIRA-OPERATING-GUIDE.md` §7 "region rule"            |
| Link-writing, whole-issue write, and status transitions are **declined non-goals**                                                                                     | `jira-write-engine.md` Guardrails: "Declined — do not re-introduce"                      |
| Confluence pushes are **section-scoped**; macros + `## Comments`/`## Metadata` are inviolate                                                                           | `docs/CONFLUENCE-OPERATING-GUIDE.md` §4                                                  |
| There are **no secrets** in either integration                                                                                                                         | Both operating guides: "the session brokers auth; there are no secrets to manage"        |

> **If any of these are no longer true when you implement, STOP and re-scope.**
> This plan assumes the as-built state described in the two operating guides.

---

## 2. E1 — Relationship-type vocabulary (doc-only config block)

### 2.1 The change — one block added to `jira-sync.config.yml`

Append a `relationships:` block to `.claude/config/jira-sync.config.yml`. It
**declares the vocabulary the integration recognizes** so that the agent, the
`jira-helper`, and any human reading the config have a single authoritative list
of link types and how hierarchy is modeled — instead of that knowledge being
implicit in `converter.ts`.

```yaml
# .claude/config/jira-sync.config.yml → NEW block (append; do not disturb existing keys)
#
# Relationship-type vocabulary — READ AS INSTRUCTION CONTEXT ONLY.
# This block documents the link types the mirror recognizes and how the epic→child
# hierarchy is modeled. It is NOT parsed by any TS runtime; converter.ts and the
# write engine are unchanged. It exists so the vocabulary is declared in one place
# rather than implied by code. Link data is PULL-ONLY and read-for-display: no
# command writes links back to JIRA (see jira-write-engine.md §8.6 "Declined").
relationships:
  # How the epic ↔ child hierarchy is resolved. Mirrors the existing epicLinkStrategy key.
  hierarchyMode: parent # parent (team-managed) | epic-link (company-managed)

  # The link types the JIRA→MD converter reads into the pull-only `## Links` region.
  # `renderedAs` names the label the converter emits in the `.md` body today.
  recognized:
    - type: parent # epic → story/task/bug hierarchy edge
      direction: inward
      renderedAs: 'Parent'
    - type: epic-link # classic "Epic Link" field (company-managed projects)
      direction: inward
      renderedAs: 'Parent'
    - type: blocks # this issue blocks another
      direction: outward
      renderedAs: 'Blocks'
    - type: blocked-by # this issue is blocked by another
      direction: inward
      renderedAs: 'Blocked by'
    - type: relates # generic relationship
      direction: bidirectional
      renderedAs: 'Relates'
    - type: duplicates # this issue duplicates another
      direction: outward
      renderedAs: 'Relates' # NOTE: currently flattened into `relates` on read (see below)
    - type: clones # this issue clones another
      direction: outward
      renderedAs: 'Relates' # NOTE: currently flattened into `relates` on read (see below)

  # HONEST LIMITATION (matches converter.ts today — do not misrepresent):
  # collectLinks() reads `blocks`/`blocked-by`/`parent` distinctly, but flattens every
  # OTHER outward/inward link type (duplicates, clones, and any custom type) into `relates`
  # when rendering the `## Links` region. Since links are pull-only and read-for-display,
  # this flattening is cosmetic and is deliberately NOT fixed by this plan.
  readFlattensNonBlocksInto: relates

  # Link WRITING is a deliberate non-goal. The write engine is description-only.
  # `createIssueLink` is a separate API surface and is intentionally not wired in.
  writeSupported: false
```

### 2.2 Rules for the implementer (non-negotiable)

1. **Append only.** Do not reorder, rename, or delete any existing key in
   `jira-sync.config.yml` (`project`, `site`, `cloudId`, `epicLinkStrategy`,
   `scope`, `epics`, `fields`, `board`, `artifactFolders`, `statusCategory`,
   `stalenessHours`, `largeSyncThreshold`, `maxBatchPages`). Read the file
   first; add the block at the end (or adjacent to `epicLinkStrategy`, since
   `hierarchyMode` mirrors it).
2. **No code change.** Do **not** edit `scripts/jira/converter.ts`, `hash.ts`,
   `mcp-client.ts`, the write engine, or any command file to _parse_ this block.
   It is instruction context.
3. **Do not misrepresent the converter.** The
   `readFlattensNonBlocksInto: relates` and `renderedAs` NOTE comments must
   match what `converter.ts` actually does today — verify against `collectLinks`
   before writing, and if the converter's behaviour differs from the summary in
   §1, describe the _actual_ behaviour, not this plan's paraphrase.
4. **`writeSupported: false` is a statement of the declared non-goal**, not a
   TODO. Do not add a link-write path.
5. **Confluence:** E1 is JIRA-only. Confluence page relationships (parent/child
   ancestry) are already modeled via `spaces/{SPACE}.json` `treeHash` and the
   `/confluence tree` verb; there is no analogous link-type vocabulary to
   declare. **Do not add a `relationships:` block to
   `confluence-sync.config.yml`** unless a future need is identified — that
   would be unrequested scope.

### 2.3 Exit criteria for E1

- `.claude/config/jira-sync.config.yml` contains the `relationships:` block, all
  prior keys intact.
- No file under `scripts/`, `.claude/commands/`, or `.claude/agents/` changed.
- The NOTE/limitation comments accurately describe `converter.ts` (spot-check
  `collectLinks`).
- `git diff` shows exactly one file changed, additive-only.

---

## 3. E2 — Honest known-gaps / roadmap

The point of E2 is spec-kit's genuinely good habit: **a document that states,
plainly, what the tool supports, what it will never do (and why), and what might
come later.** This is added as a new section to **each** operating guide so it
lives beside the command reference a human already trusts.

### 3.1 Where it goes

- **`docs/JIRA-OPERATING-GUIDE.md`** → add a new top-level section
  **"Capabilities & roadmap"** (place it after §7 "Write-back safety", before
  "Cross-references").
- **`docs/CONFLUENCE-OPERATING-GUIDE.md`** → add the same-named section after §8
  "Boundaries — what this integration will never do" (which already lists
  non-goals — the new section **extends** it with a Supported/Planned framing;
  fold the existing §8 table in as the "Deliberately Not Supported" column
  rather than duplicating it).

### 3.2 The three-bucket structure (identical shape for both guides)

Each roadmap section has exactly three subsections. **Every row must be
verifiable against the as-built system** — no aspirational claims, no inventing
features that don't exist.

```markdown
## Capabilities & roadmap

> This is the honest state of the integration. "Supported" = built and
> documented above. "Deliberately not supported" = a considered non-goal with a
> reason (not a missing feature). "Planned / possible" = flagged in a plan but
> not yet built — no promise of a date.

### Supported today

| Capability                                                           | Where documented |
| -------------------------------------------------------------------- | ---------------- |
| … one row per real, built capability, linking to the section above … |

### Deliberately NOT supported (non-goals, with reasons)

| Non-goal                                                          | Why |
| ----------------------------------------------------------------- | --- |
| … one row per declined idea, reason drawn from the source files … |

### Planned / possible (not built — no committed date)

| Idea                                                                            | Status / where flagged |
| ------------------------------------------------------------------------------- | ---------------------- |
| … one row per genuinely-deferred item, citing the plan section that defers it … |
```

### 3.3 JIRA roadmap — the rows (drawn from verified sources)

**Supported today** (each links to the section in `JIRA-OPERATING-GUIDE.md` that
documents it):

- Four-layer local mirror (sync state / per-epic roster / derived index /
  identity) — §1
- `jira-helper` NL query subagent over `_index.json` — §2
- Init/ingest, sync/index, query, write-back command families — §3
- Alias resolution via shared `people.json` — §4
- 24h staleness gate + two-timestamp invariant — §5
- Description-only, dry-run-first, lost-update-guarded write-back (A/B/C) — §7
- **Relationship-type vocabulary declared in config (E1, this plan)** — link to
  `jira-sync.config.yml`

**Deliberately NOT supported** (reasons from `jira-write-engine.md` §8.6 + this
plan §0.2):

- **Link writing** (parent/blocks/relates pushed to JIRA) — `createIssueLink` is
  a separate API surface; write-back is description-only. Links are pull-only,
  read-for-display.
- **Whole-issue write** — the mirror is a lossy ADF→MD projection; only the
  description slice is safe to round-trip.
- **Status transitions in the write path** — `transitionJiraIssue` is a separate
  surface; status stays pull-only.
- **Auto-place parent on create** — always human-confirmed (a wrong parent is
  expensive to move).
- **Auto-run `/reconcile-requirements`** — R3 boundary; write-backs only
  _suggest_.
- **Storing secrets** — the MCP brokers auth; there is nothing to store.

**Planned / possible** (only genuinely-deferred items — cite the plan section):

- Distinct rendering of `duplicates`/`clones`/custom link types in the pull-only
  `## Links` region (currently flattened into `relates`) — _possible, low
  priority; deferred in `01d` §0.2 because links are pull-only and the
  flattening is cosmetic._
- SQLite/`.ndjson` search sidecar for `/jira search` past a few hundred issues —
  _deferred in `01a` §3.4._
- Anything else ONLY if `01a` explicitly defers it. **Do not invent roadmap
  items.**

### 3.4 Confluence roadmap — the rows (drawn from verified sources)

**Supported today** (link to `CONFLUENCE-OPERATING-GUIDE.md` sections):

- Rovo-first live discovery (search/read/summary) — §3 "Live discovery"
- Citation-cache mirror + derived index — §1
- Glossary (learned bank vocabulary, human-confirmed) — §3 "Glossary"
- Mirror verbs (pull, reindex, sync, space, who, tree, gap, stale) — §3 "Mirror"
- Section-scoped, dry-run-first, lost-update-guarded write-back
  (push/create/enhance) — §4
- Power verbs (relationship-map, design-sync, comment-triage) — §3 "Power verbs"
- Shared identity/alias via `people.json` — §7

**Deliberately NOT supported** (fold in the existing §8 "Boundaries" table
verbatim — it already lists):

- Auto-mutate Confluence · Auto-reconcile `specs/` · Guess an unresolved term ·
  Drop citations · Rewrite a macro fence or pull-only region · Fabricate a
  pageId · Auto-place a parent · Overwrite a hand-edited mirror body · Silently
  overwrite a concurrently-edited page · Write synthesis to `specs/` · Commit
  secrets.

**Planned / possible** (only what `01b` genuinely defers — verify against that
plan; if `01b` defers nothing relevant, say "None currently deferred" rather
than inventing items).

### 3.5 Rules for the implementer (non-negotiable)

1. **Every "Supported" row must point at a real section** in the same guide. If
   you can't link it, it isn't supported — don't list it.
2. **Every "Deliberately not supported" row must carry a reason** traceable to
   `jira-write-engine.md`, `confluence-write-engine.md`, or the operating
   guides.
3. **"Planned" rows are the danger zone.** List an item ONLY if a sibling plan
   (`01a`/`01b`) explicitly defers it, and cite that section. **Never turn a
   declined non-goal into a "Planned" item** — that is the exact contradiction
   D-E2 forbids. If nothing is genuinely deferred, write "None currently
   deferred."
4. **Do not duplicate the Confluence §8 table** — reframe it as the middle
   bucket, linking or folding, not copy-pasting a second time.
5. **No new secrets, no new commands, no code.** E2 is documentation only.

### 3.6 Exit criteria for E2

- Both operating guides have a "Capabilities & roadmap" section with the three
  buckets.
- Every Supported row links to an existing section; every Not-Supported row has
  a reason; every Planned row cites a deferring plan section (or the bucket says
  "None currently deferred").
- No declined non-goal appears under "Planned".
- `git diff` shows only the two `docs/*.md` files changed (plus the one config
  file from E1).

---

## 4. Phased delivery

| Phase                         | Scope                                                                                                                                                                               | Exit criteria                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **1 — E1 config block**       | Append `relationships:` to `.claude/config/jira-sync.config.yml` (§2). Verify NOTE comments against `converter.ts`.                                                                 | §2.3 met — one additive file diff, no code touched, comments accurate.                      |
| **2 — E2 JIRA roadmap**       | Add "Capabilities & roadmap" to `docs/JIRA-OPERATING-GUIDE.md` (§3.3).                                                                                                              | §3.6 met for JIRA — three buckets, every row verifiable, no non-goal listed as planned.     |
| **3 — E2 Confluence roadmap** | Add "Capabilities & roadmap" to `docs/CONFLUENCE-OPERATING-GUIDE.md`, folding §8 into the middle bucket (§3.4).                                                                     | §3.6 met for Confluence — no duplicated §8 table, buckets accurate.                         |
| **4 — Cross-check**           | Re-read all three changed files together; confirm no contradiction between the E1 config comments and the E2 roadmap rows (e.g. link-write is "declined" in both, never "planned"). | The three files tell one consistent story; `git diff` is exactly three files, all additive. |

> Phases are independent and small. Phase 1 can ship alone; Phases 2–3 can ship
> together. There is no engine work, no test to write (no code changed), and no
> MCP call at any point — this is a config-and-docs change consumed as
> instruction context.

---

## 5. Verification (how to prove it's done, without running anything remote)

- `git diff --stat` → exactly three files:
  `.claude/config/jira-sync.config.yml`, `docs/JIRA-OPERATING-GUIDE.md`,
  `docs/CONFLUENCE-OPERATING-GUIDE.md`. All additive.
- Grep the config block back and confirm no existing key was disturbed:
  `git diff .claude/config/jira-sync.config.yml` shows only added lines.
- Read `scripts/jira/converter.ts` `collectLinks` and confirm the
  `relationships:` NOTE comments match its real behaviour.
- Read the two new roadmap sections and confirm: every Supported row resolves to
  a real section; no "Deliberately not supported" item also appears under
  "Planned"; link-writing is declined in both the config comment and the JIRA
  roadmap.
- **No lint/type-check/test applies** — nothing executable changed. (Markdown +
  a comment-only YAML block. If a pre-commit hook lints Markdown, satisfy it;
  otherwise there is nothing to run.)

---

## 6. Guardrails (apply throughout — from the framework's Operating Discipline)

- **Never hallucinate a capability.** If a roadmap row can't be traced to a real
  file/section, drop it.
- **Never turn a declined non-goal into a "Planned" item** (D-E2).
- **No code, no engine change, no new command, no MCP call** — this plan is
  config + docs, both consumed as instruction context.
- **No secrets, ever** — the integrations have none; do not introduce a store
  for one.
- **Append, don't rewrite** — preserve every existing config key and doc
  section; add beside them.
- **If the as-built state has drifted** from §1's ground truth when you
  implement, STOP and re-scope rather than proceeding on this plan's paraphrase.

---

## 7. Decision log (this plan)

- **D-E1** E1 is a **doc-only** `relationships:` block in
  `jira-sync.config.yml`, read as instruction context. No converter fix, no
  link-write path. (§2)
- **D-E2** E2 is an **honest three-bucket roadmap** (Supported / Deliberately
  Not Supported / Planned) added to both operating guides. Declined non-goals
  (link-write, whole-issue write, status transitions) are documented as
  **declined**, never as planned. (§3)
- **D-E3** Rejected: fixing the cosmetic link-flattening in `converter.ts`;
  adding a link-write path; adopting spec-kit-confluence's plaintext-secret
  backup / broad PAT collection; making configs runtime-parsed. (§0.2)
- **D-E4** Confluence gets the roadmap (E2) but **not** a `relationships:`
  config block (E1) — Confluence has no link-type vocabulary to declare; adding
  one would be unrequested scope. (§2.2 rule 5)

---

## 8. Recommended first step

Implement **Phase 1** (append the `relationships:` block to
`jira-sync.config.yml`) after re-reading `scripts/jira/converter.ts`
`collectLinks` to confirm the NOTE comments are accurate. It is the smallest,
lowest-risk change and validates the "config as instruction context" approach
before the two documentation phases.
