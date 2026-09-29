# PPCC Enterprise AI Framework

## Purpose

Full-cycle AI-driven development framework.
**NextJS 16** (App Router, CSR default) + **NestJS 11 / TypeScript** (Fargate behind an internal ALB, Fastify adapter) + **AWS CDK v2** infrastructure.

> Authoritative stack versions live in the project-root `CLAUDE.md` (generated from `package.json`). This file states the framework rules; defer to project-root `CLAUDE.md` for exact semver pins.
**@tanstack/react-query** + **orval** — typed API hooks generated from OpenAPI spec (never written manually).
**Monorepo** with pnpm workspaces + Turborepo.
**Prisma-first** with auto-generated Zod schemas, OpenAPI spec, and React Query hooks.

---

## CANS — Pre-Built Foundation

**This repository is a production-ready CANS platform.** The features below are **already implemented and tested** — do NOT create epics to rebuild them. Begin your project directly with `/create-specifications` or `/add-feature` for application-specific features.

> Detailed reference: `.claude/project-features.md` (lazy-load when auditing scope or onboarding a new team)

| Built-In Feature | Notes |
| --- | --- |
| Monorepo (pnpm workspaces + Turborepo) | `build`, `test`, `lint`, `generate` pipeline wired |
| CDK v2 infrastructure stacks | Internal ALB + Fargate service, RDS Multi-AZ + RDS Proxy, EventBridge, Secrets Manager |
| Docker Compose + LocalStack | PostgreSQL (5432) + LocalStack (4566); `pnpm infra:up/down` |
| PostgreSQL + Prisma ORM | Schema, migrations, seed data, connection-safe singleton client |
| Code generation pipeline | Prisma → Zod → OpenAPI → orval React Query hooks; run `pnpm generate` |
| PingID authentication (backend) | RS256/JWKS strategy, mock auth for local dev, `@Public()` decorator |
| RBAC authorization engine | `@RequirePermissions()` guard, 5-group JSON config, deny-precedence |
| Frontend auth pages | `/login`, `/login-mock`, `/secure`, `/role-permissions`, protected layout |
| Storybook UI component library | Full component library under `apps/web/src/components/` |
| Integration tests (TestContainers) | 11 tests: health, mock login, permissions |
| Husky pre-commit hooks | lint-staged, conventional commits, type-check on push |
| GitHub Actions CI/CD | Lint, type-check, unit tests, build, RBAC schema validation |

**First-time local setup** → run `/infra-setup` to validate and auto-fix the environment (see `docs/getting-started.md`).
**Infrastructure code review** → use `/infra-review`.

**Using a different tech stack?** Use `/initialize` to onboard an existing codebase onto this framework, or `/migrate-claude-framework` to migrate the framework itself to a different stack.

---

## Context Discipline

Framework usage must stay lean and scoped:

1. Load only the standards/docs/specs needed for the current subtask.
2. For large spec docs, extract the scoped slice you need rather than carrying the whole document.
3. Unload unrelated agents, standards, and workflow docs after each step.
4. Keep only a compact progress summary when moving to the next phase.
5. Re-load broader context only for planning, risk review, or architecture changes.

Token optimization protocol:

- Planning/design: use the detailed spec documents and architecture references.
- Build/test/fix: extract the relevant slice from the detailed specs + task-relevant standards only.
- Quality gate: load only the standards tied to the gate category.
- **Generation (specs, epics, tasks, stories, RTM): rules above are RELAXED — load source documents in full, do not summarise or truncate inputs, and produce complete generated artifacts. See the Generation Phase Exception in `@.claude/docs/context-optimization.md`.**

Load/unload quick guidance: `@.claude/docs/context-optimization.md`

## MCP Servers (Query Before Generating PPCC-Specific Code)

```json
{
  "ceb": { "type": "http", "url": "https://ceb.ppcc/mcp" },
  "context7": { "type": "http", "url": "https://mcp.context7.com/mcp" },
  "playwright": { "type": "stdio", "command": "npx",
    "args": [ "-y", "@playwright/mcp@latest" ],
    "env": {}
  }

}
```

- **CEB MCP**: PPCC engineering standards, security, infra, PingID patterns
- **Context7 MCP**: General framework/library docs and examples (NextJS, NestJS, React, TanStack Query, React Hook Form, Zod, Playwright)
- **Playwright MCP**: Playwright MCP Server

### Web Search — HARD RULE

> **The built-in `WebSearch` tool DOES NOT WORK in this environment and MUST NEVER be used.** Any attempt will be rejected.
>
> When public web content is needed (documentation, research, articles, release notes, external references), fetch it with **`curl`** via the `Bash` tool instead — e.g. `curl -sL "<url>"` (add `-A "Mozilla/5.0"` when a site blocks default agents, and pipe through a text extractor when helpful). For a single known URL, `WebFetch` is also acceptable. For open-ended research where the URL is unknown, use `curl` against a search endpoint or known documentation sites. **Never call `WebSearch`.**

---

## JIRA / Confluence / Figma MCP — Access Control Policy

> **CRITICAL: These MCP servers are context-heavy and must NEVER be called automatically during development commands. They are gated behind explicit user intent.**

### When MCP calls ARE permitted

| Trigger | Permitted tools |
| --- | --- |
| User runs `/jira` or any `/jira-*` command | Atlassian MCP (JIRA tools only) |
| User runs `/confluence` or any `/confluence-*` command | Atlassian MCP (Confluence tools only) |
| User runs `/figma` or any Figma-related command | Figma MCP |
| User explicitly asks a JIRA question in natural language (e.g. "what are my open tickets?") | Atlassian MCP (JIRA), after confirming intent |
| User explicitly asks a Confluence question in natural language (e.g. "find the auth design page") | Atlassian MCP (Confluence), after confirming intent |
| User explicitly asks about a Figma design in natural language | Figma MCP, after confirming intent |

### When MCP calls are FORBIDDEN — Hard Stops

The following commands and workflows **MUST NEVER** call JIRA, Confluence, or Figma MCP tools — not even once, not even as a "helpful enrichment":

- `/create-specifications` and all spec-generation variants
- `/create-epics`, `/create-epic-tasks`
- `/implement-epic`, `/add-feature`, `/add-feature-simple`
- `/add-endpoint`, `/add-component`, `/add-e2e-test`, `/add-unit-test`, `/add-integration-test`
- Any implementation, refactor, test, or build command
- Any agent invoked during the above (backend-engineer, frontend-developer, test-strategist, etc.)

These commands consume **local mirrors only** (`jira/`, `confluence/`, `figma/` folders on disk) as read-only requirement sources. They never refresh, pull, or query the remote systems.

### User-approval gate for natural-language triggers

When the user asks a natural-language question that *could* be answered by calling JIRA or Confluence MCP:

1. **Confirm intent explicitly** before making any MCP call: *"This would call the live JIRA/Confluence API. Proceed?"*
2. **Each MCP call** within a session requires its own approval — a prior approval does not carry forward.
3. If the local mirror (`jira/_index.json` or `confluence/_index.json`) can answer the question, **prefer the mirror** and skip the MCP call entirely.

### Local mirror vs. remote MCP — the decision rule

```
Can the local mirror answer the question?
  YES → read from mirror (jira/_index.json, confluence pages, figma files on disk)
  NO  → ask user approval, then call MCP
```

Mirror is stale (>24h) and question requires fresh data → notify user of staleness, offer to run `/jira-sync` or `/confluence pull`, and wait for their decision before calling MCP.

---

## Operating Discipline (Always Apply — every agent, command, and skill)

These rules are **non-negotiable** and apply to every agent, command, workflow, and skill in this framework, regardless of its model or effort tier. Higher-capability models do NOT get more latitude here — capability raises the bar for rigor, it does not license improvisation.

1. **Never hallucinate.** Do not invent file paths, APIs, function names, config keys, ticket IDs, versions, or facts. If you have not verified something by reading it (file, tool output, docs), treat it as unknown. Cite what you actually observed. When unsure, say so plainly rather than guessing.
2. **Never assume.** Do not fill requirement gaps with your own best-guess intent. If a request is ambiguous, underspecified, or silent on something that changes the outcome, **stop and ask** — surface the gap as an explicit clarifying question (multi-choice where possible). A named assumption you proceeded on without approval is a defect.
3. **Never implement unrequested scope.** Build exactly what was asked — no bonus features, no "while I'm here" refactors, no speculative abstractions, no extra files. If you believe additional work is warranted, **propose it and get explicit human approval before doing it.**
4. **Always clarify gaps and uncertainties.** When you encounter conflicting instructions, missing context, or a fork where reasonable engineers would differ, pause and get a human decision. Prefer one good clarifying question over a wrong implementation.
5. **Get human approval for anything hard to reverse or out of scope.** Destructive actions, external/outward-facing effects, deleting or overwriting work you did not create, and any deviation from the stated request require explicit sign-off first. Approval in one context does not carry to the next.
6. **Report faithfully.** State what you did, what you skipped, and what failed — with evidence. Do not claim completion or verification you did not perform. If tests fail, say so and show the output.

> These restate and reinforce the harness-level rules; where any command or agent adds its own gates (e.g. ambiguity review, dry-run-first mutation, human `[Apply/Reject]` prompts), those are **in addition** to this discipline, never a substitute for it.

## Critical Constraints (Always Apply)

| Constraint | Rule |
| --- | --- |
| **Operating Discipline** | Never hallucinate, never assume, never implement unrequested scope. Clarify gaps and get explicit human approval before acting on anything unrequested, ambiguous, or hard to reverse. See **Operating Discipline** section above. |
| **Project Structure** | ALWAYS read `@.claude/project-structure.md` BEFORE any file operations or directory navigation to avoid token waste on failed attempts |
| **Monorepo** | pnpm workspaces + Turborepo — apps/, packages/, infra/ |
| **Dependency Versions** | ALWAYS install the latest stable version of any new npm package. Use `pnpm add <pkg>@latest` (or `-D @latest` for dev deps) — NEVER `pnpm add <pkg>` without `@latest`, and NEVER hand-pick a version from memory. Before installing, verify the latest stable on the npm registry (`pnpm view <pkg> version` or `npm view <pkg> version`). Reject pre-release tags (`alpha`, `beta`, `rc`, `next`, `canary`) unless the user explicitly opts in. For pre-existing deps in `package.json`, do not silently downgrade. See `.claude/standards/monorepo-standards.md#dependency-installation`. |
| **OpenAPI First** | Edit the Prisma schema / Zod DTOs FIRST, then run `pnpm generate` to regenerate the OpenAPI spec and hooks |
| **Generated Code** | NEVER edit packages/api-spec/generated/ directly |
| **Frontend** | NextJS 16 App Router — **default to CSR** unless SSR specifically requested |
| **Backend** | NestJS 11 (Fastify adapter) — Fargate service behind an internal ALB. Batch/event work uses scheduled ECS Fargate tasks (EventBridge Scheduler → RunTask) or SQS-polling Fargate workers. RDS Proxy always used. |
| **HTTP Adapter** | `@nestjs/platform-fastify` — NEVER `@nestjs/platform-express`. Use `FastifyRequest`/`FastifyReply` types; reply is `.status().header().send()`, not `.setHeader().json()` |
| **Database** | PostgreSQL with Prisma Migrate; seed data in prisma/seed.ts |
| **ORM** | Prisma — schema is single source of truth for types, Zod schemas, and OpenAPI |
| **Zod OpenAPI** | `extendZodWithOpenApi(z)` is called **once** in `packages/validation/src/zod.ts`; all schema files import `z` from `'./zod'`, never from `'zod'` directly. See `.claude/patterns/zod-openapi-pattern.md`. |
| **API Hooks** | orval generates typed @tanstack/react-query hooks — NEVER write useQuery manually |
| **Generated** | NEVER edit hooks/generated/ or mocks/generated/ directly |
| **Infrastructure** | AWS CDK v2 TypeScript (NOT SAM) |
| **Authentication** | PingID only — never Cognito |
| **Network** | AWS DirectConnect — no public AWS endpoints |
| **UI Library** | Tailwind (layout) + Lumen (`@lumen/react`) components — NEVER DaisyUI |
| **Storybook Components** | **ALWAYS** check `apps/web/src/components/` before creating any UI component. If a suitable Storybook component exists, import and reuse it. Only create a new component when no equivalent exists. Prevents duplication and enforces consistency. See `.claude/standards/component-usage.md`. |
| **Logging** | Observe (business events) + CloudWatch (technical) |
| **All routes** | Protected — PingID/MFA required |
| **Secrets** | AWS Secrets Manager / Parameter Store only |
| **Local Dev** | Docker Compose + LocalStack for AWS services |
| **Testing** | TestContainers (backend) + MSW (frontend) + Playwright (E2E) |
| **ESLint Plugins** | `react`, `react-hooks`, `jsx-a11y`, `security` are non-negotiable. Never remove without user confirmation + documented reason. Restore after task complete. |
| **Framework Scope** | Local run/build/test only; deployment work is code/config readiness, not live deploy execution |
| **Dependency versions** | ALWAYS run `pnpm view <pkg> version` before writing a version to `package.json`. Never copy a version from memory, a template, or another file — it may be stale. Use `pnpm add <pkg>@latest` or resolve the current version first. Verify with `pnpm install` (no `ERR_PNPM_NO_MATCHING_VERSION`). See `@.claude/standards/monorepo-standards.md#dependency-installation-rules`. |

---

## Slash-Commands Reference

See `@.claude/docs/commands-reference.md` for the full command catalog.

Key entry points: `/add-feature` (new features), `/implement-epic` (epic delivery), `/create-specifications` (planning), `/infra-setup` (local dev).

---

## Lazy-Load Standards (Load Only When Relevant)

See `@.claude/docs/lazy-load-standards.md` for the full Task Type → Load File index, plus the CRITICAL load-order sequences (UI, best-practices/security/quality, testing) and the Context Compaction guidance.

Rule: load only the standards, patterns, agents, and workflow docs the current subtask needs; unload them once the phase is done.

---

## UI DEVELOPMENT PROTOCOL

### MANDATORY: Every UI change MUST follow this workflow

When implementing ANY UI feature or fixing ANY UI bug, you MUST FOLLOW `.claude/workflows/frontend-ui-protocol.md`.

Additional non-negotiable rules:

- ALWAYS check `apps/web/src/components/` first and reuse the existing Lumen-based Storybook component if one fits (see `@.claude/standards/component-usage.md`). Only author a new component when no equivalent exists, composing Lumen primitives (`@lumen/react`) — never DaisyUI classes.
- Design inputs come from Figma (via the `figma/` mirror, Phase 3+), not HTML wireframes. Preserve design intent while implementing with the configured **UI Library** (Tailwind for layout + Lumen for components).

### MANDATORY: Definition of Done

> Full DoD checklists (UI, backend, epic quality close, component, story, code quality, UI/UX standards) are in:
> **`@.claude/docs/definition-of-done.md`** — load it when verifying completion or generating task checklists.

Quick summary — no task is `complete` without:

- **UI scope**: UI protocol + accessibility + component tests + Playwright E2E + lint/type-check
- **Backend scope**: service unit tests + controller tests + integration tests (Testcontainers) + coverage thresholds
- **All changes**: `pnpm lint` zero warnings, `pnpm type-check` zero errors, tests pass

See: `@.claude/standards/testing-standards.md` — canonical testing rules for all layers.

---

## RUNTIME DIAGNOSTICS PROTOCOL

### MANDATORY: When the user reports a running-app problem by URL

When the user reports that a **running** page/endpoint is misbehaving — e.g.:

- "I go to `<url>` and see a blank screen"
- "There's an error on `<url>`" / "the `/login` page is broken"
- "`localhost:6006/?path=/docs/...` shows an error" / "the page won't load"
- any runtime misbehaviour tied to a URL or dev port

…you MUST diagnose against the **running app** (browser console, network,
screenshot, server logs) before editing source. Load and follow
**`@.claude/workflows/runtime-diagnostics.md`**, or run `/diagnose-ui <url>`.

Do NOT guess from source code alone, and do NOT start implementing a fix before
capturing evidence from the live app.

### Non-negotiable diagnostics policy

| Rule | Behaviour |
| --- | --- |
| **Server control** | Self-start & monitor — start the dev server in the background and tail its logs. |
| **Stale server** | Always **kill + restart** the target dev port for a fresh module graph (a stale long-running dev server is a top cause, esp. Storybook Vite cache). |
| **Kill scope** | Kill only a **known dev server** (next / nest / storybook / node) whose process belongs to **THIS repo**. Killable dev ports: **3000, 3001, 5000, 6006, 8080**. |
| **Another repo's server** | If a killable dev port is held by a dev server from **another project**, STOP and offer the user three choices: (1) Claude kills it (`pnpm diagnose --force-kill`), (2) the user kills it themselves (`kill <pid>`), or (3) use another port. Never force-kill without the user picking option 1. |
| **Never kill** | Ports **5432** (Postgres) / **4566** (LocalStack); any **unrelated** (non dev-server) process. STOP and ask. |
| **Browser mode** | Headless by default (`--headed` only when the user wants to watch). |
| **Teardown** | After diagnosis, shut down any server **you** started, inform the user, and give the exact command(s) to run it again. Leave infra as found. |

### Tooling

- `pnpm diagnose "<url>"` → port ownership + safe-kill check (`scripts/diagnose-runtime.ts`); add `--kill` to restart this-repo dev servers.
- `pnpm inspect:ui "<url>"` → headless browser evidence: console (incl. Storybook iframe), network failures, screenshot, perf (`scripts/browser-inspect.ts`).
- `/diagnose-ui <url>` → user-facing entry point. `/debug-backend` → deep NestJS session.

---

## Agent Roster

See `@.claude/docs/agent-roster.md` for the full roster (mode, purpose, and load file per agent).

Primary agents: `build`, `plan`. Subagents cover architecture, backend, frontend, database, testing, security, devops, requirements, accessibility, performance, integration, and the JIRA/Confluence/Figma helpers — load each agent's file only when its task type is active, and unload after.

---

## Templates Library

See `@.claude/docs/templates-reference.md`

---

## Pattern Library

See `@.claude/docs/patterns-reference.md`

---

## Workflow Library

See `@.claude/docs/workflows-reference.md`

---

## Development Workflows

See `@.claude/docs/development-workflows.md` for the Epic-Based, Existing-Project Onboarding, and Feature Development workflows.

Key entry points: `/create-specifications` → `/create-epics` → `/implement-epic` (or `/create-epic-tasks` for L/XL epics); `/add-feature` for new work; `/initialize` for onboarding an existing codebase.

---

## Project Structure

See `@.claude/project-structure.md`
