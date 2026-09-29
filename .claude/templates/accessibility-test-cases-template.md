# Accessibility Test Cases Template

Use for WCAG 2.1 AA-aligned checks across component-based interfaces.

## Feature
- Name:
- Primary flow:

## Cases

| ID | Scenario | Steps | Expected Result | Type |
| --- | --- | --- | --- | --- |
| A11Y-001 | Keyboard-only navigation | Tab through interactive elements | Logical focus order and operable controls | E2E |
| A11Y-002 | Focus visibility | Focus links/buttons/inputs | Visible focus indicator at all times | E2E |
| A11Y-003 | Semantic heading/landmarks | Inspect structure | Correct landmarks and heading hierarchy | Unit |
| A11Y-004 | Form labels and errors | Trigger validation errors | Labels and actionable errors announced | E2E |
| A11Y-005 | Contrast compliance | Check text and UI controls | Meets minimum contrast thresholds | Audit |
| A11Y-006 | Non-text alternatives | Inspect icons/images | Accessible names and alt text present | Unit |
| A11Y-007 | Status/message announcements | Trigger async success/error updates | Important updates are perceivable | E2E/Manual |
| A11Y-008 | Screen reader journey | Execute critical workflow | Flow is understandable without visual context | Manual |

## Notes
- Re-check accessibility after theme changes.
- Keep at least one accessibility regression suite in CI for critical flows.
