# Business Requirements: [Application Name]

> **Instructions for use**: Replace all `[placeholders]` with your
> application details. Delete sections that do not apply.
> This document captures business context, goals, and high-level requirements.
> For complex banking/finance apps this document is expected to be **detailed** —
> exhaustive business rules, Gherkin user stories, integration and data
> requirements, and explicit data ownership. Depth over brevity.
> Last updated: YYYY-MM-DD
>
> **Always a single file.** `specs/business-requirements.md` is ALWAYS generated
> as one file — never split into a directory. Use clear `##`/`###` headings with
> stable section anchors so other documents can deep-link to a section.
> This file is the **business source of truth**: every relevant section of
> `strategy.md`, `data-dictionary.md`, `architecture-diagrams.md`, and
> `requirements-traceability-matrix.md` MUST be referenced here by a relative
> link. All `specs/reference/` artefacts that this document uses MUST have a
> `_Source:_` relative link from the consuming section.

---

## 0. Related Documents

This BRD is the business source of truth. It works alongside these siblings —
follow the pointers rather than duplicating their detail:

- **Functional spec (the "how"):** `specs/functional-specifications.md`
- **Strategy & key decisions (the "why"):** `specs/strategy.md`
- **Data dictionary (field-level contract):** `specs/data-dictionary.md`
- **Architecture diagrams (master scope):** `specs/architecture-diagrams.md`
- **Requirements traceability:** `specs/requirements-traceability-matrix.md`
- **Source artefact library (verbatim / schema-only source copies):** `specs/reference/README.md`

Where a requirement derives from a source artefact, add a `_Source:_` pointer
that resolves **inside `specs/reference/`** — never into the temporary input
folder (which is deleted after specs are generated).

---

## 1. Executive Summary

### Business Problem

[2-3 paragraphs describing the business problem this application solves.
What pain points exist today? What inefficiencies or gaps need addressing?]

### Proposed Solution

[2-3 paragraphs describing the proposed solution at a high level.
How will this application address the business problem?]

### Business Value

[Quantifiable business outcomes expected. Examples:

- Reduce manual processing time by X%
- Improve customer satisfaction score by Y points
- Enable Z new transactions per day
- Reduce operational cost by $N annually]

---

## 2. Business Context

### Stakeholders

| Stakeholder Group | Representative | Interest | Influence |
|---|---|---|---|
| [Business Unit] | [Name/Role] | [Their interest in the project] | High/Med/Low |
| [Department] | [Name/Role] | [Their interest] | High/Med/Low |
| [Team] | [Name/Role] | [Their interest] | High/Med/Low |

### Current State

[Describe the current business process or system being replaced/enhanced:

- How is the work done today?
- What systems are currently used?
- What are the pain points?
- What manual workarounds exist?]

### Desired Future State

[Describe how the business will operate with the new application:

- How will the work be done?
- What will be automated?
- What manual steps will be eliminated?
- What new capabilities will be enabled?]

---

## 3. Business Objectives

### Primary Objectives

1. **[Objective 1]**
   - Success Criteria: [How will success be measured?]
   - Target: [Specific quantifiable target]
   - Timeline: [When should this be achieved?]

2. **[Objective 2]**
   - Success Criteria: [Measurement]
   - Target: [Target value]
   - Timeline: [Date]

3. **[Objective 3]**
   - Success Criteria: [Measurement]
   - Target: [Target value]
   - Timeline: [Date]

### Secondary Objectives

- [Objective 4]
- [Objective 5]

---

## 4. Users and Roles

### Primary Users

| User Role | Description | Volume | Key Needs |
|---|---|---|---|
| [Role 1] | [Who they are, their job function] | [N users] | [What they need from the app] |
| [Role 2] | [Description] | [N users] | [Key needs] |
| [Role 3] | [Description] | [N users] | [Key needs] |

### Secondary Users

| User Role | Description | Volume | Key Needs |
|---|---|---|---|
| [Role 4] | [Description] | [N users] | [Key needs] |

### User Personas (Optional - for customer-facing apps)

#### Persona 1: [Name]

- **Demographics**: [Age, location, tech savviness]
- **Goals**: [What they want to achieve]
- **Pain Points**: [Current frustrations]
- **Behaviors**: [How they work today]

---

## 5. Business Processes

### Process 1: [Process Name]

**Trigger**: [What initiates this process?]
**Actors**: [Who is involved?]
**Current State**: [How is it done today?]
**Future State**: [How will it be done with the new application?]

**Process Steps** (Future State):

1. [Step 1 description]
2. [Step 2 description]
3. [Step 3 description]
   - Decision point: [If applicable]
   - Alternative path: [If applicable]
4. [Step 4 description]

**Business Rules**:

- [Rule 1: condition → action]
- [Rule 2: condition → action]
- [Rule 3: condition → action]

**Exceptions**:

- [Exception scenario 1 and how to handle]
- [Exception scenario 2 and how to handle]

### Process 2: [Process Name]

[Repeat structure for each major business process]

---

## 5a. User Stories & Acceptance Criteria (Gherkin)

> For complex apps, write **detailed** stories. Each story has a stable ID,
> role/benefit statement, and Gherkin acceptance criteria covering the happy
> path **and** the notable alternate/error paths. These IDs are cited by the RTM
> and by generated epics/tasks.

### US-001: [Story title]

**As a** [role]
**I want** [capability]
**So that** [business benefit]

**Priority:** Must / Should / Could
**Traceability:** [BR-IDs it satisfies] · [FS section] · [source artefact in `specs/reference/`]

```gherkin
Feature: [Feature name]

  Scenario: [Happy path]
    Given [precondition]
    And [additional context]
    When [action]
    Then [expected outcome]
    And [additional assertion]

  Scenario: [Alternate / edge case]
    Given [precondition]
    When [action with edge input]
    Then [expected handling]

  Scenario: [Error / rejection]
    Given [precondition]
    When [invalid action]
    Then [error surfaced to user]
    And [system state is unchanged / compensated]
```

**Additional acceptance criteria (non-Gherkin, where clearer as a checklist):**

- [ ] [Measurable criterion — a testable assertion, not a vague goal]
- [ ] [Permission criterion — which role may / may not perform this]
- [ ] [Audit criterion — what is recorded]

### US-002: [Story title]

[Repeat for each story. Aim for full coverage of the business processes above.]

---

## 6. Business Rules

### Data Validation Rules

| Rule ID | Rule Description | Rationale |
|---|---|---|
| BR-001 | [Validation rule] | [Why this rule exists] |
| BR-002 | [Validation rule] | [Why this rule exists] |
| BR-003 | [Validation rule] | [Why this rule exists] |

### Processing Rules

| Rule ID | Rule Description | Rationale |
|---|---|---|
| BR-101 | [Processing logic] | [Why this rule exists] |
| BR-102 | [Processing logic] | [Why this rule exists] |
| BR-103 | [Processing logic] | [Why this rule exists] |

### Authorization Rules

| Rule ID | Rule Description | Rationale |
|---|---|---|
| BR-201 | [Who can do what] | [Why this rule exists] |
| BR-202 | [Who can do what] | [Why this rule exists] |
| BR-203 | [Who can do what] | [Why this rule exists] |

---

## 7. Key Business Entities

### Entity 1: [Entity Name]

**Definition**: [What is this entity in business terms?]

**Key Attributes**: [List key business attributes, not technical fields]

**Relationships**: [How does it relate to other business entities?]

**Business Significance**: [Why is this entity important?]

**Lifecycle**: [How is it created, updated, archived?]

### Entity 2: [Entity Name]

[Repeat for each major business entity]

---

## 7a. Integration Requirements

> Every external system this application must exchange data with, from a
> **business** perspective. Technical contracts (payloads, endpoints, retries)
> live in the FS §Integration Points; here capture the requirement, ownership,
> and direction.

| ID | System | Direction | Purpose | Data Exchanged | Owner / SoR | Frequency / Trigger | Failure Expectation |
|---|---|---|---|---|---|---|---|
| INT-001 | [System] | Inbound / Outbound / Bidirectional | [Why] | [What data] | [Who owns it] | [Real-time / batch / on-event] | [What must happen if it fails] |
| INT-002 | [System] | [dir] | [purpose] | [data] | [owner] | [freq] | [failure expectation] |

For each integration also state:

- **Contract source:** [where the interface contract is defined — e.g. `specs/reference/<artefact>`]
- **Business criticality:** [is the app usable if this integration is down?]

---

## 7b. Data Requirements

> Business-level data requirements: what data must be captured, who owns it,
> validation intent, retention, and residency. Field-level detail lives in the
> **data dictionary** — reference it, don't duplicate the column tables here.

### Data Entities & Ownership

| Entity | System of Record | Captured Here? | Key Data Elements | Retention | Residency / Sensitivity |
|---|---|---|---|---|---|
| [Entity] | This app / [external] | Full / reference-only | [key elements] | [period] | [e.g. ap-southeast-2, PII] |

### Data Validation Requirements (business intent)

| ID | Data Element | Rule (business language) | Rationale |
|---|---|---|---|
| DR-001 | [element] | [e.g. "must be one of the approved identifiers"] | [why] |

### Data Ownership & Mastering Rules

- [Rule: which data is mastered externally and only referenced locally — cite strategy principle P-00X]
- [Rule: which identifiers may be stored, and which are prohibited]

> Full field-level layout, types, nullability, enums, and JSONB shapes:
> `specs/data-dictionary.md`.

---

## 8. Compliance and Regulatory Requirements

### Regulatory Bodies

| Regulator | Regulation | Relevance | Key Requirements |
|---|---|---|---|
| APRA | CPS 234 | Cyber security | [Specific requirements] |
| ASIC | [Regulation] | [Relevance] | [Key requirements] |
| [Other] | [Regulation] | [Relevance] | [Key requirements] |

### Privacy Requirements

- **PII Data Types**: [List all PII data types handled]
- **Privacy Act Compliance**: [Specific requirements]
- **Data Retention**: [How long data must be kept]
- **Data Disposal**: [How data must be disposed]
- **Consent**: [What consent is required from users]

### Audit Requirements

- **Audit Events**: [What must be audited]
- **Audit Retention**: [How long audit logs must be kept]
- **Audit Access**: [Who can access audit logs]

---

## 9. Business Constraints

### Time Constraints

- **Launch Date**: [Target production date]
- **Key Milestones**: [Critical dates and why]
- **Business Cycles**: [Busy periods that affect deployment]

### Budget Constraints

- **Total Budget**: [If applicable]
- **Budget Allocation**: [If known]
- **Cost Expectations**: [Any specific cost targets]

### Organizational Constraints

- [Constraint 1: e.g., must use existing PPCC platforms]
- [Constraint 2: e.g., must integrate with System X]
- [Constraint 3: e.g., must support existing user base]

### Business Hours and Availability

- **Operating Hours**: [When must the application be available?]
- **Maintenance Windows**: [Acceptable downtime periods]
- **Peak Usage Times**: [When is usage highest?]

---

## 10. Success Criteria

### Launch Criteria

| Criteria | Measure | Target |
|---|---|---|
| [Criteria 1] | [How measured] | [Target value] |
| [Criteria 2] | [How measured] | [Target value] |
| [Criteria 3] | [How measured] | [Target value] |

### Post-Launch Success Metrics (6 months)

| Metric | Baseline | Target | How Measured |
|---|---|---|---|
| [Metric 1] | [Current value] | [Target value] | [Measurement method] |
| [Metric 2] | [Current value] | [Target value] | [Measurement method] |
| [Metric 3] | [Current value] | [Target value] | [Measurement method] |

---

## 11. Risks and Assumptions

### Key Assumptions

| Assumption ID | Assumption | Impact if Wrong | Owner |
|---|---|---|---|
| A-001 | [Assumption] | [Impact] | [Who to verify with] |
| A-002 | [Assumption] | [Impact] | [Who to verify with] |
| A-003 | [Assumption] | [Impact] | [Who to verify with] |

### Business Risks

| Risk ID | Risk Description | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R-001 | [Risk] | High/Med/Low | High/Med/Low | [Mitigation strategy] |
| R-002 | [Risk] | High/Med/Low | High/Med/Low | [Mitigation strategy] |
| R-003 | [Risk] | High/Med/Low | High/Med/Low | [Mitigation strategy] |

---

## 12. Dependencies

### System Dependencies

- **[System Name]**: [Why dependent, what data/functionality needed]
- **[System Name]**: [Why dependent, what data/functionality needed]

### Process Dependencies

- **[Process/Project Name]**: [Why dependent, what must complete first]
- **[Process/Project Name]**: [Why dependent, what must complete first]

### Resource Dependencies

- **[Resource/Team]**: [What is needed from them]
- **[Resource/Team]**: [What is needed from them]

---

## 13. Out of Scope

> Explicitly document what is NOT included in this project

- [Item 1 explicitly not included]
- [Item 2 explicitly not included]
- [Item 3 explicitly not included]
- [Future enhancement 1 — for later phase]
- [Future enhancement 2 — for later phase]

---

## 14. Open Questions

| # | Question | Owner | Due Date | Status |
|---|---|---|---|---|
| Q-001 | [Business question needing clarification] | [Who will answer] | YYYY-MM-DD | Open/Answered |
| Q-002 | [Business question] | [Who will answer] | YYYY-MM-DD | Open/Answered |
| Q-003 | [Business question] | [Who will answer] | YYYY-MM-DD | Open/Answered |

---

## 15. Approval and Sign-Off

| Stakeholder | Role | Approval Date | Signature |
|---|---|---|---|
| [Name] | Business Owner | YYYY-MM-DD | |
| [Name] | Product Owner | YYYY-MM-DD | |
| [Name] | Technical Lead | YYYY-MM-DD | |

---

## 16. Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | YYYY-MM-DD | [Author] | Initial draft |
| 1.0 | YYYY-MM-DD | [Author] | Approved version |

---

> **AI Usage Note**: This document provides business context for AI-driven development.
> The functional specifications document translates these business requirements into
> technical specifications for implementation.
> Reference: `@.claude/templates/functional-specifications.md` for the corresponding technical spec.
