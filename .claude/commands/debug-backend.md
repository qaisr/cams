---
description: Debug backend API issues with comprehensive logging and diagnostics
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# /debug-backend — NestJS API Debug Session

Deep debugging for a failing NestJS API endpoint on **port 3001** (the API
dev port — the older `8080` was wrong). For quick UI/URL triage use
`/diagnose-ui`; use this command when you need verbose logs and DB state for an
API-layer bug.

Follows the policy in **`.claude/workflows/runtime-diagnostics.md`**:
self-start & monitor, kill+restart only this repo's dev server on 3001, never
touch Postgres (5432) / LocalStack (4566), tear down after and hand back the
restart command.

## Usage

Provide a description of the issue you're debugging:

**Issue Description:** {{ISSUE_DESCRIPTION}}

## Process

### Step 1 — Confirm infra and port state

```bash
pnpm diagnose 3001                 # who owns 3001, and is it safe to restart?
docker compose -f docker/docker-compose.yml ps   # Postgres + LocalStack up?
```

If infra is down: `pnpm infra:up`. If 3001 is held by this repo's API, restart
it (Step 2). If held by another repo / unrelated process, STOP and ask.

### Step 2 — Start the API with verbose logging (background)

```bash
pnpm diagnose 3001 --kill          # only if this repo's API is already running
LOG_LEVEL=debug pnpm --filter @repo/api start:dev
```

Run it in the background and tail the log. Wait for the "Nest application
successfully started" line. Prisma query logging can be enabled via the Prisma
client `log` config if you need SQL-level detail.

### Step 3 — Reproduce the failing request

```bash
# public endpoint
curl -i "http://localhost:3001/<path>"

# protected endpoint (mock auth for local dev)
curl -i -H "Authorization: Bearer <mock-token>" "http://localhost:3001/<path>"
```

Capture the HTTP status, response body, and the corresponding server-log lines.

### Step 4 — Analyse against the failure taxonomy

| Signal | Likely cause | Next check |
| --- | --- | --- |
| 500 + stack trace | Unhandled service error | Read the stack in the tailed log |
| Prisma `P20xx` / `P10xx` | DB down / schema drift / bad query | `pnpm db:migrate`; look up the Prisma error code |
| 422 + Zod issues array | DTO validation failed | Compare payload to the schema in `@repo/validation` |
| 401 Unauthorized | JWKS / bad token / missing `@Public()` | PingID env vars; route guard config |
| Connection refused | API not started / wrong port | Re-check Step 2 log for the ready line |

### Step 5 — Fix and re-verify

Apply the minimal fix, then re-run the same `curl` and confirm the expected
status/body and a clean log.

### Step 6 — Teardown

Stop the API you started and tell the user:

> Stopped the API I started for debugging. To run it again:
> `pnpm --filter @repo/api start:dev`

Leave Postgres/LocalStack running as-is.

## Related

- `.claude/workflows/runtime-diagnostics.md` — full diagnostics procedure
- `/diagnose-ui` — URL-based triage (web / Storybook / API)
- `pnpm diagnose` — port ownership + safe-kill helper
