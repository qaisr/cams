## Agent Roster

| Agent | Mode | Purpose | Load File |
| --- | --- | --- | --- |
| `build` | primary | Full development, all tools | — |
| `plan` | primary | Analysis/planning, no writes | — |
| `architect` | subagent | Architecture and design | — |
| `backend-engineer` | subagent | NestJS API: Prisma schema, Zod DTOs, OpenAPI spec, controllers, services, generation pipeline | — |
| `frontend-developer` | subagent | NextJS/React: consumes generated hooks from orval, shares Zod schemas with backend | — |
| `db-designer` | subagent | Database design and migrations | — |
| `test-engineer` | subagent | Test generation — unit, integration, API contract, E2E. Unload after generation. | `@.claude/agents/test-engineer.md` |
| `tech-lead` | subagent | Enforces code quality, standards compliance, and  best practices | `@.claude/agents/tech-lead.md` |
| `security-auditor` | subagent | OWASP, NestJS/Passport-JWT, Next.js security, PingID, APRA compliance | `@.claude/agents/security-auditor.md` |
| `devops-engineer` | subagent | CI/CD and infrastructure | `@.claude/agents/devops-engineer.md` |
| `ambiguity-analyst` | subagent | Proactive ambiguity detection — invoke BEFORE any medium/high complexity task | `@.claude/agents/ambiguity-analyst.md` |
| `architecture-reviewer` | subagent | SOLID violations, layer boundaries, NestJS/Next.js design anti-patterns | `@.claude/agents/architecture-reviewer.md` |
| `database-analyst` | subagent | N+1 queries, Prisma patterns, Prisma Migrate safety, PII identification | `@.claude/agents/database-analyst.md` |
| `test-strategist` | subagent | Test pyramid balance, false-confidence detection, missing scenario identification | `@.claude/agents/test-strategist.md` |
| `requirements-impact-analyzer` | subagent | Requirements delta analysis, epic impact mapping, preserve-vs-rework recommendations | `@.claude/agents/requirements-impact-analyzer.md` |
| `product-owner` | subagent | Requirements, user stories (Gherkin), acceptance criteria, RTM, DoD. Activated for /create-requirements, /add-feature (requirements phase), /create-epics (story writing). Unload after requirements docs are produced. | `@.claude/agents/product-owner.md` |
| `ai-strategist` | subagent | Framework health and evolution — audits `.claude/` for consistency, broken refs, stale patterns, and gaps. Activated for /sync-framework, /migrate-claude-framework, /framework-health-check. Never invoked during normal feature development. | `@.claude/agents/ai-strategist.md` |
| `accessibility-auditor` | subagent | WCAG 2.1 AA compliance — ARIA, keyboard nav, color contrast, axe-core, Lighthouse. Load for UI/component accessibility work. Unload after audit complete. | `@.claude/agents/accessibility-auditor.md` |
| `api-contract-analyst` | subagent | API contract integrity — Zod→OpenAPI→orval pipeline validation, breaking change detection, versioning. | `@.claude/agents/api-contract-analyst.md` |
| `data-migration-specialist` | subagent | Prisma schema migrations, backfill scripts, seed data, zero-downtime strategies, rollback safety. | `@.claude/agents/data-migration-specialist.md` |
| `integration-engineer` | subagent | External API/webhook integrations, SQS/EventBridge, retry logic, circuit breakers, DLQ. | `@.claude/agents/integration-engineer.md` |
| `performance-engineer` | subagent | Core Web Vitals, bundle size, Fargate autoscaling, N+1 queries, SLO enforcement, load testing. | `@.claude/agents/performance-engineer.md` |
| `jira-helper` | subagent | Read/analyze the local JIRA mirror — NL queries, search, sprint/backlog views, gap analysis, relationship maps over `_index.json`; resolves aliases; asks clarifying questions; never mutates (write-back is delegated to the `/jira-*` engine). | `@.claude/agents/jira-helper.md` |
| `confluence-search` | subagent | Discover/read/summarize/synthesize Confluence content — Rovo `search` is the org-wide primary engine, the local mirror is a citation cache. Live discovery/read/summary are never staleness-gated; every answer is cited. READ/ANALYZE only — mutation intents are named and returned to the `/confluence` router. | `@.claude/agents/confluence-search.md` |
| `figma-helper` | subagent | Read/analyze the local Figma mirror — NL queries, search, frame-tree (Mermaid), designer lookups, design→code coverage, changed-node + component-usage maps over `figma/_index.json` + `figma/_designers.json`; resolves aliases; asks clarifying questions; honours the 24h staleness check; never mutates (sync/ingest is delegated to `/figma pull`, `/figma-sync`, `/add-figma-node`; codegen/Code Connect is Phase 4). | `@.claude/agents/figma-helper.md` |
| `design-system-analyst` | subagent | Read/analyze-only Figma↔Lumen auditor — token conformance (F3), component-reuse gaps, glossary coverage + unmapped components (F4 Code Connect rung), visual-regression health (F5), handshake/a11y completeness (Phase 5) over the mirror + glossary + manifests. Routes every finding to its human-gated command (`/figma-token-drift`, `/figma-codeconnect`, `/figma-glossary`, `/figma-visual-regression`, `/design-qa`, `/design-handshake`); honours the 24h staleness check; never mutates code/canvas/mirror/mappings; MCP only inside `/figma*`. | `@.claude/agents/design-system-analyst.md` |

---
