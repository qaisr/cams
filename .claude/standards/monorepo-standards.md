# Monorepo Standards (Turborepo)

> Load when: scaffolding packages, adding dependencies, or configuring build pipeline.

## Package Structure
```
apps/
  web/          # Next.js frontend
  api/          # NestJS backend (Fargate)
packages/
  database/     # Prisma client, generated Zod types
  validation/   # Extended Zod schemas + OpenAPI metadata
  api-spec/     # Generated OpenAPI JSON
  ui/           # Shared component library (Storybook)
  config/       # Shared ESLint, TS, Tailwind configs
  types/        # Shared TypeScript types (no runtime code)
  utils/        # Pure utility functions (no framework deps)
```

## Dependency Rules (Enforced via ESLint `import/no-restricted-paths`)
```
apps/web        → packages/* ✅
apps/api        → packages/* ✅
packages/ui     → packages/types, packages/utils ✅
packages/ui     → apps/* ❌ (no circular)
packages/database → (no app packages) ✅
packages/validation → packages/database ✅
packages/api-spec → packages/validation ✅
```

## turbo.json Pipeline
```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "generated/**"]
    },
    "generate": {
      "dependsOn": ["^generate"],
      "outputs": ["generated/**", "src/hooks/generated/**"]
    },
    "test": { "dependsOn": ["^build"], "cache": false },
    "lint": { "outputs": [] },
    "type-check": { "dependsOn": ["^build"], "outputs": [] }
  }
}
```

## Package.json Standards
```json
{
  "name": "@myapp/package-name",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc --project tsconfig.build.json",
    "lint": "eslint src/",
    "type-check": "tsc --noEmit"
  }
}
```

## Rules
- All shared code goes in `packages/`, never duplicated across apps
- `packages/types` must be pure TypeScript — no runtime imports
- `packages/utils` must have zero framework dependencies (no React, no NestJS)
- Use `workspace:*` protocol for internal package references
- Run `turbo run build --filter=...app[HEAD^1]` in CI for affected-only builds
- Never install a package in root `package.json` unless it's a tooling dep (turbo, husky)
- Lock file: `pnpm-lock.yaml` is source of truth; never commit conflicted lock files

## Adding a New Package
```bash
# 1. Create package
mkdir packages/my-package && cd packages/my-package

# 2. Init from config template
cp packages/config/templates/package.json ./package.json
cp packages/config/templates/tsconfig.json ./tsconfig.json

# 3. Add to workspace root
# pnpm-workspace.yaml already includes packages/*

# 4. Export from index.ts — always barrel export
echo "export * from './src/my-module';" > src/index.ts
```

## Versioning
- Internal packages use `"*"` version in workspace deps
- External deps pinned to exact version in root `package.json`
- Use `pnpm` workspaces — no `npm` or `yarn` in this repo

## Dependency Installation

> **Critical rule:** every newly added npm package MUST be installed at its latest stable version. Never guess versions from training data — registry truth wins.

### Required workflow before any `pnpm add`

1. **Check the latest stable version on the registry** (do NOT rely on memory):
   ```bash
   pnpm view <pkg> version           # single package, latest dist-tag
   pnpm view <pkg> versions --json   # full list if you need to inspect
   ```
   For multiple packages in one go:
   ```bash
   for p in pkg-a pkg-b pkg-c; do echo "$p $(pnpm view "$p" version)"; done
   ```

2. **Reject pre-release tags** unless the user explicitly opts in. Skip versions ending in
   `-alpha.*`, `-beta.*`, `-rc.*`, `-next.*`, `-canary.*`, `-experimental.*`,
   `-insiders.*`, `0.0.0-*`. If the latest dist-tag points to a pre-release, fall back
   to the highest stable version from `pnpm view <pkg> versions --json` or use
   `pnpm view <pkg> dist-tags` and pick `latest` only when it is a stable SemVer.

3. **Install with `@latest`** (or the verified version), targeting the correct workspace
   filter — never run `pnpm add <pkg>` without an explicit version specifier:
   ```bash
   # ✅ Correct — workspace-scoped, latest stable
   pnpm --filter @repo/web add <pkg>@latest
   pnpm --filter @repo/api add -D <pkg>@latest

   # ❌ Wrong — implicit version, may resolve to stale cached metadata
   pnpm --filter @repo/web add <pkg>
   pnpm add <pkg>              # also wrong: no filter, lands in repo root
   ```

4. **Verify the resolved version** in `package.json` and `pnpm-lock.yaml` matches what
   the registry reported in step 1. If they differ (offline cache, proxy, etc.), run
   `pnpm install --force` for that workspace and re-check.

5. **Run the standard gates** after install: `pnpm install`, `pnpm type-check`,
   `pnpm lint`, and the relevant `pnpm test` filter. Treat any breakage as an
   upgrade-task, not a reason to silently downgrade.

### Rules
- **Always** include `@latest` (or the exact verified version) in `pnpm add`. Bare
  `pnpm add <pkg>` is forbidden in this repo.
- **Never** copy a version from another package's `dependencies` block without
  re-verifying it against the registry — local lockfiles drift.
- **Never** downgrade a package that already exists in `package.json`. If the latest
  stable is older than what is installed, stop and ask the user.
- **Workspace scope is mandatory.** Use `pnpm --filter <pkg-name> add ...`. Never add
  app/library deps to the repo-root `package.json` — root is reserved for tooling
  (`turbo`, `husky`, `commitlint`, `lint-staged`, `prettier`, etc.).
- **Peer-dependency awareness.** When the package declares peer deps (e.g. React,
  Next.js, NestJS), confirm the latest stable is compatible with the existing peer
  versions before installing. If incompatible, surface the conflict to the user
  instead of silently installing an older "compatible" version.
- **Engines.** Respect the `"engines"` field in root `package.json` (`node >=20`,
  `pnpm >=9`). If the latest stable of a package requires a newer engine, flag it
  explicitly.
- **No `latest` in `package.json`.** The `@latest` specifier is for the install
  command only — `pnpm add` resolves it to a concrete SemVer range in
  `package.json`. Never hand-edit `package.json` to use the literal string
  `"latest"`.
- **Pre-releases.** Only when the user explicitly asks for `next`/`canary`/`beta`,
  use the matching dist-tag: `pnpm add <pkg>@next`. Note the reason in the commit.

### Upgrading existing packages
- Use `pnpm up --latest <pkg>` (workspace-filtered) for a single dep.
- Use `pnpm up --latest --interactive` to review-and-pick across the workspace.
- Never edit a version in `package.json` by hand to bump it — always go through
  pnpm so the lockfile stays in sync.

## Naming Conventions
- Package names: `@repo/<name>` (e.g., `@repo/database`)
- All packages export from `src/index.ts`
- Generated files always in `generated/` subdirectory, gitignored except `openapi.json`

## Build Constraints
- `turbo build` must complete in < 3 minutes (cached)
- Cache remote via Turborepo remote cache in CI
- Never commit `node_modules`, `.next`, `dist`

## Dependency Installation Rules

**These rules apply every time a package is added or updated — no exceptions.**

### Always resolve the latest stable version before writing to package.json

Before adding or updating any dependency, run:

```bash
pnpm view <package-name> version          # latest stable
pnpm view <package-name> dist-tags        # confirms latest vs next/beta tags
```

Never assume the version already in `package.json` is current — it may be stale from when the file was first scaffolded. Always verify.

### Use `pnpm add` with an explicit latest-resolved version

```bash
# ✅ Correct — resolve first, then add with caret range
pnpm --filter @repo/web add react@$(pnpm view react version)

# ✅ Also correct — let pnpm resolve to latest at install time
pnpm --filter @repo/web add react@latest

# ❌ Wrong — copying a hardcoded version from memory or another file
pnpm --filter @repo/web add react@18.2.0   # may be outdated
```

When scaffolding a new feature or copying a `package.json` from a template, **always re-resolve every version** before running `pnpm install`.

### Never write a version range that cannot be satisfied

A range like `^8.6.14` is uninstallable if the package has moved to `10.x`. Before committing any `package.json` change, verify every new or modified range resolves:

```bash
pnpm install --dry-run 2>&1 | grep -i "ERR_PNPM_NO_MATCHING_VERSION"
```

If any `ERR_PNPM_NO_MATCHING_VERSION` errors appear, resolve them before proceeding.

### Version range policy

| Dep type | Range | Example |
|----------|-------|---------|
| Runtime dependencies | `^major.minor.patch` | `^5.6.6` |
| Dev / tooling | `^major.minor.patch` | `^30.4.2` |
| Internal workspace packages | `workspace:*` | — |
| Breaking-decision packages (see below) | Confirm before bumping major | — |

### Breaking-decision packages — confirm before any major bump

Major version bumps for these packages require explicit user confirmation — never apply silently:

- `next`, `react`, `react-dom`
- `nestjs` (any `@nestjs/*`)
- `typescript`
- `zod`
- `electrodb`
- `turbo`
- `tailwindcss`, `daisyui`
- `storybook` (any `storybook` / `@storybook/*`)
- `jest`, `ts-jest`
- `eslint`, `typescript-eslint` (any `@typescript-eslint/*`)

For all other packages, minor and patch bumps are safe to apply without confirmation.

### After any install, verify the lockfile resolves cleanly

```bash
pnpm install           # must complete with no ERR_PNPM_NO_MATCHING_VERSION
pnpm type-check        # no new type errors
pnpm lint              # no new lint errors
pnpm test              # no regressions
```

## Token Optimization

Load this file only for: monorepo structure changes, new package creation,
pipeline configuration, or dependency resolution issues.
