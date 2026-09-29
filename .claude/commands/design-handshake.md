---
description: >
  Run the design handshake for one Figma-mirror node — the HARD PRECONDITION for a clean
  `buildStatus: built` (BD5, Plan 02b §2 / Phase 5 F2). Scaffolds the human checklist, the machine
  record `figma/nodes/<slug>.handshake.json`, and the accessibility spec `figma/nodes/<slug>.a11y.md`
  (from `.claude/templates/accessibility-spec.md`); clears / rejects / overrides the gate; and writes
  `handshakeStatus` back into the node meta sidecar. OFFLINE and human-gated: NO Figma MCP, NO canvas
  write, and it never advances `lastSyncedAt`. Participants resolve through
  `.claude/config/people.json` (D8); an unresolved handle asks — never guesses.
agent: build
subtask: false
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# /design-handshake — design + a11y gate for one node

## Input

`$ARGUMENTS`:

```
/design-handshake <slug> [--clear | --reject | --override "<reason>"]
```

- `<slug>` — the node slug, matching `figma/nodes/<slug>.*` (the same slug used by the meta sidecar
  and `figma/nodes/<slug>.md`). Resolve it against `figma/_index.json.items[]` (`slug`/`name`/
  `nodeId`); if it matches nothing, STOP and suggest `/figma search <query>`.
- No flag ⇒ **scaffold** (create the checklist + `.handshake.json` + `.a11y.md` at `status: pending`
  if they do not exist, or print the current handshake state if they do).
- `--clear` / `--reject` ⇒ transition an existing handshake (see §4).
- `--override "<reason>"` ⇒ force a build past a non-cleared gate, logging the reason (see §5).
  A reason string is **mandatory**; a bare `--override` STOPs.

## Preconditions (every invocation)

1. **Mirror initialized.** `figma/.manifest.json` present; else tell the user to run `/figma-init`
   and STOP.
2. **Node exists in the mirror.** `figma/nodes/<slug>.meta.json` must exist (the node was pulled /
   added). If absent, STOP — the handshake gates a *mirrored* node; point to `/add-figma-node` or
   `/figma pull` first. Do not scaffold a handshake for a node the mirror does not know.
3. **OFFLINE.** This command performs **no Figma MCP call** and **no canvas write**, and never moves
   `lastSyncedAt` (D4/FN11 — the two-timestamp invariant). It reads/writes only under `figma/nodes/`
   and reads `.claude/config/people.json`, `.claude/config/figma-lumen-glossary.json`, and the
   templates. **No `specs/` or `apps/web/` writes.**
4. **Exempt fixtures are not handshake-gated.** Do **not** author a `.handshake.json` for a node
   whose `handshakeStatus` is `not-required` (internal/experimental screens — e.g. the Phase-4
   `hifi-fixture-login` fixture, and the seeded node `299:12006`). If invoked on one, report that it
   is `not-required` (intentionally exempt) and STOP; only proceed if the user explicitly asks to
   change its status.

## Artifacts this command manages (all under `figma/nodes/`)

| File | Role | Authored from |
|---|---|---|
| `<slug>.handshake.md` | Human-facing checklist a reviewer fills in | `.claude/templates/design-handshake-checklist.md` |
| `<slug>.handshake.json` | **Machine record** — the gate the reindex/coverage reads | this command (shape in §3) |
| `<slug>.a11y.md` | Accessibility spec engineering implements | `.claude/templates/accessibility-spec.md` |

The `.handshake.json` is the source of truth for the gate; the `.md` checklist is the human record.
`handshakeStatus` on the **meta sidecar** is derived from `.handshake.json.status` and is what
`/figma reindex` rolls into `_index.json` (§6).

## 1. Scaffold (no flag)

If `<slug>.handshake.json` does **not** exist:

1. Read `figma/nodes/<slug>.meta.json` for `nodeId`, `fileKey`, `name` (Figma frame name).
2. **Resolve the target Lumen component** through `.claude/config/figma-lumen-glossary.json`
   (§7) — record the `figmaName → lumenComponent` pair on the checklist. Prefer a **verified** entry;
   if only an `inferred` entry (or none) exists, note it and recommend `/figma-glossary suggest` →
   `/figma-glossary add` **before** the handshake can clear.
3. **Resolve the three participants** through `.claude/config/people.json` (§8): squad designer,
   Lumen (design-system) designer, platform representative. Each handle is a people.json `id` (or a
   resolvable `alias`). `unresolvedAliasPolicy: ask` — an unknown/ambiguous handle fires an
   `AskUserQuestion`; never guess and never invent an `id`.
4. Write `<slug>.handshake.json` at `status: "pending"` with the resolved fields (§3),
   `clearedAt: null`, `handshakeOverrideReason: null`.
5. Author `<slug>.handshake.md` from `.claude/templates/design-handshake-checklist.md` and
   `<slug>.a11y.md` from `.claude/templates/accessibility-spec.md`, substituting Node / Slug / Figma
   frame / Lumen target / participants and stripping the leading HTML-comment guidance block.
6. Point `<slug>.handshake.json.a11ySpecRef` at `figma/nodes/<slug>.a11y.md`.
7. Set the meta sidecar `handshakeStatus: "pending"` and recommend `/figma reindex` so
   `/figma coverage` surfaces the gate.
8. Tell the user the a11y spec must be authored/reviewed **with** the `accessibility-auditor` agent
   against `@.claude/standards/accessibility-standards.md` before the gate can clear (BD5).

If `<slug>.handshake.json` **already** exists, print its `status`, `participants`, `a11ySpecRef`,
`decisions[]`, and `clearedAt`, and STOP — do not overwrite. Use `--clear` / `--reject` to transition.

## 2. `.handshake.json` shape (§3)

```json
{
  "slug": "<slug>",
  "nodeId": "<fileKey>:<nodeId>",
  "figmaName": "<Figma frame name>",
  "lumenComponent": "<resolved via glossary — verified preferred>",
  "status": "pending",
  "participants": {
    "squadDesigner": "<people.json id>",
    "lumenDesigner": "<people.json id>",
    "platformRep": "<people.json id>"
  },
  "a11ySpecRef": "figma/nodes/<slug>.a11y.md",
  "decisions": [
    { "decision": "<intentional deviation / waiver>", "rationale": "<why>", "raisedBy": "<people.json id>", "status": "accepted" }
  ],
  "clearedAt": null,
  "handshakeOverrideReason": null
}
```

- `status ∈ pending | cleared | rejected` (a node meta may separately carry `not-required`; this
  command does not scaffold those — §Preconditions.4).
- `nodeId` is the colon form `<fileKey>:<nodeId>` (D5) — colon in JSON, never the underscore
  asset-path form.
- `decisions[]` mirrors the checklist §6 "Decisions & deviations" table; every waived checklist item
  is recorded here with who raised it.
- `clearedAt` is an ISO-8601 timestamp, set only on `--clear`.
- `handshakeOverrideReason` is `null` unless `--override` was used (§5).

## 3. (reserved)

## 4. `--clear` / `--reject`

**Clear** (`--clear`) — allowed **only** when the gate's preconditions hold:

1. `<slug>.a11y.md` exists and `a11ySpecRef` points at it — **the a11y spec is a hard precondition;
   a handshake cannot clear without it (BD5).** If missing, STOP and tell the user to author it (from
   the template, with `accessibility-auditor`).
2. A **verified** glossary entry resolves `figmaName → lumenComponent` (an `inferred` entry is not
   enough — §7). If only inferred/none, STOP and route to `/figma-glossary add`.
3. All three participants are resolved people.json ids (no unresolved handle).
4. Set `status: "cleared"`, stamp `clearedAt` (ISO-8601 now), write `.handshake.json` back.
5. Write the meta sidecar `handshakeStatus: "cleared"`.
6. Recommend `/figma reindex` so `/figma coverage` shows a **clean built** for this node.

**Reject** (`--reject`):

1. Set `status: "rejected"` (leave `clearedAt: null`), write `.handshake.json` back.
2. Write the meta sidecar `handshakeStatus: "rejected"`.
3. On reindex, `/figma coverage` renders a `built` node as **`built (⚠ handshake pending)`** until
   re-worked (identical surfacing to `pending` — the gate has not cleared). Recommend `/figma reindex`.

Both transitions require an existing `.handshake.json` (run scaffold first). Neither touches
`lastSyncedAt`.

## 5. `--override "<reason>"`

`--override` forces a build to proceed past a **non-cleared** gate. It does **not** flip `status` to
`cleared` — it records that a human knowingly bypassed the gate:

1. The `"<reason>"` string is **mandatory**; a bare `--override` STOPs with an explanation.
2. Write the reason to `.handshake.json.handshakeOverrideReason` **and** to the meta sidecar
   `handshakeOverrideReason` (schema field) **and** append a line to the run log — it is **never
   silent** (BD5).
3. Leave `status` at its current value (`pending`/`rejected`); the override is an audit trail, not a
   clearance. `/figma coverage` still surfaces the un-cleared gate; the override reason travels with it.
4. Recommend `/figma reindex`.

The `--override` hook is consumed by **Phase 4's `/figma-to-lumen`**: that codegen command checks the
node's `handshakeStatus` before emitting a clean `built`, and honours `--override "<reason>"` by
logging `handshakeOverrideReason` rather than silently building. `/design-handshake` writes the field;
`/figma-to-lumen` reads it (do not invent a Phase-4 codegen path here — it is out of scope).

## 6. Meta / coverage wiring (BD5)

- The gate lives on the **meta sidecar** as `handshakeStatus ∈ not-required | pending | cleared |
  rejected` (required field in `figma/manifest.schema.json` → `$defs.figmaNodeMeta`). This command
  writes it; `/figma reindex` rolls it verbatim into `_index.json.items[].handshakeStatus`
  (sidecar wins — the index never invents state).
- `/figma coverage` (via `figma-helper` §9) surfaces it against `buildStatus`:
  - `built` + `cleared` → clean **built**.
  - `built` + `not-required` → clean **built** (exempt internal/experimental screen).
  - `built` + (`pending` | `rejected`) → **`built (⚠ handshake pending)`** — never a clean built.
- `handshakeOverrideReason` (optional schema field, `string | null`) carries the `--override` audit
  trail through the sidecar into the index.
- **`/figma reindex` never advances `lastSyncedAt`** — a handshake transition is not a Figma sync.

## 7. Glossary resolution (F1)

Resolve `figmaName → lumenComponent` through `.claude/config/figma-lumen-glossary.json` in the
authority order (BD2/D22):

1. **Code Connect** template mapping (authoritative — Phase 6 / F4).
2. **glossary `verified`** entry — authoritative (e.g. `TopNavigationBars ↔ DefaultTopAppBarScaffold`).
3. **glossary `inferred`** entry — flag it; **not** sufficient to clear the gate.
4. raw convention scan — a proposal only; route to `/figma-glossary suggest`.

A clean **clear** requires a `verified` resolution (or a Code Connect map). Record the resolved pair
on both the checklist (§1 Component identity) and `.handshake.json.lumenComponent`.

## 8. Participant resolution (D8)

- Participants are people.json `id`s (or resolvable `aliases`) — **not** free text and **not** the
  handshake template's placeholder strings.
- Read `.claude/config/people.json`; match each of squad designer / Lumen designer / platform rep
  against `id` then `aliases[]`.
- `unresolvedAliasPolicy: ask` — an unknown or ambiguous handle fires an `AskUserQuestion`
  (multi-choice from candidate people.json entries, plus "add a new person"); never guess, never
  fabricate an `id`. If the user opts to add a person, that is a `people.json` edit (additive) — make
  it explicit and confirm before writing.

## Guardrails

- **OFFLINE + human-gated.** No Figma MCP, no canvas write; only `figma/nodes/<slug>.{handshake.json,
  handshake.md,a11y.md}` and the derived meta `handshakeStatus`/`handshakeOverrideReason` are written.
  Nothing here advances `lastSyncedAt`.
- **The a11y spec is a hard precondition** — a handshake cannot `--clear` without `<slug>.a11y.md`
  attached and referenced (BD5).
- **`inferred` never clears** — clearance needs a `verified` glossary resolution or a Code Connect map.
- **`--override` is never silent** — it always writes `handshakeOverrideReason` (sidecar + run log)
  and never flips `status` to `cleared`.
- **Exempt fixtures stay exempt** — never scaffold a handshake for a `not-required` node
  (`hifi-fixture-login`, `299:12006`) unless the user explicitly asks to change its status.
- **No `specs/` or `apps/web/` writes; codegen / Code Connect is Phase 4** — name it and stop.
- **Figma MCP tools are called ONLY inside the `/figma*` family** — this command calls none.

## Cross-references

- Templates: `.claude/templates/design-handshake-checklist.md`, `.claude/templates/accessibility-spec.md`
- Schema: `figma/manifest.schema.json` (`$defs.handshakeStatus`, `figmaNodeMeta.handshakeStatus`, `handshakeOverrideReason`)
- Glossary: `.claude/commands/figma-glossary.md` + `.claude/config/figma-lumen-glossary.json`
- Coverage surfacing: `.claude/agents/figma-helper.md` §9
- Identity: `.claude/config/people.json` (D8)
- Offline rollup: `scripts/figma/reindex.ts` (`--root .`)
- A11y standard: `@.claude/standards/accessibility-standards.md`
