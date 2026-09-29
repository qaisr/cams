# Authorization Patterns and Architecture

**Quick reference for implementing auth and authorization.**

## Architecture Overview

```
Next.js (NextAuth) → Internal ALB → NestJS Fargate (JwtAuthGuard)
        ↕ OAuth 2.0 + PKCE
    PingSSO (SignOn.PPCC)
```

- **AuthN**: NestJS `JwtAuthGuard` (passport-jwt + jwks-rsa) validates JWT (sig, exp, iss, aud via JWKS). Bad tokens rejected in-app before reaching any handler.
- **AuthZ**: NestJS reads validated claims from the decoded token payload. Group-based RBAC via `GroupsGuard`.
- **Local dev**: `MockAuthStrategy` injects fake user. `GroupsGuard` runs with identical code.

## Responsibility Split

| Concern | Production (JwtAuthGuard) | Local (MockAuthStrategy) |
|---------|---------------------------|--------------------------|
| Token signature validation | `JwtAuthGuard` via JWKS (jwks-rsa) | Skipped |
| Issuer / audience check | `JwtAuthGuard` | Skipped |
| Token expiry check | `JwtAuthGuard` | Skipped |
| User identity extraction | Decoded JWT payload claims | Env vars or `x-mock-user` header |
| Group-based RBAC | NestJS `GroupsGuard` | NestJS `GroupsGuard` (identical) |
| Route-level public/private | `AuthGuard` + `@Public()` | `AuthGuard` + `@Public()` (identical) |

Key insight: AuthZ code (guards, decorators, group checks) is **identical** in both environments.

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| JWT validation location | NestJS `JwtAuthGuard` (in-app) | Validates at the Fargate service boundary; no external authorizer layer |
| JWKS key caching | jwks-rsa caches public keys | Eliminates repeated JWKS endpoint calls |
| Auth protocol | OAuth 2.0 + OIDC + PKCE | PPCC standard; prevents code interception |
| RBAC mechanism | AD/GWAM groups from `group_list` claim | Leverages PPCC identity infrastructure |
| Local dev auth | Mock strategy + `x-mock-user` header | Test any role without code changes |
| Token storage | Encrypted httpOnly cookie | Prevents XSS token theft |
| Session duration | 8 hours | PPCC policy |
| Frontend auth library | NextAuth v4 | Mature, supports custom OIDC with PKCE |

## AuthUser Interface

```typescript
interface AuthUser {
  sub: string;       // PingSSO subject
  lanID: string;     // Primary identifier - PPCC LAN ID (e.g., "user-admin")
  email: string;
  firstName: string; // from firstname claim
  lastName: string;  // from lastname claim
  groups: string[];  // AD/GWAM groups from group_list claim (e.g., ["app-admin"])
}
```

## RBAC Pattern

```typescript
// Any authenticated user
@UseGuards(AuthGuard)
@Get('profile')
getProfile(@CurrentUser() user: AuthUser) { ... }

// Specific group required — 403 on mismatch
@UseGuards(AuthGuard, GroupsGuard)
@RequireGroups('app-admins')
@Delete('records/:id')
deleteRecord() { ... }

// Multiple groups — any match grants access
@UseGuards(AuthGuard, GroupsGuard)
@RequireGroups('app-admins', 'app-superusers')
@Put('settings')
updateSettings() { ... }

// Public — no auth required
@Public()
@Get('health')
health() { return { status: 'ok' }; }
```

## Route Protection Layers

**Frontend:**
1. `middleware.ts` — missing/errored token → redirect to `/auth/signin`
2. `SessionErrorHandler` — client-side auto-logout on `RefreshAccessTokenError`
3. `getAccessToken()` — returns cached token or `undefined`; caller must handle

**Backend:**
1. `JwtAuthGuard` (production) — validates JWT via JWKS before handler runs; returns 401 on failure
2. `AuthGuard` — validates Passport strategy result; skips `@Public()`
3. `GroupsGuard` — enforces `@RequireGroups()`; 403 on mismatch
4. `@CurrentUser()` — injects validated `AuthUser` into handler

**Frontend — protected page (middleware handles the redirect; no auth code needed in component body):**

```typescript
// Client component — session is always populated; middleware redirected unauthenticated users
'use client';
import { useSession } from 'next-auth/react';

export default function ReportsPage() {
  const { data: session } = useSession();
  return <div>Welcome, {session?.user?.name}</div>;
}
```

**Frontend — authenticated API fetch (Server Component or API route):**

```typescript
import { getAccessToken } from '@/utils/auth';

export async function getReports() {
  const token = await getAccessToken();
  if (!token) return [];  // middleware should have prevented unauthenticated reach
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reports/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch reports');
  return res.json();
}
```

## Token Lifecycle

8h access token → silent refresh at T-60s → `RefreshAccessTokenError` → sign out → redirect to sign-in.
Backend never refreshes — reads pre-validated claims only.

## Local Role Testing

```bash
# Admin user → 200
curl -H 'x-mock-user: {"lanID":"admin01","groups":["app-admins","app-users"]}' \
  http://localhost:3001/api/reports/admin

# Wrong group → 403
curl -H 'x-mock-user: {"lanID":"reader01","groups":["app-readers"]}' \
  http://localhost:3001/api/reports/admin

# No groups → 200 (no @RequireGroups on this endpoint)
curl -H 'x-mock-user: {"lanID":"nobody","groups":[]}' \
  http://localhost:3001/api/reports/me

# Default env var user (no header)
curl http://localhost:3001/api/reports/me
```

## Security Rules

- `jwks-rsa` is used in NestJS `JwtAuthGuard` — JWT validation is the Fargate service's responsibility
- All endpoints protected by default; `@Public()` is strictly opt-in
- `x-mock-user` has no effect when `AUTH_STRATEGY=ping`
- Production guard rail: `NODE_ENV=production` + `AUTH_STRATEGY !== 'ping'` → crash on startup
- Tokens stored in httpOnly encrypted cookies — never localStorage or sessionStorage

## Testing Checklist

- [ ] Both strategies tested in isolation (unit)
- [ ] Production guard rail crash verified (unit)
- [ ] `x-mock-user` override tested with different group combinations (integration)
- [ ] GroupsGuard allows when group matches; throws ForbiddenException when not (integration)
- [ ] 401 without auth context (E2E)
- [ ] 200 with valid auth context (E2E)
- [ ] 403 with wrong groups for every `@RequireGroups` endpoint (E2E)
- [ ] 200 for `@Public()` endpoints without any auth (E2E)

## Common Pitfalls

| Pitfall | Prevention |
|---------|------------|
| Skipping JWT validation in Fargate service | Always keep `JwtAuthGuard` active in production — no external authorizer layer exists |
| Hardcoded issuer or audience | Always use env vars |
| Missing PKCE on frontend | NextAuth `checks: ['pkce', 'state', 'nonce']` |
| Client secret on frontend | Must be empty string — public client |
| `@UseGuards(GroupsGuard)` without `AuthGuard` | Always pair them: `@UseGuards(AuthGuard, GroupsGuard)` |
| Not testing group-denied scenarios | Every `@RequireGroups` needs a 403 test |
| `x-mock-user` working in production | Mock strategy only loads when `AUTH_STRATEGY=mock` |

## Environment Variables Reference

| Variable | Where | When | Description |
|----------|-------|------|-------------|
| `NEXTAUTH_URL` | Frontend | Always | App base URL |
| `NEXTAUTH_SECRET` | Frontend | Always | Session encryption key |
| `WELLKNOWN_ENDPOINT` | Frontend | Always | PingSSO OIDC discovery URL |
| `NEXT_PUBLIC_OIDC_CLIENT_ID` | Frontend | Always | OAuth client ID |
| `AUTH_STRATEGY` | Backend | Always | `ping` or `mock` |
| `NODE_ENV` | Backend | Always | `production` or `development` |
| `PING_ISSUER` | Backend | Production | PingSSO issuer URL (used by `JwtAuthGuard`) |
| `OIDC_CLIENT_ID` | Backend | Production | Audience for JWT validation (used by `JwtAuthGuard`) |
| `MOCK_USER_LANID` | Backend | If mock | Default fake LAN ID |
| `MOCK_USER_EMAIL` | Backend | If mock | Default fake email |
| `MOCK_USER_GROUPS` | Backend | If mock | Comma-separated default groups |

## Cross-References

- Full reference: `@.claude/docs/authorization-patterns-and-architecture.md`
- PingID auth pattern: `.claude/patterns/pingid-auth-pattern.md`
- Security standards: `.claude/standards/security-standards.md`
- CDK infrastructure: `.claude/patterns/cdk-infrastructure-pattern.md`
