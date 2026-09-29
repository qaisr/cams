---
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# /demo — Run CANS Platform Demo

Runs the CANS platform auth + health demo using Playwright.

## Pre-flight Check (automatic)

Before the browser opens, the demo runs a pre-flight check against three services:

| Service | Address |
| --- | --- |
| PostgreSQL | localhost:5432 |
| Backend API | localhost:3001/health |
| Frontend | localhost:3000 |

If any service is not reachable, the demo **pauses** and prints a report:

```
❌  PostgreSQL (localhost:5432)
       → run: pnpm infra:up
❌  Backend API  (localhost:3001)
       → run: pnpm --filter @repo/api start:dev
✅  Frontend     (localhost:3000)

Start the missing services, then press Enter to retry…
```

Start the missing services in separate terminals, then press **Enter** to re-check.
The demo only proceeds once all three services pass. There is no timeout — it waits indefinitely.

## Pre-requisites

- Database + LocalStack: `pnpm infra:up`
- Backend: `pnpm --filter @repo/api start:dev`
- Frontend: `pnpm --filter @repo/web dev`  (or `pnpm start` to run both)

## Commands

```bash
# Run at normal speed (1.0x)
pnpm demo

# Run at half speed (0.5x — better for presentations)
DEMO_SPEED=0.5 pnpm demo

# Run at slow speed (0.3x — detailed walkthrough)
DEMO_SPEED=0.3 pnpm demo
```

## Pause / Resume

During the demo, a **⏸ Pause Demo** button is displayed in the top-right corner.
Click it to pause; click **▶ Resume Demo** to continue.

## What the Demo Covers

The CANS platform ships auth, RBAC, and a health check only — application features
are added per project. The demo walks the built-in foundation:

1. Mock Login (`/login-mock`) — sign in with a mock user for local dev
2. Protected Route (`/secure`) — auth guard redirect + authenticated content
3. Role & Permissions (`/role-permissions`) — RBAC groups, permission evaluation
4. Health Check (`/health`) — API liveness and readiness response

## Info Cards

Up to a handful of info cards appear at key demo moments. Cards show large,
readable text for the audience. Cards dismiss automatically before the next
interaction.
