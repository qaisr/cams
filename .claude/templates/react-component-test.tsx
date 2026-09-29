/**
 * React Component Test Template — Jest + React Testing Library + MSW
 *
 * Use for unit tests on `*.tsx` components. Cover: default render, all visible states,
 * user interactions, accessibility queries, error/empty states.
 *
 * Pattern references:
 *   @.claude/patterns/msw-handler-pattern.md
 *   @.claude/patterns/component-architecture.md
 * Standards:
 *   @.claude/standards/testing-standards.md
 *   @.claude/standards/frontend-standards.md
 *   @.claude/standards/accessibility-standards.md
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NextIntlClientProvider } from 'next-intl';

import messages from '@/messages/en.json'; // i18n bundle for tests
import { ResourceCard } from './ResourceCard';

// ──────────────────────────────────────────────────────────────────────────────
// MSW server. ONE per file. `onUnhandledRequest: 'error'` is non-negotiable.
// Per-test handlers added with `server.use(...)`.
// ──────────────────────────────────────────────────────────────────────────────
const server = setupServer(
  http.get('/api/resources/:id', ({ params }) =>
    HttpResponse.json({
      data: { id: params.id, name: 'Sample', amount: 10 },
    }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ──────────────────────────────────────────────────────────────────────────────
// Render helper — fresh QueryClient per test (no shared cache leakage).
// ──────────────────────────────────────────────────────────────────────────────
function renderComponent(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={messages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('ResourceCard', () => {
  // ── Default render ────────────────────────────────────────────────────────
  it('renders the resource name and amount once loaded', async () => {
    renderComponent(<ResourceCard id="abc-123" />);

    expect(await screen.findByRole('heading', { name: /sample/i })).toBeInTheDocument();
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  // ── Loading state ─────────────────────────────────────────────────────────
  it('shows a skeleton while loading', () => {
    renderComponent(<ResourceCard id="abc-123" />);

    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  // ── Error state ───────────────────────────────────────────────────────────
  it('shows an error message and retry action when the request fails', async () => {
    server.use(
      http.get('/api/resources/:id', () =>
        HttpResponse.json(
          {
            type: 'https://docs.ppcc/errors/internal',
            title: 'Something went wrong',
            status: 500,
            code: 'INTERNAL',
            correlationId: 'test',
          },
          { status: 500 },
        ),
      ),
    );

    renderComponent(<ResourceCard id="abc-123" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
    expect(screen.getByRole('button', { name: /retry/i })).toBeEnabled();
  });

  // ── Empty state ───────────────────────────────────────────────────────────
  it('shows an empty state when the resource has no items', async () => {
    server.use(
      http.get('/api/resources/:id', ({ params }) =>
        HttpResponse.json({ data: { id: params.id, name: 'Empty', amount: 0, items: [] } }),
      ),
    );

    renderComponent(<ResourceCard id="abc-123" />);

    expect(await screen.findByText(/no items yet/i)).toBeInTheDocument();
  });

  // ── User interaction ──────────────────────────────────────────────────────
  it('expands the details panel when "Show more" is clicked', async () => {
    const user = userEvent.setup();
    renderComponent(<ResourceCard id="abc-123" />);

    const button = await screen.findByRole('button', { name: /show more/i });
    await user.click(button);

    const panel = await screen.findByRole('region', { name: /details/i });
    expect(within(panel).getByText(/full description/i)).toBeInTheDocument();
  });

  // ── Accessibility ─────────────────────────────────────────────────────────
  it('exposes the card as a labelled article', async () => {
    renderComponent(<ResourceCard id="abc-123" />);

    const article = await screen.findByRole('article', { name: /sample/i });
    expect(article).toHaveAttribute('aria-busy', 'false');
  });

  // ── Keyboard navigation ───────────────────────────────────────────────────
  it('toggles details with Enter and Space on the trigger button', async () => {
    const user = userEvent.setup();
    renderComponent(<ResourceCard id="abc-123" />);

    const button = await screen.findByRole('button', { name: /show more/i });
    button.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByRole('region', { name: /details/i })).toBeVisible());
  });
});
