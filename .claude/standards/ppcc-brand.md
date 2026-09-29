# PPCC Brand Standard (Export & Presentation)

> **Scope**: brand tokens for **exported artifacts** — documents (PDF / DOCX /
> HTML) and slides (PowerPoint / reveal.js) produced by `/export` and
> `/create-presentation`. This is **not** the application UI theme (that lives in
> `@.claude/config/ui-themes.json` and `@.claude/standards/design-tokens.md`).
> Exported deliverables go to reviewers, legal, and business stakeholders, so
> they must look consistent and on-brand.

> ⚠️ **Approximated from public brand identity.** The hex values and typography
> below are a *reasonable public approximation* of the Commonwealth Bank of
> Australia brand, chosen so the commands produce good-looking output today. They
> are **not** sourced from the official PPCC brand book. When official assets are
> available, replace the hexes, fonts, and logo path here — every asset
> (`ppcc-doc.css`, `ppcc-revealjs.css`, the generated `reference.*` templates)
> reads from this single source, so correcting them here propagates everywhere.

---

## Color Tokens

| Token | Hex | Role |
| --- | --- | --- |
| `--ppcc-yellow` | `#FCC016` | Primary brand accent — title bars, section dividers, link/hover accents, slide footers. Use on dark or white, never as body-text color. |
| `--ppcc-yellow-deep` | `#E5A800` | Darker yellow for hover / borders / where `#FCC016` fails contrast on white. |
| `--ppcc-black` | `#000000` | Primary text on light; primary background for title/section slides. |
| `--ppcc-ink` | `#1A1A1A` | Softer near-black for long-form body text (less harsh than pure black on paper). |
| `--ppcc-white` | `#FFFFFF` | Page/slide background; text on black. |
| `--ppcc-grey-900` | `#2D2D2D` | Headings on light background. |
| `--ppcc-grey-600` | `#595959` | Secondary text, captions, speaker-note attribution. |
| `--ppcc-grey-300` | `#CCCCCC` | Table borders, rules, dividers. |
| `--ppcc-grey-100` | `#F4F4F4` | Zebra table rows, code-block background, callout fill. |
| `--ppcc-accent-teal` | `#008A8C` | Sparingly — positive/info callouts, chart accent. |
| `--ppcc-accent-red` | `#C8102E` | Sparingly — warnings, risk callouts, "must" emphasis. |

**Usage rules**

- **One primary accent.** `--ppcc-yellow` is the only brand color a normal slide/
  page should show. Teal and red are *functional* accents (info / warning), not
  decoration.
- **Contrast is binding.** Body text ≥ 4.5:1, large/heading text ≥ 3:1 (WCAG AA).
  `#FCC016` on white is ~1.6:1 — **never** use yellow for text on white; use it
  as a fill behind black text, or as a bar/rule. Black text on yellow passes.
- **No gradients, no drop shadows** on brand elements unless the official brand
  book calls for them. Flat, clean, high-contrast.

---

## Typography

No proprietary font is shipped with the repo. Use a **system sans stack** so
output renders identically without font installs:

```
"Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif
```

Monospace (code): `"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace`

**Scale (documents)** — base 11pt print / 16px screen; headings 1.6/1.4/1.25/1.1×.
**Scale (slides)** — see the full type scale, weight, and case rules in
`@.claude/standards/presentation-standards.md` (Typography). In short: title
44–54pt, body ≥ 18pt, never shrink text to fit — split the slide instead.

If an official PPCC font (e.g. a licensed brand typeface) becomes available and is
installed on the machine, prepend it to the stack here.

---

## Logo

- **Slot, not asset.** No logo file is committed. Place an official logo at
  `.claude/assets/export/ppcc-logo.svg` (or `.png`) and the CSS/templates will
  pick it up via the `--ppcc-logo` slot; until then a text wordmark
  ("Commonwealth Bank" / project name) is used so output is never broken.
- Logo appears: top-left of document title page; title & section slides; small
  in slide footer. Never stretch, recolor, or place on a low-contrast background.
- **Do not fabricate** the PPCC logo as inline SVG/emoji. Absence of a logo asset
  → text wordmark, not an invented mark.

---

## Applying the brand

| Target | Mechanism | File |
| --- | --- | --- |
| HTML / PDF (Chrome-print) | CSS `:root` variables mirror the tokens above | `.claude/assets/export/ppcc-doc.css` |
| reveal.js slides | CSS overlay on a base reveal theme | `.claude/assets/export/ppcc-revealjs.css` |
| DOCX / PPTX | pandoc `--reference-doc` templates generated from the tokens | `.claude/assets/export/ppcc-reference.docx`, `ppcc-reference.pptx` (generated — see `generate-ppcc-templates.md`) |

When you change a token here, regenerate the `reference.*` templates (run the
recipe in `@.claude/assets/export/generate-ppcc-templates.md`) and update the two
CSS files' `:root` blocks to match.

---

## Cross-References

- Document export rules: `@.claude/standards/document-export-standards.md`
- Presentation rules: `@.claude/standards/presentation-standards.md`
- Export command: `@.claude/commands/export.md`
- Presentation command: `@.claude/commands/create-presentation.md`
- Template generation recipe: `@.claude/assets/export/generate-ppcc-templates.md`
- App UI theme (distinct from this): `@.claude/config/ui-themes.json`

## Token Optimization

**Load when**: generating any exported document or slide deck, or editing the
export/presentation CSS or reference templates.
**Load only**: this file + the specific export/presentation standard for the task.
**Unload after**: the artifact is produced.
