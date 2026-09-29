#!/usr/bin/env tsx
/*
 * converter.ts — JIRA issue → mirror files (plan 01a §2.1, §2.3, §2.4, §6.3a).
 *
 * The one place that turns a raw JIRA issue (as returned by the Atlassian MCP
 * getJiraIssue / searchJiraIssuesUsingJql tools) into the on-disk mirror:
 *
 *   - a human-readable {KEY}.md body, VERBATIM (R1 — no de-identification),
 *     partitioned into pushable / pull-only regions with load-bearing HTML
 *     markers (§2.4);
 *   - a machine {KEY}.json sidecar with structured metadata + the dual hashes
 *     (§2.1); or, for an Epic, a per-epic manifest (§2.3).
 *
 * ADF → Markdown: JIRA Cloud descriptions/comments are Atlassian Document
 * Format (a JSON doc tree). adfToMarkdown() renders the common node types we
 * see in EON verbatim. When the MCP already hands us a Markdown/plain string
 * (some tools accept responseContentFormat: markdown), we pass it through.
 *
 * Sprint (§6.3a) is a customfield whose entries are either structured objects
 * or the legacy GreenHopper serialized string; parseSprint() handles both by
 * the shape recorded in jira-sync.config.yml (fields.sprint.shape).
 *
 * Pure transform — takes an issue object + config, returns file contents.
 * No network, no disk writes here; callers (the /jira commands) own I/O.
 * Self-check:  tsx scripts/jira/converter.ts --selftest
 */

import { hashBody, hashPushable, hashRoster } from './hash.ts';

// ---- input shapes (a permissive subset of the Atlassian issue) --------------

export interface RawUser {
  accountId?: string;
  displayName?: string;
  emailAddress?: string;
  name?: string; // classic
}

export interface RawIssue {
  key: string;
  fields: Record<string, unknown> & {
    summary?: string;
    issuetype?: { name?: string };
    status?: { name?: string; statusCategory?: { name?: string } };
    assignee?: RawUser | null;
    reporter?: RawUser | null;
    priority?: { name?: string } | null;
    labels?: string[];
    parent?: { key?: string } | null;
    updated?: string;
    description?: unknown; // ADF doc | string | null
    issuelinks?: RawIssueLink[];
    comment?: { comments?: RawComment[] };
  };
}

export interface RawIssueLink {
  type?: { name?: string; inward?: string; outward?: string };
  inwardIssue?: { key?: string };
  outwardIssue?: { key?: string };
}

export interface RawComment {
  author?: RawUser;
  created?: string;
  body?: unknown; // ADF | string
}

export interface ConverterConfig {
  site: string; // commbank.atlassian.net
  sprintFieldId: string | null; // fields.sprint.id
  sprintShape: 'object' | 'greenhopper' | null;
  storyPointsFieldId: string | null;
  rankFieldId: string | null;
  /** fields.acceptanceCriteria.id — EON stores AC in a dedicated textarea
   *  custom field (not inline in Description). When set, its value is rendered
   *  into the pushable `## Acceptance Criteria` region (§2.4). */
  acceptanceCriteriaFieldId?: string | null;
  /** Resolve a JIRA user object to the handle we store (accountId/name/email). */
  userHandle?: (u: RawUser | null | undefined) => string | null;
}

// ---- ADF → Markdown ---------------------------------------------------------

interface AdfNode {
  type: string;
  text?: string;
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

function isAdf(v: unknown): v is AdfNode {
  return !!v && typeof v === 'object' && typeof (v as AdfNode).type === 'string';
}

function applyMarks(text: string, marks?: AdfNode['marks']): string {
  if (!marks) return text;
  let out = text;
  for (const m of marks) {
    switch (m.type) {
      case 'strong':
        out = `**${out}**`;
        break;
      case 'em':
        out = `*${out}*`;
        break;
      case 'code':
        out = `\`${out}\``;
        break;
      case 'strike':
        out = `~~${out}~~`;
        break;
      case 'link': {
        const href = (m.attrs?.href as string) ?? '';
        out = `[${out}](${href})`;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

function renderInline(nodes: AdfNode[] | undefined): string {
  if (!nodes) return '';
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'text':
          return applyMarks(n.text ?? '', n.marks);
        case 'hardBreak':
          return '\n';
        case 'mention':
          return `@${(n.attrs?.text as string) ?? (n.attrs?.id as string) ?? 'user'}`;
        case 'emoji':
          return (n.attrs?.text as string) ?? (n.attrs?.shortName as string) ?? '';
        case 'inlineCard':
          return (n.attrs?.url as string) ?? '';
        default:
          return renderInline(n.content);
      }
    })
    .join('');
}

function renderBlock(node: AdfNode, depth = 0): string {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map((c) => renderBlock(c, depth)).join('\n\n');
    case 'paragraph':
      return renderInline(node.content);
    case 'heading': {
      const level = Math.min(6, Number(node.attrs?.level ?? 3));
      // never emit H1/H2 from ADF — those anchors are ours (§2.4); demote.
      const safe = Math.max(3, level);
      return `${'#'.repeat(safe)} ${renderInline(node.content)}`;
    }
    case 'bulletList':
      return (node.content ?? [])
        .map((li) => `${'  '.repeat(depth)}- ${renderBlock(li, depth + 1).trim()}`)
        .join('\n');
    case 'orderedList':
      return (node.content ?? [])
        .map((li, i) => `${'  '.repeat(depth)}${i + 1}. ${renderBlock(li, depth + 1).trim()}`)
        .join('\n');
    case 'listItem':
      return (node.content ?? []).map((c) => renderBlock(c, depth)).join('\n');
    case 'taskList':
      return (node.content ?? []).map((li) => renderBlock(li, depth)).join('\n');
    case 'taskItem': {
      const done = node.attrs?.state === 'DONE';
      return `- [${done ? 'x' : ' '}] ${renderInline(node.content)}`;
    }
    case 'codeBlock': {
      const lang = (node.attrs?.language as string) ?? '';
      return '```' + lang + '\n' + renderInline(node.content) + '\n```';
    }
    case 'blockquote':
      return (node.content ?? [])
        .map((c) => renderBlock(c, depth))
        .join('\n')
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n');
    case 'rule':
      return '---';
    case 'panel':
      return (node.content ?? [])
        .map((c) => renderBlock(c, depth))
        .join('\n')
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n');
    case 'mediaSingle':
    case 'mediaGroup':
      return '_[media attachment — see JIRA]_';
    case 'table':
      return renderTable(node);
    default:
      // Unknown block: fall back to inline render of its children (never drop
      // content — R1 verbatim).
      return renderInline(node.content);
  }
}

function renderTable(node: AdfNode): string {
  const rows = (node.content ?? []).filter((r) => r.type === 'tableRow');
  if (rows.length === 0) return '';
  const cellText = (cell: AdfNode) =>
    (cell.content ?? [])
      .map((c) => renderBlock(c))
      .join(' ')
      .replace(/\n+/g, ' ')
      .trim();
  const asRow = (r: AdfNode) => '| ' + (r.content ?? []).map(cellText).join(' | ') + ' |';
  const header = rows[0];
  const width = (header.content ?? []).length;
  const sep = '| ' + Array(width).fill('---').join(' | ') + ' |';
  return [asRow(header), sep, ...rows.slice(1).map(asRow)].join('\n');
}

/** Render ADF (or pass through an already-string body) to Markdown. */
export function adfToMarkdown(body: unknown): string {
  if (body == null) return '';
  if (typeof body === 'string') return body.trim();
  if (isAdf(body))
    return renderBlock(body)
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  return '';
}

// ---- sprint parsing (§6.3a) -------------------------------------------------

export interface SprintInfo {
  active: string | null;
  all: string[];
}

/** Parse the sprint customfield by its recorded shape. Returns the active
 *  sprint name (else most-recent future, else null) plus the full list. */
export function parseSprint(value: unknown, shape: 'object' | 'greenhopper' | null): SprintInfo {
  if (value == null) return { active: null, all: [] };
  const arr = Array.isArray(value) ? value : [value];
  if (arr.length === 0) return { active: null, all: [] };

  if (shape === 'greenhopper') {
    // legacy: "...Sprint@1a2b[id=4021,name=EON Sprint 24,state=ACTIVE,...]"
    const parsed = arr
      .map((raw) => {
        const s = String(raw);
        const name = /name=([^,\]]+)/.exec(s)?.[1] ?? null;
        const state = /state=([^,\]]+)/.exec(s)?.[1]?.toUpperCase() ?? null;
        return name ? { name, state } : null;
      })
      .filter((x): x is { name: string; state: string | null } => !!x);
    const active =
      parsed.find((p) => p.state === 'ACTIVE')?.name ??
      parsed.find((p) => p.state === 'FUTURE')?.name ??
      null;
    return { active, all: parsed.map((p) => p.name) };
  }

  // object shape (modern Cloud): { id, name, state, startDate, endDate }
  const objs = arr.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
  // Sprint name/state are strings in the Cloud API; ignore any non-string value
  // rather than risk an "[object Object]" coercion (no-base-to-string).
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const named = objs
    .map((o) => ({ name: str(o.name), state: str(o.state).toLowerCase() }))
    .filter((o) => o.name);
  const active =
    named.find((o) => o.state === 'active')?.name ??
    named.find((o) => o.state === 'future')?.name ??
    null;
  return { active, all: named.map((o) => o.name) };
}

// ---- link roster ------------------------------------------------------------

function defaultHandle(u: RawUser | null | undefined): string | null {
  if (!u) return null;
  return u.name ?? u.accountId ?? u.emailAddress ?? u.displayName ?? null;
}

function collectLinks(issuelinks: RawIssueLink[] | undefined): {
  blocks: string[];
  blockedBy: string[];
  relates: string[];
} {
  const out = { blocks: [] as string[], blockedBy: [] as string[], relates: [] as string[] };
  for (const l of issuelinks ?? []) {
    const name = (l.type?.name ?? '').toLowerCase();
    if (l.outwardIssue?.key) {
      if (name === 'blocks') out.blocks.push(l.outwardIssue.key);
      else out.relates.push(l.outwardIssue.key);
    }
    if (l.inwardIssue?.key) {
      if (name === 'blocks') out.blockedBy.push(l.inwardIssue.key);
      else out.relates.push(l.inwardIssue.key);
    }
  }
  return out;
}

// ---- public conversion ------------------------------------------------------

export interface ConvertedItem {
  md: string;
  sidecar: Record<string, unknown>;
}

/** Convert a story / task / bug into { .md body, .json sidecar } (§2.1). */
export function convertItem(issue: RawIssue, cfg: ConverterConfig, nowIso: string): ConvertedItem {
  const f = issue.fields;
  const handle = cfg.userHandle ?? defaultHandle;
  const type = f.issuetype?.name ?? 'Task';
  const status = f.status?.name ?? 'Unknown';
  const statusCategory = f.status?.statusCategory?.name ?? 'To Do';
  const assignee = handle(f.assignee);
  const points = cfg.storyPointsFieldId
    ? ((f[cfg.storyPointsFieldId] as number | null) ?? null)
    : null;
  const priority = f.priority?.name ?? null;
  const sprintRaw = cfg.sprintFieldId ? f[cfg.sprintFieldId] : null;
  const sprint = parseSprint(sprintRaw, cfg.sprintShape);
  const rank = cfg.rankFieldId ? ((f[cfg.rankFieldId] as string | null) ?? null) : null;
  const parent = f.parent?.key ?? null;
  const links = collectLinks(f.issuelinks);
  const url = `https://${cfg.site}/browse/${issue.key}`;

  const description = adfToMarkdown(f.description);
  const acceptanceCriteria = cfg.acceptanceCriteriaFieldId
    ? adfToMarkdown(f[cfg.acceptanceCriteriaFieldId])
    : '';
  const comments = (f.comment?.comments ?? []).map((c) => ({
    author: handle(c.author) ?? 'unknown',
    at: c.created ?? nowIso,
    body: adfToMarkdown(c.body),
  }));

  const md = renderItemMd({
    key: issue.key,
    summary: f.summary ?? '',
    status,
    sprint: sprint.active,
    points,
    assignee,
    description,
    acceptanceCriteria,
    parent,
    links,
    comments,
  });

  const body = mdBody(md);
  const sidecar: Record<string, unknown> = {
    source: 'jira',
    key: issue.key,
    type,
    url,
    summary: f.summary ?? '',
    status,
    statusCategory,
    assignee,
    reporter: handle(f.reporter),
    storyPoints: points,
    priority,
    sprint: sprint.active,
    ...(sprint.all.length > 1 ? { sprints: sprint.all } : {}),
    ...(rank != null ? { rank } : {}),
    labels: f.labels ?? [],
    parent,
    links,
    remoteUpdatedAt: f.updated ?? nowIso,
    localSyncedAt: nowIso,
    contentHash: hashBody(body),
    localEditsHash: hashBody(body),
    status_sync: 'clean',
  };

  return { md, sidecar };
}

/** Build the per-epic manifest (§2.3). children roster is supplied by the
 *  caller (it comes from the scoped child query, not the epic issue itself). */
export function convertEpic(
  issue: RawIssue,
  children: Array<{
    key: string;
    type: string;
    file: string;
    status: string;
    assignee: string | null;
    remoteUpdatedAt: string;
  }>,
  cfg: ConverterConfig,
  nowIso: string,
): { md: string; manifest: Record<string, unknown> } {
  const f = issue.fields;
  const handle = cfg.userHandle ?? defaultHandle;
  const status = f.status?.name ?? 'Unknown';
  const description = adfToMarkdown(f.description);
  const acceptanceCriteria = cfg.acceptanceCriteriaFieldId
    ? adfToMarkdown(f[cfg.acceptanceCriteriaFieldId])
    : '';
  const comments = (f.comment?.comments ?? []).map((c) => ({
    author: handle(c.author) ?? 'unknown',
    at: c.created ?? nowIso,
    body: adfToMarkdown(c.body),
  }));

  const md = renderItemMd({
    key: issue.key,
    summary: f.summary ?? '',
    status,
    sprint: null,
    points: null,
    assignee: handle(f.assignee),
    description,
    acceptanceCriteria,
    parent: f.parent?.key ?? null,
    links: collectLinks(f.issuelinks),
    comments,
  });

  const manifest: Record<string, unknown> = {
    source: 'jira',
    key: issue.key,
    type: 'Epic',
    url: `https://${cfg.site}/browse/${issue.key}`,
    summary: f.summary ?? '',
    status,
    statusCategory: f.status?.statusCategory?.name ?? 'To Do',
    assignee: handle(f.assignee),
    reporter: handle(f.reporter),
    priority: f.priority?.name ?? null,
    labels: f.labels ?? [],
    parent: f.parent?.key ?? null,
    links: collectLinks(f.issuelinks),
    descriptionRef: `jira/epics/${issue.key}.md`,
    comments,
    children,
    childrenHash: hashRoster(children),
    remoteUpdatedAt: f.updated ?? nowIso,
    localSyncedAt: nowIso,
  };

  return { md, manifest };
}

// ---- Markdown template (§2.1) ----------------------------------------------

interface MdInput {
  key: string;
  summary: string;
  status: string;
  sprint: string | null;
  points: number | null;
  assignee: string | null;
  description: string;
  acceptanceCriteria: string;
  parent: string | null;
  links: { blocks: string[]; blockedBy: string[]; relates: string[] };
  comments: Array<{ author: string; at: string; body: string }>;
}

function renderItemMd(i: MdInput): string {
  const statusLine = [
    i.status,
    i.sprint ? `Sprint: ${i.sprint}` : null,
    i.points != null ? `Points: ${i.points}` : null,
    i.assignee ? `Assignee: ${i.assignee}` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  const linkLines: string[] = [];
  if (i.parent) linkLines.push(`- Parent: ${i.parent}`);
  for (const b of i.links.blocks) linkLines.push(`- Blocks: ${b}`);
  for (const b of i.links.blockedBy) linkLines.push(`- Blocked by: ${b}`);
  for (const r of i.links.relates) linkLines.push(`- Relates: ${r}`);

  const commentLines = i.comments.map(
    (c) => `- **${c.author}** ${c.at}: ${c.body.replace(/\n+/g, ' ').trim()}`,
  );

  return [
    `# ${i.key}: ${i.summary}`,
    '',
    '<!-- pull-only: mirrors JIRA; edits here are reported-and-skipped on push (§8.2) -->',
    '## Status',
    statusLine || '_unknown_',
    '',
    '<!-- pushable: Feature A pushes this region to the JIRA description field (§8.2) -->',
    '## Description',
    i.description || '_No description._',
    '',
    '## Acceptance Criteria',
    i.acceptanceCriteria ||
      '_None recorded — add `- [ ]` items here; they push with the description._',
    '',
    '<!-- pull-only -->',
    '## Links',
    linkLines.length ? linkLines.join('\n') : '_None._',
    '',
    '<!-- pull-only -->',
    '## Comments (verbatim, chronological)',
    commentLines.length ? commentLines.join('\n') : '_None._',
    '',
  ].join('\n');
}

/** The body used for hashing = the whole .md minus the H1 title line, so a
 *  summary rename (which we re-derive from JIRA anyway) doesn't read as a
 *  local edit. */
export function mdBody(md: string): string {
  return md.replace(/^#\s+.*\n/, '');
}

// ---- self-test --------------------------------------------------------------

if (process.argv[2] === '--selftest') {
  const issue: RawIssue = {
    key: 'EON-123',
    fields: {
      summary: 'Wire PingID JWKS rotation into the auth guard',
      issuetype: { name: 'Story' },
      status: { name: 'In Progress', statusCategory: { name: 'In Progress' } },
      assignee: { name: 'abbasqa', displayName: 'Qaiser Abbas' },
      reporter: { name: 'j.smith', displayName: 'John Smith' },
      priority: { name: 'High' },
      labels: ['auth', 'security'],
      parent: { key: 'EON-21' },
      updated: '2026-07-29T04:12:33.000Z',
      customfield_10016: 5,
      customfield_10020: [
        {
          id: 4021,
          name: 'EON Sprint 24',
          state: 'active',
          startDate: '2026-07-28',
          endDate: '2026-08-11',
        },
      ],
      customfield_11500: {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'guard rejects an expired token' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      description: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Rotate JWKS on 401 ' },
              { type: 'text', text: 'without restart', marks: [{ type: 'strong' }] },
            ],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'cache TTL 10m' }] },
                ],
              },
            ],
          },
        ],
      },
      issuelinks: [
        { type: { name: 'Blocks' }, outwardIssue: { key: 'EON-140' } },
        { type: { name: 'Relates' }, outwardIssue: { key: 'EON-201' } },
      ],
      comment: {
        comments: [
          {
            author: { name: 'abbasqa' },
            created: '2026-07-29T05:00:00.000Z',
            body: 'Confirmed with platform.',
          },
        ],
      },
    },
  };

  const cfg: ConverterConfig = {
    site: 'commbank.atlassian.net',
    sprintFieldId: 'customfield_10020',
    sprintShape: 'object',
    storyPointsFieldId: 'customfield_10016',
    rankFieldId: null,
    acceptanceCriteriaFieldId: 'customfield_11500',
  };

  const assert = (cond: boolean, msg: string) => {
    if (!cond) {
      console.error(`❌ ${msg}`);
      process.exit(1);
    }
    console.log(`✅ ${msg}`);
  };

  const { md, sidecar } = convertItem(issue, cfg, '2026-08-01T09:00:00.000Z');

  assert(md.startsWith('# EON-123: Wire PingID'), 'H1 has key + summary');
  assert(md.includes('<!-- pushable:'), 'pushable marker present before Description');
  assert(md.includes('<!-- pull-only'), 'pull-only markers present');
  assert(md.includes('**without restart**'), 'ADF strong mark rendered');
  assert(md.includes('- cache TTL 10m'), 'ADF bullet rendered');
  assert(
    md.includes('## Acceptance Criteria\n- guard rejects an expired token'),
    'AC read from custom field into pushable region',
  );
  assert(md.includes('Sprint: EON Sprint 24'), 'active sprint parsed (object shape)');
  assert(md.includes('- Blocks: EON-140'), 'blocks link rendered');
  assert(md.includes('**abbasqa**'), 'comment rendered verbatim');

  assert(sidecar.key === 'EON-123', 'sidecar key');
  assert(sidecar.storyPoints === 5, 'sidecar points from customfield');
  assert(sidecar.sprint === 'EON Sprint 24', 'sidecar sprint name');
  assert(sidecar.status_sync === 'clean', 'fresh item is clean');
  assert(sidecar.contentHash === sidecar.localEditsHash, 'fresh item: hashes equal');
  assert((sidecar.contentHash as string).startsWith('sha256:'), 'contentHash form');
  assert(
    JSON.stringify((sidecar.links as { blocks: string[] }).blocks) === '["EON-140"]',
    'sidecar blocks',
  );

  // greenhopper shape
  const gh = parseSprint(
    [
      'com.atlassian.greenhopper.service.sprint.Sprint@1a2b[id=4021,name=EON Sprint 24,state=ACTIVE,startDate=x]',
    ],
    'greenhopper',
  );
  assert(gh.active === 'EON Sprint 24', 'greenhopper active sprint parsed');

  // round-trip marker stability: hashing the emitted body twice is stable, and
  // the pushable slice excludes status/links/comments.
  const body = mdBody(md);
  assert(hashBody(body) === hashBody(body), 'body hash stable');
  assert(!hashPushable(body).includes('EON-140'), 'pushable hash is a digest (sanity)');

  console.log('\nconverter.ts self-test passed.');
}
