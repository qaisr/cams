---
name: migrate-claude-framework
description: >
  Orchestrates the migration of the .claude framework to a new target directory,
  adapted for a user-specified technology stack. Supports three input modes:
  manual technology selection, analysis of an existing project directory, or
  analysis of the current repository. Generates a sequence of small, focused,
  self-destructive migration commands — one per .claude subdirectory — and
  executes them in order. Each migration command deletes itself upon successful
  completion.
version: 2.2.0
requires:
  workflows:
    - .claude/workflows/framework-sync.md
  agents:
    - .claude/agents/ai-strategist.md
interaction: conversational
phases: 3
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# 🚚 Migrate Claude Framework Command

This command does NOT migrate files directly. Instead, it:

1. Determines target technologies — via manual input OR project analysis
2. Optionally ingests custom instruction files per technology
3. Generates a sequence of small, focused migration commands
4. Runs them one at a time in order
5. Each command self-destructs after successful completion
6. Guides you to the next step after each one

This approach keeps each migration step small, focused, and recoverable.

**Ground Rules for Claude:**
- Never migrate files directly in this command — only generate the migration commands
- Never assume a technology should be kept — always confirm with the user
- When analyzing a project, treat findings as SUGGESTIONS — user always confirms
- Always offer plain text as the last option for describing technology changes
- Generated migration commands must be self-consistent and independent
- Each generated command must delete itself on successful completion
- Always tell the user what was just done and what comes next
- If the user stops mid-migration, they can resume from the next numbered command
- Custom instruction files are OPTIONAL — never block progress if not provided
- When custom instruction files ARE provided, deeply incorporate their content
  into the relevant generated migration commands — not as an appendix, but woven
  into the standards, examples, checklists, and patterns throughout

---

## PHASE 1 — TARGET & STACK CONFIGURATION

```
🚚 Claude Framework Migration

I'll help you migrate your .claude framework to a new location,
adapted for your chosen technology stack.

Rather than doing everything at once, I'll generate a sequence of
small migration commands — one per directory — that run in order
and self-destruct after each successful step.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Output directory
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Where should the migrated framework be created?

This will generate the following structure:
  <your-path>/.claude/agents/
  <your-path>/.claude/standards/
  <your-path>/.claude/workflows/
  <your-path>/.claude/commands/
  <your-path>/.claude/skills/        (if present)
  <your-path>/.claude/CLAUDE.md

Examples:
  ../my-other-project           → ../my-other-project/.claude/
  ./variants/python-fastapi     → ./variants/python-fastapi/.claude/
  /workspace/new-service        → /workspace/new-service/.claude/

Type the output directory path:
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
STEP 2 — Migration scope

 [1]  Full .claude framework     (all subdirectories — recommended)
 [2]  Select specific dirs       — I'll choose which
 [3]  Everything except          — I'll specify exclusions

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

If [2] or [3], show detected directories:
```
Detected .claude directories:
  [ ]  .claude/agents/
  [ ]  .claude/standards/
  [ ]  .claude/workflows/
  [ ]  .claude/commands/
  [ ]  .claude/skills/         (if present)
  [ ]  .claude/CLAUDE.md       (root config)

Type the numbers/names to include or exclude:
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
STEP 3 — Migration goal

 [1]  New project, same company  (keep internal tooling constraints)
 [2]  New project, different team(clean slate — review all constraints)
 [3]  Open source / public use   (remove all company-specific references)
 [4]  Personal / side project    (lightweight, remove enterprise constraints)
 [5]  Different technology stack (major stack change)

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — How should I determine the target technology stack?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 [1]  Manual selection
      I'll walk you through each constraint one by one and
      you tell me what to keep, replace, remove, or modify.
      Best when: you already know exactly what the new stack is.

 [2]  Analyze an existing project
      Give me a path to another project and I'll scan its
      dependency and config files to detect the technology stack,
      then present my findings for you to confirm.
      Best when: you're aligning the framework to an existing codebase.

 [3]  Analyze the current repository
      I'll scan this repository — the one where this .claude
      folder lives — and detect what technologies are actually
      being used, then suggest what to keep, replace, or remove.
      Best when: the framework has drifted from the actual codebase,
      or you want to start fresh from what's really here.

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

If [1]: proceed directly to **PHASE 2 — TECHNOLOGY CONSTRAINT DECISIONS** (manual flow).
If [2]: proceed to **PHASE 1b — ANALYZE EXISTING PROJECT**.
If [3]: proceed to **PHASE 1b — ANALYZE CURRENT REPOSITORY**.

---

## PHASE 1b — PROJECT ANALYSIS
> *Only reached if user selected [2] or [3] in Step 4*

---

### If user selected [2] — Analyze an existing project:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECT ANALYSIS — Existing Project
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Provide the path to the project you want to analyze:

  Examples:
    ../my-other-service
    /workspace/projects/new-api
    ~/dev/frontend-app

Type the project path:
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

### If user selected [3] — Analyze the current repository:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECT ANALYSIS — Current Repository
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
I'll analyze this repository to detect the technologies in use.
Scanning now...
──────────────────────────────────────────
```

### Analysis — same process for both [2] and [3]:

Scan the project for all of the following files, reading each one found:

```
Dependency & build files:
  package.json / package-lock.json / pnpm-lock.yaml / yarn.lock
  pnpm-workspace.yaml / turbo.json / tsconfig.json
  pyproject.toml / setup.py / setup.cfg / requirements.txt / Pipfile
  Cargo.toml
  go.mod
  *.csproj / *.sln
  Gemfile

Configuration & tooling files:
  sonar-project.properties
  .eslintrc* / eslint.config.*
  tsconfig.json
  next.config.* / nuxt.config.* / vite.config.* / webpack.config.*
  tailwind.config.*
  docker-compose*.yml / Dockerfile*
  .github/workflows/*.yml / .gitlab-ci.yml / Jenkinsfile / buildspec.yml
  terraform/*.tf / cdk.json / serverless.yml / samconfig.toml
  application.properties / application.yml / bootstrap.yml
  prisma/schema.prisma / prisma/migrations
  .env.example / .env.sample
  jest.config.* / vitest.config.* / playwright.config.* / cypress.config.*
  auth0.* / okta.* / cognito-*
  sonar-project.properties
  .prettierrc* / .stylelintrc*

Infrastructure hints:
  Any *.tf files       → Terraform
  cdk.json             → AWS CDK
  serverless.yml       → Serverless Framework
  buildspec.yml        → AWS CodeBuild
  appspec.yml          → AWS CodeDeploy
  Dockerfile           → Fargate container image
  k8s/ or kubernetes/  → Kubernetes
  helm/                → Helm charts
```

After scanning, produce the technology detection report:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECT TECHNOLOGY ANALYSIS
Path: [analyzed path]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Detected from: [list of files actually found and read]

┌─────────────────────────────────────────────────────────────────────┐
│ Area                  │ Detected Technology        │ Detected From  │
├───────────────────────┼────────────────────────────┼────────────────┤
│ Project Structure     │ [detected]                 │ [source file]  │
│ Package Manager       │ [detected]                 │ [source file]  │
│ Frontend Framework    │ [detected / not found]     │ [source file]  │
│ Backend Framework     │ [detected / not found]     │ [source file]  │
│ Database              │ [detected / not found]     │ [source file]  │
│ DB Migration Tool     │ [detected / not found]     │ [source file]  │
│ Infrastructure        │ [detected / not found]     │ [source file]  │
│ Cloud Provider        │ [detected / not found]     │ [source file]  │
│ Authentication        │ [detected / not found]     │ [source file]  │
│ UI Library / CSS      │ [detected / not found]     │ [source file]  │
│ State Management      │ [detected / not found]     │ [source file]  │
│ API Contract Strategy │ [detected / not found]     │ [source file]  │
│ Testing — Backend     │ [detected / not found]     │ [source file]  │
│ Testing — Frontend    │ [detected / not found]     │ [source file]  │
│ Testing — E2E         │ [detected / not found]     │ [source file]  │
│ Logging               │ [detected / not found]     │ [source file]  │
│ Secrets Management    │ [detected / not found]     │ [source file]  │
│ Local Dev             │ [detected / not found]     │ [source file]  │
│ CI/CD                 │ [detected / not found]     │ [source file]  │
│ Code Quality          │ [detected / not found]     │ [source file]  │
└─────────────────────────────────────────────────────────────────────┘

⚠️  Could not detect (no config files found):
  → [area 1] — will ask you manually
  → [area 2] — will ask you manually

ℹ️  Ambiguous detections (multiple candidates found):
  → [area] — found [tech A] and [tech B] — will ask you to clarify
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Now map detected technologies against the current `.claude` framework constraints:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUGGESTED CONSTRAINT CHANGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Based on the analysis, here's what I suggest:

  ✅ KEEP     — same technology detected in project
  🔄 REPLACE  — different technology detected
  ❓ UNCLEAR  — could not detect, needs your input
  ➕ ADD      — detected in project but not in current framework

──────────────────────────────────────────

  ✅  Project Structure   : pnpm workspaces + Turborepo  (same — detected pnpm-lock.yaml)
  🔄  Backend Framework   : NestJS → FastAPI             (detected pyproject.toml with fastapi)
  🔄  Database Migration  : Prisma Migrate → Alembic     (detected alembic.ini)
  🔄  Authentication      : PingID → Auth0               (detected auth0-config.json)
  🔄  UI Library          : shadcn/ui + Tailwind         (detected tailwind.config.ts)
  🔄  Testing — Backend   : TestContainers → pytest      (detected pyproject.toml [pytest])
  🔄  Infrastructure      : AWS CDK → Terraform          (detected *.tf files)
  ✅  Testing — E2E       : Playwright                   (same — detected playwright.config.ts)
  ❓  Secrets Management  : AWS Secrets Manager → ?      (could not detect replacement)
  ❓  Logging Strategy    : Observe + CloudWatch → ?     (could not detect replacement)
  ➕  Code Quality        : Ruff + Black                 (detected in pyproject.toml — not in framework)

──────────────────────────────────────────
⚠️  These are SUGGESTIONS based on file analysis.
    You will confirm, correct, or override each one next.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Does this overall analysis look right before we go through each one?
  [Y]  Yes — walk me through confirming each suggestion
  [N]  No  — the analysis missed something significant (describe it)
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

If [N]: ask what was missed, incorporate the correction, re-show the relevant rows.

Now confirm each suggestion individually:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONFIRMING SUGGESTIONS — One at a time
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
I'll go through each suggestion. For each one:

  [Y]  Confirm — yes, this change is correct
  [N]  Reject  — keep the current framework technology instead
  [C]  Correct — the detected technology is wrong, I'll specify
  [X]  Remove  — remove this constraint entirely, not applicable
  [T]  Type it — let me describe the change in plain text

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Present each suggestion:

```
──────────────────────────────────────────
[🔄 / ✅ / ❓ / ➕]  [Area]
──────────────────────────────────────────
Current framework : [current technology and rule]
Analysis suggests : [detected technology — or "unknown" if ❓]
Detected from     : [source file(s)]

  [Y]  Confirm    [N]  Reject    [C]  Correct    [X]  Remove    [T]  Type it

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT per suggestion]**

If [C]:
```
What is the correct technology for [area]?
  Detected: [what was detected]
  Correct : [user types]

Any specific rule or constraint to add?
  (or press enter to use standard best practices)
──────────────────────────────────────────
```

If [T]:
```
Describe the change for [area] in plain text:
  (e.g. "we use Keycloak for auth with PKCE flow, hosted on-prem,
         never use cloud auth providers")
──────────────────────────────────────────
```

If [❓] and user doesn't know:
```
That's fine — options:
  [S]  Skip — remove this constraint from the migrated framework
  [K]  Keep — keep the current framework technology for now
  [T]  Type — I'll describe what we use
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

After all suggestions are confirmed, show the final decisions summary — then
**proceed to PHASE 2b (Custom Instruction Files)** — the technology decisions
are now equivalent to what manual selection produces, so the rest of the
process is identical from that point forward.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TECHNOLOGY DECISIONS CONFIRMED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Kept     : [n]  [list]
  Replaced : [n]  [list with old → new]
  Removed  : [n]  [list]
  Added    : [n]  [list]
  Corrected: [n]  [list — what was detected vs what user specified]

New constraints table (preview):
┌─────────────────────────────────────────────────────────────┐
│ Constraint          │ Rule                                  │
├─────────────────────┼───────────────────────────────────────┤
│ [constraint]        │ [rule]                                │
│ ...                 │ ...                                   │
└─────────────────────────────────────────────────────────────┘

Does this look correct?
  [Y]  Yes — proceed to custom instruction files
  [E]  Edit — I want to change something
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT — then continue to PHASE 2b]**

---

## PHASE 2 — TECHNOLOGY CONSTRAINT DECISIONS
> *Only reached if user selected [1] Manual selection in Step 4*
> *Users arriving from Phase 1b skip this phase entirely and go to Phase 2b*

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — Technology & Constraint Review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
I'll go through each technology constraint in the current framework.
For each one:

  [K]  Keep     — same technology, carry forward as-is
  [R]  Replace  — I'll specify the replacement
  [X]  Remove   — not applicable, remove all references everywhere
  [M]  Modify   — same tech, different configuration
  [T]  Type it  — let me describe the change in plain text

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Present each constraint one at a time:

```
──────────────────────────────────────────
CONSTRAINT: Project Structure / Monorepo
──────────────────────────────────────────
Current : pnpm workspaces + Turborepo — apps/, packages/, infra/
Rule    : Use pnpm workspaces. apps/ for deployable apps, packages/ for
          shared code, infra/ for CDK stacks.
Used in : CLAUDE.md, standards/backend.md, workflows/

  [K] Keep   [R] Replace   [X] Remove   [M] Modify   [T] Type it
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT — if R, ask for replacement; if M, ask for new config; if T, ask for plain text description]**

If [T] at any point:
```
Describe your requirement for [constraint area] in plain text:
  (e.g. "we use Nx for monorepo management with yarn workspaces,
         apps are in services/ not apps/, shared packages in libs/")
──────────────────────────────────────────
```

Repeat for each constraint:

```
CONSTRAINT: API Contract Strategy
Current : OpenAPI First — edit spec first, then run pnpm generate:types
          NEVER edit packages/api-spec/generated/ directly

CONSTRAINT: Frontend Framework
Current : NextJS 14 App Router — default to CSR unless SSR requested

CONSTRAINT: Backend Framework
Current : NestJS on Fargate (Fastify container behind internal ALB)

CONSTRAINT: Database
Current : PostgreSQL with Prisma Migrate
          Include comprehensive sample test data in migration changeSets

CONSTRAINT: Infrastructure
Current : AWS CDK v2 TypeScript (NOT SAM)

CONSTRAINT: Authentication
Current : PingID only — never Cognito

CONSTRAINT: Network / Connectivity
Current : AWS DirectConnect — no public AWS endpoints

CONSTRAINT: UI Component Library
Current : project-configured UI library

CONSTRAINT: Logging Strategy
Current : Observe (business events) + CloudWatch (technical)

CONSTRAINT: Route Protection
Current : All routes protected — PingID/MFA required

CONSTRAINT: Secrets Management
Current : AWS Secrets Manager / Parameter Store only

CONSTRAINT: Local Development
Current : Docker Compose + LocalStack for AWS services

CONSTRAINT: Testing Stack
Current : TestContainers (backend) + MSW (frontend) + Playwright (E2E)

CONSTRAINT: Framework Scope
Current : Local run/build/test only — deployment is code/config readiness,
          not live deploy execution
```

**[WAIT FOR USER INPUT per constraint]**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Any ADDITIONAL constraints to add for the new stack?
(new tooling, platform rules, team conventions)

Describe each, or type  none:
──────────────────────────────────────━━━━
```

**[WAIT FOR USER INPUT]**

---

## PHASE 2b — CUSTOM INSTRUCTION FILES (OPTIONAL)
> *All users arrive here — whether via manual selection, project analysis,*
> *or current repository analysis. The process is identical from this point.*

---

This phase runs immediately after all technology decisions are collected.
It asks the user if they have any supplementary instruction files for the
technologies they are introducing (REPLACE decisions) or significantly
modifying (MODIFY decisions).

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — Custom Instruction Files  ⟨ optional ⟩
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You've introduced or modified the following technologies:

  [List every REPLACE and MODIFY and ADD decision confirmed above]
  e.g.
  → Backend       : NestJS → FastAPI
  → Database      : PostgreSQL/Prisma Migrate → MongoDB/custom migrations
  → Auth          : PingID → Auth0
  → UI Library    : {current-library} → shadcn/ui + Tailwind
  → ...

For any of these, you can optionally provide a markdown file containing
special instructions, rules, standards, or context specific to that
technology or your team's usage of it.

If provided, I will deeply incorporate the content into the generated
migration commands — not just append it, but weave it into the standards,
examples, patterns, checklists, and agent behaviors throughout the
migrated framework.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
What kind of content is useful in these files?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your instruction file can contain any combination of:

  📐 Architecture & Structure
      Preferred project layout, module organization,
      naming conventions, folder structure rules

  📏 Coding Standards & Style
      Code style rules beyond defaults, preferred idioms,
      patterns the team has standardized on, anti-patterns
      to avoid, linting/formatting rules

  🔒 Security Rules
      Platform-specific auth flows, required security headers,
      internal security policies, compliance requirements (SOC2,
      HIPAA, etc.), things that must never appear in code

  🧪 Testing Requirements
      Required test types, coverage thresholds, specific test
      libraries or frameworks, testing patterns for this technology,
      what must always be tested vs what can be skipped

  🗄️  Data & Integration Patterns
      ORM conventions, query patterns, migration rules,
      API integration patterns, data validation rules

  ⚙️  Platform-Specific Rules
      Cloud provider specifics, hosting constraints, runtime
      requirements, environment configuration rules,
      infrastructure constraints

  🚫 Hard Constraints (Things Claude Must Never Do)
      e.g. "never use X library", "always use Y over Z",
      "this pattern is banned for compliance reasons"

  💡 Anything Else
      Internal docs, ADRs, team decisions, links to external
      standards — any context that helps Claude generate
      better code for this specific technology in your context

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is completely optional.
If you don't have these files or don't want to provide them,
the migration will proceed using general best practices for
each technology. You can always run /sync-framework later
to incorporate additional standards.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

For each REPLACE / MODIFY / ADD technology, ask individually:

```
──────────────────────────────────────────
[Technology Name]  (replacing [old technology])
──────────────────────────────────────────
Do you have a custom instruction file for [Technology Name]?

  [Y]  Yes — I'll provide the file path or paste the content
  [N]  No  — use general best practices for [Technology Name]
  [L]  Later — skip for now, I'll use /sync-framework after migration

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT per technology]**

If [Y]:
```
Provide your instruction file for [Technology Name]:

  [P]  Paste the content directly here
  [F]  Give me the file path to read

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

After receiving the file content, acknowledge and summarize:

```
✅ Instruction file received for [Technology Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
I found the following in your instructions:

  📐 Architecture rules  : [n found — brief summary]
  📏 Coding standards    : [n found — brief summary]
  🔒 Security rules      : [n found — brief summary]
  🧪 Testing requirements: [n found — brief summary]
  🚫 Hard constraints    : [n found — list them explicitly]
  💡 Other context       : [n found — brief summary]

These will be incorporated into the migration commands for:
  → .claude/standards/    [which standard files will be affected]
  → .claude/agents/       [which agents will be affected]
  → .claude/workflows/    [which workflows will be affected]
  → .claude/CLAUDE.md     [if any hard constraints belong in the root]

⚠️  Hard constraints identified (will be enforced everywhere):
  → [list each hard constraint explicitly for user to confirm]

Does this look right?
  [Y]  Yes — incorporate this
  [E]  Edit — I want to clarify something
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

After all technologies are addressed, show a summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CUSTOM INSTRUCTIONS SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Provided  : [n technologies with custom instructions]
              [list each with brief description of what was provided]

  Skipped   : [n technologies — will use general best practices]
              [list each]

  Deferred  : [n technologies — user will sync later]
              [list each]

All provided instructions will be deeply incorporated into
the generated migration commands.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## PHASE 3 — GENERATE MIGRATION COMMAND SEQUENCE

After confirming all decisions and ingesting all custom instruction files,
build the Migration Context Block and generate the numbered commands.

Build a **Migration Context Block** that every generated command embeds.
This now includes custom instructions and the analysis source:

```
MIGRATION CONTEXT (embedded in every generated command):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Output root      : [user-specified output path]
Source root      : .claude/
Migration goal   : [selected goal]
Stack detected by: [Manual selection / Analysis of [path] / Current repository analysis]

Technology decisions:
  KEEP    : [list]
  REPLACE : [old → new] for each replacement
  REMOVE  : [list — purge all references everywhere]
  MODIFY  : [list with new config]
  ADD     : [list with new constraints]

New constraints table:
  [full table]

Custom instruction files provided:
  [Technology A] : [summary of key rules and hard constraints]
  [Technology B] : [summary of key rules and hard constraints]
  ...

Hard constraints from custom instructions (enforce everywhere):
  → [constraint 1 — from Technology A instructions]
  → [constraint 2 — from Technology B instructions]
  → [constraint n]

Technologies using general best practices (no custom file):
  [list]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Instructions for Claude when generating each numbered command:**

When generating a migration command for a directory, for every file in that
directory that is relevant to a technology with a custom instruction file:

1. Read the custom instructions for that technology
2. Extract applicable rules for that specific file type
   (e.g. security instructions → security-auditor agent,
    testing instructions → test-strategist agent and testing standards,
    coding standards → backend/frontend standard files)
3. Weave those rules into the migrated file's content:
   - Replace generic examples with technology-specific examples
   - Add custom rules to checklists
   - Add hard constraints to "never do" sections
   - Update patterns to match team conventions
   - Add new sections where the custom instructions introduce concepts
     not present in the original framework file
4. Mark incorporated custom rules with a comment so they are traceable:
   `<!-- incorporated from [technology] custom instructions -->`

Determine sequence based on directories detected and scope selected.
Standard order (adjust if scope is partial):

```
1-migrate-agents.md
2-migrate-standards.md
3-migrate-workflows.md
4-migrate-commands.md
5-migrate-skills.md          (only if .claude/skills/ exists)
6-migrate-root.md            (CLAUDE.md and any root-level files)
```

Show the plan:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ MIGRATION COMMANDS GENERATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Created in .claude/commands/:

  ✅  1-migrate-agents.md
  ✅  2-migrate-standards.md
  ✅  3-migrate-workflows.md
  ✅  4-migrate-commands.md
  ✅  5-migrate-skills.md
  ✅  6-migrate-root.md

Custom instructions incorporated into:
  [Technology A] → [list which commands it affects]
  [Technology B] → [list which commands it affects]

Each command will:
  → Migrate one directory to [output path]/.claude/
  → Show you each file before writing it
  → Delete itself after successful completion
  → Tell you the next command to run

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  If you stop mid-migration, resume by running the
    next numbered command that still exists in .claude/commands/

    ls .claude/commands/*-migrate-*.md

Ready to begin?
  [Y]  Yes — run /1-migrate-agents now
  [N]  No  — I'll run each command manually when ready
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

If Y: immediately invoke the content of `1-migrate-agents.md`.
If N: end this command — user runs numbered commands manually.

---

## Generated Command Template

[Identical to v2.1.0 — no changes to the numbered command template]

---

## Recovery Instructions

If migration is interrupted at any point:

```
⚠️  To resume a stopped migration:
    Check which numbered commands still exist in .claude/commands/
    The lowest numbered one remaining is your next step.

    ls .claude/commands/*-migrate-*.md

    All technology decisions and custom instructions are embedded
    in the remaining command files — no context is lost.
```

---

## Agent

Load `@.claude/agents/ai-strategist.md` during Phase 1b (current repository analysis)
and Phase 3 (migration command generation) to validate the framework coverage of the
detected stack. Unload after the numbered migration commands are produced.
