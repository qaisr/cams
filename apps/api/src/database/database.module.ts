import { Global, Module } from '@nestjs/common';

import { getPrismaClient } from '@repo/database';

import { PrismaService } from './prisma.service';

/**
 * Global module that exposes the connection-safe Prisma singleton (single pool
 * per process behind RDS Proxy) as an injectable `PrismaService`. Import once
 * (in AppModule); every feature module can then inject `PrismaService` without
 * re-importing.
 */
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      // Return the shared singleton — never `new PrismaClient()` here.
      useFactory: () => getPrismaClient(),
    },
  ],
  exports: [PrismaService],
})
export class DatabaseModule {}
