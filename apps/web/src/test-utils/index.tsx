import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';

import { AuthProvider } from '../lib/auth/AuthContext';

import type { ReactElement } from 'react';

function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function TestProviders({ children }: { children: React.ReactNode }) {
  const queryClient = makeTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: TestProviders, ...options });
}

export * from '@testing-library/react';
