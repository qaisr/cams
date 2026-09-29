---
name: sync-project-structure
description: Sync .claude/project-structure.yaml and .claude/project-structure.md to reflect the actual current state of all project directories. Run after adding, removing, or reorganising files/folders.
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# Sync Project Structure

Keeps the two canonical project structure files in sync with reality:

- `.claude/project-structure.yaml` — machine-readable structure (used by agents and tooling)
- `.claude/project-structure.md` — human-readable annotated tree (used in docs and prompts)

**Source of truth**: the actual filesystem. Both files are outputs — never edit them manually between syncs.

## When to Run

- After adding a new feature, domain area, or module
- After reorganising directories or renaming folders
- After adding new resource files (migrations, config, etc.)
- Before committing framework or documentation changes

---

## Step 1 — Scan Actual Directory Structure

Walk the following directories and gather their actual contents. Ignore generated/transient folders.

### Frontend — `apps/web/`

Scan and note actual structure of:

```
apps/web/app/                   # all route groups, pages, layouts, API routes
apps/web/src/components/        # ui/, features/*, auth/, layout/
apps/web/src/hooks/             # all *.ts hook files
apps/web/src/lib/               # api/, api-client.ts, auth/, navigation/
apps/web/src/types/             # all *.ts type files
apps/web/mocks/                 # browser.ts, handlers.ts, handlers/, fixtures/
apps/web/config/                # config files
```

**Ignore**: `node_modules/`, `.next/`, `.swc/`, `.turbo/`, `coverage/`, `playwright-report/`, `test-results/`, `.DS_Store`

### Backend — `apps/api/`

Scan and note actual structure of:

```
apps/api/src/                                # modules/, auth/, common/, openapi/
apps/api/src/__tests__/                      # integration tests
apps/api/config/                             # api config and lint/test settings
```

**Ignore**: `dist/`, `coverage/`, `.turbo/`, `.DS_Store`

### Packages — `packages/`

Scan:

```
packages/api-spec/          # generated OpenAPI artifacts
packages/shared-config/
```

**Ignore**: `node_modules/`, `dist/`, `generated/` contents (too volatile — represent as a folder entry only)

### Infrastructure — `infra/`

Scan: `infra/bin/`, `infra/lib/`, `infra/cdk.json`

### Docker — `docker/`

Scan: top-level compose files and `localstack/init-scripts/`

### Framework — `.claude/`

Scan top-level subdirectories only: `agents/`, `commands/`, `standards/`, `workflows/`, `templates/`, `patterns/`, `docs/`

---

## Step 2 — Diff Against Existing Files

Compare the scanned structure against what is currently in both files.

Identify:
1. **New** directories or files not yet listed
2. **Removed** entries that no longer exist on disk
3. **Renamed** paths
4. **Description gaps** — entries listed without a description that now have enough context to annotate

Report findings as a brief summary before making changes:

```
📂 Project Structure Sync

New entries found:   N
Obsolete entries:    N
Renamed paths:       N
Description gaps:    N

Proceed? (yes / no)
```

**[WAIT FOR USER CONFIRMATION]**

---

## Step 3 — Update `.claude/project-structure.yaml`

Apply all changes to the YAML file:

- Add new directories/files as nested keys with `~` value (no description yet) or a description if inferrable from context
- Remove keys for deleted paths
- Update paths for renamed items
- Add `description:` entries where context is clear
- Keep the existing YAML structure and formatting conventions:
  - Directories: nested objects
  - Files with no metadata: `filename: ~`
  - Files/dirs with descriptions: `filename: Description text` or nested with `description:` key
  - TypeScript module paths: use folder notation `apps/api/src/modules/order/`

---

## Step 4 — Update `.claude/project-structure.md`

Apply the same changes to the Markdown tree:

- Add new entries at the correct indentation level in the ASCII tree
- Remove obsolete entries
- Add inline comments (` # description`) where context is available
- Preserve the existing formatting conventions:
  - Directories end with `/`
  - Inline annotations use `# comment` format
  - Files/dirs with no annotation have no trailing comment
  - `~` entries in YAML become bare filename lines in Markdown

---

## Step 5 — Verify Consistency

After both files are updated, do a final cross-check:

1. Every entry in the YAML has a corresponding entry in the Markdown
2. Every entry in the Markdown has a corresponding entry in the YAML
3. Descriptions are consistent between both files
4. No stale entries remain in either file

Report outcome:

```
✅ project-structure.yaml — updated (N additions, N removals)
✅ project-structure.md   — updated (N additions, N removals)

Both files are now consistent with the current filesystem.
```

---

## Notes

- Do **not** list every file inside `generated/` directories — represent them as folder placeholders only
- Do **not** list test fixture data files individually — represent as `fixtures/` directory
- Do **not** scan `node_modules/`, `target/`, `.next/`, `coverage/`, or other build/transient outputs
- Keep descriptions concise (one phrase) — not full sentences
- When a new domain area is added (e.g. a new feature under `src/components/features/`), add it to both the feature components list **and** the hooks list if corresponding hooks exist
