# Document Export Standards

> **Binding rules for `/export`** when the target is a **document** (PDF, DOCX,
> HTML). Slides (PPTX / reveal.js) follow
> `@.claude/standards/presentation-standards.md` instead. Branding comes from
> `@.claude/standards/ppcc-brand.md`.

Exported documents are handed to legal, business, and audit reviewers. They must
be faithful to the Markdown source, consistently branded, and self-contained
(no broken links to files the reviewer does not have).

---

## Output Location & Naming

- All outputs go under **`specs/exports/`** (never beside the source — keeps
  binaries out of authored folders). Diagram rasters go under
  `specs/exports/diagrams/`.
- **Clean name from the source stem**: `specs/business-requirements.md` →
  `specs/exports/business-requirements.pdf`.
- **Bundled vs. separate suffix**: a single bundled document keeps the root stem
  (`business-requirements.pdf`). Separate exports of a linked set land in a
  per-source subfolder: `specs/exports/business-requirements/brd-02-...pdf`.
- Never delete or move the source `.md`. Overwrite an existing same-source
  export silently (it is a re-export); if the target name collides with an
  **unrelated** existing file, STOP and ask (mirrors `convert-to-markdown.md`).

---

## Bundling Contract (single-vs-separate)

A source `.md` often links to sibling files (e.g. `business-requirements.md`
links to `./brd/01..09.md`, `./strategy.md`, `./data-dictionary.md`). When any
**local** links are found, `/export` asks the user:

- **Single bundled document** — inline linked content into one deliverable.
- **Separate files** — one output per source `.md`, links left as-is.

**Bundling depth = ONE level.** Inline the files the root document links to
directly. Do **not** recurse into links *those* files contain (prevents pulling
in the whole doc tree and duplicating shared appendices).

**Bundling algorithm** (implemented in `scripts/export-doc.ts bundle`):

1. Determine the include set, in **document order**, de-duplicated:
   - **Index-table first.** If the root doc has Markdown **table rows**
     containing `.md` links (an index/TOC table, as `business-requirements.md`
     uses), bundle **only those** — this excludes incidental prose references
     (e.g. links to framework files, ADRs, or RTM mentioned in passing).
   - **Fallback.** If there is no such table, bundle every local `.md` link in
     the body.
   - **Explicit override.** The command may pass `--include a.md,b.md,…` (paths
     relative to the root doc) when Claude has read the index and wants precise
     control; this overrides both heuristics.
2. Resolve each against the root's directory. Skip: external URLs (`http(s)://`,
   `mailto:`), anchors-only (`#section`), non-`.md` targets, and files outside
   the repo.
3. Concatenate root + each linked file's body, in order, separated by a page
   break / `---` and an `H1`-level section title derived from the link text.
4. **Strip per-file YAML front-matter** from every inlined file (keep only the
   root's title metadata).
5. **Rewrite intra-bundle links** to in-document anchors (a link to
   `./strategy.md` becomes `#strategy`). Links to files **not** in the bundle
   stay as plain text with a "(not included)" marker rather than a dead link.
6. **Heading offset**: an inlined file's headings shift down one level so the
   bundle's outline nests correctly under its section title (the root's `H1`
   stays the document title). Never exceed `H6`.

If the root document already contains an **index table** of its sub-files (as
`business-requirements.md` does), use that table's order as the authoritative
inline order.

---

## Page & Layout (PDF / DOCX)

| Aspect | Rule |
| --- | --- |
| Page size | A4 portrait default; `--landscape` opt-in for wide tables/diagrams. |
| Margins | 20mm all sides; 25mm top on the title page. |
| Title page | Document title, subtitle, version/date/status (pulled from source front-matter or first blockquote), PPCC logo slot or wordmark. One page, then a page break. |
| TOC | Auto-generated from headings when the document has ≥ 6 headings; placed after the title page. Skip for short docs. |
| Running header/footer | Footer: document title (left), page `N of M` (right), thin `--ppcc-yellow` rule above. Header omitted on the title page. |
| Headings | `--ppcc-grey-900`; `H1`/`H2` get a `--ppcc-yellow` underline rule. |
| Body | `--ppcc-ink` on white, 11pt, 1.4 line height. |
| Tables | `--ppcc-grey-300` borders, `--ppcc-grey-100` zebra rows, bold header row on a subtle fill. Wide tables shrink-to-fit or trigger a landscape suggestion. |
| Code blocks | `--ppcc-grey-100` background, monospace, no page-break inside a short block. Syntax highlight via pandoc (`tango` style). |
| Links | External URLs printed with the URL in a footnote/appendix for PDF (so a printed copy is usable); kept clickable in DOCX/HTML. |

---

## Mermaid & Images

- **Mermaid blocks are rendered to images**, not shown as code. `/export`
  extracts each ```mermaid fence, renders it via
  `npx -y @mermaid-js/mermaid-cli` to **SVG** (crisp in PDF/HTML) or **PNG**
  (DOCX, which handles PNG most reliably), and embeds it in place.
- Every rendered diagram gets **alt text** from its `accTitle`/`accDescr`
  (per `@.claude/standards/mermaid-standards.md`) or, failing that, the nearest
  preceding heading. Never emit a diagram image with empty alt text.
- Diagrams that fail to render → leave the original code block **and** flag
  `NEEDS REVIEW` in the report rather than dropping content.
- Relative image links (`![](./img/x.png)`) are resolved against the source dir
  and embedded/copied; unresolved images are flagged, not silently dropped.

---

## Fidelity Rules

- **Never invent or drop content.** The export must contain everything in the
  source(s) at the chosen bundling depth.
- **Preserve requirement IDs, tables, and Gherkin blocks verbatim** — these are
  traceability-critical (RTM depends on them).
- Front-matter is metadata, not content: use it for the title page, then strip
  it from the body.
- If a conversion step degrades content (e.g. a huge table clipped in PDF), flag
  `NEEDS REVIEW` — do not claim success.

---

## Tooling

| Step | Tool | Notes |
| --- | --- | --- |
| Markdown → HTML / DOCX / (revealjs) | `pandoc` (≥ 3.x) | Native; DOCX via `--reference-doc=ppcc-reference.docx`. |
| HTML → PDF | **Chrome headless** `--headless --disable-gpu --print-to-pdf` | No LaTeX. Renders `ppcc-doc.css` + embedded SVG. |
| Mermaid → SVG/PNG | `npx -y @mermaid-js/mermaid-cli` | On-demand; no permanent install. |

All are **install-gated**: `/export` checks each is present and, if missing,
tells the user and asks before installing — never installs silently.

---

## Cross-References

- Command: `@.claude/commands/export.md`
- Branding: `@.claude/standards/ppcc-brand.md`
- Slides (not documents): `@.claude/standards/presentation-standards.md`
- Mermaid authoring + render note: `@.claude/standards/mermaid-standards.md`
- Orchestration script: `scripts/export-doc.ts`
- Inbound counterpart: `@.claude/commands/convert-to-markdown.md`

## Token Optimization

**Load when**: running `/export` for a document target, or editing the export
pipeline/CSS.
**Load only**: this file + `@.claude/standards/ppcc-brand.md`.
**Unload after**: the document is exported.
