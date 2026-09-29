/**
 * React Hook Test Template
 *
 * For custom hooks that extend generated orval hooks
 * (e.g., optimistic updates, cache manipulation, derived state).
 *
 * DO NOT test generated hooks from hooks/generated/ directly.
 * Test your custom logic that uses them.
 *
 * Replace {Entity}, {entity}, {entities} as needed.
 * Location: apps/web/src/hooks/{entities}.hook.test.tsx
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { useCreate{Entity}Optimistic } from '@/hooks/{entities}.hooks';
import { {entity}ResponseFactory } from '@/components/{entities}/__fixtures__/{entity}.fixtures';
import type { {Entity}ResponseDtoType } from '@repo/validation';

// ── Test utilities ─────────────────────────────────────────────────────────────
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// ── useCreate{Entity}Optimistic ───────────────────────────────────────────────
describe('useCreate{Entity}Optimistic', () => {
  it('optimisticallyAdds{Entity}ToCacheBeforeApiResponse', async () => {
    const queryClient = createTestQueryClient();
    const existing    = {entity}ResponseFactory.buildList(1);
    const queryKey    = ['{entities}', { page: 1, limit: 20 }];

    // Pre-populate cache
    queryClient.setQueryData(queryKey, {
      data: existing,
      total: 1,
      page: 1,
      limit: 20,
    });

    // Delay API response to allow asserting optimistic state
    server.use(
      http.post('/v1/{entities}', async () => {
        await new Promise((r) => setTimeout(r, 100));
        return HttpResponse.json(
          {entity}ResponseFactory.build({ name: 'Optimistic {Entity}' }),
          { status: 201 }
        );
      })
    );

    const { result } = renderHook(() => useCreate{Entity}Optimistic(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ name: 'Optimistic {Entity}' });
    });

    // Before API responds — cache should have optimistic entry
    await waitFor(() => {
      const cached = queryClient.getQueryData<{ data: {Entity}ResponseDtoType[] }>(queryKey);
      expect(cached?.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Optimistic {Entity}' }),
        ])
      );
    });
  });

  it('rollsBackOptimisticUpdate_onApiFailure', async () => {
    server.use(
      http.post('/v1/{entities}', () =>
        HttpResponse.json({ status: 500 }, { status: 500 })
      )
    );

    const queryClient = createTestQueryClient();
    const original    = {entity}ResponseFactory.buildPage(
      {entity}ResponseFactory.buildList(2)
    );
    const queryKey    = ['{entities}', undefined];

    queryClient.setQueryData(queryKey, original);

    const { result } = renderHook(() => useCreate{Entity}Optimistic(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ name: 'Will Fail' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Cache must be rolled back exactly to original
    expect(queryClient.getQueryData(queryKey)).toEqual(original);
  });

  it('invalidatesQueryCache_onSuccess', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreate{Entity}Optimistic(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ name: 'New {Entity}' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(['{entities}']),
      })
    );
  });

  it('exposesCorrectLoadingState_duringMutation', async () => {
    server.use(
      http.post('/v1/{entities}', async () => {
        await new Promise((r) => setTimeout(r, 150));
        return HttpResponse.json(
          {entity}ResponseFactory.build(), { status: 201 }
        );
      })
    );

    const { result } = renderHook(
      () => useCreate{Entity}Optimistic(),
      { wrapper: createWrapper(createTestQueryClient()) }
    );

    expect(result.current.isPending).toBe(false);

    act(() => { result.current.mutate({ name: 'Test' }); });

    await waitFor(() => expect(result.current.isPending).toBe(true));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isSuccess).toBe(true);
  });
});
