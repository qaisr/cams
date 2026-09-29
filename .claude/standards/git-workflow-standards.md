# Git Workflow Standards

## Overview
Branching strategy, commit conventions, PR workflow, and release process for this project.

## Branch Strategy

### Branch Types
```
main          → Production (protected, requires PR + CI green + 1 review)
staging       → Staging environment (auto-deploys on merge)
develop       → Integration branch (auto-deploys to dev)
│   ├── feature/*     → Feature branches (from develop)
│   ├── fix/*         → Bug fixes (from develop; or from main for hotfixes)
│   ├── chore/*       → Tooling, deps, config (from develop)
│   ├── hotfix/*      → Production hotfixes (from main, merge to main + develop)
│   └── release/*     → Release preparation (from develop)
```

### Branch Naming Convention
```bash
feature/TICKET-123-user-authentication
fix/TICKET-456-login-redirect-loop
chore/upgrade-nestjs-10-to-11
hotfix/TICKET-789-critical-data-leak
release/v1.2.0
```

## Commit Message Convention (Conventional Commits)

### Format
```
<type>(<scope>): <subject> [TICKET-123]

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring (no feature/fix)
- `perf`: Performance improvement
- `test`: Adding/updating tests
- `chore`: Build, config, dependencies
- `ci`: CI/CD changes

### Scopes
- `api`: Backend API
- `web`: Frontend
- `db`: Database
- `auth`: Authentication
- `infra`: Infrastructure
- `shared`: Shared packages
- `deps`: Dependencies

### Rules
- Subject: imperative mood, no period, max 72 chars
- Body: explain WHY, not WHAT (code shows what)
- Breaking changes: add `BREAKING CHANGE:` in footer

### Examples
```
feat(api): add document version history endpoint [DOC-101]

- Implement POST /documents/:id/versions
- Add Zod validation schema
- Integrate with EventBridge audit trail

Closes DOC-101

---

fix(web): resolve infinite re-render in UserList component [BUG-202]

Fixes re-render caused by unstable object reference in useEffect deps.

Fixes BUG-202

---

perf(db): add index on documents.created_at for pagination [PERF-303]

Add compound index on (created_at, id) to improve paginated
query performance from 500ms to 50ms.

Closes PERF-303

---

chore(deps): upgrade prisma from 5.6 to 5.8 [CHORE-404]
```

## Pre-Commit Hooks (Husky)

```bash
# .husky/pre-commit
- lint-staged (prettier + eslint on staged files)
- tsc --noEmit (type check)

# .husky/commit-msg
- commitlint (enforce conventional commits)

# .husky/pre-push
- turbo run test --filter=...[HEAD^1] (affected tests only)
- snyk test (security scan, warn-only on pre-push)
```

```json
// package.json — lint-staged config
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.prisma":   ["prisma format"]
  }
}
```

| Hook | Purpose | Actions |
|------|---------|---------|
| `pre-commit` | Code quality | Lint, format, type-check |
| `commit-msg` | Commit convention | Validate commit message format |
| `pre-push` | Test validation | Run affected tests, Snyk scan |

## Commit Signing (GPG)

```bash
# Configure Git to sign commits
git config --global user.signingkey YOUR_GPG_KEY_ID
git config --global commit.gpgsign true

# Verify signed commits
git log --show-signature
```

## Pull Request Standards

### PR Title Format
```
[TICKET-123] feat(api): Add document versioning
```

### PR Description Template
```markdown
## Summary
Brief description of what and why.

## Related Epic/Task
- Ticket: TICKET-123
- Task: [Link to epic task]

## Changes
- [ ] Backend: New endpoint `POST /documents/:id/versions`
- [ ] Database: New migration `add_document_versions_table`
- [ ] Frontend: Version history UI component
- [ ] Docs: Updated API documentation

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] E2E test added for critical path
- [ ] Manual testing completed

## Quality Gates
- [ ] No `console.log` left in code
- [ ] No hardcoded secrets/URLs
- [ ] OpenAPI spec updated (`pnpm generate`)
- [ ] Migrations reviewed for zero-downtime
- [ ] Accessibility checked
- [ ] TypeScript compiles without errors
- [ ] Code coverage > 80%
- [ ] No security vulnerabilities (Snyk)

## Deployment Notes
- Database migration required: Yes/No
- Environment variables added: Yes/No
- Feature flag required: Yes/No
```

### PR Reviewer Checklist
**Reviewer must verify:**
- [ ] Code follows standards (`.claude/standards/`)
- [ ] Tests added for new features
- [ ] No hardcoded secrets or credentials
- [ ] Error handling implemented
- [ ] Logging added for key operations
- [ ] Documentation updated
- [ ] Breaking changes documented
- [ ] Performance impact considered

## Merge Strategy

| Merge | Method | Rationale |
|-------|--------|-----------|
| Feature → Develop | Squash and merge | Clean commit history in develop |
| Develop → Main (release) | Merge commit (no squash) | Preserve feature branch history |
| Hotfix → Main | Merge commit | Then cherry-pick back to develop |

## Protected Branch Rules
- `main`: Require 1 approval, all CI checks pass, no direct push
- `staging`: Require all CI checks pass
- Linear history enforced (squash or rebase merges only)
- Delete branch after merge (automated)

## Release Workflow

### 1. Create Release Branch
```bash
git checkout develop && git pull
git checkout -b release/v1.2.0
```

### 2. Update Version
```bash
npm version minor  # e.g. 1.1.0 → 1.2.0
```

### 3. Update Changelog
```markdown
## [1.2.0] - YYYY-MM-DD

### Added
- User authentication with PingID
- Dashboard with analytics

### Fixed
- Login redirect issue

### Changed
- Updated API response format
```

### 4. Merge to Main and Tag
```bash
git checkout main
git merge --no-ff release/v1.2.0
git tag v1.2.0
git push origin main --tags
```

### 5. Merge Back to Develop
```bash
git checkout develop
git merge --no-ff release/v1.2.0
git push origin develop
```

## Related
- `.claude/workflows/epic-based-development.md`
- `.claude/workflows/deployment.md`
- `.claude/templates/release-notes-template.md`

## Token Optimization

- **Load when**: branching, commit message authoring, PR open, merge strategy questions, hotfix branching.
- **Load only**: this standard. Self-contained — does not need other standards loaded.
- **Unload after**: branch created / commit landed / PR merged.
