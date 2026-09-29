# Framework Sync Scripts

## Overview

Scripts in this directory maintain synchronization between the framework source
(`.claude/`) and dependent framework areas (`.vscode/`, `.github/`, etc.).

**Sync Destinations:**

- `.vscode/ppcc-framework/prompts/` — VS Code Chat integration
- `.github/prompts/` — GitHub Copilot integration
- `.vscode/ppcc-framework/commands/` — VS Code command wrappers
  (`.instructions.md`)

## 🔒 CRITICAL SAFETY RULES

**`.claude/` folder is the single source of truth and is READ-ONLY.**

- ✅ Scripts READ FROM `.claude/commands/`, `.claude/agents/`,
  `.claude/workflows/`, etc.
- ✅ Scripts WRITE TO `.vscode/ppcc-framework/prompts/`, `.github/`, root-level
  docs, etc.
- ❌ **NEVER modify, delete, or overwrite anything IN `.claude/` folder**
- ❌ **NEVER use `.claude/` as a write target**

If a sync operation needs to write back into `.claude/`, that is a sign the sync
logic is incorrect. Stop and review.

## Scripts

### `sync-prompts.js`

Generates wrapper files from canonical command definitions.

```bash
node .claude/scripts/sync-prompts.js        # Sync + apply changes
node .claude/scripts/sync-prompts.js --check  # Check only (no changes)
```

**Flow**: `.claude/commands/*.md` →

- `.vscode/ppcc-framework/prompts/*.prompt.md` (wrapper to `.claude/commands/*`)
- `.github/prompts/*.prompt.md` (wrapper to VS Code prompt wrapper)
- `.vscode/ppcc-framework/commands/*.instructions.md` (wrapper to VS Code prompt
  wrapper)

The command body is not copied; wrappers stay thin and stable.

### `sync-all.sh`

Orchestration script that runs all sync operations.

```bash
./.claude/scripts/sync-all.sh               # Execute all syncs
./.claude/scripts/sync-all.sh --check       # Check mode (exit 0/2)
./.claude/scripts/sync-all.sh --quiet       # Minimal output
```

**Exit codes**:

- `0` = Success (already synced or all changes applied)
- `1` = Error during execution
- `2` = Changes needed (in `--check` mode)

### Other Scripts

- `infra-setup.sh` — Checks and auto-fixes the local development environment
  (run via /infra-setup)
- `pre-commit-quality-check.sh` — Pre-commit quality gates
- `verify-quality.sh` — Comprehensive quality verification
- `debug-backend.sh` — Backend debugging utilities

## Adding New Sync Scripts

When adding new sync operations:

1. **Clearly document direction**: Comment exactly which folders are read and
   which are written
2. **Add safety check**: If target directory is `.claude/`, return error and
   stop
3. **Test in check mode first**: Run with `--check` flag to verify before
   applying changes
4. **Follow naming convention**: `sync-<target>.js` or `sync-<target>.sh`

Example check:

```javascript
if (dstDir.includes('.claude')) {
  error(
    'ERROR: Cannot write to .claude/ folder — source of truth is read-only',
  );
  process.exit(1);
}
```

## Troubleshooting

| Issue                     | Solution                                                  |
| ------------------------- | --------------------------------------------------------- |
| Script not found          | Run from workspace root: `./.claude/scripts/sync-all.sh`  |
| Permission denied         | `chmod +x .claude/scripts/sync-all.sh`                    |
| Node not found            | Ensure Node.js is installed: `which node`                 |
| `.claude/` files modified | Do NOT commit. Restore from git. Investigate sync script. |

## Related Commands

- `/sync-claude-copilot` — Interactive command for running sync operations
- `/sync-framework` — Sync codebase alignment with framework
