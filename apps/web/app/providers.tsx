'use client';

import { LumenProvider } from '@lumen/react/LumenProvider';
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { AuthProvider } from '../src/lib/auth/AuthContext';
import { makeQueryClient } from '../src/lib/query-client';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState<QueryClient>(() => makeQueryClient());

  // LumenProvider is mounted side-by-side with the existing providers (Plan 02
  // Phase 1). It only establishes the Lumen context here — DaisyUI stays in
  // place and Lumen token CSS is intentionally not imported yet (Phase 2 owns
  // the DaisyUI → Lumen styling swap).
  return (
    <LumenProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </LumenProvider>
  );
}
