#!/bin/bash
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
PASSED=0; FAILED=0; WARNINGS=0
PROFILE="${1:-full}"

print_header()  { echo -e "\n${BLUE}━━━ $1 ━━━${NC}\n"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; PASSED=$((PASSED+1)); }
print_error()   { echo -e "${RED}✗${NC} $1"; FAILED=$((FAILED+1)); }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; WARNINGS=$((WARNINGS+1)); }
print_info()    { echo -e "${BLUE}ℹ${NC} $1"; }

usage() {
  echo "Usage: $0 [quick|full]"
  echo "  quick  Fast checks for active development"
  echo "  full   Comprehensive gate before PR/merge (default)"
}

[[ "$PROFILE" =~ ^(quick|full)$ ]] || { usage; exit 1; }

echo -e "\n${BLUE}NestJS Quality Gate — Profile: ${PROFILE}${NC}\n"

if [[ ! -f "package.json" ]] || [[ ! -d "apps/api" ]] || [[ ! -d "apps/web" ]]; then
  echo -e "${RED}Run from project root${NC}"; exit 1
fi

# ─── Generation Pipeline ──────────────────────────────────────────────────────
print_header "Generation Pipeline"

if pnpm --filter @repo/database generate > /dev/null 2>&1; then
  print_success "Prisma generate (client + Zod schemas)"
else
  print_error "Prisma generate failed"
  print_info "  Fix: check packages/database/prisma/schema.prisma for syntax errors"
fi

if tsx apps/api/src/openapi/generate-spec.ts > /dev/null 2>&1; then
  print_success "OpenAPI spec generated from Zod"
else
  print_error "OpenAPI spec generation failed"
  print_info "  Fix: check apps/api/src/openapi/generate-spec.ts"
fi

if pnpm --filter @repo/web orval > /dev/null 2>&1; then
  print_success "React Query hooks generated (orval)"
else
  print_error "orval codegen failed"
  print_info "  Fix: check apps/web/orval.config.ts and OpenAPI spec validity"
fi

# ─── TypeScript ───────────────────────────────────────────────────────────────
print_header "TypeScript"

if pnpm type-check > /dev/null 2>&1; then
  print_success "TypeScript (all workspaces)"
else
  print_error "TypeScript errors found"
  print_info "  Fix: pnpm type-check (shows all errors)"
fi

# ─── Linting ──────────────────────────────────────────────────────────────────
print_header "Linting & Formatting"

if pnpm lint > /dev/null 2>&1; then
  print_success "ESLint (zero warnings)"
else
  print_error "ESLint violations"
  print_info "  Fix: pnpm lint:fix"
fi

if pnpm format:check > /dev/null 2>&1; then
  print_success "Prettier formatting"
else
  print_error "Prettier formatting issues"
  print_info "  Fix: pnpm format"
fi

# ─── Tests ────────────────────────────────────────────────────────────────────
print_header "Tests"

if [[ "$PROFILE" == "quick" ]]; then
  if pnpm test --passWithNoTests > /dev/null 2>&1; then
    print_success "Unit tests (quick)"
  else
    print_error "Unit tests failed"
    print_info "  Fix: pnpm test --verbose"
  fi
else
  if pnpm test --coverage > /dev/null 2>&1; then
    print_success "Unit tests + coverage thresholds"
  else
    print_error "Unit tests / coverage thresholds failed"
    print_info "  Fix: pnpm test --coverage --verbose"
  fi

  if pnpm test:integration --runInBand > /dev/null 2>&1; then
    print_success "Integration tests (Testcontainers)"
  else
    print_warning "Integration tests failed (check Docker is running)"
    print_info "  Fix: pnpm test:integration --verbose --runInBand"
  fi
fi

# ─── Security ─────────────────────────────────────────────────────────────────
if [[ "$PROFILE" == "full" ]]; then
  print_header "Security"

  if pnpm audit --audit-level=high > /dev/null 2>&1; then
    print_success "npm audit (no high/critical)"
  else
    print_warning "npm audit found vulnerabilities"
    print_info "  Review: pnpm audit"
  fi

  if [[ -n "${SNYK_TOKEN:-}" ]]; then
    if npx snyk test --severity-threshold=high > /dev/null 2>&1; then
      print_success "Snyk scan"
    else
      print_warning "Snyk found vulnerabilities"
      print_info "  Review: npx snyk test"
    fi
  else
    print_warning "Snyk skipped (SNYK_TOKEN not set)"
  fi
fi

# ─── Build ────────────────────────────────────────────────────────────────────
if [[ "$PROFILE" == "full" ]]; then
  print_header "Build Verification"

  if pnpm --filter @repo/api build > /dev/null 2>&1; then
    print_success "API build"
  else
    print_error "API build failed"
  fi

  if pnpm --filter @repo/web build > /dev/null 2>&1; then
    print_success "Web build"
  else
    print_error "Web build failed"
  fi
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo -e "\n${BLUE}━━━ Summary ━━━${NC}"
echo -e "Passed:   ${GREEN}$PASSED${NC}"
echo -e "Failed:   ${RED}$FAILED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}\n"

if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}✨ Quality gate passed — ready to commit/push${NC}\n"
  exit 0
else
  echo -e "${RED}❌ Quality gate failed — fix issues before committing${NC}\n"
  exit 1
fi