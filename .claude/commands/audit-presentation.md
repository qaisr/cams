---
description: Audit an existing slide deck (reveal.js .html/.slides.md or .pptx) against the presentation standards, score it with the Quality Rubric, and apply improvements. Prefers editing the .slides.md source and re-rendering.
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: medium
---

# Audit Presentation

## Input

$ARGUMENTS

Examples:

- `/audit-presentation specs/exports/presentations/cans-brd-walkthrough.html`
- `/audit-presentation specs/exports/presentations/strategy.slides.md --apply`
- `/audit-presentation specs/exports/presentations/exec-overview.pptx --report-only`

---

## Purpose

Take a deck that already exists and make it **conform to the professional slide
rules** in `@.claude/standards/presentation-standards.md` (typography, color,
placement, density, structure, accessibility) and the PPCC palette in
`@.claude/standards/ppcc-brand.md`.

The command **scores** the deck with the standards' **Quality Rubric** (6
categories / 100), lists **must-fix** and **should-fix** findings, then — unless
`--report-only` — **applies the fixes** and re-renders, and re-scores so the
improvement is measurable.

> The deck's **editable source** is the `.slides.md` in
> `specs/exports/presentations/`. Improvements are made **there**, then
> re-rendered — never by hand-editing the `.html`/`.pptx` binary. Source
> documents are never touched.

---

## Token Policy

**Analysis + generation command.** Load only
`presentation-standards.md` + `ppcc-brand.md` (+ `mermaid-standards.md` if the
deck has diagrams). Read the deck's `.slides.md` in full (it is short) so the
audit is faithful; do not load unrelated standards.

---

## Argument Handling

Parse `$ARGUMENTS` as `<deck-path> [--apply|--report-only] [--audience business|technical]`:

- **Deck path** — a `.slides.md`, a rendered reveal.js `.html`, or a `.pptx`
  under `specs/exports/presentations/`.
- **`--apply`** (default) — score, then edit the source and re-render.
- **`--report-only`** — score and report findings; make no changes.
- **`--audience`** — re-frame while auditing (see the audience table in
  `presentation-standards.md`). Default: infer from the deck; otherwise business.
- **No path** → ask which deck to audit, then stop.

### Resolving the editable source

| Given | Editable source to audit/fix |
| --- | --- |
| `<stem>.slides.md` | itself |
| `<stem>.html` (reveal.js) | `<stem>.slides.md` beside it |
| `<stem>.pptx` | `<stem>.slides.md` beside it |

If a `.html`/`.pptx` is given but **no `.slides.md` exists beside it**, tell the
user: the deck was not produced by `/create-presentation`, so there is no
diff-able source. Offer to (a) reverse-engineer a `.slides.md` from the deck
(best effort — pandoc can read pptx: `pandoc <deck>.pptx -t markdown -o
<stem>.slides.md`), then audit that; or (b) `--report-only` against the rendered
deck. Do not silently overwrite the binary.

---

## Pre-Flight

- `pandoc` present (`command -v pandoc`) — needed to re-render after fixes (and
  to read `.pptx` if reverse-engineering a source). If missing, ask before
  `brew install pandoc`.
- **pptx re-render**: `.claude/assets/export/ppcc-reference.pptx` exists — if not,
  generate once per `@.claude/assets/export/generate-ppcc-templates.md`.
- **revealjs re-render**: theme at `.claude/assets/export/ppcc-revealjs.css`.
- Diagrams → `npx -y @mermaid-js/mermaid-cli` (fetched on first use; needs
  network).

---

## Process

### Step 1: Load the deck source

Resolve the editable `.slides.md` (table above). Read it in full. Note the
target format (reveal.js if a sibling `.html` exists / user says so; pptx
otherwise) and the audience.

### Step 2: Score against the Quality Rubric

Walk the deck slide-by-slide and score each of the six rubric categories in
`presentation-standards.md`:

| # | Category | Weight |
| --- | --- | --- |
| 1 | Structure & narrative | 20 |
| 2 | Typography | 20 |
| 3 | Color & contrast | 15 |
| 4 | Layout & placement | 20 |
| 5 | Content density | 15 |
| 6 | Accessibility & consistency | 10 |

For every deduction, record a **finding**: slide number, the rule it breaks, and
**must-fix** (breaks a binding rule — e.g. yellow text on white, body < 18pt,
wall-of-text, missing alt text, topic-not-assertion headline) vs **should-fix**
(weakens quality — e.g. inconsistent gutters, a second accent color, a bullet
running long). Apply the banding rule: **any must-fix caps the band at "needs
work"** until resolved.

### Step 3: Report the audit (always)

Emit the scorecard and findings **before** changing anything:

```markdown
## Presentation Audit — <deck>

### Score: <n>/100 (<band>)
| Category | Score | Notes |
|---|---|---|
| Structure & narrative | 17/20 | Slide 4 headline is a topic, not an assertion |
| Typography | 12/20 | Slide 6 body 14pt; two accent colors on slide 8 |
| Color & contrast | 11/15 | Slide 9 yellow text on white (must-fix) |
| Layout & placement | 16/20 | Inconsistent left margins slides 5–7 |
| Content density | 9/15 | Slide 3 wall-of-text (must-fix) |
| Accessibility & consistency | 7/10 | Diagram on slide 11 missing alt text (must-fix) |

### Must-fix (N)
- Slide 3 — split the wall-of-text; move detail to speaker notes.
- Slide 9 — yellow headline on white → black text on yellow rule/fill.
- Slide 11 — add alt text to the rendered diagram.

### Should-fix (N)
- Slide 4 — rewrite headline as an assertion.
- Slides 5–7 — align left edge to the 12-col grid.
```

If `--report-only`, stop here after the "Next Step" pointer.

### Step 4: Apply improvements (default)

Edit the **`.slides.md`** to resolve findings, most impactful first:

- **Structure**: reorder/split/merge slides; rewrite topic headlines as
  assertions; ensure Title → Agenda → Sections → Summary → Q&A.
- **Density**: split overloaded slides; push detail into `::: notes … :::`.
- **Typography/Color/Layout**: these are largely enforced by the **theme/template**,
  not the Markdown — so fix at the source of truth: correct any inline styles or
  raw HTML in the `.slides.md`, and if the *theme* is the cause (e.g. a size or
  color rule), fix `ppcc-revealjs.css` / the pptx reference recipe and note it.
- **Accessibility**: add alt text/captions to diagram slides; remove
  color-alone meaning.

Preserve the deck's facts — never invent content to fill a slide. Keep speaker
notes; expand them when moving detail off a slide.

### Step 5: Re-render

Re-render from the fixed `.slides.md` to the deck's format:

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

Re-render any changed Mermaid to images first (`scripts/export-doc.ts mermaid`,
svg for reveal.js / png for pptx) and re-embed.

### Step 6: Re-score & report the delta

Re-run the rubric on the fixed deck and report before/after:

```markdown
## Presentation Improved — <deck>

| | Before | After |
|---|---|---|
| Score | 62/100 (needs work) | 91/100 (excellent) |
| Must-fix | 3 | 0 |
| Should-fix | 5 | 1 |

### Applied
- Split slide 3; moved 4 detail points to speaker notes.
- Recolored slide 9 headline (yellow-on-white → black-on-yellow rule).
- Added alt text to the slide 11 architecture diagram.
- Rewrote slides 4, 7 headlines as assertions.

### Remaining (should-fix)
- Slide 8 caption could be tightened (cosmetic).

### Next Step
- Open `specs/exports/presentations/<stem>.<html|pptx>`.
- Editable source: `specs/exports/presentations/<stem>.slides.md`.
```

---

## Notes & Edge Cases

- **Never hand-edit the binary.** All fixes go through the `.slides.md` +
  theme/template, then re-render — otherwise the next `/create-presentation` or
  `/audit-presentation` run silently reverts them.
- **Theme vs. content.** Typography/color/layout are mostly the template's job.
  If many slides share the same visual defect, fix the **theme**
  (`ppcc-revealjs.css` / pptx reference recipe), not each slide.
- **Faithfulness.** Improving a deck must not change its facts or numbers — only
  how they are structured and presented.
- **No source, report-only fallback.** A `.pptx`/`.html` with no sibling
  `.slides.md` can only be reverse-engineered (best effort) or audited
  read-only; say which, don't overwrite the binary.
- **Must-fix gate.** Do not report a deck as "good/excellent" while any must-fix
  finding remains — the band is capped at "needs work".

---

## Cross-References

- Slide rules (binding) + Quality Rubric: `@.claude/standards/presentation-standards.md`
- Branding: `@.claude/standards/ppcc-brand.md`
- Create a deck from scratch: `@.claude/commands/create-presentation.md`
- reveal.js theme: `.claude/assets/export/ppcc-revealjs.css`
- PPTX template recipe: `@.claude/assets/export/generate-ppcc-templates.md`
- Diagram render: `scripts/export-doc.ts` + `@.claude/standards/mermaid-standards.md`
