---
description: Export a Markdown document to PDF / DOCX / HTML / PPTX, or a Mermaid diagram to PNG / SVG / PDF, with PPCC branding. Prompts single-vs-separate when a doc links to siblings.
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: medium
---

# Export

## Input

$ARGUMENTS

Examples:

- `/export specs/business-requirements.md --to docx`
- `/export specs/business-requirements.md --to pdf`
- `/export specs/strategy/02-architecture-overview.md --to png`
- `/export specs/business-requirements.md` (no `--to` → prompt for format)

---

## Purpose

The outbound counterpart to `/convert-to-markdown`. Turn authored Markdown into
a **deliverable** reviewers can open — Word, PDF, HTML — or render a **Mermaid**
diagram to an image. Output is **PPCC-branded** and faithful to the source.

When a document links to sibling files (e.g. `business-requirements.md` → the
`brd/*.md` set), offer to produce **one bundled deliverable** or **separate
files**.

> **Nothing is deleted.** Source `.md` files are never modified. Outputs are
> written under `specs/exports/` (diagrams under `specs/exports/diagrams/`).

Binding standards: `@.claude/standards/document-export-standards.md`,
`@.claude/standards/ppcc-brand.md`, and — for `--to pptx` — the presentation path
(`@.claude/commands/create-presentation.md`).

---

## Token Policy

This is a **conversion** command, not analysis. Do not read full document bodies
into context to "understand" them — the tooling transforms files on disk. Read a
source only to: (a) detect sibling links / an index table for bundling, or
(b) sanity-check a suspicious output. Produce the artifact and report a table.

---

## Argument Handling

Parse `$ARGUMENTS` as `<path> [--to <format>] [--separate|--single] [--landscape]`.

- **Source path** — a `.md` file (document or a file containing ```mermaid
  blocks) or a directory (export each `.md` inside; ask before large batches).
- **`--to`** — one of `pdf`, `docx`, `html`, `pptx` (document targets) or `png`,
  `svg`, `pdf` (diagram targets). If omitted → **ask** the user which format.
- **No path** → ask for a path, then stop.

### Source-and-target routing

| Source | `--to` | Route |
| --- | --- | --- |
| `.md` document | `pdf` | `export-doc.ts md2pdf` (pandoc→HTML→Chrome print) |
| `.md` document | `html` | `export-doc.ts md2html` |
| `.md` document | `docx` | `pandoc --reference-doc=ppcc-reference.docx` |
| `.md` document | `pptx` | **Route to `/create-presentation`** (so it gets slide styling, not a raw dump) |
| `.md` with ```mermaid | `png`/`svg`/`pdf` (diagram) | `export-doc.ts mermaid` |

If a document **both** is a normal doc **and** contains Mermaid, and the user
asked for `png/svg`, treat it as a **diagram extract**. If they asked for a doc
format, Mermaid is rendered **inline** within the document (handled by the
script). When ambiguous, ask.

---

## Pre-Flight

Check only the tools the chosen target needs; if one is missing, tell the user
and **ask before installing** — never install silently.

| Target | Needs | Check | If missing |
| --- | --- | --- | --- |
| html, docx, pptx | `pandoc` | `command -v pandoc` | Ask to `brew install pandoc`. |
| pdf | `pandoc` + Chrome | `command -v pandoc`; Chrome at the standard macOS path or `$CHROME_PATH` | Ask; or offer `--to html` and let the user print. |
| png/svg/pdf (mermaid) | `npx` + network | `command -v npx` | `npx -y @mermaid-js/mermaid-cli` fetches on first use; warn it needs network. |
| docx, pptx | PPCC reference template | `.claude/assets/export/ppcc-reference.docx` / `.pptx` exists | Generate once per `@.claude/assets/export/generate-ppcc-templates.md`. |

---

## Process

### Step 1: Classify the source & confirm the target

1. Confirm the source exists and is `.md` (or a dir).
2. Resolve `--to`, or ask. Validate it is legal for the source type (Step routing
   table). For `pptx`, hand off to `/create-presentation <source> --format pptx`.

### Step 2: Bundling decision (documents only)

Read the source's **link structure** (not its full body):

- If it has **local sibling `.md` links** — especially an **index/TOC table** —
  ask the user:
  - **Single bundled document** — inline one level per
    `document-export-standards.md` (index-table links preferred; you may pass an
    explicit `--include` list to `export-doc.ts bundle`).
  - **Separate files** — one output per source `.md`.
- If it has **no** local links, skip the prompt (single file).

For **single**, first build the bundle:

```bash
tsx scripts/export-doc.ts bundle "<source.md>" --out "specs/exports/.tmp/<stem>.bundled.md" \
  [--include "brd/01-....md,brd/02-....md,..."]
```

Then treat the bundled `.md` as the input to Step 3. (Clean up the `.tmp` file
after.)

### Step 3: Render

**PDF** (Chrome-print, PPCC-styled, Mermaid inlined):

```bash
tsx scripts/export-doc.ts md2pdf "<input.md>" --out "specs/exports/<stem>.pdf" --title "<Doc Title>"
```

**HTML** (standalone, self-contained):

```bash
tsx scripts/export-doc.ts md2html "<input.md>" --out "specs/exports/<stem>.html" --title "<Doc Title>"
```

**DOCX** (pandoc + PPCC reference; render Mermaid to PNG first if present):

```bash
pandoc "<input.md>" -f gfm -o "specs/exports/<stem>.docx" \
  --reference-doc=.claude/assets/export/ppcc-reference.docx --toc --toc-depth=3
```

> If the doc has Mermaid, run `export-doc.ts mermaid <input.md> --out-dir <tmp>
> --format png` first and reference the images, since DOCX handles PNG most
> reliably. Flag any diagram that fails to render as `NEEDS REVIEW`.

**Diagram (PNG / SVG / PDF)**:

```bash
tsx scripts/export-doc.ts mermaid "<source.md>" --out-dir "specs/exports/diagrams" --format <png|svg|pdf>
```

**PPTX** → do not run here; `/create-presentation "<source>" --format pptx`.

### Step 4: Verify

- File exists and is non-empty; correct type (`file <out>` shows PDF/HTML/Office/
  image as expected).
- For bundled docs: spot-check the output contains the inlined sections.
- For diagrams: one output per ```mermaid block.
- Any step that degraded or dropped content → mark `NEEDS REVIEW`, don't claim OK.

### Step 5: Report

```markdown
## Export Complete

| Source | Output | Format | Bundled? | Status |
|---|---|---|---|---|
| specs/business-requirements.md | specs/exports/business-requirements.docx | docx | single (9 sub-files) | OK |

### Needs Review
- (none)

### Next Step
- Open the output under `specs/exports/`. Sources are unchanged.
- For slides, use `/create-presentation`. To improve an existing deck, `/audit-presentation`.
```

---

## Notes & Edge Cases

- **One-level bundling only.** Links inside inlined children are flattened to
  text (marked "(not included)"), not recursed — see
  `document-export-standards.md`.
- **Overwrite** an existing same-name export silently (re-export). A collision
  with an unrelated existing file → STOP and ask (mirrors `convert-to-markdown`).
- **Large docs → PDF**: Chrome print handles multi-hundred-page docs but can be
  slow; run in the background and report when done.
- **No Chrome**: fall back to `--to html` and tell the user how to print, rather
  than failing hard.
- **Mermaid render needs network** the first time (`npx` fetches the CLI).
- **Idempotent** — re-running overwrites the same-source output.

---

## Cross-References

- Document rules: `@.claude/standards/document-export-standards.md`
- Branding: `@.claude/standards/ppcc-brand.md`
- Slides: `@.claude/commands/create-presentation.md` + `@.claude/standards/presentation-standards.md`
- Script: `scripts/export-doc.ts`
- Template recipe: `@.claude/assets/export/generate-ppcc-templates.md`
- Inbound counterpart: `@.claude/commands/convert-to-markdown.md`
- Diagram authoring/rendering: `@.claude/standards/mermaid-standards.md`
