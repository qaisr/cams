# Requirements Traceability Matrix (RTM)

**Project:** [Project Name]
**Version:** 1.0
**Last Updated:** YYYY-MM-DD
**Epic:** [Epic Name / Link]

---

## Purpose
Maps **source** (Confluence / JIRA / Figma local mirror) → business requirements →
functional specifications → user stories → test cases, ensuring complete coverage,
no orphaned requirements, and a bidirectional link from every spec back to the
external artifact it originated from.

---

## Traceability Matrix

The **Source** column anchors each business requirement to the local mirror file it
was derived from (`confluence/<slug>.md`, `jira/<type>/{KEY}.md`, or `figma/nodes/<slug>.md`),
with the remote id + version in parentheses. This makes every requirement answerable
in both directions: "which spec does this Confluence page / JIRA ticket / Figma node
feed?" and "where did this requirement come from?". Sources are joined to specs via
`specs/sources/manifest.json`; the RTM is the human-readable view of that join.

> **JIRA source format is MANDATORY and exact.** A JIRA-derived requirement records its
> originating **local mirror file** using the folder-by-type path and the remote key in
> parentheses: `` `jira/<type>/{KEY}.md` (KEY) `` where `<type>` is one of
> `epics` / `stories` / `tasks` / `bugs` — e.g. `` `jira/stories/EON-123.md` (EON-123) ``.
> Never use a flat `jira/{KEY}.md` path.

> **Figma source format is MANDATORY and exact.** A Figma-derived requirement records its
> originating **local mirror file** using the folder-by-type path and the node id in the
> **colon** form (D5) in parentheses: `` `figma/nodes/<slug>.md` (nodeId) `` — e.g.
> `` `figma/nodes/mid-fi-e2e-flow.md` (299:12006) ``. Never use a flat `figma/<slug>.md`
> path, and never the hyphenated URL form of the node id.

| Source (mirror → remote) | BR ID | Business Requirement | FS ID | Functional Spec | Story ID | User Story | Test Case ID | Test Type | Status |
|--------------------------|-------|---------------------|-------|-----------------|----------|------------|--------------|-----------|--------|
| `confluence/entity-onboarding-overview.md` (2097876103 v14) | BR-001 | Users must authenticate via PingID | FS-001 | PingID OAuth2 flow | US-001 | As a user, I want to log in via SSO | TC-001, TC-002 | E2E, Unit | ✅ Done |
| `jira/stories/EON-27.md` (EON-27) | BR-002 | Only authorized users may view documents | FS-002 | RBAC role enforcement | US-002 | As a viewer, I can view but not edit | TC-003, TC-004 | Integration | 🔄 In Progress |
| `figma/nodes/entity-onboarding-v2.md` (484:10425) | BR-003 | Onboarding wizard follows the approved 4-step flow | FS-003 | Multi-step onboarding form | US-005 | As an applicant, I complete onboarding in guided steps | TC-010 | E2E | ⬜ Not Started |

---

## Coverage Summary

| Category | Total | Covered | Coverage % |
|----------|-------|---------|-----------|
| Business Requirements | 0 | 0 | 0% |
| Functional Specifications | 0 | 0 | 0% |
| User Stories | 0 | 0 | 0% |
| Unit Tests | 0 | 0 | 0% |
| Integration Tests | 0 | 0 | 0% |
| E2E Tests | 0 | 0 | 0% |

---

## Risk Register (Uncovered Requirements)

| ID | Requirement | Risk Level | Reason | Owner | Target Date |
|----|------------|------------|--------|-------|-------------|
| BR-XXX | [Requirement] | HIGH | No test coverage | [Name] | YYYY-MM-DD |

---

## Legends
- **Source** — local mirror file the requirement originated from: `confluence/<slug>.md`, `jira/<type>/{KEY}.md` (type ∈ `epics`/`stories`/`tasks`/`bugs`), or `figma/nodes/<slug>.md` (node id in colon form, e.g. `299:12006`), with the remote id (+ Confluence version) in parentheses. Empty only for requirements authored directly in a raw-requirements file with no external source.
- **BR-XXX** — Business Requirement (from `business-requirements.md`)
- **FS-XXX** — Functional Specification (from `functional-specifications.md`)
- **US-XXX** — User Story (from epic task files)
- **TC-XXX** — Test Case (from test case documents)
- **Status:** ✅ Done | 🔄 In Progress | ⬜ Not Started | ❌ Blocked

---

## Source Traceability Rule (MANDATORY)

Every business requirement derived from a Confluence page, JIRA issue, or Figma node
**MUST** carry its originating mirror file in the **Source** column. For JIRA, the exact
format is `` `jira/<type>/{KEY}.md` (KEY) `` (folder-by-type; never flat `jira/{KEY}.md`).
For Figma, the exact format is `` `figma/nodes/<slug>.md` (nodeId) `` (folder-by-type,
colon node id; never flat `figma/<slug>.md` and never the hyphenated URL form).
The RTM and `specs/sources/manifest.json` are kept consistent by `/create-specifications`
(initial population) and `/reconcile-requirements` (on every source change).

**Consistency flags:**
- A mirror file that feeds **no** requirement → **orphaned source** (flag for review).
- A requirement with **no** source that is **not** authored from a raw input file →
  **untraced requirement** (flag for review).
- **Orphan interaction (JIRA):** an **archived** orphan under `jira/_orphaned/…` is an
  expected non-source — do **not** flag it. A still-**live** orphaned mirror file (present
  under `jira/<type>/…`, feeding no requirement) is a real problem to surface.
- **Orphan interaction (Figma):** a `figma/nodes/<slug>.md` node feeding no requirement is
  an **orphaned Figma source**; a design-derived requirement carrying no `figma/nodes/…`
  source is an **untraced design requirement**.
