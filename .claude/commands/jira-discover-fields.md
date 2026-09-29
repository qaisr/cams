---
description: >
  Discover JIRA custom-field ids and the epic-link strategy for the configured project by
  enumerating issue-type field metadata via the Atlassian MCP, then write the resolved values
  into the `fields:` and `epicLinkStrategy` blocks of `.claude/config/jira-sync.config.yml`.
  One-off; feeds the sprint parser (§6.3a) and the create path (§8.1). Never hand-guess a
  customfield id — discovery writes the real ones.
agent: build
subtask: true
model: @bedrock-eus1/us.anthropic.claude-haiku-4-5-20251001-v1:0
reasoning_effort: low
---

# Discover JIRA Fields

## Input

`$ARGUMENTS` — optional project key. Defaults to the `project:` in
`.claude/config/jira-sync.config.yml` (EON).

## Why this exists (plan 01a §4.2, §6.3a)

JIRA exposes sprint, story points, epic-link, and rank as `customfield_*` ids that differ per
site. The converter (`scripts/jira/converter.ts`) parses the **sprint** field by its discovered
**shape** (`object` for the modern Cloud API vs the legacy `greenhopper` string blob). This command
resolves those ids **from live JIRA** and records them so nothing downstream hard-codes an id.

It also RE-CONFIRMS `epicLinkStrategy` (`parent` vs `epic-link`) — EON is company-managed
(`simplified:false`) yet a live check showed `parent = EON-21` returns children directly, so the
working strategy is `parent`. If discovery disagrees, it rewrites the flag and says why.

## Contract

The MCP tools this command calls are documented in `scripts/jira/mcp-client.ts` → `MCP_CONTRACT`:
`discoverFields` → `mcp__atlassian__getJiraIssueTypeMetaWithFields`, `projectMeta` →
`mcp__atlassian__getVisibleJiraProjects`. Connection facts (site, cloudId, project) come from
`CONNECTION` in that file — never hand-type the cloudId.

## Process

### Step 1 — Resolve project + type

1. Read `project`, `site`, `cloudId` from `jira-sync.config.yml` (or `$ARGUMENTS` for the project).
2. Call `mcp__atlassian__getVisibleJiraProjects` `{ cloudId, searchString: <project>, expandIssueTypes: true }`.
   - Record `projectTypeKey` and `simplified`. `simplified:true` ⇒ team-managed (`parent` strategy);
     `simplified:false` ⇒ company-managed (usually `epic-link`, but confirm below).
   - Capture the issue-type ids present (Epic, Story, Task, Bug, plus any project-specific types such
     as Dependency on EON).

### Step 2 — Enumerate custom fields

For a representative **Story** issue-type id (and **Epic** id), call
`mcp__atlassian__getJiraIssueTypeMetaWithFields`
`{ cloudId, projectIdOrKey: <project>, issueTypeId, requiredFieldsOnly: false }`.

From the returned field metadata, match by **name and schema**, not by a guessed id:

| Target | Match heuristic | Records |
|---|---|---|
| `fields.sprint` | field whose `schema.custom` contains `gh-sprint` **or** name = "Sprint" | `id` + `shape` |
| `fields.storyPoints` | name ∈ {"Story Points", "Story point estimate"} | `id` |
| `fields.epicLink` | `schema.custom` contains `epic-link` (name "Epic Link") | `id` |
| `fields.rank` | `schema.custom` contains `gh-lexo-rank` (name "Rank") | `id` |

**Sprint shape detection (§6.3a):** inspect a live issue's sprint value if metadata is ambiguous —
if it is an array of objects with `{ id, name, state }`, shape = `object`; if it is an array of
strings like `com.atlassian.greenhopper.service.sprint.Sprint@…[name=…,state=…]`, shape =
`greenhopper`. Record whichever is observed. The converter's `parseSprint` handles both.

### Step 3 — Confirm epic-link strategy

- Default from Step 1 (`simplified` flag).
- Then a **live tie-breaker**: run `mcp__atlassian__searchJiraIssuesUsingJql`
  `{ cloudId, jql: "project = <project> AND parent = <a known epic>", maxResults: 1 }`.
  If it returns ≥1 child, `parent` works → set `epicLinkStrategy: parent` regardless of `simplified`.
  If it errors or returns nothing while `"Epic Link" = <epic>` does, set `epic-link`.
- For EON specifically, the expected outcome is `parent` (confirmed live). If discovery yields
  `epic-link`, STOP and report — it contradicts the grounding and the scope JQL must be regenerated.

### Step 4 — Write config

Edit `.claude/config/jira-sync.config.yml` **in place**, filling only the discovered values:

```yaml
epicLinkStrategy: parent   # or epic-link, per Step 3
fields:
  sprint:
    id: customfield_XXXXX
    shape: object          # or greenhopper
  storyPoints:
    id: customfield_XXXXX
  epicLink:
    id: customfield_XXXXX  # null when epicLinkStrategy != epic-link
  rank:
    id: customfield_XXXXX
```

Leave `board:`, `epics:`, `scope:` untouched — those are owned by `/jira-init`.

### Step 5 — Report

Print a table of every field resolved (target → name → id → shape), the confirmed
`epicLinkStrategy` with its evidence (the JQL that succeeded), and the issue-type id map. End with:
"Fields written to `jira-sync.config.yml`. Re-run after a JIRA field re-configuration."

## Guardrails

- **Never** invent a customfield id. If a target field is not found, write `null` and flag it.
- **No secrets** are read or written — auth is brokered by the MCP session.
- This command **only** edits the `fields:` and `epicLinkStrategy:` lines of the config; it writes
  nothing under `jira/`.
