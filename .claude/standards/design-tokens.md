# Design Tokens Registry

> **Auto-augmented by**: `/ui-apply-theme`, `/design-system-setup`.
> Edit by hand only when adding a new token category by design — otherwise let the
> commands append.
>
> **Component-level colour, spacing, radius, and sizing tokens are owned by Lumen**
> (`@lumen/react`). Do not redefine them here — pull the live set with the Lumen MCP
> `get-lumen-css-tokens`. This registry tracks the retained Tailwind layout scale and
> the app-level `ppcc-*` brand tokens declared in `apps/web/app/globals.css`.

## Token Categories

| Category | Source | Example Tokens |
| --- | --- | --- |
| Color — semantic | Lumen (`get-lumen-css-tokens`) | `--lmn-color-primary-default`, `--lmn-color-surface-default`, `--lmn-color-critical-base` |
| Color — status | Lumen (`get-lumen-css-tokens`) | `--lmn-color-success-base`, `--lmn-color-warning-base`, `--lmn-color-info-base` |
| Color — on-surface / text | Lumen (`get-lumen-css-tokens`) | `--lmn-color-on-surface-default`, `--lmn-color-on-surface-variant` |
| Color — brand (app) | `globals.css` `@theme` | `--color-ppcc-yellow`, `--color-ppcc-ink`, `--color-ppcc-grey` |
| Spacing (layout) | Tailwind scale | `space.0`, `space.1`, `space.2`, … `space.96` |
| Spacing (component) | Lumen | `--lmn-spacing-page`, `--lmn-spacing-section`, `--lmn-spacing-button-horizontal` |
| Radius | Lumen / Tailwind | `--lmn-border-radius-small`, `--lmn-border-radius-regular` |
| Shadow | `globals.css` `@theme` | `--shadow-soft`, `--shadow-elevated` |
| Typography — family | App config | `font.sans` (`--font-sans`) |
| Typography — size | Tailwind scale | `text.xs`, `text.sm`, `text.base`, `text.lg`, `text.xl`, … |
| Typography — weight | Tailwind scale | `weight.normal`, `weight.medium`, `weight.bold` |
| Z-index | App config | `z.modal`, `z.popover`, `z.toast` |

## Active Tokens (latest applied)

```yaml
appliedAt: <timestamp>
appliedBy: <command>
theme: <theme-id>
tokens:
  color: {}
  spacing: {}
  radius: {}
  shadow: {}
  typography: {}
  zIndex: {}
```

## Collision Rules

When a theme command (`/ui-apply-theme`, `/design-system-setup`) extracts new app-level
tokens:

1. **Exact match** (same name + same value) — skip.
2. **Same name, different value** — preserve existing; append the new value with a suffix
   (e.g. `--color-ppcc-yellow-alt`) and flag in the change log below.
3. **New name** — append under the matching category.
4. **Deprecated** — never delete here; mark with `@deprecated` comment and remove via a
   coordinated theme re-run.
5. **Lumen-owned token** — never redefine here; defer to Lumen's set via
   `get-lumen-css-tokens`.

## Change Log

| Timestamp | Command | Action | Token | Old Value | New Value |
| --- | --- | --- | --- | --- | --- |
| _no entries yet_ | | | | | |

## Cross-References

- Lumen token source: Lumen MCP `get-lumen-css-tokens`
- Design system setup: `@.claude/commands/design-system-setup.md`
- UI design standards: `@.claude/standards/ui-design-standards.md`
- Theme registry: `@.claude/config/ui-themes.json`
- Storybook standards: `@.claude/standards/storybook-standards.md`

## Token Optimization

**Load when**: building/auditing tokens, during theme application/review.
**Load only**: this file + `@.claude/standards/ui-design-standards.md`.
**Unload after**: tokens are written or theme is applied.
**Hand-off to**: `/ui-apply-theme` or `frontend-developer` agent.
