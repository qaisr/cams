#!/usr/bin/env tsx
/*
 * mcp-client.ts — the CONTRACT between the /jira command family and the
 * Atlassian MCP server (plan 01a §4, §6.2, §6.3).
 *
 * IMPORTANT: this file does NOT call the MCP itself. The Atlassian tools
 * (mcp__atlassian__*) are invoked by Claude while executing a /jira command —
 * there is no HTTP client here and no secret is ever read (auth is brokered by
 * the MCP session; R: never hardcode credentials). What this module provides is:
 *
 *   1. The pinned connection facts (site, cloudId, project) in ONE place, so a
 *      command never hand-types the cloudId.
 *   2. JQL builders derived from `epicLinkStrategy` — the three saved scope
 *      queries (§6.2) plus the per-epic children query used by `/jira pull`.
 *   3. A typed description of which MCP tool each command step maps to, so the
 *      command Markdown and this code cannot drift.
 *
 * Commands read these builders as instruction context (like jira-sync.config.yml)
 * and pass the resulting JQL / cloudId straight into the mcp__atlassian__* call.
 * Self-check:  tsx scripts/jira/mcp-client.ts --selftest
 */

// ---- pinned connection facts (mirror of jira-sync.config.yml header) --------

export const CONNECTION = {
  project: 'EON',
  site: 'commbank.atlassian.net',
  cloudId: '998e78d7-2a66-4fc0-809b-b43b4232d4b8',
} as const;

export type EpicLinkStrategy = 'parent' | 'epic-link';

// ---- JQL builders (§6.2, §6.3) ----------------------------------------------

/** Escape a JQL string literal (single quotes are the JQL string delimiter). */
function jqlStr(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * The "epics and their children" clause, templated from epicLinkStrategy.
 *   - parent:     issuetype = Epic OR parent in (EON-21, …)
 *   - epic-link:  issuetype = Epic OR "Epic Link" in (EON-21, …)
 * EON is confirmed `parent` (see config), but the epic-link branch keeps the
 * converter/commands honest for company-managed projects that need it.
 */
export function epicsAndChildrenJql(
  project: string,
  epicKeys: string[],
  strategy: EpicLinkStrategy,
): string {
  const keys = epicKeys.join(', ');
  const childClause = strategy === 'parent' ? `parent in (${keys})` : `"Epic Link" in (${keys})`;
  const epicOrChildren = epicKeys.length
    ? `(issuetype = Epic OR ${childClause})`
    : `issuetype = Epic`;
  return `project = ${project} AND ${epicOrChildren} ORDER BY updated DESC`;
}

/** Children of a SINGLE epic — the scoped query behind `/jira pull <EPIC>`. */
export function epicChildrenJql(
  project: string,
  epicKey: string,
  strategy: EpicLinkStrategy,
): string {
  const clause = strategy === 'parent' ? `parent = ${epicKey}` : `"Epic Link" = ${epicKey}`;
  return `project = ${project} AND ${clause} ORDER BY rank ASC`;
}

/** Backlog: not-Done and not in any sprint (§6.2). */
export function backlogJql(project: string): string {
  return `project = ${project} AND statusCategory != Done AND sprint is EMPTY ORDER BY priority DESC, rank ASC`;
}

/** Current/open sprint(s) for the project (§6.2). Board-scoped resolution of
 *  "the" current sprint happens in the command using the discovered board. */
export function currentSprintJql(project: string): string {
  return `project = ${project} AND sprint in openSprints() ORDER BY rank ASC`;
}

/** A named-sprint query (jira-helper `sprint <name>`). */
export function sprintByNameJql(project: string, sprintName: string): string {
  return `project = ${project} AND sprint = ${jqlStr(sprintName)} ORDER BY rank ASC`;
}

/** The union of the three saved scope queries `/jira-sync` walks (§6.2). */
export function scopeQueries(
  project: string,
  epicKeys: string[],
  strategy: EpicLinkStrategy,
): { epics_and_children: string; backlog: string; current_sprint: string } {
  return {
    epics_and_children: epicsAndChildrenJql(project, epicKeys, strategy),
    backlog: backlogJql(project),
    current_sprint: currentSprintJql(project),
  };
}

// ---- MCP tool contract ------------------------------------------------------
// Documents which Atlassian MCP tool each command step invokes. Claude calls
// these tools directly; this map is the single source of "what talks to what",
// so a command's prose and its actual tool usage stay aligned.

export interface McpStep {
  tool: string;
  purpose: string;
  args: string;
}

export const MCP_CONTRACT: Record<string, McpStep> = {
  resolveCloudId: {
    tool: 'mcp__atlassian__getAccessibleAtlassianResources',
    purpose: 'Confirm/resolve cloudId for the site at /jira-init (pinned thereafter).',
    args: 'none → returns resources incl. { id: cloudId, url: site }',
  },
  whoAmI: {
    tool: 'mcp__atlassian__atlassianUserInfo',
    purpose: 'Identify the authenticated user for people.json seeding at /jira-init.',
    args: 'none',
  },
  discoverFields: {
    tool: 'mcp__atlassian__getJiraIssueTypeMetaWithFields',
    purpose:
      '/jira-discover-fields: enumerate customfield_* to fill fields.{sprint,storyPoints,epicLink,rank}.',
    args: '{ cloudId, projectIdOrKey: EON, issueTypeId, requiredFieldsOnly: false }',
  },
  projectMeta: {
    tool: 'mcp__atlassian__getVisibleJiraProjects',
    purpose: 'Detect project type (simplified true/false) → confirm epicLinkStrategy.',
    args: '{ cloudId, searchString: EON, expandIssueTypes: true }',
  },
  search: {
    tool: 'mcp__atlassian__searchJiraIssuesUsingJql',
    purpose: 'Run the scope queries / children query; page via nextPageToken.',
    args: '{ cloudId, jql, fields: [...discovered], maxResults: 100, nextPageToken? }',
  },
  getIssue: {
    tool: 'mcp__atlassian__getJiraIssue',
    purpose:
      'Full single-issue pull (description ADF + comments) for /jira-add-issue and epic body.',
    args: '{ cloudId, issueIdOrKey, fields: ["*all"] , expand: "renderedFields" }',
  },
  // ---- write-back (Phase 5) — human-gated, dry-run first --------------------
  editIssue: {
    tool: 'mcp__atlassian__editJiraIssue',
    purpose:
      'Feature A: push the pushable slice to the description field after APPROVE + version re-check.',
    args: '{ cloudId, issueIdOrKey, fields: { description }, contentFormat: "markdown" }',
  },
  createIssue: {
    tool: 'mcp__atlassian__createJiraIssue',
    purpose: 'Feature B: create a new issue under a CONFIRMED parent (never auto-place).',
    args: '{ cloudId, projectKey: EON, issueTypeName, summary, description, parent }',
  },
  addComment: {
    tool: 'mcp__atlassian__addCommentToJiraIssue',
    purpose: 'Write the [CANS-SYNC] audit breadcrumb (audit only — NOT the idempotency key).',
    args: '{ cloudId, issueIdOrKey, commentBody }',
  },
  getTransitions: {
    tool: 'mcp__atlassian__getTransitionsForJiraIssue',
    purpose: 'Resolve a status transition id when a write-back changes state (rare; confirmed).',
    args: '{ cloudId, issueIdOrKey }',
  },
} as const;

// ---- self-test --------------------------------------------------------------

if (process.argv[2] === '--selftest') {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) {
      console.error(`❌ ${msg}`);
      process.exit(1);
    }
    console.log(`✅ ${msg}`);
  };

  assert(CONNECTION.cloudId === '998e78d7-2a66-4fc0-809b-b43b4232d4b8', 'cloudId pinned');

  const parent = epicsAndChildrenJql('EON', ['EON-21'], 'parent');
  assert(parent.includes('parent in (EON-21)'), 'parent strategy → parent in (...)');
  assert(parent.includes('issuetype = Epic'), 'epics always in scope');

  const link = epicsAndChildrenJql('EON', ['EON-21', 'EON-99'], 'epic-link');
  assert(
    link.includes('"Epic Link" in (EON-21, EON-99)'),
    'epic-link strategy → Epic Link in (...)',
  );

  const kids = epicChildrenJql('EON', 'EON-21', 'parent');
  assert(
    kids === 'project = EON AND parent = EON-21 ORDER BY rank ASC',
    'single-epic children query',
  );

  assert(backlogJql('EON').includes('sprint is EMPTY'), 'backlog excludes sprinted items');
  assert(currentSprintJql('EON').includes('openSprints()'), 'current sprint uses openSprints()');
  assert(sprintByNameJql('EON', "Bob's Sprint").includes("\\'"), 'named sprint escapes quotes');

  const q = scopeQueries('EON', ['EON-21'], 'parent');
  assert(
    !!q.epics_and_children && !!q.backlog && !!q.current_sprint,
    'three scope queries produced',
  );

  assert(MCP_CONTRACT.editIssue.tool === 'mcp__atlassian__editJiraIssue', 'write tool mapped');
  assert(Object.keys(MCP_CONTRACT).length >= 10, 'contract covers read + write steps');

  console.log('\nmcp-client.ts self-test passed.');
}
