# Getting Started — CANS

This guide takes you from a fresh clone to a running local development
environment.

---

## 1. Prerequisites

| Requirement        | Version    | Notes                                                                    |
| ------------------ | ---------- | ------------------------------------------------------------------------ |
| Node.js            | >= 20      | Use [nvm](https://github.com/nvm-sh/nvm): `nvm install 20 && nvm use 20` |
| pnpm               | >= 9       | `npm install -g pnpm`                                                    |
| Docker Desktop     | Latest     | Must be running before starting LocalStack and PostgreSQL                |
| Git                | Any recent | Standard installation                                                    |
| PingID credentials | Optional   | Not required for local development — mock auth works without them        |

---

## 2. Quick Start

```bash
# 1. Clone the repository
git clone <repo-url> my-project
cd my-project

# 2. Create your local environment file
cp .env.local.example .env.local
# Edit .env.local — see section 5 for required values

# 3. Run the environment setup (in Claude Code)
/infra-setup
```

`/infra-setup` checks all 12 prerequisites, auto-fixes what it can (installs
pnpm, starts Docker containers, runs Prisma migrations), and reports clear next
steps for anything that needs manual intervention.

After all checks pass:

```bash
# 4. Start the API
pnpm --filter @repo/api start:dev

# 5. Start the web app (new terminal)
pnpm --filter @repo/web dev
```

Visit `http://localhost:3000/login-mock` to authenticate with mock credentials.

---

## 3. Project Structure Overview

```
app/
├── apps/
│   ├── api/          # NestJS API (Fargate service)
│   └── web/          # Next.js 14 web application
├── packages/
│   ├── database/     # Prisma schema, migrations, and client
│   ├── shared-config/# RBAC config, shared constants
│   ├── validation/   # Shared Zod schemas and DTOs
│   └── api-contracts/# Generated OpenAPI types and React Query hooks
├── infra/            # AWS CDK v2 infrastructure stacks
├── docker/           # Docker Compose for LocalStack and PostgreSQL
└── .claude/          # Claude AI development framework
```

Full detail including file conventions: `.claude/project-structure.md`

---

## 4. Local Development

### Start the API

```bash
pnpm --filter @repo/api start:dev
```

The API starts on `http://localhost:3001`. Health check:
`GET http://localhost:3001/health`

### Start the Web App

```bash
pnpm --filter @repo/web dev
```

The web app starts on `http://localhost:3000`.

### Mock Login

With mock auth enabled (the default for local dev), visit:

```
http://localhost:3000/login-mock
```

Enter any LAN ID and select a group (e.g. `mx-admin`) to mint a token and
authenticate.

Alternatively, POST directly to the API:

```bash
curl -s -X POST http://localhost:3001/login \
  -H 'Content-Type: application/json' \
  -d '{"lanId":"your-lan-id","groups":["mx-admin"]}'
```

### Run Tests

```bash
# Unit tests (all packages)
pnpm test

# Integration tests (requires Docker)
pnpm test:integration --runInBand

# A single package
pnpm --filter @repo/api test
```

---

## 5. Authentication Setup

### Mock Auth (Local Development)

Mock auth is enabled by default for local development. No setup is required
beyond the `.env.local` file that `/infra-setup` creates.

The `.env.local` value that controls this:

```bash
MOCK_AUTH_ENABLED=true
```

When `MOCK_AUTH_ENABLED=true`, the API accepts `POST /login` requests without a
real PingID token, making it easy to test any role or permission locally.

### Real PingID Auth

To test against a real PingID identity provider, set these values in
`.env.local`:

```bash
MOCK_AUTH_ENABLED=false
PINGID_JWKS_URI=https://<your-pingid-tenant>/.well-known/jwks.json
PINGID_ISSUER=https://<your-pingid-tenant>
PINGID_AUDIENCE=<your-application-client-id>
```

Contact your identity team for the correct tenant URL and client ID.

---

## 6. RBAC Configuration

### Where the Config Lives

```
packages/shared-config/rbac/rbac-group-permissions.json
```

This file is the single source of truth for group-to-permission mappings. It is
validated against a JSON Schema (`rbac-group-permissions.schema.json` in the
same directory) in CI.

### Add a New Group

Open `packages/shared-config/rbac/rbac-group-permissions.json` and add an entry:

```json
{
  "groups": {
    "mx-new-group": {
      "permissions": ["resource:read", "resource:write"]
    }
  }
}
```

### Add a New Permission

Define the permission in the schema, then assign it to one or more groups in
`rbac-group-permissions.json`. The schema enforces the allowed permission
strings — adding a new permission requires updating the schema first.

### Validate Locally

```bash
npx ajv-cli validate \
  -s packages/shared-config/rbac/rbac-group-permissions.schema.json \
  -d packages/shared-config/rbac/rbac-group-permissions.json
```

### Visual Inspection

The `/role-permissions` page in the web app shows the full group–permission
matrix as a table. Visit `http://localhost:3000/role-permissions` (requires
admin login).

---

## 7. Using the Claude AI Framework

The `.claude/` folder contains the AI-driven development framework used to build
and extend this application.

### Add a Feature

```
/add-feature <description>
```

Accepts a plain-English description, a story ID, a requirements document, or a
folder. Classifies the scope (API-only, UI-only, or full-stack), runs an
ambiguity review, and generates epics in `specs/epics/`.

### Implement an Epic

```
/implement-epic specs/epics/epic-XXX-name.md
```

Autonomously implements a small or medium epic — OpenAPI spec, backend,
frontend, tests, and quality gate.

### Full Command Reference

See `.claude/CLAUDE.md` for the complete command catalog, including commands for
architecture review, security audit, database migration, and deployment
preparation.

---

## 8. Deployment Readiness

### CDK Infrastructure

The AWS CDK stacks live in `infra/`. To synthesise the CloudFormation template
for the `dev` stage:

```bash
cd infra
cdk synth --context stage=dev
```

### CI/CD Pipelines

GitHub Actions workflows are in `.github/workflows/`:

| File                | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `ci.yml`            | Build, lint, unit tests — runs on every PR  |
| `integration.yml`   | Integration tests — runs on every PR        |
| `e2e.yml`           | Playwright E2E tests — runs on every PR     |
| `cd-staging.yml`    | Deploy to staging — runs on merge to `main` |
| `cd-production.yml` | Deploy to production — runs on release tags |

### Pre-Release Gate

Before raising a production PR, run the pre-release check:

```
/pre-release-check
```

This validates security, error handling, database state, and test coverage and
produces a GO/NO-GO verdict.

---

## 9. Troubleshooting

### Docker not running

`/infra-setup` will report this. Start Docker Desktop and wait for it to fully
initialise before re-running.

### Port 3001 already in use

```bash
# Find the process using port 3001
lsof -i :3001

# Kill it (replace <PID> with the number from the output)
kill <PID>
```

### Port 3000 already in use

Same pattern as above, substituting `3000` for `3001`.

### Prisma migration error

```bash
# Regenerate the Prisma client
pnpm --filter @repo/database generate

# Apply pending migrations
DATABASE_URL=<your-url> npx prisma migrate deploy \
  --schema=packages/database/prisma/schema.prisma
```

If the migration fails due to a connection error, check that PostgreSQL is
running:

```bash
docker compose -f docker/docker-compose.yml ps postgres
```

### RBAC schema validation error

If the CI schema validation step fails, validate locally to get a clear error
message:

```bash
npx ajv-cli validate \
  -s packages/shared-config/rbac/rbac-group-permissions.schema.json \
  -d packages/shared-config/rbac/rbac-group-permissions.json
```

Fix the JSON and re-push.

### Integration tests timing out

Testcontainers requires Docker to be running and to have permission to pull
images. If tests time out on the first run, Docker may still be pulling the
`postgres:16-alpine` image. Run once manually to pre-pull:

```bash
docker pull postgres:16-alpine
```

### Environment variable not picked up

Changes to `.env.local` require restarting the API process. Kill the running
`start:dev` process and restart it.
