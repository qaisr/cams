# Feature Development Workflow

> **Operating Discipline (always applies).** Follow `@.claude/CLAUDE.md` → Operating Discipline throughout this workflow: never hallucinate paths/APIs/versions, never assume intent to fill a gap, never implement unrequested scope, clarify ambiguities before acting, and get **explicit human approval** before anything hard-to-reverse or beyond the stated request. Report faithfully what was done, skipped, or failed.


## Overview

End-to-end workflow from requirements to production-ready code.
Used by `/add-feature` command and referenced by all development agents.

**Related commands:**
- `/create-tasks` — generates sequenced, self-destructive task files for this workflow (recommended for medium/large features)
- `/ambiguity-analyst` (agent) — invoke before Phase 1 for any medium/high complexity feature to surface unclear requirements early
- `/implement-best-practices` — run after delivery to ensure new code meets quality standards

**Requirements phase agent:**
- Load `@.claude/agents/product-owner.md` during Phase 1 when requirements are incomplete, ambiguous, or need Gherkin story writing. Unload after acceptance criteria are confirmed.

## Workflow Phases

```

Phase 1: Understand  →  Phase 2: Design  →  Phase 3: Build  →  Phase 4: Verify  →  Phase 5: Ship

```

---

## Phase 1: Understand

### 1.1 Read Context (Always First)

**CRITICAL: Read `@.claude/project-structure.md` FIRST to understand directory structure before any file operations or navigation.**

```

1. Read business requirements: @specs/business-requirements.md
2. Read functional spec: @specs/functional-specifications.md
   (these detailed docs are the single source of truth; extract the scoped
   slice you need for this feature — running out of context is not a concern)
3. Find related stories: search .claude/docs/stories-*.md
4. Find related requirements: search .claude/docs/requirements-*.md
5. Scan codebase for related patterns:
   - Existing controllers: apps/api/src/
   - Existing pages: apps/web/src/app/
   - Existing migrations: apps/api/prisma/migrations/
   - OpenAPI specs: packages/api-spec/
   - Generated Zod schemas: packages/database/generated/zod/
6. Query CEB MCP: relevant PPCC standards for feature type
7. Read `@.claude/standards/architecture-design-standards.md`
8. If frontend work: read `@.claude/standards/ui-design-standards.md`
9. If frontend work: read `@.claude/standards/component-usage.md` — check existing Storybook library before creating components
10. If frontend work: read `@.claude/docs/component-library.md`
10. Query Context7 MCP (`https://mcp.context7.com/mcp`) for framework/library docs (NextJS/React/TanStack/Zod/RHF) when needed
11. Read `@.claude/docs/authorization-patterns-and-architecture.md` for role access model and guard patterns

```

### 1.2 Clarify Before Building

**Always confirm before writing code:**

- Acceptance criteria complete and agreed?
- DB schema changes understood?
- API contract agreed (new endpoints, request/response shapes)?
- Auth/permission requirements clear?
- Role model explicit? (default: all authenticated users can access pages/read operations unless explicitly restricted; create/edit/delete and other mutations require write scopes)
- Any third-party integrations involved?

If any unclear → present questions to user and wait for answers.

### 1.3 Create TODO List

Present a detailed TODO list before starting:

```markdown
## Feature: {name}
### Estimated Scope: S/M/L/XL

### Phase 0: OpenAPI Spec First
- [ ] Update `packages/api-spec/openapi.yaml` or generate from Zod via `generate-spec.ts`
- [ ] Run `pnpm generate:types` to generate hooks/client/types
- [ ] Verify generated files in `packages/api-spec/generated/`

### Phase 1: Database
- [ ] Prisma schema update: `apps/api/prisma/schema.prisma`
- [ ] Run `pnpm prisma:migrate dev --name {description}` to generate migration SQL
- [ ] Run `pnpm prisma:generate` to regenerate Prisma client + Zod schemas
- [ ] Add seed data in `apps/api/prisma/seed.ts` (deterministic IDs)

### Phase 2: API (Backend)
- [ ] Zod DTO schema: `apps/api/src/{module}/dto/{name}.schema.ts`
- [ ] Service: `{Entity}Service` (Prisma queries, business logic)
- [ ] Controller: `{Entity}Controller` + `ZodValidationPipe`
- [ ] Exception types (if new domain errors)
- [ ] EventBridge event (if domain event required)

### Phase 3: Frontend
- [ ] Run `pnpm generate:types` — imports hooks from `apps/web/src/hooks/generated/`
- [ ] Custom hook extensions (if needed): `hooks/use{Entity}.ts`
- [ ] Components: (list each)
- [ ] Page: `app/(protected)/{resource}/page.tsx` (CSR with `'use client'`)
- [ ] Route protection verified (`middleware.ts`)

### Phase 4: Tests
- [ ] NestJS unit tests: `{entity}.service.spec.ts` (mock Prisma)
- [ ] NestJS integration test: `{entity}.controller.integration.spec.ts` (Testcontainers)
- [ ] React component tests: `{Component}.test.tsx` (RTL + MSW)
- [ ] MSW handlers for API mocking
- [ ] E2E test: `{resource}.spec.ts` (Playwright)

### Phase 5: Quality
- [ ] Code review
- [ ] Security review (if auth/PII/new endpoints)
- [ ] Lint + format
- [ ] Coverage check

### Files to Create/Modify
[complete list]
```

**Wait for user confirmation before proceeding.**

---

## Phase 2: Design

### 2.1 OpenAPI Spec First

**CRITICAL**: Always start with OpenAPI spec before any implementation.

Load: `@.claude/standards/api-standards.md#openapi-first-workflow`

Steps:

1. Edit `packages/api-spec/openapi.yaml` (or generate from Zod `generate-spec.ts`)
2. Define all endpoints, request/response schemas, validation rules
3. Define error responses (RFC 7807 ProblemDetail)
4. Define pagination params for list endpoints
5. Define security scheme (PingID JWT)
6. Run `pnpm generate:types` to generate:
      - orval-generated React Query hooks and request/response types in `apps/web/src/hooks/generated/`
      - orval-generated MSW mocks in `apps/web/src/mocks/generated/`

**Present API contract to user for confirmation before implementing.**

### 2.2 Database Design

Load: `@.claude/standards/database-standards.md`

Steps:

1. Design schema — tables, columns, types, constraints
2. Generate ER diagram (Mermaid)
3. Update `apps/api/prisma/schema.prisma` with new models
4. Run `pnpm prisma:migrate dev --name {description}` to generate SQL migration
5. Run `pnpm prisma:generate` to regenerate Prisma client + Zod schemas
6. Add comprehensive seed data to `apps/api/prisma/seed.ts` with deterministic UUIDs
7. Check backward compatibility

### 2.3 UI Design

Read `@.claude/standards/ui-design-standards.md` first.
Read `@.claude/docs/component-library.md`.
Query Context7 MCP for framework implementation patterns when required.
Load: `@.claude/standards/frontend-standards.md`
Load: `@.claude/workflows/ui-design-workflow.md`

**If feature involves authentication/protected routes**: Review `@.claude/standards/frontend-standards.md#8-authentication-state-management-pattern`

Steps:

1. Map acceptance criteria to component tree
2. Default to CSR (Client-Side Rendering) — use 'use client' directive
3. Plan form schemas (Zod — import from generated schemas)
4. Plan state management (React Query for server data + Zustand for client state)
5. If login/auth flow: Use AuthContext's `login()` method (never direct API fetch)
6. If protected page: Check `isLoading` before checking `!user` to avoid "Loading..." hang

---

## Phase 3: Build

### 3.1 Build Order

Always build in this order to avoid dependency issues:

```
1. Prisma Schema Update (apps/api/prisma/schema.prisma)
      ↓
2. Run pnpm prisma:migrate dev + pnpm prisma:generate
   (generates Prisma client + Zod schemas in packages/database/generated/zod/)
      ↓
3. Extend Zod schemas with OpenAPI metadata (packages/validation/src/)
      ↓
4. Run generate-spec.ts to produce packages/api-spec/generated/openapi.json
      ↓
5. Run pnpm generate:types (orval) → apps/web/src/hooks/generated/
      ↓
6. NestJS Service (uses Prisma client + Zod DTOs)
      ↓
7. NestJS Controller (uses ZodValidationPipe + DTOs)
      ↓
8. Frontend pages/components (use orval-generated hooks only — never manual useQuery)
      ↓
9. Page assembly (with 'use client' for CSR)
```

**Key Principle**: Prisma schema is the single source of truth. `zod-prisma-types` generates Zod schemas. `@asteasolutions/zod-to-openapi` generates the OpenAPI spec. `orval` generates typed React Query hooks. Never manually create DTOs, types, or API client code.

### 3.2 API Implementation Checklist

Per endpoint:

- [ ] Prisma schema updated + migration generated
- [ ] Zod DTO schema defined (`CreateEntitySchema`, `UpdateEntitySchema`)
- [ ] Controller: `ZodValidationPipe` on `@Body()`/`@Query()`, `ParseUUIDPipe` on `@Param('id')`
- [ ] Service: business logic isolated, Prisma transactions on writes
- [ ] Guards: `@RequirePermissions` on mutations (POST/PUT/PATCH/DELETE)
- [ ] Structured pino logging with correlationId
- [ ] EventBridge event: business events published
- [ ] Correlation ID propagated through all layers

### 3.3 Frontend Implementation Checklist

Per component/page:

- [ ] `@.claude/standards/ui-design-standards.md` reviewed first
- [ ] `@.claude/docs/component-library.md` patterns reviewed
- [ ] Design references consulted (if available)
- [ ] Design system MCP queried for component APIs (if configured)
- [ ] Context7 MCP consulted for framework API questions
- [ ] Types/hooks imported from `apps/web/src/hooks/generated/` (orval output)
- [ ] Zod schema imported from generated schemas (not manually created)
- [ ] No `any` types
- [ ] Use `'use client'` directive (CSR default unless SSR specifically requested)
- [ ] Error boundary on page (error.tsx)
- [ ] Loading state handled (loading.tsx or design system skeleton/spinner)
- [ ] Empty state handled
- [ ] Error state handled (user-friendly message)
- [ ] Success state handled where applicable
- [ ] Accessibility: ARIA labels, keyboard nav, focus management
- [ ] PingID auth guard applied to route (middleware.ts)
- [ ] React Query for all server data fetching
- [ ] Zustand only for client-side UI state (not server data)
- [ ] **Authentication**: Login pages use `login()` from useAuth() hook (never direct fetch)
- [ ] **Protected pages**: Check `isLoading` state before checking `!user`
- [ ] **Protected pages**: Use `useEffect` to redirect unauthenticated users

### 3.4 Logging Standards

```typescript
// Every significant operation in NestJS (pino-structured):
this.logger.info( { action, status: 'started', id, correlationId }, 'action started');
this.logger.info( { action, status: 'success', id, correlationId, durationMs }, 'success');
this.logger.warn( { action, status: 'notFound', id, correlationId }, 'not found');
this.logger.error({ action, status: 'error',    id, correlationId, error }, 'error');
```

---

## Phase 4: Verify

### 4.1 Fast Local Validation Loop (Mandatory - Must Pass Before Committing)

**CRITICAL**: These checks are **MANDATORY** before every commit. Do not commit code if any check fails.

Run fast, targeted checks first. Do not run the full `/verify-quality` gate automatically during implementation.

```bash
# Contract and generated types (if Prisma schema or OpenAPI changed)
pnpm prisma:generate
pnpm generate:types

# Frontend fast checks
pnpm --filter @repo/web type-check
pnpm --filter @repo/web lint
pnpm --filter @repo/web test -- --watchAll=false --passWithNoTests

# Backend fast checks (MANDATORY before commit)
pnpm --filter @repo/api type-check
pnpm --filter @repo/api lint
pnpm --filter @repo/api test -- --passWithNoTests
```

Rules:

- **If any check fails, fix immediately and re-run only affected commands**
- **TypeScript errors**: fix type issues and re-run `type-check`
- **ESLint violations**: fix or use `pnpm lint:fix`
- **Never commit code with TypeScript or ESLint errors**
- Continue implementation only when this loop is green

### 4.2 Unit Tests

Invoke `@test-engineer`:

```
Generate unit tests for:
- All service methods (happy path + error paths + edge cases)
- All controller endpoints (200/201/400/401/404/500)
- All UI components (render + interaction + validation)
```

Execute from monorepo root:

```bash
# All tests (monorepo root)
pnpm test

# Backend only
pnpm --filter @repo/api test --coverage

# Frontend only
pnpm --filter @repo/web test:coverage
```

**Fix all failures before proceeding.**

### 4.3 Integration Tests

Run API integration tests at the end of implementation whenever the change affects backend behaviour, API contracts, persistence, authorization, or any acceptance criterion that depends on end-to-end server-side execution.

```bash
# Backend integration tests with Testcontainers (real Postgres)
pnpm --filter @repo/api test:integration
```

Testcontainers spins up a real PostgreSQL container for tests — validates actual SQL and migration correctness.
Do not declare the feature complete until the relevant API integration scenarios pass without unresolved errors or warnings.

### 4.4 E2E Tests

Invoke `@test-engineer`:

```
Generate Playwright E2E tests covering acceptance criteria:
- Happy path (full user flow)
- Validation errors
- Auth guard (unauthenticated redirect)
```

Run Playwright at the end of implementation whenever the feature changes a user journey, page behaviour, browser-visible validation, routing, or any acceptance criterion that requires end-user proof:

```bash
pnpm --filter @repo/web test:e2e
```

Target specific specs when possible. Do not declare the feature complete until the relevant Playwright scenarios pass without unresolved errors, console failures, or unexpected warnings.

### 4.5 Code Review (Required)

Invoke `@tech-lead`:

```
Review all new files for this feature.
Focus: correctness, PPCC standards, security, performance.
```

Fix all Critical findings.
Address all Major findings.

Re-run fast local validation loop after applying review fixes.

### 4.6 Security Review

If feature includes:

- New API endpoints → security review required
- PII data handling → security review required
- New AWS resources → security review required
- Auth/permission changes → security review required

Invoke `@security-auditor`:

```
Security review for {feature} — new endpoints: [list]
```

### 4.7 Acceptance Criteria Verification (Traceability Matrix Required)

For every acceptance criterion, provide objective evidence:

```text
AC-1: {criterion}
- Automated evidence: {unit/integration/e2e test name}
- Manual evidence: {steps + observed result}
- Status: ✅/❌

AC-2: {criterion}
- Automated evidence: {test}
- Manual evidence: {steps + result}
- Status: ✅/❌
```

Rules:

- No AC can remain unverified.
- Automated evidence must come from tests that were actually executed for this implementation, not from planned or assumed coverage.
- If an AC is ❌, return to Build phase and fix.

### 4.8 Self-Healing Loop (Bounded)

When checks fail, use this loop before asking the user to intervene:

1. Classify failure: compile, lint/style, unit, integration, E2E, or contract mismatch.
2. Apply deterministic fixes first:
      - Frontend: `pnpm lint:fix`, `pnpm format`
   - Backend: `pnpm --filter @repo/api lint:fix`, `pnpm --filter @repo/api type-check`
   - Contract drift: `pnpm prisma:generate && pnpm generate:types`
3. Re-run only impacted checks.
4. Repeat up to 2 cycles.
5. If still failing after 2 cycles, report root cause, attempted fixes, and exact remaining failures.

### 4.9 Manual Full Quality Gate (Before PR Merge)

Run only when needed or when preparing to merge/release:

```bash
# Quick manual gate
./.claude/scripts/verify-quality.sh --profile quick

# Full manual gate (slower)
./.claude/scripts/verify-quality.sh --profile full
```

### 4.10 Additional Quality Gate Commands

```bash
# Backend deep verification
pnpm --filter @repo/api test:integration
pnpm --filter @repo/api build

# Frontend deep verification
pnpm --filter @repo/web lint
pnpm --filter @repo/web build
pnpm --filter @repo/web test:coverage

# Monorepo-level consistency
pnpm validate
```

Coverage check:

- New code ≥ 80%
- Critical paths (auth, payment, PII) ≥ 95%

All ACs must be ✅ before shipping.

---

## Phase 5: Ship

### 5.1 Pre-Ship Checklist

```
Code:
- [ ] All tests passing
- [ ] Coverage ≥ 80%
- [ ] No lint errors
- [ ] No TypeScript errors
- [ ] Code review: no critical findings

Documentation:
- [ ] OpenAPI spec updated
- [ ] README updated (if setup changed)
- [ ] ADR created (if architectural decision made)
- [ ] RTM updated: /rtm-create

Security:
- [ ] Security review passed (if applicable)
- [ ] No critical/high CVEs in dependencies
- [ ] PingID auth on all new endpoints verified

Observability:
- [ ] Structured logs with correlation ID
- [ ] X-Ray tracing enabled
- [ ] CloudWatch alarms configured (if new service/infrastructure)
- [ ] Observe business events publishing
```

### 5.2 Commit and PR

```bash
# Branch naming
git checkout -b feature/{story-id}-{short-description}

# Commit message format
git commit -m "feat(resource): add resource management CRUD

- Implements US-001: Resource creation
- Implements US-002: Resource list with pagination
- Adds Prisma migration: 20240530_create_resources
- Adds /api/v1/resources endpoints

Closes #123"

# Push and create PR
git push origin feature/{branch-name}
```

PR description template:

```markdown
## Summary
[What this PR does]

## Stories
- Closes US-001
- Closes US-002

## Changes
- API: [new endpoints]
- DB: [Prisma migration name and description]
- Frontend: [new pages/components]

## Test Coverage
- Unit tests: X new tests
- Integration tests: X new tests
- E2E tests: X new scenarios
- Coverage: X%

## Deployment Notes
- DB migration: V{N} — backward compatible
- Environment variables: [any new ones]
- Feature flags: [if applicable]
```

### 5.3 Release Readiness (No Live Deployment by Default)

For this framework, complete local verification and delivery artifacts only:

- Select and run one or more modes from `@.claude/workflows/local-runtime-modes.md`
- Produce deployment-ready IaC/pipeline/config updates
- Use `/deploy-prepare` for readiness checks, not for executing live environment deployments

If the user explicitly requests live deployment in a separate task, follow `@.claude/workflows/deployment.md`.

---

## Workflow Quick Reference

| Phase | Key Output | Agent |
|---|---|---|
| Understand | TODO list, confirmed ACs | build |
| DB Design | Migration SQL, ER diagram | db-designer |
| API Design | OpenAPI spec, DTOs | backend-engineer |
| UI Design | Component plan | frontend-developer |
| API Build | Controller/Service/Repo | backend-engineer |
| UI Build | Pages/Components/Hooks | frontend-developer |
| Tests | Jest/Playwright | test-engineer |
| Review | Review report | tech-lead |
| Security | Security report | security-auditor |
| Ship | PR, release readiness artifacts | devops-engineer |

## Cross-References

- Standards: `@.claude/standards/`
- Commands: `/add-feature`
- API contract workflow: `@.claude/workflows/api-contract-workflow.md`
- Codegen sync workflow: `@.claude/workflows/codegen-sync-workflow.md`
- State management standards: `@.claude/standards/state-management-standards.md`
- Form validation pattern: `@.claude/patterns/form-validation-pattern.md`
- Optimistic update pattern: `@.claude/patterns/optimistic-update-pattern.md`
- Runtime modes: `@.claude/workflows/local-runtime-modes.md`
- Deployment artifacts/config: `@.claude/workflows/deployment.md`
- Templates: `@.claude/templates/`

## Token Optimization

- **Load when**: `/add-feature`, `/implement-epic`, end-to-end feature work.
- **Load only**: this workflow + the standards relevant to the current scope (api/frontend/database). Skip unrelated standards.
- **Unload after**: feature delivered, tests pass, implemented summary written. Drop epic-specific context once complete.
- **Hand-off to**: `tech-lead` for review, then `devops-engineer` for deploy prep.
- **Generation phase exception**: while `/add-feature` is generating epics, stories, or task breakdowns (planning phase only), read source requirements documents and input files **in full** — do not summarise inputs to save tokens. See `@.claude/docs/context-optimization.md` (Generation Phase Exception). Normal discipline resumes once epics are generated and implementation begins.
