# Local Runtime Modes

## Scope
Local execution, validation, and delivery readiness only.
Agents must NOT execute live deployments unless explicitly requested.

## Generation Pipeline (run on any schema/spec change)
```bash
# Full pipeline — always run in this order
pnpm --filter @repo/database generate        # Prisma client + zod-prisma-types
tsx apps/api/src/openapi/generate-spec.ts    # Zod → OpenAPI JSON
pnpm --filter @repo/web orval                # OpenAPI → React Query hooks + MSW
pnpm --filter @repo/web orval:msw            # OpenAPI → MSW handlers

# Or via root shortcut
pnpm generate
````

## Runtime Mode Matrix

### Mode A: Frontend Only (MSW Mock API)

Validate UI flows without backend.

```bash
# 1. Generate types and MSW handlers from OpenAPI spec
pnpm generate

# 2. Start frontend with MSW enabled
cd apps/web && NEXT_PUBLIC_API_MODE=mock pnpm dev

# 3. Frontend tests
pnpm --filter @repo/web test
```

### Mode B: Full Local Stack

End-to-end local integration.

```bash
# 1. Start Postgres + LocalStack
docker compose up -d postgres localstack

# 2. Run migrations + seed
pnpm --filter @repo/database migrate:dev
pnpm --filter @repo/database seed

# 3. Start NestJS API (local mode)
pnpm --filter @repo/api start:dev

# 4. Start Next.js frontend
pnpm --filter @repo/web dev

# 5. Tests
pnpm test                         # all workspaces
```

### Mode C: Frontend Local + Live API

```bash
# Point frontend at deployed API
NEXT_PUBLIC_API_URL=https://api.dev.example.com pnpm --filter @repo/web dev
```

### Mode D: Backend Local + Local Postgres + LocalStack

```bash
docker compose up -d postgres localstack
pnpm --filter @repo/database migrate:dev
pnpm --filter @repo/api start:dev
pnpm --filter @repo/api test:integration    # Testcontainers tests
```

### Mode E: Backend Local + Live AWS (validation only)

```bash
# Uses env vars pointing to dev/staging AWS
pnpm --filter @repo/api start:dev
pnpm --filter @repo/api test:integration
```

## docker-compose.yml Services

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: myapp
      POSTGRES_PASSWORD: myapp

  localstack:
    image: localstack/localstack:latest
    ports: ["4566:4566"]
    environment:
      SERVICES: secretsmanager,ssm,events,logs,sqs,sns
      DEBUG: 1

  prisma-studio:
    # Optional — runs Prisma Studio for DB inspection
    command: npx prisma studio --port 5555 --schema=/app/packages/database/prisma/schema.prisma
    ports: ["5555:5555"]
```

## Required Reporting for Any Run/Test Task

1. Mode selected (A–E)
2. Generation pipeline status (up-to-date / regenerated)
3. Services started
4. Test results (pass/fail counts)
5. Coverage (if applicable)
6. What was NOT validated

## Cross-References

- Feature workflow: `@.claude/workflows/feature-development.md`
- API standards: `@.claude/standards/api-standards.md`
- Testing: `@.claude/standards/testing-standards.md`

## Token Optimization

- **Load when**: choosing how to run/build/test locally (dev server, Storybook, mock vs real auth, Playwright modes).
- **Load only**: this workflow. No standards needed — it's a runtime decision matrix.
- **Unload after**: chosen mode is running; subsequent work loads task-specific docs.
