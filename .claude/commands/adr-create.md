---
description: Create an Architecture Decision Record (ADR) for a technical decision
agent: architect
subtask: true
---

# Architecture Decision Record

## Input

$ARGUMENTS (decision description or context)
Examples:

- `/adr-create use RDS Proxy instead of direct RDS connection from Fargate tasks`
- `/adr-create @.claude/docs/architecture/ choose between SNS fanout vs direct EventBridge subscription`
- `/adr-create` (interactive — AI asks questions)

## Process

### Step 1: Get Next ADR Number

```bash
!`find .claude/docs/adr -name "ADR-*.md" 2>/dev/null | sort -V | tail -1 | grep -o "ADR-[0-9]*" | grep -o "[0-9]*" || echo "000"`
```

Next number = found number + 1, zero-padded to 3 digits.

Create directory if needed:

```bash
!`mkdir -p .claude/docs/adr`
```

### Step 2: Gather Decision Context

If $ARGUMENTS is descriptive enough, extract:

- **Decision**: what was decided
- **Context**: why a decision was needed
- **Constraints**: PPCC constraints that influenced the decision

If $ARGUMENTS is sparse, ask:

```
To write this ADR I need a few more details:

1. What is the specific decision being made?
2. What triggered this decision? (problem, new requirement, etc.)
3. What alternatives did you consider?
4. What are the main pros/cons of the chosen option?
5. Any risks or consequences to document?
```

### Step 3: Query PPCC Standards

Query CEB MCP: "PPCC standards for [technology/decision area]"
Use findings to validate the decision against PPCC guidelines.

### Step 4: Generate ADR

```markdown
# ADR-{NNN}: {Decision Title}

**Date**: {YYYY-MM-DD}
**Status**: Proposed | Accepted | Deprecated | Superseded
**Deciders**: {team/individuals}
**Ticket**: {US-NNN / JIRA-NNN if applicable}

---

## Context

{What is the issue that motivates this decision?
What forces are at play — technical, business, PPCC constraints?
Include: DirectConnect, PingID, project design system, APRA requirements if relevant.}

## Decision

{State the decision clearly in one sentence.}
**We will use {X} because {primary reason}.**

## Rationale

{Detailed explanation of why this option was chosen.
Reference PPCC standards from CEB MCP where applicable.}

## Alternatives Considered

### Option A: {Chosen option} ← Selected
| Pro | Con |
|---|---|
| {pro} | {con} |

**Why chosen**: {reason}

### Option B: {Alternative}
| Pro | Con |
|---|---|
| {pro} | {con} |

**Why rejected**: {reason}

### Option C: {Alternative} (if applicable)
**Why rejected**: {reason}

## Consequences

### Positive
- {benefit 1}
- {benefit 2}

### Negative / Trade-offs
- {trade-off 1}
- {trade-off 2}

### Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| {risk} | High/Med/Low | High/Med/Low | {mitigation} |

## Implementation Notes

{Any specific implementation guidance, patterns to follow,
or code references.}

## References
- CEB MCP: {query result reference}
- Related ADRs: {ADR-NNN if supersedes or relates}
- Standards: {link to relevant standard file}
- External: {any external references}
```

### Step 5: Save and Index

Save to: `.claude/docs/adr/ADR-{NNN}-{kebab-case-title}.md`

Update architecture index if it exists:

```bash
!`ls .claude/docs/architecture/index.md 2>/dev/null && echo "EXISTS" || echo "NONE"`
```

If index exists, append ADR entry.
If no index, note that one should be created.

### Step 6: Confirm Status

Ask user:

```
ADR-{NNN} created: .claude/docs/adr/ADR-{NNN}-{title}.md

Set status to:
1. Proposed (decision not yet finalised)
2. Accepted (decision is agreed and in effect)

Which status? (default: 2 — Accepted)
```

## Cross-References

- ADR workflow: `@.claude/workflows/adr-workflow.md`
- ADR template: `@.claude/templates/adr-template.md`
- Architecture design: `/design-architecture`
- Framework index: `.claude/README.md`
- ADR directory: `.claude/docs/adr/`
