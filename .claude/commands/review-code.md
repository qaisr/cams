---
description: Comprehensive code review — quality, security, performance, PPCC standards
agent: tech-lead
subtask: true
---

# Code Review

## Input

$ARGUMENTS (file path, PR description, or feature name)
Examples:

- `@apps/api/src/controllers/resource.controller.ts`
- `all changes in the resource-management feature`
- (no args — reviews staged git changes)

## Process

### 1. Identify Scope

If $ARGUMENTS is empty:

```bash
!`git diff --name-only HEAD~1`
```

Read each changed file.

If $ARGUMENTS is a file path: read that file.
If $ARGUMENTS is a feature: find all related files.

### 2. Load Relevant Standards

- TypeScript/NestJS files: `@.claude/standards/api-standards.md`
- TypeScript/TSX: `@.claude/standards/frontend-standards.md`
- Prisma/SQL: `@.claude/standards/database-standards.md`
- All files: `@.claude/standards/security-standards.md`

Query CEB MCP: "PPCC code review standards"

### 3. Review Each File

Apply review dimensions from `@.claude/agents/tech-lead.md`:

1. Correctness — logic, null safety, edge cases
2. Security — OWASP, PingID, input validation
3. Performance — N+1, pagination, caching
4. Maintainability — naming, complexity, SRP
5. PPCC Standards — Design System, PingID, Observe, DirectConnect
6. Testability — coverage, test quality
7. Accessibility — WCAG 2.1 AA (frontend only)

### 4. Output Report

Use format from `@.claude/agents/tech-lead.md`:

```
## Code Review: {scope}
**Overall**: ✅ / ⚠️ / ❌

### Critical (Must Fix Before Merge)
### Major (Should Fix)
### Minor (Consider)
### Positive Observations
### Security Checklist
### Accessibility Checklist (frontend)
```

### 5. Auto-fix Minor Issues

For lint/format issues only, offer to auto-fix:

```bash
!`pnpm turbo lint:fix`
!`pnpm format`
```

## Cross-References

- Security review: `/security-audit`
- Fix issues: `/enhance-code`
- Standards: `@.claude/standards/`
