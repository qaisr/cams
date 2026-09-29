# API Standards — NestJS on AWS Fargate

## Stack Reference
- NestJS 11+, TypeScript 6+
- **Compute:** AWS Fargate (NestJS Fastify container) behind an internal ALB
- RDS PostgreSQL via RDS Proxy + Prisma ORM
- **PingID only** — RS256/JWKS JWT authentication (never Cognito)
- **Zod-first** — all validation via Zod, never class-validator
- **OpenAPI generated from Zod** via `@asteasolutions/zod-to-openapi`

---

## Single Source of Truth Pipeline

```
packages/database/prisma/schema.prisma          ← EDIT THIS FIRST
  └─► zod-prisma-types ──► packages/database/generated/zod/
      └─► packages/validation/src/              (extended with OpenAPI metadata)
          └─► apps/api/src/openapi/generate-spec.ts
              └─► packages/api-spec/generated/openapi.json   ← DO NOT EDIT
                  └─► orval ──► apps/web/src/hooks/generated/ ← DO NOT EDIT
```

**NEVER** manually edit generated files. **NEVER** duplicate type definitions.

Run `pnpm generate` after any schema or DTO change.

---

## Contract-First Development

1. **Edit Prisma schema** (or Zod schemas) first — before touching any controller
2. **Run `pnpm generate`** — regenerates Zod types, OpenAPI spec, and React Query hooks
3. **Implement backend** — controllers and services must match the generated contract exactly
4. **Write contract tests** — validate live responses against the Zod schemas
5. **Validate OpenAPI spec** — run `openapi-validator` before merging

---

## Design Principles

- **Controllers**: thin — validate input, delegate to service, return response; no business logic
- **Services**: business logic, transaction boundaries, event publishing
- **Repositories**: only for complex queries — simple CRUD goes directly through Prisma in the service
- **Domain exceptions**: never throw raw `HttpException` from services; use domain exception classes
- **Structured logging**: include `correlationId` on every operation (see [Correlation ID](#correlation-id))

---

## URL & Versioning

```
GET    /v1/{resources}        List (paginated)
POST   /v1/{resources}        Create → 201 + Location header
GET    /v1/{resources}/{id}   Get by ID
PUT    /v1/{resources}/{id}   Full update
PATCH  /v1/{resources}/{id}   Partial update
DELETE /v1/{resources}/{id}   Soft delete → 204
```

- Use URL path versioning (`/v1/`, `/v2/`) — never query param or header versioning
- Breaking changes require a new version — the previous version must remain stable
- Add deprecation headers when sunsetting old versions (see `.claude/patterns/api-versioning-pattern.md`)

---

## HTTP Status Codes & Error Envelope

Status-code selection and the response-envelope rules are defined canonically in
`@.claude/standards/http-response-standards.md` — follow it for which code to
return in each scenario and for the `application/problem+json` conventions. Do
not duplicate that table here.

For API design, every endpoint's OpenAPI spec **must** document each status code
it can return (success + all applicable `400/401/403/404/409/422/429/500`), each
error using the RFC 7807 `ProblemDetail` shape below.

### RFC 7807 ProblemDetail (all errors)

```typescript
interface ProblemDetail {
  type: string;          // URI: https://api.example.com/errors/not-found
  title: string;         // Short: "Not Found"
  status: number;        // 404
  detail: string;        // Human-readable explanation
  instance: string;      // Request path
  correlationId: string; // x-correlation-id header value
  timestamp: string;     // ISO 8601
  errors?: ZodIssue[];   // Validation errors only (422 Unprocessable Entity)
}
// Implementation: @.claude/patterns/error-handling-pattern.md
```

This interface is realised as the `ErrorResponseSchema` Zod schema below so the
OpenAPI spec and the runtime filter share one definition.

---

## Zod Schema Requirements

### DTO Schemas

```typescript
// packages/validation/src/user.schema.ts
// Import z from @repo/validation (which extends Zod with OpenAPI support)
import { z } from './zod';

export const CreateUserInputSchema = z.object({
  email: z.string().email().describe('User email address').openapi({ example: 'user@example.com' }),
  firstName: z.string().min(1).max(50).describe('First name'),
  lastName: z.string().min(1).max(50).describe('Last name'),
  role: z.enum(['ADMIN', 'USER']).default('USER').describe('User role'),
}).openapi('CreateUserInput');

export const UserResponseSchema = z.object({
  id: z.string().uuid().describe('User unique identifier'),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(['ADMIN', 'USER']),
  createdAt: z.string().datetime().describe('ISO 8601 timestamp'),
}).openapi('User');
```

### Error Response Schema

```typescript
export const ErrorResponseSchema = z.object({
  type: z.string().openapi({ example: 'https://api.example.com/errors/validation' }),
  title: z.string().openapi({ example: 'Validation Failed' }),
  status: z.number().int().openapi({ example: 422 }),
  detail: z.string().openapi({ example: 'One or more fields failed validation' }),
  instance: z.string().openapi({ example: '/v1/users' }),
  correlationId: z.string().uuid(),
  timestamp: z.string().datetime(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
}).openapi('ProblemDetail');
```

---

## Zod Validation in NestJS (mandatory)

```typescript
// ✅ Request body — use ZodValidationPipe
@Post()
async create(@Body(new ZodValidationPipe(CreateUserSchema)) dto: CreateUserSchemaType) {}

// ✅ Query params — use ZodValidationPipe
@Get()
async list(@Query(new ZodValidationPipe(PaginationSchema)) q: PaginationSchemaType) {}

// ✅ Path params — use ParseUUIDPipe
@Get(':id')
async findById(@Param('id', ParseUUIDPipe) id: string) {}

// ❌ Never use class-validator / @IsEmail() / @IsNotEmpty() / class-transformer
```

---

## OpenAPI Endpoint Documentation

```typescript
import { createRoute } from '@asteasolutions/zod-to-openapi';

export const createUserRoute = createRoute({
  method: 'post',
  path: '/v1/users',
  tags: ['Users'],
  summary: 'Create a user',
  description: 'Creates a new user account. Emits a UserCreated event.',
  request: {
    body: {
      content: { 'application/json': { schema: CreateUserInputSchema } },
    },
  },
  responses: {
    201: {
      description: 'User created successfully',
      content: { 'application/json': { schema: UserResponseSchema } },
    },
    422: {
      description: 'Validation error (body parsed but fields invalid)',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'User already exists',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});
```

### Required Documentation for Each Endpoint

1. **Description** — concise summary + side effects (emails sent, events emitted)
2. **Request** — all parameters (path, query, header, body); type, constraints, required/optional, defaults, examples
3. **Response** — schema for every status code; success and error examples; pagination format if applicable
4. **Errors** — all 4xx and 5xx codes that the endpoint can return

---

## Pagination Standard

```typescript
// packages/validation/src/pagination.schema.ts
export const PaginationSchema = z
  .object({
    page:      z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit:     z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
    sortBy:    z.string().optional().openapi({ example: 'createdAt' }),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .openapi('Pagination');

// Response envelope
export const PaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    data:  z.array(itemSchema),
    total: z.number().int(),
    page:  z.number().int(),
    limit: z.number().int(),
  });

// Sort allowlist — always validate sortBy against known fields
const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'name', 'status']);
if (sortBy && !ALLOWED_SORT_FIELDS.has(sortBy)) {
  throw new ValidationException([{ field: 'sortBy', message: 'Invalid sort field' }]);
}
```

---

## Filtering Standard

```typescript
// Extend per-entity with relevant filter fields
export const BaseFilterSchema = z.object({
  createdAfter:  z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  search:        z.string().optional().describe('Full-text search across key fields'),
}).openapi('BaseFilter');
```

---

## Correlation ID

```typescript
// CorrelationIdMiddleware (already configured in AppModule):
// - Reads x-correlation-id request header; auto-generates UUID v4 if absent
// - Sets x-correlation-id on the response
// - Must be propagated to all service method calls and included in every log entry
// See: @.claude/patterns/error-handling-pattern.md#correlation-id-middleware
```

---

## Structured Logging

```typescript
// Use NestJS Logger — JSON format in production via Pino
this.logger.log({
  action: 'createUser',
  status: 'started',
  correlationId,
  resourceId: dto.id,
});

this.logger.error({
  action: 'createUser',
  status: 'error',
  correlationId,
  error: err.message, // Never log stack traces in production
});

// NEVER log: passwords, tokens, PANs, raw PII (name, email, DOB)
// DO log:    correlationId, action, status, resource IDs, durations, error messages
```

---

## Compute entry point

The API runs as a long-lived NestJS (Fastify) process on Fargate. Bootstrap the
app and `listen()` as a normal server (`apps/api/src/main.ts`); the container
serves the internal ALB target group. The service is always warm — no scale-out
lag on interactive paths.

---

## Contract Testing

Unit-level contract tests (supertest) go in `apps/api/src/contracts/`:

```typescript
// apps/api/src/contracts/users.contract.spec.ts
// See template: @.claude/templates/api-contract-test.ts
const result = UserResponseSchema.safeParse(body);
if (!result.success) {
  console.error('Schema violations:', JSON.stringify(result.error.format(), null, 2));
}
expect(result.success).toBe(true);
```

E2E contract validation (Playwright) goes in `apps/web/e2e/`:

```typescript
// apps/web/e2e/api/users.contract.spec.ts
import { test, expect } from '@playwright/test';

test('POST /v1/users matches OpenAPI spec', async ({ request }) => {
  const response = await request.post('/v1/users', {
    data: { email: 'test@example.com', firstName: 'Test', lastName: 'User' },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  const result = UserResponseSchema.safeParse(body);
  expect(result.success).toBe(true);
});
```

---

## Quality Gates

### Schema Quality
- [ ] All schemas imported from `@repo/validation` (never raw `zod`)
- [ ] All schemas have `.openapi('Name')` registration
- [ ] All fields have `.describe()` descriptions and `.openapi({ example })` values
- [ ] Error responses use RFC 7807 ProblemDetail shape
- [ ] Generated OpenAPI spec validates with `openapi-validator`
- [ ] Generated React Query hooks compile without errors

### Before Every Commit

```bash
pnpm generate         # Regenerate after any schema/DTO change
pnpm lint             # ESLint zero warnings
pnpm type-check       # tsc --noEmit zero errors
pnpm test             # Unit tests pass
```

### Before PR

```bash
pnpm test:integration             # Testcontainers integration tests
pnpm build                        # Verify build succeeds
./.claude/scripts/verify-quality.sh --profile full
```

### Implementation Checklist
- [ ] Generation pipeline run after any schema/DTO change
- [ ] Controllers thin — no business logic
- [ ] All endpoints use `ZodValidationPipe` (no class-validator)
- [ ] All errors use domain exceptions (not raw `HttpException`)
- [ ] RFC 7807 ProblemDetail on all error responses
- [ ] `correlationId` propagated in all service calls and log entries
- [ ] Pagination on all list endpoints with sort allowlist
- [ ] Unit tests: all branches covered
- [ ] Integration tests: Testcontainers + supertest
- [ ] No `any` types
- [ ] No stack traces in error responses
- [ ] No hardcoded secrets

---

## Cross-References

- Architecture: `.claude/standards/architecture-design-standards.md`
- Database: `.claude/standards/database-standards.md`
- Security: `.claude/standards/security-standards.md`
- Observability: `.claude/standards/observability-standards.md`
- HTTP responses & status codes: `.claude/standards/http-response-standards.md`
- Error handling: `.claude/patterns/error-handling-pattern.md`
- Zod + OpenAPI pattern: `.claude/patterns/zod-openapi-pattern.md`
- API versioning: `.claude/patterns/api-versioning-pattern.md`
- Controller template: `.claude/templates/nestjs-controller.ts`
- Contract test template: `.claude/templates/api-contract-test.ts`
- Workflows: `.claude/workflows/api-contract-workflow.md`

## Token Optimization

- **Load when**: any backend API work — new endpoint, DTO change, OpenAPI edit, error contract review.
- **Load only**: this standard + `zod-openapi-pattern.md` + `error-handling-pattern.md`. Add `http-response-standards.md` for status-code decisions and `pagination-cursor-pattern.md` only when paginating.
- **Unload after**: endpoint shipped, contract test passes, OpenAPI spec regenerated.
