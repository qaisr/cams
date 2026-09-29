# Workflow: Database Migration

> **Operating Discipline (always applies).** Follow `@.claude/CLAUDE.md` → Operating Discipline throughout this workflow: never hallucinate paths/APIs/versions, never assume intent to fill a gap, never implement unrequested scope, clarify ambiguities before acting, and get **explicit human approval** before anything hard-to-reverse or beyond the stated request. Report faithfully what was done, skipped, or failed.


## Overview
Safe, reversible database migration workflow for Prisma schema changes and data
transformations. Covers everything from planning to production deployment and cleanup.

## When to Use
Any time the Prisma schema changes: adding/removing fields, creating tables,
modifying constraints, or running data backfills.

## Agents to Load
- `data-migration-specialist` (primary — migration planning and data scripts)
- `db-designer` (schema design and review)
- `database-analyst` (Prisma migration generation and cleanup)
- `devops-engineer` (deployment sequencing)
- `test-engineer` (migration tests)
- `backend-engineer`, `frontend-developer` (application code updates)
- Unload when done — load only agents needed for the current step

## Workflow Steps

### Step 1: Plan Migration
**Agents**: `db-designer`, `data-migration-specialist`

Classify the change first — the risk level drives whether a direct migration is
safe or an expand-contract pattern is mandatory:

| Type | Risk | Approach |
|------|------|----------|
| Add nullable column | LOW | Direct migration |
| Add non-null column with default | LOW | Direct migration |
| Add non-null column without default | HIGH | Expand-contract |
| Rename column | HIGH | Expand-contract |
| Change column type | HIGH | Expand-contract |
| Drop column | MEDIUM | Verify no reads first |
| Add index (large table) | MEDIUM | `CREATE INDEX CONCURRENTLY` |
| Drop table | HIGH | Archive first |

```
@data-migration-specialist Assess the impact of this schema change:
[Describe the change]

Evaluate:
1. Migration risk level (LOW/MEDIUM/HIGH)
2. Is this zero-downtime compatible?
3. Does it require expand-contract pattern?
4. Estimated rows affected and migration duration
5. Required index changes
6. Rollback strategy
7. Success criteria
```

**Example Plan:**
```markdown
# Migration Plan: Split User Name Field

## Current State
- `User.name` (TEXT): "John Doe"

## Target State
- `User.firstName` (TEXT): "John"
- `User.lastName` (TEXT): "Doe"

## Breaking Changes
- API response format changes (requires API version bump)

## Duration Estimate
- 10,000 rows × 10ms = 100 seconds

## Rollback Strategy
- Reverse migration merges `firstName + lastName` back to `name`

## Success Criteria
- All rows have `firstName` and `lastName` populated
- No data loss (row count matches)
- Application tests pass
```

### Step 2: Schema Design Review
**Agent**: `db-designer`

```
@db-designer Review the proposed Prisma schema change:
[Paste schema diff]

Check against database-standards.md:
- Naming conventions
- Index strategy
- FK constraints
- Soft-delete pattern compliance
- Data types appropriate?
```

### Step 3: Create Prisma Migration
**Agent**: `database-analyst`

Update `prisma/schema.prisma` first, then generate the migration:

```bash
# Create migration without applying — review SQL before committing
npx prisma migrate dev --create-only --name <descriptive_name>

# Review generated SQL in prisma/migrations/
# Edit if needed (e.g., add CONCURRENTLY to index creation, add rollback comment)
```

**Example schema change:**
```prisma
// packages/database/prisma/schema.prisma
model User {
  id        String   @id @default(uuid())
  // name   String  // Remove old field later (expand-contract)
  firstName String   @map("first_name")
  lastName  String   @map("last_name")
  email     String   @unique
  createdAt DateTime @default(now())
}
```

**Generated SQL:**
```sql
-- prisma/migrations/20240115_split_user_name_field/migration.sql
-- Risk: LOW | Rollback: ALTER TABLE "User" DROP COLUMN "first_name", DROP COLUMN "last_name";
ALTER TABLE "User" ADD COLUMN "first_name" TEXT;
ALTER TABLE "User" ADD COLUMN "last_name" TEXT;
```

### Step 4: Write Data Migration Script (if data backfill needed)
**Agent**: `data-migration-specialist`

Create a typed, batched, dry-run-capable script:

```typescript
// prisma/migrations/20240115_split_user_name_field/migrate-data.ts
import { PrismaClient } from '@prisma/client';
import { z } from '@repo/validation';

const prisma = new PrismaClient();

const BATCH_SIZE = 100;
const DRY_RUN = process.env.DRY_RUN === 'true';

const OldUserSchema = z.object({ id: z.string().uuid(), name: z.string() });
const NewUserSchema = z.object({ id: z.string().uuid(), firstName: z.string(), lastName: z.string() });

export async function up() {
  console.log(`Starting migration (DRY_RUN: ${DRY_RUN})`);

  const totalRows = await prisma.user.count();
  console.log(`Total rows to migrate: ${totalRows}`);

  let processed = 0;
  let cursor: string | undefined;

  while (true) {
    const batch = await prisma.user.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' },
    });

    if (batch.length === 0) break;

    for (const user of batch) {
      OldUserSchema.parse(user); // Validate old format
      const [firstName, ...lastNameParts] = user.name.split(' ');
      const lastName = lastNameParts.join(' ') || firstName;
      if (!DRY_RUN) {
        await prisma.user.update({ where: { id: user.id }, data: { firstName, lastName } });
      }
      processed++;
    }

    cursor = batch[batch.length - 1].id;
    console.log(`Progress: ${processed}/${totalRows} (${((processed / totalRows) * 100).toFixed(1)}%)`);
  }

  // Post-migration validation
  const sampleRows = await prisma.user.findMany({ take: 10 });
  for (const row of sampleRows) NewUserSchema.parse(row);

  console.log('Migration complete');
}

export async function down() {
  console.log('Starting rollback');
  const users = await prisma.user.findMany();
  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { name: `${user.firstName} ${user.lastName}` },
    });
  }
  console.log('Rollback complete');
}

if (require.main === module) {
  up().finally(() => prisma.$disconnect());
}
```

### Step 5: Test Migration Locally
**Agent**: `test-engineer`

```bash
# 1. Restore production snapshot to local DB (optional but recommended for large tables)
pg_restore -d app_local production_snapshot.dump

# 2. Dry run first
DRY_RUN=true npx tsx prisma/migrations/<name>/migrate-data.ts

# 3. Run for real
npx tsx prisma/migrations/<name>/migrate-data.ts

# 4. Run validation tests
pnpm --filter @repo/api test:integration
```

**Migration tests:**
```typescript
// tests/migration/split-user-name.spec.ts
describe('Split user name migration', () => {
  it('migrates all rows without data loss', async () => {
    const countBefore = await prisma.user.count();
    await up();
    expect(await prisma.user.count()).toBe(countBefore);
  });

  it('splits name correctly', async () => {
    await prisma.user.create({ data: { id: '1', name: 'John Doe', email: 'john@example.com' } });
    await up();
    const user = await prisma.user.findUnique({ where: { id: '1' } });
    expect(user?.firstName).toBe('John');
    expect(user?.lastName).toBe('Doe');
  });

  it('rollback restores original data', async () => {
    await up();
    await down();
    const user = await prisma.user.findUnique({ where: { id: '1' } });
    expect(user?.name).toBe('John Doe');
  });
});
```

### Step 6: Apply Migration (Dev) and Regenerate
```bash
npx prisma migrate dev
npx prisma generate          # Regenerate Prisma client
pnpm turbo run generate      # Regenerate Zod types + OpenAPI spec + React Query hooks
```

```
@data-migration-specialist Validate this migration:
[Paste migration SQL]

Confirm:
- [ ] Migration SQL reviewed for safety
- [ ] Prisma client regenerated
- [ ] Zod schemas regenerated (zod-prisma-types)
- [ ] Tests still pass after schema change
- [ ] Seed data updated if needed
```

### Step 7: Update Seed Data (if needed)
```
@data-migration-specialist Update seed files to include new fields/tables.
Reference: packages/database/prisma/seed.ts
```

### Step 8: Update Application Code
**Agents**: `backend-engineer`, `frontend-developer`

**Backend:**
```typescript
// apps/api/src/users/users.service.ts
async findById(id: string) {
  return this.prisma.user.findUniqueOrThrow({
    where: { id },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
}
```

**Frontend (if impacted):**
```typescript
// apps/web/src/components/UserProfile.tsx
export function UserProfile({ user }: { user: User }) {
  return <h1>{user.firstName} {user.lastName}</h1>;
}
```

### Step 9: Deployment Sequencing
**Agent**: `devops-engineer`

```
@devops-engineer Create deployment plan for this migration:
Risk level: [LOW/MEDIUM/HIGH]

Confirm:
1. Migration runs BEFORE new code deploys (additive changes)
   OR
   Migration runs AFTER new code deploys (contract removal)
2. RDS snapshot strategy
3. Rollback procedure documented
```

**Deployment steps:**
```bash
# 1. Snapshot production database before migrating
aws rds create-db-snapshot \
  --db-instance-identifier app-prod \
  --db-snapshot-identifier app-pre-migration-$(date +%Y%m%d)

# 2. Apply Prisma schema migration
npx prisma migrate deploy

# 3. Run data migration script (if applicable)
node prisma/migrations/<name>/migrate-data.js

# 4. Validate data integrity
node scripts/validate-migration.js

# 5. Deploy updated application code
# (handled by CI/CD pipeline)
```

### Step 10: Monitor and Validate
**Agent**: `devops-engineer`

**Post-deployment checks:**
- [ ] CloudWatch logs — no unexpected errors
- [ ] Data integrity: row counts and checksums match
- [ ] API error rates within baseline
- [ ] Smoke tests pass
- [ ] Rollback procedure verified

**Rollback trigger thresholds:**
- Error rate > 5%
- Data integrity checks fail
- Performance degradation > 50%

**Rollback procedure:**
```bash
# 1. Run rollback SQL (from migration header) or the down() script
psql $DATABASE_URL -f rollback.sql

# 2. Mark migration as rolled back
npx prisma migrate resolve --rolled-back <MIGRATION_TIMESTAMP_name>

# 3. Redeploy the previous app version. CDK has no direct rollback command:
#    CloudFormation auto-rolls-back a failed deploy, otherwise redeploy the prior tag.
#    git checkout <previous-tag> && pnpm --filter @repo/infra cdk deploy --all -c env=production
```

### Step 11: Cleanup (After Validation Period)
**Agent**: `database-analyst`

After 1–2 weeks with no issues, remove old columns via a follow-up migration:

```sql
-- prisma/migrations/20240130_drop_old_name_field/migration.sql
ALTER TABLE "User" DROP COLUMN "name";
```

---

## Migration Types

### Schema-Only (Low Risk)
```sql
ALTER TABLE "User" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
CREATE INDEX CONCURRENTLY "User_status_idx" ON "User"("status");
```

### Zero-Downtime (Expand-Contract Pattern)
```
Phase 1 — Expand:   Add new column (nullable), dual-write old + new
Phase 2 — Backfill: Populate new column from old data
Phase 3 — Contract: Make new column NOT NULL, switch reads, drop old column
```

---

## Checklist Before PR
- [ ] Migration file has risk comment and rollback SQL
- [ ] Zero-downtime / expand-contract applied where needed
- [ ] Prisma client regenerated (`npx prisma generate`)
- [ ] Zod types regenerated (`pnpm turbo run generate`)
- [ ] Data migration script tested with `DRY_RUN=true`
- [ ] Migration tests written and passing
- [ ] Seed data updated
- [ ] Application code updated (backend + frontend as needed)
- [ ] `data-dictionary-template.md` updated for changed entities
- [ ] Integration tests pass with new schema
- [ ] RDS snapshot strategy documented
- [ ] Staging deployment plan ready

## Token Optimization
- Load `data-migration-specialist` only during planning and script-writing steps
- Load `devops-engineer` only for deployment sequencing
- Unload agents after their step is complete

## Related
- `.claude/standards/database-standards.md`
- `.claude/standards/data-migration-standards.md`
- `.claude/agents/data-migration-specialist.md`
- `.claude/templates/prisma-migration.ts`
- `.claude/patterns/zod-openapi-pattern.md`
