# Fixture Factory Pattern

> How to create and use test data factories in this monorepo.
> Factories live in `__fixtures__/` directories alongside source files.

## Why Factories, Not Literals

```typescript
// ❌ WRONG — inline literals
it('creates user', () => {
  const user = {
    id: '123',
    email: 'test@test.com',
    name: 'Test',
    status: 'ACTIVE',
    // Missing required fields — will fail TypeScript in future
  };
});

// ✅ CORRECT — factory with defaults, override only what matters
it('creates user', () => {
  const user = userFactory.build({ status: 'INACTIVE' });
  // All required fields populated, only override what the test needs
});
```

## Factory Location

```
apps/api/src/modules/{entity}/
└── __fixtures__/
    └── {entity}.fixtures.ts    ← Prisma model factories + DTO factories

apps/web/src/components/{resource}/
└── __fixtures__/
    └── {entity}.fixtures.ts    ← Response DTO fixtures for MSW handlers
```

## Factory Structure

```typescript
// apps/api/src/modules/{entity}/__fixtures__/{entity}.fixtures.ts
import { faker } from '@faker-js/faker';
import type { {Entity} } from '@prisma/client';
import type {
  Create{Entity}DtoType,
  Update{Entity}DtoType,
  {Entity}ResponseDtoType,
} from '@repo/validation';

// ── Prisma model factory (backend) ────────────────────────────────────────────
export const {entity}Factory = {
  build: (overrides: Partial<{Entity}> = {}): {Entity} => ({
    id:        faker.string.uuid(),
    name:      faker.commerce.productName(),
    status:    'ACTIVE',
    deletedAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),  // deterministic for snapshots
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    createdBy: faker.string.uuid(),
    updatedBy: faker.string.uuid(),
    ...overrides,
  }),

  buildList: (count: number, overrides: Partial<{Entity}> = {}): {Entity}[] =>
    Array.from({ length: count }, () => {entity}Factory.build(overrides)),

  // Deterministic IDs — used in seed.ts and referenced in tests
  // that need to query specific known records
  SEED_ID: '11111111-1111-1111-1111-111111111111' as const,
  SEED_ID_2: '22222222-2222-2222-2222-222222222222' as const,

  buildSeed: (): {Entity} =>
    {entity}Factory.build({ id: {entity}Factory.SEED_ID }),
};

// ── DTO factories ─────────────────────────────────────────────────────────────
export const create{Entity}DtoFactory = {
  build: (overrides: Partial<Create{Entity}DtoType> = {}): Create{Entity}DtoType => ({
    name:   faker.commerce.productName(),
    status: 'ACTIVE',
    ...overrides,
  }),
};

export const update{Entity}DtoFactory = {
  build: (overrides: Partial<Update{Entity}DtoType> = {}): Update{Entity}DtoType => ({
    name: faker.commerce.productName(),
    ...overrides,
  }),
};

// ── Response DTO factory (frontend MSW handlers) ──────────────────────────────
export const {entity}ResponseFactory = {
  build: (overrides: Partial<{Entity}ResponseDtoType> = {}): {Entity}ResponseDtoType => ({
    id:        faker.string.uuid(),
    name:      faker.commerce.productName(),
    status:    'ACTIVE',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  buildList: (
    count: number,
    overrides: Partial<{Entity}ResponseDtoType> = {}
  ): {Entity}ResponseDtoType[] =>
    Array.from({ length: count }, () => {entity}ResponseFactory.build(overrides)),

  buildPage: (
    data: {Entity}ResponseDtoType[],
    total = data.length
  ) => ({
    data,
    total,
    page: 1,
    limit: 20,
  }),
};
```

## Using Deterministic IDs

For tests that reference seed data (seeded in `packages/database/prisma/seed.ts`):

```typescript
// packages/database/prisma/seed.ts
await prisma.{entity}.create({
  data: {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Seed {Entity}',
    // ...
  },
});

// In tests — reference the same known ID
it('finds seeded record', async () => {
  const result = await service.findById({entity}Factory.SEED_ID);
  expect(result.name).toBe('Seed {Entity}');
});
```

## Factory in Integration Tests

```typescript
// Create in DB, not just in memory
const record = await prisma.{entity}.create({
  data: {
    // Spread factory for all required fields
    ...{entity}Factory.build(),
    // Add audit fields required by DB constraints
    createdBy: 'test-seed',
    updatedBy: 'test-seed',
    // Override specific fields for this test scenario
    name: 'Specific Name for This Test',
  },
});
```

## Faker Seed for Reproducible Failures

When a test fails due to faker-generated data, set seed for reproduction:

```typescript
// In your test or beforeAll — makes faker deterministic
faker.seed(12345);

// Or per-test
beforeEach(() => {
  faker.seed(Date.now());  // random but printed in test output for reproduction
  console.log('Faker seed:', faker.seed());
});
```

## Token Optimization

**Load when** when generating typed test fixtures (Prisma model / DTO / response). **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
