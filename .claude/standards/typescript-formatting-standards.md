# TypeScript Formatting Standards — NestJS + NextJS

## Toolchain

- **Formatter**: Prettier (enforced via lint-staged + Husky)
- **Linter**: ESLint with `@typescript-eslint`, `eslint-plugin-import`
- **Git hooks**: Husky pre-commit → lint-staged
- **Type checking**: `tsc --noEmit` in CI

## Prettier Config (root `prettier.config.js`)

```js
module.exports = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  trailingComma: "all",
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "lf",
};
```

## ESLint Config (`eslint.config.mjs` — flat config)

```js
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(tseslint.configs.recommendedTypeChecked, {
  plugins: { import: importPlugin },
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/consistent-type-imports": "error",
    "import/order": [
      "error",
      { "newlines-between": "always", alphabetize: { order: "asc" } },
    ],
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
});
```

## Naming Conventions

```
Files:          kebab-case          → user.service.ts, auth.guard.ts
Classes:        PascalCase          → UserService, AuthGuard
Interfaces:     PascalCase (no I)   → UserRepository (not IUserRepository)
Types:          PascalCase          → CreateUserDto
Enums:          PascalCase          → UserStatus
Enum values:    SCREAMING_SNAKE     → UserStatus.ACTIVE
Functions:      camelCase           → findById, createUser
Variables:      camelCase           → userId, correlationId
Constants:      SCREAMING_SNAKE     → MAX_PAGE_SIZE, DEFAULT_TIMEOUT
Private fields: camelCase           → private readonly logger
```

## Import Order (enforced by ESLint)

```typescript
// 1. Node built-ins
import { randomUUID } from "crypto";

// 2. External packages
import { Injectable, Logger } from "@nestjs/common";

// 3. Internal monorepo packages (@repo/*)
// NOTE: import `z` from `@repo/validation` (OpenAPI-extended), never from 'zod' directly.
import { z, CreateUserDto } from "@repo/validation";
import { PrismaClient } from "@repo/database";

// 4. Relative imports (deep → shallow)
import { UserRepository } from "./user.repository";
import type { UserRecord } from "./types";
```

## Type Safety Rules

```typescript
// ✅ Always infer from Zod schemas — never duplicate types
export type CreateUserDtoType = z.infer<typeof CreateUserDto>;

// ✅ Use type imports for types only (Fastify, never Express)
import type { FastifyRequest, FastifyReply } from 'fastify';

// ✅ Explicit return types on public service methods
async findById(id: string): Promise<UserResponseDtoType> { ... }

// ❌ Never use any — use unknown + type narrowing
function handle(payload: unknown) {
  if (isUserPayload(payload)) { ... }
}

// ✅ Readonly for config objects
const DB_CONFIG = Object.freeze({ maxConnections: 10 });
```

## Exhaustiveness — `assertNever` on Every Union Switch

Our enums are `VarChar` strings validated by Zod (`z.enum([...])`), not native
PostgreSQL enums. When you branch on such a union, the compiler must prove every
case is handled — so a new enum member causes a **type error at the switch**, not
a silent runtime fall-through.

```typescript
// shared helper (packages/common/src/assert-never.ts)
export function assertNever(value: never): never {
  throw new Error(`Unhandled union member: ${JSON.stringify(value)}`);
}

type DocumentStatus = z.infer<typeof DocumentStatusSchema>; // 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

// ✅ default: assertNever — adding 'DELETED' to the schema breaks compilation here
function label(status: DocumentStatus): string {
  switch (status) {
    case 'DRAFT':     return 'Draft';
    case 'PUBLISHED': return 'Published';
    case 'ARCHIVED':  return 'Archived';
    default:          return assertNever(status); // ← type error if a case is missing
  }
}

// ❌ default: throw new Error(...) — compiles even when a case is unhandled (no exhaustiveness)
// ❌ omitting default — union may silently return undefined
```

Rule: any `switch` / `if-else` chain over a finite union (Zod enum, discriminated
union `kind`/`type` field) MUST end in `assertNever(x)` in the `default` / final
`else`. This is the single most valuable guard against enum drift in a
schema-first codebase where the union is regenerated from Prisma.

## Discriminated Unions Over Boolean Flags

```typescript
// ✅ Model mutually-exclusive states as a discriminated union
type Result =
  | { kind: 'success'; data: UserResponseDtoType }
  | { kind: 'error'; reason: string };

// ❌ Boolean-flag soup permits impossible states (ok:true + error set)
type Result = { ok: boolean; data?: User; error?: string };
```

## Async Patterns

```typescript
// ✅ Always await — no floating promises
await this.events.publish('user.created', payload);

// ✅ Explicit error handling in async contexts
try {
  await this.prisma.user.create({ data });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictException('Email already exists');
  }
  throw error;
}

// ❌ Never swallow errors
catch (_e) {} // NEVER
```

## Husky + lint-staged Config

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yaml,yml}": ["prettier --write"],
    "prisma/schema.prisma": ["prisma format"]
  }
}
```

## Quality Gates (CI — must pass before merge)

```bash
pnpm lint          # ESLint (zero warnings with --max-warnings 0)
pnpm format:check  # Prettier check
pnpm type-check    # tsc --noEmit across all packages
pnpm test          # Jest (coverage thresholds enforced)
pnpm build         # Verify build succeeds
```

## Token Optimization

- **Load when**: writing TypeScript/React code; resolving formatting/lint mismatches.
- **Load only**: this standard + `eslint-policy.md`. Self-contained for formatting decisions.
- **Unload after**: `pnpm lint` and `pnpm type-check` clean.
