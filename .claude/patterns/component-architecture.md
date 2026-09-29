---
name: component-architecture
description: Folder structure, file naming, CVA pattern, forwardRef, and export rules for React components
metadata:
  type: reference
---

# Component Architecture Pattern

Components in `apps/web/src/components/` are **thin wrappers over Lumen
primitives** (`@lumen/react`). Compose Lumen — never re-implement its visuals in
Tailwind or DaisyUI classes. Discover primitives with the Lumen MCP
(`list-lumen-components` → `get-lumen-component-documentation`) before authoring
anything custom. Tailwind is retained for **layout/utilities only**.

## Folder Structure

```
src/components/
├── ui/                    ← Atomic, single-purpose (e.g. Button, Input, Badge)
├── composite/             ← Two or more atoms combined (e.g. Card, Modal, Table)
├── features/              ← Domain-specific, app-aware (e.g. UserProfile, SettingsPanel)
└── layouts/               ← Structural / page-level (e.g. Header, AppShell)
```

## File Naming (per component)

```
ComponentName/
├── ComponentName.tsx         ← Implementation
├── ComponentName.types.ts    ← Interfaces/types only — no runtime code
├── ComponentName.stories.tsx ← All 8 story groups
├── ComponentName.test.tsx    ← All 5 describe blocks
└── index.ts                  ← Re-exports only
```

## Implementation Rules

### Thin wrapper over a Lumen primitive (the default)

Wrap the Lumen primitive, forward its variant/behaviour props, and expose
`className` for **layout/utility overrides only** — Lumen owns colour, radius,
spacing, focus, and motion. Match the wrapper shape to the Lumen primitive: use
`forwardRef` + `displayName` when the Lumen primitive is a `forwardRef` component
(e.g. `Button`, `TextField`, `Select`); use a plain FC + `displayName` when it is
a plain FC (e.g. `Dialog`, `MessageBanner`, `PageHeader`).

```typescript
// ✅ forwardRef wrapper — Lumen owns visuals, className is layout-only
import { Button as LumenButton } from '@lumen/react/Button';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import type { ButtonProps } from './Button.types';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => (
    <LumenButton ref={ref} variant={variant} className={cn(className)} {...props} />
  ),
);
Button.displayName = 'Button';
```

```typescript
// ✅ plain-FC passthrough — for Lumen primitives that are plain FCs (no ref)
import { PageHeader as LumenPageHeader } from '@lumen/react/PageHeader';
import type { PageHeaderProps } from './PageHeader.types';

export function PageHeader(props: PageHeaderProps) {
  return <LumenPageHeader {...props} />;
}
PageHeader.displayName = 'PageHeader';
```

### Types derive from the Lumen primitive

```typescript
import type { ComponentProps } from 'react';
import type { Button as LumenButton } from '@lumen/react/Button';

export type ButtonProps = ComponentProps<typeof LumenButton>;
```

### className via `cn` — layout/utility overrides only

Pass Tailwind **layout** utilities (flex, grid, spacing, sizing) through
`className`. Do **not** re-style Lumen with Tailwind visual utilities and do
**not** use DaisyUI classes (`btn`, `btn-primary`, …) — DaisyUI has been removed.

```typescript
// ✅ Correct — Lumen variant + layout-only className
<Button variant="primary" className="w-full">Continue</Button>

// ❌ Wrong — re-styling Lumen with visual utilities / DaisyUI classes
<Button className="btn btn-primary bg-black rounded font-bold">Continue</Button>
```

### No hardcoded hex values

Style only via Lumen CSS tokens (`get-lumen-css-tokens`) or the retained
`ppcc-*`/`status-*` brand tokens defined in `globals.css` — never raw hex.

### index.ts — re-exports only

```typescript
export { Button } from './Button';
export type { ButtonProps } from './Button.types';
```

## Token Optimization

**Load when** when creating new UI components (folder layout, forwardRef, CVA, exports). **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
