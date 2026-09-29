import * as databaseModule from '@repo/database';

import { HealthService } from './health.service';

jest.mock('@repo/database', () => ({
  getPrismaClient: jest.fn(),
  PrismaClient: jest.fn(),
}));

describe('HealthService', () => {
  let service: HealthService;
  const mockPrisma = { $queryRaw: jest.fn() };

  beforeEach(() => {
    service = new HealthService();
    (databaseModule.getPrismaClient as jest.Mock).mockReturnValue(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('check()', () => {
    it('returns ok status when Prisma query succeeds', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.check();

      expect(result.status).toBe('ok');
      expect(result.db).toBe('connected');
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('returns degraded status when Prisma query throws', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const result = await service.check();

      expect(result.status).toBe('degraded');
      expect(result.db).toBe('disconnected');
      expect(result.timestamp).toBeDefined();
    });

    it('returns degraded status when getPrismaClient throws', async () => {
      (databaseModule.getPrismaClient as jest.Mock).mockImplementation(() => {
        throw new Error('PrismaClient initialization failed');
      });

      const result = await service.check();

      expect(result.status).toBe('degraded');
      expect(result.db).toBe('disconnected');
    });

    it('response timestamp is a valid ISO 8601 string', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const { timestamp } = await service.check();

      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });
});
