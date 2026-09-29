# Workflow: Codegen Sync Workflow

## Purpose
Keep the Prisma → Zod → OpenAPI → orval pipeline in sync.
Run after any schema change to ensure all generated artifacts are current.

## Trigger Conditions
- `prisma/schema.prisma` modified
- `packages/validation/src/**` modified
- NestJS controller endpoints added/changed

## Full Pipeline
```bash
# Step 1: Generate Zod types from Prisma schema
pnpm prisma generate          # triggers zod-prisma-types generator

# Step 2: Extend with OpenAPI metadata (if new models)
# Edit: packages/validation/src/<model>.ts
# Add: .openapi({ description: '...', example: ... })

# Step 3: Generate OpenAPI spec from Zod
pnpm turbo run codegen:spec   # runs apps/api/src/openapi/generate-spec.ts

# Step 4: Generate React Query hooks from OpenAPI
pnpm turbo run codegen:hooks  # runs orval

# Step 5: Type-check everything
pnpm turbo run typecheck

# Step 6: Run tests to verify nothing broke
pnpm turbo run test:unit
```

## Automated via Husky (Pre-commit)
The pre-commit hook auto-detects changes and runs relevant codegen steps.
See: `.claude/patterns/orval-codegen-pattern.md` for hook configuration.

## Quick Commands
```bash
# Full pipeline regeneration
pnpm run codegen:all

# Only regenerate OpenAPI spec (no Prisma changes)
pnpm run codegen:spec

# Only regenerate hooks (OpenAPI spec already updated)
pnpm run codegen:hooks

# Verify generated files match source (CI check)
pnpm run codegen:verify
```

## What Gets Generated
| Source | Generator | Output |
|--------|-----------|--------|
| `prisma/schema.prisma` | `zod-prisma-types` | `packages/database/generated/zod/` |
| `packages/validation/src/` | `zod-to-openapi` | `packages/api-spec/generated/openapi.json` |
| `packages/api-spec/generated/openapi.json` | `orval` | `apps/web/src/hooks/generated/` |
| `packages/api-spec/generated/openapi.json` | `orval` | `apps/web/src/types/generated/` |

## Rules
- Generated files are READ-ONLY — never edit manually
- Always commit generated files with the source change in the same commit
- CI blocks merge if generated files are stale
- If orval generates unexpected types: fix the Zod schema, not the generated file

## Troubleshooting
| Problem | Solution |
|---------|----------|
| Type errors in generated hooks | Zod schema type mismatch → fix schema |
| orval generates wrong HTTP method | Check OpenAPI operation decorator |
| Missing endpoint in generated client | Verify `@ApiOperation` decorator present |
| Stale openapi.json in CI | Run `pnpm codegen:spec` and commit |

## Token Optimization

- **Load when**: Prisma schema changes, OpenAPI spec edits, or orval/MSW generation drift detected.
- **Load only**: this workflow + `zod-openapi-pattern.md` + `orval-codegen-pattern.md`.
- **Unload after**: pipeline runs clean (`pnpm generate`), generated artifacts committed, type-check passes.
- **Hand-off to**: `backend-engineer` (DTO updates), `frontend-developer` (consume new hooks).
