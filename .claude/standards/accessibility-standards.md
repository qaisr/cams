# Accessibility Standards (WCAG 2.1 AA)

> **Standard**: WCAG 2.1 AA (mandatory), WCAG 2.2 AA (target).
> **Load when**: building UI components, pages, or forms. Unload for pure backend tasks.

## Compliance Target
WCAG 2.1 Level AA — enforced via automated + manual testing.

---

## Mandatory Requirements (POUR)

### Perceivable
- All images: meaningful `alt` text or `alt=""` for decorative
- Color contrast ratio ≥ 4.5:1 (text), ≥ 3:1 (large text/UI components)
- No information conveyed by color alone — use icons or text labels
- Form inputs: always have associated `<label>` (not placeholder-only)

### Operable
- Full keyboard navigation: Tab, Shift+Tab, Enter, Space, Arrow keys
- Visible focus indicator on all interactive elements (`:focus-visible`)
- No keyboard traps
- Skip navigation link as first focusable element
- Modal dialogs: trap focus inside, restore on close

### Understandable
- `lang` attribute on `<html>`
- Error messages reference specific field names
- Autocomplete attributes on personal data fields (name, email, etc.)

### Robust
- ARIA used only when semantic HTML is insufficient
- ARIA roles, states, properties must be valid and correct
- Live regions (`aria-live`) for dynamic content updates

---

## Core Patterns

### 1. Semantic HTML First
```tsx
// ✅ Use semantic elements
<nav aria-label="Main navigation">
<main id="main-content">
<section aria-labelledby="section-heading">
<article>
<aside>
<header> / <footer>

// ❌ Avoid div soup
<div class="nav"> ... </div>
<div class="main"> ... </div>
```

### 2. Focus Management
```tsx
// ✅ Visible focus indicator (never remove without replacement)
// Tailwind: focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none

// ✅ Modal focus trap
import { FocusTrap } from '@radix-ui/react-focus-trap'; // or use Headless UI

// ✅ After async action, restore focus
const buttonRef = useRef<HTMLButtonElement>(null);
// After modal closes:
buttonRef.current?.focus();

// ✅ Skip link (every page)
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:p-2">
  Skip to main content
</a>
```

### 3. Color & Contrast
```typescript
// Design tokens must meet contrast ratios:
// Text on background: 4.5:1 minimum
// Large text (18pt / 14pt bold): 3:1 minimum
// UI components (borders, icons): 3:1 minimum
// Use: https://webaim.org/resources/contrastchecker/

// Never convey info by color alone:
// ❌ <span style="color: red">Error</span>
// ✅ <span><ErrorIcon aria-hidden="true" /> Error: field required</span>
```

---

## Component-Level Requirements

### Forms
```tsx
// ✅ Correct — label, describedby, invalid, autocomplete
<label htmlFor="email">Email address</label>
<input
  id="email"
  type="email"
  aria-describedby="email-error"
  aria-invalid={!!errors.email}
  autoComplete="email"
/>
{errors.email && (
  <span id="email-error" role="alert">{errors.email.message}</span>
)}

// ✅ Required fields
<input aria-required="true" />
// AND visible indicator: <span aria-hidden="true">*</span>

// ❌ Wrong — no label, placeholder only (disappears on type, fails contrast)
<input type="email" placeholder="Email address" />
```

### Buttons & Links
```tsx
// ✅ Icon button must have accessible name
<button aria-label="Close dialog">
  <XIcon aria-hidden="true" />
</button>

// ✅ Link must describe destination
<a href="/reports">View reports</a>

// ❌ Non-descriptive
<a href="/reports">Click here</a>
```

### Tables
```tsx
<table>
  <caption>Monthly Sales Report</caption>
  <thead>
    <tr><th scope="col">Month</th><th scope="col">Revenue</th></tr>
  </thead>
  <tbody>...</tbody>
</table>
```

### Dialogs / Modals
```tsx
<dialog
  aria-labelledby="dialog-title"
  aria-describedby="dialog-desc"
>
  <h2 id="dialog-title">Confirm Delete</h2>
  <p id="dialog-desc">This action cannot be undone.</p>
</dialog>
```

### Loading States
```tsx
// Announce loading to screen readers
<div aria-live="polite" aria-busy={isLoading} aria-label={isLoading ? 'Loading results...' : undefined}>
  {isLoading ? <Spinner aria-label="Loading..." /> : <Content />}
</div>
```

### Dynamic Content (Toasts & Route Changes)
```tsx
// ✅ Toast notifications
<div aria-live="polite" aria-atomic="true" className="sr-only" id="toast-region" />

// ✅ Route changes (Next.js)
// Announce page title on route change via aria-live region
```

---

## Automated Testing

### Unit & Component Tests (jest-axe)
```typescript
// jest.setup.ts
import { configureAxe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

// Component test
it('has no accessibility violations', async () => {
  const { container } = render(<MyForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### E2E Tests (Playwright + axe-core)
```typescript
import AxeBuilder from '@axe-core/playwright';

const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
  .analyze();
expect(results.violations).toEqual([]);
```

### Static Analysis
- `eslint-plugin-jsx-a11y` — zero warnings policy
- Storybook: `@storybook/addon-a11y` on all stories
- Run `axe` scan on every page in CI

---

## Manual Testing Checklist
- [ ] Keyboard-only navigation through all flows
- [ ] Screen reader test (NVDA/JAWS on Windows, VoiceOver on Mac)
- [ ] 200% browser zoom — no content loss or horizontal scroll
- [ ] High contrast mode — all elements visible
- [ ] Color blindness simulation (Stark / browser DevTools)

## Component Done Checklist
Before marking any UI component done:
- [ ] Keyboard navigable (Tab, Enter, Space, Escape, Arrow keys as appropriate)
- [ ] Focus visible and logical order
- [ ] ARIA roles/labels correct
- [ ] Color contrast passes (4.5:1 text, 3:1 UI components)
- [ ] Screen reader tested (or axe-core passes)
- [ ] Works at 200% zoom without horizontal scroll
- [ ] Error states announced via `role="alert"` or `aria-live`

## Token Optimization

- **Load when**: any UI implementation OR full WCAG audit; `/ui-test-accessibility`.
- **Load only**: this standard + `accessibility-test-cases-template.md`. Add `playwright-e2e-standards.md` only when scripting a11y E2E.
- **Unload after**: a11y checks pass — axe clean, keyboard flows verified, contrast verified.
