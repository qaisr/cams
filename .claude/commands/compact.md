---
description: Compact active context by summarizing decisions, risks, and next actions, then unload non-essential references.
agent: plan
subtask: false
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# Compact

## Purpose
Reduce context size during long multi-phase sessions without losing delivery-critical state.

## Process

1. Preserve:
- Confirmed decisions
- Open risks and mitigations
- Completed actions
- Next 3 concrete steps

2. Drop:
- Repetitive exploration output
- Obsolete alternative options
- Inactive standards/agents not needed for next step

3. Handoff summary format:
- Scope now
- What changed
- Blockers
- Immediate next action

## Output
A concise context handoff note for the next step.

## Cross-References
- `@.claude/docs/context-optimization.md`
- `/implement-best-practices`
- `/pre-release-check`
