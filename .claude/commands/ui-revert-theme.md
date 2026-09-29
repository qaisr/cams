---
name: ui-revert-theme
description: Rollback to a previous UI theme version
applyTo: "**"
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# Revert UI Theme

**Purpose**: Undo theme changes and restore a previous theme version

**Use this command when**:
- Need to undo last theme application
- Want to restore a previously working theme
- Experimenting with themes and need to roll back
- Reverting component changes made by theme application

---

## How It Works

### Step 1: Review Theme History

AI shows available versions:

```
📋 **Theme History**

1. 2026-04-21 10:30 - Tropical Sunset (Vibrant) - dashboard scope
2. 2026-04-20 14:15 - Professional (preset) - app-wide
3. 2026-04-18 09:00 - Calm (preset) - initial application
4. Default State - Original (no theme applied)

Select version to restore (1-4):
```

### Step 2: Confirm Rollback

User selects: `1`

AI confirms:
```
⚠️ Reverting to: Tropical Sunset (Vibrant)

Files to be restored:
- src/app/dashboard/page.tsx
- src/components/StatusCard.tsx
- src/components/Hero.tsx

Continue? (y/n)
```

### Step 3: Apply Revert

```
✅ Theme reverted successfully!

Restored: Tropical Sunset (Vibrant)
Files restored: 3
Scope: dashboard section

Updated: .claude/docs/current-theme.md
- Previous theme: Professional
- Reverted to: Tropical Sunset (Vibrant)
- Reverted at: 2026-04-21 11:45

Next: /ui-apply-theme to select new theme
       /ui-audit to check quality
```

---

## What Gets Restored

Revert restores:
- ✅ All component props (surface, variant, color)
- ✅ Original styling before theme application
- ✅ No changes to component structure/logic
- ✅ Theme documentation in `current-theme.md`

Does NOT restore:
- ❌ Other code changes made after theme application
- ❌ New components added after theme (only reverts theme-specific props)
- ❌ Manual edits to styled components

---

## Backup Files

When revert happens, AI:
1. Creates timestamped backup of current state
2. Stores in `.claude/backups/themes/` (optional)
3. Preserves full theme change history in `current-theme.md`

Example:
```
.claude/backups/themes/
├── tropical-sunset-vibrant-2026-04-21.json
├── professional-preset-2026-04-20.json
└── calm-preset-2026-04-18.json
```

---

## Theme History Tracking

Each revert updates `current-theme.md`:

```markdown
## Change History

| Date | Theme | Action | Scope | Status |
|------|-------|--------|-------|--------|
| 2026-04-21 11:45 | Tropical Sunset | Reverted to | dashboard | ✅ |
| 2026-04-21 10:30 | Tropical Sunset | Applied | dashboard | ✅ |
| 2026-04-20 14:15 | Professional | Applied | app-wide | ✅ |
```

---

## Related Commands

- `/ui-apply-theme` — Apply new theme
- `/ui-preview-themes` — See available themes
- `/ui-export-theme` — Export current theme config

---

## References

- Current theme: `@.claude/docs/current-theme.md`
- Theme config: `@.claude/config/ui-themes.json`
- UI standards: `@.claude/standards/ui-design-standards.md`
