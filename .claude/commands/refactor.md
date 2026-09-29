---
description: Refactor code — apply patterns, reduce complexity, improve naming, eliminate tech debt
agent: build
subtask: false
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# Refactor

## Input

$ARGUMENTS (file path and refactor goal)
Examples:

- `@apps/api/src/services/order.service.ts extract payment logic to PaymentService`
- `@apps/web/src/components/Dashboard.tsx split into smaller components`
- `@apps/api/src/repositories/resource.repository.ts add query optimisation`

## Process

### 1. Analyze Current Code

- Read target file
- Identify: complexity, duplication, naming issues, SRP violations
- Check test coverage before refactoring:

```bash
!`pnpm --filter @repo/api test -- --testPathPattern="{ClassName}" --coverage 2>/dev/null | tail -5`
```

### 2. Refactor Plan

Present plan BEFORE making changes:

```
## Refactor Plan: {file}

### Issues Identified
1. [Issue + why it's a problem]

### Proposed Changes
1. [Change + pattern being applied]

### Files Affected
- Modified: [list]
- Created: [list]
- Deleted: [list]

### Risk: Low / Medium / High
```

**Confirm with user before proceeding.**

### 3. Apply Refactoring

Common patterns to apply:

- **Extract Method/Class** — SRP violation
- **Replace Conditional with Polymorphism** — complex if/switch
- **Introduce Parameter Object** — long parameter lists (>3)
- **Extract Interface** — for testability
- **Builder Pattern** — complex object construction
- **Repository Pattern** — data access in service layer
- **Strategy Pattern** — interchangeable algorithms

### 4. Verify Tests Still Pass

```bash
# TypeScript (API)
!`pnpm --filter @repo/api test -- --testPathPattern="{AffectedModule}" 2>&1 | tail -20`

# TypeScript (Frontend)
!`pnpm --filter @repo/web test -- --testPathPattern="{AffectedFile}" 2>&1 | tail -20`
```

ALL tests must pass after refactoring.

### 5. Update Tests if Needed

If method signatures changed, update tests to match new API.
Never delete tests — refactor them alongside code.

### 6. Summary

```
## Refactor Complete: {file}
### Changes Made
### Tests: X passing (was X before)
### Complexity: Before X → After X (cyclomatic)
```

## Cross-References

- Code review after: `/review-code`
- Tests: `/add-unit-test`
