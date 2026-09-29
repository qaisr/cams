# Architecture and Design Standards

## Purpose

This standard defines mandatory architecture and design practices for all generated code.
Use it with API, frontend, security, testing, and database standards.

## Canonical Runtime Architecture

- Backend ingress: **internal ALB** (private, DirectConnect-only) routing to the Fargate service. PingID enforced; JWT validated inside the NestJS app by `JwtAuthGuard`.
- Compute runtime: **AWS Fargate** running NestJS on the **Fastify adapter** (`@nestjs/platform-fastify`, never Express) as a long-lived warm container behind an internal ALB. Autoscaled via target-tracking (CPU 60% / memory 70%). Deployed via **AWS CDK v2** (never SAM, never SST).
- Batch/event tier: scheduled ECS Fargate tasks (EventBridge Scheduler → RunTask) and SQS-polling Fargate workers — both run as separate task definitions on the same cluster.
- Authentication and authorization: `JwtAuthGuard` (global) + `PermissionsGuard` + `@RequirePermissions` on mutations.
- Database: RDS PostgreSQL via RDS Proxy + Prisma ORM (Zod schemas generated from schema).
- Frontend: NextJS 16 (App Router, CSR default) + project-configured UI library, orval-generated React Query hooks.

---

## 1. Core Principles

- Prefer declarative code over imperative orchestration where possible.
- Keep strict Separation of Concerns (SoC): controller/page, application service, domain, infrastructure.
- Apply SOLID consistently, especially SRP and DIP.
- Use constructor-based Dependency Injection only.
- Design for testability first: pure domain logic, side effects at edges.
- Enforce DRY through shared utilities and reusable abstractions.
- Use composition over inheritance unless inheritance is semantically required.

---

## 2. Layered Boundaries (Clean/Hexagonal)

### Required structure

- Interface adapters: REST controllers, BFF routes, UI components.
- Application layer: use cases, orchestration, transaction boundaries.
- Domain layer: business rules, invariants, value objects.
- Infrastructure layer: repositories, external clients, messaging, persistence.

### Rules

- Controllers/pages are thin and do not contain business rules.
- Domain rules do not depend on frameworks.
- Infrastructure never calls UI/controllers directly.
- External systems are accessed behind ports/interfaces.

---

## 3. NestJS Design Rules

- Controllers: map request (validated via `ZodValidationPipe`) to service call, return response DTO. No business logic.
- Services: one business capability per method; avoid mega-service classes. Own Prisma interactions.
- Repositories (thin): optional layer for complex queries; simple CRUD stays in service via Prisma.
- Use interfaces for outbound dependencies (ports); implementations in infrastructure layer.
- Use Zod-derived types at boundaries; Prisma models stay inside service/repository layer.

### "Thin controller" — the concrete test

A controller method is thin when **every** line falls into exactly one of these
categories. If a method contains anything else, the logic belongs in a service:

1. Route/HTTP metadata: decorators (`@Get`, `@RequirePermissions`, `@HttpCode`).
2. Extracting validated input: `@Body`, `@Param`, `@Query`, `@CurrentUser`.
3. **A single delegating call** to one application-service method.
4. Returning that result (optionally mapped by a service-provided response DTO).

Objective red lines — a controller is too fat if it has ANY of:

- an `if`/`switch`/ternary that changes **business** outcome (auth-shape guards
  handled by the guard don't count);
- a `try/catch` that translates domain errors (that's the global exception
  filter's job — see `error-handling-standards.md`);
- more than **one** `await` on a service/repository (orchestrating two calls =
  a use case → move to a service method);
- any direct `prisma.*` / `PrismaService` access (controllers never touch the ORM);
- arithmetic, string-building, mapping, or looping over domain data;
- more than ~10 statements in the method body.

```typescript
// ✅ Thin — delegates once, returns the result
@Post()
@RequirePermissions('document:create')
create(@Body() dto: CreateDocumentDtoType, @CurrentUser() user: AuthUser) {
  return this.documents.create(dto, user);
}

// ❌ Fat — branching, two awaits, ORM access, error translation all belong in a service
@Post()
async create(@Body() dto: CreateDocumentDtoType, @CurrentUser() user: AuthUser) {
  const existing = await this.prisma.document.findFirst({ where: { title: dto.title } });
  if (existing) throw new ConflictException('exists');           // → service invariant
  const doc = await this.prisma.document.create({ data: { ...dto, ownerId: user.sub } });
  return { ...doc, url: `https://app/docs/${doc.id}` };          // → service mapping
}
```

### Example: port and adapter (TypeScript)

```typescript
// Domain port — no framework dependency
export interface PricingPort {
  calculatePrice(productId: string, customerTier: CustomerTier): Promise<Money>;
}

// Application service — injected via NestJS DI
@Injectable()
export class OrderPricingService {
  constructor(private readonly pricing: PricingPort) {}

  async quote(draft: OrderDraft): Promise<Money> {
    return this.pricing.calculatePrice(draft.productId, draft.customerTier);
  }
}

// Infrastructure adapter — registered via module providers
@Injectable()
export class PricingApiAdapter implements PricingPort {
  async calculatePrice(productId: string, tier: CustomerTier): Promise<Money> {
    // HTTP call to pricing service via DirectConnect
  }
}
```

---

## 4. Next.js Design Rules

- Use Server Components for data-heavy/static rendering where interactivity is not required.
- Use Client Components only for stateful interactivity, browser APIs, or event handlers.
- Keep data access in server actions/routes/services, not deeply inside presentational components.
- Presentational components should receive ready-to-render props.

### Server vs Client decision

- Server Component: fetch-only, SEO-critical content, no browser-only APIs.
- Client Component: forms, local state, event handling, drag/drop, complex interactions.

---

## 5. Dependency Injection Patterns

- All dependencies are injected through constructors.
- Avoid service locator patterns and static state.
- Prefer interface contracts for external integrations to simplify mocking and substitution.

---

## 6. Testability-First Rules

- Keep side effects isolated behind interfaces.
- Business logic functions should be deterministic with explicit inputs/outputs.
- Use builders/factories for test data to remove duplication.
- Time and randomness should be injected via abstractions (Clock, IdGenerator).

---

## 7. Consistency Rules Across Layers

- Request/response schema naming is consistent from OpenAPI to UI types.
- Error model is consistent (RFC 7807) across backend and frontend handling.
- Validation rules are mirrored at boundaries (Zod on both backend `ZodValidationPipe` and frontend forms).
- Correlation ID is propagated end-to-end.

---

## 8. Anti-Patterns to Reject

- Fat controllers/pages with business branching.
- Repositories returning entities directly to frontend boundaries.
- Duplicate business rules copied across UI and backend.
- Shared mutable singleton state for request-scoped logic.
- Utilities with mixed concerns (validation, IO, business rules in one place).

---

## 9. Architecture Checklist

- [ ] Responsibilities are separated by layer.
- [ ] Business rules are framework-agnostic and testable.
- [ ] Dependencies point inward to application/domain contracts.
- [ ] Controllers/pages remain thin.
- [ ] DTO/entity/domain boundaries are explicit.
- [ ] Transaction boundaries are in application services, not repositories/controllers.
- [ ] Repeated logic extracted to reusable components.
- [ ] Unit tests validate domain rules without heavy framework setup.

## Cross-References

- API standards: `@.claude/standards/api-standards.md`
- Frontend standards: `@.claude/standards/frontend-standards.md`
- Security: `@.claude/standards/security-standards.md`
- Testing: `@.claude/standards/testing-standards.md`
- Database: `@.claude/standards/database-standards.md`
- PingID auth pattern: `@.claude/patterns/pingid-auth-pattern.md`
- Infrastructure (AWS CDK v2): `@.claude/patterns/cdk-infrastructure-pattern.md`

## Token Optimization

- **Load when**: architectural decisions, ADR drafting, layer-boundary review, system design tasks.
- **Load only**: this standard + relevant patterns (`cdk-infrastructure-pattern.md` for infra, `pingid-auth-pattern.md` for auth, etc.). Skip implementation-level standards.
- **Unload after**: ADR committed or design accepted. Implementation switches to layer-specific standards.
