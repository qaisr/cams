---
description: >
  Manage the authoritative Figma↔Lumen name-mapping glossary
  (`.claude/config/figma-lumen-glossary.json`). Subcommands: view / add / suggest / lint. The
  glossary is the authoritative Figma-name ↔ Lumen-code-name resolver (BD2/D22) — it fills the
  Phase-3 "glossary hook point" so `/figma coverage` stops reporting built screens as not-built when
  the Figma name diverges from the Lumen name (verified: `TopNavigationBars` ↔
  `DefaultTopAppBarScaffold`). OFFLINE: reads the local mirror + `apps/web/src/` only. NO Figma MCP,
  NO canvas writes, and it never advances `lastSyncedAt`. `get_code_connect_map` is the only MCP
  touch point and only on explicit invocation (Phase 6).
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: medium
---

# /figma-glossary — Figma↔Lumen name resolver

## Input

`$ARGUMENTS` — one of the sub-verb forms below. Bare `/figma-glossary` ⇒ `view` (whole glossary).

## Preconditions (every invocation)

1. `.claude/config/figma-lumen-glossary.json` must exist (committed, seeded in Phase 5). If missing,
   STOP and tell the user to restore it — never fabricate the file or its entries.
2. This command is **OFFLINE**. It reads only: the glossary config, `figma/_index.json` (derived),
   and the Lumen component tree under `apps/web/src/components/`. It performs **no Figma MCP call**
   and **no canvas write**, and never moves `lastSyncedAt`.

## Source model (BD2/D22 — the authority ladder)

The glossary is the **authoritative** Figma↔Lumen name resolver. Each entry carries a `source`:

| `source` | Meaning | Trust |
|---|---|---|
| `verified` | Human-confirmed, or lifted from a pushed Code Connect map. | Authoritative — may resolve a frame to `built`. |
| `inferred` | Proposed by the suggest script via fuzzy match. | **Not trusted** until a human promotes it to `verified`. A `mapsTo` derived from an `inferred` entry is **flagged inferred** in `/figma coverage` and never sets `built` on its own. |

The `/figma coverage` build-coverage resolution order (the hook point this glossary fills):

1. **Code Connect** template mapping (authoritative — Phase 6 / F4).
2. **glossary `verified`** entry.
3. **glossary `inferred`** entry (flagged inferred in output).
4. **raw convention scan** → only ever **proposes** a new `inferred` entry; **never `built` alone**.

## Subcommands

### `/figma-glossary view [<figmaName>]`

Print the glossary, or one entry. Read `.claude/config/figma-lumen-glossary.json`. With a
`<figmaName>` (matched against `figmaName` **and** `aliases`, case-insensitive), print just that
entry; if none matches, say so and suggest `/figma-glossary suggest`. Show `figmaName →
lumenComponent (lumenPath)`, aliases, `confidence`, and `source` — mark `inferred` entries plainly
so the reader never mistakes a proposal for an authoritative mapping.

### `/figma-glossary add <figmaName> <lumenPath>`

Add or **upgrade** a human-authored **`verified`** entry.

1. Resolve `<lumenPath>` against disk — it must be an existing folder under
   `apps/web/src/components/`. If it does not exist, STOP and report (a `verified` entry must point
   at real code); offer `/figma-glossary suggest` for candidates.
2. Derive `lumenComponent` from the folder name.
3. If an entry for `<figmaName>` already exists, **upgrade it in place** (set `source: "verified"`,
   `confidence: 1.0`, update `lumenPath`/`lumenComponent`, preserve existing `aliases`). Otherwise
   append a new entry with `aliases: []`, `confidence: 1.0`, `source: "verified"`.
4. Write the glossary back with stable 2-space formatting; show the before/after entry for
   confirmation. This is the **only** subcommand that writes the glossary.

### `/figma-glossary suggest`

Dry-run proposals — **never auto-writes**.

1. Run `node_modules/.bin/tsx scripts/figma-glossary-suggest.ts --root .`.
2. The script fuzzy-matches Figma component names (from `figma/_index.json.componentUsage`, populated
   by Phase-4 codegen) against Lumen components on disk, **skips any name the glossary already
   resolves** (by `figmaName` or alias — authoritative wins), and prints an `inferred` proposal list.
   It writes **nothing**.
3. Present the proposals. The user approves a subset; write each **only** by re-invoking
   `/figma-glossary add <figmaName> <lumenPath>` for the ones they confirm (which lands them as
   `verified`). Never bulk-write `inferred` entries silently — `unresolvedPolicy: propose-then-ask`.
4. When `componentUsage` is empty (pre-Phase-4), the script reports "nothing to suggest" — relay
   that verbatim; do not invent Figma names.

### `/figma-glossary lint`

Report two gap classes; **read-only**.

1. **Stale `lumenPath`s** — for every entry, check the `lumenPath` folder exists under
   `apps/web/src/components/`. A missing folder ⇒ the Lumen component was deleted/renamed; flag it
   (`stale: <figmaName> → <lumenPath> (not found)`) and suggest `/figma-glossary add` with the new
   path (or removal).
2. **Unmapped components** — every Figma component in `figma/_index.json.componentUsage` with **no**
   glossary entry (by `figmaName` or alias) is a coverage gap; flag it and point to
   `/figma-glossary suggest`.
3. Exit summary: counts of stale paths + unmapped components; "clean" when both are zero.

> **Renames surface via lint.** `/figma-glossary lint` runs inside `/figma-sync`'s change report, so
> a renamed Figma component (new name appears in `componentUsage`, old name gone) is flagged as an
> unmapped component prompting a glossary update. (`/figma-sync` calls this command's `lint` as its
> reusable rename-detection engine.)

## Wiring into Phase 3

- **`figma-helper`** consults this glossary when answering "which Lumen component realizes this
  frame?" / "is this frame built?" — resolving Figma names through the glossary (verified →
  inferred, flagged) **before** falling back to the raw convention scan (§9 of `figma-helper`).
- The seeded `TopNavigationBars ↔ DefaultTopAppBarScaffold` verified entry is exactly the case the
  convention scan misses; with the glossary in place `/figma coverage` resolves it to `built`.

## Guardrails

- **OFFLINE, read-mostly.** Only `add` writes, and only the glossary JSON — never `figma/`,
  `specs/`, or `apps/web/`.
- **`suggest` never auto-writes**; proposals are `inferred` and require human promotion via `add`.
- **`inferred` is never authoritative** — it cannot set `built` alone; coverage flags it.
- **No Figma MCP** in any subcommand except an explicitly-invoked `get_code_connect_map` (Phase 6);
  nothing here advances `lastSyncedAt` or touches the canvas.
