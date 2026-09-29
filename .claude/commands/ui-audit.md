---
name: ui-audit
description: Run comprehensive UI quality audit with scoring and prioritized findings
applyTo: "**"
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# Audit UI Quality

**Purpose**: Comprehensive UI quality inspection and scoring against design standards

**Use this command when**:
- Need to assess UI quality across pages or features
- Want prioritized list of issues to fix
- Checking compliance with design system and token standards
- Creating baseline before redesign
- Quarterly quality checks

---

## Audit Process

### Step 1: Scope Definition

User specifies scope:

```
📊 UI Quality Audit

Audit scope:

1. Single page (e.g., src/app/dashboard/page.tsx)
2. Feature (e.g., all dashboard pages)
3. Component (e.g., all Button variants)
4. Entire application
5. Custom path or glob pattern

Select scope (1-5):
```

### Step 2: Load Standards

- `@.claude/standards/ui-design-standards.md`
- `@.claude/standards/component-usage.md` — reference for what Storybook components exist
- `@.claude/docs/component-library.md`

Wireframe gate:

- Read `.claude/wireframes/.generated-manifest.json` before auditing UI quality, then apply **Wireframe Precedence** (`@.claude/standards/component-usage.md#wireframe-precedence-canonical`). Audit-specific nuance: for a `converted` component/pattern wireframe, treat component and wireframe as peers — report drift as a finding to reconcile, not automatically as a component defect.
- Read **UI Library** in `@.claude/CLAUDE.md` Critical Constraints.
- If wireframes use a different UI library/styling approach, evaluate compliance against the configured UI library constraints while preserving wireframe layout, hierarchy, spacing, states, and interactions.

### Step 3: Inspection

AI inspect components for:

**Wireframe Alignment (manifest-governed)**
- For page/layout wireframes: UI aligns with relevant wireframe sections/layouts
- For `converted` component/pattern wireframes: component and wireframe treated as equal peers — drift is a reconcile-and-flag finding, not an automatic defect
- Layout and hierarchy fidelity preserved
- Interaction intent preserved across states

**UI Library Mapping Fidelity**
- If wireframes and configured **UI Library** differ, mapping is explicit and consistent
- Converted primitives follow configured UI library constraints

**Visual Consistency**
- Hierarchy and emphasis appropriate
- Spacing aligned to token grid
- Typography scale followed
- Colors from design system palette

**Token Compliance**
- No hardcoded hex values
- Surface props use valid tokens
- Lozenge variants correctly mapped
- Spacing uses token values

**Responsive Behavior**
- Validates at 375px, 768px, 1440px
- Layout stable across breakpoints
- Text readable at all sizes
- Touch targets 48px+ on mobile

**State Coverage**
- Loading states present/styled
- Error states with messages
- Empty states with guidance
- Success states with feedback

**Accessibility**
- Semantic HTML structure
- ARIA labels where needed
- Focus visible on interactive
- Color contrast WCAG AA+
- Keyboard navigation works

**Design System Pattern Reuse**
- Familiar patterns used
- Component library consulted
- Minimal custom wrappers
- Clear composition intent

### Step 4: Scoring & Findings

AI generates report with scoring:

```
📈 UI Quality Audit Report

Scope: src/app/dashboard/**
Components Inspected: 24
Issues Found: 7

Scoring:

Visual Consistency:    ⭐⭐⭐⭐ (8/10)
Token Compliance:     ⭐⭐⭐   (6/10)
Responsive Design:    ⭐⭐⭐⭐⭐ (10/10)
State Coverage:       ⭐⭐⭐   (7/10)
Accessibility:        ⭐⭐⭐⭐ (8/10)
Pattern Reuse:        ⭐⭐⭐   (6/10)

OVERALL SCORE: 7.5/10 (Good - needs improvement in tokens and patterns)
```

### Step 5: Prioritized Findings

Generated `docs/ui-audit-report.md`:

```markdown
# UI Quality Audit Report

**Date**: 2026-04-21
**Scope**: src/app/dashboard/**
**Overall Score**: 7.5/10

## 🔴 Critical Issues (Fix First)

1. **Hardcoded hex values in Button component**
   - Location: src/components/Button.tsx:24-31
   - Issue: Using #1368ef instead of a design token
   - Impact: Visual consistency, token governance
   - Fix: Use `surface="blue"` or `color="primary"`
   - Effort: 15 min

2. **Missing error states in Form**
   - Location: src/components/Form.tsx
   - Issue: No error message display
   - Impact: User confusion on validation failure
   - Fix: Add MessageBanner variant="error"
   - Effort: 30 min

## 🟡 Medium Issues (Should Fix)

3. **Spacing inconsistency in Card**
   - Location: src/components/Card.tsx:14
   - Issue: Using padding="tile-medium" instead of token
   - Impact: Visual alignment issues
   - Fix: Use padding="tile" (standard)
   - Effort: 10 min

## 🟢 Low Issues (Nice to Have)

4. **Unused component variant**
   - Recommendation: Remove or document usage

## 📊 Breakdown by Category

| Category | Score | Issues | Time |
|----------|-------|--------|------|
| Visual | 8/10 | 3 | 1.5h |
| Tokens | 6/10 | 4 | 2h |
| Responsive | 10/10 | 0 | - |
| States | 7/10 | 2 | 1h |
| A11y | 8/10 | 1 | 30m |
| Patterns | 6/10 | 2 | 1.5h |

Total estimated fix time: 6.5 hours

## Quick Wins (15-min fixes)

- [ ] Fix Button hardcoded colors
- [ ] Update Card spacing tokens
- [ ] Add missing focus states
```

---

## Output

✅ Audit report: `docs/ui-audit-report.md`
✅ Scoring by category
✅ Prioritized issues (critical → low)
✅ Estimated effort per fix
✅ Quick wins highlighted
✅ File locations and line numbers

---

## After Audit

Next steps:

1. Review findings with team
2. Run `/ui-improve` to fix issues
3. Re-audit after improvements
4. Track score progression over time

---

## Related Commands

- `/ui-improve` — Fix issues found in audit
- `/ui-review` — Final quality gate
- `/ui-apply-theme` — Apply theme consistency
- `/ui-preview-themes` — Check theme quality

---

## References

- UI standards: `@.claude/standards/ui-design-standards.md`
- Component library: `@.claude/docs/component-library.md`
- Design system tokens: `@.claude/docs/component-library.md`
- Current theme: `@.claude/docs/current-theme.md`
