# PingID Authentication Pattern

> **Load when**: implementing auth, guards, route protection, or mock user setup. Unload after.

## Core Principle

The NestJS Fargate service validates PingID JWTs **in-app** via `JwtAuthGuard`
(passport-jwt + jwks-rsa). There is no separate authorizer layer and no API Gateway —
the internal ALB forwards requests directly to the Fargate service, which validates
the RS256/JWKS token itself.

**NestJS = AuthN + AuthZ**: `JwtAuthGuard` validates the JWT (via JWKS); `PermissionsGuard`
enforces group-based access.

## Auth Strategy

Controlled by `AUTH_STRATEGY` env var:

| Value | Environment | Description |
|-------|-------------|-------------|
| `ping` | Production/SIT/UAT | Validates JWT via PingID JWKS endpoint (jwks-rsa + passport-jwt) |
| `mock` | Local dev / CI | Injects fake user from env vars; `x-mock-user` header override |

**Guard rail**: If `NODE_ENV=production` and `AUTH_STRATEGY !== 'ping'` → app crashes on startup.

## AuthUser Interface (Backend)

```typescript
interface AuthUser {
  sub: string;       // PingSSO subject
  lanID: string;     // PPCC LAN ID (lanID or lanid claim)
  email: string;
  firstName: string; // firstname claim
  lastName: string;  // lastname claim
  groups: string[];  // from groups or group_list claim (JSON string or array)
}
```

## Frontend (Next.js + NextAuth)

- Custom OIDC provider via `wellKnown` endpoint, PKCE (`checks: ['pkce', 'state', 'nonce']`)
- JWT session strategy, `maxAge: 8 * 60 * 60` (8h, matches PPCC policy)
- Silent token refresh at T-60s in `jwt` callback via `refreshAccessToken()`
- `SessionErrorHandler`: client-side auto-logout on `RefreshAccessTokenError`

**`src/middleware.ts` — copy exactly; matcher covers all pages, excludes Next.js internals, auth routes, and static files:**

```typescript
import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || token.error === 'RefreshAccessTokenError') {
    const signIn = new URL('/auth/signin', req.url);
    signIn.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api/auth|auth|favicon.ico|images|.*\\..*).*)'],
};
```

**`src/utils/auth.ts` — get access token for API calls (works in both server and client contexts):**

```typescript
import { getServerSession } from 'next-auth';
import { getSession } from 'next-auth/react';
import { authOptions } from '@/auth';

export async function getAccessToken(): Promise<string | undefined> {
  const session =
    typeof window === 'undefined'
      ? await getServerSession(authOptions)
      : await getSession();
  if (!session?.accessToken || session.error) return undefined;
  return session.accessToken;
}

// Usage — every authenticated API call:
const token = await getAccessToken();
if (!token) throw new Error('Not authenticated');
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reports/me`, {
  headers: { Authorization: `Bearer ${token}` },
  cache: 'no-store',
});
```

Reference implementation lives in the app: `apps/web/src/app/(auth)/` and `apps/web/src/lib/auth/`.

## Backend — In-App JWT Validation (Fargate NestJS)

The Fargate NestJS service validates the Bearer token directly using `passport-jwt`
and `jwks-rsa`. The JWKS endpoint is configured via `PINGID_JWKS_URI`.

```typescript
// apps/api/src/auth/strategies/ping-jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

@Injectable()
export class PingJwtStrategy extends PassportStrategy(Strategy, 'ping-jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksUri: process.env.PINGID_JWKS_URI!,
      }),
      issuer: process.env.PINGID_ISSUER,
      audience: process.env.PINGID_AUDIENCE,
      algorithms: ['RS256'],
    });
  }

  validate(payload: Record<string, unknown>): AuthUser {
    return {
      sub: payload.sub as string,
      lanID: (payload.lanID ?? payload.lanid) as string,
      email: payload.email as string,
      firstName: payload.firstname as string,
      lastName: payload.lastname as string,
      groups: normaliseGroups(payload.groups ?? payload.group_list),
    };
  }
}

function normaliseGroups(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return raw.split(',').map(g => g.trim()); }
  }
  return [];
}
```

## Backend — Auth Module

`AuthModule.register()` selects strategy from `AUTH_STRATEGY`:
- `ping` → `PingJwtStrategy` (validates JWT via JWKS — in-app, no external authorizer)
- `mock` → `MockAuthStrategy` (env vars + `x-mock-user` header)

Exports: `JwtAuthGuard`, `PermissionsGuard`, `PassportModule`

## Backend — Strategies

**`PingJwtStrategy`** (production):
- Extracts Bearer token from `Authorization` header
- Validates RS256 signature against PingID JWKS endpoint (`PINGID_JWKS_URI`)
- Verifies `iss` and `aud` claims
- Normalises `groups` / `group_list` from JSON string, comma-separated string, or array
- Returns `AuthUser` via `validate()`. Full JWT validation — trusts no external layer.

**`MockAuthStrategy`** (local dev):
- Default user from `MOCK_USER_*` env vars
- `x-mock-user` JSON header overrides any field: `{"lanID":"admin01","groups":["app-admins","app-users"]}`

Reference implementation lives in the app: `apps/api/src/auth/` (strategies, guards, decorators).

## Guards & Decorators

```typescript
// Guards — apply at controller level or register globally
@UseGuards(JwtAuthGuard)                  // Validates JWT; skips @Public() endpoints
@UseGuards(JwtAuthGuard, PermissionsGuard) // + enforces @RequireGroups(); 403 on mismatch

// Decorators
@Public()                                       // Opt-out of auth (health checks only)
@RequireGroups('app-admins')                    // Any matching group = access granted
@RequireGroups('app-admins', 'app-superusers')  // Multiple groups — any match grants access
@CurrentUser() user: AuthUser                   // Inject full AuthUser
@CurrentUser('lanID') lanID: string             // Inject single field
```

## Controller Pattern

```typescript
@Controller('api/reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  @Get('me')
  getMyReports(@CurrentUser() user: AuthUser) { ... }          // Any authenticated user

  @Get('admin')
  @RequireGroups('app-admins')
  getAdminReports(@CurrentUser('lanID') lanID: string) { ... } // Group required

  @Get('health')
  @Public()
  health() { return { status: 'ok' }; }                       // No auth required
}
```

## Key Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `AUTH_STRATEGY` | Backend | `ping` or `mock` |
| `NODE_ENV` | Backend | `production` or `development` |
| `PINGID_JWKS_URI` | Backend | PingID JWKS endpoint URL |
| `PINGID_ISSUER` | Backend | JWT issuer claim to validate |
| `PINGID_AUDIENCE` | Backend | JWT audience claim to validate |
| `NEXTAUTH_SECRET` | Frontend | Session encryption key |
| `WELLKNOWN_ENDPOINT` | Frontend | PingSSO OIDC discovery URL |
| `NEXT_PUBLIC_OIDC_CLIENT_ID` | Frontend | OAuth client ID |
| `NEXT_PUBLIC_OIDC_SCOPE` | Frontend | `openid profile` |
| `MOCK_USER_LANID` | Backend (mock) | Default fake LAN ID |
| `MOCK_USER_GROUPS` | Backend (mock) | Comma-separated default groups |

## Security Rules

- `jwks-rsa` + `passport-jwt` in NestJS validate the JWT — the Fargate service is responsible for all token validation
- All endpoints protected by default; `@Public()` is strictly opt-in (health checks only)
- `x-mock-user` header has no effect when `AUTH_STRATEGY=ping`
- Tokens stored in httpOnly encrypted cookies — never localStorage
- Client secret is empty string on frontend (public client)
- Production guard rail prevents mock auth in production

## Testing Requirements

- **Unit**: test both strategies in isolation; verify production guard rail crashes app
- **Integration**: test `JwtAuthGuard` + `PermissionsGuard` with mock requests; test `x-mock-user` with different group combos
- **E2E**: 401 without auth context, 200 with valid context, 403 with wrong groups
- Every `@RequireGroups` endpoint MUST have a 403 test for wrong groups

## Cross-References

- Reference implementation: `apps/api/src/auth/` (backend) and `apps/web/src/lib/auth/` (frontend)
- Authorization patterns: `.claude/docs/authorization-patterns-and-architecture.md`
- Security standards: `.claude/standards/security-standards.md`
- CDK infrastructure: `.claude/patterns/cdk-infrastructure-pattern.md`
