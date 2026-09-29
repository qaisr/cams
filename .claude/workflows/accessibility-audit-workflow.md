# Workflow: Accessibility Audit

## Purpose
Systematically identify and remediate accessibility issues to meet WCAG 2.1 AA.

## When to Use
- After building any new page, form, or modal
- Before any feature merges to `main`
- When Storybook a11y addon reports violations
- When modifying navigation, focus flow, or interactive components
- After a major UI library upgrade
- Quarterly full-app a11y audit

## Agents
- Primary: `accessibility-auditor`, `frontend-developer`
- Standards: `.claude/standards/accessibility-standards.md`
- Unload backend/DB agents during audit

## Audit Scopes

### Level 1: Automated (Every PR — Required)
```bash
# Run axe-core in component tests
pnpm turbo run test:a11y

# Run axe-core in Playwright E2E
pnpm playwright test --grep @accessibility
```

### Level 2: Component Audit (During Development)
```
@accessibility-auditor Audit this component for WCAG 2.1 AA compliance:
[Paste component code]

Check:
1. Semantic HTML and ARIA usage
2. Keyboard navigation
3. Focus management
4. Color contrast
5. Screen reader announcements
6. Error state accessibility
```

### Level 3: Page-Level Audit (Before Feature Merge)
```
@accessibility-auditor Perform a full page accessibility audit for {{PageName}}.
Reference: accessibility-standards.md

Provide:
1. Violations found (WCAG criterion reference)
2. Severity (Critical/Serious/Moderate/Minor)
3. Specific fix for each violation
4. Updated code with fixes applied
```

### Level 4: Flow Audit (Keyboard & Screen Reader)
```
@accessibility-auditor Audit the {{feature}} user flow for keyboard-only navigation:

Flow: [Login → Create Document → Submit Form → View Result]

Check:
1. Tab order is logical throughout the flow
2. Focus moves correctly after async operations
3. Modal focus trap works
4. All actions achievable without mouse
5. Skip link works
```

---

## Step 1: Automated Scanning

### Storybook (component level)
```bash
pnpm --filter=web run storybook:test
# Review violations in Storybook a11y panel
```

### Playwright axe scan (page level)
```typescript
// e2e/accessibility/{{feature}}.a11y.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('{{Feature}} Accessibility @accessibility', () => {
  test('List page has no violations', async ({ page }) => {
    await page.goto('/{{feature}}');
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .exclude('#known-exception') // Document exceptions
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('Create form has no violations', async ({ page }) => {
    await page.goto('/{{feature}}/create');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('Error states are accessible', async ({ page }) => {
    await page.goto('/{{feature}}/create');
    await page.click('button[type="submit"]'); // Trigger validation errors
    await page.waitForSelector('[role="alert"]');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
```

> **Alternative** using `axe-playwright` helper:
> ```typescript
> import { checkA11y } from 'axe-playwright';
> test('document list page is accessible', async ({ page }) => {
>   await page.goto('/documents');
>   await checkA11y(page, undefined, { detailedReport: true, detailedReportOptions: { html: true } });
> });
> ```

### ESLint a11y (code level)
```bash
pnpm turbo run lint
# jsx-a11y plugin runs automatically — zero warnings policy
```

---

## Step 2: Manual Testing Checklist

### Keyboard Navigation
- [ ] Tab through entire page — all interactive elements reachable
- [ ] Shift+Tab navigates backward correctly
- [ ] Enter/Space activates buttons/links
- [ ] Arrow keys work in menus, selects, date pickers
- [ ] Escape closes modals, dropdowns
- [ ] No keyboard traps (can always Tab out)
- [ ] Skip navigation link visible on first Tab press

### Screen Reader (VoiceOver on Mac)
```
Cmd+F5 to enable VoiceOver
VO+Right to navigate
VO+Space to activate
```
- [ ] Page title announced on navigation
- [ ] Headings create logical outline (h1 → h2 → h3)
- [ ] Images have meaningful descriptions
- [ ] Form errors announced immediately
- [ ] Loading states announced via `aria-live`
- [ ] Modal title announced when opened

### Visual
- [ ] 200% browser zoom — no horizontal scroll, no content hidden
- [ ] High contrast mode (OS) — all elements visible
- [ ] Color contrast passes (use browser DevTools → Accessibility)
- [ ] No information conveyed by color alone

---

## Step 3: Issue Classification

| Priority | Criteria | SLA |
|----------|----------|-----|
| P1 | Blocks core user task for keyboard/screen reader users | Fix before release |
| P2 | Significant friction for assistive technology users | Fix within 1 sprint |
| P3 | Enhancement / best practice | Fix within 2 sprints |

### Common Violations Reference

| Violation | Severity | Fix |
|-----------|----------|-----|
| Missing form label | Critical (P1) | Add `<label htmlFor="id">` |
| Missing alt text | Critical (P1) | Add descriptive `alt` |
| Missing keyboard access | Critical (P1) | Add `tabIndex`, keyboard handlers |
| Low color contrast | Serious (P2) | Update design tokens |
| Focus not visible | Serious (P2) | Add `focus-visible:ring` CSS |
| Missing ARIA on modal | Serious (P2) | Add `role="dialog"`, `aria-modal` |
| Dynamic content not announced | Moderate (P3) | Add `aria-live` region |

---

## Step 4: Remediation Patterns

### Missing label
```tsx
// ❌ Problem
<input type="search" placeholder="Search..." />

// ✅ Fix
<label htmlFor="search" className="sr-only">Search documents</label>
<input id="search" type="search" placeholder="Search..." />
```

### Missing button accessible name
```tsx
// ❌ Problem
<button onClick={onClose}><XIcon /></button>

// ✅ Fix
<button onClick={onClose} aria-label="Close dialog">
  <XIcon aria-hidden="true" />
</button>
```

### Missing focus indicator
```css
/* ✅ Always provide visible focus */
:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
/* Never: */
:focus { outline: none; } /* ❌ */
```

### Dynamic content not announced
```tsx
// ✅ Announce dynamic updates
<div role="status" aria-live="polite" aria-atomic="true">
  {message && <p>{message}</p>}
</div>
```

---

## Step 5: Document Findings
Create `docs/accessibility/audit-YYYY-MM-DD.md`:
```markdown
## Accessibility Audit Report

**Date:** YYYY-MM-DD
**Scope:** Documents module

### Automated Scan Results
- axe violations: 2 (P1: 0, P2: 1, P3: 1)
- jsx-a11y warnings: 0

### Issues Found
| ID | Severity | Element | Issue | Fix |
|----|----------|---------|-------|-----|
| A1 | P2 | DocumentFilter | Select has no label | Add aria-label |

### Status
[ ] A1 — Assigned to @dev, Sprint 12
```

---

## Sign-off Checklist (Pre-release)
- [ ] `axe-core` automated tests pass (0 violations) on all new pages
- [ ] `jsx-a11y`: zero warnings (`pnpm lint` clean)
- [ ] Storybook a11y panel: no violations in new/changed components
- [ ] Keyboard navigation tested manually
- [ ] Focus management verified for modals/dialogs
- [ ] VoiceOver spot-check on critical flows
- [ ] Color contrast verified for all new text/components
- [ ] Skip link present and functional
- [ ] Forms: all inputs labeled, errors announced
- [ ] Loading states announced via `aria-busy` or `aria-live`
- [ ] Audit report updated (`docs/accessibility/audit-YYYY-MM-DD.md`)

## Token Optimization

- **Load when**: WCAG sign-off before release, `/ui-test-accessibility`, or remediation of axe/Lighthouse findings.
- **Load only**: `accessibility-standards.md`, `accessibility-test-cases-template.md`. Add `playwright-e2e-standards.md` only when scripting E2E a11y assertions.
- **Unload after**: audit report committed under `docs/accessibility/`. Routine UI work uses the lighter checks in `frontend-ui-protocol.md`.
- **Hand-off to**: `frontend-developer` for fixes, `tech-lead` for release-gate sign-off.
