# UI Design And Implementation Workflow

## Purpose

Design-first workflow for producing high-quality UI with the project's configured design system.
Use this workflow for new pages, major redesigns, and UI quality improvements.

## Phase 0: Theme Selection (Optional)

Before designing, optionally establish a visual direction through theme selection.

### Option A: Use Existing Theme
Check `.claude/docs/current-theme.md` for active theme
Apply consistent patterns from established theme
Skip to Phase 1

### Option B: Apply New Theme
Run `/ui-apply-theme` to establish new visual direction:

- Select preset theme (Vibrant, Professional, Calm, Modern, Warm)
- OR provide custom colors for AI to analyze
- Specify scope (page, feature, or app-wide)
- Document theme in `.claude/docs/current-theme.md`

Then proceed to Phase 1 using established theme

### Option C: No Specific Theme
Use default design system variants
Focus on functionality over aesthetics
Can apply theme later with `/ui-apply-theme`

Then proceed to Phase 1

---

## Phase 1: Design Reference Discovery

1. Load standards and references:
   - `@.claude/standards/ui-design-standards.md`
   - `@.claude/standards/component-usage.md` — ALWAYS check existing Storybook library before creating any new component
   - `@.claude/docs/component-library.md`
2. Check the generation manifest `.claude/wireframes/.generated-manifest.json` before treating any
   wireframe as the sole source, then apply **Wireframe Precedence** — the canonical rule in
   `@.claude/standards/component-usage.md#wireframe-precedence-canonical`.
3. If a design tool (e.g. Figma) MCP is configured, query it when a design source exists:
   - Find matching frames/components
   - Capture spacing, typography, and state behavior
4. Query the project's design system MCP (if configured):
   - Identify canonical component mappings
   - Confirm token usage and variants
5. Inspect existing codebase patterns for consistency before introducing new patterns.

Output:

- Candidate design references
- Component mapping list
- Initial quality risks

## Phase 2: UI Specification

Create a feature-specific UI spec before implementation.

Suggested path:

- `.claude/specs/ui-specs/<feature-name>-ui-spec.md`

Suggested template:

- `@.claude/templates/ui-spec-template.md`

Spec sections:

1. User flow
2. Layout hierarchy and responsive behavior
3. Component inventory with design system mapping
4. Design tokens to use (color, spacing, type)
5. State definitions (loading, error, empty, success)
6. Accessibility plan (keyboard, semantics, focus)
7. Design references and implementation notes
8. Theme alignment (if theme in use)

## Phase 3: Implementation Sequence

Implement in this order:

1. Structural layout and composition
2. Typography hierarchy
3. Spacing and surfaces using tokens
4. Primary/secondary action clarity
5. Interaction states (hover/focus/active)
6. Loading/error/empty states
7. Responsive behavior
8. Accessibility hardening
9. Apply theme variants if established theme in use

Implementation rules:

- Design system components first, custom wrappers second.
- No arbitrary CSS values when a token exists.
- Avoid visual drift from established pages.
- Respect active theme mappings.

## Phase 4: UI Quality Gate

Use this quality gate before completion or merge.

Visual:

- Consistent hierarchy and spacing
- Intentional action emphasis
- No token violations
- Adherence to active theme (if applicable)

Responsive:

- 375px pass
- 768px pass
- 1440px pass
- No horizontal overflow

Accessibility:

- Semantic structure
- Keyboard-only navigation
- Focus-visible signals
- Labeling and validation clarity
- Contrast compliance

States:

- Loading covered
- Error covered
- Empty covered
- Success covered where applicable

## Phase 5: Documentation And Reuse

Update artifacts when new reusable patterns are introduced:

- `@.claude/docs/component-library.md`
- Relevant command notes under `@.claude/commands/`
- Any new token decisions or caveats in `@.claude/docs/component-library.md`

## Design Tool MCP Setup Checklist

If a design tool MCP (e.g. Figma) is configured but not consistently used:

1. Confirm server entry exists in your MCP configuration.
2. Confirm auth token is available in local environment or server config.
3. Verify access to target design files/projects.
4. Run a small retrieval test for one frame/component before starting implementation work.
5. If retrieval fails, continue with design-system-only flow and log a "design tool unavailable" note in the UI spec.

## Fast Commands

- Use `/ui-audit` for baseline quality scoring.
- Use `/ui-improve` for refactor recommendations.
- Use `/ui-review` as final gate before completion.

## Token Optimization

- **Load when**: planning a new screen, flow, or visual change before implementation.
- **Load only**: this workflow + `ui-design-standards.md` + `accessibility-standards.md` + any wireframes under `.claude/wireframes/`.
- **Unload after**: design artifact (wireframe / spec / annotated screenshot) approved. Implementation switches to `frontend-ui-protocol.md`.
- **Hand-off to**: `frontend-developer` for implementation, `accessibility-auditor` for review.
