# /// script
# requires-python = ">=3.9"
# dependencies = ["openpyxl>=3.1"]
# ///
"""
Convert an Excel workbook (.xlsx / .xlsm / .xls) to one CSV file per sheet,
plus a Markdown index that links to each CSV.

Why CSV-per-sheet + index (the default):
  - Compactness: Markdown tables are very verbose for wide sheets (every row
    repeats "| ... |" and there is a "---" separator row). A single large
    workbook can explode into tens of thousands of Markdown lines. CSV is
    compact and the Read tool parses it natively.
  - Multi-sheet fidelity: every sheet becomes its own CSV, in workbook order,
    so nothing is flattened or truncated. The index preserves the mapping from
    CSV filename back to the real sheet name and records row/column counts.
  - Macro safety: openpyxl opens with data_only=True and keep_vba=False. It
    reads the *cached cell values* only and NEVER executes VBA — safe for .xlsm
    macro workbooks.

An inline single-file Markdown mode (--inline-markdown) is retained for small
workbooks where one .md with tables is more convenient than a folder of CSVs.

Invoked through uv so the openpyxl dependency is provisioned ephemerally and we
do not depend on a system Python having it installed:

    # Default: CSV-per-sheet + Markdown index
    uv run scripts/xlsx-to-csv.py <input.xlsx> [--index <path.md>] [--csv-dir <dir>]

    # Optional: single inline-tables Markdown file (small workbooks)
    uv run scripts/xlsx-to-csv.py <input.xlsx> --inline-markdown [--output <path.md>]

If paths are omitted they default, next to the source, to:
    <source-stem>.md          (index)         matching /convert-to-markdown Option B
    <source-stem>/            (CSV directory)

The caller (the /convert-to-markdown or /convert-excel-to-csv command) is
responsible for collision detection across the whole folder before invoking
this per file.
"""
from __future__ import annotations

import argparse
import csv
import datetime as _dt
import re
import sys
from pathlib import Path

try:
    from openpyxl import load_workbook
    from openpyxl.utils.exceptions import InvalidFileException
except ImportError:  # pragma: no cover - uv provisions this
    sys.stderr.write(
        "openpyxl is not available. Run this script via uv so the dependency "
        "is provisioned:\n  uv run scripts/xlsx-to-csv.py <file>\n"
    )
    sys.exit(2)


SUPPORTED = {".xlsx", ".xlsm", ".xls"}


def _cell_to_value(value: object) -> str:
    """Render a single cell value as plain text for CSV output.

    CSV quoting is handled by the csv module, so we do NOT escape pipes or
    commas here. We only normalise types and flatten nothing — embedded
    newlines are preserved and correctly quoted by the csv writer.
    """
    if value is None:
        return ""
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (_dt.datetime, _dt.date, _dt.time)):
        return value.isoformat()
    return str(value)


def _cell_to_md(value: str) -> str:
    """Escape a plain cell value for safe, single-line Markdown table text."""
    text = value.replace("\\", "\\\\").replace("|", "\\|")
    text = text.replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
    return text.strip()


def _read_sheet_rows(ws) -> list[list[str]]:
    """Read a worksheet into a rectangular list of plain-text rows, trimming
    fully-empty leading/trailing rows and empty edge columns."""
    rows: list[list[str]] = []
    for row in ws.iter_rows(values_only=True):
        rows.append([_cell_to_value(v) for v in row])

    # Trailing then leading empty rows.
    while rows and all(c == "" for c in rows[-1]):
        rows.pop()
    while rows and all(c == "" for c in rows[0]):
        rows.pop(0)
    if not rows:
        return []

    width = max(len(r) for r in rows)
    for r in rows:
        if len(r) < width:
            r.extend([""] * (width - len(r)))

    # Drop columns that are empty across every row.
    keep = [any(r[c] != "" for r in rows) for c in range(width)]
    if not any(keep):
        return []
    return [[cell for cell, k in zip(r, keep) if k] for r in rows]


def _slugify_sheet(name: str) -> str:
    """Turn a sheet name into a filesystem-safe slug for a CSV filename."""
    slug = name.strip()
    slug = re.sub(r"[^\w\s-]", "", slug)      # drop punctuation like & / : etc.
    slug = re.sub(r"[\s_]+", "-", slug)        # spaces/underscores -> single dash
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug or "sheet"


def _yaml_flow_scalar(value: str) -> str:
    """Quote a sheet name for a YAML flow sequence when it needs it."""
    if value == "" or any(ch in value for ch in ",[]{}:#&*!|>'\"%@`") or value.strip() != value:
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'
    return value


# ---------------------------------------------------------------------------
# Default mode: CSV-per-sheet + Markdown index
# ---------------------------------------------------------------------------

def convert_to_csv(
    input_path: Path,
    index_path: Path,
    csv_dir: Path,
) -> list[dict]:
    """Write one CSV per sheet into csv_dir and a Markdown index at index_path.

    Returns a list of per-sheet metadata dicts (name, csv, rows, cols, empty).
    """
    if input_path.suffix.lower() not in SUPPORTED:
        raise ValueError(
            f"Unsupported extension '{input_path.suffix}'. "
            f"Expected one of: {', '.join(sorted(SUPPORTED))}"
        )

    wb = load_workbook(
        filename=input_path,
        data_only=True,
        keep_vba=False,
        read_only=True,
    )
    sheet_names = list(wb.sheetnames)
    csv_dir.mkdir(parents=True, exist_ok=True)

    used_slugs: set[str] = set()
    meta: list[dict] = []

    for idx, name in enumerate(sheet_names, start=1):
        rows = _read_sheet_rows(wb[name])
        base = f"{idx:02d}-{_slugify_sheet(name)}"
        slug = base
        n = 2
        while slug in used_slugs:  # guard against slug collisions across sheets
            slug = f"{base}-{n}"
            n += 1
        used_slugs.add(slug)

        csv_name = f"{slug}.csv"
        csv_path = csv_dir / csv_name
        with csv_path.open("w", encoding="utf-8", newline="") as fh:
            writer = csv.writer(fh)
            for r in rows:
                writer.writerow(r)

        meta.append(
            {
                "name": name,
                "csv": csv_name,
                "rows": len(rows),
                "cols": (len(rows[0]) if rows else 0),
                "empty": not rows,
            }
        )

    wb.close()

    _write_index(input_path, index_path, csv_dir, sheet_names, meta)
    return meta


def _write_index(
    input_path: Path,
    index_path: Path,
    csv_dir: Path,
    sheet_names: list[str],
    meta: list[dict],
) -> None:
    now = _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()
    # Link paths in the index are relative to the index file's own directory.
    try:
        rel_dir = csv_dir.relative_to(index_path.parent)
        rel_prefix = f"{rel_dir.as_posix()}/"
    except ValueError:
        rel_prefix = f"{csv_dir.as_posix()}/"

    lines: list[str] = []
    lines.append("---")
    lines.append(f"source_file: {input_path.name}")
    lines.append("converted_by: xlsx-to-csv.py")
    lines.append(f"converted_at: {now}")
    lines.append("format: csv-per-sheet")
    lines.append(f"csv_dir: {rel_prefix}")
    lines.append("sheets: [" + ", ".join(_yaml_flow_scalar(s) for s in sheet_names) + "]")
    lines.append("---")
    lines.append("")
    lines.append(f"# {input_path.name}")
    lines.append("")
    lines.append(
        f"> Converted from `{input_path.name}` — {len(sheet_names)} sheet(s), "
        "one CSV per sheet. Cell values are cached values only; no formulas or "
        "macros were executed. This file is an **index** — open the linked CSVs "
        "for the actual data."
    )
    lines.append("")
    lines.append("## Sheets")
    lines.append("")
    lines.append("| # | Sheet | CSV | Rows | Cols |")
    lines.append("| --- | --- | --- | --- | --- |")
    for i, m in enumerate(meta, start=1):
        link = f"[{m['csv']}]({rel_prefix}{m['csv']})"
        sheet_disp = _cell_to_md(m["name"])
        note = " _(empty)_" if m["empty"] else ""
        lines.append(f"| {i} | {sheet_disp}{note} | {link} | {m['rows']} | {m['cols']} |")
    lines.append("")

    index_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# Optional mode: single inline-tables Markdown file
# ---------------------------------------------------------------------------

def _sheet_to_markdown_table(rows: list[list[str]]) -> tuple[str, bool]:
    if not rows:
        return ("_(empty sheet — no cell data)_", True)
    max_width = max(len(r) for r in rows)
    md_rows = [[_cell_to_md(c) for c in r] for r in rows]
    for r in md_rows:
        if len(r) < max_width:
            r.extend([""] * (max_width - len(r)))

    header = md_rows[0]
    if all(c == "" for c in header):
        header = [f"Column {i + 1}" for i in range(max_width)]
        body = md_rows
    else:
        body = md_rows[1:]

    out = ["| " + " | ".join(header) + " |", "| " + " | ".join(["---"] * max_width) + " |"]
    for r in body:
        out.append("| " + " | ".join(r) + " |")
    return ("\n".join(out), False)


def convert_inline_markdown(input_path: Path) -> tuple[str, list[str]]:
    if input_path.suffix.lower() not in SUPPORTED:
        raise ValueError(
            f"Unsupported extension '{input_path.suffix}'. "
            f"Expected one of: {', '.join(sorted(SUPPORTED))}"
        )
    wb = load_workbook(filename=input_path, data_only=True, keep_vba=False, read_only=True)
    sheet_names = list(wb.sheetnames)
    now = _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()

    parts: list[str] = ["---",
                        f"source_file: {input_path.name}",
                        "converted_by: xlsx-to-csv.py",
                        f"converted_at: {now}",
                        "format: inline-markdown",
                        "sheets: [" + ", ".join(_yaml_flow_scalar(s) for s in sheet_names) + "]",
                        "---", "", f"# {input_path.name}", "",
                        f"> Converted from `{input_path.name}` — {len(sheet_names)} sheet(s). "
                        "Cell values are cached values only; no formulas or macros were executed.",
                        ""]
    for name in sheet_names:
        body, _empty = _sheet_to_markdown_table(_read_sheet_rows(wb[name]))
        parts.extend([f"## Sheet: {name}", "", body, ""])
    wb.close()
    return ("\n".join(parts).rstrip() + "\n", sheet_names)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Convert an Excel workbook to CSV-per-sheet plus a Markdown index."
    )
    parser.add_argument("input", type=Path, help="Path to .xlsx / .xlsm / .xls file")
    parser.add_argument(
        "--index",
        type=Path,
        default=None,
        help="Output Markdown index path (default: <source-stem>.md next to source)",
    )
    parser.add_argument(
        "--csv-dir",
        type=Path,
        default=None,
        help="Directory for per-sheet CSVs (default: <source-stem>/ next to source)",
    )
    parser.add_argument(
        "--inline-markdown",
        action="store_true",
        help="Emit a single Markdown file with inline tables instead of CSV-per-sheet",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="[inline-markdown mode] Output .md path (default: <source-stem>.md)",
    )
    args = parser.parse_args(argv)

    input_path: Path = args.input
    if not input_path.exists():
        sys.stderr.write(f"Input file not found: {input_path}\n")
        return 1

    try:
        if args.inline_markdown:
            markdown, sheet_names = convert_inline_markdown(input_path)
            output_path: Path = args.output or input_path.with_suffix(".md")
            output_path.write_text(markdown, encoding="utf-8")
            sys.stderr.write(
                f"OK: {input_path.name} -> {output_path.name} "
                f"(inline markdown, {len(sheet_names)} sheet(s))\n"
            )
            return 0

        index_path: Path = args.index or input_path.with_suffix(".md")
        csv_dir: Path = args.csv_dir or input_path.with_suffix("")
        meta = convert_to_csv(input_path, index_path, csv_dir)
        nonempty = sum(1 for m in meta if not m["empty"])
        sys.stderr.write(
            f"OK: {input_path.name} -> {index_path.name} + {csv_dir.name}/ "
            f"({len(meta)} sheet(s), {nonempty} non-empty CSV(s))\n"
        )
        return 0
    except InvalidFileException:
        sys.stderr.write(
            f"Could not read '{input_path}' as an Excel workbook. "
            "It may be corrupt or not a real .xlsx/.xlsm/.xls file.\n"
        )
        return 1
    except ValueError as exc:
        sys.stderr.write(f"{exc}\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
