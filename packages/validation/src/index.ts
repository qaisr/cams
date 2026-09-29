// Re-export the shared, OpenAPI-extended `z` so consumers do
// `import { z } from '@repo/validation'` — never from 'zod' directly.
export { z } from './zod';
export * from './auth.schema';
