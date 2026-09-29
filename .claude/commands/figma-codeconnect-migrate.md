---
description: >
  Migrate every framework-specific React Code Connect file (`@figma/code-connect/react`, `.figma.tsx`)
  to a framework-agnostic template file (`@figma/code-connect/html`) BEFORE Figma retires the React
  parser on **2026-08-17** (BD1/D20). Enumerates existing parser files, rewrites each as a template
  via the Phase-6 F4 mechanism, verifies the published mapping with `get_code_connect_map`, and
  reconciles the mirror. Figma MCP is called ONLY inside this `/figma*` command (Dev seat). Canvas
  never edited (D15).
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# /figma-codeconnect-migrate — React parser → template files (deadline 2026-08-17)

## Why this exists

Figma **retires the React Code Connect parser on 2026-08-17**. After that date, any
`@figma/code-connect/react` `.figma.tsx` file stops publishing and existing React-parser mappings
go stale. This command migrates them to the framework-agnostic template mechanism
(`@figma/code-connect/html`) that survives the retirement — the same mechanism `/figma-codeconnect`
authors for new nodes.

**Run this before 2026-08-17.** Today is well ahead of the deadline; the enumeration step below
tells you exactly how much (if any) work remains.

## Preconditions

Same as `/figma-codeconnect`: mirror initialized, Dev seat for MCP, MCP touch points confined to this
command (BD9). See `.claude/commands/figma-codeconnect.md`.

## Migration checklist

### 1. ENUMERATE — find every React-parser file

Search the repo for the React parser, offline (no MCP):

```
grep -rln "@figma/code-connect/react" --include="*.tsx" --include="*.ts" .
find . -name "*.figma.tsx" -not -path "*/node_modules/*"
```

Also list published React mappings via `mcp__figma__get_code_connect_map` per candidate node to see
what is live vs. what is only on disk. Produce a table: `file → figma node → Lumen component (from
glossary) → status (react-parser | template | unmapped)`.

> **Current repo state:** no `@figma/code-connect/react` files exist yet — this repo authors template
> files from the outset (Phase 6 F4). If ENUMERATE returns nothing, report "no migration required"
> and STOP. This command exists to guarantee that stays true and to handle any React-parser file that
> lands before the deadline.

### 2. RESOLVE — confirm each Lumen name via the glossary

For every enumerated node, re-resolve the Lumen component name through
`.claude/config/figma-lumen-glossary.json` (authority ladder in
`.claude/patterns/figma-code-connect-template-pattern.md`). Do **not** trust the component name
hardcoded in the old React file — a `verified` glossary entry (or live Code Connect map) is the
authority. An `inferred`/absent entry STOPS that node until promoted via `/figma-glossary add`.

### 3. REWRITE — author a template file per node

For each node, produce a template file from `.claude/templates/code-connect-template.ts`:

- Port `props` bindings, mapping React-parser prop helpers to the `html` equivalents
  (`figma.string/boolean/instance/enum/children`) using the **exact** Figma property names.
- Rewrite the `example` as an `html\`…\`` tagged template using the glossary-resolved component name.
- URL uses the **hyphen** node form; JSON/sidecars stay **colon** (D5).

Show each rewritten template in a **dry-run** and get **per-file human approval** (`AskUserQuestion`)
before publishing — mirroring `/figma-codeconnect` steps 4–5. Never bulk-migrate silently.

### 4. PUBLISH & RETIRE — publish template, remove the React file

On approval, publish the template mapping (`add_code_connect_map` / `send_code_connect_mappings`),
then delete the superseded `.figma.tsx` React-parser file. Publishing annotates the node in Dev Mode
only — **the canvas is never edited** (D15).

### 5. VERIFY — confirm the mapping is the template mapping

Re-pull `mcp__figma__get_code_connect_map` for each node and confirm the live mapping is the
template file (not the retired React parser). Any node still showing a React mapping is not migrated —
loop back to step 3.

### 6. RECONCILE — refresh the mirror

For each migrated node, run the standard RECONCILE (as in `/figma-codeconnect` step 7): write
`componentRef` + `buildStatus` onto `figma/nodes/<slug>.meta.json`, then
`node_modules/.bin/tsx scripts/figma/reindex.ts --root .`. Do not move `lastSyncedAt` (D4).

### 7. REPORT — migration summary

Emit the final table: files migrated, files retired, nodes verified on the template mapping, any
nodes still blocked (glossary gap / divergence). State plainly whether the repo is fully clear of the
React parser ahead of **2026-08-17**.

## Guardrails

- **Deadline: 2026-08-17.** No `@figma/code-connect/react` file may remain published past that date.
- **Template files only** on the way out — never re-introduce the React parser.
- **Names via the glossary** — never trust the old React file's hardcoded name.
- **Per-file human approval** before publish/retire — no silent bulk migration.
- **Canvas never edited** (D15); **MCP only inside this command** (Dev seat, BD9).
- **No `apps/web/` or `specs/` writes** beyond an approved Code Connect source root.

## Cross-references

- Command: `.claude/commands/figma-codeconnect.md` (7-step flow for new nodes)
- Pattern: `.claude/patterns/figma-code-connect-template-pattern.md`
- Scaffold: `.claude/templates/code-connect-template.ts`
- Glossary: `.claude/commands/figma-glossary.md`
- Reindex: `scripts/figma/reindex.ts`
