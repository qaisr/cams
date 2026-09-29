---
description: Generate Requirements Traceability Matrix linking requirements to stories, tests, and code
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# Requirements Traceability Matrix

## Input

$ARGUMENTS (feature name)
Reads:

- `.claude/docs/requirements-{feature}.md`
- `.claude/docs/stories-{feature}.md`
- Existing test files for the feature

## Token Policy

This is a **generation** command. Token-efficiency rules are **relaxed**: read
the full requirements document, all stories, and the relevant test files
before producing the matrix. Skipping inputs to save tokens directly breaks
traceability — the artifact's whole purpose. See
`@.claude/docs/context-optimization.md` (Generation Phase Exception).

## Output Format

### Traceability Matrix

| Req ID | Requirement | Story ID | Test Case | Code Location | Status |
|---|---|---|---|---|---|
| FR-001 | User can create resource | US-001 | TC-001, TC-002 | ResourceController.create() | ✅ Implemented |
| FR-002 | List is paginated | US-002 | TC-003 | ResourceController.list() | 🔄 In Progress |
| NFR-001 | API P99 < 1000ms | — | PERF-001 | — | ⏳ Pending |

### Decision Table

For complex business rules, generate decision tables:

| Condition | Rule 1 | Rule 2 | Rule 3 |
|---|---|---|---|
| User is admin | Y | Y | N |
| Resource is draft | Y | N | — |
| **Action: Publish** | Allow | Deny | Deny |
| **Action: Delete** | Allow | Allow | Deny |

### Coverage Summary

- Functional requirements covered: X/Y (Z%)
- NFRs with test coverage: X/Y
- Stories with E2E tests: X/Y
- Open gaps: [list any uncovered requirements]

## Output File

Save to: `.claude/docs/rtm-{feature-name}.md`

## Cross-References

- Agent: `@.claude/agents/product-owner.md` — activate to generate the RTM; the PO agent owns traceability from requirements through tests
- Requirements: `.claude/docs/requirements-{feature}.md`
- Stories: `.claude/docs/stories-{feature}.md`
- Test plan: `/test-run`
