---
description: Refine existing user stories — improve acceptance criteria, add edge cases, split large stories, add Definition of Done
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# Story Refinement

## Input

$ARGUMENTS
Examples:

- `/story-refine .claude/docs/stories-order-management.md`
- `/story-refine US-003 in .claude/docs/stories-checkout.md`
- `/story-refine all stories missing edge cases in .claude/docs/stories-auth.md`

## Process

### Step 1: Read Stories

Read the referenced stories file.
If no file given, look for stories files:

```bash
!`find .claude/docs -name "stories-*.md" | head -10`
```

### Step 2: Assess Each Story

For each story, evaluate:

**Acceptance Criteria Quality**

```
- [ ] At least one happy path scenario
- [ ] At least one validation/error scenario
- [ ] Edge cases covered (empty, null, max, min, duplicate)
- [ ] Auth/permission scenario (what happens when unauthorised)
- [ ] Scenarios are testable (Given/When/Then format)
- [ ] No ambiguous language ("user-friendly", "fast", "nice")
```

**Story Quality**

```
- [ ] Single responsibility (does one thing)
- [ ] Estimable (not too vague)
- [ ] Fits in one sprint (not too large — if >8 points, split)
- [ ] Independent (not tightly coupled to another story)
- [ ] Has clear business value in "So that" clause
```

### Step 3: Refinement Actions

For each issue found, apply the appropriate fix:

**Add missing scenarios**

```
If happy path missing → add it
If error path missing → add validation and not-found scenarios
If auth scenario missing → add "Given user does not have required scope"
If edge cases missing → add boundary conditions
```

**Improve scenario language**

```
Before: "When the user submits the form"
After:  "When the user clicks Submit with all required fields completed"

Before: "Then the system shows success"
After:  "Then a success notification appears with the message 'Order created'"
         And the user is redirected to /orders/{new-order-id}"
```

**Split large stories**

```
If story > 8 points or covers multiple features:
- Identify natural split points
- Create child stories US-{N}a, US-{N}b
- Ensure each child is independently deliverable
- Mark parent as Epic
```

**Strengthen Definition of Done**

> Load `@.claude/docs/definition-of-done.md` §5 for the canonical story DoD. Add missing items:

```
Standard DoD to add if missing:
- [ ] API endpoint implemented and documented in OpenAPI
- [ ] Frontend component implemented with project design system
- [ ] PingID auth applied to all new endpoints
- [ ] Unit tests passing (≥ 80% coverage)
- [ ] Integration tests passing
- [ ] E2E test covering happy path
- [ ] Code review approved
- [ ] Security checklist passed
- [ ] Deployed to dev environment
- [ ] Acceptance criteria demonstrated to product owner
```

### Step 4: Present Changes

Before modifying the file:

```
## Story Refinement Summary

### Stories with Issues Found
| Story ID | Issue | Action |
|---|---|---|
| US-003 | Missing auth scenario | Adding "Given user lacks scope" |
| US-007 | No error path | Adding validation failure scenario |
| US-012 | Too large (>8 pts) | Splitting into US-012a and US-012b |

### New Scenarios to Add: {N}
### Stories to Split: {N}
### DoD gaps to fill: {N}

Proceed with refinements? (yes/no)
```

### Step 5: Apply Refinements

Update the stories file in place.
Add a refinement log at the bottom:

```markdown
---
## Refinement Log
- {date}: Refined by /story-refine — {summary of changes}
```

### Step 6: Verify Coverage

After refinement, check against requirements:

```bash
!`cat .claude/docs/requirements-*.md 2>/dev/null | grep "^| FR-" | wc -l`
```

Report: "X of Y functional requirements have story coverage."

## Output

- Updated stories file (in place)
- Refinement summary printed to console

## Cross-References

- Story creation: `/story-create`
- RTM: `/rtm-create`
- Stories template: based on `/story-create` output format
