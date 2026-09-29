---
name: add-api-test
description: >
  Generate API contract tests that validate the running API against the
  OpenAPI spec. Tests HTTP semantics, response shapes, headers, error formats,
  and auth flows against localhost:3001. Requires preflight check.
version: 1.0.0
agent: test-engineer
subtask: true
arguments:
  - name: TARGET
    required: false
    default: "all"
    examples:
      - "apps/api/src/modules/users/"
      - "POST /v1/users endpoint"
      - "all auth-protected endpoints"
---

# Add API Contract Test

## What API Tests Cover

Unlike integration tests (which test internal behaviour + DB state),
API tests treat the running application as a black box:

```
Integration Test:
  Real NestJS app (in-process) + Testcontainers Postgres
  → Tests: HTTP + DB state + event publishing

API Contract Test:
  Running app at localhost:3001 + real Postgres at localhost:5432
  → Tests: HTTP contract, response shapes match OpenAPI spec,
           headers correct, error formats RFC 7807,
           auth flows, rate limiting, CORS headers
```

Run API tests in CI against a deployed staging environment.
Run locally against the running dev stack.

## Input
$ARGUMENTS

---

## Step 1 — Preflight

```bash
# Must pass before API tests can run
pnpm test:preflight

# Verify OpenAPI spec is current
pnpm run generate:api-spec
```

---

## Step 2 — Read OpenAPI Spec

```bash
cat packages/api-spec/generated/openapi.json | \
  jq '.paths | keys[]' | grep -i "{entity}"
```

For each endpoint in scope, extract:
- Request body schema (required fields, types, constraints)
- Response schemas per status code
- Required headers
- Auth requirements (`securitySchemes`)

---

## Step 3 — Generate API Contract Test

Location: `apps/api/src/test/api/{entity}.api.spec.ts`

```typescript
/**
 * API Contract Tests — {Entity} endpoints
 *
 * Tests the RUNNING API at process.env.API_INTERNAL_BASE_URL
 * against the OpenAPI specification.
 *
 * Run: pnpm test:api --testPathPattern="{entity}.api"
 * Requires: pnpm test:preflight to pass first
 */
import * as request from 'supertest';
import { readFileSync } from 'fs';
import { join } from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { preflightCheck } from '../helpers/preflight.helper';
import { getTestAuthToken } from '../helpers/auth-token.helper';
import { create{Entity}DtoFactory, {entity}Factory } from
  '../../modules/{entity}/__fixtures__/{entity}.fixtures';

// ── OpenAPI schema validator ──────────────────────────────────────────────────
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const openApiSpec = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../../packages/api-spec/generated/openapi.json'),
    'utf-8'
  )
);

function validateAgainstSchema(
  schemaRef: string,
  data: unknown
): { valid: boolean; errors: string[] } {
  const validate = ajv.compile({ $ref: schemaRef, ...openApiSpec });
  const valid = validate(data);
  return {
    valid: valid as boolean,
    errors: validate.errors?.map((e) => `${e.instancePath} ${e.message}`) ?? [],
  };
}

// ── Test setup ────────────────────────────────────────────────────────────────
const API_BASE = process.env.API_INTERNAL_BASE_URL ?? 'http://localhost:3001';

beforeAll(async () => {
  await preflightCheck(['postgres', 'api']);
}, 10_000);

// ── Helpers ───────────────────────────────────────────────────────────────────
const authHeader = async (role: 'admin' | 'viewer' = 'admin') => ({
  Authorization: `Bearer ${await getTestAuthToken(role)}`,
});
const corrId = (id: string) => ({ 'x-correlation-id': id });

// ── Contract Tests ────────────────────────────────────────────────────────────
describe('{Entity} API Contract', () => {
  describe('POST /v1/{entities}', () => {
    it('contract_validRequest_responseMatchesOpenApiSchema', async () => {
      const dto = create{Entity}DtoFactory.build();

      const res = await request(API_BASE)
        .post('/v1/{entities}')
        .set(await authHeader())
        .set(corrId('api-post-001'))
        .send(dto)
        .expect(201);

      // Validate response against OpenAPI {Entity}ResponseDto schema
      const { valid, errors } = validateAgainstSchema(
        '#/components/schemas/{Entity}ResponseDto',
        res.body
      );
      expect(errors).toEqual([]);  // print errors if test fails
      expect(valid).toBe(true);

      // Required headers
      expect(res.headers['location']).toMatch(/\/v1\/{entities}\//);
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    it('contract_missingRequiredField_returns400WithRfc7807', async () => {
      const res = await request(API_BASE)
        .post('/v1/{entities}')
        .set(await authHeader())
        .set(corrId('api-post-400'))
        .send({})  // empty body — all required fields missing
        .expect(400);

      // RFC 7807 Problem Details
      expect(res.body).toMatchObject({
        type: expect.stringMatching(/^https?:\/\//),
        title: expect.any(String),
        status: 400,
        correlationId: 'api-post-400',
      });
      expect(res.body).not.toHaveProperty('stack');
      expect(res.body).not.toHaveProperty('message'); // NestJS default — must be suppressed
    });

    it('contract_missingAuthHeader_returns401', async () => {
      const res = await request(API_BASE)
        .post('/v1/{entities}')
        .send(create{Entity}DtoFactory.build())
        .expect(401);

      expect(res.body.status).toBe(401);
    });

    it('contract_insufficientPermission_returns403', async () => {
      await request(API_BASE)
        .post('/v1/{entities}')
        .set(await authHeader('viewer'))
        .send(create{Entity}DtoFactory.build())
        .expect(403);
    });
  });

  describe('GET /v1/{entities}', () => {
    it('contract_listResponse_matchesPaginationEnvelopeSchema', async () => {
      const res = await request(API_BASE)
        .get('/v1/{entities}')
        .set(await authHeader())
        .query({ page: 1, limit: 10 })
        .expect(200);

      // Validate pagination envelope
      expect(res.body).toMatchObject({
        data: expect.any(Array),
        total: expect.any(Number),
        page: 1,
        limit: 10,
      });

      // Validate each item in data array
      if (res.body.data.length > 0) {
        const { valid, errors } = validateAgainstSchema(
          '#/components/schemas/{Entity}ResponseDto',
          res.body.data[0]
        );
        expect(errors).toEqual([]);
        expect(valid).toBe(true);
      }
    });

    it('contract_invalidPaginationParams_returns422', async () => {
      await request(API_BASE)
        .get('/v1/{entities}')
        .set(await authHeader())
        .query({ page: -1, limit: 999 })  // beyond max
        .expect(422);
    });
  });

  describe('Response Headers Contract', () => {
    it('contract_allResponses_includeSecurityHeaders', async () => {
      const res = await request(API_BASE)
        .get('/v1/{entities}')
        .set(await authHeader())
        .expect(200);

      // Standard security headers — must be set by global middleware
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('contract_correlationId_echoedInResponseHeader', async () => {
      const res = await request(API_BASE)
        .get('/v1/{entities}')
        .set(await authHeader())
        .set(corrId('echo-test-123'))
        .expect(200);

      expect(res.headers['x-correlation-id']).toBe('echo-test-123');
    });
  });

  describe('Auth Token Validation', () => {
    it('contract_expiredToken_returns401', async () => {
      await request(API_BASE)
        .get('/v1/{entities}')
        .set({ Authorization: 'Bearer expired.jwt.token' })
        .expect(401);
    });

    it('contract_malformedToken_returns401', async () => {
      await request(API_BASE)
        .get('/v1/{entities}')
        .set({ Authorization: 'Bearer not-a-jwt' })
        .expect(401);
    });

    it('contract_wrongAudience_returns401', async () => {
      await request(API_BASE)
        .get('/v1/{entities}')
        .set({ Authorization: 'Bearer wrong-audience-token' })
        .expect(401);
    });
  });
});
```

---

## Step 4 — Auth Token Helper

Ensure `apps/api/src/test/helpers/auth-token.helper.ts` exists:

```typescript
/**
 * Generate test JWT tokens that the API will accept.
 * When MOCK_AUTH_ENABLED=true, tokens are validated by MockPingIdGuard.
 * Tokens follow the convention: "test-token-{role}"
 */
export async function getTestAuthToken(
  role: 'admin' | 'editor' | 'viewer' = 'admin'
): Promise<string> {
  if (process.env.MOCK_AUTH_ENABLED === 'true') {
    // MockPingIdGuard accepts these literal tokens in development
    return `test-token-${role}`;
  }

  // Production: generate a real JWT for CI/staging
  // Fetch from PingID token endpoint using client credentials
  throw new Error(
    'Real PingID token generation not implemented — set MOCK_AUTH_ENABLED=true for local tests'
  );
}
```

---

## Step 5 — Run

```bash
pnpm --filter @repo/api test:api \
  --testPathPattern="{entity}.api" \
  --verbose \
  --runInBand
```

---

## Cross-References
- Integration tests: `/add-integration-test`
- Preflight: `@.claude/workflows/preflight-checks.md`
- API contract workflow: `@.claude/workflows/api-contract-workflow.md`
- API contract testing pattern: `@.claude/patterns/api-contract-testing-pattern.md`
- API versioning pattern: `@.claude/patterns/api-versioning-pattern.md`
- Standards: `@.claude/standards/testing-standards.md`
- Template: `@.claude/templates/api-contract-test.ts`
- OpenAPI spec: `packages/api-spec/generated/openapi.json`
