/**
 * Prisma Data Migration Template
 *
 * Use this template for migrations that include data transformations.
 * Replace placeholders with actual logic.
 */

import { PrismaClient } from '@prisma/client';
// Import `z` from the shared validation package, never from 'zod' directly.
import { z } from '@repo/validation';

const prisma = new PrismaClient();

// === Configuration ===
const BATCH_SIZE = 100;
const DRY_RUN = process.env.DRY_RUN === 'true';
const MIGRATION_NAME = 'your_migration_name'; // e.g., 'split_user_name'

// === Validation Schemas ===
const OldRecordSchema = z.object({
  id: z.string().uuid(),
  // Define old schema fields
});

const NewRecordSchema = z.object({
  id: z.string().uuid(),
  // Define new schema fields
});

type OldRecord = z.infer<typeof OldRecordSchema>;
type NewRecord = z.infer<typeof NewRecordSchema>;

// === Migration Logic ===
export async function up() {
  console.log(`Starting migration: ${MIGRATION_NAME}`);
  console.log(`DRY_RUN: ${DRY_RUN}`);

  // 1. Count total records
  const total = await prisma.yourModel.count();
  console.log(`Total records to migrate: ${total}`);

  // 2. Sample validation (validate old format)
  const sample = await prisma.yourModel.findMany({ take: 10 });
  for (const record of sample) {
    OldRecordSchema.parse(record);
  }

  // 3. Batch processing
  let processed = 0;
  let cursor: string | undefined;

  while (true) {
    const batch = await prisma.yourModel.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' },
    });

    if (batch.length === 0) break;

    for (const record of batch) {
      try {
        // === TRANSFORMATION LOGIC HERE ===
        const transformed = transformRecord(record);

        // Update record
        if (!DRY_RUN) {
          await prisma.yourModel.update({
            where: { id: record.id },
            data: transformed,
          });
        }

        processed++;

        // Progress logging
        if (processed % 100 === 0) {
          console.log(`Progress: ${processed}/${total} (${((processed/total) * 100).toFixed(1)}%)`);
        }
      } catch (error) {
        console.error(`Failed to migrate record ${record.id}:`, error);
        throw error; // Stop on error
      }
    }

    cursor = batch[batch.length - 1].id;
  }

  // 4. Post-migration validation
  const validatedSample = await prisma.yourModel.findMany({ take: 10 });
  for (const record of validatedSample) {
    NewRecordSchema.parse(record);
  }

  console.log(`Migration complete: ${processed} records migrated`);
}

export async function down() {
  console.log(`Starting rollback: ${MIGRATION_NAME}`);

  const records = await prisma.yourModel.findMany();

  for (const record of records) {
    // === ROLLBACK LOGIC HERE ===
    const reverted = revertRecord(record);

    await prisma.yourModel.update({
      where: { id: record.id },
      data: reverted,
    });
  }

  console.log('Rollback complete');
}

// === Helper Functions ===
function transformRecord(record: OldRecord): Partial<NewRecord> {
  // TODO: Implement transformation logic
  return {
    // Map old fields to new fields
  };
}

function revertRecord(record: NewRecord): Partial<OldRecord> {
  // TODO: Implement rollback logic
  return {
    // Map new fields back to old fields
  };
}

// === Script Execution ===
if (require.main === module) {
  up()
    .then(() => {
      console.log('Migration successful');
      prisma.$disconnect();
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      prisma.$disconnect();
      process.exit(1);
    });
}
