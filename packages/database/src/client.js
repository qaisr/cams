'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.getPrismaClient = getPrismaClient;
exports.resetPrismaClient = resetPrismaClient;
const adapter_pg_1 = require('@prisma/adapter-pg');
const client_1 = require('@prisma/client');
let prisma;
function getPrismaClient() {
  if (!prisma) {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    const adapter = new adapter_pg_1.PrismaPg(connectionString);
    prisma = new client_1.PrismaClient({
      adapter,
      log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prisma;
}
function resetPrismaClient() {
  prisma = undefined;
}
//# sourceMappingURL=client.js.map
