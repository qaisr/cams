# Runtime Diagnostics Workflow

**Purpose:** A repeatable procedure for diagnosing a *running-app* problem the
user reports by URL — a blank screen, a render/console error, a broken page, or
a failing API endpoint. Applies to the Next.js web app (`:3000`), NestJS
API (`:3001`), and Storybook (`:6006`).

**Invoke this workflow when** the user says things like:

- "I see a blank screen at `<url>`"
- "There's an error on `<url>`"
- "The `/login` page is broken" / "the page won't load"
- "Something's wrong at `localhost:6006/?path=...`"
- Any report of runtime misbehaviour tied to a URL or a dev port.

> This is a **diagnosis** procedure, not a feature-build. Do NOT jump to editing
> source before you have captured evidence from the running app.

---

## Confirmed operating policy (do not deviate without asking)

| Decision | Rule |
| --- | --- |
| **Server control** | Self-start & monitor. Claude starts the server in the background and tails its logs. |
| **Stale server** | Always **kill + restart** the target dev port to guarantee a fresh module graph — never trust a long-running dev server as the source of truth. |
| **Kill scope** | Only kill a **known dev server** (next / nest / storybook / node) whose process **belongs to THIS repo** (the current working directory). Killable dev ports: **3000, 3001, 5000, 6006, 8080**. |
| **Never kill** | Infra ports **5432** (Postgres) and **4566** (LocalStack) — managed via `pnpm infra:up/down`. Processes belonging to **another repo**. Any **unrelated/unknown** process. In these cases: STOP and ask the user. |
| **Browser mode** | Headless by default. Use `--headed` only when the user wants to watch. |
| **Teardown** | After diagnosis, **shut down the server(s) Claude started**, tell the user it was stopped, and give the exact commands to bring it back up. |

---

## Step 1 — Triage the URL → surface type

Parse the URL to decide what you're looking at:

| URL shape | Surface | Port |
| --- | --- | --- |
| `localhost:3000/...` | Next.js page | 3000 |
| `localhost:3001/...` or `/api/...` | NestJS endpoint | 3001 |
| `localhost:6006/?path=/docs/...` | Storybook docs (MDX) | 6006 |
| `localhost:6006/?path=/story/...` | Storybook story | 6006 |

Storybook docs/stories render inside an **iframe** (`#storybook-preview-iframe`)
— top-level console capture misses them; use the iframe-aware inspector.

## Step 2 — Confirm server state (never assume)

```bash
pnpm diagnose "<url>"          # read-only: who owns the port, and is it safe to kill?
```

Interpret the `classification`:

- `free` → nothing running; go to Step 3 and start it.
- `known-this-repo` → our dev server; go to Step 3 to kill+restart.
- `known-other-repo` → **STOP and ask.** Tell the user the port is held by a dev
  server from **another project** (name the repo path + PID), then offer these
  three choices and wait for their answer:
  1. **Kill it for them** → re-run `pnpm diagnose "<url>" --force-kill`, then
     start this repo's server on that port.
  2. **They kill it themselves** → give them the exact command
     (`kill <pid>`) to run via the `!` prefix, then continue once it's free.
  3. **Use another port** → start this repo's server on a different port and
     inspect that URL instead.
  Never `--force-kill` without the user explicitly choosing option 1.
- `infra` → **STOP.** Postgres/LocalStack — never touch (manage via `pnpm infra:up/down`).
- `unrelated` → **STOP.** Report the process; ask before doing anything. Do not
  offer to kill an unrelated (non dev-server) process.

## Step 3 — Ensure a fresh server (kill + restart)

Only for `free` or `known-this-repo`:

```bash
pnpm diagnose "<url>" --kill   # kills only this-repo dev servers on killable ports
```

Then start the correct service in the **background** and tail its logs so you
can watch startup + request-time errors:

| Surface | Start command | Notes |
| --- | --- | --- |
| web | `pnpm --filter @repo/web dev` | port 3000 |
| api | `pnpm --filter @repo/api start:dev` | port 3001; needs `pnpm infra:up` + DB |
| storybook | `pnpm sb` | port 6006 |

For Storybook specifically, a stale Vite cache is the most common cause of
"Failed to fetch dynamically imported module" / "Invalid or unexpected token".
Clear it before restart:

```bash
rm -rf apps/web/node_modules/.cache/storybook apps/web/node_modules/.vite
```

Wait for the "ready"/"compiled" line in the tailed log before inspecting.

## Step 4 — Capture evidence from the running app

**UI surfaces (web page or Storybook):**

```bash
pnpm inspect:ui "<url>"        # headless; writes .claude/browser-reports/summary.md
# add --headed to watch the browser
```

Then read `.claude/browser-reports/summary.md` — it contains console errors
(incl. iframe errors for Storybook), network failures (incl. 404'd dynamic
imports and failed requests), the screenshot, and performance metrics.

**API endpoints:** hit the endpoint directly and read the server log you're
tailing:

```bash
curl -i "http://localhost:3001/<path>"                 # public endpoint
curl -i -H "Authorization: Bearer <mock-token>" "..."  # protected endpoint
```

For a full backend debug session (verbose logging, DB state), use
`/debug-backend`.

## Step 5 — Root-cause with stack-specific heuristics

### Next.js (`:3000`)

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| Blank white screen, no HTML | JS error before React mounts | `consoleErrors` in report; check the failing chunk |
| "Hydration failed" / text mismatch | Server/client render divergence | Non-deterministic render (`Date`, `Math.random`, `window` at module scope) |
| "useX is not a function" from a generated hook | orval hooks out of sync with spec | Re-run `pnpm generate`; never hand-edit `hooks/generated/` |
| 404 on `/_next/static/...chunk.js` | Stale `.next` build | `rm -rf apps/web/.next` and restart |
| 401 on API calls from the page | Auth/JWKS or missing mock token | Check `MOCK_AUTH_ENABLED`, PingID config |

### NestJS (`:3001`)

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| 500 + stack trace | Unhandled service error | Tailed server log stack trace |
| Prisma `P20xx`/`P10xx` error | DB not up / schema drift / bad query | `pnpm infra:up`, `pnpm db:migrate`; check the Prisma error code |
| 422 with Zod issues array | Request failed DTO validation | Compare payload to the Zod schema in `@repo/validation` |
| 401 Unauthorized | JWKS fetch failure / bad token | PingID env vars; `@Public()` on the route? |
| Startup crash | NestJS module wiring / Fastify bootstrap error | Tailed server log; `apps/api/src/main.ts` |

### Storybook (`:6006`)

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| "Failed to fetch dynamically imported module: .../X.mdx" | **Stale Vite/Storybook cache** — index references a module path the transform layer no longer serves | Clear cache + restart (Step 3). Confirm with `curl -o /dev/null -w "%{http_code}" http://localhost:6006/<module-path>` → 404 proves it |
| "Invalid or unexpected token" on every docs page | Corrupt/partial chunk from the same stale cache, OR a real syntax error in one shared MDX/preview file | If cache clear fixes it → it was stale. If it persists → inspect `.storybook/preview.tsx` and each `*.mdx` for a genuine syntax error |
| Story renders blank | Missing default export / broken decorator in `.storybook/preview.tsx` | Check the story's `export default` and preview decorators |
| Addon panel error | Addon version mismatch | Check `.storybook/main.ts` addon versions |

> **Prove stale-cache before assuming it.** `index.json` returning 200 while the
> module URL returns 404 is the definitive signature (the server knows the story
> but can't serve its module).

### orval / codegen drift (affects web)

If generated hooks or MSW handlers look wrong, the fix is upstream: edit
`schema.prisma` → `pnpm generate`. Never edit `*/generated/`.

## Step 6 — Fix, then re-verify

Apply the smallest fix that addresses the root cause. Then **re-run the
inspection** (Step 4) against the same URL and confirm the error is gone before
declaring success. For UI, confirm the screenshot renders the expected content,
not just an absence of console errors.

## Step 7 — Teardown & hand back

Shut down any server **you** started, then tell the user plainly:

> Stopped the `<service>` I started for diagnosis. To run it again yourself:
> `<start command>`

Use the `!` prefix hint if the user should run something interactive
themselves. Leave infra (Postgres/LocalStack) as you found it.

---

## Related

- `/diagnose-ui <url>` — user-facing entry point to this workflow
- `/debug-backend` — deep NestJS debug session (verbose logs, DB state)
- `scripts/diagnose-runtime.ts` — port ownership + safe-kill helper (`pnpm diagnose`)
- `scripts/browser-inspect.ts` — headless browser evidence capture (`pnpm inspect:ui`)
- `.claude/workflows/local-runtime-modes.md` — how the app runs locally
