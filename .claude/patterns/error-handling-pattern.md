# Error Handling Pattern — NestJS RFC 7807

## Principles

1. Fail fast — validate early, surface errors immediately
2. RFC 7807 ProblemDetail on all API error responses
3. Correlation ID on every error — links logs to request
4. Never expose stack traces in production responses
5. Log with context — enough to diagnose without PII
6. Structured errors — machines and humans can both parse them

---

## Exception Hierarchy

```typescript
// packages/common/src/exceptions/base.exception.ts
export abstract class AppException extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode: string,
    public readonly correlationId?: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
    if (cause) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

export class NotFoundException extends AppException {
  constructor(resource: string, id: string, correlationId?: string) {
    super(
      `${resource} with id '${id}' not found`,
      404,
      'RESOURCE_NOT_FOUND',
      correlationId,
    );
  }
}

export class ConflictException extends AppException {
  constructor(message: string, correlationId?: string) {
    super(message, 409, 'DUPLICATE_RESOURCE', correlationId);
  }
}

export class ValidationException extends AppException {
  constructor(
    public readonly errors: ValidationError[],
    correlationId?: string,
  ) {
    // 422 Unprocessable Entity — body parsed but fields failed validation.
    // 400 is reserved for unparseable bodies. Matches http-response-standards.md
    // and the real GlobalExceptionFilter (ZodError → 422).
    super('Validation Failed', 422, 'VALIDATION_FAILED', correlationId);
  }
}

export class ForbiddenException extends AppException {
  constructor(message = 'Insufficient permissions', correlationId?: string) {
    super(message, 403, 'ACCESS_DENIED', correlationId);
  }
}

export class BusinessRuleException extends AppException {
  constructor(rule: string, message: string, correlationId?: string) {
    super(message, 422, `BUSINESS_RULE_${rule.toUpperCase()}`, correlationId);
  }
}

export class UpstreamServiceException extends AppException {
  constructor(
    public readonly serviceName: string,
    message: string,
    correlationId?: string,
    cause?: Error,
  ) {
    super(message, 502, 'UPSTREAM_ERROR', correlationId, cause);
  }
}

export class UnauthorizedException extends AppException {
  constructor(message = 'Authentication required', correlationId?: string) {
    super(message, 401, 'UNAUTHORIZED', correlationId);
  }
}

export class RateLimitException extends AppException {
  constructor(message = 'Too many requests', correlationId?: string) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', correlationId);
  }
}

export class ServiceUnavailableException extends AppException {
  constructor(message = 'Service temporarily unavailable', correlationId?: string) {
    super(message, 503, 'SERVICE_UNAVAILABLE', correlationId);
  }
}
```

---

## Domain-Specific Exceptions (co-locate with module)

```typescript
// src/modules/users/exceptions/user.exceptions.ts
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
    super(`User with email '${email}' already exists`, correlationId);
  }
}

export class UserInactiveException extends BusinessRuleException {
  constructor(userId: string, correlationId?: string) {
    super(
      'USER_INACTIVE',
      `Cannot perform action on inactive user: ${userId}`,
      correlationId,
    );
  }
}
```

---

## Global Exception Filter (RFC 7807 ProblemDetail)

```typescript
// src/common/filters/global-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodValidationException } from 'nestjs-zod';
import { Prisma } from '@repo/database';
import { AppException, ForbiddenException, UpstreamServiceException } from '@repo/common';

interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  correlationId: string;
  timestamp: string;
  errors?: unknown[]; // validation errors only
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly baseUri = process.env.ERROR_URI_BASE ?? 'https://api.example.com/errors/';
  private readonly isProd = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<FastifyRequest>();
    const res = ctx.getResponse<FastifyReply>();

    const correlationId =
      (req.headers['x-correlation-id'] as string) ?? 'unknown';

    const problem = this.toProblemDetail(exception, req, correlationId);

    // Structured logging
    if (problem.status >= 500) {
      this.logger.error({
        action: 'handleError',
        type: 'unexpected',
        method: req.method,
        path: req.url,
        correlationId,
        status: problem.status,
        errorCode: problem.type,
        message: exception instanceof Error ? exception.message : String(exception),
        // Stack trace only in non-prod or when explicitly needed
        ...((!this.isProd || problem.status === 500) && exception instanceof Error
          ? { stack: exception.stack }
          : {}),
      });
    } else if (problem.status === 401 || problem.status === 403) {
      // Do not log sensitive auth details — just the fact it happened
      this.logger.warn({
        action: 'handleError',
        type: problem.status === 401 ? 'unauthorized' : 'accessDenied',
        method: req.method,
        path: req.url,
        correlationId,
      });
    } else {
      this.logger.warn({
        action: 'handleError',
        type: 'clientError',
        method: req.method,
        path: req.url,
        correlationId,
        status: problem.status,
        detail: problem.detail,
      });
    }

    // Fastify reply: .status().header().send() — NOT Express .setHeader().json()
    void res
      .status(problem.status)
      .header('content-type', 'application/problem+json')
      .header('x-correlation-id', correlationId)
      .send(problem);
  }

  private toProblemDetail(
    exception: unknown,
    req: FastifyRequest,
    correlationId: string,
  ): ProblemDetail {
    const base = {
      instance: req.url,
      correlationId,
      timestamp: new Date().toISOString(),
    };

    // ─── Validation Errors ────────────────────────────────────────────────────
    if (exception instanceof ZodValidationException) {
      const errors = exception.getZodError().errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return {
        ...base,
        type: `${this.baseUri}validation`,
        title: 'Validation Failed',
        status: 422, // Unprocessable Entity — body parsed, fields invalid (400 = unparseable)
        detail: errors.map((e) => `${e.field}: ${e.message}`).join('; '),
        errors,
      };
    }

    // ─── Domain Exceptions ────────────────────────────────────────────────────
    if (exception instanceof AppException) {
      // Special handling for access denied — sanitize message
      if (exception instanceof ForbiddenException) {
        return {
          ...base,
          type: `${this.baseUri}forbidden`,
          title: 'Forbidden',
          status: 403,
          detail: 'You do not have permission to perform this action.',
        };
      }

      // Special handling for upstream errors
      if (exception instanceof UpstreamServiceException) {
        return {
          ...base,
          type: `${this.baseUri}upstream-error`,
          title: 'Bad Gateway',
          status: 502,
          detail: this.isProd
            ? 'A dependent service is temporarily unavailable.'
            : `${exception.serviceName}: ${exception.message}`,
        };
      }

      return {
        ...base,
        type: `${this.baseUri}${exception.errorCode.toLowerCase().replace(/_/g, '-')}`,
        title: exception.errorCode.replace(/_/g, ' '),
        status: exception.statusCode,
        detail: exception.message,
      };
    }

    // ─── Prisma Errors ────────────────────────────────────────────────────────
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint violation → 409
      if (exception.code === 'P2002') {
        return {
          ...base,
          type: `${this.baseUri}conflict`,
          title: 'Conflict',
          status: 409,
          detail: 'A record with this value already exists',
        };
      }
      // Foreign key constraint → 422
      if (exception.code === 'P2003') {
        return {
          ...base,
          type: `${this.baseUri}business-rule`,
          title: 'Business Rule Violation',
          status: 422,
          detail: 'Referenced resource does not exist',
        };
      }
      // Record not found (for delete/update operations)
      if (exception.code === 'P2025') {
        return {
          ...base,
          type: `${this.baseUri}not-found`,
          title: 'Not Found',
          status: 404,
          detail: 'The requested resource was not found',
        };
      }
    }

    // ─── NestJS HttpException ─────────────────────────────────────────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const detail =
        typeof response === 'string'
          ? response
          : (response as any).message ?? exception.message;

      return {
        ...base,
        type: `${this.baseUri}http-${status}`,
        title: HttpStatus[status] ?? 'Error',
        status,
        detail: Array.isArray(detail) ? detail.join('; ') : detail,
      };
    }

    // ─── Unhandled → 500 ──────────────────────────────────────────────────────
    return {
      ...base,
      type: `${this.baseUri}internal`,
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: this.isProd
        ? 'An unexpected error occurred.'
        : exception instanceof Error
          ? exception.message
          : String(exception),
    };
  }
}
```

---

## Register in bootstrap.ts

Shared bootstrap logic lives in `apps/api/src/bootstrap.ts` (called by
`main.ts` which starts the long-lived Fastify server), so the
filter is registered once for every entry point.

```typescript
// apps/api/src/bootstrap.ts
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ZodValidationPipe } from 'nestjs-zod';

export async function bootstrap(app: NestFastifyApplication) {
  // Exception filter registered globally — catches domain, Zod, Prisma, and HTTP errors
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Zod validation pipe (never class-validator) — validation failures surface as 422
  app.useGlobalPipes(new ZodValidationPipe());

  // Fastify security plugins registered here too — see security-standards.md
}
```

---

## Correlation ID Middleware

```typescript
// src/common/middleware/correlation-id.middleware.ts
// On @nestjs/platform-fastify, class middleware receives the RAW Node req/res
// (via @fastify/middie), so we type against Node's IncomingMessage/ServerResponse.
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationIdMiddleware.name);

  use(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const existing = req.headers['x-correlation-id'] as string | undefined;
    const id = existing?.trim() ? existing : randomUUID();

    req.headers['x-correlation-id'] = id;
    res.setHeader('x-correlation-id', id);

    this.logger.log({
      action: 'incomingRequest',
      method: req.method,
      path: req.url,
      correlationId: id,
    });

    next();
  }
}
```

> Alternatively, register a Fastify `onRequest` hook in `main.ts`
> for correlation IDs — it runs earlier in the lifecycle than class middleware.

**Register in AppModule:**

```typescript
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
```

---

## Service Usage Pattern

```typescript
// ✅ Correct — throw domain exception with correlationId
async findById(id: string, correlationId?: string) {
  const record = await this.prisma.user.findFirst({
    where: { id, deletedAt: null },
  });

  if (!record) {
    throw new UserNotFoundException(id, correlationId);
    // → GlobalExceptionFilter → 404 ProblemDetail with correlationId
  }

  return record;
}

// ✅ Business rule validation
async createUser(dto: CreateUserDto, correlationId?: string) {
  if (dto.age < 18) {
    throw new BusinessRuleException(
      'MIN_AGE',
      'User must be at least 18 years old',
      correlationId,
    );
  }

  try {
    return await this.prisma.user.create({ data: dto });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new UserEmailConflictException(dto.email, correlationId);
    }
    throw error; // Re-throw for GlobalExceptionFilter
  }
}

// ✅ Upstream service call with error wrapping
async fetchExternalData(userId: string, correlationId?: string) {
  try {
    const response = await this.httpService.axiosRef.get(
      `https://external-api.com/users/${userId}`,
    );
    return response.data;
  } catch (error) {
    throw new UpstreamServiceException(
      'ExternalAPI',
      'Failed to fetch user data from external service',
      correlationId,
      error instanceof Error ? error : undefined,
    );
  }
}
```

---

## Logging Standards for Errors

```typescript
// ✅ Correct — structured, no PII, actionable
this.logger.error({
  action: 'processPayment',
  status: 'error',
  orderId,
  correlationId,
  errorCode: exception.errorCode,
  message: exception.message,
});

// ✅ Warn for expected errors (404, validation, auth)
this.logger.warn({
  action: 'findOrder',
  status: 'notFound',
  orderId,
  correlationId,
});

// ❌ Never — PII in logs
this.logger.error(`Payment failed for ${customerName} (${cardNumber})`);

// ❌ Never — unstructured string logs
this.logger.error('Error: ' + exception.stack);

// ✅ Instead — structured log with optional stack in non-prod
this.logger.error({
  action: 'processPayment',
  correlationId,
  error: exception.message,
  ...(process.env.NODE_ENV !== 'production' ? { stack: exception.stack } : {}),
});
```

---

## Frontend Error Handling (mirrors backend RFC 7807 structure)

```typescript
// lib/errors.ts
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    public readonly detail: string | undefined,
    public readonly correlationId: string,
    public readonly type: string,
  ) {
    super(detail ?? title);
    this.name = 'ApiError';
  }

  isNotFound(): boolean {
    return this.status === 404;
  }
  isUnauthorized(): boolean {
    return this.status === 401;
  }
  isForbidden(): boolean {
    return this.status === 403;
  }
  isValidation(): boolean {
    return this.status === 400;
  }
  isConflict(): boolean {
    return this.status === 409;
  }
  isServer(): boolean {
    return this.status >= 500;
  }
}

// lib/custom-fetch.ts — the orval mutator. orval-generated hooks call this,
// so ALL API errors flow through here. No axios: this project's client is
// fetch-based (see .claude/patterns/orval-codegen-pattern.md).
export async function customFetch<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${url}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  }).catch(() => {
    throw new ApiError(
      0,
      'Network Error',
      'Unable to connect. Check your network connection.',
      'network-error',
      'network',
    );
  });

  if (!res.ok) {
    const problem = (await res.json().catch(() => ({}))) as Partial<ProblemDetail>;
    const apiError = new ApiError(
      res.status,
      problem.title ?? 'Error',
      problem.detail ?? res.statusText,
      problem.correlationId ?? res.headers.get('x-correlation-id') ?? 'unknown',
      problem.type ?? 'unknown',
    );
    if (apiError.isUnauthorized()) redirectToLogin();
    throw apiError;
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

// ─── Error Message Mapping ────────────────────────────────────────────────────
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isValidation()) return error.detail ?? 'Please check your input.';
    if (error.isNotFound()) return 'The requested item was not found.';
    if (error.isForbidden())
      return 'You do not have permission for this action.';
    if (error.isConflict()) return error.detail ?? 'A conflict occurred.';
    if (error.isServer()) return 'Something went wrong. Please try again.';
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred.';
}
```

---

## Error Code Reference

| HTTP | Error Code              | When to Use                      |
| ---- | ----------------------- | -------------------------------- |
| 422  | VALIDATION_FAILED       | Field validation errors (body parsed, fields invalid) |
| 400  | MALFORMED_REQUEST       | Unparseable request body         |
| 401  | UNAUTHORIZED            | Missing/invalid auth token       |
| 403  | ACCESS_DENIED           | Valid token, insufficient scope  |
| 404  | RESOURCE_NOT_FOUND      | Entity not found by ID           |
| 409  | DUPLICATE_RESOURCE      | Unique constraint violation      |
| 422  | BUSINESS_RULE_{NAME}    | Domain rule violation            |
| 429  | RATE_LIMIT_EXCEEDED     | Rate limiting triggered          |
| 500  | INTERNAL_ERROR          | Unexpected server error          |
| 502  | UPSTREAM_ERROR          | Downstream service failure       |
| 503  | SERVICE_UNAVAILABLE     | Circuit breaker open             |

---

## Cross-References

- API standards: `@.claude/standards/api-standards.md`
- Frontend standards: `@.claude/standards/frontend-standards.md`
- Observability: `@.claude/standards/observability-standards.md`
- Security: `@.claude/standards/security-standards.md`

## Token Optimization

**Load when** when designing error envelopes (RFC 7807), exception filters, or HTTP error contracts. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
