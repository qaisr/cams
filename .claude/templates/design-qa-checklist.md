# Design-QA checklist — `<slug>`

<!--
  Template for /design-qa (Plan 02b F5 / Phase 6). One rendered instance per built
  hi-fi screen, written to a throwaway report (never committed, never mutating the
  mirror or canvas). The command fills <slug>/<nodeId>/<route> and ticks each box
  from mirror-only evidence. OFFLINE, NO MCP (BD9). Detection/report only — a failed
  item routes to a human-gated command, it never auto-fixes.

  Evidence sources are all on disk:
    figma/nodes/<slug>.meta.json        renderHash / handshakeStatus / buildStatus / componentRef
    figma/nodes/<slug>.png              mirror baseline render
    figma/nodes/<slug>.a11y.md          Phase-5 accessibility spec (design-handshake)
    figma/nodes/<slug>.handshake.json   Phase-5 handshake record
    figma/.visual-regression/manifest.json   F5 lastResult for this slug
    .claude/config/figma-lumen-glossary.json component-name resolution + Code Connect rung
  Nothing here calls Figma/Lumen MCP; the live analyses live in /figma-token-drift
  and /figma-codeconnect, which this checklist points to.
-->

- **Node:** `<nodeId>` (colon form — D5)   ·   **Route:** `<route>`
- **Generated:** `<ISO>`   ·   **Source:** committed mirror (no MCP)

Each item is **pass / fail / n/a**, with the evidence that decided it. A `fail`
names the human-gated command that owns the fix — this checklist changes nothing.

---

## 1. Visual parity (F5)
- [ ] The screen's `figma/.visual-regression/manifest.json` entry exists and its
      `lastResult.status` is `pass` (diffRatio ≤ threshold).
- [ ] The entry is **not stale** — `baselineRenderHash` still equals the node's current
      `renderHash` in `<slug>.meta.json` (BD6). Stale ⇒ this item is `fail` and the
      diff itself is untrusted.
- **On fail →** run `/figma-visual-regression <slug>`; if stale, `/figma pull` (MCP, local
  dev only) then refresh the baseline. Never refresh `baselineRenderHash` from here.

## 2. Token conformance (F3)
- [ ] No **semantic-tier** Figma⟷Lumen token drift affects this screen's colors,
      spacing, or type (per the last `/figma-token-drift` report / the advisory
      `token-drift-check` signal).
- [ ] Global/primitive drift, if any, is noted but not blocking.
- **On fail →** run `/figma-token-drift` (detection only — never rewrites tokens, Lumen
  config, or the baseline; a human decides — BD4 / D21).

## 3. Component reuse (Lumen-first)
- [ ] The screen composes existing `apps/web/src/components/` (Lumen-based) components;
      no bespoke re-implementation of a component that already exists.
- [ ] Each mapped Figma component resolves to a Lumen component via
      `.claude/config/figma-lumen-glossary.json` at `verified` authority (Code Connect
      rung filled where a mapping is published — `buildStatus`/`componentRef` set).
- **On fail →** `/figma-glossary add` for a missing/inferred mapping; `/figma-codeconnect
  <node>` to publish the template mapping and fill the top rung.

## 4. Accessibility (Phase-5 `.a11y.md`)
- [ ] `figma/nodes/<slug>.a11y.md` exists and its requirements (roles, labels, focus
      order, contrast, keyboard paths) are satisfied by the build.
- [ ] Automated a11y checks pass for `<route>` (axe/Playwright — the project a11y gate),
      with no new violations.
- **On fail →** address per `@.claude/standards/accessibility-standards.md`; the spec itself
  is authored/updated by `/design-handshake <slug>` (it scaffolds the `.a11y.md`).

## 5. Responsive / interaction states
- [ ] Documented breakpoints render without overflow/clipping against the mirror intent.
- [ ] Interaction states present in the design (hover / focus / active / disabled /
      loading / empty / error) are implemented.
- **On fail →** implement the missing state per the design; re-run `/figma-visual-regression`
  for the affected viewport.

## 6. Handshake cleared (Phase-5 gate — BD5)
- [ ] `figma/nodes/<slug>.handshake.json` exists and is `status: cleared` (or a logged
      `--override` with a reason). A `pending`/`rejected` handshake ⇒ `fail`.
- [ ] The node meta sidecar's `handshakeStatus` matches the handshake record.
- **On fail →** run `/design-handshake <slug> --clear` (after the checklist is satisfied)
  or `--override "<reason>"`. The build is not clean while this gate is open.

---

## Verdict
`<pass>` of `<total-applicable>` items — **`<PASS | FAIL>`**.

> Report only. This checklist never edits code, the mirror, the glossary, or the Figma
> canvas (D15). Every fix is a separate, human-invoked, gated command named above.
