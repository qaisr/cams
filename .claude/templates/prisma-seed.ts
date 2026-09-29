// Template: Prisma Database Seed
// File: prisma/seeds/index.ts

import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { seedOrganizations } from './seed-organizations';
import { seedUsers } from './seed-users';
import { seedDocuments } from './seed-documents';

// Deterministic seeds for reproducibility
faker.seed(42);

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

async function main() {
  console.log('🌱 Starting database seed...');

  // Order matters — respect FK dependencies
  const orgs = await seedOrganizations(prisma);
  console.log(`✅ Seeded ${orgs.length} organizations`);

  const users = await seedUsers(prisma, orgs);
  console.log(`✅ Seeded ${users.length} users`);

  const documents = await seedDocuments(prisma, users, orgs);
  console.log(`✅ Seeded ${documents.length} documents`);

  console.log('🎉 Seed complete!');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// ────────────────────────────────────────────────────────────────────────────
// prisma/seeds/seed-organizations.ts

export async function seedOrganizations(prisma: PrismaClient) {
  const orgs = [
    { id: 'org_seed_001', name: 'Acme Corporation', slug: 'acme' },
    { id: 'org_seed_002', name: 'Globex Inc', slug: 'globex' },
  ];

  return Promise.all(
    orgs.map((org) =>
      prisma.organization.upsert({
        where: { id: org.id },
        update: {},
        create: org,
      })
    )
  );
}

// ────────────────────────────────────────────────────────────────────────────
// prisma/seeds/seed-users.ts

export async function seedUsers(
  prisma: PrismaClient,
  orgs: Array<{ id: string }>
) {
  // Deterministic test users (known credentials for dev)
  const fixedUsers = [
    {
      id: 'user_seed_admin',
      email: 'admin@seed.example.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      orgId: orgs[0].id,
    },
    {
      id: 'user_seed_viewer',
      email: 'viewer@seed.example.com',
      firstName: 'View',
      lastName: 'Only',
      role: 'viewer',
      orgId: orgs[0].id,
    },
  ];

  // Random users for load testing
  const randomUsers = Array.from({ length: 20 }, (_, i) => ({
    id: `user_seed_${String(i).padStart(3, '0')}`,
    email: `user${i}@seed.example.com`,
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    role: 'member',
    orgId: orgs[i % orgs.length].id,
  }));

  const allUsers = [...fixedUsers, ...randomUsers];

  return Promise.all(
    allUsers.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: user,
      })
    )
  );
}
