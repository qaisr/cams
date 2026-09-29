# Zod OpenAPI Extension Pattern

## Problem

`@asteasolutions/zod-to-openapi` adds `.openapi()` to the Zod prototype via `extendZodWithOpenApi(z)`.
In a pnpm monorepo, multiple files calling `extendZodWithOpenApi(z)` against their own `import { z } from 'zod'`
can silently operate on **different module instances** depending on hoisting. When the `z` used in a schema
file is a different instance from the one extended in `generate-spec.ts`, `.openapi()` is undefined and
`registry.register()` throws:

```
TypeError: Cannot read properties of undefined (reading 'openapi')
```

This is especially fragile in v8+ of `zod-to-openapi`, which changed how metadata is stored on schema objects.

## Solution: Single Shared Extended `z`

Create **one** canonical `zod.ts` in the validation package that calls `extendZodWithOpenApi` exactly once
and re-exports `z`. Every schema file and `generate-spec.ts` imports `z` from this shared module.

### Step 1 — Create `packages/validation/src/zod.ts`

```typescript
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export { z };
```

### Step 2 — Update all schema files

In every `*.schema.ts` under `packages/validation/src/`, replace:

```typescript
// BEFORE (wrong — may create a separate zod instance)
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);
```

with:

```typescript
// AFTER (correct — uses the single extended instance)
import { z } from './zod';
```

### Step 3 — Update `generate-spec.ts`

In `apps/api/src/openapi/generate-spec.ts`, replace:

```typescript
import { z } from 'zod';
```

with:

```typescript
import { z } from '@repo/validation/zod';
```

Or, if the validation package re-exports `z` from its `index.ts`, import it from there:

```typescript
import { z } from '@repo/validation';
```

`generate-spec.ts` must **not** call `extendZodWithOpenApi` itself.

### Step 4 — Export `z` from the validation package index

In `packages/validation/src/index.ts`, add:

```typescript
export { z } from './zod';
```

This makes the extended `z` available to consumers as `import { z } from '@repo/validation'`.

## Rules

| Rule | Rationale |
|------|-----------|
| `extendZodWithOpenApi` is called **exactly once**, in `packages/validation/src/zod.ts` | Multiple calls on separate instances silently produce schemas without `.openapi()` |
| Schema files import `z` from `'./zod'`, never from `'zod'` directly | Direct import may resolve to a different module instance under pnpm |
| `generate-spec.ts` imports `z` from `@repo/validation` | Same instance guarantee, never calls `extendZodWithOpenApi` itself |
| New schema files must follow this pattern from the start | One-line comment `// z is pre-extended — import from './zod', not from 'zod'` in zod.ts is enough |

## Enforcement

Add an ESLint rule to the `packages/validation` workspace to flag direct `import { z } from 'zod'`
in `*.schema.ts` files (optional but recommended as the codebase grows):

```js
// .eslintrc — packages/validation
'no-restricted-imports': ['error', {
  paths: [{ name: 'zod', importNames: ['z'], message: "Import z from './zod' to use the pre-extended instance." }]
}]
```

## Files Involved

| File | Role |
|------|------|
| `packages/validation/src/zod.ts` | Single source — calls `extendZodWithOpenApi`, re-exports `z` |
| `packages/validation/src/*.schema.ts` | Import `z` from `'./zod'` |
| `packages/validation/src/index.ts` | Re-exports `z` from `'./zod'` for external consumers |
| `apps/api/src/openapi/generate-spec.ts` | Imports `z` from `@repo/validation` |

## Token Optimization

**Load when** when extending Zod schemas with OpenAPI metadata. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
