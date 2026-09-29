<!--
  Accessibility spec template (Plan 02b §2 / Phase 5 F2).

  This is the a11y spec ENGINEERING IMPLEMENTS for a handshake-gated screen. Author one per node as
  `figma/nodes/<slug>.a11y.md` and reference it from `figma/nodes/<slug>.handshake.json.a11ySpecRef`.
  A handshake CANNOT clear without this spec attached (BD5 — a11y spec is a handshake precondition).

  Target: WCAG 2.1 AA (mandatory), WCAG 2.2 AA (aspirational). Author and review WITH the
  `accessibility-auditor` agent against `@.claude/standards/accessibility-standards.md`.

  Fill every section. "N/A" is an acceptable answer ONLY with a one-line reason — never leave a
  section blank. Delete these HTML comments in the authored copy.
-->

# Accessibility Spec — <Screen / Component name>

| Field | Value |
|---|---|
| Node | `<fileKey>:<nodeId>` (e.g. `2MbwX0rxNA1uhgDwlC7Z6G:299:12210`) |
| Slug | `<slug>` (matches `figma/nodes/<slug>.*`) |
| Figma frame | `<figmaName>` |
| Lumen target | `<lumenComponent>` (resolve via `.claude/config/figma-lumen-glossary.json`) |
| WCAG target | 2.1 AA (mandatory) |
| Authored / reviewed by | `<people.json handle>` + `accessibility-auditor` |
| Date | `<YYYY-MM-DD>` |

## 1. Roles & ARIA

- **Landmark roles** — semantic HTML first (`<nav>`, `<main>`, `<header>`, `<footer>`, `<section
  aria-labelledby>`); ARIA only where semantic HTML is insufficient.
- **Widget roles** — list each interactive region and its role/state (e.g. `role="dialog"
  aria-modal="true"`, `aria-expanded`, `aria-current="step"` on a stepper).
- **Names & descriptions** — `aria-label` / `aria-labelledby` / `aria-describedby` for every control
  whose visible text is not its accessible name.
- **Invalid ARIA to avoid** — note any anti-patterns the design must not tempt (e.g. `role` on a
  native element that already has it).

## 2. Keyboard interaction & focus order

- **Tab order** — the explicit logical order of focusable elements (top→bottom, left→right unless
  stated). No positive `tabindex`.
- **Keys** — Tab / Shift+Tab / Enter / Space / Arrow / Esc behaviour per widget (e.g. Esc closes the
  dialog and restores focus to the trigger; Arrow keys move between stepper steps).
- **Focus indicator** — visible `:focus-visible` indicator on every interactive element; never
  removed without a compliant replacement (≥ 3:1 contrast against adjacent colours).
- **No keyboard trap** — focus can always leave every region via the keyboard.
- **Initial focus / focus return** — where focus lands on open, and where it returns on close.

## 3. Color contrast (WCAG 2.1 AA)

- Body text ≥ **4.5:1**; large text (≥ 24px, or ≥ 18.66px bold) and UI components / graphical
  objects ≥ **3:1**.
- List each foreground/background pair with its measured ratio and pass/fail (resolve colours from
  the node's `.tokens.json` where a Pipeline-C token export exists).
- **No colour-only meaning** — every state (error, selected, disabled, required) also carries an
  icon or text label.

## 4. Screen-reader announcements

- **On load** — heading structure (single `<h1>`, no skipped levels) and the reading order a screen
  reader will follow.
- **Dynamic updates** — `aria-live` regions (`polite` for status, `assertive` for errors); what text
  is announced and when.
- **Control names as announced** — the accessible name each control exposes (verify it matches the
  visible label).

## 5. Motion / reduced-motion

- Any animation/transition and its trigger.
- `prefers-reduced-motion: reduce` behaviour — the reduced/removed motion alternative.
- No content that flashes more than 3× per second.

## 6. Error / empty / loading states

- **Error** — messages reference the specific field by name; associated via `aria-describedby`;
  `aria-invalid` on the field; error summary focus behaviour.
- **Empty** — accessible empty-state text (not conveyed by illustration alone).
- **Loading** — busy indication (`aria-busy` / live region); focus is not lost while content loads.
- **Forms** — every input has an associated `<label>` (never placeholder-only); autocomplete
  attributes on personal-data fields.

## 7. Test hooks (axe-core / Playwright)

- **axe-core** — the automated scan must pass with zero violations at the target ruleset; list any
  documented, justified exceptions.
- **Stable selectors** — `data-testid` / role-based selectors for the key controls, listed here so
  the Playwright a11y test and the component test target the same hooks.
- **Playwright checks** — keyboard-only walkthrough (Tab order + Esc/Enter), focus-return on dialog
  close, `@axe-core/playwright` assertion. Reference the E2E spec path once written.
