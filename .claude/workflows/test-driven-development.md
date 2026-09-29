# Test-Driven Development Workflow

> **Operating Discipline (always applies).** Follow `@.claude/CLAUDE.md` → Operating Discipline throughout this workflow: never hallucinate paths/APIs/versions, never assume intent to fill a gap, never implement unrequested scope, clarify ambiguities before acting, and get **explicit human approval** before anything hard-to-reverse or beyond the stated request. Report faithfully what was done, skipped, or failed.


> TDD workflow for this monorepo stack.
> Write the test first. Watch it fail. Make it pass. Refactor.

## When to Use TDD

| Scenario | Approach |
|---|---|
| New service method | ✅ Full TDD — test first |
| New API endpoint | ✅ Integration test first |
| Bug fix | ✅ Write failing test reproducing bug, then fix |
| New React component | ✅ RTL test first for behaviour |
| Refactor (no new behaviour) | Test coverage first, then refactor |
| Generated code (orval, prisma-zod) | ❌ Don't TDD generated output |

## The Cycle

```
1. RED    → Write test describing desired behaviour → Run → Should fail
2. GREEN  → Write minimum code to make test pass → Run → Should pass
3. REFACTOR → Clean up without breaking tests → Run → Still green
```

## Step 1: RED — Write the Test

Before writing any implementation:

```bash
# 1. Create the fixture factory if it doesn't exist
touch apps/api/src/modules/{entity}/__fixtures__/{entity}.fixtures.ts

# 2. Create the test file
touch apps/api/src/modules/{entity}/{entity}.service.spec.ts

# 3. Write ONE failing test
```

```typescript
// What I want the service to do:
it('create_validDto_persistsAndPublishesEvent', async () => {
  const dto     = create{Entity}DtoFactory.build();
  const created = {entity}Factory.build({ name: dto.name });
  mockPrisma.{entity}.create.mockResolvedValue(created);

  const result = await service.create(dto, 'corr-001');

  expect(result.id).toBe(created.id);
  expect(mockEvents.publish).toHaveBeenCalledWith(
    expect.objectContaining({ detailType: '{entity}.created' })
  );
});
```

```bash
# Run — MUST fail (service doesn't exist yet)
pnpm --filter @repo/api test --testPathPattern="{entity}.service" --verbose
# Expected: FAIL — "{Entity}Service" is not defined
```

## Step 2: GREEN — Minimum Implementation

Write the smallest amount of code to make the test pass.
Don't add features not covered by tests.

```bash
# Run — MUST pass
pnpm --filter @repo/api test --testPathPattern="{entity}.service" --verbose
# Expected: PASS
```

## Step 3: REFACTOR

Clean up the implementation (extract methods, improve naming)
without changing behaviour. Run tests after every change.

```bash
# After every refactor step
pnpm --filter @repo/api test --testPathPattern="{entity}.service" --verbose
```

## TDD for API Endpoints (Integration-First)

```
1. Write integration test for POST /v1/{entities}
2. Run → FAIL (controller doesn't exist)
3. Generate NestJS controller/service/module scaffold
4. Run → FAIL (wrong implementation)
5. Implement service logic
6. Run → PASS
7. Write next integration test (GET, DELETE, etc.)
8. Repeat
```

## TDD for React Components (Behaviour-First)

```
1. Write RTL test for loading state
2. Write RTL test for success state (what renders after data loads)
3. Write RTL test for user interaction (button click)
4. Write RTL test for error state
5. Run all → FAIL (component doesn't exist)
6. Implement component
7. Run all → PASS
```

## Claude TDD Commands

```
# Start TDD session for a new feature
/add-unit-test for {EntityService} create method — write test first, I will implement

# TDD a bug fix
/add-unit-test reproduce bug: findById returns stale soft-deleted record

# TDD an entire module
/generate-tests apps/api/src/modules/{entity} — TDD mode
```

## Pre-Commit TDD Gate

The pre-commit hook runs:
```bash
pnpm --filter @repo/api test --testPathPattern="changed-files" --bail
```

New code without tests blocks commit. This enforces TDD at the workflow level.

## Coverage as TDD Signal

```
Coverage drops → You added code without writing tests first
Coverage stays same → Your refactor didn't change behaviour (good)
Coverage goes up → You added test for existing untested code
```

Run after each TDD cycle:
```bash
pnpm --filter @repo/api test \
  --testPathPattern="{entity}" \
  --coverage \
  --coverageReporters=text \
  --collectCoverageFrom="src/modules/{entity}/**"
```

## Token Optimization

- **Load when**: implementing any new NestJS service/controller, API endpoint, or React hook with non-trivial logic.
- **Load only**: `testing-standards.md`, the matching unit-test template, plus the implementation pattern (e.g. `prisma-repository-pattern.md`).
- **Unload after**: red-green-refactor cycle complete and coverage threshold met.
- **Hand-off to**: `test-engineer` for E2E layer, `tech-lead` for review.
