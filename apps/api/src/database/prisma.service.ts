import { PrismaClient } from '@repo/database';

/**
 * Injection token + type for the shared Prisma client.
 *
 * `PrismaService` is the injectable *type* used across the API (constructor
 * params, `app.get(PrismaService)` in tests). The concrete instance is the
 * connection-safe singleton produced by `getPrismaClient()` — wired up in
 * DatabaseModule via a factory provider, NOT constructed here. This keeps a
 * single connection pool per process, which RDS Proxy then multiplexes onto
 * the database.
 *
 * Because the provider yields the singleton, an injected `PrismaService` behaves
 * exactly like a `PrismaClient`: `this.prisma.<model>.findMany(...)`.
 */
export abstract class PrismaService extends PrismaClient {}
