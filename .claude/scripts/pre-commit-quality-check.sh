#!/bin/bash
# Pre-commit quality check for TypeScript/NestJS/NextJS code
#
# Runs type-check, lint, and affected unit tests on staged files.
# Fast-fail approach: first failure aborts immediately.
#
# Usage:
#   ./.claude/scripts/pre-commit-quality-check.sh
#
# To install as a git hook (if not using Husky):
#   ln -sf ../../.claude/scripts/pre-commit-quality-check.sh .git/hooks/pre-commit

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Pre-Commit Quality Check — TypeScript / NestJS / NextJS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Detect staged TypeScript / TSX files
STAGED_TS=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|mts|cts)$' || true)

if [ -z "$STAGED_TS" ]; then
  echo -e "${GREEN}✓ No TypeScript files staged — skipping TS quality checks${NC}"
  exit 0
fi

echo -e "${YELLOW}Staged TypeScript files:${NC}"
echo "$STAGED_TS" | sed 's/^/  - /'
echo ""

# Determine which workspaces are affected
HAS_API=$(echo "$STAGED_TS" | grep -q "^apps/api\|^packages/" && echo "yes" || echo "no")
HAS_WEB=$(echo "$STAGED_TS" | grep -q "^apps/web" && echo "yes" || echo "no")
HAS_PACKAGES=$(echo "$STAGED_TS" | grep -q "^packages/" && echo "yes" || echo "no")

# ─── Step 0: Secret detection ─────────────────────────────────────────────────
# Note: Husky's pre-commit hook runs gitleaks — this is a fast supplementary check.

echo -e "${BLUE}Step 0/5: Scanning staged files for secrets...${NC}"
SECRET_PATTERNS='(password|secret|api_key|apikey|token|private_key)\s*=\s*["\x27][^"\x27]{8,}'
SECRETS_FOUND=$(echo "$STAGED_TS" | xargs grep -iEn "$SECRET_PATTERNS" 2>/dev/null |
  grep -v "test\|spec\|example\|placeholder\|TODO\|REPLACE\|{" | head -5 || true)
if [ -n "$SECRETS_FOUND" ]; then
  echo -e "${RED}✗ Potential secrets detected in staged files${NC}"
  echo "$SECRETS_FOUND"
  echo -e "${YELLOW}Fix:${NC} move to AWS Secrets Manager or use \${ENV_VAR} references"
  exit 1
fi
echo -e "${GREEN}✓ No secrets detected${NC}"
echo ""

# ─── Step 1: Format check (Prettier) ─────────────────────────────────────────

echo -e "${BLUE}Step 1/5: Checking Prettier formatting...${NC}"
if command -v pnpm >/dev/null 2>&1; then
  if ! pnpm format:check 2>&1; then
    echo -e "${RED}✗ Prettier formatting violations found${NC}"
    echo ""
    echo -e "${YELLOW}Fix with:${NC}  pnpm format"
    echo ""
    exit 1
  fi
fi
echo -e "${GREEN}✓ Prettier formatting OK${NC}"
echo ""

# ─── Step 2: ESLint ──────────────────────────────────────────────────────────

echo -e "${BLUE}Step 2/5: Running ESLint...${NC}"

LINT_FAILED=0

if [ "$HAS_API" = "yes" ] || [ "$HAS_PACKAGES" = "yes" ]; then
  if ! pnpm --filter @repo/api lint 2>&1; then
    echo -e "${RED}✗ ESLint violations in @repo/api${NC}"
    LINT_FAILED=1
  fi
fi

if [ "$HAS_WEB" = "yes" ]; then
  if ! pnpm --filter @repo/web lint 2>&1; then
    echo -e "${RED}✗ ESLint violations in @repo/web${NC}"
    LINT_FAILED=1
  fi
fi

if [ $LINT_FAILED -ne 0 ]; then
  echo ""
  echo -e "${YELLOW}Fix with:${NC}  pnpm lint:fix"
  echo ""
  exit 1
fi
echo -e "${GREEN}✓ ESLint passed${NC}"
echo ""

# ─── Step 3: TypeScript type-check ───────────────────────────────────────────

echo -e "${BLUE}Step 3/5: Running TypeScript type-check...${NC}"

TYPECHECK_FAILED=0

if [ "$HAS_API" = "yes" ] || [ "$HAS_PACKAGES" = "yes" ]; then
  if ! pnpm --filter @repo/api type-check 2>&1; then
    echo -e "${RED}✗ TypeScript errors in @repo/api${NC}"
    TYPECHECK_FAILED=1
  fi
fi

if [ "$HAS_WEB" = "yes" ]; then
  if ! pnpm --filter @repo/web type-check 2>&1; then
    echo -e "${RED}✗ TypeScript errors in @repo/web${NC}"
    TYPECHECK_FAILED=1
  fi
fi

if [ $TYPECHECK_FAILED -ne 0 ]; then
  echo ""
  echo -e "${YELLOW}Fix TypeScript errors before committing.${NC}"
  echo ""
  exit 1
fi
echo -e "${GREEN}✓ TypeScript type-check passed${NC}"
echo ""

# ─── Step 4: Unit tests (affected packages only) ─────────────────────────────

echo -e "${BLUE}Step 4/5: Running unit tests for affected packages...${NC}"

TEST_FAILED=0

if [ "$HAS_API" = "yes" ] || [ "$HAS_PACKAGES" = "yes" ]; then
  if ! pnpm --filter @repo/api test --passWithNoTests 2>&1; then
    echo -e "${RED}✗ Unit tests failed in @repo/api${NC}"
    TEST_FAILED=1
  fi
fi

if [ "$HAS_WEB" = "yes" ]; then
  if ! pnpm --filter @repo/web test --passWithNoTests 2>&1; then
    echo -e "${RED}✗ Unit tests failed in @repo/web${NC}"
    TEST_FAILED=1
  fi
fi

if [ $TEST_FAILED -ne 0 ]; then
  echo ""
  echo -e "${YELLOW}Fix failing tests before committing.${NC}"
  echo -e "${YELLOW}Run:${NC}  pnpm test"
  echo ""
  exit 1
fi
echo -e "${GREEN}✓ Unit tests passed${NC}"
echo ""

# ─── Step 5: console.log in production code (warning only) ────────────────────

echo -e "${BLUE}Step 5/5: Checking for console statements...${NC}"
CONSOLE_LOGS=$(echo "$STAGED_TS" | grep -v "\.test\.\|\.spec\." |
  xargs grep -n "console\.\(log\|error\|warn\)" 2>/dev/null | grep -v "// " | head -5 || true)
if [ -n "$CONSOLE_LOGS" ]; then
  echo -e "${YELLOW}⚠ console statements found in production code (prefer the logger):${NC}"
  echo "$CONSOLE_LOGS"
  echo ""
else
  echo -e "${GREEN}✓ No console statements in production code${NC}"
  echo ""
fi

# ─── All checks passed ────────────────────────────────────────────────────────

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ All pre-commit quality checks passed!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

exit 0
