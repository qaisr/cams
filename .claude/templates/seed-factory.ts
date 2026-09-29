/**
 * Seed Factory Template
 *
 * Usage: Copy per entity, replace ENTITY_NAME placeholders
 * Standards: idempotent upserts, faker-based, env-aware
 */
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

// ─── Builder Pattern Factory ──────────────────────────────────────────────────

interface ENTITY_NAMEOverrides {
  id?: string;
  // Add entity-specific field overrides here
  name?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  createdAt?: Date;
}

export function buildENTITY_NAME(overrides: ENTITY_NAMEOverrides = {}) {
  return {
    id: overrides.id ?? faker.string.uuid(),
    name: overrides.name ?? faker.commerce.productName(),
    status: overrides.status ?? 'ACTIVE',
    createdAt: overrides.createdAt ?? faker.date.past(),
    updatedAt: new Date(),
  };
}

// ─── Seed Functions ───────────────────────────────────────────────────────────

/**
 * Seed reference/lookup data — runs first, always idempotent
 */
export async function seedReferenceData() {
  const referenceItems = [
    { id: 'ref-1', code: 'TYPE_A', label: 'Type A' },
    { id: 'ref-2', code: 'TYPE_B', label: 'Type B' },
  ];

  for (const item of referenceItems) {
    await prisma.referenceTable.upsert({
      where: { id: item.id },
      create: item,
      update: { label: item.label }, // only update safe fields
    });
  }
  console.log(`✓ Seeded ${referenceItems.length} reference items`);
}

/**
 * Seed ENTITY_NAME records — safe to re-run
 */
export async function seedENTITY_NAMEs(count = 10) {
  const entities = Array.from({ length: count }, (_, i) =>
    buildENTITY_NAME({ id: `seed-entity-${i + 1}` }) // deterministic IDs
  );

  let created = 0;
  for (const entity of entities) {
    const result = await prisma.eNTITY_NAME.upsert({
      where: { id: entity.id },
      create: entity,
      update: {}, // don't overwrite existing seed data
    });
    if (result) created++;
  }
  console.log(`✓ Seeded ${created} ENTITY_NAME records`);
}

// ─── Environment-Specific Seeds ───────────────────────────────────────────────

async function seedDevelopment() {
  await seedReferenceData();
  await seedENTITY_NAMEs(50);
}

async function seedTest() {
  await seedReferenceData();
  await seedENTITY_NAMEs(5); // minimal for tests
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const env = process.env.NODE_ENV ?? 'development';
  console.log(`Seeding for environment: ${env}`);

  try {
    if (env === 'test') {
      await seedTest();
    } else {
      await seedDevelopment();
    }
    console.log('✓ Seed complete');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
