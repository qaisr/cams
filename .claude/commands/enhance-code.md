---
description: Enhance existing code — add features, change libraries, improve UX, update patterns
agent: build
subtask: false
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# Enhance Code

## Input

$ARGUMENTS (enhancement description)
Examples:

- `change the layout and components to use [NewLibrary] instead of MUI @path/to/component.tsx`
- `add pagination to the resource list in @apps/api/src/modules/resource/resource.controller.ts`
- `add dark mode support to @frontend/src/app/layout.tsx`
- `add caching to @apps/api/src/modules/resource/resource.service.ts`

## Process

### 1. Analyze Target

- Read all referenced files
- Understand current implementation
- Identify what needs to change vs what stays the same

### 2. Impact Analysis

```

## Enhancement: {description}

### Current State

[What exists now]

### Target State

[What it should look like after]

### Files to Modify

- [file]: [what changes]

### Breaking Changes

- None / [list any API or prop changes]

### Dependencies to Add/Remove

- Add: [package@version]
- Remove: [package]

```

Confirm with user if breaking changes exist.

### 3. Library Migration (if applicable)

When migrating UI libraries (e.g., MUI → new design system):

1. Read `@.claude/docs/component-library.md` for composition/slot guidance
2. Query design system MCP (if configured) for equivalent components
3. Query Context7 MCP (`https://mcp.context7.com/mcp`) for NextJS/React migration patterns if needed
4. Map old components to new equivalents
5. Replace imports
6. Replace component usage (query MCP for props if available)
7. Replace style props with design tokens
8. Remove old library imports
9. Check accessibility still meets WCAG 2.1 AA

### 4. Implement Enhancement

Apply relevant standards:

- UI changes: `@.claude/standards/frontend-standards.md`
- API changes: `@.claude/standards/api-standards.md`
- For UI changes, read `@.claude/docs/component-library.md` for reusable patterns
- Use Context7 MCP for non-PPCC framework/library behavior and migration references

### 5. Verify

```bash
!`cd frontend && npm run build 2>&1 | tail -20`
!`cd frontend && npm test -- --testPathPattern="{affected}"`
!`cd frontend && npm run lint`
```

### 6. Update Tests

If component props or API signatures changed, update tests to match.

## Cross-References

- Component only: `/add-component`
- Review after: `/review-code`
- Component library guide: `@.claude/docs/component-library.md`
- Framework docs/examples: query Context7 MCP
