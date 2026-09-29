# Context Optimization — Quick Guidance

> **Purpose**: keep agent context small and focused so the model spends tokens
> on reasoning, not on background reading.

This is a quick lookup for **what to load** and **what to drop** at each stage
of work. Per-file Token Optimization sections (in agents, standards, workflows,
patterns) are the canonical detail; this doc is the index.

## The Four Rules (guidance, not hard gates)

These are heuristics to keep context focused — apply judgment, don't follow them
mechanically. Dropping something you still need only to re-read it moments later
wastes more tokens than it saves.

1. **Load by task, not by topic.** Prefer the smallest set of files that answers
   the current question.
2. **Unload when a phase clearly ends** — drop standards/agents you no longer
   need. If you're likely to need a doc again within the same phase, keep it.
3. **Prefer summaries to deep docs** where a summary is genuinely sufficient. A
   two-line summary of the last phase usually beats re-loading the full plan.
4. **Re-load on scope change.** If the work pivots (new layer, new constraint),
   re-evaluate what to load.

## Generation Phase Exception (Authoritative)

The four rules above are **RELAXED** during generation of: business
requirements, functional specifications, epics, epic tasks, non-functional
tasks, user stories, acceptance criteria, RTM, and requirements analyses.

**Why:** business requirement and functional specification documents are
intentionally large and detailed. Compressing or skipping them to save tokens
produces incomplete epics, missing requirements, and broken traceability — which
costs far more tokens in downstream rework than the input cost saved.

**Rules during generation:**

- Load source documents in full — `specs/business-requirements.md`,
  `specs/functional-specifications.md`, requirements folders, wireframes, and
  any user-supplied input files. **Do not summarise, truncate, or skip sections
  to save tokens.**
- Load the full template + standards set the generated artifact depends on (e.g.
  epic template, task template, DoD, authorization patterns, relevant standards
  for the scope being generated).
- The generated artifact itself may also be long. Optimise for completeness,
  fidelity to the source, and traceability — not for token count.
- Only the **detailed** specs are produced: `specs/business-requirements.md` and
  `specs/functional-specifications.md`. There is no concise variant. These
  detailed documents are the single source of truth for planning, design, and
  implementation alike.
- Because the detailed specs are large, generation commands may **extract** the
  scoped slice they need (relevant entities, flows, endpoints, permissions,
  diagrams) from the detailed specs plus `specs/epics/0-epics-index.md` and
  `specs/epics-implemented/*.md`, and then **optionally unload** the large
  detailed specs once that scoped context is captured — but only where it helps
  and only after extraction is complete. Context overflow is not a concern, so
  never trade completeness or traceability for a smaller context.
- Tracker-first / incremental generation patterns (e.g. `/create-epics`
  bootstrap mode, `/create-epic-tasks` per-epic breakdown) still apply — they
  are _batching_ strategies, not summarisation strategies. Within each batch,
  source documents are read in full.

**Applies to:** `/create-specifications`, `/create-functional-spec`,
`/requirements-analyze`, `/create-epics`, `/create-epic-tasks`, `/create-tasks`,
`/story-create`, `/rtm-create`, `/add-feature` (epic-planning phase only).

**Resumes normal discipline:** once the generated artifact is written and the
workflow moves into implementation/build/test/review, the standard phase-based
load/unload rules below resume.

## Phase → Load Set

| Phase                                                           | Load (must-have)                                                                                                                          | Add only if relevant                                                                    | Always unload after                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Requirements & specs                                            | `agents/product-owner.md`, `agents/ambiguity-analyst.md`                                                                                  | `templates/business-requirements.md`, `templates/functional-specifications.md`          | the analyst & PO agents once spec is committed       |
| Architecture / design                                           | `agents/architect.md`, `standards/architecture-design-standards.md`                                                                       | `patterns/cdk-infrastructure-pattern.md`, ADR template                                  | implementation-level patterns                        |
| Database / schema                                               | `agents/db-designer.md`, `standards/database-standards.md`, `patterns/prisma-repository-pattern.md`                                       | `standards/data-migration-standards.md`, `patterns/prisma-transaction-pattern.md`       | UI/frontend standards                                |
| API / backend                                                   | `agents/backend-engineer.md`, `standards/api-standards.md`, `patterns/zod-openapi-pattern.md`                                             | `patterns/error-handling-pattern.md`, `patterns/pagination-cursor-pattern.md`           | UI standards                                         |
| Frontend / UI                                                   | `agents/frontend-developer.md`, `standards/frontend-standards.md`, `standards/component-usage.md`, `standards/accessibility-standards.md` | `patterns/component-architecture.md`, `patterns/form-validation-pattern.md`             | backend standards                                    |
| Storybook / design system                                       | `standards/storybook-standards.md`, `standards/component-usage.md`, `patterns/component-architecture.md`                                  | `standards/ui-design-standards.md`                                                      | testing layers other than component tests            |
| Testing — unit                                                  | `standards/testing-standards.md`, `templates/jest-unit-test.ts`                                                                           | `templates/nestjs-service-unit-test.ts`                                                 | E2E / integration patterns                           |
| Testing — integration                                           | `standards/testing-standards.md`, `patterns/testcontainers-pattern.md`, `workflows/preflight-checks.md`                                   | `patterns/fixture-factory-pattern.md`                                                   | unit-only patterns                                   |
| Testing — E2E                                                   | `standards/playwright-e2e-standards.md`, `patterns/playwright-page-object-pattern.md`, `patterns/playwright-fixture-pattern.md`           | MSW handlers if mocking                                                                 | unit/integration patterns                            |
| Performance                                                     | `standards/performance-standards.md`, `agents/performance-engineer.md`                                                                    | `patterns/cache-strategy-pattern.md`, `patterns/pagination-cursor-pattern.md`           | UI standards (unless Core Web Vitals work)           |
| Security review                                                 | `agents/security-auditor.md`, `standards/security-standards.md`, `patterns/pingid-auth-pattern.md`                                        | `patterns/error-handling-pattern.md` (info disclosure), `patterns/audit-log-pattern.md` | implementation standards                             |
| Accessibility                                                   | `agents/accessibility-auditor.md`, `standards/accessibility-standards.md`                                                                 | `standards/playwright-e2e-standards.md` for E2E a11y                                    | implementation patterns                              |
| Deployment / CI/CD                                              | `standards/cicd-standards.md`, `workflows/deployment.md`, `templates/github-actions-*.yml`                                                | `standards/observability-standards.md`                                                  | UI / database standards                              |
| Quality gate / pre-release                                      | `commands/pre-release-check.md`, `standards/quality-gate-standards.md`                                                                    | `workflows/production-release-checklist.md`                                             | per-layer standards (load on demand if a gate fails) |
| Framework health (`/sync-framework`, `/framework-health-check`) | `agents/ai-strategist.md`, `workflows/framework-sync.md`                                                                                  | docs reference manifests                                                                | all implementation docs                              |

## Hand-off Pattern

Every agent role declares, in its own Token Optimization section, the next agent
to hand off to. Common hand-offs:

```
ambiguity-analyst       → backend-engineer / frontend-developer / db-designer / architect
product-owner           → architect → db-designer → backend-engineer → frontend-developer
backend-engineer        → frontend-developer (with generated OpenAPI hooks) → test-engineer
frontend-developer      → test-engineer (component tests + E2E) → accessibility-auditor
db-designer             → data-migration-specialist → backend-engineer
data-migration-specialist → devops-engineer (rollout) → tech-lead (sign-off)
test-engineer           → tech-lead (review)
test-strategist         → test-engineer (generation)
security-auditor        → originating implementation agent → tech-lead
accessibility-auditor   → frontend-developer (fixes) → tech-lead (sign-off)
performance-engineer    → backend-engineer / frontend-developer / db-designer
requirements-impact-analyzer → product-owner → originating implementation agents
tech-lead               → originating implementation agent (read-only role)
ai-strategist           → user (read-only — produces remediation report)
```

## Compaction Cues

Run `/compact` (or summarise in-line) when any of these are true:

- Active context is getting large relative to the window (roughly past the
  halfway mark) — the runtime also compacts automatically as it nears the limit,
  so don't compact pre-emptively just to stay small
- Phase boundary just crossed (e.g., spec done → implementation starting)
- Pivot to a different layer (e.g., backend done, starting frontend)
- After every successful epic implementation in a multi-epic session

Preserve only:

1. Confirmed decisions (from ambiguity analysis)
2. Acceptance criteria still pending
3. List of files modified this session
4. Failed gates (if any) and their owners

## When to Re-Load Broader Context

Re-load broader context **only** for:

- Genuine architecture pivots
- Cross-cutting risk review (security audit, performance review, release gate)
- Adding a new pattern that needs alignment with existing patterns
- Framework health check (`/framework-health-check`)

## Cross-References

- All agents declare role-specific Token Optimization in `.claude/agents/*.md`.
- All workflows declare phase-specific Token Optimization in
  `.claude/workflows/*.md`.
- All standards declare scope-specific Token Optimization in
  `.claude/standards/*.md`.
- All patterns declare a one-line Token Optimization footer in
  `.claude/patterns/*.md`.
- Compaction command: `.claude/commands/compact.md`
- Framework health check: `.claude/commands/framework-health-check.md`
