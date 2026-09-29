# Templates Library

All templates live in `.claude/templates/`.

## Requirements & Documentation

| Template                               | Format   | Purpose                                                                                                                                                                |
| -------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `business-requirements.md`             | Markdown | Detailed business context template with goals, constraints, and scope — single source of truth for planning, design, and implementation.                               |
| `functional-specifications.md`         | Markdown | Full functional spec template with implementation-ready technical detail and inline design diagrams — single source of truth for planning, design, and implementation. |
| `requirements-traceability-matrix.md`  | Markdown | RTM template mapping requirements → user stories → test cases → implementation.                                                                                        |
| `data-dictionary-template.md`          | Markdown | Data dictionary template — entity definitions, field types, constraints, and business rules.                                                                           |
| `adr-template.md`                      | Markdown | Architecture Decision Record — context, options, decision, consequences (positive + negative).                                                                         |
| `release-notes-template.md`            | Markdown | Structured release notes — new features, fixes, breaking changes, migration guide.                                                                                     |
| `deployment-runbook-template.md`       | Markdown | Deployment runbook — pre-deploy checklist, deploy steps, smoke tests, rollback procedure.                                                                              |
| `epic-index-template.md`               | Markdown | Epic tracker template — status table, sequencing, dependencies, lifecycle states (`pending` → `complete`).                                                             |
| `epic-task-index-template.md`          | Markdown | Per-epic task tracker template — task list, dependencies, parallelizable groups, acceptance criteria.                                                                  |
| `epic-revision-record.md`              | Markdown | Per-epic migration plan — preserve/extend/rework analysis and migration options.                                                                                       |
| `implemented-epic-summary-template.md` | Markdown | Post-implementation summary written to `specs/epics-implemented/` — actual scope delivered, deviations, follow-ups.                                                    |

## API & Backend (TypeScript)

| Template                     | Format     | Purpose                                                                                                                                                                  |
| ---------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `openapi-endpoint.yaml`      | YAML       | OpenAPI endpoint template with PingID security and shared error conventions.                                                                                             |
| `nestjs-controller.ts`       | TypeScript | NestJS controller template with ZodValidationPipe and @RequirePermissions                                                                                                |
| `nestjs-service.ts`          | TypeScript | Service template with Prisma, Pino logging, EventBridge events                                                                                                           |
| `nestjs-repository.ts`       | TypeScript | Thin Prisma repository wrapper for complex queries                                                                                                                       |
| `nestjs-module.ts`           | TypeScript | NestJS feature module template — providers, controllers, imports, exports wired up.                                                                                      |
| `nestjs-guard.ts`            | TypeScript | RBAC authorization reference — canonical `@RequirePermissions` + `@CurrentUser` usage against the global deny-precedence `PermissionsGuard` (do NOT hand-roll `@Roles`). |
| `zod-dto-schema.ts`          | TypeScript | Zod DTO schema template — Create/Update/Patch/Response/List schemas with `.openapi()` metadata; import `z` from `@repo/validation`.                                      |
| `nestjs-exception-filter.ts` | TypeScript | Global exception filter — RFC 7807 error format, correlation ID, structured logging.                                                                                     |
| `background-job.ts`          | TypeScript | SQS-polling Fargate worker — schema validation, DLQ, progress logging, retry.                                                                                            |
| `feature-flag.ts`            | TypeScript | Feature flag evaluation service — environment-based toggles with runtime override support.                                                                               |
| `prisma-migration.ts`        | TypeScript | Prisma migration script template — idempotent backfill with chunking, progress, and rollback.                                                                            |
| `prisma-seed.ts`             | TypeScript | Prisma seed script template — deterministic seed data using factories and faker.                                                                                         |
| `seed-factory.ts`            | TypeScript | Seed factory template — typed entity factories for seed data and test fixtures.                                                                                          |
| `zod-transform-validator.ts` | TypeScript | Zod transform and preprocess templates — DTO normalization, coercion, custom refinements.                                                                                |

## Frontend (TypeScript/TSX)

| Template                        | Format         | Purpose                                                                                                          |
| ------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| `nextjs-page.tsx`               | TypeScript/TSX | NextJS protected page template with PingID.                                                                      |
| `nextjs-component.tsx`          | TypeScript/TSX | Reusable NextJS UI component template.                                                                           |
| `nextjs-api-client.ts`          | TypeScript     | Typed API client template with Zod validation and correlation IDs.                                               |
| `react-hook-form-component.tsx` | TypeScript/TSX | React Hook Form + Zod component — `useForm`, `zodResolver`, field errors, server error handling.                 |
| `react-error-boundary.tsx`      | TypeScript/TSX | Next.js App Router `error.tsx` / `global-error.tsx` boundary — `{ error, reset }`, digest reporting, a11y alert. |
| `storybook-story.tsx`           | TypeScript/TSX | Storybook CSF3 story template — default export, named variants, play function, a11y addon.                       |

## Testing (TypeScript)

| Template                         | Format         | Purpose                                                                                                            |
| -------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------ |
| `nestjs-service-unit-test.ts`    | TypeScript     | Full NestJS service test — all CRUD, soft-delete, EventBridge publish assertions, error propagation.               |
| `nestjs-controller-unit-test.ts` | TypeScript     | NestJS controller delegation test — HTTP codes, DTO passthrough, guard verification.                               |
| `nestjs-integration-test.ts`     | TypeScript     | Full integration test — Testcontainers PostgreSQL, supertest, RFC 7807 error envelope assertions.                  |
| `jest-unit-test.ts`              | TypeScript     | Jest + RTL + MSW template with QueryClient isolation and generated handler patterns                                |
| `react-component-test.tsx`       | TypeScript/TSX | React component test — default/loading/error/empty states, user interactions, accessibility queries, keyboard nav. |
| `react-hook-test.tsx`            | TypeScript/TSX | Custom React hook test — optimistic updates, cache invalidation, MSW integration.                                  |
| `playwright-e2e.ts`              | TypeScript     | Playwright E2E template using POM and PingID-authenticated flows.                                                  |
| `playwright-page-object.ts`      | TypeScript     | Enhanced Page Object Model template — readonly locators, no assertions in POM, `goto()` contract.                  |
| `playwright-api-mock.ts`         | TypeScript     | Playwright API mocking template — route interception with response factories and error scenarios.                  |
| `playwright-fixtures.ts`         | TypeScript     | Playwright fixture template — authenticated sessions with storage state and custom fixture composition.            |
| `fixture-factory.ts`             | TypeScript     | Combined Prisma model + DTO + response DTO factory template with deterministic seed IDs.                           |
| `api-contract-test.ts`           | TypeScript     | API contract test template — OpenAPI spec conformance, request/response schema validation.                         |
| `performance-test.ts`            | TypeScript     | k6 / Artillery performance test template — load scenario, thresholds, SLO validation.                              |

## CI/CD (YAML)

| Template                    | Format | Purpose                                                                                            |
| --------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| `github-actions-ci.yml`     | YAML   | GitHub Actions CI pipeline — lint, typecheck, unit tests, integration tests, build, security scan. |
| `github-actions-deploy.yml` | YAML   | GitHub Actions deploy pipeline — staging deploy, smoke tests, production gate, rollback trigger.   |

## Accessibility & UI Standards

| Template                               | Format   | Purpose                                                                                    |
| -------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `accessibility-test-cases-template.md` | Markdown | Accessibility test cases — WCAG criterion, severity, manual + automated checks.            |
| `ui-spec-template.md`                  | Markdown | UI specification template — component states, accessibility notes, responsive breakpoints. |
| `navigation-test-cases-template.md`    | Markdown | Navigation test cases — keyboard flow, skip links, focus order, screen reader.             |
| `pagination-test-cases-template.md`    | Markdown | Pagination test cases — cursor nav, URL state, loading states, empty/edge cases.           |
