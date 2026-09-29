# Security Standards — PPCC Enterprise Application

> **Token optimization**: Load this file only for security work, audits, new endpoints, PII handling, or AWS resource changes. Unload after the relevant phase is complete.

## Frameworks

- APRA CPS 234 — Information Security
- OWASP Top 10 (Web + API Security)
- PPCC Security Handbook (query CEB MCP for specifics)
- PCI DSS (where applicable)
- Privacy Act 1988 (PII handling)

### OWASP Top 10 Control Mapping (Mandatory)

| OWASP Risk | Required Control in This Framework |
|---|---|
| A01 Broken Access Control | `JwtAuthGuard` (global) + `PermissionsGuard` + `@RequirePermissions` on mutations |
| A02 Cryptographic Failures | TLS 1.2+, AES-256-GCM for sensitive fields, KMS-managed keys |
| A03 Injection | `ZodValidationPipe` + Prisma parameterized queries + allowlist sanitization |
| A04 Insecure Design | OpenAPI-first + architecture/design checklist before implementation |
| A05 Security Misconfiguration | Helmet.js headers, restricted CORS allowlist, environment hardening |
| A06 Vulnerable Components | CI `pnpm audit` with fail thresholds |
| A07 Identification/Auth Failures | PingID JWT validation via JWKS + MFA enforced at the ALB/app layer |
| A08 Software/Data Integrity Failures | Signed artifacts in CI/CD, immutable container images, trusted registries |
| A09 Logging/Monitoring Failures | Structured pino logs + correlation ID + alerting on auth/rate-limit failures |
| A10 SSRF | Egress restrictions via VPC, endpoint allowlists, no arbitrary URL fetch from user input |

---

## 1. PingID Authentication

**Architecture**: Browser → NextJS → internal ALB → Fargate service (NestJS) → RDS Proxy → PostgreSQL

**CRITICAL RULES**:

- NEVER use Cognito, JWT self-signed, or Basic Auth in production
- PingID JWT validation handled in-app by `JwtAuthGuard` (passport-jwt + jwks-rsa) on the Fargate service
- JWT tokens validated using PingID JWKS endpoint (RS256)
- MFA required for all users — no exceptions
- `JwtAuthGuard` applied globally in `AppModule` — opt-out with `@Public()` only for health checks
- Fine-grained RBAC via `@RequirePermissions` + `PermissionsGuard` at controller/service layer
- All secrets in AWS Secrets Manager

### NestJS JWT Guard Pattern (Canonical)

```typescript
// apps/api/src/auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Allow @Public() routes (health checks only)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

// apps/api/src/auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: config.getOrThrow('PING_JWKS_URI'),
      }),
      algorithms: ['RS256'],
      issuer: config.getOrThrow('PING_ISSUER_URI'),
      audience: config.getOrThrow('PING_AUDIENCE'),
    });
  }

  validate(payload: Record<string, unknown>) {
    // Payload already verified by passport-jwt — extract claims
    return {
      userId:   payload.sub as string,
      email:    payload['email'] as string,
      scope:    payload['scope'] as string,
      tenantId: payload['tenantId'] as string,
    };
  }
}

// Register globally in AppModule
// app.module.ts
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },    // All routes protected by default
  { provide: APP_GUARD, useClass: PermissionsGuard }, // RBAC on mutations
],
```

### Controller Security Pattern

```typescript
// ✅ Inject validated PingID claims via @CurrentUser() — never validate tokens yourself
import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';

@Controller('api/v1/resources')
export class ResourceController {

  @Get(':id')
  // Read endpoints: protected by global JwtAuthGuard only (no extra scope needed)
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findById(id, user.userId);
  }

  @Post()
  @RequirePermissions('resources:write')   // PermissionsGuard enforces this
  async create(
    @Body(ZodValidationPipe) dto: CreateResourceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(dto, user);
  }
}

// ✅ CurrentUser decorator — reads from request set by JwtStrategy.validate()
// apps/api/src/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest().user,
);
```

### PermissionsGuard — Fine-Grained RBAC

```typescript
// apps/api/src/auth/guards/permissions.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { JwtPayload } from '../types/jwt-payload.type';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as JwtPayload;
    const scopes = (user.scope ?? '').split(' ');
    const hasAll = required.every(p => scopes.includes(p));
    if (!hasAll) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
```

---

## 2. AWS Security

### Network Security

```
Architecture:
- Fargate tasks in VPC private subnets (no public IPs)
- Internal ALB as ingress (HTTPS only, PPCC DirectConnect)
- RDS in private subnet with RDS Proxy
- All AWS API calls via DirectConnect (no public internet)
- SecurityGroups: minimal inbound rules, no 0.0.0.0/0
- NACL rules: default deny, explicit allow per service

Rules:
- Fargate tasks placed in private subnets only
- ALB listener policy: restrict to PPCC IP ranges
- Fargate task security group: allows outbound to RDS Proxy SG only
- RDS Proxy security group: allows inbound from Fargate task SG only
- No direct RDS access — always via RDS Proxy
```

### IAM Security

```
Fargate Task Role (application permissions):
- logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents
- xray:PutTraceSegments, xray:PutTelemetryRecords
- secretsmanager:GetSecretValue (specific secret ARNs only)
- s3:GetObject, s3:PutObject (specific buckets only)
- sqs:SendMessage, sqs:ReceiveMessage (specific queues only)
- events:PutEvents (specific EventBridge bus only)

Rules:
- Separate IAM task roles per Fargate service
- No wildcard (*) actions in production IAM policies
- OIDC for GitHub Actions (no long-lived access keys)
- Least privilege — grant only what's needed
```

### CDK IAM Pattern (AWS CDK v2)

```typescript
// AWS CDK v2 — least privilege Fargate task role IAM
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

// Fargate task definition with least-privilege task role
const taskDef = new ecs.FargateTaskDefinition(this, 'ApiTask', {
  taskRole: new iam.Role(this, 'ApiTaskRole', {
    assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
  }),
});

// Grant only the specific secrets needed
dbSecret.grantRead(taskDef.taskRole);

// Explicit policy for S3 (never *)
taskDef.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: ['s3:GetObject', 's3:PutObject'],
  resources: [`${uploadBucket.bucketArn}/*`],  // specific path, not bucket root
}));

// EventBridge publish permission (specific bus only)
taskDef.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: ['events:PutEvents'],
  resources: [eventBus.eventBusArn],
}));
```

### Secrets Management

```
Rules:
- All secrets in AWS Secrets Manager
- Rotation enabled (minimum 90 days)
- No secrets in: code, environment variables (.env files), CDK parameters or context
- Parameter Store for non-sensitive config only
- Fargate task role retrieves secrets; inject via ECS `secrets` mapping from Secrets Manager

In NestJS (Fargate container):
- Read secrets via AWS SDK SecretsManager client at startup (or ECS-injected env from Secrets Manager)
- Cache resolved secret in module initialization — avoid per-request SDK calls
- Never hardcode secrets in .env.production or CDK config/context
```

```typescript
// apps/api/src/config/secrets.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

@Injectable()
export class SecretsService implements OnModuleInit {
  private readonly client = new SecretsManagerClient({ region: 'ap-southeast-2' });
  private dbPassword: string;

  async onModuleInit() {
    // Resolve once at service startup — never per request
    const result = await this.client.send(
      new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN }),
    );
    const secret = JSON.parse(result.SecretString!);
    this.dbPassword = secret.password;
    process.env.DATABASE_URL = buildDatabaseUrl(secret);
  }
}
```

---

## 3. Input Validation

```typescript
// ✅ NestJS — ZodValidationPipe on all @Body() and @Query() (never naked)
@Post()
async create(
  @Body(new ZodValidationPipe(CreateResourceSchema)) dto: CreateResourceDto,
) { ... }

@Get()
async list(
  @Query(new ZodValidationPipe(ListQuerySchema)) query: ListQueryDto,
) { ... }

// ✅ ParseUUIDPipe on all @Param('id') — prevents non-UUID path injection
@Get(':id')
async getById(@Param('id', ParseUUIDPipe) id: string) { ... }

// ✅ Zod schema with strict rules
const CreateResourceSchema = z.object({
  name:   z.string().min(1).max(200),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
  email:  z.string().email().max(320),
});
```

```typescript
// ✅ Zod validation on all API responses on the frontend (trust nothing from network)
const ResourceSchema = z.object({
  id:     z.string().uuid(),
  name:   z.string().min(1).max(200),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
});

const data = ResourceSchema.parse(apiResponse.data); // throws if invalid
```

### Input Sanitization Rules

- Treat all user-provided HTML/markdown as untrusted; sanitize before render.
- Use allowlist validation for identifiers and sort fields (never interpolate user strings into queries).
- Use `.strict()` on Zod schemas to reject unexpected JSON properties at API boundaries.
- Never concatenate user input into SQL, shell commands, or file paths — use Prisma's typed query API.
- Never use `prisma.$queryRawUnsafe()` — use tagged template literals `prisma.$queryRaw\`...\`` only.

---

## 4. Data Protection

```
PII Rules (Privacy Act 1988):
- Tag all PII fields in Prisma schema with `/// @pii` JSDoc comment
- Encrypt PII at application layer before storing (AES-256-GCM via KMS)
- Never log PII values — log masked or hashed versions only
- PII access logged to CloudWatch with user identity (correlationId + userId)
- Data retention policy enforced — soft delete then purge schedule

Encryption:
- Data in transit: TLS 1.2 minimum (TLS 1.3 preferred)
- Data at rest: RDS encryption enabled (AWS KMS)
- Backups: encrypted with same KMS key
- S3 objects: SSE-KMS

Logging (what NOT to log):
- Passwords, PINs
- PingID tokens / Bearer tokens
- Credit/debit card numbers (PAN)
- Tax file numbers
- Raw PII (log masked: "user@***.com.au")
```

### Password and Secret Handling

- Application-managed passwords must use Argon2id (preferred) or bcrypt with cost >= 12.
- Never encrypt passwords for storage; always hash with per-password salt.
- Store pepper in Secrets Manager; rotate at least every 90 days.
- Compare hashes using constant-time comparison.

```typescript
// apps/api/src/auth/password.service.ts
import * as argon2 from 'argon2';

export class PasswordService {
  async hash(rawPassword: string): Promise<string> {
    return argon2.hash(rawPassword, { type: argon2.argon2id });
  }

  async verify(hash: string, rawPassword: string): Promise<boolean> {
    return argon2.verify(hash, rawPassword);  // constant-time comparison
  }
}
```

---

## 5. API Security

### Rate Limiting

```typescript
// ✅ NestJS @nestjs/throttler — per-endpoint rate limiting
// app.module.ts
ThrottlerModule.forRoot([{
  name: 'default',
  ttl: 60_000,  // 1 minute window
  limit: 100,
}]),
providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],

// ✅ Stricter limits on auth and mutation endpoints
@Throttle({ default: { limit: 5, ttl: 60_000 } })  // 5 req/min per IP
@Post('auth/login')
async login(@Body() dto: LoginDto) { ... }

// ✅ API Gateway WAF for edge-level rate limiting and DDoS protection
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';

const webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
  scope: 'REGIONAL',
  defaultAction: { allow: {} },
  rules: [{
    name: 'RateLimitRule',
    priority: 1,
    statement: {
      rateBasedStatement: {
        limit: 2000,  // requests per 5 minutes per IP
        aggregateKeyType: 'IP',
      },
    },
    action: { block: {} },
    visibilityConfig: { sampledRequestsEnabled: true, cloudWatchMetricsEnabled: true, metricName: 'RateLimitRule' },
  }],
  visibilityConfig: { sampledRequestsEnabled: true, cloudWatchMetricsEnabled: true, metricName: 'WebACL' },
});
```

### DoS Protection Layers

- Edge: AWS WAF rate-based rules on the ALB + managed bot control.
- Transport: ALB request size limits, Fargate task scaling limits.
- App: `@nestjs/throttler` per-principal limits for expensive operations.
- Data: Prisma query timeout caps and bounded pagination (`take <= 100`).

### CORS Configuration

```typescript
// ✅ CORS via @fastify/cors — we run the Fastify adapter, NOT Express.
// Never use `app.enableCors()` (Express-only). Register the plugin in bootstrap.
// apps/api/src/bootstrap.ts
import cors from '@fastify/cors';

const allowed = [
  'https://app.ppcc.com.au',
  'https://app-dev.ppcc.com.au',
  'https://app-staging.ppcc.com.au',
];

await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin || allowed.includes(origin)) cb(null, true);
    else cb(new Error('CORS: origin not allowed'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Correlation-Id'],
  credentials: true,
  maxAge: 3600,
});
```

### Security Headers (Helmet.js)

```typescript
// ✅ Security headers via @fastify/helmet — we run the Fastify adapter.
// Never `app.use(helmet())` (Express middleware); register the Fastify plugin.
// apps/api/src/bootstrap.ts
import helmet from '@fastify/helmet';

await app.register(helmet, {
  hsts: { maxAge: 31536000, includeSubDomains: true },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // add design-system CDN domains if needed
      imgSrc: ["'self'", 'data:', '*.ppcc.com.au'],
      connectSrc: ["'self'", '*.ppcc.com.au'],
      frameAncestors: ["'none'"],
    },
  },
});
```

### OAuth2/JWT Validation Standards

- Validate issuer (`iss`), audience (`aud`), expiry (`exp`), not-before (`nbf`), and key ID (`kid`) — handled by `passport-jwt` + `jwks-rsa`.
- Use short token lifetime; no long-lived bearer tokens.
- Fail closed on validation errors — return 401 without token details in response body.
- Map JWT `scope` claim to permissions with least privilege defaults.
- Log all 401/403 failures with correlationId (never log the token itself).

```typescript
// passport-jwt strategy validates: issuer, audience, expiry, RS256 signature
// See Section 1 — JwtStrategy handles all JWT validation centrally.
// Application code only reads claims from the pre-validated request.user object.
```

---

## 6. Frontend Security

```typescript
// ✅ CSP headers in next.config.js
const cspHeader = `
  default-src 'self';
  script-src 'self' 'nonce-{nonce}';
  style-src 'self';  /* add CDN domains for your design system if needed */
  img-src 'self' data: *.ppcc.com.au;
  connect-src 'self' *.ppcc.com.au;
  frame-ancestors 'none';
`;

// ✅ Never store sensitive data in localStorage
// Use httpOnly cookies for session tokens (set by server)

// ✅ No sensitive data in URL params
// ❌ /resources?token=abc123
// ✅ /resources/{id}  (token in httpOnly cookie)

// ✅ Sanitise user-generated content before rendering
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userContent);
```

---

## 7. Dependency Scanning

```bash
# Run in CI pipeline (monorepo root)
pnpm audit --audit-level=high       # All packages (frontend + backend)
pnpm --filter @repo/api audit       # Backend only
pnpm --filter @repo/web audit       # Frontend only

# Block deployment on:
# - Critical CVEs
# - High CVEs (unless risk-accepted with PPCC Security team approval)
# Optionally integrate Snyk in CI:
# npx snyk test --severity-threshold=high
```

---

## 8. Security Checklist (Pre-Deployment)

- [ ] `JwtAuthGuard` registered globally in `AppModule` — no unguarded routes
- [ ] `JwtStrategy` validates: issuer, audience, expiry, RS256 via JWKS
- [ ] `@Public()` used only on `/health` and auth-callback endpoints
- [ ] `@RequirePermissions` applied to all mutation endpoints (POST/PUT/PATCH/DELETE)
- [ ] `ZodValidationPipe` applied to all `@Body()` and `@Query()` params
- [ ] `ParseUUIDPipe` on all `@Param('id')` — no raw string IDs
- [ ] No `prisma.$queryRawUnsafe()` anywhere in codebase
- [ ] JWT validation uses PingID JWKS endpoint (PING_JWKS_URI env var)
- [ ] No secrets in code, `.env` files committed to git, or CDK parameters/context
- [ ] All secrets stored in AWS Secrets Manager with rotation enabled
- [ ] CORS `origin` allowlist from environment variable — never `'*'`
- [ ] WAF rate limiting configured on the ALB
- [ ] `@nestjs/throttler` applied to auth and mutation endpoints
- [ ] Helmet.js configured with CSP, HSTS, X-Frame-Options, Referrer-Policy
- [ ] No PII in logs (masked or hashed only); `pino` `redact` config set
- [ ] TLS 1.2+ enforced at the ALB
- [ ] Dependency scan clean (no critical/high CVEs) — `pnpm audit`
- [ ] Fargate task role: least privilege (no wildcard `*` permissions)
- [ ] Fargate tasks in VPC private subnets only
- [ ] RDS accessible only via RDS Proxy from Fargate task security group
- [ ] DirectConnect used for all AWS connectivity
- [ ] CloudWatch logs enabled for audit trail
- [ ] X-Ray tracing enabled on the Fargate service

## Cross-References

- **Architecture and design**: `@.claude/standards/architecture-design-standards.md`
- **Monorepo structure**: `@.claude/CLAUDE.md#project-structure`
- **PingID Guards**: `@.claude/patterns/pingid-auth-pattern.md`
- **Authorization patterns**: `@.claude/docs/authorization-patterns-and-architecture.md`
- PPCC Security Handbook: query CEB MCP
- API standards: `@.claude/standards/api-standards.md`
- Infrastructure: `@.claude/patterns/cdk-infrastructure-pattern.md`
- Database PII: `@.claude/standards/database-standards.md#pii-handling`
