import { Injectable } from '@nestjs/common';

import { getPrismaClient } from '@repo/database';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  db: 'connected' | 'disconnected';
}

@Injectable()
export class HealthService {
  async check(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    let db: 'connected' | 'disconnected' = 'disconnected';

    try {
      const prisma = getPrismaClient();
      await prisma.$queryRaw<[{ '?column?': number }]>`SELECT 1`;
      db = 'connected';
    } catch {
      // Non-500: return degraded status rather than throwing
    }

    return {
      status: db === 'connected' ? 'ok' : 'degraded',
      timestamp,
      db,
    };
  }
}
