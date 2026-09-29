# Database Migration Pattern

## Safe Migration Workflow
```bash
# 1. Create migration (dev only)
pnpm prisma migrate dev --name descriptive_name

# 2. Review generated SQL
cat prisma/migrations/$(ls prisma/migrations | tail -1)/migration.sql

# 3. Test migration locally
pnpm prisma migrate deploy

# 4. Validate
pnpm tsx scripts/validate-migration.ts

# 5. Apply to staging via CI (never manually)
```

## Migration File Header (required)
```sql
-- Migration: add_document_version_field
-- Description: Adds version tracking to documents for optimistic locking
-- Risk: LOW — additive only
-- Rollback: ALTER TABLE "documents" DROP COLUMN IF EXISTS "version";
-- Estimated rows affected: ~50,000 (documents table)
-- Zero-downtime: YES — nullable column addition

ALTER TABLE "documents" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
```

## Common Safe Patterns
```sql
-- ✅ Add nullable column
ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;

-- ✅ Add column with default (PostgreSQL 11+)
ALTER TABLE "documents" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- ✅ Create index concurrently (no lock)
CREATE INDEX CONCURRENTLY "idx_documents_status" ON "documents"("status");

-- ✅ Add constraint as NOT VALID first, validate later
ALTER TABLE "documents" ADD CONSTRAINT "chk_version_positive"
  CHECK (version > 0) NOT VALID;
-- After backfill:
ALTER TABLE "documents" VALIDATE CONSTRAINT "chk_version_positive";
```

## Expand-Contract for Column Rename
```sql
-- PHASE 1 (EXPAND): Add new column
ALTER TABLE "users" ADD COLUMN "full_name" TEXT;

-- App deploy: write to BOTH old (name) and new (full_name)
-- PHASE 2 (BACKFILL):
UPDATE "users" SET "full_name" = "name" WHERE "full_name" IS NULL;

-- App deploy: read from new column only
-- PHASE 3 (CONTRACT): Drop old column
ALTER TABLE "users" DROP COLUMN "name";
```

## Prisma-Specific Notes
```typescript
// After risky migrations, verify with Prisma validate
// prisma/scripts/verify-schema.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verify() {
  // Verify row counts
  const count = await prisma.document.count();
  console.log(`Documents: ${count} rows`);

  // Verify no nulls where unexpected
  const nullVersions = await prisma.document.count({
    where: { version: null },
  });
  console.assert(nullVersions === 0, 'Found documents with null version');

  await prisma.$disconnect();
}
```

## Rollback Procedure
```bash
# 1. Identify last good migration
pnpm prisma migrate status

# 2. Apply rollback SQL (from migration header comment)
pnpm tsx scripts/rollback-migration.ts --migration=20240115_add_document_version

# 3. Mark migration as rolled back
pnpm prisma migrate resolve --rolled-back 20240115000000_add_document_version

# 4. Redeploy previous app version
```

## Token Optimization

**Load when** when authoring a Prisma migration that needs review/rollback. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
