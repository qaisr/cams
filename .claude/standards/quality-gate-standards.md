# Cross-Cutting Quality Gate Standards

Use this standard for enterprise release readiness and implementation verification.

## Token Discipline

- Load only for quality-gate, audit, and pre-release steps.
- Unload after decision and retain only findings summary.
- Keep context focused on blockers, risks, and remediation actions.

## Mandatory Gate Categories

Each item lists the **signal** that proves it (command, artifact, or check) and a **severity**:
`BLOCKER` = NO-GO if unmet; `WARN` = GO-with-caution if unmet with explicit owner.
Categories 1, 2, 3 are the critical gates — any unmet BLOCKER there forces NO-GO.

### 1. Correctness & regression risk — *critical*
- [ ] Every acceptance criterion for the release scope maps to a passing test or verified check (RTM / story AC). — **BLOCKER**
- [ ] `pnpm test` + affected integration/E2E suites pass for changed modules. — **BLOCKER**
- [ ] No known open regression in a changed module. — **BLOCKER**

### 2. Security & compliance — *critical*
- [ ] Auth + input validation enforced on every changed/added entry point (guard + Zod DTO present). — **BLOCKER**
- [ ] No secrets in source, config, or logs (gitleaks clean; secrets via Secrets Manager / Parameter Store). — **BLOCKER**
- [ ] Compliance-sensitive flows (PII, money movement, authz decisions) reviewed and verified. — **BLOCKER**
- [ ] Dependency scan (Snyk / Dependabot) shows no unresolved high/critical on release scope. — **WARN** (BLOCKER if exploitable in changed path)

### 3. Reliability & fault tolerance — *critical*
- [ ] Failure modes for new logic are deterministic (no unhandled rejection / silent catch). — **BLOCKER**
- [ ] External dependency calls have timeout + retry/fallback (or documented why not). — **WARN**
- [ ] Error responses expose no stack traces or internal detail to clients. — **BLOCKER**

### 4. Performance & capacity
- [ ] Critical journeys meet the latency/resource budget in `performance-standards.md` (or no budget regression). — **WARN**
- [ ] New queries/endpoints reviewed for N+1 and unbounded result sets. — **WARN**

### 5. Observability & supportability
- [ ] Logs for new critical workflows are structured and carry a correlation id. — **WARN**
- [ ] Metrics/traces/events exist for new critical workflows. — **WARN**
- [ ] Runbook / operational impact documented when a new failure mode or dependency is introduced. — **WARN**

### 6. UX / accessibility & user safety
- [ ] Accessibility checks pass for changed UI (axe/Lighthouse; keyboard nav; ARIA). — **BLOCKER** for UI scope
- [ ] Navigation, empty states, and pagination behave consistently and predictably. — **WARN**

### 7. Testability & delivery confidence
- [ ] Coverage appropriate to risk: unit + integration for backend, component + E2E for UI. — **WARN** (BLOCKER below threshold in `testing-standards.md`)
- [ ] `pnpm lint` zero warnings, `pnpm type-check` zero errors, `pnpm build` succeeds for release scope. — **BLOCKER**

## Release Verdict Policy

- **GO**: no unmet BLOCKER in any category, and all critical gates (1–3) pass.
- **GO with caution**: only unmet WARN items remain, each with an explicit named owner and follow-up.
- **NO-GO**: any unmet BLOCKER, or any unresolved blocker in correctness, security, or reliability.

## Token Optimization

- **Load when**: `/pre-release-check`, `/verify-quality`, release-gate review, or PR sign-off.
- **Load only**: this standard. Other standards load on-demand when a gate fails.
- **Unload after**: gate decision (GO / GO-with-caution / NO-GO) recorded.
