# Testcontainers Pattern

> How to correctly use Testcontainers in this monorepo for NestJS integration tests.
> Anti-patterns that cause slow or flaky tests are documented below.

## Golden Rules

1. **One container per suite** — `beforeAll`, not `beforeEach`
2. **Data reset per test** — `deleteMany` in `beforeEach`, not container restart
3. **Run Prisma migrations** — not `db push`, migrations test real schema evolution
4. **`--runInBand`** — required to prevent port conflicts across parallel suites
5. **Mock EventBridge** — real EventBridge publishing is not needed in integration tests; mock the service
6. **`MOCK_AUTH_ENABLED=true`** — use mock JWT guard to avoid PingID dependency

## Container Lifecycle

```typescript
// ✅ CORRECT — container shared across entire suite
let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('test_db')
    .withUsername('test')
    .withPassword('test')
    .start();
  // ... build module, run migrations
}, 90_000);

afterAll(async () => {
  await app?.close();
  await container?.stop();
});

beforeEach(async () => {
  // ✅ CORRECT — reset data, not container
  jest.clearAllMocks();
  await prisma.childEntity.deleteMany();  // children first
  await prisma.entity.deleteMany();       // parents last
});
```

```typescript
// ❌ WRONG — new container per test = catastrophically slow
beforeEach(async () => {
  container = await new PostgreSqlContainer().start();  // 10-30s per test
});
```

## Running Migrations in Test Container

```typescript
import { execSync } from 'child_process';

// In beforeAll, after container starts:
execSync('pnpm prisma migrate deploy', {
  env: {
    ...process.env,
    DATABASE_URL: container.getConnectionUri(),
  },
  stdio: 'pipe',  // suppress migration output in test logs
});
```

## Global Test Container (Shared Across All Integration Suites)

For maximum performance, use a global setup that starts one container
for ALL integration test suites:

```typescript
// apps/api/src/test/setup/testcontainers.setup.ts
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'child_process';

let container: StartedPostgreSqlContainer;

export async function setupTestDatabase(): Promise<string> {
  if (container) return container.getConnectionUri();

  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('test_db')
    .withUsername('test')
    .withPassword('test')
    .start();

  const connectionUri = container.getConnectionUri();

  // Run migrations once
  execSync('pnpm prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: connectionUri },
    stdio: 'pipe',
  });

  // Register cleanup
  process.on('exit', () => { void container.stop(); });
  process.on('SIGINT', () => { void container.stop(); process.exit(130); });

  return connectionUri;
}

export async function teardownTestDatabase(): Promise<void> {
  await container?.stop();
}
```

## Module Override Pattern

```typescript
// Override DATABASE_URL and EventBridgeService
const module = await Test.createTestingModule({
  imports: [AppModule],
})
  .overrideProvider('DATABASE_URL')
  .useValue(container.getConnectionUri())
  .overrideProvider(EventBridgeService)
  .useValue({ publish: jest.fn().mockResolvedValue(undefined) })
  .compile();

// ⚠️ Must match production bootstrap order exactly
app = module.createNestApplication();
app.useGlobalFilters(new GlobalExceptionFilter());
app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
app.setGlobalPrefix('v1');
await app.init();
```

## Data Cleanup Order

Always delete in reverse foreign key dependency order:

```typescript
// Correct order — children before parents
await prisma.comment.deleteMany();
await prisma.post.deleteMany();
await prisma.userProfile.deleteMany();
await prisma.user.deleteMany();
await prisma.organisation.deleteMany();
```

Tip: Generate the correct order from your Prisma schema:
```bash
grep -E "^\s+@relation" packages/database/prisma/schema.prisma
```

## jest.config.ts Settings

```typescript
// apps/api/jest.config.ts
export default {
  projects: [
    {
      displayName: 'unit',
      testMatch: ['**/*.spec.ts'],
      testPathIgnorePatterns: ['*.integration.spec.ts'],
    },
    {
      displayName: 'integration',
      testMatch: ['**/*.integration.spec.ts'],
      testTimeout: 60_000,   // Testcontainers needs longer timeout
      maxWorkers: 1,         // --runInBand equivalent for this project
    },
  ],
};
```

## pnpm Scripts

```json
// package.json in apps/api
{
  "scripts": {
    "test": "jest --selectProjects unit",
    "test:integration": "jest --selectProjects integration --runInBand",
    "test:all": "jest --runInBand",
    "test:coverage": "jest --selectProjects unit --coverage",
    "test:preflight": "tsx ../../scripts/preflight-check.ts"
  }
}
```

## Performance Tips

| Technique | Saves |
|---|---|
| One container per suite | ~10-30s per test |
| `postgres:16-alpine` image | Smaller pull, faster start |
| `deleteMany` over container restart | ~10-25s per test |
| `--runInBand` | Prevents flaky port conflicts |
| Warm Docker layer cache | ~20s on subsequent runs |

Typical suite time with these patterns:
- First run (cold Docker): ~45-90s for full suite
- Subsequent runs (warm): ~8-20s for full suite

## Token Optimization

**Load when** when writing integration tests against real PostgreSQL. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
