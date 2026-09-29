/**
 * Fixture Factory Template
 *
 * Replace: {Entity}, {entity}, {entities}
 * Location: apps/api/src/modules/{entity}/__fixtures__/{entity}.fixtures.ts
 *           apps/web/src/components/{entities}/__fixtures__/{entity}.fixtures.ts
 *
 * Rules:
 * - Dates: use deterministic strings for frontend fixtures ('2024-01-01T00:00:00.000Z')
 * - Dates: use new Date() for backend Prisma model fixtures
 * - SEED_ID constants: must match packages/database/prisma/seed.ts
 * - buildList: always creates unique instances (no shared reference)
 */

import { faker } from '@faker-js/faker';
import type { {Entity} } from '@prisma/client';
import type {
  Create{Entity}DtoType,
  Update{Entity}DtoType,
  {Entity}ResponseDtoType,
} from '@repo/validation';

// ─────────────────────────────────────────────────────────────────────────────
// PRISMA MODEL FACTORY (backend — service + integration tests)
// ─────────────────────────────────────────────────────────────────────────────
export const {entity}Factory = {
  // Deterministic seed IDs — must match packages/database/prisma/seed.ts
  SEED_ID:   '11111111-1111-1111-1111-111111111111' as const,
  SEED_ID_2: '22222222-2222-2222-2222-222222222222' as const,

  build(overrides: Partial<{Entity}> = {}): {Entity} {
    return {
      id:        faker.string.uuid(),
      name:      faker.commerce.productName(),
      status:    'ACTIVE',
      // Add all other required Prisma model fields here
      deletedAt: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      createdBy: faker.string.uuid(),
      updatedBy: faker.string.uuid(),
      ...overrides,
    };
  },

  buildList(count: number, overrides: Partial<{Entity}> = {}): {Entity}[] {
    return Array.from({ length: count }, () => this.build(overrides));
  },

  buildSeed(): {Entity} {
    return this.build({ id: this.SEED_ID, name: 'Seed {Entity}' });
  },

  buildSoftDeleted(overrides: Partial<{Entity}> = {}): {Entity} {
    return this.build({ ...overrides, deletedAt: new Date() });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DTO FACTORIES (backend — service unit tests)
// ─────────────────────────────────────────────────────────────────────────────
export const create{Entity}DtoFactory = {
  build(overrides: Partial<Create{Entity}DtoType> = {}): Create{Entity}DtoType {
    return {
      name:   faker.commerce.productName(),
      // Add all other DTO fields here
      ...overrides,
    };
  },
};

export const update{Entity}DtoFactory = {
  build(overrides: Partial<Update{Entity}DtoType> = {}): Update{Entity}DtoType {
    return {
      name: faker.commerce.productName(),
      ...overrides,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE DTO FACTORY (frontend — MSW handlers + component tests)
// ─────────────────────────────────────────────────────────────────────────────
export const {entity}ResponseFactory = {
  SEED_ID:   '11111111-1111-1111-1111-111111111111' as const,

  build(overrides: Partial<{Entity}ResponseDtoType> = {}): {Entity}ResponseDtoType {
    return {
      id:        faker.string.uuid(),
      name:      faker.commerce.productName(),
      status:    'ACTIVE',
      // ISO string dates — not Date objects (JSON serialized)
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      ...overrides,
    };
  },

  buildList(
    count: number,
    overrides: Partial<{Entity}ResponseDtoType> = {}
  ): {Entity}ResponseDtoType[] {
    return Array.from({ length: count }, () => this.build(overrides));
  },

  buildPage(
    data: {Entity}ResponseDtoType[],
    options: { total?: number; page?: number; limit?: number } = {}
  ) {
    return {
      data,
      total:  options.total ?? data.length,
      page:   options.page  ?? 1,
      limit:  options.limit ?? 20,
    };
  },

  buildSeed(): {Entity}ResponseDtoType {
    return this.build({ id: this.SEED_ID, name: 'Seed {Entity}' });
  },
};
