// Template: NestJS Service
// Usage: Replace {Entity}, {entity}, {entities} with actual names
// Cross-ref: @.claude/standards/api-standards.md

import { Injectable, Logger } from '@nestjs/common';
// PrismaService is the injectable wrapper around the connection-safe Prisma singleton
// (provided by DatabaseModule). Adjust the relative path to your module depth.
import { PrismaService } from '../../database';
// Prisma model types come from the generated client, re-exported by @repo/database.
// Import the model type ({Entity}) so response mapping is type-checked — never `any`.
import type { {Entity} } from '@repo/database';
import {
  Create{Entity}DtoType, Update{Entity}DtoType,
  PaginationDtoType, {Entity}ResponseDtoType,
} from '@repo/validation';
import {
  {Entity}NotFoundException, {Entity}ConflictException,
} from './exceptions/{entity}.exceptions';
import { EventBridgeService } from '../events/eventbridge.service';

@Injectable()
export class {Entity}Service {
  private readonly logger = new Logger({Entity}Service.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBridgeService,
  ) {}

  async findAll(
    pagination: PaginationDtoType,
    correlationId?: string,
  ): Promise<{ data: {Entity}ResponseDtoType[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const skip = (page - 1) * limit;

    this.logger.log({ action: 'findAll{Entities}', status: 'started', correlationId });

    const [data, total] = await this.prisma.$transaction([
      this.prisma.{entity}.findMany({
        where: { deletedAt: null },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.{entity}.count({ where: { deletedAt: null } }),
    ]);

    this.logger.log({ action: 'findAll{Entities}', status: 'success', count: data.length, correlationId });
    return { data: data.map(this.toResponse), total, page, limit };
  }

  async findById(id: string, correlationId?: string): Promise<{Entity}ResponseDtoType> {
    this.logger.log({ action: 'find{Entity}ById', status: 'started', id, correlationId });

    const record = await this.prisma.{entity}.findFirst({
      where: { id, deletedAt: null },
    });

    if (!record) {
      this.logger.warn({ action: 'find{Entity}ById', status: 'notFound', id, correlationId });
      throw new {Entity}NotFoundException(id, correlationId);
    }

    this.logger.log({ action: 'find{Entity}ById', status: 'success', id, correlationId });
    return this.toResponse(record);
  }

  async create(dto: Create{Entity}DtoType, correlationId?: string): Promise<{Entity}ResponseDtoType> {
    this.logger.log({ action: 'create{Entity}', status: 'started', correlationId });

    const record = await this.prisma.{entity}.create({ data: dto });

    await this.events.publish('{entity}.created', { id: record.id, correlationId });

    this.logger.log({ action: 'create{Entity}', status: 'success', id: record.id, correlationId });
    return this.toResponse(record);
  }

  async update(
    id: string,
    dto: Update{Entity}DtoType,
    correlationId?: string,
  ): Promise<{Entity}ResponseDtoType> {
    await this.findById(id, correlationId); // throws if not found

    const record = await this.prisma.{entity}.update({
      where: { id },
      data: { ...dto, updatedAt: new Date() },
    });

    await this.events.publish('{entity}.updated', { id, correlationId });
    this.logger.log({ action: 'update{Entity}', status: 'success', id, correlationId });
    return this.toResponse(record);
  }

  async patch(
    id: string,
    dto: Partial<Update{Entity}DtoType>,
    correlationId?: string,
  ): Promise<{Entity}ResponseDtoType> {
    await this.findById(id, correlationId);

    const record = await this.prisma.{entity}.update({
      where: { id },
      data: { ...dto, updatedAt: new Date() },
    });

    this.logger.log({ action: 'patch{Entity}', status: 'success', id, correlationId });
    return this.toResponse(record);
  }

  async remove(id: string, correlationId?: string): Promise<void> {
    await this.findById(id, correlationId);

    await this.prisma.{entity}.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.events.publish('{entity}.deleted', { id, correlationId });
    this.logger.log({ action: 'delete{Entity}', status: 'success', id, correlationId });
  }

  // Map Prisma record → response DTO (never expose raw Prisma types)
  private toResponse = (record: {Entity}): {Entity}ResponseDtoType => ({
    id: record.id,
    // ... map fields
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}
