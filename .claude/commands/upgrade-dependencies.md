---
description: Carefully upgrade dependencies across all pnpm workspace packages with security checks, conflict resolution, and verification.
agent: build
subtask: false
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# Upgrade Dependencies

## Input

$ARGUMENTS (optional scope/flags)

Examples:

- `/upgrade-dependencies` — upgrade all packages across the workspace
- `/upgrade-dependencies --scope @repo/web` — restrict to one workspace package
- `/upgrade-dependencies --minor` — minor + patch only, skip majors
- `/upgrade-dependencies --dry-run` — report the upgrade plan without applying changes

Default: upgrade all workspace packages, propose latest stable, hold majors for explicit confirmation.

## Purpose

Bring outdated dependencies up to date safely across every package in the pnpm
workspace. Eliminate stale/unresolvable version ranges (e.g. a `^8.x` range when
only `10.x` is published), close known vulnerabilities, avoid version conflicts
across the monorepo, and prove the result still installs, type-checks, lints,
and passes tests before reporting done.

## Guardrails (read before acting)

- **Never** edit generated files (`packages/*/generated/`, `apps/web/src/hooks/generated/`, `apps/web/src/mocks/generated/`). If a dependency upgrade changes generated output, re-run `pnpm generate` instead of hand-editing.
- **Never** skip git hooks or bypass commit signing.
- **Do not** swap a banned dependency back in (no `class-validator`, no Cognito, no SAM, no `@nestjs/platform-express`). If an upgrade pulls one transitively, flag it — do not adopt it.
- **Respect the engine floor**: Node `>=20`, pnpm `>=9`. Do not upgrade a package to a version requiring a newer engine without flagging it as a breaking decision.
- Honour the pinned core stack intent in `CLAUDE.md`. Major bumps to NestJS, NextJS, React, TypeScript, Zod, ElectroDB, Turborepo, or TailwindCSS are **breaking decisions** — present them for confirmation, never apply silently.
- Treat any upgrade that crosses a **major** version as requiring confirmation unless `--major` is explicitly passed.

## Workflow

### 1. Snapshot & Backup

Confirm a clean-enough starting point and back up the lockfile.

```bash
!`git status --short`
!`node --version && pnpm --version`
!`cp pnpm-lock.yaml "pnpm-lock.yaml.bak.$(date +%Y%m%d-%H%M%S)" && ls -la pnpm-lock.yaml.bak.* 2>/dev/null`
```

- If there are unrelated uncommitted changes, warn the user and ask whether to continue (a clean tree makes rollback trivial).
- Record the backup filename in the final report so it can be restored or deleted.

### 2. Enumerate Workspace Packages

Discover the actual packages from the workspace config — do not assume the layout.

```bash
!`cat pnpm-workspace.yaml`
!`pnpm -r list --depth -1 2>/dev/null`
```

Build the list of workspace packages to process. If `--scope <name>` was passed, restrict to that package (and its workspace dependents if relevant).

### 3. Audit Current State

For each package, gather what is outdated and what is vulnerable.

```bash
# What is outdated (recursive across the workspace)
!`pnpm -r outdated 2>&1 || true`

# Known vulnerabilities in the current tree
!`pnpm audit --audit-level=low 2>&1 || true`
```

Classify every outdated entry:

- **patch** — safe, apply.
- **minor** — generally safe, apply; spot-check changelogs for anything in the core stack.
- **major** — breaking decision; collect for the confirmation step.
- **stale/unresolvable range** — the requested range no longer resolves to any published version (the reported symptom: `ERR_PNPM_NO_MATCHING_VERSION`). These MUST be fixed even if it means a major bump, because the project currently cannot install. Flag each one explicitly.

Cross-reference vulnerabilities so a security fix that requires a major bump is surfaced as both "security" and "breaking decision".

### 4. Plan the Upgrade

Produce an upgrade plan grouped by risk, and surface it before changing anything:

```
Upgrade Plan
============
Stale ranges (install-blocking — must fix):
  - <pkg> <oldRange> → <newVersion>   (in: <workspace-pkg>)   reason: latest is X, range matched nothing

Security (must fix):
  - <pkg> <old> → <fixed>   severity: <high|critical>   advisory: <id>

Safe (patch/minor — auto-apply):
  - <pkg> <old> → <new>   (in: <workspace-pkg>)

Breaking decisions (need confirmation):
  - <pkg> <oldMajor> → <newMajor>   (in: <workspace-pkg>)   notes: <migration concerns>
```

For `--dry-run`, STOP here and present the plan only.

Otherwise, use **AskUserQuestion** to confirm the "Breaking decisions" group before proceeding. Apply the stale-range and security and safe groups regardless (the project is already broken without the stale-range fixes), but never apply a major bump the user declined.

### 5. Apply Upgrades (Incrementally)

Apply in order of increasing risk so failures are easy to localise. Prefer
small, verifiable batches over one giant bump.

```bash
# Patch + minor across the workspace (safe band)
!`pnpm -r update 2>&1 | tail -40`
```

For specific targeted upgrades (stale ranges, security fixes, confirmed majors),
set the exact version on the owning package:

```bash
# Example — adjust package name, version, and --filter to the real target
# pnpm --filter @repo/web add -D @storybook/nextjs-vite@^10.4.6
```

- Pin versions consistent with how the repo already expresses ranges (match existing `^`/`~`/exact style).
- For peer-dependency families (e.g. all `@storybook/*`, all `@nestjs/*`, React + React-DOM + types), upgrade the whole family together to the same line to avoid mismatches.
- After each batch, run `pnpm install` and confirm it resolves with no `ERR_PNPM_*` errors before moving on.

### 6. Reconcile & De-Duplicate

```bash
!`pnpm install 2>&1 | tail -30`
!`pnpm dedupe 2>&1 | tail -20`
```

- Resolve peer-dependency warnings. If two workspace packages pin conflicting versions of a shared dep, align them (single version policy across the monorepo where practical).
- If the upgrade touched anything feeding the codegen pipeline (Zod, orval, zod-to-openapi, nestjs-zod), re-run generation rather than editing generated output:

```bash
!`pnpm generate 2>&1 | tail -30 || true`
```

### 7. Verify

Run the full local quality gates. Do NOT report success until these pass.

```bash
!`pnpm install 2>&1 | tail -10`
!`pnpm type-check 2>&1 | tail -40`
!`pnpm lint 2>&1 | tail -40`
!`pnpm build 2>&1 | tail -40`
!`pnpm test 2>&1 | tail -60`
```

- If integration/E2E suites exist and are runnable locally, run the unit suite at minimum; note any suites skipped and why.
- Re-run the security audit to confirm the upgrade actually closed the advisories:

```bash
!`pnpm audit --audit-level=high 2>&1 || true`
```

### 8. Recover on Failure

If install, type-check, lint, build, or tests fail and the cause is an upgrade:

1. Isolate the offending package (bisect the batch — revert half, re-test).
2. If a single package breaks the build, pin it back to the last working version and record it as **blocked** in the report with the error and a suggested remediation (codemod, peer bump, await upstream fix).
3. If the tree is broadly broken, restore the lockfile from the backup and re-install:

```bash
# Only when broadly broken and a clean reset is wanted:
# cp pnpm-lock.yaml.bak.<timestamp> pnpm-lock.yaml && pnpm install
```

Never leave the workspace in a non-installing state. Either land a green upgrade or restore to the backed-up baseline.

### 9. Report

Produce a concise report:

```
Dependency Upgrade Report
=========================
Backup lockfile: pnpm-lock.yaml.bak.<timestamp>

Upgraded (applied & verified):
  - <pkg> <old> → <new>  (<workspace-pkg>)

Security fixes:
  - <pkg> <old> → <fixed>  severity <...>  advisory <id>

Deferred / declined majors:
  - <pkg> <old> → <available>  reason: <user declined | needs migration>

Blocked (pinned back):
  - <pkg> stuck at <version>  error: <summary>  suggested fix: <...>

Verification:
  - install: PASS/FAIL
  - type-check: PASS/FAIL
  - lint: PASS/FAIL
  - build: PASS/FAIL
  - tests: PASS/FAIL (<n> passed / <n> failed)
  - audit (high+): <clean | N remaining>

Next steps / manual follow-ups:
  - <...>
```

- Do not commit automatically. State that changes are staged/working-tree only and let the user run `/commit`.
- If anything is still red, lead the report with the blocking issue and the recommended fix.

## Cross-References

- `/lint-fix` — auto-fix lint/format after upgrades
- `/verify-quality` — broader quality gate
- `/security-audit` — deeper security review beyond `pnpm audit`
- `/commit` — commit the verified upgrade
- Generation pipeline: `pnpm generate` (see `CLAUDE.md` → Code Generation Pipeline)
