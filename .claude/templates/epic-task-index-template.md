# Epic Task Index

**Epic Reference**: `specs/epics/[epic-file].md`
**Task Folder**: `specs/epic-tasks/[epic-file-stem]/`
**Created**: [YYYY-MM-DD]
**Last Updated**: [YYYY-MM-DD]

---

## How to Use This File

1. Execute task files in sequence unless explicit dependencies allow parallel work.
2. After completing a task, update the task file status to `complete`.
3. Update this file from `pending` to `complete` for the same task.
4. Append the implemented functionality delivered by that task.
5. Ask the user whether the next task in the queue should be started.
6. When the last task completes, roll the outcome up to `specs/epics-implemented/[same-epic-file-name].md` and mark the epic `complete`.

## Task Status Legend

- `pending`
- `complete`

## Task Queue

| # | Task File | Status | Depends On | Summary |
| --- | --- | --- | --- | --- |
| 1 | `1-[task-name].md` | pending | - | - |
| 2 | `2-[task-name].md` | pending | 1 | - |

## Implemented Functionality Log

### Task 1 - [YYYY-MM-DD]

- [implemented item]
- [validation run]

## Epic Completion Roll-Up

- Implemented summary file: `specs/epics-implemented/[same-epic-file-name].md`
- Epic tracker row to update: `specs/epics/0-epics-index.md`
- Recovery command if needed: `/mark-epic-completed specs/epics/[epic-file].md`
