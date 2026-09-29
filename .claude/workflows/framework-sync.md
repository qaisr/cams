---
name: framework-sync
description: >
  Scans the .claude framework after codebase changes and produces
  targeted updates to keep standards, agents, and workflows aligned
  with what was actually implemented.
version: 1.0.0
invoked_by:
  - .claude/commands/implement-best-practices.md (Phase 6)
  - .claude/commands/sync-framework.md (standalone)
  - .claude/commands/security-audit.md (post-fix)
  - .claude/commands/review-tests.md (post-fix)
  - .claude/commands/migrate-claude-framework.md
---

# Framework Sync Workflow

## Purpose

After implementing best practices in the codebase, the .claude framework
must reflect the new patterns — otherwise future AI-generated code will
revert to old patterns.

## Sync Analysis Process

### Step 1 — Build change manifest
From the Phase 5 change log, extract:
- New patterns introduced
- Old patterns replaced
- New dependencies added
- New architectural decisions made

### Step 2 — Scan .claude for misalignment

For each file in `.claude/`:
```
SCAN QUESTIONS:
  → Does this file reference the old pattern that was replaced?
  → Does this file lack a standard for a new pattern we introduced?
  → Does this file contradict what we just implemented?
  → Should a new file be created to document what we established?
```

### Step 3 — Categorize updates needed

```
TYPE: OUTDATED    → File references pattern that no longer exists
TYPE: INCOMPLETE  → File missing guidance for new pattern
TYPE: CONFLICTING → File contradicts implemented change
TYPE: MISSING     → New file needed to document new pattern
TYPE: ALIGNED     → No update needed
```

### Step 4 — Produce targeted diffs

For each file needing update, show exact diff:
- Quoted original text
- Proposed replacement
- Reason for change

Never rewrite entire files — surgical updates only.

## Special Handling

### Standards files (.claude/standards/)
- Update code examples to match new patterns
- Add new sections for newly established standards
- Mark deprecated patterns clearly before removing

### Agent files (.claude/agents/)
- Update checklists to include new items discovered
- Update analysis patterns based on what was found

### Workflow files (.claude/workflows/)
- Update execution steps if process was refined
- Add new steps discovered during implementation

### Command files (.claude/commands/)
- Rarely need updating — only if process itself changed

## Sync Completeness Verification

After all updates, confirm:
- [ ] No .claude file still references replaced patterns
- [ ] All new patterns have corresponding standards
- [ ] Agent checklists cover new areas
- [ ] Future code generation will naturally follow new patterns

## Token Optimization

- **Load when**: `.claude/` framework drift detected after large codebase refactor; `/sync-framework`.
- **Load only**: this workflow + `ai-strategist` agent. Avoid loading individual standards — this workflow reasons about file consistency, not implementation.
- **Unload after**: surgical diffs applied to `.claude/` and committed.
- **Hand-off to**: `ai-strategist` for periodic health checks, originating agents for any newly-added standards.
