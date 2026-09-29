---
description: Create Prisma migration for schema changes with comprehensive sample test data
agent: db-designer
subtask: true
---

# Database Migration

> **Token optimization**: Load `@.claude/standards/database-standards.md` for Prisma conventions. Unload after migration is complete.

## Input

$ARGUMENTS (description of change — e.g. "add categoryId to resources table")

## Process

### 1. Check Current Migration Status

```bash
!`pnpm prisma migrate status 2>&1 | tail -20`
!`ls prisma/migrations | sort | tail -5`
```

### 2. Analyze Change

- Is this additive (add column/table/index)? → Low risk
- Is this modifying existing columns (rename, type change)? → Medium risk — check backward compat
- Is this dropping columns/tables? → High risk — requires deprecation period + two-phase migration

### 3. Update Prisma Schema First

Edit `prisma/schema.prisma`:

- Add/modify models, fields, relations
- Add `@index` for new FK columns
- Mark PII fields with `/// @pii` comment
- Add `createdAt`, `updatedAt` to new models
- Add `deletedAt` for soft-delete models

### 4. Generate and Apply Migration

```bash
# Generate migration SQL (review before applying)
!`pnpm prisma migrate dev --name {description} --create-only 2>&1`

# Review the generated SQL
!`cat prisma/migrations/$(ls prisma/migrations | sort | tail -1)/migration.sql`

# Apply after review
!`pnpm prisma migrate dev --name {description} 2>&1`

# Re-generate Zod schemas
!`pnpm generate:types 2>&1 | tail -10`
```

### 5. Add Seed Data (if applicable)

For new tables, add representative seed data to `prisma/seed.ts`:

- Use deterministic UUIDs for reproducibility
- Cover happy path + boundary cases + relationships
- Include `upsert` to be idempotent

### 6. Backward Compatibility Check

Migration is safe to deploy alongside old code if:

- Only adding nullable columns (not `NOT NULL` without default)
- Only adding new tables
- Only adding indexes
- Only adding new enum values (not removing)

Flag if NOT backward compatible — requires coordinated deployment.

### 7. Review Output

```
Migration file: prisma/migrations/{timestamp}_{description}/migration.sql
Type: Additive / Modifying / Destructive
Backward compatible: Yes / No
Zod schemas regenerated: Yes
Seed data: Included / Not needed
PII columns: None / [list]
Estimated rows affected: [small/large table]
```

## Output File

`prisma/migrations/{timestamp}_{description}/migration.sql`

## Cross-References

- DB standards: `@.claude/standards/database-standards.md`
- Data migration standards: `@.claude/standards/data-migration-standards.md`
- Schema migration workflow: `@.claude/workflows/database-migration-workflow.md`
- Data backfill workflow: `@.claude/workflows/database-migration-workflow.md`
- Database migration pattern: `@.claude/patterns/database-migration-pattern.md`
- Prisma transaction pattern: `@.claude/patterns/prisma-transaction-pattern.md`
- Migration template: `@.claude/templates/prisma-migration.ts`
- Seed template: `@.claude/templates/prisma-seed.ts`
- Design: `/design-database`
- Deploy: `/deploy-prepare` checks migration status
