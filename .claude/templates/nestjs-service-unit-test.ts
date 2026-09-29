/**
 * NestJS Service Unit Test Template
 *
 * Replace:
 *   {Entity}         → PascalCase entity name (e.g., User, Booking)
 *   {entity}         → camelCase entity name (e.g., user, booking)
 *   {entities}       → plural camelCase (e.g., users, bookings)
 *
 * Location: apps/api/src/modules/{entity}/{entity}.service.spec.ts
 */

import { Test, type TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { {Entity}Service } from './{entity}.service';
// PrismaService (injectable) lives in the API app database module — mock it here.
import { PrismaService } from '../../database';
import { EventBridgeService } from '../events/eventbridge.service';
import { {Entity}NotFoundException } from './exceptions/{entity}.exceptions';
import {
  {entity}Factory,
  create{Entity}DtoFactory,
  update{Entity}DtoFactory,
} from './__fixtures__/{entity}.fixtures';

// ── Mocks ─────────────────────────────────────────────────────────────────────
// Defined at module level — recreated via jest.clearAllMocks() in beforeEach
const mockPrisma = {
  {entity}: {
    findFirst:  jest.fn(),
    findUnique: jest.fn(),
    findMany:   jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    updateMany: jest.fn(),
    delete:     jest.fn(),
    count:      jest.fn(),
  },
  $transaction: jest.fn(<T>(fn: (tx: typeof mockPrisma) => Promise<T>) =>
    fn(mockPrisma)
  ),
};

const mockEvents = {
  publish:     jest.fn().mockResolvedValue(undefined),
  publishMany: jest.fn().mockResolvedValue(undefined),
};

// ── Suite ──────────────────────────────────────────────────────────────────────
describe('{Entity}Service', () => {
  let service: {Entity}Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {Entity}Service,
        { provide: PrismaService,      useValue: mockPrisma },
        { provide: EventBridgeService, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<{Entity}Service>({Entity}Service);

    // Reset all mock state — prevents test order dependency
    jest.clearAllMocks();
  });

  // ── findById ─────────────────────────────────────────────────────────────────
  describe('findById', () => {
    it('findById_existingId_returnsDto', async () => {
      // Arrange
      const record = {entity}Factory.build();
      mockPrisma.{entity}.findFirst.mockResolvedValue(record);

      // Act
      const result = await service.findById(record.id, 'corr-001');

      // Assert
      expect(result.id).toBe(record.id);
      expect(mockPrisma.{entity}.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: record.id, deletedAt: null } })
      );
    });

    it('findById_nonExistentId_throws{Entity}NotFoundException', async () => {
      mockPrisma.{entity}.findFirst.mockResolvedValue(null);

      await expect(service.findById('non-existent', 'corr-001'))
        .rejects.toThrow({Entity}NotFoundException);

      expect(mockEvents.publish).not.toHaveBeenCalled();
    });

    it('findById_softDeletedId_throws{Entity}NotFoundException', async () => {
      const deleted = {entity}Factory.build({ deletedAt: new Date() });
      mockPrisma.{entity}.findFirst.mockResolvedValue(null); // soft-delete filter

      await expect(service.findById(deleted.id, 'corr-001'))
        .rejects.toThrow({Entity}NotFoundException);
    });

    it('findById_prismaThrows_propagatesError', async () => {
      mockPrisma.{entity}.findFirst.mockRejectedValue(new Error('DB unavailable'));

      await expect(service.findById('any-id', 'corr-001'))
        .rejects.toThrow('DB unavailable');

      expect(mockEvents.publish).not.toHaveBeenCalled();
    });
  });

  // ── findAll ──────────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('findAll_withRecords_returnsPaginatedResult', async () => {
      const records = {entity}Factory.buildList(3);
      mockPrisma.{entity}.findMany.mockResolvedValue(records);
      mockPrisma.{entity}.count.mockResolvedValue(3);

      const result = await service.findAll({ page: 1, limit: 20 }, 'corr-001');

      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
    });

    it('findAll_emptyTable_returnsEmptyPage', async () => {
      mockPrisma.{entity}.findMany.mockResolvedValue([]);
      mockPrisma.{entity}.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, limit: 20 }, 'corr-001');

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ── create ───────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('create_validDto_persistsAndPublishesEvent', async () => {
      // Arrange
      const dto     = create{Entity}DtoFactory.build();
      const created = {entity}Factory.build({ name: dto.name });
      mockPrisma.{entity}.create.mockResolvedValue(created);

      // Act
      const result = await service.create(dto, 'corr-001');

      // Assert — persisted
      expect(result.id).toBe(created.id);
      expect(mockPrisma.{entity}.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: dto.name }) })
      );

      // Assert — event published
      expect(mockEvents.publish).toHaveBeenCalledOnce();
      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          detailType: '{entity}.created',
          detail: expect.objectContaining({ id: created.id }),
        })
      );
    });

    it('create_duplicateName_throwsConflictException', async () => {
      // Simulate Prisma unique constraint violation
      const prismaError = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target: ['name'] },
      });
      mockPrisma.{entity}.create.mockRejectedValue(prismaError);

      await expect(service.create(create{Entity}DtoFactory.build(), 'corr-001'))
        .rejects.toThrow(ConflictException);

      // No event on failed create
      expect(mockEvents.publish).not.toHaveBeenCalled();
    });

    it('create_prismaConnectionError_propagatesWithoutPublishingEvent', async () => {
      mockPrisma.{entity}.create.mockRejectedValue(new Error('Connection lost'));

      await expect(service.create(create{Entity}DtoFactory.build(), 'corr-001'))
        .rejects.toThrow('Connection lost');

      expect(mockEvents.publish).not.toHaveBeenCalled();
    });
  });

  // ── update ───────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('update_existingId_updatesAndPublishesEvent', async () => {
      const existing = {entity}Factory.build();
      const dto      = update{Entity}DtoFactory.build();
      const updated  = { ...existing, ...dto };

      mockPrisma.{entity}.findFirst.mockResolvedValue(existing);
      mockPrisma.{entity}.update.mockResolvedValue(updated);

      const result = await service.update(existing.id, dto, 'corr-001');

      expect(result.id).toBe(existing.id);
      expect(mockPrisma.{entity}.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: existing.id } })
      );
      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({ detailType: '{entity}.updated' })
      );
    });

    it('update_nonExistentId_throwsNotFoundException', async () => {
      mockPrisma.{entity}.findFirst.mockResolvedValue(null);

      await expect(service.update('bad-id', update{Entity}DtoFactory.build(), 'corr-001'))
        .rejects.toThrow({Entity}NotFoundException);

      expect(mockPrisma.{entity}.update).not.toHaveBeenCalled();
      expect(mockEvents.publish).not.toHaveBeenCalled();
    });
  });

  // ── remove (soft delete) ─────────────────────────────────────────────────────
  describe('remove', () => {
    it('remove_existingId_setsDeletedAtAndPublishesEvent', async () => {
      const record = {entity}Factory.build();
      mockPrisma.{entity}.findFirst.mockResolvedValue(record);
      mockPrisma.{entity}.update.mockResolvedValue({
        ...record,
        deletedAt: new Date(),
      });

      await service.remove(record.id, 'corr-001');

      expect(mockPrisma.{entity}.update).toHaveBeenCalledWith({
        where: { id: record.id },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      });
      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({ detailType: '{entity}.deleted' })
      );
    });

    it('remove_nonExistentId_throwsNotFoundWithoutUpdatingOrPublishing', async () => {
      mockPrisma.{entity}.findFirst.mockResolvedValue(null);

      await expect(service.remove('bad-id', 'corr-001'))
        .rejects.toThrow({Entity}NotFoundException);

      expect(mockPrisma.{entity}.update).not.toHaveBeenCalled();
      expect(mockEvents.publish).not.toHaveBeenCalled();
    });

    it('remove_alreadySoftDeleted_throwsNotFoundException', async () => {
      // findFirst with deletedAt: null filter returns null for soft-deleted
      mockPrisma.{entity}.findFirst.mockResolvedValue(null);

      await expect(service.remove('deleted-id', 'corr-001'))
        .rejects.toThrow({Entity}NotFoundException);
    });
  });
});
