---
name: add-integration-test
description: >
  Generate integration tests using Jest + Testcontainers (real PostgreSQL) +
  supertest. Covers full HTTP stack including validation, auth, DB state,
  soft delete, and event publishing. Runs preflight before executing tests.
version: 2.0.0
agent: test-engineer
subtask: true
arguments:
  - name: TARGET
    required: true
    examples:
      - "apps/api/src/modules/users/users.controller.ts"
      - "apps/api/src/modules/users/ (all endpoints)"
      - "the user creation flow covering auth and soft delete"
---

# Add Integration Test

## Input
$ARGUMENTS

---

## Step 1 — Preflight Check

Before generating or running integration tests, verify services are available:

```bash
pnpm test:preflight
```

See `@.claude/workflows/preflight-checks.md` for what this checks.
If preflight fails, report which service is down and stop.

---

## Step 2 — Read Target

```bash
# Read controller
cat $TARGET_CONTROLLER

# Read service (for understanding business logic)
cat $TARGET_SERVICE

# Read Prisma schema for this entity
grep -A 30 "model {Entity}" packages/database/prisma/schema.prisma

# Check for existing integration tests
find apps/api/src -name "*.integration.spec.ts" | xargs ls -la

# Read an existing integration test for style reference
find apps/api/src -name "*.integration.spec.ts" | head -1 | xargs cat
```

---

## Step 3 — Identify Scenarios

For each endpoint, cover ALL of:

```
POST   /v1/{entities}
  → 201 + Location header + body matches DTO
  → 201 + DB row exists with correct values
  → 201 + DB row has deletedAt = null
  → 201 + EventBridge publish called with correct detailType
  → 422 Zod validation failure → RFC 7807 body, no stack trace
  → 422 correlationId present in error body
  → 401 missing Authorization header
  → 403 wrong permission scope
  → 409 duplicate unique field

GET    /v1/{entities}/:id
  → 200 found → correct DTO shape
  → 404 not found → RFC 7807 body
  → 404 soft deleted record
  → 401, 403

GET    /v1/{entities}
  → 200 with pagination envelope
  → 200 empty page when no records
  → 200 filters applied correctly
  → 200 sort applied correctly
  → 422 invalid pagination params

PATCH/PUT /v1/{entities}/:id
  → 200 updated → correct DTO
  → 422 validation
  → 404 not found / soft deleted
  → 409 conflict (if applicable)
  → 401, 403

DELETE /v1/{entities}/:id
  → 204 response
  → DB row exists with deletedAt set (NOT deleted)
  → Subsequent GET returns 404
  → EventBridge publish called
  → 404 already soft deleted
  → 401, 403
```

---

## Step 4 — Generate Integration Test

Location: `apps/api/src/modules/{entity}/__tests__/{entity}.integration.spec.ts`

Follow `@.claude/patterns/testcontainers-pattern.md` and `@.claude/templates/nestjs-integration-test.ts`:

```typescript
import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { PrismaService } from '../../../database'; // injectable PrismaService from the app's DatabaseModule
import { EventBridgeService } from '../../events/eventbridge.service';
import { AppModule } from '../../../app.module';
import { GlobalExceptionFilter } from '../../../common/filters/global-exception.filter';
import {
  {entity}Factory,
  create{Entity}DtoFactory,
} from '../__fixtures__/{entity}.fixtures';

// ── Shared container — started once, reused across all tests ─────────────────
// See @.claude/patterns/testcontainers-pattern.md
let container: StartedPostgreSqlContainer;
let app: INestApplication;
let prisma: PrismaService;
const mockEventBridge = { publish: jest.fn().mockResolvedValue(undefined) };

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('test_db')
    .withUsername('test')
    .withPassword('test')
    .start();

  const module: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider('DATABASE_URL')
    .useValue(container.getConnectionUri())
    .overrideProvider(EventBridgeService)
    .useValue(mockEventBridge)
    .compile();

  app = module.createNestApplication();

  // ⚠️ Must match production bootstrap — globalSetup in apps/api/src/main.ts
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
  );
  app.setGlobalPrefix('v1');

  await app.init();
  prisma = module.get(PrismaService);

  // Run Prisma migrations against test container
  const { execSync } = await import('child_process');
  execSync('pnpm prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: container.getConnectionUri() },
  });
}, 90_000); // Allow time for container pull on first run

afterAll(async () => {
  await app?.close();
  await container?.stop();
});

beforeEach(async () => {
  // Reset mocks
  jest.clearAllMocks();
  // Clean data in reverse FK order — edit for your schema
  await prisma.{childEntity}.deleteMany();
  await prisma.{entity}.deleteMany();
});

// ── Auth helpers ──────────────────────────────────────────────────────────────
// Tokens validated by mock PingID guard in test mode (MOCK_AUTH_ENABLED=true)
const auth = (role: 'admin' | 'editor' | 'viewer' = 'admin') =>
  ({ Authorization: `Bearer test-token-${role}` });
const noAuth = () => ({});
const correlationHeader = (id = 'it-corr-001') =>
  ({ 'x-correlation-id': id });

// ── Test Suites ───────────────────────────────────────────────────────────────
describe('{Entity}Controller (Integration)', () => {
  describe('POST /v1/{entities}', () => {
    it('returns_201_withLocationHeader_andPersistsRow', async () => {
      const dto = create{Entity}DtoFactory.build();

      const res = await request(app.getHttpServer())
        .post('/v1/{entities}')
        .set(auth())
        .set(correlationHeader('post-001'))
        .send(dto)
        .expect(201);

      // Response shape
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe(dto.name);
      expect(res.headers['location']).toMatch(/\/v1\/{entities}\//);

      // DB state
      const saved = await prisma.{entity}.findUnique({ where: { id: res.body.id } });
      expect(saved).not.toBeNull();
      expect(saved!.name).toBe(dto.name);
      expect(saved!.deletedAt).toBeNull();  // soft delete guard

      // Event published
      expect(mockEventBridge.publish).toHaveBeenCalledOnce();
      expect(mockEventBridge.publish).toHaveBeenCalledWith(
        expect.objectContaining({ detailType: '{entity}.created' })
      );
    });

    it('returns_422_withRfc7807_forInvalidPayload', async () => {
      await request(app.getHttpServer())
        .post('/v1/{entities}')
        .set(auth())
        .set(correlationHeader('post-422'))
        .send({ name: '' }) // fails Zod min(1)
        .expect(422)
        .expect((res) => {
          expect(res.body.title).toBe('Validation Failed');
          expect(res.body.status).toBe(422);
          expect(res.body.correlationId).toBe('post-422');
          expect(res.body.errors).toBeDefined();
          expect(res.body).not.toHaveProperty('stack');  // never expose
        });
    });

    it('returns_401_whenNoAuthorizationHeader', async () => {
      await request(app.getHttpServer())
        .post('/v1/{entities}')
        .set(noAuth())
        .send(create{Entity}DtoFactory.build())
        .expect(401);
    });

    it('returns_403_forViewerRole', async () => {
      await request(app.getHttpServer())
        .post('/v1/{entities}')
        .set(auth('viewer'))
        .send(create{Entity}DtoFactory.build())
        .expect(403);
    });

    it('returns_409_forDuplicateName', async () => {
      const dto = create{Entity}DtoFactory.build();
      await prisma.{entity}.create({
        data: { ...{entity}Factory.build({ name: dto.name }), createdBy: 'seed', updatedBy: 'seed' },
      });

      await request(app.getHttpServer())
        .post('/v1/{entities}')
        .set(auth())
        .send(dto)
        .expect(409);
    });
  });

  describe('GET /v1/{entities}/:id', () => {
    it('returns_200_withCorrectDto_forExistingRecord', async () => {
      const record = await prisma.{entity}.create({
        data: { ...{entity}Factory.build(), createdBy: 'seed', updatedBy: 'seed' },
      });

      const res = await request(app.getHttpServer())
        .get(`/v1/{entities}/${record.id}`)
        .set(auth())
        .expect(200);

      expect(res.body.id).toBe(record.id);
      expect(res.body.name).toBe(record.name);
    });

    it('returns_404_forSoftDeletedRecord', async () => {
      const record = await prisma.{entity}.create({
        data: {
          ...{entity}Factory.build({ deletedAt: new Date() }),
          createdBy: 'seed',
          updatedBy: 'seed',
        },
      });

      await request(app.getHttpServer())
        .get(`/v1/{entities}/${record.id}`)
        .set(auth())
        .expect(404);
    });

    it('returns_404_forNonExistentId', async () => {
      await request(app.getHttpServer())
        .get('/v1/{entities}/00000000-0000-0000-0000-000000000000')
        .set(auth())
        .expect(404);
    });
  });

  describe('DELETE /v1/{entities}/:id', () => {
    it('returns_204_andSoftDeletes_andSubsequentGetReturns404', async () => {
      const record = await prisma.{entity}.create({
        data: { ...{entity}Factory.build(), createdBy: 'seed', updatedBy: 'seed' },
      });

      await request(app.getHttpServer())
        .delete(`/v1/{entities}/${record.id}`)
        .set(auth())
        .expect(204);

      // Verify soft delete — row exists in DB
      const afterDelete = await prisma.{entity}.findUnique({ where: { id: record.id } });
      expect(afterDelete).not.toBeNull();
      expect(afterDelete!.deletedAt).not.toBeNull();

      // Verify API treats it as gone
      await request(app.getHttpServer())
        .get(`/v1/{entities}/${record.id}`)
        .set(auth())
        .expect(404);

      // Verify event published
      expect(mockEventBridge.publish).toHaveBeenCalledWith(
        expect.objectContaining({ detailType: '{entity}.deleted' })
      );
    });

    it('returns_404_forNonExistentId_andDoesNotPublishEvent', async () => {
      await request(app.getHttpServer())
        .delete('/v1/{entities}/00000000-0000-0000-0000-000000000000')
        .set(auth())
        .expect(404);

      expect(mockEventBridge.publish).not.toHaveBeenCalled();
    });
  });
});
```

---

## Step 5 — Run Tests

```bash
# --runInBand prevents Testcontainers port conflicts
pnpm --filter @repo/api test:integration \
  --testPathPattern="{entity}.integration" \
  --verbose \
  --runInBand
```

Fix all failures before finishing.

---

## Step 6 — Coverage Check

```bash
pnpm --filter @repo/api test:integration \
  --testPathPattern="{entity}" \
  --coverage \
  --coverageReporters=text \
  --collectCoverageFrom="src/modules/{entity}/**" \
  --runInBand
```

Report coverage. Flag branches below 80%.

---

## Cross-References
- Unit tests: `/add-unit-test`
- API contract tests: `/add-api-test`
- Pattern: `@.claude/patterns/testcontainers-pattern.md`
- Template: `@.claude/templates/nestjs-integration-test.ts`
- Pre-flight: `@.claude/workflows/preflight-checks.md`
- Standards: `@.claude/standards/testing-standards.md`
