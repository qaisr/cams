---
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# Smart Commit Command

<!-- cSpell:ignore recieve authroized -->
<!-- The above are intentional misspellings used as spell-check EXAMPLES below. -->

## Context
You are helping the user create a git commit with the following intelligent workflow:

## Workflow

**Note**: This is a 10-step intelligent commit workflow that handles everything from staging to pushing.

1. **Check staged files**
   - Run `git status --porcelain` to check what's staged (lines starting with `A`, `M`, `D`, etc. in the index column)
   - If nothing is staged:
     - Run `git status --porcelain` to check for unstaged changes
     - If there are unstaged changes, ask the user if they want to:
       - Stage all changes (`git add .`)
       - Stage specific files (let them specify)
       - Cancel the commit
     - If no changes at all, inform the user and exit

2. **Analyze staged changes**
   - Run `git diff --cached --stat` to see high-level stats
   - Run `git diff --cached` to see detailed changes (limit output if too large)
   - Categorize the changes:
     - New features
     - Bug fixes
     - Refactoring
     - Documentation
     - Configuration/Infrastructure
     - Tests
     - Dependencies
     - Code quality/formatting

3. **Spell-check staged files (cSpell)**
   - Run cSpell against staged, spell-checkable files only (`.md`, `.mdx`, `.ts`,
     `.tsx`, `.js`, `.mjs`). Derive the list from the staged set:
     ```bash
     STAGED_SPELL=$(git diff --cached --name-only --diff-filter=ACM \
       | grep -Ei '\.(md|mdx|ts|tsx|js|mjs)$')
     [ -n "$STAGED_SPELL" ] && pnpm exec cspell --no-progress --no-must-find-files $STAGED_SPELL
     ```
   - If no spell-checkable files are staged, skip this step silently.
   - If cSpell reports **zero** unknown words, continue to step 4.
   - If cSpell reports unknown words:
     - Collect the unique unknown words (the `Unknown word (…)` entries) and show
       them to the user grouped by file, with the `file:line` reference for each.
     - For each unknown word, make a quick judgement call to help the user decide:
       - **Likely a real misspelling** (e.g. `recieve`, `authroized`) → recommend fixing.
       - **Likely a valid domain/tech term** (acronyms, product names, library
         scopes, British/AU spellings already covered by the dictionaries should
         NOT appear here — if they do, the dictionaries may be misconfigured) →
         recommend adding to the word list.
     - Use the **AskUserQuestion** tool to ask how to resolve them. Offer, per the
       situation:
       1. **Add to `.cspell/project-words.txt`** — treat the flagged words as valid
          project vocabulary. Append them (one per line, into the most fitting
          section, alphabetised) and re-run cSpell to confirm they clear. Re-stage
          `.cspell/project-words.txt` so the additions are part of THIS commit.
       2. **Fix the spelling** — correct the misspelled words in the source files,
          re-stage the fixed files, and re-run cSpell to confirm.
       3. **Mixed** — some words fixed, some added to the word list. Apply both,
          re-stage all affected files, re-run cSpell.
       4. **Ignore for this commit** — proceed without changes (note: the
          `lint-staged` pre-commit hook also runs cSpell and WILL block the commit
          on the same words, so this only makes sense if the user intends to use
          `--no-verify` — warn them explicitly).
     - Never add a word to `.cspell/project-words.txt` or edit source spelling
       without user consent — always ask first via AskUserQuestion.
     - After resolution, confirm cSpell passes on the staged set before moving on.

4. **Generate commit message**
   - Based on the analysis, generate a clear, conventional commit message:
     - Format: `<type>(<scope>): <subject>`
     - Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`, `ci`
     - Keep subject line under 72 characters
     - Add body if needed to explain "why" (not "what")
   - Present the suggested message to the user
   - Ask if they want to:
     - Use the suggested message
     - Modify it
     - Provide their own message

5. **Attempt commit**
   - Run `git commit -m "<message>"`
   - If successful, show the commit hash and exit

6. **Handle husky/pre-commit failures**
   - If the commit fails, analyze the error output
   - Common issues to detect and fix:
     - **cSpell unknown words**: The `lint-staged` hook runs cSpell on staged
       `.md/.mdx/.ts/.tsx` files. If it fails, apply the same resolution flow as
       step 3 — show the unknown words, then use AskUserQuestion to offer: (a) add
       to `.cspell/project-words.txt`, (b) fix the spelling, or (c) both. Re-stage
       the affected files (including `.cspell/project-words.txt` if edited) and
       retry the commit.
     - **ESLint errors**: Show the errors, offer to run `pnpm lint:fix`
     - **Prettier formatting**: Offer to run `prettier --write` on affected files
     - **Type errors**: Show the errors, offer to run `pnpm type-check` to see details
     - **Test failures**: Show test output, suggest fixing tests
     - **API spec lint errors**: Show spectral errors, suggest fixes
     - **TypeScript formatting**: Offer to run pnpm format
     - **Large commits timing out**: If lint-staged times out on 100+ files, offer `--no-verify` option
     - **Missing configuration files**: If ESLint/Prettier can't find config, offer to create minimal config
     - **OpenAPI $ref errors**: Parse spectral output to identify broken references, offer to fix them
   - After fixing, re-stage affected files and retry commit
   - Maximum 3 retry attempts
   - If all retries fail, offer `--no-verify` as last resort (explain consequences)

7. **Handle large infrastructure commits**
   - If commit has 50+ files OR includes infrastructure/config changes:
     - Warn that pre-commit hooks may take time or fail
     - Offer options:
       1. Try commit normally (may timeout)
       2. Use `--no-verify` for this commit only (recommended for infrastructure setup)
       3. Split into smaller commits
   - If using `--no-verify`, add note to commit message explaining why
   - Example: "Note: Committed with --no-verify due to large infrastructure setup. Quality gates will apply to all future commits."

8. **Handle merge conflicts**
   - If `git status` shows conflicts (lines with "UU", "AA", "DD", etc.)
   - List conflicted files
   - Offer to:
     - Show conflicts in each file
     - Help resolve conflicts interactively
     - Abort the commit and let user resolve manually

9. **Ask about pushing to remote**
   - After successful commit, check remote status:
     - Run `git remote -v` to verify remote exists
     - Run `git rev-parse --abbrev-ref HEAD` to get current branch name
     - Run `git rev-list --count @{u}..HEAD 2>/dev/null || echo "0"` to check commits ahead
     - Run `git status -sb` to see tracking status
   - If remote exists, ask user:
     - "Your commit was successful! Would you like to push to remote?"
     - Options:
       1. **Push normally** - `git push` (or `git push -u origin <branch>` if not tracking)
       2. **Push with --force-with-lease** - Safely force push (recommended over --force)
       3. **Skip push** - Stay local for now
   - Handle push results:
     - If successful: Show pushed commit hash and remote branch
     - If rejected (behind remote): Offer to pull with rebase (`git pull --rebase`) then retry
     - If branch doesn't exist on remote: Confirm creating new remote branch
     - If failed: Show error and suggest troubleshooting steps
   - If the pre-push output shows Snyk / `pnpm audit` / Dependabot warnings, do
     NOT ignore them — point the user to `/health-scan` to triage dependency and
     tooling health deliberately (those heavy scans are intentionally skipped by
     the fast hooks).

10. **Final confirmation**
   - After commit (and optional push), show:
     - Commit hash
     - Short summary of what was committed
     - Number of files changed, insertions, deletions
     - Push status (if pushed: branch and remote, if not: "Changes not pushed")
     - If any issues were auto-fixed, mention them
     - Suggest next steps (e.g., continue working, create PR, run tests)

## Important Rules

- **Never force commit** - Always respect pre-commit hooks unless user explicitly chooses to skip
- **Never force push with --force** - Always use --force-with-lease instead to prevent overwriting others' work
- **Never stage files without user consent** - Always ask first
- **Never push without user consent** - Always ask after successful commit
- **Never auto-fix without showing what will be fixed** - Transparency is key
- **Always explain errors in user-friendly terms** - Not just raw output
- **Respect the project's quality gates** - If tests fail, don't commit
- **Be helpful but safe** - Suggest fixes but let user decide
- **Track retry attempts** - Stop after 3 failed attempts to prevent infinite loops
- **Use --no-verify sparingly** - Only for infrastructure commits or after multiple failed fix attempts
- **Handle push failures gracefully** - Offer rebase, show errors, suggest fixes

## Error Recovery Strategies

### Git hooks not running / hooksPath corruption

**Symptom**: A commit or push fails with `sh: --version/_/pre-commit: invalid
option` (or a variant naming some other odd path), OR the hooks silently do not
run at all.

**Root cause**: `git config core.hooksPath` has been rewritten to a bad value.
This is most often caused by accidentally running `husky --version` (or
`npx husky --version` / `pnpm husky --version`) — husky's CLI treats the
argument as an install directory and rewrites `core.hooksPath` to it (e.g.
`--version/_`). A stray `./--version/` directory at the repo root is left behind
by the same accident.

**Fix**:
```bash
git config core.hooksPath .husky/_     # restore the correct wrapper dir
git config core.hooksPath              # verify: prints .husky/_
rm -rf './--version'                    # remove stray junk dir (check git status first)
```

**Prevention**: NEVER run `husky --version`. To check the husky version, read
`package.json` or run `pnpm why husky`. The `pre-commit` and `pre-push` hooks
now carry a fast hooksPath sanity check that warns if this drifts again.

### Husky v9→v10 deprecation

**Symptom**: On push (or commit), husky prints a deprecation warning such as
`husky - DEPRECATED ... please remove the following two lines`.

**Fix**: Open the offending hook file and delete the two v9 preamble lines:
```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
```
The migrated v10 format has NO shebang and NO sourcing line — the file starts
directly with its first comment/command. `pre-commit` and `commit-msg` are the
reference format to copy from. After editing, keep the file executable
(`chmod +x`) and confirm syntax with `sh -n .husky/<hook>`.

### OpenAPI $ref Errors (invalid-ref)
```bash
# Show the specific broken references
pnpm lint:api 2>&1 | grep "error"

# Example output:
# 1:1  error  invalid-ref  '#/users' does not exist

# Identify the issue:
# - The reference '#/users' is used in openapi.yaml
# - But the users.yaml file has 'users-list', 'users-create' instead of 'users'
# - Solution: Restructure users.yaml to group operations under '#/users' anchor

# Fix: Read the referenced file, restructure to match OpenAPI Path Item Object format:
# OLD:
# users-list:
#   operationId: listUsers
#   ...
#
# NEW:
# users:
#   get:
#     operationId: listUsers
#     ...
#   post:
#     operationId: createUser
#     ...
```

### Type-check Task Missing in Turbo
```bash
# Error: "could not find task `type-check` in project"

# Fix: Add type-check task to turbo.json
# Read turbo.json, add:
# "type-check": {
#   "outputs": []
# }
```

### ESLint Can't Find Config
```bash
# Error: "ESLint couldn't find a configuration file"

# For monorepos: Create minimal root .eslintrc.json that delegates to workspaces
# Only lint JS files at root, let workspaces handle TS
{
  "root": true,
  "ignorePatterns": ["node_modules/", "dist/", ".next/", "target/", "generated/", "*.d.ts"],
  "overrides": [
    {
      "files": ["*.js"],
      "extends": ["eslint:recommended"],
      "parserOptions": {
        "ecmaVersion": 2022,
        "sourceType": "module"
      }
    }
  ]
}
```

### Lint-staged Timing Out
```bash
# For large commits (100+ files):
# - ESLint, type-check, and spectral may timeout
# - Solution: Use --no-verify for this commit only
# - Add explanation to commit message
```

### cSpell Unknown Words
```bash
# The lint-staged pre-commit hook runs cSpell on staged .md/.mdx/.ts/.tsx files.
# It also runs standalone in commit step 3. Config: cspell.json + .cspell/project-words.txt

# Reproduce against the staged set:
STAGED_SPELL=$(git diff --cached --name-only --diff-filter=ACM \
  | grep -Ei '\.(md|mdx|ts|tsx|js|mjs)$')
pnpm exec cspell --no-progress --no-must-find-files $STAGED_SPELL

# Example output:
#   docs/spec.md:12:8 - Unknown word (recieve)
#   docs/spec.md:40:3 - Unknown word (idempotency)

# Decide per word, then ask the user (AskUserQuestion):
#  - Real typo (recieve)      → fix in source, re-stage the file
#  - Valid domain term        → append to .cspell/project-words.txt (alphabetised,
#    (idempotency)              in the fitting section), re-stage that file

# After either fix, confirm it clears and re-stage:
pnpm exec cspell --no-progress --no-must-find-files $STAGED_SPELL
git add <fixed-source-files> .cspell/project-words.txt

# GB/AU/US spellings (authorised / authorized) are already accepted by the
# dictionaries — if such a word is flagged, the dictionary config is broken,
# NOT the word. Investigate cspell.json rather than adding it to the word list.
```

### ESLint/Prettier Errors
```bash
# Show errors first
pnpm lint

# Offer to fix
pnpm lint:fix

# Re-stage fixed files
git add <fixed-files>

# Retry commit
```

### Type Errors
```bash
# Show detailed errors
pnpm type-check

# Explain the errors to user
# Offer to open problematic files
# Let user fix manually (type errors often need manual intervention)
```

### Test Failures
```bash
# Show which tests failed
pnpm test

# Explain the failures
# Suggest running tests in watch mode to fix
# Don't commit until tests pass
```

### API Spec Errors
```bash
# Show spectral lint errors
pnpm lint:api

# Explain the specific OpenAPI issues
# Offer to open the problematic spec files
# Suggest fixes based on error messages
```

### TypeScript/NestJS Formatting
```bash
# Run ESLint and Prettier fixes
pnpm turbo lint:fix
pnpm format

# Re-stage fixed files
git add -u

# Retry commit
```

## Examples

### Example 1: Nothing staged
```
User: /commit
Assistant:
I see you have unstaged changes in the following files:
- apps/web/src/components/Button.tsx
- apps/web/src/pages/index.tsx

Would you like to:
1. Stage all changes (git add .)
2. Stage specific files
3. Cancel
```

### Example 2: Successful commit with push
```
User: /commit
Assistant:
Analyzing staged changes...

Changes detected:
- 3 files modified in frontend/components
- 1 new test file added
- Type: Feature development (new Button component with tests)

Suggested commit message:
feat(ui): add accessible Button component with tests

Committed-By: John Smith <john.smith@company.com>

Would you like to:
1. Use this message
2. Modify it
3. Provide your own message

[User selects option 1]

✓ Commit successful: a1b2c3d
  3 files changed, 145 insertions(+), 12 deletions(-)

Your commit was successful! Would you like to push to remote?

Current branch: feature/button-component
Remote: origin (1 commit ahead)

1. Push normally (git push)
2. Push with --force-with-lease
3. Skip push

[User selects option 1]

✓ Pushed to origin/feature/button-component
  a1b2c3d feat(ui): add accessible Button component with tests

Summary:
- Committed and pushed 3 files
- 145 insertions, 12 deletions
- Branch: feature/button-component → origin/feature/button-component

Next steps:
- Run tests: pnpm test
- Create pull request
- Continue working
```

### Example 3: Husky pre-commit failure
```
User: /commit
Assistant:
Attempting commit...

✗ Pre-commit hook failed

ESLint errors found:
- apps/web/src/components/Button.tsx:15:3 - 'onClick' is missing in props validation
- apps/web/src/components/Button.tsx:22:10 - 'children' is already declared in the upper scope

Would you like me to:
1. Run 'pnpm lint:fix' to auto-fix what's possible
2. Show me the full errors
3. Cancel and let me fix manually

[User selects option 1]

Running pnpm lint:fix...
✓ Auto-fixed 1 error
✗ 1 error requires manual intervention

The remaining error needs manual fixing:
- Line 22: Rename the variable 'children' to avoid shadowing

Would you like me to:
1. Open the file to fix manually
2. Cancel commit
```

### Example 4: Spell-check finds unknown words
```
User: /commit
Assistant:
Analyzing staged changes... (2 markdown specs, 1 service file)

Spell-checking staged files with cSpell...

Found 3 unknown words:

specs/functional-specifications.md
  - line 42: "recieve"      → looks like a typo (should be "receive")
  - line 88: "idempotency"  → valid technical term
apps/api/src/orders/orders.service.ts
  - line 15: "CAMS"         → looks like a project/product name

How would you like to resolve these?
1. Fix the spelling (I'll correct "recieve" → "receive" and let you confirm the rest)
2. Add all to .cspell/project-words.txt (treat as valid vocabulary)
3. Mixed — fix "recieve", add "idempotency" and "CAMS" to the word list
4. Ignore for this commit (⚠️ the pre-commit hook runs cSpell too and will block
   unless you use --no-verify)

[User selects option 3]

✓ Fixed "recieve" → "receive" in specs/functional-specifications.md
✓ Added "idempotency" and "CAMS" to .cspell/project-words.txt
✓ Re-staged the corrected spec and .cspell/project-words.txt
✓ cSpell now passes on the staged set

Proceeding to commit...
```

### Example 5: Push rejected (behind remote)
```
User: /commit
Assistant:
✓ Commit successful: e4f5g6h
  2 files changed, 34 insertions(+), 8 deletions(-)

Your commit was successful! Would you like to push to remote?

Current branch: feature/api-updates
Remote: origin (1 commit ahead)

1. Push normally (git push)
2. Push with --force-with-lease
3. Skip push

[User selects option 1]

✗ Push rejected: Remote contains commits you don't have locally

Error: Updates were rejected because the remote contains work that you do not have locally.

Would you like to:
1. Pull with rebase (git pull --rebase) then retry push
2. View remote commits (git log origin/feature/api-updates ^HEAD)
3. Cancel and review manually

[User selects option 1]

Pulling with rebase...
✓ Rebased successfully (1 remote commit integrated)

Retrying push...
✓ Pushed to origin/feature/api-updates
  e4f5g6h feat(api): add validation middleware

Summary:
- Committed, rebased, and pushed 2 files
- Branch: feature/api-updates → origin/feature/api-updates
- 1 remote commit was integrated via rebase
```

## Implementation Notes

- Use `git status --porcelain` for parsing (it's machine-readable)
- Use `git diff --cached` for analyzing staged changes
- Use `git diff --cached --stat` for file count and change statistics
- Use `git remote -v` to check if remote exists
- Use `git rev-parse --abbrev-ref HEAD` to get current branch name
- Use `git rev-list --count @{u}..HEAD 2>/dev/null` to count commits ahead of remote
- Use `git status -sb` to see branch tracking status in short format
- Use `git config user.name` to get committer name for commit message attribution
- Use `git config user.email` to get committer email for commit message attribution
- Capture all command output to analyze errors
- Use pattern matching to detect specific error types (grep for "error", "invalid-ref", "could not find task", etc.)
- Keep retry count to prevent infinite loops (max 3 attempts for commit, max 2 for push)
- Always show progress and what's happening
- Use AskUserQuestion tool for user choices
- Parse lint-staged output to identify which linter failed (eslint, prettier, spectral, type-check)
- Count staged files early to detect large commits that may timeout
- Parse push errors to detect rejection reasons (behind remote, no tracking branch, etc.)

## Best Practices from Testing

1. **Detect large commits early**:
   - Count staged files: `git diff --cached --numstat | wc -l`
   - If > 50 files, warn about potential timeout
   - If > 100 files AND includes config/infrastructure, recommend --no-verify

2. **Parse pre-commit hook output intelligently**:
   - Look for `[FAILED]` markers from lint-staged
   - Extract actual error messages (after the ✖ symbol)
   - Identify which tool failed: eslint, prettier, spectral, type-check, mvn

3. **Fix errors in logical order**:
   - Missing config files (turbo.json, .eslintrc.json) - fix first
   - OpenAPI $ref errors - fix before retrying spectral
   - Auto-fixable issues (prettier, eslint --fix) - try first
   - Manual issues (type errors, test failures) - guide user

4. **Know when to give up gracefully**:
   - After 3 failed attempts, offer --no-verify
   - Explain that hooks will work for future commits
   - Add explanatory note to commit message

5. **Provide helpful error context**:
   - Don't just show raw error output
   - Explain what the error means in plain English
   - Show the fix, not just the problem
   - Give specific file:line references when available

## Commit Message Best Practices

- Use conventional commits format: `type(scope): subject`
- Keep subject line under 72 characters
- Use present tense ("add" not "added")
- Include bullet points for multi-part changes
- Add attribution at the end with committer info:
  1. First, get committer name and email:
     - Run `git config user.name` to get name
     - Run `git config user.email` to get email
  2. Then add attribution block:
  ```

  Committed-By: [Name] <email@example.com>
  ```
  3. If name/email are not available, omit the Committed-By line
- If using --no-verify, add explanation in commit body
