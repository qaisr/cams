---
name: ui-improve
description: Analyze and refactor UI components against quality standards
applyTo: "**"
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# Improve UI

**Purpose**: Refactor and improve existing UI against design standards

**Use this command when**:
- Found issues from `/ui-audit`
- Need to upgrade component quality
- Refactoring for consistency
- Improving accessibility or responsiveness
- Post-audit fixes

---

## Workflow

### Step 1: Scope & Context

User specifies what to improve:

```
🎨 UI Improvement

What would you like to improve?

1. Single component (e.g., Button.tsx)
2. Feature/page (e.g., dashboard pages)
3. Specific aspect (e.g., "accessibility", "tokens", "spacing")
4. Issues from audit (reference /ui-audit report)

Example: Improve src/components/Card.tsx for token compliance
```

### Step 2: Load Standards

- `@.claude/standards/ui-design-standards.md`
- `@.claude/standards/component-usage.md` — check Storybook library before proposing new components
- `@.claude/docs/component-library.md`

Wireframe gate:

- Read `.claude/wireframes/.generated-manifest.json` before proposing UI improvements, then apply **Wireframe Precedence** (`@.claude/standards/component-usage.md#wireframe-precedence-canonical`). Improve the living component — do not treat a `converted` raw wireframe as an override; flag conflicts.
- Read **UI Library** in `@.claude/CLAUDE.md` Critical Constraints.
- If wireframes use a different UI library/styling approach, convert improvements to configured UI library constraints while preserving layout, hierarchy, spacing, states, and interactions.

### Step 3: Analysis

AI analyzes current implementation for:

- Alignment with relevant wireframe sections (when `.claude/wireframes/*` exists)
- Fidelity to configured **UI Library** constraints after wireframe-to-library conversion

```
📋 Analysis: Card Component

Current State:
- ✅ Semantic HTML correct
- ❌ Using hardcoded colors (#f5f5f5, #333333)
- ⚠️  Padding inconsistent (12px, 16px, 20px mixed)
- ❌ Missing focus states
- ✅ Accessibility labels present

Recommended Improvements:
1. Replace hardcoded colors with design system tokens
2. Standardize spacing to token values
3. Add focus and hover states
4. Document component variants

Estimated Effort: 1.5 hours
Impact: High (visual consistency, token governance)
```

### Step 4: Refactoring

AI implements improvements:

```
✨ Refactoring Card component...

Changes:
- Line 14: padding="16px" → padding="tile"
- Line 18: background="#f5f5f5" → surface="container"
- Line 24: color="#333333" → color="default"
- Line 45: Adding focus state with focus-visible
- Line 52: Adding hover state transition

Tests: Updating snapshots and integration tests
```

### Step 5: Validation

Before-and-after comparison:

- Confirm updated UI still matches wireframe intent
- Confirm no regression in wireframe-to-configured-library mapping

```
📊 Improvement Summary

Before:
- Visual Score: 7/10
- Token Score: 4/10
- A11y Score: 8/10
- Overall: 6.3/10

After:
- Visual Score: 9/10
- Token Score: 9/10
- A11y Score: 9/10
- Overall: 9/10

✅ Quality improved 43%
```

---

## Improvement Types

### Token Compliance
```tsx
// Before
<Box style={{ padding: '16px', backgroundColor: '#f5f5f5' }}>

// After
<Box surface="container" padding="tile">
```

### Spacing Standardization
```tsx
// Before
<Flex gap="12px" padding="20px">

// After
<Flex gap="container-small" padding="tile">
```

### State Coverage
```tsx
// Before
<Button>Save</Button>

// After
<Button>
  {isLoading ? <Spinner /> : 'Save'}
</Button>
// + hover, focus, active states
```

### Accessibility
```tsx
// Before
<div onClick={handleClick}>Click me</div>

// After
<Button onPress={handleClick} autoFocus={isFocused}>
  Click me
</Button>
```

### Responsive
```tsx
// Before
<Box padding="20px">

// After
<Box padding={{ mobile: 'container-small', tablet: 'tile', desktop: 'tile' }}>
```

---

## Output

✅ Refactored code with improvements
✅ Updated tests and snapshots
✅ Accessibility validation passed
✅ Token compliance verified
✅ Before/after comparison
✅ Performance impact analysis

---

## Quick Wins

Fast improvements you can make:

- [ ] Replace hardcoded colors with tokens
- [ ] Standardize spacing values
- [ ] Add missing focus states
- [ ] Update variant definitions
- [ ] Document component usage

---

## After Improvement

Next steps:

1. Review changes with team
2. Run tests to verify no regressions
3. `/ui-review` for final quality check
4. Merge and deploy

---

## Related Commands

- `/ui-audit` — Find improvement opportunities
- `/ui-review` — Final quality gate before merge
- `/ui-preview-themes` — Check theme consistency
- `/ui-apply-theme` — Apply theme updates

---

## References

- UI standards: `@.claude/standards/ui-design-standards.md`
- Component library: `@.claude/docs/component-library.md`
- Design tokens: `@.claude/docs/component-library.md`
