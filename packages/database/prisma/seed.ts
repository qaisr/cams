import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      lanId: 'superadmin001',
      email: 'superadmin@app.local',
      name: 'Super Admin',
    },
  });

  await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      lanId: 'admin001',
      email: 'admin@app.local',
      name: 'Admin User',
    },
  });

  await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      lanId: 'user001',
      email: 'user@app.local',
      name: 'Regular User',
    },
  });

  console.warn('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
