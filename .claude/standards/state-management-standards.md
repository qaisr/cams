# State Management Standards (NextJS / React)

## State Hierarchy — Choose the Right Tool
```
1. Local UI state        → useState / useReducer
2. Shared UI state       → React Context (theme, modals, toasts)
3. Server/async state    → React Query (TanStack Query) via orval hooks
4. URL state             → useSearchParams / nuqs
5. Form state            → React Hook Form + Zod
6. Complex local state   → useReducer
```

**No global state library (Redux/Zustand) unless justified by tech lead.**

## React Query (Server State) — Primary Pattern
```typescript
// ✅ Use orval-generated hooks (source of truth)
import { useGetDocuments, useCreateDocument } from '@/hooks/generated';

// ✅ Consistent query key factory pattern
export const documentKeys = {
  all: ['documents'] as const,
  list: (filters: DocumentFilters) => [...documentKeys.all, 'list', filters] as const,
  detail: (id: string) => [...documentKeys.all, 'detail', id] as const,
};

// ✅ Optimistic updates for better UX
const { mutate } = useUpdateDocument({
  onMutate: async (variables) => {
    await queryClient.cancelQueries(documentKeys.detail(variables.id));
    const previous = queryClient.getQueryData(documentKeys.detail(variables.id));
    queryClient.setQueryData(documentKeys.detail(variables.id), (old) => ({
      ...old,
      ...variables,
    }));
    return { previous };
  },
  onError: (_err, variables, context) => {
    queryClient.setQueryData(documentKeys.detail(variables.id), context?.previous);
  },
  onSettled: (_data, _err, variables) => {
    queryClient.invalidateQueries(documentKeys.detail(variables.id));
  },
});
```

## React Hook Form + Zod (Form State)
```typescript
// ✅ Always use Zod schema from packages/validation
import { CreateDocumentSchema } from '@repo/validation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from '@repo/validation';

type FormData = z.infer<typeof CreateDocumentSchema>;

const form = useForm<FormData>({
  resolver: zodResolver(CreateDocumentSchema),
  defaultValues: { title: '', status: 'DRAFT' },
  mode: 'onBlur', // validate on blur, not on every keystroke
});
```

## Context (Shared UI State)
```typescript
// ✅ Context for UI-only shared state (theme, sidebar, toasts)
// ❌ Do not put server data in Context — use React Query

// Split context: separate state from dispatch to prevent unnecessary renders
const ToastStateContext = createContext<ToastState | undefined>(undefined);
const ToastDispatchContext = createContext<ToastDispatch | undefined>(undefined);
```

## URL State
```typescript
// ✅ Persist filterable/shareable state in URL
import { useQueryState } from 'nuqs';

const [status, setStatus] = useQueryState('status', {
  defaultValue: 'all',
  parse: (v) => DocumentStatusSchema.parse(v),
});
```

## Rules
- No prop drilling beyond 2 levels — lift to Context or URL state
- React Query `staleTime` must be explicitly set (no implicit defaults)
- `queryClient.invalidateQueries` after every mutation
- Never store derived data in state — derive with `useMemo`
- Form dirty state tracked by RHF — no manual tracking
- Loading/error states always handled — no silent failures

## Token Optimization
Load for: frontend state management, React Query integration,
form development, complex UI state. Unload for backend tasks.
