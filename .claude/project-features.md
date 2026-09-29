# CANS — Built-In Features

> Lazy-load this file when you need to audit what's already implemented, assess
> scope before planning epics, or onboard a new team member.

The CANS platform ships with a production-ready foundation covering
infrastructure, auth, RBAC, frontend pages, testing, and tooling. **Do not
create epics for any of the features listed here** — they are complete and
tested.

---

## 1. Monorepo & Tooling Foundation

- **pnpm workspaces + Turborepo** — `build`, `test`, `lint`, `generate` tasks
  with correct dependency order
- **ESLint + Prettier** — configured across all packages; `eslint-plugin-react`,
  `react-hooks`, `jsx-a11y`, `security` enabled
- **Husky pre-commit hooks** — lint-staged (ESLint + Prettier on staged files),
  commit-msg (conventional commits), pre-push (type-check)
- **TypeScript 5+** — shared `packages/tsconfig/` base, NestJS, and NextJS
  variants
- **`packages/shared-config`** (`@repo/shared-config`) — shared RBAC config,
  constants
- **`packages/validation`** (`@repo/validation`) — Zod schemas with OpenAPI
  metadata
- **`packages/common`** — shared utilities

## 2. CDK v2 Infrastructure (`infra/`)

- `api-stack.ts` — internal ALB + long-lived NestJS (Fastify) Fargate service;
  scheduled ECS Fargate batch tasks via EventBridge Scheduler → RunTask
- `database-stack.ts` — RDS PostgreSQL 16 (Multi-AZ) + RDS Proxy + Secrets
  Manager secret; VPC interface endpoints (PrivateLink), no NAT
- `events-stack.ts` — EventBridge event bus
- Stage-parameterised resource naming: `{project}-{stage}-{resource}`
- Passes `cdk synth --context stage=local` with no errors

## 3. Docker Compose + LocalStack

- `docker/docker-compose.yml` — PostgreSQL (port 5432) + LocalStack (port 4566)
- LocalStack services: `secretsmanager, ssm, events, logs`
- `docker/localstack/init-aws.sh` — seeds Secrets Manager with DB credentials
- `.env.local.example` — all required env vars with placeholder values
- Convenience scripts: `pnpm infra:up`, `pnpm infra:down`, `pnpm infra:logs`

## 4. Database — Prisma + PostgreSQL

- **Prisma schema** (`packages/database/prisma/schema.prisma`) — `User` model
  with `id`, `lanId`, `email`, `name`, `createdAt`, `updatedAt`
- **Initial migration** generated and ready to deploy
- **Seed data** — 3 deterministic test users (superadmin, admin, user roles) via
  `upsert`
- **Connection-safe `getPrismaClient()` singleton** (single pool per process
  behind RDS Proxy) in `packages/database/src/client.ts`
- Scripts: `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:studio`, `pnpm db:reset`

## 5. Code Generation Pipeline

Single source of truth flow, end-to-end via `pnpm generate`:

```
prisma/schema.prisma
└─► zod-prisma-types ──► packages/database/generated/zod/
└─► packages/validation/src/  (extended with OpenAPI metadata)
└─► apps/api/src/openapi/generate-spec.ts
└─► packages/api-spec/generated/openapi.json
└─► orval ──► apps/web/src/hooks/generated/
```

- Generated hooks: `useGetHealth`, `usePostLogin`, `useGetAuthMePermissions`, +
  MSW mock handlers
- Never edit generated files directly — run `pnpm generate` instead

## 6. NestJS API — Core Modules

- **`GET /health`** — public endpoint, Prisma ping, returns
  `{ status, timestamp, db }`; < 500ms SLA
- **Correlation ID middleware** — reads/generates `x-correlation-id` on every
  request/response
- **RFC 7807 error responses** — structured `ProblemDetail` with `status`,
  `title`, `detail`, `instance`
- **Global exception filter** — catches all unhandled exceptions and formats as
  RFC 7807
- **`AppModule`** — global JWT guard wired, `CorrelationIdMiddleware` applied

## 7. PingID Authentication (Backend)

- **`jwt.strategy.ts`** — RS256 JWKS validation via `passport-jwt` + `jwks-rsa`
  (10-min cache)
- **`mock-jwt.strategy.ts`** — local RSA key generation, RS256 token signing
  (dev only)
- **`MockKeyStore`** — injectable NestJS service sharing RSA keys between
  strategy and service
- **`jwt-auth.guard.ts`** — global JWT guard with `@Public()` bypass, RFC 7807
  errors
- **`@CurrentUser()` decorator** — extracts user from request
- **`POST /login`** — mock login (dev) + real PingID PKCE stub (production)
- **`GET /.well-known/jwks.json`** — public JWKS endpoint
- **Production guard** — `MOCK_AUTH_ENABLED` env var; startup throws in
  production if mock is on
- 28 unit tests covering all auth flows

## 8. RBAC Authorization Engine

- **`packages/shared-config/rbac/rbac-group-permissions.json`** — 5-group
  permission mapping
- **`rbac-group-permissions.schema.json`** — JSON Schema draft-07 for validation
- **`loadRbacConfig()`** — startup-fail with caching; throws if config is
  invalid
- **`permissions.service.ts`** — union, `*:admin` expansion, deny-precedence,
  superadmin bypass
- **`@RequirePermissions()`** decorator — AND/OR permission modes
- **`permissions.guard.ts`** — global guard, RFC 7807 403 responses
- **`GET /auth/me/permissions`** — returns effective permissions for the
  authenticated user
- **GitHub Actions CI** — `validate-rbac-schema` job validates JSON Schema on
  every push
- 57 unit tests across API and shared-config

## 9. Frontend — Auth Pages & Infrastructure

- **`AuthContext.tsx`** — `AuthUser` shape, `login`/`logout`, JWT in
  `sessionStorage`, token expiry validation
- **Root layout + Providers** — `QueryClientProvider` + `AuthProvider` wired
- **Protected route layout** (`/(protected)/layout.tsx`) — redirects
  unauthenticated to `/login`
- **`/login`** — PingID stub with env var config banner; link to mock login
- **`/login-mock`** — all 5 RBAC groups; mock login flow; dev-only banner +
  production guard
- **`/secure`** — identity + effective permissions display; superadmin badge;
  Sign Out
- **`/role-permissions`** — full RBAC matrix table (all 5 groups × all
  permissions); auth strategy explainer; RBAC-gated (admin+ only)
- **`api-client.ts`** — custom orval fetch mutator; attaches Bearer token;
  handles 401; sets correlation ID
- **MSW setup** — `handlers.ts`, `server.ts` (Node), `browser.ts` (browser
  worker)
- **Test infrastructure** — `jest-fixed-jsdom`, `renderWithProviders`,
  `identity-obj-proxy`

## 10. Storybook UI Component Library

- Full Storybook design system scaffolded under `apps/web/src/components/`
- Components cover: buttons, forms, inputs, modals, navigation, tables, alerts,
  badges, pagination, and more
- Each component has stories (default, variants, states), MDX docs,
  accessibility audits, and unit tests
- See `.claude/standards/component-usage.md` for the current catalogue and
  import rules
- **ALWAYS check the component library before creating new UI components**

## 11. Integration Tests (TestContainers)

- `apps/api/src/__tests__/smoke.integration.spec.ts` — 11 integration tests
- Uses `@testcontainers/postgresql` — ephemeral `postgres:16-alpine` per run
- Tests: `GET /health`, `POST /login` (mock), `GET /auth/me/permissions`
- `jest.integration.config.ts` — separate Jest config for integration runs
- Run with: `pnpm test:integration --runInBand`

## 12. GitHub Actions CI/CD

- **`ci.yml`** — lint, type-check, unit tests, build
- **`integration.yml`** — integration tests (Docker-enabled runner)
- **`validate-rbac-schema`** job — validates RBAC JSON Schema on every push

---

## Running the Application

From the repo root:

```bash
# Start everything (recommended)
pnpm dev              # frontend (port 3000) + backend (watch mode)

# Frontend only
pnpm --filter @repo/web dev        # next dev — hot reload, port 3000

# Backend only
pnpm --filter @repo/api start:dev  # nest start --watch

# Run Storybook
pnpm --filter @repo/web storybook  # http://localhost:6006

# Infrastructure
pnpm infra:up    # start Docker Compose (DB + LocalStack)
pnpm infra:down  # stop
pnpm infra:logs  # tail logs

# Database
pnpm db:migrate  # run Prisma migrations
pnpm db:seed     # seed test data
pnpm db:studio   # open Prisma Studio (http://localhost:5555)

# Code generation (run after schema changes)
pnpm generate    # Prisma → Zod → OpenAPI → orval hooks

# Tests
pnpm test                     # unit tests (all packages)
pnpm test:integration         # integration tests (requires Docker)
pnpm --filter @repo/api test  # API unit tests only
pnpm --filter @repo/web test  # Web unit tests only
```

---

## Key Files Reference

| File                                                      | Purpose                                                   |
| --------------------------------------------------------- | --------------------------------------------------------- |
| `packages/shared-config/rbac/rbac-group-permissions.json` | RBAC group-to-permission mapping (single source of truth) |
| `packages/database/prisma/schema.prisma`                  | Database schema (single source of truth for types)        |
| `packages/api-spec/generated/openapi.json`                | Generated OpenAPI spec (do not edit directly)             |
| `apps/web/src/hooks/generated/index.ts`                   | Generated React Query hooks (do not edit directly)        |
| `apps/api/src/openapi/generate-spec.ts`                   | OpenAPI spec generation entry point                       |
| `docker/docker-compose.yml`                               | Local infrastructure services                             |
| `.env.local.example`                                      | Environment variable template                             |
| `docs/getting-started.md`                                 | Full onboarding guide for new team members                |
| `infra/`                                                  | AWS CDK v2 infrastructure stacks                          |
