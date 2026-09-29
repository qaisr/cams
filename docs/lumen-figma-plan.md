# DaisyUI → Lumen Adoption + Figma Design Ingestion Plan

> **Status:** Plan / proposal — not yet implemented. **Author:** Brainstorming
> session, 2026-07-29. **Reviewed & corrected:** 2026-07-29 — every claim was
> verified against the live `.claude/` framework files, `apps/web/`, and the
> live Figma + Lumen MCP servers. Corrections are folded directly into the text
> below; this is the reconciled plan, not the original draft. Notable reversals
> from the first draft: there is **no existing DaisyUI component library to
> migrate** (the components directory is empty and untracked — this is a
> _build-on-Lumen_, not a _migrate_, effort); the Figma **access already works
> today** on a View seat for metadata/screenshots (only Dev-Mode code extraction
> is seat-gated); and the DaisyUI/wireframe blast radius is **~2–3× wider** than
> the first draft's file list. **Runs independently:** This plan is
> self-contained. It can be executed in a **brand-new Claude session** with no
> dependency on [`docs/jira-confluence-plan.md`](./jira-confluence-plan.md)
> (JIRA + Confluence). The only shared artifact is the traceability manifest
> `specs/sources/manifest.json`; this plan **adds Figma entries** to it but does
> not require the JIRA/Confluence work to have shipped.
>
> **Why this is a separate plan.** Two things make this track bigger and riskier
> than the JIRA/Confluence integration, so they are bundled here on purpose:
>
> 1. **Removing DaisyUI and adopting Lumen** touches the framework's UI
>    standards, the (still-empty) Storybook component library, the design-token
>    registry, and the whole HTML-wireframe pipeline — a wide blast radius
>    across `.claude/` **and** `apps/web/`. The app itself is greenfield (no
>    components built yet), so the risk lives almost entirely in the _framework
>    guidance_, not in existing UI.
> 2. **Figma ingestion** uses the Figma MCP, which **already works today** on
>    the current View seat for the cheap pipelines (metadata + screenshots).
>    Only Dev-Mode code extraction (`get_design_context`, Pipeline C) is gated
>    behind a Dev/Full seat. Ingestion pays off most once the UI system is
>    Lumen-based, because the hi-fi screens are being designed to be **highly
>    Lumen-compatible**.
>
> Sequencing them together in one independent session avoids half-migrated UI
> state.

---

## 1. Context & Problem Statement

### 1.1 What changed

- **No screens are designed yet, and no components are built yet.**
  `apps/web/src/components/` is **empty and untracked** — `component-usage.md`
  states outright that "the CANS platform ships **no components**." So this is a
  _build-on-Lumen-from-the-start_ effort, **not a migration of existing DaisyUI
  components** (there are none). The only DaisyUI that actually exists in the
  app is the `@plugin 'daisyui'` line in `globals.css` and the `package.json`
  dependency. This makes the UI-library switch low-risk on the product side
  (nothing to visually regress) — the real work is stopping the _framework_ from
  steering Claude toward DaisyUI and the HTML-wireframe pipeline.
- **The team is standardising on Lumen** (PPCC's design system, available via
  the **Lumen MCP** — `list-lumen-components`,
  `get-lumen-component-documentation`, `get-lumen-css-tokens`,
  `explore-lumen-components`). Lumen is a **React component library** (Box,
  Flex, Grid, Heading, Text, Button, Dialog, Table, …) mounted under a required
  **`LumenProvider`** root — it is _not_ a Tailwind utility layer, so adopting
  it is materially different from swapping one Tailwind plugin for another. The
  designer will produce **hi-fi UI screens in Figma that are highly compatible
  with Lumen**.
- Therefore the framework must: **remove all DaisyUI guidance**, **add
  equivalent Lumen guidance where DaisyUI used to be referenced**, **remove the
  HTML-based wireframe pipeline** (no longer aligned with how this project
  designs), and **add a Figma → specs / Figma → Lumen-code pipeline**.

### 1.2 Current framework coupling to DaisyUI / HTML wireframes (to be removed/replaced)

DaisyUI and HTML wireframes are referenced across the framework and app. The
adoption must find and address every reference. **Verified blast radius** (live
`grep` at review time — larger than the first draft assumed):

- **DaisyUI** appears in **~10 `.md` framework files**, both `CLAUDE.md` files
  (root mentions it in **two** places), and `apps/web` (`globals.css` +
  `package.json`).
- **"wireframe"** appears in **~29 `.md` files** plus the `.claude/wireframes/`
  directory and the functional-spec **template**.

| Area                                                                                                                               | Current state                                                                                                                                                            | Target                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Root `CLAUDE.md` "UI Library" critical rule + monorepo comment (**2 mentions**)                                                    | "Tailwind, DaisyUI" / "TailwindCSS + DaisyUI"                                                                                                                            | "Tailwind + **Lumen**" (DaisyUI removed)                                   |
| `.claude/CLAUDE.md` critical constraints ("UI Library" row)                                                                        | "Tailwind, DaisyUI"                                                                                                                                                      | Lumen listed; DaisyUI removed                                              |
| `apps/web/app/globals.css`                                                                                                         | `@plugin 'daisyui';` (Tailwind v4 CSS-first)                                                                                                                             | Lumen provider/styles; `@plugin 'daisyui'` line removed                    |
| `apps/web/package.json`                                                                                                            | `"daisyui": "^5.6.13"` dep                                                                                                                                               | removed; Lumen packages added                                              |
| `apps/web/src/components/` (Storybook library)                                                                                     | **empty / untracked — no components exist yet**                                                                                                                          | Lumen-based components built here                                          |
| `.claude/standards/ui-design-standards.md`, `component-usage.md`, `storybook-standards.md`, `component-architecture.md`            | DaisyUI theming/patterns                                                                                                                                                 | Lumen tokens/patterns                                                      |
| `.claude/standards/design-tokens.md`                                                                                               | tokens sourced from "DaisyUI theme" (`--color-primary`, `--color-base-100`); **auto-augmented** by `/wireframes-to-storybook`, `/design-system-setup`, `/ui-apply-theme` | re-source from Lumen tokens; sever the wireframe-command auto-augmentation |
| `.claude/config/ui-themes.json`                                                                                                    | DaisyUI theme config                                                                                                                                                     | Lumen tokens/theming                                                       |
| `.claude/wireframes/` + `.generated-manifest.json` + `/wireframes-to-components` + `/wireframes-to-storybook` (**~41 KB command**) | HTML wireframe pipeline                                                                                                                                                  | **Removed** (Figma is the design input)                                    |
| `.claude/docs/component-library.md`, `.claude/workflows/storybook-development.md`                                                  | DaisyUI patterns                                                                                                                                                         | Lumen patterns                                                             |
| `.claude/templates/functional-specifications.md`                                                                                   | screen table has a **`.claude/wireframes/[file]` "Wireframe" column**                                                                                                    | replace column with a Figma-node reference                                 |
| `.claude/commands/create-epics.md`, `create-epic-tasks.md`, `.claude/workflows/epic-based-development.md`                          | reference wireframes as design input                                                                                                                                     | reference Figma nodes instead                                              |

> **This plan still does not enumerate every file blindly** — Phase 1 begins
> with a discovery sweep (`grep -rli daisyui .`, `grep -rli wireframe .`) to
> produce the authoritative, complete removal/rewrite list before any edits. The
> counts above are the review-time floor, not a promise of exactness.

### 1.3 Constraints carried over from the framework

| Constraint                                     | Implication for this plan                                                                                                                                                                                                         |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lumen only** (new) — DaisyUI removed         | All new components use Lumen; check the Lumen MCP before hand-rolling anything. `LumenProvider` must wrap the app root (Phase 0).                                                                                                 |
| Reuse-before-create (Storybook library)        | New Lumen components live in `apps/web/src/components/` (currently empty); check there first before creating                                                                                                                      |
| Sensitive-data guard (mode C)                  | Figma content (screen labels, sample data in mockups) de-identified before it lands in specs/repo. The seeded frames use real-sounding entity/onboarding labels — **de-identify before landing anything in git or the manifest**. |
| Token efficiency (Claude tokens)               | Figma ingestion is **node-scoped + `depth`-capped + lazy** — never pull whole files; a single node has been observed to return **~767 KB**, so persist output and cap subtree depth (§2.4)                                        |
| Install latest stable; verify with `pnpm view` | Applies to all Lumen package installs                                                                                                                                                                                             |
| MCP registration                               | `.mcp.json` **does not currently exist** in the repo — registering the Figma and Lumen MCP servers is an explicit Phase-0 prerequisite (see §4.3)                                                                                 |
| Never edit generated files                     | Unchanged                                                                                                                                                                                                                         |

### 1.4 The two Figma links (seeded into the manifest now)

Figma access **already works today** on the current PPCC View seat:
`get_metadata` and `get_screenshot` on these nodes were verified during review.
That covers Pipelines A and B in full. The one gap is **Dev-Mode code
extraction** (`get_design_context`, Pipeline C), which is gated behind a
**Dev/Full seat** — so only the hi-fi-to-Lumen codegen step (§2.2 C, Phase 4)
waits on a seat upgrade. The links are recorded in the manifest so all ingestion
can begin immediately:

| Purpose                                                 | Figma URL                                                                                        | fileKey                  | node        | Usable now?                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------ | ----------- | ----------------------------------------------------------- |
| Entity Onboarding v2 (Future-State Exploration) — hi-fi | `https://www.figma.com/design/2MbwX0rxNA1uhgDwlC7Z6G/Future-State-Exploration?node-id=484-10425` | `2MbwX0rxNA1uhgDwlC7Z6G` | `484-10425` | Metadata/screenshot ✅; `get_design_context` needs Dev seat |
| Mid-Fi e2e Flow                                         | `https://www.figma.com/design/2MbwX0rxNA1uhgDwlC7Z6G/Future-State-Exploration?node-id=299-12006` | `2MbwX0rxNA1uhgDwlC7Z6G` | `299-12006` | Metadata/screenshot ✅                                      |

> **Both links are `/design/` files, not FigJam `/board/` files.** This matters
> for tool selection (§2.2): `get_figjam` only works on `/board/` URLs and will
> fail on these — use `get_metadata` / `get_screenshot` / `get_design_context`
> instead.

---

## 2. Design Decisions (with rationale)

### 2.1 Decision: Lumen replaces DaisyUI; HTML wireframe pipeline is removed

- **DaisyUI is removed, not layered.** Keeping both invites drift and lets
  Claude pick the wrong one. The critical-constraint "UI Library" rule flips to
  Lumen, and every DaisyUI reference (10+ `.md` files, both `CLAUDE.md`s,
  `globals.css`, `package.json`) is either deleted or rewritten to its Lumen
  equivalent.
- **Tailwind stays; DaisyUI goes.** The decision is: **keep Tailwind for layout
  utilities, adopt Lumen for components and design tokens.** Lumen components
  carry their own styling under `LumenProvider`, so the two coexist cleanly —
  Tailwind handles spacing/grid glue, Lumen owns the component surface. This is
  deliberately stated so Phase-1 rewrites don't accidentally strip Tailwind
  along with DaisyUI.
- **HTML wireframes are removed** (`.claude/wireframes/`, its manifest,
  `/wireframes-to-components`, and `/wireframes-to-storybook`). The design input
  for this project is **Figma**, so the HTML-wireframe precedence machinery is
  dead weight that would confuse the UI protocol. The UI protocol, the
  functional-spec template's "Wireframe" column, and the epic commands are
  rewritten to reference **Figma + the Lumen library** as the authoritative
  inputs.
- **`design-tokens.md` needs a migration path, not just deletion.** It currently
  sources tokens from the DaisyUI theme and is auto-augmented by three commands
  (`/wireframes-to-storybook`, `/design-system-setup`, `/ui-apply-theme`) — two
  of which touch the wireframe pipeline being removed. Re-point it at Lumen
  tokens (`get-lumen-css-tokens`) and sever the wireframe-command
  auto-augmentation so the registry isn't orphaned.
- **Equivalent Lumen features are added where DaisyUI provided one** — theming
  tokens, component-usage guidance, Storybook standards — so the framework
  remains just as prescriptive, only pointed at Lumen.

### 2.2 Decision: Figma is three distinct pipelines, priced by token cost and seat tier

Not all Figma content is equal. Treat it as three pipelines with escalating
cost, so cheap wins ship first and expensive hi-fi work stays scoped:

| Pipeline                   | Source in Figma                                                                                    | Target                                                           | Token cost    | Seat         | MCP tools                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------- | ------------ | ----------------------------------------------------------------------------------- |
| **A. Flows & journeys**    | Flow/journey frames within the `/design/` file (or a genuine FigJam `/board/` file, if one exists) | Mermaid → `specs/*`                                              | **Cheap**     | View ✅      | `get_metadata` (+ `generate_diagram`); `get_figjam` **only** for `/board/` URLs     |
| **B. Wireframes / mid-fi** | Frames like the Mid-Fi e2e flow (node `299-12006`)                                                 | Distilled structure → spec sections / component inventory        | **Moderate**  | View ✅      | `get_metadata`, `get_screenshot`                                                    |
| **C. Hi-fi screens**       | Hi-fi frames (e.g. Entity Onboarding v2, node `484-10425`)                                         | **Lumen** React components in `apps/web/src/components/` + pages | **Expensive** | **Dev/Full** | `get_design_context`, `get_screenshot`, `get_variable_defs`, `get_code_connect_map` |

Rationale: flows are almost free and improve specs immediately; hi-fi codegen is
the costly step and must be **node-scoped and lazy** (§2.4). **Tool caveat:**
the two seeded links are `/design/` files, so Pipeline A uses `get_metadata`
(not `get_figjam`, which is `/board/`-only). The mid-fi node (`299-12006`) is
largely **embedded raster screenshots**, which limits structured extraction —
expect Pipeline B to lean on `get_screenshot` + human reading rather than clean
node trees.

### 2.3 Decision: Hi-fi codegen is design-system-first, with a visual-diff gate

The tension: designers want **pixel-exact**; the framework wants **design-system
consistency** (reuse Lumen, don't hand-roll one-off styles). Resolution:

> **System-first, then verify with a visual diff.**
>
> 1. Generate the screen by **composing existing Lumen components** (via the
>    Lumen MCP) — not raw CSS transcribed from Figma.
> 2. Map Figma variables/tokens to **Lumen tokens** (`get_variable_defs` →
>    `get-lumen-css-tokens`). Only create a new token/component when Lumen has
>    no equivalent (then it goes into the Storybook library, reusable).
> 3. **Visual-diff gate:** screenshot the implemented screen (Playwright) and
>    the Figma node (`get_screenshot`); a human reviews the diff and approves.
>    Because the designer is building **Lumen-compatible** hi-fi, this diff
>    should be small by construction.

This keeps output consistent and reusable while giving the designer a concrete
fidelity check.

### 2.4 Decision: Figma ingestion is node-scoped and lazy (token discipline)

- Adapters accept a **fileKey + nodeId** and pull only that subtree — never a
  whole Figma file into context.
- **Node-scoped is not automatically cheap.** During review, `get_metadata` on a
  single node returned **~767 KB** of output. So the adapters must (a) pass a
  **`depth` cap** to `get_metadata`, (b) rely on the MCP's **persisted-output**
  file path rather than inlining the payload into the prompt, and (c) drill down
  by child-node id rather than pulling a deep frame in one call.
- Hi-fi codegen is invoked **per screen on demand**, not batch-run across the
  file.
- The manifest stores the Figma pointers (fileKey/node/version); `get_metadata`
  is used to cheaply detect which nodes changed before any expensive
  `get_design_context`.

### 2.5 Decision: Code Connect ties Lumen components back to Figma (optional, later)

Once components exist, `add_code_connect_map` links each Figma component to its
Lumen React implementation so future design-to-code is deterministic. This is a
**nice-to-have final polish**, not a blocker.

---

## 3. Target Architecture

```text
                     ┌───────────────────────────────────────────────┐
   DESIGN SOURCE      │  Figma (Future-State-Exploration)              │
                      │  flows/journeys   wireframes   hi-fi screens    │
                      └──────┬─────────────────┬──────────────┬────────┘
                        Figma MCP          Figma MCP        Figma MCP
                             │                 │                │
   FIGMA PIPELINES    ┌──────▼──────┐  ┌───────▼──────┐  ┌──────▼───────────┐
                      │ A. flows →   │  │ B. wireframes│  │ C. hi-fi screens │
                      │   Mermaid    │  │  → structure │  │  → Lumen code    │
                      └──────┬──────┘  └───────┬──────┘  └──────┬───────────┘
                             │                 │                │
                   specs/*.md (flows)   spec sections    apps/web/src/components/
                             │                 │          + pages (Lumen)
                             └─────────────────┴──────┬─────────┘
                                                       │
   LUMEN SYSTEM        ┌───────────────────────────────▼──────────────────┐
   (replaces DaisyUI)  │ Lumen MCP: components + tokens                    │
                       │ Storybook library (apps/web/src/components/)      │
                       │ Framework UI standards rewritten DaisyUI → Lumen  │
                       │ HTML wireframe pipeline REMOVED                   │
                       └───────────────────────────────┬──────────────────┘
                                                        │
   FIDELITY GATE                          Playwright screenshot ⟷ Figma get_screenshot
                                                  (human-approved visual diff)

   TRACEABILITY        specs/sources/manifest.json  (Figma pointers: fileKey/node/version)
```

---

## 4. New / Changed Framework Artifacts

### 4.1 Removals (DaisyUI + HTML wireframes)

| Artifact                                                                                                                                                                                                                                                                                  | Action                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"daisyui": "^5.6.13"` in `apps/web/package.json`                                                                                                                                                                                                                                         | Remove the dependency (note: drifted from the `^5.5.20` pin recorded in root `CLAUDE.md` — both must be corrected)                                              |
| `@plugin 'daisyui';` in `apps/web/app/globals.css`                                                                                                                                                                                                                                        | Remove the line. **This is Tailwind v4 CSS-first config — there is no `tailwind.config.*` file and no JS plugin entry to edit.** Keep `@import 'tailwindcss';`. |
| `apps/web/src/components/`                                                                                                                                                                                                                                                                | **Nothing to remove — the directory is empty.** Build Lumen components here (Phase 2), don't "convert" anything.                                                |
| `.claude/wireframes/` (empty dir, no manifest present) + `/wireframes-to-components` + `/wireframes-to-storybook`                                                                                                                                                                         | Remove                                                                                                                                                          |
| Wireframe-precedence rules in `component-usage.md`, `frontend-ui-protocol.md`, `ui-design-workflow.md`; `.claude/wireframes/[file]` column in the `functional-specifications.md` template; wireframe references in `create-epics.md`, `create-epic-tasks.md`, `epic-based-development.md` | Rewrite (Figma is the design input)                                                                                                                             |
| DaisyUI references in `ui-design-standards.md`, `component-library.md`, `storybook-standards.md`, `component-architecture.md`, `storybook-development.md`, `design-tokens.md`, `ui-themes.json`, and **both** `CLAUDE.md` files (root has **2** mentions)                                 | Remove / rewrite to Lumen                                                                                                                                       |

### 4.2 New commands

| Command                                       | Purpose                                                                                                                                         | MCP                                                          | Token profile                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------- |
| `/ingest-figma-flow <url\|fileKey+node>`      | Pipeline A: flow/journey frame → Mermaid → spec section; register Figma source in manifest                                                      | Figma (`get_metadata`; `get_figjam` only if a `/board/` URL) | Cheap                         |
| `/ingest-figma-wireframe <url\|fileKey+node>` | Pipeline B: wireframe/mid-fi frame → distilled structure + component inventory                                                                  | Figma (`get_metadata`,`get_screenshot`)                      | Moderate                      |
| `/figma-to-lumen <url\|fileKey+node>`         | Pipeline C: hi-fi node → Lumen component(s)/page, system-first + visual-diff gate. **Requires a Figma Dev/Full seat** for `get_design_context`. | Figma + Lumen                                                | Expensive (node-scoped, lazy) |

### 4.3 New / changed supporting files

| File                                                                                                                                     | Purpose                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.mcp.json` (repo root)                                                                                                                  | **New / create.** Does not currently exist. Register the **Figma** and **Lumen** MCP servers here so the pipelines are reachable in a fresh session. (CEB, Context7, Playwright are already documented in `.claude/CLAUDE.md`; consolidate all servers here.) |
| `.claude/patterns/figma-to-lumen-pattern.md`                                                                                             | **New.** Canonical rules: node-scoped + `depth`-capped fetch, persisted-output discipline, Figma-token → Lumen-token mapping, system-first composition, visual-diff gate, `/board/`-only `get_figjam` caveat, Dev-seat requirement for `get_design_context`.  |
| `apps/web` app root (`app/layout.tsx` or providers)                                                                                      | **New.** Wrap the app in **`LumenProvider`** — prerequisite for any Lumen component to render.                                                                                                                                                                |
| `.claude/standards/design-tokens.md`                                                                                                     | **Rewrite** — re-source tokens from Lumen (`get-lumen-css-tokens`); remove DaisyUI theme sourcing; sever auto-augmentation by the deleted wireframe commands.                                                                                                 |
| `.claude/standards/ui-design-standards.md`                                                                                               | **Rewrite** DaisyUI → Lumen.                                                                                                                                                                                                                                  |
| `.claude/standards/component-usage.md`                                                                                                   | **Rewrite** — Lumen reuse-before-create; remove wireframe precedence; add Figma-as-input.                                                                                                                                                                     |
| `.claude/standards/storybook-standards.md` + `.claude/patterns/component-architecture.md` + `.claude/workflows/storybook-development.md` | **Rewrite** DaisyUI patterns → Lumen.                                                                                                                                                                                                                         |
| `.claude/workflows/frontend-ui-protocol.md` + `ui-design-workflow.md`                                                                    | **Rewrite** — Figma + Lumen inputs; remove HTML-wireframe steps.                                                                                                                                                                                              |
| `.claude/templates/functional-specifications.md`                                                                                         | **Rewrite** the screen-table "Wireframe" column → Figma-node reference.                                                                                                                                                                                       |
| `.claude/config/ui-themes.json`                                                                                                          | **Rewrite** to Lumen tokens.                                                                                                                                                                                                                                  |
| Root `CLAUDE.md` (2 DaisyUI mentions) + `.claude/CLAUDE.md`                                                                              | **Edit** UI-Library constraint → Lumen; fix the DaisyUI version note; drop DaisyUI/wireframe lazy-load rows; add Figma pipeline rows.                                                                                                                         |
| `specs/sources/manifest.json`                                                                                                            | **Add** the two Figma entries (fileKey `2MbwX0rxNA1uhgDwlC7Z6G`, nodes `484-10425`, `299-12006`) — **de-identified labels only**. Shared with the JIRA/Confluence plan but not dependent on it.                                                               |
| `apps/web` Lumen packages                                                                                                                | **Install latest stable** via Lumen MCP guidance / `pnpm --filter @repo/web add <pkg>@latest` (verify with `pnpm view` first).                                                                                                                                |

---

## 5. Phased Delivery Plan

### Phase 0 — Discovery, MCP registration & Lumen foundation (0.5–1 day)

- **Discovery sweep:** `grep -rli daisyui .`, `grep -rli wireframe .` →
  authoritative removal/rewrite list; confirm Lumen MCP reachable
  (`list-lumen-components`) and Figma MCP reachable (`get_metadata` on node
  `299-12006` — verified working on the current View seat during review).
- **Create `.mcp.json`** registering the Figma + Lumen MCP servers (does not
  exist yet).
- Install Lumen packages in `apps/web` (latest stable, `pnpm view`-verified) and
  wrap the app root in **`LumenProvider`**.
- Add the two Figma entries to `specs/sources/manifest.json` (de-identified
  labels).

**Exit:** removal list produced; `.mcp.json` present with Figma + Lumen; Lumen
available in `apps/web` under `LumenProvider`; Figma pointers in manifest.

### Phase 1 — Remove DaisyUI + HTML wireframes from the framework

- Execute the removal list (§4.1): strip DaisyUI deps/config/classes; delete the
  HTML-wireframe pipeline; rewrite UI standards/protocol/themes to Lumen.
- Rewrite the "UI Library" critical constraint in both `CLAUDE.md` files.

**Exit:** `grep -ri daisyui` and `grep -ri wireframe` return only intentional
historical mentions; framework steers Claude to Lumen exclusively; `pnpm build`

- `pnpm lint` + `pnpm type-check` green.

### Phase 2 — Lumen component library

- **Build** `apps/web/src/components/` on Lumen from scratch (the directory is
  currently empty); add Storybook stories per the (rewritten) storybook
  standards; build in accessibility from the start.

**Exit:** the Storybook library is Lumen-based; components pass a11y + component
tests.

### Phase 3 — Figma flows & wireframes (Pipelines A & B) — _works on current View seat_

- Build `/ingest-figma-flow` and `/ingest-figma-wireframe`.
- Ingest the **Mid-Fi e2e Flow** (`299-12006`) → flow diagram + structure into
  specs. (Node is mostly raster screenshots, so expect screenshot-led
  extraction, §2.2.)

**Exit:** Figma flows/wireframes enrich `specs/*`, de-identified, manifest
updated. **No seat upgrade required** — this phase can start immediately.

### Phase 4 — Figma hi-fi → Lumen (Pipeline C) — _needs Figma Dev/Full seat_

- Build `/figma-to-lumen` (system-first + visual-diff gate, §2.3).
- Generate the **Entity Onboarding v2** screen (`484-10425`) as Lumen
  components/page.
- (Optional) `add_code_connect_map` to link components back to Figma.

**Blocker:** `get_design_context` (Dev Mode) requires a **Dev/Full Figma seat**
— the _only_ part of this plan gated on a seat upgrade. Everything else runs
today.

**Exit:** at least one hi-fi screen implemented in Lumen, visual-diff approved.

### Phase 5 — Human workflow guide (documentation)

The final step of implementing this plan is to write a **human-facing guide**:

- Create **`docs/Figma-workflow-guide.md`** covering:
  - The three Figma pipelines (flows / wireframes / hi-fi) and when to use each
    (§2.2).
  - **How to ingest a flow** (`/ingest-figma-flow <url>`) with the Mid-Fi
    example.
  - **How to ingest a wireframe** (`/ingest-figma-wireframe <url>`).
  - **How to generate a Lumen screen from hi-fi** (`/figma-to-lumen <url>`),
    including the system-first rule and how the **visual-diff approval** works.
  - The **Lumen-first rule**: check the Lumen library/MCP before hand-rolling
    UI; reuse Storybook components; how Figma tokens map to Lumen tokens.
  - How to get a node-specific Figma URL (right-click → Copy link to selection)
    so ingestion stays **node-scoped** (token discipline).
  - A note that **DaisyUI and HTML wireframes are gone** — do not reintroduce
    them.

**Exit:** `docs/Figma-workflow-guide.md` exists; a designer/engineer can follow
it to ingest a Figma node and produce a Lumen screen.

---

## 6. Token-Cost Strategy (summary)

| Lever                       | Rule                                                                     |
| --------------------------- | ------------------------------------------------------------------------ |
| **Node-scoped Figma fetch** | Always pull a single fileKey+node subtree, never a whole file            |
| **Lazy hi-fi codegen**      | `/figma-to-lumen` runs per screen on demand, not batch                   |
| **Cheap-first pipelines**   | Flows (A) and wireframes (B) ship value before expensive hi-fi (C)       |
| **Metadata before context** | `get_metadata` to detect changed nodes before `get_design_context`       |
| **System-first**            | Compose Lumen components (small prompts) instead of transcribing raw CSS |

---

## 7. Open Questions / Decisions (resolved this session)

1. **DaisyUI** — ✅ **Removed entirely** (dep + `globals.css` `@plugin` + 10+
   docs), replaced by Lumen everywhere it was referenced. Tailwind is **kept**
   for layout.
2. **HTML wireframes** — ✅ **Removed**; Figma is the design input.
3. **Design fidelity vs consistency** — ✅ **System-first + visual-diff gate**
   (§2.3); the designer builds Lumen-compatible hi-fi, keeping diffs small.
4. **Figma token cost** — ✅ **Node-scoped + `depth`-capped + lazy** (§2.4) — a
   single node was observed at ~767 KB, so this is a real discipline, not a
   formality.
5. **Figma access** — ✅ **Works today on the View seat** for Pipelines A & B;
   only Pipeline C (`get_design_context`) waits on a Dev/Full seat.
6. **App state** — ✅ **Greenfield build**, not a migration:
   `apps/web/src/components/` is empty; there are no DaisyUI components to
   convert.
7. **Independence** — ✅ Runnable as a standalone Claude session; only shares
   the manifest file with the JIRA/Confluence plan.

---

## 8. Recommended First Step

1. **Phase 0 + Phase 1 first** — these need **no Figma seat upgrade** and remove
   the biggest source of framework drift (DaisyUI + HTML wireframes). Ship them
   now.
2. **Phase 2** — build the Lumen component library from scratch.
3. **Phase 3** — begin **immediately**; Pipelines A & B work on the current View
   seat (verified). The manifest already points at the two nodes.
4. **Phase 4** — begin the moment the **Dev/Full Figma seat** lands (only
   `get_design_context` is gated).
5. **Phase 5** — write `docs/Figma-workflow-guide.md`.

> **This document is a plan only. No framework files have been modified.**
