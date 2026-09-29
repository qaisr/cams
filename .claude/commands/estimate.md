---
description: Estimate story points or time for stories, features, or tasks using Fibonacci scale
agent: plan
subtask: false
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: medium
---

# Estimation

## Input

$ARGUMENTS
Examples:

- `/estimate .claude/docs/stories-order-management.md`
- `/estimate US-010 through US-018`
- `/estimate add pagination to all list endpoints`
- `/estimate full order management feature`

## Process

### Step 1: Read Input

Read referenced stories or description.
Read related existing code to calibrate estimate accuracy:

```bash
!`find apps/api/src -name "*.controller.ts" | wc -l`
!`find frontend/src/app -name "page.tsx" | wc -l`
```

### Step 2: Calibrate Against Reference Stories

Find the simplest existing feature for calibration:

```
Reference story (1 point): A simple read-only endpoint with
  a corresponding display component — e.g., GET /health or
  a status badge component.

Reference story (3 points): A single CRUD endpoint with
  basic form — e.g., a settings page with one field.

Reference story (5 points): Full resource CRUD with list,
  create, edit, delete — e.g., a simple lookup table.

Reference story (8 points): Complex feature with business
  rules, multiple entities, async processing.

Reference story (13 points): Cross-cutting feature with
  multiple services, DB schema changes, auth changes.
```

### Step 3: Estimate Each Story

For each story, consider:

**API complexity**

```
- [ ] New DB migration needed? (+1)
- [ ] Complex business logic or rules? (+1-2)
- [ ] Multiple entities involved? (+1)
- [ ] Async processing (SNS/SQS)? (+1)
- [ ] External service integration? (+2)
- [ ] Auth/scope changes? (+1)
```

**Frontend complexity**

```
- [ ] New page vs new component only?
- [ ] Complex form with validation? (+1)
- [ ] Real-time updates needed? (+2)
- [ ] Multiple states (loading/error/empty/populated)?
```

**Testing overhead**

```
- [ ] Integration tests with Testcontainers?
- [ ] E2E scenarios needed?
- [ ] Performance tests needed?
```

### Step 4: Output Estimation Table

```
## Estimation Report

### Individual Stories
| Story | Title | API | Frontend | Tests | Total | Confidence |
|---|---|---|---|---|---|---|
| US-010 | Create order | 3 | 3 | 2 | **8** | High |
| US-011 | List orders | 2 | 2 | 1 | **5** | High |
| US-012 | Order details | 1 | 2 | 1 | **3** | High |
| US-013 | Cancel order | 2 | 1 | 1 | **5** | Medium |

### Sprint Capacity Planning
| Total Points | Recommended Team | Sprints |
|---|---|---|
| {total} | 2 engineers | ~{total/20} sprints |

Note: assumes 20 points per sprint per engineer pair,
      including code review, testing, and PR overhead.

### Risks that could increase estimates
- {risk 1}: +{N} points if occurs
- {risk 2}: +{N} points if occurs

### Dependencies
| Story | Depends On | Reason |
|---|---|---|
| US-013 | US-010 | Cancel requires Order entity |

### Recommended Build Order
1. US-010 (creates foundation)
2. US-011, US-012 (can be parallel)
3. US-013 (depends on US-010)
```

### Step 5: Flag Large Stories

Any story estimated > 8 points:

```
⚠️  US-015 estimated at 13 points — consider splitting:

Suggested split:
- US-015a: {first deliverable} — 5 points
- US-015b: {second deliverable} — 5 points
- US-015c: {third deliverable} — 3 points

Each is independently deployable. Recommend splitting
before sprint planning.
```

## Cross-References

- Story creation: `/story-create`
- Story refinement: `/story-refine`
- RTM: `/rtm-create`
- Feature workflow: `@.claude/workflows/feature-development.md`
