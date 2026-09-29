# Project Structure

## Monorepo Layout

```
app/
├── apps/
│   ├── api/                 # NestJS (Fastify) — Fargate service behind internal ALB
│   └── web/                 # NextJS 16 — App Router, CSR default
│       ├── .storybook
│       ├── app
│       ├── e2e
│       ├── public
│       ├── src
│       └── storybook-static
├── packages/
│   ├── database/        # ⭐ Prisma schema — single source of truth
│   ├── validation/      # Shared Zod schemas + OpenAPI metadata
│   ├── api-spec/        # Generated OpenAPI spec (DO NOT EDIT)
│   ├── shared-config/   # RBAC config, shared runtime settings
│   └── tsconfig/        # Shared TS configs (base, nestjs, nextjs)
├── demo/                # Playwright demo specs
├── scripts/             # generate.ts, check-env.ts
├── infra/               # AWS CDK v2 (NOT SAM)
├── docker/              # docker-compose.yml + localstack init
├── .claude/             # AI framework
├── .github/workflows/
├── .husky/              # pre-commit, commit-msg, pre-push
├── pnpm-workspace.yaml
└── .editorconfig, .prettierrc.json, .yamllint, eslint.config.mjs, package.json, turbo.json, tsconfig.json
```

### Pre-commit Speed Strategy

```
Commit          → lint-staged (FAST — staged files only)
                  + type-check affected (FAST — turbo cache)

Push            → unit tests affected (FAST — turbo cache)

CI (PR)         → full lint + type-check + unit + integration + build

CI (main)       → everything above + E2E + security scan
```

## Package Names

```
@repo/api           → apps/api
@repo/web           → apps/web
@repo/database      → packages/database
@repo/validation    → packages/validation
@repo/api-spec      → packages/api-spec
@repo/shared-config → packages/shared-config
```

## Generation Pipeline (CRITICAL — run on any schema change)

```
packages/database/prisma/schema.prisma        [EDIT THIS]
  └─► packages/database/generated/zod/        [generated — DO NOT EDIT]
        └─► packages/api-spec/generated/       [generated — DO NOT EDIT]
              └─► apps/web/src/hooks/generated/ [generated — DO NOT EDIT]
              └─► apps/web/src/mocks/generated/ [generated — DO NOT EDIT]

Command: pnpm generate
```

## apps/api — NestJS Structure

### Conventions

- One folder per domain under `src/modules/{feature}/`
- Every module: `{f}.module.ts`, `{f}.controller.ts`, `{f}.service.ts`
- Repository file only when complex queries needed (simple CRUD goes in service
  via Prisma directly)
- Tests co-located: `{f}.service.spec.ts`, `{f}.controller.spec.ts`
- Integration tests in `src/__tests__/{f}.integration.spec.ts` (Testcontainers +
  supertest) — co-located at `src/` level, not per-module
- Fixtures in `__fixtures__/{f}.fixtures.ts` (faker factories)
- Domain exceptions in `exceptions/{f}.exceptions.ts`

```
src/
├── modules/{feature}/
│   ├── {feature}.module.ts
│   ├── {feature}.controller.ts       # ZodValidationPipe, @RequirePermissions — thin
│   ├── {feature}.service.ts          # Business logic, Prisma, EventBridge
│   ├── {feature}.repository.ts       # Complex queries only (optional)
│   ├── {feature}.service.spec.ts     # Jest + mock Prisma + mock EventBridge
│   ├── {feature}.controller.spec.ts
│   ├── exceptions/{feature}.exceptions.ts
│   ├── __fixtures__/{feature}.fixtures.ts
│   └── __tests__/{feature}.integration.spec.ts
├── common/
│   ├── filters/global-exception.filter.ts   # RFC 7807 ProblemDetail
│   ├── guards/permissions.guard.ts          # Reads JWT claims
│   ├── guards/rls.guard.ts                  # Row-level security
│   ├── decorators/permissions.decorator.ts  # @RequirePermissions('x:read')
│   ├── decorators/public.decorator.ts       # @Public() — bypasses JWT
│   ├── middleware/correlation-id.middleware.ts
│   └── services/rls.service.ts             # Row-level security service
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts            # /auth endpoints
│   ├── auth.service.ts
│   ├── permissions.service.ts        # Permission validation
│   ├── mock-key-store.ts
│   ├── decorators/
│   ├── guards/
│   │   ├── jwt-auth.guard.ts         # Applied globally in AppModule
│   │   └── mock-auth.guard.ts        # Local dev only
│   └── strategies/
│       ├── jwt.strategy.ts           # RS256 JWKS validation
│       └── mock-jwt.strategy.ts      # Local dev only
├── health/
│   ├── health.module.ts
│   ├── health.controller.ts          # GET /health — @Public(), Prisma ping
│   └── health.service.ts
├── openapi/generate-spec.ts          # Zod → OpenAPI JSON (pnpm generate)
├── app.module.ts                     # Registers global guards + filters
├── bootstrap.ts                      # Helmet, CORS, pipes, filters — shared setup
└── main.ts                           # HTTP server entry point
```

## apps/web — NextJS Structure

### Conventions

- All pages default to `'use client'` — SSR only when explicitly requested
- Every page folder needs: `page.tsx`, `loading.tsx`, `error.tsx`
- Components co-located with tests: `{Component}.tsx` + `{Component}.test.tsx`
- `hooks/generated/` — orval output, NEVER edit manually
- `mocks/generated/` — orval MSW output, NEVER edit manually
- Hand-written hook extensions only for optimistic updates / complex cache
  manipulation
- `renderWithProviders()` in every component test — fresh QueryClient per test

```
app/
├── (protected)/          # Requires JWT auth — all internal pages go here
│   ├── layout.tsx        # Auth guard
│   ├── role-permissions/ # RBAC demo page
│   └── secure/           # Protected demo page
├── (auth)/               # Unauthenticated pages
│   ├── login/
│   └── login-mock/
├── layout.tsx            # Root — QueryClientProvider + AuthProvider here
├── page.tsx              # Root redirect → /secure or /login
└── providers.tsx         # Client-side providers (QueryClient, Auth)

src/
├── components/                 # Storybook component library — check before creating new components
│   ├── composite/              # Multi-atom composed components
│   ├── features/               # Domain feature components
│   ├── layouts/                # Layout components
│   └── ui/                     # Generic UI primitives
├── hooks/
│   └── generated/              # orval output — DO NOT EDIT
│       └── {feature}.ts        # useGet{X}, useCreate{X}, get{X}QueryKey
├── mocks/
│   ├── generated/              # orval MSW output — DO NOT EDIT
│   ├── handlers.ts             # Global baseline (imports from generated/)
│   ├── server.ts               # MSW node server (Jest)
│   └── browser.ts              # MSW browser (dev)
├── lib/
│   ├── query-client.ts         # makeQueryClient() — retry/error defaults
│   ├── api-client.ts           # customFetch — orval mutator
│   ├── utils.ts
│   └── auth/
│       ├── AuthContext.tsx     # login(), logout() → queryClient.clear()
│       └── useHasPermission.ts
├── stories/                    # Storybook stories
├── test-utils/                 # renderWithProviders, test helpers
│   └── index.tsx
└── index.ts
```

## packages/database — Prisma Schema

```
prisma/
├── schema.prisma       # EDIT THIS — source of truth for all types
├── migrations/         # Auto-generated by prisma migrate dev — DO NOT EDIT
└── seed.ts             # Deterministic UUIDs, upsert pattern, idempotent
prisma.config.ts        # Prisma config (migrations dir, schema path)
generated/
└── zod/                # zod-prisma-types output — DO NOT EDIT
src/
├── client.ts           # getPrismaClient() singleton (connection-safe, single pool per process behind RDS Proxy)
└── index.ts
```

## packages/validation — Shared Zod Schemas

```
src/
├── auth.schema.ts       # Auth schemas — add feature schemas here
├── zod.ts               # extendZodWithOpenApi(z) called once here — import z from here
└── index.ts             # Re-exports all — imported by both api/ and web/
```

## Key Rules for File Operations

| Rule                          | Detail                                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Never edit generated/         | `packages/database/generated/`, `apps/web/src/hooks/generated/`, `apps/web/src/mocks/generated/`, `packages/api-spec/generated/` |
| Schema changes → run pipeline | Any `schema.prisma` edit requires `pnpm generate`                                                                                |
| Spec changes → run pipeline   | Any Zod schema edit in `packages/validation` requires `pnpm generate`                                                            |
| New feature module            | Create full folder under `apps/api/src/modules/{feature}/`                                                                       |
| New page                      | Create under `app/(protected)/{feature}/` with `page.tsx` + `loading.tsx` + `error.tsx`                                          |
| Shared types                  | Always from `@repo/validation` — never duplicate in `apps/web/src/types/`                                                        |
| DB migrations                 | `npx prisma migrate dev --name {description}` — never `db push` in production                                                    |

## Cross-References

- Standards: `@.claude/standards/`
- Generation pipeline details: `@.claude/workflows/local-runtime-modes.md`
- Coding patterns: `@.claude/templates/`
