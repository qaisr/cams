---
description: Import one or more public webpages OR Confluence pages from URLs into the repo as Markdown, PDF, HTML, or a PowerPoint deck — asking first for the desired format, style, image handling, and (for multiple URLs) consolidated-vs-separate. Public pages are fetched via WebFetch; Confluence pages via the Atlassian MCP server. Delegates image→Mermaid to convert-image-to-mermaid and PPTX to create-presentation.
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: medium
---

# Import Web Page

## Input

$ARGUMENTS

Examples:

- `/import-web-page https://nextjs.org/docs/app/building-your-application/caching`
- `/import-web-page https://martinfowler.com/articles/patterns-of-distributed-systems/`
- `/import-web-page https://martinfowler.com/bliki/CQRS.html --default` (all defaults, no prompts)
- `/import-web-page https://a.example/one https://b.example/two --format pptx` (multiple URLs → deck)
- `/import-web-page https://mycompany.atlassian.net/wiki/spaces/ENG/pages/12345/Design` (Confluence page → Atlassian MCP)
- `/import-web-page https://mycompany.atlassian.net/wiki/x/Fc1bBw --format pdf` (Confluence tiny link → PDF)
- `/import-web-page` (no URL → ask the user for one, then stop)

---

## Purpose

Take **one or more URLs** — public webpages **or** Confluence pages — and bring
their content into the repository as local artifacts the team can read, review,
and version — a distraction-free capture of the page(s) rather than live
bookmarks.

Two kinds of source, one pipeline:

- **Public webpage** → fetched with `WebFetch` (HTML → Markdown).
- **Confluence page** (not publicly reachable) → fetched with the **Atlassian
  MCP server** (`getConfluencePage`), which authenticates and returns the page
  body. This is the **only** difference — content acquisition. Everything
  downstream (style, format, image handling, consolidate-vs-separate, rendering)
  is identical.

The user chooses **how** it is saved (format — Markdown, PDF, HTML, or a
PowerPoint deck), **what** to keep (style), and **what to do with images**
before anything is fetched or written. When **multiple** URLs are given, the
user also chooses whether to **consolidate** them into one document or keep
**separate** files. A single run may mix public and Confluence URLs freely.
Sensible defaults let the user accept the prompt and move on.

> **Nothing is deleted.** This command only fetches the URLs given (public via
> `WebFetch`, Confluence via the Atlassian MCP server) and writes new files
> under `docs/imports/` (PowerPoint decks under
> `specs/exports/presentations/`). It never modifies existing files (except
> re-importing the same URL — see Overwrite Policy), never writes back to
> Confluence, and never touches source code.

---

## Scope & Non-Goals

- **In scope**:
  - Publicly reachable HTTP(S) pages — articles, docs, blog posts, reference
    pages, changelogs (fetched via `WebFetch`).
  - **Confluence pages** — any page/blog post URL on an Atlassian Cloud site the
    user's Atlassian MCP connection can access (fetched via the Atlassian MCP
    server). Supports full page URLs (`/wiki/spaces/<KEY>/pages/<id>/<title>`)
    and tiny links (`/wiki/x/<id>`).
- **Out of scope**:
  - **Other authenticated / private URLs** that are **not** Confluence — behind
    login, SSO, VPN-only, or non-Confluence intranet hosts (e.g. `*.ppcc`
    internal apps). `WebFetch` cannot authenticate and the Atlassian MCP server
    only serves Confluence/Jira — STOP and tell the user to save the page as a
    file and use `/convert-to-markdown` instead.
  - **Jira issues / other Atlassian content.** This command imports Confluence
    **pages** only. A Jira URL → point the user at the Atlassian tooling
    directly; do not attempt to render an issue as a "page".
  - **Non-HTML resources** given directly (a `.pdf`, `.docx`, `.png` URL). Point
    the user at `/convert-to-markdown` (documents) or
    `/convert-image-to-mermaid` (diagram images).
  - **Bulk crawling** — the command imports only the **explicit URLs** the user
    provides (one or many). It never follows links to discover further pages,
    never walks a sitemap, and never recurses into a site.

---

## Token Policy

This is an **import** command. Fetch each page once — `WebFetch` for a public
URL, `getConfluencePage` for a Confluence URL — transform it, and write the
artifact. Do not re-fetch to "double check", and do not read the written output
back in full to pad context — a lightweight sanity check (non-empty, starts with
frontmatter) is enough. For Confluence, request the body **once** in the format
you need (`markdown` for most styles; see Process Step 3) rather than fetching
multiple representations. Load `@.claude/standards/mermaid-standards.md` **only**
if the user chooses the image→Mermaid option, and only then. For the
**PowerPoint** format, hand the assembled Markdown to `/create-presentation`,
which is generation-phase and loads its own standards — do not pre-load
presentation standards here.

---

## Argument Handling

Interpret `$ARGUMENTS` as **one or more** URLs (separated by whitespace),
optionally followed by flags a power user may pass to skip prompts — see
Preference Flags.

- **One or more valid `http(s)://` URLs** → collect them all, then proceed to
  Pre-Flight. Deduplicate identical URLs and tell the user if any were dropped.
- **No argument** → ask the user for one or more public webpage or Confluence
  URLs, then stop.
- **A bare domain without scheme** (e.g. `nextjs.org/docs`) → assume `https://`
  and confirm the normalized URL(s) with the user before fetching.
- **A local path or `@file`** → this command is for URLs; point the user at
  `/convert-to-markdown` and stop.
- **A mix of URLs and non-URL tokens** → treat non-flag, non-URL tokens as
  invalid; list them and ask the user to correct, rather than guessing.

### Classify each URL — public vs Confluence

For every collected URL, decide the **source type** (this drives only the fetch
method; a single run may mix both):

- **Confluence** if the URL is an Atlassian Cloud wiki URL — the host is an
  Atlassian site (`*.atlassian.net`, or a known custom Confluence host) **and**
  the path is under `/wiki/` — either a full page URL
  (`/wiki/spaces/<SPACEKEY>/pages/<pageId>/<title>`) or a tiny link
  (`/wiki/x/<id>`). Extract the **cloud site host** (pass it as `cloudId` — the
  Atlassian tools accept the site URL) and the **pageId** (the numeric id from
  `/pages/<pageId>/`, or the tiny-link id after `/wiki/x/`).
- **Public** otherwise — a normal HTTP(S) page fetched with `WebFetch`.

If a URL looks like Atlassian but is a **Jira** issue (`/browse/<KEY>` or
`/jira/`), treat it as out-of-scope (see Scope & Non-Goals) — list it and ask
the user to remove it, rather than guessing a page.

Record the resolved source type per URL; the report notes each source's origin.

### Preference Flags (optional — skip the prompts)

If the user already knows what they want, they may pass flags and the command
skips the matching question:

- `--default` (or `-d`) — use the **default** for all preferences (Markdown
  · key concepts · ignore images; and for multiple URLs, **separate** files) and
  ask **nothing**. Proceed straight to fetch. If combined with any individual
  flag below, the individual flag wins for that one preference and the rest stay
  at their defaults.
- `--format markdown|pdf|html|pptx`
- `--style key-concepts|summary|full` — **ignored for `pptx`**, which is always
  key concepts (see Question 2). If `--style` conflicts with `--format pptx`,
  honor pptx's fixed style and note the override.
- `--images ignore|save|mermaid`
- `--consolidated` | `--separate` — for **multiple** URLs, whether to merge into
  one artifact or keep one per URL. Ignored (and irrelevant) for a single URL.
  **`pptx` is always consolidated** into one deck regardless of this flag.

Any preference **not** supplied by a flag (and without `--default`/`-d`) is
still asked. If every applicable preference is supplied — or `--default`/`-d` is
present — ask nothing and proceed straight to fetch.

---

## Pre-Flight

### Step 0: Validate & classify each URL

1. Confirm each argument parses as an `http(s)://` URL and classify it as
   **public** or **Confluence** per Argument Handling → Classify each URL.
2. Reject / STOP with guidance for the out-of-scope cases above (non-Confluence
   authenticated URL, Jira issue, non-HTML resource, local path).
3. **Public URLs**: if the host is obviously an **internal, non-Confluence** host
   (`*.ppcc`, `*.internal`, private IP ranges), STOP — `WebFetch` upgrades to
   HTTPS and cannot reach authenticated intranet content. Suggest saving the
   page and using `/convert-to-markdown`.
4. **Confluence URLs**: confirm the Atlassian MCP server is connected before
   fetching. If **no** `getConfluencePage` (or equivalent Atlassian) tool is
   available, STOP for those URLs and tell the user the Atlassian MCP server is
   not connected — public URLs in the same run can still proceed. If the user's
   Atlassian connection spans **multiple sites**, use the site host from each URL
   as the `cloudId`; only call `getAccessibleAtlassianResources` if a fetch fails
   with an ambiguous-site error.

### Step 1: Tooling gate — only for the chosen format

Markdown needs **no** external tooling. Check tooling **after** the format is
chosen (Step 2 of Process), and only for that format. Never install silently —
ask first.

| Chosen format | Needs | Check | If missing |
| --- | --- | --- | --- |
| Markdown (default) | — | — | — |
| HTML | `pandoc` | `command -v pandoc` | Ask to `brew install pandoc`, or offer Markdown instead. |
| PDF | `pandoc` + Google Chrome (headless) | `command -v pandoc`; Chrome at the standard macOS path or `$CHROME_PATH` | Ask; or offer HTML / Markdown and let the user print to PDF. |
| PowerPoint (pptx) | handled by `/create-presentation` | — (its own Pre-Flight checks `pandoc` + the PPCC `.pptx` template) | `/create-presentation` prompts/installs as needed — do not duplicate the check here. |

> HTML and PDF reuse the **same PPCC-branded pipeline as `/export`**
> (`scripts/export-doc.ts` `md2html` / `md2pdf`), so imported pages look
> consistent with other exported deliverables. **PowerPoint** is delegated
> wholesale to `/create-presentation` (PPCC slide styling + outline confirmation).

---

## Gather Preferences (ask BEFORE fetching)

Use **one** `AskUserQuestion` call with the questions below that still apply
(omit any question already answered by a flag; omit Question 4 for a single URL;
apply the `pptx` special-cases noted per question). Present the **default**
option first and label it `(Recommended)`.

### Question 1 — Import Format

| Option | Meaning |
| --- | --- |
| **Markdown (Recommended)** | Write a `.md` file under `docs/imports/`. No tooling required. |
| PDF | Produce Markdown, then render a PPCC-branded PDF via `export-doc.ts md2pdf`. |
| HTML | Produce Markdown, then render a PPCC-branded standalone HTML via `export-doc.ts md2html`. |
| PowerPoint (pptx) | Extract the key concepts, then build a professional, PPCC-branded slide deck via `/create-presentation`. **Forces the *key concepts* style** and, for multiple URLs, a **single consolidated** deck. |

### Question 2 — Import Style

> **PowerPoint skips this question.** A `pptx` import is **always** *key concepts
> & important information* — a deck is a distillation, not a full-page or
> summary-prose dump. If the format is `pptx`, do not ask Question 2; set the
> style to key concepts and move on.

| Option | Meaning |
| --- | --- |
| **Key concepts & important information (Recommended)** | Extract the page's key ideas, definitions, and the information that matters — dropping nav chrome, ads, cookie banners, and boilerplate. Retains structure (headings, lists, code, essential tables). |
| Short summary | A concise summary of the page, with bullet points where they aid clarity. Shortest output. |
| Full page, as-is | The complete page content, faithfully, in reading order — chrome and boilerplate still stripped, but no summarization or omission of substantive content. |

### Question 3 — Image Handling *(ask ONLY if any page contains images)*

Do **not** ask this question if no page has meaningful `<img>` content.
Detect image presence during the fetch reconnaissance (Process Step 3); if you
must know before asking, do a first lightweight `WebFetch` per URL to list
images (see Process Step 3), then ask.

| Option | Meaning |
| --- | --- |
| **Ignore all images (Recommended)** | Reference no images. Where an image conveyed meaning, keep a short bracketed note like `[image: architecture diagram]` so context isn't lost. |
| Save images as-is | Download each image to `docs/imports/<slug>-assets/` and link it from the Markdown with its alt text. |
| Convert images to Mermaid where possible | For each image that is a **diagram** (architecture, flowchart, sequence, ER, state, DFD), reproduce it as portable Mermaid per `@.claude/commands/convert-image-to-mermaid.md`. Non-diagram images fall back to the *Save images as-is* behavior (and are noted as such). |

### Question 4 — Consolidate or Separate *(ask ONLY if there are 2+ URLs)*

Do **not** ask this question for a single URL. For `pptx`, do **not** ask —
a deck is always consolidated; note that in the resolved-choices echo.

| Option | Meaning |
| --- | --- |
| **Separate files (Recommended)** | Import each URL into its own artifact under `docs/imports/` (one `.md`, and one rendered `.pdf`/`.html` each). |
| Consolidate into one document | Merge all pages into a **single** artifact — each page becomes a top-level section (`# <page title>`), in the order the URLs were given, with a short source line under each. One combined `.md` (+ one `.pdf`/`.html`). |

If every applicable preference arrived via flags, skip this section entirely.

---

## Process

### Step 1: Resolve preferences

Combine flags + `AskUserQuestion` answers into a settled `{format, style,
images, layout}` (where `layout` is `separate` | `consolidated`, only meaningful
for 2+ URLs). Apply the `pptx` overrides:

- If `format = pptx` → force `style = key-concepts` and `layout = consolidated`
  (a deck is always one distillation), regardless of any conflicting flag; note
  any override in the echo.
- If a single URL → `layout` is irrelevant; omit it.

Echo the resolved choices back in one line so the user sees what will happen,
e.g. _"Importing 3 pages as a PowerPoint deck · key concepts · ignore images ·
consolidated"_ or _"Importing as Markdown · key concepts · ignore images"_.

### Step 2: Tooling gate for the chosen format

Run the Pre-Flight Step 1 check for the **chosen** format only. If tooling is
missing, ask before installing or offer a fallback format. Do not proceed to a
PDF/HTML render you cannot complete.

### Step 3: Fetch & reconnoiter each page

Process each URL in turn (independent fetches may run in parallel). The fetch
**method** depends on the source type from Step 0; everything after fetch is
identical for both. For `pptx`, use the **key concepts** treatment for every
page regardless of source.

#### 3a. Public URLs — `WebFetch`

Use `WebFetch` with a prompt tailored to the chosen **style**. `WebFetch`
converts the page to Markdown and answers a prompt against it — craft the prompt
so the returned content already matches the requested style:

- **Key concepts** → prompt: _"Extract the key concepts, definitions, and
  important information from this page. Preserve headings, lists, code blocks,
  and essential tables. Omit navigation, ads, cookie/consent banners, footers,
  and unrelated boilerplate. Return clean Markdown."_
- **Short summary** → prompt: _"Summarize this page concisely. Lead with a short
  prose summary, then bullet points for the key takeaways where they aid
  clarity. Return Markdown."_
- **Full page, as-is** → prompt: _"Return the full main content of this page as
  faithful Markdown in reading order. Preserve all headings, paragraphs, lists,
  code blocks, and tables. Strip only navigation, ads, cookie/consent banners,
  and site chrome — do not summarize or omit substantive content."_

Capture the page **title**, the **canonical URL** (follow one redirect if
`WebFetch` returns a cross-host redirect — call it again with the redirect URL),
and an inventory of **images** if needed (see "Both" below).

> **Cross-host redirects.** `WebFetch` returns (does not follow) cross-host
> redirects. If you get one, re-invoke `WebFetch` with the redirect URL. Record
> the final URL as the canonical source.

#### 3b. Confluence URLs — Atlassian MCP (`getConfluencePage`)

Call `getConfluencePage` with the `cloudId` (the site host from the URL) and
`pageId` (the numeric page id, or the tiny-link id — the tool accepts a tiny
link id directly). Request the body as **`markdown`** (`contentFormat: markdown`)
so it drops straight into the pipeline; only request `html`/`adf` if you need to
faithfully preserve rich macros the user asked to keep. The response gives you
the page **title** and body; the **canonical URL** is the original URL the user
supplied (no redirect handling needed).

`getConfluencePage` returns the **already-clean** page body — there is no nav
chrome, ads, or cookie banners to strip. Apply the chosen **style** to that body
yourself (do not re-fetch):

- **Full page, as-is** → use the returned Markdown body verbatim (only normalize
  obvious artifacts, e.g. empty macro placeholders).
- **Key concepts** → distill the returned body to its key concepts, definitions,
  and important information; preserve headings, lists, code blocks, and essential
  tables.
- **Short summary** → write a concise summary of the returned body, with bullets
  where they aid clarity.

Confluence images/attachments appear as image nodes in the body. Inventory them
(src/attachment + alt text) the same as public images; handle per Step 4. If an
image is a Confluence **attachment** requiring auth to download, prefer the
*ignore* fallback with a `[image: …]` marker unless the user chose save/mermaid —
and if a save/mermaid download needs auth `curl` can't provide, fall back to the
marker and note it under Review Required.

> **Comments, versions, restricted pages.** Import only the page **body** — not
> comments or version history (out of scope). If `getConfluencePage` returns a
> permission/not-found error, the user's connection can't see that page: skip it
> and list it under Review Required (do not present an error stub as content).

#### Both — resilience & image inventory

Also capture an inventory of **images** (src + alt text) for every page if image
handling is anything other than the default *ignore*, or if you still need to
decide whether to ask Question 3.

If one URL among several fails (public: unreachable, paywalled, consent-walled,
or thin SPA output; Confluence: permission denied, not found, or MCP error), do
**not** abort the whole run — skip that URL, continue with the rest, and list the
failure under Review Required in the final report.

### Step 4: Handle images per the chosen mode

- **Ignore (default)** — do not download anything. Replace meaningful images
  with a short `[image: <alt or brief description>]` marker inline so the reader
  knows something was there.
- **Save as-is** — create `docs/imports/<slug>-assets/`, download each image
  (`curl -fsSL "<img-url>" -o "<assets>/<n>-<clean-name>.<ext>"`), and link it in
  the Markdown as `![alt](./<slug>-assets/<file>)`. Skip images that fail to
  download and list them under Review Required. Do not download tracking pixels
  or 1×1 spacers.
- **Convert to Mermaid** — for each image, decide if it is a **diagram**:
  1. If it is a diagram, follow `@.claude/commands/convert-image-to-mermaid.md`
     and `@.claude/standards/mermaid-standards.md` (load the standard **in
     full** now): download the image, read it with the `Read` tool (multimodal),
     classify the diagram type, reproduce it faithfully as portable Mermaid, and
     embed the ```mermaid block inline where the image appeared. Add a
     `%% REVIEW:` note for any illegible label.
  2. If it is **not** a diagram (photo, screenshot, logo, decorative), fall back
     to *Save as-is* for that image and note it under Review Required.

### Step 5: Assemble the Markdown artifact(s)

Compute a **slug** for each page from its title or the last meaningful URL path
segment (kebab-case, lowercased, ASCII). Create `docs/imports/` if it does not
exist.

**Separate (default, and every single-URL import).** Write one
`docs/imports/<slug>.md` **per page** with per-page frontmatter:

```markdown
---
source_url: <final canonical URL>
source_type: public | confluence
imported_by: import-web-page
imported_at: <UTC ISO-8601 timestamp>
import_style: key-concepts | summary | full
import_format: markdown | pdf | html | pptx
images: ignore | save | mermaid
title: <page title>
---

# <Page title>

> Imported from <final canonical URL> on <date> · style: <style> · source: <public page | Confluence>.
> This is a point-in-time capture — the live page may have changed.

<the styled content, with images handled per Step 4>
```

**Consolidated (2+ URLs, when chosen — and always for `pptx`).** Write a
**single** `docs/imports/<combined-slug>.md` (derive `<combined-slug>` from a
short user-meaningful theme, or fall back to `imported-<n>-pages`). Use one
frontmatter block listing all sources, then each page as a top-level `#`
section in URL order:

```markdown
---
source_urls:
  - url: <final canonical URL 1>
    type: public | confluence
  - url: <final canonical URL 2>
    type: public | confluence
imported_by: import-web-page
imported_at: <UTC ISO-8601 timestamp>
import_style: key-concepts | summary | full
import_format: markdown | pdf | html | pptx
images: ignore | save | mermaid
layout: consolidated
title: <combined title>
---

# <Page 1 title>

> Imported from <URL 1> on <date> · style: <style>.

<page 1 content>

# <Page 2 title>

> Imported from <URL 2> on <date> · style: <style>.

<page 2 content>
```

For `pptx`, this consolidated `.md` is the **source handed to
`/create-presentation`** (Step 6); it still lives in `docs/imports/` as the
editable provenance record.

**Overwrite policy.** If the target `.md` already exists and its `source_url:` /
`source_urls:` frontmatter matches this import, it is a **re-import** — overwrite
it (and regenerate any `<slug>-assets/` if saving images). If it exists with
**no** frontmatter or a **different** source, treat it as a collision — STOP for
that target and ask the user to rename or clear it, or disambiguate the slug.

### Step 6: Render the chosen format

For **separate** layout, render **each** `.md`; for **consolidated**, render the
single combined `.md`.

- **Markdown** — done at Step 5; the `.md`(s) **are** the deliverable.
- **HTML** — render the PPCC-branded standalone HTML for each source `.md`:

  ```bash
  tsx scripts/export-doc.ts md2html "docs/imports/<slug>.md" --out "docs/imports/<slug>.html" --title "<title>"
  ```

- **PDF** — render the PPCC-branded PDF (pandoc → HTML → Chrome print) for each
  source `.md`:

  ```bash
  tsx scripts/export-doc.ts md2pdf "docs/imports/<slug>.md" --out "docs/imports/<slug>.pdf" --title "<title>"
  ```

- **PowerPoint (pptx)** — delegate the **consolidated** `.md` from Step 5 to
  `/create-presentation`, which plans an outline, confirms it with the user, and
  renders a PPCC-branded deck to `specs/exports/presentations/`:

  ```text
  /create-presentation docs/imports/<combined-slug>.md --format pptx
  ```

  Pass a brief alongside the path so the deck is framed as an imported-content
  walkthrough (e.g. audience business unless the user said otherwise). Let
  `/create-presentation` own slide styling, the outline-confirmation step, and
  diagram rendering — do **not** re-implement slide authoring here. The deck's
  editable `.slides.md` and the `.pptx` both land under
  `specs/exports/presentations/`; the imported `.md` remains in `docs/imports/`
  as the provenance source.

For PDF/HTML the intermediate `.md`(s) are kept alongside the rendered file(s) —
the editable source and provenance record. Any inline Mermaid is rendered by
`export-doc.ts` (and by `/create-presentation` for decks) automatically.

### Step 7: Verify

- Every written `.md` is non-empty and starts with the frontmatter block.
- For **consolidated**: the combined `.md` contains one `#` section per
  successfully-fetched URL, in order.
- For **save-images**: the `<slug>-assets/` directory holds the expected files;
  list any that failed.
- For **mermaid**: each embedded ```mermaid block passes the
  `mermaid-standards.md` Correctness & Portability checklist (balanced brackets,
  closed subgraphs, portable syntax, `accTitle`/`accDescr`). Flag anything that
  could not be reproduced faithfully as `NEEDS REVIEW`.
- For **PDF/HTML**: each rendered file exists and is non-empty.
- For **pptx**: `/create-presentation` reports success and the `.pptx` exists
  under `specs/exports/presentations/` (that command runs its own verify + Quality
  Rubric — surface its result rather than re-checking slides here).

If a step produced empty or obviously broken output, report it as `NEEDS
REVIEW` rather than claiming success.

### Step 8: Report

Show one row per source URL. For **consolidated** / **pptx**, list each source
URL against the single combined output.

```markdown
## Web Page Import Complete

Format: <markdown|pdf|html|pptx> · Style: <style> · Images: <mode> · Layout: <separate|consolidated|n/a>

| Source URL | Source | Output | Status |
|---|---|---|---|
| <final URL 1> | public | docs/imports/<slug1>.md (+ .pdf/.html / -assets/) | OK |
| <final URL 2> | Confluence | docs/imports/<slug2>.md | OK |
| <final URL 3> | Confluence | (skipped — no access) | SKIPPED |

<!-- pptx example:
| <URL 1> | public | specs/exports/presentations/<stem>.pptx (source: docs/imports/<combined-slug>.md) | OK |
| <URL 2> | Confluence | ↑ consolidated into the same deck | OK |
-->

### Review Required
- <skipped/failed URL · Confluence permission/not-found · Atlassian MCP not connected · failed image download · non-diagram fallback · illegible Mermaid label · redirect note> — or "(none)"

### Next Step
- Open the output(s) and review against the live page(s) — a point-in-time
  capture; re-run the command on the same URL(s) to refresh.
- **pptx**: refine the deck with `/audit-presentation <deck>`; the editable
  outline is at `specs/exports/presentations/<stem>.slides.md`.
```

---

## Notes & Edge Cases

- **Point-in-time capture.** The import reflects the page at fetch time. The
  frontmatter records `source_url` + `imported_at`; re-running refreshes it. For
  Confluence, this captures the **current** page version — not a specific
  historical version.
- **Confluence = fetch method only.** The Atlassian MCP path changes *how* the
  content is acquired; style, format, image handling, consolidate/separate,
  rendering, overwrite policy, and reporting are all identical to a public page.
  A single run may freely mix public and Confluence URLs.
- **Atlassian MCP not connected.** If no `getConfluencePage`/Atlassian tool is
  available, skip Confluence URLs (report them under Review Required) but still
  process any public URLs in the same run. Tell the user to connect the Atlassian
  MCP server to import Confluence pages.
- **Restricted / not-found Confluence page.** A permission or not-found error
  means the user's Atlassian connection cannot see that page — skip it and note
  it; never present the error payload as page content.
- **Confluence macros.** Requesting the body as `markdown` flattens most macros
  to text/tables. If the user needs a rich macro preserved faithfully, request
  the body as `html` for that page and note that some interactive macros can't
  be reproduced in a static import.
- **Never writes back.** This command only **reads** from Confluence; it never
  creates, updates, or comments on a Confluence page.
- **Paywalled / consent-walled public pages.** If `WebFetch` returns a consent
  wall or paywall stub instead of content, STOP and tell the user — do not
  present the stub as the page. Suggest they save the page locally and use
  `/convert-to-markdown`.
- **JS-rendered SPAs.** `WebFetch` sees server-rendered HTML; a client-only SPA
  may return little content. If the output is suspiciously thin, flag it as
  `NEEDS REVIEW` and suggest the save-locally + `/convert-to-markdown` path.
- **Large pages.** For *full page* style on a very long page, keep structure and
  code intact; do not truncate silently — if the content is enormous, note it
  and offer to split, rather than dropping the tail without saying so.
- **Robots / terms.** Import only pages the user is entitled to read. This
  command fetches the exact pages the user provided; it does not crawl or follow
  links.
- **Multiple URLs, partial failure.** A run continues past a URL that fails;
  successful pages are still written and failures are listed under Review
  Required. It only STOPs before writing anything if the *arguments themselves*
  are invalid (e.g. non-URL tokens, or a collision on a target file).
- **Consolidation order.** Consolidated documents preserve the **order the URLs
  were given**, one `#` section per page — not fetch-completion order.
- **PowerPoint is always key concepts + consolidated.** A deck distills; it is
  never a full-page or per-URL dump. `/create-presentation` confirms the slide
  outline with the user before rendering, so the deck step is interactive by
  design.
- **Idempotent.** Re-running on the same URL(s) overwrites the same-source
  artifact (and re-renders the chosen format); a `pptx` re-run regenerates the
  consolidated source `.md` and re-invokes `/create-presentation`.

---

## Cross-References

- Image → Mermaid conversion (binding when `--images mermaid`):
  `@.claude/commands/convert-image-to-mermaid.md`
- Mermaid authoring standard (binding for any emitted diagram):
  `@.claude/standards/mermaid-standards.md`
- Confluence content acquisition: Atlassian MCP server `getConfluencePage`
  (public pages use `WebFetch`)
- Rendering pipeline reused for PDF/HTML: `scripts/export-doc.ts` (via
  `@.claude/commands/export.md`)
- Export branding standards: `@.claude/standards/document-export-standards.md` +
  `@.claude/standards/ppcc-brand.md`
- Local-document counterpart (not URLs): `@.claude/commands/convert-to-markdown.md`
