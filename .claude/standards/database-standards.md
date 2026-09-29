# Database Standards — PostgreSQL + Prisma ORM

## Stack Reference
- PostgreSQL 16 (local Docker: `postgres:16-alpine`), AWS RDS Multi-AZ `DatabaseInstance`
- RDS Proxy (connection-safe singleton pool per Fargate task process)
- **Prisma ORM** — schema as single source of truth
- Prisma Migrate — version-controlled schema migrations
- `zod-prisma-types` generator — auto-generates Zod schemas from schema.prisma

## Prisma Schema Rules

### Mandatory Fields on Every Model
```prisma
model {Entity} {
  id        String    @id @default(uuid()) @db.Uuid
  // ... domain fields ...
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz  // soft delete
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  createdBy String    @map("created_by") @db.VarChar(100)
  updatedBy String    @map("updated_by") @db.VarChar(100)

  @@map("{table_name}")
}
````

### Naming Conventions

```
Prisma model:   PascalCase singular   → User, CartItem
DB table name:  snake_case plural     → @@map("users"), @@map("cart_items")
Prisma field:   camelCase             → createdAt, tenantId
DB column:      snake_case            → @map("created_at"), @map("tenant_id")
PK:             id                    → always String @id @default(uuid())
FK:             {relation}Id          → tenantId, authorId
```

### Data Types

```prisma
// IDs:        String @db.Uuid
// Short text: String @db.VarChar(n)   — always specify length
// Long text:  String                   — TEXT (no length restriction)
// Timestamps: DateTime @db.Timestamptz — ALWAYS timezone-aware
// Money:      Decimal @db.Decimal(19,4) — NEVER Float
// Booleans:   Boolean @default(false) — NOT NULL
// Enums:      String @db.VarChar(n)   — NEVER PostgreSQL native ENUM
// JSON:       Json                    — stored as JSONB
```

### CRITICAL: Never Use Native PostgreSQL ENUMs

```prisma
// ❌ WRONG — PostgreSQL native ENUMs cause painful migration issues
model User {
  status UserStatus  // PostgreSQL ENUM type
}
enum UserStatus { ACTIVE INACTIVE }

// ✅ CORRECT — VARCHAR with application-level enum
model User {
  /// @zod.string.refine(v => ['ACTIVE','INACTIVE'].includes(v))
  status String @default("ACTIVE") @db.VarChar(20)
}
// In Zod: z.enum(['ACTIVE', 'INACTIVE'])
// Add DB CHECK constraint in migration if needed
```

### PII Tagging

```prisma
model User {
  id    String @id @default(uuid()) @db.Uuid
  /// @pii encrypted
  email String @db.VarChar(255)
  /// @pii hashed
  taxId String? @db.VarChar(100)
}
```

### Indexes

```prisma
model User {
  // ...
  @@index([status], map: "idx_users_status")
  @@index([tenantId, createdAt(sort: Desc)], map: "idx_users_tenant_created")
  @@unique([tenantId, email], map: "uq_users_tenant_email")
}
```

## CANS Data Modeling — Relational Core + JSONB Elections Tail

> **Binding for the CANS/GMDi Replacement.** These rules make the
> [ADR-0002](../../specs/adr/adr-0002-postgres-jsonb-hybrid.md) hybrid model
> and the [FS/07](../../specs/fs/07-data-model.md) contracts enforceable in the
> schema. They govern how 100+ ISDA-family agreement types are stored: a stable
> **relational core** of typed columns plus a variable **JSONB "elections" tail**.
> Apply this section for any CANS agreement/opinion/netting table; the generic
> rules above still apply for everything else.

### 1. Column-vs-JSONB promotion rule (FS-07-CORE-01) — the load-bearing decision

A field is a **promoted, typed relational column** — never JSONB — **if and only
if** at least one is true:

1. It is queried by **range, exact-match, sort, or join** (a WHERE/ORDER BY/JOIN
   predicate anywhere in the app or reporting), **or**
2. It is **consumed by the Murex EOD export** ([FS/08](../../specs/fs/08-murex-eod-export.md))
   **or by reporting**.

Otherwise the field lives in the **JSONB elections tail** (`elections`,
`request_meta`, `regulatory_meta`, `source_meta`, `checklist`).

```prisma
// ✅ Promoted: filtered/sorted/joined AND consumed by Murex export → typed column, B-tree
model Agreement {
  id                 String    @id @default(uuid()) @db.Uuid
  agreementType      String    @map("agreement_type") @db.VarChar(80)   // FK to agreement_types, filtered
  status             String    @db.VarChar(30)                          // filtered
  nettingEnforceable Boolean?  @map("netting_enforceable")              // consumed by Murex
  governingLaw       String?   @map("governing_law") @db.VarChar(80)    // filtered
  murexAgreementId   String?   @map("murex_agreement_id") @db.VarChar(64) // export join key
  lineageId          String    @map("lineage_id") @db.Uuid              // joined (amendment lineage)
  effectiveDate      DateTime? @map("effective_date") @db.Timestamptz   // range-queried

  // ✅ Variable tail: type-specific elections NOT filtered/sorted/exported → JSONB
  elections          Json      @db.JsonB                                // per-doc-type answers
  requestMeta        Json      @map("request_meta") @db.JsonB

  @@map("agreements")
}
```

- **Discovery of a needed value inside JSONB is a signal to PROMOTE it**
  (add a typed column + migration), **never** to index-scan or filter into the
  tail (FS-07-IDX-01). A reporting/export read must never scan JSONB for a value
  it filters or joins on.
- **Do not** promote a field speculatively "because it might be queried later" —
  promotion is driven by an actual predicate or an actual export/reporting
  consumer. Unpromoted fields stay in the tail; promote when the predicate arrives.
- Enums on promoted columns follow the house rule: **`VarChar` + app-level Zod
  enum**, never native PG ENUM (see above).

### 2. Per-document-type elections modeling (ADR-0001) — Zod, not CDM codegen

The elections tail is heterogeneous across 100+ ISDA-family types. Model it with
**hand-authored Zod discriminated unions**, **not** generated from the ISDA CDM.
The **CDM is a vocabulary reference only** ([ADR-0001](../../specs/adr/adr-0001-cdm-as-vocabulary-not-codegen.md))
— borrow its field *names* for shared understanding; never treat it as the schema
backbone or a code-generation source.

- **Discriminant = `schema_version`** (stored per row). Each `(agreement_type,
  schema_version)` maps to one Zod member describing that version's tail shape.
- **Two validation passes**, both in the service layer, both required before an
  elections payload is persisted:
  1. **Structural** — the Zod discriminated-union member selected by
     `schema_version` validates the JSONB shape/types.
  2. **Bank-policy** — a `.superRefine()` layer keyed by `policy_version` enforces
     PPCC cross-field rules (e.g. "if X elected then Y mandatory"). `policy_version`
     is stored per row alongside `schema_version`.
- **Never widen a committed member.** A changed tail shape is a **new
  `schema_version`** with a new union member; historical rows keep validating
  against their stored version. Same discipline as "never modify a committed
  migration."
- Import `z` from `@repo/validation` (the OpenAPI-extended re-export), never from
  `zod` directly (see `.claude/patterns/zod-openapi-pattern.md`). These unions are
  **hand-authored**, so they live in `packages/validation` — they are *not* part
  of the `zod-prisma-types` generated output and must never be placed in a
  `generated/` directory.

```typescript
// Sketch — one member per (agreement_type, schema_version); discriminated on schema_version.
const IsdaMasterV1 = z.object({ schemaVersion: z.literal('isda-master@1'), /* v1 tail */ });
const IsdaMasterV2 = z.object({ schemaVersion: z.literal('isda-master@2'), /* v2 tail */ });
const ElectionsTail = z
  .discriminatedUnion('schemaVersion', [IsdaMasterV1, IsdaMasterV2 /* … */])
  .superRefine((tail, ctx) => {
    // policy_version-keyed PPCC cross-field rules (bank-policy pass)
  });
```

### 3. `search_attrs` projection — generated columns vs triggers

Promoted scalars that originate inside JSONB are physically projected out for
indexing (FS-07-IDX-01/02). Two mechanisms — choose by rule, do not mix
arbitrarily:

| Mechanism | Use when | Notes |
| --- | --- | --- |
| **`GENERATED ALWAYS AS (… ) STORED`** | The value is a **pure function of a single row's JSONB** (e.g. `elections->>'governingLaw'`). | **Default choice.** Cannot drift — Postgres recomputes on write; no trigger to maintain or forget. Add the column in a Prisma migration via raw SQL (Prisma has no first-class generated-column DSL); index it B-tree. |
| **Trigger-maintained column** | The projection needs **cross-row/multi-table state**, non-deterministic input, or logic a generated expression can't express. | Last resort — a trigger is app logic in the DB, must be tested and audited. Document *why* a generated column was insufficient in the migration. |

- **Prefer generated columns.** Reach for a trigger only when the projection
  genuinely depends on more than the single row's own JSONB.
- **GIN-index every JSONB tail with `jsonb_path_ops`** (FS-07-IDX-02): `elections`,
  `request_meta`, `regulatory_meta`, `source_meta`, `checklist`, `search_attrs`.
  Naming is fixed: `_gin` suffix, `_active_idx` for partials
  ([data-dictionary §7](../../specs/data-dictionary.md)).
- **B-tree** every promoted scalar (type, status, dates, `netting_enforceable`,
  reg booleans, `governing_law`, `murex_agreement_id`, `lineage_id`).
- **Partial indexes** for the hot working set (`agreements_active_idx` on
  non-terminated; `deleted_at IS NULL`) — keep them small.
- **Phase-1 search is Postgres-only** (GIN + B-tree). OpenSearch is a Phase-2+
  *derived, rebuildable* index and never a second source of truth — see
  `.claude/patterns/opensearch-derived-index-pattern.md`. Do not stand up
  OpenSearch to serve a Phase-1 filter.

### CANS modeling checklist

- [ ] Every field is promoted to a typed column **iff** it's filtered/sorted/joined **or** Murex/reporting-consumed (FS-07-CORE-01); everything else is in the JSONB tail.
- [ ] A value needed by export/reporting is a **promoted column**, never a JSONB scan (FS-07-IDX-01).
- [ ] Elections tail validated by a Zod discriminated union keyed on `schema_version` (structural) **and** a `policy_version`-keyed `.superRefine()` (bank-policy) — hand-authored, not CDM-generated.
- [ ] Tail-shape changes create a **new `schema_version`** member; committed members are never widened.
- [ ] `schema_version` + `policy_version` stored **per row**.
- [ ] JSONB-derived promoted scalars use **`GENERATED ALWAYS AS STORED`** unless cross-row logic forces a documented trigger.
- [ ] Every JSONB column GIN-indexed with `jsonb_path_ops` (`_gin`); every promoted scalar B-tree indexed; partials for the active working set.

## Migration Workflow

```bash
# Development — auto-generates migration SQL
npx prisma migrate dev --name add-user-role

# Production — applies existing migrations
npx prisma migrate deploy

# Reset local DB (development only)
npx prisma migrate reset

# NEVER run migrate dev in production
# NEVER use prisma db push in production
```

## Seed Data (packages/database/prisma/seed.ts)

```typescript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Use deterministic UUIDs — referenced in integration tests
const IDS = {
  tenant1: "11111111-1111-1111-1111-111111111111",
  user1: "22222222-2222-2222-2222-222222222222",
};

async function seed() {
  await prisma.tenant.upsert({
    where: { id: IDS.tenant1 },
    create: {
      id: IDS.tenant1,
      name: "Test Corp",
      createdBy: "seed",
      updatedBy: "seed",
    },
    update: {},
  });
  // More seed data...
}

seed().finally(() => prisma.$disconnect());
```

## Query Performance Rules

```typescript
// ✅ Paginate all list queries
const [data, total] = await prisma.$transaction([
  prisma.user.findMany({ where, skip, take, orderBy }),
  prisma.user.count({ where }),
]);

// ✅ Soft delete filter — always exclude deletedAt !== null
where: {
  deletedAt: null;
}

// ✅ Select only needed fields (projection)
prisma.user.findMany({ select: { id: true, name: true, email: true } });

// ✅ Use include for relations (not findMany + manual join)
prisma.post.findMany({ include: { author: true } });

// ❌ Never fetch all records without pagination
prisma.user.findMany(); // NEVER in production

// ❌ Never N+1 — use include or separate batched query
users.map((u) => prisma.post.findMany({ where: { authorId: u.id } })); // NEVER
```

## Transactions — Isolation, Retries, Deadlocks

```typescript
// ✅ Interactive transaction for read-modify-write — set isolation explicitly.
// Default PostgreSQL level is READ COMMITTED; raise it only when you need it.
await prisma.$transaction(
  async (tx) => {
    const account = await tx.account.findUniqueOrThrow({ where: { id } });
    await tx.account.update({
      where: { id },
      data: { balance: account.balance.minus(amount) },
    });
  },
  {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable, // strongest — for money/inventory
    timeout: 5_000,    // ms — abort long-held locks (default 5s)
    maxWait: 2_000,    // ms — max wait to acquire a connection from the pool
  },
);
```

### Isolation Level — When to Raise It

| Level | Use for | Cost |
| --- | --- | --- |
| `ReadCommitted` (default) | Ordinary CRUD; no cross-row invariants | Cheapest |
| `RepeatableRead` | Multi-read consistency within one txn (reports, aggregates) | Moderate |
| `Serializable` | Money movement, stock decrement, uniqueness you enforce in code | Highest; **can fail with `40001`** |

### Serialization / Deadlock Retry (MANDATORY at `Serializable`)

`Serializable` and high-contention updates can abort with a retryable error:
Postgres `40001` (serialization failure) or `40P01` (deadlock). These are **not**
bugs — the caller must retry the whole transaction.

```typescript
// ✅ Retry the entire transaction body on 40001 / 40P01 (bounded, jittered)
async function withSerializableRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const code = (e as Prisma.PrismaClientKnownRequestError).code;
      const retryable = code === 'P2034' /* Prisma write-conflict/deadlock */;
      if (!retryable || i >= attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 25 * 2 ** i + Math.random() * 25));
    }
  }
}
```

### Transaction Rules

- **Keep transactions short** — never `await` an HTTP call, EventBridge publish,
  or user input inside `$transaction`. Locks are held for the whole body; a slow
  transaction exhausts the pinned RDS Proxy connection.
- **Deterministic lock ordering** — always update multiple rows/tables in a
  fixed, sorted order (e.g. by `id`) across the codebase to avoid deadlocks.
- **No nested `$transaction`** — pass the `tx` client down; a nested call opens a
  second connection and can self-deadlock.
- **Emit domain events AFTER commit**, not inside the txn — publish in the
  service once `$transaction` resolves, so a rollback never leaks an event.
- **`P2034`** is the Prisma code for a write conflict/deadlock that timed out —
  wrap contention-prone transactions with the retry helper above.

## Test Data Cleanup Order

```typescript
// Delete in reverse FK dependency order — children before parents
beforeEach(async () => {
  await prisma.orderLineItem.deleteMany(); // Level 3 (deepest child)
  await prisma.order.deleteMany(); // Level 2
  await prisma.customer.deleteMany(); // Level 1 (root)
});
```

## Decision Audit Log (Immutable)

```prisma
// Append-only table — no updatedAt, no deletedAt, no updates ever
model DecisionAuditLog {
  id              String   @id @default(uuid()) @db.Uuid
  entityType      String   @db.VarChar(100)
  entityId        String   @db.Uuid
  decisionType    String   @db.VarChar(100)
  decisionOutcome String   @db.VarChar(50)
  rulesEvaluated  Json
  rulesMatched    Json
  factsSnapshot   Json
  reasonCodes     String[]
  reasonMessages  String[]
  decidedBy       String   @db.VarChar(255)
  decidedAt       DateTime @default(now()) @db.Timestamptz

  @@map("decision_audit_log")
  @@index([entityType, entityId])
  @@index([decidedAt(sort: Desc)])
}
```

## Quality Checklist

- [ ] All models have mandatory audit fields
- [ ] No PostgreSQL native ENUMs — use VarChar
- [ ] No Float for money — use Decimal(19,4)
- [ ] All timestamps use @db.Timestamptz
- [ ] PII fields tagged with `/// @pii` comment
- [ ] All FK fields have corresponding @@index
- [ ] Soft delete filter `deletedAt: null` on all user-facing queries
- [ ] Pagination on all list queries
- [ ] Seed data uses deterministic UUIDs
- [ ] Test cleanup deletes children before parents
- [ ] Migrations generated via `prisma migrate dev` (never db push)

## Cross-References

- API standards: `@.claude/standards/api-standards.md`
- Repository template: `@.claude/templates/nestjs-repository.ts`
- RDS Proxy: `@.claude/patterns/rds-proxy-pattern.md`
- Testing: `@.claude/standards/testing-standards.md`
- CANS data model (contracts): `specs/fs/07-data-model.md`
- Hybrid relational-core + JSONB decision: `specs/adr/adr-0002-postgres-jsonb-hybrid.md`
- CDM as vocabulary reference only (not codegen): `specs/adr/adr-0001-cdm-as-vocabulary-not-codegen.md`
- Zod OpenAPI setup (hand-authored elections unions): `@.claude/patterns/zod-openapi-pattern.md`
- Phase-2+ derived search index: `@.claude/patterns/opensearch-derived-index-pattern.md`

## Token Optimization

- **Load when**: Prisma schema design, migrations, query design, indexing decisions, transaction work.
- **Load only**: this standard + `prisma-repository-pattern.md` + `prisma-transaction-pattern.md`. Add `data-migration-standards.md` only when migrating data.
- **Unload after**: schema/migration committed and generation pipeline runs clean.
