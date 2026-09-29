---
name: help
description: >
  Displays contextual help for any .claude command, agent, workflow, or standard.
  Shows a brief overview, what it connects to, how to invoke it, and a simplified
  walkthrough of what to expect. Accepts the name of any .claude file as its argument.
version: 1.0.0
usage: /help <name>
examples:
  - /help implement-best-practices
  - /help security-audit
  - /help ambiguity-analyst
  - /help framework-sync
  - /help (no argument — shows full index)
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# /help $ARGUMENTS

## Behaviour

When `$ARGUMENTS` is provided:
  → Look up the named file across all `.claude/` subdirectories
  → Match by filename (with or without `.md` extension)
  → Match by name field in the file's frontmatter
  → Match partial names — e.g. `security` matches `security-audit.md`
  → If multiple matches found, list them and ask which one was intended
  → If no match found, say so clearly and show the closest matches

When no `$ARGUMENTS` is provided:
  → Show the full index of all available `.claude` files (see Index Format below)

**Ground Rules for Claude:**
- Read the actual target file before generating help — never produce help from memory
- Keep help output concise — this is a quick reference, not a full re-print of the file
- Never reproduce the full file content — summarise and highlight
- Always show the "How to invoke" section — this is the most useful thing for a user
  who is reading help
- If the file references other `.claude` files, show those connections clearly
- Use plain language — help output should be readable by someone unfamiliar with
  the file

---

## Help Output Format

### For Commands (`.claude/commands/`)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖  COMMAND HELP — /[command-name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[One sentence — what this command does and when you'd reach for it]

HOW TO INVOKE
  /[command-name]
  [Any arguments or options it accepts, if applicable]

WHAT IT DOES
  [3–6 bullet points describing what the command actually does,
   in plain language. Focus on outcomes, not internal mechanics.]

PHASES
  [If the command has phases, list them as a simple numbered sequence]
  1 → [Phase name] — [one line description]
  2 → [Phase name] — [one line description]
  ...

CONNECTS TO
  Agents    : [list agents it invokes, or "none"]
  Workflows : [list workflows it invokes, or "none"]
  Standards : [list standards it references, or "none"]
  Commands  : [list other commands it hands off to or is related to]

INVOKED BY
  [List any other commands or workflows that call this one, or "standalone only"]

GOOD TO KNOW
  [1–3 short notes about behaviour that isn't obvious from the name alone.
   e.g. interaction model, self-destructing behaviour, confirmation gates, etc.]

RELATED
  [2–3 related commands or agents the user might also want to look at]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### For Agents (`.claude/agents/`)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖  AGENT HELP — [agent-name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[One sentence — what this agent specialises in]

ROLE
  [2–4 sentences describing what this agent does, what it looks for,
   and what kind of output it produces]

INVOKED BY
  [List every command or workflow that invokes this agent]
  [For each: command/workflow name → reason it's invoked there]

DIRECT INVOCATION
  [How to invoke this agent directly if applicable, or
   "This agent is invoked automatically — no direct invocation needed"]

SPECIALISATION AREAS
  [Bullet list of the key areas this agent analyses or acts on]

OUTPUT IT PRODUCES
  [What the agent returns — findings format, severity levels,
   report structure, etc. — in brief]

GOOD TO KNOW
  [1–3 non-obvious behavioural notes]

RELATED
  [Related agents or commands]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### For Workflows (`.claude/workflows/`)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖  WORKFLOW HELP — [workflow-name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[One sentence — what this workflow orchestrates]

ROLE
  [2–3 sentences — what problem this workflow solves and
   where it sits in the overall process]

INVOKED BY
  [List every command that triggers this workflow]

AGENTS IT ORCHESTRATES
  [List agents this workflow coordinates, with brief role of each]
  [agent-name] → [what it does in this workflow's context]

EXECUTION STEPS
  [Simplified numbered steps — not the full detail, just the shape]
  1 → [step]
  2 → [step]
  ...

OUTPUT / DELIVERABLE
  [What this workflow produces at the end]

GOOD TO KNOW
  [1–2 non-obvious notes]

RELATED
  [Related workflows or commands]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### For Standards (`.claude/standards/`)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖  STANDARD HELP — [standard-name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[One sentence — what area this standard governs]

COVERS
  [Bullet list of the key areas and rules this standard defines]

REFERENCED BY
  [List agents, workflows, and commands that read this standard]

KEY RULES  (top 5 most impactful)
  → [rule 1]
  → [rule 2]
  → [rule 3]
  → [rule 4]
  → [rule 5]

GOOD TO KNOW
  [Any non-obvious constraints or things that frequently cause
   confusion when this standard is applied]

RELATED
  [Related standards or agents]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Index Format
*Used when `/help` is called with no arguments*

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖  .CLAUDE FRAMEWORK — HELP INDEX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type  /help <name>  for detailed help on any item below.
Partial names work — e.g.  /help security  or  /help migrate

─────────────────────────────────────────
  COMMANDS  (/command-name)
─────────────────────────────────────────
  CANS Platform & Environment
  /infra-setup                12-point local environment check and auto-fix
  /infra-review               AWS CDK infrastructure review (IAM, security, cost)

  Onboarding & Initialization
  /initialize                 Onboard an existing codebase onto this framework

  Requirements & Planning
  /create-specifications      Generate detailed + concise specs from requirements
  /requirements-analyze       Analyze and document requirements
  /story-create               Create Gherkin user stories
  /story-refine               Refine stories with acceptance criteria
  /estimate                   Story point estimation
  /adr-create                 Architecture Decision Record
  /rtm-create                 Requirements Traceability Matrix

  Epic-Based Development
  /create-epics               Generate epics from specifications
  /create-epic-tasks          Break a large epic into self-contained tasks
  /implement-epic             Implement a single epic
  /mark-epic-completed        Reconcile epic completion state
  /reconcile-requirements     Realign epics/tasks/code after requirements change
  /reset                      Roll back epics to pending and remove artifacts

  Feature Development
  /add-feature                Feature intake, epic planning, and implementation
  /add-component              Create a UI component
  /add-endpoint               Add API endpoint (OpenAPI + implementation)
  /database-migrate           Create Prisma migration with seed data
  /integrate-service          Third-party/AWS service integration
  /create-tasks               Create tasks for non-functional work
  /create-functional-spec     Generate functional specs from code or docs
  /debug-backend              Debug backend API issues
  /commit                     Smart git commit (stage, message, push)

  Design & Architecture
  /design-architecture        System architecture design
  /design-api                 API design (OpenAPI spec first)
  /design-database            Database schema design
  /design-ui                  UI/UX wireframes and component plan
  /diagram-create             Generate diagrams (ER, sequence, flow)
  /design-system-setup        Configure the project's design system

  UI Design & Theming
  /ui-improve                 Analyze and improve existing UI
  /ui-audit                   Comprehensive UI quality audit
  /ui-add-component-with-design  Design-first component creation
  /ui-review                  Final UI quality gate
  /ui-apply-theme             Apply a color theme
  /ui-preview-themes          Preview all preset themes
  /ui-revert-theme            Rollback to previous theme
  /ui-export-theme            Export current theme config
  /ui-test-accessibility      Accessibility verification and remediation
  /wireframes-to-components   Generate components from wireframes
  /wireframes-to-storybook    Build full Storybook design system from wireframes
  /ui-theme-commands          Theme command catalog

  Testing
  /add-unit-test              Unit tests (Jest)
  /add-integration-test       Integration tests (TestContainers)
  /add-e2e-test               Playwright E2E tests
  /test-run                   Execute test suite with coverage
  /test-performance           Performance test scenarios

  Code Quality & Best Practices
  /implement-best-practices   Master interactive best practices review + implementation
  /security-audit             Standalone focused security audit (OWASP Top 10)
  /review-tests               Test suite quality review
  /tech-debt-map              Build a prioritized technical debt register
  /pre-release-check          Fast pre-release quality gate (GO/NO-GO)
  /review-code                Full code review
  /refactor                   Refactor with patterns
  /enhance-code               Enhance existing code
  /lint-fix                   Lint and format
  /checklist-verify           Run quality checklist
  /verify-quality             Comprehensive quality gate (build + lint + tests + security)
  /setup-formatters           Verify and fix Prettier/ESLint/VS Code formatter sync
  /analyze-codebase           Deep codebase analysis — architecture, patterns, debt

  Framework & Tooling
  /help                       This command — contextual help index
  /compact                    Summarize active context and unload non-essential refs
  /sync-framework             Bidirectional .claude ↔ codebase sync
  /sync-claude-copilot        Sync .claude framework with VS Code/GitHub files
  /sync-project-structure     Refresh .claude/project-structure.md
  /migrate-claude-framework   Migrate framework to a different tech stack

  Infrastructure & Deployment
  /deploy-prepare             Pre-deployment checklist
  /deploy-pipeline            GitHub Actions CI/CD setup
  /monitor-setup              CloudWatch/X-Ray monitoring setup
  /rollback-plan              Rollback procedure

  Documentation
  /docs-technical             Technical documentation
  /docs-runbook               Operational runbook
  /changelog-update           Update changelog

─────────────────────────────────────────
  AGENTS  (invoked automatically or on request)
─────────────────────────────────────────
  ambiguity-analyst           Proactive requirement clarity check — run BEFORE any feature
  security-auditor            OWASP, NestJS/Passport-JWT, Next.js, PingID security
  architecture-reviewer       SOLID, layer boundaries, NestJS/Next.js design patterns
  test-strategist             Test pyramid, quality signals, mock strategy
  database-analyst            Prisma patterns, migrations, query performance, PII
  requirements-impact-analyzer  Requirements delta analysis and epic impact mapping
  backend-engineer               NestJS API: Prisma, Zod DTOs, OpenAPI, generation pipeline
  frontend-developer          NextJS/React: pages, hooks, MSW mocks
  db-designer                 PostgreSQL schema, migrations, seed data
  test-engineer               Unit, integration, and E2E test generation
  tech-lead               Code quality and standards review
  devops-engineer             CI/CD, CDK infrastructure, deployment

─────────────────────────────────────────
  WORKFLOWS  (orchestration — invoked by commands)
─────────────────────────────────────────
  best-practices-analysis     Multi-agent analysis orchestration
  best-practices-refactor     Systematic change execution and sequencing
  epic-based-development      Iterative epic delivery model
  feature-development         End-to-end feature workflow
  local-runtime-modes         Canonical matrix for running/building/testing locally
  ui-design-workflow          UI design process with design system integration
  deployment                  Deployment process and environment gating
  framework-sync              .claude file alignment and surgical updates
  storybook-development       Storybook component development checklist
  requirements-reconciliation Six-phase reconciliation after requirements drift
  epic-reset                  Destructive rollback workflow for epics

─────────────────────────────────────────
  WHERE TO START?
─────────────────────────────────────────
  New to this CANS platform?
    → /infra-setup              set up local environment
    → .claude/project-features.md  understand what's already built

  Building a new application on the CANS platform?
    → /create-specifications    generate specs from requirements
    → /create-epics             plan your epics
    → /implement-epic           implement each epic

  Adding a feature to an existing app?
    → /add-feature              full feature intake and planning

  Before a release?
    → /pre-release-check        fast GO/NO-GO quality gate

  Moving to a different tech stack?
    → /initialize               onboard existing codebase
    → /migrate-claude-framework migrate the framework itself
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Worked Examples
*Showing what the output looks like for real files in this framework*

---

### `/help implement-best-practices`

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖  COMMAND HELP — /implement-best-practices
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The master interactive command for reviewing and systematically
implementing enterprise best practices across your full-stack codebase.

HOW TO INVOKE
  /implement-best-practices
  No arguments — it asks you everything interactively.

WHAT IT DOES
  → Lets you select which best practice categories to review
    (Security, Architecture, Backend, Frontend, Testing, Database,
     Error Handling, Performance, Code Quality — or all)
  → Scans the codebase and produces structured findings per category
  → For each finding, presents multiple solution options with honest
    trade-offs, risks, and effort estimates — you choose what to implement
  → Implements agreed changes one at a time with before/after diffs,
    waiting for your confirmation before each change
  → After all changes, offers to scan the .claude framework and update
    it to reflect what was just implemented

PHASES
  1 → Category Selection      — choose which areas to review
  2 → Scope Configuration     — how deep, what to include/exclude
  3 → Codebase Scan           — findings per category with real code evidence
  4 → Risk & Solution Options — trade-offs and alternatives per finding
  5 → Implementation          — systematic changes with per-change confirmation
  6 → Framework Sync          — update .claude to reflect new patterns

CONNECTS TO
  Agents    : security-auditor, architecture-reviewer,
              test-strategist, database-analyst
  Workflows : best-practices-analysis (Phase 3),
              best-practices-refactor (Phase 5),
              framework-sync (Phase 6)
  Standards : security.md, testing.md, backend.md, frontend.md
  Commands  : sync-framework (Phase 6 hands off here)

INVOKED BY
  Standalone only — this is a top-level command

GOOD TO KNOW
  → Never makes a code change without your explicit confirmation —
    every change is shown as a before/after diff first
  → You can pause at any point by typing  pause
  → Deferred findings are summarised at the end so nothing is lost —
    feed them into /tech-debt-map to track them
  → Run /ambiguity-analyst first if your requirements are unclear

RELATED
  /security-audit              focused security-only version
  /review-tests                focused testing-only version
  /pre-release-check           faster, opinionated pre-release gate
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### `/help ambiguity-analyst`

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖  AGENT HELP — ambiguity-analyst
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Surfaces unclear, conflicting, or assumption-heavy requirements
before implementation begins — preventing rework rather than causing it.

ROLE
  Analyses a task or request before code is written and identifies
  anything that would require a harmful assumption if left unanswered.
  Classifies each ambiguity by type and impact, asks only questions
  that have materially different implementation answers, and presents
  every question with concrete options, a clear recommendation, and
  a plain text fallback. Can also be invoked mid-task when unexpected
  complexity is discovered.

INVOKED BY
  Any code generation task of medium or high complexity
    → Triggered automatically before starting
  Any command receiving informal or verbal requirements
    → Triggered at intake
  Mid-task discovery
    → Triggered when an unexpected situation can't be safely assumed
  Direct invocation
    → "Analyse this for ambiguity before we start"

DIRECT INVOCATION
  Describe your requirement or paste the task, then ask:
  "Run ambiguity analysis on this before we start"

SPECIALISATION AREAS
  → Requirement decomposition into functional, technical, data,
    API, security, UI, and testing dimensions
  → Framework constraint cross-check against CLAUDE.md
  → Assumption mining across 8 probe areas (identity, state,
    boundaries, errors, performance, testing, security, scope)
  → Conflict detection within requests and against the codebase

OUTPUT IT PRODUCES
  → BLOCKING questions (must answer before starting) — each with
    concrete options, a marked recommendation, and a plain text fallback
  → SIGNIFICANT questions (should answer, can proceed carefully)
  → STATE+GO assumptions (stated transparently, low risk to proceed)
  → Clear to proceed confirmation when no blocking ambiguity found

GOOD TO KNOW
  → Never asks more than 5 questions at once — ruthlessly prioritised
  → Every question includes a ← RECOMMENDED or ← DEFAULT marker
    so you always have a sensible starting point
  → [T] plain text fallback is always the last option on every question —
    for when none of the presented options fit
  → Will stop mid-task and surface a question rather than guess —
    this is intentional, not a failure

RELATED
  /implement-best-practices    always pair with this for feature work
  /migrate-claude-framework    ambiguity-analyst runs during Phase 1b
                               confirmation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### `/help framework-sync`

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖  WORKFLOW HELP — framework-sync
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Keeps the .claude framework files aligned with what is actually
implemented in the codebase — in either direction.

ROLE
  After code changes are made, the .claude framework can drift out
  of sync — standards may reference old patterns, agents may check
  for things no longer used, examples may be outdated. This workflow
  scans for those misalignments and produces surgical, targeted updates
  to the affected framework files. It can also run in reverse — reading
  the framework as the source of truth and finding where the codebase
  deviates from it.

INVOKED BY
  implement-best-practices     → automatically at Phase 6 completion
  sync-framework (command)     → standalone invocation with direction choice
  security-audit               → optionally after fixes are applied
  review-tests                 → optionally after test improvements

AGENTS IT ORCHESTRATES
  None — this workflow operates on .claude files directly,
  not on agents. It reads the change manifest from the invoking
  command and applies file-level updates.

EXECUTION STEPS
  1 → Build change manifest from what was just implemented
  2 → Scan .claude/ for files affected by those changes
  3 → Classify each file: OUTDATED / INCOMPLETE / CONFLICTING /
      MISSING / ALIGNED
  4 → Produce a surgical diff for each file needing an update
  5 → Apply updates with user confirmation per file

OUTPUT / DELIVERABLE
  Updated .claude framework files that accurately reflect the
  patterns now in use in the codebase. New files created where
  a pattern was established but had no corresponding standard.

GOOD TO KNOW
  → Surgical updates only — never rewrites an entire file
  → Always quotes the specific text being replaced (before and after)
  → When invoked via /sync-framework command, user chooses direction:
    codebase→framework, framework→codebase, or bidirectional

RELATED
  /sync-framework    the interactive command that wraps this workflow
  /implement-best-practices    the primary command that triggers this
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
