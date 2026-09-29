import { Test, type TestingModule } from '@nestjs/testing';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

import type { HealthStatus } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  const mockHealthService = {
    check: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: mockHealthService }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check()', () => {
    it('returns ok status when database is connected', async () => {
      const response: HealthStatus = {
        status: 'ok',
        timestamp: '2026-01-01T00:00:00.000Z',
        db: 'connected',
      };
      mockHealthService.check.mockResolvedValue(response);

      const result = await controller.check();

      expect(result).toEqual(response);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.check).toHaveBeenCalledTimes(1);
    });

    it('returns degraded status when database is disconnected', async () => {
      const response: HealthStatus = {
        status: 'degraded',
        timestamp: '2026-01-01T00:00:00.000Z',
        db: 'disconnected',
      };
      mockHealthService.check.mockResolvedValue(response);

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.db).toBe('disconnected');
      expect(result.timestamp).toBeDefined();
    });

    it('delegates to HealthService.check()', async () => {
      mockHealthService.check.mockResolvedValue({
        status: 'ok',
        timestamp: new Date().toISOString(),
        db: 'connected',
      });

      await controller.check();

      expect(mockHealthService.check).toHaveBeenCalledTimes(1);
    });
  });
});
