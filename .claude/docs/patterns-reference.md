# Pattern Library

All patterns live in `.claude/patterns/`.

## API & Backend

| Pattern | Area | Purpose |
| --- | --- | --- |
| `pingid-auth-pattern.md` | Security/Auth | PingID-only authentication architecture for protected frontend/backend routes. |
| `error-handling-pattern.md` | Reliability/API | Structured error handling pattern using RFC 7807 and correlation IDs. |
| `api-contract-testing-pattern.md` | API | Consumer-driven contract testing — Zod schema validation, Pact, and OpenAPI spec conformance. |
| `api-versioning-pattern.md` | API | URL-based API versioning, deprecation headers, and sunset strategy for NestJS controllers. |
| `audit-log-pattern.md` | Reliability | Immutable audit trail — Prisma `AuditLog` model, append-only writes, who/what/when/why. |
| `background-job-pattern.md` | Integration | Async job processing using scheduled ECS Fargate tasks or SQS-polling Fargate workers with DLQ, retry, and observability. |
| `cache-strategy-pattern.md` | Performance | Multi-tier caching: React Query → Redis → API Gateway → CDN with invalidation rules. |
| `database-migration-pattern.md` | Database | Safe Prisma migration workflow — SQL review, index concurrency, rollback header, zero-downtime rules. |
| `feature-flag-pattern.md` | Delivery | Feature flag evaluation using environment config and runtime toggles; integrates with NestJS guards. |
| `observability-pattern.md` | Reliability | Logs + Metrics + Traces interceptor — X-Ray trace IDs, CloudWatch metrics emission, request lifecycle. |
| `pagination-cursor-pattern.md` | API | Cursor-based pagination — Zod schema, Prisma query, response factory, and React Query infinite scroll. |
| `prisma-repository-pattern.md` | Database | Typed Prisma repository classes — encapsulate queries, cursor pagination, soft-delete, scoped by orgId. |
| `prisma-transaction-pattern.md` | Database | `prisma.$transaction()` patterns — interactive transactions, idempotency, rollback guidance. |
| `zod-transformation-pattern.md` | Validation | Zod `.transform()`, `.preprocess()`, coerce patterns — DTO mapping and input normalization. |

## Frontend & UI

| Pattern | Area | Purpose |
| --- | --- | --- |
| `component-architecture.md` | Frontend | Component folder layout, `forwardRef`, CVA variants, prop typing, default exports vs named exports, slot composition. |
| `form-validation-pattern.md` | Frontend | React Hook Form + Zod — `useForm`, `zodResolver`, field-level errors, server error merge. |
| `optimistic-update-pattern.md` | Frontend | TanStack Query optimistic mutation — `onMutate` / `onError` rollback / `onSettled` invalidation. |
| `orval-codegen-pattern.md` | Frontend | orval configuration, pipeline trigger, custom fetch mutator, MSW handler generation. |
| `state-management-pattern.md` | Frontend | State hierarchy: `useState` → Context → React Query → URL params — with Zustand for complex UI state. |

## Infrastructure & Integration

| Pattern | Area | Purpose |
| --- | --- | --- |
| `rds-proxy-pattern.md` | Data Access | RDS Proxy pattern to protect PostgreSQL connections under bursty workloads. |
| `sns-event-pattern.md` | Integration | SNS-based asynchronous event communication between services. |
| `eventbridge-pattern.md` | Integration | EventBridge event bus — schema registry, rule matching, Fargate worker target, dead-letter handling. |
| `cdk-infrastructure-pattern.md` | Infrastructure | Standard AWS CDK stack and networking patterns for PPCC environments. |
| `opensearch-derived-index-pattern.md` | Search (Phase 2+) | Lean reference for the Phase-2+ derived, CDC-fed, rebuildable OpenSearch index — Postgres stays the SoR; Phase-1 search is Postgres-only. |

## Testing

| Pattern | Area | Purpose |
| --- | --- | --- |
| `testcontainers-pattern.md` | Testing | Correct Testcontainers usage — one container per suite, migration strategy, data reset, anti-patterns. |
| `msw-handler-pattern.md` | Testing | MSW v2 server setup, global handlers, per-test overrides, `onUnhandledRequest: 'error'` discipline. |
| `fixture-factory-pattern.md` | Testing | Factory pattern for test data — Prisma model, DTO, and response DTO factories with faker seed. |
| `playwright-page-object-pattern.md` | E2E Testing | Canonical Page Object Model — readonly locators, no assertions in POM, `goto()` contract. |
| `playwright-fixture-pattern.md` | E2E Testing | Playwright fixture setup for authenticated sessions and API mocking with route interception. |

## Zod / OpenAPI

| Pattern | Area | Purpose |
| --- | --- | --- |
| `zod-openapi-pattern.md` | Validation/API | `extendZodWithOpenApi` setup, `.openapi()` metadata, registry registration, spec generation. |
