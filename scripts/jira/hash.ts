#!/usr/bin/env tsx
/*
 * hash.ts — SHA-256 utilities for the JIRA mirror's change-detection and
 * push-diff machinery (plan 01a §2.2, §2.4).
 *
 * Two independent uses of hashing:
 *
 *   1. Whole-body change detection (§2.2). The sidecar stores two hashes of the
 *      SAME .md body:
 *        - contentHash    = body as last written by an ingest/sync
 *        - localEditsHash = body as it currently sits on disk
 *      They differ ⇒ a human hand-edited the mirror ⇒ sync must not clobber it.
 *      Both are computed by hashBody() over the FULL body.
 *
 *   2. Push-diff payload (§2.4). Feature A pushes only the PUSHABLE regions
 *      (## Description, ## Acceptance Criteria). hashPushable() hashes just that
 *      slice, so a status-only hand-edit (pull-only region) marks the item
 *      local-ahead (whole-body hash changed) yet yields an empty pushable diff.
 *
 * The childrenHash (§2.3) is a hash of the sorted (key, remoteUpdatedAt) roster
 * — hashRoster() below.
 *
 * Pure functions, no I/O. Importable by converter.ts / sync commands and
 * unit-testable in isolation. Run directly for a quick self-check:
 *   tsx scripts/jira/hash.ts --selftest
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
 * We trim a single trailing newline so an editor that (un)adds one doesn't
 * flip the hash, but preserve all interior whitespace (it is meaningful in
 * verbatim comment bodies — R1).
 */
export function hashBody(body: string): string {
  return sha256(body.replace(/\n+$/, '\n'));
}

// ---- region partitioning (§2.4) --------------------------------------------

export type RegionClass = 'pushable' | 'pull-only';

export interface Region {
  heading: string; // the ## heading text, e.g. "Description"
  cls: RegionClass;
  body: string; // content under the heading (excludes the heading line)
}

const PUSHABLE_HEADINGS = new Set(['description', 'acceptance criteria']);

/**
 * Split a mirror .md body into ## regions and classify each (§2.4).
 *
 * Classification precedence:
 *   1. An explicit <!-- pushable --> / <!-- pull-only --> marker on the line(s)
 *      immediately preceding a ## heading is authoritative.
 *   2. Otherwise, known headings (## Description, ## Acceptance Criteria) are
 *      pushable; EVERYTHING else defaults to pull-only (fail-safe — never push
 *      a section we don't recognise).
 *
 * The leading `# {KEY}: title` H1 and any preamble before the first ## is
 * treated as pull-only preamble (not pushed).
 */
export function partitionRegions(body: string): Region[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const regions: Region[] = [];

  let pendingMarker: RegionClass | null = null;
  let cur: Region | null = null;
  const buf: string[] = [];

  const flush = () => {
    if (cur) {
      cur.body = buf.join('\n').replace(/^\n+|\n+$/g, '');
      regions.push(cur);
    }
    buf.length = 0;
  };

  for (const line of lines) {
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
      const known = PUSHABLE_HEADINGS.has(heading.toLowerCase().replace(/\s*\(.*\)\s*$/, ''));
      const cls: RegionClass = explicit ?? (known ? 'pushable' : 'pull-only');
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
 * rendered back to the Markdown that becomes the JIRA description (§2.4, §8.2).
 * AC checkboxes travel with the description.
 */
export function pushablePayload(body: string): string {
  return partitionRegions(body)
    .filter((r) => r.cls === 'pushable')
    .map((r) => `## ${r.heading}\n\n${r.body}`.trimEnd())
    .join('\n\n');
}

/** Hash of the pushable slice only — the push-diff key (§2.4). */
export function hashPushable(body: string): string {
  return sha256(pushablePayload(body));
}

// ---- children roster hash (§2.3) -------------------------------------------

/** Hash of the sorted (key, remoteUpdatedAt) roster — detects a child
 *  add/remove/update on epic sync (§2.3). */
export function hashRoster(children: Array<{ key: string; remoteUpdatedAt: string }>): string {
  const canonical = [...children]
    .map((c) => `${c.key}\t${c.remoteUpdatedAt}`)
    .sort()
    .join('\n');
  return sha256(canonical);
}

// ---- self-test -------------------------------------------------------------

if (process.argv[2] === '--selftest') {
  const body = [
    '# EON-1: sample',
    '',
    '<!-- pull-only -->',
    '## Status',
    'In Progress',
    '',
    '<!-- pushable -->',
    '## Description',
    'Hello world.',
    '',
    '## Acceptance Criteria',
    '- [ ] one',
    '',
    '<!-- pull-only -->',
    '## Links',
    '- Parent: EON-21',
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

  assert(byName['Status'] === 'pull-only', 'Status is pull-only (explicit marker)');
  assert(byName['Description'] === 'pushable', 'Description is pushable');
  assert(
    byName['Acceptance Criteria'] === 'pushable',
    'Acceptance Criteria is pushable (known heading, no marker)',
  );
  assert(byName['Links'] === 'pull-only', 'Links is pull-only (explicit marker)');

  const payload = pushablePayload(body);
  assert(payload.includes('Hello world.'), 'payload includes description');
  assert(payload.includes('- [ ] one'), 'payload includes ACs');
  assert(!payload.includes('In Progress'), 'payload excludes pull-only status');
  assert(!payload.includes('Parent: EON-21'), 'payload excludes pull-only links');

  // status-only edit changes whole-body hash but not the pushable hash
  const edited = body.replace('In Progress', 'Done');
  assert(
    hashBody(edited) !== hashBody(body),
    'status edit changes whole-body hash (→ local-ahead)',
  );
  assert(
    hashPushable(edited) === hashPushable(body),
    'status edit does NOT change pushable hash (→ empty push diff)',
  );

  console.log('\nhash.ts self-test passed.');
}
