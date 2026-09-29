---
description: Detect drift between Figma design tokens and Lumen-consumed tokens (detection only — never auto-writes)
argument-hint: (no arguments)
allowed-tools: Read, Grep, Glob, Bash, AskUserQuestion, mcp__figma__get_variable_defs, mcp__lumen__get-lumen-css-tokens
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# /figma-token-drift

**Detect token drift between the Figma design tokens and the Lumen tokens the code
actually consumes.** DETECTION ONLY — this command **never** rewrites a token, a
Lumen config, or the committed baseline (BD4 / D21). It surfaces the delta so a
human can decide.

> **MCP discipline (BD9).** This is a `/figma*` command, so the two MCP reads below
> are permitted **only when the user invokes this command**: `get_variable_defs`
> (Figma Dev seat, step 1) and `get-lumen-css-tokens` (Lumen, step 4). Every other
> step is offline. The `.claude/hooks/token-drift-check` advisory hook and any CI
> path run the **mirror only** and call **no MCP**.

---

## Inputs on disk

| Path | Role | Committed? |
|---|---|---|
| `figma/tokens/figma-tokens.json` | Current Figma token export, DTCG shape. Refreshed by **step 1**. | Yes |
| `figma/tokens/.baseline.dtcg.json` | Last **human-accepted** Figma token baseline. Compared in step 2. | Yes |
| `.claude/config/style-dictionary.config.js` | Style Dictionary config (source → resolved CSS vars). | Yes |
| `.claude/.token-drift/` | Style Dictionary build output — resolved snapshot. | **No** (gitignored, regenerable) |
| `scripts/token-drift.ts` | Pure diff/classify engine (offline, importable, `--selftest`). | Yes |

Node id form: **hyphen in Figma URLs** (`299-12006`), **colon in JSON** (`299:12006`) — D5.

---

## The 8-step pipeline

### 1. EXPORT — refresh the Figma token export (MCP, this command only)
Call `mcp__figma__get_variable_defs` (Figma **Dev seat**) for the design's variable
collections. Normalize the returned variables into DTCG form (`$value` / `$type`,
groups nested) and write them to `figma/tokens/figma-tokens.json`.

- This is the **only** step that touches Figma. If the user declines the MCP call or
  is offline, SKIP this step and run the pipeline against the **committed**
  `figma-tokens.json` already on disk — say so explicitly in the report.
- Never invent tokens. Only what `get_variable_defs` returns is written.

### 2. NORMALIZE + baseline diff (offline)
Load `figma/tokens/figma-tokens.json` and `figma/tokens/.baseline.dtcg.json`. Using
`flattenDtcg()` + `diffTokens()` from `scripts/token-drift.ts`, compute what changed
**in Figma since the last accepted baseline**. Report this as the "since-baseline"
section. Do **not** rewrite the baseline — a human refreshes it after accepting a
design change (see STOP, step 8).

### 3. BUILD — resolve the Figma tokens (offline)
Run Style Dictionary to resolve the DTCG source into a flat, comparable set:

```bash
node_modules/.bin/style-dictionary build --config .claude/config/style-dictionary.config.js
```

Output lands in `.claude/.token-drift/` (gitignored). This is a throwaway snapshot —
never committed, never hand-edited.

### 4. READ Lumen tokens (MCP, this command only)
Call `mcp__lumen__get-lumen-css-tokens` to read the tokens **Lumen actually
consumes**. Normalize the returned CSS variables into the same flat DTCG shape
(strip the `lmn`/`--` prefix so paths align with the Figma side; `$type` inferred
from the value — color / dimension / typography / string).

- If the user declines the Lumen MCP call or is offline, read a **Lumen token
  snapshot on disk** if one exists (same file the advisory hook reads); otherwise
  STOP and tell the user the Lumen side is unavailable — do not fabricate it.

### 5. DIFF — Figma-derived vs Lumen-consumed (offline)
Feed both flat sets to `diffTokens()`. Four buckets:

- **added** — declared in Figma, not consumed by Lumen
- **removed** — consumed by Lumen, not declared in Figma
- **valueChanged** — same path & `$type`, different `$value`
- **typeChanged** — same path, different `$type` (checked before value, never
  double-counted)

### 6. CLASSIFY — semantic vs global/primitive (offline)
`classifyDrift()` tags each entry via `classifyTier()`:

- **global** — raw value scales: `palette.*`, `primitive(s).*`, `global(s).*`,
  `ref/reference.*`, `scale.*`, or a trailing numeric leaf (`color.blue.500`).
- **semantic** — everything else (`color.primary.default`, `text.body`,
  `surface.raised`). **Default is semantic** (conservative — D21 prefers semantic,
  so drift is never silently down-ranked).

Semantic drift ranks **higher-severity** than global-only drift.

### 7. REPORT — human-readable drift report (offline)
Emit a report the user can act on. Follow the four buckets + two tiers. Recommended shape:

```
Token drift — Figma ⟷ Lumen                 (generated <ISO>, source: <live MCP | committed mirror>)

Since accepted baseline (figma-tokens.json vs .baseline.dtcg.json):
  <n> changed  — <list, or "none">

Figma ⟷ Lumen drift:
  SEMANTIC  (higher severity)
    valueChanged  color.primary.default   figma #1e1e1e   lumen #000000
    added         color.tertiary.default  figma #faec20   (not in Lumen)
    removed       color.legacy.default     lumen #cccccc   (not in Figma)
  GLOBAL / primitive (lower severity)
    added         color.blue.500          figma #0000ff   (not in Lumen)

Summary: total <N>  |  semantic <s>  global <g>  |  semantic drift present: yes/no
```

Use `summarize()` for the counts and the `hasSemanticDrift` flag. Keep it plain
text; no color-writes, no file mutations.

### 8. STOP — never auto-rewrite
This command **stops at the report**. It does **not**:
- rewrite `figma-tokens.json`, `.baseline.dtcg.json`, or any Lumen config/token file
- edit the Figma canvas (D15)
- open a PR or stage changes

To act on the drift, a **human** decides and then may:
- refresh the baseline (`.baseline.dtcg.json`) after accepting a design change, or
- adjust the Lumen token consumption in code, or
- route a mapping gap to `/figma-glossary add` / `/figma-codeconnect`.

---

## Offline proof
```bash
tsx scripts/token-drift.ts --selftest   # four diff buckets + semantic/global tiers; exits 0
```
