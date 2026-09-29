# State Management Pattern

## Query Key Factory (per domain)
```typescript
// apps/web/src/lib/query-keys/document.keys.ts
import type { DocumentListFilters } from '@repo/validation';

export const documentKeys = {
  all: ['documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  list: (filters: DocumentListFilters) =>
    [...documentKeys.lists(), filters] as const,
  details: () => [...documentKeys.all, 'detail'] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
} as const;
```

## Optimistic Mutation Pattern
```typescript
// apps/web/src/hooks/mutations/useUpdateDocumentTitle.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { documentKeys } from '@/lib/query-keys/document.keys';
import { documentsApi } from '@/lib/api-client';
import type { Document, UpdateDocumentDto } from '@repo/validation';

export function useUpdateDocumentTitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { id: string; dto: UpdateDocumentDto }) =>
      documentsApi.update(vars.id, vars.dto),

    onMutate: async ({ id, dto }) => {
      await queryClient.cancelQueries({ queryKey: documentKeys.detail(id) });
      const previous = queryClient.getQueryData<Document>(documentKeys.detail(id));

      queryClient.setQueryData<Document>(documentKeys.detail(id), (old) =>
        old ? { ...old, ...dto } : old
      );

      return { previous, id };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(documentKeys.detail(context.id), context.previous);
      }
    },

    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}
```

## Infinite Scroll / Pagination
```typescript
// Cursor-based infinite query
export function useDocumentList(filters: DocumentListFilters) {
  return useInfiniteQuery({
    queryKey: documentKeys.list(filters),
    queryFn: ({ pageParam }) =>
      documentsApi.list({ ...filters, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 2 * 60 * 1000,
  });
}
```

## Global Query Client Config
```typescript
// apps/web/src/lib/query-client.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,        // 1 minute default
      gcTime: 5 * 60 * 1000,       // 5 minutes garbage collect
      retry: 1,                     // one retry on failure
      refetchOnWindowFocus: false,  // explicit in enterprise apps
    },
    mutations: {
      retry: 0,                     // no mutation retries (non-idempotent)
    },
  },
});
```

## Form State + Server Mutation Integration
```typescript
// Complete form → mutation → feedback loop
export function DocumentForm({ onSuccess }: { onSuccess: () => void }) {
  const form = useForm<CreateDocumentDto>({
    resolver: zodResolver(CreateDocumentSchema),
    defaultValues: { title: '', status: 'DRAFT' },
  });

  const { mutate, isPending } = useCreateDocument({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      form.reset();
      onSuccess();
    },
    onError: (error) => {
      // Map API validation errors to form fields
      if (error.response?.status === 422) {
        error.response.data.errors?.forEach((e: FieldError) => {
          form.setError(e.field as any, { message: e.message });
        });
      }
    },
  });

  return (
    <form onSubmit={form.handleSubmit((data) => mutate(data))}>
      {/* fields */}
      <Button type="submit" loading={isPending}>Save</Button>
    </form>
  );
}
```

## Token Optimization

**Load when** when choosing client state strategy (useState/Context/RQ/URL/Zustand). **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
