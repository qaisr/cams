// Single source of `z` for the whole monorepo.
//
// `extendZodWithOpenApi(z)` MUST be called exactly once, before any schema is
// declared, so every schema gains the `.openapi()` method. All schema files —
// and all consumers in apps/api and apps/web — import `z` from here (re-exported
// by the package barrel as `@repo/validation`), NEVER from 'zod' directly.
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export { z };
