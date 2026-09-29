#!/usr/bin/env tsx
// Master generation pipeline — run with: pnpm generate
// Order is critical: Prisma → Zod → OpenAPI → orval hooks → MSW handlers

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

function run(command: string, label: string, cwd = ROOT): void {
  console.log(`\n🔄 ${label}...`);
  try {
    execSync(command, { stdio: 'inherit', cwd });
    console.log(`✅ ${label}`);
  } catch {
    console.error(`\n❌ Failed: ${label}`);
    console.error(`   Command: ${command}`);
    process.exit(1);
  }
}

function check(filePath: string, label: string): void {
  if (!existsSync(path.join(ROOT, filePath))) {
    console.error(`❌ Required file missing: ${filePath} (${label})`);
    process.exit(1);
  }
}

console.log('\n🏗️  Generation Pipeline\n' + '─'.repeat(50));

// Pre-flight checks
check('packages/database/prisma/schema.prisma', 'Prisma schema');

// Step 1: Prisma → DB client + Zod schemas (via zod-prisma-types generator)
run(
  'pnpm --filter @repo/database generate',
  'Step 1/4 — Prisma client + Zod schemas (zod-prisma-types)',
);

// Step 2: Zod schemas → OpenAPI JSON spec
check('apps/api/src/openapi/generate-spec.ts', 'OpenAPI spec generator');
run(
  'tsx apps/api/src/openapi/generate-spec.ts',
  'Step 2/4 — OpenAPI spec from Zod (zod-to-openapi)',
);

// Step 3: OpenAPI → typed React Query hooks (orval)
check('packages/api-spec/generated/openapi.json', 'Generated OpenAPI spec');
run(
  'pnpm --filter @repo/web orval --config orval.config.ts',
  'Step 3/4 — React Query hooks (orval)',
);

// Step 4: OpenAPI → MSW mock handlers (orval)
run(
  'pnpm --filter @repo/web orval --config orval.msw.config.ts',
  'Step 4/4 — MSW mock handlers (orval)',
);

console.log('\n🎉 Generation complete!\n');
console.log('   Generated files (DO NOT EDIT MANUALLY):');
console.log('   → packages/database/generated/zod/     (Prisma → Zod)');
console.log('   → packages/api-spec/generated/          (Zod → OpenAPI)');
console.log('   → apps/web/src/hooks/generated/         (OpenAPI → React Query)');
console.log('   → apps/web/src/mocks/generated/         (OpenAPI → MSW)\n');
