---
name: ui-export-theme
description: Export current UI theme configuration for sharing and reuse
applyTo: "**"
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# Export UI Theme

**Purpose**: Export active theme configuration for team sharing and reuse across projects

**Use this command when**:
- Want to share your theme with team members
- Planning to reuse theme in another project/repository
- Creating archival backup of custom theme
- Documenting brand theme for design system

---

## Export Options

### Option 1: Export Current Active Theme

```bash
/ui-export-theme

Where should I save the theme? (default: .claude/configs/themes/current-theme-export.json)
```

AI exports:
```json
{
  "name": "Tropical Sunset",
  "version": "1.0",
  "exportedAt": "2026-04-21T11:45:00Z",
  "exportedByUser": "user@ppcc.com",
  "preset": "vibrant",
  "colors": ["#faec20", "#fa915a", "#01a292"],
  "mappings": {
    "primary": "tertiary",
    "accent1": "red-earth",
    "accent2": "ocean-green",
    "surface": "container",
    "hero": "tertiary"
  },
  "characteristics": {
    "boldness": "high",
    "playfulness": "high",
    "professionalism": "medium",
    "contrast": "high",
    "mood": "energetic, warm, attention-grabbing"
  },
  "designTokens": {
    "tertiary": "#faec20",
    "red-earth": "#e46c2c",
    "ocean-green": "#01a292"
  },
  "appliedTo": [
    "src/app/dashboard/**",
    "src/components/StatusCard.tsx",
    "src/components/Hero.tsx"
  ],
  "documentation": {
    "bestFor": ["Marketing sites", "creative portfolios", "dashboards", "youth-focused products"],
    "accessibility": {
      "wcagAA": true,
      "colorBlindFriendly": true,
      "testedInDarkMode": true
    }
  }
}
```

### Option 2: Export with Custom Name

```bash
/ui-export-theme "My Brand Theme"

Exporting as: .claude/configs/themes/my-brand-theme.json
```

### Option 3: Export as Shareable Config

```bash
/ui-export-theme --format=shareable

Generated: .claude/config-exports/tropical-sunset-2026-04-21.json

Share this file with team members to apply the same theme.
```

---

## Export Directory Structure

After export:

```
.claude/config-exports/
├── tropical-sunset-vibrant-2026-04-21.json
├── professional-preset-2026-04-20.json
└── README.EXPORTED-THEMES.md
```

---

## Using Exported Theme

To use exported theme in another project:

```bash
# 1. Copy exported theme file to new project
cp tropical-sunset-vibrant-2026-04-21.json /path/to/other-project/.claude/config/

# 2. Import theme
/ui-import-theme tropical-sunset-vibrant-2026-04-21.json

# 3. Apply imported theme
/ui-apply-theme
# Select: imported theme from list
```

---

## What Gets Exported

✅ **Exported**:
- Theme name, description, version
- Color palette (hex values)
- Design token mappings
- Component surface/variant assignments
- Mood and characteristics
- Accessibility compliance status
- Metadata (export date, user, notes)
- Applied file list

❌ **NOT Exported**:
- Actual code changes (only config)
- Component implementations
- Project-specific paths (normalized)
- Internal comments/drafts

---

## Export Metadata

```json
{
  "exportMetadata": {
    "exportedAt": "2026-04-21T11:45:00Z",
    "exportedBy": "username@ppcc.com",
    "sourceProject": "app",
    "sourceProjectUrl": "",
    "frameworkVersion": "PPCC Enterprise AI Framework v2.1",
    "notes": "Brand standard theme for all PPCC dashboards"
  }
}
```

---

## Sharing Exported Themes

After export, share theme:

**Option 1: Direct File Share**
```bash
# Upload to shared drive or GitHub
git add .claude/config-exports/tropical-sunset*.json
git commit -m "docs: export Tropical Sunset theme for team use"
git push
```

**Option 2: Document in README**
```markdown
## Theme: Tropical Sunset

For team members wanting consistent branding:

1. Download: `tropical-sunset-vibrant-2026-04-21.json`
2. Import: `/ui-import-theme tropical-sunset-vibrant-2026-04-21.json`
3. Apply: `/ui-apply-theme` → select Tropical Sunset
4. Done!
```

**Option 3: Add to Design System Docs**
- Document theme characteristics
- Include preview images
- Provide usage guidelines
- Link exported config file

---

## Version Control

Exported themes can be tracked in git:

```bash
.claude/config-exports/
├── .gitkeep
└── *.json  # Theme export files

# In .gitignore:
# .claude/backups/   (local backups, not shared)
# But .claude/config-exports/ IS tracked for team sharing
```

---

## Related Commands

- `/ui-apply-theme` — Apply active or imported theme
- `/ui-preview-themes` — See all available themes
- `/ui-revert-theme` — Undo theme changes
- `/ui-import-theme` — Import exported theme (future)

---

## Use Cases

### Use Case 1: Brand Consistency Across Team

```
1. Design lead creates and refines theme: Tropical Sunset
2. Lead exports: /ui-export-theme "Tropical Sunset"
3. Commits to git: .claude/config-exports/tropical-sunset.json
4. Team members import: /ui-import-theme tropical-sunset.json
5. Team members apply: /ui-apply-theme → select Tropical Sunset
6. All projects now have consistent branding ✅
```

### Use Case 2: Migrating Theme Between Projects

```
Project A → Export → Project B
1. Project A: /ui-export-theme (creates JSON)
2. Download/copy JSON to Project B
3. Project B: /ui-import-theme (registers theme)
4. Project B: /ui-apply-theme (applies to codebase)
5. Projects A & B now share theme ✅
```

### Use Case 3: Archiving Custom Themes

```
1. Create custom theme = /ui-apply-theme → Custom Colors
2. Refine over time (multiple iterations)
3. When satisfied: /ui-export-theme "Final Brand Theme"
4. Store in version control or design docs
5. Reference point for future work ✅
```

---

## References

- Theme config: `@.claude/config/ui-themes.json`
- UI standards: `@.claude/standards/ui-design-standards.md`
