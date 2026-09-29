# Pattern: Optimistic Updates (React Query)

## Overview
Apply optimistic updates for mutations that change data the user just interacted
with. This eliminates perceived latency for critical user actions.

## When to Use
| Scenario | Use Optimistic | Reason |
|----------|---------------|--------|
| Toggle status (active/inactive) | ✅ Yes | Instant feedback needed |
| Like / bookmark | ✅ Yes | Instant feedback needed |
| Delete item | ✅ Yes | Remove from UI immediately |
| Create new item | ⚠️ Sometimes | Need server ID for navigation |
| Complex form submit | ❌ No | Too many fields to rollback |
| File upload | ❌ No | Progress UX preferred |

## Standard Pattern
```typescript
// hooks/useUpdateDocumentStatus.ts
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { updateDocument } from '@/hooks/generated/documents';
import { getGetDocumentsQueryKey, GetDocumentsResponse } from '@/hooks/generated/documents';

export function useUpdateDocumentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: DocumentStatus }) =>
      updateDocument(id, { status }),

    onMutate: async ({ id, status }) => {
      // 1. Cancel in-flight refetches (avoid overwriting optimistic update)
      const queryKey = getGetDocumentsQueryKey();
      await queryClient.cancelQueries({ queryKey });

      // 2. Snapshot current value for rollback
      const previous = queryClient.getQueryData<GetDocumentsResponse>(queryKey);

      // 3. Optimistically update cache
      queryClient.setQueryData<GetDocumentsResponse>(queryKey, (old) => ({
        ...old!,
        items: old!.items.map((doc) =>
          doc.id === id ? { ...doc, status, updatedAt: new Date().toISOString() } : doc
        ),
      }));

      return { previous }; // Context for onError rollback
    },

    onError: (err, _, context) => {
      // 4. Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(getGetDocumentsQueryKey(), context.previous);
      }
      toast.error('Failed to update status');
    },

    onSettled: () => {
      // 5. Always refetch to sync with server (handles edge cases)
      queryClient.invalidateQueries({ queryKey: getGetDocumentsQueryKey() });
    },
  });
}
```

## Usage in Component
```typescript
function DocumentStatusToggle({ document }: { document: Document }) {
  const { mutate: updateStatus, isPending } = useUpdateDocumentStatus();

  return (
    <Switch
      checked={document.status === 'active'}
      onCheckedChange={(checked) =>
        updateStatus({ id: document.id, status: checked ? 'active' : 'inactive' })
      }
      disabled={isPending}
      aria-label={`Toggle ${document.title} status`}
    />
  );
}
```

## Optimistic Delete Pattern
```typescript
onMutate: async (id) => {
  await queryClient.cancelQueries({ queryKey });
  const previous = queryClient.getQueryData(queryKey);

  queryClient.setQueryData<PaginatedResponse<Document>>(queryKey, (old) => ({
    ...old!,
    items: old!.items.filter((doc) => doc.id !== id),
    totalCount: (old!.totalCount ?? 1) - 1,
  }));

  return { previous };
},
```

## Rules
- Always `cancelQueries` before optimistic update to prevent race conditions
- Always snapshot `previous` for rollback
- Always `invalidateQueries` in `onSettled` (not `onSuccess`) for server sync
- Only mutate caches you control — don't modify other features' caches
- Show `isPending` state on UI elements to prevent double-click

## Token Optimization

**Load when** when designing TanStack Query mutations with cache rollback. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
