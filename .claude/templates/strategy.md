# Strategy & Key Decisions: [Application Name]

> **Instructions for use**: This document is the **architectural strategy and
> decision record** sibling of the BRD/FS. It captures the load-bearing
> decisions (the "why") that shape the whole solution, so that BRD/FS can stay
> focused on requirements and behaviour. Replace all `[placeholders]`. Delete
> sections that do not apply.
>
> **Always a single file.** `specs/strategy.md` is always one file regardless of
> how many decisions or principles it contains. ADRs live as numbered sections
> inside this file — no `specs/strategy/` subdirectory. Use stable heading anchors
> (e.g. `#adr-0002-orchestration-model`) so BRD/FS can deep-link to individual
> ADRs.
>
> Last updated: YYYY-MM-DD

---

## 1. Purpose & Scope

[One or two paragraphs: what this application is, the delivery phase this
strategy covers (e.g. Phase 1), and what is explicitly deferred to later
phases. State which BRD/FS documents this strategy governs.]

**Related documents:**

- Business requirements: `specs/business-requirements.md`
- Functional specifications: `specs/functional-specifications.md`
- Data dictionary: `specs/data-dictionary.md`
- Architecture diagrams: `specs/architecture-diagrams.md`
- Requirements traceability: `specs/requirements-traceability-matrix.md`
- Source artefact library: `specs/reference/README.md`

---

## 2. Executive Summary

[3–5 paragraphs a stakeholder can read standalone: the problem, the chosen
approach at a high level, the key trade-offs made, and why. This is the "if you
read nothing else" section.]

---

## 3. Guiding Principles

> The non-negotiable rules every downstream decision must respect. Number them
> so BRD/FS/epics can cite them (e.g. "per P-003").

| ID | Principle | Rationale | Implication |
|---|---|---|---|
| P-001 | [e.g. Legal-content changes are governed, never ad-hoc] | [Why] | [What this forces in the design] |
| P-002 | [e.g. Counterparties are never mastered locally] | [Why] | [What this forces] |
| P-003 | [Principle] | [Why] | [Implication] |

---

## 4. Key Decisions (ADR-style)

> One subsection per load-bearing decision. Keep each self-contained: a reader
> should understand the decision, the alternatives, and the consequences without
> leaving this document. Promote any decision that needs full formal treatment
> to a standalone ADR via `/adr` and link it here.

### ADR-000X: [Decision Title]

- **Status**: Proposed / Accepted / Superseded by ADR-00Y
- **Context**: [The forces at play — constraints, requirements, prior state]
- **Decision**: [What was decided, stated plainly]
- **Alternatives considered**:
  - **[Option A]** — [why rejected]
  - **[Option B]** — [why rejected]
- **Consequences**:
  - Positive: [what this buys us]
  - Negative / cost: [what we accept in return]
  - Downstream impact: [entities, endpoints, epics, or NFRs this constrains]
- **Traceability**: [BR/FS IDs this decision satisfies or is driven by]

### ADR-000Y: [Decision Title]

[Repeat for each key decision. Typical banking-app decision areas:
data model philosophy (relational core vs. document store vs. hybrid),
identifier mastering / system-of-record boundaries, versioning & immutability,
amendment/patch strategy, event model, integration ownership, phasing.]

---

## 5. Solution Architecture Overview

[A prose + diagram summary of the target architecture at the highest level.
Embed or reference the C4 context/container diagrams. Full diagrams live in
`specs/architecture-diagrams/`; reference them by number here rather than
duplicating, unless a single overview diagram aids the narrative.]

```mermaid
%% High-level context or container view. Follow @.claude/standards/mermaid-standards.md
flowchart TB
  accTitle: Solution architecture overview
  accDescr: High-level view of the [application] and its neighbouring systems.
  subgraph app[[Application Name]]
    ui[Web UI]
    api[API service]
    db[(PostgreSQL)]
  end
  ui --> api --> db
```

---

## 6. Phasing & Delivery Strategy

| Phase | Scope | Rationale | Deferred to later |
|---|---|---|---|
| Phase 1 | [Foundational scope] | [Why first] | [What waits] |
| Phase 2 | [Next increment] | [Why] | — |

---

## 7. Cross-Cutting Concerns

[How the strategy handles concerns that span the whole app: authentication &
authorization model, auditability, observability, data residency, compliance
posture. Reference the relevant standards rather than restating them.]

---

## 8. Open Strategic Questions

| # | Question | Impact if unresolved | Owner | Status |
|---|---|---|---|---|
| SQ-001 | [Strategic question] | [Impact] | [Who] | Open / Resolved |

---

## 9. Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | YYYY-MM-DD | [Author] | Initial draft |

---

> **AI Usage Note**: This document records the *why* behind the solution shape.
> Downstream commands (`/create-epics`, `/create-epic-tasks`, `/implement-epic`)
> must respect the Guiding Principles (§3) and Key Decisions (§4) — cite the
> relevant `P-00X` / `ADR-00X` when a design choice is constrained by them.
