# Epic Revision Record — [EPIC-ID]

**Epic**: [EPIC-TITLE]
**Epic File**: `specs/epics/[epic-file-stem].md`
**Revision Date**: [YYYY-MM-DD]
**Previous Status**: [previous-status]
**New Status**: `complete-amended` | `complete-requires-revision`
**Evidence Source**: `implemented-summary` | `task-index` | `codebase-analysis` | `none`

---

## What Changed

[One or two paragraphs describing which requirements changed and how they affect the scope
that was implemented in this epic. Explain the obsolete or replaced behaviour clearly,
because this revision record is the only durable place where that obsolete scope is retained.]

---

## Implementation Evidence Summary

[Brief summary of what was built, drawn from the evidence source identified above.
Reference key files, endpoints, DB tables, and UI components that were implemented.]

This section is the durable record of obsolete or replaced implementation scope during
reconciliation. Do not duplicate this information in specs, epics, tasks, or implemented
summary files.

Evidence source: `specs/epics-implemented/[epic-file].md`

Key artifacts implemented:
- `[path/to/artifact]` — [brief description of what it does]
- `[path/to/artifact]` — [brief description]

---

## Preserve vs. Rework Analysis

### Preserved Components

These artifacts remain fully valid under the corrected requirements. No changes needed.

| Artifact | Layer | Reason to Preserve |
|---|---|---|
| `[path/to/file]` | API / DB / Frontend / Test | [why it stays valid] |

### Components to Extend

These artifacts are valid but incomplete. Additive changes are needed.

| Artifact | Layer | Extension Needed | Effort |
|---|---|---|---|
| `[path/to/file]` | API / DB / Frontend / Test | [what to add] | S / M / L / XL |

### Components to Rework

These artifacts implement the old (incorrect) requirement and must change.

| Artifact | Layer | Reason to Rework | Effort |
|---|---|---|---|
| `[path/to/file]` | API / DB / Frontend / Test | [what conflicts with new requirements] | S / M / L / XL |

### Components to Remove

These artifacts were built specifically for the old requirement and are now obsolete.

| Artifact | Layer | Reason | Notes |
|---|---|---|---|
| `[path/to/file]` | API / DB / Frontend / Test | [why it is now obsolete] | [delete after replacement lands] |

*Remove any empty tables from the final document.*

---

## Migration Options

For each component that requires rework or significant extension, present migration options.

### [Component Name — path/to/file]

Current state: [what the component currently does]
Required state: [what the corrected requirement demands]

```
[A] Extend existing implementation                          ← RECOMMENDED
    [Specific additions needed]. Effort: M, Risk: Low

[B] Refactor targeted section
    [Specific method/class to rewrite]. Effort: M, Risk: Medium

[C] Full rewrite aligned to corrected requirements
    [Justification for why full rewrite may be appropriate]. Effort: L, Risk: Medium

[D] Describe a different approach
```

**Selected option**: [Record user's selection and any notes here]

*Repeat this block for each component requiring a decision. Remove if only small
extensions or preserve-only components are present.*

---

## Revised Acceptance Criteria

| AC | Original Text | Revised Text | Status | Notes |
|---|---|---|---|---|
| AC-1 | [original AC] | [revised AC under new requirements] | revised | |
| AC-2 | [original AC] | — | preserved | Still valid |
| AC-3 | — | [new AC from ADDITIVE delta] | new | |
| AC-4 | [original AC] | — | removed | Made obsolete by D-001 |

Do not copy removed or obsolete acceptance criteria back into the active epic or task files.

---

## Test Impact

[Brief description of tests that may need updating because of the rework. Reference specific
test files or test class names where known.]

| Test | File | Impact | Action |
|---|---|---|---|
| [test name] | `[path/to/test]` | [what may break] | update / remove / add new |

For task files that become `revision-required` or `superseded`, capture the obsolete task scope
here, then delete those task files and remove obsolete details from the task index.

---

## Residual Risks

- [Risk 1 — e.g. "Changing the calculation method may affect downstream reports that depend
  on the previously computed values stored in the DB."]
- [Risk 2]

---

## Notes and Follow-Ups

- [Any caveats, decisions deferred, or items to track after reconciliation]
- After revised implementation is completed, update `specs/epics-implemented/<same epic file>.md`
    so it reflects only the valid current implementation state
