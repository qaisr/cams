---
name: ui-review
description: Final UI quality gate for implementation readiness
applyTo: "**"
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# Review UI Quality

**Purpose**: Final quality gate to verify UI implementation meets all standards

**Use this command when**:
- Feature implementation complete and ready for review
- Need final sign-off before merge/release
- Validating against all quality criteria
- Creating deployment checklist

---

## Review Checklist

### Wireframe Alignment (manifest-governed) ✅
> Apply Wireframe Precedence (see `@.claude/standards/component-usage.md`). Read `.claude/wireframes/.generated-manifest.json` first. Page/layout wireframes lead; `converted` component/pattern wireframes carry equal weight with the generated component (drift = reconcile-and-flag, not an automatic defect).
- [ ] `.claude/wireframes/.generated-manifest.json` and relevant wireframes inspected before review
- [ ] Relevant wireframe sections identified for the reviewed scope
- [ ] For page/layout scope: final UI preserves wireframe layout and hierarchy intent
- [ ] For page/layout scope: final UI preserves wireframe interaction/state intent
- [ ] For `converted` component/pattern scope: component and wireframe reconciled as equal peers, conflicts flagged

### UI Library Conversion Fidelity ✅
- [ ] **UI Library** constraint in `@.claude/CLAUDE.md` verified
- [ ] If wireframe library differs, implementation converted to configured UI library constraints
- [ ] Mapping from wireframe primitives to configured UI library primitives is consistent

### Visual Consistency ✅
- [ ] Hierarchy and emphasis clear and appropriate
- [ ] Spacing aligned to design system grid
- [ ] Typography scale followed consistently
- [ ] Colors from project design system palette only
- [ ] No visual regressions from current theme
- [ ] Component variants styled correctly

### Design System & Token Compliance ✅
- [ ] All surfaces use valid design system tokens
- [ ] No hardcoded color hex values
- [ ] Lozenges/badges use correct variants
- [ ] Spacing uses token values (container, tile, etc.)
- [ ] Typography uses design system scale
- [ ] Border radius consistent with theme

### Responsive Design ✅
- [ ] Validates at 375px (mobile)
- [ ] Validates at 768px (tablet)
- [ ] Validates at 1440px (desktop)
- [ ] No layout breakage at any breakpoint
- [ ] Touch targets 48px+ on mobile
- [ ] Text readable at all sizes
- [ ] Images and media scale correctly

### State Coverage ✅
- [ ] Loading state present and styled
- [ ] Error state with helpful message
- [ ] Empty state with guidance
- [ ] Success state with feedback
- [ ] All state transitions smooth
- [ ] Disabled states clearly marked

### Accessibility ✅
- [ ] Semantic HTML structure correct
- [ ] Heading hierarchy appropriate (h1 → h2 → h3)
- [ ] Form labels connected to inputs
- [ ] ARIA labels where needed (aria-label, aria-describedby)
- [ ] Keyboard navigation works
- [ ] Focus visible on all interactive elements
- [ ] Focus order logical
- [ ] Color contrast WCAG AA (4.5:1 text, 3:1 graphics)
- [ ] No keyboard traps
- [ ] Screen reader tested

### Pattern Reuse ✅
- [ ] Patterns from component-library.md referenced
- [ ] No duplicate patterns introduced
- [ ] Minimal custom wrappers/styling
- [ ] Composition intent clear in JSDoc

### Performance ✅
- [ ] No unnecessary re-renders
- [ ] Images optimized (WebP, proper sizing)
- [ ] CSS-in-JS or Tailwind performant
- [ ] Bundle size impact acceptable
- [ ] Layout shift prevented (CLS)

### Testing ✅
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Accessibility tests pass (axe, etc.)
- [ ] E2E tests pass
- [ ] Coverage meets threshold (>80%)

### Documentation ✅
- [ ] Component JSDoc complete
- [ ] Usage examples provided
- [ ] Props documented and typed
- [ ] Accessibility notes included
- [ ] States explained (if complex)

---

## Review Process

### Step 1: Scope Definition

```
🔍 UI Review

What scope would you like to review?

1. Single component
2. Page/feature
3. Specific changes (provide PR/commit)
4. Full application
```

### Step 2: Load Standards

- `@.claude/standards/ui-design-standards.md`
- `@.claude/docs/component-library.md`

Wireframe gate:

- Read `.claude/wireframes/.generated-manifest.json` before final UI review, then apply **Wireframe Precedence** (`@.claude/standards/component-usage.md#wireframe-precedence-canonical`) — review a `converted` component and its wireframe as peers, flag drift to reconcile.
- Read **UI Library** in `@.claude/CLAUDE.md` Critical Constraints.
- If wireframes use a different UI library/styling approach, validate converted implementation against configured UI library constraints while preserving wireframe intent.

### Step 3: Automated Checks

```
⚙️ Running checks...

- ESLint: ✅ Pass
- TypeScript: ✅ Pass (no errors)
- CSS-in-JS: ✅ Pass (no unused styles)
- Accessibility: ✅ Pass (axe: 0 violations)
- Tests: ✅ Pass (24/24 tests)
- Coverage: ✅ Pass (85% statements)
```

### Step 4: Manual Review

```
👨‍💻 Manual review...

- Visual: ✅ Consistent with theme
- Tokens: ✅ All valid design system tokens
- Responsive: ✅ All breakpoints pass
- A11y: ✅ Keyboard & screen reader OK
- Patterns: ✅ Reused from library
- Perf: ✅ No metrics degradation
```

### Step 5: Approval or Feedback

```
✅ APPROVED FOR MERGE

Summary:
- All standards met
- No blockers identified
- Ready for production

Merge to: main
```

Or:

```
⚠️ NEEDS WORK

Blockers (must fix):
1. Color not from design system palette (line 45)
2. Missing error state handling

Follow-ups (should fix):
1. Add loading state
2. Improve focus state styling

Next: Make fixes and request re-review
```

---

## Output

✅ Pass/Fail determination
✅ Automated check results
✅ Manual review findings
✅ Approval or detailed feedback
✅ Merge recommendation
✅ Post-merge checklist (if approved)

---

## Quality Gate Criteria

**PASS** if:
- ✅ Wireframe alignment checks pass per Wireframe Precedence (page/layout: UI matches wireframe; `converted` component/pattern: component and wireframe reconciled as equal peers)
- ✅ UI library conversion fidelity checks pass (when wireframe library differs)
- ✅ All checklist items pass OR minor issues only
- ✅ Automated tests all pass
- ✅ No accessibility violations
- ✅ Responsive design validates
- ✅ Performance metrics acceptable

**NEEDS WORK** if:
- ❌ For page/layout scope: wireframe intent is not preserved in final UI (or for `converted` component/pattern scope: unreconciled conflict between component and wireframe left unflagged)
- ❌ UI library conversion/mapping is inconsistent with configured constraints
- ❌ Critical accessibility issues
- ❌ Test failures blocking merge
- ❌ Layout breaks at key breakpoints
- ❌ Non-design-system tokens or hardcoded colors
- ❌ Missing required states

---

## Related Commands

- `/ui-audit` — Find quality issues
- `/ui-improve` — Fix issues before review

---

## References

- UI standards: `@.claude/standards/ui-design-standards.md`
- Component library: `@.claude/docs/component-library.md`
