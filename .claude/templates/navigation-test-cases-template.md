# Navigation Test Cases Template

Use for NextJS App Router navigation validation, guarded routes, and state continuity.

## Feature
- Name:
- Route scope:
- Role constraints:

## Cases

| ID | Scenario | Steps | Expected Result | Type |
| --- | --- | --- | --- | --- |
| NAV-001 | Direct route access | Open route URL | Correct page and guard behavior | E2E |
| NAV-002 | Link-based transition | Click in-app link | Correct route transition with expected content | E2E |
| NAV-003 | Browser back behavior | Navigate to detail and back | Returns to expected context | E2E |
| NAV-004 | Browser forward behavior | Forward after back | State restored correctly | E2E |
| NAV-005 | Protected route access | Access route without required auth | Redirect/deny behavior works | E2E |
| NAV-006 | Query/filters preserved | Navigate away and return | Query/filter context preserved as designed | Integration |

## Notes
- Validate role-aware UI visibility where route is accessible but actions are restricted.
- Keep stable selectors on navigation controls.
