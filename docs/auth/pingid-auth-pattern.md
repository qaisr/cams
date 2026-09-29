# PingID Authentication Pattern

## Overview

OAuth 2.0 Authorization Code Flow with PKCE using PingSSO (SignOn.PPCC) as IdP.
Frontend: Next.js + NextAuth. Backend: NestJS on Fargate behind an internal ALB.
**NestJS handles both AuthN (RS256/JWKS token validation via passport-jwt +
jwks-rsa) and AuthZ (group-based access via PermissionsGuard).**

## Auth Strategy Selection

Backend supports two strategies controlled by `MOCK_AUTH_ENABLED` env var:

| Value   | Environment            | Description                                                   |
| ------- | ---------------------- | ------------------------------------------------------------- |
| `false` | Production / SIT / UAT | Validates RS256 JWT via PingID JWKS; extracts claims in-app   |
| `true`  | Local dev              | Injects configurable fake user; supports `x-mock-user` header |

**Production guard rail:** If `NODE_ENV=production` and
`MOCK_AUTH_ENABLED=true`, the app MUST crash on startup.

---

## Frontend (Next.js + NextAuth)

### NextAuth Provider Config — `src/auth.ts`

```typescript
import NextAuth, { NextAuthOptions } from 'next-auth';

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: 'oidc',
      name: 'PPCC SSO',
      type: 'oauth',
      wellKnown: process.env.WELLKNOWN_ENDPOINT,
      clientId: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID,
      clientSecret: '',
      authorization: {
        params: {
          scope: process.env.NEXT_PUBLIC_OIDC_SCOPE || 'openid profile',
          code_challenge_method: 'S256',
        },
      },
      checks: ['pkce', 'state', 'nonce'],
      profile(profile) {
        return {
          id: profile.sub || '',
          name: `${profile.firstname || ''} ${profile.lastname || ''}`.trim(),
          email: profile.email,
          lanID: profile.lanID,
          groups: Array.isArray(profile.group_list)
            ? profile.group_list
            : (profile.group_list || '').split(',').filter(Boolean),
        };
      },
    },
  ],
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  callbacks: {
    async jwt({ token, account, user }) {
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: (account.expires_at || 0) * 1000,
          refreshToken: account.refresh_token,
          idToken: account.id_token,
          user,
        };
      }
      if (Date.now() + 60_000 < (token.accessTokenExpires as number)) {
        return token;
      }
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.user = token.user as any;
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;
      return session;
    },
  },
};

async function refreshAccessToken(token: any) {
  try {
    const discovery = await fetch(process.env.WELLKNOWN_ENDPOINT!).then((r) =>
      r.json(),
    );
    const res = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    });
    const tokens = await res.json();
    if (!res.ok) throw tokens;
    // Decode refreshed id_token to pick up updated profile claims (e.g. group_list changes)
    const payloadBase64 = tokens.id_token.split('.')[1];
    const updatedProfile = JSON.parse(
      Buffer.from(payloadBase64, 'base64').toString(),
    );
    return {
      ...token,
      accessToken: tokens.access_token,
      accessTokenExpires: Date.now() + tokens.expires_in * 1000,
      refreshToken: tokens.refresh_token || token.refreshToken,
      idToken: tokens.id_token,
      user: {
        ...(token.user as any),
        groups: Array.isArray(updatedProfile.group_list)
          ? updatedProfile.group_list
          : (updatedProfile.group_list || '').split(',').filter(Boolean),
      },
      error: undefined,
    };
  } catch {
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}
```

### Middleware — `src/middleware.ts`

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
  matcher: ['/((?!_next|api/auth|auth|favicon.ico|images|.*\..*).*)'],
};
```

### Session Error Handler — `src/providers/NextAuthProvider.tsx`

```typescript
'use client';
import { SessionProvider, useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useEffect, ReactNode } from 'react';

function SessionErrorHandler({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'authenticated' && session?.error === 'RefreshAccessTokenError') {
      signOut({ redirect: false });
      if (pathname !== '/auth/signin') window.location.href = '/auth/signin';
    }
  }, [session, status, pathname]);

  return <>{children}</>;
}

export default function NextAuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      <SessionErrorHandler>{children}</SessionErrorHandler>
    </SessionProvider>
  );
}
```

### Access Token Helper — `src/utils/auth.ts`

```typescript
import { getServerSession } from 'next-auth';
import { getSession } from 'next-auth/react';
import { authOptions } from '@/auth';

let cache: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string | undefined> {
  if (cache && Date.now() + 60_000 < cache.expiresAt) return cache.token;
  const session =
    typeof window === 'undefined'
      ? await getServerSession(authOptions)
      : await getSession();
  if (!session?.accessToken || session.error) return undefined;
  // Use the token's actual expiry from the JWT callback (account.expires_at * 1000)
  // rather than a hardcoded duration — prevents serving a stale token after a refresh
  cache = {
    token: session.accessToken,
    expiresAt:
      (session as any).accessTokenExpires ?? Date.now() + 7 * 60 * 60 * 1000,
  };
  return session.accessToken;
}
```

**Usage:**

```typescript
const token = await getAccessToken();
const res = await fetch(`${API_URL}/endpoint`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

---

## Backend (NestJS on Fargate)

JWT validation happens **in-app** on the Fargate service using passport-jwt +
jwks-rsa. There is no external authorizer — the NestJS `JwtAuthGuard` validates
the RS256 signature, issuer, and audience on every request.

### AuthUser Interface

```typescript
// src/common/interfaces/auth-user.interface.ts
export interface AuthUser {
  sub: string;
  lanID: string;
  email: string;
  firstName: string;
  lastName: string;
  groups: string[];
}
```

### Auth Module — Strategy Selection

```typescript
// src/auth/auth.module.ts
import { Module, DynamicModule, Logger } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MockAuthStrategy } from './strategies/mock-auth.strategy';
import { AuthGuard } from './guards/auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({})
export class AuthModule {
  static register(): DynamicModule {
    const isMock = process.env.MOCK_AUTH_ENABLED === 'true';
    const logger = new Logger('AuthModule');

    if (process.env.NODE_ENV === 'production' && isMock) {
      throw new Error(
        'FATAL: MOCK_AUTH_ENABLED=true is not allowed in production.',
      );
    }

    logger.warn(`Auth strategy: ${isMock ? 'mock' : 'ping-jwt'}`);

    const strategyProvider = isMock ? MockAuthStrategy : JwtStrategy;

    return {
      module: AuthModule,
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      providers: [strategyProvider, AuthGuard, PermissionsGuard],
      exports: [AuthGuard, PermissionsGuard, PassportModule],
    };
  }
}
```

### Strategy: PingID JWT (Production) — In-App RS256/JWKS Validation

The Fargate service validates the JWT directly using passport-jwt + jwks-rsa. No
external authorizer is involved.

```typescript
// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { AuthUser } from '../../common/interfaces/auth-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: process.env.PINGID_JWKS_URI!,
      }),
      issuer: process.env.PINGID_ISSUER,
      audience: process.env.PINGID_AUDIENCE,
      algorithms: ['RS256'],
    });
  }

  validate(payload: Record<string, any>): AuthUser {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token claims');
    }

    const groupList = payload.group_list ?? payload.groups ?? [];
    const groups: string[] = Array.isArray(groupList)
      ? groupList
      : String(groupList).split(',').filter(Boolean);

    return {
      sub: payload.sub,
      lanID: payload.lanID || payload.lanid || '',
      email: payload.email || '',
      firstName: payload.firstName || payload.firstname || '',
      lastName: payload.lastName || payload.lastname || '',
      groups,
    };
  }
}
```

### Strategy: Mock (Local Dev)

Injects a fake user from env vars. Supports `x-mock-user` header override for
role testing.

```typescript
// src/auth/strategies/mock-auth.strategy.ts
import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { AuthUser } from '../../common/interfaces/auth-user.interface';

@Injectable()
export class MockAuthStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger('MockAuth');

  private readonly defaultUser: AuthUser = {
    sub: process.env.MOCK_USER_SUB || 'mock-sub-001',
    lanID: process.env.MOCK_USER_LANID || 'ab123456',
    email: process.env.MOCK_USER_EMAIL || 'dev.user@ppcc.com.au',
    firstName: process.env.MOCK_USER_FIRST_NAME || 'Dev',
    lastName: process.env.MOCK_USER_LAST_NAME || 'User',
    groups: (process.env.MOCK_USER_GROUPS || 'dev-team,app-users').split(','),
  };

  constructor() {
    super((req: any, done: Function) => {
      const headerOverride = req.headers?.['x-mock-user'];

      if (headerOverride) {
        try {
          const override = JSON.parse(headerOverride) as Partial<AuthUser>;
          const user: AuthUser = { ...this.defaultUser, ...override };
          if (typeof override.groups === 'string') {
            user.groups = (override.groups as unknown as string).split(',');
          }
          this.logger.debug(
            `Mock auth — header override: ${user.lanID} [${user.groups}]`,
          );
          return done(null, user);
        } catch (e) {
          this.logger.warn(`Invalid x-mock-user header, using default: ${e}`);
        }
      }

      this.logger.debug(`Mock auth — default user: ${this.defaultUser.lanID}`);
      done(null, { ...this.defaultUser });
    });
  }
}
```

**Testing different roles via header:**

```bash
# Admin user
curl -H 'x-mock-user: {"lanID":"admin01","groups":["app-admins","app-users"]}' \
  http://localhost:3001/api/reports/admin

# Read-only user
curl -H 'x-mock-user: {"lanID":"reader01","groups":["app-readers"]}' \
  http://localhost:3001/api/reports/admin

# No groups (expect 403)
curl -H 'x-mock-user: {"lanID":"nobody","groups":[]}' \
  http://localhost:3001/api/reports/admin

# Default user (no header)
curl http://localhost:3001/api/reports/me
```

### Auth Guard

```typescript
// src/auth/guards/auth.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

### Permissions Guard (RBAC)

```typescript
// src/auth/guards/permissions.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;
    const user = context.switchToHttp().getRequest().user as AuthUser;
    const hasGroup = required.some((g) => user.groups.includes(g));
    if (!hasGroup)
      throw new ForbiddenException('Insufficient group membership');
    return true;
  }
}
```

### Decorators

```typescript
// src/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../../common/interfaces/auth-user.interface';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user as AuthUser;
    return data ? user?.[data] : user;
  },
);

// src/auth/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// src/auth/decorators/require-permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
```

### Controller Usage

```typescript
@Controller('api/reports')
@UseGuards(AuthGuard, PermissionsGuard)
export class ReportsController {
  @Get('me')
  getMyReports(@CurrentUser() user: AuthUser) {
    return this.reportsService.findByLanId(user.lanID);
  }

  @Get('admin')
  @RequirePermissions('reports:admin')
  getAdminReports(@CurrentUser('lanID') lanID: string) {
    return this.reportsService.findAll();
  }

  @Get('health')
  @Public()
  health() {
    return { status: 'ok' };
  }
}
```

---

## Environment Variables

### Frontend

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>
WELLKNOWN_ENDPOINT=https://sso.pingidentity.com/.well-known/openid-configuration
NEXT_PUBLIC_OIDC_CLIENT_ID=your-client-id
NEXT_PUBLIC_OIDC_SCOPE=openid profile
```

### Backend — Production

```
MOCK_AUTH_ENABLED=false
NODE_ENV=production
PINGID_JWKS_URI=https://sso.pingidentity.com/pf/JWKS
PINGID_ISSUER=https://sso.pingidentity.com
PINGID_AUDIENCE=your-client-id
```

### Backend — Local Dev

```
MOCK_AUTH_ENABLED=true
NODE_ENV=development
MOCK_USER_LANID=ab123456
MOCK_USER_EMAIL=dev.user@ppcc.com.au
MOCK_USER_FIRST_NAME=Dev
MOCK_USER_LAST_NAME=User
MOCK_USER_GROUPS=dev-team,app-users
```

---

## Available PingSSO Claims

Configure which attributes to include in the ID token during PingSSO onboarding.
Available OAuth attribute names:

| Claim             | Description                                                      |
| ----------------- | ---------------------------------------------------------------- |
| `lanID`           | PPCC LAN ID — primary user identifier                            |
| `firstName`       | First name                                                       |
| `lastName`        | Last name                                                        |
| `email`           | Corporate email address                                          |
| `group_list`      | AD/GWAM group memberships (comma-separated string or JSON array) |
| `employeeNumber`  | Employee number                                                  |
| `upn`             | User Principal Name                                              |
| `ims_id`          | IMS identifier                                                   |
| `device_location` | Device location                                                  |
| `scope`           | Granted OAuth scopes                                             |

`openid` and `profile` scopes are added by default. Minimum required: `lanID`,
`firstName`, `lastName`, `email`, `group_list`.

---

## Testing Requirements

- **Unit tests:** Test both strategies in isolation. Verify production guard
  rail crashes app when `MOCK_AUTH_ENABLED=true` in production.
- **Integration tests:** Test AuthGuard + PermissionsGuard with mock request
  objects. Test `x-mock-user` header override with different group combinations.
- **E2E tests:** Protected endpoints return 401 without auth context, 200 with
  valid context, 403 with wrong groups.
- Every new endpoint MUST use `@UseGuards(AuthGuard)` unless explicitly
  `@Public()`.
- Permission-restricted endpoints MUST have tests verifying access denied for
  wrong groups.
