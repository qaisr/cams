---
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# Verify Code Quality

Manual quality gate command. Run this intentionally before PR/merge or when you need deep validation.

## Important

- Do not auto-run this command in normal feature implementation loops.
- For day-to-day development speed, use targeted checks first, then run this command manually as needed.
- Load only release-check standards while executing this command.
- Use `@.claude/standards/quality-gate-standards.md` as the verdict baseline.
- Unload build-phase implementation docs and keep only failures and fixes.

## Usage

```bash
# Comprehensive quality/security/build gate (slower)
./.claude/scripts/verify-quality.sh

# Faster local gate for active feature work
./.claude/scripts/verify-quality.sh --profile quick
```

## What each profile runs

1. `--profile quick`:
   - API: `pnpm --filter @repo/api type-check`, `pnpm --filter @repo/api lint`
   - Web: `pnpm --filter @repo/web type-check`, `pnpm --filter @repo/web lint`
   - Targeted tests: `pnpm --filter @repo/api test --passWithNoTests`, `pnpm --filter @repo/web test --passWithNoTests`

2. `--profile full` (default):
   - Quick checks plus coverage checks
   - Security scans (Snyk if token exists, `pnpm audit`)
   - Build verification (`pnpm turbo build`)

## Cross-Cutting Verdict Gates

Before declaring release-ready, confirm:

- Correctness/regression gate: changed journeys verified end-to-end.
- Security/compliance gate: no unresolved high-risk findings.
- Reliability gate: failure handling and timeout/retry paths validated.
- Performance gate: no critical latency/capacity regressions.
- Observability gate: logs/metrics/events sufficient for support.
- UX/accessibility gate: critical UI journeys are usable and accessible.
- Testability gate: risk-appropriate automated test coverage exists.

## Recommended fast path during feature development

Use only the checks needed for changed areas:

```bash
# Frontend-focused change
pnpm --filter @repo/web type-check
pnpm --filter @repo/web lint
pnpm --filter @repo/web test --passWithNoTests

# API-focused change
pnpm --filter @repo/api type-check
pnpm --filter @repo/api lint
pnpm --filter @repo/api test --passWithNoTests

# OpenAPI contract change
pnpm lint:api
pnpm generate:types
```

## Auto-fix first where possible

```bash
# Frontend
pnpm lint:fix
pnpm format

# API
pnpm --filter @repo/api lint:fix
```

## Exit behavior

- Exit `0`: all required checks for selected profile passed.
- Exit `1`: one or more required checks failed.
- Warnings are reported separately and do not fail the script unless explicitly configured in tooling.
