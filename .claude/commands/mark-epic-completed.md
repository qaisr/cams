---
description: Reconcile an epic to complete status by updating the epic, the epic tracker, and implemented summary sources using specs/epics-implemented as the primary evidence source.
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# Mark Epic Completed

## Input

$ARGUMENTS (required epic file path or epic file name)

The input must resolve to a file under:

```text
specs/epics/**
```

## Purpose

Mark an epic as complete when implementation work has finished but the tracker and summary files were not updated automatically.

This command is intended for recovery scenarios such as:

- context overflow interrupted completion updates
- the user implemented the work manually
- task files completed the epic but the epic tracker was not rolled up
- implementation summary exists but epic status remains stale

## Canonical Epic Status Values

Use these exact lowercase values:

- `pending`
- `epic-generated`
- `complete`

## Evidence Resolution Order

When determining what was implemented, use this order:

1. `specs/epics-implemented/<EXACT_FILE_NAME_AS_ORIGINAL_EPIC_FILE_NAME>.md`
2. `specs/epic-tasks/<EPIC_FILE_STEM>/0-tasks-index.md`
3. current workspace changes (unstaged/staged)
4. targeted codebase analysis of impacted files

## Process

### Step 1: Validate Epic Input

Before reading content:

- ensure input points to `specs/epics/**`
- resolve exact epic file name and stem

### Step 2: Collect Implementation Evidence

Try the evidence sources in order.

Preferred evidence:

- implemented summary under `specs/epics-implemented/`
- if not found, use the task index under `specs/epic-tasks/`
- if still not found, inspect current changes
- if still insufficient, analyze the code to infer implemented scope

### Step 3: Build Completion Summary

Produce a concise summary of:

- features implemented
- important files created/changed
- testing/verification evidence if available
- any remaining caveats or partial completion notes

### Step 4: Update the Epic File

Update the epic file status to `complete`.

If the epic has a status line near the top, change it explicitly.
If no status field exists, add a concise completion note near the top.

### Step 5: Update specs/epics/0-epics-index.md

Locate the epic row and update:

- status → `complete`
- summary column or notes block → concise implemented outcomes
- implemented summary reference → `specs/epics-implemented/<same-epic-file-name>.md` if available

### Step 6: Create or Update specs/epics-implemented Summary

If `specs/epics-implemented/<same-epic-file-name>.md` exists:

- refresh it with the best available implemented summary

If it does not exist:

- create it using the recovered evidence

The summary should include at minimum:

- scope delivered
- evidence source used
- files changed
- tests/quality evidence if known
- follow-ups or caveats if any

### Step 7: Report Outcome

Tell the user:

- which evidence source was used
- whether the epic and tracker were updated successfully
- whether the implemented summary was created or refreshed
- any uncertainty if evidence was partial

## Safety Rules

- Do not mark an epic `complete` if evidence strongly suggests incomplete implementation
- If evidence is partial, state that clearly in the summary
- Prefer implemented summaries and task indexes over inferred code analysis

## Cross-References

- Epic planning: `/create-epics`
- Epic task breakdown: `/create-epic-tasks`
- Direct epic implementation: `/implement-epic`
