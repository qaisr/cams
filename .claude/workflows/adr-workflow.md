# Workflow: Architecture Decision Record (ADR)

## When to Use
Create an ADR whenever a significant technical decision is made that:
- Affects multiple teams or components
- Has non-obvious tradeoffs
- Might be questioned in the future
- Involves technology selection
- Changes an established pattern
- Has security or compliance implications

## Agents to Load
- `architect` (primary — decision analysis)
- `tech-lead` (implementation feasibility)
- Domain-specific agent (e.g., `devops-engineer` for infra decisions)

## When NOT to Create an ADR
- Routine implementation choices (which utility function to use)
- Minor bug fixes
- Decisions already covered by existing standards

## Workflow

### Step 1: Identify Decision Needed
```
@architect We need to make a decision about: [topic]

Context: [Why is this decision needed now?]
Options being considered:
1. [Option A]
2. [Option B]
3. [Option C: Status quo / do nothing]

Constraints:
- [Technical constraint]
- [Business constraint]
- [Timeline]
```

### Step 2: Analysis
```
@architect Analyze these options against our stack:
- NestJS + NextJS + AWS Fargate (internal ALB) + RDS + Turborepo

For each option, assess:
1. Fit with existing architecture
2. Implementation complexity
3. Operational burden
4. Security implications
5. Performance implications
6. Cost implications
7. Team capability
```

### Step 3: Recommendation
```
@tech-lead Given the analysis, what is your recommendation?
Which option best balances the tradeoffs given our:
- Current team size and expertise
- Production timeline
- Existing patterns in the codebase
```

### Step 4: Document the Decision
```
@architect Create an ADR using the adr-template.md for this decision.
Fill in all sections including consequences (positive AND negative).
ADR number: ADR-{{NEXT_NUMBER}}
```

### Step 5: File the ADR
```bash
# ADRs live in:
specs/architecture/decisions/

# Naming:
ADR-001-use-prisma-orm.md
ADR-002-cursor-pagination-strategy.md
ADR-003-zod-openapi-contract-first.md

# Update the ADR index:
specs/architecture/decisions/README.md
```

### Step 6: Link to Implementation
- Reference ADR number in relevant PR description
- Add `// See ADR-003` comment in key implementation files
- Update affected `standards/` files to reference the ADR if it sets a standard

## ADR Lifecycle Management
```markdown
# When a decision is superseded:
# 1. Update old ADR status to "Superseded by ADR-XXX"
# 2. Create new ADR explaining the change and why
# 3. Update affected standards files

# When a decision is deprecated:
# 1. Update status to "Deprecated"
# 2. Add deprecation note: "Do not use this pattern for new features"
```

## ADR Index Template
```markdown
# Architecture Decision Records

## Active Decisions
| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](ADR-001-prisma-orm.md) | Use Prisma ORM | Accepted | 2024-01-15 |
| [ADR-002](ADR-002-cursor-pagination.md) | Cursor Pagination Strategy | Accepted | 2024-01-20 |
| [ADR-003](ADR-003-zod-contract-first.md) | Zod-first Contract Generation | Accepted | 2024-01-25 |

## Superseded
| ADR | Title | Superseded By |
|-----|-------|--------------|
| [ADR-000](ADR-000-class-validator.md) | Use class-validator | ADR-003 |
```

## Quick Reference: ADR Numbers by Domain
- `001-099`: Architecture & Infrastructure
- `100-199`: Database & Data
- `200-299`: API Design
- `300-399`: Frontend
- `400-499`: Security & Auth
- `500-599`: Testing & Quality
- `600-699`: DevOps & Deployment

## Token Optimization

- **Load when**: significant architectural decision (new pattern, dependency swap, infra change, breaking API change).
- **Load only**: this workflow + `adr-template.md` + `architecture-design-standards.md`. Skip implementation patterns.
- **Unload after**: ADR committed under `specs/adr/` and indexed.
- **Hand-off to**: `architect` for design extension, originating implementation agent for execution.
