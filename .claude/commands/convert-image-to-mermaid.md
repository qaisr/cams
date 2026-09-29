---
description: Convert an image of a diagram (architecture, flowchart, DFD, sequence, ER, etc.) into a portable, enterprise-grade Mermaid diagram beside the source image.
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: medium
---

# Convert Image To Mermaid

## Input

$ARGUMENTS

Examples:

- `/convert-image-to-mermaid @docs/input/architecture.png`
- `/convert-image-to-mermaid @raw-requirements/eod-flow.jpg`
- `/convert-image-to-mermaid @design/diagrams/`

---

## Purpose

Take an **image** of a diagram — an AWS architecture diagram, flowchart, data
flow diagram (DFD), sequence diagram, ER diagram, state machine, etc. — and
reproduce it as a **portable Mermaid diagram**, written to a `.md` file next to
the source image.

This command is **only** for image → Mermaid conversion. When Claude authors a
diagram from written requirements (spec generation, ADRs, `/diagram-create`,
`/design-architecture`), it does **not** run this command — but it applies the
**same** shared standard so both paths produce identical-looking output. That
shared standard is `@.claude/standards/mermaid-standards.md`.

> **Nothing is deleted.** The source image is left untouched. Only a `.md` file
> (and, on re-conversion, its overwrite) is written.

---

## Scope & Non-Goals

- **In scope**: raster/vector diagram images — `.png`, `.jpg`/`.jpeg`, `.webp`,
  `.gif` (first frame), `.bmp`, and screenshots of diagrams.
- **Out of scope**: photos, UI screenshots that are not diagrams, dense tables,
  or images with no diagram structure. If the image is not a diagram, STOP and
  tell the user — do not hallucinate a diagram.
- **Not** invoked during `/create-specifications` or any requirements-driven
  authoring. Those paths read `mermaid-standards.md` directly.

---

## Token Policy

This is a **conversion** command. Read the source image in full (you must see
every node, edge, and label to reproduce it faithfully) and load
`@.claude/standards/mermaid-standards.md` in full. Do not load unrelated
standards. Produce the `.md` and report — do not re-read the output to pad
context.

---

## Argument Handling

Interpret `$ARGUMENTS` as exactly one source path.

- **File path** to a supported image → convert that one image.
- **Directory path** → find every supported image inside it (recursively) and
  convert each.
- **No argument** → ask the user for an image path, then stop.
- **A non-image / non-diagram file** → tell the user this command handles
  diagram images only; point them at `/convert-to-markdown` for documents.

Supported extensions: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp`.

---

## Pre-Flight

### Load the shared standard (required)

Read `@.claude/standards/mermaid-standards.md` **in full** before generating
anything. Every rule there — portable syntax (no `aws:`/iconify icons), sparing
emoji (≤1 per role-bearing node), the `classDef` theme palette, `subgraph`
boundaries, `accTitle`/`accDescr`, the diagram-type selection table, the DFD
convention, and the correctness checklist — is binding here.

### No renderer needed

Verification is **syntax-level only** — mentally parse the Mermaid block per the
standard's Correctness & Portability Checklist. Do **not** install or run
`mermaid-cli`, Chromium, or any headless renderer.

---

## Process

### Step 1: Read & classify the image

1. Read the image with the `Read` tool (it is multimodal — you will see the
   diagram).
2. **Classify** the diagram type from what you see, and map it to the correct
   Mermaid type using the standard's Diagram Type Selection table:

   | What the image shows | Mermaid type |
   | --- | --- |
   | Cloud/AWS boxes, VPCs, arrows between services | `flowchart` with `subgraph` boundaries |
   | Decision logic, business process, swimlanes | `flowchart TD`/`LR` |
   | Lifelines, actors exchanging messages over time | `sequenceDiagram` |
   | Entities with attributes + crow's-foot/cardinality lines | `erDiagram` |
   | Circles/rounded states with transition arrows | `stateDiagram-v2` |
   | External entities + processes + labelled data stores | `flowchart` (DFD convention) |
   | Classes/objects with fields and relationships | `classDiagram` |

   If the image mixes types (e.g. an architecture diagram with an inset
   sequence), prefer **one diagram per type** — emit the primary diagram and
   note in surrounding prose that a secondary diagram may be split out.

3. If you cannot confidently classify it as a diagram → STOP and tell the user.

### Step 2: Extract structure (fidelity contract)

Reproduce the image **faithfully**. Before writing Mermaid, inventory what you
see so nothing is invented or dropped:

- **Nodes** — every box/shape and its exact text label.
- **Edges** — every arrow/line, its direction, and any edge label (protocol,
  action, condition, cardinality).
- **Groupings** — every boundary/container (VPC, subnet, trust zone, swimlane,
  subsystem) becomes a `subgraph`.
- **Shapes** — preserve shape semantics per the standard (`[ ]` service,
  `[( )]` datastore, `{ }` decision, `([ ])` start/end, `(( ))` actor/boundary
  pool, `[[ ]]` managed service).
- **Roles** — map recognisable roles to the emoji vocabulary (👤 user,
  🚪 gateway, ⚡ compute, 🗄️ database, 🔐 auth, 📨 event bus, 🪣 storage,
  🔗 external, ⏱️ cron, 🔑 secrets), **sparingly** — ≤1 emoji per node, only on
  role-bearing nodes.

**Fidelity rules:**

- Do **not** invent nodes, edges, labels, or groupings that are not in the
  image.
- Do **not** omit anything present in the image. If a label is partially
  illegible, transcribe your best reading and add a `%% REVIEW: <what/why>`
  comment on that line rather than silently guessing or dropping it.
- Keep the same reading direction the image implies (`TB` for top-down
  architecture, `LR` for left-to-right pipelines/sequences) to minimise edge
  crossings.
- If the source uses a different cloud/UI icon set, reproduce the **intent**
  with the portable emoji + `classDef` roles from the standard — never emit
  `aws:`/iconify icons (they render blank on our targets).

### Step 3: Generate the Mermaid diagram

Author the diagram strictly per `@.claude/standards/mermaid-standards.md`:

- Portable syntax only (no `aws:`, no `registerIconPacks`, no Chart-only
  features).
- `%%{init: {"theme": "neutral", ...}}%%` base for predictable rendering.
- Model every boundary as a `subgraph`.
- Emoji sparingly (≤1 per role node); labels must stand alone without the emoji.
- Apply the `classDef` theme palette (`actor`, `edge`, `vpc`, `data`, `auth`)
  and `class` the nodes — do not invent per-node inline colours.
- Add `accTitle` and `accDescr` (derive the description from what the diagram
  conveys).
- Label non-trivial edges with what they carry.
- Keep it ≤ ~30 nodes; if the image is larger, split into a context diagram plus
  detail diagrams and say so in prose.

### Step 4: Write the output file

Write `<image-stem>.md` **next to the source image** with YAML frontmatter,
then the Mermaid block:

```markdown
---
source_file: <original image filename with extension>
converted_by: convert-image-to-mermaid
converted_at: <UTC ISO-8601 timestamp>
diagram_type: <flowchart | sequenceDiagram | erDiagram | stateDiagram-v2 | classDiagram | dfd>
---

# <Short title derived from the diagram>

> Converted from `<image filename>`. Portable Mermaid (open-source renderers).
> Review against the source image before use.

​```mermaid
%%{init: {"theme": "neutral", "flowchart": {"curve": "basis"}}}%%
flowchart TB
    accTitle: <title>
    accDescr: <one-line description of what the diagram shows>
    ...
​```

## Review notes

- <any REVIEW markers, illegible labels, or split-diagram notes — omit the
  section if there are none>
```

**Overwrite policy (per file):** if `<image-stem>.md` already exists and its
`source_file:` frontmatter matches the current image, it is a re-conversion —
overwrite it. If it exists with **no** frontmatter or a **different**
`source_file:`, treat it as a collision — STOP for that file and ask the user to
rename or clear the target first.

### Step 5: Verify (syntax-level)

Run the standard's **Correctness & Portability Checklist** against the emitted
block:

1. Parses (balanced brackets, closed subgraphs, quoted labels with spaces).
2. Portable (no `aws:`/iconify/Chart-only syntax).
3. Correct diagram type for the source.
4. Emoji sparing (≤1 per role node).
5. Themed (uses the `classDef` palette; boundaries are `subgraph`s).
6. Accessible (`accTitle` + `accDescr` present).
7. Edges labelled where non-trivial.
8. Sized (≤ ~30 nodes, else split).

Also confirm **fidelity**: every node, edge, label, and grouping in the image is
present in the Mermaid, and nothing extra was invented. If a check fails, fix
the block before reporting success. If something could not be reproduced
faithfully, flag it as `NEEDS REVIEW` rather than claiming success.

### Step 6: Report

```markdown
## Image → Mermaid Conversion Complete

| Source Image | Output | Diagram Type | Nodes | Status |
|---|---|---|---|---|
| architecture.png | architecture.md | flowchart | 12 | OK |

### Review Required
- <illegible label / split-diagram note / assumption> — or "(none)"

### Next Step
- Open `<image-stem>.md`, preview the Mermaid, and compare it against the source
  image. Adjust any `REVIEW` markers. The source image is preserved.
```

---

## Notes & Edge Cases

- **Multi-diagram images** — emit the primary diagram; note that secondary
  diagrams (a different type) can be split into their own `.md` on request.
- **Illegible / low-resolution text** — transcribe best-effort and mark with a
  `%% REVIEW:` comment + a Review Required line; never silently drop or invent.
- **Vendor icon sets in the source** (AWS, Azure, GCP, Visio stencils) — map to
  portable emoji + `classDef` roles; never reproduce as `aws:`/iconify icons.
- **Very large diagrams** — split into a context diagram + detail diagrams per
  the standard's size discipline rather than emitting an unreadable wall.
- **Not a diagram** — STOP and tell the user; do not fabricate structure.
- **Idempotent** — re-running on the same image overwrites its same-source
  `.md`.

---

## Cross-References

- Shared standard (binding): `@.claude/standards/mermaid-standards.md`
- Authoring counterpart (requirements → Mermaid): `@.claude/commands/diagram-create.md`
- Theme source (palette override): `@.claude/standards/design-tokens.md`
- Document conversion (not images): `@.claude/commands/convert-to-markdown.md`
