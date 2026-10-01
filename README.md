# CANS — PPCC Agreement and Netting System

A production-ready monorepo for the CANS platform at PPCC. Ships with
infrastructure, authentication, RBAC authorization, a UI component library,
testing tooling, and a comprehensive AI-driven development framework
(`.claude/`) — all pre-built and tested, so your team can start delivering
business features immediately.

---

## What's Built In

The CANS platform comes with the following ready to use:

| Feature                         | Details                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| **Monorepo**                    | pnpm workspaces + Turborepo (`build`, `test`, `lint`, `generate`)                     |
| **NestJS API**                  | TypeScript 5+, Fargate service behind internal ALB (Fastify)                          |
| **NextJS Frontend**             | App Router, CSR default, protected layouts                                            |
| **AWS CDK v2 Infrastructure**   | Fargate + internal ALB, RDS PostgreSQL + RDS Proxy, EventBridge, Secrets Manager      |
| **Docker Compose + LocalStack** | PostgreSQL (5432) + LocalStack (4566) for all AWS services locally                    |
| **Prisma ORM**                  | Schema, migrations, seed data, connection-safe singleton client                       |
| **Code Generation Pipeline**    | Prisma → Zod → OpenAPI → orval React Query hooks — run `pnpm generate`                |
| **PingID Authentication**       | RS256/JWKS strategy, mock auth for local dev, `@Public()` decorator                   |
| **RBAC Authorization**          | `@RequirePermissions()` guard, 5-group JSON config, deny-precedence                   |
| **Frontend Auth Pages**         | `/login`, `/login-mock`, `/secure`, `/role-permissions` with protected layout         |
| **Storybook UI Library**        | Full component library in `apps/web/src/components/`                                  |
| **Integration Tests**           | TestContainers — health, mock login, permissions (11 tests)                           |
| **Husky + lint-staged**         | Pre-commit: ESLint + Prettier; commit-msg: conventional commits; pre-push: type-check |
| **GitHub Actions CI/CD**        | Lint, type-check, unit tests, build, RBAC schema validation                           |

> Full feature details:
> [.claude/project-features.md](.claude/project-features.md)

---

## Technology Stack

- **Frontend**: NextJS 14 (App Router), TypeScript, Tailwind CSS, DaisyUI,
  @tanstack/react-query, orval
- **Backend**: NestJS 10+, TypeScript 5+, Zod, `@asteasolutions/zod-to-openapi`,
  Fargate service behind internal ALB
- **Database**: PostgreSQL (via RDS Proxy), Prisma ORM, `zod-prisma-types`
- **Infrastructure**: AWS CDK v2, Fargate + internal ALB, EventBridge, Secrets
  Manager
- **Local Dev**: Docker Compose, LocalStack, `pnpm dev`
- **Testing**: Jest, TestContainers, MSW (Mock Service Worker), Playwright (E2E)
- **Auth**: PingID (RS256/JWKS) + mock auth for local development
- **Tooling**: pnpm workspaces, Turborepo, ESLint, Prettier, Husky

---

## Prerequisites

| Requirement        | Version  | Notes                                                                    |
| ------------------ | -------- | ------------------------------------------------------------------------ |
| Node.js            | >= 20    | Use [nvm](https://github.com/nvm-sh/nvm): `nvm install 20 && nvm use 20` |
| pnpm               | >= 9     | `npm install -g pnpm`                                                    |
| Docker Desktop     | Latest   | Must be running for local infrastructure                                 |
| Git                | Any      | Standard installation                                                    |
| PingID credentials | Optional | Not required — mock auth works without them for local dev                |

---

## Getting Started

### Quick Setup (Recommended)

```bash
# 1. Clone and enter the repository
git clone <repo-url> my-project
cd my-project

# 2. Install dependencies
pnpm install

# 3. Create your local environment file
cp .env.local.example .env.local
# Edit .env.local — fill in any project-specific values

# 4. Start the infrastructure (Docker must be running)
pnpm infra:up

# 5. Apply database migrations and seed data
pnpm db:migrate
pnpm db:seed

# 6. Run the code generation pipeline
pnpm generate

# 7. Start the application
pnpm dev
```

Visit `http://localhost:3000/login-mock` to authenticate with a mock user and
explore the application.

### Automated Environment Check

If you are using Claude Code (the AI development assistant), run the
`/infra-setup` command for an automated 12-point environment check that
validates all prerequisites and auto-fixes what it can:

```
/infra-setup
```

This validates Node.js, pnpm, dependencies, Husky hooks, `.env.local`, Docker,
LocalStack, PostgreSQL, Prisma migrations, and smoke-tests the API.

See [docs/getting-started.md](docs/getting-started.md) for the full onboarding
guide.

---

## Running the Application

From the repo root:

```bash
# Start everything (recommended)
pnpm dev                          # frontend (port 3000) + backend (watch mode, port 3001)

# Frontend only
pnpm --filter @repo/web dev       # next dev — hot reload, http://localhost:3000

# Backend only
pnpm --filter @repo/api start:dev # nest start --watch

# Build for production
pnpm build                        # builds all packages
```

---

## Infrastructure Commands

```bash
pnpm infra:up     # start Docker Compose (PostgreSQL + LocalStack)
pnpm infra:down   # stop all containers
pnpm infra:logs   # tail container logs
```

---

## Database Commands

```bash
pnpm db:migrate   # run pending Prisma migrations
pnpm db:seed      # seed test data (idempotent)
pnpm db:studio    # open Prisma Studio — http://localhost:5555
pnpm db:reset     # reset database and re-run all migrations
```

---

## Code Generation

The codebase uses a single-source-of-truth code generation pipeline. Run this
after any schema changes:

```bash
pnpm generate
```

This runs:

1. `prisma generate` — Prisma client + Zod schemas
2. `generate-spec.ts` — OpenAPI JSON spec from Zod
3. `orval` — typed React Query hooks + MSW handlers from OpenAPI

> **Never** edit files in `packages/api-spec/generated/` or
> `apps/web/src/hooks/generated/` directly.

---

## Running Tests

```bash
# Unit tests (all packages)
pnpm test

# Unit tests with coverage
pnpm test --coverage

# Integration tests (requires Docker running)
pnpm test:integration --runInBand

# API tests only
pnpm --filter @repo/api test

# Web tests only
pnpm --filter @repo/web test

# E2E tests (Playwright)
pnpm --filter @repo/web test:e2e
```

---

## Storybook

The UI component library is built with Storybook. All components in
`apps/web/src/components/` have stories, MDX docs, and accessibility audits.

```bash
# Start Storybook dev server
pnpm --filter @repo/web storybook    # http://localhost:6006

# Build static Storybook
pnpm --filter @repo/web build-storybook
```

> Before creating any new UI component, **always check the Storybook library
> first** — see
> [.claude/standards/component-usage.md](.claude/standards/component-usage.md).

---

## Code Quality

```bash
pnpm lint          # ESLint across all packages
pnpm lint:fix      # ESLint + auto-fix
pnpm format        # Prettier format all files
pnpm type-check    # TypeScript type-check all packages
```

---

## Project Structure

```
.
├── apps/
│   ├── api/          # NestJS API — Fargate service, auth, RBAC, health
│   └── web/          # NextJS 14 frontend — App Router, auth pages, components
├── packages/
│   ├── api-spec/     # Generated OpenAPI spec (do not edit)
│   ├── common/       # Shared utilities
│   ├── database/     # Prisma schema, migrations, seed, generated Zod types
│   ├── shared-config/# RBAC config, shared constants
│   ├── tsconfig/     # Shared TypeScript configurations
│   └── validation/   # Zod schemas with OpenAPI metadata
├── infra/            # AWS CDK v2 stacks (API, Database, Events)
├── docker/           # Docker Compose + LocalStack setup
├── docs/             # Project General documentation and guides
├── specs/            # Project BED and Specs
├── .claude/          # AI development framework (commands, agents, standards)
└── .github/          # GitHub Actions CI/CD workflows
```

See [docs/project-structure.md](docs/project-structure.md) for a detailed
breakdown.

---

## Documentation

| Document                                                                                                       | Description                                             |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [docs/getting-started.md](docs/getting-started.md)                                                             | Full local setup and onboarding guide                   |
| [docs/centralized-error-handling-and-alert-strategy.md](docs/centralized-error-handling-and-alert-strategy.md) | Error handling strategy and alert patterns              |
| [docs/auth/pingid-auth-pattern.md](docs/auth/pingid-auth-pattern.md)                                           | PingID authentication architecture                      |
| [docs/auth/authorization-patterns-and-architecture.md](docs/auth/authorization-patterns-and-architecture.md)   | RBAC authorization patterns                             |
| [.claude/project-features.md](.claude/project-features.md)                                                     | Detailed reference of all built-in CANS features        |
| [.claude/CLAUDE.md](.claude/CLAUDE.md)                                                                         | AI framework master guide — commands, agents, workflows |

---

## AI Development Framework (`.claude/`)

The CANS platform ships with a comprehensive AI development framework that
enables AI-driven, full-cycle application development — from requirements
through deployment.

### How It Works

The `.claude/` folder contains:

- **Slash-commands** — structured prompts for every development activity
- **Agents** — specialized AI subagents for architecture, security, testing,
  database design, etc.
- **Standards** — coding standards, design patterns, and quality gates
- **Workflows** — orchestrated multi-step development processes
- **Templates** — code templates for NestJS controllers, services, NextJS pages,
  tests, etc.

### Extending CANS with New Features

```
1. /create-specifications   → Generate business + functional specs from your requirements
2. /create-epics            → Plan your delivery epics
3. /implement-epic          → Implement each epic (S/M size)
   /create-epic-tasks       → Break L/XL epics into tasks first
```

### Common Commands

| Command                    | Purpose                                     |
| -------------------------- | ------------------------------------------- |
| `/infra-setup`             | Validate and auto-fix local environment     |
| `/add-feature`             | Add a new feature with epic planning        |
| `/create-specifications`   | Generate specs from requirements            |
| `/create-epics`            | Plan delivery epics                         |
| `/implement-epic`          | Implement a single epic                     |
| `/security-audit`          | OWASP Top 10 security audit                 |
| `/pre-release-check`       | Fast GO/NO-GO quality gate                  |
| `/wireframes-to-storybook` | Build Storybook components from wireframes  |
| `/help`                    | Get help on any command, agent, or workflow |

> Full command reference: [.claude/CLAUDE.md](.claude/CLAUDE.md)

---

## Authentication

### Local Development (Mock Auth)

CANS uses mock authentication for local development — no PingID credentials
required.

1. Start the app: `pnpm dev`
2. Visit `http://localhost:3000/login-mock`
3. Select any of the 5 RBAC groups to authenticate

### Production (PingID)

Set the following environment variables in `.env.local`:

```
PINGID_JWKS_URI=https://auth.pingone.com/{env-id}/as/jwks.json
PINGID_ISSUER=https://auth.pingone.com/{env-id}/as
PINGID_AUDIENCE=your-api-audience
MOCK_AUTH_ENABLED=false
```

See [docs/auth/pingid-auth-pattern.md](docs/auth/pingid-auth-pattern.md) for the
full PingID integration guide.

---

## RBAC Authorization

CANS ships with a 5-group RBAC system:

| Group           | Access Level                           |
| --------------- | -------------------------------------- |
| `mx-superadmin` | Full access — bypasses all RBAC checks |
| `mx-admin`      | Administrative access to all resources |
| `mx-manager`    | Read + write on business resources     |
| `mx-viewer`     | Read-only access                       |
| `mx-user`       | Basic user access                      |

Permission rules are defined in
`packages/shared-config/rbac/rbac-group-permissions.json`. Use
`@RequirePermissions('resource:action')` on any NestJS controller method.

---

## License

Internal use — PPCC Enterprise. See repository policies for usage terms.
# cams
# cams
