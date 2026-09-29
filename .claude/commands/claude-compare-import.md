---
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# Command: /claude-compare-import

## Purpose
Compare the local `.claude` framework against an external `.claude` framework and enhance the local `.claude` framework.

It using a **two-track approach**:

- **Track 1 — Direct Apply**: Simple, safe enhancements (new standalone files, additive
  improvements, cross-reference updates, stack-agnostic additions) are applied immediately
  to the local `.claude/` and recorded in `./claude-enhancements/APPLIED.md`.
- **Track 2 — Mega-Prompts**: Complex changes (stack-specific code, multi-file coordinated
  rewrites, infrastructure/codegen changes, large additions requiring validation) are written
  as independently-runnable prompts to `./claude-enhancements/`.

**The external framework is NEVER modified. Only the local `.claude/` is changed.**

## Usage
```
/claude-compare-import <external-path> [focus-area]
```

### Arguments
| Argument | Required | Description |
|---|---|---|
| `<external-path>` | ✅ | Absolute or relative path to the external `.claude` folder |
| `[focus-area]` | ❌ | Constrain comparison scope (see Focus Areas below) |

### Focus Areas (optional)
If omitted, all areas are compared. Accepted values:
```
agents | patterns | standards | workflows | templates | commands | docs | all
```
Multiple values comma-separated: `agents,standards`

---

## Execution Protocol

### Phase 0 — Initialization & Validation

```
BEFORE DOING ANYTHING ELSE:
1. Resolve <external-path> to an absolute path.
2. Verify the path exists and contains a CLAUDE.md or at least one of:
   agents/ | patterns/ | standards/ | workflows/ | templates/ | commands/
3. If path is invalid → abort with clear error message.
4. Read LOCAL  → .claude/CLAUDE.md  (if exists)
5. Read REMOTE → <external-path>/CLAUDE.md  (if exists)
6. Parse both CLAUDE.md files to extract:
   - Stack / tech choices
   - Naming conventions
   - Workflow philosophy
   - Any explicit exclusions or constraints
7. Create ./claude-enhancements/ directory if it does not exist.
8. Write ./claude-enhancements/SESSION.md with run metadata (timestamp, args, CLAUDE.md summaries).
```

**Compatibility Gate** — before any action, verify:
- External item does NOT contradict a hard constraint in local `CLAUDE.md`
- Tech stack references are compatible (e.g., don't import Vue patterns into a Next.js project)
- If incompatible → flag as `⚠️ SKIP – incompatible stack` in the index; skip entirely

---

### Phase 1 — Inventory Both Frameworks

Build a structured inventory:

```
LOCAL_INVENTORY  = map of { category → [filename, first-100-chars-of-content] }
REMOTE_INVENTORY = map of { category → [filename, first-100-chars-of-content] }
```

Categories to scan:
```
agents/ | patterns/ | standards/ | workflows/ | templates/ | commands/ | docs/
```

Token-efficient scanning strategy:
- Read filenames first → classify by category
- Read only first ~100 chars of each file to extract purpose/title
- Do NOT fully read every file yet — defer deep reads to Phase 2

---

### Phase 2 — Gap & Delta Analysis

For each category (filtered by `[focus-area]` if provided):

#### 2a. Net-New Items
Files that exist in REMOTE but NOT in LOCAL.
→ Classify as `NEW` — check stack compatibility then route to Track 1 or Track 2

#### 2b. Potentially Enhanced Items
Files that exist in BOTH frameworks with same/similar name.
→ Read both versions fully
→ Compare for:
  - Additional sections/rules the remote has that local lacks
  - Better examples, more concrete standards
  - Additional agents/roles not in local
  - Extra workflow steps
  - Additional templates or template fields
  - Security, observability, or quality additions
→ Classify as `ENHANCE` with a specific diff summary; route to Track 1 or Track 2

#### 2c. Conflicting Items
Files that exist in both but with contradictory approaches.
→ Classify as `CONFLICT` — flag for human decision; never auto-apply or generate a prompt
→ Document both approaches in CONFLICTS.md

#### 2d. Local-Only Items
Files only in LOCAL — record them; do not touch.
→ Classify as `LOCAL-ONLY` — no action

#### 2e. CLAUDE.md-Level Insights
Compare the two CLAUDE.md files for:
- Missing workflow steps in local
- Missing agent/standard references
- Better memory/token hygiene instructions in remote
→ Classify actionable items as `CLAUDE-ENHANCE`; route to Track 1 or Track 2

---

### Phase 3 — Classification: Direct Apply vs Mega-Prompt

For every `NEW`, `ENHANCE`, and `CLAUDE-ENHANCE` finding, assign a track:

#### Track 1 — DIRECT-APPLY criteria (ALL must hold)
- The change is purely additive — does not restructure or remove existing content
- No stack-specific code examples needed (or examples are language-agnostic markdown)
- Self-contained: does not require coordinated edits across 3+ files
- Effort: Small (< 50 lines) or Medium (50-200 lines) of new content
- Risk: Safe — no local naming convention conflicts

**Typical direct-apply candidates:**
- New standalone agent/pattern/standard/template/command/doc file with no stack conflicts
- Adding a new rule, section, or checklist item to an existing file (additive only)
- New entry in `CLAUDE.md` lazy-load table or agent roster
- New cross-reference between existing files
- Documentation improvements (clearer wording, better examples in existing format)
- New stack-agnostic checklist items or acceptance criteria

#### Track 2 — MEGA-PROMPT criteria (ANY one triggers)
- Contains stack-specific code examples requiring local stack adaptation
  (e.g., Express → Fastify, Vue → React, SQLAlchemy → Prisma, different auth provider)
- Requires coordinated changes across 3+ files with interdependencies
- Involves the code-generation pipeline (Prisma schema, Zod, OpenAPI, orval hooks)
- Infrastructure, CI/CD, or deployment configuration changes
- Large addition (200+ lines) with internal cross-references
- Risk: Review-needed — touches core local conventions or hard constraints
- Any `CONFLICT` classification → always goes to CONFLICTS.md, never Track 1 or Track 2

Score each finding:
```
IMPACT  = High | Medium | Low
EFFORT  = Small (< 50 lines) | Medium (50-200 lines) | Large (200+ lines)
RISK    = Safe | Review-needed | Conflicting
TRACK   = DIRECT-APPLY | MEGA-PROMPT | CONFLICT | SKIP
```

Group related Track 2 findings into logical mega-prompts (e.g., "all agent enhancements").
Never mix CONFLICT items into a mega-prompt.

---

### Phase 4 — Execute Track 1: Direct Application

**For each DIRECT-APPLY item (in impact order — High first):**

1. **New file**: Create `.claude/{category}/{filename}.md` with full content adapted from
   the external source (replace any stack references with local equivalents where obvious).
2. **Enhancement to existing file**: Edit `.claude/{path}` — add the new section/rule/entry
   without touching existing content. Use precise insertion point (e.g., "after line X" or
   "under section Y").
3. **CLAUDE.md entry**: Add the new line to the appropriate table/section in `.claude/CLAUDE.md`.

After applying each item:
- Record it in `./claude-enhancements/APPLIED.md` (see format below)
- Do NOT modify any file in `<external-path>/`

**Adaptation rules for direct-apply:**
- Replace framework-specific tool names with local equivalents if trivial
  (e.g., "Confluence" → comment it out as optional; "Slack" → keep as-is if generic)
- Preserve local naming conventions (file naming, heading style, checklist format)
- If adaptation is non-trivial → downgrade to Track 2 (mega-prompt) instead

#### APPLIED.md format
```markdown
# Directly Applied Enhancements
- **Run date**: {ISO timestamp}
- **External framework**: {external-path}

## Applied Changes
| # | Type | Local file | Change summary | Source file |
|---|---|---|---|---|
| 1 | NEW | .claude/agents/performance-engineer.md | Created new file | {ext}/agents/performance-engineer.md |
| 2 | ENHANCE | .claude/standards/api-standards.md | Added "Rate Limiting" section | {ext}/standards/api-standards.md |
| 3 | CLAUDE-ENHANCE | .claude/CLAUDE.md | Added 2 entries to lazy-load table | {ext}/CLAUDE.md |
| ... | | | | |

## Rollback Instructions
To undo any direct change:
- **NEW files**: delete `.claude/{path}`
- **ENHANCE edits**: restore the original section (diff shown below)

### Diffs for ENHANCE rollbacks
{For each ENHANCE: show the exact lines added so the user can revert if needed}
```

---

### Phase 5 — Execute Track 2: Generate Mega-Prompts

Generate a mega-prompt file for each Track 2 item.

#### Output folder structure
```
./claude-enhancements/
├── INDEX.md                          ← master map of all findings
├── SESSION.md                        ← run metadata
├── APPLIED.md                        ← record of all direct-apply changes
├── MP-001-<slug>.md                  ← mega-prompt 1 (complex changes only)
├── MP-002-<slug>.md                  ← mega-prompt 2
├── ...
└── CONFLICTS.md                      ← human-review items (if any conflicts found)
```

#### Mega-prompt naming
```
MP-{NNN}-{tier}-{category}-{slug}.md
e.g.:
MP-001-P1-patterns-aws-eventbridge-pattern.md
MP-002-P1-standards-enhance-api-standards-codegen.md
MP-003-P2-workflows-add-deployment-runbook.md
```

#### Priority tiers for mega-prompts

| Tier | Criteria |
|---|---|
| P1 | High impact + any effort (stack-specific or large) |
| P2 | Medium impact |
| P3 | High impact + Review-needed — include explicit review gates in prompt |
| P4 | Low impact — document in INDEX.md only; no prompt generated |

#### Every mega-prompt MUST contain these sections:

```markdown
# MP-{NNN}: {Title}

## Metadata
- **Priority**: P{1|2|3}
- **Category**: {agents|patterns|standards|workflows|templates|commands|docs|claude-md}
- **Effort**: {Small|Medium|Large}
- **Risk**: {Safe|Review-needed}
- **Source**: {external-path}/{filename}
- **Generated**: {ISO timestamp}
- **Why mega-prompt (not direct-apply)**: {one-line reason — e.g., "contains Prisma-specific
  code requiring local schema alignment"}

## Why This Enhancement
{2-4 sentences explaining the gap this fills and the value it adds.}

## Pre-flight Checks
Before running this prompt, verify:
- [ ] {specific check 1}
- [ ] No merge conflicts with: {list related local files}

## Compatibility Notes
{Stack alignment statement. Flag any adaptation required.}

## Prompt to Execute
> Copy everything between START and END markers and run as a new Claude prompt
> in the root of your project.

---PROMPT-START---

You are a ClaudeCode framework architect enhancing the local `.claude/` framework.

### Context
{Summarize the relevant local file content}

### Enhancement Source
{Summarize the relevant external file content}

### Your Task
{Precise, step-by-step instructions:}
1. Create/edit `.claude/{category}/{filename}.md`:
   [full content or exact change]
2. Update `.claude/CLAUDE.md` if required — add under section X:
   [exact line]
3. Validate: {specific condition to check}

### Constraints
- Do NOT modify any file not listed above.
- Do NOT remove existing content unless explicitly stated.
- Preserve local naming conventions as defined in `.claude/CLAUDE.md`.
- Output a checklist confirming each file was written.

### Acceptance Criteria
- [ ] {criterion 1}
- [ ] {criterion 2}

---PROMPT-END---

## Rollback
{delete file X | restore section Y in file Z}
```

---

### Phase 6 — Generate INDEX.md

```markdown
# Framework Comparison Index
- **Local framework**: .claude/
- **External framework**: {external-path}
- **Focus area**: {all | specified}
- **Run date**: {ISO timestamp}
- **Local CLAUDE.md stack**: {one-line summary}
- **External CLAUDE.md stack**: {one-line summary}

## Summary
| Category | NEW | ENHANCE | CONFLICT | LOCAL-ONLY | Direct-Applied | Mega-Prompts |
|---|---|---|---|---|---|---|
| agents | N | N | N | N | N | N |
| patterns | | | | | | |
| standards | | | | | | |
| workflows | | | | | | |
| templates | | | | | | |
| commands | | | | | | |
| docs | | | | | | |
| CLAUDE.md | | | | | | |
| **TOTAL** | | | | | | |

## Directly Applied Changes
See `APPLIED.md` for full details and rollback instructions.
| # | Local file | Change | Source |
|---|---|---|---|
| 1 | .claude/agents/... | Created new file | {ext}/... |
| 2 | .claude/standards/... | Added section | {ext}/... |

## Mega-Prompts (run in priority order)
| # | File | Title | Priority | Category | Effort | Risk |
|---|---|---|---|---|---|---|
| 1 | MP-001-... | ... | P1 | patterns | Large | Safe |
| 2 | MP-002-... | ... | P2 | standards | Medium | Review-needed |

## Conflicts Requiring Human Review
| Item | Local file | External file | Nature of conflict |
|---|---|---|---|
| ... | | | |

## Skipped Items
| Item | Reason |
|---|---|
| ... | Incompatible stack: {detail} |
| ... | Low impact: {detail} |

## Recommended Execution Order
{Ordered list of mega-prompt files with rationale for sequence}
```

---

### Phase 7 — Conflict Report (if any)

If conflicts were detected, write `CONFLICTS.md`:

```markdown
# Conflicts Requiring Human Decision

## CONFLICT-{N}: {title}
- **Local file**: .claude/{path}
- **External file**: {external-path}/{path}
- **Nature**: {e.g., "different error-handling philosophy — local uses Result type, remote uses exceptions"}
- **Local approach**: ...
- **External approach**: ...
- **Recommendation**: {adopt local | adopt remote | merge manually | keep both}
- **To resolve**: {specific instruction once human decides}
```

---

## Context & Token Management

```
READ STRATEGY:
1. Filenames + first 100 chars  → Phase 1 (always)
2. Full file read               → Phase 2 only for ENHANCE candidates
3. Skip full reads for          → LOCAL-ONLY and confirmed-incompatible items
4. CLAUDE.md files              → always read fully (small and critical)

UNLOAD AFTER USE:
- After Phase 1: release raw directory listings
- After Phase 2 diff for a file pair: release full file contents; carry only diff summary
- After Phase 4 (direct apply): release full external file contents
- Carry forward only: diff summaries, track assignments, applied-change log, generated prompt text
```

---

## Error Handling

| Condition | Behavior |
|---|---|
| `<external-path>` does not exist | Abort: `ERROR: Path not found: {path}` |
| External path has no `.claude` structure | Warn; ask user to confirm before continuing |
| Local `CLAUDE.md` missing | Continue; alignment checks are best-effort |
| External file is binary or unreadable | Skip; log in INDEX.md as `UNREADABLE` |
| `claude-enhancements/` cannot be created | Abort with permission error |
| Direct-apply adaptation is non-trivial | Downgrade item to Track 2 (mega-prompt) |
| Mega-prompt would exceed ~4000 tokens | Split into MP-NNN-a and MP-NNN-b with sequencing note |

---

## Examples

### Example 1 — Full comparison
```
/claude-compare-import ../project-confluence/.claude
```
All categories. Simple enhancements applied directly; complex ones become mega-prompts.

### Example 2 — Focused agents + standards
```
/claude-compare-import ../project-confluence/.claude agents,standards
```
Only `agents/` and `standards/` scanned.

### Example 3 — Patterns from AWS-focused project
```
/claude-compare-import ../project-aws/.claude patterns
```
New AWS service patterns adopted directly if stack-compatible; stack-specific code → mega-prompt.

---

## Execution Checklist (Claude self-verify before completing)

```
[ ] SESSION.md written with correct metadata
[ ] Both CLAUDE.md files read and summarized in SESSION.md
[ ] Every REMOTE item classified: DIRECT-APPLY | MEGA-PROMPT | CONFLICT | SKIP
[ ] All DIRECT-APPLY changes applied to local .claude/ and recorded in APPLIED.md
[ ] APPLIED.md includes rollback diffs for every ENHANCE edit
[ ] Every mega-prompt has all required sections and is independently runnable
[ ] INDEX.md summary counts match APPLIED.md entries + MP-*.md files
[ ] CONFLICTS.md written if any conflicts found
[ ] No file in <external-path>/ was modified (only local .claude/ changed)
[ ] claude-enhancements/ contains only: INDEX.md, SESSION.md, APPLIED.md, MP-*.md, CONFLICTS.md
```
