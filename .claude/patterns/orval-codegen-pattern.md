# Orval Code Generation & React Query Usage Pattern

## Purpose
Maintain Single Source of Truth: Prisma/Zod → OpenAPI → React Query hooks.
All API client code is generated — never hand-written.

## Generation Pipeline
```
packages/database/prisma/schema.prisma  (source of truth)
  └─► pnpm generate:prisma  →  packages/database/generated/zod/
      └─► pnpm generate:spec  →  packages/api-spec/generated/openapi.json
          └─► pnpm generate:hooks  →  apps/web/src/hooks/generated/
                                       apps/web/src/mocks/generated/
```

Run the full pipeline: `pnpm generate`

## orval.config.ts
```typescript
// apps/web/orval.config.ts
import { defineConfig } from 'orval';

export default defineConfig({
  app: {
    input: {
      target: '../../packages/api-spec/generated/openapi.json',
    },
    output: {
      target: './src/hooks/generated/index.ts',
      client: 'react-query',
      httpClient: 'fetch',
      override: {
        mutator: {
          path: './src/lib/api-client.ts',   // custom fetch with PingID auth
          name: 'customFetch',
        },
      },
      mock: {
        generators: [{ type: 'msw' }],       // MSW handlers for tests/dev
      },
      clean: true,
    },
  },
});
```

MSW mock output is configured separately in `orval.msw.config.ts` →
`apps/web/src/mocks/generated/`.

## Custom Fetch Client (with PingID auth)
```typescript
// apps/web/src/lib/api-client.ts
const getBaseUrl = () => process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

const generateCorrelationId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

type OkResponse<D> = { data: D; status: number; headers: Headers };

export const customFetch = async <T extends OkResponse<unknown>>(
  url: string,
  options: RequestInit = {},
): Promise<T> => {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-correlation-id': generateCorrelationId(),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fullUrl = url.startsWith('http') ? url : `${getBaseUrl()}${url}`;
  const response = await fetch(fullUrl, { ...options, headers });

  if (response.status === 401) {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('authUser');
    if (typeof window !== 'undefined') window.location.replace('/login');
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const body = (await response.json().catch(() => null)) as {
        detail?: string; title?: string;
      } | null;
      const message = body?.detail ?? body?.title ?? `${response.status} ${response.statusText}`;
      throw new Error(message);
    }
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  const data: unknown = contentType?.includes('application/json')
    ? await response.json()
    : undefined;

  return { data, status: response.status, headers: response.headers } as T;
};
```

## Generation Scripts
```jsonc
// package.json (root)
{
  "generate": "tsx scripts/generate.ts",     // full pipeline
  "generate:prisma": "pnpm --filter @repo/database generate",
  "generate:spec": "tsx --tsconfig apps/api/tsconfig.json apps/api/src/openapi/generate-spec.ts",
  "generate:hooks": "pnpm --filter @repo/web orval"
}
```

```jsonc
// turbo.json pipeline
{
  "generate": {
    "inputs": ["prisma/schema.prisma", "openapi/**/*.yaml"],
    "outputs": [
      "generated/**",
      "src/hooks/generated/**",
      "src/mocks/generated/**"
    ],
    "cache": true
  }
}
```

## Husky Pre-commit Hook
```bash
# .husky/pre-commit
# Detect if Prisma schema or Zod validation schemas changed
if git diff --cached --name-only | grep -qE 'packages/(database/prisma|validation/src)'; then
  echo "Schema changed — regenerating OpenAPI spec and hooks..."
  pnpm run generate:spec
  pnpm run generate:hooks
  git add packages/api-spec/generated/openapi.json \
          apps/web/src/hooks/generated/ \
          apps/web/src/mocks/generated/
fi
```

---

## Usage Patterns

### 1. Query (GET)
```typescript
// ✅ Use generated hook directly — never write useQuery manually
import { useGetItems } from '@/hooks/generated';

function FileList() {
  const { data, isLoading, error } = useGetItems({
    query: {
      staleTime: 5 * 60 * 1000,
      select: (data) => data.items,   // transform in select, not render
      enabled: !!orgId,               // conditional fetch
    }
  });

  if (isLoading) return <FileListSkeleton />;
  if (error) return <ErrorAlert error={error} />;

  return <FileTable files={data ?? []} />;
}
```

### 2. Query with Path Parameters
```typescript
import { useGetItemById } from '@/hooks/generated';

function FileDetail({ id }: { id: string }) {
  const { data: file } = useGetItemById(id, {
    query: { enabled: !!id }
  });
  return <FileView file={file} />;
}
```

### 3. Mutation (POST / PUT / DELETE)
```typescript
import { useCreateItem } from '@/hooks/generated';
import { useQueryClient } from '@tanstack/react-query';
import { getGetItemsQueryKey } from '@/hooks/generated';

function CreateFileButton() {
  const queryClient = useQueryClient();
  const { mutate, isPending } = useCreateItem({
    mutation: {
      onSuccess: () => {
        // Invalidate the list query so it refetches
        queryClient.invalidateQueries({ queryKey: getGetItemsQueryKey() });
        toast.success('File created');
      },
      onError: (error) => {
        toast.error(extractApiError(error)); // see error-handling-pattern.md
      },
    },
  });

  return (
    <Button onClick={() => mutate({ title: 'New File' })} loading={isPending}>
      Create File
    </Button>
  );
}
```

### 4. Prefetching (Next.js SSR)
```typescript
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { getItems, getGetItemsQueryKey } from '@/hooks/generated';

export default async function FilesPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: getGetItemsQueryKey(),
    queryFn: () => getItems(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FileList />
    </HydrationBoundary>
  );
}
```

### 5. Infinite / Cursor-Paginated Query
```typescript
import { useInfiniteGetItems } from '@/hooks/generated';

function InfiniteFileList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteGetItems(
      { limit: 20 },
      {
        query: {
          getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
          initialPageParam: undefined,
        },
      }
    );

  const files = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      {files.map((f) => <FileCard key={f.id} file={f} />)}
      {hasNextPage && (
        <Button onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
          Load more
        </Button>
      )}
    </>
  );
}
```

---

## Rules
- **NEVER** edit files in `src/hooks/generated/` or `src/mocks/generated/` — overwritten on every `pnpm generate`
- **NEVER** edit `packages/api-spec/generated/openapi.json` manually
- **NEVER** write manual `useQuery`/`useMutation`/`fetch`/`axios` calls — always use generated hooks
- Always run `pnpm generate` after Prisma schema or Zod validation changes before committing
- Keep custom hook compositions in `src/hooks/` (non-generated folder), wrapping generated hooks
- Always handle `isLoading` and `error` states — never render raw data without null checks
- Use `select` for data transformation inside the query options, not `useMemo` outside
- CI blocks merge if generated spec is stale
- Generated types are the contract — if they break, a Zod/Prisma schema changed

## Token Optimization

**Load when** when configuring orval, custom mutators, or MSW handler generation. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
