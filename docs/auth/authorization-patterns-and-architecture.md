# Authorization Patterns & Architecture

## System Architecture

### Production (AWS)

```

┌─────────────┐   ┌──────────────────────────┐   ┌───────────────────────────┐
│ Next.js     │──▶│ Internal ALB             │──▶│ NestJS Fargate Service    │
│ (NextAuth)  │   │ (HTTPS listener,         │   │                           │
│ Handles:    │   │  VPC-internal only)      │   │ JwtAuthGuard validates    │
│ - PKCE flow │   │                          │   │ RS256 JWT via jwks-rsa    │
│ - Token     │   │                          │   │ (passport-jwt strategy)   │
│ refresh     │   │                          │   │                           │
│ - Session   │   │                          │   │ Applies RBAC via          │
└──────┬──────┘   └──────────────────────────┘   │ PermissionsGuard          │
       │                                          └───────────────────────────┘
       │ OAuth 2.0 + PKCE
       ▼
┌──────────────┐
│ PingSSO      │
│ (SignOn.PPCC) │
└──────────────┘

```

### Local Development

```

┌───────────┐   ┌────────────────────────────────────────┐
│ Next.js   │──▶│ NestJS (local, port 3001)              │
│ (or curl/ │   │                                        │
│ Postman)  │   │ MockAuthStrategy reads x-mock-user     │
│           │   │ header or injects default fake user    │
└───────────┘   └────────────────────────────────────────┘

```

## Responsibility Split

| Concern                        | Production (Fargate)                | Local (NestJS mock)                      |
| ------------------------------ | ----------------------------------- | ---------------------------------------- |
| **Token signature validation** | NestJS JwtAuthGuard via jwks-rsa    | Skipped                                  |
| **Issuer / audience check**    | NestJS JwtAuthGuard (passport-jwt)  | Skipped                                  |
| **Token expiry check**         | NestJS JwtAuthGuard                 | Skipped                                  |
| **User identity extraction**   | JwtAuthGuard → validated JWT claims | Mock strategy → env vars or header       |
| **Group-based RBAC**           | NestJS PermissionsGuard             | NestJS PermissionsGuard (same code)      |
| **Route-level public/private** | NestJS AuthGuard + @Public()        | NestJS AuthGuard + @Public() (same code) |

Key insight: AuthZ code (guards, decorators, group checks) is **identical** in
both environments. Only the user identity source changes.

## Architectural Decisions

| Decision                | Choice                             | Rationale                                                                 |
| ----------------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| JWT validation location | NestJS JwtAuthGuard (in-app)       | Single enforcement point on the Fargate service; no separate authorizer   |
| JWKS caching            | jwks-rsa cache (default 10 min)    | Eliminates repeated JWKS calls for the same signing key                   |
| Auth protocol           | OAuth 2.0 + OIDC + PKCE            | PPCC standard; prevents code interception                                 |
| Frontend auth library   | NextAuth v4                        | Mature, supports custom OIDC providers with PKCE                          |
| Backend auth            | passport-jwt + jwks-rsa on Fargate | NestJS-native; RS256/JWKS validated in-app; no external authorizer needed |
| Token storage           | Encrypted httpOnly cookie          | Prevents XSS token theft                                                  |
| Session duration        | 8 hours                            | PPCC policy                                                               |
| Local dev auth          | Mock strategy with header override | Test any role combination without code changes                            |
| RBAC mechanism          | AD/GWAM groups from `group_list`   | Leverages existing PPCC identity infrastructure                           |

## Token Lifecycle

```

Login ──▶ Access Token (8h) ──▶ Auto-refresh at T-60s ──▶ New Token
│
Refresh fails?
│
▼
SessionErrorHandler detects
RefreshAccessTokenError
│
▼
Sign out + redirect to /auth/signin

```

- Access tokens are JWTs signed by PingSSO.
- Refresh happens silently in the NextAuth JWT callback.
- The Fargate service validates tokens on every request via JwtAuthGuard.

## Route Protection

### Frontend Layers

1. **Middleware (`middleware.ts`):** No token → redirect to sign-in. Errored
   token → redirect to sign-in.
2. **SessionErrorHandler:** Client-side auto-logout on
   `RefreshAccessTokenError`.
3. **`getAccessToken()` utility:** Returns cached token or `undefined` — caller
   must handle.

### Backend Layers

1. **JwtAuthGuard (all environments):** Validates RS256 JWT signature, issuer,
   audience, and expiry using passport-jwt + jwks-rsa. Skips for `@Public()`
   endpoints.
2. **PermissionsGuard:** Checks `@RequirePermissions()` against user's groups.
   Returns 403 on mismatch.
3. **`@CurrentUser()` decorator:** Injects validated `AuthUser` into handler.

## AuthUser Interface

```typescript
interface AuthUser {
  sub: string; // PingSSO subject identifier
  lanID: string; // PPCC LAN ID (from lanID claim)
  email: string; // Corporate email
  firstName: string; // From firstname claim
  lastName: string; // From lastname claim
  groups: string[]; // AD/GWAM groups from group_list claim
}
```

## RBAC Pattern

```typescript
// Any authenticated user
@UseGuards(AuthGuard)
@Get('profile')
getProfile(@CurrentUser() user: AuthUser) { ... }

// Specific group required
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('records:delete')
@Delete('records/:id')
deleteRecord() { ... }

// Multiple permissions — any match grants access
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('settings:write')
@Put('settings')
updateSettings() { ... }

// Public — no auth required
@Public()
@Get('health')
health() { return { status: 'ok' }; }
```

## Local Role Testing

Use the `x-mock-user` header to test any user/group combination without changing
config:

```bash
# Admin user
curl -H 'x-mock-user: {"lanID":"admin01","groups":["app-admins","app-users"]}' \
  http://localhost:3001/api/reports/admin
# Expected: 200

# Read-only user hitting admin endpoint
curl -H 'x-mock-user: {"lanID":"reader01","groups":["app-readers"]}' \
  http://localhost:3001/api/reports/admin
# Expected: 403 Forbidden

# User with no groups
curl -H 'x-mock-user: {"lanID":"nobody","groups":[]}' \
  http://localhost:3001/api/reports/me
# Expected: 200 (no group restriction on /me)

# Default user from env vars (no header)
curl http://localhost:3001/api/reports/me
# Expected: 200
```

## Security Checklist

- [ ] PingID JWKS URI configured correctly (`PINGID_JWKS_URI`)
- [ ] Issuer and audience validated in JwtAuthGuard (`PINGID_ISSUER`,
      `PINGID_AUDIENCE`)
- [ ] PKCE enabled on frontend (`code_challenge_method: S256`)
- [ ] State and nonce validated by NextAuth
- [ ] Tokens stored in httpOnly encrypted cookies only
- [ ] HTTPS enforced in all non-local environments
- [ ] No client secret on frontend (public client)
- [ ] Logout clears local session only (no IdP logout call)
- [ ] Production guard rail prevents mock auth in production
- [ ] All endpoints protected by default; `@Public()` is opt-in
- [ ] `x-mock-user` header has no effect when `MOCK_AUTH_ENABLED=false`

## Testing Patterns

### Unit — Production Guard Rail

```typescript
describe('AuthModule', () => {
  it('crashes in production with mock strategy', () => {
    process.env.NODE_ENV = 'production';
    process.env.MOCK_AUTH_ENABLED = 'true';
    expect(() => AuthModule.register()).toThrow(/not allowed in production/);
  });

  it('registers JwtStrategy when mock auth disabled', () => {
    process.env.MOCK_AUTH_ENABLED = 'false';
    const module = AuthModule.register();
    expect(module.providers).toContainEqual(JwtStrategy);
  });

  it('registers MockAuthStrategy when mock auth enabled', () => {
    process.env.MOCK_AUTH_ENABLED = 'true';
    process.env.NODE_ENV = 'development';
    const module = AuthModule.register();
    expect(module.providers).toContainEqual(MockAuthStrategy);
  });
});
```

### Integration — PermissionsGuard

```typescript
describe('PermissionsGuard', () => {
  it('allows access when user has required permission', () => {
    const user: AuthUser = { ...baseUser, groups: ['app-admins'] };
    mockReflector.getAllAndOverride.mockReturnValue(['records:delete']);
    expect(guard.canActivate(mockContext(user))).toBe(true);
  });

  it('throws ForbiddenException when user lacks required permission', () => {
    const user: AuthUser = { ...baseUser, groups: ['app-readers'] };
    mockReflector.getAllAndOverride.mockReturnValue(['records:delete']);
    expect(() => guard.canActivate(mockContext(user))).toThrow(
      ForbiddenException,
    );
  });

  it('allows access when no permissions required', () => {
    const user: AuthUser = { ...baseUser, groups: [] };
    mockReflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(mockContext(user))).toBe(true);
  });
});
```

### E2E — Protected Endpoints

```typescript
describe('Reports API', () => {
  it('GET /api/reports/me — returns 200 with mock user', () => {
    return request(app.getHttpServer()).get('/api/reports/me').expect(200);
  });

  it('GET /api/reports/admin — returns 200 for admin group', () => {
    return request(app.getHttpServer())
      .get('/api/reports/admin')
      .set('x-mock-user', JSON.stringify({ groups: ['app-admins'] }))
      .expect(200);
  });

  it('GET /api/reports/admin — returns 403 for non-admin', () => {
    return request(app.getHttpServer())
      .get('/api/reports/admin')
      .set('x-mock-user', JSON.stringify({ groups: ['app-readers'] }))
      .expect(403);
  });

  it('GET /api/reports/health — returns 200 without auth', () => {
    return request(app.getHttpServer()).get('/api/reports/health').expect(200);
  });
});
```

## Common Pitfalls

| Pitfall                             | Prevention                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| Skipping JWT validation in NestJS   | JwtAuthGuard is applied globally; never bypass it without `@Public()`                  |
| Hardcoded issuer or audience        | Always use env vars (`PINGID_ISSUER`, `PINGID_AUDIENCE`)                               |
| Missing PKCE on frontend            | NextAuth checks: `['pkce', 'state', 'nonce']`                                          |
| Client secret on frontend           | Must be empty string — public client                                                   |
| Calling PingSSO logout endpoint     | Not supported; clear local session only                                                |
| Forgetting `@UseGuards(AuthGuard)`  | Apply globally via `APP_GUARD` or enforce via lint rule                                |
| Not testing group-denied scenarios  | Every `@RequirePermissions` needs a 403 test                                           |
| `x-mock-user` working in production | Mock strategy only loads when `MOCK_AUTH_ENABLED=true`; production guard rail prevents |

## Environment Variables Reference

| Variable                     | Where    | When       | Description                    |
| ---------------------------- | -------- | ---------- | ------------------------------ |
| `NEXTAUTH_URL`               | Frontend | Always     | App base URL                   |
| `NEXTAUTH_SECRET`            | Frontend | Always     | Session encryption key         |
| `WELLKNOWN_ENDPOINT`         | Frontend | Always     | PingSSO OIDC discovery URL     |
| `NEXT_PUBLIC_OIDC_CLIENT_ID` | Frontend | Always     | OAuth client ID                |
| `NEXT_PUBLIC_OIDC_SCOPE`     | Frontend | Always     | `openid profile`               |
| `MOCK_AUTH_ENABLED`          | Backend  | Always     | `false` for prod; `true` local |
| `NODE_ENV`                   | Backend  | Always     | `production` or `development`  |
| `PINGID_JWKS_URI`            | Backend  | Production | PingSSO JWKS endpoint          |
| `PINGID_ISSUER`              | Backend  | Production | PingSSO issuer URL             |
| `PINGID_AUDIENCE`            | Backend  | Production | Audience for JWT validation    |
| `MOCK_USER_LANID`            | Backend  | If mock    | Default fake LAN ID            |
| `MOCK_USER_EMAIL`            | Backend  | If mock    | Default fake email             |
| `MOCK_USER_FIRST_NAME`       | Backend  | If mock    | Default fake first name        |
| `MOCK_USER_LAST_NAME`        | Backend  | If mock    | Default fake last name         |
| `MOCK_USER_GROUPS`           | Backend  | If mock    | Comma-separated default groups |
