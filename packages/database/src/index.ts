export { getPrismaClient, resetPrismaClient } from './client';
export { PrismaClient, Prisma } from '@prisma/client';
// Re-export Prisma model types (e.g. `User`) so API/services can
// `import type { User } from '@repo/database'` for response mapping.
export type * from '@prisma/client';
