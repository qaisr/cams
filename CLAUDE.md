# CANS — Claude Memory

> Review and update as the project evolves.

## Project Overview

This is the **CANS platform**: a full-stack monorepo for the PPCC Agreement and
Netting System, with PingID authentication, RBAC authorization, a health check,
the code-generation pipeline (Prisma → Zod → OpenAPI → React Query hooks), and
AWS CDK infrastructure.

## Monorepo Structure

```
apps/api/          # NestJS 11 (Fastify) — Fargate service behind internal ALB (ADR-0005)
apps/web/          # NextJS 16 App Router — CSR default, TailwindCSS (layout) + Lumen (components)
packages/database/ # ⭐ Prisma schema — single source of truth for all types
packages/validation/ # Zod schemas extended with OpenAPI metadata
packages/api-spec/ # Generated OpenAPI spec (DO NOT EDIT)
packages/shared-config/ # RBAC config, shared runtime settings
packages/common/   # Shared utilities
packages/tsconfig/ # Shared TS configs (base, nestjs, nextjs)
infra/             # AWS CDK v2 stacks (api, auth, database, events)
docker/            # docker-compose.yml (postgres + localstack)
demo/              # Playwright demo specs
scripts/           # generate.ts, check-env.ts, browser-inspect.ts
.claude/           # AI framework (commands, agents, workflows, patterns, standards)
```

## Technology Stack

### Core

- **NestJS** `^11.1.24` — API framework on Fastify (`@nestjs/platform-fastify`)
- **NextJS** `16.2.6` — Frontend (App Router, CSR default)
- **TypeScript** `^6.0.3`
- **Node.js** `>=20.0.0` — minimum version
- **pnpm** `>=9.0.0` + **Turborepo** `^2.9.16`

### Database & ORM

- **Prisma** `^7.8.0` — schema-first ORM
- **PostgreSQL 16** — local Docker; AWS RDS via RDS Proxy in production
- **zod-prisma-types** `^3.3.11` — auto-generates Zod schemas from Prisma schema

### API & Validation

- **Zod** `^4.4.3` — all validation (never class-validator)
- **nestjs-zod** `^5.4.0` — Zod integration for NestJS pipes/guards
- **@asteasolutions/zod-to-openapi** `^8.5.0` — Zod → OpenAPI spec
- **@nestjs/swagger** `^11.4.4` — Swagger UI integration

### Frontend

- **@tanstack/react-query** `^5.100.14` — server state management
- **orval** `^8.14.0` — generates typed React Query hooks from OpenAPI
- **react-hook-form** `^7.76.1` + **@hookform/resolvers** `^5.4.0`
- **TailwindCSS** `^4.3.0` — layout & utilities (CSS-first, no config file)
- **@lumen/react** `^1.4.1` — PPCC Lumen design system (UI components)
- **MSW** `^2.14.6` — mock service worker for tests and dev
- **zustand** `^5.0.14` — client state management

### Auth & Security

- **PingID** — JWKS RS256 JWT authentication (NEVER Cognito)
- **passport-jwt** `^4.0.1` — JWT strategy
- **jwks-rsa** `^3.2.0` — JWKS key fetching
- **helmet** `^8.2.0`, **@nestjs/throttler** `^6.5.0`

### Infrastructure

- **AWS CDK v2** `^2.200.0` (NEVER SAM)
- **AWS SDK v3**: EventBridge, RDS Signer
- **AWS X-Ray** — tracing
- **LocalStack** — local AWS services emulation

### Testing

- **Jest** `^30.4.2` + **ts-jest** `^29.4.11`
- **@testcontainers/postgresql** `^12.0.1` — integration tests
- **@playwright/test** `^1.60.0` — E2E tests
- **@testing-library/react** `^16.3.2` — React component tests
- **Storybook** `^10.4.1` + **@storybook/nextjs-vite**

## Code Generation Pipeline

**Run `pnpm generate` to execute the full pipeline in order:**

```
packages/database/prisma/schema.prisma   ← EDIT THIS FIRST
  │
  └─► Step 1: pnpm --filter @repo/database generate
      ├── Prisma client (packages/database/generated/prisma-client/)
      └── Zod schemas   (packages/database/generated/zod/)          ← DO NOT EDIT
          │
          └─► Step 2: tsx apps/api/src/openapi/generate-spec.ts
              └── OpenAPI JSON (packages/api-spec/generated/openapi.json) ← DO NOT EDIT
                  │
                  ├─► Step 3: pnpm --filter @repo/web orval --config orval.config.ts
                  │   └── React Query hooks (apps/web/src/hooks/generated/) ← DO NOT EDIT
                  │
                  └─► Step 4: pnpm --filter @repo/web orval --config orval.msw.config.ts
                      └── MSW handlers (apps/web/src/mocks/generated/)     ← DO NOT EDIT
```

**Individual steps:**

- `pnpm generate:prisma` — Step 1 only
- `pnpm generate:spec` — Step 2 only
- `pnpm generate:hooks` — Steps 3+4

## Development Commands

### Root (run from repo root)

| Purpose                  | Command                 |
| ------------------------ | ----------------------- |
| Start all services       | `pnpm dev`              |
| Build all                | `pnpm build`            |
| Run all tests            | `pnpm test`             |
| Integration tests        | `pnpm test:integration` |
| E2E tests                | `pnpm test:e2e`         |
| Type check all           | `pnpm type-check`       |
| Lint all                 | `pnpm lint`             |
| Full generation pipeline | `pnpm generate`         |
| DB migrate (local)       | `pnpm db:migrate`       |
| DB seed                  | `pnpm db:seed`          |
| DB studio                | `pnpm db:studio`        |
| Start Docker infra       | `pnpm infra:up`         |
| Stop Docker infra        | `pnpm infra:down`       |
| Check env                | `pnpm check-env`        |
| Storybook                | `pnpm sb`               |
| Snyk security scan       | `pnpm snyk:test`        |

### API (apps/api)

- `pnpm --filter @repo/api start:dev` — local development
- `pnpm --filter @repo/api test` — unit tests
- `pnpm --filter @repo/api test:integration` — integration (TestContainers)
- `pnpm --filter @repo/api test:coverage` — with coverage report

### Web (apps/web)

- `pnpm --filter @repo/web dev` — local dev (port 3000)
- `pnpm --filter @repo/web test` — unit tests (Jest + RTL)
- `pnpm --filter @repo/web test:e2e` — Playwright E2E (mock auth)
- `pnpm --filter @repo/web test:e2e:live` — Playwright E2E (live PingID)
- `pnpm --filter @repo/web storybook` — Storybook (port 6006)

## Environment Setup

Copy `.env.example` → `.env.local` (gitignored) and fill in values.

| Variable                   | Description                        | Required |
| -------------------------- | ---------------------------------- | -------- |
| `NODE_ENV`                 | `development` / `production`       | Yes      |
| `PORT`                     | API port (default: 3001)           | No       |
| `DATABASE_URL`             | PostgreSQL connection string       | Yes      |
| `PINGID_JWKS_URI`          | PingID JWKS endpoint               | Prod     |
| `PINGID_ISSUER`            | PingID token issuer                | Prod     |
| `PINGID_AUDIENCE`          | PingID audience claim              | Prod     |
| `MOCK_AUTH_ENABLED`        | `true` for local dev               | Local    |
| `AWS_REGION`               | `ap-southeast-2`                   | Yes      |
| `LOCALSTACK_ENDPOINT`      | `http://localhost:4566` for local  | Local    |
| `EVENT_BUS_NAME`           | EventBridge bus name               | Yes      |
| `NEXT_PUBLIC_API_BASE_URL` | API URL for browser                | Yes      |
| `NEXT_PUBLIC_APP_ENV`      | `local` / `staging` / `prod`       | Yes      |
| `API_INTERNAL_BASE_URL`    | API URL for SSR (server-to-server) | Yes      |
| `NEXT_PUBLIC_API_MODE`     | `real` or `mock` (MSW)             | No       |
| `SNYK_TOKEN`               | Snyk security scanning             | CI       |

**Local defaults**: PostgreSQL at
`postgresql://postgres:postgres@localhost:5432/app_local`, LocalStack at
`http://localhost:4566`

## Key Conventions

### TypeScript

- Strict mode enabled everywhere
- `ES2022` target, `NodeNext` module resolution
- Path aliases via `@repo/*` workspace packages
- Never edit generated files in `packages/*/generated/` or
  `apps/web/src/hooks/generated/`

### Validation

- **Zod only** — never use `class-validator` or `class-transformer`
- `nestjs-zod` for NestJS integration
- Import `z` from `@repo/validation` (which re-exports with OpenAPI extensions)
- See `.claude/patterns/zod-openapi-pattern.md`

### Authentication

- **PingID only** — RS256/JWKS strategy
- `MOCK_AUTH_ENABLED=true` for local dev bypasses PingID
- `@Public()` decorator to opt out of auth on specific endpoints
- See `.claude/patterns/pingid-auth-pattern.md`

### Git & Commits

- **Conventional Commits** enforced by commitlint + husky
- Format: `<type>(<scope>): <subject>`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`,
  `ci`, `revert`, `build`

## Pre-commit & Pre-push Hooks

| Hook         | What Runs                                                                   |
| ------------ | --------------------------------------------------------------------------- |
| `pre-commit` | gitleaks secret detection → lint-staged (ESLint + Prettier on staged files) |
| `commit-msg` | commitlint — validates Conventional Commits format                          |
| `pre-push`   | `pnpm turbo run test --affected` — unit tests for changed packages          |

## Domain Model

CANS ships a single `User` model (`id`, `lanId`, `email`, `name`, timestamps) in
`packages/database/prisma/schema.prisma`. Add your own models and enums there,
then run `pnpm generate` to propagate types through the pipeline.
Roles/permissions for authorization live in `packages/shared-config/rbac/`.

## Claude Framework (`.claude/`)

| Category           | Files                                                                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Commands** (60+) | `add-feature`, `add-endpoint`, `add-component`, `add-e2e-test`, `create-epics`, `implement-epic`, `generate-tests`, `pre-release-check`, `tech-debt-map`, and many more                                                                                                        |
| **Agents** (14)    | `backend-engineer`, `frontend-developer`, `ui-developer`, `test-engineer`, `security-auditor`, `architect`, `architecture-reviewer`, `database-analyst`, `test-strategist`, `ambiguity-analyst`, `tech-lead`, `devops-engineer`, `db-designer`, `requirements-impact-analyzer` |
| **Workflows** (15) | `feature-development`, `epic-based-development`, `test-driven-development`, `playwright-tdd-workflow`, `frontend-ui-protocol`, `best-practices-analysis`, `deployment`, and more                                                                                               |
| **Patterns** (13)  | `zod-openapi-pattern`, `pingid-auth-pattern`, `rds-proxy-pattern`, `testcontainers-pattern`, `msw-handler-pattern`, `playwright-page-object-pattern`, `cdk-infrastructure-pattern`, and more                                                                                   |
| **Standards** (15) | `testing-standards`, `api-standards`, `frontend-standards`, `security-standards`, `database-standards`, `typescript-formatting-standards`, `ui-design-standards`, and more                                                                                                     |

## Critical Rules

1. **Never edit** `packages/*/generated/` or `apps/web/src/hooks/generated/` or
   `apps/web/src/mocks/generated/` — auto-generated
2. **Never use** `class-validator` or `class-transformer` — Zod only
3. **Never use** Cognito — PingID only
4. **Never use** SAM — AWS CDK v2 only
5. **Never use** `@nestjs/platform-express` — we use `@nestjs/platform-fastify`
6. **Never hardcode** secrets — use AWS Secrets Manager / Parameter Store
7. **OpenAPI first** — update Prisma schema → run `pnpm generate` before
   implementing new endpoints
8. **Always check** `apps/web/src/components/` before creating a new UI
   component (Storybook library)
9. **Default to CSR** in Next.js — only use Server Components when explicitly
   needed
10. **Always install latest stable** when adding any npm package — use
    `pnpm --filter <ws> add <pkg>@latest` (or `-D @latest`). Verify with
    `pnpm view <pkg> version` first, skip pre-release tags
    (`alpha`/`beta`/`rc`/`next`/`canary`), and never bare `pnpm add <pkg>`. See
    `.claude/standards/monorepo-standards.md#dependency-installation`.

## Important File Locations

| File                                           | Purpose                                           |
| ---------------------------------------------- | ------------------------------------------------- |
| `packages/database/prisma/schema.prisma`       | ⭐ Single source of truth — all models            |
| `packages/api-spec/generated/openapi.json`     | Generated OpenAPI spec (do not edit)              |
| `apps/web/src/hooks/generated/index.ts`        | Generated React Query hooks (do not edit)         |
| `apps/web/src/mocks/generated/`                | Generated MSW handlers (do not edit)              |
| `packages/validation/src/index.ts`             | Zod schema exports for both API and Web           |
| `packages/shared-config/src/rbac/constants.ts` | RBAC permissions and groups                       |
| `apps/api/src/openapi/generate-spec.ts`        | OpenAPI spec generator script                     |
| `apps/api/src/app.module.ts`                   | Root NestJS module with all feature modules       |
| `apps/api/src/main.ts`                         | Fastify server entry point (production and local) |
| `apps/api/Dockerfile`                          | Container image build for Fargate deployment      |
| `.env.example`                                 | Environment variable template                     |
| `scripts/generate.ts`                          | Full generation pipeline script                   |
| `docker/docker-compose.yml`                    | Local PostgreSQL (5432) + LocalStack (4566)       |
| `.claude/CLAUDE.md`                            | AI framework configuration                        |
| `.claude/project-structure.md`                 | Detailed project structure (read before file ops) |
