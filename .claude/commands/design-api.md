---
description: Design API — Zod DTOs with OpenAPI metadata, register paths, regenerate spec
agent: backend-engineer
subtask: true
---
# API Design

## Input
$ARGUMENTS (resource name — e.g. "user management" or "POST /v1/users")

## Process

### 1. Read Context
- Read `@specs/functional-specifications.md`
- Check `packages/database/generated/zod/` (generated base schemas)
- Check `packages/validation/src/` (existing extended schemas)
- Check `apps/api/src/openapi/generate-spec.ts` (existing path registrations)

### 2. Design Decisions
Confirm before writing:
- Resource name (plural noun, kebab-case)
- Required operations (CRUD subset)
- Pagination on list? Filtering/sorting params?
- Async operations needed (EventBridge)?
- Nested resources?

### 3. Extend Zod Schemas with OpenAPI Metadata
```typescript
// packages/validation/src/{resource}.schema.ts
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from '@repo/validation';
import { {Entity}Schema, {Entity}CreateInputSchema } from '@repo/database/generated/zod';

extendZodWithOpenApi(z);

export const Create{Entity}Dto = {Entity}CreateInputSchema
  .extend({
    email: z.string().email().openapi({ example: 'user@example.com' }),
  })
  .openapi('Create{Entity}Dto');

export const {Entity}ResponseDto = {Entity}Schema
  .omit({ password: true, deletedAt: true })
  .openapi('{Entity}ResponseDto');

export const Update{Entity}Dto = Create{Entity}Dto.partial().openapi('Update{Entity}Dto');

export type Create{Entity}DtoType = z.infer<typeof Create{Entity}Dto>;
export type {Entity}ResponseDtoType = z.infer<typeof {Entity}ResponseDto>;
````

### 4. Register OpenAPI Paths

```typescript
// apps/api/src/openapi/generate-spec.ts — add to registry

registry.registerPath({
  method: 'post',
  path: '/v1/{resources}',
  tags: ['{Entities}'],
  summary: 'Create {entity}',
  security: [{ JWT: [] }],
  request: {
    headers: z.object({ 'x-correlation-id': z.string().optional() }),
    body: { content: { 'application/json': { schema: Create{Entity}Dto } } },
  },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: {Entity}ResponseDto } } },
    422: { description: 'Validation error' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden' },
    409: { description: 'Conflict' },
  },
});
```

### 5. Run Generation Pipeline

```bash
pnpm --filter @repo/database generate
tsx apps/api/src/openapi/generate-spec.ts   # → packages/api-spec/generated/openapi.json
pnpm --filter @repo/web orval               # → apps/web/src/hooks/generated/
```

### 6. API Contract Review

- [ ] All endpoints registered in generate-spec.ts
- [ ] Request DTOs have Zod validation
- [ ] All HTTP status codes documented (200/201/400/401/403/404/409/500)
- [ ] Pagination on list endpoints
- [ ] Sort fields documented
- [ ] JWT security scheme applied
- [ ] x-correlation-id header documented
- [ ] RFC 7807 ProblemDetail schema referenced for errors
- [ ] Generation pipeline runs cleanly

## Output Files

- Validation schemas: `packages/validation/src/{resource}.schema.ts`
- OpenAPI spec: `packages/api-spec/generated/openapi.json` (regenerated)
- React Query hooks: `apps/web/src/hooks/generated/` (regenerated)

## Cross-References

- Implementation: `/add-feature`
- Standards: `@.claude/standards/api-standards.md`
- Templates: `@.claude/templates/nestjs-controller.ts`
