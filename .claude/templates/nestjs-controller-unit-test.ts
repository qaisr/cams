/**
 * NestJS Controller Unit Test Template
 *
 * Controllers are thin delegation layers.
 * Test: correct service method called, correct args, correct HTTP response shape.
 * DO NOT test business logic here — that belongs in service.spec.ts
 *
 * Replace {Entity}, {entity}, {entities} as per service template.
 * Location: apps/api/src/modules/{entity}/{entity}.controller.spec.ts
 */

import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { {Entity}Controller } from './{entity}.controller';
import { {Entity}Service } from './{entity}.service';
import {
  {entity}Factory,
  create{Entity}DtoFactory,
  update{Entity}DtoFactory,
} from './__fixtures__/{entity}.fixtures';

// ── Mock Service ───────────────────────────────────────────────────────────────
const mock{Entity}Service = {
  findAll:  jest.fn(),
  findById: jest.fn(),
  create:   jest.fn(),
  update:   jest.fn(),
  remove:   jest.fn(),
};

// ── Suite ──────────────────────────────────────────────────────────────────────
describe('{Entity}Controller', () => {
  let controller: {Entity}Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [{Entity}Controller],
      providers: [
        { provide: {Entity}Service, useValue: mock{Entity}Service },
      ],
    }).compile();

    controller = module.get<{Entity}Controller>({Entity}Controller);
    jest.clearAllMocks();
  });

  // ── findAll ──────────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('findAll_delegatesToService_returnsPageResult', async () => {
      const page = {
        data: {entity}Factory.buildList(2),
        total: 2,
        page: 1,
        limit: 20,
      };
      mock{Entity}Service.findAll.mockResolvedValue(page);

      const result = await controller.findAll(
        { page: 1, limit: 20 },
        'corr-001'
      );

      expect(mock{Entity}Service.findAll).toHaveBeenCalledWith(
        { page: 1, limit: 20 },
        'corr-001'
      );
      expect(result).toBe(page);  // exact same reference
    });
  });

  // ── findOne ──────────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('findOne_delegatesToService_returnsDto', async () => {
      const record = {entity}Factory.build();
      mock{Entity}Service.findById.mockResolvedValue(record);

      const result = await controller.findOne(record.id, 'corr-001');

      expect(mock{Entity}Service.findById).toHaveBeenCalledWith(record.id, 'corr-001');
      expect(result).toBe(record);
    });

    it('findOne_serviceThrowsNotFoundException_propagates', async () => {
      mock{Entity}Service.findById.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne('bad-id', 'corr-001'))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── create ───────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('create_delegatesToService_returnsCreatedDto', async () => {
      const dto     = create{Entity}DtoFactory.build();
      const created = {entity}Factory.build({ name: dto.name });
      mock{Entity}Service.create.mockResolvedValue(created);

      const result = await controller.create(dto, 'corr-001');

      expect(mock{Entity}Service.create).toHaveBeenCalledWith(dto, 'corr-001');
      expect(result).toBe(created);
    });
  });

  // ── update ───────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('update_delegatesToService_returnsUpdatedDto', async () => {
      const existing = {entity}Factory.build();
      const dto      = update{Entity}DtoFactory.build();
      const updated  = { ...existing, ...dto };
      mock{Entity}Service.update.mockResolvedValue(updated);

      const result = await controller.update(existing.id, dto, 'corr-001');

      expect(mock{Entity}Service.update).toHaveBeenCalledWith(
        existing.id, dto, 'corr-001'
      );
      expect(result).toBe(updated);
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('remove_delegatesToService_returnsVoid', async () => {
      mock{Entity}Service.remove.mockResolvedValue(undefined);

      await controller.remove({entity}Factory.SEED_ID, 'corr-001');

      expect(mock{Entity}Service.remove).toHaveBeenCalledWith(
        {entity}Factory.SEED_ID, 'corr-001'
      );
    });

    it('remove_serviceThrowsNotFoundException_propagates', async () => {
      mock{Entity}Service.remove.mockRejectedValue(new NotFoundException());

      await expect(controller.remove('bad-id', 'corr-001'))
        .rejects.toThrow(NotFoundException);
    });
  });
});
