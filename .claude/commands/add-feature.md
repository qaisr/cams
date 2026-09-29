---
description: >
  Feature intake and epic planning — accepts feature description, story ID, requirements
  document, or requirements folder. Auto-detects scope (API-only / UI-only / full-stack),
  runs ambiguity review, estimates size, creates epics in specs/epics/ using the shared epic
  tracker as source of truth, then follows the epic-based development workflow. Supersedes
  /add-feature, /add-feature-ui, and /create-tasks.
agent: build
subtask: false
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# Add Feature

## Input

$ARGUMENTS — one of:

1. **Plain text** — e.g. `"user management with CRUD and role assignment"`
2. **Story / task ID** — e.g. `US-042`
3. **Requirements document path** — e.g. `specs/requirements/users-feature.md`
4. **Requirements folder path** — e.g. `specs/requirements/users/`

If `$ARGUMENTS` is empty, ask the user for the feature description or requirements source before continuing.

---

## Purpose

`/add-feature` is the primary front door for adding any new capability to the application,
regardless of scope. It:

1. Extracts scope, constraints, and acceptance criteria from any input format
2. Auto-detects the feature type (API-only / UI-only / full-stack)
3. Runs an ambiguity review when scope, boundaries, or permissions are unclear
4. Checks alignment with existing implemented and queued epics to prevent duplication
5. Estimates feature complexity and determines epic count
6. Creates epics in `specs/epics/` — the single source of truth shared with `/create-epics`
7. Prompts for epic placement with recommended insertion point
8. Follows the epic-based development workflow (`@.claude/workflows/epic-based-development.md`) for implementation

---

## Token Policy (Planning Phase)

While `/add-feature` is in its **planning / epic-generation phase**,
token-efficiency rules are **relaxed**: read the input (description, story,
requirements file, or requirements folder), the epic tracker, relevant
implemented summaries, and applicable standards **in full**. Do not summarise
or truncate inputs to save tokens — incomplete planning here propagates into
every generated epic.

Normal token discipline **resumes** once epics are generated and the workflow
hands off to `/implement-epic`. See `@.claude/docs/context-optimization.md`
(Generation Phase Exception).

---

## Pre-Flight: Context Loading

Always load first:
- `@.claude/workflows/epic-based-development.md`
- `@.claude/docs/authorization-patterns-and-architecture.md`
- Current epic tracker: `specs/epics/0-epics-index.md` (if it exists)
- Implemented summaries: `specs/epics-implemented/*.md` (scan for relevant completed work)

Load lazily based on detected feature type:

- API only: `@.claude/standards/api-standards.md`, `@.claude/standards/database-standards.md`
- UI only: `@.claude/standards/frontend-standards.md`
- Full-stack: all of the above
- Security-related: `@.claude/standards/security-standards.md`

Load lazily based on detected feature type:
- API only: `@.claude/standards/api-standards.md`, `@.claude/standards/database-standards.md`
- UI only: `@.claude/standards/frontend-standards.md`, `@.claude/standards/ui-design-standards.md`, `@.claude/docs/component-library.md`
- Full-stack: all of the above
- Security-related: `@.claude/standards/security-standards.md`

Mandatory for any UI scope (UI-only or Full-stack with UI):
- Inspect `.claude/wireframes/*` and read `.claude/wireframes/.generated-manifest.json` first, then apply **Wireframe Precedence** — the canonical rule in `@.claude/standards/component-usage.md#wireframe-precedence-canonical`.
- Read **UI Library** from `@.claude/CLAUDE.md` Critical Constraints.
- If wireframes use a different UI library/styling approach, convert UI implementation to configured UI library constraints while preserving wireframe layout, hierarchy, spacing, states, and interaction intent.

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

### Step 3: Check Existing Epic Alignment

Read `specs/epics/0-epics-index.md` and `specs/epics-implemented/*.md` to identify:

- Any `complete` epics whose scope overlaps the requested feature — avoid duplicating delivered work
- Any `epic-generated` or `pending` epics that overlap — surface as a clarification item (extend vs. new epic?)
- Any epics that are prerequisites for the requested feature — record as dependencies

Report findings before running ambiguity analysis so context is available to the analyst.

### Step 4: Run Ambiguity Review

Load `@.claude/agents/ambiguity-analyst.md` and invoke the ambiguity analyst flow if ANY of the following are true:

- Scope boundaries are unclear (common for folder or document inputs)
- Multiple valid interpretations of the feature exist
- Permission or authorization model is unspecified for new operations
- The request touches more than two domain areas simultaneously
- The request contradicts or is silent on a known framework constraint
- The feature touches auth, security, or compliance-sensitive areas
- Overlap with existing epics was found in Step 3
- Feature size is estimated L or XL

During the ambiguity review, also surface:
- Any overlap with `epic-generated` epics: **extend** existing epic vs. **create a new parallel epic**?
- Any overlap with `complete` epics: **extend delivered scope** vs. **treat as a new feature** built on top?

When no blocking ambiguity is found, state any assumptions being made and proceed.

### Step 5: Estimate Feature Size

After ambiguity is resolved, estimate the overall feature size:

| Size | Criteria |
|------|----------|
| **S** | Single domain concept, 1–3 endpoints or components, no complex business logic |
| **M** | 2–4 entities, 4–8 endpoints or components, 1–2 integrations or workflows |
| **L** | Multi-entity, >8 endpoints or components, complex logic, or system integration |
| **XL** | 3+ major domain areas, cross-cutting architectural change, major UI subsystem |

Determine epic count based on size:

| Size | Likely epic count |
|------|------------------|
| S | 1 |
| M | 1–2 |
| L | 2–4 |
| XL | 4+ (clarify breakdown with user) |

### Step 6: Design Epic Structure

Propose the epic breakdown. For each proposed epic, include:
- Suggested epic title
- What it delivers
- Dependencies on other proposed or existing epics
- Estimated size (S/M/L/XL)
- Recommended execution path (`/implement-epic` or `/create-epic-tasks`)

Present as a confirmation prompt:

```
## Proposed Epic Breakdown: {Feature Name}

Total: {n} epic(s) | Feature Type: {API-only / UI-only / Full-Stack}

| # | Title | Delivers | Size | Depends On | Exec Path |
|---|-------|----------|------|-----------|-----------|
| 1 | {title} | {brief} | S | — | /implement-epic |
| 2 | {title} | {brief} | L | 1 | /create-epic-tasks |

Shall I proceed with this breakdown?
[Y]  Yes, proceed as proposed    ← RECOMMENDED
[E]  Edit — I will adjust the breakdown
[T]  Different breakdown — describe it
```

Wait for user confirmation before continuing.

### Step 7: Determine Epic Placement

Read `specs/epics/0-epics-index.md` and identify:

- Last epic marked `complete` → position A
- Last epic marked `epic-generated` → position B
- Last epic of any status → position C

Present placement options:

```
## Epic Placement in specs/epics/0-epics-index.md

Current tracker state:
  Last completed epic    : {Epic-NNN} — {title}
  Last generated epic    : {Epic-MMM} — {title}  (not yet implemented)
  Total planned epics    : {count}

Where should the new epic(s) be inserted?

[A]  After last completed epic (Epic-{NNN})
     → New epics become the highest-priority unimplemented work
     → Subsequent pending/generated epics shift down by {n}
     ← RECOMMENDED when this feature should be implemented before existing queued work

[B]  After last generated epic (Epic-{MMM})
     → New epics queue after all currently generated (not yet implemented) epics
     → Existing generated epics are implemented first; lower immediate priority
     ← DEFAULT when no urgency — avoids disrupting current delivery order

[C]  At the very end of the planned list
     → Lowest priority — implemented after all currently planned work

[T]  Custom position — specify the Epic ID to insert after
```

Wait for user selection before continuing.

If `specs/epics/0-epics-index.md` does not exist, see **Bootstrap Mode** below.

### Step 8: Assign Epic IDs and Renumber

Based on the chosen insertion point:

1. Assign sequential epic IDs to new epics (format: `epic-{NNN}` with zero-padded 3-digit IDs)
2. If inserting mid-sequence (options A or T), renumber subsequent epics to make room
3. Update all affected epic file names and tracker rows
4. If renaming existing epic files, update cross-references inside those files

### Step 9: Generate Epic Files

For each new epic, create a file at:

```
specs/epics/epic-{NNN}-{kebab-case-title}.md
```

Each epic file must be self-contained and include:

1. Title, priority, dependency, estimated scope
2. Application state before this epic
3. What this epic delivers
4. Feature type context (API-only / UI-only / Full-stack)
5. Functional, non-functional, and technical requirements
6. Architecture and data model notes
7. Acceptance criteria in testable form
8. Test requirements
9. Definition of done (reference `@.claude/docs/definition-of-done.md` §4 with scope-appropriate sections)
10. Implementation recommendation (`/implement-epic` or `/create-epic-tasks`)

### Step 10: Update Epic Tracker

Add new epic rows to `specs/epics/0-epics-index.md` at the confirmed insertion point.

Set all new epics to status `epic-generated`.

If renumbering was required, update all affected tracker rows and epic file cross-references.

Apply the archive strategy from `epic-based-development.md` if tracker has > 9 completed epics with full summaries.

### Step 11: Hand Off to Implementation

Present next-steps summary:

```
## Feature Epics Created

Feature  : {Feature Name}
Type     : {API-only / UI-only / Full-Stack}
Epics    : {n} created in specs/epics/

Next steps — execute in order:

  1. /implement-epic specs/epics/epic-{NNN}-{title}.md
  2. /create-epic-tasks specs/epics/epic-{MMM}-{title}.md   ← L/XL — use task breakdown

After each epic:
  → Write specs/epics-implemented/<epic-file-name>.md
  → Mark epic `complete` in specs/epics/0-epics-index.md
```

Follow `@.claude/workflows/epic-based-development.md` from this point.

---

## Bootstrap Mode: Tracker Does Not Exist

If `specs/epics/0-epics-index.md` does not exist:

Present options:

```
specs/epics/0-epics-index.md does not exist yet.

[A]  Run /create-epics first to plan the full project epic sequence, then add this feature
     ← RECOMMENDED for greenfield or early-stage projects

[B]  Bootstrap the tracker for this feature only and create it now
     → A minimal tracker is created with just these new epics
     → Additional epics can be planned later with /create-epics

[T]  Different approach — describe it
```

If bootstrapping (option B), create `specs/epics/0-epics-index.md` with:
- Project name, creation date
- Epic status legend
- Only the new feature epics (marked `epic-generated`)
- A note that further project epics can be planned via `/create-epics`

---

## Feature Type — Implementation Standards

### API-Only Features

Load: `@.claude/standards/api-standards.md`, `@.claude/standards/database-standards.md`

Implementation order within each epic:
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

### UI-Only Features

Load: `@.claude/standards/frontend-standards.md`, `@.claude/standards/ui-design-standards.md`, `@.claude/docs/component-library.md`

Wireframe gate — read `.claude/wireframes/.generated-manifest.json` before UI implementation planning, then apply **Wireframe Precedence** (`@.claude/standards/component-usage.md#wireframe-precedence-canonical`).
- If wireframe UI library differs from configured **UI Library**, include explicit mapping notes (wireframe primitives -> configured library primitives) in epic/task descriptions.

Query before implementation:

- Design tool MCP (if configured): design references for the feature
- Design system MCP (if configured): available components, design tokens
- Context7 MCP: NextJS/React/TanStack Query/Zod/React Hook Form patterns

**Before writing any code — run generation pipeline**:

```bash
# Ensure hooks and MSW handlers are up-to-date from OpenAPI spec
pnpm --filter @repo/database generate
tsx apps/api/src/openapi/generate-spec.ts
pnpm --filter @repo/web orval          # → hooks/generated/ + mocks/generated/
```

Implementation order within each epic:
1. Confirm OpenAPI spec has required endpoints (if not, run /add-endpoint first)
2. Run generation pipeline — creates/updates hooks in `hooks/generated/`
3. Extend or create Zod validation schemas in `packages/validation/src/` if needed
4. Components — from smallest to largest, using generated hooks
5. Page — wire components, handle loading/error/empty states
6. Custom hook extensions (only if optimistic updates or complex cache manipulation needed)
7. Route — ensure in `(protected)` group with auth guard

**TanStack Query rules**:
- NEVER write useQuery/useMutation manually for API calls
- ALWAYS use generated hooks from `hooks/generated/`
- Extend via options at call site, not by wrapping
- Only write custom hook files for optimistic updates or non-trivial cache manipulation
- `queryClient.invalidateQueries()` after mutations — verify generated hook does this

**Form rules**:
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

### Full-Stack Features

Load all API-only and UI-only standards above.

Implementation order:

1. Prisma schema update (if DB change needed)
2. Run generation pipeline (step 2 of API-only)
3. API layer: extend Zod → register OpenAPI path → controller → service
4. Re-run generation pipeline (`pnpm generate`) — updates frontend hooks
5. Frontend layer: use generated hooks → components → page
6. Unit tests (service + component)
7. Integration tests (Testcontainers + supertest)
8. E2E tests (Playwright — must cover all acceptance criteria journeys)

**Key constraint**: Frontend never makes API calls without a generated hook.
If an endpoint is missing, add it to the API first, regenerate, then build the UI.


---

## Quality Close for Each Epic

At the end of each epic implementation:

> **MANDATORY**: Load **`@.claude/docs/definition-of-done.md` §4 (Epic Quality Close)** and apply the relevant gate. A UI epic is not `complete` until the UI protocol and all tests pass. A backend epic is not `complete` until unit + integration tests pass.

- **UI-Only or Full-Stack**: apply §4.1 (UI protocol, component tests, Playwright E2E, accessibility)
- **API-Only or Full-Stack**: apply §4.2 (service/controller unit tests, Testcontainers, API contract)
- **All epics**: apply §4.3 (lint, type-check, tests pass, epics-implemented written, tracker updated)

Unload `definition-of-done.md` after quality close is complete.

---

## Cross-References

- Epic workflow: `@.claude/workflows/epic-based-development.md`
- Epic tracker: `specs/epics/0-epics-index.md`
- Epic generation (full project): `/create-epics`
- Epic implementation: `/implement-epic`
- Epic task breakdown: `/create-epic-tasks`
- Ambiguity review: `@.claude/agents/ambiguity-analyst.md`
- Requirements phase agent: `@.claude/agents/product-owner.md` — activate for requirements extraction, story writing, and acceptance criteria. Unload after requirements docs are produced.
- Authorization: `@.claude/docs/authorization-patterns-and-architecture.md`
- API standards: `@.claude/standards/api-standards.md`
- UI standards: `@.claude/standards/frontend-standards.md`
9. Lint + format

```

**Confirm with user before proceeding.**

### Step 2: Acceptance Criteria

If no stories exist for this feature, draft acceptance criteria now.
Present to user: "Please confirm these acceptance criteria are complete before I begin implementation."

### Step 3: Database (full-stack and API-only)

- Update Prisma schema
- Run `pnpm --filter @repo/database generate`
- Seed data with deterministic UUIDs in `packages/database/prisma/seed.ts`

### Step 4: API Implementation
- Run generation pipeline after Zod schema changes
- Controller (ZodValidationPipe, @RequirePermissions, thin delegation)
- Service (structured logging, EventBridge events, domain exceptions)

### Step 5: Frontend Implementation
- **First**: Confirm all required endpoints exist in OpenAPI spec
- **Run generation pipeline**: `pnpm generate`
  - Generates `hooks/generated/` — typed React Query hooks (built on @tanstack/react-query)
  - Generates `mocks/generated/` — MSW handlers for tests
- Read `@.claude/standards/frontend-standards.md`
- Use generated hooks — NEVER write useQuery/useMutation by hand
- Use shared Zod schema from `@repo/validation` for form validation
- Handle all states: loading (aria-busy), error (role="alert"), empty, success
- Apply `enabled: !!user` pattern when query depends on auth

### Step 6: Unit Tests
```
API:  @subagent test-engineer — Jest + @nestjs/testing
      - Service unit tests (mock Prisma + EventBridge, all branches)
      - Controller unit tests (mock service, verify delegation)

UI:   @subagent test-engineer — Jest + RTL + MSW
      - Use renderWithProviders() from template (fresh QueryClient per test)
      - Use generated MSW handlers from mocks/generated/ as baseline
      - Override handlers per test for error scenarios
      - Test: loading state, success state, error state, user interactions
      - Test: form validation messages match backend Zod schema errors
      - For custom hooks (optimistic updates): test cache state directly
```
Follow template: `@.claude/templates/jest-unit-test.ts`

### Step 7: Execute Tests
```bash
# API tests
pnpm test --testPathPattern="{entity}.service" --verbose
pnpm test:integration --testPathPattern="{entity}" --runInBand

# Frontend tests
pnpm --filter @repo/web test --testPathPattern="{Entity}" --verbose
```
Fix all failures before proceeding.

### Step 8: E2E Test
```
@subagent test-engineer — Playwright E2E
- Page Object Model for new pages
- Happy path scenario
- Form validation error scenario
- Auth guard scenario (unauthenticated redirect)
- Permission-denied scenario (authenticated, wrong role)
```

```bash
pnpm --filter @repo/web test:e2e
```

### Step 9: Code Review
```
@subagent tech-lead — review all new files
Focus: correctness, security, standards, performance
Verify: no manual React Query hooks, no @repo/validation type duplication
```

### Step 10: Quality Gate
```bash
pnpm generate                          # Ensure generated files current
pnpm lint                              # ESLint zero warnings
pnpm type-check                        # tsc --noEmit
pnpm test                              # Unit tests + coverage thresholds
pnpm test:integration --runInBand      # Integration tests
./.claude/scripts/verify-quality.sh --profile full
```

Verify:
- [ ] All acceptance criteria met
- [ ] Generation pipeline produces clean output
- [ ] No manually written React Query hooks for API endpoints
- [ ] Generated hooks/generated/ and mocks/generated/ not manually edited
- [ ] Test coverage ≥ 80%
- [ ] No lint errors, no TypeScript errors
- [ ] Integration tests passing (Testcontainers)
- [ ] Playwright E2E passing
- [ ] Security checklist passed

### Step 11: Summary
```
## Feature Complete: {name}

### Implemented
- Files created: [list]
- Endpoints added: [list — each regenerates hooks automatically]
- DB changes: [Prisma migration name]
- Generated: hooks/generated/{resource}.ts, mocks/generated/{resource}.ts

### Generation Pipeline
- pnpm generate: ✅ clean
- OpenAPI spec: packages/api-spec/generated/openapi.json
- React Query hooks: apps/web/src/hooks/generated/
- MSW handlers: apps/web/src/mocks/generated/

### Test Results
- Unit tests: X passing
- Integration tests: X passing
- E2E tests: X passing
- Coverage: X%

### Acceptance Criteria
- [x] AC-1: ...
- [x] AC-2: ...
```

## Cross-References

- Frontend standards: `@.claude/standards/frontend-standards.md`
- API standards: `@.claude/standards/api-standards.md`
- Test template: `@.claude/templates/jest-unit-test.ts`
- Generation pipeline: `@.claude/workflows/local-runtime-modes.md`
- Epic workflow: `@.claude/workflows/epic-based-development.md`
