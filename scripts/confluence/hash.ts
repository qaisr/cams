#!/usr/bin/env tsx
/*
 * hash.ts — SHA-256 utilities for the Confluence mirror's change-detection and
 * push-diff machinery (plan 01c Phase 3 §2, §4, §7). Twin of scripts/jira/hash.ts.
 *
 * Two independent uses of hashing:
 *
 *   1. Whole-body change detection (§3, §7). The sidecar stores two hashes of
 *      the SAME .md body:
 *        - contentHash    = body as last written by a real pull (remote truth)
 *        - localEditsHash = body as it currently sits on disk (hand-edit signal)
 *      They differ ⇒ a human hand-edited the mirror ⇒ pull must not clobber it.
 *      Both are computed by hashBody() over the FULL body.
 *
 *   2. Push-diff payload (§2, Phase 4). Write-back pushes only the PUSHABLE
 *      regions (authored prose). hashPushable() hashes just that slice, so a
 *      comment/metadata hand-edit (pull-only region) marks the item local-ahead
 *      (whole-body hash changed) yet yields an empty pushable diff.
 *
 * The per-space treeHash (§4) is a hash of the sorted (pageId, remoteLastModified,
 * ancestors) roster — hashTree() below. Per confluence/manifest.schema.json the
 * treeHash is defined over (pageId, remoteLastModified, ancestors); the schema
 * wins over the plan prose's (pageId, parentId, version).
 *
 * Confluence-specific vs JIRA: the pull-only headings are `Comments` and
 * `Metadata` (JIRA used Description/Acceptance-Criteria as PUSHABLE). Everything
 * else authored is pushable; unknown headings default to pull-only (fail-safe).
 * Macros are preserved upstream (converter.ts) as opaque `<!-- macro:… -->`
 * fenced blocks and are never treated as pushable prose.
 *
 * Pure functions, no I/O. Importable by converter.ts / reindex.ts / the pull
 * pipeline and unit-testable in isolation:
 *   tsx scripts/confluence/hash.ts --selftest
 */

import { createHash } from 'node:crypto';

/** sha256:<hex> of an arbitrary string, normalized to LF line endings so a
 *  CRLF/LF flip on a hand-edit is not mistaken for a content change. */
export function sha256(input: string): string {
  const normalized = input.replace(/\r\n/g, '\n');
  return 'sha256:' + createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Hash of the full .md body (both contentHash and localEditsHash use this).
 * We collapse a trailing run of newlines to a single LF so an editor that
 * (un)adds one doesn't flip the hash, but preserve all interior whitespace
 * (it is meaningful in verbatim Confluence bodies — R1).
 */
export function hashBody(body: string): string {
  return sha256(body.replace(/\n+$/, '\n'));
}

// ---- region partitioning (§2) ----------------------------------------------

export type RegionClass = 'pushable' | 'pull-only';

export interface Region {
  heading: string; // the ## heading text, e.g. "Comments"
  cls: RegionClass;
  body: string; // content under the heading (excludes the heading line)
}

/** Confluence pull-only headings: mirror-only regions never written back by a
 *  section-scoped push. Everything else authored is pushable. */
const PULL_ONLY_HEADINGS = new Set(['comments', 'metadata']);

/**
 * Split a mirror .md body into ## regions and classify each (§2).
 *
 * Classification precedence (Confluence is PUSHABLE-by-default for authored
 * prose, the inverse of JIRA's known-pushable allow-list):
 *   1. An explicit <!-- pushable --> / <!-- pull-only --> marker on the line(s)
 *      immediately preceding a ## heading is authoritative.
 *   2. Otherwise, known pull-only headings (## Comments, ## Metadata) are
 *      pull-only; every OTHER ## section is authored prose → pushable.
 *
 * The leading `# {title}` H1 and any preamble before the first ## is treated as
 * pull-only preamble (not pushed).
 */
export function partitionRegions(body: string): Region[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const regions: Region[] = [];

  let pendingMarker: RegionClass | null = null;
  let cur: Region | null = null;
  const buf: string[] = [];
  let inMacroFence = false;

  const flush = () => {
    if (cur) {
      cur.body = buf.join('\n').replace(/^\n+|\n+$/g, '');
      regions.push(cur);
    }
    buf.length = 0;
  };

  for (const line of lines) {
    // A macro fence (```macro … ```) is opaque: never interpret markers or ##
    // headings inside it, so a macro body can contain anything verbatim.
    const fence = line.match(/^```(\S*)/);
    if (fence) {
      if (!inMacroFence && fence[1] === 'macro') inMacroFence = true;
      else if (inMacroFence && fence[1] === '') inMacroFence = false;
      if (cur) buf.push(line);
      pendingMarker = null;
      continue;
    }
    if (inMacroFence) {
      if (cur) buf.push(line);
      continue;
    }

    const marker = line.match(/<!--\s*(pushable|pull-only)\b/i);
    if (marker) {
      pendingMarker = marker[1].toLowerCase() as RegionClass;
      continue;
    }
    const h2 = line.match(/^##\s+(.*\S)\s*$/);
    if (h2) {
      flush();
      const heading = h2[1].trim();
      const explicit = pendingMarker;
      const pullOnlyKnown = PULL_ONLY_HEADINGS.has(
        heading.toLowerCase().replace(/\s*\(.*\)\s*$/, ''),
      );
      const cls: RegionClass = explicit ?? (pullOnlyKnown ? 'pull-only' : 'pushable');
      cur = { heading, cls, body: '' };
      pendingMarker = null;
      continue;
    }
    // Non-heading, non-marker line: belongs to the current region (or dropped
    // as pre-first-## preamble).
    if (cur) buf.push(line);
    pendingMarker = null; // a marker only binds to an immediately-following ##
  }
  flush();
  return regions;
}

/**
 * The push payload: the concatenated pushable regions, in document order,
 * rendered back to the Markdown that becomes the Confluence body (§2, Phase 4).
 */
export function pushablePayload(body: string): string {
  return partitionRegions(body)
    .filter((r) => r.cls === 'pushable')
    .map((r) => `## ${r.heading}\n\n${r.body}`.trimEnd())
    .join('\n\n');
}

/** Hash of the pushable slice only — the push-diff key (§2). */
export function hashPushable(body: string): string {
  return sha256(pushablePayload(body));
}

// ---- per-space tree hash (§4) ----------------------------------------------

export interface TreeRosterEntry {
  pageId: string;
  remoteLastModified: string | null;
  ancestors: string[];
}

/**
 * Hash of the sorted (pageId, remoteLastModified, ancestors) roster — detects a
 * structural change (page added / moved / remotely-modified) without re-pulling
 * every body (§4). Sorted numeric-aware by pageId for stability; ancestors are
 * joined in document order (a move changes the ancestor chain → changes hash).
 * Matches manifest.schema.json spaceManifest.treeHash definition.
 */
export function hashTree(roster: TreeRosterEntry[]): string {
  const canonical = [...roster]
    .sort((a, b) => cmpNumericKey(a.pageId, b.pageId))
    .map((e) => `${e.pageId}\t${e.remoteLastModified ?? ''}\t${e.ancestors.join('>')}`)
    .join('\n');
  return sha256(canonical);
}

/** Numeric-aware compare for pageId-like keys (so "9" sorts before "10"). */
export function cmpNumericKey(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---- self-test -------------------------------------------------------------

if (process.argv[2] === '--selftest') {
  const body = [
    '# Party Credentials — NTB POBO',
    '',
    '<!-- pushable -->',
    '## Overview',
    'How we create temporary credentials.',
    '',
    '## Steps',
    '1. Request a token.',
    '',
    '```macro',
    '<!-- macro:jira key=PCON-1 -->',
    '## Not A Heading (inside macro)',
    '```',
    '',
    '<!-- pull-only -->',
    '## Comments',
    '- **qaiser.abbas** 2026-08-01: looks good.',
    '',
    '## Metadata',
    '- Labels: party-credentials',
  ].join('\n');

  const regions = partitionRegions(body);
  const byName = Object.fromEntries(regions.map((r) => [r.heading, r.cls]));
  const assert = (cond: boolean, msg: string) => {
    if (!cond) {
      console.error(`❌ ${msg}`);
      process.exit(1);
    }
    console.log(`✅ ${msg}`);
  };

  assert(byName['Overview'] === 'pushable', 'Overview is pushable (explicit marker)');
  assert(byName['Steps'] === 'pushable', 'Steps is pushable (authored prose default)');
  assert(byName['Comments'] === 'pull-only', 'Comments is pull-only (known heading)');
  assert(byName['Metadata'] === 'pull-only', 'Metadata is pull-only (known heading)');
  assert(
    !Object.keys(byName).includes('Not A Heading (inside macro)'),
    'a ## inside a macro fence is NOT parsed as a region',
  );

  const payload = pushablePayload(body);
  assert(payload.includes('How we create temporary credentials.'), 'payload includes overview');
  assert(payload.includes('1. Request a token.'), 'payload includes steps');
  assert(!payload.includes('looks good'), 'payload excludes pull-only comments');
  assert(!payload.includes('party-credentials'), 'payload excludes pull-only metadata');
  assert(payload.includes('macro:jira'), 'macro fence travels inside its pushable region verbatim');

  // A comment-only edit changes whole-body hash but not the pushable hash.
  const edited = body.replace('looks good', 'needs work');
  assert(
    hashBody(edited) !== hashBody(body),
    'comment edit changes whole-body hash (→ local-ahead)',
  );
  assert(
    hashPushable(edited) === hashPushable(body),
    'comment edit does NOT change pushable hash (→ empty push diff)',
  );

  // treeHash: order-independent over input, stable across equal rosters; a
  // remoteLastModified change or a move changes it.
  const rosterA: TreeRosterEntry[] = [
    { pageId: '10', remoteLastModified: 'Jul 30, 2026 02:00', ancestors: ['1', '2'] },
    { pageId: '9', remoteLastModified: 'Jul 01, 2026 09:00', ancestors: ['1'] },
  ];
  const rosterB: TreeRosterEntry[] = [
    { pageId: '9', remoteLastModified: 'Jul 01, 2026 09:00', ancestors: ['1'] },
    { pageId: '10', remoteLastModified: 'Jul 30, 2026 02:00', ancestors: ['1', '2'] },
  ];
  assert(hashTree(rosterA) === hashTree(rosterB), 'treeHash is input-order independent');
  const bumped = rosterA.map((e) =>
    e.pageId === '10' ? { ...e, remoteLastModified: 'Jul 31, 2026 10:00' } : e,
  );
  assert(hashTree(bumped) !== hashTree(rosterA), 'a remoteLastModified change changes treeHash');
  const moved = rosterA.map((e) => (e.pageId === '10' ? { ...e, ancestors: ['1'] } : e));
  assert(hashTree(moved) !== hashTree(rosterA), 'a page move changes treeHash');
  assert(cmpNumericKey('9', '10') < 0, 'numeric-aware key sort: 9 < 10');

  // A null remoteLastModified must not collide with any real string via the
  // `?? ''` fallback (an empty string is not a valid Confluence timestamp).
  const nullEntry = rosterA.map((e) =>
    e.pageId === '10' ? { ...e, remoteLastModified: null } : e,
  );
  assert(
    hashTree(nullEntry) !== hashTree(rosterA),
    'null remoteLastModified hashes differently from a real string (no false collision)',
  );

  console.log('\nhash.ts self-test passed.');
}
