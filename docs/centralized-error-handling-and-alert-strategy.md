# Centralized Error Handling & Alert Strategy

## Core Philosophy

```
One error shape (RFC 7807) flows from DB → Service → API → Frontend
One alert system renders it consistently everywhere
Zero duplicate error definitions
```

---

## The Full Flow

```
Prisma/Domain throws
       │
       ▼
GlobalExceptionFilter          ← NestJS (single place — transforms ALL errors)
       │
       ▼
RFC 7807 ProblemDetail JSON    ← single wire format
       │
       ▼
customFetch throws ProblemDetail ← frontend (typed throw)
       │
       ▼
React Query catches it         ← error sits in query/mutation state
       │
       ├─► Field errors    → react-hook-form setError()
       ├─► Toast alerts    → useToast() (transient — mutations)
       ├─► Inline banners  → <ErrorBanner> (persistent — page errors)
       └─► Error boundary  → error.tsx (unrecoverable — page crash)
```

---

## Part 1: Backend — NestJS

### Exception Hierarchy

```typescript
// packages/common/src/exceptions/index.ts
// Single file — all domain exceptions extend AppException

export class AppException extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode: string, // machine-readable — used by frontend
    public readonly correlationId?: string,
    public readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    // Preserve stack across async boundaries
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ── 400 ──────────────────────────────────────────────────────────────────────
export class ValidationException extends AppException {
  constructor(
    public readonly errors: ValidationFieldError[],
    correlationId?: string,
  ) {
    super('Validation Failed', 400, 'VALIDATION_ERROR', correlationId);
  }
}

export interface ValidationFieldError {
  field: string;
  message: string;
  code: string; // e.g. 'too_small', 'invalid_type' — matches Zod issue codes
}

// ── 401 ──────────────────────────────────────────────────────────────────────
export class UnauthorizedException extends AppException {
  constructor(reason = 'Authentication required', correlationId?: string) {
    super(reason, 401, 'UNAUTHORIZED', correlationId);
  }
}

// ── 403 ──────────────────────────────────────────────────────────────────────
export class ForbiddenException extends AppException {
  constructor(
    public readonly requiredPermission: string,
    correlationId?: string,
  ) {
    super(
      `Permission required: ${requiredPermission}`,
      403,
      'FORBIDDEN',
      correlationId,
      { requiredPermission },
    );
  }
}

// ── 404 ──────────────────────────────────────────────────────────────────────
export class NotFoundException extends AppException {
  constructor(resource: string, id: string, correlationId?: string) {
    super(`${resource} '${id}' not found`, 404, 'NOT_FOUND', correlationId, {
      resource,
      id,
    });
  }
}

// ── 409 ──────────────────────────────────────────────────────────────────────
export class ConflictException extends AppException {
  constructor(
    resource: string,
    field: string,
    value: string,
    correlationId?: string,
  ) {
    super(
      `${resource} with ${field} '${value}' already exists`,
      409,
      'CONFLICT',
      correlationId,
      { resource, field, value },
    );
  }
}

// ── 422 ──────────────────────────────────────────────────────────────────────
export class BusinessRuleException extends AppException {
  constructor(
    message: string,
    public readonly ruleCode: string,
    correlationId?: string,
  ) {
    super(message, 422, 'BUSINESS_RULE_VIOLATION', correlationId, { ruleCode });
  }
}

// ── 429 ──────────────────────────────────────────────────────────────────────
export class RateLimitException extends AppException {
  constructor(retryAfterSeconds: number, correlationId?: string) {
    super('Too many requests', 429, 'RATE_LIMITED', correlationId, {
      retryAfterSeconds,
    });
  }
}
```

### Domain-Specific Exceptions (co-located with module)

```typescript
// apps/api/src/modules/users/exceptions/user.exceptions.ts
import {
  NotFoundException,
  ConflictException,
  BusinessRuleException,
} from '@repo/common';

export class UserNotFoundException extends NotFoundException {
  constructor(id: string, correlationId?: string) {
    super('User', id, correlationId);
  }
}

export class UserEmailConflictException extends ConflictException {
  constructor(email: string, correlationId?: string) {
    super('User', 'email', email, correlationId);
  }
}

export class UserCannotBeDeletedException extends BusinessRuleException {
  constructor(id: string, reason: string, correlationId?: string) {
    super(
      `User '${id}' cannot be deleted: ${reason}`,
      'USER_DELETE_BLOCKED',
      correlationId,
    );
  }
}
```

### RFC 7807 ProblemDetail Type (shared)

```typescript
// packages/common/src/types/problem-detail.ts
// This exact shape is used on both backend (response) and frontend (error type)

export interface ProblemDetail {
  type: string; // URI — https://api.example.com/errors/{code}
  title: string; // Short human-readable title
  status: number; // HTTP status code
  detail: string; // Full explanation (safe for display)
  instance: string; // Request path
  correlationId: string; // x-correlation-id — for support tracing
  timestamp: string; // ISO 8601
  // Present only on 400 validation errors
  errors?: ValidationFieldError[];
  // Present only on 422 business rule violations
  ruleCode?: string;
  // Present only on 403
  requiredPermission?: string;
}

export interface ValidationFieldError {
  field: string; // dot-notation path e.g. 'address.postcode'
  message: string; // human-readable — safe to display in UI
  code: string; // machine-readable — 'too_small', 'invalid_type', etc.
}
```

### Global Exception Filter

```typescript
// apps/api/src/common/filters/global-exception.filter.ts
import {
  type ExceptionFilter,
  Catch,
  type ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodValidationException } from 'nestjs-zod';
import { Prisma } from '@prisma/client';
import { AppException, ValidationException } from '@repo/common';
import type { ProblemDetail, ValidationFieldError } from '@repo/common';

const BASE_URL =
  process.env.API_ERROR_BASE_URL ?? 'https://api.example.com/errors';
const IS_PROD = process.env.NODE_ENV === 'production';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();
    const correlationId =
      (request.headers['x-correlation-id'] as string) ?? 'unknown';

    const problem = this.toProblemDetail(exception, request, correlationId);

    // Structured logging — different levels by severity
    if (problem.status >= 500) {
      this.logger.error({
        action: 'unhandledException',
        correlationId,
        path: request.url,
        method: request.method,
        status: problem.status,
        errorCode: problem.type,
        errorMessage: problem.detail,
        // Stack only in non-production logs
        ...(IS_PROD
          ? {}
          : {
              stack: exception instanceof Error ? exception.stack : undefined,
            }),
      });
    } else if (problem.status >= 400) {
      this.logger.warn({
        action: 'clientError',
        correlationId,
        path: request.url,
        method: request.method,
        status: problem.status,
        errorCode: problem.type,
        detail: problem.detail,
      });
    }

    void reply
      .status(problem.status)
      .header('x-correlation-id', correlationId)
      .header('content-type', 'application/problem+json')
      .send(problem);
  }

  private toProblemDetail(
    exception: unknown,
    request: FastifyRequest,
    correlationId: string,
  ): ProblemDetail {
    const base = {
      instance: request.url,
      correlationId,
      timestamp: new Date().toISOString(),
    };

    // ── Zod validation (nestjs-zod) ──────────────────────────────────────────
    if (exception instanceof ZodValidationException) {
      const errors: ValidationFieldError[] = exception
        .getZodError()
        .errors.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        }));

      return {
        ...base,
        type: `${BASE_URL}/validation-error`,
        title: 'Validation Failed',
        status: 400,
        detail: 'One or more fields failed validation',
        errors,
      };
    }

    // ── Domain exceptions ────────────────────────────────────────────────────
    if (exception instanceof AppException) {
      const problem: ProblemDetail = {
        ...base,
        type: `${BASE_URL}/${exception.errorCode.toLowerCase().replace(/_/g, '-')}`,
        title: this.toTitle(exception.errorCode),
        status: exception.statusCode,
        detail: exception.message,
      };

      // Attach structured fields for specific types
      if (exception instanceof ValidationException) {
        problem.errors = exception.errors;
      }
      if (exception.meta?.ruleCode) {
        problem.ruleCode = exception.meta.ruleCode as string;
      }
      if (exception.meta?.requiredPermission) {
        problem.requiredPermission = exception.meta
          .requiredPermission as string;
      }

      return problem;
    }

    // ── Prisma known errors ──────────────────────────────────────────────────
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception, base);
    }

    // ── Prisma validation errors ─────────────────────────────────────────────
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        ...base,
        type: `${BASE_URL}/invalid-request`,
        title: 'Invalid Request',
        status: 400,
        detail: IS_PROD ? 'Invalid request data' : exception.message,
      };
    }

    // ── NestJS HttpException (guards, passport, etc.) ────────────────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      return {
        ...base,
        type: `${BASE_URL}/http-${status}`,
        title: exception.message,
        status,
        detail: typeof body === 'string' ? body : exception.message,
      };
    }

    // ── Unhandled — never expose internals ───────────────────────────────────
    return {
      ...base,
      type: `${BASE_URL}/internal-error`,
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail:
        'An unexpected error occurred. Please try again or contact support.',
    };
  }

  private handlePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
    base: Pick<ProblemDetail, 'instance' | 'correlationId' | 'timestamp'>,
  ): ProblemDetail {
    switch (exception.code) {
      case 'P2002': // Unique constraint
        return {
          ...base,
          type: `${BASE_URL}/conflict`,
          title: 'Conflict',
          status: 409,
          detail: 'A record with this value already exists',
        };
      case 'P2025': // Record not found
        return {
          ...base,
          type: `${BASE_URL}/not-found`,
          title: 'Not Found',
          status: 404,
          detail: 'The requested record does not exist',
        };
      case 'P2003': // FK constraint
        return {
          ...base,
          type: `${BASE_URL}/conflict`,
          title: 'Dependency Conflict',
          status: 409,
          detail:
            'This record is referenced by other records and cannot be modified',
        };
      default:
        return {
          ...base,
          type: `${BASE_URL}/database-error`,
          title: 'Database Error',
          status: 500,
          detail: 'An unexpected database error occurred',
        };
    }
  }

  private toTitle(errorCode: string): string {
    return errorCode
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  }
}
```

### Register in bootstrap.ts

```typescript
// apps/api/src/bootstrap.ts
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

export async function bootstrapApp(app: NestFastifyApplication) {
  app.useGlobalFilters(new GlobalExceptionFilter());
  // ... rest of bootstrap
}
```

---

## Part 2: Frontend — Shared Types + API Client

### Shared ProblemDetail type (consumed by frontend)

```typescript
// packages/common/src/types/problem-detail.ts — same file as backend
// Both api/ and web/ import from @repo/common

export function isProblemDetail(error: unknown): error is ProblemDetail {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'type' in error &&
    'correlationId' in error
  );
}

export function isValidationError(
  error: unknown,
): error is ProblemDetail & { errors: ValidationFieldError[] } {
  return (
    isProblemDetail(error) && Array.isArray((error as ProblemDetail).errors)
  );
}

export function isForbiddenError(error: unknown): error is ProblemDetail {
  return isProblemDetail(error) && error.status === 403;
}

export function isNotFoundError(error: unknown): error is ProblemDetail {
  return isProblemDetail(error) && error.status === 404;
}
```

### customFetch — throws typed ProblemDetail

```typescript
// apps/web/src/lib/api-client.ts
import type { ProblemDetail } from '@repo/common';
import { isProblemDetail } from '@repo/common';

export class ApiError extends Error {
  constructor(public readonly problem: ProblemDetail) {
    super(problem.detail);
    this.name = 'ApiError';
  }
}

export async function customFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { params, body, ...init } = options;
  const url = buildUrl(path, params);

  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-correlation-id': crypto.randomUUID(),
      ...getAuthHeaders(),
      ...init.headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    // Always throw a typed ProblemDetail — React Query catches this
    const problem: ProblemDetail = isProblemDetail(data)
      ? data
      : {
          type: 'https://api.example.com/errors/unknown',
          title: 'Unknown Error',
          status: response.status,
          detail: response.statusText,
          instance: path,
          correlationId: response.headers.get('x-correlation-id') ?? 'unknown',
          timestamp: new Date().toISOString(),
        };
    throw new ApiError(problem);
  }

  return data as T;
}
```

---

## Part 3: Frontend — Alert System

### Toast + Banner + Field Errors — one hook rules them all

```typescript
// apps/web/src/lib/errors/use-error-handler.ts
'use client';
import { useCallback } from 'react';
import { type FieldValues, type UseFormSetError } from 'react-hook-form';
import { isProblemDetail, isValidationError } from '@repo/common';
import { useToast } from '@/components/ui/toast/use-toast';
import { ApiError } from '@/lib/api-client';

interface ErrorHandlerOptions<T extends FieldValues> {
  // If provided, 400 validation errors are mapped to form fields
  setError?: UseFormSetError<T>;
  // Override default user-facing messages per status code
  messages?: Partial<Record<number | 'default', string>>;
}

export function useErrorHandler<T extends FieldValues = FieldValues>(
  options: ErrorHandlerOptions<T> = {},
) {
  const { toast } = useToast();

  const handle = useCallback(
    (error: unknown) => {
      const problem = error instanceof ApiError
        ? error.problem
        : isProblemDetail(error) ? error : null;

      if (!problem) {
        // Non-API error (network failure, JSON parse error, etc.)
        toast({
          variant:     'destructive',
          title:       'Connection Error',
          description: 'Unable to reach the server. Please check your connection.',
        });
        return;
      }

      const userMessage =
        options.messages?.[problem.status] ??
        options.messages?.['default'] ??
        getDefaultMessage(problem);

      switch (problem.status) {
        case 400:
          if (isValidationError(problem) && options.setError) {
            // Map server field errors → react-hook-form field errors
            problem.errors!.forEach(({ field, message }) => {
              options.setError!(
                field as Parameters<UseFormSetError<T>>[0],
                { type: 'server', message },
              );
            });
            // Also show a summary toast
            toast({
              variant:     'destructive',
              title:       'Please fix the errors below',
              description: `${problem.errors!.length} field(s) need attention`,
            });
          } else {
            toast({ variant: 'destructive', title: 'Invalid Request', description: userMessage });
          }
          break;

        case 401:
          // Don't toast — redirect to login
          window.location.href = `/login?returnUrl=${encodeURIComponent(window.location.pathname)}`;
          break;

        case 403:
          toast({
            variant:     'destructive',
            title:       'Access Denied',
            description: userMessage,
            // Show support correlation ID so users can report it
            action:      <ToastAction altText="Copy ID" onClick={() =>
              navigator.clipboard.writeText(problem.correlationId)
            }>Copy Error ID</ToastAction>,
          });
          break;

        case 404:
          toast({ variant: 'default', title: 'Not Found', description: userMessage });
          break;

        case 409:
          toast({ variant: 'destructive', title: 'Already Exists', description: userMessage });
          break;

        case 422:
          toast({
            variant:     'destructive',
            title:       'Action Not Allowed',
            description: userMessage,
          });
          break;

        case 429:
          toast({
            variant:     'destructive',
            title:       'Too Many Requests',
            description: 'Please wait a moment and try again.',
          });
          break;

        default:
          toast({
            variant:     'destructive',
            title:       'Something Went Wrong',
            description: userMessage,
            action:      <ToastAction altText="Copy ID" onClick={() =>
              navigator.clipboard.writeText(problem.correlationId)
            }>Copy Error ID</ToastAction>,
          });
      }
    },
    [toast, options],
  );

  return { handle };
}

function getDefaultMessage(problem: ProblemDetail): string {
  // Use server-provided detail when safe — it's already sanitised by GlobalExceptionFilter
  if (problem.detail && problem.status < 500) {
    return problem.detail;
  }
  return 'Something went wrong. If this persists, contact support.';
}
```

### Toast component (shadcn/ui pattern)

```typescript
// apps/web/src/components/ui/toast/Toaster.tsx
// Place once in root layout — receives all toasts from useToast()
'use client';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './toast';
import { useToast } from './use-toast';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, variant, ...props }) => (
        <Toast key={id} variant={variant} {...props}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
```

```typescript
// apps/web/app/layout.tsx — wire in once
import { Toaster } from '@/components/ui/toast/Toaster';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {children}
            <Toaster />  {/* single global toaster */}
          </AuthProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

### Inline Error Banner (persistent page-level errors)

```typescript
// apps/web/src/components/ui/ErrorBanner.tsx
// For query errors that can't be toasted — data failed to load
import { isProblemDetail } from '@repo/common';
import { ApiError } from '@/lib/api-client';

interface Props {
  error: unknown;
  onRetry?: () => void;
}

export function ErrorBanner({ error, onRetry }: Props) {
  const problem = error instanceof ApiError
    ? error.problem
    : isProblemDetail(error) ? error : null;

  const title       = problem?.title ?? 'Something went wrong';
  const detail      = problem && problem.status < 500
    ? problem.detail
    : 'Please try again or contact support.';
  const correlationId = problem?.correlationId;

  return (
    <div role="alert" aria-live="assertive" className="error-banner">
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
        {correlationId && (
          <small>
            Error ID:{' '}
            <button
              onClick={() => navigator.clipboard.writeText(correlationId)}
              aria-label="Copy error ID to clipboard"
            >
              {correlationId}
            </button>
          </small>
        )}
      </div>
      {onRetry && (
        <button onClick={onRetry} aria-label="Retry">
          Try again
        </button>
      )}
    </div>
  );
}
```

---

## Part 4: Usage Patterns

### Pattern A: Mutation with form field errors + toast

```typescript
// apps/web/src/components/users/CreateUserForm.tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateUserDto, type CreateUserDtoType } from '@repo/validation';
import { useCreateUser } from '@/hooks/generated/users';
import { useErrorHandler } from '@/lib/errors/use-error-handler';

export function CreateUserForm() {
  const form = useForm<CreateUserDtoType>({
    resolver: zodResolver(CreateUserDto),
  });

  // setError wires server field errors back to form fields
  const { handle } = useErrorHandler<CreateUserDtoType>({
    setError: form.setError,
    messages: {
      409: 'A user with this email already exists. Please use a different email.',
    },
  });

  const { mutate, isPending } = useCreateUser({
    onSuccess: () => {
      form.reset();
      // Success toast handled in generated hook or here
    },
    onError: handle,   // ← single line — all errors handled
  });

  return (
    <form onSubmit={form.handleSubmit((data) => mutate(data))} noValidate>
      <label htmlFor="email">Email *</label>
      <input
        id="email"
        {...form.register('email')}
        aria-invalid={!!form.formState.errors.email}
        aria-describedby={form.formState.errors.email ? 'email-error' : undefined}
      />
      {form.formState.errors.email && (
        <span id="email-error" role="alert">
          {form.formState.errors.email.message}
        </span>
      )}

      <button type="submit" disabled={isPending} aria-busy={isPending}>
        {isPending ? 'Creating...' : 'Create User'}
      </button>
    </form>
  );
}
```

### Pattern B: Query error with inline banner + retry

```typescript
// apps/web/src/components/users/UserList.tsx
'use client';
import { useGetUsers } from '@/hooks/generated/users';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

export function UserList() {
  const { data, isLoading, isError, error, refetch } = useGetUsers({
    page: 1,
    limit: 20,
  });

  if (isLoading) return <UserListSkeleton />;

  if (isError) {
    return (
      <ErrorBanner
        error={error}
        onRetry={() => void refetch()}  // ← retry button
      />
    );
  }

  if (!data?.data.length) return <EmptyState />;

  return (
    <>
      {data.data.map((user) => <UserCard key={user.id} user={user} />)}
    </>
  );
}
```

### Pattern C: Global React Query error handler (background refetch failures)

```typescript
// apps/web/src/lib/query-client.ts
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-client';
import { toast } from '@/components/ui/toast/use-toast';

export function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Only show toast for background refetch failures
        // (initial load failures are shown via ErrorBanner in component)
        if (query.state.data !== undefined && error instanceof ApiError) {
          toast({
            variant: 'destructive',
            title: 'Failed to refresh data',
            description: error.problem.detail,
          });
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        // Fallback — component-level onError takes precedence
        // This only fires if the mutation has no onError handler
        if (error instanceof ApiError) {
          toast({
            variant: 'destructive',
            title: error.problem.title,
            description: error.problem.detail,
          });
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.problem.status < 500)
            return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
    },
  });
}
```

### Pattern D: Next.js error.tsx (unrecoverable page crash)

```typescript
// apps/web/app/(protected)/users/error.tsx
'use client';
import { useEffect } from 'react';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function UsersError({ error, reset }: Props) {
  useEffect(() => {
    // Log to monitoring (Sentry, CloudWatch RUM, etc.)
    console.error('[Page Error]', error);
  }, [error]);

  return (
    <main>
      <ErrorBanner
        error={error}
        onRetry={reset}
      />
    </main>
  );
}
```

---

## Part 5: Success Alerts

```typescript
// apps/web/src/lib/errors/use-success-handler.ts
// Mirror of useErrorHandler — consistent success messaging
'use client';
import { useCallback } from 'react';
import { useToast } from '@/components/ui/toast/use-toast';

type SuccessAction = 'created' | 'updated' | 'deleted' | 'saved' | 'submitted';

const DEFAULT_MESSAGES: Record<SuccessAction, (resource: string) => string> = {
  created: (r) => `${r} created successfully`,
  updated: (r) => `${r} updated successfully`,
  deleted: (r) => `${r} deleted`,
  saved: (r) => `${r} saved`,
  submitted: (r) => `${r} submitted successfully`,
};

export function useSuccessHandler() {
  const { toast } = useToast();

  const handle = useCallback(
    (action: SuccessAction, resource: string, description?: string) => {
      toast({
        variant: 'default',
        title: DEFAULT_MESSAGES[action](resource),
        description: description,
      });
    },
    [toast],
  );

  return { handle };
}
```

```typescript
// Usage alongside useErrorHandler in a mutation
const { handle: handleError } = useErrorHandler({ setError: form.setError });
const { handle: handleSuccess } = useSuccessHandler();

const { mutate } = useCreateUser({
  onSuccess: () => handleSuccess('created', 'User'),
  onError: handleError,
});
```

---

## Summary

```
Layer               Responsibility                          Location
────────────────────────────────────────────────────────────────────────
AppException        Typed domain errors with errorCode      packages/common
GlobalExceptionFilter  Catches ALL errors → RFC 7807        apps/api (global)
ProblemDetail type  Single wire format — backend + frontend packages/common
ApiError            Wraps ProblemDetail as JS Error         apps/web/lib
QueryCache.onError  Background refetch failures → toast     query-client.ts
MutationCache.onError  Unhandled mutation fallback → toast  query-client.ts
useErrorHandler     400 → form fields, 4xx/5xx → toast      apps/web/lib
useSuccessHandler   Consistent success toasts               apps/web/lib
ErrorBanner         Inline persistent error (query fail)    apps/web/components
error.tsx           Unrecoverable page crash boundary       app/(protected)/*/
Toaster             Single global toast renderer            app/layout.tsx
```

### Decision Guide

```
Error type                          → Where to handle
────────────────────────────────────────────────────────
400 with field errors               → useErrorHandler({ setError }) → form fields
400 without field errors            → useErrorHandler → toast
401                                 → useErrorHandler → redirect to login
403                                 → useErrorHandler → toast with error ID
404 on mutation                     → useErrorHandler → toast
404 on page load (query)            → ErrorBanner with retry
409 conflict                        → useErrorHandler (custom message) → toast
422 business rule                   → useErrorHandler → toast
429 rate limit                      → useErrorHandler → toast
500                                 → useErrorHandler → toast with error ID
Background refetch failure          → QueryCache.onError → toast
Unhandled mutation (no onError)     → MutationCache.onError → toast
Page crash (React error boundary)   → error.tsx → ErrorBanner + reset
```
