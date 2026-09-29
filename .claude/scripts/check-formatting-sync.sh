#!/usr/bin/env bash
# scripts/check-formatting-sync.sh
# Verify Prettier owns formatting, ESLint owns quality — no overlap
# Usage: bash scripts/check-formatting-sync.sh
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
PASS=0
FAIL=0

ok() {
  echo -e "${GREEN}✅ PASS${NC} $1"
  PASS=$((PASS + 1))
}
fail() {
  echo -e "${RED}❌ FAIL${NC} $1"
  FAIL=$((FAIL + 1))
}
warn() { echo -e "${YELLOW}⚠️  WARN${NC} $1"; }
info() { echo -e "${BLUE}ℹ${NC}  $1"; }

echo -e "\n${BLUE}Formatter Sync Check${NC}\n"

# A: .prettierrc.json exists
if [ -f ".prettierrc.json" ]; then
  TABWIDTH=$(node -e "console.log(require('./.prettierrc.json').tabWidth ?? 2)")
  EOL=$(node -e "console.log(require('./.prettierrc.json').endOfLine ?? 'lf')")
  ok ".prettierrc.json present (tabWidth=$TABWIDTH, endOfLine=$EOL)"
else
  fail ".prettierrc.json missing"
  TABWIDTH=2
  EOL="lf"
fi

# B: eslint-config-prettier in ESLint config
if grep -q "eslint-config-prettier\|from 'prettier'" eslint.config.mjs 2>/dev/null; then
  ok "eslint-config-prettier found in eslint.config.mjs"
else
  fail "eslint-config-prettier not found in eslint.config.mjs — formatting rules may conflict"
fi

# C: No formatting rules active in ESLint
FORMATTING_RULES="\"indent\"\|\"quotes\"\|\"semi\"\|\"comma-dangle\"\|\"max-len\""
if grep -E "$FORMATTING_RULES" eslint.config.mjs 2>/dev/null | grep -v "'off'\|\"off\"\|0\|//"; then
  fail "Formatting rules found in eslint.config.mjs — these conflict with Prettier"
else
  ok "No active formatting rules in ESLint"
fi

# D: .editorconfig indent_size matches Prettier tabWidth
if [ -f ".editorconfig" ]; then
  EC_INDENT=$(grep -m1 'indent_size' .editorconfig | grep -o '[0-9]' || echo "?")
  if [ "$EC_INDENT" = "$TABWIDTH" ]; then
    ok ".editorconfig indent_size=$EC_INDENT matches Prettier tabWidth=$TABWIDTH"
  else
    fail ".editorconfig indent_size=$EC_INDENT ≠ Prettier tabWidth=$TABWIDTH"
  fi
  EC_EOL=$(grep -m1 'end_of_line' .editorconfig | grep -oE 'lf|crlf|cr' || echo "?")
  if [ "$EC_EOL" = "$EOL" ]; then
    ok ".editorconfig end_of_line=$EC_EOL matches Prettier endOfLine=$EOL"
  else
    fail ".editorconfig end_of_line=$EC_EOL ≠ Prettier endOfLine=$EOL"
  fi
else
  fail ".editorconfig missing"
fi

# E: VSCode delegates to Prettier
if [ -f ".vscode/settings.json" ]; then
  if grep -q "esbenp.prettier-vscode" .vscode/settings.json; then
    ok ".vscode/settings.json uses Prettier as default formatter"
  else
    fail ".vscode/settings.json does not set esbenp.prettier-vscode as defaultFormatter"
  fi
  if grep -q '"editor.formatOnSave": true' .vscode/settings.json; then
    ok ".vscode/settings.json has formatOnSave: true"
  else
    fail ".vscode/settings.json missing formatOnSave: true"
  fi
  if grep -q '"editor.detectIndentation": false' .vscode/settings.json; then
    ok ".vscode/settings.json has detectIndentation: false"
  else
    warn ".vscode/settings.json missing detectIndentation: false (VSCode may override indent)"
  fi
else
  fail ".vscode/settings.json missing"
fi

# F: lint-staged has prettier + eslint for TS
if [ -f "lint-staged.config.js" ]; then
  if grep -q "prettier --write" lint-staged.config.js &&
    grep -q "eslint --fix" lint-staged.config.js; then
    ok "lint-staged.config.js has both prettier --write and eslint --fix"
  else
    fail "lint-staged.config.js missing prettier --write or eslint --fix"
  fi
elif node -e "const p=require('./package.json'); process.exit(p['lint-staged']?0:1)" 2>/dev/null; then
  ok "lint-staged config found in package.json"
else
  fail "lint-staged config not found in lint-staged.config.js or package.json"
fi

# G: Husky pre-commit calls lint-staged
if [ -f ".husky/pre-commit" ]; then
  if grep -q "lint-staged" .husky/pre-commit; then
    ok ".husky/pre-commit calls lint-staged"
  else
    fail ".husky/pre-commit does not call lint-staged"
  fi
else
  fail ".husky/pre-commit hook missing"
fi

# H: .prettierignore covers generated directories
if [ -f ".prettierignore" ]; then
  REQUIRED=("**/generated/" ".next/" "dist/" "coverage/" "pnpm-lock.yaml")
  MISSING_IGNORES=()
  for entry in "${REQUIRED[@]}"; do
    grep -qF "$entry" .prettierignore || MISSING_IGNORES+=("$entry")
  done
  if [ ${#MISSING_IGNORES[@]} -eq 0 ]; then
    ok ".prettierignore covers all generated/build directories"
  else
    fail ".prettierignore missing entries: ${MISSING_IGNORES[*]}"
  fi
else
  fail ".prettierignore missing"
fi

# I: sonar-project.properties exists and has required keys
if [ -f "sonar-project.properties" ]; then
  REQUIRED_SONAR_KEYS=(
    "sonar.projectKey"
    "sonar.sources"
    "sonar.exclusions"
    "sonar.javascript.lcov.reportPaths"
  )
  MISSING_SONAR=()
  for key in "${REQUIRED_SONAR_KEYS[@]}"; do
    grep -q "^${key}=" sonar-project.properties || MISSING_SONAR+=("$key")
  done
  if [ ${#MISSING_SONAR[@]} -eq 0 ]; then
    ok "sonar-project.properties present with required keys"
  else
    fail "sonar-project.properties missing keys: ${MISSING_SONAR[*]}"
  fi
else
  fail "sonar-project.properties missing"
fi

# J: .snyk exists
if [ -f ".snyk" ]; then
  ok ".snyk policy file present"
else
  fail ".snyk policy file missing"
fi

# K: jest-junit reporter configured (required for Sonar test results)
if grep -r "jest-junit" apps/api/jest.config.* apps/web/jest.config.* \
  jest.config.* 2>/dev/null | grep -q "jest-junit"; then
  ok "jest-junit reporter configured (SonarQube test execution reports)"
else
  fail "jest-junit reporter not configured — SonarQube will not show test results"
fi

# L: lcov coverage reporter configured
if grep -r "lcov" apps/api/jest.config.* apps/web/jest.config.* \
  jest.config.* 2>/dev/null | grep -q "lcov"; then
  ok "lcov coverage reporter configured (SonarQube coverage)"
else
  fail "lcov not in coverageReporters — SonarQube will not show coverage"
fi

# Summary
echo ""
echo -e "Passed: ${GREEN}$PASS${NC}  Failed: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✅ All formatter checks passed.${NC}"
  echo -e "   Run 'pnpm format:check' to verify no files need formatting."
  exit 0
else
  echo -e "${RED}❌ $FAIL check(s) failed.${NC}"
  echo -e "   Run '/setup-formatters' to fix automatically."
  exit 1
fi
