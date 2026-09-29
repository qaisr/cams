---
description: >
  Author a template-file Code Connect mapping for one Figma node (Phase 6 / F4). Runs the 7-step
  flow RESOLVE→INSPECT→SCAFFOLD→DRY-RUN→APPROVE→PUBLISH→RECONCILE using the framework-agnostic
  `@figma/code-connect/html` mechanism (the React parser is retired 2026-08-17 — BD1/D20). Resolves
  the Lumen component name through the Phase-5 glossary (verified entry required), inspects props via
  `get_context_for_code_connect`, dry-runs the template for per-component human approval, publishes
  the mapping, then reconciles `componentRef`/`buildStatus` and reindexes so `/figma coverage` sees
  it. Figma MCP is called ONLY inside this `/figma*` command (Dev seat). Canvas never edited (D15).
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# /figma-codeconnect — template-file Code Connect for one node

## Input

`$ARGUMENTS` — a Figma node reference: a `/design/` URL (with `node-id`), or a bare node id
(colon `299:12006` or hyphen `299-12006` form), optionally the `fileKey`. `fileKey` defaults to the
pinned value in `.claude/config/figma-sync.config.yml`.

## Preconditions

1. **Mirror initialized** — `figma/.manifest.json` present and `figma/_index.json` exists (derived).
   If missing → tell the user to run `/figma-init` / `/figma reindex` and STOP.
2. **Dev seat** — Code Connect + `get_context_for_code_connect` require the Figma **Dev** seat.
3. **Deadline reminder** — the React parser is retired **2026-08-17**. This command authors
   **template files only** (`@figma/code-connect/html`); never the `@figma/code-connect/react` parser.
4. **MCP scope (BD9)** — the only MCP touch points are `get_context_for_code_connect`,
   `add_code_connect_map` / `send_code_connect_mappings`, and `get_code_connect_map`, and they run
   **only inside this command**. No hook or CI path calls them.

## The 7-step flow (§4.4)

### 1. RESOLVE — Figma node → Lumen component (glossary first, never guess)

Read `.claude/config/figma-lumen-glossary.json`. Resolve the node's Figma component name through the
authority ladder (`.claude/patterns/figma-code-connect-template-pattern.md`):

1. Existing Code Connect map (`get_code_connect_map`) — authoritative; if one already exists, this is
   a re-publish/update, not a new mapping.
2. glossary **`verified`** entry → use its `lumenComponent` + `lumenPath`.
3. glossary **`inferred`** entry → **STOP**. Promote it first via `/figma-glossary add <figmaName>
   <lumenPath>`, then re-run. An inferred name must never be published.
4. **no entry** → **STOP**. Route to `/figma-glossary suggest` / `add`.

Normalise the node id: **colon** form for JSON/sidecars, **hyphen** form for the URL you will write
into the template (D5).

### 2. INSPECT — read props/variants/descendant tree

Call `mcp__figma__get_context_for_code_connect` (Dev seat) for the node. Extract the **exact Figma
property names** and kinds (string / boolean / instance-swap / variant enum). Respect output-size
discipline — do not dump a full hi-fi frame; the structured component metadata is what you need.

### 3. SCAFFOLD — write a template file from the scaffold

Copy `.claude/templates/code-connect-template.ts` and fill it:

- `figma.connect('<design URL with hyphen node-id>', { … })`.
- `props`: one binding per inspected property — `figma.string('<Name>')` / `figma.boolean('<Name>')`
  / `figma.instance('<Name>')` / `figma.enum('<Name>', { … })`, using the **exact** names from step 2.
- `example`: `html\`<LumenComponent …props />\`` using the **glossary-resolved** component name.

Write it to the project's Code Connect source root (per `figma.config.json` when a live publish is
wired); otherwise present it in-session for the dry-run. Never write under `apps/web/` unless the
project's Code Connect root is there and the user has approved that location.

### 4. DRY-RUN — show the template + the mapping it will publish

Print the full template file and a plain-language summary of the mapping (`node 299:12006
"TopNavigationBars" → Lumen DefaultTopAppBarScaffold`, prop bindings listed). **Nothing is pushed.**

### 5. APPROVE — human, per-component

Fire `AskUserQuestion`: **[Publish this mapping / Edit the template first / Cancel]**. Publish only on
explicit approval. Each component approved individually — never bulk-publish silently.

### 6. PUBLISH — push the template-file mapping

On approval, publish via `mcp__figma__add_code_connect_map` (single) or
`mcp__figma__send_code_connect_mappings` (batch), passing the template. This annotates the Figma node
in Dev Mode — **it does not edit the canvas** (D15).

### 7. RECONCILE — write sidecar + reindex so coverage sees it

1. Re-pull `mcp__figma__get_code_connect_map` for the node to confirm the published mapping.
2. Write onto `figma/nodes/<slug>.meta.json`: `componentRef` (the Lumen component/path) and
   `buildStatus` (`built` once code exists + mapping published; otherwise the node's real state).
   Do **not** invent `handshakeStatus` — leave the Phase-5 gate field as-is.
3. Run `node_modules/.bin/tsx scripts/figma/reindex.ts --root .` (OFFLINE rollup; `--root` is the
   repo root, the script appends `figma/`). This refreshes `_index.json.mapsTo` / `buildCoverage`
   from the sidecar — the **top authority rung** `/figma coverage` + `/figma-glossary` already read.
4. **Do not move `lastSyncedAt`** — RECONCILE is not a content pull; reindex moves `generatedAt`
   only (two-timestamp invariant, D4). If step 2's field write is the only mirror change, that's fine.

## Guardrails

- **Template files only** — never the React parser (dead 2026-08-17).
- **Name comes from the glossary** (`verified`) — an `inferred`/absent entry STOPS the flow.
- **Canvas never edited** — a Code Connect map is metadata (D15).
- **Human approval before PUBLISH** — per component, no silent bulk publish.
- **MCP only inside this command** (Dev seat) — never in a hook or CI (BD9).
- **No `apps/web/` or `specs/` writes** beyond an approved Code Connect source root.

## Cross-references

- Pattern: `.claude/patterns/figma-code-connect-template-pattern.md`
- Scaffold: `.claude/templates/code-connect-template.ts`
- Migration: `.claude/commands/figma-codeconnect-migrate.md`
- Glossary: `.claude/commands/figma-glossary.md` + `.claude/config/figma-lumen-glossary.json`
- Coverage consumer: `.claude/commands/figma.md` (`/figma coverage`) + `figma-helper` §9
- Reindex: `scripts/figma/reindex.ts`
