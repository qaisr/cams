<!--
  Design-handshake checklist template (Plan 02b §2 / Phase 5 F2).

  The design handshake is the HARD PRECONDITION for a clean `buildStatus: built` (BD5). A node cannot
  report a clean "built" until this checklist is worked through and its `.handshake.json` reaches
  `status: cleared` (or `not-required` for internal/experimental screens exempted by design).

  This is the human-facing checklist a reviewer fills in during the handshake. The machine record is
  `figma/nodes/<slug>.handshake.json`; the accessibility spec it references is
  `figma/nodes/<slug>.a11y.md` (authored from `accessibility-spec.md`). `/design-handshake <slug>`
  scaffolds all three.

  Every box must be ticked (or explicitly waived with a reason under "Decisions & deviations") before
  a reviewer clears the handshake. Delete these HTML comments in the authored copy.
-->

# Design Handshake — <Screen / Component name>

| Field | Value |
|---|---|
| Node | `<fileKey>:<nodeId>` (e.g. `2MbwX0rxNA1uhgDwlC7Z6G:299:12210`) |
| Slug | `<slug>` (matches `figma/nodes/<slug>.*`) |
| Figma frame | `<figmaName>` |
| Machine record | `figma/nodes/<slug>.handshake.json` |
| Status | `pending` → `cleared` \| `rejected` (or `not-required`) |

## 1. Component identity

- [ ] Figma frame name and node id recorded above and match the mirror sidecar.
- [ ] Target Lumen component resolved through `.claude/config/figma-lumen-glossary.json`
      (a **verified** entry — not an `inferred` proposal). Record the `figmaName → lumenComponent`
      pair. If no verified entry exists, run `/figma-glossary suggest` → `/figma-glossary add`
      **before** clearing.
- [ ] Scope of this handshake is one frame/screen (or an explicitly named set) — not a whole file.

## 2. Design review (squad + Lumen sign-off)

- [ ] **Squad designer** has reviewed the frame and confirms it represents the intended design.
- [ ] **Lumen (design-system) designer** confirms the frame composes existing Lumen
      primitives/components correctly and introduces no off-system pattern without a recorded
      deviation (see §6).
- [ ] Any new shared pattern has a home in the design system (or a ticket to add one) — it is not
      forked silently into this screen.

## 3. Token conformance (semantic > global — F3, Phase 6)

- [ ] Colours, spacing, typography, and radii reference **semantic** design tokens, not raw global
      values, wherever a semantic token exists (semantic-over-global — F3).
- [ ] Any raw/global-token or hard-coded value is listed under "Decisions & deviations" with a
      reason. *(Automated token-conformance checking lands in Phase 6 / F3; until then this is a
      manual review item — do not fabricate an automated gate.)*

## 4. Accessibility spec attached

- [ ] `figma/nodes/<slug>.a11y.md` exists, authored from `.claude/templates/accessibility-spec.md`.
- [ ] It was authored/reviewed with the `accessibility-auditor` agent against
      `@.claude/standards/accessibility-standards.md` (WCAG 2.1 AA).
- [ ] `handshake.json.a11ySpecRef` points at that file. **A handshake cannot clear without this —
      the a11y spec is a precondition (BD5).**

## 5. Platform / tech feasibility

- [ ] **Platform representative** confirms the design is implementable on the CANS stack
      (NextJS 16 App Router / Lumen / Tailwind) with no blocking constraint.
- [ ] Data/loading/error/empty states in the design have a feasible source (existing hooks or a
      planned endpoint) — no state is designed that the app cannot produce.
- [ ] Responsive / breakpoint behaviour is specified or explicitly deferred.

## 6. Decisions & deviations

Record every intentional deviation, waiver, or open decision — each maps to a `decisions[]` entry in
`handshake.json`:

| Decision / deviation | Rationale | Raised by | Status |
|---|---|---|---|
| _e.g. Uses a global spacing token pending a semantic alias_ | _F3 not yet in place_ | `<handle>` | accepted / deferred |

## 7. Sign-off

The handshake is cleared **only** when §1–§5 are satisfied (or waived in §6) and all three
participants have signed. Participants resolve through `.claude/config/people.json` (D8).

| Role | Handle (people.json) | Signed | Date |
|---|---|---|---|
| Squad designer | `<squadDesigner>` | ☐ | `<YYYY-MM-DD>` |
| Lumen designer | `<lumenDesigner>` | ☐ | `<YYYY-MM-DD>` |
| Platform rep | `<platformRep>` | ☐ | `<YYYY-MM-DD>` |

On clearing: set `handshake.json.status = "cleared"`, stamp `clearedAt`, and re-run `/figma reindex`
so `/figma coverage` shows a clean **built** for this node. A `rejected` handshake keeps the node at
**`built (⚠ handshake pending)`** in coverage until re-worked. `--override "<reason>"` may force a
build past a non-cleared gate, but the reason is logged to the sidecar
(`handshakeOverrideReason`) and the run log — it is **never silent**.
