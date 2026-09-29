# API Contract Testing Pattern

## Purpose
Verify that the OpenAPI spec (generated from Zod) matches actual API behavior,
and that the frontend orval client correctly handles real API responses.

## Layer 1: Schema Validation Tests (Backend)
```typescript
// apps/api/src/contracts/document.contract.spec.ts
import { generateSchema } from '@anatine/zod-nestjs';
import { DocumentResponseSchema } from '@repo/validation';

describe('Document API Contract', () => {
  let app: INestApplication;
  let request: supertest.SuperTest<supertest.Test>;

  beforeAll(async () => {
    app = await createTestApp();
    request = supertest(app.getHttpServer());
  });

  it('GET /documents/:id response matches Zod schema', async () => {
    const { body } = await request
      .get('/documents/test-doc-id')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);

    // Assert response body conforms to Zod schema
    const result = DocumentResponseSchema.safeParse(body);
    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('Schema violations:', result.error.format());
    }
  });

  it('POST /documents request is validated', async () => {
    const { body } = await request
      .post('/documents')
      .send({ title: '' }) // invalid: empty title
      .set('Authorization', `Bearer ${validToken}`)
      .expect(422);

    expect(body).toMatchObject({
      statusCode: 422,
      errors: expect.arrayContaining([
        expect.objectContaining({ field: 'title' }),
      ]),
    });
  });
});
```

## Layer 2: OpenAPI Spec Drift Detection
```typescript
// packages/api-spec/src/validate-spec.ts
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import deepEqual from 'fast-deep-equal';

describe('OpenAPI Spec is up to date', () => {
  it('generated spec matches committed spec', () => {
    // Generate fresh spec
    execSync('turbo run codegen --filter=api');

    const committed = JSON.parse(
      readFileSync('packages/api-spec/generated/openapi.json', 'utf-8')
    );
    const fresh = JSON.parse(
      readFileSync('packages/api-spec/generated/openapi.fresh.json', 'utf-8')
    );

    expect(deepEqual(committed, fresh)).toBe(true);
  });
});
```

## Layer 3: MSW Contract Tests (Frontend)
```typescript
// apps/web/src/contracts/document-api.contract.spec.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { useGetDocument } from '@/hooks/generated';
import { DocumentResponseSchema } from '@repo/validation';

describe('useGetDocument contract', () => {
  it('parses real API response shape correctly', async () => {
    // Use actual fixture that matches production shape
    const fixture = DocumentFixtureFactory.create();

    server.use(
      http.get('/api/documents/:id', () =>
        HttpResponse.json(fixture)
      )
    );

    const { result } = renderHook(() => useGetDocument('test-id'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Validate hook output matches Zod schema
    expect(DocumentResponseSchema.safeParse(result.current.data).success).toBe(true);
  });
});
```

## CI: Contract Check Step
```yaml
# .github/workflows/contract-check.yml
- name: Check API contract
  run: |
    pnpm turbo run codegen --filter=api
    pnpm turbo run test:contract
    git diff --exit-code packages/api-spec/generated/openapi.json || \
      (echo "OpenAPI spec drift detected. Run 'turbo run codegen' and commit." && exit 1)
```

## Rules
- Zod schema is always source of truth — never edit `openapi.json` manually
- Contract tests run in CI before merge
- Any API response shape change requires: Zod update → codegen → orval regen → PR
- Versioning: breaking changes require `v2` path prefix or deprecation header

## Token Optimization

**Load when** when writing or fixing API contract tests / OpenAPI conformance. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
