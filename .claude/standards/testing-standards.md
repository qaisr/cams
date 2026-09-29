# Testing Standards — NestJS + NextJS (Jest + Playwright)

> Canonical reference for all test generation, review, and audit commands.
> Every agent and command in this framework defers to this document.
> Last merged: includes Storybook, pre-flight, API contract, TDD, and coverage standards.

---

## Stack

| Layer | Framework | Location |
|---|---|---|
| NestJS unit | Jest + `@nestjs/testing` | `apps/api/src/**/*.spec.ts` |
| NestJS integration | Jest + Testcontainers + supertest | `apps/api/src/**/*.integration.spec.ts` |
| API contract | supertest + OpenAPI validator | `apps/api/src/test/api/**/*.api.spec.ts` |
| React component | Jest + RTL + MSW | `apps/web/src/**/*.test.tsx` |
| React hook | `renderHook` + MSW | `apps/web/src/**/*.hook.test.tsx` |
| Storybook | `composeStories` + `play` + axe-core | `apps/web/src/**/*.stories.tsx` |
| E2E | Playwright + POM | `apps/web/e2e/**/*.spec.ts` |
| Test data | `@faker-js/faker` + factory pattern | `**/__fixtures__/*.fixtures.ts` |
| API mocking | MSW v2 (frontend), supertest (backend) | `apps/web/src/mocks/**` |
| Coverage | Istanbul (Jest) | Thresholds enforced in CI |

---

## Test Pyramid Targets

```
          ╱▔▔▔▔▔▔╲
         ╱  E2E   ╲          ~5%   Critical user journeys only
        ╱──────────╲
       ╱ Integration╲        ~20%  API contracts, DB queries, auth flows
      ╱──────────────╲
     ╱   Unit Tests   ╲      ~75%  Service logic, component behaviour
    ╲────────────────╱
```

---

## Coverage Thresholds (enforced in CI)

```typescript
// jest.config.ts
coverageThreshold: {
  global: {
    branches:   80,
    functions:  85,
    lines:      85,
    statements: 85,
  },
  // Exception paths must be fully covered
  'apps/api/src/**/exceptions/**': {
    branches:   100,
    functions:  100,
    lines:      100,
    statements: 100,
  },
  // Auth guards must be fully covered
  'apps/api/src/**/guards/**': {
    branches:   100,
    functions:  100,
    lines:      100,
    statements: 100,
  },
  // Generated code — do not enforce
  'apps/web/src/hooks/generated/**': {
    branches:   0,
    functions:  0,
    lines:      0,
    statements: 0,
  },
  'apps/web/src/mocks/generated/**': {
    branches:   0,
    functions:  0,
    lines:      0,
    statements: 0,
  },
}
```

### Storybook Component Coverage Thresholds

| Category | Minimum | Target |
|---|---|---|
| Lines | 80% | 90% |
| Branches | 75% | 85% |
| Functions | 80% | 90% |
| Critical paths | 100% | 100% |

axe-core violations allowed: **0**

---

## Naming Convention

```
{method}_{scenario}_{expectedOutcome}

Backend:
  findById_existingId_returnsResponse
  findById_nonExistentId_throwsNotFoundException
  findById_softDeletedId_throwsNotFoundException
  create_duplicateEmail_throwsConflictException
  create_validDto_persistsAndPublishesEvent
  create_prismaConnectionError_propagatesWithoutPublishingEvent
  remove_existingId_setsDeletedAtAndPublishesEvent
  remove_nonExistentId_throwsNotFoundWithoutUpdating

Frontend:
  renders_loadingState_showsSkeleton
  renders_successState_displaysEntityName
  renders_errorState_showsAlertWithMessage
  submit_emptyName_showsValidationError
  submit_validInput_callsApiAndInvokesOnSuccess
  submit_409Conflict_showsConflictMessage
  mutation_onSuccess_invalidatesQueryCache
  mutation_onFailure_rollsBackOptimisticUpdate
```

---

## Test File Co-location

```
apps/api/src/modules/{entity}/
├── {entity}.service.ts
├── {entity}.service.spec.ts           ← unit test alongside source
├── {entity}.controller.spec.ts        ← unit test alongside source
├── __fixtures__/
│   └── {entity}.fixtures.ts           ← faker factories
└── __tests__/
    └── {entity}.integration.spec.ts   ← Testcontainers integration test

apps/api/src/test/
├── api/
│   └── {entity}.api.spec.ts           ← API contract tests (black-box)
├── helpers/
│   ├── auth-token.helper.ts
│   └── preflight.helper.ts
└── setup/
    └── testcontainers.setup.ts

apps/web/src/components/{resource}/
├── {Component}.tsx
├── {Component}.test.tsx               ← RTL unit test
├── {Component}.stories.tsx            ← Storybook stories
└── __fixtures__/
    └── {entity}.fixtures.ts

apps/web/src/hooks/
└── {entity}.hook.test.tsx             ← renderHook tests

apps/web/src/mocks/
├── handlers.ts                        ← global baseline handlers
├── server.ts                          ← MSW server singleton
└── generated/                         ← orval-generated (DO NOT EDIT)
```

---

## Non-Negotiable Rules

### Universal
1. **Tests are independent** — no shared mutable state between tests
2. **No arbitrary waits** — `setTimeout` / `sleep` in tests is a defect; use `waitFor` or `jest.useFakeTimers()`
3. **No snapshot tests on frequently-changing components** — snapshot theater
4. **Factories, not literals** — never inline object literals with magic values in tests
5. **Deterministic seed IDs** — `11111111-1111-1111-1111-111111111111` format for fixtures referenced in `packages/database/prisma/seed.ts`
6. **Coverage thresholds enforced in CI** — not optional, not negotiable

### NestJS Backend
7. **`jest.clearAllMocks()` in every `beforeEach`** — no bleed between tests
8. **Mock Prisma at method level** — `{ user: { findFirst: jest.fn() } }`
9. **Never mock Postgres** — use Testcontainers for any real DB assertion
10. **Always assert EventBridge publish** — or assert `not.toHaveBeenCalled()` on error paths
11. **Always assert `deletedAt` in soft-delete tests** — check the DB row directly, not just the API response
12. **Correlation IDs in integration tests** — send `x-correlation-id` header on every request; verify it is echoed in error responses

### React Frontend
13. **Fresh `QueryClient` per test** — via `createTestQueryClient()` + `renderWithProviders()`
14. **Never `jest.mock('@tanstack/react-query')`** — use MSW to intercept real fetch calls
15. **Never test generated code directly** — `hooks/generated/**` and `mocks/generated/**` have 0% threshold
16. **MSW `{ onUnhandledRequest: 'error' }`** — catches missing handler setup immediately
17. **`server.resetHandlers()` in `afterEach`** — prevents handler bleed between tests

### Pre-Flight (Integration / API / E2E Tests)
18. **Run `pnpm test:preflight` before integration or API tests** — fail fast if services are unavailable
19. **`--runInBand` for integration tests** — prevents Testcontainers port conflicts across parallel suites

---

## Pre-Flight Service Checks

Before running integration tests, API tests, or E2E tests, verify all required services are running.

| Service | Address | Required For |
|---|---|---|
| PostgreSQL | `localhost:5432` | Integration, API |
| Backend API | `localhost:3001/health` | API, E2E |
| Frontend | `localhost:3000` | E2E only |
| LocalStack | `localhost:4566/_localstack/health` | AWS-dependent tests |

```bash
pnpm test:preflight                  # all services
pnpm test:preflight --scope=integration   # Postgres only
pnpm test:preflight --scope=api           # Postgres + API
pnpm test:preflight --scope=e2e           # Postgres + API + Frontend
```

In Jest `beforeAll` for integration and API test suites:

```typescript
import { preflightCheck } from '../helpers/preflight.helper';

beforeAll(async () => {
  await preflightCheck(['postgres', 'api']);
}, 10_000);
```

See `@.claude/workflows/preflight-checks.md` and `scripts/preflight-check.ts`.

---

## Fixture Factory Pattern

```typescript
// apps/api/src/modules/{entity}/__fixtures__/{entity}.fixtures.ts
import { faker } from '@faker-js/faker';
import type { User } from '@prisma/client';
import type { CreateUserDtoType, UpdateUserDtoType, UserResponseDtoType } from '@repo/validation';

// ── Prisma model factory (backend — unit + integration tests) ─────────────────
export const userFactory = {
  // Deterministic IDs — must match packages/database/prisma/seed.ts
  SEED_ID:   '11111111-1111-1111-1111-111111111111' as const,
  SEED_ID_2: '22222222-2222-2222-2222-222222222222' as const,

  build: (overrides: Partial<User> = {}): User => ({
    id:        faker.string.uuid(),
    email:     faker.internet.email(),
    name:      faker.person.fullName(),
    status:    'ACTIVE',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: faker.string.uuid(),
    updatedBy: faker.string.uuid(),
    ...overrides,
  }),

  buildList: (count: number, overrides: Partial<User> = {}): User[] =>
    Array.from({ length: count }, () => userFactory.build(overrides)),

  buildSoftDeleted: (overrides: Partial<User> = {}): User =>
    userFactory.build({ ...overrides, deletedAt: new Date() }),

  buildSeed: (): User =>
    userFactory.build({ id: userFactory.SEED_ID, name: 'Seed User' }),
};

// ── DTO factories (backend — service unit tests) ──────────────────────────────
export const createUserDtoFactory = {
  build: (overrides: Partial<CreateUserDtoType> = {}): CreateUserDtoType => ({
    email:    faker.internet.email(),
    name:     faker.person.fullName(),
    password: faker.internet.password({ length: 12 }),
    ...overrides,
  }),
};

export const updateUserDtoFactory = {
  build: (overrides: Partial<UpdateUserDtoType> = {}): UpdateUserDtoType => ({
    name: faker.person.fullName(),
    ...overrides,
  }),
};

// ── Response DTO factory (frontend — MSW handlers + component tests) ──────────
// Dates are ISO strings — not Date objects — because JSON serialization
export const userResponseFactory = {
  build: (overrides: Partial<UserResponseDtoType> = {}): UserResponseDtoType => ({
    id:        faker.string.uuid(),
    email:     faker.internet.email(),
    name:      faker.person.fullName(),
    status:    'ACTIVE',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  buildList: (count: number, overrides: Partial<UserResponseDtoType> = {}): UserResponseDtoType[] =>
    Array.from({ length: count }, () => userResponseFactory.build(overrides)),

  buildPage: (data: UserResponseDtoType[], options: { total?: number; page?: number; limit?: number } = {}) => ({
    data,
    total:  options.total ?? data.length,
    page:   options.page  ?? 1,
    limit:  options.limit ?? 20,
  }),
};
```

> Full template: `@.claude/templates/fixture-factory.ts`

---

## Unit Test Rules

1. Mock ALL external dependencies (Prisma, EventBridge, HTTP clients, AWS SDK)
2. One `describe` per class, nested `describe` per method
3. `jest.clearAllMocks()` in every `beforeEach` — never share mock state
4. Test ALL branches: happy path, not-found, validation, conflict, error propagation
5. Never use `setTimeout` for waits — use `jest.useFakeTimers()` or `waitFor`
6. Fixtures via factories — no inline object literals with magic values
7. Assert EventBridge publish on all mutation paths; assert `not.toHaveBeenCalled()` on all failure paths

### Fake Timers — Correct Usage (retries, debounce, TTL, backoff)

Real delays make tests slow and flaky. When code under test uses `setTimeout`,
`setInterval`, or date-based logic (retry backoff, cache TTL, debounced input),
use Jest fake timers — but follow these rules or you will deadlock the test:

```typescript
describe('retry with backoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();          // ✅ enable per-suite in beforeEach
  });
  afterEach(() => {
    jest.runOnlyPendingTimers();   // flush stragglers so they don't leak across tests
    jest.useRealTimers();          // ✅ MANDATORY — restore, or later suites hang
  });

  it('retries twice then succeeds', async () => {
    const promise = withBackoff(fn, { attempts: 3 }); // schedules setTimeout internally

    // ✅ async code + fake timers: advance with the ASYNC variant, and await it,
    // so queued microtasks (the awaited promises inside the retry) can resolve.
    await jest.advanceTimersByTimeAsync(1_000);
    await jest.advanceTimersByTimeAsync(2_000);

    await expect(promise).resolves.toBe('ok');
  });
});
```

- **`useRealTimers()` in `afterEach` is non-negotiable** — a suite that leaves
  fake timers installed silently hangs the next suite that awaits a real timer.
- **Mixing `await` with fake timers?** Use `advanceTimersByTimeAsync` /
  `runAllTimersAsync` (the `*Async` variants) and `await` them. The synchronous
  `advanceTimersByTime` does NOT drain the microtask queue, so an `await` inside
  the code under test never resolves → the test times out. This is the #1 cause
  of "works in prod, hangs in test."
- **Pin the clock** for date-dependent logic: `jest.setSystemTime(new Date('2026-01-01T00:00:00Z'))`.
- **Never** call `jest.useFakeTimers()` and then `await waitFor(...)` from RTL
  without advancing — `waitFor` polls on a timer that fake timers have frozen.
  Either advance manually, or don't fake timers for that test.

### NestJS Service Unit Test Pattern

```typescript
// {entity}.service.spec.ts
import { Test, type TestingModule } from '@nestjs/testing';
import { {Entity}Service } from './{entity}.service';
import { PrismaService } from '../database';
import { EventBridgeService } from '../events/eventbridge.service';
import { {Entity}NotFoundException } from './exceptions/{entity}.exceptions';
import { {entity}Factory, create{Entity}DtoFactory } from './__fixtures__/{entity}.fixtures';

const mockPrisma = {
  {entity}: {
    findFirst:  jest.fn(),
    findMany:   jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    updateMany: jest.fn(),
    count:      jest.fn(),
  },
  $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
};

const mockEvents = {
  publish:     jest.fn().mockResolvedValue(undefined),
  publishMany: jest.fn().mockResolvedValue(undefined),
};

describe('{Entity}Service', () => {
  let service: {Entity}Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {Entity}Service,
        { provide: PrismaService,      useValue: mockPrisma },
        { provide: EventBridgeService, useValue: mockEvents },
      ],
    }).compile();
    service = module.get<{Entity}Service>({Entity}Service);
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('findById_existingId_returnsDto', async () => {
      const record = {entity}Factory.build();
      mockPrisma.{entity}.findFirst.mockResolvedValue(record);

      const result = await service.findById(record.id, 'corr-001');

      expect(result.id).toBe(record.id);
      expect(mockPrisma.{entity}.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: record.id, deletedAt: null } })
      );
    });

    it('findById_nonExistentId_throwsNotFoundException', async () => {
      mockPrisma.{entity}.findFirst.mockResolvedValue(null);

      await expect(service.findById('non-existent', 'corr-001'))
        .rejects.toThrow({Entity}NotFoundException);

      expect(mockEvents.publish).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('create_validDto_persistsAndPublishesEvent', async () => {
      const dto     = create{Entity}DtoFactory.build();
      const created = {entity}Factory.build({ name: dto.name });
      mockPrisma.{entity}.create.mockResolvedValue(created);

      const result = await service.create(dto, 'corr-001');

      expect(result.id).toBe(created.id);
      expect(mockPrisma.{entity}.create).toHaveBeenCalledWith({ data: dto });
      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          detailType: '{entity}.created',
          detail: expect.objectContaining({ id: created.id }),
        })
      );
    });

    it('create_prismaThrows_propagatesErrorWithoutPublishingEvent', async () => {
      mockPrisma.{entity}.create.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.create(create{Entity}DtoFactory.build(), 'corr-001'))
        .rejects.toThrow('DB connection lost');

      expect(mockEvents.publish).not.toHaveBeenCalled();
    });
  });

  describe('remove (soft delete)', () => {
    it('remove_existingId_setsDeletedAtAndPublishesEvent', async () => {
      const record = {entity}Factory.build();
      mockPrisma.{entity}.findFirst.mockResolvedValue(record);
      mockPrisma.{entity}.update.mockResolvedValue({ ...record, deletedAt: new Date() });

      await service.remove(record.id, 'corr-001');

      expect(mockPrisma.{entity}.update).toHaveBeenCalledWith({
        where: { id: record.id },
        data:  expect.objectContaining({ deletedAt: expect.any(Date) }),
      });
      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({ detailType: '{entity}.deleted' })
      );
    });

    it('remove_nonExistentId_throwsNotFoundWithoutUpdatingOrPublishing', async () => {
      mockPrisma.{entity}.findFirst.mockResolvedValue(null);

      await expect(service.remove('bad-id', 'corr-001'))
        .rejects.toThrow({Entity}NotFoundException);

      expect(mockPrisma.{entity}.update).not.toHaveBeenCalled();
      expect(mockEvents.publish).not.toHaveBeenCalled();
    });
  });
});
```

> Full template: `@.claude/templates/nestjs-service-unit-test.ts`
> Controller template: `@.claude/templates/nestjs-controller-unit-test.ts`

---

## Integration Test Pattern (Testcontainers)

### Rules
- **One container per suite** — `beforeAll`, not `beforeEach` (saves 10–30s per test)
- **Data reset per test** — `deleteMany` in `beforeEach` in reverse FK order, not container restart
- **Run Prisma migrations** — not `db push`; migrations test real schema evolution
- **`--runInBand`** — required to prevent port conflicts across parallel suites
- **Mock EventBridge** — real event publishing to AWS is not needed in integration tests
- **`MOCK_AUTH_ENABLED=true`** — use mock JWT guard to avoid PingID dependency locally

```typescript
// apps/api/src/modules/{entity}/__tests__/{entity}.integration.spec.ts
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import { PrismaService } from '../../database';
import { EventBridgeService } from '../../events/eventbridge.service';
import { AppModule } from '../../../app.module';
import { GlobalExceptionFilter } from '../../../common/filters/global-exception.filter';
import { {entity}Factory, create{Entity}DtoFactory } from '../__fixtures__/{entity}.fixtures';
import { preflightCheck } from '../../../test/helpers/preflight.helper';

let app:       INestApplication;
let prisma:    PrismaService;
let container: StartedPostgreSqlContainer;
const mockEventBridge = { publish: jest.fn().mockResolvedValue(undefined) };

beforeAll(async () => {
  await preflightCheck(['postgres']);

  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('test_db')
    .withUsername('test')
    .withPassword('test')
    .start();

  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider('DATABASE_URL').useValue(container.getConnectionUri())
    .overrideProvider(EventBridgeService).useValue(mockEventBridge)
    .compile();

  app    = module.createNestApplication();
  prisma = module.get(PrismaService);

  // ⚠️ Must match production bootstrap order exactly
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.setGlobalPrefix('v1');
  await app.init();

  // Run migrations — not db push
  execSync('pnpm prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: container.getConnectionUri() },
    stdio: 'pipe',
  });
}, 90_000);

afterAll(async () => {
  await app?.close();
  await container?.stop();
});

beforeEach(async () => {
  jest.clearAllMocks();
  // Delete in reverse FK order — children before parents
  await prisma.{childEntity}.deleteMany();
  await prisma.{entity}.deleteMany();
});

// Auth helpers (MOCK_AUTH_ENABLED=true — tokens validated by MockPingIdGuard)
const auth     = (role: 'admin' | 'editor' | 'viewer' = 'admin') =>
  ({ Authorization: `Bearer test-token-${role}` });
const noAuth   = () => ({});
const corrId   = (id = 'it-corr-001') => ({ 'x-correlation-id': id });

describe('{Entity}Controller (Integration)', () => {
  describe('POST /v1/{entities}', () => {
    it('returns_201_withLocationHeader_andPersistsRow', async () => {
      const dto = create{Entity}DtoFactory.build();

      const res = await request(app.getHttpServer())
        .post('/v1/{entities}')
        .set(auth())
        .set(corrId('post-001'))
        .send(dto)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.headers.location).toMatch(/\/v1\/{entities}\//);

      // Verify DB state — not just response body
      const saved = await prisma.{entity}.findUnique({ where: { id: res.body.id } });
      expect(saved).not.toBeNull();
      expect(saved!.deletedAt).toBeNull();

      // Verify event published
      expect(mockEventBridge.publish).toHaveBeenCalledWith(
        expect.objectContaining({ detailType: '{entity}.created' })
      );
    });

    it('returns_400_withRfc7807_noStackTrace', async () => {
      await request(app.getHttpServer())
        .post('/v1/{entities}')
        .set(auth())
        .set(corrId('post-400'))
        .send({ name: '' })
        .expect(400)
        .expect((res) => {
          expect(res.body.title).toBe('Validation Failed');
          expect(res.body.correlationId).toBe('post-400');
          expect(res.body.errors).toBeDefined();
          expect(res.body).not.toHaveProperty('stack');    // never expose
          expect(res.body).not.toHaveProperty('message'); // NestJS default — must be suppressed
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

  describe('DELETE /v1/{entities}/:id', () => {
    it('returns_204_softDeletes_andSubsequentGetReturns404', async () => {
      const record = await prisma.{entity}.create({
        data: { ...{entity}Factory.build(), createdBy: 'seed', updatedBy: 'seed' },
      });

      await request(app.getHttpServer())
        .delete(`/v1/{entities}/${record.id}`)
        .set(auth())
        .expect(204);

      // Verify soft delete — row must still exist in DB
      const after = await prisma.{entity}.findUnique({ where: { id: record.id } });
      expect(after).not.toBeNull();
      expect(after!.deletedAt).not.toBeNull();

      // Verify API hides it
      await request(app.getHttpServer())
        .get(`/v1/{entities}/${record.id}`)
        .set(auth())
        .expect(404);
    });
  });
});
```

> Full template: `@.claude/templates/nestjs-integration-test.ts`
> Testcontainers performance and lifecycle: `@.claude/patterns/testcontainers-pattern.md`

---

## Frontend Component Test Pattern

### React Query Setup

Always use `renderWithProviders` — never `render()` directly in component tests.
Fresh `QueryClient` per test prevents cache bleed.

```typescript
// apps/web/src/test/helpers/render-with-providers.tsx
import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries:   { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return {
    ...render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    ),
    queryClient, // expose for cache assertions
  };
}
```

### MSW Setup

```typescript
// apps/web/jest.setup.ts
import '@testing-library/jest-dom';
import { server } from '@/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());   // ← prevents handler bleed
afterAll(() => server.close());
```

### Component Test Pattern

```typescript
// CreateUserForm.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test/helpers/render-with-providers';
import { CreateUserForm } from './CreateUserForm';

describe('CreateUserForm', () => {
  it('submits_validForm_showsSuccessMessage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateUserForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'securepass123');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() =>
      expect(screen.getByText(/user created/i)).toBeInTheDocument()
    );
  });

  it('submit_emptyForm_showsInlineValidationErrors', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateUserForm />);

    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
  });

  it('submit_409Conflict_showsAlertWithConflictMessage', async () => {
    server.use(
      http.post('/v1/users', () =>
        HttpResponse.json({ title: 'Conflict', status: 409 }, { status: 409 })
      )
    );
    const user = userEvent.setup();
    renderWithProviders(<CreateUserForm />);

    await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
    await user.type(screen.getByLabelText(/password/i), 'securepass123');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i)
    );
  });
});
```

> Full template: `@.claude/templates/jest-unit-test.ts`
> MSW handler pattern: `@.claude/patterns/msw-handler-pattern.md`

---

## React Hook Test Pattern

For custom hooks that extend generated orval hooks (optimistic updates, cache manipulation, derived state).
**Do not test generated hooks from `hooks/generated/` directly.**

```typescript
// {entity}.hook.test.tsx
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { createTestQueryClient } from '@/test/helpers/render-with-providers';
import { useCreate{Entity}Optimistic } from '@/hooks/{entities}.hooks';
import { {entity}ResponseFactory } from './__fixtures__/{entity}.fixtures';

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useCreate{Entity}Optimistic', () => {
  it('optimisticallyAdds{Entity}ToCacheBeforeApiResponse', async () => {
    const queryClient = createTestQueryClient();
    const queryKey    = ['{entities}', { page: 1, limit: 20 }];
    queryClient.setQueryData(queryKey, {entity}ResponseFactory.buildPage([]));

    server.use(
      http.post('/v1/{entities}', async () => {
        await new Promise((r) => setTimeout(r, 100));
        return HttpResponse.json({entity}ResponseFactory.build({ name: 'Optimistic' }), { status: 201 });
      })
    );

    const { result } = renderHook(() => useCreate{Entity}Optimistic(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => { result.current.mutate({ name: 'Optimistic' }); });

    await waitFor(() => {
      const cached = queryClient.getQueryData<{ data: unknown[] }>(queryKey);
      expect(cached?.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'Optimistic' })])
      );
    });
  });

  it('rollsBackOptimisticUpdate_onApiFailure', async () => {
    server.use(
      http.post('/v1/{entities}', () =>
        HttpResponse.json({ status: 500 }, { status: 500 })
      )
    );

    const queryClient = createTestQueryClient();
    const original    = {entity}ResponseFactory.buildPage({entity}ResponseFactory.buildList(2));
    const queryKey    = ['{entities}', undefined];
    queryClient.setQueryData(queryKey, original);

    const { result } = renderHook(() => useCreate{Entity}Optimistic(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => { result.current.mutate({ name: 'Will Fail' }); });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(queryClient.getQueryData(queryKey)).toEqual(original);
  });
});
```

> Full template: `@.claude/templates/react-hook-test.tsx`

---

## Storybook Component Testing

### Story-Based Unit Tests

Always derive tests from stories using `composeStories`. Never duplicate setup between stories and tests.

```typescript
import { composeStories } from '@storybook/react';
import * as stories from './ComponentName.stories';

const { Primary, Loading, Disabled } = composeStories(stories);

test('renders_primaryVariant_showsButton', () => {
  render(<Primary />);
  expect(screen.getByRole('button')).toBeInTheDocument();
});
```

### Interaction Tests in Stories

Use the `play` function for user-flow testing inside Storybook stories:

```typescript
export const UserFlow: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /submit/i }));
    await expect(canvas.getByText('Success')).toBeVisible();
  },
};
```

### Accessibility Tests

Every story that renders a complete interactive component **must** include an `AccessibilityAudit` story with axe-core config.
See `.claude/standards/storybook-standards.md` § 7.

### Jest Config for `composeStories`

```typescript
testEnvironmentOptions: {
  customExportConditions: ['', 'require', 'default'],
},
```

### Running Storybook Tests

```bash
pnpm --filter @repo/web test-storybook       # All stories
pnpm --filter @repo/web storybook:a11y       # Accessibility only
pnpm --filter @repo/web storybook            # Dev server at :6006
```

---

## API Contract Test Pattern

API contract tests treat the running application as a black box.
They validate HTTP semantics, response shapes against the OpenAPI spec,
required headers, error formats, and auth flows.

**Difference from integration tests:**

| | Integration Test | API Contract Test |
|---|---|---|
| App | In-process (Testcontainers) | Running at `localhost:3001` |
| DB | Testcontainers Postgres | Real local Postgres |
| Tests | HTTP + DB state + events | HTTP contract only |
| Run in | CI (any environment) | CI against staging |

```typescript
// apps/api/src/test/api/{entity}.api.spec.ts
import * as request from 'supertest';
import { preflightCheck } from '../helpers/preflight.helper';
import { getTestAuthToken } from '../helpers/auth-token.helper';

const API_BASE = process.env.API_INTERNAL_BASE_URL ?? 'http://localhost:3001';

beforeAll(async () => {
  await preflightCheck(['postgres', 'api']);
}, 10_000);

describe('{Entity} API Contract', () => {
  it('contract_validRequest_responseMatchesSchema', async () => {
    const res = await request(API_BASE)
      .post('/v1/{entities}')
      .set({ Authorization: `Bearer ${await getTestAuthToken('admin')}` })
      .set({ 'x-correlation-id': 'api-post-001' })
      .send(create{Entity}DtoFactory.build())
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.headers.location).toMatch(/\/v1\/{entities}\//);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('contract_missingAuth_returns401', async () => {
    await request(API_BASE)
      .get('/v1/{entities}')
      .expect(401);
  });

  it('contract_correlationId_echoedInResponseHeader', async () => {
    const res = await request(API_BASE)
      .get('/v1/{entities}')
      .set({ Authorization: `Bearer ${await getTestAuthToken()}` })
      .set({ 'x-correlation-id': 'echo-test-123' })
      .expect(200);

    expect(res.headers['x-correlation-id']).toBe('echo-test-123');
  });
});
```

> Full command: `/add-api-test`

---

## Anti-Pattern Reference

| Anti-Pattern | Why Dangerous | Correct Approach |
|---|---|---|
| `jest.mock('@tanstack/react-query')` | Tests nothing real | MSW intercepts real fetch |
| Shared `QueryClient` across tests | Cache bleed = false positives | `createTestQueryClient()` per test |
| Mocking Postgres | Misses SQL, migration, FK constraint bugs | Testcontainers |
| Not asserting `mockEvents.publish` | Event publishing silently broken | Always assert publish or `not.toHaveBeenCalled()` |
| `expect(true).toBe(true)` | Always passes regardless of logic | Real assertion on real value |
| Tests without error paths | Ships broken error handling | Test 4xx/5xx explicitly |
| `@jest.skip` without reason | Silently ignored failures | Comment with ticket number or delete |
| Testing generated hooks directly | Tests orval output, not your code | Test the component that uses the hook |
| New Testcontainers container per test | Catastrophically slow (10–30s × test count) | One container per suite in `beforeAll` |
| Not asserting `deletedAt` in soft-delete tests | Thinks row is gone when it isn't | Assert DB row exists with `deletedAt` set |
| Snapshot tests on dynamic components | Breaks on every UI change | Behavioural assertions on roles/text |

---

## Quality Checklist

- [ ] Unit tests mock all external dependencies
- [ ] All branches covered: happy path, not-found, validation, conflict, error propagation
- [ ] EventBridge publish asserted on mutation success; `not.toHaveBeenCalled()` on failure
- [ ] Integration tests use real Postgres via Testcontainers
- [ ] Integration tests verify DB state directly (not just response body)
- [ ] Soft-delete tests: verify row exists with `deletedAt` set; subsequent GET returns 404
- [ ] Test cleanup deletes child tables before parents (reverse FK order)
- [ ] Fixtures use faker factories — no inline object literals
- [ ] Deterministic `SEED_ID` constants match `packages/database/prisma/seed.ts`
- [ ] No shared mutable state between tests
- [ ] Fresh `QueryClient` per React component test (`renderWithProviders`)
- [ ] MSW `{ onUnhandledRequest: 'error' }` configured in `jest.setup.ts`
- [ ] `server.resetHandlers()` called in `afterEach`
- [ ] Coverage thresholds enforced in CI (80% branches, 85% lines)
- [ ] Exception paths: 100% coverage
- [ ] Auth guard paths: 100% coverage
- [ ] `pnpm test:preflight` passes before integration/API/E2E tests
- [ ] `--runInBand` used for integration tests
- [ ] Storybook `play` functions cover critical user interactions
- [ ] axe-core: 0 violations in Storybook accessibility stories
- [ ] MSW handlers generated from OpenAPI spec via orval (baseline)

---

## pnpm Scripts

```json
// apps/api/package.json
{
  "scripts": {
    "test":             "jest --selectProjects unit",
    "test:integration": "jest --selectProjects integration --runInBand",
    "test:api":         "jest --selectProjects api --runInBand",
    "test:all":         "jest --runInBand",
    "test:coverage":    "jest --selectProjects unit --coverage",
    "test:preflight":   "tsx ../../scripts/preflight-check.ts --scope=integration"
  }
}

// root package.json
{
  "scripts": {
    "test:preflight":     "tsx scripts/preflight-check.ts",
    "test:preflight:api": "tsx scripts/preflight-check.ts --scope=api",
    "test:preflight:e2e": "tsx scripts/preflight-check.ts --scope=e2e"
  }
}
```

---

## Cross-References

| Resource | Location |
|---|---|
| Test commands | `/add-unit-test`, `/add-integration-test`, `/add-api-test`, `/add-e2e-test` |
| Coverage audit | `/test-coverage-audit` |
| Test generation | `/generate-tests` |
| TDD workflow | `@.claude/workflows/test-driven-development.md` |
| Playwright TDD workflow | `@.claude/workflows/playwright-tdd-workflow.md` |
| Pre-flight workflow | `@.claude/workflows/preflight-checks.md` |
| Pre-flight script | `scripts/preflight-check.ts` |
| Testcontainers pattern | `@.claude/patterns/testcontainers-pattern.md` |
| MSW handler pattern | `@.claude/patterns/msw-handler-pattern.md` |
| Fixture factory pattern | `@.claude/patterns/fixture-factory-pattern.md` |
| Playwright POM pattern | `@.claude/patterns/playwright-page-object-pattern.md` |
| Playwright fixture pattern | `@.claude/patterns/playwright-fixture-pattern.md` |
| NestJS service template | `@.claude/templates/nestjs-service-unit-test.ts` |
| NestJS controller template | `@.claude/templates/nestjs-controller-unit-test.ts` |
| NestJS integration template | `@.claude/templates/nestjs-integration-test.ts` |
| React component template | `@.claude/templates/jest-unit-test.ts` |
| React hook template | `@.claude/templates/react-hook-test.tsx` |
| Fixture factory template | `@.claude/templates/fixture-factory.ts` |
| Playwright E2E template | `@.claude/templates/playwright-e2e.ts` |
| Playwright POM template | `@.claude/templates/playwright-page-object.ts` |
| Playwright API mock template | `@.claude/templates/playwright-api-mock.ts` |
| Playwright fixture template | `@.claude/templates/playwright-fixtures.ts` |
| E2E standards | `@.claude/standards/playwright-e2e-standards.md` |
| Playwright audit command | `/playwright-ui-audit` → `@.claude/commands/ui-audit-playwright.md` |
| Playwright E2E command | `/add-e2e-test` → `@.claude/commands/add-e2e-test.md` |
| Playwright coverage command | `/playwright-coverage-audit` → `@.claude/commands/playwright-coverage-audit.md` |
| Storybook standards | `@.claude/standards/storybook-standards.md` |
| API standards | `@.claude/standards/api-standards.md` |
| Frontend standards | `@.claude/standards/frontend-standards.md` |
| Test strategist agent | `@.claude/agents/test-strategist.md` |
| Test engineer agent | `@.claude/agents/test-engineer.md` |

## Token Optimization

- **Load when**: ANY test work — unit, integration, API contract, E2E, performance.
- **Load only**: this standard FIRST, then add layer-specific patterns: `testcontainers-pattern.md` (integration), `msw-handler-pattern.md` (frontend), `playwright-page-object-pattern.md` (E2E), `fixture-factory-pattern.md` (any layer with fixtures).
- **Unload after**: tests written, pass, coverage threshold met. Drop layer-specific patterns once their test type is done.
