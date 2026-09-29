#!/usr/bin/env tsx
/*
 * mcp-client.ts — the CONTRACT between the /confluence command family and the
 * Atlassian MCP server (plan 01c Phase 3 §5). Twin of scripts/jira/mcp-client.ts.
 *
 * IMPORTANT: this file does NOT call the MCP itself. The Atlassian tools
 * (mcp__atlassian__*) are invoked by Claude while executing a /confluence
 * command — there is no HTTP client here and no secret is ever read (auth is
 * brokered by the MCP session; R: never hardcode credentials). What this module
 * provides is:
 *
 *   1. The pinned connection facts (site, cloudId) in ONE place, mirroring
 *      confluence-sync.config.yml, so a command never hand-types the cloudId.
 *   2. SCOPE-AWARE CQL builders — the mandatory scoped roster query (§5) that is
 *      NEVER "all of Confluence" (token-blowout guard). Scope comes from config:
 *      spaces[], optional labels[], ancestors[], plus a lastmodified window.
 *   3. A typed description of which MCP tool each pull/analytic step maps to, so
 *      the command Markdown and this code cannot drift.
 *
 * Commands read these builders as instruction context (like the config yml) and
 * pass the resulting CQL / cloudId straight into the mcp__atlassian__* call.
 * Self-check:  tsx scripts/confluence/mcp-client.ts --selftest
 */

// ---- pinned connection facts (mirror of confluence-sync.config.yml header) --

export const CONNECTION = {
  site: 'commbank.atlassian.net',
  cloudId: '998e78d7-2a66-4fc0-809b-b43b4232d4b8',
} as const;

/** Per-space scope from confluence-sync.config.yml. labels/ancestors optional;
 *  when both are omitted the pull is space-wide but still bounded by the
 *  lastmodified window (never unbounded). */
export interface SpaceScope {
  key: string;
  labels?: string[];
  ancestors?: string[]; // page ids
}

// ---- CQL builders (§5) ------------------------------------------------------

/** Escape a CQL string literal. CQL uses double quotes as the string delimiter;
 *  a `\` and an inner `"` must be backslash-escaped. */
export function cqlStr(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * The scope clause for one space (§5). Composes:
 *   space = KEY
 *     AND (label in (...) OR ancestor = id OR ...)   ← only if labels/ancestors set
 *     AND lastmodified >= now("-<window>")
 * ORDER BY lastmodified DESC
 *
 * The (label … OR ancestor …) group is OR-joined so a page qualifies by EITHER
 * a matching label OR sitting under a scoped ancestor — matching the plan's
 * example. When neither labels nor ancestors are configured the group is
 * omitted and the space is taken whole (still window-bounded).
 */
export function spaceScopeCql(scope: SpaceScope, sinceWindow: string): string {
  const parts: string[] = [`space = ${scope.key}`];

  const orClauses: string[] = [];
  const labels = scope.labels ?? [];
  if (labels.length) orClauses.push(`label in (${labels.map(cqlStr).join(', ')})`);
  for (const a of scope.ancestors ?? []) orClauses.push(`ancestor = ${a}`);
  if (orClauses.length) {
    parts.push(orClauses.length === 1 ? orClauses[0] : `(${orClauses.join(' OR ')})`);
  }

  parts.push(`lastmodified >= now(${cqlStr('-' + sinceWindow)})`);
  return parts.join(' AND ') + ' ORDER BY lastmodified DESC';
}

/** A single-page CQL lookup by id (the `pull <pageId>` path, when a CQL fetch
 *  is preferred over getConfluencePage — e.g. to confirm scope membership). */
export function pageByIdCql(pageId: string): string {
  return `id = ${pageId}`;
}

/** Union of the per-space scope queries a full `pull <SPACE>` sweep walks. */
export function scopeQueries(
  scopes: SpaceScope[],
  sinceWindow: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of scopes) out[s.key] = spaceScopeCql(s, sinceWindow);
  return out;
}

// ---- MCP tool contract ------------------------------------------------------
// Documents which Atlassian MCP tool each pull/analytic step invokes. Claude
// calls these tools directly; this map is the single source of "what talks to
// what", so a command's prose and its actual tool usage stay aligned. Read
// tools only — every mutation is deferred to the Phase-4 write-back engine.

export interface McpStep {
  tool: string;
  purpose: string;
  args: string;
}

export const MCP_CONTRACT: Record<string, McpStep> = {
  resolveCloudId: {
    tool: 'mcp__atlassian__getAccessibleAtlassianResources',
    purpose: 'Confirm/resolve cloudId for the site at init (pinned thereafter).',
    args: 'none → returns resources incl. { id: cloudId, url: site }',
  },
  whoAmI: {
    tool: 'mcp__atlassian__atlassianUserInfo',
    purpose: 'Identify the authenticated user for people.json seeding.',
    args: 'none',
  },
  search: {
    tool: 'mcp__atlassian__search',
    purpose: 'LIVE Rovo org-wide discovery — the primary engine; never staleness-gated.',
    args: '{ query }',
  },
  searchCql: {
    tool: 'mcp__atlassian__searchConfluenceUsingCql',
    purpose: 'Scope-aware roster pull (§5); page via cursor. NEVER unbounded.',
    args: '{ cloudId, cql, limit: 50, cursor? }',
  },
  getPage: {
    tool: 'mcp__atlassian__getConfluencePage',
    purpose: 'Fetch a page body as Markdown (R1 verbatim) for conversion → mirror.',
    args: '{ cloudId, pageId, contentFormat: "markdown" }',
  },
  descendants: {
    tool: 'mcp__atlassian__getConfluencePageDescendants',
    purpose: 'Resolve a subtree roster under a page for `pull <pageId>` --descendants.',
    args: '{ cloudId, pageId, depth?, limit?, cursor? }',
  },
  footerComments: {
    tool: 'mcp__atlassian__getConfluencePageFooterComments',
    purpose: 'Pull footer comments into the pull-only ## Comments region (if pullComments).',
    args: '{ cloudId, pageId, contentFormat: "markdown", cursor? }',
  },
  inlineComments: {
    tool: 'mcp__atlassian__getConfluencePageInlineComments',
    purpose: 'Pull inline comments into the pull-only ## Comments region (if pullComments).',
    args: '{ cloudId, pageId, contentFormat: "markdown", cursor? }',
  },
  // ---- write-back (Phase 4) — human-gated, dry-run first, NOT wired here -----
  createPage: {
    tool: 'mcp__atlassian__createConfluencePage',
    purpose: 'Phase 4 create: new page under a CONFIRMED parent (never auto-place).',
    args: '{ cloudId, spaceId, title, body, parentId?, contentFormat: "markdown" }',
  },
  updatePage: {
    tool: 'mcp__atlassian__updateConfluencePage',
    purpose: 'Phase 4 push: write the pushable slice after APPROVE + version re-check.',
    args: '{ cloudId, pageId, title, body, contentFormat: "markdown" }',
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
  assert(CONNECTION.site === 'commbank.atlassian.net', 'site pinned');

  // The plan's canonical scoped example.
  const scoped = spaceScopeCql(
    { key: 'PCON', labels: ['party-credentials', 'admin-hub'], ancestors: ['1332713924'] },
    '30d',
  );
  assert(scoped.startsWith('space = PCON AND '), 'space clause first');
  assert(
    scoped.includes('(label in ("party-credentials", "admin-hub") OR ancestor = 1332713924)'),
    'label/ancestor group OR-joined and parenthesized',
  );
  assert(scoped.includes('lastmodified >= now("-30d")'), 'window bound applied');
  assert(scoped.endsWith('ORDER BY lastmodified DESC'), 'deterministic ordering');

  // A space with no labels/ancestors is whole-space but STILL window-bounded.
  const broad = spaceScopeCql({ key: 'SEC' }, '30d');
  assert(broad === 'space = SEC AND lastmodified >= now("-30d") ORDER BY lastmodified DESC',
    'no scope filters → space-wide but window-bounded (never unbounded)');
  assert(!broad.includes('label in') && !broad.includes('ancestor ='), 'no empty scope group');

  // A single label collapses without wrapping parens.
  const oneLabel = spaceScopeCql({ key: 'PCON', labels: ['admin-hub'] }, '7d');
  assert(oneLabel.includes('AND label in ("admin-hub") AND'), 'single clause not over-parenthesized');

  assert(pageByIdCql('2042342654') === 'id = 2042342654', 'single-page CQL by id');
  assert(cqlStr('a"b\\c') === '"a\\"b\\\\c"', 'CQL string escaping');

  const q = scopeQueries([{ key: 'SEC' }, { key: 'PCON', ancestors: ['1332713924'] }], '30d');
  assert(!!q.SEC && !!q.PCON, 'union of per-space scope queries produced');
  assert(q.PCON.includes('ancestor = 1332713924'), 'per-space scope preserved');

  assert(MCP_CONTRACT.searchCql.tool === 'mcp__atlassian__searchConfluenceUsingCql', 'CQL tool mapped');
  assert(MCP_CONTRACT.getPage.args.includes('markdown'), 'page pull uses markdown format');
  assert(Object.keys(MCP_CONTRACT).length >= 8, 'contract covers read + deferred write steps');

  console.log('\nmcp-client.ts self-test passed.');
}
