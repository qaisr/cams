#!/usr/bin/env tsx
/*
 * converter.ts — Confluence content → mirror files (plan 01c Phase 3 §2, §3, §4).
 * Twin of scripts/jira/converter.ts, adapted for Confluence.
 *
 * The one place that turns a raw Confluence page (as returned by the Atlassian
 * MCP getConfluencePage tool with contentFormat:"markdown") into the on-disk
 * mirror:
 *
 *   - a human-readable {SPACE}-{pageId}.md body, VERBATIM (R1 — no
 *     de-identification), with each Confluence heading normalized to a stable
 *     `##` anchor, partitioned into pushable (authored prose) vs pull-only
 *     (## Comments, ## Metadata) regions via load-bearing HTML-comment markers
 *     (§2); Phase 4's write-back keys on these markers;
 *   - a machine {SPACE}-{pageId}.json sidecar with structured metadata + the
 *     dual hashes + the two-timestamp field (§3), validated against
 *     confluence/manifest.schema.json#/$defs/itemSidecar.
 *
 * Unlike JIRA (ADF JSON), Confluence pages arrive already as Markdown — so this
 * module is mostly structural: normalize headings, wrap regions, PRESERVE
 * unconvertible macros as opaque ```macro fenced blocks (never rewritten by a
 * section-scoped push), and append the pull-only Comments/Metadata regions.
 *
 * Pure transform — takes a page object + config, returns file contents. No
 * network, no disk writes here; callers (the /confluence pull pipeline) own I/O.
 * Self-check:  tsx scripts/confluence/converter.ts --selftest
 */

import { hashBody, hashPushable } from './hash.ts';

// ---- input shapes (a permissive subset of the Atlassian page) ---------------

export interface RawComment {
  author?: string | null; // resolved handle (accountId/displayName), or null
  at?: string | null; // created timestamp
  body?: string; // markdown (getConfluencePage*Comments contentFormat:markdown)
}

export interface RawPage {
  pageId: string;
  spaceKey: string;
  type: 'page' | 'blogpost';
  title: string;
  /** Body already in Markdown (getConfluencePage contentFormat:"markdown"). */
  bodyMarkdown: string;
  /** Confluence lastModified as returned by the MCP tools — opaque display string, compared only for exact equality. */
  remoteLastModified: string | null;
  ancestors?: string[]; // ordered root → immediate parent (pageIds)
  labels?: string[];
  comments?: RawComment[]; // footer + inline, already resolved to markdown
}

export interface ConverterConfig {
  site: string; // commbank.atlassian.net
  pullComments: boolean;
}

// ---- macro preservation (§2) ------------------------------------------------

/**
 * Confluence macros that survive markdown conversion arrive as HTML-ish blocks
 * the MCP could not render (page-properties, include, jira-issue, etc.). We wrap
 * each in an opaque ```macro fence so partitionRegions (hash.ts) treats it as
 * verbatim content and a section-scoped push never rewrites it. Detection is
 * intentionally conservative: a run of lines that look like a raw
 * <ac:…>/<ri:…>/<div class="…macro…"> block, OR a line the MCP emitted as an
 * explicit `[macro: …]` placeholder.
 *
 * The input body is otherwise passed through verbatim (R1); we only FENCE the
 * macro spans, we never drop or rewrite them.
 */
export function preserveMacros(bodyMarkdown: string): string {
  const lines = bodyMarkdown.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  const isMacroOpen = (l: string) =>
    /^\s*<(ac:|ri:)/.test(l) || /^\s*\[macro[:\]]/i.test(l) || /data-macro-name=/.test(l);
  const isMacroClose = (l: string) => /<\/ac:[a-z-]+>\s*$/.test(l) || /^\s*\]\s*$/.test(l);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Never double-fence: if the body already carries a ```macro fence, copy it
    // through untouched up to its closing ```.
    if (/^```macro\b/.test(line)) {
      out.push(line);
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) out.push(lines[i++]);
      if (i < lines.length) out.push(lines[i++]); // closing fence
      continue;
    }
    if (isMacroOpen(line)) {
      const block: string[] = [line];
      let j = i + 1;
      // A single-line placeholder (`[macro: …]`) closes immediately.
      if (!isMacroClose(line)) {
        while (j < lines.length && !isMacroClose(lines[j])) block.push(lines[j++]);
        if (j < lines.length) block.push(lines[j++]);
      } else {
        j = i + 1;
      }
      out.push('```macro', ...block, '```');
      i = j;
      continue;
    }
    out.push(line);
    i++;
  }
  return out.join('\n');
}

/**
 * Normalize Confluence headings so the mirror uses `##` stable anchors (§2):
 * demote any H1 in the body to `##` (the file's single H1 is the title we
 * emit), and leave H2+ as-is. Never touches content inside a ```macro fence.
 */
export function normalizeHeadings(bodyMarkdown: string): string {
  const lines = bodyMarkdown.split('\n');
  const out: string[] = [];
  let inMacro = false;
  for (const line of lines) {
    if (/^```macro\b/.test(line)) {
      inMacro = true;
      out.push(line);
      continue;
    }
    if (inMacro) {
      if (/^```\s*$/.test(line)) inMacro = false;
      out.push(line);
      continue;
    }
    const h1 = line.match(/^#\s+(.*)$/);
    out.push(h1 ? `## ${h1[1]}` : line);
  }
  return out.join('\n');
}

// ---- public conversion ------------------------------------------------------

export interface ConvertedItem {
  md: string;
  sidecar: Record<string, unknown>;
}

/** Relative sidecar/body folder for a content type (schema: page→pages/, blogpost→blogposts/). */
export function typeFolder(type: 'page' | 'blogpost'): 'pages' | 'blogposts' {
  return type === 'blogpost' ? 'blogposts' : 'pages';
}

/** Item key {SPACE}-{pageId}. */
export function itemKey(spaceKey: string, pageId: string): string {
  return `${spaceKey}-${pageId}`;
}

/** Relative path to the cached .md body (schema sidecar.sourceRef form). */
export function bodyRelPath(page: Pick<RawPage, 'spaceKey' | 'pageId' | 'type'>): string {
  return `confluence/${typeFolder(page.type)}/${itemKey(page.spaceKey, page.pageId)}.md`;
}

/**
 * Convert a Confluence page/blogpost into { .md body, .json sidecar } (§2, §3).
 * A freshly-pulled item is `clean` with contentHash === localEditsHash (the
 * on-disk body IS the last-pulled body until a human edits it).
 */
export function convertItem(page: RawPage, cfg: ConverterConfig, nowIso: string): ConvertedItem {
  const url = `https://${cfg.site}/wiki/spaces/${page.spaceKey}/pages/${page.pageId}`;
  const commentsPulled = cfg.pullComments && Array.isArray(page.comments);

  const md = renderPageMd({
    title: page.title,
    bodyMarkdown: page.bodyMarkdown,
    labels: page.labels ?? [],
    ancestors: page.ancestors ?? [],
    remoteLastModified: page.remoteLastModified,
    comments: commentsPulled ? (page.comments ?? []) : [],
    commentsPulled,
  });

  const body = mdBody(md);
  const contentHash = hashBody(body);

  const sidecar: Record<string, unknown> = {
    source: 'confluence',
    pageId: page.pageId,
    spaceKey: page.spaceKey,
    type: page.type,
    title: page.title,
    url,
    ...(page.ancestors?.length ? { ancestors: [...page.ancestors] } : {}),
    ...(page.labels?.length ? { labels: [...page.labels] } : {}),
    remoteLastModified: page.remoteLastModified ?? null,
    contentHash,
    localEditsHash: contentHash, // fresh pull: on-disk body === last-pulled body
    status_sync: 'clean',
    lastSyncedAt: nowIso, // a REAL pull sets this (reindex must never touch it)
    commentsPulled,
    sourceRef: bodyRelPath(page),
  };

  return { md, sidecar };
}

// ---- per-space manifest item (§4) ------------------------------------------

export interface SpaceRosterItem {
  pageId: string;
  type: 'page' | 'blogpost';
  file: string; // sidecar path, e.g. confluence/pages/SEC-2097876103.json
  title: string;
  ancestors: string[];
  remoteLastModified: string | null;
}

/** Build one space-roster entry for spaces/{SPACE}.json from a page. */
export function rosterItem(page: RawPage): SpaceRosterItem {
  return {
    pageId: page.pageId,
    type: page.type,
    file: `confluence/${typeFolder(page.type)}/${itemKey(page.spaceKey, page.pageId)}.json`,
    title: page.title,
    ancestors: [...(page.ancestors ?? [])],
    remoteLastModified: page.remoteLastModified ?? null,
  };
}

// ---- Markdown template (§2) ------------------------------------------------

interface MdInput {
  title: string;
  bodyMarkdown: string;
  labels: string[];
  ancestors: string[];
  remoteLastModified: string | null;
  comments: RawComment[];
  commentsPulled: boolean;
}

function renderPageMd(i: MdInput): string {
  // Authored prose: preserve macros as opaque fences, then normalize headings.
  const authored = normalizeHeadings(preserveMacros(i.bodyMarkdown)).trim();

  const commentLines = i.comments.map(
    (c) =>
      `- **${c.author ?? 'unknown'}** ${c.at ?? ''}: ${(c.body ?? '').replace(/\n+/g, ' ').trim()}`,
  );

  const metaLines: string[] = [
    `- Last modified (remote): ${i.remoteLastModified ?? '_unknown_'}`,
    i.labels.length ? `- Labels: ${i.labels.join(', ')}` : '- Labels: _none_',
    i.ancestors.length ? `- Ancestors: ${i.ancestors.join(' > ')}` : '- Ancestors: _root_',
  ];

  return [
    `# ${i.title}`,
    '',
    '<!-- pushable: Phase-4 write-back pushes the authored regions to the Confluence body (§2) -->',
    '## Body',
    authored || '_No body content._',
    '',
    '<!-- pull-only: mirrors Confluence; edits here are reported-and-skipped on push (§2) -->',
    '## Comments',
    i.commentsPulled
      ? commentLines.length
        ? commentLines.join('\n')
        : '_None._'
      : '_Not pulled (config.pullComments = false)._',
    '',
    '<!-- pull-only -->',
    '## Metadata',
    metaLines.join('\n'),
    '',
  ].join('\n');
}

/** The body used for hashing = the whole .md minus the H1 title line, so a page
 *  rename (which we re-derive from Confluence anyway) doesn't read as a local
 *  edit. Mirrors JIRA's mdBody(). */
export function mdBody(md: string): string {
  return md.replace(/^#\s+.*\n/, '');
}

// ---- self-test --------------------------------------------------------------

if (process.argv[2] === '--selftest') {
  const page: RawPage = {
    pageId: '2042342654',
    spaceKey: 'PCON',
    type: 'page',
    title: 'NTB POBO — temporary credentials',
    bodyMarkdown: [
      '# How to create temporary credentials',
      '',
      'Follow these steps for an NTB POBO.',
      '',
      '<ac:structured-macro ac:name="jira">',
      '  <ac:parameter ac:name="key">PCON-1</ac:parameter>',
      '</ac:structured-macro>',
      '',
      '## Details',
      'Tokens expire after 24h.',
    ].join('\n'),
    remoteLastModified: 'Jul 30, 2026 02:00',
    ancestors: ['1332713924', '1332713925'],
    labels: ['party-credentials', 'admin-hub'],
    comments: [
      { author: 'qaiser.abbas', at: '2026-07-31T00:00:00.000Z', body: 'Confirmed with platform.' },
    ],
  };

  const cfg: ConverterConfig = { site: 'commbank.atlassian.net', pullComments: true };

  const assert = (cond: boolean, msg: string) => {
    if (!cond) {
      console.error(`❌ ${msg}`);
      process.exit(1);
    }
    console.log(`✅ ${msg}`);
  };

  const { md, sidecar } = convertItem(page, cfg, '2026-08-01T09:00:00.000Z');

  assert(md.startsWith('# NTB POBO — temporary credentials'), 'H1 is the page title');
  assert(md.includes('<!-- pushable:'), 'pushable marker present before Body');
  assert(md.includes('<!-- pull-only'), 'pull-only markers present');
  assert(md.includes('## Body'), 'authored prose under ## Body');
  assert(
    md.includes('## How to create temporary credentials'),
    'in-body H1 demoted to ## stable anchor',
  );
  assert(md.includes('```macro'), 'unconvertible macro preserved as opaque fence');
  assert(md.includes('ac:name="jira"'), 'macro content kept verbatim inside the fence');
  assert(md.includes('## Details'), 'existing H2 preserved');
  assert(md.includes('## Comments'), 'pull-only Comments region emitted');
  assert(md.includes('**qaiser.abbas**'), 'comment rendered verbatim');
  assert(md.includes('## Metadata'), 'pull-only Metadata region emitted');
  assert(md.includes('- Labels: party-credentials, admin-hub'), 'labels in metadata');
  assert(md.includes('- Ancestors: 1332713924 > 1332713925'), 'ancestor chain in metadata');

  assert(sidecar.source === 'confluence', 'sidecar source const');
  assert(sidecar.pageId === '2042342654', 'sidecar pageId');
  assert(sidecar.spaceKey === 'PCON', 'sidecar spaceKey');
  assert(sidecar.type === 'page', 'sidecar type');
  assert(sidecar.remoteLastModified === 'Jul 30, 2026 02:00', 'sidecar remoteLastModified');
  assert(sidecar.status_sync === 'clean', 'fresh item is clean');
  assert(sidecar.contentHash === sidecar.localEditsHash, 'fresh item: hashes equal');
  assert((sidecar.contentHash as string).startsWith('sha256:'), 'contentHash form');
  assert(sidecar.lastSyncedAt === '2026-08-01T09:00:00.000Z', 'real pull sets lastSyncedAt');
  assert(sidecar.commentsPulled === true, 'commentsPulled reflects config');
  assert(
    sidecar.sourceRef === 'confluence/pages/PCON-2042342654.md',
    'sourceRef is relative .md path (schema)',
  );

  // A macro-body ## does NOT leak into the pushable hash as prose (it's fenced),
  // yet a comment-only edit changes the whole-body hash but not the pushable one.
  const body = mdBody(md);
  const commentEdited = md.replace('Confirmed with platform.', 'Needs review.');
  assert(hashBody(mdBody(commentEdited)) !== hashBody(body), 'comment edit → local-ahead');
  assert(
    hashPushable(mdBody(commentEdited)) === hashPushable(body),
    'comment edit does not change the pushable slice',
  );

  // roster item + path helpers
  const ri = rosterItem(page);
  assert(ri.file === 'confluence/pages/PCON-2042342654.json', 'roster sidecar path');
  assert(ri.remoteLastModified === 'Jul 30, 2026 02:00', 'roster remoteLastModified');
  assert(bodyRelPath(page) === 'confluence/pages/PCON-2042342654.md', 'body rel path');
  assert(itemKey('PCON', '2042342654') === 'PCON-2042342654', 'item key');
  assert(typeFolder('blogpost') === 'blogposts', 'blogpost folder');

  // pullComments=false path
  const { sidecar: noComments } = convertItem(
    page,
    { ...cfg, pullComments: false },
    '2026-08-01T09:00:00.000Z',
  );
  assert(noComments.commentsPulled === false, 'commentsPulled false when disabled');

  // remoteLastModified is opaque: a relative-format string round-trips verbatim (never parsed).
  const relativePage: RawPage = { ...page, remoteLastModified: 'about 2 hours ago' };
  const { sidecar: relativeSidecar, md: relativeMd } = convertItem(
    relativePage,
    cfg,
    '2026-08-01T09:00:00.000Z',
  );
  assert(
    relativeSidecar.remoteLastModified === 'about 2 hours ago',
    'relative-format remoteLastModified round-trips verbatim',
  );
  assert(
    relativeMd.includes('- Last modified (remote): about 2 hours ago'),
    'relative-format string rendered verbatim in Metadata',
  );

  // null remoteLastModified renders as _unknown_ in the Metadata line.
  const nullPage: RawPage = { ...page, remoteLastModified: null };
  const { md: nullMd } = convertItem(nullPage, cfg, '2026-08-01T09:00:00.000Z');
  assert(
    nullMd.includes('- Last modified (remote): _unknown_'),
    'null remoteLastModified renders as _unknown_',
  );

  console.log('\nconverter.ts self-test passed.');
}
