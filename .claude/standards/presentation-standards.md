# Presentation Standards

> **Binding rules for `/create-presentation` and the `/export … --to pptx`
> path.** Governs slide design, structure, and quality for both **PowerPoint
> (.pptx)** and **reveal.js** output. Branding comes from
> `@.claude/standards/ppcc-brand.md`; any Mermaid follows
> `@.claude/standards/mermaid-standards.md`.

A deck is not a document with page breaks. These decks are shown live to
business, legal, and executive audiences — clarity and restraint matter more
than completeness. When in doubt, cut.

---

## Core Design Principles

1. **One idea per slide.** If a slide needs "and", it is probably two slides.
2. **Slides support the speaker; they are not the script.** Detail lives in
   speaker notes, not on the slide. Prefer a headline + a few supporting points.
3. **6×6 guideline.** Aim for ≤ 6 bullets, ≤ 6 words per bullet. It is a
   guideline for density, not a hard cap — but a wall of text is always wrong.
4. **Headline = the takeaway.** Write slide titles as assertions
   ("Phase 1 delivers agreement capture, not netting calc") not topics
   ("Phase 1 scope").
5. **Show, don't list.** Prefer a diagram, a simple table, or one number over a
   bulleted paragraph where it fits.
6. **Consistency.** Same fonts, colors, spacing, and layout family across the
   deck. Branding is applied through the PPCC template, never per-slide.
7. **Never shrink text to fit.** Body text stays ≥ 18pt. If it does not fit,
   split the slide.

---

## Slide Types & Layouts

| Type | Purpose | Layout |
| --- | --- | --- |
| **Title** | Deck open | Black or PPCC-yellow band background, logo/wordmark, title, subtitle, presenter + date. |
| **Agenda** | Roadmap | 3–6 numbered sections; mirrors the section slides that follow. |
| **Section divider** | Signals a new part | Full-bleed PPCC color, section number + title, minimal text. |
| **Content** | The workhorse | Assertion headline + ≤ 6 supporting points, or a single visual. |
| **Visual / diagram** | Show a flow or architecture | One rendered diagram, large; caption; minimal chrome. |
| **Comparison** | Two options / before-after | Two columns or a small table; balanced. |
| **Quote / callout** | Emphasis | One statement, large; attribution in `--ppcc-grey-600`. |
| **Data** | A key metric | One big number + one line of context. Avoid dense tables on slides. |
| **Summary / next steps** | Close | 3–5 takeaways or actions; owner + date where relevant. |

Every deck: **Title → Agenda → (Section → Content…)* → Summary**. Add a closing
"Questions / Contact" slide.

---

## Typography (professional)

Type is the single biggest driver of a deck looking "designed" vs "made in a
hurry". These rules are binding.

### Families

- **One family for the whole deck.** The PPCC system-sans stack from
  `@.claude/standards/ppcc-brand.md` is the default. Do **not** mix more than two
  families; if a second is used it is monospace, for code/IDs only.
- Never use Comic Sans, Papyrus, condensed display faces, or decorative fonts.
- If pairing two families: one sans for headings + body is safest. A serif is
  only introduced for a deliberate editorial tone and must be tested for
  legibility at 18pt.

### Type scale (16:9, 1280×720pt canvas)

| Role | Size | Weight | Notes |
| --- | --- | --- | --- |
| Deck title | 44–54pt | Bold (700) | One or two lines max. |
| Section divider | 36–44pt | Bold | Short. |
| Slide headline | 28–34pt | Semibold (600) | The assertion. 1–2 lines. |
| Body / bullets | 20–26pt | Regular (400) | Never below **18pt**. |
| Caption / source / footer | 12–14pt | Regular | `--ppcc-grey-600`. |
| Big-number stat | 72–120pt | Bold | One per data slide. |
| Code / IDs | 18–22pt | Mono Regular | Only where needed. |

Use a **consistent modular scale** — do not hand-pick arbitrary sizes per slide.
Two adjacent levels should be visibly different (≥ 1.25× step).

### Weight, case & spacing

- Establish hierarchy with **size + weight**, not with color or underline.
- Use **at most two weights** on a slide (e.g. Semibold headline + Regular body).
- **Sentence case** for headlines and bullets. Reserve ALL-CAPS for short labels
  (section kicker, footer) with slight letter-spacing (`+0.5–1pt`); never
  all-caps a full sentence.
- **Bold** for genuine emphasis only — one emphasis per slide. Avoid italics for
  emphasis (weak on projectors); never underline (reads as a link).
- Line height 1.15–1.3 for headlines, 1.25–1.4 for body.
- Line length ≤ ~40 characters per bullet; wrap deliberately, don't let text run
  edge to edge.

---

## Colors (professional application)

Palette is fixed by `@.claude/standards/ppcc-brand.md`. This section governs *how
much* and *where*.

### 60 / 30 / 10 ratio

- **60% dominant** — background/neutral (white or `--ppcc-black` on title/section
  slides).
- **30% secondary** — text and structural neutrals (`--ppcc-ink`,
  `--ppcc-grey-*`).
- **10% accent** — `--ppcc-yellow` only: headline rules, the active agenda item,
  a key figure, footer bar. Accent is a *spotlight*, not a coat of paint.

### Rules

- **One accent per slide.** If everything is highlighted, nothing is. Teal/red
  are **functional only** (info / risk) and appear rarely.
- **Contrast is non-negotiable**: body ≥ 4.5:1, large text ≥ 3:1. Yellow text on
  white is **banned** (use black text on a yellow fill, or yellow as a rule/bar).
- **No gradients, glows, drop shadows, or bevels** on brand elements. Flat and
  clean. A single subtle shadow to lift a card off the background is the only
  exception.
- **Backgrounds stay quiet.** No busy photos or textures behind text. If a photo
  background is used, add a solid or 60%+ scrim so text keeps contrast.
- **Consistency across the deck**: the same element (headline rule, footer,
  section band) is the same color everywhere. Don't recolor per slide.
- Semantic color, when used in a chart/table, is paired with a label or icon —
  never color alone.

---

## Placement, Grid & Whitespace

Consistent placement is what makes a deck feel engineered rather than assembled.

### Safe area & margins

- **Outer margin ≥ 5%** of the canvas on all sides (~40pt on 1280×720). Nothing
  but full-bleed color bands touches the edge.
- Keep a **title-safe** zone: headline baseline in the same position on every
  content slide so titles don't jump between slides.

### Grid & alignment

- Lay content on a simple grid — **12 columns** (or a 2/3-column split). Align
  every block to a column edge; nothing floats arbitrarily.
- **Left-align body text and headlines** (most legible). Center only short titles
  and the deck/section covers. Never center multi-line body text.
- **One alignment axis per slide.** Elements share left edges / baselines so the
  eye tracks cleanly.
- **Consistent gutters** between columns and consistent vertical rhythm between
  blocks — reuse the same spacing values (e.g. 8/16/24/40pt), don't nudge
  by eye each time.

### Visual hierarchy & placement conventions

- Reading order: **top-left → bottom-right.** Put the most important element
  top-left or dead-center (for a single hero visual).
- Headline top, supporting content below, caption/source at the bottom. Footer
  (logo/section/slide number) fixed at the bottom on every content slide.
- **One focal point per slide.** Size, weight, color, and whitespace all point
  to it.
- Group related items (proximity) and separate unrelated ones — whitespace *is*
  the grouping mechanism.

### Whitespace

- **Whitespace is a feature, not waste.** A slide with one idea and lots of
  breathing room reads as confident and premium; a full slide reads as a
  document.
- Do not fill empty space just because it exists. Better one clear point with
  air around it than four cramped ones.

### Images, icons & diagrams placement

- Icons: one consistent style (line **or** solid, one weight) across the deck;
  sized to the type; used to aid scanning, not as decoration.
- Images: high-resolution only (no stretching/pixelation), consistent treatment
  (all photographic, or all illustration — not mixed), aligned to the grid,
  never distorted (preserve aspect ratio).
- Diagrams (rendered Mermaid): one per slide, centered or grid-aligned, sized to
  fill the content area with margin; caption below; alt text always.
- Never place text over the busy part of an image; use a panel or scrim.

---

## Audience Framing

`/create-presentation --audience business|technical` changes emphasis, not facts:

| | **business** (default) | **technical** |
| --- | --- | --- |
| Language | Outcomes, risk, cost, timeline. Expand acronyms on first use. | Precise terms, component names, trade-offs. |
| Diagrams | Context / flow level; hide internals. | Architecture, sequence, data-model detail. |
| Depth | "What it means for you." | "How it works and why." |
| Requirement IDs | Omit from slides (keep in notes). | May reference IDs directly. |
| Numbers | Rounded, framed ("~390 requirements"). | Exact where it matters. |

When summarising a source doc (e.g. "walkthrough of
`specs/business-requirements.md` for business users"), **extract the narrative**,
do not paste headings. A 389-requirement BRD becomes a story: problem → what
we're building → scope/phasing → how we know it works → risks → next steps.

---

## Mermaid & Visuals in Slides

- Mermaid is **rendered to an image** (SVG for reveal.js/HTML, PNG for PPTX) via
  `npx -y @mermaid-js/mermaid-cli` and placed on a **visual slide** — never
  shown as a code block.
- **One diagram per slide**, sized to fill. If a source diagram has > ~12 nodes,
  simplify it for the slide (a context view) and keep the full version in the
  source doc — note this in speaker notes.
- Every diagram slide has **alt text** (from `accTitle`/`accDescr`) and a short
  caption.
- Charts/tables: keep to what is readable from the back of a room. A table with
  > 5 columns or > 6 rows belongs in the document export, not a slide.

---

## Speaker Notes

- Generate **speaker notes for every content slide** — the detail, caveats, and
  transitions the slide deliberately omits. This is where nuance from the source
  document goes.
- Notes are prose, not more bullets. 2–5 sentences per slide.

---

## Accessibility

- Contrast per `ppcc-brand.md` (body ≥ 4.5:1). Black text on yellow is fine;
  yellow text on white is **banned**.
- Never encode meaning by color alone (add a label/icon).
- Diagram images carry alt text. reveal.js output keeps a logical heading
  order and is keyboard-navigable.
- Minimum on-slide font 18pt.

---

## Format Choice — reveal.js vs PowerPoint

| Choose **reveal.js** when | Choose **PowerPoint (.pptx)** when |
| --- | --- |
| Presenting from a browser / sharing a URL | Audience needs to edit or re-use slides |
| Live demo, embedded video, fragments/animation | Corporate template / offline PPT expected |
| You want speaker view + timer in-browser | Handing to a team that lives in Office |
| Version-controlled, diff-able source (`.md`/HTML) | Reviewers annotate in PowerPoint |

Both are branded from the **same** PPCC tokens (`ppcc-brand.md`): reveal.js via
`ppcc-revealjs.css`, PPTX via the generated `ppcc-reference.pptx`. Content and
outline are identical; only the renderer differs. Default to **reveal.js** for
walkthroughs, **pptx** when the user says "PowerPoint" or needs Office editing.

---

## Authoring Source Format

Slides are authored as **pandoc Markdown** (portable, diff-able, one source →
both formats):

- Level-1/2 headings start new slides (pandoc `--slide-level`).
- A horizontal rule `---` forces a slide break.
- Speaker notes in a `::: notes` fenced div (reveal.js) / notes are carried to
  PPTX.
- Section dividers via a heading with no body.

`/create-presentation` **confirms the slide outline with the user** before
rendering, so structure is agreed before any binary is produced.

---

## Quality Rubric (used by `/audit-presentation`)

Score a deck out of 100 across six categories. Each finding is tagged
**must-fix** (breaks a binding rule) or **should-fix** (weakens quality).

| # | Category | Weight | What "good" looks like |
| --- | --- | --- | --- |
| 1 | **Structure & narrative** | 20 | Title → agenda → sections → summary; assertion headlines; one idea per slide; logical flow; no orphan/duplicate slides. |
| 2 | **Typography** | 20 | One family; consistent modular scale; ≤ 2 weights/slide; ≥ 18pt body; sentence case; no underline-for-emphasis; sane line length/height. |
| 3 | **Color & contrast** | 15 | 60/30/10; one accent/slide; AA contrast; **no yellow text on white**; no gradients/shadows; consistent element colors. |
| 4 | **Layout & placement** | 20 | Grid alignment; consistent margins/gutters; fixed title-safe zone; left-aligned body; one focal point; generous whitespace; no crowding. |
| 5 | **Content density** | 15 | ~6×6; no wall-of-text; detail pushed to speaker notes; tables/charts readable from the back; one diagram/slide. |
| 6 | **Accessibility & consistency** | 10 | Alt text on visuals; not color-alone meaning; consistent footer/branding; keyboard-navigable (reveal.js); logical heading order. |

**Bands**: 90–100 excellent · 75–89 good, minor polish · 60–74 needs work ·
< 60 rebuild. Any **must-fix** present caps the band at "needs work" until fixed.

---

## Cross-References

- Command: `@.claude/commands/create-presentation.md`
- Doc export (pptx-from-doc routes here): `@.claude/commands/export.md`
- Branding: `@.claude/standards/ppcc-brand.md`
- reveal.js theme: `.claude/assets/export/ppcc-revealjs.css`
- PPTX template + recipe: `@.claude/assets/export/generate-ppcc-templates.md`
- Mermaid rules: `@.claude/standards/mermaid-standards.md`

## Token Optimization

**Load when**: running `/create-presentation`, or exporting a document to pptx.
**Load only**: this file + `@.claude/standards/ppcc-brand.md` (+ `mermaid-standards.md`
only if the deck has diagrams).
**Unload after**: the deck is produced.
