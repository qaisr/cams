# MSW Handler Pattern

> How to correctly set up and use MSW v2 for React component
> and hook tests in this monorepo.

## Architecture

```
apps/web/src/mocks/
├── server.ts          ← Singleton MSW server (Node environment)
├── browser.ts         ← MSW worker (browser/Storybook)
├── handlers.ts        ← Global baseline handlers (happy path)
└── generated/         ← orval-generated handlers (DO NOT EDIT)
    └── {entity}.ts
```

## Server Setup (jest.setup.ts)

```typescript
// apps/web/jest.setup.ts
import '@testing-library/jest-dom';
import { server } from '@/mocks/server';

// Start MSW server before all tests
beforeAll(() =>
  server.listen({
    onUnhandledRequest: 'error', // ← Catch missing handlers immediately
  })
);

// Reset per-test overrides — prevents handler bleed
afterEach(() => server.resetHandlers());

// Clean shutdown
afterAll(() => server.close());
```

## Server Singleton

```typescript
// apps/web/src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Exported singleton — imported in jest.setup.ts and individual tests
export const server = setupServer(...handlers);
```

## Global Handlers (Baseline Happy Path)

```typescript
// apps/web/src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';
import { mock{Entity} } from './__fixtures__/{entity}.fixtures';

// These provide happy-path baseline responses.
// Override per-test with server.use() for error scenarios.
export const handlers = [
  http.get('/v1/{entities}', () =>
    HttpResponse.json({
      data: [mock{Entity}],
      total: 1,
      page: 1,
      limit: 20,
    })
  ),

  http.get('/v1/{entities}/:id', ({ params }) =>
    HttpResponse.json({ ...mock{Entity}, id: params.id as string })
  ),

  http.post('/v1/{entities}', async ({ request }) => {
    const body = await request.json() as { name: string };
    return HttpResponse.json(
      { ...mock{Entity}, id: crypto.randomUUID(), name: body.name },
      { status: 201 }
    );
  }),

  http.delete('/v1/{entities}/:id', () =>
    new HttpResponse(null, { status: 204 })
  ),
];
```

## Per-Test Overrides

```typescript
// Override for error scenarios — server.use() replaces for current test only
// afterEach → server.resetHandlers() restores global handlers

it('shows 404 error alert', async () => {
  server.use(
    http.get('/v1/{entities}/:id', () =>
      HttpResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'Entity not found',
          correlationId: 'test-404',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      )
    )
  );

  renderWithProviders(<{Entity}Detail id="non-existent" />);
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(/not found/i)
  );
});

it('shows 500 generic error', async () => {
  server.use(
    http.get('/v1/{entities}/:id', () =>
      HttpResponse.json({ title: 'Server Error', status: 500 }, { status: 500 })
    )
  );
  // ...
});

it('simulates slow network', async () => {
  server.use(
    http.get('/v1/{entities}/:id', async () => {
      await new Promise((r) => setTimeout(r, 200));
      return HttpResponse.json(mock{Entity});
    })
  );
  // ...
});
```

## Anti-Patterns

```typescript
// ❌ WRONG — bypasses MSW, tests mock not real behaviour
jest.mock('../../lib/api-client', () => ({
  get{Entity}: jest.fn().mockResolvedValue(mock{Entity}),
}));

// ❌ WRONG — mocks React Query itself
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn().mockReturnValue({ data: mock{Entity} }),
}));

// ❌ WRONG — global server missing resetHandlers → test order dependency
// (if afterEach(() => server.resetHandlers()) is absent)

// ❌ WRONG — wrong response shape
http.get('/v1/{entities}/:id', () =>
  HttpResponse.json({ userId: '123' })  // wrong key — real API returns 'id'
)
// This makes component tests pass against wrong API contract
```

## Correct Pattern: Test All States

```typescript
describe('{Entity}Card', () => {
  // Happy path — uses global handler (no override needed)
  it('renders_{entity}Name_onSuccess', async () => {
    renderWithProviders(<{Entity}Card id={mock{Entity}.id} />);
    await waitFor(() =>
      expect(screen.getByText(mock{Entity}.name)).toBeInTheDocument()
    );
  });

  // Loading state
  it('shows_skeleton_whileLoading', () => {
    // No waitFor — check synchronously before MSW responds
    renderWithProviders(<{Entity}Card id={mock{Entity}.id} />);
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  // 404 error
  it('shows_errorAlert_on404', async () => {
    server.use(
      http.get('/v1/{entities}/:id', () =>
        HttpResponse.json({ status: 404, title: 'Not Found' }, { status: 404 })
      )
    );
    renderWithProviders(<{Entity}Card id="bad-id" />);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    );
  });

  // Network error
  it('shows_errorAlert_onNetworkFailure', async () => {
    server.use(
      http.get('/v1/{entities}/:id', () => HttpResponse.error())
    );
    renderWithProviders(<{Entity}Card id={mock{Entity}.id} />);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    );
  });
});
```

## Using Generated Handlers (orval)

```typescript
// apps/web/src/mocks/handlers.ts
// Import generated handlers as baseline — override per-test for errors
import { getGeneratedHandlers } from './generated';

export const handlers = [
  ...getGeneratedHandlers(),  // orval-generated baseline
  // Add any custom overrides here
];
```

Note: Generated handlers reflect the OpenAPI spec. If your tests
break after regenerating handlers, the API contract changed — fix
the implementation, not the test.

## Token Optimization

**Load when** when configuring MSW handlers for tests or local mock mode. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
