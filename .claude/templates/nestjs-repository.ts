// Template: Prisma-based Repository
// Thin wrapper for complex queries. Simple CRUD goes directly in service via PrismaService.
// Usage: Replace {Entity}, {entity}, {entities} with actual names

import { Injectable } from '@nestjs/common';
// PrismaService (injectable singleton wrapper) lives in the API app's database
// module. Adjust the relative path to your module depth.
import { PrismaService } from '../../database';
// Import the Prisma namespace (query types) from the shared package barrel.
import { Prisma } from '@repo/database';

@Injectable()
export class {Entity}Repository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Complex paginated query with filters.
   * Use for queries that would be verbose inline in the service.
   */
  async findManyWithFilters(
    filters: {
      status?: string;
      search?: string;
      tenantId?: string;
    },
    pagination: { skip: number; take: number; orderBy: Prisma.{Entity}OrderByWithRelationInput },
  ) {
    const where: Prisma.{Entity}WhereInput = {
      deletedAt: null,
      ...(filters.tenantId && { tenantId: filters.tenantId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    return this.prisma.$transaction([
      this.prisma.{entity}.findMany({ where, ...pagination }),
      this.prisma.{entity}.count({ where }),
    ]);
  }

  /**
   * Upsert pattern — safe for idempotent operations.
   */
  async upsertByExternalId(
    externalId: string,
    create: Prisma.{Entity}CreateInput,
    update: Prisma.{Entity}UpdateInput,
  ) {
    return this.prisma.{entity}.upsert({
      where: { externalId },
      create,
      update,
    });
  }

  /**
   * Soft-delete multiple by IDs (bulk operation).
   */
  async bulkSoftDelete(ids: string[], actorId: string): Promise<number> {
    const result = await this.prisma.{entity}.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });
    return result.count;
  }
}
