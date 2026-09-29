---
name: ui-test-accessibility
description: Run focused accessibility verification and remediation planning
applyTo: "**"
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# Test Accessibility

**Purpose**: Comprehensive accessibility verification with remediation guidance

**Use this command when**:
- Need accessibility compliance (WCAG AA)
- Created new UI and want a11y check
- Found accessibility issues in audit
- Preparing for accessibility review/audit
- Meeting compliance requirements

---

## Accessibility Checks

### Semantic Structure
- [ ] Proper heading hierarchy (h1 → h2 → h3)
- [ ] Form inputs have labels
- [ ] Buttons use `<button>` not `<div>`
- [ ] Lists use semantic `<ul>`, `<ol>`
- [ ] Tables have proper `<thead>`, `<tbody>`
- [ ] Navigation landmarks present

### ARIA
- [ ] `aria-label` on icon buttons
- [ ] `aria-describedby` for complex fields
- [ ] `aria-live` for dynamic content
- [ ] No redundant ARIA
- [ ] ARIA roles appropriate

### Keyboard Navigation
- [ ] All interactive elements keyboard accessible
- [ ] Tab order logical and visible
- [ ] No keyboard traps
- [ ] Escape key closes modals/menus
- [ ] Enter/Space triggers buttons

### Focus Management
- [ ] Focus visible (outline/ring)
- [ ] Focus trapped in modals
- [ ] Focus restored after closing
- [ ] Skip links for navigation
- [ ] Focus indicators clear (3:1 contrast minimum)

### Color & Contrast
- [ ] Text contrast WCAG AA (4.5:1)
- [ ] Large text contrast WCAG AA (3:1)
- [ ] Graphics/UI components contrast (3:1)
- [ ] Color not only indicator (icons, patterns)
- [ ] Light/dark mode both compliant

### Cognitive
- [ ] Language clear and simple
- [ ] Error messages clear
- [ ] Help text available
- [ ] Process steps labeled
- [ ] Consistent navigation

---

## Workflow

### Step 1: Scope

```
🔍 Accessibility Testing

What scope?

1. Single component
2. Page/feature
3. User flow (multi-page)
4. Entire application

Select: 1 (Component)
Component path: src/components/Form.tsx
```

### Step 2: Automated Checks

AI runs:

```
⚙️ Running automated accessibility checks...

- axe-core scanning
- WAVE evaluation
- Lighthouse a11y
- Pa11y analysis

Results:
- ✅ Semantic HTML
- ❌ Color contrast (3 violations)
- ⚠️ ARIA attributes (1 warning)
```

### Step 3: Manual Testing

```
👨‍💻 Manual accessibility testing...

Keyboard Navigation:
- Tab through component: ✅
- Enter on buttons: ✅
- Escape closes: N/A
- Focus visible: ⚠️ (slight outline)

Screen Reader (NVDA):
- Announces correctly: ✅
- Labels clear: ✅
- State changes announced: ✅

Color Contrast:
- Text #333 on #fff: ✅ (16:1)
- Text #666 on #f5f5f5: ❌ (3.2:1, needs 4.5:1)
```

### Step 4: Findings Report

Generated report:

```markdown
# Accessibility Test Report

**Component**: Form.tsx
**Date**: 2026-04-21
**Status**: 2 Issues Found

## 🔴 Critical Issues

1. **Insufficient Color Contrast**
   - Location: .gray-text class
   - Current: #666 on #f5f5f5 = 3.2:1
   - Required: 4.5:1 (WCAG AA)
   - Severity: CRITICAL
   - Fix: Change #666 to #555 or darker
   - Impact: Color-blind users, low vision users

2. **Missing Form Label**
   - Element: <input type="email"> line 24
   - Issue: No associated <label>
   - Severity: CRITICAL
   - Fix: Add <label htmlFor="email">Email</label>
   - Impact: Screen reader users can't identify field

## 🟡 Medium Issues

3. **Focus Outline Too Subtle**
   - Issue: Blue outline hard to see
   - Suggestion: Use box-shadow or thicker outline
   - Impact: Keyboard users struggle to see focus

## ✅ Passed Checks

- Semantic HTML structure
- Heading hierarchy correct
- Buttons keyboard accessible
- ARIA attributes appropriate
- Responsive design (accessible at all breakpoints)
```

### Step 5: Remediation Plan

```markdown
## Remediation Plan

### Step 1 (Immediate)
- [ ] Fix text contrast in .gray-text
- [ ] Add form labels

Estimated time: 30 minutes
Impact: Resolves 2 critical issues

### Step 2 (Follow-up)
- [ ] Improve focus visibility
- [ ] Test with screen reader

Estimated time: 1 hour
Impact: Better keyboard experience
```

---

## Testing Tools

AI can use:

- **axe DevTools**: Automated a11y scanning
- **WAVE**: Visual feedback on issues
- **Lighthouse**: Audit via Chrome DevTools
- **NVDA/VoiceOver**: Screen reader testing
- **Color Contrast Analyzer**: Contrast checking
- **Keyboard Navigation**: Manual testing

---

## Accessibility Standards

Target: **WCAG 2.1 Level AA**

Key Requirements:
- 1.4.3 Contrast (Minimum) - 4.5:1 for normal text
- 2.1.1 Keyboard - All functionality keyboard accessible
- 2.1.2 No Keyboard Trap - Can navigate away
- 2.4.3 Focus Order - Logical and visible
- 3.3.1 Error Identification - Clear error messages
- 3.3.4 Error Prevention - Confirm critical actions
- 4.1.3 Status Messages - Announced to screen readers

---

## Quick Wins

Fast a11y improvements:

- [ ] Add color contrast using theme tokens
- [ ] Add `aria-label` to icon buttons
- [ ] Ensure focus outline visible
- [ ] Connect form labels to inputs
- [ ] Add error text with ARIA
- [ ] Ensure heading hierarchy

---

## Output

✅ Accessibility report with findings
✅ Priority-ranked issues
✅ Remediation guidance
✅ Test evidence and screenshots
✅ Compliance status (pass/fail per criterion)
✅ Next steps

---

## Related Commands

- `/ui-audit` — Overall quality including a11y
- `/ui-improve` — Fix identified a11y issues
- `/ui-review` — Final a11y validation

---

## References

- WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/
- Component library: `@.claude/docs/component-library.md`
- UI standards: `@.claude/standards/ui-design-standards.md`
