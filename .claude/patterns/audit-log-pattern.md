# Pattern: Audit Logging

## Overview
All state-changing operations on business entities must produce an immutable
audit trail. Audit logs are append-only and must capture who, what, when, and why.

## Database Schema
```prisma
model AuditLog {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now()) @map("created_at")

  // Who
  userId      String   @map("user_id")
  userEmail   String   @map("user_email")  // Denormalized for durability

  // What
  action      AuditAction
  entityType  String   @map("entity_type")  // 'Document', 'User', etc.
  entityId    String   @map("entity_id")

  // Context
  orgId       String   @map("org_id")
  ipAddress   String?  @map("ip_address")
  userAgent   String?  @map("user_agent")

  // Changes
  before      Json?    // State before change
  after       Json?    // State after change
  metadata    Json?    // Additional context

  @@map("audit_logs")
  @@index([entityType, entityId])
  @@index([userId])
  @@index([orgId, createdAt])
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  RESTORE
  PUBLISH
  APPROVE
  REJECT
  LOGIN
  LOGOUT
  EXPORT
}
```

## NestJS Audit Interceptor
```typescript
// apps/api/src/audit/audit.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_KEY, AuditMetadata } from './audit.decorator';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const audit = this.reflector.get<AuditMetadata>(AUDIT_KEY, context.getHandler());
    if (!audit) return next.handle();

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    return next.handle().pipe(
      tap(async (responseData) => {
        await this.auditService.log({
          action: audit.action,
          entityType: audit.entityType,
          entityId: responseData?.id ?? req.params.id,
          userId: user.id,
          userEmail: user.email,
          orgId: user.orgId,
          ipAddress: req.ip,
          after: audit.logResponse ? responseData : undefined,
        });
      }),
    );
  }
}
```

## Audit Decorator
```typescript
// apps/api/src/audit/audit.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

export const AUDIT_KEY = 'audit';

export interface AuditMetadata {
  action: AuditAction;
  entityType: string;
  logResponse?: boolean;
}

export const Audit = (metadata: AuditMetadata) => SetMetadata(AUDIT_KEY, metadata);
```

## Controller Usage
```typescript
@Post()
@Audit({ action: AuditAction.CREATE, entityType: 'Document', logResponse: true })
@UseInterceptors(AuditInterceptor)
async create(@Body() dto: CreateDocumentDto, @CurrentUser() user: AuthUser) {
  return this.documentsService.create(dto, user);
}

@Delete(':id')
@Audit({ action: AuditAction.DELETE, entityType: 'Document' })
@UseInterceptors(AuditInterceptor)
async delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
  return this.documentsService.softDelete(id, user.orgId);
}
```

## Audit Query Service
```typescript
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(data: CreateAuditLogDto): Promise<void> {
    // Fire-and-forget with error swallowing — audit failure must not break request
    this.prisma.auditLog.create({ data }).catch((err) =>
      this.logger.error({ err }, 'Failed to write audit log')
    );
  }

  async getEntityHistory(entityType: string, entityId: string, orgId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId, orgId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
```

## Rules
- Audit logs are **immutable** — no UPDATE or DELETE on audit_logs table
- Fire-and-forget: audit failure must NEVER break the business operation
- Always capture `userId` + `userEmail` (denormalized for durability)
- Store `before`/`after` as JSON snapshots for critical entities (documents, users)
- Scope all audit queries by `orgId`
- Do NOT audit read operations (GET) — only state changes
- Retain audit logs per compliance requirement (default: 7 years for financial data)

## Token Optimization

**Load when** when implementing immutable audit trails (who/what/when/why). **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
