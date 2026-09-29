---
description: Analyze requirements from functional spec or input text, produce structured requirements document
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# Requirements Analysis

## Input

$ARGUMENTS (feature name, area, or free-text description)
Referenced specs:

- @specs/functional-specifications.md

## Token Policy

This is a **generation** command. Token-efficiency rules are **relaxed**: read
the detailed `specs/functional-specifications.md` (and any input documents) in
full — it is the single source of truth (there is no concise variant). Produce a
complete requirements document with full FR/NFR coverage. See
`@.claude/docs/context-optimization.md` (Generation Phase Exception).

## Steps

### 1. Read Context

- Read functional spec if exists
- Read existing codebase structure relevant to the feature
- Query CEB MCP for any PPCC-specific domain knowledge

### 2. Produce Requirements Document

Output the following sections:

#### Business Context

- Problem statement
- Business value
- Stakeholders

#### Functional Requirements

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-001 | ... | Must/Should/Could | Spec/Stakeholder |

#### Non-Functional Requirements

| ID | Category | Requirement | Measure |
|---|---|---|---|
| NFR-001 | Performance | API P99 < 1000ms | CloudWatch |
| NFR-002 | Security | PingID auth required | All endpoints |
| NFR-003 | Availability | 99.9% uptime | CloudWatch |

#### Assumptions and Constraints

- PPCC DirectConnect required for AWS
- PingID authentication mandatory
- project-configured design system for UI
- Data must remain in ap-southeast-2

#### Out of Scope

#### Open Questions

List any ambiguities requiring stakeholder clarification

### 3. Acceptance Criteria Draft

For each major functional requirement, draft Given/When/Then acceptance criteria.

### 4. Confirm with User

Present the requirements document and ask:
"Does this accurately capture the requirements? Are there any gaps or corrections needed before proceeding?"

## Output File

Save to: `.claude/docs/requirements-{feature-name}.md`

## Cross-References

- Agent: `@.claude/agents/product-owner.md` — activate to structure and validate requirements, define personas, and produce the BRD. Unload after requirements doc is produced.
- Stories: run `/story-create` after this
- Architecture: run `/design-architecture` after this
- RTM: run `/rtm-create` after this
