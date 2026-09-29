---
description: Diagnose a running-app problem by URL — blank screen, console/render error, broken page, or Storybook docs failure. Captures live browser + server evidence, root-causes, fixes, re-verifies, then tears down.
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# /diagnose-ui — Runtime Diagnostics by URL

## Purpose

Diagnose a problem the user reports against a **running** surface (Next.js page
`:3000`, NestJS endpoint `:3001`, or Storybook docs/story `:6006`) by looking at
the actual app — browser console, network activity, screenshots, and server
logs — rather than guessing from source.

## Usage

```
/diagnose-ui <url>
```

Examples:

- `/diagnose-ui http://localhost:6006/?path=/docs/documentation-designtokens`
- `/diagnose-ui http://localhost:3000/login`
- `/diagnose-ui http://localhost:3001/health`

If no URL is given, ask the user which URL is failing and what they see.

## What it does

Follows **`.claude/workflows/runtime-diagnostics.md`** end to end:

1. **Triage** the URL → surface type (web / API / Storybook).
2. **Confirm server state** — `pnpm diagnose "<url>"` (read-only port ownership check).
3. **Ensure a fresh server** — kill + restart the target dev port, but **only**
   when it is a known dev server belonging to THIS repo. Refuse and ask if the
   port is held by another repo, infra (Postgres/LocalStack), or an unrelated
   process. For Storybook, clear the Vite cache first.
4. **Capture evidence** — `pnpm inspect:ui "<url>"` (headless) for UI, or
   `curl` + tailed server log for API.
5. **Root-cause** using the stack-specific heuristics in the workflow
   (hydration, RSC/CSR, stale chunk 404, Prisma/Zod/JWKS errors, stale Storybook
   cache, orval drift).
6. **Fix** the smallest thing that addresses the root cause, then **re-verify**
   by re-inspecting the same URL.
7. **Teardown** — stop any server this command started and give the user the
   exact commands to run it again.

## Policy (see workflow for full detail)

- Self-start & monitor; always kill+restart the target port for a fresh module graph.
- Killable dev ports: 3000, 3001, 5000, 6006, 8080 — **only if the process belongs to this repo**.
- Never kill 5432 (Postgres) / 4566 (LocalStack) or an unrelated process — stop and ask.
- If another repo's dev server holds the port, offer three choices: Claude kills it (`--force-kill`), user kills it, or use another port. Only force-kill on explicit approval.
- Headless by default (`--headed` to watch).
- Tear down after diagnosis; hand the restart commands back to the user.

## Related

- `.claude/workflows/runtime-diagnostics.md` — the procedure this command runs
- `/debug-backend` — deep NestJS debug session
- `pnpm diagnose` / `pnpm inspect:ui` — the underlying helpers
