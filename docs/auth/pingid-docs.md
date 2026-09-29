Here's the full compiled guide with all the important content from PPCC's
internal documentation.

---

# PPCC PingSSO Authentication Implementation Guide for JavaScript

**Architecture:** Next.js Frontend + Python FastAPI Backend (preferred
JS-relevant stacks) **Authentication Provider:** PingSSO (SignOn.PPCC) — Ping
Identity OIDC **Protocol:** OAuth 2.0 Authorization Code Flow with PKCE

---

## Part 1 — Overview & Architecture

The application implements enterprise Single Sign-On (SSO) using PingSSO with an
OAuth 2.0 + OIDC flow. The architecture follows a modern SPA pattern where:

- **Frontend (Next.js)** handles the OAuth flow and manages JWT tokens
- **Backend (FastAPI)** handles OAuth endpoints, PKCE validation, JWT validation
  (via JWKS), and secure session management
- **PingSSO (SignOn.PPCC)** acts as the Identity Provider (IdP), supporting
  OpenID Connect with PingID MFA

### Authentication Pattern

- **Protocol:** OAuth 2.0 Authorization Code Flow with PKCE
- **Token Type:** JWT (JSON Web Tokens)
- **Session Storage:** Encrypted JWT cookies (Next.js) / Database-backed
  sessions with encrypted HTTP-only cookies (FastAPI)
- **Token Lifetime:** 8 hours with automatic refresh
- **Public client only** — no client secret used on frontend
- **PingID MFA** enforced as part of the authentication flow
- All users must have valid PPCC credentials and be enrolled in PingID MFA

### Recommended Stack Combinations

| Frontend                              | Backend                                          |
| ------------------------------------- | ------------------------------------------------ |
| Next.js (App Router) + NextAuth v4/v5 | FastAPI (Python) — preferred for JS+Python teams |
| Docusaurus (React)                    | FastAPI (Python) — proven in GenAI Playbook      |
| Next.js (App Router) + NextAuth v4/v5 | .NET 8 — proven in Farlo project                 |

---

## Part 2 — PingSSO Onboarding (Before You Code)

Before implementing authentication, your application must be registered with
PPCC's Ping SSO team. Here is the process:

### Step 1 — Complete the Engagement Questionnaire

Complete the questionnaire at PPCC's CyberControls SharePoint site (SignOn.PPCC
Understand & Prepare page). This checks if your application is eligible for
onboarding to SignOn.PPCC.

### Step 2 — Ping Team Assignment

Once submitted, you'll be assigned a member of the Ping team who will guide you
through the provisioning process and validate your submission.

### Step 3 — Provide Callback URLs (one per environment)

For each environment (dev, sit, uat, prod), provide the exact callback/redirect
URI(s) where Ping will send the authorization code after user authentication.
Ping will only redirect to registered callback URIs.

**Example:** If provisioning the dev environment, the callback might be:

```
https://your-app.dev.ppcc/api/auth/callback
```

### Step 4 — Provide a Client ID

Provide Ping with a `client_id` — any string to uniquely identify your
application.

### Step 5 — Ping Provides Configuration

After provisioning, Ping will provide:

- A **client secret** associated with your `client_id` (keep this secure; note:
  frontend is configured as a public client with no secret)
- **OpenID Connect configuration** (`.well-known/openid-configuration` endpoint
  and JWKS URL) containing:
  - Authorization, token, and userinfo endpoints
  - JWKS endpoint for JWT signature verification
  - Supported scopes, response types, grant types
  - Supported algorithms (RS256, PS256, etc.) and token signing keys
  - Token endpoint authentication methods

### Step 6 — Self-Service Onboarding Form

1. Select "Deployment to PingSSO SIT environment" option
2. Fill out the OAuth configuration details (see below)
3. Get approvals; the Cyber Controls Onboarding Team handles the rest
4. After successful SIT testing, submit a second request for "Deployment to
   PingSSO STG and Prod environments" — attach SIT testing evidence

### OAuth Configuration Details Required

| Question                                 | Description                                                                                                            | Required?                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Application CI number                    | CI number of application                                                                                               | Yes                          |
| Application Service Owner                | Service Owner for the application                                                                                      | Yes                          |
| Is your application internet facing?     | Mobile app or public DNS are internet-facing. Verify using nslookup.io                                                 | Yes                          |
| How does a user access your application? | Only internal network / Only personal devices / Both                                                                   | Yes, if internet facing      |
| Enable MFA?                              | MFA via PingID mobile app or Yubikey                                                                                   | Yes                          |
| Number of users                          | Approximate production user count                                                                                      | Yes                          |
| Enable MFA only for subset of users?     | If yes, add users to CBAiNET group `SGG-PPCC-AD-MFA-Inclusion-Subset` or GWAM group `PPCC-GWAM-MFA-Inclusion-Subset`   | Yes, if MFA + >5000 users    |
| Information Classification               | Public / Group Use / Confidential / Customer & Personal / Highly Protected                                             | Yes                          |
| Client ID                                | Your application's client ID                                                                                           | Yes                          |
| Access Token Type                        | **JWT** (recommended — allows resource server to decode without calling introspection endpoint) or Opaque              | Yes                          |
| Grant Type                               | **Authorisation Code with PKCE** (recommended for SPAs — prevents CSRF and code injection attacks)                     | Yes                          |
| Requires Access Token Validation?        | Yes — validate audience claims, permissions, and scopes                                                                | Yes                          |
| Client Authentication Method             | For auth code with PKCE: select `none/SECRET`. For auth code or client credentials: select `SECRET`                    | Yes                          |
| ID Token Encryption support?             | Yes/No                                                                                                                 | Yes, if using auth code flow |
| ID Token Encryption Algorithm            | Default: ECDH-ES with AES-256 key wrap                                                                                 | Yes, if encryption enabled   |
| ID Token Content Encryption Algorithm    | Default: AES-GCM-256                                                                                                   | Yes, if encryption enabled   |
| Scopes                                   | OpenID and Profile added by default for OIDC. Comma-separated                                                          | Optional                     |
| Redirect URI                             | Format: `https://<host>/path`                                                                                          | Yes, for auth code           |
| CORS Whitelist                           | For SPAs: `https://<host>:<port>`                                                                                      | Optional                     |
| User Store                               | GWAM or CBAiNET                                                                                                        | Yes                          |
| Rename user attributes in ID token?      | If yes, configure attribute names                                                                                      | Yes                          |
| Available OAuth Attribute Names          | `firstName`, `lastName`, `email`, `employeeNumber`, `device_location`, `group_list`, `upn`, `lanID`, `ims_id`, `scope` | Configure as needed          |

---

## Part 3 — Frontend Implementation (Next.js)

Uses **NextAuth.js v4/v5** to implement the OAuth 2.0 + OIDC flow with PingSSO.

### File: `frontend/src/auth.ts` — Core Authentication Logic

```typescript
export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: 'oidc',
      name: 'PPCC SSO',
      type: 'oauth',
      wellKnown: process.env.WELLKNOWN_ENDPOINT,
      clientId: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID,
      clientSecret: '', // Public client (SPA) - no secret
      authorization: {
        params: {
          scope: process.env.NEXT_PUBLIC_OIDC_SCOPE, // "openid profile"
          code_challenge_method: 'S256', // PKCE for SPA security
        },
      },
      checks: ['pkce', 'state', 'nonce'], // Security checks
      profile(profile: Profile): User {
        return createUserFromProfile(profile);
      },
    },
  ],
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial sign-in: Store tokens
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: account.expires_at * 1000,
          refreshToken: account.refresh_token,
          idToken: account.id_token,
          user: user,
        };
      }

      // Token still valid (more than 1 min left)
      if (Date.now() + 60000 < token.accessTokenExpires) {
        return token;
      }

      // Token expired - refresh it
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.user = token.user;
      session.accessToken = token.accessToken;
      session.accessTokenExpires = token.accessTokenExpires;
      session.error = token.error;
      return session;
    },
  },
};
```

### Token Refresh Logic

```typescript
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const oidcConfig = await getOidcEndpoints();
    const tokenEndpoint = oidcConfig.token_endpoint;

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) throw refreshedTokens;

    // Decode new ID token for updated user profile
    const payloadBase64 = refreshedTokens.id_token.split('.')[1];
    const decodedPayload = JSON.parse(
      Buffer.from(payloadBase64, 'base64').toString(),
    );
    const updatedUser = createUserFromProfile(decodedPayload);

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token || token.refreshToken,
      idToken: refreshedTokens.id_token,
      user: updatedUser,
      error: undefined,
    };
  } catch (error) {
    console.error('Token refresh failed:', error);
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}
```

### User Profile Extraction from PingSSO Claims

```typescript
export const createUserFromProfile = (profile: {
  sub?: string;
  firstname?: string;
  lastname?: string;
  lanID?: string;
  email?: string;
  group_list?: string | string[];
}): User => {
  return {
    id: profile.sub || '',
    name: `${profile.firstname || ''} ${profile.lastname || ''}`.trim(),
    firstname: profile.firstname,
    lastname: profile.lastname,
    lanID: profile.lanID,
    email: profile.email,
    groups: parseGroups(profile.group_list),
  };
};
```

### File: `frontend/src/proxy.ts` — Middleware Route Protection

Enforces authentication on all routes except auth pages and static files.

```typescript
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get session token (server-side)
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // No token - redirect to signin
  if (!token) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Token refresh failed - redirect to signin
  if (token.error === 'RefreshAccessTokenError') {
    const signInUrl = new URL('/auth/signin', request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

// Match all routes except static and auth
export const config = {
  matcher: ['/((?!_next|api/auth|auth|favicon.ico|images|.*\\..*).*)'],
};
```

### File: `frontend/src/nextAuthProvider.tsx` — Client Session Provider

Provides session context to client components and handles refresh errors.

```typescript
function SessionErrorHandler({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    // Auto-logout on refresh failure
    if (status === 'authenticated' && session?.error === 'RefreshAccessTokenError') {
      console.error('Session refresh failed, clearing session...');
      signOut({ redirect: false });
      if (pathname !== '/auth/signin') {
        window.location.href = '/auth/signin';
      }
    }
  }, [session, status, pathname]);

  return <>{children}</>;
}

export default function NextAuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      <SessionErrorHandler>
        {children}
      </SessionErrorHandler>
    </SessionProvider>
  );
}
```

### File: `frontend/src/utils/auth-utils.ts` — API Token Helper

Retrieves access tokens for API calls with caching. Works in both server-side
and client-side contexts.

```typescript
export async function getAccessToken(): Promise<string | undefined> {
  // Check in-memory cache (1-min before expiry)
  if (sessionCache && Date.now() + 60000 < sessionCache.expiresAt) {
    return sessionCache.accessToken;
  }

  // Determine environment (server vs client)
  const isServer = typeof window === 'undefined';
  const session = isServer
    ? await getServerSession(authOptions) // Server-side
    : await getSession(); // Client-side

  if (!session?.accessToken) return undefined;
  if (session.error === 'RefreshAccessTokenError') return undefined;

  // Cache token
  if (session.accessTokenExpires) {
    sessionCache = {
      accessToken: session.accessToken,
      expiresAt: session.accessTokenExpires,
    };
  }

  return session.accessToken;
}
```

**Usage in API calls:**

```typescript
const token = await getAccessToken();
const response = await fetch(`${API_URL}/endpoint`, {
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});
```

### Frontend Environment Variables (`.env.local`)

```shell
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random-32-character-secret>  # Generate with: openssl rand -base64 32

# PingSSO / OIDC
WELLKNOWN_ENDPOINT=https://sso.pingidentity.com/.well-known/openid-configuration
NEXT_PUBLIC_OIDC_CLIENT_ID=your-client-id
NEXT_PUBLIC_OIDC_SCOPE=openid profile

# Backend API
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

---

## Part 4 — Backend Implementation (Python FastAPI)

This is the preferred backend for JavaScript/Next.js frontends (used by AI
Portal team, GenAI Playbook). The backend uses a Backend-for-Frontend (BFF)
pattern handling OAuth complexity, with database-backed sessions.

### Architecture Components

| Layer         | File                                 | Purpose                                       |
| ------------- | ------------------------------------ | --------------------------------------------- |
| Router        | `src/app/routers/auth.py`            | Exposes authentication API endpoints          |
| Service       | `src/app/services/auth.py`           | Core authentication business logic            |
| Client        | `src/app/clients/ping.py`            | Manages Ping OAuth client configuration       |
| Settings      | `src/app/settings/ping.py`           | Ping configuration and JWT validation options |
| Auth Core     | `src/app/core/auth.py`               | Dependency injection for protected endpoints  |
| User Model    | `src/app/db/models/auth_users.py`    | Stores user identity information              |
| Session Model | `src/app/db/models/auth_sessions.py` | Manages active user sessions                  |

### Database Schema

**`auth.users`** — Stores user identity information:

- `id` (UUID): Unique user identifier, auto-generated
- `first_name` (TEXT): User's first name from Ping
- `last_name` (TEXT): User's last name from Ping
- `lanid` (TEXT): Corporate LAN ID, unique identifier from directory
- `email` (TEXT): User's email address

**`auth.sessions`** — Manages active authentication sessions:

- `id` (TEXT): Cryptographically secure session identifier (43 characters)
- `user_id` (UUID): Foreign key to auth.users
- `created_timestamp` (TIMESTAMP): When session was created
- `last_seen` (TIMESTAMP): Last activity timestamp
- `session_expires_at` (TIMESTAMP): Absolute expiration time
- `is_revoked` (BOOLEAN): Manual revocation flag

Relationship: one-to-many — one user can have multiple active sessions
(different devices/browsers).

### Authentication Flow — Step by Step

**1. Login Initiation (`GET /api/auth/login`)**

- Generates a PKCE code verifier (random 256-bit value)
- Creates a code challenge by hashing the verifier with SHA-256
- Stores the code verifier in the user's session
- Redirects to PingFederate's authorization endpoint with: client_id,
  redirect_uri, scopes (openid, profile), code challenge + method (S256), state
  parameter for CSRF protection

**2. PingFederate Authentication**

- Displays login page to the user
- Validates credentials against the corporate directory
- Performs multi-factor authentication (PingID) if configured
- Generates an authorization code on success

**3. Callback Processing (`GET /api/auth/callback`)**

- Validates the state parameter to prevent CSRF attacks
- Retrieves the code verifier from the session
- Exchanges the authorization code for tokens by sending: authorization code,
  client ID and secret, code verifier (for PKCE validation), redirect URI
- Receives: `id_token` (JWT with user claims), `access_token` (for API access),
  `refresh_token`, token type and expiration

**4. Token Validation** The ID token is a JWT that must be cryptographically
verified:

- Fetches the signing key from Ping's JWKS endpoint
- Verifies the JWT signature using the public key
- Only accepts whitelisted algorithms (RS256, PS256, ES256, etc.) to prevent
  algorithm confusion attacks
- Validates standard claims:
  - `iss` (issuer): Must match configured PING_ISSUER
  - `exp` (expiration): Token must not be expired
  - `iat` (issued at): Token must have valid timestamp
  - Optionally validates `aud` (audience) for client ID

**5. User Record Management**

- Queries database for existing user by `lanid` to verify user should have
  access
- If user not found → raise Authentication error
- If user exists → returns the user's database ID for session creation

**6. Session Creation**

- Generates cryptographically secure session ID (256-bit random value, URL-safe
  encoded using `secrets.token_urlsafe()`)
- Calculates expiration timestamp (current time + AUTH_SESSION_TTL)
- Creates `auth_sessions` record linking session ID to user ID
- Stores session ID in encrypted HTTP-only cookie
- Redirects user to the application's base URL

**7. Authenticated Requests (on every protected endpoint)**

- Extracts session ID from the encrypted cookie
- Queries `auth_sessions` table with eager loading of user relationship
- Validates session: exists, not expired (`session_expires_at > current time`),
  not revoked (`is_revoked = false`)
- Loads user data and associated roles/permissions
- Injects User object into endpoint via dependency injection

**8. Logout (`GET /api/auth/logout`)**

- Clears all session data from server-side session store
- Deletes the session cookie
- Redirects to the application's base URL
- **Does NOT call Ping IdP logout endpoint** (federated logout is not supported
  in this pattern)

---

## Part 5 — Complete Authentication Flow Diagrams

### Initial Login Flow

```
User visits protected page (e.g., /dashboard)
         ↓
Middleware (proxy.ts) checks for token
         ↓
No token found → Redirect to /auth/signin?callbackUrl=/dashboard
         ↓
User clicks "Sign In with PPCC SSO"
         ↓
NextAuth initiates OAuth flow:
  - Generates PKCE code_challenge
  - Redirects to PingSSO authorization endpoint
  - Includes: client_id, scope, redirect_uri, code_challenge, state, nonce
         ↓
User authenticates at PingSSO (+ PingID MFA)
         ↓
PingSSO redirects to /api/auth/callback/oidc?code=xxx&state=yyy
         ↓
NextAuth callback handler:
  1. Validates state parameter
  2. Exchanges authorization code for tokens (PKCE)
     POST to PingSSO token endpoint with:
     - code, client_id, code_verifier, redirect_uri
  3. Receives: access_token, refresh_token, id_token, expires_in
  4. Extracts user profile from id_token
  5. Creates encrypted JWT session cookie
         ↓
Redirect to original page (/dashboard)
         ↓
User authenticated ✓
```

### API Request Flow

```
Frontend component needs data
         ↓
Call getAccessToken() utility
         ↓
Returns cached token or fetches from session
         ↓
Make API request:
  fetch(API_URL, {
    headers: { Authorization: `Bearer ${token}` }
  })
         ↓
Backend receives request
         ↓
Validates JWT/session:
  ✓ Signature (using PingSSO public keys from JWKS)
  ✓ Issuer (matches configured issuer)
  ✓ Audience (matches configured audience)
  ✓ Lifetime (not expired)
         ↓
If valid: Continue to endpoint with user context
If invalid: Return 401 Unauthorized
```

### Automatic Token Refresh Flow

```
Frontend session accessed (any page load or API call)
         ↓
JWT callback checks token expiry
         ↓
If < 1 minute until expiry:
  ↓
  POST to PingSSO token endpoint:
    - grant_type: refresh_token
    - refresh_token: <current_refresh_token>
    - client_id: <client_id>
  ↓
  If successful:
    - Receive new access_token, refresh_token, id_token
    - Decode id_token for updated user profile
    - Update session with new tokens
    - User stays authenticated ✓
  ↓
  If failed (token expired, revoked, or invalid):
    - Set error: 'RefreshAccessTokenError'
    - SessionErrorHandler detects error
    - Automatically sign out
    - Redirect to /auth/signin
    - User must re-authenticate
```

---

## Part 6 — Security Features

| Feature                                | Description                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **PKCE**                               | Prevents authorization code interception attacks. Client generates random code verifier → derives code challenge → Ping validates hash match during token exchange |
| **State Parameter**                    | Prevents CSRF attacks                                                                                                                                              |
| **Nonce Parameter**                    | Prevents replay attacks                                                                                                                                            |
| **Encrypted Session Cookies**          | Token storage in httpOnly cookies — prevents XSS token theft                                                                                                       |
| **Automatic Token Refresh**            | Silent refresh before expiry (1-minute threshold)                                                                                                                  |
| **Signature Validation**               | Cryptographic verification using public keys from JWKS endpoint. Auto-refreshes keys on rotation                                                                   |
| **Issuer & Audience Validation**       | Prevents token reuse from other identity providers                                                                                                                 |
| **Algorithm Whitelisting**             | Only accepts RS256, PS256, ES256, etc. — prevents algorithm confusion attacks                                                                                      |
| **HTTPS Enforcement**                  | RequireHttpsMetadata in production for all authentication endpoints                                                                                                |
| **Claim Preservation**                 | No legacy remapping (`MapInboundClaims = false`)                                                                                                                   |
| **Session Fixation Prevention**        | New session ID generated on each login                                                                                                                             |
| **Database-backed sessions** (FastAPI) | Sessions stored server-side, preventing client-side tampering. Supports revocation via `is_revoked` flag                                                           |
| **Cross-tab session sync**             | Required for multi-tab user experience                                                                                                                             |

---

## Part 7 — Implementation Constraints (PPCC-Specific)

| Constraint                                                          | Rationale                                                                                                                        |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Public client only** — no client secret on frontend               | All templates implement a public OIDC client suitable for browser-based flows. Do not introduce a client secret on the frontend. |
| **Local session logout only** — do not call PingSSO logout endpoint | Logout clears the application session only. Federated logout via the IdP is not supported in this integration pattern.           |
| **Environment-specific configuration** — no hardcoded URLs or IDs   | All environment-dependent values must be injected via environment variables, not committed to source control.                    |
| **HTTPS enforced** for all communications                           | PPCC security policy                                                                                                             |
| **HTTP-only cookies** for session tokens                            | Prevents XSS token theft                                                                                                         |
| **APIs must validate JWT/session on every request**                 | Otherwise access is denied                                                                                                       |
| **PingID MFA is mandatory**                                         | Only users authenticated via PPCC Ping SSO with valid MFA may access the application                                             |
| **All authentication tokens validated using JWKS and PKCE**         | PPCC business rule                                                                                                               |

---

## Part 8 — Testing Strategy

### Test Types

- **Unit Tests:** Validate PKCE code generation/validation logic. Test JWT
  validation and session creation functions. Mock Ping SSO endpoints for
  isolated backend logic. Tools: Jest (JS/TS), pytest (Python)
- **Integration Tests:** Simulate end-to-end OAuth 2.0/OIDC flows including PKCE
  and state validation. Test frontend-backend interaction for login, logout, and
  session refresh. Validate secure cookie handling and cross-tab session sync.
- **E2E Tests:** Automate browser flows — login, MFA, session expiry, logout.
  Test route protection and redirection for unauthenticated users. Validate
  error handling for failed authentication and expired tokens. Tools: Cypress,
  Playwright, or Selenium
- **Security Tests:** Attempt CSRF, replay, and token substitution attacks. Test
  HTTPS enforcement and cookie security flags. Validate MFA enforcement and
  session invalidation on logout. Tools: OWASP ZAP, custom scripts for
  token/cookie manipulation
- **Compliance & Audit Tests:** Ensure audit logs are generated for login,
  logout, and failed attempts. Validate adherence to PPCC security policies
  (e.g., APRA CPS 234).

### Key Test Scenarios (all passed in GenAI Playbook implementation)

| Test                              | Description                                                                    | Result |
| --------------------------------- | ------------------------------------------------------------------------------ | ------ |
| Login with valid PPCC credentials | Navigate to app → enter PPCC credentials → redirected to app                   | PASS   |
| Login with invalid credentials    | Invalid credentials → remains on PingSSO login page, access denied             | PASS   |
| Session persistence across pages  | After login, navigate across pages without re-authentication                   | PASS   |
| Authentication event logging      | Login events, failed attempts logged with timestamps and user IDs (CloudWatch) | PASS   |
| Cross-browser compatibility       | Works on Safari, Chrome, Firefox, Edge                                         | PASS   |
| SQL injection prevention          | SQL injection strings in login fields rejected                                 | PASS   |
| Performance                       | Authentication completes in 1–2 seconds                                        | PASS   |

---

## Part 9 — Integration Checklist

### Frontend Setup

- [ ] Install `next-auth` package
- [ ] Create `auth.ts` with NextAuth configuration (OIDC provider, PKCE, JWT
      callbacks)
- [ ] Create `proxy.ts` middleware for route protection
- [ ] Create `nextAuthProvider.tsx` for session context and error handling
- [ ] Set up environment variables (`NEXTAUTH_SECRET`, `WELLKNOWN_ENDPOINT`,
      `NEXT_PUBLIC_OIDC_CLIENT_ID`, `NEXT_PUBLIC_OIDC_SCOPE`)
- [ ] Create API route handler at `app/api/auth/[...nextauth]/route.ts`
- [ ] Wrap app with NextAuthProvider in root layout
- [ ] Implement `getAccessToken()` utility for API calls

### Backend Setup (FastAPI)

- [ ] Implement OAuth endpoints (`/api/auth/login`, `/api/auth/callback`,
      `/api/auth/logout`)
- [ ] Implement PKCE validation logic
- [ ] Implement JWT validation via JWKS
- [ ] Set up database schema (`auth.users`, `auth.sessions`)
- [ ] Implement secure session management with HTTP-only cookies
- [ ] Configure environment variables (`PING_ISSUER`, `PING_CLIENT_ID`,
      `PING_CLIENT_SECRET`, `WELLKNOWN_ENDPOINT`)
- [ ] Add dependency injection for protected endpoints

### Testing

- [ ] Test initial login flow
- [ ] Test protected route access
- [ ] Test API calls with token
- [ ] Test automatic token refresh
- [ ] Test session expiry behaviour
- [ ] Test logout flow
- [ ] Test cross-browser compatibility

---

## Part 10 — Troubleshooting

**Token Validation Fails (401 Unauthorized)**

- Check: Issuer matches the `iss` claim in JWT
- Check: Audience matches the `aud` claim in JWT
- Check: Token hasn't expired (check `exp` claim)
- Check: Backend can reach `{issuer}/.well-known/openid-configuration`

**Token Refresh Fails**

- Check: Refresh token hasn't expired (PingSSO configuration)
- Check: Client ID is correct
- Check: `WELLKNOWN_ENDPOINT` is accessible

**Middleware Redirect Loop**

- Check: `/auth/signin` is excluded from middleware matcher
- Check: `/api/auth/*` routes are excluded from middleware
- Check: `NEXTAUTH_SECRET` is properly set

**Session Issues**

- Check: Session has not expired (`session_expires_at > current time`)
- Check: Session is not revoked (`is_revoked = false`)
- Check: HTTP-only cookie is being set correctly

---

## Part 11 — AI-Assisted Implementation (Claude Code Templates)

PPCC provides structured AI prompt templates in the `risk-spec-driven-dev`
GitHub repository (PPCC-General org) under `integrations/pingsso/`. These are
designed for use with Claude Code:

**How to use:**

1. Open your project in Claude Code (CLI or IDE extension)
2. Copy the full contents of the relevant template markdown file
3. Paste into Claude Code with any project context (directory structure,
   existing auth, target environment)
4. Claude generates production-ready code covering: OIDC discovery, PKCE flow,
   token refresh, session handling, route protection, sign-in/sign-out
5. Review generated code against your application's patterns before committing
6. Configure environment-specific values for `WELLKNOWN_ENDPOINT` and
   `OIDC_CLIENT_ID`

**Prerequisites:** Claude Code installed, your repo cloned locally, PingSSO
environment variables ready, Node.js (for Next.js) and/or Python 3.9+ (for
FastAPI) installed.

**Available templates:** `pingsso-frontend-ai-template.md` (Next.js),
`pingsso-fastapi-backend-ai-template.md` (Python FastAPI),
`pingsso-dotnet-backend-ai-template.md` (.NET/C#). Note: these are in a private
PPCC-General GitHub org repository — you'll need org access to retrieve them.
