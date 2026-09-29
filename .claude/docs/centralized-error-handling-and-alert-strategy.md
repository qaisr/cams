# Centralized Error Handling & Alert Strategy

## Flow (never deviate from this)

```
Prisma/Domain throws
  → GlobalExceptionFilter (ONE place — transforms ALL errors)
  → RFC 7807 ProblemDetail JSON (single wire format)
  → customFetch throws ApiError (typed)
  → React Query catches
  → useErrorHandler() routes to correct UI layer
```

## Backend — Exception Hierarchy

```typescript
// packages/common/src/exceptions/index.ts
class AppException extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode: string,   // machine-readable — used by frontend
    public readonly correlationId?: string,
    public readonly meta?: Record<string, unknown>,
  ) { super(message); }
}

// Extend per status code:
class ValidationException  extends AppException { /* 400 — has errors: ValidationFieldError[] */ }
class UnauthorizedException extends AppException { /* 401 */ }
class ForbiddenException    extends AppException { /* 403 — has requiredPermission */ }
class NotFoundException     extends AppException { /* 404 — has resource + id */ }
class ConflictException     extends AppException { /* 409 — has resource + field + value */ }
class BusinessRuleException extends AppException { /* 422 — has ruleCode */ }
class RateLimitException    extends AppException { /* 429 — has retryAfterSeconds */ }
```

**Domain exceptions co-located with module:**

```typescript
// apps/api/src/modules/users/exceptions/user.exceptions.ts
class UserNotFoundException     extends NotFoundException    { constructor(id, corrId?) { super('User', id, corrId) } }
class UserEmailConflictException extends ConflictException  { constructor(email, corrId?) { super('User', 'email', email, corrId) } }
class UserCannotBeDeletedException extends BusinessRuleException { /* ... */ }
```

## Shared ProblemDetail Type (packages/common)

```typescript
// Used by BOTH api/ and web/ — single import
interface ProblemDetail {
  type: string;           // URI: https://api.example.com/errors/{code}
  title: string;
  status: number;
  detail: string;         // safe for display — sanitised by filter
  instance: string;       // request path
  correlationId: string;  // for support tracing
  timestamp: string;      // ISO 8601
  errors?: ValidationFieldError[];   // 400 only
  ruleCode?: string;                 // 422 only
  requiredPermission?: string;       // 403 only
}

interface ValidationFieldError {
  field: string;    // dot-notation: 'address.postcode'
  message: string;  // safe to show in UI
  code: string;     // Zod issue code: 'too_small', 'invalid_type'
}

// Type guards (packages/common)
isProblemDetail(e): e is ProblemDetail
isValidationError(e): e is ProblemDetail & { errors: ValidationFieldError[] }
```

## GlobalExceptionFilter — Mapping Rules

```
ZodValidationException          → 400, errors[] mapped from Zod issues
AppException subclass           → statusCode from exception, attach meta fields
Prisma P2002 (unique)           → 409 Conflict
Prisma P2025 (not found)        → 404 Not Found
Prisma P2003 (FK constraint)    → 409 Dependency Conflict
PrismaClientValidationError     → 400 Invalid Request
NestJS HttpException            → pass through status
Anything else                   → 500, generic message (never expose internals)
```

**Always:**

- Set `content-type: application/problem+json`
- Set `x-correlation-id` response header
- Log 5xx as `logger.error`, 4xx as `logger.warn`
- Never include stack traces in production responses

## Frontend — ApiError Wrapper

```typescript
// apps/web/src/lib/api-client.ts
class ApiError extends Error {
  constructor(public readonly problem: ProblemDetail) {
    super(problem.detail);
  }
}

// customFetch always throws ApiError on non-2xx
// React Query catches it → error: ApiError in query/mutation state
```

## Frontend — useErrorHandler (single hook for all errors)

```typescript
// apps/web/src/lib/errors/use-error-handler.ts
useErrorHandler<T extends FieldValues>({
  setError?: UseFormSetError<T>,  // if provided: 400 field errors → form fields
  messages?: Partial<Record<number | 'default', string>>,  // per-status overrides
})
// Returns: { handle: (error: unknown) => void }
```

**Routing logic:**
```
400 + setError provided   → map errors[] to form fields via setError() + summary toast
400 without setError      → destructive toast
401                       → redirect to /login?returnUrl=...  (no toast)
403                       → destructive toast + "Copy Error ID" action
404 (on mutation)         → default toast
409                       → destructive toast (use custom message override)
422                       → destructive toast
429                       → destructive toast "Please wait and try again"
5xx                       → destructive toast + "Copy Error ID" action
non-ApiError              → "Connection Error" toast
```

## Frontend — When to Use Which UI Layer

| Situation | Use |
|---|---|
| Mutation fails (create/update/delete) | `useErrorHandler` → toast |
| 400 with field errors | `useErrorHandler({ setError })` → form fields + toast |
| Query fails on initial load | `<ErrorBanner error={error} onRetry={refetch}>` |
| Background refetch fails | `QueryCache.onError` → toast (only if `query.state.data !== undefined`) |
| Mutation has no `onError` | `MutationCache.onError` → toast (fallback) |
| Page-level crash | `error.tsx` → `<ErrorBanner>` + reset button |
| Mutation succeeds | `useSuccessHandler().handle('created', 'User')` |

## QueryClient Setup (centralized error callbacks)

```typescript
// apps/web/src/lib/query-client.ts
new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Only toast on background refetch failure — not initial load
      if (query.state.data !== undefined && error instanceof ApiError) {
        toast({ variant: 'destructive', title: error.problem.title, description: error.problem.detail });
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      // Fallback only — component-level onError takes precedence
      if (error instanceof ApiError) {
        toast({ variant: 'destructive', title: error.problem.title, description: error.problem.detail });
      }
    },
  }),
  defaultOptions: {
    queries: {
      retry: (count, error) => error instanceof ApiError && error.problem.status < 500 ? false : count < 2,
    },
  },
});
```

## Canonical Usage Examples

### Mutation + form field errors

```typescript
const { handle: handleError }   = useErrorHandler({ setError: form.setError, messages: { 409: 'Email already in use' } });
const { handle: handleSuccess } = useSuccessHandler();

useCreateUser({ onSuccess: () => handleSuccess('created', 'User'), onError: handleError });
```

### Query + inline banner

```typescript
const { data, isError, error, refetch } = useGetUsers({ page: 1, limit: 20 });
if (isError) return <ErrorBanner error={error} onRetry={() => void refetch()} />;
```

### error.tsx (page boundary)

```typescript
// app/(protected)/users/error.tsx — required on every page folder
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorBanner error={error} onRetry={reset} />;
}
```

## Components (keep thin — logic lives in hooks)

```
<Toaster />       → place once in app/layout.tsx — renders all toasts
<ErrorBanner />   → inline persistent error (query load failure, error.tsx)
                    props: error: unknown, onRetry?: () => void
                    displays: title, detail, correlationId (copyable)
```

## useSuccessHandler

```typescript
useSuccessHandler().handle(
  action: 'created' | 'updated' | 'deleted' | 'saved' | 'submitted',
  resource: string,  // e.g. 'User', 'Order'
  description?: string,
)
// → toast: "{resource} {action} successfully"
```

## Rules Summary

- ONE GlobalExceptionFilter — never throw HttpException directly from services
- ONE ProblemDetail shape — backend and frontend share the type from @repo/common
- ONE ApiError class — customFetch always wraps non-2xx in ApiError
- ONE useErrorHandler — never write per-component error switch statements
- ONE Toaster — placed in root layout, never duplicated
- 401 → always redirect, never toast
- 5xx → always show correlationId so users can report it
- Never expose stack traces, Prisma internals, or class names in responses
- Server-provided `detail` is safe to display for status < 500

## File Locations

```
packages/common/src/exceptions/index.ts         AppException hierarchy
packages/common/src/types/problem-detail.ts     ProblemDetail + type guards
apps/api/src/common/filters/global-exception.filter.ts
apps/api/src/modules/{f}/exceptions/{f}.exceptions.ts
apps/web/src/lib/api-client.ts                  customFetch + ApiError
apps/web/src/lib/query-client.ts                QueryCache/MutationCache onError
apps/web/src/lib/errors/use-error-handler.ts
apps/web/src/lib/errors/use-success-handler.ts
apps/web/src/components/ui/ErrorBanner.tsx
apps/web/src/components/ui/toast/Toaster.tsx
apps/web/app/(protected)/{feature}/error.tsx    per-page boundary
```

## Cross-References

- API standards: `@.claude/standards/api-standards.md`
- Frontend standards: `@.claude/standards/frontend-standards.md`
- Security (no PII in errors): `@.claude/standards/security-standards.md`
- Observability (error logging): `@.claude/standards/observability-standards.md`
```