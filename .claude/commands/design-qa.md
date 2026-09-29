---
description: Run the design-QA checklist for one built hi-fi screen — visual parity, token conformance, Lumen reuse, a11y, states, handshake (Plan 02b F5 / Phase 6). Report only; OFFLINE, NO MCP.
argument-hint: "<slug>"
allowed-tools: Read, Grep, Glob, Bash, AskUserQuestion
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# /design-qa `<slug>`

Run the **design-QA gate** for one built screen: score it against the six-heading
checklist (`.claude/templates/design-qa-checklist.md`) using **mirror-only evidence**,
and print a pass/fail report. This command **changes nothing** — every failed item
names the human-gated command that owns the fix.

> **MCP discipline (BD9).** Design-QA is a **mirror-only** gate: it reads on-disk state
> and calls **no MCP** — not Figma, not Lumen. The live analyses it references
> (`/figma-token-drift`, `/figma-codeconnect`, `/figma pull`) are separate, explicitly
> user-invoked `/figma*` commands. Nothing here edits code, the mirror, the glossary, or
> the Figma canvas (D15).

## Input

```
/design-qa <slug>
```

`<slug>` matches `figma/nodes/<slug>.*` (the same slug used by the meta sidecar,
`.a11y.md`, `.handshake.json`, and the visual-regression manifest). Resolve it against
`figma/_index.json.items[]` (`slug` / `name` / `nodeId`). No match ⇒ STOP and suggest
`/figma search <query>`.

## Preconditions

1. **Mirror initialized** — `figma/.manifest.json` present; else point to `/figma-init` and STOP.
2. **Node mirrored** — `figma/nodes/<slug>.meta.json` exists; else point to `/add-figma-node`
   or `/figma pull` and STOP. QA gates a *built + mirrored* node.
3. **OFFLINE** — no Figma/Lumen MCP call, no canvas write.

## Evidence on disk (read-only)

| Path | Feeds heading |
|---|---|
| `figma/.visual-regression/manifest.json` | 1 Visual parity (`lastResult`, `baselineRenderHash`) |
| `figma/nodes/<slug>.meta.json` | 1 staleness (`renderHash`), 3 (`buildStatus`/`componentRef`), 6 (`handshakeStatus`) |
| last `/figma-token-drift` report / `token-drift-check` signal | 2 Token conformance |
| `.claude/config/figma-lumen-glossary.json` | 3 Component reuse (name → Lumen, Code Connect rung) |
| `apps/web/src/components/` | 3 Component reuse (does a Lumen component already exist?) |
| `figma/nodes/<slug>.a11y.md` | 4 Accessibility (Phase-5 spec) |
| `figma/nodes/<slug>.handshake.json` | 6 Handshake cleared (BD5) |

## Flow

1. **RESOLVE** `<slug>` → node in `figma/_index.json`; gather the evidence paths above.
2. **SCORE** each heading of `.claude/templates/design-qa-checklist.md` as
   **pass / fail / n/a** from that evidence only:
   - **Visual parity** — manifest entry `lastResult.status === 'pass'` **and** fresh
     (`baselineRenderHash === renderHash`). Stale ⇒ `fail` (untrusted diff — BD6).
   - **Token conformance** — no unresolved **semantic** Figma⟷Lumen drift for this
     screen (from the last drift report; global-only drift is noted, not blocking).
   - **Component reuse** — built from existing Lumen components; mapping resolves at
     `verified` authority in the glossary (Code Connect rung filled where published).
   - **Accessibility** — `<slug>.a11y.md` present and its requirements met; project a11y
     checks pass for `<route>`.
   - **Responsive / interaction states** — documented breakpoints + states implemented.
   - **Handshake cleared** — `<slug>.handshake.json` is `cleared` (or logged `--override`)
     and `handshakeStatus` in meta matches (BD5).
3. **REPORT** a filled instance of the checklist template: per-item verdict + the evidence
   that decided it, and for each `fail` the exact human-gated command to run
   (`/figma-visual-regression`, `/figma-token-drift`, `/figma-glossary add`,
   `/figma-codeconnect`, `/design-handshake`). End with `Verdict: PASS | FAIL`.
4. **STOP** — report only. No fix is applied here; the canvas is never touched (D15).

## Notes

- Missing evidence for a heading ⇒ mark it `fail` with "evidence missing: <path>", never a
  silent pass. If the whole screen has no visual-regression entry yet, say so and point to
  the manifest's "Adding a screen" example in `/figma-visual-regression`.
- The advisory `.claude/hooks/design-qa-check` runs a lighter, non-blocking subset of these
  same mirror reads after a build; this command is the full, on-demand gate.
