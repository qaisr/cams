---
description: Implement a single small or medium epic directly, and record completion in specs/epics-implemented and the epic tracker.
agent: build
subtask: false
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# Implement Epic

## Input

$ARGUMENTS (path to epic file)
Example: `specs/epics/epic-007-agreement-structure-versioning.md`

## MCP Access — Hard Prohibition

> **HARD RULE**: `/implement-epic` **MUST NOT** call any remote JIRA, Confluence, or Figma MCP
> tool (no `mcp__atlassian__*`, `mcp__figma__*`, or any other live-API tool). All context is
> read from local files only — the epic file, `specs/`, and local mirrors on disk. If information
> appears to require a live lookup, raise it with the user rather than calling MCP silently.

## Guardrails

- If `$ARGUMENTS` points to `specs/tasks/**` or `specs/epic-tasks/**`, stop and tell the user to execute the task file directly.
- If the epic is clearly large or marked with a recommendation to use `/create-epic-tasks`, confirm with the user before proceeding and recommend task breakdown.
- This command is intended primarily for **S** and **M** epics.

## Purpose

Autonomously implement a complete epic with API, database, frontend, and test work when the epic is small enough to execute directly without unacceptable token pressure.

## Pre-Flight

Load only the context required by the epic:

- source epic file
- `specs/epics/0-epics-index.md`
- relevant standards based on scope
- `@.claude/workflows/feature-development.md`
- `@.claude/workflows/epic-based-development.md`
- related implemented summaries in `specs/epics-implemented/*.md` for dependency context

## Workflow

### Step 1: Validate Suitability for Direct Implementation

Before implementation:

- read the epic file
- check its size and scope
- if the epic is L/XL or obviously too broad, recommend `/create-epic-tasks <EPIC_FILE>` instead
- otherwise proceed

### Step 2: Create Implementation Plan

Break the epic into concrete execution steps:

- OpenAPI / contracts
- database / migrations
- backend implementation
- frontend implementation
- unit, integration, and E2E tests
- quality review and verification

### Step 3: Implement the Epic

Follow the feature-development workflow and standards lazily based on scope.

Always:

- update OpenAPI before backend implementation if APIs change
- add or update tests for epic acceptance criteria
- run the relevant verification commands
- avoid unrelated changes

### Step 4: Verify Acceptance Criteria and Definition of Done

> Load **`@.claude/docs/definition-of-done.md` §4 (Epic Quality Close)** — do not mark the epic complete until all applicable items are satisfied.

Apply the relevant gate based on epic scope:
- **UI scope** → §1 UI DoD + §4.1 UI/Full-Stack Epic gate
- **Backend/API scope** → §2 Backend DoD + §4.2 API/Full-Stack Epic gate
- **All epics** → §4.3 Final Gate (lint, type-check, tests, epics-implemented written)

Unload `definition-of-done.md` after verification is complete.

### Step 5: Finalize Completion Automatically

When acceptance criteria and definition of done are satisfied, do not ask the user whether completion artifacts should be created. Finalize the epic automatically in the same run.

### Step 6: Update Completion Artifacts

After successful implementation and verification:

1. Update the epic file status to `complete`
2. Update `specs/epics/0-epics-index.md`:
   - status → `complete`
   - summary → concise implemented outcomes
3. Always create or update:
   - `specs/epics-implemented/<EXACT_FILE_NAME_AS_ORIGINAL_EPIC_FILE_NAME>.md`
4. If `specs/epics-implemented.md` exists, append concise implementation information there as well
5. Do not ask the user whether the implementation summary should be created

### Step 7: Implementation Summary Requirements

The implemented summary file in `specs/epics-implemented/` must include:

- epic title
- scope delivered
- key files changed
- tests and quality evidence actually run
- acceptance criteria trace if available
- risks, caveats, or follow-ups

## Completion Rules

On success, epic status values must use lowercase canonical values in the tracker:

- `pending`
- `epic-generated`
- `complete`

Successful completion also requires that the implementation summary in `specs/epics-implemented/` is created or updated automatically in the same run.

## Cross-References

- Epic planning: `/create-epics`
- Epic task breakdown: `/create-epic-tasks`
- Completion recovery: `/mark-epic-completed`
- Epic workflow: `@.claude/workflows/epic-based-development.md`
