# Workflow: API Contract-First Development (Zod → OpenAPI → React Query)

## Purpose
Maintain integrity of the Zod → OpenAPI → orval pipeline. Covers both green-field
endpoint development and change management when existing API schemas or endpoints evolve.

## When to Use
- New API endpoint being created from scratch
- Existing endpoint request/response schema changed
- After any Prisma schema change that affects API responses
- After `pnpm prisma generate` runs
- Before raising a PR that touches API or frontend data fetching

## Agents
- Primary: `api-contract-analyst`
- Support: `backend-engineer` (Zod schema authoring, NestJS implementation), `frontend-developer` (hook consumption)
- Unload agents not needed for the current step

## The Pipeline
```
prisma/schema.prisma
  └─► zod-prisma-types  →  packages/database/generated/zod/
  └─► packages/validation/src/  (extend with OpenAPI metadata)
  └─► apps/api/src/openapi/generate-spec.ts
  └─► packages/api-spec/generated/openapi.json
  └─► orval  →  apps/web/src/hooks/generated/
              └─► apps/web/src/mocks/generated/
```

---

## Part 1: New API Endpoint (Green Field)

### Step 1: Define Zod Schemas

Create Zod schemas for request/response in `packages/validation/src/`.

```typescript
// packages/validation/src/{{feature}}/{{feature}}.schema.ts
import { z } from './zod'; // Always import from './zod', NOT from 'zod' directly

export const CreateDocumentInputSchema = z.object({
  title: z.string().min(1).max(255).openapi({ example: 'My Document' }),
  status: z.enum(['draft', 'review', 'published']).default('draft').openapi({ example: 'draft' }),
}).openapi('CreateDocumentInput');

export const DocumentSchema = z.object({
  id: z.string().openapi({ description: 'Unique identifier (CUID)' }),
  title: z.string().max(255).openapi({ example: 'My Document' }),
  status: z.enum(['draft', 'review', 'published']).openapi({ example: 'draft' }),
  createdAt: z.string().datetime().openapi({ description: 'ISO 8601 UTC' }),
}).openapi('Document');

export type CreateDocumentInput = z.infer<typeof CreateDocumentInputSchema>;
export type Document = z.infer<typeof DocumentSchema>;
```

> **Note**: `extendZodWithOpenApi(z)` is called **once** in `packages/validation/src/zod.ts`.
> All schema files must import `z` from `'./zod'`, never from `'zod'` directly.
> See `.claude/patterns/zod-openapi-pattern.md`.

### Step 2: Register in OpenAPI Registry

```typescript
// apps/api/src/openapi/registry.ts
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { CreateDocumentInputSchema, DocumentSchema } from '@repo/validation';
import fs from 'fs';

export const registry = new OpenAPIRegistry();

// Register schemas
registry.register('Document', DocumentSchema);
registry.register('CreateDocumentInput', CreateDocumentInputSchema);

// Register paths
registry.registerPath({
  method: 'post',
  path: '/documents',
  tags: ['Documents'],
  summary: 'Create a new document',
  request: {
    body: {
      content: { 'application/json': { schema: CreateDocumentInputSchema } },
    },
  },
  responses: {
    201: {
      description: 'Document created',
      content: { 'application/json': { schema: DocumentSchema } },
    },
    422: { description: 'Validation error' },
  },
});

// Generate and write spec
const generator = new OpenApiGeneratorV3(registry.definitions);
const spec = generator.generateDocument({
  openapi: '3.1.0',
  info: { title: 'App API', version: '1.0.0' },
  servers: [{ url: 'https://api.example.com' }],
});

fs.writeFileSync(
  'packages/api-spec/generated/openapi.json',
  JSON.stringify(spec, null, 2),
);
```

### Step 3: Generate & Validate OpenAPI Spec

```bash
pnpm generate:spec
# Outputs: packages/api-spec/generated/openapi.json

# Validate the spec is well-formed
npx @redocly/cli lint packages/api-spec/generated/openapi.json
```

### Step 4: Generate React Query Hooks

```bash
pnpm generate:hooks
# Outputs: apps/web/src/hooks/generated/  (DO NOT EDIT)
#          apps/web/src/mocks/generated/   (DO NOT EDIT)
```

The `orval.config.ts` controls hook generation:
```typescript
// orval.config.ts (already configured — reference only)
module.exports = {
  api: {
    input: 'packages/api-spec/generated/openapi.json',
    output: {
      mode: 'tags-split',
      target: 'apps/web/src/hooks/generated',
      client: 'react-query',
    },
  },
};
```

Generated hooks are consumed like this — **never write `useQuery`/`useMutation` manually**:
```typescript
// apps/web/src/components/CreateDocumentForm.tsx
import { useCreateDocument } from '@/hooks/generated/documents/documents';
import { CreateDocumentInput } from '@repo/validation';

export function CreateDocumentForm() {
  const createDocument = useCreateDocument();

  const handleSubmit = async (data: CreateDocumentInput) => {
    const doc = await createDocument.mutateAsync(data);
    toast.success(`Document "${doc.title}" created`);
  };
  // ...
}
```

### Step 5: Implement Backend

```typescript
// apps/api/src/documents/documents.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { CreateDocumentInputSchema, DocumentSchema } from '@repo/validation';
import { ZodValidationPipe } from 'nestjs-zod';

@Controller('documents')
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Post()
  async create(@Body(new ZodValidationPipe(CreateDocumentInputSchema)) dto: CreateDocumentInput) {
    const doc = await this.documentsService.create(dto);
    return DocumentSchema.parse(doc); // Validate output shape
  }
}
```

### Step 6: Write Contract Tests

Verify the backend implementation matches the OpenAPI spec:

```typescript
// apps/api/test/contract/documents.contract.spec.ts
import { test, expect } from '@playwright/test';
import { CreateDocumentInputSchema, DocumentSchema } from '@repo/validation';

test('POST /documents matches contract', async ({ request }) => {
  const input = { title: 'Test Doc', status: 'draft' };

  const response = await request.post('/documents', { data: input });

  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(DocumentSchema.safeParse(body).success).toBe(true);
});

test('POST /documents validates input', async ({ request }) => {
  const response = await request.post('/documents', { data: { title: '' } });
  expect(response.status()).toBe(400);
});
```

### Step 7: Implement Frontend

Use the generated hook at call sites. See generated file `apps/web/src/hooks/generated/` for exact hook names and types.

---

## Part 2: Modifying Existing API (Change Management)

### Step 1: Identify Changed Schemas

```bash
git diff --name-only HEAD~1 | grep 'packages/validation/src'
```

Classify each change:
- **Additive** (new optional field, new endpoint) — non-breaking, safe to proceed
- **Breaking** (removed field, renamed field, type change, new required field) — requires versioning

### Step 2: Regenerate OpenAPI Spec

```bash
pnpm turbo run codegen:spec
```

Review the diff:
```bash
git diff packages/api-spec/generated/openapi.json
```
- Additive changes: proceed
- Breaking changes: bump API version path (`/v2/`) or add deprecation before proceeding

### Step 3: Regenerate orval Hooks

```bash
pnpm turbo run codegen:hooks
```

Review generated changes in `apps/web/src/hooks/generated/`.
Verify React Query hooks match expected API shape.

### Step 4: Run Contract Tests

```bash
pnpm turbo run test:contract
```

All contract tests in `apps/api/src/contracts/` must pass.

### Step 5: Update Frontend Usage (if breaking)

If hook signatures changed:
1. Update all hook call sites in `apps/web/src/`
2. Update MSW handlers in `apps/web/src/mocks/handlers/`
3. Run frontend unit tests: `pnpm turbo run test:unit --filter=web`

### Step 6: Verify E2E

```bash
pnpm turbo run test:e2e
```

### Step 7: Commit in Order

```bash
git add packages/validation/src/          # 1. Schema changes
git add packages/api-spec/generated/      # 2. Spec (auto-generated)
git add apps/web/src/hooks/generated/     # 3. Hooks (auto-generated)
git add apps/web/src/mocks/generated/     # 4. MSW mocks (auto-generated)
git add apps/web/src/                     # 5. Updated usages
git commit -m "feat(api): [description of change]"
```

---

## Breaking Change Protocol

When a breaking change is unavoidable:

1. Add new version endpoint (`/v2/`) — keep `/v1/` operational
2. Add `@deprecated` annotation to the `v1` OpenAPI operation
3. Set sunset header: `Sunset: <date 90 days out>`
4. Update frontend to use the `v2` endpoint
5. Remove `v1` after sunset date (track as a tech debt ticket)

### Breaking Change Policy Table

| Change Type | Breaking? | Action |
|-------------|-----------|--------|
| Add optional field | No | Safe, proceed |
| Add required field | Yes | Version endpoint or make optional |
| Remove field | Yes | Deprecate first, remove in v2 |
| Change field type | Yes | Version endpoint |
| Add new endpoint | No | Safe, proceed |
| Remove endpoint | Yes | Deprecate with 410 response first |
| Change status code | Yes | Major version bump |

---

## Full Pipeline (Single Command)

```bash
# Runs: generate:zod → generate:openapi → generate:hooks
pnpm generate
```

Or step-by-step:
```bash
pnpm generate:prisma  # Step 1: Prisma client + Zod schemas
pnpm generate:spec    # Step 2: OpenAPI JSON
pnpm generate:hooks   # Step 3+4: React Query hooks + MSW handlers
```

## CI Gate: Spec Sync Check
```yaml
# .github/workflows/ci.yml
- name: Check no uncommitted generated files
  run: git diff --exit-code packages/api-spec/generated/openapi.json || exit 1
```

---

## Quality Gates / Checklist
- [ ] Zod schemas updated and validated
- [ ] OpenAPI spec regenerated (`pnpm generate:spec`) and diff reviewed
- [ ] orval hooks regenerated (`pnpm generate:hooks`)
- [ ] Contract tests pass
- [ ] TypeScript compiles without errors (`pnpm type-check`)
- [ ] Frontend hook call sites updated (if breaking change)
- [ ] MSW handlers updated (if breaking change)
- [ ] No breaking changes without a versioning plan
- [ ] E2E tests pass
- [ ] PR description explains API change and migration path
- [ ] API documentation (Swagger UI) reflects changes

---

## Workflow Diagram

```
┌──────────────────────────┐
│ 1. Define Zod Schemas    │
│    packages/validation/  │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ 2. Register in OpenAPI   │
│    Registry              │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ 3. Generate OpenAPI Spec │
│    pnpm generate:spec    │
└──────────┬───────────────┘
           │
           ├─────────────────────┐
           ▼                     ▼
┌──────────────────┐   ┌──────────────────────┐
│ 4. Generate      │   │ 5. Implement Backend │
│    React Query   │   │    (NestJS)          │
│    Hooks (orval) │   └──────────┬───────────┘
└──────┬───────────┘              │
       │                          ▼
       │               ┌──────────────────────┐
       │               │ 6. Write Contract    │
       │               │    Tests             │
       │               └──────────┬───────────┘
       │                          │
       ▼                          ▼
┌─────────────────────────────────────────────┐
│ 7. Implement Frontend (use generated hooks) │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│ Quality Gates: type-check, tests, lint, E2E │
└─────────────────────────────────────────────┘
```

## Token Optimization
- Load only agents needed for the current step
- Unload `api-contract-analyst` after the classification step
- Reference schemas by import path, not full inline content
pnpm turbo run generate
# Runs: generate:zod → generate:openapi → generate:hooks
```

## CI Gate: Spec Sync Check
```yaml
# In GitHub Actions (already in github-actions-ci.yml template):
- name: Check no uncommitted generated files
  run: git diff --exit-code packages/api-spec/generated/openapi.json || exit 1
```

## Breaking Change Policy
| Change Type | Breaking? | Action |
|-------------|-----------|--------|
| Add optional field | ❌ | Safe, proceed |
| Add required field | ✅ | Version endpoint or make optional |
| Remove field | ✅ | Deprecate first, remove in v2 |
| Change field type | ✅ | Version endpoint |
| Add new endpoint | ❌ | Safe, proceed |
| Remove endpoint | ✅ | Deprecate with 410 response first |
| Change status code | ✅ | Major version bump |
