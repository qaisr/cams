---
description: Read-only audit of the entire `.claude/` framework for broken references, orphan files, missing Token Optimization, stale patterns, and reference-manifest drift. Produces a remediation report — never modifies files.
agent: ai-strategist
subtask: true
---

# Framework Health Check

Comprehensive, read-only audit of the `.claude/` framework. Verifies that every
agent, command, workflow, standard, pattern, and template is consistent,
cross-linked, and aligned with the current technology stack.

## Activation

Load when:
- After large framework changes (new agents/standards/patterns added)
- Before adopting the framework on a new project (`/initialize` follow-up)
- Periodic quarterly health check
- Suspected drift between `.claude/CLAUDE.md` and on-disk files

Unload after the report is produced. **Never modifies files.** Use
`/sync-framework` or hand-edit the issues from the report to remediate.

## Inputs

No arguments required. Operates on the workspace `.claude/` folder.

## Audit Checklist

### 1. Reference Integrity
- All `@.claude/...` and `.claude/...` paths resolve to existing files
- No broken cross-references in agents, workflows, standards, patterns
- `requires:` blocks in command frontmatter point to real files

### 2. Reference Manifest Accuracy
- Every command file has an entry in `.claude/docs/commands-reference.md`
- Every workflow has an entry in `.claude/docs/workflows-reference.md`
- Every pattern has an entry in `.claude/docs/patterns-reference.md`
- Every template has an entry in `.claude/docs/templates-reference.md`
- Conversely, every entry in those references has a corresponding file

### 3. Token Optimization Coverage
- Every agent declares Load/Unload triggers
- Every workflow declares Token Optimization or Hand-off section
- Every standard ≥ 60 lines declares Load/Unload guidance
- Every pattern has a one-line Activation hint at the top

### 4. Stack Alignment
- Tech stack declared in `.claude/CLAUDE.md` matches dependencies in `package.json`
- No agent/standard references libraries no longer used
- Code generation pipeline references match `scripts/generate.ts`

### 5. Redundancy Detection
- No two files cover the same topic without a clear separation note
- Concise + detailed templates have explicit "use which when" guidance

### 6. Orphan Detection
- No file exists on disk that no other file references
- No reference points to a non-existent file

### 7. Coverage Gaps
- Architecture diagrams, user flows, decision tables, i18n covered
- OWASP Top 10, CORS, CSP, rate limiting covered
- Error handling, success metrics, observability covered

## Output Format

Produce `.claude/logs/framework-health-YYYY-MM-DD.md` with these sections:

```markdown
# Framework Health Report — YYYY-MM-DD

## Summary
- Total files: N
- Critical issues: N
- High-priority issues: N
- Medium-priority issues: N

## 1. Broken References
[file:line → broken target]

## 2. Manifest Drift
- Files on disk but missing from reference: [...]
- Reference entries pointing to missing files: [...]

## 3. Missing Token Optimization
[grouped by directory]

## 4. Redundancy / Overlap Candidates
[file pairs with overlap analysis]

## 5. Orphan Files
[files referenced nowhere]

## 6. Coverage Gaps
[topics not covered]

## Recommended Remediation (Priority Order)
[actionable list]
```

## Quality Gate

- [ ] Report generated under `.claude/logs/`
- [ ] No file modifications made (verify `git status` before/after)
- [ ] Recommendations are concrete (file paths + actions, not vague)

## Token Optimization

- Load only `.claude/agents/ai-strategist.md` for this command.
- Unload all other agents and standards.
- Read manifests and sample files; never load the entire framework into context.
- Hand off to user for remediation; this command does NOT auto-fix.

## Cross-References

- Agent: `@.claude/agents/ai-strategist.md`
- Sync command: `@.claude/commands/sync-framework.md`
- Migration command: `@.claude/commands/migrate-claude-framework.md`
- Framework sync workflow: `@.claude/workflows/framework-sync.md`
