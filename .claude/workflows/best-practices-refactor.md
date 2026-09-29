---
name: best-practices-refactor
description: >
  Orchestrates the systematic implementation phase of implement-best-practices.
  Manages change sequencing, side effect tracking, and rollback guidance.
version: 1.0.0
invoked_by:
  - .claude/commands/implement-best-practices.md (Phase 5)
---

# Best Practices Refactor Workflow

## Pre-Implementation Checklist

Before making any change, verify:
- [ ] User has explicitly confirmed this change in Phase 4
- [ ] Dependencies of this change are already implemented
- [ ] Side effects have been identified and communicated
- [ ] Tests that will break have been flagged to user

## Change Execution Rules

### Atomicity
Each change must be self-contained:
- Single logical concern per change
- All files needed for that change done together
- Tests updated in the same change, not separately

### Side Effect Tracking

When implementing a change, track:
```
CHANGE: [what was changed]
SIDE EFFECTS TRIGGERED:
  → [file] needs updating because [reason]
  → [test] will fail because [reason]
  → [config] needs updating because [reason]
ADD TO QUEUE: [list side effect work items]
```

Process the side effect queue before moving to the next finding.

### Change Safety Levels

```
SAFE        → Additive changes, new files, new methods
              Proceed with user confirmation

MODERATE    → Modifying existing methods, changing signatures
              Show full diff, confirm, note test impact

HIGH RISK   → Changing database schema, security config,
              authentication flow, public API contracts
              Extra confirmation required, show rollback steps
```

### Rollback Guidance

For HIGH RISK changes, always provide:
```
To rollback this change:
  1. [specific revert steps]
  2. [migration rollback if applicable]
  3. [config revert if applicable]
```

## Post-Change Verification

After each change, suggest:
```
Verify this change:
  → Run: [specific test command]
  → Check: [specific behavior to verify manually]
  → Watch for: [potential runtime issues]
```

## Change Log

Maintain a running log during Phase 5:
```
CHANGE LOG
──────────────────────────────────────────
[timestamp-equivalent] [file] [what changed] [status: applied/skipped]
```

Provide this log in the Phase 5 completion summary.

## Token Optimization

- **Load when**: `/implement-best-practices` Phase 5 (implementation).
- **Load only**: this workflow + the standards/patterns matching the changes being implemented this batch.
- **Unload after**: each change is verified (tests pass, type-check clean). Drop standards as their changes complete.
- **Hand-off to**: `tech-lead` for review, `framework-sync.md` workflow for any new patterns introduced.
