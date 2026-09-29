# Data Migration Standards

> Load when: Prisma schema changes, backfill scripts, seed data, or database restructuring. Unload for feature development without schema changes.

## Overview

Standards for safe, reversible database migrations covering Prisma schema changes, SQL migrations, and operational data backfills.

## Core Principles

1. **Non-destructive first** - never drop, rename, or narrow data in the same deployment that introduces a replacement.
2. **Idempotent** - data migrations and backfills must be safe to retry after partial completion.
3. **Reversible** - every migration needs rollback SQL or a documented restore strategy.
4. **Observable** - long-running work must report progress, failures, and row counts.
5. **Tested** - validate against a production-like dataset before production.
6. **Zero-downtime by default** - use expand-contract for breaking schema changes.

## Migration Types

### Schema-Only Migrations

Use Prisma Migrate for schema changes. Review generated SQL before it is applied to any shared environment.

```bash
# Development: generate a named migration (review SQL before applying)
pnpm --filter @repo/database migrate:dev --create-only --name add_user_status
# Edit the generated SQL if needed (e.g., CONCURRENTLY indexes), then apply:
pnpm --filter @repo/database migrate:dev

# Production: apply committed migrations only
pnpm --filter @repo/database migrate:deploy

# Never use db push in production.
# Never edit a migration after it has been applied to any environment.
```

Example generated SQL:

```sql
ALTER TABLE "users" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
CREATE INDEX "idx_users_status" ON "users"("status");
```

### Naming Convention

```
YYYYMMDDHHMMSS_<verb>_<entity>_<detail>

Examples:
  20240115120000_add_user_status_column
  20240116090000_create_document_versions_table
  20240117140000_drop_legacy_notifications_table
  20240118100000_backfill_user_display_names
```

### Migration Categories and Risk

| Category   | Examples                         | Risk   | Strategy                         |
|------------|----------------------------------|--------|----------------------------------|
| Additive   | Add nullable column, new table   | LOW    | Single migration                 |
| Rename     | Column/table rename              | HIGH   | Expand-contract (3 phases)       |
| Remove     | Drop column/table                | HIGH   | Expand-contract (3 phases)       |
| Constraint | Add NOT NULL, UNIQUE             | MEDIUM | Backfill first, then constrain   |
| Index      | Add/drop index                   | LOW    | Use `CONCURRENTLY`               |
| Data       | Backfill, transform              | MEDIUM | Batched script                   |

### Zero-Downtime SQL Rules

```sql
-- ✅ Safe: Add nullable column (backward compatible)
ALTER TABLE "users" ADD COLUMN "display_name" TEXT;

-- ✅ Safe: Add index without locking
CREATE INDEX CONCURRENTLY "idx_users_email" ON "users"("email");

-- ❌ Unsafe: Add NOT NULL without default on populated table
ALTER TABLE "users" ADD COLUMN "status" TEXT NOT NULL; -- LOCKS TABLE

-- ✅ Safe equivalent (3 steps):
-- Step 1: Add nullable
ALTER TABLE "users" ADD COLUMN "status" TEXT;
-- Step 2: Backfill (in batches)
UPDATE "users" SET "status" = 'active' WHERE "status" IS NULL;
-- Step 3: Add constraint (after deploy + backfill confirmed)
ALTER TABLE "users" ALTER COLUMN "status" SET NOT NULL;
```

### Data Migrations and Backfills

Use reviewed TypeScript scripts for data transformations, backfills, and operational retries. Keep them separate from generated Prisma migration SQL unless the data change is small, deterministic, and safe inside a single transaction.

Required script behavior:

- Supports `DRY_RUN=true`.
- Processes records in bounded batches.
- Selects only required fields.
- Updates only unprocessed rows so reruns are safe.
- Logs progress and final row counts.
- Validates input and output shapes with Zod where practical.
- Exposes or documents a rollback path.

## Expand-Contract Pattern

Use expand-contract for breaking changes, column renames, type changes, required field additions, and large data transformations.

```text
1. EXPAND:   Add the new nullable column/table/index and deploy compatible code.
2. DUAL RUN: Read old + new where needed, and write to both fields when applicable.
3. MIGRATE:  Backfill existing data in idempotent batches.
4. SWITCH:   Read from the new shape after validation passes.
5. CONTRACT: Drop the old shape after at least one full deploy cycle.
```

Never combine `EXPAND` and `CONTRACT` in one deployment.

### Blue-Green Migration

Use blue-green delivery when the schema change must support old and new application versions during rollout or rollback.

```text
1. Add the new nullable schema shape.
2. Deploy green code that can read old + new and write both where needed.
3. Backfill old data into the new shape.
4. Shift traffic to green after validation passes.
5. Keep blue rollback-compatible until one full deploy cycle completes.
6. Contract the old schema in a later migration.
```

Blue-green is the deployment strategy; expand-contract is the database migration shape. Use both together for high-risk changes.

Example column replacement:

```sql
-- EXPAND
ALTER TABLE "users" ADD COLUMN "new_email" TEXT;

-- MIGRATE
UPDATE "users"
SET "new_email" = "email"
WHERE "new_email" IS NULL;

-- SWITCH validation gate
ALTER TABLE "users" ALTER COLUMN "new_email" SET NOT NULL;

-- CONTRACT, only after old code is fully retired
ALTER TABLE "users" DROP COLUMN "email";
ALTER TABLE "users" RENAME COLUMN "new_email" TO "email";
```

Application code during dual-run:

```typescript
await prisma.user.update({
  where: { id },
  data: {
    email: newEmail,
    newEmail,
  },
});
```

## Data Migration Script Template

```typescript
import { PrismaClient } from '@repo/database';
import { z } from '@repo/validation';

const prisma = new PrismaClient();
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 1000);
const DRY_RUN = process.env.DRY_RUN === 'true';

const SourceUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});

const TargetUserSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

function splitName(name: string) {
  const [firstName, ...lastNameParts] = name.trim().split(/\s+/);
  const lastName = lastNameParts.join(' ') || firstName;

  return TargetUserSchema.parse({ firstName, lastName });
}

export async function up() {
  let processed = 0;

  while (true) {
    const users = await prisma.user.findMany({
      where: { firstName: null, lastName: null },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    });

    if (users.length === 0) break;

    const updates = users.map((user) => {
      const source = SourceUserSchema.parse(user);
      const target = splitName(source.name);

      return prisma.user.update({
        where: { id: source.id },
        data: target,
      });
    });

    if (!DRY_RUN) {
      await prisma.$transaction(updates);
    }

    processed += users.length;
    console.log(`Processed ${processed} users`);
  }
}

export async function down() {
  let processed = 0;

  while (true) {
    const users = await prisma.user.findMany({
      where: { firstName: { not: null }, lastName: { not: null } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    });

    if (users.length === 0) break;

    if (!DRY_RUN) {
      await prisma.$transaction(
        users.map((user) =>
          prisma.user.update({
            where: { id: user.id },
            data: {
              name: `${user.firstName} ${user.lastName}`.trim(),
              firstName: null,
              lastName: null,
            },
          })
        )
      );
    }

    processed += users.length;
    console.log(`Rolled back ${processed} users`);
  }
}

if (require.main === module) {
  up()
    .catch((error) => {
      console.error('Migration failed', error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
```

## Large Dataset Rules

Apply these rules for tables above 100,000 rows or any migration expected to run longer than one minute:

- Use batches of 500-1,000 rows by default; tune down when locks or CPU increase.
- Avoid `skip` pagination for large mutable datasets; query unprocessed rows or use a stable cursor.
- Keep transactions small and bounded to a single batch.
- Pause briefly between batches when production load is sensitive.
- Use `CREATE INDEX CONCURRENTLY` for large PostgreSQL indexes.
- Avoid long exclusive locks, full-table rewrites, and unbounded `UPDATE` statements.
- For type changes, add a new column, backfill it, switch reads, then contract later.

## Backfill Script Template

Backfill scripts must be idempotent, batched, observable, and safe to resume after partial failure.

```typescript
async function processUnmigratedUsers() {
  let processed = 0;

  while (true) {
    const rows = await prisma.user.findMany({
      where: { newField: null },
      select: { id: true, sourceField: true },
      orderBy: { id: 'asc' },
      take: 1000,
    });

    if (rows.length === 0) break;

    await prisma.$transaction(
      rows.map((row) =>
        prisma.user.update({
          where: { id: row.id },
          data: { newField: transform(row.sourceField) },
        })
      )
    );

    processed += rows.length;
    console.log(`Backfilled ${processed} rows`);
  }
}
```

Concurrency is allowed only when the operation is independent per row and the database has capacity. Always cap concurrency.

```typescript
import pLimit from 'p-limit';

const limit = pLimit(5);
await Promise.all(batches.map((batch) => limit(() => processBatch(batch))));
```

## Validation Post-Migration

Run validation immediately after the migration and before switching reads or scheduling contract work.

```sql
-- Row count preserved or changed by the expected amount.
SELECT COUNT(*) FROM affected_table;

-- Backfill complete.
SELECT COUNT(*) FROM affected_table WHERE new_column IS NULL;

-- Constraints exist and are valid.
SELECT conname, contype, convalidated
FROM pg_constraint
WHERE conrelid = 'affected_table'::regclass;

-- No orphaned foreign keys after transformation.
SELECT COUNT(*)
FROM child_table child
LEFT JOIN parent_table parent ON parent.id = child.parent_id
WHERE parent.id IS NULL;
```

Also validate a representative sample with the target Zod schema and compare business-level totals, such as status counts, amount totals, or per-phase workflow counts.

## Destructive Operations

Before any `DROP COLUMN`, `DROP TABLE`, `ALTER TYPE`, narrowing type change, or irreversible data transform:

- [ ] No deployed code reads or writes the old shape.
- [ ] At least one full deploy cycle has passed since the switch.
- [ ] Data is backed up or archived according to retention requirements.
- [ ] Rollback or restore procedure is written and tested.
- [ ] Production impact and lock behavior are reviewed.
- [ ] Stakeholders are notified if downtime or degraded performance is possible.

## Testing Migrations

Migration tests must cover successful transformation, edge cases, idempotent reruns, and rollback where rollback is supported.

```typescript
describe('user name split migration', () => {
  const userId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    await testPrisma.user.deleteMany();
    await testPrisma.user.create({
      data: { id: userId, name: 'John Doe' },
    });
  });

  it('splits full names', async () => {
    await up();

    const user = await testPrisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    expect(user.firstName).toBe('John');
    expect(user.lastName).toBe('Doe');
  });

  it('can be rerun without changing migrated rows', async () => {
    await up();
    await expect(up()).resolves.not.toThrow();
  });

  it('restores original data on rollback', async () => {
    await up();
    await down();

    const user = await testPrisma.user.findFirstOrThrow();
    expect(user.name).toBe('John Doe');
  });
});
```

## Migration Checklist

### Pre-Migration

- [ ] Schema migration generated with descriptive name and SQL reviewed.
- [ ] Data migration is idempotent, batched, and supports dry-run.
- [ ] Rollback or restore strategy is tested.
- [ ] Production-like test run completed with duration estimate.
- [ ] Backup, retention, and audit requirements confirmed.
- [ ] Monitoring, alerting, and operational owner identified.

### During Migration

- [ ] Progress logging enabled.
- [ ] Batch sizes and lock behavior monitored.
- [ ] Health checks remain green.
- [ ] Errors stop the migration or isolate failed records safely.
- [ ] No unexpected performance degradation occurs.

### Post-Migration

- [ ] Row counts and data validation pass.
- [ ] Post-migration SQL validation has been captured as evidence.
- [ ] Foreign key, unique, and check constraints are valid.
- [ ] Application tests pass against migrated data.
- [ ] Read path has switched to the new shape.
- [ ] Contract migration is scheduled only after the validation period.

## Prisma Schema Standards

Always use `@map` for snake_case column names and `@@map` for table names. Explicitly index all foreign keys.

```prisma
model User {
  id        String    @id @default(cuid())
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")  // Soft delete

  // Always use snake_case for DB columns, camelCase for Prisma fields
  firstName String @map("first_name")

  // Foreign keys must be explicitly indexed
  orgId String       @map("org_id")
  org   Organization @relation(fields: [orgId], references: [id])

  @@map("users")
  @@index([orgId])
  @@index([deletedAt])  // Partial index via raw migration for soft delete filter
}
```

## Seed Data Standards

- Seeds use deterministic IDs for records referenced by tests.
- Seeds are idempotent via `upsert`, never plain `create` for shared seed data.
- Reference and lookup data is seeded before transactional data.
- Test data uses factories and never real customer or production PII.
- Environment-specific seeds must be explicit, for example `seed.dev.ts` and `seed.test.ts`.
- Use `faker.seed(42)` (or another fixed seed) to keep generated values deterministic across runs.

```typescript
// prisma/seeds/seed-users.ts
import { PrismaClient } from '@repo/database';
import { faker } from '@faker-js/faker';

faker.seed(42); // Deterministic — same output on every run

export async function seedUsers(prisma: PrismaClient, count = 10) {
  return Promise.all(
    Array.from({ length: count }, (_, i) =>
      prisma.user.upsert({
        where: { email: `user${i}@seed.example.com` },
        update: {},
        create: {
          email: `user${i}@seed.example.com`,
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          status: 'active',
        },
      })
    )
  );
}
```

## Rollback Procedure Template

Document a rollback procedure for every non-trivial migration. Commit this alongside the migration file.

```markdown
## Migration Rollback: [migration_name]

### Pre-conditions
- Application deployed to previous version
- Database backup confirmed (RDS snapshot)

### Steps
1. `npx prisma migrate resolve --rolled-back [migration_name]`
2. Run manual SQL: `[paste down migration SQL]`
3. Verify: `SELECT COUNT(*) FROM [affected_table]`
4. Restart application
5. Smoke test: [list critical paths]

### Verification
- [ ] Row counts match pre-migration snapshot
- [ ] Application health check passes
- [ ] No errors in CloudWatch for 5 minutes
```

## Related

- `.claude/standards/database-standards.md`
- `.claude/templates/seed-factory.ts`
- `.claude/templates/prisma-migration.ts`
- `.claude/agents/data-migration-specialist.md`
- `.claude/workflows/database-migration-workflow.md`

## Token Optimization

Load for: Prisma schema changes, backfill scripts, seed data,
database restructuring. Unload for feature development without schema changes.
