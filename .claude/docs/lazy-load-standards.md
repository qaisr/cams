## Lazy-Load Standards (Load Only When Relevant)

| Task Type | Load File |
| --- | --- |
| **CANS built-in features** | `.claude/project-features.md` (lazy-load when auditing scope, planning epics, or onboarding) |
| **Local dev setup / infra check** | `.claude/commands/infra-setup.md` + `docs/getting-started.md` |
| **Infrastructure code review** | `.claude/commands/infra-review.md` |
| **React Query + orval patterns** | `@.claude/standards/frontend-standards.md#tanstack-query--orval-relationship` |
| **TypeScript/React Code Generation** | `@.claude/standards/typescript-formatting-standards.md` **(ALWAYS load before writing TypeScript/React)** |
| **UI Design** | **`@.claude/standards/ui-design-standards.md`** |
| **UI Implementation Workflow** | **`@.claude/workflows/ui-design-workflow.md`** |
| **Reusable UI Patterns** | **`@.claude/docs/component-library.md`** |
| **Storybook Component Library** | **`@.claude/standards/component-usage.md` (ALWAYS check before creating any UI component — reuse before creating)** |
| **Storybook Standards** | `@.claude/standards/storybook-standards.md` (story structure, CVA, a11y, test patterns) |
| **Component Architecture** | `@.claude/patterns/component-architecture.md` (folder layout, forwardRef, CVA, exports) |
| **Storybook Development** | `@.claude/workflows/storybook-development.md` (new component checklist, dev commands) |
| **UI Themes** | **`@.claude/config/ui-themes.json` + `@.claude/commands/ui-theme-commands.md`** |
| Frontend/UI | `@.claude/standards/frontend-standards.md` |
| API/Backend | `@.claude/standards/api-standards.md` |
| **HTTP API responses & status codes** | `@.claude/standards/http-response-standards.md` (load when designing endpoints, choosing status codes, designing error envelopes) |
| **Error handling (exceptions, RFC 7807, filter)** | `@.claude/patterns/error-handling-pattern.md` + `@.claude/templates/nestjs-exception-filter.ts` (load when building the exception hierarchy, global filter, upstream-error wrapping, or frontend RFC 7807 surfacing). Validation failures are **422** (400 = unparseable body). |
| Zod + OpenAPI spec generation | `@.claude/patterns/zod-openapi-pattern.md` |
| Architecture/Design | `@.claude/standards/architecture-design-standards.md` |
| **Mermaid diagrams (ANY command that emits a diagram)** | `@.claude/standards/mermaid-standards.md` — canonical, **binding** rules for every Mermaid diagram, no matter which command authors it (portable syntax, sparing emoji, `classDef` theme, `subgraph` boundaries, `accTitle`/`accDescr`). Load whenever a diagram is generated: `/diagram-create`, `/convert-image-to-mermaid`, `/create-specifications`, `/create-functional-spec`, `/create-epics`, `/create-epic-tasks`, `/design-architecture`, `/design-database`, ADRs, and any spec/epic/task/design output containing a ```` ```mermaid ```` block. Command: `@.claude/commands/convert-image-to-mermaid.md` (image → Mermaid). |
| Database | `@.claude/standards/database-standards.md` |
| Security | `@.claude/standards/security-standards.md` |
| **Internationalization (i18n)** | `@.claude/standards/internationalization-standards.md` (load when localising UI; never hardcode user-facing strings) |
| **UX writing / microcopy** | `@.claude/standards/ux-writing-standards.md` (load when writing labels, errors, empty states, toasts) |
| **Context optimization quick guidance** | `@.claude/docs/context-optimization.md` (phase → load set; hand-off pattern; compaction cues) |
| **Document export (PDF/DOCX/HTML)** | `@.claude/commands/export.md` + `@.claude/standards/document-export-standards.md` + `@.claude/standards/ppcc-brand.md` (load when exporting a Markdown doc to a deliverable; script `scripts/export-doc.ts`) |
| **Presentations (create / audit)** | `@.claude/commands/create-presentation.md` + `@.claude/commands/audit-presentation.md` + `@.claude/standards/presentation-standards.md` + `@.claude/standards/ppcc-brand.md` (load when creating, exporting-to-pptx, or auditing a slide deck) |
| **Definition of Done (all scopes)** | `@.claude/docs/definition-of-done.md` — load when verifying completion or generating task checklists |
| **Testing (all layers)** | `@.claude/standards/testing-standards.md` — canonical reference; load first for any test work |
| E2E / Playwright testing | `@.claude/standards/playwright-e2e-standards.md` + `@.claude/patterns/playwright-page-object-pattern.md` |
| TDD workflow (backend) | `@.claude/workflows/test-driven-development.md` |
| TDD workflow (E2E) | `@.claude/workflows/playwright-tdd-workflow.md` |
| Pre-flight checks | `@.claude/workflows/preflight-checks.md` — load before integration, API, or E2E tests |
| Integration test patterns | `@.claude/patterns/testcontainers-pattern.md` |
| MSW handler patterns | `@.claude/patterns/msw-handler-pattern.md` |
| Fixture factory patterns | `@.claude/patterns/fixture-factory-pattern.md` |
| Playwright POM + fixture | `@.claude/patterns/playwright-page-object-pattern.md` + `@.claude/patterns/playwright-fixture-pattern.md` |
| Test coverage audit | `@.claude/commands/test-coverage-audit.md` + `@.claude/agents/test-strategist.md` |
| API contract testing | `@.claude/commands/add-api-test.md` + `@.claude/patterns/api-contract-testing-pattern.md` + `@.claude/workflows/api-contract-workflow.md` |
| API versioning / breaking changes | `@.claude/patterns/api-versioning-pattern.md` + `@.claude/agents/api-contract-analyst.md` |
| Generate test suite | `@.claude/commands/generate-tests.md` |
| Playwright audit / coverage | `@.claude/commands/ui-audit-playwright.md` or `@.claude/commands/playwright-coverage-audit.md` |
| New feature | `@.claude/workflows/feature-development.md` |
| Epic-based dev | `@.claude/workflows/epic-based-development.md` |
| Runtime modes | `@.claude/workflows/local-runtime-modes.md` |
| Runtime diagnostics (blank screen / URL error / broken page) | `@.claude/workflows/runtime-diagnostics.md` + `@.claude/commands/diagnose-ui.md` + `@.claude/commands/debug-backend.md` |
| Deployment | `@.claude/workflows/deployment.md` |
| Production release gate | `@.claude/workflows/production-release-checklist.md` + `@.claude/commands/pre-release-check.md` |
| Hotfix / emergency fix | `@.claude/workflows/hotfix-workflow.md` + `@.claude/standards/git-workflow-standards.md` |
| Monitoring | `@.claude/standards/observability-standards.md` |
| Logging / Monitoring / Alerting | `@.claude/standards/observability-standards.md` + `@.claude/patterns/observability-pattern.md` |
| Audit logging | `@.claude/patterns/audit-log-pattern.md` |
| Authorization/RBAC Remediation | `@.claude/docs/authorization-patterns-and-architecture.md` |
| CDK infrastructure | `@.claude/patterns/cdk-infrastructure-pattern.md` |
| CI/CD pipeline / GitHub Actions | `@.claude/standards/cicd-standards.md` |
| Git branching / commits / PRs | `@.claude/standards/git-workflow-standards.md` |
| Monorepo / Turborepo / package setup | `@.claude/standards/monorepo-standards.md` — **includes mandatory dependency installation rules: always resolve latest stable before writing to package.json** |
| Accessibility audit / WCAG | `@.claude/standards/accessibility-standards.md` + `@.claude/agents/accessibility-auditor.md` + `@.claude/workflows/accessibility-audit-workflow.md` |
| Performance review / SLOs | `@.claude/standards/performance-standards.md` + `@.claude/agents/performance-engineer.md` |
| Performance optimization | `@.claude/workflows/performance-optimization-workflow.md` + `@.claude/patterns/cache-strategy-pattern.md` |
| Performance / load testing | `@.claude/workflows/performance-testing-workflow.md` |
| State management (frontend) | `@.claude/standards/state-management-standards.md` + `@.claude/patterns/state-management-pattern.md` |
| Form validation (React Hook Form) | `@.claude/patterns/form-validation-pattern.md` |
| Optimistic updates | `@.claude/patterns/optimistic-update-pattern.md` |
| orval / codegen pipeline | `@.claude/patterns/orval-codegen-pattern.md` + `@.claude/workflows/codegen-sync-workflow.md` |
| Cursor / offset pagination | `@.claude/patterns/pagination-cursor-pattern.md` |
| Prisma repository pattern | `@.claude/patterns/prisma-repository-pattern.md` |
| Prisma transactions | `@.claude/patterns/prisma-transaction-pattern.md` |
| Zod transforms / preprocessing | `@.claude/patterns/zod-transformation-pattern.md` |
| Data migration / backfill | `@.claude/standards/data-migration-standards.md` + `@.claude/agents/data-migration-specialist.md` + `@.claude/workflows/database-migration-workflow.md` |
| Database migration workflow | `@.claude/workflows/database-migration-workflow.md` + `@.claude/patterns/database-migration-pattern.md` |
| Background jobs (scheduled ECS / SQS-polling Fargate worker) | `@.claude/patterns/background-job-pattern.md` |
| Caching (Redis / React Query / CDN) | `@.claude/patterns/cache-strategy-pattern.md` |
| Search — Phase 2+ derived index (OpenSearch) | `@.claude/patterns/opensearch-derived-index-pattern.md` — Phase-1 search is Postgres-only; load ONLY for the Phase-2+ search increment |
| Feature flags | `@.claude/patterns/feature-flag-pattern.md` |
| External API / webhook integration | `@.claude/agents/integration-engineer.md` + `@.claude/patterns/eventbridge-pattern.md` + `@.claude/patterns/sns-event-pattern.md` |
| Security review (pre-merge) | `@.claude/workflows/security-review-workflow.md` + `@.claude/agents/security-auditor.md` |
| ADR / architecture decision | `@.claude/workflows/adr-workflow.md` + `@.claude/templates/adr-template.md` |
| RTM / requirements traceability | `@.claude/templates/requirements-traceability-matrix.md` |
| Data dictionary | `@.claude/templates/data-dictionary-template.md` |
| Release notes | `@.claude/templates/release-notes-template.md` |
| Deployment runbook | `@.claude/templates/deployment-runbook-template.md` |
| Best practices / full audit | `@.claude/workflows/best-practices-analysis.md` (orchestrates agents) |
| Security audit only | `@.claude/agents/security-auditor.md` + `@.claude/standards/security-standards.md` |
| Dependency & tooling health (on-demand deep scan) | `@.claude/commands/health-scan.md` — covers vulnerabilities, outdated packages, deprecations, hooksPath/husky integrity, Snyk/Dependabot triage, and formatter-config sync (Prettier = source of truth). Distinct from code-security audits; run before releases, after changing `.prettierrc*`, or when hook warnings appear. |
| Architecture review | `@.claude/agents/architecture-reviewer.md` + `@.claude/standards/architecture-design-standards.md` |
| Test quality review | `@.claude/agents/test-strategist.md` + `@.claude/standards/testing-standards.md` |
| Database review | `@.claude/agents/database-analyst.md` + `@.claude/standards/database-standards.md` |
| Pre-release gate | `@.claude/commands/pre-release-check.md` |
| Cross-cutting release gate | `@.claude/standards/quality-gate-standards.md` |
| Technical debt mapping | `@.claude/commands/tech-debt-map.md` |
| Framework sync after refactor | `@.claude/workflows/framework-sync.md` |
| VS Code framework sync | `@.claude/commands/sync-claude-copilot.md` |
| Framework comparison / enhancement | `@.claude/commands/claude-compare-import.md` |
| Codebase onboarding / analysis | `@.claude/commands/analyze-codebase.md` → produces `.claude/docs/codebase-report.md` |
| Existing project onboarding | `@.claude/commands/initialize.md` (run once at framework adoption) |
| Ambiguity before any task | `@.claude/agents/ambiguity-analyst.md` (invoke for medium/high complexity) |
| Requirements / specifications / user stories | `@.claude/agents/product-owner.md` — activate for /create-specifications, /story-create, /requirements-analyze, /create-epics. Unload after requirements docs are produced. |
| Framework health / ai tooling evolution | `@.claude/agents/ai-strategist.md` — activate for /sync-framework, /migrate-claude-framework, /framework-health-check. Never load during normal development. |
| Figma↔Lumen design-system audit (token drift / coverage / visual regression / handshake) | `@.claude/agents/design-system-analyst.md` — read/analyze-only auditor; activate for `/figma`-family audit intents (F3 token drift, F4 Code Connect coverage, F5 visual-regression + `/design-qa`, Phase-5 handshake/a11y). Routes findings to `/figma-token-drift`, `/figma-codeconnect`, `/figma-glossary`, `/figma-visual-regression`, `/design-qa`, `/design-handshake`. MCP only inside `/figma*`; never mutates. Unload after the audit. |

After each phase, trim context:

- Remove docs/agents not needed for the next phase.
- Keep one short handoff summary instead of full prior analysis.
- Re-open deep docs only when scope, risk, or design intent changes.
| Requirements change mid-workflow | `@.claude/workflows/requirements-reconciliation.md` + `@.claude/agents/requirements-impact-analyzer.md` |
| Epic reset / rollback | `@.claude/workflows/epic-reset.md` |

**CRITICAL**: For UI work, load in this order before implementation:

1. `@.claude/standards/ui-design-standards.md`
2. `@.claude/standards/component-usage.md` — ALWAYS check existing Storybook library before creating anything
3. `@.claude/docs/component-library.md`
4. `@.claude/workflows/ui-design-workflow.md`
5. `@.claude/commands/ui-theme-commands.md` (if applying theme)
6. `@.claude/config/ui-themes.json` (if applying theme)

**CRITICAL**: For best-practices / security / quality work, load in this order:

1. `@.claude/workflows/best-practices-analysis.md` (orchestration)
2. Relevant agent files (load only the agents for selected categories)
3. Relevant standards files (security, testing, database, architecture)

**CRITICAL**: For testing work, load in this order:

1. `@.claude/standards/testing-standards.md` — canonical rules (always load first)
2. Select by test layer:
   - Unit: `@.claude/agents/test-engineer.md`
   - Integration: `@.claude/patterns/testcontainers-pattern.md` + `@.claude/workflows/preflight-checks.md`
   - API contract: `@.claude/commands/add-api-test.md` + `@.claude/workflows/preflight-checks.md`
   - E2E: `@.claude/standards/playwright-e2e-standards.md` + `@.claude/patterns/playwright-page-object-pattern.md`
3. Load `@.claude/patterns/fixture-factory-pattern.md` for any test data generation
4. Load matching template from Templates Library
5. Unload testing agent and patterns after tests are generated or fixed

**Context Compaction** — for long multi-phase sessions:

- After each phase of `/implement-best-practices`, `/security-audit`, or `/tech-debt-map`, consider running `/compact` to summarise and free context.
- Each command stores key state in its output format — summarise: (a) categories selected, (b) findings confirmed, (c) changes completed, (d) deferred items.
- Key state to preserve before compacting: confirmed decisions, risk ratings, changes already implemented.

---
