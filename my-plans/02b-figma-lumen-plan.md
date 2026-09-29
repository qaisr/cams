# Plan 2b — Figma↔Lumen Advanced Features (Glossary · Handshake Gate · Token-Drift · Template Code Connect · Design-QA)

> **Status:** Proposed · **Author:** AI Tools Expert / Frameworks Designer
> session · **Date:** 2026-08-02 **Companion to:**
> `my-plans/02-figma-lumen-plan.md` (the mirror/index/helper foundation)
> **Sibling plans:** `my-plans/01a-jira-plan.md` ·
> `my-plans/01b-confluence-plan.md`

---

## 0. What this plan is (and is not)

`02` builds the **foundation**: a local-copy Figma mirror (`figma/`), a derived
`figma/_index.json`, the `figma-helper` subagent + `/figma` router, per-node
`.meta.json` (with `buildStatus`/`mapsTo`), shared `.claude/config/people.json`,
and a **code-side-only** write-back posture.

**`02b` is strictly additive.** It turns five research findings — each verified
against PPCC-internal sources or the vendor's own docs — into concrete
`.claude/` framework artifacts (commands, agents, patterns, standards,
templates, scripts, hooks, config). It **does not restate** `02`; it references
`02 §N` and plugs into that foundation. Nothing here works without `02` Phases
0–3 in place.

| #      | Feature                                          | What it fixes                                                                                         | Extends `02`                                        |
| ------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **F1** | **Figma↔Lumen name-mapping glossary**            | Figma component names diverge from Lumen code names → `02 §7` convention scan misses matches          | `02 §5` (helper), `§7` (coverage/`mapsTo`)          |
| **F2** | **Design Handshake + Accessibility-spec gate**   | PPCC's formal pre-finalization gate + a11y spec are not enforced before a component is marked "built" | `02 §2.2` (meta), `§4.6` (codegen), `§7` (coverage) |
| **F3** | **DTCG + Style Dictionary token-drift pipeline** | Figma tokens drift from the Lumen tokens the code consumes, undetected; semantic>global not enforced  | `02 §4.6` (token mapping), `§9` (Lumen adoption)    |
| **F4** | **Template-file Code Connect**                   | Framework-specific parsers **EOL 2026-08-17**; `02 §8` describes Code Connect generically             | `02 §8` (write-back engine), `§7` (`mapsTo`)        |
| **F5** | **Design-QA / visual-regression hooks**          | `02 §4.6` visual-diff is one-shot at codegen; no ongoing guard after later code changes               | `02 §4.6` (visual-diff), `§7` (coverage)            |

> **The `02` asymmetry rule still governs everything here:** the designer's
> Figma canvas is the **system of record** — AI **never** edits it. Every
> "write-back" in `02b` is **code-side only** (Code Connect **template**
> mappings + build-status/handshake back-annotation into the local mirror).

---

## 1. Feature F1 — Figma↔Lumen name-mapping glossary

### 1.1 The problem (PPCC-specific, verified)

Figma component names **do not equal** Lumen code component names. Verified PPCC
examples:

| Figma component name            | Lumen code component       |
| ------------------------------- | -------------------------- |
| `TopNavigationBars`             | `DefaultTopAppBarScaffold` |
| `PrimaryHeadingContentTemplate` | (equivalent code template) |
| `ResultTemplate`                | (equivalent code template) |

`02 §7`'s build-coverage populates `mapsTo`/`buildStatus` partly via a
**convention scan** — matching a frame slug against a component name in
`apps/web/src/components/`. Because the two naming systems diverge, that scan
**silently misses real matches** and reports built screens as `not-built`. A
glossary is the authoritative name resolver that closes the gap.

### 1.2 Artifacts

| Artifact                    | Path                                       | Purpose                                                                                         |
| --------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Glossary config (committed) | `.claude/config/figma-lumen-glossary.json` | Canonical Figma name ↔ Lumen component name/path, with aliases, confidence, source              |
| Command                     | `.claude/commands/figma-glossary.md`       | `/figma-glossary view\|add\|suggest\|lint`                                                      |
| Suggestion script           | `scripts/figma-glossary-suggest.ts`        | Fuzzy-match Figma component inventory vs Lumen components + Code Connect maps → propose entries |

### 1.3 `.claude/config/figma-lumen-glossary.json` shape

```json
{
  "_note": "Authoritative Figma-name ↔ Lumen-code-name resolver. Hand-owned + committed. The 02 §7 convention scan may only PROPOSE entries here (human-approved); it is never authoritative.",
  "entries": [
    {
      "figmaName": "TopNavigationBars",
      "lumenComponent": "DefaultTopAppBarScaffold",
      "lumenPath": "apps/web/src/components/navigation/DefaultTopAppBarScaffold",
      "aliases": ["TopNav", "AppBar"],
      "confidence": 1.0,
      "source": "verified"
    },
    {
      "figmaName": "PrimaryHeadingContentTemplate",
      "lumenComponent": "PrimaryHeadingContentTemplate",
      "lumenPath": "apps/web/src/components/templates/PrimaryHeadingContentTemplate",
      "aliases": ["PrimaryHeading"],
      "confidence": 1.0,
      "source": "verified"
    },
    {
      "figmaName": "ResultTemplate",
      "lumenComponent": "ResultTemplate",
      "lumenPath": "apps/web/src/components/templates/ResultTemplate",
      "aliases": [],
      "confidence": 0.7,
      "source": "inferred"
    }
  ],
  "unresolvedPolicy": "propose-then-ask"
}
```

- `source: "verified"` — a human confirmed the pairing (or it came from a pushed
  Code Connect map).
- `source: "inferred"` — the `figma-glossary suggest` script proposed it by
  fuzzy match; **not yet trusted** until a human promotes it to `verified`.
  `mapsTo` derived from an `inferred` entry is flagged as inferred in `02 §7`
  coverage output.

### 1.4 How it plugs into `02`

- **`02 §7` build-coverage resolution order** becomes: (1) **Code Connect**
  template mapping (authoritative — F4); (2) **glossary** `verified` entry; (3)
  **glossary** `inferred` entry (flagged); (4) raw convention scan → only ever
  **proposes** a new `inferred` glossary entry, never sets `built` on its own.
- **`figma-helper` (`02 §5`)** consults the glossary when answering _"which
  Lumen component realizes this frame?"_ and _"is this frame built?"_ —
  resolving Figma names through the glossary before reporting.
- `/figma-glossary lint` flags: glossary entries whose `lumenPath` no longer
  exists (component deleted/renamed → stale), and Figma components in
  `figma/_index.json.componentUsage` with **no** glossary entry (coverage gap).

### 1.5 `/figma-glossary` subcommands

| Subcommand                    | Behaviour                                                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `view [<figmaName>]`          | Print the glossary (or one entry).                                                                                         |
| `add <figmaName> <lumenPath>` | Add/upgrade a `verified` entry (human-authored).                                                                           |
| `suggest`                     | Run `scripts/figma-glossary-suggest.ts` → dry-run list of proposed `inferred` entries; human approves the subset to write. |
| `lint`                        | Report stale `lumenPath`s and unmapped Figma components.                                                                   |

---

## 2. Feature F2 — Design Handshake + Accessibility-spec gate

### 2.1 The problem (PPCC process, verified)

PPCC finalizes a design-system component only after a formal **Design
Handshake** — squad designers + Lumen designers + platform representatives meet
and agree the component is production-ready. Separately, the **Accessibility
team issues an "Accessibility spec"** (ARIA roles, keyboard interaction, focus
order, contrast) for engineering to implement. `02 §4.6` hi-fi→Lumen codegen has
no concept of either — it can happily mark a node `built` that never cleared the
gate or lacks its a11y spec. F2 makes the gate a **hard precondition** for
`buildStatus: built`.

### 2.2 Artifacts

| Artifact                     | Path                                              | Purpose                                                                       |
| ---------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------- |
| Gate command                 | `.claude/commands/design-handshake.md`            | `/design-handshake <slug>` — checklist-driven gate; records `.handshake.json` |
| Handshake checklist template | `.claude/templates/design-handshake-checklist.md` | The meeting/sign-off checklist                                                |
| Accessibility-spec template  | `.claude/templates/accessibility-spec.md`         | The a11y spec engineering implements                                          |
| Per-node mirror artifact     | `figma/nodes/<slug>.handshake.json`               | Gate status recorded per node                                                 |

### 2.3 `figma/nodes/<slug>.handshake.json` shape

```json
{
  "slug": "entity-onboarding-confirm",
  "nodeId": "299:12210",
  "status": "cleared",
  "participants": {
    "squadDesigner": "s.designer",
    "lumenDesigner": "l.lumen",
    "platformRep": "abbasqa"
  },
  "a11ySpecRef": "figma/nodes/entity-onboarding-confirm.a11y.md",
  "decisions": [
    "Use Lumen Stepper, not a custom progress bar.",
    "Confirm CTA is the only primary button on the screen."
  ],
  "clearedAt": "2026-08-05T04:00:00.000Z"
}
```

- `status ∈ pending | cleared | rejected`.
- `a11ySpecRef` points at the node's accessibility spec (authored from
  `.claude/templates/accessibility-spec.md`).

### 2.4 Meta + coverage wiring (into `02`)

- Add a `handshakeStatus` field to the per-node `.meta.json` (`02 §2.2`):
  `not-required | pending | cleared | rejected`, mirroring
  `.handshake.json.status`.
- **`02 §7` `/figma coverage`** surfaces `handshakeStatus` alongside
  `buildStatus`, so a node cannot be reported "built" if the gate is
  `pending`/`rejected` — it's shown as `built (⚠ handshake pending)`.
- **`02 §4.6` `/figma-to-lumen`** hard-checks `handshakeStatus === "cleared"`
  before it may set `buildStatus: built`. Override path:
  `--override "<logged reason>"` records the reason into `.meta.json` and the
  run log — never silent.

> **Exercise this gate against the Phase 4 hi-fi fixture.** The throwaway
> `hifi-fixture-login` node (Pipeline C, authored in `02` Phase 4 — Option B)
> carries **`handshakeStatus: "not-required"`** precisely so codegen can clear
> the gate before any real Design Handshake exists. Use it as the
> **`not-required` regression case**: confirm `/figma coverage` shows the
> fixture as `built` **without** a `⚠ handshake pending` warning, while a
> `pending`/absent-handshake node stays blocked from `built`; optionally
> exercise `--override "<reason>"` on the fixture to verify the reason lands in
> `.meta.json` + the run log and is never applied silently. Do **not** author a
> `.handshake.json` for the fixture — `not-required` is the whole point. The
> fixture proves the gate mechanics; a **real** cleared handshake on the
> designer's `entity-onboarding-v2` node is still required for production.
> Delete the fixture when the real node lands.

### 2.5 Template section headings

`design-handshake-checklist.md`: **Component identity** · **Design review**
(squad + Lumen sign-off) · **Token conformance** (semantic>global — F3) ·
**Accessibility spec attached** · **Platform/tech feasibility** · **Decisions &
deviations** · **Sign-off (participants + date)**.

`accessibility-spec.md`: **Roles & ARIA** · **Keyboard interaction & focus
order** · **Color contrast (WCAG 2.1 AA)** · **Screen-reader announcements** ·
**Motion/reduced-motion** · **Error/empty/loading states** · **Test hooks
(axe-core / Playwright)**. This template is authored/reviewed with the existing
**`accessibility-auditor`** agent against
**`@.claude/standards/accessibility-standards.md`**.

---

## 3. Feature F3 — DTCG + Style Dictionary token-drift pipeline

### 3.1 The problem

`get_variable_defs` (verified) returns the full PPCC token set — e.g.
`color/primary/default: #1e1e1e`, `color/tertiary/default: #faec20` (brand
yellow), `color/surface/default: #ffffff`,
`Foundation/Body: PPCC Beacon Sans Regular 16px`, plus spacing/radius. The Lumen
code consumes `var(--lmn-color-*)`, `var(--lmn-spacing-*)`. These two sets
**drift** — a designer retones a color, a token is renamed — and nothing detects
it today. Lumen's rule is **semantic > global/primitive**; the pipeline must
also flag where code uses a global token when a semantic one exists.

### 3.2 Research basis

- **DTCG** (W3C Design Tokens Community Group) — the interchange format for
  design tokens. Stable spec **TR 2025.10** (2025-10-28); members include
  **Figma**, **Style Dictionary**, **Tokens Studio**.
- **Style Dictionary** — the canonical token-transform tool (DTCG JSON → CSS
  custom properties, etc.).
- **Tokens Studio** — Figma plugin storing tokens as JSON with GitHub sync +
  aliases + theme sets; the **optional designer-side single-source** path.

> **Dependency rule.** `style-dictionary` is a new dependency — install with
> `pnpm add -D style-dictionary@latest` **after** verifying the latest stable
> via `pnpm view style-dictionary version`; reject pre-release tags (per
> `.claude/CLAUDE.md`).

### 3.3 Artifacts

| Artifact                  | Path                                        | Purpose                                                                                   |
| ------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Command                   | `.claude/commands/figma-token-drift.md`     | `/figma-token-drift` — dry-run Figma-vs-Lumen token delta report                          |
| Script                    | `scripts/token-drift.ts`                    | The pipeline (below)                                                                      |
| Style Dictionary config   | `.claude/config/style-dictionary.config.js` | DTCG → CSS custom-property transform                                                      |
| DTCG baseline (committed) | `figma/tokens/.baseline.dtcg.json`          | Last-reviewed normalized token snapshot                                                   |
| File-level Figma tokens   | `figma/tokens/figma-tokens.json`            | Figma tokens mirrored at file scope (complements per-node `<slug>.tokens.json` from `02`) |
| Advisory hook             | `.claude/hooks/token-drift-check`           | Warns (non-blocking) when `figma/tokens/*` changed without a drift review                 |

### 3.4 Pipeline (`scripts/token-drift.ts`) — detection only

```
1. Read Figma tokens from the mirror (figma/tokens/figma-tokens.json or per-node <slug>.tokens.json).
2. Normalize → DTCG JSON ($value/$type, aliases as {alias} refs).
3. Style Dictionary (.claude/config/style-dictionary.config.js) → emit CSS custom properties.
4. Read Lumen tokens actually consumed by the app:
     - get-lumen-css-tokens (Lumen MCP)   → the available --lmn-* vars
     - grep var(--lmn-*) across apps/web   → the ones the code uses
5. Diff emitted-vs-Lumen: added / removed / changed(value) / renamed(same value, new name).
6. Flag semantic>global violations: a global/primitive token is used where a semantic token exists.
7. Print a dry-run report. Compare against figma/tokens/.baseline.dtcg.json to show "since last review".
8. NEVER edits Figma. NEVER auto-rewrites Lumen tokens. Human decides; re-baselining is explicit.
```

### 3.5 DTCG token shape

```json
{
  "color": {
    "primary": {
      "default": { "$value": "#1e1e1e", "$type": "color" }
    },
    "tertiary": {
      "default": {
        "$value": "#faec20",
        "$type": "color",
        "$description": "PPCC brand yellow"
      }
    }
  },
  "spacing": {
    "200": { "$value": "8px", "$type": "dimension" }
  },
  "typography": {
    "body": {
      "$type": "typography",
      "$value": {
        "fontFamily": "PPCC Beacon Sans",
        "fontWeight": "Regular",
        "fontSize": "16px"
      }
    }
  }
}
```

### 3.6 Style Dictionary config skeleton

```js
// .claude/config/style-dictionary.config.js
export default {
  source: ['figma/tokens/*.dtcg.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      prefix: 'lmn', // emit --lmn-* to line up with Lumen naming
      buildPath: '.claude/.token-drift/',
      files: [{ destination: 'figma-emitted.css', format: 'css/variables' }],
    },
  },
};
```

### 3.7 Sample drift report

```
Token drift — Figma (mirror) vs Lumen (code), since baseline 2026-07-20
  CHANGED   color/tertiary/default   #f6e800 → #faec20   (brand yellow retoned)
  ADDED     spacing/250              10px               (no --lmn-spacing-250 in Lumen yet)
  RENAMED   color/surface/base → color/surface/default  (same value #ffffff)
  ⚠ SEMANTIC   apps/web/.../Card.tsx uses --lmn-color-primary-default (global);
               prefer semantic --lmn-color-on-surface-default
  3 deltas, 1 semantic>global warning. Re-baseline with /figma-token-drift --baseline (explicit).
```

### 3.8 Run it against the Phase 4 hi-fi fixture (before the real node)

Token-drift can be validated **now** — no wait for the designer's
`entity-onboarding-v2` node. The Phase 4 throwaway fixture
(`hifi-fixture-login`, Pipeline C) is pulled with `get_variable_defs`, so its
`figma/nodes/hifi-fixture-login.tokens.json` gives a **real PPCC Figma token
set** to normalize → DTCG → Style-Dictionary-emit → diff against the Lumen
tokens the app consumes. Point `/figma-token-drift` at the fixture's tokens to
prove the full pipeline (value deltas + semantic>global advisories vs the
baseline) end-to-end. The fixture proves the machinery; the **real** token set
still comes from the real node. Delete the fixture's token export in the Phase 4
cleanup step.

---

## 4. Feature F4 — Template-file Code Connect (supersedes the EOL parser)

### 4.1 The problem (verified, TIME-CRITICAL)

Figma Code Connect **framework-specific parsers lose all support on 2026-08-17**
— **template files (framework-agnostic JS templates) become the only actively
maintained way to use Code Connect**. Today is **2026-08-02** — a ~2-week
window. `02 §8`'s write-back engine references Code Connect generically; `02b`
specifies the **template-file** approach concretely so the engine is
future-proof from day one and anyone on the old React-parser path migrates
before the deadline. (Requires Org/Enterprise plan + a Design or **Dev** Mode
seat — user's Dev seat is confirmed in `02 §0.1`.)

### 4.2 Artifacts

| Artifact                | Path                                                      | Purpose                                                                                           |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Pattern doc (canonical) | `.claude/patterns/figma-code-connect-template-pattern.md` | Template files not parsers; the `figma.connect()` template shape; Figma-prop → Lumen-prop mapping |
| Command                 | `.claude/commands/figma-codeconnect.md`                   | `/figma-codeconnect <ComponentPath> <node-id>` — generate template → dry-run → approve → push     |
| Template scaffold       | `.claude/templates/code-connect-template.ts`              | Starter `figma.connect(...)` for a Lumen ↔ Figma pairing                                          |
| Migration checklist     | `.claude/commands/figma-codeconnect-migrate.md`           | For anyone on the React-parser path — **complete before 2026-08-17**                              |

### 4.3 Template scaffold (`.claude/templates/code-connect-template.ts`)

```ts
// Framework-AGNOSTIC template file (the only Code Connect path maintained after 2026-08-17).
// Figma-name ↔ Lumen-name pairing comes from .claude/config/figma-lumen-glossary.json (F1).
import figma, { html } from '@figma/code-connect/html';

// Figma component "TopNavigationBars" ↔ Lumen "DefaultTopAppBarScaffold" (glossary: verified)
figma.connect(
  'https://www.figma.com/design/2MbwX0rxNA1uhgDwlC7Z6G/...?node-id=299-12006',
  {
    props: {
      title: figma.string('Title'),
      hasBackButton: figma.boolean('Show back button'),
    },
    example: (props) => html`
      <default-top-app-bar-scaffold
        title="${props.title}"
        back-button="${props.hasBackButton}"
      >
      </default-top-app-bar-scaffold>
    `,
  },
);
```

### 4.4 `/figma-codeconnect` flow (reuses the `02 §8` engine shape)

```
1. GENERATE   scaffold a template file from .claude/templates/code-connect-template.ts,
              resolving Figma-name ↔ Lumen-name via the F1 glossary.
2. DRY-RUN    show the template body + the node it targets; nothing pushed.
3. APPROVE    human, per-mapping.
4. RE-CHECK   get_code_connect_map — skip nodes already mapped / conflicting.
5. PUSH       add_code_connect_map / send_code_connect_mappings — TEMPLATE body only.
6. RE-PULL    get_code_connect_map → authoritative mapping set.
7. RECONCILE  write mapsTo + buildStatus into .meta.json + _index.json (02 §7).
```

The `02 §8.4` invariants stand: **never edit the designer's canvas**;
**per-mapping approval**; a wrong mapping misleads Dev Mode → always dry-run
first.

### 4.5 Migration checklist (`figma-codeconnect-migrate.md`) — before 2026-08-17

Detect any existing React-parser Code Connect
(`figma.connect(Component, url, {...})` in `.figma.tsx` files) → convert each to
a **template file** (`figma.connect(url, { example })`) → re-push → verify in
Dev Mode → delete the parser-based files. Flag loudly if the deadline is near.

---

## 5. Feature F5 — Design-QA / visual-regression hooks

### 5.1 The problem

`02 §4.6`'s visual-diff gate fires **once**, at codegen. After later code
changes a built Lumen screen can silently drift from its Figma render, and
there's no repeatable design-QA checklist. F5 adds an **ongoing** guard that
compares the built route against the **local mirror render** — never re-pulling
Figma in CI (respects `02`'s local-mirror-first + no-auto-MCP rules).

### 5.2 Artifacts

| Artifact                     | Path                                          | Purpose                                                                      |
| ---------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------- |
| Visual-regression command    | `.claude/commands/figma-visual-regression.md` | `/figma-visual-regression [<slug>]` — Playwright render ⟷ mirror `.png` diff |
| Visual-regression hook       | `.claude/hooks/design-qa-check`               | Optional step in the E2E/Playwright flow; CI for `buildStatus: built` nodes  |
| Manifest (committed)         | `figma/.visual-regression/manifest.json`      | slug → route → threshold → lastResult → baselineRenderHash                   |
| Diff output                  | `figma/.visual-regression/<slug>/`            | diff image + pass/fail per run                                               |
| Design-QA command            | `.claude/commands/design-qa.md`               | `/design-qa <slug>` — manual checklist sign-off                              |
| Design-QA checklist template | `.claude/templates/design-qa-checklist.md`    | The conformance checklist                                                    |

### 5.3 `figma/.visual-regression/manifest.json` shape

```json
{
  "nodes": [
    {
      "slug": "entity-onboarding-confirm",
      "route": "/onboarding/confirm",
      "threshold": 0.02,
      "baselineRenderHash": "sha256:…",
      "lastResult": {
        "status": "pass",
        "diffRatio": 0.004,
        "at": "2026-08-06T02:00:00.000Z"
      }
    }
  ]
}
```

- Compares the Playwright screenshot against the committed
  `figma/nodes/<slug>.png` (`02` mirror render).
- `threshold` — per-node pixel-diff tolerance (font AA differences → keep a
  small, tuned tolerance).
- **Re-baselining is explicit only**: requires `/sync-figma --pull` (fresh
  mirror render, advances `lastSyncedAt` per `02 §5.4`) + human approval. Never
  silent. `baselineRenderHash` must equal the mirror `.png`'s `renderHash`
  (`02 §2.2`) or the run reports **baseline-stale**, not pass/fail.

> **Validate F5 against the Phase 4 hi-fi fixture (before the real node).** Add
> a manifest entry for the throwaway `hifi-fixture-login` node whose baseline is
> the fixture's committed `figma/nodes/hifi-fixture-login.png` and whose `route`
> is the screen `/figma-to-lumen` built from it; its `baselineRenderHash` must
> equal the node's `renderHash` in `.meta.json`. That proves the whole
> visual-regression loop (Playwright screenshot ⟷ mirror `.png`, threshold,
> baseline-stale detection, CI reads mirror-only per BD9) end-to-end without
> waiting for the designer. Remove the fixture's manifest entry in the Phase 4
> cleanup step; the fixture proves the machinery, the real
> `entity-onboarding-v2` node is still required for production QA.

### 5.4 Design-QA checklist headings (`design-qa-checklist.md`)

**Spacing/layout conformance** · **Token conformance** (semantic>global — F3) ·
**Typography** · **Interaction states** (hover/focus/active/disabled) ·
**Responsive breakpoints** · **Accessibility-spec conformance** (F2
`a11ySpecRef`) · **Visual-regression pass** (F5 manifest). Manual sign-off for
nodes where pixel diffing is too brittle to fully trust.

---

## 6. New `.claude/` artifacts inventory (implementation checklist)

| Type     | Path                                                      | Feature | Purpose                                    |
| -------- | --------------------------------------------------------- | ------- | ------------------------------------------ |
| Config   | `.claude/config/figma-lumen-glossary.json`                | F1      | Authoritative Figma↔Lumen name resolver    |
| Command  | `.claude/commands/figma-glossary.md`                      | F1      | view/add/suggest/lint the glossary         |
| Script   | `scripts/figma-glossary-suggest.ts`                       | F1      | Propose glossary entries by fuzzy match    |
| Command  | `.claude/commands/design-handshake.md`                    | F2      | Handshake gate; writes `.handshake.json`   |
| Template | `.claude/templates/design-handshake-checklist.md`         | F2      | Handshake sign-off checklist               |
| Template | `.claude/templates/accessibility-spec.md`                 | F2      | A11y spec engineering implements           |
| Command  | `.claude/commands/figma-token-drift.md`                   | F3      | Figma-vs-Lumen token delta report          |
| Script   | `scripts/token-drift.ts`                                  | F3      | DTCG → Style Dictionary → diff pipeline    |
| Config   | `.claude/config/style-dictionary.config.js`               | F3      | DTCG → CSS var transform                   |
| Hook     | `.claude/hooks/token-drift-check`                         | F3      | Advisory warn on unreviewed token change   |
| Pattern  | `.claude/patterns/figma-code-connect-template-pattern.md` | F4      | Canonical template-file Code Connect       |
| Command  | `.claude/commands/figma-codeconnect.md`                   | F4      | Generate→dry-run→approve→push a template   |
| Template | `.claude/templates/code-connect-template.ts`              | F4      | `figma.connect()` scaffold                 |
| Command  | `.claude/commands/figma-codeconnect-migrate.md`           | F4      | Parser→template migration (pre-2026-08-17) |
| Command  | `.claude/commands/figma-visual-regression.md`             | F5      | Playwright ⟷ mirror `.png` diff            |
| Command  | `.claude/commands/design-qa.md`                           | F5      | Manual design-QA checklist                 |
| Hook     | `.claude/hooks/design-qa-check`                           | F5      | Optional E2E/CI visual-regression step     |
| Template | `.claude/templates/design-qa-checklist.md`                | F5      | Design-QA conformance checklist            |
| Agent    | `.claude/agents/design-system-analyst.md`                 | all     | Read/analyze glossary+tokens+coverage (§7) |

Manifest/mirror artifacts (written by commands, per node/file):
`figma/nodes/<slug>.handshake.json`, `figma/nodes/<slug>.a11y.md`,
`figma/tokens/figma-tokens.json`, `figma/tokens/.baseline.dtcg.json`,
`figma/.visual-regression/manifest.json` (+ `<slug>/` diff outputs). Add the
derived/heavy ones (`.claude/.token-drift/`, `figma/.visual-regression/<slug>/`
diff images) to `.gitignore`; keep the committed baselines and manifests.

---

## 7. Do we need a new subagent?

**Recommendation: yes — a focused `design-system-analyst`**, rather than
overloading `figma-helper`.

`figma-helper` (`02 §5`) is scoped to the **mirror/index** — "what's in the
file, what changed, what's built". F1/F3/F4's questions are a different
competency: _token_ drift, _name_ resolution across two naming systems, and
_Code Connect_ mapping health. Folding them into `figma-helper` would bloat its
load set (glossary + DTCG + Style Dictionary output + Code Connect maps) on
every mundane "find the login frame" query. A separate analyst keeps each lean.

| Agent                   | Mode     | Purpose                                                                                                                                                                                                                                                                                                                                                                              | Tools                                                                                                                                                                                                     | Load File                                 |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `design-system-analyst` | subagent | Read/analyze the **design-system health** surface: glossary coverage & staleness (F1), token drift & semantic>global (F3), Code Connect mapping coverage (F4), and design-QA/coverage rollups (F5). **READ/ANALYZE ONLY** — every mutation (glossary write, token re-baseline, Code Connect push, handshake clear) is delegated to the gated `/figma-*` commands, never done inline. | Read, Grep, Glob, AskUserQuestion, Lumen MCP (`get-lumen-css-tokens`), Figma MCP read tools (`get_code_connect_map`, `get_variable_defs`) — **only when the user explicitly invokes a `/figma*` command** | `.claude/agents/design-system-analyst.md` |

It mirrors the `jira-helper`/`confluence-search` posture: analysis in the agent,
mutation in the router-gated commands.

---

## 8. Critical challenges & solutions (new features)

| Gap / flaw                                                  | Consequence                                                              | Fix                                                                                                                                                                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Glossary staleness** — designer renames a Figma component | Glossary points at a dead Figma name → coverage regresses to `not-built` | `/figma-glossary lint` runs in `/sync-figma`'s report; a renamed Figma component (new name in `componentUsage`, old name gone) surfaces as an unmapped component prompting a glossary update.               |
| **`inferred` glossary entries trusted too soon**            | A wrong fuzzy match marks a screen "built"                               | `inferred` never sets `built` alone (§1.4); coverage flags it inferred; only human promotion to `verified` (or a Code Connect push) makes it authoritative.                                                 |
| **DTCG / Style Dictionary version drift**                   | A tool upgrade changes emitted output → false drift                      | Pin `style-dictionary@latest`-resolved version in `package.json`; the config lives in-repo; the **baseline** is the comparison anchor, so a tool bump shows as a one-time re-baseline, reviewed by a human. |
| **Token-drift false positives from semantic-vs-global**     | Noise drowns real deltas                                                 | Separate the report into **value deltas** (added/removed/changed/renamed) vs **semantic>global advisories**; advisories are warnings, never failures.                                                       |
| **Code Connect parser EOL 2026-08-17 missed**               | Mappings silently unsupported after the date                             | F4 standardizes on **template files** from day one; `figma-codeconnect-migrate` flags loudly as the deadline nears; the `02` decision log + `02b` D-log record the deadline.                                |
| **Visual-regression flakiness** (font AA, sub-pixel)        | Constant false CI failures → ignored gate                                | Per-node tuned `threshold`; compare against the **local mirror** render (deterministic, committed) not a live pull; brittle screens fall back to the manual `/design-qa` checklist.                         |
| **Baseline goes stale silently**                            | Regression passes against an old render                                  | `baselineRenderHash` must equal the mirror `.png` `renderHash`; mismatch → **baseline-stale**, not pass; re-baseline only via explicit `/sync-figma --pull` + approval.                                     |
| **Handshake gate becomes a bottleneck**                     | Codegen blocked waiting on a meeting                                     | `handshakeStatus: not-required` for internal/experimental screens; `--override "<reason>"` on `/figma-to-lumen` with a logged reason for justified exceptions — never silent.                               |
| **A11y spec absent but component shipped**                  | WCAG regressions reach prod                                              | Handshake checklist requires `a11ySpecRef`; the `accessibility-auditor` agent + `accessibility-standards.md` validate it; `/design-qa` re-checks conformance post-build.                                    |
| **CI accidentally calls Figma MCP**                         | Violates the MCP access-control policy; slow/gated                       | Token-drift + visual-regression in CI read the **local mirror only** and call **no MCP**; MCP reads happen solely inside human-invoked `/figma*` commands (§10).                                            |

---

## 9. Phased delivery (additive on `02` Phases 0–6)

| Phase                                                      | Scope                                                                                                                                                                                           | Seat                          | Exit criteria                                                                                                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **02b-A — Glossary (F1)**                                  | `figma-lumen-glossary.json`; `/figma-glossary` (view/add/suggest/lint); `figma-glossary-suggest.ts`; wire glossary into `02 §7` resolution order + `figma-helper`. Seed the 3 verified entries. | View                          | `02 §7` coverage resolves names through the glossary; the `TopNavigationBars↔DefaultTopAppBarScaffold` case reports `built`; `lint` flags unmapped components. |
| **02b-B — Handshake + a11y gate (F2)**                     | `/design-handshake`; checklist + a11y-spec templates; `.handshake.json`; add `handshakeStatus` to `.meta.json` + coverage; `/figma-to-lumen` hard-checks `cleared`.                             | View                          | A `pending` node cannot be marked `built`; coverage shows the ⚠ handshake state; `--override` logs a reason.                                                   |
| **02b-C — Token-drift (F3)**                               | `/figma-token-drift`; `token-drift.ts`; Style Dictionary config; DTCG baseline; advisory hook. Install `style-dictionary@latest` (verified).                                                    | Dev (for `get_variable_defs`) | Dry-run report shows value deltas + semantic>global advisories vs baseline; re-baseline is explicit; CI path calls no MCP.                                     |
| **02b-D — Template Code Connect (F4) — BEFORE 2026-08-17** | Pattern doc; `/figma-codeconnect` (template scaffold → dry-run → approve → push → reconcile); migration checklist; retire any parser-based files.                                               | Dev                           | A Lumen component maps to its node via a **template file**; Dev Mode shows the snippet; no parser-based Code Connect remains; `mapsTo`/`buildStatus` updated.  |
| **02b-E — Design-QA / visual-regression (F5)**             | `/figma-visual-regression`; `design-qa-check` hook; visual-regression manifest; `/design-qa` + checklist; wire optional CI step for `built` nodes.                                              | View                          | A built route diffs green against its mirror render within threshold; baseline-stale is detected; re-baseline requires `--pull` + approval; CI calls no MCP.   |

> **Sequencing note.** 02b-D is **deadline-driven** (2026-08-17) — if the Code
> Connect write-back from `02 §8` is being implemented at all, do 02b-D **first
> among 02b phases**. 02b-A (glossary) should precede 02b-D so template mappings
> resolve names through the glossary. The rest (B, C, E) are independent and can
> land in any order after A.

---

## 10. MCP access-control compliance

Every command in `02b` is **Figma-MCP-gated** exactly as `.claude/CLAUDE.md`
requires: Figma MCP is called **only** inside a user-invoked `/figma*` command
(or an explicit NL Figma question after confirming intent), and **never**
auto-invoked during `/create-specifications`, `/create-epics`,
`/implement-epic`, `/add-*`, or any implementation/CI path.

- **F1 `/figma-glossary`** — reads the local mirror + `apps/web/src/`;
  `get_code_connect_map` only on explicit invocation.
- **F3 token-drift** — the **CI hook + baseline path read the local mirror only
  (no MCP)**; `get_variable_defs`/`get-lumen-css-tokens` run **only** inside the
  human-invoked `/figma-token-drift`.
- **F4 Code Connect** — the only feature that pushes; strictly
  dry-run→approve→push, code-side only, canvas never edited.
- **F5 visual-regression** — **CI reads the committed mirror `.png` only, calls
  no MCP**; re-baselining requires an explicit `/sync-figma --pull`.

The `02` two-timestamp staleness invariant and local-mirror-first rules are
preserved: no `02b` CI/hook path advances `lastSyncedAt`, and none re-pulls
Figma implicitly.

---

## 11. Decision log (this plan)

- **BD1** **Template-file Code Connect over the framework-specific parser** —
  parsers are EOL 2026-08-17; template files are the only maintained path. All
  Code Connect in the framework uses templates (F4); a migration command exists
  for legacy parser files.
- **BD2** **Glossary is the authoritative Figma↔Lumen name resolver** — the
  `02 §7` convention scan may only _propose_ `inferred` glossary entries; Code
  Connect maps and `verified` glossary entries are authoritative. Fixes the
  naming-asymmetry coverage gap (F1).
- **BD3** **DTCG + Style Dictionary is the token-transform stack** — Figma
  tokens normalize to DTCG (stable TR 2025.10), transform via Style Dictionary,
  diff against Lumen; detection/report only, never auto-rewrite (F3).
- **BD4** **Enforce semantic > global** — token-drift reports flag global-token
  usage where a semantic token exists; advisory, not a failure (F3).
- **BD5** **Handshake gate blocks `buildStatus: built`** — `/figma-to-lumen`
  requires `handshakeStatus === cleared` (or a logged `--override`); a11y spec
  is a handshake precondition (F2).
- **BD6** **Visual-regression compares against the local mirror only** — never
  re-pulls Figma in CI; re-baselining is explicit (`/sync-figma --pull` +
  approval); baseline-stale is detected via `renderHash` equality (F5).
- **BD7** **Token drift is detection, not mutation** — the pipeline never edits
  Figma and never auto-rewrites Lumen tokens; the human decides and re-baselines
  explicitly (F3).
- **BD8** **A new `design-system-analyst` subagent** — read/analyze-only for
  glossary/token/Code-Connect/coverage health; mutation stays in the gated
  `/figma-*` commands, keeping `figma-helper` lean (§7).
- **BD9** **All `02b` CI/hook paths are MCP-free** — Figma MCP is invoked only
  inside human-run `/figma*` commands; CI reads the local mirror (§10),
  preserving the `.claude/CLAUDE.md` access-control policy and the `02`
  local-mirror-first invariant.

> **Cross-plan coordination.** BD1's 2026-08-17 deadline is also recorded in
> `02`'s D20; BD2 is `02`'s D22; the two plans must stay in step. `02b` depends
> on `02` Phases 0–3 (mirror, index, helper, meta) being in place — implement
> `02` first, then layer `02b` per §9.
