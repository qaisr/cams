---
description: Configure the project's design system — color tokens, typography scale, spacing, radius, shadows — wired into Tailwind/DaisyUI theme and Storybook.
agent: frontend-developer
subtask: true
---

# Design System Setup

Bootstraps a token-driven design system for the project. Produces a single source
of truth for colors, typography, spacing, and motion that every UI component consumes.

## Activation

Load when:
- Starting a new project
- Refreshing brand identity
- Migrating from ad-hoc styles to design tokens
- Onboarding a new theme alongside `/ui-apply-theme`

Unload after design tokens, Tailwind config, and Storybook theme registration are committed.

## Required Inputs

1. **Brand inputs** — primary/secondary palette, typography family, logo (if any)
2. **Mode** — light, dark, or both
3. **Density** — comfortable / compact (controls base spacing scale)
4. **Accessibility floor** — WCAG 2.1 AA (default) or AAA

If any input missing, ask the user once. Do not invent brand colors.

## Outputs (Deterministic)

| Artifact | Path | Purpose |
| --- | --- | --- |
| Token JSON | `.claude/config/ui-themes.json` | Canonical theme registry (extends existing structure) |
| Tailwind config | `apps/web/tailwind.config.ts` | Extended with semantic tokens |
| DaisyUI theme | `apps/web/src/styles/themes.css` | Maps tokens → DaisyUI variables |
| Storybook theme | `apps/web/.storybook/preview.tsx` | Backgrounds + viewports updated |
| Tokens reference | `.claude/docs/component-library.md#design-tokens` | Updated section |

## Process (6 steps)

1. **Audit existing styles** — grep for hardcoded colors / px values across `apps/web/src/`
2. **Define semantic tokens** — `surface`, `surface-muted`, `text`, `text-muted`, `border`, `accent`, `success`, `warning`, `danger`, `info`
3. **Map raw → semantic** — never reference raw hex in components
4. **Generate Tailwind utilities** — `bg-surface`, `text-muted`, etc.
5. **Wire DaisyUI** — register theme(s) in `themes.css`
6. **Verify in Storybook** — load every published component variant under each theme

## Quality Gate

- [ ] No raw hex codes in `apps/web/src/components/` (grep clean)
- [ ] No raw `px` values for spacing (use `space-{n}` / `gap-{n}`)
- [ ] WCAG contrast verified for `text` on every `surface` token (axe / contrast checker)
- [ ] Light + dark mode (if requested) screenshot-tested in Storybook
- [ ] `.claude/standards/component-usage.md` updated with new tokens
- [ ] `.claude/config/ui-themes.json` validates against schema (run `pnpm validate:themes` if defined)

## Token Optimization

- Load only `.claude/standards/ui-design-standards.md` and `.claude/standards/accessibility-standards.md` during setup.
- Unload Storybook standards and component-usage standard once theme registration is verified.
- Hand off to `/ui-apply-theme` for switching between configured themes.

## Cross-References

- UI design standards: `@.claude/standards/ui-design-standards.md`
- Accessibility standards: `@.claude/standards/accessibility-standards.md`
- Component usage standard: `@.claude/standards/component-usage.md`
- Theme commands catalog: `@.claude/commands/ui-theme-commands.md`
- Component library reference: `@.claude/docs/component-library.md`
- Frontend standards: `@.claude/standards/frontend-standards.md#styling`
