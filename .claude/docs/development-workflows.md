## Development Workflows

### Epic-Based Workflow (For Building Complete Applications)

**Use when**: Building a new application or major feature set from functional specifications

**Process**:

1. Generate specifications via `/create-specifications @path/to/source`
2. Use the detailed specs at `specs/business-requirements.md` and `specs/functional-specifications.md` for planning, design, and implementation alike — they are the single source of truth (no concise variant). Extract the scoped slice each phase needs.
3. Run `/create-epics` to create `specs/epics/0-epics-index.md` if it does not exist yet
4. Run `/create-epics` again to generate the next pending epics and mark them `epic-generated`
5. For S/M epics, implement directly with `/implement-epic specs/epics/epic-{NNN}-{name}.md`
6. For L/XL epics, break them down with `/create-epic-tasks specs/epics/epic-{NNN}-{name}.md`
7. Execute generated task files directly and keep `specs/epic-tasks/<epic-stem>/0-tasks-index.md` updated
8. Record completed epic implementation in `specs/epics-implemented/<EXACT_FILE_NAME_AS_ORIGINAL_EPIC_FILE_NAME>.md`
9. Mark the epic `complete` in `specs/epics/0-epics-index.md`
10. If completion state is missing, recover it with `/mark-epic-completed`
11. If requirements change mid-workflow, recover with `/reconcile-requirements @path/to/corrected-requirements`
12. During reconciliation, delete misaligned non-completed epic/task files, reset them to `pending`, and keep obsolete completed-scope details only in `specs/epics-revised/`
13. If you need to intentionally roll back delivered or generated epics, use `/reset` to delete reset-scope artifacts, remove implementation, and optionally renumber the tracker

**Benefits**:

- Systematic, iterative development
- Tracker-first generation reduces unnecessary context loading
- Large epics can be broken into direct-execution task files
- Implemented summaries in `specs/epics-implemented/` provide durable completion context
- Lazy-loading and staged generation help stay within token limits
- Testable milestones exist at both epic and task levels
- Builds foundation before features

Full details: `@.claude/workflows/epic-based-development.md`

### Existing Project Onboarding Workflow (use /initialize)

Run `/initialize` to scan the codebase, detect the tech stack, collect improvement preferences, generate sequenced onboarding tasks in `docs/onboarding-tasks/`, and produce `docs/onboarding-guide.md`. After completion, use `/add-feature` for all new work.

Full details: `@.claude/commands/initialize.md`

---

### Feature Development Workflow (use /add-feature)

Run `/add-feature <description | story-id | requirements-doc | folder>` to parse scope, auto-classify API/UI/full-stack, run an ambiguity review, size and break down epics, generate epic files, implement, and quality-close with tests and implemented summary.

Full details: `@.claude/commands/add-feature.md` + `@.claude/workflows/epic-based-development.md`

For authorization architecture and incident-driven remediation planning, use:
`@.claude/docs/authorization-patterns-and-architecture.md`

---
