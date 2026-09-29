/**
 * Jest unit test template for React components and hooks.
 * Uses React Testing Library — test behaviour, not implementation.
 * Uses MSW for API mocking — never mock fetch/axios directly.
 * Uses generated MSW handlers from orval where available.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { {Entity}Card } from '@/components/{resources}/{Entity}Card';
import { {Entity}Form } from '@/components/{resources}/{Entity}Form';
import type { {Entity}ResponseDtoType } from '@repo/validation';
// Import server from centralised MSW setup — configured in jest.setup.ts
import { server } from '@/mocks/server';

// ─── Test Fixtures ────────────────────────────────────────────────────────────
// Use deterministic IDs — matches seed data in packages/database/prisma/seed.ts
const mock{Entity}: {Entity}ResponseDtoType = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Test {Entity}',
  status: 'ACTIVE',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

// ─── MSW Handlers ─────────────────────────────────────────────────────────────
// Option A: Use generated handlers from orval (preferred)
// import { get{Entity}ByIdHandler } from '@/mocks/generated/{entities}';
//
// Option B: Inline handlers for test-specific overrides
const default{Entity}Handlers = [
  http.get('/v1/{entities}/:id', ({ params }) => {
    if (params.id === mock{Entity}.id) {
      return HttpResponse.json(mock{Entity});
    }
    return HttpResponse.json(
      {
        type: 'https://api.example.com/errors/not-found',
        title: 'Not Found',
        status: 404,
        detail: `{Entity} ${params.id} not found`,
        correlationId: 'test-corr-001',
        timestamp: new Date().toISOString(),
      },
      { status: 404 }
    );
  }),

  http.post('/v1/{entities}', async ({ request }) => {
    const body = await request.json() as { name: string };
    return HttpResponse.json(
      { ...mock{Entity}, id: 'new-{entity}-id', name: body.name },
      { status: 201 }
    );
  }),

  http.delete('/v1/{entities}/:id', () => {
    return new HttpResponse(null, { status: 204 });
  }),
];

// MSW server lifecycle — configured in jest.setup.ts
// beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
// afterEach(() => server.resetHandlers());
// afterAll(() => server.close());

// ─── Test Utilities ───────────────────────────────────────────────────────────
/**
 * Create a fresh QueryClient per test — prevents cache bleed between tests.
 * retry: false — don't retry on 4xx in tests.
 * gcTime: 0 — don't cache between tests.
 */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,   // Always fetch fresh in tests
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Render with QueryClientProvider.
 * Each test gets a fresh QueryClient — no shared state.
 */
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    ),
    queryClient,
  };
}

// ─── {Entity}Card Tests ───────────────────────────────────────────────────────
describe('{Entity}Card', () => {
  // Add test-specific handlers — server.use() in tests overrides global handlers
  // Global handlers are defined in mocks/handlers.ts (loaded in jest.setup.ts)

  describe('loading state', () => {
    it('shows loading skeleton while fetching', () => {
      renderWithProviders(<{Entity}Card {entity}Id={mock{Entity}.id} />);

      // Check loading indicator before data resolves
      expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
    });
  });

  describe('success state', () => {
    it('displays {entity} name after data loads', async () => {
      renderWithProviders(<{Entity}Card {entity}Id={mock{Entity}.id} />);

      await waitFor(() => {
        expect(screen.getByText(mock{Entity}.name)).toBeInTheDocument();
      });
    });

    it('displays status badge with correct value', async () => {
      renderWithProviders(<{Entity}Card {entity}Id={mock{Entity}.id} />);

      await waitFor(() => {
        expect(screen.getByRole('status', { name: /status/i }))
          .toHaveTextContent('ACTIVE');
      });
    });

    it('calls onSelect with {entity} data when Select button clicked', async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();
      renderWithProviders(
        <{Entity}Card {entity}Id={mock{Entity}.id} onSelect={onSelect} />
      );

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /select/i })).toBeEnabled()
      );

      await user.click(screen.getByRole('button', { name: /select/i }));

      // Verify called with the correct data shape
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: mock{Entity}.id })
      );
    });
  });

  describe('error state', () => {
    it('shows error alert when {entity} not found (404)', async () => {
      // Override handler for this test — 404 response
      server.use(
        http.get('/v1/{entities}/:id', () =>
          HttpResponse.json(
            { title: 'Not Found', status: 404, correlationId: 'test-404' },
            { status: 404 }
          )
        )
      );

      renderWithProviders(<{Entity}Card {entity}Id="non-existent-id" />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/unable to load/i);
      });
    });

    it('shows error alert on server error (500)', async () => {
      server.use(
        http.get('/v1/{entities}/:id', () =>
          HttpResponse.json(
            { title: 'Internal Server Error', status: 500 },
            { status: 500 }
          )
        )
      );

      renderWithProviders(<{Entity}Card {entity}Id={mock{Entity}.id} />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('delete flow', () => {
    it('shows confirmation dialog when Delete button clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<{Entity}Card {entity}Id={mock{Entity}.id} />);

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /delete/i })).toBeEnabled()
      );

      await user.click(screen.getByRole('button', { name: /delete/i }));

      expect(
        screen.getByRole('dialog', { name: /confirm delete/i })
      ).toBeInTheDocument();
    });

    it('closes dialog without deleting when Cancel clicked', async () => {
      const user = userEvent.setup();
      const onDeleted = jest.fn();
      renderWithProviders(
        <{Entity}Card {entity}Id={mock{Entity}.id} onDeleted={onDeleted} />
      );

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /delete/i })).toBeEnabled()
      );

      await user.click(screen.getByRole('button', { name: /delete/i }));
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onDeleted).not.toHaveBeenCalled();
    });

    it('calls onDeleted after successful deletion and invalidates cache', async () => {
      const user = userEvent.setup();
      const onDeleted = jest.fn();
      const { queryClient } = renderWithProviders(
        <{Entity}Card {entity}Id={mock{Entity}.id} onDeleted={onDeleted} />
      );

      // Spy on cache invalidation
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /delete/i })).toBeEnabled()
      );

      await user.click(screen.getByRole('button', { name: /delete/i }));
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: /delete/i })
      );

      await waitFor(() => {
        expect(onDeleted).toHaveBeenCalledWith(mock{Entity}.id);
        // Verify React Query cache was invalidated after mutation
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: expect.arrayContaining(['{entities}']) })
        );
      });
    });
  });

  describe('accessibility', () => {
    it('delete button has accessible name including {entity} name', async () => {
      renderWithProviders(<{Entity}Card {entity}Id={mock{Entity}.id} />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: `Delete ${mock{Entity}.name}` })
        ).toBeInTheDocument();
      });
    });

    it('confirmation dialog has aria-labelledby and aria-describedby', async () => {
      const user = userEvent.setup();
      renderWithProviders(<{Entity}Card {entity}Id={mock{Entity}.id} />);

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /delete/i })).toBeEnabled()
      );

      await user.click(screen.getByRole('button', { name: /delete/i }));

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(dialog).toHaveAttribute('aria-describedby');
    });

    it('loading state announced to screen readers via aria-live', () => {
      renderWithProviders(<{Entity}Card {entity}Id={mock{Entity}.id} />);

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveAttribute('aria-live');
    });
  });
});

// ─── {Entity}Form Tests ───────────────────────────────────────────────────────
describe('{Entity}Form', () => {
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validation (client-side — Zod schema from @repo/validation)', () => {
    it('shows error when name is empty on submit', async () => {
      const user = userEvent.setup();
      renderWithProviders(<{Entity}Form onSuccess={mockOnSuccess} />);

      await user.click(screen.getByRole('button', { name: /save/i }));

      // Error message comes from Zod schema — same message as backend validation
      expect(await screen.findByRole('alert')).toHaveTextContent(/required/i);
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('shows error when name exceeds max length', async () => {
      const user = userEvent.setup();
      renderWithProviders(<{Entity}Form onSuccess={mockOnSuccess} />);

      await user.type(screen.getByLabelText(/name/i), 'a'.repeat(201));
      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });

  describe('submission (React Query mutation)', () => {
    it('calls API and triggers onSuccess with valid input', async () => {
      const user = userEvent.setup();
      renderWithProviders(<{Entity}Form onSuccess={mockOnSuccess} />);

      await user.type(screen.getByLabelText(/name/i), 'Valid {Entity}');
      await user.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Valid {Entity}' })
        );
      });
    });

    it('disables submit button while mutation is pending (aria-busy)', async () => {
      const user = userEvent.setup();
      // Simulate slow API
      server.use(
        http.post('/v1/{entities}', async () => {
          await new Promise((r) => setTimeout(r, 100));
          return HttpResponse.json({ ...mock{Entity} }, { status: 201 });
        })
      );

      renderWithProviders(<{Entity}Form onSuccess={mockOnSuccess} />);

      await user.type(screen.getByLabelText(/name/i), 'Test');
      await user.click(screen.getByRole('button', { name: /save/i }));

      // Button should be disabled and aria-busy during pending state
      const savingButton = screen.getByRole('button', { name: /saving/i });
      expect(savingButton).toBeDisabled();
      expect(savingButton).toHaveAttribute('aria-busy', 'true');
    });

    it('shows API error message on 409 conflict', async () => {
      server.use(
        http.post('/v1/{entities}', () =>
          HttpResponse.json(
            {
              title: 'Conflict',
              status: 409,
              detail: 'A {entity} with this name already exists',
              correlationId: 'test-409',
            },
            { status: 409 }
          )
        )
      );

      const user = userEvent.setup();
      renderWithProviders(<{Entity}Form onSuccess={mockOnSuccess} />);

      await user.type(screen.getByLabelText(/name/i), 'Existing Name');
      await user.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i);
      });
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('shows generic error message on 500 server error', async () => {
      server.use(
        http.post('/v1/{entities}', () =>
          HttpResponse.json({ title: 'Internal Server Error', status: 500 }, { status: 500 })
        )
      );

      const user = userEvent.setup();
      renderWithProviders(<{Entity}Form onSuccess={mockOnSuccess} />);

      await user.type(screen.getByLabelText(/name/i), 'Test Name');
      await user.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i);
      });
    });
  });

  describe('accessibility', () => {
    it('associates error messages with inputs via aria-describedby', async () => {
      const user = userEvent.setup();
      renderWithProviders(<{Entity}Form onSuccess={mockOnSuccess} />);

      await user.click(screen.getByRole('button', { name: /save/i }));

      const input = await screen.findByLabelText(/name/i);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby');

      const errorId = input.getAttribute('aria-describedby');
      expect(document.getElementById(errorId!)).toHaveTextContent(/required/i);
    });

    it('API error container has aria-live for screen reader announcement', async () => {
      renderWithProviders(<{Entity}Form onSuccess={mockOnSuccess} />);

      // Error container should be present in DOM (even when empty) with aria-live
      const errorContainer = screen.getByTestId('{entity}-form-api-error');
      expect(errorContainer).toHaveAttribute('aria-live', 'assertive');
    });
  });
});

// ─── Hook Tests (direct hook testing) ────────────────────────────────────────
// For custom hooks that extend generated hooks (e.g., optimistic updates)
import { renderHook, waitFor as waitForHook } from '@testing-library/react';
import { useCreate{Entity}Optimistic } from '@/hooks/{entities}.hooks';

describe('useCreate{Entity}Optimistic', () => {
  it('optimistically adds {entity} to cache before API response', async () => {
    const queryClient = createTestQueryClient();

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Pre-populate cache
    queryClient.setQueryData(['{entities}', { page: 1, limit: 20 }], {
      data: [mock{Entity}],
      total: 1,
      page: 1,
      limit: 20,
    });

    const { result } = renderHook(() => useCreate{Entity}Optimistic(), { wrapper });

    // Trigger mutation
    result.current.mutate({ name: 'Optimistic {Entity}' });

    // Cache should be updated optimistically before API responds
    const cached = queryClient.getQueryData(['{entities}']) as {Entity}ResponseDtoType[];
    expect(cached).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Optimistic {Entity}' }),
      ])
    );
  });

  it('rolls back optimistic update on API failure', async () => {
    server.use(
      http.post('/v1/{entities}', () =>
        HttpResponse.json({ status: 500 }, { status: 500 })
      )
    );

    const queryClient = createTestQueryClient();
    const originalData = { data: [mock{Entity}], total: 1, page: 1, limit: 20 };
    queryClient.setQueryData(['{entities}', undefined], originalData);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCreate{Entity}Optimistic(), { wrapper });

    result.current.mutate({ name: 'Will Fail' });

    await waitForHook(() => expect(result.current.isError).toBe(true));

    // Cache should be rolled back to original
    expect(queryClient.getQueryData(['{entities}', undefined])).toEqual(originalData);
  });
});
