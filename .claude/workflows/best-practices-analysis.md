---
name: best-practices-analysis
description: >
  Orchestrates the multi-agent codebase analysis phase of the
  implement-best-practices command. Coordinates agents, merges findings,
  and identifies cross-cutting issues.
version: 1.0.0
invoked_by:
  - .claude/commands/implement-best-practices.md (Phase 3)
  - .claude/commands/security-audit.md (scan phase)
  - .claude/commands/pre-release-check.md (gates phase)
agents:
  - security-auditor
  - architecture-reviewer
  - test-strategist
  - database-analyst
  - accessibility-auditor
  - performance-engineer
---

# Best Practices Analysis Workflow

## Execution Order

The analysis runs agents in this order to enable cross-referencing findings:

```
1. architecture-reviewer   → establishes structural baseline first
2. security-auditor        → needs architecture context
3. database-analyst        → needs architecture context
4. test-strategist         → needs full picture to assess test gaps
5. accessibility-auditor   → UI/component WCAG 2.1 AA audit (load when UI code is in scope)
6. performance-engineer    → SLO/bundle/query performance review (load when perf is in scope)
7. cross-cutting-synthesis → merge and correlate all findings
```

## Cross-Cutting Synthesis

After all agents report, synthesize findings to identify:

### Patterns that span agents:
- Issue appears in both security AND architecture findings?
  → Likely a systemic design problem, not a one-off fix
- Issue appears in architecture AND tests findings?
  → Pattern is established incorrectly AND tested incorrectly — both need fixing
- Database finding also a security finding?
  → Elevate severity and co-present solutions

### Dependency mapping:
Before presenting solutions, determine:
- Which fixes must happen before others (dependencies)
- Which fixes conflict with each other
- Which fixes have the highest blast radius
- Sequence recommendations for Phase 5

## Deduplication Rules

If multiple agents flag the same file/class:
1. Merge into a single finding
2. List all categories it violates
3. Elevate to highest severity among the agents
4. Present unified solution that addresses all concerns

## Finding Prioritization Matrix

```
                 HIGH Impact    LOW Impact
HIGH Effort   |  Plan for     |  Skip or
              |  next sprint  |  automate
──────────────┼───────────────┼────────────
LOW Effort    |  Do first     |  Quick wins
              |  (critical)   |  batch
```

Apply this matrix when ordering the implementation plan in Phase 4.

## Output Contract

This workflow must produce output consumable by:
- implement-best-practices.md Phase 3 (structured findings)
- implement-best-practices.md Phase 4 (risk and options data)
- best-practices-refactor.md (implementation instructions)

## Post-Analysis Framework Sync

After findings are implemented, run `/sync-framework` with the `ai-strategist` agent
(`@.claude/agents/ai-strategist.md`) to update `.claude/` standards and patterns so
future AI-generated code reflects the new practices — not the old ones.

## Cross-References

- Security review workflow: `@.claude/workflows/security-review-workflow.md`
- Accessibility audit workflow: `@.claude/workflows/accessibility-audit-workflow.md`
- Performance optimization workflow: `@.claude/workflows/performance-optimization-workflow.md`
- Security auditor: `@.claude/agents/security-auditor.md`
- Accessibility auditor: `@.claude/agents/accessibility-auditor.md`
- Performance engineer: `@.claude/agents/performance-engineer.md`
- Quality gate standards: `@.claude/standards/quality-gate-standards.md`

## Token Optimization

- **Load when**: `/implement-best-practices` Phase 3 (analysis).
- **Load only**: this workflow + the agents and standards corresponding to the categories selected in Phase 1.
- **Read-only orchestration** — emits findings; does not modify code.
- **Unload after**: findings handed to `best-practices-refactor.md`. Drop unselected-category agents/standards immediately.
- **Hand-off to**: `best-practices-refactor.md` for change sequencing.
