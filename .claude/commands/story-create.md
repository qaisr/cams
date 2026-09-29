---
description: Create Gherkin user stories with acceptance criteria from requirements
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# User Story Creation

## Input

$ARGUMENTS (feature name or @path/to/requirements.md)

## Token Policy

This is a **generation** command. Token-efficiency rules are **relaxed**: read
the full requirements document (or `specs/functional-specifications.md`) in full
before generating stories — the detailed `specs/functional-specifications.md` is
the single source of truth (there is no concise variant). Generated stories may
be long; favour completeness and testability over brevity. See
`@.claude/docs/context-optimization.md` (Generation Phase Exception).

## Steps

### 1. Read Input

- Load requirements doc if path provided
- Otherwise use `specs/functional-specifications.md`
- Identify all user roles/personas involved

### 2. Generate User Stories

Format each story:

```

Story ID: US-{NNN}
Title: [Action-oriented title]
Epic: [Parent epic name]

As a [role]
I want to [action]
So that [business value]

Acceptance Criteria:
  Scenario: [Happy path]
    Given [precondition]
    When [action]
    Then [expected outcome]
    And [additional outcome]

  Scenario: [Validation/error case]
    Given [precondition]
    When [invalid action]
    Then [error shown]

  Scenario: [Edge case]
    ...

Definition of Done:

> See `@.claude/docs/definition-of-done.md` §5 for the standard story DoD.
- [ ] API endpoint implemented and documented in OpenAPI
- [ ] Frontend component implemented with project design system
- [ ] PingID auth applied
- [ ] Unit tests passing (≥ 80% coverage)
- [ ] Integration tests passing
- [ ] E2E test covering happy path
- [ ] Code review approved
- [ ] Security checklist passed
- [ ] Deployed to dev environment

Story Points: [1/2/3/5/8/13]
Dependencies: [US-XXX, ...]

```

### 3. Story Coverage Check

Verify stories cover:

- [ ] All functional requirements from requirements doc
- [ ] Authentication/authorisation scenarios
- [ ] Validation error scenarios
- [ ] Empty state / no data scenarios
- [ ] Pagination (if list views)
- [ ] Permission denied scenarios

### 4. Confirm with User

Present stories and ask:
"Do these stories capture all the required functionality?
Are the acceptance criteria complete and testable?"

## Output File

Save to: `.claude/docs/stories-{feature-name}.md`

## Cross-References

- Agent: `@.claude/agents/product-owner.md` — the primary agent for story writing; activate to draft and refine stories, acceptance criteria, and the Definition of Done
- Requirements: `/requirements-analyze`
- RTM: `/rtm-create`
- Tests from stories: `/add-e2e-test`
