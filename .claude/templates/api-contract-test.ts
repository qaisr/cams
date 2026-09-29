/**
 * API Contract Test Template
 *
 * Tests that backend responses match Zod schemas (source of truth).
 * Place in: apps/api/src/contracts/ENTITY_NAME.contract.spec.ts
 * Standards: .claude/patterns/api-contract-testing-pattern.md
 *
 * Placeholders to replace:
 *   ENTITY_NAME       → PascalCase model name  (e.g. Contract)
 *   entity-names      → kebab-case route path   (e.g. contracts)
 *   eNTITY_NAME       → Prisma client accessor  (e.g. contract)
 */
import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { ZodValidationPipe } from 'nestjs-zod';
// Replace ENTITY_NAME* with actual schema names from @repo/validation
import {
  z,
  ENTITY_NAMEResponseSchema,
  PaginatedENTITY_NAMEResponseSchema,
  CreateENTITY_NAMESchema,
} from '@repo/validation';
import { createTestJwt } from '../test-utils/auth.helper';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';

describe('ENTITY_NAME API Contract', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();

    prisma = module.get(PrismaService);
    authToken = createTestJwt({ sub: 'test-user', roles: ['USER'] });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  // ── GET /entity-names ──────────────────────────────────────────────────────
  describe('GET /entity-names (list)', () => {
    it('response matches PaginatedENTITY_NAMEResponseSchema', async () => {
      const { body } = await supertest(app.getHttpServer())
        .get('/entity-names?limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const result = PaginatedENTITY_NAMEResponseSchema.safeParse(body);
      if (!result.success) {
        console.error('Schema violations:', JSON.stringify(result.error.format(), null, 2));
      }
      expect(result.success).toBe(true);
    });

    it('rejects over-limit param with 400 or 422', async () => {
      const { body } = await supertest(app.getHttpServer())
        .get('/entity-names?limit=200') // exceeds max allowed value
        .set('Authorization', `Bearer ${authToken}`)
        .expect(422); // adjust to 400 if the API returns that instead

      expect(body).toMatchObject({
        statusCode: expect.any(Number),
        message: expect.any(String),
      });
    });

    it('paginates correctly with cursor (no overlap between pages)', async () => {
      const page1 = await supertest(app.getHttpServer())
        .get('/entity-names')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 3 })
        .expect(200);

      expect(page1.body.items).toHaveLength(3);
      expect(page1.body.hasMore).toBe(true);
      expect(page1.body.nextCursor).toBeTruthy();

      const page2 = await supertest(app.getHttpServer())
        .get('/entity-names')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 3, cursor: page1.body.nextCursor })
        .expect(200);

      const page1Ids = page1.body.items.map((item: { id: string }) => item.id);
      const page2Ids = page2.body.items.map((item: { id: string }) => item.id);
      expect(page1Ids).not.toEqual(expect.arrayContaining(page2Ids));
    });
  });

  // ── GET /entity-names/:id ──────────────────────────────────────────────────
  describe('GET /entity-names/:id', () => {
    it('response matches ENTITY_NAMEResponseSchema', async () => {
      const created = await prisma.eNTITY_NAME.create({
        data: { id: 'contract-test-id', name: 'Contract Test Entity' },
      });

      const { body } = await supertest(app.getHttpServer())
        .get(`/entity-names/${created.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const result = ENTITY_NAMEResponseSchema.safeParse(body);
      if (!result.success) {
        console.error('Schema violations:', JSON.stringify(result.error.format(), null, 2));
      }
      expect(result.success).toBe(true);

      // Cleanup
      await prisma.eNTITY_NAME.delete({ where: { id: created.id } });
    });

    it('returns 404 for non-existent ID', async () => {
      const { body } = await supertest(app.getHttpServer())
        .get('/entity-names/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(body).toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('not found'),
      });
    });

    it('returns 404 (not 403) for cross-tenant resource — tenant isolation', async () => {
      // Must not reveal existence of another tenant's records: return 404 not 403
      const otherTenantToken = createTestJwt({ sub: 'other-tenant-user', roles: ['USER'] });
      const ownedRecord = await prisma.eNTITY_NAME.create({
        data: { id: 'tenant-isolation-test-id', name: 'Tenant A Record' },
      });

      const { status } = await supertest(app.getHttpServer())
        .get(`/entity-names/${ownedRecord.id}`)
        .set('Authorization', `Bearer ${otherTenantToken}`);

      expect(status).toBe(404);

      // Cleanup
      await prisma.eNTITY_NAME.delete({ where: { id: ownedRecord.id } });
    });
  });

  // ── POST /entity-names ─────────────────────────────────────────────────────
  describe('POST /entity-names (create)', () => {
    it('rejects invalid payload with 422 and structured error body', async () => {
      const invalidPayload = { name: '' }; // fails minLength(1)

      const { body } = await supertest(app.getHttpServer())
        .post('/entity-names')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPayload)
        .expect(422);

      expect(body).toMatchObject({
        statusCode: 422,
        error: expect.any(String),
        message: expect.any(Array),
      });
    });

    it('created entity response matches ENTITY_NAMEResponseSchema', async () => {
      const validPayload: z.infer<typeof CreateENTITY_NAMESchema> = { name: 'Contract Test' };

      const { body } = await supertest(app.getHttpServer())
        .post('/entity-names')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validPayload)
        .expect(201);

      const result = ENTITY_NAMEResponseSchema.safeParse(body);
      if (!result.success) {
        console.error('Schema violations:', JSON.stringify(result.error.format(), null, 2));
      }
      expect(result.success).toBe(true);

      // Cleanup
      if (result.success) {
        await prisma.eNTITY_NAME.delete({ where: { id: result.data.id } });
      }
    });
  });

  // ── Authentication & Authorization ─────────────────────────────────────────
  describe('Authentication & Authorization', () => {
    it('returns 401 on GET without token', async () => {
      await supertest(app.getHttpServer())
        .get('/entity-names')
        .expect(401);
    });

    it('returns 401 on POST without token', async () => {
      await supertest(app.getHttpServer())
        .post('/entity-names')
        .send({ name: 'Test' })
        .expect(401);
    });

    it('returns 403 for insufficient role (write operation)', async () => {
      const readOnlyToken = createTestJwt({ sub: 'readonly-user', roles: ['VIEWER'] });

      await supertest(app.getHttpServer())
        .post('/entity-names')
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .send({ name: 'Test' })
        .expect(403);
    });
  });
});
