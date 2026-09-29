---
description: >
  Lightweight feature delivery — accepts feature description, story ID, requirements
  document, or requirements folder. Auto-detects scope (API-only / UI-only / full-stack),
  runs a complexity gate (escalates to /add-feature for L/XL), confirms acceptance criteria,
  then implements directly following all standards, patterns, and quality gates — without
  creating epics or updating the tracker.
agent: build
subtask: false
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# Add Feature (Simple)

## Input

$ARGUMENTS — one of:

1. **Plain text** — e.g. `"add a status badge to the file detail header"`
2. **Story / task ID** — e.g. `US-042`
3. **Requirements document path** — e.g. `specs/requirements/status-badge.md`
4. **Requirements folder path** — e.g. `specs/requirements/status-badge/`

If `$ARGUMENTS` is empty, ask the user for the feature description or requirements source before continuing.

---

## Purpose

`/add-feature-simple` delivers small-to-medium features directly without epic planning overhead.

It is the right command when the feature:
- Is bounded to 1–2 domain areas
- Does not require phased delivery or task breakdown
- Has no cross-cutting architectural impact
- Fits comfortably in a single focused implementation session

It is **not** the right command when the feature is large, cross-cutting, or has dependencies
on other planned work — in those cases it escalates and recommends `/add-feature` instead.

**What it does:**
1. Parses scope from any input format
2. Auto-detects feature type (API-only / UI-only / full-stack)
3. Runs a complexity gate — escalates to `/add-feature` if size is L/XL or impact is high
4. Runs a targeted ambiguity review when scope is unclear
5. Confirms acceptance criteria before implementation
6. Implements directly following all framework standards, patterns, and quality gates
7. Runs a quality close without creating epics or touching the tracker

---

## Pre-Flight: Context Loading

Always load first:
- `@.claude/docs/authorization-patterns-and-architecture.md`

Load lazily based on detected feature type:

- API only: `@.claude/standards/api-standards.md`, `@.claude/standards/database-standards.md`
- UI only: `@.claude/standards/frontend-standards.md`, `@.claude/standards/ui-design-standards.md`, `@.claude/docs/component-library.md`
- Full-stack: all of the above
- Security-related: `@.claude/standards/security-standards.md`

Mandatory for any UI scope (UI-only or Full-stack with UI):
- Inspect `.claude/wireframes/*` and read `.claude/wireframes/.generated-manifest.json` first, then apply **Wireframe Precedence** — the canonical rule in `@.claude/standards/component-usage.md#wireframe-precedence-canonical`.
- Read **UI Library** from `@.claude/CLAUDE.md` Critical Constraints.
- If wireframes use a different UI library/styling approach, convert UI implementation to the configured UI library while preserving wireframe layout, hierarchy, spacing, states, and interaction intent.

---

## Workflow

### Step 1: Parse Input

Determine input type from `$ARGUMENTS`:

- **Folder path** → read all `.md`, `.txt`, `.yaml` files in the folder; merge extracted scope, constraints, goals, and acceptance criteria into a unified requirements summary
- **File path** → read the file; extract scope, goals, constraints, acceptance criteria
- **Story ID** → scan story files in `specs/`, `specs/tasks/`, `.claude/docs/`; extract story content
- **Plain text** → use as-is; treat as a high-level feature description

Produce a structured requirements summary:

```
Feature Name        : [inferred or extracted]
Feature Type        : [API-only / UI-only / Full-Stack — inferred from scope]
Goals               : [what the feature achieves]
Scope               : [bounded description of what is in and out]
Domain Entities     : [affected data model areas]
User Journeys       : [affected user flows, if any]
Constraints         : [technical, regulatory, or business constraints]
Acceptance Criteria : [testable criteria extracted, or [] if not provided]
```

### Step 2: Auto-Detect Feature Type

Classify the feature based on requirements content:

| Signal | Inferred Type |
|--------|--------------|
| Only API endpoints, no UI pages mentioned | API-only |
| Only pages, forms, or UI components, no DB/service changes | UI-only |
| Both API and UI signals, or no explicit signal | Full-Stack |

State the detected type and load the relevant pre-flight context.

### Step 3: Complexity Gate

Estimate the feature size using the criteria below. If the feature is **L or XL**, or meets
any escalation trigger, **do not proceed** — present the escalation notice and stop.

**Size rubric:**

| Size | Criteria |
|------|----------|
| **S** | Single domain concept, 1–3 endpoints or components, no complex business logic |
| **M** | 2–4 entities, 4–8 endpoints or components, 1–2 integrations or workflows |
| **L** | Multi-entity, >8 endpoints or components, complex logic, or system integration |
| **XL** | 3+ major domain areas, cross-cutting architectural change, major UI subsystem |

**Escalation triggers (any one → escalate):**

- Estimated size is **L** or **XL**
- Feature touches **3 or more domain areas** simultaneously
- Feature introduces a **cross-cutting architectural change** (new auth pattern, new event bus topic, new DB join strategy, etc.)
- Feature has **dependencies on unimplemented planned epics** (found in `specs/epics/0-epics-index.md`)
- Feature **modifies or replaces existing delivered scope** in `specs/epics-implemented/` in a non-trivial way
- Feature requires **phased delivery** or cannot safely be delivered as a single atomic change

**If escalation is triggered, present:**

```
## Complexity Escalation — Use /add-feature Instead

This feature exceeds the scope of /add-feature-simple.

Reason: {specific trigger(s) that fired}

Estimated size : {L / XL}
Domain areas   : {list}

/add-feature-simple is designed for S/M features that can be delivered atomically.
Features of this size benefit from epic planning, a tracker entry, and phased delivery.

Recommended next step:
  /add-feature {original $ARGUMENTS}

This will run the full epic planning workflow, check alignment with the existing
tracker, and produce a structured implementation plan before any code is written.
```

**Stop here** if escalation is triggered. Do not proceed with implementation.

If the feature is **S or M** and no escalation trigger fires, state the estimated size,
list any assumptions being made, and continue to Step 4.

### Step 4: Quick Impact Scan

Scan the existing work to avoid duplicating delivered functionality:

- Skim `specs/epics-implemented/*.md` — flag any delivered scope that overlaps this feature
- Skim `specs/epics/0-epics-index.md` (if it exists) — flag any `epic-generated` or `pending` epics with overlapping scope

Report findings as informational context only (not as a planning gate). If overlap is found,
state clearly what is already delivered and what this feature adds or changes.

If the overlap is substantial enough to suggest the feature should extend an existing epic
rather than be delivered standalone, surface this as a recommendation — but do not block
unless an escalation trigger from Step 3 also fires.

### Step 5: Ambiguity Review

Invoke the ambiguity analyst flow (load `@.claude/agents/ambiguity-analyst.md`) if ANY of the following are true:

- Scope boundaries are unclear
- Multiple valid interpretations exist
- Permission or authorization model is unspecified for new operations
- The request contradicts or is silent on a known framework constraint
- The feature touches auth, security, or compliance-sensitive areas

When no blocking ambiguity is found, state any assumptions being made and proceed.

### Step 6: Confirm Acceptance Criteria

Present the extracted or inferred acceptance criteria to the user:

```
## Acceptance Criteria: {Feature Name}

AC-1: {testable criterion}
AC-2: {testable criterion}
...

Please confirm these are complete and accurate before I begin implementation.
[Y]  Yes, proceed    ← RECOMMENDED
[E]  Edit — I will adjust the criteria
```

Wait for user confirmation before continuing.

If no acceptance criteria could be extracted from the input, draft them from the feature
description and present for confirmation.

### Step 7: Implementation Plan

Before writing any code, present a concise implementation plan:

```
## Implementation Plan: {Feature Name}

Type     : {API-only / UI-only / Full-Stack}
Size     : {S / M}
Changes  : [list of files/areas to be created or modified]

Order:
  1. {first step}
  2. {second step}
  ...

Proceed? [Y / adjust]
```

Wait for confirmation, then implement.

### Step 8: Implementation

Follow the implementation standards for the detected feature type.

#### API-Only Features

Load: `@.claude/standards/api-standards.md`, `@.claude/standards/database-standards.md`

Implementation order:
1. Prisma schema update (if DB change needed)
2. Run generation pipeline: `pnpm generate` (Prisma → Zod → OpenAPI → hooks)
3. Extend Zod schema in `packages/validation/src/` with OpenAPI metadata
4. Register path in `apps/api/src/openapi/generate-spec.ts`
5. Controller — thin, ZodValidationPipe, @RequirePermissions
6. Service — business logic, structured logging, EventBridge events
7. Repository — only for complex queries
8. Unit tests for all service methods

Templates:
- Controller: `@.claude/templates/nestjs-controller.ts`
- Service: `@.claude/templates/nestjs-service.ts`
- Repository: `@.claude/templates/nestjs-repository.ts`

Checklist:
- [ ] Generation pipeline run after schema/Zod changes
- [ ] All endpoints use ZodValidationPipe (no class-validator)
- [ ] All errors thrown as domain exceptions
- [ ] RFC 7807 ProblemDetail on all errors
- [ ] correlationId propagated in all service calls
- [ ] EventBridge event published on state changes
- [ ] Unit and integration tests passing

#### UI-Only Features

Load: `@.claude/standards/frontend-standards.md`, `@.claude/standards/ui-design-standards.md`, `@.claude/docs/component-library.md`

Wireframe gate — read `.claude/wireframes/.generated-manifest.json` before implementation planning, then apply **Wireframe Precedence** (`@.claude/standards/component-usage.md#wireframe-precedence-canonical`).
- If wireframe UI library differs from configured **UI Library**, map wireframe primitives → configured library primitives before writing any code.

Query before implementation:
- Design system MCP (if configured): available components, design tokens
- Context7 MCP: NextJS/React/TanStack Query/Zod/React Hook Form patterns

**Before writing any code — run generation pipeline:**

```bash
pnpm --filter @repo/database generate
tsx apps/api/src/openapi/generate-spec.ts
pnpm --filter @repo/web orval          # → hooks/generated/ + mocks/generated/
```

Implementation order:
1. Confirm OpenAPI spec has required endpoints (if not, run `/add-endpoint` first)
2. Run generation pipeline — creates/updates hooks in `hooks/generated/`
3. Extend or create Zod validation schemas in `packages/validation/src/` if needed
4. Components — from smallest to largest, using generated hooks
5. Page — wire components, handle loading/error/empty states
6. Custom hook extensions (only if optimistic updates or complex cache manipulation needed)
7. Route — ensure in `(protected)` group with auth guard

**TanStack Query rules:**
- NEVER write useQuery/useMutation manually for API calls
- ALWAYS use generated hooks from `hooks/generated/`
- Extend via options at call site, not by wrapping
- Only write custom hook files for optimistic updates or non-trivial cache manipulation
- `queryClient.invalidateQueries()` after mutations — verify generated hook does this

**Form rules:**
- ALWAYS use shared Zod schema from `@repo/validation` with zodResolver
- Same validation schema as backend — single source of truth for error messages

Checklist:
- [ ] Design system MCP queried for all components (if configured)
- [ ] Generation pipeline run before writing any component code
- [ ] No manually written useQuery/useMutation for endpoint calls
- [ ] Generated files in hooks/generated/ not manually edited
- [ ] Forms use shared Zod schema from @repo/validation
- [ ] All loading, error, and empty states handled
- [ ] queryClient.clear() called on logout
- [ ] WCAG 2.1 AA accessibility attributes
- [ ] PingID/JWT auth guard applied
- [ ] Component tests use renderWithProviders (fresh QueryClient per test)
- [ ] MSW handlers from mocks/generated/ used in tests
- [ ] Tests passing, lint clean

#### Full-Stack Features

Load all API-only and UI-only standards above.

Implementation order:
1. Prisma schema update (if DB change needed)
2. Run generation pipeline (step 2 of API-only above)
3. API layer: extend Zod → register OpenAPI path → controller → service
4. Re-run generation pipeline (`pnpm generate`) — updates frontend hooks
5. Frontend layer: use generated hooks → components → page
6. Unit tests (service + component)
7. Integration tests (Testcontainers + supertest)
8. E2E tests (Playwright — must cover all acceptance criteria journeys)

**Key constraint:** Frontend never makes API calls without a generated hook.
If an endpoint is missing, add it to the API first, regenerate, then build the UI.

### Step 9: Tests

```
API:  Jest + @nestjs/testing
      - Service unit tests (mock Prisma + EventBridge, all branches)
      - Controller unit tests (mock service, verify delegation)
      - Integration tests (Testcontainers + supertest) for new endpoints

UI:   Jest + RTL + MSW
      - Use renderWithProviders() (fresh QueryClient per test)
      - Use generated MSW handlers from mocks/generated/ as baseline
      - Override handlers per test for error scenarios
      - Test: loading state, success state, error state, user interactions
      - Test: form validation messages match backend Zod schema errors

E2E:  Playwright (full-stack or UI-only with user journeys)
      - Happy path scenario
      - Form validation error scenario
      - Auth guard scenario (unauthenticated redirect)
      - Permission-denied scenario (authenticated, wrong role)
```

Follow template: `@.claude/templates/jest-unit-test.ts`

Run tests and fix all failures before the quality close:

```bash
# API
pnpm --filter @repo/api test --verbose
pnpm --filter @repo/api test:integration --runInBand

# Web
pnpm --filter @repo/web test --verbose
pnpm --filter @repo/web test:e2e       # if UI journeys are in scope
```

### Step 10: Quality Close

Load `@.claude/docs/definition-of-done.md` and apply the relevant gate:

- **UI-Only or Full-Stack**: apply §4.1 — UI protocol, component tests, Playwright E2E, accessibility
- **API-Only or Full-Stack**: apply §4.2 — service/controller unit tests, Testcontainers, API contract
- **All features**: apply the code quality section of §4.3 — lint, type-check, tests pass

> Note: The tracker update and `specs/epics-implemented/` entry from §4.3 are **skipped** —
> this command does not use the epic tracker.

```bash
pnpm generate          # Ensure generated files are current
pnpm lint              # ESLint zero warnings
pnpm type-check        # tsc --noEmit zero errors
pnpm test              # Unit tests pass
pnpm test:integration --runInBand   # Integration tests pass (if applicable)
```

Unload `definition-of-done.md` after quality close is complete.

### Step 11: Summary

```
## Feature Complete: {Feature Name}

Type     : {API-only / UI-only / Full-Stack}
Size     : {S / M}

### Files Changed
- Created : [list]
- Modified: [list]

### Endpoints (if applicable)
- [METHOD] /path — {description}

### DB Changes (if applicable)
- Migration: {name}
- Seed: updated (if applicable)

### Generation Pipeline
- pnpm generate: ✅ clean
- OpenAPI spec  : packages/api-spec/generated/openapi.json
- React Query hooks: apps/web/src/hooks/generated/  (if applicable)
- MSW handlers     : apps/web/src/mocks/generated/   (if applicable)

### Test Results
- Unit tests        : {n} passing
- Integration tests : {n} passing  (if applicable)
- E2E tests         : {n} passing  (if applicable)

### Acceptance Criteria
- [x] AC-1: ...
- [x] AC-2: ...

### Quality Gate
- [ ] ESLint: zero warnings
- [ ] TypeScript: zero errors
- [ ] All tests passing
- [ ] No manually written React Query hooks
- [ ] No edits to generated files
```

---

## When to Use Which Command

| Situation | Use |
|-----------|-----|
| Small focused change, 1–2 domain areas, no cross-cutting impact | `/add-feature-simple` ← this command |
| Feature is L/XL, cross-cutting, or has planned-epic dependencies | `/add-feature` |
| Building a complete new capability from requirements | `/add-feature` |
| Implementing a specific existing epic file | `/implement-epic` |
| Breaking down a large epic into tasks before implementing | `/create-epic-tasks` |

---

## Cross-References

- Full epic workflow: `/add-feature` → `@.claude/workflows/epic-based-development.md`
- Authorization patterns: `@.claude/docs/authorization-patterns-and-architecture.md`
- API standards: `@.claude/standards/api-standards.md`
- UI standards: `@.claude/standards/frontend-standards.md`
- Testing standards: `@.claude/standards/testing-standards.md`
- Definition of done: `@.claude/docs/definition-of-done.md`
- Ambiguity review: `@.claude/agents/ambiguity-analyst.md`
- TypeScript formatting: `@.claude/standards/typescript-formatting-standards.md`
