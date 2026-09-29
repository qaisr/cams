# Pattern: Prisma Repository

## Overview
Encapsulate complex Prisma interactions behind typed repository classes.

**When to use a repository:** multi-step queries, transactions, queries reused
across services, or any query with non-trivial `where`/`include`/aggregation
logic. Keep that logic out of the service so it stays testable and reusable.

**When direct `PrismaService` in the service is acceptable:** simple
single-entity CRUD (`findUnique`, `create`, `update`, `delete` by id) on one
model. Introducing a repository for a one-line passthrough adds indirection
without benefit. This matches the `nestjs-service.ts` template default.

## Repository Structure
```typescript
// apps/api/src/documents/documents.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Document } from '@prisma/client';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  DocumentFiltersDto,
} from './dto/document.dto';

export type DocumentWithRelations = Prisma.DocumentGetPayload<{
  include: { owner: true; versions: true };
}>;

@Injectable()
export class DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, orgId: string): Promise<Document | null> {
    return this.prisma.document.findFirst({
      where: { id, orgId, deletedAt: null },
    });
  }

  async findMany(
    orgId: string,
    filters: DocumentFiltersDto,
    cursor?: string,
    limit = 20
  ): Promise<{ items: Document[]; nextCursor: string | null }> {
    const items = await this.prisma.document.findMany({
      where: {
        orgId,
        deletedAt: null,
        ...(filters.status && { status: filters.status }),
        ...(filters.search && {
          title: { contains: filters.search, mode: 'insensitive' },
        }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: {
        id: true, title: true, status: true, createdAt: true, updatedAt: true,
        ownerId: true,
      },
    });

    const hasMore = items.length > limit;
    if (hasMore) items.pop();

    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async create(data: CreateDocumentDto, ownerId: string, orgId: string): Promise<Document> {
    return this.prisma.document.create({
      data: { ...data, ownerId, orgId },
    });
  }

  async update(id: string, orgId: string, data: UpdateDocumentDto): Promise<Document> {
    return this.prisma.document.update({
      where: { id, orgId },
      data: { ...data, updatedAt: new Date() },
    });
  }

  async softDelete(id: string, orgId: string): Promise<void> {
    await this.prisma.document.update({
      where: { id, orgId },
      data: { deletedAt: new Date() },
    });
  }

  // Transactional operations
  async createWithAudit(
    data: CreateDocumentDto,
    ownerId: string,
    orgId: string
  ): Promise<Document> {
    return this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: { ...data, ownerId, orgId },
      });
      await tx.auditLog.create({
        data: { action: 'CREATE', entityType: 'Document', entityId: doc.id, userId: ownerId, orgId },
      });
      return doc;
    });
  }
}
```

## Module Registration
```typescript
@Module({
  providers: [DocumentsService, DocumentsRepository],
  exports: [DocumentsRepository], // Export if other modules need it
})
export class DocumentsModule {}
```

## Rules
- Repository methods = pure data access (no business logic)
- Service layer = business logic (uses repository)
- Always scope queries by `orgId` (multi-tenancy)
- Always filter `deletedAt: null` unless explicitly fetching deleted records
- Use typed `Prisma.XGetPayload<>` for complex return types
- Wrap multi-step operations in `$transaction`
- Never use `prisma.model.deleteMany()` without `where` clause

## Token Optimization

**Load when** when wrapping Prisma queries in typed repositories with cursor pagination. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
