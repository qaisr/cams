# Workflow Library

All workflows live in `.claude/workflows/`.

## Delivery & Planning

| Workflow | Focus | Purpose |
| --- | --- | --- |
| `feature-development.md` | Delivery | End-to-end feature workflow from requirements through verification. |
| `epic-based-development.md` | Delivery Planning | Iterative epic-based delivery model for large application builds. |
| `local-runtime-modes.md` | Local Execution | Canonical matrix for running, building, and testing locally. |
| `runtime-diagnostics.md` | Diagnostics | Diagnose running-app problems by URL — blank screens, console/render errors, broken pages, and failing API endpoints. Covers Next.js (:3000), NestJS (:3001), and Storybook (:6006). |
| `deployment.md` | Release Readiness | Deployment process and environment gating for release preparation. |
| `production-release-checklist.md` | Release | Comprehensive pre-production checklist — code quality, testing, security, database, monitoring gates. |
| `hotfix-workflow.md` | Incident | Fast-track critical production fixes — branch strategy, minimal quality gates, emergency PR process. |

## Architecture & Design

| Workflow | Focus | Purpose |
| --- | --- | --- |
| `adr-workflow.md` | Architecture | Architecture Decision Record creation — identify options, analyze tradeoffs, document, file ADR. |
| `api-contract-workflow.md` | API | Zod→OpenAPI→orval pipeline integrity — green-field endpoint creation and change management. |
| `codegen-sync-workflow.md` | Code Generation | Keep the Prisma→Zod→OpenAPI→orval pipeline in sync after schema or spec changes. |

## UI & Accessibility

| Workflow | Focus | Purpose |
| --- | --- | --- |
| `ui-design-workflow.md` | UI Design | Step-by-step UI design process with design system integration and accessibility gates. |
| `frontend-ui-protocol.md` | UI Dev | Mandatory step-by-step protocol for every UI change — dev server, mock auth, wireframe gate, browser inspection. |
| `storybook-development.md` | Component Dev | New component checklist, Storybook dev commands, story structure, a11y audits. |
| `accessibility-audit-workflow.md` | Accessibility | Systematic WCAG 2.1 AA audit: automated axe-core scan, component audit, page-level, flow-level, and remediation. |

## Database & Data

| Workflow | Focus | Purpose |
| --- | --- | --- |
| `database-migration-workflow.md` | Database | Safe Prisma migration lifecycle — dev, staging, production, rollback, post-validation. |

## Quality & Security

| Workflow | Focus | Purpose |
| --- | --- | --- |
| `best-practices-analysis.md` | Quality Analysis | Orchestrates multi-agent analysis (architecture → security → database → tests) with cross-finding synthesis. |
| `best-practices-refactor.md` | Quality Refactor | Manages change sequencing, side-effect tracking, safety classification, and rollback guidance. |
| `security-review-workflow.md` | Security | OWASP Top 10 review, NestJS auth checks, injection prevention, secret scanning — before every PR to main. |

## Performance

| Workflow | Focus | Purpose |
| --- | --- | --- |
| `performance-optimization-workflow.md` | Performance | Baseline → bottleneck identification → optimization → re-measurement — covers frontend + backend + DB. |
| `performance-testing-workflow.md` | Performance | k6/Artillery load test design, execution, SLO validation, and CI performance budget enforcement. |

## Testing

| Workflow | Focus | Purpose |
| --- | --- | --- |
| `preflight-checks.md` | Testing | Pre-flight service check workflow — verify Postgres, API, and Frontend are running before integration/API/E2E tests. |
| `test-driven-development.md` | Testing | TDD red-green-refactor cycle for NestJS services, API endpoints, and React components. |
| `playwright-tdd-workflow.md` | E2E Testing | TDD workflow for Playwright E2E — write failing Page Object tests before implementing UI components. |

## Framework Maintenance

| Workflow | Focus | Purpose |
| --- | --- | --- |
| `framework-sync.md` | Framework Alignment | Scans `.claude/` for misalignment after codebase changes; produces surgical diffs — never full rewrites. |
| `requirements-reconciliation.md` | Requirements Change | Six-phase reconciliation of specs, epics, tasks, and code after mid-workflow requirements drift is discovered. |
| `epic-reset.md` | Delivery Reset | Destructive rollback workflow for resetting selected epics, removing their implementation, and optionally renumbering the epic queue. |
