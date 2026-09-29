---
name: storybook-development
description: End-to-end workflow for creating a new Storybook component from wireframe to production-ready
metadata:
  type: reference
---

# Storybook Development Workflow

<!-- STORYBOOK-AUGMENT:START — wireframes-to-storybook 2026-06-01 -->

## Commands

```bash
pnpm --filter @repo/web storybook           # Dev server — http://localhost:6006
pnpm --filter @repo/web build-storybook     # Production build
pnpm --filter @repo/web test-storybook      # Run all story tests
pnpm --filter @repo/web storybook:a11y      # Accessibility audit only
```

## Adding a New Component — Checklist

### 1. Identify category

| Pattern | Category |
|---|---|
| Standalone atom (button, input, badge) | `ui/` |
| Combines two+ atoms | `composite/` |
| Uses app-level data/routing | `features/` |
| Full-page shell | `layouts/` |

### 2. Create file structure

```bash
mkdir -p apps/web/src/components/ui/ComponentName
touch apps/web/src/components/ui/ComponentName/ComponentName.{tsx,types.ts,stories.tsx,test.tsx}
touch apps/web/src/components/ui/ComponentName/index.ts
```

### 3. Required files

1. `ComponentName.types.ts` — TypeScript interface with JSDoc on all props
2. `ComponentName.tsx` — CVA + forwardRef + displayName + DaisyUI
3. `ComponentName.stories.tsx` — All 8 story groups (variants, sizes, states, edge cases, responsive, interactions, a11y, dark mode)
4. `ComponentName.test.tsx` — All 5 describe blocks using composeStories
5. `index.ts` — barrel re-export

### 4. Quality gate before marking complete

- [ ] `pnpm --filter @repo/web type-check` — zero errors
- [ ] `pnpm --filter @repo/web build-storybook` — build passes
- [ ] All 8 story groups present
- [ ] Zero axe-core violations in AccessibilityAudit story
- [ ] All 5 test describe blocks pass
- [ ] No hardcoded hex values

### 5. Add to root barrel

Update `apps/web/src/components/ui/index.ts`:

```typescript
export * from './ComponentName';
```

Update `.claude/standards/component-usage.md` Current Library table.

## Story Title Hierarchy

```
UI/Components/   → Button, Input, Badge, Spinner
UI/Composite/    → Card, Modal, Table
UI/Layout/       → Header, AppShell
Features/        → UserProfile, SettingsPanel
```

<!-- STORYBOOK-AUGMENT:END -->

## Token Optimization

- **Load when**: building or updating any Storybook component or story.
- **Load only**: this workflow + `storybook-standards.md` + `component-usage.md` + `component-architecture.md` + `storybook-story.tsx` template.
- **Unload after**: component published with stories for all 8 standard groups (default/states/variants/edge/a11y/responsive/themes/RTL).
- **Hand-off to**: `accessibility-auditor` for WCAG audit, `test-engineer` for component-level tests.
