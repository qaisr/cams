import { execSync } from 'node:child_process';
import path from 'node:path';

import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import supertest from 'supertest';

import { resetPrismaClient } from '@repo/database';

import { AppModule } from '../app.module';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';

import type { INestApplication } from '@nestjs/common';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const DATABASE_PACKAGE_DIR = path.resolve(REPO_ROOT, 'packages/database');
const PRISMA_BIN = path.resolve(REPO_ROOT, 'node_modules/.bin/prisma');
const PRISMA_CONFIG = path.resolve(DATABASE_PACKAGE_DIR, 'prisma.config.ts');

let pgContainer: StartedPostgreSqlContainer;
let app: INestApplication;
let adminToken: string;
let superadminToken: string;

beforeAll(async () => {
  pgContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('app_test')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  const databaseUrl = pgContainer.getConnectionUri();

  // Reset Prisma singleton so it picks up the new DATABASE_URL
  resetPrismaClient();

  process.env['DATABASE_URL'] = databaseUrl;
  process.env['MOCK_AUTH_ENABLED'] = 'true';
  process.env['NODE_ENV'] = 'test';
  process.env['JWT_SECRET'] = 'test-secret';
  // JwtStrategy is always registered but not used when MOCK_AUTH_ENABLED=true
  process.env['PINGID_JWKS_URI'] = 'https://mock.ping.internal/.well-known/jwks.json';
  process.env['PINGID_ISSUER'] = 'https://mock.ping.internal';
  process.env['PINGID_AUDIENCE'] = 'mock-audience';

  // Run migrations against the test container
  execSync(`${PRISMA_BIN} migrate deploy --config=${PRISMA_CONFIG}`, {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    cwd: DATABASE_PACKAGE_DIR,
    stdio: 'pipe',
  });

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication(new FastifyAdapter(), {
    logger: ['error', 'warn'],
  });

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Correlation-ID'],
  });

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  // Mint tokens for authenticated test cases
  const adminRes = await supertest(app.getHttpServer())
    .post('/login')
    .send({ lanId: 'test-admin', groups: ['mx-admin'] });
  adminToken = (adminRes.body as { accessToken: string }).accessToken;

  const superadminRes = await supertest(app.getHttpServer())
    .post('/login')
    .send({ lanId: 'test-superadmin', groups: ['mx-superadmin'] });
  superadminToken = (superadminRes.body as { accessToken: string }).accessToken;
}, 120_000);

afterAll(async () => {
  await app?.close();
  await pgContainer?.stop();
});

describe('GET /health', () => {
  it('returns 200 with { status: ok, db: connected }', async () => {
    const res = await supertest(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'connected' });
  });

  it('returns content-type application/json', async () => {
    const res = await supertest(app.getHttpServer()).get('/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('includes x-correlation-id in response headers', async () => {
    const res = await supertest(app.getHttpServer()).get('/health');
    expect(res.headers['x-correlation-id']).toBeDefined();
  });
});

describe('POST /login (mock, MOCK_AUTH_ENABLED=true)', () => {
  it('valid body returns 201 with { accessToken, user }', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/login')
      .send({ lanId: 'test-user', groups: ['mx-admin'] });

    // Debug: log response body if unexpected status
    if (res.status !== 201) {
      console.error('Login failed with status', res.status, ':', JSON.stringify(res.body));
    }

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      accessToken: expect.any(String),
      user: expect.objectContaining({
        lanId: 'test-user',
        groups: ['mx-admin'],
      }),
    });
  });

  it('returned accessToken is a valid JWT (3 dot-separated parts)', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/login')
      .send({ lanId: 'test-user', groups: ['mx-admin'] });

    const parts = (res.body as { accessToken: string }).accessToken.split('.');
    expect(parts).toHaveLength(3);
  });

  it('returned user has correct shape { lanId, name, email, groups }', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/login')
      .send({ lanId: 'test-user', groups: ['mx-admin'] });

    const { user } = res.body as { user: Record<string, unknown> };
    expect(user).toMatchObject({
      lanId: 'test-user',
      name: expect.any(String),
      email: expect.any(String),
      groups: ['mx-admin'],
    });
  });

  it('invalid body (missing lanId) → 422 ProblemDetail', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/login')
      .send({ groups: ['mx-admin'] });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ status: 422 });
  });

  it('invalid body (empty groups) → 422 ProblemDetail', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/login')
      .send({ lanId: 'test-user', groups: [] });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ status: 422 });
  });
});

describe('GET /auth/me/permissions (authenticated)', () => {
  it('valid JWT for mx-admin → 200 with effectivePermissions including app:admin', async () => {
    const res = await supertest(app.getHttpServer())
      .get('/auth/me/permissions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const body = res.body as { effectivePermissions: string[] };
    expect(body.effectivePermissions).toContain('app:admin');
  });

  it('valid JWT for mx-superadmin → 200 with isSuperadmin: true', async () => {
    const res = await supertest(app.getHttpServer())
      .get('/auth/me/permissions')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ isSuperadmin: true });
  });

  it('no JWT → 401 ProblemDetail', async () => {
    const res = await supertest(app.getHttpServer()).get('/auth/me/permissions');

    expect(res.status).toBe(401);
  });
});
