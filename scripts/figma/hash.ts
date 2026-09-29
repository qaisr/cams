#!/usr/bin/env tsx
/*
 * hash.ts — SHA-256 utilities for the Figma mirror's change-detection
 * machinery (Plan 02, Phase 0 — the shared hashing utility every hashing
 * consumer reuses: Phase 3 sync, Phase 6 token drift).
 *
 * Three independent hashes are stored per tracked node (figmaNodeMeta):
 *
 *   1. renderHash    — a BYTE hash of the exported render (PNG/SVG bytes).
 *                      A pixel change ⇒ the render drifted from code.
 *   2. structureHash — an ORDER-INDEPENDENT hash of the node subtree
 *                      structure. Canonical-JSON serialisation with sorted
 *                      object keys, so a Figma API reorder of sibling props
 *                      does NOT flip the hash — only a real structural change
 *                      does.
 *   3. localEditsHash — an LF-normalised TEXT hash of code-side edits /
 *                      annotations, so a CRLF/LF flip on a hand-edit is not
 *                      mistaken for a change (mirrors scripts/jira/hash.ts).
 *
 * Pure functions, no I/O. Node crypto only — no new deps. Importable by the
 * Phase 3 sync commands and unit-testable in isolation. Run directly for a
 * quick self-check:
 *   tsx scripts/figma/hash.ts --selftest
 */

import { createHash } from 'node:crypto';

const PREFIX = 'sha256:';

/** sha256:<hex> of raw bytes (no normalisation) — the render hash primitive. */
function digestBytes(bytes: Uint8Array): string {
  return PREFIX + createHash('sha256').update(bytes).digest('hex');
}

/** sha256:<hex> of a string, normalised to LF line endings so a CRLF/LF flip
 *  on a hand-edit is not mistaken for a content change. */
export function sha256(input: string): string {
  const normalized = input.replace(/\r\n/g, '\n');
  return PREFIX + createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Hash of an exported render. Renders are binary (PNG/SVG bytes), so this is a
 * pure byte-hash — any pixel/byte change flips the hash (§change-detection).
 * A UTF-8 string (e.g. an SVG source) is hashed as its LF-normalised text so
 * an incidental line-ending flip is not treated as a render change.
 */
export function renderHash(bytes: Uint8Array | string): string {
  return typeof bytes === 'string' ? sha256(bytes) : digestBytes(bytes);
}

/**
 * Canonical, deterministic JSON serialisation: object keys are sorted at every
 * depth so the output is independent of key insertion order. Arrays keep their
 * order (list order is meaningful for a node's children). Used only to feed
 * structureHash — never for storage.
 */
export function canonicalize(value: unknown): string {
  const seen = new WeakSet<object>();
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) throw new Error('canonicalize: circular reference');
    seen.add(v);
    if (Array.isArray(v)) return v.map(walk);
    const obj = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) out[key] = walk(obj[key]);
    return out;
  };
  return JSON.stringify(walk(value));
}

/**
 * Order-independent hash of a node subtree structure. Two subtrees that differ
 * only in object-key ordering hash identically; any real structural change
 * (added/removed/renamed field, changed value, reordered children) flips it.
 */
export function structureHash(node: unknown): string {
  return sha256(canonicalize(node));
}

/**
 * Hash of code-side edits / annotations, LF-normalised. Differs from the value
 * last written by sync ⇒ a human hand-edit ⇒ sync must not clobber it.
 */
export function localEditsHash(text: string): string {
  return sha256(text);
}

// ---- self-test -------------------------------------------------------------

if (process.argv[2] === '--selftest') {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) {
      console.error(`❌ ${msg}`);
      process.exit(1);
    }
    console.log(`✅ ${msg}`);
  };

  // determinism — same input → same hash
  const struct = { id: '299:12006', children: [{ a: 1 }, { b: 2 }], name: 'Button' };
  assert(structureHash(struct) === structureHash(struct), 'structureHash is deterministic');
  assert(localEditsHash('hello') === localEditsHash('hello'), 'localEditsHash is deterministic');
  assert(
    renderHash(Buffer.from([1, 2, 3])) === renderHash(Buffer.from([1, 2, 3])),
    'renderHash is deterministic',
  );

  // structure order-independence — key reorder → same hash
  const reordered = { name: 'Button', children: [{ a: 1 }, { b: 2 }], id: '299:12006' };
  assert(
    structureHash(struct) === structureHash(reordered),
    'structureHash is order-independent (key reorder → same hash)',
  );

  // array order IS significant (child order matters)
  const childrenSwapped = { id: '299:12006', name: 'Button', children: [{ b: 2 }, { a: 1 }] };
  assert(
    structureHash(struct) !== structureHash(childrenSwapped),
    'structureHash is sensitive to child (array) reordering',
  );

  // structure change → different hash
  const changed = { ...struct, name: 'Link' };
  assert(structureHash(struct) !== structureHash(changed), 'structureHash detects a field change');

  // render byte sensitivity
  assert(
    renderHash(Buffer.from([1, 2, 3])) !== renderHash(Buffer.from([1, 2, 4])),
    'renderHash detects a byte change',
  );

  // localEdits LF-normalisation — CRLF/LF flip does NOT change the hash
  assert(
    localEditsHash('a\r\nb') === localEditsHash('a\nb'),
    'localEditsHash normalises CRLF → LF (no false change)',
  );
  // but a real text change DOES
  assert(localEditsHash('a\nb') !== localEditsHash('a\nc'), 'localEditsHash detects a text change');

  // shape of the output
  assert(/^sha256:[0-9a-f]{64}$/.test(structureHash(struct)), 'hash matches sha256:<hex> form');

  console.log('\nhash.ts self-test passed.');
}
