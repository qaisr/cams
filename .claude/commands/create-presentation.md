---
description: Generate a professional, PPCC-branded slide deck from a brief or a project document. Outputs PowerPoint (.pptx) or reveal.js. Confirms the slide outline before rendering.
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: medium
---

# Create Presentation

## Input

$ARGUMENTS

Examples:

- `/create-presentation "a walkthrough of specs/business-requirements.md for business users" --format revealjs`
- `/create-presentation specs/strategy.md --format pptx --audience technical`
- `/create-presentation "10-slide overview of the CANS project, exec audience"`

---

## Purpose

Turn a **brief** (free text) and/or a **project document** into a polished,
on-brand slide deck. The deck follows the professional slide rules in
`@.claude/standards/presentation-standards.md` (typography, color, placement,
one-idea-per-slide) and the PPCC palette in `@.claude/standards/ppcc-brand.md`.

Two output formats, one source outline:

- **reveal.js** — browser deck (URL-shareable, speaker view, animations).
- **PowerPoint (.pptx)** — Office deck (editable, offline, corporate hand-off).

> Output goes to `specs/exports/presentations/`. Source documents are never
> modified.

---

## Token Policy

**Generation-phase command** — the Context Discipline "Generation Phase
Exception" applies. When summarising a source document, read the **relevant
slices in full** so the narrative is faithful; do not truncate the source into a
shallow deck. But do not load unrelated standards — only
`presentation-standards.md` + `ppcc-brand.md` (+ `mermaid-standards.md` if the
deck has diagrams).

---

## Argument Handling

Parse `$ARGUMENTS` as: a **brief** (quoted text) and/or a **`@doc` / path**
source, plus flags:

- `--format pptx | revealjs` — output format. If omitted → **ask** (default
  suggestion: `revealjs` for a walkthrough, `pptx` when they say "PowerPoint" or
  need Office editing).
- `--audience business | technical` — framing (default **business**). See the
  audience table in `presentation-standards.md`.
- `--slides <n>` — target slide count (optional; otherwise size to the content).

- **No brief and no source** → ask what the deck is about and (optionally) which
  document(s) to base it on, then stop.

---

## Pre-Flight

- `pandoc` present (`command -v pandoc`) — required for both formats. If missing,
  ask before `brew install pandoc`.
- **pptx**: `.claude/assets/export/ppcc-reference.pptx` exists — if not, generate
  it once per `@.claude/assets/export/generate-ppcc-templates.md`.
- **revealjs**: no extra install (pandoc emits self-contained HTML; the PPCC theme
  is `.claude/assets/export/ppcc-revealjs.css`).
- Diagrams in the deck → `npx -y @mermaid-js/mermaid-cli` (fetched on first use;
  needs network).

---

## Process

### Step 1: Gather source material

- If a document is referenced, read the slices needed for the narrative (respect
  the Generation Phase Exception — read fully what you summarise).
- If only a brief is given, work from the brief + project context you already
  have. Do not invent facts about the project — if a claim needs a source you do
  not have, mark it as an assumption to confirm.

### Step 2: Plan the outline (apply the standards)

Draft a slide outline per `presentation-standards.md`:

- **Structure**: Title → Agenda → (Section → Content…)\* → Summary → Q&A/Contact.
- **Assertion headlines** (the takeaway, not the topic).
- **One idea per slide**; detail goes to speaker notes.
- **Audience framing** per the flag (business vs technical).
- Identify where a **diagram** (rendered Mermaid) or a **single big number**
  beats bullets.

Present the outline as a numbered list (slide title + one-line intent each) and
**confirm with the user** before rendering. Adjust on feedback. Do not produce a
binary until the outline is agreed.

### Step 3: Author the deck source (pandoc Markdown)

Write the agreed outline to
`specs/exports/presentations/<stem>.slides.md` as pandoc Markdown:

- `#`/`##` headings start slides (set `--slide-level` accordingly).
- Section dividers = a heading with no body (tag with `data-state="section"` for
  reveal.js via a fenced div or a `##` under a section marker).
- Speaker notes in `::: notes … :::`.
- Keep body ≥ 18pt-equivalent density: ≤ ~6 bullets, ≤ ~6 words each.
- Big numbers wrapped so the PPCC `.stat` class applies (reveal.js).
- Render any Mermaid to an image first (Step 4) and reference it.

### Step 4: Render diagrams (if any)

```bash
tsx scripts/export-doc.ts mermaid "specs/exports/presentations/<stem>.slides.md" \
  --out-dir "specs/exports/presentations/assets" --format svg   # png for pptx
```

Embed each image on its own visual slide with a caption and alt text.

### Step 5: Render the deck

**reveal.js:**

```bash
pandoc "specs/exports/presentations/<stem>.slides.md" \
  -t revealjs --standalone --embed-resources \
  -V theme=white --slide-level=2 \
  --css ".claude/assets/export/ppcc-revealjs.css" \
  -o "specs/exports/presentations/<stem>.html"
```

**PowerPoint:**

```bash
pandoc "specs/exports/presentations/<stem>.slides.md" \
  -t pptx --slide-level=2 \
  --reference-doc ".claude/assets/export/ppcc-reference.pptx" \
  -o "specs/exports/presentations/<stem>.pptx"
```

### Step 6: Verify

- File exists, correct type (`file <out>`), opens.
- Slide count ≈ the agreed outline; no empty/orphan slides.
- Quick self-check against the **Quality Rubric** in `presentation-standards.md`
  (structure, typography, color/contrast, layout, density, a11y). Fix
  must-fix issues before reporting OK.
- Diagrams rendered (not code blocks); every diagram has alt text.

### Step 7: Report

```markdown
## Presentation Ready

| Deck | Format | Audience | Slides | Source |
|---|---|---|---|---|
| specs/exports/presentations/cans-brd-walkthrough.html | revealjs | business | 14 | specs/business-requirements.md |

### Self-Rubric Score: <n>/100 (<band>)
- Structure <..> · Typography <..> · Color <..> · Layout <..> · Density <..> · A11y <..>

### Next Step
- Open the deck. To refine against the standards, run `/audit-presentation <deck>`.
- The editable source outline is at `specs/exports/presentations/<stem>.slides.md`.
```

---

## Notes & Edge Cases

- **Never shrink text to fit** — split a crowded slide. Body stays ≥ 18pt.
- **One accent per slide** (PPCC yellow). Never yellow text on white.
- **Speaker notes carry the detail** the slide omits — always generate them for
  content slides.
- **Both formats from one source** — content is identical; only the renderer/
  theme differs. If the user wants both, render twice from the same
  `.slides.md`.
- **Editable outline preserved** — the `.slides.md` stays so the user (or
  `/audit-presentation`) can revise without starting over.
- **Faithfulness** — when summarising a doc, do not invent facts or numbers;
  round and frame per audience, but keep them true to the source.

---

## Cross-References

- Slide rules (binding): `@.claude/standards/presentation-standards.md`
- Branding: `@.claude/standards/ppcc-brand.md`
- Audit/improve an existing deck: `@.claude/commands/audit-presentation.md`
- reveal.js theme: `.claude/assets/export/ppcc-revealjs.css`
- PPTX template recipe: `@.claude/assets/export/generate-ppcc-templates.md`
- Diagram render: `scripts/export-doc.ts` + `@.claude/standards/mermaid-standards.md`
- Document export (non-slides): `@.claude/commands/export.md`
