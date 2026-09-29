---
description: Deep codebase analysis — architecture, patterns, tech debt, coverage gaps, and onboarding summary. Produces a codebase-report.md. Use before starting work on an unfamiliar codebase.
agent: build
subtask: false
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# Analyze Codebase

## Input

$ARGUMENTS (optional scope limiter)
Examples:

- `/analyze-codebase` — full analysis
- `/analyze-codebase api` — API layer only
- `/analyze-codebase frontend` — frontend only
- `/analyze-codebase @apps/api/src/` — specific directory

---

## Purpose

Produces a comprehensive codebase report covering:

1. What the application does (inferred from code)
2. Architecture and layers
3. Domain model and data flow
4. Patterns in use (and deviations)
5. Tech debt and quality gaps
6. Test coverage assessment
7. Security posture
8. Onboarding guide for new developers

This command is the prerequisite for:

- `/create-functional-spec from-code` (reverse-engineered functional spec)
- `/create-specifications @path/to/requirements-or-folder` (when source business docs are available)
- Understanding an unfamiliar codebase before modifying it
- Scoping a refactoring effort

---

## Analysis Steps

### Step 1: Discovery Scan

```bash
# Codebase shape
!`find . -type f \( -name "*.ts" -o -name "*.tsx" \) | grep -v node_modules | grep -v ".test." | grep -v generated | wc -l`
!`find . -name "package.json" -not -path "*/node_modules/*" | head -15`
!`find . -name "prisma" -type d | head -5`
!`find . -name "*.prisma" | head -5`
!`find . -path "*/openapi/*.yaml" -o -path "*/openapi/*.json" | head -5`
!`find . -path "./.github/workflows/*.yml" | head -10`
!`find . -name "sst.config.ts" -o -name "cdk.json" | head -5`
!`cat package.json 2>/dev/null | grep -A5 '"scripts"'`
```

### Step 2: Dependency Analysis

```bash
# Root workspace dependencies
!`cat package.json 2>/dev/null | grep -E '"(pnpm|workspaces|turbo)"' | head -10`

# API dependencies
!`cat apps/api/package.json 2>/dev/null | grep -A 60 '"dependencies"' | head -60`
!`cat apps/api/package.json 2>/dev/null | grep -A 20 '"devDependencies"' | head -20`

# Frontend dependencies
!`cat apps/web/package.json 2>/dev/null | grep -A 60 '"dependencies"' | head -60`

# Node version
!`node --version && cat .nvmrc 2>/dev/null || cat .node-version 2>/dev/null`
```

### Step 3: Architecture Analysis

Read these files to understand architecture:

**Backend structure**

```
Read all files in:
- apps/api/src/modules/          (feature modules)
- apps/api/src/controllers/      (API surface)
- apps/api/src/services/         (business logic)
- apps/api/src/repositories/     (data access)
- apps/api/src/guards/           (auth/authorization)
- apps/api/src/config/           (configuration)
- apps/api/src/exceptions/       (error handling)
- packages/api-spec/             (OpenAPI spec)
- prisma/schema.prisma           (data model)
```

**Frontend structure**

```
Read:
- apps/web/src/app/              (pages and routes)
- apps/web/src/components/       (component inventory)
- apps/web/src/hooks/generated/  (orval-generated React Query hooks)
- apps/web/src/middleware.ts     (auth guard)
```

**Infrastructure**

```
Read:
- infra/lib/                     (CDK stacks)
- .github/workflows/             (CI/CD pipelines)
- docker-compose.yml             (local dev setup)
```

### Step 4: Pattern Detection

For each layer, identify patterns in use:

**NestJS/TypeScript patterns found**

```
Check for:
- [ ] Constructor injection vs property injection
- [ ] DTOs as Zod schemas vs plain classes
- [ ] Guard placement (controller vs method level)
- [ ] Exception handling (global filter? try/catch in controllers?)
- [ ] Logging style (structured Pino? console.log?)
- [ ] Correlation ID propagation
- [ ] OpenAPI decorators present?
- [ ] Zod validation on inputs?
- [ ] Pagination on list endpoints (cursor vs offset)?
- [ ] Soft delete pattern?
- [ ] Audit columns (createdAt, updatedBy, etc.)?
```

**TypeScript/React patterns found**

```
Check for:
- [ ] `any` types present?
- [ ] API response validation (Zod? none?)
- [ ] Error handling (error boundaries? try/catch? none?)
- [ ] Auth guard (middleware? HOC? none?)
- [ ] State management (TanStack Query? SWR? Redux? none?)
- [ ] Form validation (React Hook Form? Formik? none?)
- [ ] UI library (which component library?)
- [ ] RSC vs client components (appropriate split?)
- [ ] next/link for navigation?
- [ ] Accessibility attributes?
- [ ] Orval-generated hooks used vs manual useQuery?
```

### Step 5: Quality Assessment

```bash
# Test coverage indicators
!`find . -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" | grep -v node_modules | wc -l`
!`find . -name "*.spec.ts" -path "*/e2e/*" | wc -l`

# Try to run tests and get coverage (non-blocking)
!`pnpm turbo test --filter='!e2e' 2>/dev/null | tail -10 || echo "Tests not run"`
```

Assess:

- Test file count vs source file count ratio
- Presence of integration/supertest tests
- Presence of E2E tests (Playwright config?)
- Coverage tool configured? (Istanbul/c8)
- Orval-generated hooks covered by MSW handlers?

### Step 6: Security Posture Check

```bash
# Dependency vulnerabilities
!`pnpm audit --audit-level=high 2>/dev/null | tail -15 || echo "pnpm audit not available"`

# Secrets scan (patterns only — not executing)
!`grep -rn "password\s*=\s*[\"'][^\"']*[\"']" --include="*.ts" --include="*.env" . 2>/dev/null | grep -v test | grep -v example | grep -v placeholder | head -10`

# Auth pattern check
!`grep -rn "PingId\|pingid\|UseGuards\|JwtAuthGuard" --include="*.ts" . 2>/dev/null | head -10`
!`grep -rn "Cognito\|cognito\|AmazonCognito" --include="*.ts" . 2>/dev/null | head -5`
```

### Step 7: Technical Debt Identification

Look for:

```bash
# TODO/FIXME/HACK comments
!`grep -rn "TODO\|FIXME\|HACK\|XXX\|TEMP\|WORKAROUND" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v node_modules | head -20`

# Dead code indicators
!`grep -rn "@deprecated\|// DEPRECATED\|// UNUSED" --include="*.ts" . 2>/dev/null | grep -v node_modules | head -10`

# Disabled tests
!`grep -rn "xit(\|xdescribe(\|test.skip\|it.skip" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v node_modules | head -10`
```

---

## Output: Codebase Report

Generate `.claude/docs/codebase-report.md`:

```markdown
# Codebase Analysis Report: {APP_NAME}

**Generated**: {date}
**Scope**: {full / api / frontend / directory}
**Analyzer**: /analyze-codebase

---

## Executive Summary

{2-3 paragraph description of what this application does,
its current state, and top 3 observations}

**Codebase Health**: 🟢 Good / 🟡 Fair / 🔴 Needs Attention

---

## 1. Application Overview

### What It Does
{inferred purpose from controller names, entities, pages}

### Tech Stack Detected
| Layer | Technology | Version | Notes |
|---|---|---|---|
| Frontend | NextJS | {version} | {App Router / Pages Router} |
| UI Library | {component library / version} | {version} | {compliant / not} |
| Backend | NestJS | {version} | Fargate service behind internal ALB |
| ORM | Prisma | {version} | {migration count} migrations |
| DB Migrations | prisma migrate | | {migration count} |
| Auth | {PingID / Other} | | {Compliant / needs migration} |
| IaC | AWS CDK v2 | | |
| CI/CD | {GitHub Actions / Jenkins / none} | | |

---

## 2. Architecture

### Layer Structure
```

{ASCII or text diagram of actual layers found}

```

### API Surface
| Method | Path | Controller | Description |
|---|---|---|---|
{table of all endpoints found}

### Pages / Routes
| Route | Component | RSC/Client | Auth Guard |
|---|---|---|---|
{table of all pages found}

---

## 3. Domain Model

### Prisma Models Found
| Model | Table | Key Fields | Relationships |
|---|---|---|---|
{table from prisma/schema.prisma}

### ER Diagram
```mermaid
erDiagram
{generated from entities found}
```

---

## 4. Patterns Assessment

### ✅ Patterns Correctly Used

{list of good patterns found}

### ⚠️ Deviations from PPCC Standards

| File | Deviation | Standard | Severity |
|---|---|---|---|
| {file} | {what is wrong} | {what it should be} | High/Med/Low |

### Common Issues Found

{grouped list of recurring issues across files}

---

## 5. Test Coverage Assessment

| Layer | Source Files | Test Files | Ratio | Assessment |
|---|---|---|---|---|
| NestJS Services | {N} | {N} | {X%} | 🟢/🟡/🔴 |
| NestJS Controllers | {N} | {N} | {X%} | |
| React Components | {N} | {N} | {X%} | |
| E2E Tests | — | {N} | — | |

### Test Quality Observations

{observations about test patterns, what is well tested, gaps}

---

## 6. Security Assessment

### Auth Posture

- Auth provider: { PingID / Other }
- PingID compliant: ✅ Yes / ❌ No / ⚠️ Partial
- Endpoint protection: {All / Partial / None}

### Findings

| Severity | Finding | Location | Recommendation |
|---|---|---|---|
| High | {finding} | {file:line} | {fix} |
| Medium | | | |

### Dependency Vulnerabilities

{output from npm audit / summary}

---

## 7. Technical Debt Register

| Item | Location | Impact | Estimated Effort | Priority |
|---|---|---|---|---|
| {debt item} | {file} | High/Med/Low | S/M/L | P1/P2/P3 |

### TODO/FIXME Comments Found

{list from grep output}

---

## 8. Onboarding Guide

### Local Development Setup

```bash
{inferred from package.json scripts, README, docker-compose}
```

### Key Files to Understand First

1. {most important file}: {why}
2. {second file}: {why}
3. {third file}: {why}

### Gotchas and Non-Obvious Behaviours

{anything unusual found in the code that a new developer should know}

### Where to Add New Features

{guidance based on existing patterns}

---

## 9. Recommended Actions

### Immediate (Before Next Feature)

{Critical security issues or breaking problems}

### Short Term (This Sprint)

{High-impact quality improvements}

### Long Term (Backlog)

{Tech debt items}

---

## 10. Framework Alignment

How well does this codebase align with the `.claude/` framework standards?

| Standard | Alignment | Key Gaps |
|---|---|---|
| API Standards | {%} | {gaps} |
| Frontend Standards | {%} | {gaps} |
| Database Standards | {%} | {gaps} |
| Security Standards | {%} | {gaps} |
| Testing Standards | {%} | {gaps} |

### Migration Priority

{If not fully aligned, what to migrate first and why}

```

---

## Post-Analysis Output

After saving the report:

```

## ✅ Codebase Analysis Complete

**Report saved**: `.claude/docs/codebase-report.md`
**Health**: 🟢/🟡/🔴

### Top 5 Findings

1. {most important finding}
2. {second}
3. {third}
4. {fourth}
5. {fifth}

### Recommended Next Steps

Based on the analysis:

→ If specs do not exist and only code is available:
  /create-functional-spec from-code

→ If source requirement documents are available:
  /create-specifications @path/to/docs-or-folder

→ If starting new feature work:
  /requirements-analyze [feature name]
  (spec is ready as context)

→ If addressing technical debt:
  /review-code [highest priority files]
  then /refactor [file] [goal]

→ If improving test coverage:
  /add-unit-test for [lowest coverage class]

→ Full report: .claude/docs/codebase-report.md

```

---

## Cross-References
- Diagram standard (binding, for any Mermaid diagram): `@.claude/standards/mermaid-standards.md`
- Creates input for: `/create-functional-spec from-code`
- References: `@.claude/standards/` (for deviation detection)
- Related: `/review-code`, `/security-audit`, `/refactor`
- Output consumed by: all commands via functional spec
```

**Save to**: `.claude/commands/analyze-codebase.md`

---

Both files are complete. Here is how they work together:

## Usage Flow

```
New greenfield project
  └── /create-specifications @path/to/requirements.md
        → Reads document(s) → extracts info → generates detailed specs

Existing project, no docs
  └── /analyze-codebase                        (optional deep dive first)
        → Produces .claude/docs/codebase-report.md
  └── /create-functional-spec from-code
        → Reads codebase → reverse-engineers functional specs

Existing project, has partial docs + has code
  └── /create-specifications @path/to/partial-spec-or-folder
        → Uses source docs to generate detailed business/functional specs

Starting fresh with no info at all
  └── /create-functional-spec               (no args)
        → Prompts user to choose mode
        → Option 4: interactive interview
```

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Mode detection from arguments | No separate commands for each mode — one command, smart routing |
| File lock check before overwrite | Prevents accidental destruction of existing specs |
| Confidence annotations in output | `<!-- INFERRED -->` and `<!-- REVIEW -->` markers tell humans exactly what to verify |
| Gap analysis presented to user before generating | User can fill gaps before AI uses PPCC defaults |
| `analyze-codebase` as separate command | Useful standalone for onboarding, tech debt review, and security audit — not just for spec generation |
| Post-generation report with coverage summary | User knows immediately which sections need human attention |
| Interactive interview as option 4 | Handles the case where there is literally no source material at all |
