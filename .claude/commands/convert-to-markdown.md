---
description: Convert source documents (docx, pptx, pdf, xlsx, xlsm, xls, and more) into Markdown so /create-specifications can ingest them losslessly.
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: medium
---

# Convert To Markdown

## Input

$ARGUMENTS

Examples:

- `/convert-to-markdown @raw-requirements/`
- `/convert-to-markdown @raw-requirements/ISDA_Product_Mapping.xlsx`
- `/convert-to-markdown @docs/input/`

---

## Purpose

Convert every non-Markdown, non-CSV source document in a folder (or a single
file) into Markdown, in place, so that downstream commands — chiefly
`/create-specifications` — can read the full content. The `Read` tool cannot
parse binary Office/PDF formats (`.docx`, `.pptx`, `.xlsx`, `.xlsm`, `.xls`),
so those must be converted first or their requirements are silently lost.

Each converted file:

- keeps a **clean name** (`ISDA_Product_Mapping.xlsx` → `ISDA_Product_Mapping.md`)
- carries **YAML frontmatter** recording the original file, converter, and
  timestamp (plus sheet names for Excel), so cross-references from other
  documents that still name the original file resolve correctly
- is written **next to the original** — nothing is ever deleted or moved

> **Nothing is deleted.** Originals and any `.md`/`.csv` files are left
> untouched. The user removes or archives raw originals manually, once they are
> confident the generated specifications are correct.

---

## Token Policy

This is a **conversion** command, not an analysis one. Do not read the full
content of every converted document into context — the goal is to produce the
Markdown files on disk and report a summary table. Read file content only when
you need to sanity-check a conversion (e.g. an Excel workbook whose output looks
suspicious).

---

## Argument Handling

Interpret `$ARGUMENTS` as exactly one source path.

- **File path** → convert that one file (if it is a convertible type).
- **Directory path** → recursively find every convertible file inside it.
- **No argument** → ask the user for a file or directory path, then stop.

### File classification

| Class | Extensions | Action |
|---|---|---|
| Skip — already ingestible | `.md`, `.csv` | Leave untouched (Read handles both natively). |
| Convert — Excel path | `.xlsx`, `.xlsm`, `.xls` | Dedicated script `scripts/xlsx-to-csv.py` → **one CSV per sheet + a Markdown index** (not inline tables). Same behaviour as `/convert-excel-to-csv`. |
| Convert — markitdown path | `.docx`, `.pptx`, `.pdf`, `.doc`, `.ppt`, `.html`, `.htm`, `.rtf`, `.odt`, `.epub`, and other office/text types markitdown supports | `uvx --from 'markitdown[all]' markitdown` |
| Skip — not a document | images, archives, binaries with no textual requirements | Skip; list under "Not Converted". |

> **Why Excel is different.** Markdown tables are hugely verbose for wide
> sheets — a single large workbook can produce 25k+ Markdown lines, which
> overwhelms downstream context. Excel is therefore split into compact
> per-sheet CSVs plus a small `.md` index that links to them. Every other format
> becomes a single Markdown file.

If unsure whether a type carries requirements, ask the user rather than
skipping silently.

---

## Pre-Flight

### Step 0: Ensure `uv` is installed

`uv` (and its `uvx` runner) is the only prerequisite — it provisions both
`markitdown` and the Excel script's (`scripts/xlsx-to-csv.py`) `openpyxl`
dependency ephemerally, so no system Python packages are required.

1. Check: run `command -v uv`.
2. If **present** → continue.
3. If **missing** → do **not** install silently. Tell the user `uv` is required
   and ask permission to install it with the official installer:

   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

   Only run this after the user confirms. After install, `uv` lands in
   `~/.local/bin`; if `command -v uv` still fails in the current shell, tell the
   user to add `~/.local/bin` to `PATH` (or restart the shell) and re-run.

Do **not** pre-install or warm any package cache beyond this — `uvx` and
`uv run` fetch what they need on first use.

---

## Process

### Step 1: Build the conversion inventory

Enumerate the target path and classify every file. Produce an inventory:

| File | Ext | Class | Target `.md` | Extra output | Notes |
|---|---|---|---|---|---|
| ISDA_Product_Mapping.xlsx | .xlsx | Excel | ISDA_Product_Mapping.md (index) | ISDA_Product_Mapping/ (CSVs) | 14 sheets |
| CBA_CANS_Business_Requirements.docx | .docx | markitdown | CBA_CANS_Business_Requirements.md | — | |
| Murex_EOD_Feed__Report.csv | .csv | skip | — | — | Read handles natively |

### Step 2: Collision check (STOP on clash)

Because converted files use **clean names**, two source files whose stems match
(e.g. `report.docx` and `report.xlsx`) would both target `report.md`. Excel
files additionally claim a `<stem>/` directory for their per-sheet CSVs.

- Compute the target `.md` name for every convertible file, **plus** the
  `<stem>/` CSV directory for every Excel file.
- Detect collisions where:
  - **two or more source files** map to the same target `.md`, **or**
  - a target `.md` already exists **as a conversion of a different source**
    (check its `source_file:` frontmatter), **or**
  - an Excel file's `<stem>/` directory already exists holding **unrelated**
    files (not a prior conversion of the same workbook).
- If any collision exists → **STOP**. Do not convert anything. Print the
  clashing groups and ask the user to rename the offending source files first,
  then re-run.

A target `.md` (or `<stem>/` dir) that is an **existing conversion of the same
source** is **not** a collision — it is a re-conversion (handled in Step 3,
Overwrite Policy).

### Step 3: Convert each file

Process convertible files one at a time. For each:

**Excel (`.xlsx` / `.xlsm` / `.xls`) — CSV-per-sheet + index:**

```bash
uv run scripts/xlsx-to-csv.py "<source>"
```

- Defaults write `<stem>.md` (the index) and `<stem>/` (the CSV directory) next
  to the source — no flags needed. Override with `--index` / `--csv-dir` if
  outputs must go elsewhere.
- The script opens workbooks with `data_only=True` and `keep_vba=False`: it
  reads **cached cell values only** and **never executes VBA** — safe for
  `.xlsm` macro workbooks.
- It writes one CSV per sheet (`NN-<slug>.csv`, workbook order) and a Markdown
  **index** with frontmatter (`source_file`, `converted_by`, `converted_at`,
  `format: csv-per-sheet`, `csv_dir`, `sheets`) plus a table linking each sheet
  to its CSV. The index writes its own frontmatter — do **not** add a second
  block.
- This is identical to running `/convert-excel-to-csv` on the file.

**Everything else (markitdown):**

```bash
uvx --from 'markitdown[all]' markitdown "<source>" -o "<target>.md"
```

Then **prepend YAML frontmatter** to the markitdown output (markitdown does not
add it):

```yaml
---
source_file: <original filename with extension>
converted_by: markitdown
converted_at: <UTC ISO-8601 timestamp>
---
```

(The Excel script writes its own frontmatter, including `sheets:` — do not add a
second block for Excel outputs.)

**Overwrite policy (per file):** if the target `.md` already exists and its
`source_file:` frontmatter matches the current source, it is a re-conversion —
overwrite it, and for Excel regenerate the `<stem>/` CSV directory (the source
is authoritative). If it exists but has **no** frontmatter or a **different**
`source_file:`, treat it as a collision per Step 2 and STOP for that file.

### Step 4: Verify each conversion

Do a lightweight sanity check per output (do not load full content):

- Markitdown outputs: the `.md` is non-empty and starts with the frontmatter
  block.
- Excel outputs: the index `.md` starts with frontmatter, its sheet-table row
  count equals the workbook's sheet count, and the `<stem>/` directory contains
  one `.csv` per sheet.
- If a conversion produced empty or obviously broken output, flag it in the
  report as `NEEDS REVIEW` rather than claiming success.

### Step 5: Report

Print a summary table and a short next-step:

```markdown
## Conversion Complete

| Source | Output | Converter | Sheets | Status |
|---|---|---|---|---|
| ISDA_Product_Mapping.xlsx | ISDA_Product_Mapping.md + ISDA_Product_Mapping/ (14 CSVs) | xlsx-to-csv.py | 14 | OK |
| CBA_CANS_Business_Requirements.docx | CBA_CANS_Business_Requirements.md | markitdown | — | OK |

### Skipped (already ingestible)
- Murex_EOD_Feed__Report.csv (.csv — Read handles natively)

### Not Converted
- (none)

### Next Step
Run `/create-specifications @<folder>` to generate specifications from the
converted Markdown. Originals are preserved — remove or archive them yourself
once the generated specs are verified.
```

---

## Notes & Edge Cases

- **Cross-references between documents.** Documents such as
  `CBA_CANS_Business_Requirements.docx` refer to other files by their original
  names (e.g. "see ISDA_Product_Mapping.xlsx"). The `source_file:` frontmatter
  in each converted `.md` is the bridge: `/create-specifications` builds a
  `source_file → .md` map to resolve those references even though the on-disk
  file is now `ISDA_Product_Mapping.md`.
  For Excel, the index `.md` carries the `source_file:` frontmatter, so
  references to `ISDA_Product_Mapping.xlsx` resolve to `ISDA_Product_Mapping.md`
  (which in turn links to the per-sheet CSVs).
- **Excel → CSV-per-sheet.** Excel files are split into compact per-sheet CSVs
  plus a small `.md` index (see the `/convert-excel-to-csv` command, which uses
  the same script). This avoids the tens-of-thousands-of-lines problem inline
  Markdown tables cause for wide workbooks.
- **`.xlsm` macros.** Never executed. The Excel script loads data only. Do not
  attempt to run or extract VBA.
- **Large PDFs.** markitdown handles them, but tables may extract imperfectly.
  Flag any PDF whose output looks garbled as `NEEDS REVIEW`.
- **Idempotent.** Re-running on a folder re-converts sources whose `.md` already
  maps back to them (frontmatter match) and leaves `.md`/`.csv` untouched.

---

## Cross-References

- Consumed by: `@.claude/commands/create-specifications.md` (guards on
  unconverted extensions and stale conversions; reads Excel indexes + CSVs)
- Excel-only entry point: `@.claude/commands/convert-excel-to-csv.md`
- Excel converter script: `scripts/xlsx-to-csv.py`
- Tooling: `uv` / `uvx` (https://astral.sh/uv), `markitdown` (Microsoft)
