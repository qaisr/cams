---
description: Integrate external/internal services with secure auth, resilient error handling, and observable operations.
agent: backend-engineer
subtask: false
---

# Integrate Service

## Input
$ARGUMENTS (service and integration intent)

Examples:
- `/integrate-service "new internal customer profile API"`
- `/integrate-service "notification provider for outbound alerts"`

## Purpose
Integrate a service into the `gmdi` stack (NestJS + NextJS) with production-safe patterns.

## Pre-Flight
Load:
- `@.claude/standards/api-standards.md`
- `@.claude/standards/security-standards.md`
- `@.claude/standards/observability-standards.md`
- `@.claude/standards/quality-gate-standards.md`

## Workflow

### 1. Integration Design
Define:
- Authentication model (service-to-service, token propagation, PingID constraints where applicable)
- Retry/timeout/circuit behavior
- Error mapping and fallback behavior
- Rate limits and quota considerations

### 2. Configuration and Secrets
- Add required variables to `.env.example` and runtime config docs
- No hardcoded credentials
- Use approved secret sources only

### 3. Implementation
- Add typed client/service layer
- Add request/response validation
- Add correlation IDs in logs and traces
- Add metrics/events for critical operations

### 4. Validation
- Unit tests for happy/error paths
- Integration tests with failure simulation
- Security checks for authz/authn and sensitive data handling

## Output
- Integration summary with architecture notes, risks, and runbook updates.

## Cross-References
- `/design-api`
- `/security-audit`
- `/verify-quality`
- `/pre-release-check`
