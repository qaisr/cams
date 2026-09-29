---
name: component-usage
description: Rules for consuming components from the Storybook library — when to reuse vs create, import conventions, and duplication prevention
metadata:
  type: reference
---

# Component Usage Standards

## Primary Rule

**ALWAYS check `apps/web/src/components/` before creating any UI element.**

If a suitable component exists in the Storybook library, import and reuse it. Only create a new component when no equivalent exists.

## Import Convention

```typescript
// ✅ From category barrel
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// ✅ From root UI barrel (when importing several)
import { Button, Input } from '@/components/ui';
```

## When to Create vs Reuse

| Scenario | Action |
|---|---|
| Component exists with matching variant | Import and use |
| Component exists but missing a variant | Add variant to existing component + story |
| Completely new interaction pattern | Create in appropriate category |
| Page-level or domain-specific | Create under `features/` not `ui/` |

## Category Map

| Path | Purpose |
|---|---|
| `components/ui/` | Atomic, single-purpose elements |
| `components/composite/` | Two or more atoms combined |
| `components/features/` | Domain-specific, app-aware |
| `components/layouts/` | Structural / page-level shells |

## File Structure (per component)

```
ComponentName/
├── ComponentName.tsx        ← forwardRef + CVA, composing Lumen primitives
├── ComponentName.types.ts   ← interfaces + type unions only
├── ComponentName.stories.tsx ← all 8 story groups
├── ComponentName.test.tsx   ← all 5 describe blocks using composeStories
└── index.ts                 ← re-exports only
```

Components compose **Lumen** primitives (`@lumen/react`) and style only with Lumen
CSS tokens or the retained `ppcc-*`/Tailwind layout tokens — never hardcoded hex.
Discover Lumen primitives with the Lumen MCP (`list-lumen-components` →
`get-lumen-component-documentation`) before authoring anything custom.

## Current Library

`apps/web/src/components/` is a Lumen-based library. Record each component here as
it is added:

| Component | Category | Lumen primitive | Status |
|---|---|---|---|
| `Button` | ui | `Button` | ✅ |
| `TextField` | ui | `TextField` | ✅ |
| `Select` | ui | `Select` | ✅ |
| `Dialog` | composite | `Dialog` | ✅ |
| `MessageBanner` | composite | `MessageBanner` | ✅ |
| `PageHeader` | layouts | `PageHeader` | ✅ |

## Token Optimization

- **Load when**: BEFORE creating any UI component — check this standard first to enforce reuse over duplication.
- **Load only**: this standard. The catalog is the only context needed to pick existing vs. new.
- **Unload after**: import decision recorded. Component implementation loads `component-architecture.md` and `frontend-standards.md`.
