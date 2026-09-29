---
name: sync-claude-copilot
description: Sync .claude framework with VS Code framework (.vscode/ppcc-framework, .github) to keep all AI tooling consistent
version: 1.0.0
requires:
  scripts:
    - .claude/scripts/sync-prompts.js
    - .claude/scripts/sync-all.sh
  cross_references:
    - CLAUDE.md
    - AGENTS.md
    - .github/copilot-instructions.md
    - .vscode/ppcc-framework/.instructions.md
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# Sync Claude Framework with VS Code & GitHub

## Overview

Keeps your framework ecosystem in sync:
- `.claude/` (source of truth)
- `.vscode/ppcc-framework/` (VS Code Chat integration)
- `.github/copilot-instructions.md` (GitHub Copilot)
- Root-level `AGENTS.md`, `CLAUDE.md`, etc.

Sync mode is **template-based wrappers**:
- Full command content lives only in `.claude/commands/*.md`
- Generated wrappers are created/updated in:
  - `.vscode/ppcc-framework/prompts/*.prompt.md`
  - `.github/prompts/*.prompt.md`
  - `.vscode/ppcc-framework/commands/*.instructions.md`

**When to run:**
- After adding new `.claude/commands/` or `.claude/agents/`
- After modifying command descriptions or framework structure
- Before committing framework changes
- As part of pre-release quality checks

**🔒 SAFETY RULE — NEVER MODIFIES SOURCE:**
- This command ONLY READS from `.claude/` folder (source of truth)
- **`.claude/` is always read-only and never written to**
- Changes flow ONE-WAY: `.claude/` → `.vscode/` and `.github/`
- This ensures source framework cannot be corrupted by sync operations

## Phase 1 — Check Sync Status

```
🔄 Framework Sync

Type  check  to see what needs syncing (non-destructive)
Type  sync   to execute all syncs
Type  abort  to cancel

```

**[WAIT FOR USER INPUT]**

## Phase 2 — Execute Sync (if requested)

### Option A: Check Mode (Recommended First)

If user selected `check`:

```bash
./.claude/scripts/sync-all.sh --check
```

Present output:

```
✓ Syncing command wrappers (VS Code + GitHub)...
  Missing: create-tasks, help, implement-best-practices
  Outdated: deploy-prepare, add-feature

⚠ Sync check: 1 area(s) need updates

Next step: Type  sync  to apply these changes.
```

**[WAIT FOR USER INPUT — confirm or abort]**

### Option B: Full Sync

If user confirmed or selected `sync`:

```bash
./.claude/scripts/sync-all.sh
```

Execution:

```
✓ Syncing command wrappers (VS Code + GitHub)...
✓ Created: .vscode/ppcc-framework/prompts/create-tasks.prompt.md
✓ Created: .github/prompts/create-tasks.prompt.md
✓ Created: .vscode/ppcc-framework/commands/create-tasks.instructions.md
✓ Updated: .vscode/ppcc-framework/prompts/deploy-prepare.prompt.md

✓ All framework areas in sync
```

## Phase 3 — Verify & Next Steps

After sync:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SYNC SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Changes synced:
  ✓ Wrapper files generated/updated from templates

Areas synced:
  ✓ .vscode/ppcc-framework/prompts/
  ✓ .github/prompts/
  ✓ .vscode/ppcc-framework/commands/

Remaining manual steps (if any):
  (none — all sync operations completed automatically)

Next steps:
  1. Review changes: git diff
  2. Commit: git add && git commit -m "framework: sync claude with vscode"
  3. Verify VS Code Chat recognizes new commands
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## What Gets Synced

### Wrapper Generation (`.vscode` + `.github`)

**Source**: `.claude/commands/*.md` files
**Targets**:
- `.vscode/ppcc-framework/prompts/*.prompt.md`
- `.github/prompts/*.prompt.md`
- `.vscode/ppcc-framework/commands/*.instructions.md`

Generates thin wrapper files using stable templates.
Command body is NOT copied; canonical content remains in `.claude/commands/`.

**Example**:

```md
# Generated: .vscode/ppcc-framework/prompts/create-tasks.prompt.md
Canonical prompt: `../../../.claude/commands/create-tasks.md`

# Generated: .github/prompts/create-tasks.prompt.md
Canonical prompt: `../../.vscode/ppcc-framework/prompts/create-tasks.prompt.md`

# Generated: .vscode/ppcc-framework/commands/create-tasks.instructions.md
Canonical prompt: `../prompts/create-tasks.prompt.md`
```

### Planned Future Sync Areas

*(Ready to implement — uncomment in Phase 2 when needed)*

```
[Optional extended sync operations]

- Sync .github/copilot-instructions.md
  (from .claude/CLAUDE.md lazy-load mappings)

- Sync AGENTS.md / CLAUDE.md cross-references
  (verify agent file existence, check for broken links)

- Sync .vscode/ppcc-framework/ skills and instruction files
  (if derived from .claude/ patterns)

- Validate .vscode/ppcc-framework/.instructions.md
  (check for broken file references)
```

## Exit Codes

```
0  = All synced successfully, no changes or all changes applied
1  = Error occurred during sync
2  = (--check mode) Changes detected but not applied
```

## Manual Alternatives

If you need to sync just one area:

```bash
# VS Code prompts only
node .claude/scripts/sync-prompts.js

# Check without making changes
./.claude/scripts/sync-all.sh --check

# Suppress output
./.claude/scripts/sync-all.sh --quiet
```

## Troubleshooting

### "Permission denied" running scripts

Make scripts executable:

```bash
chmod +x .claude/scripts/sync-all.sh
```

### Prompts not appearing in VS Code Chat

1. Run `/sync-claude-copilot` to regenerate
2. Restart VS Code
3. Check that `.vscode/ppcc-framework/.instructions.md` is loaded correctly

### Scripts fail with "Cannot find module"

Ensure you're running from the project root:

```bash
cd /path/to/your-app
./.claude/scripts/sync-all.sh
```

---

## Related Commands

- `/help sync-framework` — detailed `.claude` framework sync guidance
- `/analyze-codebase` — audit framework structure and completeness
- `/verify-quality` — full quality gate including framework validation
