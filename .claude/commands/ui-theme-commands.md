---
name: ui-theme-commands-catalog
description: Reference catalog for UI theme commands (individual command files available)
applyTo: "**"
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# UI Theme Commands - Reference Catalog

**Status**: Individual command files now available as slash commands.

Type `/ui-apply-theme`, `/ui-preview-themes`, `/ui-revert-theme`, or `/ui-export-theme` in chat.

**Individual Command Files**:
- `/ui-apply-theme` → `ui-apply-theme.md`
- `/ui-preview-themes` → `ui-preview-themes.md`
- `/ui-revert-theme` → `ui-revert-theme.md`
- `/ui-export-theme` → `ui-export-theme.md`

---

# Theme Commands Overview

## `/ui-apply-theme`

**Purpose**: Apply a predefined or custom color theme to UI components

**Interactive Process**:

### Step 1: Present Theme Options

```
🎨 **UI Theme Selection**

Choose a theme style:

1. **Vibrant** - Bold, energetic colors with high contrast
   Preview: 🟡🟠🟢🔵 (Yellow, Orange, Teal, Blue)
   Best for: Marketing sites, creative portfolios, dashboards

2. **Professional** - Clean, minimal, business-focused
   Preview: ⬜⬛🟨 (Neutral, Black, Subtle Yellow)
   Best for: Enterprise apps, admin panels, corporate sites

3. **Calm** - Soothing, low-contrast, subtle design
   Preview: 🟢🔵⬜ (Teal, Light Blue, White)
   Best for: Wellness apps, reading interfaces, medical

4. **Modern** - Contemporary, balanced, tech-forward
   Preview: 🟣🔵⬜ (Purple, Blue, White)
   Best for: SaaS products, tech platforms, startups

5. **Warm** - Inviting, friendly, approachable
   Preview: 🟠🟡🟢 (Orange, Yellow, Green)
   Best for: Community platforms, social apps, education

6. **Custom Colors** - Specify your own color palette

Which theme would you like to apply? (1-6 or type theme name)
```

---

### Step 2A: If Preset Theme Selected

**User selects**: `2` or `professional`

**AI Response**:
```
✅ Applying **Professional** theme...

**Theme Configuration**:

- Primary Accent: Brand Accent
- Surface Style: Minimal, container-based
- Contrast: Medium

**Changes to be applied**:

1. Hero sections → `surface="default"` (clean white/dark)
2. Cards → `surface="container"` (subtle gray)
3. Status indicators → `shade`/`light` lozenges
4. CTAs → Primary buttons with brand accent
5. Data sections → Neutral containers

**Scope**:

- [ ] Current page only
- [ ] All pages in current feature
- [ ] Entire application

Select scope (1-3):
```

---

### Step 2B: If Custom Colors Selected

**User selects**: `6` or `custom colors`

**AI Response**:
```
🎨 **Custom Color Theme**

Please provide 2-4 colors in hex format (comma-separated):
Example: #faec20,#fa915a,#01a292

Your colors:
```

**User provides**: `#faec20,#fa915a,#01a292`

**AI Analyzes**:
```
🔍 **Analyzing your color palette...**

**Colors Provided**:

1. 🟡 #faec20 - Bright Yellow (Dominant)
2. 🟠 #fa915a - Coral Orange (Accent 1)
3. 🟢 #01a292 - Teal (Accent 2)

**Closest Design Tokens**:

- #faec20 → `tertiary` (Brand Yellow family)
- #fa915a → `red-earth` (Coral/Orange family)
- #01a292 → `ocean-green` (Teal family)

**Suggested Theme**: **Tropical Sunset** (Vibrant preset)

**Mood**: Energetic, warm, attention-grabbing
**Best for**: Creative apps, marketing pages, youth-focused products

**Color Application Strategy**:

- **Primary Accent**: Tertiary (Yellow) - Hero sections, primary CTAs
- **Secondary Accent**: Red Earth (Coral) - Secondary buttons, highlights
- **Tertiary Accent**: Ocean Green (Teal) - Status indicators, accents
- **Backgrounds**: Container (neutral) to balance vibrant accents

**Apply this theme?** (y/n)
If no, would you like to:

1. Adjust color mapping
2. Try a different preset
3. Provide different colors
```

---

### Step 3: Apply Theme

**User confirms**: `y`

**AI Executes**:

1. **Scan Current UI Components**
```
📊 Scanning UI components...

Found:

- 3 Hero sections
- 12 Card components
- 8 Lozenge status indicators
- 15 Button components
- 5 Box containers
```

2. **Generate Theme Changes**
```
🔧 Generating theme changes...

**Changes**:

src/app/dashboard/page.tsx:

- Line 24: Box surface="default" → surface="tertiary"
- Line 45: Lozenge variant="brand" → variant="red-earth"
- Line 67: Box surface="container" → surface="container" (no change)

src/components/StatusCard.tsx:

- Line 12: Lozenge variant="success" → variant="ocean-green"
- Line 18: Box surface="default" → surface="container"

src/components/Hero.tsx:

- Line 8: Box surface="container" → surface="tertiary"
- Line 15: Button variant="secondary" → variant="primary"

Total: 7 components updated across 3 files
```

3. **Create Theme Documentation**
```
📄 Creating theme documentation...

File created: .claude/docs/current-theme.md
```
```
✅ Theme applied successfully!

**Summary**:

- Theme: Tropical Sunset (Vibrant)
- Files modified: 3
- Components updated: 7
- Color palette: Yellow/Coral/Teal

**Preview**: Run `npm run dev` to see changes

**Rollback**: If you want to revert, use `/ui-revert-theme`
```

---

### Step 4: Theme Preview & Refinement

**AI offers**:
```
🎨 **Theme Preview Tips**

Test your new theme:

1. Check contrast in both light and dark mode
2. Verify status indicators are distinguishable
3. Ensure CTAs are prominent
4. Review card hierarchy

Would you like to:

1. Generate theme preview screenshots (requires Playwright)
2. Create a theme comparison report
3. Fine-tune specific components
4. Apply to remaining pages

Choose option (1-4) or type 'done':
```

---

## Implementation Details

### Color Matching Algorithm

When user provides custom colors, AI should:

1. **Parse hex colors** and extract RGB values
2. **Calculate color distance** to each token family in the project's design system
3. **Suggest closest token variants**
4. **Analyze color temperature** (warm vs cool)
5. **Determine contrast ratios**
6. **Recommend preset theme** based on characteristics

**Pseudo-logic**:
```typescript
function findClosestToken(hexColor: string) {
  const userRGB = hexToRGB(hexColor);
  const designTokens = loadColorTokens();

  let closestToken = null;
  let minDistance = Infinity;

  for (const token of designTokens) {
    const tokenRGB = hexToRGB(token.primaryHex);
    const distance = colorDistance(userRGB, tokenRGB);

    if (distance < minDistance) {
      minDistance = distance;
      closestToken = token;
    }
  }

  return {
    variant: closestToken.variant,
    exactMatch: minDistance < 10,
    similarity: (100 - minDistance).toFixed(0) + "%"
  };
}
```

---

### Theme Application Rules

**Component Update Priority**:

1. **Hero sections** → Update `surface` prop based on theme emphasis
2. **Status lozenges** → Map to theme's primary lozenge variants
3. **Cards/Containers** → Update `surface` to match theme hierarchy
4. **Buttons** → Adjust variants for theme consistency
5. **Accents** → Apply theme's accent lozenge variants

**Preservation Rules**:

- **Never change**: Status lozenges with semantic meaning (`critical`, `warning`, `success`, `info`)
- **Preserve**: Component structure, layout, functionality
- **Only update**: Visual styling (surface, variant, color props)

---

### File Updates

When applying theme, AI should:

1. **Create backup** (optional but recommended):

   ```bash
   # Before changes
   cp src/app/dashboard/page.tsx src/app/dashboard/page.tsx.backup
   ```

2. **Update component props**:

   ```tsx
   // Before
   <Box surface="default" padding="tile">

   // After (Vibrant theme)
   <Box surface="container" padding="tile">
   ```

3. **Update lozenge variants**:

   ```tsx
   // Before
   <Lozenge variant="brand" label="Featured" />

   // After (Custom: Coral theme)
   <Lozenge variant="red-earth" label="Featured" />
   ```

4. **Document changes**:

   ```markdown
   # Theme Change Log

   **Date**: 2026-04-21
   **Theme**: Tropical Sunset (Vibrant)
   **Colors**: #faec20, #fa915a, #01a292

   ## Changes:

   - src/app/dashboard/page.tsx: 3 updates
   - src/components/StatusCard.tsx: 2 updates
   - src/components/Hero.tsx: 2 updates

   ## Mapping:

   - Primary: tertiary (Yellow)
   - Accent 1: red-earth (Coral)
   - Accent 2: ocean-green (Teal)
   ```

---

## `/ui-preview-themes`

**Purpose**: Show visual comparison of all preset themes without applying

**Output**: Generates side-by-side comparison:

```
🎨 **Theme Comparison Preview**

Current: Professional

┌─────────────────────────────────────────────────────┐
│ VIBRANT                  │ PROFESSIONAL             │
├─────────────────────────────────────────────────────┤
│ 🟡 Tertiary surface      │ ⬜ Default surface       │
│ 🟠🟢🔵 Colorful lozenges  │ ⬜⬛ Minimal lozenges     │
│ High contrast            │ Medium contrast          │
│ Frequent accents         │ Subtle accents           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ CALM                     │ MODERN                   │
├─────────────────────────────────────────────────────┤
│ 🟢 Container surface     │ ⬛ Contrast surface      │
│ 🟢🔵 Cool lozenges        │ 🟣🔵 Tech lozenges        │
│ Low contrast             │ Medium contrast          │
│ Soothing feel            │ Contemporary feel        │
└─────────────────────────────────────────────────────┘

Select theme to see detailed preview (1-4):
```

---

## `/ui-revert-theme`

**Purpose**: Rollback to previous theme or restore from backup

**Process**:

1. Check for backup files from previous theme application
2. Show theme history with dates and applied scopes
3. Allow user to select version to restore
4. Restore selected version with confirmation

**Example output**:
```
📋 **Theme History**

1. 2026-04-20 - Vibrant (dashboard scope)
2. 2026-04-18 - Professional (app-wide)
3. 2026-04-15 - Default (initial state)

Select version to restore (1-3): 1

✅ Restoring to Tropical Sunset (Vibrant)...
Restored: 3 files
```

---

## `/ui-export-theme`

**Purpose**: Export current theme configuration for reuse across projects

**Output**: `.claude/config/my-custom-theme.json`

```json
{
  "name": "My Brand Theme",
  "colors": ["#faec20", "#fa915a", "#01a292"],
  "preset": "vibrant",
  "mappings": {
    "hero": "tertiary",
    "cards": "container",
    "lozenges": ["red-earth", "ocean-green", "sky-blue"]
  },
  "appliedTo": ["src/app/dashboard/**", "src/components/StatusCard.tsx"],
  "exportedAt": "2026-04-21T10:30:00Z"
}
```

**Usage**: Share exported theme with team or import into other projects via `/ui-import-theme`

---

## Integration Details

### References

- Theme config: `@.claude/config/ui-themes.json`
- Component patterns: `@.claude/docs/component-library.md`

### Workflow Integration

When starting new feature work via `/add-feature` or `/implement-epic`:

1. Check active theme in `.claude/config/ui-themes.json`
2. Apply theme defaults to new components
3. Query design tool MCP (if configured) to validate design intent aligns with theme
4. Document theme usage in implementation notes
