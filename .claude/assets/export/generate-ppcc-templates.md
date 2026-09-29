# Generating the PPCC `reference.docx` / `reference.pptx`

> Recipe for materialising the two **binary** pandoc reference templates used by
> `/export` (DOCX) and `/create-presentation` / `/export --to pptx` (PPTX).
> Binary templates are **not committed** — they are generated on first use into
> this folder and reused thereafter, so the source of truth stays the text
> tokens in `@.claude/standards/ppcc-brand.md`. Regenerate whenever a token
> changes.

Outputs (git-ignored):

- `.claude/assets/export/ppcc-reference.docx`
- `.claude/assets/export/ppcc-reference.pptx`

Prerequisite: `pandoc` (≥ 3.x). Check with `command -v pandoc`. If missing, ask
the user before installing (`brew install pandoc`) — never install silently.

---

## Why generate instead of commit

A `reference.docx`/`reference.pptx` is a zipped Office document. Committing one
blind means nobody can review or safely edit the styles, and it drifts from the
brand tokens. Generating it from a known recipe keeps it reproducible and lets a
token change in `ppcc-brand.md` propagate with one command.

---

## Step 1 — Extract pandoc's default reference, then restyle

The most reliable approach: start from pandoc's own default reference file (so
all required styles exist), then apply PPCC styling. `/export` and
`/create-presentation` run these steps automatically on first use; they are
documented here so the process is auditable and hand-editable.

### DOCX

```bash
DIR=.claude/assets/export
# 1. Get pandoc's default reference so every named style is present.
pandoc --print-default-data-file reference.docx > "$DIR/ppcc-reference.docx"
```

Then apply PPCC styling to `ppcc-reference.docx` (open once in Word/LibreOffice,
or script via the `docx` XML) so the named styles match `ppcc-brand.md`:

| Word style         | PPCC setting                                                              |
| ------------------ | ------------------------------------------------------------------------- |
| Title              | Sans, 26pt, Bold, `#2D2D2D`; yellow `#FCC016` bottom border               |
| Heading 1          | Sans, 18pt, Bold, `#2D2D2D`; yellow bottom border                         |
| Heading 2          | Sans, 15pt, Bold, `#2D2D2D`                                               |
| Heading 3          | Sans, 13pt, Semibold, `#595959`                                           |
| Normal             | Sans, 11pt, `#1A1A1A`, line spacing 1.15                                  |
| Table (header row) | Fill `#2D2D2D`, text white, bold; body borders `#CCCCCC`; zebra `#F4F4F4` |
| Hyperlink          | `#E5A800`                                                                 |
| Blockquote / Quote | Left yellow bar, fill `#F4F4F4`                                           |

> Fully scripted DOCX restyling (editing `word/styles.xml` inside the zip) is
> possible but brittle; the pragmatic path is a one-time manual restyle of the
> generated file, kept because it is git-ignored and regenerated rarely. If a
> reproducible scripted path is later required, add it to
> `scripts/export-doc.ts`.

### PPTX

```bash
DIR=.claude/assets/export
pandoc --print-default-data-file reference.pptx > "$DIR/ppcc-reference.pptx"
```

Then edit the slide master/layouts to match `presentation-standards.md` +
`ppcc-brand.md`:

- **Theme colors**: accent1 = `#FCC016`, dark1 = `#000000`, light1 = `#FFFFFF`,
  text = `#1A1A1A`, greys `#2D2D2D`/`#595959`/`#CCCCCC`/`#F4F4F4`.
- **Fonts**: heading + body = the system-sans stack (set major/minor font to a
  broadly available sans, e.g. "Segoe UI" / "Calibri" fallback).
- **Title slide layout**: black background, white title, yellow subtitle, logo
  slot top-left.
- **Section header layout**: full yellow background, black title.
- **Title-and-content layout**: headline top with a yellow rule; content area on
  a grid; footer with slide number + section.
- **Body sizes**: title 40–54pt, headline 28–34pt, body ≥ 18pt.

---

## Step 2 — Verify

```bash
# Both files exist and are valid Office (zip) containers:
file .claude/assets/export/ppcc-reference.docx
file .claude/assets/export/ppcc-reference.pptx
# Smoke-test that pandoc accepts them as references:
echo "# Test" | pandoc -o /tmp/t.docx --reference-doc=.claude/assets/export/ppcc-reference.docx
echo "# Test" | pandoc -t pptx -o /tmp/t.pptx --reference-doc=.claude/assets/export/ppcc-reference.pptx
```

If either smoke test errors, the reference file is malformed — regenerate from
the default and re-apply styles.

---

## Step 3 — Use

```bash
# DOCX export
pandoc input.md -o specs/exports/out.docx --reference-doc=.claude/assets/export/ppcc-reference.docx

# PPTX export
pandoc slides.md -t pptx -o specs/exports/presentations/out.pptx \
  --reference-doc=.claude/assets/export/ppcc-reference.pptx --slide-level=2
```

---

## When to regenerate

- A token in `@.claude/standards/ppcc-brand.md` changed.
- An official PPCC font or logo asset was added.
- The pandoc major version changed (default reference structure can shift).

Regeneration is safe and idempotent — the outputs are git-ignored.

## Cross-References

- Brand tokens: `@.claude/standards/ppcc-brand.md`
- Doc rules: `@.claude/standards/document-export-standards.md`
- Slide rules: `@.claude/standards/presentation-standards.md`
- Consumers: `@.claude/commands/export.md`,
  `@.claude/commands/create-presentation.md`
