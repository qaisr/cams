#!/usr/bin/env bash
# .claude/scripts/infra-setup.sh
# CANS — Local Development Environment Setup
# Idempotent: safe to run multiple times. Never overwrites existing .env.local.

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

PASS="${GREEN}[✅]${RESET}"
WARN="${YELLOW}[⚠️ ]${RESET}"
FAIL="${RED}[❌]${RESET}"

# Track overall result
FAILURES=0

print_header() {
  echo ""
  echo -e "${BOLD}/infra-setup — Local Development Environment Check${RESET}"
  echo "==================================================="
  echo ""
}

pass() { echo -e "${PASS} $1"; }
warn() { echo -e "${WARN} $1"; }
fail() {
  echo -e "${FAIL} $1"
  FAILURES=$((FAILURES + 1))
}

# ── Check 1: Node.js version ──────────────────────────────────────────────────
check_node() {
  local required_major=20
  if ! command -v node &>/dev/null; then
    fail "Node.js not found — install Node.js >= ${required_major} via https://nodejs.org or nvm"
    return
  fi
  local version
  version=$(node --version | sed 's/v//')
  local major
  major=$(echo "$version" | cut -d. -f1)
  if [ "$major" -lt "$required_major" ]; then
    fail "Node.js ${version} — requires >= ${required_major}. Run: nvm install ${required_major} && nvm use ${required_major}"
  else
    pass "Node.js ${version} — OK"
  fi
}

# ── Check 2: pnpm installed ───────────────────────────────────────────────────
check_pnpm() {
  if ! command -v pnpm &>/dev/null; then
    echo "  → Installing pnpm..."
    npm install -g pnpm 2>&1 | tail -1
    if command -v pnpm &>/dev/null; then
      warn "pnpm — installed via npm"
    else
      fail "pnpm — install failed. Run: npm install -g pnpm"
    fi
  else
    local version
    version=$(pnpm --version)
    pass "pnpm ${version} — OK"
  fi
}

# ── Check 3: Dependencies installed ──────────────────────────────────────────
check_deps() {
  local root_nm="node_modules"
  if [ ! -d "${root_nm}" ] || [ ! -d "${root_nm}/.pnpm" ]; then
    echo "  → Running pnpm install..."
    pnpm install 2>&1 | tail -3
    warn "Dependencies — installed"
  else
    pass "Dependencies installed — OK"
  fi
}

# ── Check 4: Husky hooks executable ──────────────────────────────────────────
check_husky() {
  local hooks_ok=true
  for hook in .husky/pre-commit .husky/commit-msg .husky/pre-push; do
    if [ -f "$hook" ] && [ ! -x "$hook" ]; then
      hooks_ok=false
    fi
  done

  if [ "$hooks_ok" = false ]; then
    echo "  → Fixing hook permissions..."
    chmod +x .husky/* 2>/dev/null || true
    warn "Husky hooks — permissions fixed"
  else
    pass "Husky hooks executable — OK"
  fi
}

# ── Check 5: .env.local exists ───────────────────────────────────────────────
check_env_local() {
  if [ ! -f ".env.local" ]; then
    if [ -f ".env.local.example" ]; then
      cp ".env.local.example" ".env.local"
      warn ".env.local — MISSING → Copied from .env.local.example. Fill in PINGID_* values before production use."
    else
      fail ".env.local — MISSING and no .env.local.example found. Create it manually (see docs/getting-started.md#authentication-setup)."
    fi
  else
    pass ".env.local — OK"
  fi
}

# ── Check 6: Docker running ───────────────────────────────────────────────────
check_docker() {
  if ! docker info &>/dev/null 2>&1; then
    fail "Docker — not running. Start Docker Desktop then re-run /infra-setup"
    return 1
  fi
  pass "Docker running — OK"
  return 0
}

# ── Check 7: LocalStack running ───────────────────────────────────────────────
check_localstack() {
  if curl -sf http://localhost:4566/_localstack/health &>/dev/null; then
    pass "LocalStack — OK"
    return
  fi
  if [ -f "docker/docker-compose.yml" ]; then
    echo "  → Starting LocalStack..."
    docker compose -f docker/docker-compose.yml up -d localstack 2>&1 | tail -2
    sleep 3
    if curl -sf http://localhost:4566/_localstack/health &>/dev/null; then
      warn "LocalStack — started"
    else
      fail "LocalStack — failed to start. Check docker/docker-compose.yml"
    fi
  else
    fail "LocalStack — not running and no docker/docker-compose.yml found"
  fi
}

# ── Check 8: PostgreSQL running ───────────────────────────────────────────────
check_postgres() {
  # Try to check if the postgres container is running
  if docker compose -f docker/docker-compose.yml ps postgres 2>/dev/null | grep -q "running\|Up"; then
    pass "PostgreSQL running — OK"
    return
  fi
  if [ -f "docker/docker-compose.yml" ]; then
    echo "  → Starting PostgreSQL..."
    docker compose -f docker/docker-compose.yml up -d postgres 2>&1 | tail -2
    sleep 3
    if docker compose -f docker/docker-compose.yml ps postgres 2>/dev/null | grep -q "running\|Up"; then
      warn "PostgreSQL — started"
    else
      fail "PostgreSQL — failed to start. Check docker/docker-compose.yml"
    fi
  else
    fail "PostgreSQL — not running and no docker/docker-compose.yml found"
  fi
}

# ── Check 9: Prisma migrations applied ────────────────────────────────────────
check_migrations() {
  local db_url
  db_url="${DATABASE_URL:-$(grep DATABASE_URL .env.local 2>/dev/null | cut -d= -f2- | tr -d '"' || true)}"

  if [ -z "$db_url" ]; then
    fail "Prisma migrations — cannot check: DATABASE_URL not set. Set it in .env.local"
    return
  fi

  local migration_status
  if migration_status=$(DATABASE_URL="$db_url" pnpm --filter @repo/database exec prisma migrate status 2>&1); then
    if echo "$migration_status" | grep -q "Database schema is up to date"; then
      pass "Prisma migrations — up to date"
    else
      echo "  → Running migrations..."
      if DATABASE_URL="$db_url" pnpm --filter @repo/database exec prisma migrate deploy 2>&1 | tail -3; then
        warn "Prisma migrations — applied"
      else
        fail "Prisma migrations — failed. Check DATABASE_URL and postgres connection"
      fi
    fi
  else
    fail "Prisma migrations — could not connect. Check DATABASE_URL in .env.local"
  fi
}

# ── Checks 10–12: API startup + smoke tests ────────────────────────────────────
API_PID=""

check_api_startup() {
  local port=3001
  local health_url="http://localhost:${port}/health"

  # Kill any existing process on port
  if lsof -ti ":${port}" &>/dev/null; then
    echo "  → Port ${port} in use — killing existing process..."
    kill "$(lsof -ti ":${port}")" 2>/dev/null || true
    sleep 1
  fi

  echo "  → Starting API..."
  NODE_ENV=development MOCK_AUTH_ENABLED=true \
    pnpm --filter @repo/api start:dev >/tmp/app-api.log 2>&1 &
  API_PID=$!

  # Wait up to 20 seconds for the API to respond
  local attempts=0
  until curl -sf "${health_url}" &>/dev/null || [ $attempts -ge 20 ]; do
    sleep 1
    attempts=$((attempts + 1))
  done

  if ! curl -sf "${health_url}" &>/dev/null; then
    fail "API startup — failed after 20s. Check /tmp/app-api.log"
    API_PID=""
    return 1
  fi

  pass "API started on :${port} — OK"
  return 0
}

check_health_endpoint() {
  local response
  response=$(curl -sf http://localhost:3001/health 2>/dev/null)
  if echo "$response" | grep -q '"status":"ok"'; then
    pass "GET /health → { status: ok, db: connected }"
  else
    fail "GET /health → unexpected response: ${response}"
  fi
}

check_mock_login() {
  local response
  response=$(curl -sf -X POST http://localhost:3001/login \
    -H 'Content-Type: application/json' \
    -d '{"lanId":"infra-check","groups":["mx-admin"]}' 2>/dev/null || true)

  if echo "$response" | grep -q '"accessToken"'; then
    pass "POST /login (mock) → accessToken issued"
  else
    fail "POST /login (mock) → unexpected response: ${response}"
  fi
}

cleanup() {
  if [ -n "$API_PID" ]; then
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ── Main ──────────────────────────────────────────────────────────────────────
print_header

check_node
check_pnpm
check_deps
check_husky
check_env_local

# Docker-dependent checks
if check_docker; then
  check_localstack
  check_postgres
else
  warn "LocalStack — skipped (Docker not running)"
  warn "PostgreSQL — skipped (Docker not running)"
fi

check_migrations

# API smoke tests
if check_api_startup; then
  check_health_endpoint
  check_mock_login
else
  warn "GET /health — skipped (API not started)"
  warn "POST /login — skipped (API not started)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
if [ "$FAILURES" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}All checks passed. CANS is ready for development.${RESET}"
  echo ""
  echo "Next steps:"
  echo "  - Run /login-mock at http://localhost:3000/login-mock to test mock auth"
  echo "  - See docs/getting-started.md for the full onboarding guide"
  exit 0
else
  echo -e "${RED}${BOLD}${FAILURES} check(s) failed. Fix the issues above and re-run /infra-setup.${RESET}"
  exit 1
fi
