# Project Structure

```
.
my-app/
├── apps/
│   │
│   ├── api/ # NestJS application
│   │   ├── src/
│   │   │   ├── modules/ # Feature modules (one folder per domain)
│   │   │   │   └── users/ # Example feature module
│   │   │   │       ├── users.module.ts # NestJS module definition
│   │   │   │       ├── users.controller.ts # Thin — ZodValidationPipe, @RequirePermissions
│   │   │   │       ├── users.service.ts # Business logic, EventBridge events
│   │   │   │       ├── users.repository.ts # Complex queries only (simple CRUD in service)
│   │   │   │       ├── users.controller.spec.ts
│   │   │   │       ├── users.service.spec.ts
│   │   │   │       ├── exceptions/
│   │   │   │       │   └── user.exceptions.ts # Domain exceptions (UserNotFoundException etc.)
│   │   │   │       ├── fixtures/
│   │   │   │       │   └── user.fixtures.ts # faker factories (userFactory, createUserDtoFactory)
│   │   │   │       └── tests/
│   │   │   │           └── users.integration.spec.ts # supertest + Testcontainers
│   │   │   │
│   │   │   ├── common/ # Shared NestJS infrastructure
│   │   │   │   ├── filters/
│   │   │   │   │   └── global-exception.filter.ts # RFC 7807 ProblemDetail — all errors
│   │   │   │   ├── guards/
│   │   │   │   │   ├── jwt-auth.guard.ts # JwtAuthGuard — applied globally
│   │   │   │   │   └── permissions.guard.ts # PermissionsGuard — reads JWT claims
│   │   │   │   ├── decorators/
│   │   │   │   │   ├── permissions.decorator.ts # @RequirePermissions('user:create')
│   │   │   │   │   └── public.decorator.ts # @Public() — bypasses JWT guard
│   │   │   │   └── middleware/
│   │   │   │       └── correlation-id.middleware.ts # Auto-generates x-correlation-id
│   │   │   │
│   │   │   ├── auth/        # JWT strategy and Passport setup
│   │   │   │   ├── jwt.strategy.ts # RS256 JWKS validation
│   │   │   │   └── auth.module.ts
│   │   │   │
│   │   │   ├── events/ # EventBridge integration
│   │   │   │   ├── eventbridge.service.ts # publish() and publishMany()
│   │   │   │   └── events.module.ts
│   │   │   │
│   │   │   ├── health/ # Health check endpoint (@Public)
│   │   │   │   └── health.controller.ts # GET /health — Prisma connectivity check
│   │   │   │
│   │   │   ├── openapi/
│   │   │   │   └── generate-spec.ts # Zod → OpenAPI JSON (run via pnpm generate)
│   │   │   │
│   │   │   ├── app.module.ts # Root module — registers global guards/filters
│   │   │   ├── bootstrap.ts # Shared app setup (Helmet, CORS, pipes, filters)
│   │   │   └── main.ts # Fastify server entry point
│   │   │
│   │   ├── test/
│   │   │   └── jest.integration.config.ts # Separate Jest config for integration tests
│   │   │
│   │   ├── Dockerfile # Container image build for Fargate deployment
│   │   ├── docker-entrypoint.sh # Composes DATABASE_URL from Secrets Manager + RDS Proxy host
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json # Extends packages/tsconfig/nestjs.json
│   │   ├── tsconfig.build.json # Excludes test files from build
│   │   ├── jest.config.ts # Unit test config (excludes .integration.spec.ts)
│   │   └── package.json # @repo/api
│   │
│   └── web/ # NextJS 14 application
│       ├── app/                        # App Router — pages and layouts
│       │   ├── (protected)/            # Route group — requires JWT auth
│       │   │   ├── layout.tsx          # Auth guard layout (checks useAuth)
│       │   │   ├── dashboard/
│       │   │   │   ├── page.tsx        # 'use client' default — uses generated hooks
│       │   │   │   ├── loading.tsx     # Suspense fallback skeleton
│       │   │   │   └── error.tsx       # Error boundary (required on all pages)
│       │   │   └── users/
│       │   │       ├── page.tsx        # User list page
│       │   │       ├── loading.tsx
│       │   │       ├── error.tsx
│       │   │       └── [id]/
│       │   │           ├── page.tsx    # User detail page
│       │   │           └── error.tsx
│       │   │
│       │   ├── (auth)/                 # Route group — unauthenticated pages
│       │   │  ├── login/
│       │   │  │   └── page.tsx         # Uses AuthContext.login() — not raw fetch
│       │   │  └── unauthorized/
│       │   │      └── page.tsx
│       │   │
│       │   ├── api/                    # NextJS route handlers (thin BFF proxy only)
│       │   │   └── auth/
│       │   │       ├── login/route.ts  # POST /api/auth/login
│       │   │       ├── logout/route.ts # POST /api/auth/logout
│       │   │       └── me/route.ts     # GET /api/auth/me
│       │   │
│       │   ├── layout.tsx              # Root layout — QueryClientProvider + AuthProvider
│       │   └── page.tsx                # Root redirect → /dashboard or /login
│       │
│       └── src/
│           ├── components/
│           │   ├── ui/                 # Generic primitive wrappers
│           │   │   ├── LoadingSpinner.tsx
│           │   │   ├── ErrorMessage.tsx
│           │   │   └── EmptyState.tsx
│           │   ├── users/              # Feature-scoped components
│           │   │   ├── UserList.tsx    # Uses useGetUsers() generated hook
│           │   │   ├── UserList.test.tsx   # renderWithProviders + MSW
│           │   │   ├── UserCard.tsx
│           │   │   ├── UserCard.test.tsx
│           │   │   ├── CreateUserForm.tsx  # useForm + zodResolver(CreateUserDto)
│           │   │   ├── CreateUserForm.test.tsx
│           │   │   └── index.ts            # Barrel export
│           │   └── layout/
│           │       ├── AppShell.tsx # Navigation shell
│           │       └── Sidebar.tsx
│           │
│           ├── hooks/
│           │   ├── generated/      # ← orval output — DO NOT EDIT MANUALLY
│           │   │   ├── users.ts    # useGetUsers, useCreateUser, getUsersQueryKey
│           │   │   ├── posts.ts    # useGetPosts, useCreatePost, ...
│           │   │   └── index.ts    # Re-exports all generated hooks
│           │   └── users.hooks.ts  # Hand-written extensions (optimistic updates only)
│           │
│           ├── mocks/
│           │   ├── generated/      # ← orval MSW output — DO NOT EDIT MANUALLY
│           │   │   ├── users.ts    # Generated MSW handlers for /v1/users
│           │   │   └── posts.ts
│           │   ├── handlers.ts     # Global baseline handlers (imports from generated/)
│           │   ├── server.ts       # MSW node server — used in Jest tests
│           │   └── browser.ts      # MSW browser setup — used in development
│           │
│           ├── lib/
│           │   ├── query-client.ts # makeQueryClient() — retry/error defaults
│           │   ├── api-client.ts   # customFetch — orval mutator, sets x-correlation-id
│           │   └── auth/
│           │       ├── AuthContext.tsx # AuthProvider — calls queryClient.clear() on logout
│           │       └── permissions.ts  # hasRole(), hasPermission() helpers
│           │
│           └── types/              # Local TS types (never duplicate @repo/validation)
│               └── navigation.ts   # Route constants
│
├── packages/
│   │
│   ├── database/ # ⭐ PRISMA SCHEMA — SINGLE SOURCE OF TRUTH
│   │   ├── prisma/
│   │   │   ├── schema.prisma # All models — generates Prisma client + Zod schemas
│   │   │   ├── migrations/ # Auto-generated by prisma migrate dev — DO NOT EDIT
│   │   │   │   └── 20240101000000_init/
│   │   │   │       └── migration.sql
│   │   │   └── seed.ts # Deterministic UUID seed data (upsert — idempotent)
│   │   ├── generated/
│   │   │   └── zod/          # ← zod-prisma-types output — DO NOT EDIT
│   │   │       └── index.ts  # UserSchema, UserCreateInputSchema, etc.
│   │   ├── src/
│   │   │   ├── client.ts  # getPrismaClient() singleton (connection-safe — single pool per process behind RDS Proxy)
│   │   │   └── index.ts   # Re-exports PrismaService + types
│   │   └── package.json   # @repo/database
│   │
│   ├── validation/ # Shared Zod schemas + OpenAPI metadata
│   │   ├── src/
│   │   │   ├── user.schema.ts # Extends generated UserCreateInputSchema
│   │   │   │  # + .openapi() metadata for spec generation
│   │   │   ├── pagination.schema.ts # PaginationDto, PaginatedResponseDto
│   │   │   ├── common.schema.ts # ProblemDetail, CorrelationIdHeader
│   │   │   ├── enums.ts # TypeScript enums mirroring VarChar DB values
│   │   │   └── index.ts # Re-exports all — imported by api/ and web/
│   │   └── package.json # @repo/validation
│   │
│   ├── api-spec/ # Generated OpenAPI spec
│   │   ├── generated/
│   │   │   ├── openapi.json # ← generate-spec.ts output — DO NOT EDIT
│   │   │   └── openapi.yaml # YAML copy for human review
│   │   └── package.json # @repo/api-spec
│   │
│   └── tsconfig/ # Shared TypeScript configurations
│       ├── base.json       # Strict mode, paths, common excludes
│       ├── nestjs.json     # Extends base — decorators, CommonJS, emitDecoratorMetadata
│       └── nextjs.json     # Extends base — DOM lib, Bundler resolution, JSX
│
├── scripts/
│   ├── generate.ts # Master pipeline: Prisma→Zod→OpenAPI→orval hooks→MSW
│   └── check-env.ts # Validates required env vars before start
│
├── infra/          # AWS CDK v2 (TypeScript) — NOT SAM
│   ├── bin/
│   │   └── app.ts  # CDK app entry point
│   ├── lib/
│   │   ├── shared-stack.ts # VPC, IAM roles, ECR
│   │   ├── api-stack.ts    # Fargate service + internal ALB, RDS, RDS Proxy, EventBridge
│   │   └── web-stack.ts    # S3, CloudFront
│   └── cdk.json
│
├── docker/
│   ├── docker-compose.yml # Full local stack: Postgres + LocalStack
│   ├── docker-compose.test.yml # Integration test environment
│   └── localstack/
│       └── init-scripts/ # LocalStack bootstrap (EventBridge bus, S3 buckets)
│
├── .claude/ # AI framework
│   ├── CLAUDE.md
│   ├── agents/
│   ├── commands/
│   ├── standards/
│   ├── workflows/
│   ├── templates/
│   ├── patterns/
│   └── docs/
│
├── .github/
│   └── workflows/
│       ├── ci.yml # PR: lint + type-check + unit tests + build
│       ├── integration.yml # PR: Testcontainers integration tests
│       └── deploy.yml # main: full pipeline + CDK deploy
│
├── .husky/
│   ├── pre-commit # lint-staged + type-check affected
│   ├── commit-msg # commitlint (Conventional Commits)
│   └── pre-push # unit tests affected packages
│
├── .editorconfig # IDE baseline: LF, 2 spaces, UTF-8
├── .env.example # All required vars documented — commit this
├── .eslintignore # Legacy — flat config uses ignores in eslint.config.mjs
├── .prettierignore # Excludes generated/, .next/, dist/, migrations/
├── .prettierrc.json # Formatting rules (printWidth 100, singleQuote, LF)
├── .yamllint # YAML structure validation
├── eslint.config.mjs # ESLint flat config — TS, security, import order
├── package.json # Root: scripts, lint-staged, commitlint, devDeps
├── pnpm-workspace.yaml # Workspace: apps/, packages/*
├── tsconfig.json # Root tsconfig — references all workspaces
└── turbo.json # Task graph, caching, env passthrough
```

## Github Actions

```
Workflow Trigger Purpose
────────────────────────────────────────────────────────────────────────────
ci.yml PR + push main/develop Lint, type-check, unit tests, build
integration.yml PR + push main/develop Testcontainers API integration tests
e2e.yml PR + push main Playwright full stack security.yml PR + push main +
weekly Audit, Snyk, Gitleaks, CodeQL cd-staging.yml push main (auto) Deploy to
staging after CI + integration cd-production.yml workflow_dispatch (manual)
Deploy to production with approval gate pr-checks.yml PR events Commitlint, size
label release.yml workflow_dispatch Changelog + version bump + GitHub release
```

## Prettier & ESLint Setup

```
Concern              Tool              Config file
────────────────────────────────────────────────────────────────────────────
Code formatting      Prettier          .prettierrc.json
Code quality/logic   ESLint            eslint.config.mjs
Import ordering      ESLint            eslint.config.mjs (import/order rule)
Formatting conflicts DISABLED          eslint-config-prettier (last in chain)
IDE formatter        Prettier via      .vscode/settings.json
                     VS Code plugin    (defaultFormatter = prettier-vscode)
IDE baseline         EditorConfig      .editorconfig (same values as Prettier)
Git pre-commit       lint-staged       lint-staged.config.js
Git commit format    commitlint        package.json (commitlint key)
Git pre-push         Husky             .husky/pre-push
Prisma formatting    prisma format     schema.prisma (in lint-staged)
Shell scripts        shfmt             .husky/* + scripts/*.sh
```

### The Single Rule to Remember

> **Prettier owns formatting. ESLint owns quality. They never overlap.**
> `eslint-config-prettier` as the last entry in `eslint.config.mjs` enforces
> this.

## Husky Setup

```
File                    Purpose                                         Scope
─────────────────────────────────────────────────────────────────────────────
package.json (root)     Scripts, lint-staged config, commitlint         All
turbo.json              Task graph, caching, env passthrough            All
eslint.config.mjs       ESLint flat config — TS, security, imports      All
.prettierrc.json        Formatting rules                                All
.prettierignore         Excludes generated/, .next/, dist/              All
.editorconfig           IDE baseline (tabs, LF, indent)                 All
.yamllint               YAML structure validation in pre-commit         YAML files
.env.example            Documents required vars — committed             All
.husky/pre-commit       lint-staged + type-check on staged files        Commit time
.husky/commit-msg       Conventional Commits format validation          Commit time
.husky/pre-push         Unit tests for affected packages                Push time
scripts/generate.ts     Prisma→Zod→OpenAPI→hooks pipeline               Dev workflow
scripts/check-env.ts    Validates env vars before start                 Dev/CI
```

## Pre-commit Speed Strategy

```
Commit          → lint-staged (FAST — staged files only)
                  + type-check affected (FAST — turbo cache)

Push            → unit tests affected (FAST — turbo cache)

CI (PR)         → full lint + type-check + unit + integration + build

CI (main)       → everything above + E2E + security scan
```

## Required GitHub Secrets & Variables

```
Secrets (repository or environment level)
──────────────────────────────────────────────────────
TURBO_TOKEN                  Turborepo remote cache token
CODECOV_TOKEN                Coverage upload
SNYK_TOKEN                   Snyk vulnerability scanning
AWS_DEPLOY_ROLE_STAGING      IAM role ARN (OIDC — no keys)
AWS_DEPLOY_ROLE_PRODUCTION   IAM role ARN (OIDC — no keys)
DATABASE_URL_STAGING         Postgres connection string
DATABASE_URL_PRODUCTION      Postgres connection string
SLACK_BOT_TOKEN              Deployment notifications
TKN_SNR                      SonarQube authentication token


Variables (non-secret config)
──────────────────────────────────────────────────────
TURBO_TEAM                   Turborepo team slug
API_BASE_URL_STAGING         https://api.staging.example.com
API_BASE_URL_PRODUCTION      https://api.example.com
SLACK_DEPLOY_CHANNEL         #deployments
SNYK_ENABLED                 true / false
SONAR_ROOT_CERT              SonarQube internal CA certificate
CODECOV_TOKEN                Codecov upload token (optional parallel upload)
```
