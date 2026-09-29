---
description: Run lint/format auto-fixes for frontend and backend, then report remaining manual issues.
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# Lint Fix

## Input
$ARGUMENTS (optional scope/profile)

Examples:
- `/lint-fix`
- `/lint-fix --scope frontend`
- `/lint-fix --scope backend`

## Purpose
Apply safe automatic lint/format fixes quickly and produce a concise manual-fix list.

## Workflow

### 1. Run Auto-Fixes
Frontend:
```bash
pnpm --filter @repo/web lint --fix
pnpm --filter @repo/web format
```

Backend:
```bash
# Auto-fix what can be fixed
pnpm turbo lint:fix
pnpm format
```

### 2. Re-Check
```bash
pnpm turbo lint
pnpm turbo type-check
pnpm turbo test --passWithNoTests
```

### 3. Report
Provide:
- Files fixed automatically
- Remaining violations with exact fix guidance
- Any regression risk introduced by formatting/lint changes

## Cross-References
- `/verify-quality`
- `/review-code`
- `/checklist-verify`
