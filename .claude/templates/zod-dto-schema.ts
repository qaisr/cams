/**
 * Zod DTO Schema Template — Create / Update / Response
 *
 * Lives in packages/validation/src/{entity}.schema.ts and is re-exported from
 * packages/validation/src/index.ts. These schemas are the single source of
 * truth for API validation AND OpenAPI generation (via `.openapi()` metadata),
 * which orval then turns into typed React Query hooks. Edit the Prisma schema
 * first for persisted shapes, then run `pnpm generate`.
 *
 * Rules (see @.claude/patterns/zod-openapi-pattern.md):
 *  - Import `z` from './zod' (the OpenAPI-extended singleton), NEVER from 'zod'.
 *  - Add `.openapi({ ... })` to every exported schema so the spec is documented.
 *  - Export an inferred type alias per schema (`…DtoType`) for API + web to share.
 *  - Response schemas describe what the API returns — never leak Prisma internals
 *    (e.g. omit soft-delete columns, hashed secrets).
 *
 * Replace {Entity} (PascalCase) and {entity} (camelCase) before use.
 */
import { z } from './zod';

// ─── Create ───────────────────────────────────────────────────────────────────
// Fields the client supplies when creating. No server-assigned fields (id, dates).
export const Create{Entity}Schema = z
  .object({
    name: z.string().min(1).max(200).openapi({ example: 'Acme invoice' }),
    // amount: z.number().int().nonnegative(),
    // status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT'),
  })
  .openapi('Create{Entity}');

export type Create{Entity}DtoType = z.infer<typeof Create{Entity}Schema>;

// ─── Update ─────────────────────────────────────────────────────────────────
// PUT (full replace): same required shape as Create. For PATCH use `.partial()`
// at the call site or export a dedicated Patch schema below.
export const Update{Entity}Schema = Create{Entity}Schema.openapi('Update{Entity}');
export type Update{Entity}DtoType = z.infer<typeof Update{Entity}Schema>;

export const Patch{Entity}Schema = Create{Entity}Schema.partial().openapi('Patch{Entity}');
export type Patch{Entity}DtoType = z.infer<typeof Patch{Entity}Schema>;

// ─── Response ───────────────────────────────────────────────────────────────
// What the API returns. Add server-assigned fields; keep datetimes as ISO strings.
export const {Entity}ResponseSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    // status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('{Entity}Response');

export type {Entity}ResponseDtoType = z.infer<typeof {Entity}ResponseSchema>;

// ─── List (paginated envelope) ────────────────────────────────────────────────
// Keep the envelope shape aligned with @.claude/standards/http-response-standards.md.
export const {Entity}ListResponseSchema = z
  .object({
    data: z.array({Entity}ResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi('{Entity}ListResponse');

export type {Entity}ListResponseDtoType = z.infer<typeof {Entity}ListResponseSchema>;
