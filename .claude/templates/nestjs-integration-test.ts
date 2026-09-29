/**
 * NestJS Integration Test Template
 *
 * Use with `/add-integration-test` for any HTTP endpoint that touches the database
 * or external services. Runs against a real PostgreSQL via Testcontainers.
 *
 * Pre-requisites:
 *  - `pnpm test:preflight --scope=integration` passes (see workflows/preflight-checks.md)
 *  - `@repo/database` migrations apply cleanly to the container database
 *
 * Pattern reference: @.claude/patterns/testcontainers-pattern.md
 * Standards:        @.claude/standards/testing-standards.md
 */
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { ZodValidationPipe } from 'nestjs-zod';
import { Test, TestingModule } from '@nestjs/testing';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database';
import { fixtureFactory } from './helpers/fixtures'; // see fixture-factory.ts template

describe('Resource Integration', () => {
  let app: NestFastifyApplication;
  let pg: StartedPostgreSqlContainer;
  let prisma: PrismaService;

  // ────────────────────────────────────────────────────────────────────────────
  // Lifecycle: ONE container per suite. NEVER per test.
  // ────────────────────────────────────────────────────────────────────────────
  beforeAll(async () => {
    pg = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('test')
      .withUsername('test')
      .withPassword('test')
      .start();

    process.env.DATABASE_URL = pg.getConnectionUri();

    // Apply migrations once.
    execSync('pnpm --filter @repo/database prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: pg.getConnectionUri() },
      stdio: 'inherit',
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Bootstrap with the Fastify adapter to match the production Fargate service (main.ts).
    // Using the default Express adapter here would test a different request pipeline
    // than production and can mask parsing/serialization differences.
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    // ZodValidationPipe (nestjs-zod) — the project uses Zod DTOs, never class-validator.
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
    // Fastify needs an explicit readiness wait before the first request.
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService);
  }, 60_000); // container start budget

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await pg?.stop();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Reset BETWEEN tests with deterministic order. Never `prisma.reset()`.
  // See testing-standards.md#test-data-cleanup-order.
  // ────────────────────────────────────────────────────────────────────────────
  beforeEach(async () => {
    await prisma.$transaction([
      prisma.auditLog.deleteMany(),
      prisma.resource.deleteMany(),
      // …add child tables before parent tables
      prisma.user.deleteMany(),
    ]);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Tests
  // ──────────────────────────────────────────────────────────────────────────
  describe('POST /resources', () => {
    it('creates a resource and returns 201 with envelope shape', async () => {
      const user = await fixtureFactory.user(prisma);
      const token = await fixtureFactory.signedJwt(user);

      const res = await request(app.getHttpServer())
        .post('/resources')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Correlation-Id', 'test-corr-1')
        .send({ name: 'Example', amount: 10 })
        .expect(201);

      expect(res.headers['x-correlation-id']).toBe('test-corr-1');
      expect(res.body).toEqual({
        data: expect.objectContaining({
          id: expect.any(String),
          name: 'Example',
          amount: 10,
        }),
      });

      const persisted = await prisma.resource.findUnique({ where: { id: res.body.data.id } });
      expect(persisted).not.toBeNull();
    });

    it('rejects invalid input with 422 and per-field errors', async () => {
      const user = await fixtureFactory.user(prisma);
      const token = await fixtureFactory.signedJwt(user);

      const res = await request(app.getHttpServer())
        .post('/resources')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '', amount: -1 })
        .expect(422);

      expect(res.body).toMatchObject({
        status: 422,
        code: 'VALIDATION_FAILED',
        errors: expect.arrayContaining([
          expect.objectContaining({ path: 'name' }),
          expect.objectContaining({ path: 'amount' }),
        ]),
      });
    });

    it('rejects unauthenticated requests with 401', async () => {
      await request(app.getHttpServer())
        .post('/resources')
        .send({ name: 'Example', amount: 10 })
        .expect(401);
    });

    it('rejects forbidden role with 403', async () => {
      const user = await fixtureFactory.user(prisma, { role: 'VIEWER' });
      const token = await fixtureFactory.signedJwt(user);

      await request(app.getHttpServer())
        .post('/resources')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Example', amount: 10 })
        .expect(403);
    });
  });

  describe('GET /resources/:id', () => {
    it('returns the resource for the owner', async () => {
      const user = await fixtureFactory.user(prisma);
      const token = await fixtureFactory.signedJwt(user);
      const resource = await fixtureFactory.resource(prisma, { ownerId: user.id });

      const res = await request(app.getHttpServer())
        .get(`/resources/${resource.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.id).toBe(resource.id);
    });

    it('returns 404 for non-existent id', async () => {
      const user = await fixtureFactory.user(prisma);
      const token = await fixtureFactory.signedJwt(user);

      await request(app.getHttpServer())
        .get('/resources/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
