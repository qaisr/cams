#!/bin/bash

###############################################################################
# sync-all.sh — Orchestrate all framework sync operations
#
# Syncs prompts to multiple locations:
#   - .vscode/ppcc-framework/prompts/   (VS Code Chat)
#   - .github/prompts/                 (GitHub Copilot)
#
# SAFETY: This script ONLY READS from .claude/ and WRITES to other areas.
# Never modify, delete, or overwrite anything in .claude/ folder.
# .claude/ is the source of truth and must remain read-only.
#
# Usage: ./.claude/scripts/sync-all.sh [--check] [--quiet]
#   --check  : Check what needs syncing without making changes
#   --quiet  : Suppress output
#
# Exit codes:
#   0 = All synced
#   1 = Errors occurred
#   2 = Changes needed (in --check mode)
###############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
CHECK_MODE="${1:-}"
QUIET_MODE="${2:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
  if [[ -z "$QUIET_MODE" ]]; then
    echo -e "${GREEN}✓${NC} $1"
  fi
}

warn() {
  if [[ -z "$QUIET_MODE" ]]; then
    echo -e "${YELLOW}⚠${NC} $1"
  fi
}

error() {
  if [[ -z "$QUIET_MODE" ]]; then
    echo -e "${RED}✗${NC} ERROR: $1"
  fi
}

cd "$PROJECT_ROOT"

# Track overall status
CHANGES_NEEDED=0
ERRORS=0

# Sync 1: Command wrappers
log "Syncing command wrappers (VS Code + GitHub)..."
if node "$SCRIPT_DIR/sync-prompts.js" $CHECK_MODE $QUIET_MODE; then
  :
else
  EXIT_CODE=$?
  if [[ $EXIT_CODE -eq 2 ]]; then
    CHANGES_NEEDED=$((CHANGES_NEEDED + 1))
  else
    ERRORS=$((ERRORS + 1))
    error "Failed to sync VS Code prompts (exit code: $EXIT_CODE)"
  fi
fi

# Summary
echo ""
if [[ $ERRORS -gt 0 ]]; then
  error "Sync completed with $ERRORS error(s)"
  exit 1
elif [[ $CHANGES_NEEDED -gt 0 && -n "$CHECK_MODE" ]]; then
  warn "Sync check: $CHANGES_NEEDED area(s) need updates"
  exit 2
else
  log "All framework areas in sync"
  exit 0
fi
