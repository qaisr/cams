# Workflow: Security Review

## When to Use
- Before any feature merges to `main`
- After adding new API endpoints or auth flows
- When handling PII or financial data
- Before production deployments
- Quarterly security review

## Agents to Load
- `security-auditor` (primary)
- `backend-engineer` (remediation)
- Unload frontend/DB agents unless auth or data handling is in scope

## OWASP Top 10 Review Checklist

### A01: Broken Access Control
```
@security-auditor Review access control for {{feature}}:
- Is every endpoint protected by the global PingID auth guard (or explicitly @Public())?
- Are all queries scoped by orgId (multi-tenancy)?
- Are permission checks in place (@RequirePermissions + global PermissionsGuard)?
- Is there insecure direct object reference risk?
- Can a user access another org's data?
```
**Test:**
```typescript
// Contract test: cross-tenant isolation
it('returns 404 for cross-tenant access', async () => {
  const otherUserToken = await getAuthToken(await createTestUser()); // Different org
  const { status } = await request(app).get(`/documents/${docInOtherOrg.id}`)
    .set('Authorization', `Bearer ${otherUserToken}`);
  expect(status).toBe(404); // 404, not 403 (don't reveal existence)
});
```

### A02: Cryptographic Failures
- [ ] No secrets in code or env files committed to git
- [ ] AWS secrets in Parameter Store (SecureString), not env vars
- [ ] JWT uses RS256 (asymmetric) not HS256 in production
- [ ] Database connections use SSL (`sslmode=require`)
- [ ] S3 buckets encrypted at rest (SSE-S3 or SSE-KMS)
- [ ] PII fields encrypted at column level if required by policy

### A03: Injection
- [ ] All queries via Prisma ORM (parameterized) — no raw SQL with user input
- [ ] If raw SQL needed, use `prisma.$queryRaw` with `Prisma.sql` template tags
- [ ] All inputs validated via Zod before processing
- [ ] No `eval()`, `Function()`, or dynamic `require()`

### A04: Insecure Design
- [ ] Rate limiting on auth endpoints (see rate-limiting config)
- [ ] Account lockout after N failed login attempts
- [ ] Audit logging for sensitive operations (see audit-log-pattern.md)
- [ ] Principle of least privilege for IAM roles

### A05: Security Misconfiguration
```typescript
// Required NestJS (Fastify adapter) security setup in apps/api/src/bootstrap.ts:
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';

await app.register(helmet, { contentSecurityPolicy: { /* directives */ } });
await app.register(cors, {
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [],
  credentials: true,
});
await app.register(rateLimit, { max: 100, timeWindow: '15 minutes' });
```

### A06: Vulnerable Components
```bash
# Run before every PR:
pnpm snyk test --severity-threshold=high
pnpm audit --audit-level=high
```

### A07: Auth & Identity Failures
- [ ] JWT validated on every request (not just token presence)
- [ ] JWT expiry enforced (short-lived: 15min access, 7d refresh)
- [ ] Refresh token rotation implemented
- [ ] PingID claims (`sub`, `org_id`, `roles`) validated

### A08: Software Integrity Failures
- [ ] Dependencies pinned (not `^` or `~` for security-critical packages)
- [ ] Lock file committed and verified in CI
- [ ] Docker images use specific digests in production

### A09: Logging & Monitoring
- [ ] No PII/secrets in logs
- [ ] All auth failures logged with IP
- [ ] CloudWatch alarms on error rate spikes
- [ ] Audit log covers all state changes (see audit-log-pattern.md)

### A10: SSRF
- [ ] No user-controlled URLs used in server-side HTTP calls without allowlist
- [ ] AWS metadata endpoint (169.254.169.254) accessible only by task role — no user-controllable SSRF path to it

## Security Sign-off Template
```markdown
## Security Review: {{Feature}} — {{Date}}

Reviewer: {{Name}}
Risk Level: LOW / MEDIUM / HIGH

| OWASP Category | Status | Notes |
|----------------|--------|-------|
| A01: Access Control | ✅ Pass | RBAC + orgId scoping verified |
| A02: Crypto Failures | ✅ Pass | No secrets in code |
| A03: Injection | ✅ Pass | Prisma parameterized queries |
| A04: Insecure Design | ⚠️ Warning | Rate limiting needs tuning |
| A05: Misconfiguration | ✅ Pass | Helmet, CORS configured |
| A06: Vulnerable Deps | ✅ Pass | Snyk scan clean |
| A07: Auth Failures | ✅ Pass | PingID JWT validated |
| A08: Integrity | ✅ Pass | Lock file verified |
| A09: Logging | ✅ Pass | Audit log implemented |
| A10: SSRF | N/A | No outbound HTTP |

**Decision:** Approved / Conditional Approval / Blocked
**Conditions:** [Any required fixes before merge]
```

## Token Optimization

- **Load when**: every PR touching auth, secrets, input validation, or external integration; before merging to `main`.
- **Load only**: `security-standards.md`, `pingid-auth-pattern.md`, `error-handling-pattern.md`. Add `audit-log-pattern.md` only when audit-relevant changes ship.
- **Read-only orchestration** — runs `security-auditor` agent and produces decision artifact.
- **Unload after**: decision recorded (Approved / Conditional / Blocked). Skip during routine implementation.
- **Hand-off to**: originating agent for fixes, `tech-lead` for sign-off.
