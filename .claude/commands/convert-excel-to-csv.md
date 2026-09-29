---
description: Convert Excel workbooks (xlsx, xlsm, xls) into one CSV per sheet plus a Markdown index — the manual entry point for Excel-only conversion.
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# Convert Excel To CSV

## Input

$ARGUMENTS

Examples:

- `/convert-excel-to-csv @raw-requirements/ISDA_Product_Mapping.xlsx`
- `/convert-excel-to-csv @raw-requirements/`
- `/convert-excel-to-csv @data/workbooks/`

---

## Purpose

Convert Excel workbooks to **one CSV file per sheet**, plus a Markdown **index**
that links to each CSV. This is the standalone, manual entry point for Excel →
CSV conversion; `/convert-to-markdown` calls the same underlying script for any
Excel files it encounters, so the output is identical either way.

**Why CSV-per-sheet instead of one big Markdown file:** Markdown tables are very
verbose for wide sheets — a single large workbook can explode into tens of
thousands of Markdown lines (e.g. one real workbook produced 27k+ lines). CSV is
compact, the `Read` tool parses it natively, and per-sheet files let downstream
commands load only the sheets they need. Empty and huge sheets stay isolated.

Output for `ISDA_Product_Mapping.xlsx` (14 sheets):

```
raw-requirements/
  ISDA_Product_Mapping.md            ← index: frontmatter + sheet→CSV table
  ISDA_Product_Mapping/              ← one CSV per sheet, workbook order
    01-SignedOFF.csv
    02-Pivot-Typologies.csv
    ...
    14-GMDI-Agreements3pm-20240821.csv
```

> **Nothing is deleted.** The original workbook is left untouched. Only the
> `.md` index and the `<stem>/` CSV directory are written.

---

## Token Policy

This is a **conversion** command. Do not read the CSV contents into context —
produce the files and report a summary. Read a CSV only to sanity-check a
suspicious conversion.

---

## Argument Handling

Interpret `$ARGUMENTS` as one source path.

- **File** ending in `.xlsx` / `.xlsm` / `.xls` → convert that workbook.
- **Directory** → find every `.xlsx` / `.xlsm` / `.xls` inside it (recursively)
  and convert each. Ignore all other file types.
- **No argument** → ask the user for a path, then stop.
- **A non-Excel file** → tell the user this command handles Excel only, and
  point them at `/convert-to-markdown` for other formats.

---

## Pre-Flight

### Ensure `uv` is installed

`uv` is the only prerequisite — it provisions the script's `openpyxl` dependency
ephemerally, so no system Python packages are required.

1. Check: `command -v uv`.
2. If **present** → continue.
3. If **missing** → do **not** install silently. Ask permission to install:

   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

   Only run after the user confirms. `uv` lands in `~/.local/bin`; if it is
   still not found, tell the user to add that to `PATH` or restart the shell.

---

## Process

### Step 1: Inventory

List every target workbook and its intended outputs:

| Workbook | Index `.md` | CSV dir | Notes |
|---|---|---|---|
| ISDA_Product_Mapping.xlsx | ISDA_Product_Mapping.md | ISDA_Product_Mapping/ | |

### Step 2: Collision check (STOP on clash)

Both the index `.md` and the CSV directory use the workbook's clean stem.

- For each workbook `X.ext`, the targets are `X.md` and `X/`.
- If `X.md` already exists with `source_file:` frontmatter pointing at a
  **different** source, or `X/` already exists holding unrelated files → **STOP**
  and ask the user to rename the workbook or clear the target, then re-run.
- If `X.md` is an existing conversion of the **same** `X.ext` → it is a
  re-conversion; overwrite (see Step 4).

### Step 3: Convert

For each workbook:

```bash
uv run scripts/xlsx-to-csv.py "<workbook>"
```

Defaults (no flags needed): writes `<stem>.md` index and `<stem>/` CSV dir next
to the workbook. To place outputs elsewhere:

```bash
uv run scripts/xlsx-to-csv.py "<workbook>" --index "<path.md>" --csv-dir "<dir>"
```

The script:

- opens with `data_only=True, keep_vba=False` — reads **cached cell values
  only** and **never executes VBA** (safe for `.xlsm` macro workbooks);
- writes one CSV per sheet, in workbook order, named `NN-<slugified-sheet>.csv`;
- trims empty edge rows/columns; preserves commas, quotes, and in-cell newlines
  via proper CSV quoting;
- writes the `.md` index with frontmatter (`source_file`, `converted_by`,
  `converted_at`, `format: csv-per-sheet`, `csv_dir`, `sheets`) and a table
  linking each sheet to its CSV with row/column counts.

**Small-workbook alternative.** For a tiny workbook where a single Markdown file
with inline tables is more convenient than a CSV folder, pass
`--inline-markdown` (optionally with `--output <path.md>`). Default remains
CSV-per-sheet.

### Step 4: Overwrite policy

If the index `.md` already exists and its `source_file:` matches the current
workbook, it is a re-conversion — overwrite the index and regenerate the CSV
directory. Otherwise treat as a collision (Step 2).

### Step 5: Verify

For each workbook, sanity-check without loading full data:

- the index `.md` exists, starts with frontmatter, and its sheet-table row count
  equals the workbook's sheet count;
- the CSV directory exists and contains one `.csv` per non-skipped sheet;
- flag any conversion that produced zero CSVs or an empty index as
  `NEEDS REVIEW`.

### Step 6: Report

```markdown
## Excel → CSV Conversion Complete

| Workbook | Index | Sheets | CSVs | Status |
|---|---|---|---|---|
| ISDA_Product_Mapping.xlsx | ISDA_Product_Mapping.md | 14 | 14 | OK |

### Largest sheets (heads-up for downstream loading)
- 14-GMDI-Agreements3pm-20240821.csv — 24,942 rows

### Next Step
- Read `<stem>.md` for the sheet index, then open only the CSVs you need.
- If this was part of requirements prep, run `/create-specifications @<folder>`.
```

---

## Notes & Edge Cases

- **`.xlsm` macros** — never executed; cell data only.
- **Sheet-name slugs** — spaces/underscores become dashes, punctuation
  (`&`, `/`, `:`) is dropped; a numeric prefix preserves workbook order. The
  index maps each slug back to the real sheet name.
- **Empty sheets** — still produce a (possibly empty) CSV and are marked
  `_(empty)_` in the index so nothing is silently dropped.
- **Huge sheets** — isolated in their own CSV; the index row/count column warns
  before you load a multi-MB file.
- **Idempotent** — re-running overwrites an existing same-source conversion.

---

## Cross-References

- Orchestrator: `@.claude/commands/convert-to-markdown.md` — routes Excel files
  through this same script as part of whole-folder conversion
- Consumer: `@.claude/commands/create-specifications.md` — reads the index and
  the per-sheet CSVs
- Script: `scripts/xlsx-to-csv.py`
- Tooling: `uv` (https://astral.sh/uv)
