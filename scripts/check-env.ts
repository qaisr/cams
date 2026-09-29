#!/usr/bin/env tsx
// Validates required environment variables are set before starting.
// Run automatically in docker-compose healthchecks and CI.

import { z } from 'zod';

const ApiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  DATABASE_URL: z.string().url(),
  AUTH_JWKS_URI: z.string().url(),
  AUTH_AUDIENCE: z.string().min(1),
  EVENT_BUS_NAME: z.string().min(1),
  AWS_REGION: z.string().min(1),
});

const WebEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
});

const target = process.argv[2] ?? 'all';

function validate(schema: z.ZodObject<z.ZodRawShape>, name: string): boolean {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    console.error(`\n❌ Missing/invalid env vars for ${name}:\n`);
    for (const issue of result.error.issues) {
      console.error(`   ${issue.path.join('.')}: ${issue.message}`);
    }
    return false;
  }
  console.log(`✅ ${name} environment variables valid`);
  return true;
}

let allValid = true;

if (target === 'api' || target === 'all') {
  allValid = validate(ApiEnvSchema, 'API') && allValid;
}

if (target === 'web' || target === 'all') {
  allValid = validate(WebEnvSchema, 'Web') && allValid;
}

if (!allValid) {
  console.error('\n💡 Copy .env.example to .env.local and fill in values\n');
  process.exit(1);
}
