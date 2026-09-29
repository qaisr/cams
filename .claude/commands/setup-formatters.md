---
description: >
  Verify and fix the full formatter sync setup — Prettier owns formatting,
  ESLint owns quality, VSCode delegates to Prettier on save. Checks all
  config files for conflicts and fixes them. Idempotent — safe to re-run.
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---
# /setup-formatters

## Purpose

Ensure every formatting tool in the stack agrees on the same rules.
After this command completes, a file formatted by VSCode on save will be
identical to one formatted by Prettier CLI, lint-staged, or CI.

```
Prettier       → ALL formatting (indent, quotes, semi, line width)
ESLint         → ALL quality/logic rules (zero formatting rules)
EditorConfig   → IDE baseline fallback (same values as Prettier)
VSCode         → delegates to Prettier on save (never its own formatter)
lint-staged    → runs same Prettier + ESLint on staged files only
```

---

## Process

### Step 1: Read Context

Read the following files if they exist (do not fail if missing — they may need
to be created):
- `package.json` (root)
- `.prettierrc.json`
- `.prettierignore`
- `.editorconfig`
- `eslint.config.mjs` (or `.eslintrc.json` if flat config not yet in use)
- `lint-staged.config.js` (or `lint-staged` key in `package.json`)
- `.vscode/settings.json`
- `.vscode/extensions.json`
- `scripts/check-formatting-sync.sh`

Read `@.claude/standards/typescript-formatting-standards.md`.

---

### Step 2: Audit Current State

Run each check below. Record PASS / FAIL / MISSING for each.
Do not stop on first failure — collect all issues before fixing.

#### Check A — Required packages installed

```bash
node -e "
const pkg = require('./package.json');
const allDeps = {
  ...pkg.dependencies,
  ...pkg.devDependencies,
  ...pkg.peerDependencies
};
const required = [
  'prettier',
  'eslint',
  'eslint-config-prettier',
  'typescript-eslint',
  '@eslint/js',
  'eslint-plugin-import',
  'eslint-plugin-security',
  'eslint-plugin-unicorn',
  'husky',
  'lint-staged',
];
const missing = required.filter(p => !allDeps[p]);
if (missing.length) {
  console.log('MISSING_PACKAGES:' + missing.join(','));
  process.exit(1);
}
console.log('PASS: all required packages present');
"
```

#### Check B — No formatting rules in ESLint config

```bash
# Formatting rules that conflict with Prettier
# Any of these set to 'error' or 'warn' is a conflict
node -e "
const { execSync } = require('child_process');
const target = 'apps/api/src/app.module.ts';
let config;
try {
  config = JSON.parse(
    execSync('npx eslint --print-config ' + target + ' 2>/dev/null').toString()
  );
} catch {
  console.log('SKIP: cannot read ESLint config (file may not exist yet)');
  process.exit(0);
}
const conflictingRules = [
  'indent', '@typescript-eslint/indent',
  'quotes', '@typescript-eslint/quotes',
  'semi', '@typescript-eslint/semi',
  'comma-dangle', '@typescript-eslint/comma-dangle',
  'max-len', 'object-curly-spacing',
  'space-before-function-paren', 'arrow-spacing',
  'key-spacing', 'space-infix-ops',
  'no-trailing-spaces', 'eol-last',
];
const active = conflictingRules.filter(r => {
  const rule = config.rules?.[r];
  return Array.isArray(rule) ? rule[0] !== 'off' && rule[0] !== 0
       : rule !== 'off' && rule !== 0 && rule !== undefined;
});
if (active.length) {
  console.log('CONFLICT_RULES:' + active.join(','));
  process.exit(1);
}
console.log('PASS: no formatting rules in ESLint');
"
```

#### Check C — eslint-config-prettier is last in ESLint config

```bash
node -e "
const fs = require('fs');
const path = require('path');
const configFile = ['eslint.config.mjs', 'eslint.config.js', '.eslintrc.json', '.eslintrc.js']
  .find(f => fs.existsSync(path.join(process.cwd(), f)));
if (!configFile) {
  console.log('MISSING: no ESLint config file found');
  process.exit(1);
}
const content = fs.readFileSync(configFile, 'utf8');
const hasPrettier = content.includes('eslint-config-prettier') || content.includes('prettier');
if (!hasPrettier) {
  console.log('MISSING_PRETTIER_DISABLE: eslint-config-prettier not found in ESLint config');
  process.exit(1);
}
// Check it appears after typescript-eslint (rough positional check)
const prettierPos = content.lastIndexOf('prettier');
const tseslintPos = content.lastIndexOf('tseslint') || content.lastIndexOf('typescript-eslint');
if (tseslintPos > 0 && prettierPos < tseslintPos) {
  console.log('ORDER_WRONG: prettier must be last entry in ESLint config');
  process.exit(1);
}
console.log('PASS: eslint-config-prettier present and positioned last');
"
```

#### Check D — Prettier config exists and is valid

```bash
node -e "
const fs = require('fs');
const configs = ['.prettierrc.json', '.prettierrc', '.prettierrc.js', 'prettier.config.js'];
const found = configs.find(f => fs.existsSync(f));
if (!found) {
  console.log('MISSING: no Prettier config file found');
  process.exit(1);
}
try {
  const config = JSON.parse(fs.readFileSync('.prettierrc.json', 'utf8'));
  const required = { printWidth: 100, tabWidth: 2, singleQuote: true, endOfLine: 'lf' };
  const wrong = Object.entries(required)
    .filter(([k, v]) => config[k] !== v)
    .map(([k, v]) => k + ' should be ' + JSON.stringify(v) + ' got ' + JSON.stringify(config[k]));
  if (wrong.length) {
    console.log('CONFIG_MISMATCH:' + wrong.join(' | '));
    process.exit(1);
  }
  console.log('PASS: .prettierrc.json valid');
} catch(e) {
  console.log('INVALID_JSON: .prettierrc.json — ' + e.message);
  process.exit(1);
}
"
```

#### Check E — EditorConfig values match Prettier

```bash
node -e "
const fs = require('fs');
if (!fs.existsSync('.editorconfig')) {
  console.log('MISSING: .editorconfig not found');
  process.exit(1);
}
const content = fs.readFileSync('.editorconfig', 'utf8');
const prettier = JSON.parse(fs.readFileSync('.prettierrc.json', 'utf8'));
const checks = [
  { editorKey: 'indent_size',          prettierKey: 'tabWidth',    expected: String(prettier.tabWidth ?? 2) },
  { editorKey: 'end_of_line',          prettierKey: 'endOfLine',   expected: prettier.endOfLine ?? 'lf' },
  { editorKey: 'insert_final_newline', prettierKey: null,          expected: 'true' },
  { editorKey: 'trim_trailing_whitespace', prettierKey: null,      expected: 'true' },
];
const mismatches = checks.filter(({ editorKey, expected }) => {
  const match = content.match(new RegExp(editorKey + '\\s*=\\s*(\\S+)'));
  return match && match[1].toLowerCase() !== expected.toLowerCase();
});
if (mismatches.length) {
  console.log('EDITORCONFIG_MISMATCH:' + mismatches.map(m => m.editorKey).join(','));
  process.exit(1);
}
console.log('PASS: .editorconfig in sync with .prettierrc.json');
"
```

#### Check F — VSCode settings delegate to Prettier

```bash
node -e "
const fs = require('fs');
if (!fs.existsSync('.vscode/settings.json')) {
  console.log('MISSING: .vscode/settings.json not found');
  process.exit(1);
}
const settings = JSON.parse(fs.readFileSync('.vscode/settings.json', 'utf8'));
const issues = [];
if (settings['editor.defaultFormatter'] !== 'esbenp.prettier-vscode')
  issues.push('editor.defaultFormatter must be esbenp.prettier-vscode');
if (settings['editor.formatOnSave'] !== true)
  issues.push('editor.formatOnSave must be true');
if (settings['editor.detectIndentation'] !== false)
  issues.push('editor.detectIndentation must be false (Prettier controls this)');
if (settings['files.eol'] !== '\n')
  issues.push('files.eol must be \\n (LF)');
const tsFormatter = settings['[typescript]']?.['editor.defaultFormatter'];
if (tsFormatter && tsFormatter !== 'esbenp.prettier-vscode')
  issues.push('[typescript].editor.defaultFormatter must be esbenp.prettier-vscode');
if (issues.length) {
  console.log('VSCODE_ISSUES:' + issues.join(' | '));
  process.exit(1);
}
console.log('PASS: .vscode/settings.json delegates to Prettier');
"
```

#### Check G — lint-staged runs Prettier then ESLint on TS files

```bash
node -e "
const fs = require('fs');
let config;
// Check lint-staged.config.js first, then package.json
if (fs.existsSync('lint-staged.config.js')) {
  // Basic string check — avoid executing arbitrary JS
  const content = fs.readFileSync('lint-staged.config.js', 'utf8');
  const hasPrettier = content.includes('prettier --write');
  const hasEslint   = content.includes('eslint --fix');
  if (!hasPrettier || !hasEslint) {
    console.log('LINT_STAGED_MISSING: must include eslint --fix and prettier --write for TS files');
    process.exit(1);
  }
} else {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const ls = pkg['lint-staged'];
  if (!ls) {
    console.log('MISSING: lint-staged config not found in lint-staged.config.js or package.json');
    process.exit(1);
  }
  const tsConfig = ls['*.{ts,tsx}'] || ls['*.ts'];
  if (!tsConfig) {
    console.log('LINT_STAGED_NO_TS: no lint-staged config for *.ts/*.tsx files');
    process.exit(1);
  }
  const commands = Array.isArray(tsConfig) ? tsConfig : [tsConfig];
  if (!commands.some(c => c.includes('prettier')))
    { console.log('LINT_STAGED_NO_PRETTIER: prettier --write missing from TS staged config'); process.exit(1); }
  if (!commands.some(c => c.includes('eslint')))
    { console.log('LINT_STAGED_NO_ESLINT: eslint --fix missing from TS staged config'); process.exit(1); }
}
console.log('PASS: lint-staged configured correctly');
"
```

#### Check H — Husky hooks exist and call lint-staged

```bash
node -e "
const fs = require('fs');
const hooks = ['.husky/pre-commit'];
hooks.forEach(hook => {
  if (!fs.existsSync(hook)) {
    console.log('MISSING_HOOK:' + hook);
    process.exit(1);
  }
  const content = fs.readFileSync(hook, 'utf8');
  if (!content.includes('lint-staged')) {
    console.log('HOOK_MISSING_LINT_STAGED:' + hook + ' must call lint-staged');
    process.exit(1);
  }
});
console.log('PASS: Husky pre-commit hook calls lint-staged');
"
```

#### Check I — .prettierignore excludes generated directories

```bash
node -e "
const fs = require('fs');
if (!fs.existsSync('.prettierignore')) {
  console.log('MISSING: .prettierignore not found');
  process.exit(1);
}
const content = fs.readFileSync('.prettierignore', 'utf8');
const required = ['**/generated/', 'prisma/migrations', '.next/', 'dist/', 'coverage/'];
const missing = required.filter(r => !content.includes(r));
if (missing.length) {
  console.log('PRETTIERIGNORE_MISSING:' + missing.join(','));
  process.exit(1);
}
console.log('PASS: .prettierignore excludes all generated directories');
"
```

#### Check J — sonar-project.properties

```bash
node -e "
const fs = require('fs');
if (!fs.existsSync('sonar-project.properties')) {
  console.log('MISSING: sonar-project.properties not found');
  process.exit(1);
}
const content = fs.readFileSync('sonar-project.properties', 'utf8');
const required = [
  'sonar.projectKey',
  'sonar.sources',
  'sonar.exclusions',
  'sonar.javascript.lcov.reportPaths',
  'sonar.typescript.tsconfigPaths',
];
const missing = required.filter(k => !content.includes(k + '='));
if (missing.length) {
  console.log('SONAR_MISSING_KEYS:' + missing.join(','));
  process.exit(1);
}
console.log('PASS: sonar-project.properties valid');
"
```

### Check K — .snyk policy file

```bash
node -e "
const fs = require('fs');
if (!fs.existsSync('.snyk')) {
  console.log('MISSING: .snyk policy file not found');
  process.exit(1);
}
console.log('PASS: .snyk policy file present');
"
```

### Check L — jest reporters configured for Sonar

```bash
node -e "
const fs = require('fs');
const configFiles = [
  'jest.config.ts', 'jest.config.js',
  'apps/api/jest.config.ts', 'apps/web/jest.config.ts'
].filter(f => fs.existsSync(f));
if (!configFiles.length) {
  console.log('MISSING: no jest config files found');
  process.exit(1);
}
const hasLcov    = configFiles.some(f => fs.readFileSync(f,'utf8').includes('lcov'));
const hasJunit   = configFiles.some(f => fs.readFileSync(f,'utf8').includes('jest-junit'));
if (!hasLcov)  console.log('MISSING_LCOV: lcov not in coverageReporters (required for SonarQube)');
if (!hasJunit) console.log('MISSING_JUNIT: jest-junit not configured (required for SonarQube test results)');
if (!hasLcov || !hasJunit) process.exit(1);
console.log('PASS: jest reporters configured for SonarQube');
"
```

---

#### Check M — Gitleaks available (pre-commit secret detection)

```bash
command -v gitleaks >/dev/null 2>&1 \
  && echo "PASS: gitleaks installed" \
  || echo "MISSING: gitleaks not installed — fallback grep used in pre-commit. Install: brew install gitleaks"
```

#### Check N — pre-push calls pnpm audit

```bash
node -e "
const fs = require('fs');
if (!fs.existsSync('.husky/pre-push')) {
  console.log('MISSING: .husky/pre-push not found');
  process.exit(1);
}
const content = fs.readFileSync('.husky/pre-push', 'utf8');
if (!content.includes('pnpm audit')) {
  console.log('MISSING_AUDIT: .husky/pre-push does not run pnpm audit');
  process.exit(1);
}
console.log('PASS: pre-push runs pnpm audit');
"
```

#### Check O — SonarQube not in Husky hooks (anti-pattern check)

```bash
node -e "
const fs = require('fs');
const hooks = ['.husky/pre-commit', '.husky/pre-push'];
const violations = hooks.filter(h => {
  if (!fs.existsSync(h)) return false;
  const c = fs.readFileSync(h, 'utf8');
  return c.includes('sonar') || c.includes('sonarqube');
});
if (violations.length) {
  console.log('ANTI_PATTERN: SonarQube found in Husky hooks: ' + violations.join(', '));
  console.log('  SonarQube must only run in CI (requires server + coverage + PR context)');
  process.exit(1);
}
console.log('PASS: SonarQube correctly absent from Husky hooks');
"
```

---

### Step 3: Report Audit Results

Display a summary table before making any changes:

```
## Formatter Sync Audit

| Check | Status | Issue |
|---|---|---|
| A: Required packages    | ✅ PASS / ❌ FAIL / ⚠️ MISSING | details |
| B: No ESLint format rules | ✅ / ❌ | details |
| C: prettier last in ESLint | ✅ / ❌ | details |
| D: Prettier config valid  | ✅ / ❌ | details |
| E: EditorConfig in sync   | ✅ / ❌ | details |
| F: VSCode delegates Prettier | ✅ / ❌ | details |
| G: lint-staged config     | ✅ / ❌ | details |
| H: Husky hooks            | ✅ / ❌ | details |
| I: .prettierignore        | ✅ / ❌ | details |
```

If ALL checks pass:
```
✅ All formatter checks passed — nothing to do.
Run 'pnpm format:check' to verify no files need formatting.
```
Stop here.

If any checks FAIL or MISSING — proceed to Step 4.

---

### Step 4: Confirm Before Fixing

Present the list of fixes that will be applied and ask for confirmation:

```
The following fixes will be applied:

1. [A] Install missing packages: prettier, eslint-config-prettier
2. [B] Remove formatting rules from eslint.config.mjs: indent, quotes
3. [C] Add prettier as last entry in eslint.config.mjs
4. [D] Create .prettierrc.json with standard config
5. [E] Update .editorconfig indent_size to match Prettier tabWidth (2)
6. [F] Update .vscode/settings.json to delegate formatting to Prettier
7. [G] Create lint-staged.config.js with correct TS config
8. [H] Create .husky/pre-commit calling lint-staged
9. [I] Add generated/ to .prettierignore

Proceed with fixes? [Y/n]
```

Wait for confirmation. If declined, show the manual fix instructions and stop.

---

### Step 5: Apply Fixes

Apply only the fixes for failed/missing checks.

#### Fix A — Install missing packages

```bash
pnpm add -D \
  prettier \
  eslint \
  eslint-config-prettier \
  typescript-eslint \
  @eslint/js \
  eslint-plugin-import \
  eslint-plugin-security \
  eslint-plugin-unicorn \
  husky \
  lint-staged
```

#### Fix B — Remove formatting rules from ESLint config

If `eslint.config.mjs` exists, remove or disable any of these rules:
`indent`, `@typescript-eslint/indent`, `quotes`, `@typescript-eslint/quotes`,
`semi`, `@typescript-eslint/semi`, `comma-dangle`, `max-len`,
`object-curly-spacing`, `space-before-function-paren`, `arrow-spacing`,
`key-spacing`, `space-infix-ops`, `no-trailing-spaces`, `eol-last`

Set each found rule to `'off'` rather than deleting (easier to audit):
```javascript
// DISABLED — Prettier handles this
'indent': 'off',
'quotes': 'off',
```

#### Fix C — Add eslint-config-prettier as last entry

If `eslint.config.mjs` does not end with `prettier`:
```javascript
// Append to end of config array
import prettier from 'eslint-config-prettier';
// ...
export default tseslint.config(
  // ... existing config ...
  prettier,   // ← MUST be last
);
```

#### Fix D — Create/update `.prettierrc.json`

Write the canonical config (only if missing or values are wrong):
```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "quoteProps": "as-needed",
  "jsxSingleQuote": false,
  "trailingComma": "all",
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always",
  "endOfLine": "lf",
  "embeddedLanguageFormatting": "auto",
  "overrides": [
    { "files": "*.json",   "options": { "printWidth": 80, "trailingComma": "none" } },
    { "files": "*.yaml",   "options": { "singleQuote": false, "printWidth": 120 } },
    { "files": "*.md",     "options": { "printWidth": 80, "proseWrap": "always" } },
    { "files": "*.prisma", "options": { "printWidth": 120 } }
  ]
}
```

#### Fix E — Sync `.editorconfig` with Prettier

Update only the mismatched values. Do not rewrite the whole file.
Target values (must match Prettier):
```ini
indent_style = space
indent_size = 2              # matches tabWidth
end_of_line = lf             # matches endOfLine
insert_final_newline = true
trim_trailing_whitespace = true
```

#### Fix F — Create/update `.vscode/settings.json`

Create `.vscode/` directory if missing.
Write/merge these keys (preserve any existing keys not in conflict):
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.detectIndentation": false,
  "files.eol": "\n",
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.rulers": [100],
  "eslint.useFlatConfig": true,
  "eslint.enable": true,
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "never"
  },
  "[typescript]":      { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[typescriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[javascript]":      { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[json]":            { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[yaml]":            { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[markdown]":        { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[prisma]":          { "editor.defaultFormatter": "Prisma.prisma" }
}
```

Also create `.vscode/extensions.json` if missing:
```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "EditorConfig.EditorConfig",
    "Prisma.prisma",
    "Orta.vscode-jest",
    "ms-playwright.playwright"
  ],
  "unwantedRecommendations": [
    "HookyQR.beautify"
  ]
}
```

#### Fix G — Create `lint-staged.config.js`

```javascript
export default {
  '*.{ts,tsx}': [
    'eslint --fix --max-warnings=0',
    'prettier --write',
  ],
  '*.{js,mjs,cjs}': [
    'eslint --fix --max-warnings=0',
    'prettier --write',
  ],
  '*.{json,jsonc}':  ['prettier --write'],
  '*.{md,mdx}':      ['prettier --write'],
  '*.{yaml,yml}':    ['prettier --write'],
  '*.css':           ['prettier --write'],
  'prisma/schema.prisma': ['prisma format'],
};
```

If `lint-staged` is currently configured in `package.json`, migrate it to
`lint-staged.config.js` and remove the `lint-staged` key from `package.json`.

#### Fix H — Create/fix Husky hooks

```bash
# Initialise Husky if not already done
pnpm exec husky init
```

Write `.husky/pre-commit`:
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
pnpm exec lint-staged
```

Write `.husky/commit-msg`:
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
pnpm exec commitlint --edit "$1"
```

Make hooks executable:
```bash
chmod +x .husky/pre-commit .husky/commit-msg
```

Ensure `prepare` script exists in root `package.json`:
```json
{ "scripts": { "prepare": "husky" } }
```

#### Fix I — Add missing entries to `.prettierignore`

Append any missing entries:
```
**/generated/
packages/database/generated/
apps/web/src/hooks/generated/
apps/web/src/mocks/generated/
apps/web/src/types/generated/
packages/database/prisma/migrations/
.next/
dist/
coverage/
.turbo/
pnpm-lock.yaml
cdk.out/
```

---

### Step 6: Write Sync Verification Script

Create or overwrite `scripts/check-formatting-sync.sh`
(used by CI and this command's Step 2):

```bash
#!/usr/bin/env bash
# scripts/check-formatting-sync.sh
# Verify Prettier owns formatting, ESLint owns quality — no overlap
# Usage: bash scripts/check-formatting-sync.sh
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'
PASS=0; FAIL=0

ok()   { echo -e "${GREEN}✅ PASS${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}❌ FAIL${NC} $1"; FAIL=$((FAIL+1)); }
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
  TABWIDTH=2; EOL="lf"
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
  if grep -q "prettier --write" lint-staged.config.js && \
     grep -q "eslint --fix"    lint-staged.config.js; then
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
```

```bash
chmod +x scripts/check-formatting-sync.sh
```

---

### Step 7: Re-run Audit

After all fixes are applied, re-run all checks from Step 2:

```bash
bash scripts/check-formatting-sync.sh
```

All checks must pass before proceeding.

---

### Step 8: Format Existing Codebase

Run Prettier across all existing files to bring them into sync
(skips generated files and lockfiles via `.prettierignore`):

```bash
pnpm format
```

Then run ESLint fix pass:

```bash
pnpm lint:fix
```

Report the number of files changed. If zero files changed, the codebase
was already in sync.

---

### Step 9: Verify Final State

```bash
# Prettier — no files need reformatting
pnpm format:check

# ESLint — no violations
pnpm lint

# TypeScript — no type errors introduced by formatting changes
pnpm type-check
```

All three must pass with zero errors.

---

### Step 10: Summary Report

```
## /setup-formatters Complete

### Checks
| Check | Before | After |
|---|---|---|
| A: Required packages     | ❌/✅ | ✅ |
| B: No ESLint format rules | ❌/✅ | ✅ |
| C: prettier last in ESLint | ❌/✅ | ✅ |
| D: Prettier config        | ❌/✅ | ✅ |
| E: EditorConfig in sync   | ❌/✅ | ✅ |
| F: VSCode delegates Prettier | ❌/✅ | ✅ |
| G: lint-staged config     | ❌/✅ | ✅ |
| H: Husky hooks            | ❌/✅ | ✅ |
| I: .prettierignore        | ❌/✅ | ✅ |

### Files Changed
- Created:  [list any created files]
- Updated:  [list any updated files]
- Formatted: X files reformatted by pnpm format

### Rule of Responsibility (now enforced)
Prettier  → formatting (indent, quotes, semi, line width, EOL)
ESLint    → quality (no-unused-vars, import order, security, types)
VSCode    → delegates to Prettier on save
Husky     → runs lint-staged (ESLint fix + Prettier write) on commit

### Next Steps
1. Restart VSCode to pick up .vscode/settings.json changes
2. Install recommended extensions: Ctrl+Shift+P → 'Show Recommended Extensions'
3. Commit the config changes:
   git add .prettierrc.json .editorconfig eslint.config.mjs \
           .vscode/ lint-staged.config.js scripts/check-formatting-sync.sh
   git commit -m "chore: sync formatter configuration"
```

---

## Cross-References

- Formatting standards: `@.claude/standards/typescript-formatting-standards.md`
- Pre-commit hooks: `.husky/pre-commit`
- CI quality gate: `.github/workflows/ci.yml`
- Verify script: `scripts/check-formatting-sync.sh`
