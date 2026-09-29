---
description: Design system architecture with diagrams, ADRs, and component specifications
agent: architect
subtask: true
---

# Architecture Design

## Input

$ARGUMENTS (feature or system area to design)

## Process

### 1. Read Context

- Read `@specs/functional-specifications.md`
- Read existing architecture if any: `@.claude/docs/architecture/`
- Query CEB MCP: "PPCC architecture standards for [feature type]"
- Query CEB MCP: "PPCC AWS approved services"

### 2. Identify Constraints

Always apply:

- AWS DirectConnect (no public AWS endpoints)
- PingID via in-app NestJS `JwtAuthGuard` (internal ALB → Fargate service)
- ap-southeast-2 region only
- APRA CPS 234 compliance
- Wireframe designs (if available in `.claude/wireframes/` folder)
- NestJS on Fargate only (Fastify container behind internal ALB); CDK `ecsPatterns.ApplicationLoadBalancedFargateService`
- AWS CDK v2 for infrastructure

### 3. Architecture Document

> **Binding diagram standard:** every Mermaid diagram below MUST follow
> `@.claude/standards/mermaid-standards.md` — portable syntax (no `aws:`/iconify
> icons), emoji sparingly (≤1 per role-bearing node), the `classDef` theme
> palette, `subgraph` trust/network boundaries, and `accTitle`/`accDescr`. The
> examples in this file are illustrative; the standard governs.

#### System Context Diagram

```mermaid
graph TB
    User["👤 PPCC User<br/>(PingID MFA)"]
    NextJS["NextJS Frontend<br/>"]
    ALB["Internal ALB<br/>(ap-southeast-2)"]
    Fargate["Fargate Service<br/>(NestJS Fastify)"]
    RDS["RDS PostgreSQL<br/>(via RDS Proxy)"]
    SNS["SNS/EventBridge"]
    CW["CloudWatch + X-Ray"]

    User -->|"HTTPS + PingID"| NextJS
    NextJS -->|"REST + Bearer"| ALB
    ALB -->|"Forwarded request"| Fargate
    Fargate -->|"JwtAuthGuard validates JWT"| Fargate
    Fargate --> RDS
    Fargate --> SNS
    Fargate --> CW
```

#### Component Diagram

```mermaid
graph LR
    subgraph Frontend
        Page --> Component
        Component --> Hook
        Hook --> APIClient
    end
    subgraph API
        Controller --> Service
        Service --> Repository
        Service --> EventPublisher
        Repository --> DB[(PostgreSQL)]
        EventPublisher --> SNS
    end
    APIClient -->|OpenAPI| Controller
```

#### Sequence Diagram (per feature)

```mermaid
sequenceDiagram
    actor User
    participant FE as NextJS
    participant ALB as Internal ALB
    participant API as Fargate/NestJS
    participant DB as PostgreSQL

    User->>FE: Action
    FE->>ALB: POST /api/v1/resource (Bearer token)
    ALB->>API: Forward request
    API->>API: JwtAuthGuard validates JWT (passport-jwt + jwks-rsa)
    API->>API: NestJS Guard checks scope/role
    API->>DB: Prisma INSERT
    DB-->>API: Created record
    API-->>ALB: 201 Created
    ALB-->>FE: 201 + resource
    FE-->>User: Success state
```

#### Data Flow Diagram

#### Security Boundaries

#### NFR Analysis

### 4. Architecture Decision Records

For each key decision, create an ADR using format in `@.claude/agents/architect.md`

### 5. Technology Decisions

| Concern | Choice | Rationale | Alternatives Rejected |
|---|---|---|---|

### 6. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|

## Output Files

- Architecture: `.claude/docs/architecture/{feature}-architecture.md`
- ADRs: `.claude/docs/adr/ADR-{NNN}-{title}.md`
- Diagrams embedded in Mermaid within architecture doc

## Cross-References

- Diagram standard (binding): `@.claude/standards/mermaid-standards.md`
- Diagram authoring examples: `@.claude/commands/diagram-create.md`
- Standards: `@.claude/standards/`
- DB design: `/design-database`
- API design: `/design-api`
