# UI DEVELOPMENT PROTOCOL: Every UI change MUST follow this workflow

> **Operating Discipline (always applies).** Follow `@.claude/CLAUDE.md` → Operating Discipline throughout this workflow: never hallucinate paths/APIs/versions, never assume intent to fill a gap, never implement unrequested scope, clarify ambiguities before acting, and get **explicit human approval** before anything hard-to-reverse or beyond the stated request. Report faithfully what was done, skipped, or failed.


When implementing ANY UI feature or fixing ANY UI bug, you MUST:

## 0. Wireframe gate (before any implementation)

If `.claude/wireframes/` contains files, read `.claude/wireframes/.generated-manifest.json` first,
then apply **Wireframe Precedence** — the canonical rule in
`@.claude/standards/component-usage.md#wireframe-precedence-canonical` (page/layout wireframes lead;
`converted` component/pattern wireframes carry equal weight with the generated component; no manifest
entry → wireframe is a mandatory input).

Protocol enforcement: this gate is mandatory for full-screen work — do NOT skip it for "small UI
tweaks", and inspect the relevant wireframe(s) even if `/wireframes-to-components` has already run.

In all branches:

- Read **UI Library** from `.claude/CLAUDE.md` Critical Constraints.
- If wireframe library/styling differs from the configured UI library, convert implementation to
  configured constraints while preserving wireframe layout, hierarchy, spacing, states, and
  interactions.

## 1. Ensure dev server is running

```bash
# Check if already running
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

# If not 200, start it (in background)
# IMPORTANT: use `pnpm start`, NOT `pnpm dev`
pnpm start &

# Wait for it to be ready
npx wait-on http://localhost:3000 --timeout 30000
```

> **Why `pnpm start` and not `pnpm dev`?**
> `pnpm start` is required for UI inspection and testing of protected pages.
> In local environment `NODE_ENV` is set to `development`, which runs the backend locally.

## 1a. Recovery: login failures or API not responding

If you encounter a login failure, authentication redirect not working, or API calls failing (network errors, `ECONNREFUSED`, or the app not redirecting to `/secure` after login), **retry once** using the full reset procedure below before diagnosing further.

> **Root cause**: Running only `pnpm --filter @repo/web start` starts the frontend only. The backend on port 3001 will not be running, causing all API calls to fail silently or with network errors.

```bash
# Step 1 — Kill both ports
kill -9 $(lsof -ti :3000) 2>/dev/null; kill -9 $(lsof -ti :3001) 2>/dev/null

# Step 2 — Wait for ports to be released
sleep 2

# Step 3 — Start BOTH frontend and backend together
# CRITICAL: use `pnpm start` — NOT `pnpm --filter @repo/web start`
# `pnpm start` starts the full stack (frontend on :3000 + backend on :3001)
pnpm start &

# Step 4 — Wait for both to be ready
npx wait-on http://localhost:3000 http://localhost:3001/health --timeout 60000
```

After this reset, retry the mock auth flow from Section 1b before proceeding.

## 1b. Accessing Protected Pages (Mock Auth)

All application routes are protected by PingID/MFA. To access them locally, you MUST authenticate
via the mock login page first. Do NOT attempt to navigate directly to a protected route — you will
be redirected to `/login` and the page will not load.

### Mock auth protocol (use this every time before inspecting a protected page)

**Step 1** — Confirm the app is started with `pnpm start` (see Section 1 above).

**Step 2** — Local `NODE_ENV=development` uses local backend — no live API calls.

**Step 3** — Navigate to the mock login page (NOT `/login`):

```json
// .claude/browser-actions.json
[
  {
    "type": "navigate",
    "url": "http://localhost:3000/login-mock",
    "description": "Navigate to mock login page"
  },
  {
    "type": "screenshot",
    "description": "Verify mock login page loaded — should show a list of users/roles"
  }
]
```

**Step 4** — Click a user/role. Use **Superadmin** when you need full access:

```json
// .claude/browser-actions.json
[
  {
    "type": "navigate",
    "url": "http://localhost:3000/login-mock",
    "description": "Navigate to mock login page"
  },
  {
    "type": "click",
    "selector": "text=Superadmin",
    "description": "Click Superadmin user to authenticate with full access"
  },
  {
    "type": "wait",
    "duration": 2000,
    "description": "Wait for auth redirect"
  },
  {
    "type": "screenshot",
    "description": "Verify redirect to /secure confirms successful login"
  }
]
```

**VERIFY_LOGIN_SUCCESS** — successful login redirects to `http://localhost:3000/secure`.
If the page does NOT redirect to `/secure`, authentication failed — do not proceed.

**Step 5** — After successful auth, navigate to the target protected page in the same session:

```json
[
  { "type": "navigate", "url": "http://localhost:3000/login-mock", "description": "Mock login" },
  { "type": "click", "selector": "text=Superadmin", "description": "Authenticate as Superadmin" },
  { "type": "wait", "duration": 2000, "description": "Wait for auth redirect to /secure" },
  { "type": "navigate", "url": "http://localhost:3000/pipeline", "description": "Navigate to target page" },
  { "type": "screenshot", "description": "Capture target page" }
]
```

Replace `/pipeline` with the route you want to inspect.

### Available user roles on `/login-mock`

| Role | Access level |
| --- | --- |
| Superadmin | Full access — use for all general UI inspection |
| Other roles | Subset of permissions — use when testing role-specific behaviour |

## 1c. Clean up old browser reports

```bash
rm -rf tmp-playwright/browser-reports/*
```

This ensures each task starts with fresh inspection data and avoids confusion from stale reports.

## 2. Run browser inspection BEFORE making changes (to understand current state)

```bash
pnpm inspect:ui
# Read: tmp-playwright/browser-reports/summary.md
# Read: tmp-playwright/browser-reports/report.json
```

## 3. Make your code changes

## 4. Wait for Next.js hot reload\*\* (after saving file

```bash
sleep 3
```

## 5. Run browser inspection AFTER changes

```bash
pnpm inspect:ui
# Analyze summary.md and screenshot
```

## 6. Verify ALL of the following are clean:

- ✅ Zero console errors
- ✅ Zero console warnings (especially React warnings)
- ✅ Zero network failures (no 4xx/5xx API calls)
- ✅ Screenshot shows expected UI
- ✅ No hydration errors in console

## 7. If issues found → diagnose and fix → repeat from step 3

Do NOT ask the user to check the browser. You check it yourself.

### For Specific Routes

```bash
# Inspect a specific page
pnpm inspect:ui http://localhost:3000/dashboard
pnpm inspect:ui http://localhost:3000/settings

# Inspect with authentication (add auth token to localStorage first via an interaction script)
```

### For Interactive UI Testing

When you need to test user flows (forms, navigation, modals, etc.):

1. Create an actions file:

```json
// .claude/browser-actions.json
[
  {
    "type": "navigate",
    "url": "http://localhost:3000/login-mock",
    "description": "Navigate to mock login page (NOT /login — all routes are PingID protected)"
  },
  {
    "type": "click",
    "selector": "text=Superadmin",
    "description": "Authenticate as Superadmin (full access)"
  },
  {
    "type": "wait",
    "duration": 2000,
    "description": "Wait for redirect to /secure (confirms successful login)"
  },
  {
    "type": "navigate",
    "url": "http://localhost:3000/pipeline",
    "description": "Navigate to target protected page"
  },
  {
    "type": "screenshot",
    "description": "Capture post-auth page state"
  }
]
```

2. Run it:

   ```bash
   pnpm interact:ui
   # Read: tmp-playwright/browser-reports/interactions/summary.md
   # Check each step screenshot
   ```

### Reading Browser Reports

After running inspection, ALWAYS read these files:

```bash
cat tmp-playwright/browser-reports/summary.md
```

Pay special attention to:

- **Console Errors section**: These are bugs that MUST be fixed
- **Network Failures section**: These indicate API/backend issues
- **The screenshot**: Visually verify the UI looks correct

---

## ── APPLICATION LOGS PROTOCOL ────────────────────────────────────

### Always check logs when diagnosing issues

**Next.js (Frontend) logs:**

```bash
# Dev server output is in terminal - check for:
# - Build errors
# - SSR errors
# - API route errors
```

**NestJS (Backend) logs:**

```bash
# If running separately
cat logs/app.log | tail -100
# Or check the terminal running NestJS
```

**Combined startup for debugging:**

```bash
# Start both with log capture
pnpm dev 2>&1 | tee .claude/logs/nextjs.log &
# In apps/api:
pnpm start:dev 2>&1 | tee .claude/logs/nestjs.log &
```

---

## ── DEBUGGING DECISION TREE ──────────────────────────────────────

When the user reports a UI issue:

```
User reports UI issue
        │
        ▼
Login fails OR API not responding?
        │
        ├─→ YES → Full stack reset (Section 1a):
        │           kill :3000 + :3001 → pnpm start → retry mock auth
        │           If still failing → diagnose below
        │
        ▼
Run: pnpm inspect:ui [url]
        │
        ├─→ Console errors found?
        │         │
        │         └─→ Read error + stack trace → fix the code
        │
        ├─→ Network failures found?
        │         │
        │         ├─→ ECONNREFUSED :3001? → backend not running
        │         │       Kill both ports → run `pnpm start` (not filter command)
        │         │
        │         └─→ Other API errors → Check NestJS logs → fix API/backend
        │
        ├─→ Screenshot looks wrong?
        │         │
        │         └─→ Check HTML snapshot in report.json
        │             Look at component structure
        │             Check CSS/Tailwind classes
        │
        └─→ Issue is interactive (needs click/form)?
                  │
                  └─→ Create browser-actions.json
                      Run: pnpm interact:ui
                      Analyze step screenshots
```

---

## ── CODE STANDARDS ───────────────────────────────────────────────

### TypeScript

- Strict mode enabled — no `any` types
- All functions must have explicit return types
- Use `interface` for object shapes, `type` for unions/intersections

### Next.js

- App Router only (no Pages Router)
- Server Components by default
- `'use client'` only when needed (event handlers, hooks, browser APIs)
- Always handle loading and error states

### NestJS

- Dependency injection always
- DTOs with class-validator for all inputs
- Swagger decorators on all endpoints

### File Structure

```
apps/
  web/          # Next.js app
    app/        # App Router pages
    components/ # React components
    lib/        # Utilities
  api/          # NestJS app
    src/
      modules/  # Feature modules
packages/       # Shared packages
scripts/        # Automation scripts (browser inspection, etc.)
.claude/
  CLAUDE.md     # This file
  browser-reports/  # Auto-generated, gitignored
  logs/             # Auto-generated, gitignored
```

### Testing

- Run `pnpm test` after significant changes
- E2E: Playwright tests in `e2e/` directory

---

## ── DEFINITION OF DONE (UI Tasks) ─────────────────────────────────────

> **Load and apply `@.claude/docs/definition-of-done.md` §1** for the full UI DoD checklist.
> A UI task, epic, or story is **not complete** until ALL items in §1 are satisfied.
> Unload `definition-of-done.md` after verification is complete.

Key gates (summary):
- UI protocol: browser inspection clean (zero errors, zero network failures, screenshot verified)
- Accessibility: WCAG 2.1 AA — aria attributes, keyboard navigation, focus indicators
- Tests: component unit tests (RTL + MSW, all states) + Playwright E2E (happy path, error, auth guard)
- Code quality: `pnpm lint` zero warnings, `pnpm type-check` zero errors

See: `@.claude/docs/definition-of-done.md` §1–§7 for full checklists, UI/UX best practices, navigation, pagination, accessibility, and testability standards.

---

## ── COMMON PITFALLS ──────────────────────────────────────────────

- **Hydration errors**: Usually caused by `'use client'` missing,
  or using `Math.random()`/`Date.now()` in render without
  `useEffect`. Check console errors in browser report.

- **CORS errors**: Check NestJS CORS config, verify API URL
  in `.env.local` matches running port

- **401/403 errors**: Check auth middleware in NestJS,
  verify JWT token is being sent in requests (check cookies/
  localStorage in browser report)

- **Component not updating**: Check if state mutation vs. new
  object reference is the issue

- **Build passes but runtime fails**: Always run `pnpm inspect:ui`
  — build TypeScript errors ≠ runtime browser errors

---

## ── GIT CONVENTIONS ──────────────────────────────────────────────

```
feat(scope): description
fix(scope): description
refactor(scope): description
```

Never commit `tmp-playwright/browser-reports/` or `.claude/logs/`

## Token Optimization

- **Load when**: ANY UI change — pages, components, forms, theme, layout. Mandatory per `.claude/CLAUDE.md`.
- **Load only**: this workflow + `ui-design-standards.md` + `accessibility-standards.md` + `component-usage.md`. Skip backend standards entirely.
- **Unload after**: UI change merged with browser-clean console, component tests passing, Playwright E2E green.
- **Hand-off to**: `accessibility-auditor` for full WCAG audit (when scope warrants), `test-engineer` for missing coverage.
