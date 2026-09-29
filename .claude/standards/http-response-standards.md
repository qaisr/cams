# HTTP API Response Standards

> **Load when**: designing endpoints, choosing status codes, designing error envelopes, or reviewing API responses. **Unload after** the endpoint contract is finalised and tested.

This standard defines **which HTTP status code** to use **when** and the **canonical response envelope** for both success and error cases. It complements `api-standards.md` (general API design) and `patterns/error-handling-pattern.md` (RFC 7807 details).

## Status Code Decision Tree

### Success (2xx)

| Code | Use when | Example |
| --- | --- | --- |
| **200 OK** | Synchronous read or update succeeds; response body returns the resource (or list) | `GET /requests/{id}` returning the request |
| **201 Created** | New resource created **synchronously**; response body returns the created resource; `Location` header points to it | `POST /requests` returning the new request |
| **202 Accepted** | Request accepted for **async** processing; response body returns a job/correlation ID; client polls or subscribes for result | `POST /reports/export` returning `{ jobId }` |
| **204 No Content** | Operation succeeded but no body to return; common for `DELETE` and idempotent state changes that the client already knows the result of | `DELETE /sessions/{id}` |

**Never** return 200 with `{ success: false }`. Use the appropriate 4xx/5xx code.

### Client Errors (4xx)

| Code | Use when | Versus |
| --- | --- | --- |
| **400 Bad Request** | Generic client error not matching a more specific code; request shape is wrong (e.g., malformed JSON) | not for validation — see 422 |
| **401 Unauthorized** | No credentials, expired token, invalid token | 403 means token is valid but lacks permission |
| **403 Forbidden** | Authenticated but not allowed to perform the action; or row-level deny | 401 means re-authenticate may help |
| **404 Not Found** | Resource does not exist **and** caller is allowed to know that | 403 if existence itself is sensitive |
| **405 Method Not Allowed** | Endpoint exists, method is not supported (must include `Allow` header) | rare in REST-by-convention APIs |
| **409 Conflict** | Idempotency-key collision; optimistic-concurrency mismatch; duplicate unique-key insert | 422 if business rule prevents creation |
| **410 Gone** | Resource intentionally permanently removed (e.g., right-to-be-forgotten records) | 404 for non-existent or unknown |
| **412 Precondition Failed** | `If-Match` / `If-Unmodified-Since` failed | concurrency control |
| **413 Payload Too Large** | Body exceeds configured limit (e.g., file upload) | enforce at ALB + NestJS Fastify |
| **415 Unsupported Media Type** | `Content-Type` not supported (e.g., XML when only JSON accepted) | rare |
| **422 Unprocessable Entity** | **Zod validation failed** — request shape is valid JSON but fields fail business/format rules | 400 only for unparseable bodies |
| **429 Too Many Requests** | Rate-limit exceeded; include `Retry-After` and `RateLimit-*` headers | applies per-IP or per-token |

### Server Errors (5xx)

| Code | Use when |
| --- | --- |
| **500 Internal Server Error** | Unhandled exception. **Never include stack traces in body.** Always log with correlation ID. |
| **502 Bad Gateway** | Upstream dependency (e.g., PingID, downstream service) returned an invalid response |
| **503 Service Unavailable** | Maintenance mode, circuit-breaker open, capacity exhausted; include `Retry-After` |
| **504 Gateway Timeout** | Upstream timeout; include correlation ID |

## Canonical Success Response

```jsonc
{
  "data": { /* resource or list */ },
  "meta": {                            // optional, only when needed
    "page": { "cursor": "abc", "next": "def" },
    "total": 1234
  }
}
```

- **Single resource**: `data` is the object directly.
- **Collection**: `data` is an array. `meta.page` carries cursor info per `pagination-cursor-pattern.md`.
- **No `success: true` field.** A 2xx code IS the success signal.
- Always emit `X-Correlation-Id` header (mirrored from request or freshly minted).

## Canonical Error Response (RFC 7807)

```jsonc
{
  "type": "https://docs.ppcc/errors/validation",      // stable URI per error class
  "title": "Validation failed",                       // short human title
  "status": 422,                                      // mirrors HTTP status
  "detail": "One or more fields failed validation.",  // user-displayable
  "instance": "/requests",                            // request path
  "code": "VALIDATION_FAILED",                        // stable machine code
  "correlationId": "8f3a-2b7e-...",                  // for logs / support
  "errors": [                                         // optional: per-field for 422
    { "path": "email",  "code": "format",   "message": "Email must include @ and a domain." },
    { "path": "amount", "code": "tooSmall", "message": "Amount must be at least 1." }
  ]
}
```

- Centralised in NestJS via `templates/nestjs-exception-filter.ts`.
- **Never** expose internal exception messages or stack traces.
- **Never** hint at sensitive existence (e.g., "user not found" vs "wrong password" — always 401 with the same generic message).

## Headers Every Response Must Include

| Header | Purpose |
| --- | --- |
| `X-Correlation-Id` | Tracks the request through logs, X-Ray, and downstream services |
| `Content-Type: application/json; charset=utf-8` | Always JSON; never plain text on errors |
| `Cache-Control` | Default `no-store` for authenticated endpoints |
| `Strict-Transport-Security` | API Gateway level |
| `X-Content-Type-Options: nosniff` | API Gateway level |
| `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` | When rate-limited endpoints |

## Response Shape Per Method

| Method | Success code | Body | Headers |
| --- | --- | --- | --- |
| `GET /resource` | 200 | `{ data: resource }` | `Cache-Control` per resource |
| `GET /resources` | 200 | `{ data: [...], meta: { page } }` | `Cache-Control: no-store` |
| `POST /resource` | 201 | `{ data: created }` | `Location: /resource/{id}` |
| `POST /resource` (async) | 202 | `{ data: { jobId } }` | `Location: /jobs/{id}` |
| `PUT /resource/{id}` | 200 | `{ data: updated }` | — |
| `PATCH /resource/{id}` | 200 | `{ data: updated }` | — |
| `DELETE /resource/{id}` | 204 | empty | — |
| `POST /actions/...` | 200 \| 202 | `{ data: result }` or `{ data: { jobId } }` | — |

## Pagination

- Cursor pagination is the default for collections — see `patterns/pagination-cursor-pattern.md`.
- Page meta in `meta.page`, never as top-level fields.
- `Link` header is optional; cursor in body is canonical.

## Versioning

- URL versioning: `/v1/...`. Breaking changes go to `/v2/...`.
- `Sunset` header on deprecated endpoints; `Deprecation` header points at successor.
- See `patterns/api-versioning-pattern.md`.

## Idempotency

- All mutating endpoints (POST/PUT/PATCH/DELETE) accept `Idempotency-Key` header.
- Replays of a key within the retention window return the original response with the same status code.
- Conflicts (key reused with different body) return **409 Conflict**.

## Content Negotiation

- Default `application/json`. Reject other types with **415**.
- Compression: gzip (auto via API Gateway).
- File downloads use a separate endpoint family (`/files/...`) with binary types — out of scope for this JSON standard.

## Rate Limiting

- Per-token + per-IP. Limit and burst configured per route.
- Return **429** with `Retry-After` (seconds) and the `RateLimit-*` headers.
- Always wire alarms — see `observability-standards.md`.

## Anti-Patterns

- ❌ Returning `200` with an error envelope ("HTTP says OK so my code can return success: false").
- ❌ Using `400` for validation errors (use `422`).
- ❌ Using `404` for unauthorized access to existing resources (use `403`).
- ❌ Echoing user input verbatim into `detail` without sanitisation.
- ❌ Returning different shapes per endpoint (always envelope-wrap with `data` / `errors`).
- ❌ Embedding stack traces or internal class names in any response.

## Token Optimization

- **Load when**: designing or reviewing API responses; choosing status codes; setting up exception filters.
- **Load only**: this standard + `api-standards.md` + `error-handling-pattern.md` + `patterns/api-versioning-pattern.md` (when versioning).
- **Unload after**: endpoint contract finalised and contract test passes.

## Cross-References

- API standards (general design): `@.claude/standards/api-standards.md`
- Zod + OpenAPI pattern: `@.claude/patterns/zod-openapi-pattern.md`
- Error handling pattern: `@.claude/patterns/error-handling-pattern.md`
- Pagination: `@.claude/patterns/pagination-cursor-pattern.md`
- API versioning: `@.claude/patterns/api-versioning-pattern.md`
- Exception filter template: `@.claude/templates/nestjs-exception-filter.ts`
- API contract test template: `@.claude/templates/api-contract-test.ts`
- Security headers / CORS / CSP: `@.claude/standards/security-standards.md`
- Observability (logging, metrics, alarms): `@.claude/standards/observability-standards.md`
