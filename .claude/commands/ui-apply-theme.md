---
name: ui-apply-theme
description: Apply a predefined or custom color theme to UI components using design tokens
applyTo: "**"
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: medium
---

# Apply UI Theme

**Purpose**: Apply a predefined or custom color theme to UI components

**Use this command when**:
- Starting a new feature and want to establish visual direction
- Redesigning UI for a specific mood/brand aesthetic
- Have specific brand colors you want to apply
- Want interactive guidance on color mapping

---

## Interactive Theme Selection

### Step 1: Choose Theme Style

AI presents 6 options:

```
🎨 UI Theme Selection

1. Vibrant - Bold, energetic colors with high contrast
2. Professional - Clean, minimal, business-focused
3. Calm - Soothing, low-contrast, subtle design
4. Modern - Contemporary, balanced, tech-forward
5. Warm - Inviting, friendly, approachable
6. Custom Colors - Specify your own color palette
```

### Step 2A: If Preset Selected

**Example**: User selects `2` (Professional)

AI responds:
```
✅ Applying Professional theme...

Color Palette:
- Primary Accent: Brand (PPCC Yellow #faec20)
- Lozenge Variants: shade, light, brand
- Surface Style: Minimal, container-based
- Contrast Level: Medium
- Lozenge Usage: Minimal (status only)

Component Changes:
- Hero sections → surface="default"
- Cards → surface="container"
- Status indicators → shade/light lozenges
- CTAs → primary buttons with brand accent
- Data sections → neutral containers

Apply to:
1. Current page only
2. All pages in current feature
3. Entire application
```

### Step 2B: If Custom Colors Selected

**Example**: User selects `6` (Custom), provides `#faec20,#fa915a,#01a292`

AI analyzes:
```
🔍 Analyzing palette...

Colors:
1. 🟡 #faec20 → tertiary (Brand Yellow)
2. 🟠 #fa915a → red-earth (Coral Orange)
3. 🟢 #01a292 → ocean-green (Teal)

Suggested Theme: Tropical Sunset (Vibrant preset)
Mood: Energetic, warm, attention-grabbing

Apply custom theme? (y/n)
```

### Step 3: Apply & Document

AI:
1. Scans current UI components
2. Generates targeted changes
3. Creates/updates `.claude/docs/current-theme.md`
4. Shows summary of changes

```
✅ Theme applied!

Summary:
- Theme: Tropical Sunset (Vibrant)
- Files modified: 3
- Components updated: 7
- Scope: dashboard section

Rollback: Use /ui-revert-theme
```

---

## Related Commands

- `/ui-preview-themes` — See all themes before applying
- `/ui-revert-theme` — Undo to previous theme
- `/ui-export-theme` — Share theme configuration
- `/ui-audit` — Check UI quality against active theme

---

## References

- Theme config: `@.claude/config/ui-themes.json`
- UI standards: `@.claude/standards/ui-design-standards.md`
- Component library: `@.claude/docs/component-library.md`
