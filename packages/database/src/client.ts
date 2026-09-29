import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const adapter = new PrismaPg(connectionString);

    prisma = new PrismaClient({
      adapter,
      log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prisma;
}

export function resetPrismaClient(): void {
  prisma = undefined;
}
