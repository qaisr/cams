# Pattern — Template-File Code Connect (`@figma/code-connect/html`)

> **Phase 6 / F4.** How this repo authors every Figma↔code mapping. Load when
> writing or migrating a Code Connect file. Consumed by `/figma-codeconnect` and
> `/figma-codeconnect-migrate`.

## Why template files (not the React parser)

Figma **retires the framework-specific React Code Connect parser on 2026-08-17**
(BD1 / D20). After that date, `@figma/code-connect/react` `.figma.tsx` files stop
publishing. Every mapping in this repo is therefore authored with the
**framework-agnostic template-file mechanism** — `@figma/code-connect/html` —
which is not tied to any UI framework and survives the parser retirement.

A template file is **metadata about a mapping**, not a component. It never renders
in the app, never ships in a bundle, and — critically — **never edits the Figma
canvas** (D15). Publishing a mapping only annotates the Figma node in Dev Mode
with "this maps to Lumen `DefaultTopAppBarScaffold`".

## The mechanism

```ts
import figma, { html } from '@figma/code-connect/html';

figma.connect(
  '<figma design URL with node-id in HYPHEN form>',
  {
    props: {
      // Figma property name (string, from get_context_for_code_connect) → binding
      title: figma.string('Title'),
      hasBackButton: figma.boolean('Has back button'),
      icon: figma.instance('Icon'), // nested instance-swap slot
    },
    example: (props) => html`<DefaultTopAppBarScaffold
      title=${props.title}
      hasBackButton=${props.hasBackButton}
    />`,
  },
);
```

### Prop-binding helpers

| Helper | Figma property kind | Yields |
|---|---|---|
| `figma.string('Name')` | text / variant enum | the string value |
| `figma.boolean('Name')` | boolean | `true` / `false` |
| `figma.instance('Name')` | instance-swap slot | a nested mapped component |
| `figma.enum('Name', { … })` | variant → mapped value | the mapped branch |
| `figma.children(['…'])` | nested layers | rendered children |

The **left-hand key** (`title`, `hasBackButton`) is the code prop; the **argument
string** (`'Title'`, `'Has back button'`) is the exact Figma property name as
returned by `get_context_for_code_connect`. Do not guess property names — read
them from the inspect step.

## Node-id form (D5)

- **URL** (the first arg to `figma.connect`): **hyphen** form — `node-id=299-12006`.
- **Everywhere in JSON** (`_index.json`, `<slug>.meta.json`, mirror sidecars):
  **colon** form — `299:12006`.

## Component name resolution — glossary first (never guess)

The component in the `html` example (`DefaultTopAppBarScaffold`) is **resolved
through `.claude/config/figma-lumen-glossary.json`**, not invented from the Figma
layer name. The Figma name (`TopNavigationBars`) is asymmetric to the Lumen name
(`DefaultTopAppBarScaffold`) — only the glossary knows the pair.

Resolution authority ladder (same order `/figma coverage` uses):

1. **Existing Code Connect map** (`get_code_connect_map`) — authoritative.
2. **glossary `verified`** entry — authoritative; use its `lumenComponent`.
3. **glossary `inferred`** entry — **STOP**; promote via `/figma-glossary add`
   first. An inferred name must not be published.
4. **no entry** — **STOP**; route to `/figma-glossary suggest` / `add`.

A template file is only scaffolded once the name resolves to a `verified` glossary
entry (or a live Code Connect map).

## Where mappings live & how coverage learns about them

- Template files live under a Code Connect source root (configured in the Figma
  project's `figma.config.json` when a real publish is wired). This repo authors
  them via `/figma-codeconnect`; the file is shown in a **dry-run** and only
  published after human approval.
- After PUBLISH, the RECONCILE step re-pulls `get_code_connect_map`, writes
  `componentRef` + `buildStatus` onto the node's `figma/nodes/<slug>.meta.json`,
  then runs `tsx scripts/figma/reindex.ts --root .`. The rollup refreshes
  `_index.json.mapsTo` / `buildCoverage`, which is the **top authority rung** that
  `/figma coverage` and `figma-helper` already read (Phase 5 §9).

## Hard boundaries

- **Template files only** — never `@figma/code-connect/react` (dead 2026-08-17).
- **Canvas never edited** — a mapping is metadata (D15).
- **MCP only inside `/figma-codeconnect`** (Dev seat) — never in a hook or CI (BD9).
- **Names come from the glossary**, never a raw layer-name guess.

## Cross-references

- Command: `.claude/commands/figma-codeconnect.md` (7-step flow)
- Migration: `.claude/commands/figma-codeconnect-migrate.md` (pre-2026-08-17)
- Scaffold: `.claude/templates/code-connect-template.ts`
- Glossary: `.claude/config/figma-lumen-glossary.json` + `.claude/commands/figma-glossary.md`
- Reindex rollup: `scripts/figma/reindex.ts`
