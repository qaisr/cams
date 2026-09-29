# Pagination Test Cases Template

Use for paged lists/tables with sorting/filtering and enterprise data volumes.

## Feature
- Name:
- Data source/API:
- Default page size:

## Cases

| ID | Scenario | Steps | Expected Result | Type |
| --- | --- | --- | --- | --- |
| PAG-001 | Initial page load | Open paged view | Page 1 data and count are correct | E2E |
| PAG-002 | Next page transition | Click next | New data page loads correctly | E2E |
| PAG-003 | Previous page transition | Click previous | Returns to prior page data | E2E |
| PAG-004 | First-page boundary | On page 1 inspect controls | Previous is disabled | Unit/E2E |
| PAG-005 | Last-page boundary | On final page inspect controls | Next is disabled | Unit/E2E |
| PAG-006 | Sorting consistency | Change sort and paginate | Ordering remains stable and deterministic | Integration |
| PAG-007 | Filter + pagination | Apply filter while on later page | Page index behavior is deterministic | E2E |
| PAG-008 | Empty dataset state | Filter to no results | Accessible empty state + recovery action | E2E |

## Notes
- Add checks for API contract fields: page, size, total, hasNext/hasPrevious.
- Watch for duplicate/missing rows across page transitions.
