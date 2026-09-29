---
description: Update CHANGELOG.md following Keep a Changelog format
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# Update Changelog

## Input

$ARGUMENTS (release version or feature description)
Examples:

- `/changelog-update 1.2.0`
- `/changelog-update for order management feature`
- `/changelog-update from git log`

## Process

### Step 1: Read Current Changelog

```bash
!`cat CHANGELOG.md 2>/dev/null | head -60 || echo "No changelog yet"`
!`git log --oneline -20 2>/dev/null`
!`git log --oneline main..HEAD 2>/dev/null || git log --oneline -10`
```

### Step 2: Gather Changes

Read git log and categorise commits:

```bash
!`git log --pretty=format:"%s" main..HEAD 2>/dev/null || git log --pretty=format:"%s" -15`
```

Map commit messages to changelog categories:

```
feat(*):     → Added
fix(*):      → Fixed
refactor(*): → Changed
perf(*):     → Changed (performance)
docs(*):     → no changelog entry (internal)
test(*):     → no changelog entry (internal)
chore(*):    → no changelog entry (unless breaking)
BREAKING:    → Changed (mark clearly)
security:    → Security
deps(*):     → no entry unless CVE fix → Security
```

### Step 3: Generate Entry

Follow [Keep a Changelog](https://keepachangelog.com) format:

```markdown
## [{version}] - {YYYY-MM-DD}

### Added
- {New feature or capability — written for end users}
- {Another new feature}

### Changed
- {Changed behaviour — what changed and how it affects users}

### Fixed
- {Bug fix — what was broken and what it does now}

### Security
- {Security fix — describe without exposing vulnerability details}

### Deprecated
- {Feature marked for removal in future version}

### Removed
- {Removed feature}
```

**Writing style**:

- Write for users, not developers ("Users can now..." not "Added UserService.createUser()")
- Be specific about what changed
- Reference story IDs where relevant: `(US-042)`
- No implementation details (no class names, method names)

### Step 4: Update File

If `CHANGELOG.md` does not exist, create it:

```markdown
# Changelog

All notable changes to this project will be documented here.
Format: [Keep a Changelog](https://keepachangelog.com)
Versioning: [Semantic Versioning](https://semver.org)

## [Unreleased]
{placeholder for next release}

---

## [{version}] - {date}
{generated entry}
```

If exists, insert new entry after `## [Unreleased]` section.

### Step 5: Semantic Version Suggestion

If version not provided in $ARGUMENTS, suggest based on changes:

```
Based on changes found:
- Breaking changes: {Y/N}
- New features: {Y/N}
- Bug fixes only: {Y/N}

Suggested version: {X}.{Y}.{Z}
  (current: {current version from package.json or apps/api/package.json})

Breaking change → increment MAJOR (X)
New feature     → increment MINOR (Y)
Bug fix only    → increment PATCH (Z)
```

## Output

- Updated `CHANGELOG.md`
- Version suggestion printed to console

## Cross-References

- Technical docs: `/docs-technical`
- Deployment: `/deploy-prepare`
- ADRs: `.claude/docs/adr/`
