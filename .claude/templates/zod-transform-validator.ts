/**
 * Zod Transformation Validator Template
 *
 * Use this template for complex data transformations with Zod.
 *
 * IMPORTANT: import `z` from the shared validation package, never from 'zod'.
 * `extendZodWithOpenApi(z)` is called exactly ONCE in
 * packages/validation/src/zod.ts. Calling it again here (or importing the raw
 * 'zod' `z`) produces `TypeError: Cannot read properties of undefined (reading 'openapi')`.
 * See .claude/patterns/zod-openapi-pattern.md.
 */

import { z } from '@repo/validation';

// === Input Transformation ===
export const YourInputSchema = z.object({
  // String transformations
  email: z.string()
    .email()
    .transform((val) => val.toLowerCase().trim())
    .describe('User email address')
    .openapi({ example: 'user@example.com' }),

  // Date transformation
  birthDate: z.string()
    .transform((val) => new Date(val))
    .describe('Birth date (ISO 8601)')
    .openapi({ example: '1990-01-01' }),

  // Number coercion
  age: z.coerce.number().int().min(18).max(120),

  // Phone number normalization
  phoneNumber: z.preprocess(
    (val) => String(val).replace(/\D/g, ''), // Remove non-digits
    z.string().length(10, 'Phone must be 10 digits')
  ),

  // Optional with default
  role: z.enum(['ADMIN', 'USER']).default('USER'),

  // Nullable with transformation
  metadata: z.record(z.unknown()).nullable().transform((val) => val ?? {}),
}).openapi('YourInput');

export type YourInput = z.infer<typeof YourInputSchema>;

// === Complex Validation with refine ===
export const ComplexInputSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  { message: 'Passwords do not match', path: ['confirmPassword'] }
).refine(
  (data) => /[A-Z]/.test(data.password), // Uppercase required
  { message: 'Password must contain uppercase letter', path: ['password'] }
).refine(
  (data) => /[0-9]/.test(data.password), // Number required
  { message: 'Password must contain number', path: ['password'] }
);

// === Conditional Schema (Discriminated Union) ===
export const DocumentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('image'),
    mimeType: z.enum(['image/jpeg', 'image/png']),
    maxSizeMB: z.number().default(5),
  }),
  z.object({
    type: z.literal('pdf'),
    mimeType: z.literal('application/pdf'),
    maxSizeMB: z.number().default(10),
  }),
  z.object({
    type: z.literal('video'),
    mimeType: z.enum(['video/mp4', 'video/webm']),
    maxSizeMB: z.number().default(100),
  }),
]).openapi('Document');

// === Output Transformation ===
export const YourOutputSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.date().transform((date) => date.toISOString()),

  // Transform nested objects
  profile: z.object({
    firstName: z.string(),
    lastName: z.string(),
  }).transform((profile) => ({
    ...profile,
    fullName: `${profile.firstName} ${profile.lastName}`,
  })),

  // Transform arrays
  tags: z.array(z.string()).transform((tags) => tags.map((tag) => tag.toLowerCase())),
}).openapi('YourOutput');

export type YourOutput = z.infer<typeof YourOutputSchema>;

// === Async Validation (with refine) ===
export const UniqueEmailSchema = z.string().email().refine(
  async (email) => {
    // Check if email exists in database
    const exists = await checkEmailExists(email);
    return !exists;
  },
  { message: 'Email already exists' }
);

async function checkEmailExists(email: string): Promise<boolean> {
  // TODO: Database lookup
  return false;
}
