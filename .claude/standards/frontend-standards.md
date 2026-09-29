# Frontend Standards — NextJS 16/TypeScript (CSR Default)

## Stack Reference
- NextJS 16 (App Router, **CSR default**), TypeScript 6.x, React 19
- **@tanstack/react-query v5** — server state management (all API data)
- **orval** — generates typed React Query hooks from OpenAPI spec (do not write hooks manually)
- React Hook Form + Zod (shared schemas from `@repo/validation`)
- Zustand — client-only UI state (not server data)
- Jest + React Testing Library + MSW, Playwright
- PingID JWT auth (RS256/JWKS) — never Cognito; all routes protected
- **Monorepo**: pnpm workspaces, types from `@repo/validation` and `apps/web/src/hooks/generated/`

---

## Critical: TanStack Query + orval Relationship

```
@tanstack/react-query     ← engine (caching, refetch, mutations, devtools)
        ↑
      orval               ← generates typed wrappers — do NOT write these by hand
        ↑
  OpenAPI spec            ← source of truth for what hooks exist
        ↑
  Zod schemas             ← source of truth for types
        ↑
  schema.prisma           ← origin of everything
```

**Rules**:
- NEVER write `useQuery`/`useMutation` wrappers manually for API endpoints — use generated hooks
- NEVER edit `apps/web/src/hooks/generated/` — regenerate via `pnpm orval`
- DO use `useQueryClient()` directly for cache invalidation, optimistic updates, prefetching
- DO extend generated hooks with options (onSuccess, onError, select, enabled) at call site
- DO configure `QueryClient` globally for retry logic and error defaults

---

## 1. Rendering Strategy

**Default: Client-Side Rendering (CSR)**
- Use `'use client'` in pages and components by default
- Simpler, easier to reason about for enterprise internal apps

**Optional: Server Components + Prefetching**
- Only when SEO or faster initial paint is specifically requested
- Use `queryClient.prefetchQuery()` with generated query keys for hydration

### Server vs Client Decision Matrix

| Use Server Components when | Use Client Components when |
|---|---|
| Read-mostly content, no browser events | Needs `useState`, `useEffect`, `useReducer` |
| SEO metadata matters | Browser-only APIs (`window`, `localStorage`) |
| Data fetched once at route level | Rich interactivity (forms, wizards, inline edit) |
| Prefetching for hydration | Consuming React Query hooks |

Rule: Keep `'use client'` boundaries as small as possible.

---

## 2. Project Structure

```
apps/web/src/
├── app/                        # NextJS App Router
│   ├── (auth)/                 # Auth pages (login, unauthorized)
│   ├── (protected)/            # PingID-protected routes
│   │   ├── layout.tsx          # Auth guard layout
│   │   └── {feature}/
│   │       ├── page.tsx        # 'use client' default
│   │       ├── loading.tsx
│   │       └── error.tsx
│   ├── api/                    # NextJS route handlers (thin BFF proxy)
│   └── layout.tsx
├── components/
│   ├── ui/                     # Generic primitives
│   ├── {feature}/              # Feature-scoped components
│   └── layout/                 # Shell, nav, sidebar
├── hooks/
│   ├── generated/              # ← orval output — DO NOT EDIT
│   │   ├── users.ts            # useGetUsers, useCreateUser, getUsersQueryKey, etc.
│   │   └── posts.ts
│   └── {feature}.hooks.ts     # Hand-written extensions on generated hooks
├── mocks/
│   ├── generated/              # ← orval MSW output — DO NOT EDIT
│   ├── server.ts               # MSW server setup
│   └── browser.ts              # MSW browser setup
├── lib/
│   ├── query-client.ts         # QueryClient factory with defaults
│   ├── api-client.ts           # fetch wrapper (used by orval mutator)
│   └── auth/                   # Auth context and utilities
├── types/                      # Local TS types (never duplicate @repo/validation)
└── constants/                  # Routes, config constants
```

---

## 3. QueryClient Setup

```typescript
// apps/web/src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';
import type { ProblemDetail } from '@repo/validation';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,          // 1 minute — avoids refetch on tab focus for fresh data
        retry: (failureCount, error) => {
          // Never retry on 4xx — only on network errors or 5xx
          if (isProblemDetail(error) && error.status < 500) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,   // Enterprise apps — disable aggressive refetch
      },
      mutations: {
        // Global mutation error is a fallback — component-level onError takes precedence
        onError: (error) => {
          console.error('[Mutation Error]', error);
        },
      },
    },
  });
}

function isProblemDetail(error: unknown): error is ProblemDetail {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as ProblemDetail).status === 'number'
  );
}
```

```typescript
// apps/web/src/app/layout.tsx (root layout)
'use client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { makeQueryClient } from '@/lib/query-client';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // useState ensures one QueryClient per component tree (Next.js App Router safe)
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
          {process.env.NODE_ENV === 'development' && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

---

## 4. orval-Generated Hooks — Usage Patterns

### What orval generates (DO NOT write manually)
```typescript
// apps/web/src/hooks/generated/users.ts — AUTO-GENERATED
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Query key factory — use for cache invalidation
export const getUsersQueryKey = (params?: PaginationDtoType) =>
  ['users', params] as const;

export const getGetUsersQueryOptions = (params: PaginationDtoType) => ({
  queryKey: getUsersQueryKey(params),
  queryFn: () => customFetch<PaginatedResponse<UserResponseDtoType>>('/v1/users', { params }),
});

// Generated React Query hooks
export const useGetUsers = (
  params: PaginationDtoType,
  options?: UseQueryOptions<PaginatedResponse<UserResponseDtoType>>
) => useQuery({ ...getGetUsersQueryOptions(params), ...options });

export const useGetUserById = (
  id: string,
  options?: UseQueryOptions<UserResponseDtoType>
) => useQuery({
  queryKey: ['users', id],
  queryFn: () => customFetch<UserResponseDtoType>(`/v1/users/${id}`),
  enabled: !!id,
  ...options,
});

export const useCreateUser = (
  options?: UseMutationOptions<UserResponseDtoType, ProblemDetail, CreateUserDtoType>
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto) => customFetch('/v1/users', { method: 'POST', body: dto }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getUsersQueryKey() });
    },
    ...options,
  });
};
```

### Direct usage in components (standard pattern)
```typescript
'use client';
// Import from generated — never write useQuery directly for API calls
import { useGetUsers, useCreateUser } from '@/hooks/generated/users';
import { CreateUserDto, type CreateUserDtoType } from '@repo/validation'; // shared schema

export function UserListPage() {
  const { data, isLoading, isError, error } = useGetUsers({ page: 1, limit: 20 });

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorMessage error={error} />;

  return <UserList users={data?.data ?? []} total={data?.total ?? 0} />;
}

export function CreateUserButton() {
  const { mutate, isPending, isError, error } = useCreateUser({
    onSuccess: (user) => {
      toast.success(`User ${user.name} created`);
    },
    onError: (err) => {
      toast.error(err.detail ?? 'Failed to create user');
    },
  });

  return (
    <button onClick={() => mutate({ email: 'new@example.com', name: 'New User' })}
            disabled={isPending}
            aria-busy={isPending}>
      {isPending ? 'Creating...' : 'Create User'}
    </button>
  );
}
```

---

## 5. Extending Generated Hooks (Advanced Patterns)

### Pattern A: Passing options at call site
```typescript
// No new file needed — pass options directly to generated hook
const { data } = useGetUsers(
  { page: 1, limit: 20 },
  {
    select: (data) => data.data,           // transform response
    enabled: !!tenantId,                   // conditional fetch
    placeholderData: keepPreviousData,     // pagination UX
    staleTime: 5 * 60 * 1000,             // override global stale time
  }
);
```

### Pattern B: Optimistic updates (hand-written extension)
```typescript
// apps/web/src/hooks/users.hooks.ts
// HAND-WRITTEN — only when generated hook needs custom cache manipulation
import { useQueryClient } from '@tanstack/react-query';
import { useCreateUser, getUsersQueryKey } from './generated/users';
import type { UserResponseDtoType, CreateUserDtoType } from '@repo/validation';

export function useCreateUserOptimistic() {
  const queryClient = useQueryClient();

  return useCreateUser({
    onMutate: async (newUser: CreateUserDtoType) => {
      // Cancel in-flight queries to avoid overwrite
      await queryClient.cancelQueries({ queryKey: getUsersQueryKey() });

      // Snapshot for rollback
      const previous = queryClient.getQueryData<UserResponseDtoType[]>(getUsersQueryKey());

      // Optimistically add placeholder
      queryClient.setQueryData(getUsersQueryKey(), (old: UserResponseDtoType[] = []) => [
        ...old,
        { ...newUser, id: 'temp-optimistic', createdAt: new Date().toISOString() },
      ]);

      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Roll back on failure
      queryClient.setQueryData(getUsersQueryKey(), context?.previous);
    },
    onSettled: () => {
      // Always sync with server after mutation
      queryClient.invalidateQueries({ queryKey: getUsersQueryKey() });
    },
  });
}
```

### Pattern C: Manual cache invalidation
```typescript
'use client';
import { useQueryClient } from '@tanstack/react-query';
import { getUsersQueryKey, getGetUserByIdQueryKey } from '@/hooks/generated/users';

export function useRefreshUserData(userId: string) {
  const queryClient = useQueryClient();

  return {
    refreshList: () =>
      queryClient.invalidateQueries({ queryKey: getUsersQueryKey() }),
    refreshOne: () =>
      queryClient.invalidateQueries({ queryKey: ['users', userId] }),
    prefetchNext: (params: PaginationDtoType) =>
      queryClient.prefetchQuery(getGetUsersQueryOptions(params)),
  };
}
```

### Pattern D: Server-side prefetch (Next.js App Router)
```typescript
// apps/web/src/app/(protected)/users/page.tsx
// Only use when SSR is explicitly requested for performance
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { getGetUsersQueryOptions } from '@/hooks/generated/users';
import { fetchUsersServer } from '@/lib/api-server';
import { UserList } from './UserList';

export default async function UsersPage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    ...getGetUsersQueryOptions({ page: 1, limit: 20 }),
    queryFn: () => fetchUsersServer({ page: 1, limit: 20 }), // server-side fetcher
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserList />  {/* useGetUsers() hits cache immediately — no loading flash */}
    </HydrationBoundary>
  );
}
```

---

## 6. Form Pattern (React Hook Form + Shared Zod Schema)

```typescript
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
// ALWAYS use shared schema from @repo/validation — same as backend validation
import { CreateUserDto, type CreateUserDtoType } from '@repo/validation';
import { useCreateUser } from '@/hooks/generated/users';

export function CreateUserForm() {
  const { mutate: createUser, isPending, error: apiError } = useCreateUser({
    onSuccess: () => form.reset(),
  });

  const form = useForm<CreateUserDtoType>({
    resolver: zodResolver(CreateUserDto),   // same Zod schema as backend
    defaultValues: { email: '', name: '', password: '' },
  });

  return (
    <form onSubmit={form.handleSubmit((data) => createUser(data))} noValidate>
      <label htmlFor="email">Email *</label>
      <input
        id="email"
        type="email"
        {...form.register('email')}
        aria-invalid={!!form.formState.errors.email}
        aria-describedby={form.formState.errors.email ? 'email-error' : undefined}
      />
      {form.formState.errors.email && (
        // Error messages come from Zod schema — defined once in schema.prisma comments
        <span id="email-error" role="alert">
          {form.formState.errors.email.message}
        </span>
      )}

      {/* API error (RFC 7807) */}
      {apiError && (
        <div role="alert" aria-live="assertive">
          {getErrorMessage(apiError)}
        </div>
      )}

      <button type="submit" disabled={isPending} aria-busy={isPending}>
        {isPending ? 'Creating...' : 'Create User'}
      </button>
    </form>
  );
}

// Translate RFC 7807 ProblemDetail → user-friendly message
function getErrorMessage(error: unknown): string {
  if (isProblemDetail(error)) {
    if (error.status === 409) return 'A user with this email already exists';
    if (error.status === 403) return 'You do not have permission to create users';
    if (error.status === 400) return error.detail ?? 'Please check your input';
    return error.detail ?? 'Something went wrong';
  }
  return 'Something went wrong. Please try again.';
}
```

---

## 7. State Management — TanStack Query vs Zustand

| Data Type | Use | Why |
|---|---|---|
| API / server data | `@tanstack/react-query` (generated hooks) | Caching, background sync, deduplication |
| Form state | `react-hook-form` | Optimized re-renders, Zod integration |
| Global UI state (modals, sidebar, theme) | `zustand` | Simple, no boilerplate |
| Derived from server data | `select` option in `useQuery` | Keeps cache as single source |
| URL / filter state | `useSearchParams` (Next.js) | Shareable, back-button safe |

**Anti-patterns to avoid**:
```typescript
// ❌ NEVER store server data in Zustand
const useUserStore = create((set) => ({
  users: [],  // ← belongs in React Query cache
  fetchUsers: async () => { ... },
}));

// ❌ NEVER useState for data that comes from an API
const [users, setUsers] = useState([]);
useEffect(() => { fetch('/users').then(...) }, []);

// ✅ Always use generated React Query hook
const { data: users } = useGetUsers({ page: 1, limit: 20 });
```

---

## 8. API Client (fetch wrapper — used by orval)

```typescript
// apps/web/src/lib/api-client.ts
// This is the mutator that orval uses — configure in orval.config.ts

import { randomUUID } from 'crypto';
import type { ProblemDetail } from '@repo/validation';

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export async function customFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { params, body, ...init } = options;

  // Build URL with query params
  const url = new URL(path, process.env.NEXT_PUBLIC_API_BASE_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });
  }

  const token = getAuthToken(); // from auth context / cookie

  const response = await fetch(url.toString(), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-correlation-id': randomUUID(),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...init.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    // Parse RFC 7807 ProblemDetail and throw — React Query catches this
    const problem: ProblemDetail = await response.json().catch(() => ({
      type: 'https://api.example.com/errors/unknown',
      title: 'Unknown Error',
      status: response.status,
      detail: response.statusText,
      instance: path,
      correlationId: 'unknown',
      timestamp: new Date().toISOString(),
    }));
    throw problem;
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

function getAuthToken(): string | null {
  // Read from cookie or auth context
  if (typeof document === 'undefined') return null;
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith('auth-token='))
    ?.split('=')[1] ?? null;
}
```

```typescript
// apps/web/orval.config.ts
import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: {
      target: '../../packages/api-spec/generated/openapi.json',
      validation: true,
    },
    output: {
      mode: 'tags-split',                           // Split by OpenAPI tags
      target: './src/hooks/generated',
      schemas: './src/types/generated',
      client: 'react-query',
      httpClient: 'fetch',
      override: {
        mutator: {
          path: './src/lib/api-client.ts',
          name: 'customFetch',
        },
        query: {
          useQuery: true,
          useMutation: true,
          useInfinite: true,                        // Infinite scroll support
          signal: true,                             // AbortSignal for cleanup
        },
      },
    },
  },
  // Separate config for MSW mock handlers
  apiMock: {
    input: '../../packages/api-spec/generated/openapi.json',
    output: {
      mode: 'tags-split',
      target: './src/mocks/generated',
      client: 'msw',
    },
  },
});
```

---

## 9. Auth Context + React Query Integration

```typescript
// apps/web/src/lib/auth/AuthContext.tsx
'use client';
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface User {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'x-correlation-id': crypto.randomUUID() },
      });
      if (res.ok) setUser(await res.json());
      else setUser(null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-correlation-id': crypto.randomUUID() },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) throw new Error('Login failed');
      setUser((await res.json()).user);  // ✅ Update context — prevents dashboard loading flash
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    // ✅ Clear all React Query cache on logout — prevents stale data leakage
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      logout,
      hasRole: (role) => user?.roles.includes(role) ?? false,
      hasPermission: (p) => user?.permissions.includes(p) ?? false,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

---

## 10. Protected Page Pattern

```typescript
'use client';
// apps/web/src/app/(protected)/dashboard/page.tsx
import { useAuth } from '@/lib/auth/AuthContext';
import { useGetUsers } from '@/hooks/generated/users';     // generated hook
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { user, isLoading: authLoading, hasPermission } = useAuth();
  const router = useRouter();

  // React Query hook — only fires when user is authenticated
  const { data, isLoading: dataLoading } = useGetUsers(
    { page: 1, limit: 5 },
    { enabled: !!user }   // ← don't fetch until auth confirmed
  );

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  if (authLoading || dataLoading) return <LoadingSpinner />;
  if (!user) return null;  // redirecting

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      {hasPermission('user:read') && <RecentUsers users={data?.data ?? []} />}
    </div>
  );
}
```

---

## 11. Loading, Error, and Empty States (Mandatory)

Every component that uses a React Query hook **must** handle all states:

```typescript
'use client';
import { useGetUsers } from '@/hooks/generated/users';

export function UserList() {
  const { data, isLoading, isError, error, isFetching } = useGetUsers({ page: 1, limit: 20 });

  // Loading state
  if (isLoading) {
    return (
      <div aria-live="polite" aria-busy={true}>
        <UserListSkeleton />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div role="alert">
        <ErrorMessage
          title="Failed to load users"
          detail={isProblemDetail(error) ? error.detail : 'Please try again'}
        />
      </div>
    );
  }

  // Empty state
  if (!data?.data.length) {
    return (
      <EmptyState
        title="No users yet"
        action={<CreateUserButton />}
      />
    );
  }

  // Success state — show stale indicator during background refetch
  return (
    <div aria-live="polite" aria-busy={isFetching}>
      {isFetching && <div aria-label="Refreshing..." className="sr-only" />}
      {data.data.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
      <Pagination total={data.total} page={data.page} limit={data.limit} />
    </div>
  );
}
```

### Section-11 states vs. error boundaries — two different jobs

Per-hook `isError` handling (above) covers **expected, recoverable** failures for
one query (a 4xx/5xx from the API). It does **not** catch a render-time exception
(a thrown error in a child component, a null-deref). Those must be caught by an
App Router **error boundary** (`error.tsx`). Use both — they are not
interchangeable.

### Error Boundary Placement (App Router)

`error.tsx` is a Client Component that React renders when any component in its
route segment subtree throws during render. Placement is a deliberate design
decision — the file lives at the level whose failure it should contain:

```
app/
├── global-error.tsx        ← last resort: catches errors in the ROOT layout
│                              (replaces <html>/<body>; must render them itself)
├── error.tsx               ← catches errors anywhere below the root layout
└── (dashboard)/
    ├── layout.tsx
    ├── error.tsx           ← ✅ contains dashboard failures WITHOUT unmounting
    │                          the nav/layout — user keeps context and can retry
    └── reports/
        ├── error.tsx       ← granular: a broken report doesn't blank the dashboard
        └── page.tsx
```

Placement rules:

- **One `error.tsx` per meaningful failure boundary**, not one global catch-all.
  A boundary co-located with a route segment isolates the blast radius — sibling
  segments and the parent layout keep rendering.
- **An `error.tsx` does NOT catch errors in the `layout.tsx` of its own
  segment** (the layout sits above the boundary). To catch a layout's own
  errors, put the boundary in the **parent** segment.
- **`global-error.tsx`** only catches root-layout errors and is the sole boundary
  that must render its own `<html>` and `<body>` (it replaces the root layout).
  Keep it minimal and dependency-free — if it throws, nothing renders.
- **`not-found.tsx`** and **`loading.tsx`** are separate concerns (404 / Suspense
  fallback) — do not funnel those through error boundaries.

```tsx
// app/(dashboard)/reports/error.tsx
'use client'; // error boundaries are ALWAYS Client Components

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ReportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // `digest` correlates to the server-side log entry — report to observability
    console.error('[reports.error]', error.digest, error.message);
  }, [error]);

  return (
    <div role="alert" className="p-6">
      <h2 className="text-lg font-semibold">Couldn’t load reports</h2>
      <p className="text-base-content/70">Try again, or contact support if it persists.</p>
      <Button onClick={reset} className="mt-4">
        Retry
      </Button>
    </div>
  );
}
```

Reference template: `@.claude/templates/react-error-boundary.tsx`.

---

## 12. Accessibility (WCAG 2.1 AA — Mandatory)

```typescript
// ✅ Loading states — announce to screen readers
<div aria-live="polite" aria-busy={isLoading}>
  {isLoading ? <Spinner aria-label="Loading users" /> : <UserList />}
</div>

// ✅ Mutation pending state
<button disabled={isPending} aria-busy={isPending}>
  {isPending ? 'Saving...' : 'Save'}
</button>

// ✅ Form error association
<input aria-invalid={!!error} aria-describedby={error ? 'field-error' : undefined} />
<span id="field-error" role="alert">{error?.message}</span>

// ✅ Interactive elements — explicit labels
<button aria-label={`Delete ${user.name}`}>
  <TrashIcon aria-hidden="true" />
</button>

// ✅ Skip navigation
<a href="#main-content" className="skip-link">Skip to main content</a>
```

---

## 13. TypeScript Rules

```typescript
// ❌ Never
const data: any = response;

// ✅ Always infer from Zod schemas — never duplicate
import { CreateUserDto } from '@repo/validation';
type CreateUserDtoType = z.infer<typeof CreateUserDto>;

// ✅ Type imports for type-only usage
import type { UserResponseDtoType } from '@repo/validation';

// ✅ Use discriminated unions for component state
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: ProblemDetail };

// ✅ Parse API responses with Zod at boundaries (belt-and-suspenders)
const user = UserResponseDto.parse(rawData);
```

---

## 14. Routing & Navigation

```typescript
// ✅ Always next/link — never <a href> for internal links
import Link from 'next/link';
<Link href={ROUTES.USER_DETAIL(id)}>View User</Link>

// ✅ Route constants — no magic strings
export const ROUTES = {
  DASHBOARD:    '/dashboard',
  USERS:        '/users',
  USER_DETAIL:  (id: string) => `/users/${id}`,
  USER_NEW:     '/users/new',
} as const;
```

---

## 15. Environment Variables

```typescript
// NEXT_PUBLIC_* — client-visible, never put secrets here
// Server-only vars — only available in route handlers and server components

// Import `z` from the shared package (OpenAPI-extended), never from 'zod' directly.
import { z } from '@repo/validation';

const EnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
});

export const env = EnvSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
});
```

---

## 16. Performance

```typescript
// Dynamic import for heavy components
import dynamic from 'next/dynamic';
const HeavyChart = dynamic(() => import('@/components/charts/HeavyChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

// Pagination UX — keep previous data while fetching next page
import { keepPreviousData } from '@tanstack/react-query';
const { data } = useGetUsers({ page }, { placeholderData: keepPreviousData });

// Infinite scroll
const { data, fetchNextPage, hasNextPage } = useGetUsersInfinite(
  { limit: 20 },
  { getNextPageParam: (last) => last.page < last.totalPages ? last.page + 1 : undefined }
);
```

---

## 17. Quality Checklist

- [ ] No manually written `useQuery`/`useMutation` for API calls — using generated hooks
- [ ] Generated files in `hooks/generated/` and `mocks/generated/` not manually edited
- [ ] orval regenerated after any OpenAPI spec change (`pnpm orval`)
- [ ] `QueryClient` configured with retry logic and error defaults
- [ ] `queryClient.clear()` called on logout
- [ ] All hooks have loading, error, and empty states handled
- [ ] Forms use shared Zod schema from `@repo/validation` (same as backend)
- [ ] Zustand only for UI state — never server/API data
- [ ] Server data never duplicated in `useState` or Zustand
- [ ] `enabled` option used when query depends on auth or other conditions
- [ ] `'use client'` used appropriately (default for pages/components)
- [ ] Error boundary on all pages
- [ ] WCAG 2.1 AA: `aria-live`, `aria-busy`, `aria-invalid`, `aria-describedby`
- [ ] No `any` TypeScript types
- [ ] `next/link` for all navigation, `next/image` for images
- [ ] JWT middleware protecting all routes
- [ ] `queryClient.clear()` on logout prevents cross-user data leakage

## Cross-References
- API standards: `@.claude/standards/api-standards.md`
- Shared validation: `packages/validation/src/`
- Generated hooks: `apps/web/src/hooks/generated/` (orval output)
- Testing: `@.claude/standards/testing-standards.md`
- Security: `@.claude/standards/security-standards.md`
- orval config: `apps/web/orval.config.ts`

## Token Optimization

- **Load when**: any Next.js/React work — pages, components, hooks, data fetching, forms, state.
- **Load only**: this standard + `component-usage.md` + `state-management-standards.md`. Add `accessibility-standards.md` for any user-facing surface.
- **Unload after**: component/page passes lint, type-check, component tests, and (where in scope) Playwright E2E.
