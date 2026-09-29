---
description: Add a single API endpoint — Zod DTO, OpenAPI registration, controller, service, unit tests
agent: backend-engineer
subtask: true
---
# Add Endpoint

## Input
$ARGUMENTS
Examples:
- `GET /v1/orders/{id}/items`
- `POST /v1/products/batch-update`
- `PATCH /v1/users/{id}/status requires admin permission`
- `DELETE /v1/resources/{id} soft delete`

## Process

### Step 1: Parse & Clarify
Extract: HTTP method, path, path params, special requirements.
If ambiguous, ask:
````

1. New controller or adding to existing?
2. Request body shape? (POST/PUT/PATCH)
3. Response shape?
4. Permission required beyond default read/write?
5. Sync or async (EventBridge event)?

````

### Step 2: Read Existing Code
```bash
find apps/api/src/modules -name "*.controller.ts" | head -10
cat packages/database/generated/zod/index.ts | grep "export const {Entity}"
cat packages/validation/src/{resource}.schema.ts
````

### Step 3: Update Zod Schema + OpenAPI Registration

**Before implementation**:

```typescript
// 1. Add/update DTO in packages/validation/src/{resource}.schema.ts
// 2. Register path in apps/api/src/openapi/generate-spec.ts
// 3. Run generation pipeline
pnpm --filter @repo/database generate
tsx apps/api/src/openapi/generate-spec.ts
pnpm --filter @repo/web orval
```

### Step 4: Add Controller Method

Follow `@.claude/templates/nestjs-controller.ts`:

```typescript
@{Method}('{path}')
@HttpCode(HttpStatus.{STATUS})
@RequirePermissions('{resource}:{action}')
@ApiOperation({ summary: '{description}' })
async {methodName}(
  @Param('id', ParseUUIDPipe) id: string,
  @Body(new ZodValidationPipe({RequestDto})) dto: {RequestDtoType},
  @Headers('x-correlation-id') correlationId?: string,
) {
  return this.{entity}Service.{methodName}(id, dto, correlationId);
}
```

Rules:

- Controllers are thin — validate, delegate, return
- No business logic in controllers
- Always pass correlationId to service

### Step 5: Add Service Method

Follow `@.claude/templates/nestjs-service.ts`:

```typescript
async {methodName}(id: string, dto: {DtoType}, correlationId?: string) {
  this.logger.log({ action: '{methodName}', status: 'started', id, correlationId });
  // business logic
  // throw domain exception if not found/conflict
  // publish EventBridge event if state change
  this.logger.log({ action: '{methodName}', status: 'success', id, correlationId });
  return this.toResponse(result);
}
```

### Step 6: Generate and Run Tests

```bash
pnpm test --testPathPattern="{entity}.service" --verbose
```

Cover: happy path, not-found, validation, wrong permission, error propagation.
Fix all failures.

### Step 7: Checklist

- [ ] Zod DTO updated with OpenAPI metadata
- [ ] OpenAPI path registered in generate-spec.ts
- [ ] Generation pipeline run (spec + hooks regenerated)
- [ ] Controller method is thin (delegates only)
- [ ] Service has structured logging with correlationId
- [ ] Domain exception thrown (not raw HttpException)
- [ ] Permission checked via @RequirePermissions
- [ ] EventBridge event published on state changes
- [ ] Unit tests passing

## Cross-References

- Full feature: `/add-feature`
- API standards: `@.claude/standards/api-standards.md`
- Templates: `@.claude/templates/nestjs-controller.ts`, `nestjs-service.ts`
