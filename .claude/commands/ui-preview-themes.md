---
name: ui-preview-themes
description: Preview all UI theme options side-by-side without applying changes
applyTo: "**"
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# Preview UI Themes

**Purpose**: Compare all 5 preset themes visually before applying

**Use this command when**:
- Deciding between theme options
- Want to see side-by-side visual comparison
- Exploring design direction without committing changes
- Need to explain themes to team/stakeholders

---

## Theme Preview Gallery

AI generates visual comparison showing:

```
🎨 **Theme Preview Comparison**

Current Active Theme: Professional

┌──────────────────────────────────────────────┐
│ VIBRANT                │ PROFESSIONAL         │
├──────────────────────────────────────────────┤
│ 🟡 Tertiary surface    │ ⬜ Default surface   │
│ 🟠🟢🔵 Colorful lozenges │ ⬜⬛ Minimal lozenges  │
│ High contrast          │ Medium contrast      │
│ Frequent accents       │ Subtle accents       │
│ Best for: Dashboards   │ Best for: Enterprise │
│ Boldness: HIGH         │ Boldness: LOW        │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ CALM                   │ MODERN               │
├──────────────────────────────────────────────┤
│ 🟢 Container surface   │ ⬛ Contrast surface  │
│ 🟢🔵 Cool lozenges      │ 🟣🔵 Tech lozenges    │
│ Low contrast           │ Medium contrast      │
│ Soothing feel          │ Contemporary feel    │
│ Best for: Wellness     │ Best for: SaaS       │
│ Boldness: LOW          │ Boldness: MEDIUM     │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ WARM                                         │
├──────────────────────────────────────────────┤
│ 🟠 Tertiary surface                          │
│ 🟠🟢🔵 Warm lozenges                          │
│ Medium contrast                              │
│ Friendly, inviting feel                      │
│ Best for: Community, Education               │
│ Boldness: MEDIUM                             │
└──────────────────────────────────────────────┘
```

---

## Detailed Theme Breakdowns

### Vibrant Theme
**Primary Colors**: Yellow (tertiary), Orange (red-earth), Teal (ocean-green), Blue
**Usage**: Hero sections with bold tertiary surface, frequent colorful lozenges
**Best For**: Marketing dashboards, creative portfolios, attention-grabbing UIs
**Characteristics**: High boldness, high playfulness, medium professionalism

### Professional Theme
**Primary Colors**: Yellow (brand), Neutral (shade, light)
**Usage**: Minimal lozenge variants, neutral container surfaces
**Best For**: Enterprise applications, admin panels, corporate sectors
**Characteristics**: Low boldness, low playfulness, high professionalism

### Calm Theme
**Primary Colors**: Teal (ocean-green), Light Blue (sky-blue)
**Usage**: Low-contrast containers, soothing blue-green palette
**Best For**: Wellness apps, medical interfaces, reading platforms
**Characteristics**: Low boldness, medium playfulness, medium professionalism

### Modern Theme
**Primary Colors**: Purple (southern-sky), Blue
**Usage**: Tech-forward accent in contrast surfaces, contemporary lozenges
**Best For**: SaaS products, tech platforms, startups
**Characteristics**: Medium boldness, medium playfulness, high professionalism

### Warm Theme
**Primary Colors**: Yellow (tertiary), Coral (red-earth), Green (ocean-green)
**Usage**: Warm, inviting tertiary surfaces with friendly accents
**Best For**: Community platforms, social apps, education
**Characteristics**: Medium boldness, high playfulness, medium professionalism

---

## What Gets Previewed

Each theme preview shows:
- Sample color palette with hex values
- Surface assignments (hero, cards, sections)
- Lozenge variant usage
- Contrast level and emphasis
- Mood/personality characteristics
- Best-use scenarios
- Color compatibility with light/dark modes

---

## Next Steps

After previewing:

1. **Apply a theme**: `/ui-apply-theme` then select from menu
2. **Check current theme**: View `.claude/docs/current-theme.md`
3. **Get more details**: Reference `.claude/config/ui-themes.json`
4. **Compare specific themes**: Request detailed side-by-side

---

## Related Commands

- `/ui-apply-theme` — Apply selected theme to components
- `/ui-revert-theme` — Undo to previous theme
- `/ui-export-theme` — Export theme configuration

---

## References

- Theme configuration: `@.claude/config/ui-themes.json`
- UI standards: `@.claude/standards/ui-design-standards.md`
- Component library: `@.claude/docs/component-library.md`
