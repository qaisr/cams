---
description: Design UI/UX for a feature using the project's design system and accessibility-first structure.
agent: frontend-developer
subtask: true
---

# Design UI

## Input
$ARGUMENTS (feature/page description)

## Purpose
Create implementation-ready UI design guidance using NextJS App Router, aligned with the project's design system and any available design references.

## Pre-Flight
Load:
- `@.claude/standards/ui-design-standards.md`
- `@.claude/standards/component-usage.md` — check Storybook library before designing new components
- `@.claude/docs/component-library.md`
- `@.claude/workflows/ui-design-workflow.md`

Wireframe gate:

- Inspect `.claude/wireframes/*` and read `.claude/wireframes/.generated-manifest.json` before designing any UI output, then apply **Wireframe Precedence** (`@.claude/standards/component-usage.md#wireframe-precedence-canonical`).
- Read **UI Library** in `@.claude/CLAUDE.md` Critical Constraints.
- If wireframes use a different UI library/styling system, convert implementation guidance to the configured UI library while preserving wireframe layout, hierarchy, spacing, states, and interaction intent.

## Workflow

### 1. Clarify Scope
Capture:
- User goal and key tasks
- Page type (list/detail/form/dashboard)
- Required states (loading, empty, error, success)
- Navigation expectations and role constraints

### 2. Pull Design References
- If a design tool MCP is configured, query it for matching frames/components
- Analyze relevant files in `.claude/wireframes/` per Wireframe Precedence: page/layout wireframes lead; a component/pattern wireframe marked `converted` carries equal weight with the already-generated component (reconcile, don't override)
- Map to the project's design system equivalents
- Note gaps and approved substitutions
- If wireframe library differs from configured **UI Library**, provide explicit mapping notes from wireframe primitives to target UI library primitives

### 3. Produce Design Spec
Create concise implementation spec with:
- Component tree
- Layout at 375/768/1440 breakpoints
- Token usage (no raw colors/spacing)
- Accessibility requirements
- Navigation + pagination behavior
- Testability notes (stable selectors, deterministic states)
- Wireframe coverage notes: which wireframe files/sections were used and how they were translated to configured UI library constraints

### 4. Validate Quality Gates
Before handoff confirm:
- Usability and visual hierarchy
- WCAG 2.1 AA checks
- Consistent navigation flows
- Pagination behavior defined
- Design system-only component usage

## Output
- UI implementation brief in `.claude/specs/ui-specs/{feature}-ui-spec.md`

## Cross-References
- `/ui-add-component-with-design`
- `/ui-review`
- `/ui-test-accessibility`
