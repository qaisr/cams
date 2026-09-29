# Epic Implementation Index

**Project**: [PROJECT_NAME]
**Created**: [YYYY-MM-DD]
**Last Updated**: [YYYY-MM-DD]
**Total Epics**: [COUNT]

---

## How to Use This File

1. Run `/create-epics` once to create or refresh this tracker.
2. Re-run `/create-epics` to generate only the next pending epic files.
3. Use `/implement-epic` for epics sized `S` or `M` unless the epic file recommends otherwise.
4. Use `/create-epic-tasks` for epics sized `L` or `XL`, then execute the generated task files directly.
5. When an epic is delivered, update its row to `complete`, add a concise summary, and link the durable summary in `specs/epics-implemented/`.
6. If implementation is already finished but the tracker is stale, use `/mark-epic-completed`.

## Implementation Context

- Use `specs/business-requirements.md` and `specs/functional-specifications.md` as the primary planning sources.
- Use `specs/epics-implemented/*.md` as the primary completion evidence source for already delivered work.
- Generate only the next few pending epics to keep context and token usage bounded.

## Epic Status Legend

- `pending`: planned, but the epic file has not been generated yet
- `epic-generated`: epic file exists and is ready for implementation or task breakdown
- `complete`: implementation, verification, and completion tracking are recorded

## Epic Queue

| Epic | Title | Status | Priority | Size | Dependencies | Impl Order | Recommended Path | Summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Epic-001 | [TITLE] | pending | Must Have | M | None | 1 | implement-epic | - |
| Epic-002 | [TITLE] | pending | Must Have | L | 001 | 2 | create-epic-tasks | - |

## Phase Summary

| Phase | Epics | Status | Notes |
| --- | --- | --- | --- |
| Foundation | 001-003 | pending | [SHORT_SUMMARY] |

## Next Recommended Epic Generation Batch

1. `specs/epics/[epic-file-1].md`
2. `specs/epics/[epic-file-2].md`
3. `specs/epics/[epic-file-3].md`

## Notes

- Keep statuses lowercase.
- Keep summaries concise and durable.
- Point completed epics to `specs/epics-implemented/[same-epic-file-name].md`.

## Cross-References

- Epic workflow: `@.claude/workflows/epic-based-development.md`
- Epic task tracker template: `@.claude/templates/epic-task-index-template.md`
- Implemented summary template: `@.claude/templates/implemented-epic-summary-template.md`
