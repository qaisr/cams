# Preflight Checks Workflow

> Run before any integration tests, API tests, or E2E tests.
> Fail fast — do not waste time on tests against unavailable services.

## Services and Checks

| Service | Address | Check Type | Required For |
|---|---|---|---|
| PostgreSQL | `localhost:5432` | TCP connection | Integration tests |
| Backend API | `localhost:3001/health` | HTTP GET 200 | API tests, E2E |
| Frontend | `localhost:3000` | HTTP GET 200 | E2E only |
| LocalStack | `localhost:4566/_localstack/health` | HTTP GET | Tests using AWS |

## Environment: NODE_ENV=development

When `NODE_ENV=development`:
- `MOCK_AUTH_ENABLED=true` → auth guard uses mock tokens
- `LOCALSTACK_ENDPOINT=http://localhost:4566` → AWS calls go to LocalStack
- `DATABASE_URL` → points to local Docker Postgres
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`

## How to Run

```bash
# Run all preflight checks
pnpm test:preflight

# Run checks for specific test type
pnpm test:preflight --scope=integration   # Postgres only
pnpm test:preflight --scope=api           # Postgres + API
pnpm test:preflight --scope=e2e           # Postgres + API + Frontend
```

## Pre-Flight Script

See `scripts/preflight-check.ts` — script implementation.

## What Happens on Failure

```
✅ PostgreSQL     localhost:5432        — Connected
✅ Backend API    localhost:3001/health — 200 OK
❌ Frontend       localhost:3000        — Connection refused

PREFLIGHT FAILED
  Frontend is not running.
  Start it with: pnpm --filter @repo/web dev
  Then re-run: pnpm test:preflight --scope=e2e

Aborting test run.
```

Tests do NOT run when preflight fails. This prevents misleading
test failures caused by missing infrastructure, not test logic.

## Integration with Test Commands

```typescript
// apps/api/src/test/helpers/preflight.helper.ts
import { preflightCheck } from './preflight.helper';

beforeAll(async () => {
  await preflightCheck(['postgres', 'api']);
}, 10_000);
```

The `preflightCheck` helper throws a descriptive error if any
service is unavailable, which aborts the test suite cleanly.

## Docker Compose Quick Start (local dev)

```bash
# Start all local services
docker compose -f docker/docker-compose.yml up -d

# Verify
pnpm test:preflight --scope=e2e
```

## Token Optimization

- **Load when**: BEFORE running integration, API contract, or E2E tests on a fresh shell.
- **Load only**: this workflow. No standards needed — it's a service-readiness gate.
- **Unload after**: services verified ready. The single result line is sufficient context for the test run.
