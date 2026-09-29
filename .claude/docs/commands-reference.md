# Slash-Commands Reference

## Existing Project Onboarding

| Command       | Purpose                                                                                                                                                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/initialize` | Onboard an existing project — scans codebase, detects tech stack, interviews user about improvements, runs ambiguity review, generates sequenced onboarding tasks in `docs/onboarding-tasks/`, seeds `specs/epics/0-epics-index.md`, and produces `docs/onboarding-guide.md` |

**When to use**: Starting a new project? → Use the greenfield workflow below.
Adopting the framework on an existing codebase? → Use `/initialize`.

**After `/initialize` completes**, grow the project with `/add-feature`.

## Epic-Based Development (Full Application from Spec)

| Command                   | Purpose                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/create-specifications`  | Generate detailed business and functional specs (single source of truth) with inline design diagrams                                                                                  |
| `/create-epics`           | Create `specs/epics/0-epics-index.md` first, then incrementally generate pending epics                                                                                                |
| `/create-epic-tasks`      | Break a large epic into self-contained tasks under `specs/epic-tasks/`                                                                                                                |
| `/implement-epic`         | Implement a single small/medium epic directly                                                                                                                                         |
| `/mark-epic-completed`    | Reconcile epic completion state using `specs/epics-implemented` and task trackers                                                                                                     |
| `/reconcile-requirements` | Align specs, epics, tasks, and code with corrected requirements mid-workflow — delete incomplete work for regeneration and retain obsolete scope only in `specs/epics-revised/`       |
| `/reset`                  | Reset selected epics back to `pending`, remove their generated/implemented artifacts, optionally roll back code, and renumber the queue if confirmed or keep IDs with `--no-renumber` |

**Workflow**: `/create-specifications` → `/create-epics` → choose
`/implement-epic` or `/create-epic-tasks` per epic size → update trackers and
`specs/epics-implemented`

**Requirements changed mid-workflow?** →
`/reconcile-requirements @path/to/corrected-requirements`

**Need to roll back delivered or generated epics?** → `/reset --after epic-00N`,
`/reset 4,5b,6`, or add `--no-renumber` to keep current IDs

## Requirements & Planning

> **Agent**: Load `@.claude/agents/product-owner.md` for any command in this
> section. The Product Owner agent drives requirements extraction, Gherkin story
> writing, acceptance criteria, and RTM generation. Unload after requirements
> documents are produced.

| Command                 | Purpose                            |
| ----------------------- | ---------------------------------- |
| `/requirements-analyze` | Analyze and document requirements  |
| `/story-create`         | Create Gherkin user stories        |
| `/story-refine`         | Refine and add acceptance criteria |
| `/estimate`             | Story point estimation             |
| `/adr-create`           | Architecture Decision Record       |
| `/rtm-create`           | Requirements Traceability Matrix   |

## Design & Architecture

| Command                | Purpose                                      |
| ---------------------- | -------------------------------------------- |
| `/design-architecture` | System architecture design                   |
| `/design-api`          | API design (OpenAPI spec first)              |
| `/design-database`     | Database schema design                       |
| `/design-ui`           | UI/UX wireframes and component plan          |
| `/diagram-create`      | Generate diagrams (ER, sequence, flow)       |
| `/design-system-setup` | Configure the project's chosen design system |

## Design & UI (Enhanced)

| Command                         | Purpose                                                                                                                                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/ui-improve`                   | Analyze and improve existing UI for quality and consistency                                                                                                                                        |
| `/ui-audit`                     | Run comprehensive UI quality audit with prioritized issues                                                                                                                                         |
| `/ui-add-component-with-design` | Design-first component creation with standards and states                                                                                                                                          |
| `/ui-review`                    | Final UI quality gate before completion                                                                                                                                                            |
| `/ui-apply-theme`               | Apply preset or custom color theme to UI components                                                                                                                                                |
| `/ui-preview-themes`            | Preview all preset themes side-by-side without applying                                                                                                                                            |
| `/ui-revert-theme`              | Rollback to previous theme version                                                                                                                                                                 |
| `/ui-export-theme`              | Export current theme configuration for reuse                                                                                                                                                       |
| `/ui-test-accessibility`        | Run focused accessibility verification and remediation planning                                                                                                                                    |
| `/wireframes-to-components`     | Analyze `.claude/wireframes/`, generate reusable Next.js components with prop design and defaults, convert to configured UI library constraints when needed, and scaffold Storybook stories/pages. |
| `/wireframes-to-storybook`      | Build the full Storybook design system from wireframes — components, stories (all 8 groups), tests, MDX docs, and a11y audits. Updates `component-usage.md` with new library entries.              |
| `/ui-theme-commands`            | Theme command catalog and usage guide                                                                                                                                                              |

## Development

| Command                   | Purpose                                                                                                                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/add-feature`            | Feature intake and epic planning — accepts description, story ID, requirements doc, or folder; auto-detects API/UI/full-stack scope; runs ambiguity review; creates epics in `specs/epics/` tracker; follows epic-based workflow |
| `/add-feature-simple`     | Lightweight single-pass feature implementation for trivial changes — skips epic creation. Use only when scope is unambiguous and small (1–3 files, no new endpoints). Routes complex requests back to `/add-feature`.            |
| `/add-component`          | Create a UI component                                                                                                                                                                                                            |
| `/add-endpoint`           | Add API endpoint (OpenAPI + impl)                                                                                                                                                                                                |
| `/database-migrate`       | Create Prisma migration with comprehensive sample seed data                                                                                                                                                                      |
| `/integrate-service`      | Third-party/AWS service integration                                                                                                                                                                                              |
| `/create-tasks`           | Create sequenced tasks for **non-functional** work — cosmetics, refactoring, accessibility, config, docs. Routes functional requests to `/add-feature`.                                                                          |
| `/create-functional-spec` | Generate functional specs from source docs or existing code                                                                                                                                                                      |
| `/debug-backend`          | Debug backend API issues with logging and diagnostics                                                                                                                                                                            |
| `/commit`                 | Smart git commit — stages, writes message, and pushes                                                                                                                                                                            |

## Testing

| Command                      | Purpose                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `/add-unit-test`             | Unit tests (Jest) for NestJS services/controllers and React components/hooks                    |
| `/add-integration-test`      | Integration tests with Testcontainers + supertest (real PostgreSQL)                             |
| `/add-api-test`              | API contract tests against the running app + OpenAPI spec validation                            |
| `/add-e2e-test`              | Playwright E2E tests using Page Object Model + auth fixtures                                    |
| `/generate-tests`            | Scan a module and generate full unit + integration test suites from scratch                     |
| `/test-coverage-audit`       | Coverage gap analysis with source inspection and prioritised improvement plan                   |
| `/test-run`                  | Execute test suite with coverage                                                                |
| `/test-performance`          | Performance test scenarios                                                                      |
| `/ui-audit-playwright`       | Audit + fix Playwright tests against best practices; back-fill missing `data-testid` attributes |
| `/playwright-coverage-audit` | Identify uncovered routes/features and generate a prioritised E2E coverage roadmap              |

## Code Quality

| Command             | Purpose                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `/setup-formatters` | Verify and fix formatter sync so Prettier, ESLint, VS Code, EditorConfig, and lint-staged all agree |
| `/review-code`      | Full code review                                                                                    |
| `/refactor`         | Refactor with patterns                                                                              |
| `/enhance-code`     | Enhance existing code                                                                               |
| `/lint-fix`         | Lint and format                                                                                     |
| `/checklist-verify` | Run quality checklist                                                                               |
| `/verify-quality`   | Comprehensive quality gate script (build + lint + tests + security)                                 |
| `/analyze-codebase` | Deep codebase analysis — architecture, patterns, debt, coverage gaps                                |

## Quality & Best Practices

> Multi-phase interactive commands that perform deep analysis, present findings
> with risk scores, and implement improvements with your confirmation at each
> step.

| Command                     | Purpose                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `/implement-best-practices` | Master interactive command — security + architecture + database + tests, full stack     |
| `/security-audit`           | Standalone focused security audit — OWASP Top 10, NestJS/Passport-JWT, Next.js          |
| `/review-tests`             | Targeted test suite quality review — quality signals, not just coverage numbers         |
| `/tech-debt-map`            | Build a prioritized technical debt register with impact × effort scoring                |
| `/pre-release-check`        | Fast pre-release gate — Security / Error Handling / Database / Tests — GO/NO-GO verdict |

## Framework & Tooling

| Command                     | Purpose                                                                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/help`                     | Contextual help for any `.claude` command, agent, workflow, or standard                                                                                           |
| `/compact`                  | Summarize active context and unload non-essential references                                                                                                      |
| `/setup-claude-memory`      | Initialise/refresh `CLAUDE.md` with project facts, stack, scripts, conventions                                                                                    |
| `/sync-framework`           | Bidirectional sync between `.claude` framework and codebase                                                                                                       |
| `/sync-claude-copilot`      | Sync `.claude` framework with VS Code and GitHub framework files                                                                                                  |
| `/sync-project-structure`   | Refresh `.claude/project-structure.md` to match current codebase layout                                                                                           |
| `/framework-health-check`   | Full audit of `.claude/` for broken references, orphan files, stale patterns, and reference-manifest drift. Read-only — produces a remediation report.            |
| `/migrate-claude-framework` | Migrate the `.claude` framework to a new tech stack — generates self-destructive migration steps                                                                  |
| `/claude-compare-import`    | Compare local `.claude` against an external `.claude` folder and generate enhancement mega-prompts in `./claude-enhancements/` without modifying either framework |

> **Agent**: Load `@.claude/agents/ai-strategist.md` when running
> `/sync-framework`, `/migrate-claude-framework`, or `/framework-health-check`.
> The AI Strategist audits the framework for stale patterns, broken references,
> and alignment gaps. Never load during normal feature development.

## Infrastructure & Deployment

| Command            | Purpose                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `/infra-setup`     | Validate and auto-fix the local development environment prerequisites and startup checks |
| `/deploy-prepare`  | Pre-deployment checklist                                                                 |
| `/deploy-pipeline` | GitHub Actions CI/CD setup                                                               |
| `/infra-review`    | Infrastructure review                                                                    |
| `/monitor-setup`   | CloudWatch/X-Ray monitoring                                                              |
| `/rollback-plan`   | Rollback procedure                                                                       |

## Documentation

| Command             | Purpose                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `/docs-technical`   | Technical documentation                                                                               |
| `/docs-runbook`     | Operational runbook                                                                                   |
| `/changelog-update` | Update changelog                                                                                      |
| `/demo`             | Run the Playwright demo suite — deterministic walkthrough of key user journeys for stakeholder review |

## Conversion & Export

> **Inbound** commands bring source material _into_ the repo as
> Markdown/CSV/Mermaid; **outbound** commands turn authored Markdown into
> deliverables (Word, PDF, HTML, slides) or render diagrams to images. All
> exports are PPCC-branded and land in `specs/exports/`; sources are never
> modified.

| Command                     | Purpose                                                                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/convert-to-markdown`      | Inbound — convert source documents (docx, pptx, pdf, xlsx/xlsm/xls, …) to Markdown for `/create-specifications` ingestion                                      |
| `/convert-image-to-mermaid` | Inbound — convert an image of a diagram into a portable Mermaid diagram beside the source image                                                                |
| `/convert-excel-to-csv`     | Inbound — convert Excel workbooks into one CSV per sheet plus a Markdown index                                                                                 |
| `/export`                   | Outbound — export a Markdown doc to PDF / DOCX / HTML / PPTX, or a Mermaid diagram to PNG / SVG / PDF. Prompts single-vs-separate when a doc links to siblings |
| `/create-presentation`      | Outbound — generate a professional, PPCC-branded slide deck (PowerPoint or reveal.js) from a brief or a project document; confirms the outline before rendering |
| `/audit-presentation`       | Outbound — audit an existing deck against the presentation standards, score it with the Quality Rubric, and apply improvements                                 |
