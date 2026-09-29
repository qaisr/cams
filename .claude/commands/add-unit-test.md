---
name: add-unit-test
description: >
  Generate unit tests for a NestJS service, controller, or React component/hook.
  Reads source, identifies all branches, generates full test file with factories.
  Runs tests and fixes failures before finishing.
version: 2.0.0
agent: test-engineer
subtask: true
arguments:
  - name: TARGET
    description: File path or module description
    required: true
    examples:
      - "apps/api/src/modules/users/users.service.ts"
      - "apps/web/src/components/users/CreateUserForm.tsx"
      - "apps/api/src/modules/users/users.controller.ts"
      - "add tests for duplicate email scenario in apps/api/src/modules/users/users.service.spec.ts"
---

# Add Unit Test

## Input
$ARGUMENTS

---

## Step 1 — Read Target

```bash
# Read the target source file
cat $TARGET_FILE

# Check for existing test file
ls -la $(dirname $TARGET_FILE)/*.spec.ts 2>/dev/null || echo "No existing spec file"
ls -la $(dirname $TARGET_FILE)/*.test.tsx 2>/dev/null || echo "No existing test file"

# Read existing fixtures if present
find $(dirname $TARGET_FILE) -name "*.fixtures.ts" -o -name "*.fixtures.tsx" 2>/dev/null | xargs cat

# Understand imports and dependencies
grep -n "import" $TARGET_FILE | head -30
```

Identify:
- All public methods / route handlers / exported component props
- Every branch: happy path, not-found, validation, conflict, auth, exception propagation
- All injectable dependencies to mock
- Existing test file style (if "add tests" mode — match exactly, no duplication)

---

## Step 2 — Classify Target

**Rule**: Read `@.claude/standards/testing-standards.md` § "Test Type Decision Matrix"

| If target is... | Generate... | Template |
|---|---|---|
| `*.service.ts` | `*.service.spec.ts` | `@.claude/templates/nestjs-service-unit-test.ts` |
| `*.controller.ts` | `*.controller.spec.ts` | `@.claude/templates/nestjs-controller-unit-test.ts` |
| React `*.tsx` component | `*.test.tsx` | `@.claude/templates/react-component-test.tsx` |
| React `*.ts` custom hook | `*.hook.test.tsx` | `@.claude/templates/react-hook-test.tsx` |

---

## Step 3 — Locate or Create Fixture Factory

```bash
# Check for existing factory
find apps/ -path "*__fixtures__*" -name "*.fixtures.ts" | grep -i "{entity}"
```

If no factory exists, create one first:
- Location: `{source_dir}/__fixtures__/{entity}.fixtures.ts`
- Follow `@.claude/templates/fixture-factory.ts`
- Export: `{entity}Factory`, `create{Entity}DtoFactory`, `update{Entity}DtoFactory`

---

## Step 4 — Identify Test Scenarios

For every public method, enumerate ALL branches:

```
findById(id, correlationId):
  ✓ existingId_notSoftDeleted  → returns mapped DTO
  ✓ softDeletedId              → throws NotFoundException
  ✓ nonExistentId              → throws NotFoundException
  ✓ prismaThrows               → propagates error, no event published

create(dto, correlationId):
  ✓ validDto                   → persists, publishes event, returns DTO
  ✓ duplicateUniqueField       → throws ConflictException, no event published
  ✓ prismaConnectionError      → propagates error, no event published
  ✓ eventBridgeThrows          → behaviour defined by service (propagate or swallow?)

remove(id, correlationId):
  ✓ existingId                 → sets deletedAt, publishes event
  ✓ nonExistentId              → throws NotFoundException, no update, no event
  ✓ alreadySoftDeleted         → throws NotFoundException
```

**Do not skip error paths.** Error path coverage = 100% requirement.

---

## Step 5 — Generate Test File

Follow the appropriate template. Key rules:

### NestJS Service
```typescript
// ── Mocks defined at module level (not inside describe) ──────────────────────
const mockPrisma = {
  {entity}: {
    findFirst:  jest.fn(),
    findMany:   jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    updateMany: jest.fn(),
    count:      jest.fn(),
  },
  $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
};

const mockEvents = {
  publish:     jest.fn().mockResolvedValue(undefined),
  publishMany: jest.fn().mockResolvedValue(undefined),
};

// ── Suite ────────────────────────────────────────────────────────────────────
describe('{EntityService}', () => {
  let service: {Entity}Service;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        {Entity}Service,
        { provide: PrismaService,      useValue: mockPrisma },
        { provide: EventBridgeService, useValue: mockEvents },
      ],
    }).compile();
    service = module.get({Entity}Service);
    jest.clearAllMocks();   // ← MANDATORY in every beforeEach
  });

  // nested describe per method
  // test names: method_scenario_expected
});
```

### NestJS Controller
```typescript
// Mock the service — controllers are thin delegation layers
const mock{Entity}Service = {
  findAll:  jest.fn(),
  findById: jest.fn(),
  create:   jest.fn(),
  update:   jest.fn(),
  remove:   jest.fn(),
};

describe('{Entity}Controller', () => {
  let controller: {Entity}Controller;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [{Entity}Controller],
      providers: [
        { provide: {Entity}Service, useValue: mock{Entity}Service },
      ],
    }).compile();
    controller = module.get({Entity}Controller);
    jest.clearAllMocks();
  });

  // Controller tests verify:
  // 1. Correct method on service is called with correct args
  // 2. Return value is correctly passed through
  // 3. HTTP status codes (if using @HttpCode decorators)
  // 4. Decorators are wired (@Param, @Body, @Query)
});
```

### React Component
```typescript
// Always renderWithProviders — never render() directly
// MSW intercepts — never jest.mock() API clients
// Test all states: loading, success, empty, error (4xx, 5xx)
// Test all user interactions: click, type, submit
// Test accessibility: aria attributes, keyboard navigation
```

---

## Step 6 — Add Mode (extending existing tests)

If `$ARGUMENTS` contains "add tests for":
1. Read existing spec file completely
2. Identify existing test names — do NOT duplicate
3. Find the gap (e.g., "duplicate email scenario")
4. Append new `describe` block or `it` block to existing suite
5. Match existing style exactly (mock patterns, factory usage, naming)

---

## Step 7 — Run and Verify

```bash
# Backend
pnpm --filter @repo/api test --testPathPattern="{EntityName}" --verbose

# Frontend
pnpm --filter @repo/web test --testPathPattern="{ComponentName}" --verbose
```

**If tests fail**: fix the test or fix the source — do not skip.

Report:
```
Tests run    : [n]
Passed       : [n]
Failed       : [n]  ← must be 0 before finishing
```

---

## Step 8 — Coverage Check

```bash
pnpm --filter @repo/api test --testPathPattern="{EntityName}" \
  --coverage --coverageReporters=text --collectCoverageFrom="src/modules/{entity}/**"
```

Identify uncovered branches. For each:
- Is it reachable? → Add test
- Is it dead code? → Flag for removal, note in output

**Required**: 80% branches, 85% lines.

---

## Cross-References
- Integration tests: `/add-integration-test`
- API tests: `/add-api-test`
- Standards: `@.claude/standards/testing-standards.md`
- NestJS service template: `@.claude/templates/nestjs-service-unit-test.ts`
- NestJS controller template: `@.claude/templates/nestjs-controller-unit-test.ts`
- React component template: `@.claude/templates/react-component-test.tsx`
- React hook template: `@.claude/templates/react-hook-test.tsx`
- Agent: `@.claude/agents/test-engineer.md`
