#!/usr/bin/env tsx
/*
 * reindex.ts — deterministic, OFFLINE rollup of the Confluence mirror into
 * confluence/_index.json (plan 01c Phase 3 §6). Twin of scripts/jira/reindex.ts,
 * adapted for the Confluence four-layer state model.
 *
 * WHY a script (not just inline): both `/confluence reindex` and the `/confluence
 * pull` pipeline (Step 6 — "reindex the affected subtree") need the exact same
 * rollup. Extracting it here removes the duplication — the router runs this via
 * `node_modules/.bin/tsx scripts/confluence/reindex.ts`.
 *
 * Contract (every invariant is load-bearing — see the schema `index` def):
 *   - PURE / OFFLINE. Reads the item sidecars + per-space manifests on disk. NO
 *     network — never re-queries Confluence. Rewrites confluence/_index.json only.
 *   - `generatedAt` = now (the one field a rebuild always moves).
 *   - `lastSyncedAt` = the NEWEST real-pull time across the mirror, carried
 *     through from the sidecars/prior index — a reindex is NOT a sync and must
 *     never set it to now() (§3.1 two-timestamp invariant). null if nothing has
 *     ever been pulled.
 *   - SIDECAR WINS on any sidecar↔manifest↔index disagreement.
 *   - Items whose status_sync is `orphaned` are EXCLUDED from `items` and their
 *     keys are pruned from any space tree edges (dangling-edge prune); their
 *     {SPACE}-{pageId} keys are listed in `orphans[]`.
 *
 * The `now` timestamp is injected (arg / env) so the rollup is deterministic and
 * unit-testable; there is no Date.now() in the pure path.
 *
 *   Run:       tsx scripts/confluence/reindex.ts [--now <iso>] [--root <dir>]
 *   Self-test: tsx scripts/confluence/reindex.ts --selftest
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// ---- shapes (subset of manifest.schema.json we consume/emit) ----------------

type StatusSync = 'clean' | 'remote-ahead' | 'local-ahead' | 'diverged' | 'new' | 'orphaned';
type ContentType = 'page' | 'blogpost';

interface ItemSidecar {
  source: 'confluence';
  pageId: string;
  spaceKey: string;
  type: ContentType;
  title: string;
  url: string;
  ancestors?: string[];
  labels?: string[];
  remoteLastModified: string | null;
  contentHash: string;
  localEditsHash: string;
  status_sync: StatusSync;
  lastSyncedAt: string | null;
  commentsPulled?: boolean;
  sourceRef?: string | null;
}

interface SpaceManifest {
  source: 'confluence';
  spaceKey: string;
  name?: string | null;
  url?: string | null;
  treeHash: string;
  lastSyncedAt?: string | null;
  items: Array<{
    pageId: string;
    type: ContentType;
    file: string;
    title: string;
    ancestors?: string[];
    remoteLastModified?: string | null;
  }>;
}

interface IndexItem {
  pageId: string;
  spaceKey: string;
  type: ContentType;
  title: string;
  labels?: string[];
  ancestors?: string[];
  status_sync?: StatusSync;
  file: string;
}

/** _index.json.tree: space key → { name, roots[] }, plus pageId → children[]. */
export type IndexTree = Record<string, { name?: string | null; roots: string[] } | string[]>;

export interface ConfluenceIndex {
  $schema?: string;
  generatedAt: string;
  lastSyncedAt: string | null;
  counts: Record<string, number>;
  items: IndexItem[];
  tree: IndexTree;
  orphans: string[];
}

export interface ReindexInput {
  /** Parsed item sidecars (from confluence/{pages,blogposts}/*.json). `file` is
   *  the repo-relative POSIX sidecar path. */
  sidecars: Array<{ file: string; data: ItemSidecar }>;
  /** Parsed per-space manifests (from confluence/spaces/*.json). */
  spaces: Array<{ data: SpaceManifest }>;
  /** The existing index (only for $schema passthrough), or null. */
  prior: ConfluenceIndex | null;
  /** Injected timestamp — the ONLY thing that moves on a rebuild. */
  now: string;
}

// ---- the pure rollup (deterministic; no I/O, no clock) ----------------------

/** Item key {SPACE}-{pageId}. */
export function itemKey(spaceKey: string, pageId: string): string {
  return `${spaceKey}-${pageId}`;
}

/**
 * Roll item sidecars + per-space manifests into the schema `index` shape. Pure:
 * same input → same output. Enforces every invariant in the file header.
 */
export function rollup(input: ReindexInput): ConfluenceIndex {
  // Sidecar wins: the canonical per-item record is the sidecar. An orphaned
  // sidecar is excluded from items and recorded in orphans[].
  const orphanKeys = new Set<string>();
  const liveByKey = new Map<string, { file: string; data: ItemSidecar }>();

  for (const rec of input.sidecars) {
    const key = itemKey(rec.data.spaceKey, rec.data.pageId);
    if (rec.data.status_sync === 'orphaned') {
      orphanKeys.add(key);
      continue;
    }
    liveByKey.set(key, rec);
  }

  const items: IndexItem[] = [];
  const counts: Record<string, number> = {};

  for (const { file, data } of liveByKey.values()) {
    const item: IndexItem = {
      pageId: data.pageId,
      spaceKey: data.spaceKey,
      type: data.type,
      title: data.title,
      ...(data.labels?.length ? { labels: [...data.labels] } : {}),
      ...(data.ancestors?.length ? { ancestors: [...data.ancestors] } : {}),
      status_sync: data.status_sync,
      file,
    };
    items.push(item);
    counts[data.type] = (counts[data.type] ?? 0) + 1;
  }

  // Tree: one entry per space ({ name, roots[] }) + one entry per live page
  // (pageId → children[]), derived from the per-space manifest rosters. Orphan
  // edges are pruned (dangling-edge prune).
  const tree: IndexTree = {};
  for (const { data } of input.spaces) {
    const live = data.items.filter((it) => !orphanKeys.has(itemKey(data.spaceKey, it.pageId)));
    const liveIds = new Set(live.map((it) => it.pageId));

    // roots = pages whose immediate parent (last ancestor) is NOT in this space
    // roster (top of the mirrored subtree).
    const roots: string[] = [];
    const childrenOf = new Map<string, string[]>();
    for (const it of live) childrenOf.set(it.pageId, []);

    for (const it of live) {
      const anc = it.ancestors ?? [];
      const parent = anc.length ? anc[anc.length - 1] : null;
      if (parent && liveIds.has(parent)) {
        childrenOf.get(parent)!.push(it.pageId);
      } else {
        roots.push(it.pageId);
      }
    }

    tree[data.spaceKey] = {
      name: data.name ?? null,
      roots: [...roots].sort(cmpNumericKey),
    };
    for (const [pid, kids] of childrenOf) {
      tree[pid] = [...kids].sort(cmpNumericKey);
    }
  }

  // lastSyncedAt = the newest real pull across the mirror (sidecars +
  // per-space manifests). Carried through — reindex NEVER sets it to now().
  const lastSyncedAt = newestLastSynced(input);

  // Deterministic ordering so the file diff is stable across runs regardless of
  // directory-read order.
  items.sort((a, b) => cmpKey(itemKey(a.spaceKey, a.pageId), itemKey(b.spaceKey, b.pageId)));
  const orphans = [...orphanKeys].sort(cmpKey);
  const sortedCounts: Record<string, number> = {};
  for (const k of Object.keys(counts).sort()) sortedCounts[k] = counts[k];
  const sortedTree = sortTree(tree);

  return {
    $schema: input.prior?.$schema ?? './manifest.schema.json',
    generatedAt: input.now, // the one field a rebuild always moves
    lastSyncedAt, // preserved from newest pull — reindex ≠ sync
    counts: sortedCounts,
    items,
    tree: sortedTree,
    orphans,
  };
}

/** Newest lastSyncedAt across sidecars + space manifests (null if none). ISO-8601
 *  timestamps compare correctly as strings; nulls are ignored. */
function newestLastSynced(input: ReindexInput): string | null {
  let best: string | null = null;
  const consider = (t: string | null | undefined) => {
    if (t && (best === null || t > best)) best = t;
  };
  for (const { data } of input.sidecars) consider(data.lastSyncedAt);
  for (const { data } of input.spaces) consider(data.lastSyncedAt);
  return best;
}

/** Stable key ordering for the tree object: space keys and page ids both sorted,
 *  space entries and page-children entries kept as they are (values already
 *  sorted by the caller). */
function sortTree(tree: IndexTree): IndexTree {
  const out: IndexTree = {};
  for (const k of Object.keys(tree).sort(cmpKey)) out[k] = tree[k];
  return out;
}

/** Compare {SPACE}-{pageId} keys: same space → numeric-aware on pageId; else
 *  lexicographic on the whole key. */
function cmpKey(a: string, b: string): number {
  const ma = a.match(/^([A-Za-z][A-Za-z0-9]*)-(\d+)$/);
  const mb = b.match(/^([A-Za-z][A-Za-z0-9]*)-(\d+)$/);
  if (ma && mb && ma[1] === mb[1]) return Number(ma[2]) - Number(mb[2]);
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Numeric-aware compare for bare pageId-like keys (so "9" sorts before "10"). */
export function cmpNumericKey(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---- I/O layer (impure; reads the tree, calls the pure rollup) --------------

const TYPE_FOLDERS = ['pages', 'blogposts'] as const;

/** Read every sidecar/manifest under `root/confluence`, run the rollup, write index. */
export function reindex(root: string, now: string): { index: ConfluenceIndex; indexPath: string } {
  const dir = join(root, 'confluence');
  const indexPath = join(dir, '_index.json');
  const prior: ConfluenceIndex | null = existsSync(indexPath)
    ? (JSON.parse(readFileSync(indexPath, 'utf8')) as ConfluenceIndex)
    : null;

  const sidecars: ReindexInput['sidecars'] = [];
  for (const folder of TYPE_FOLDERS) {
    const folderDir = join(dir, folder);
    if (!existsSync(folderDir)) continue;
    for (const name of readdirSync(folderDir)) {
      if (!name.endsWith('.json')) continue;
      const abs = join(folderDir, name);
      const data = JSON.parse(readFileSync(abs, 'utf8')) as ItemSidecar;
      sidecars.push({ file: relPosix(root, abs), data });
    }
  }

  const spaces: ReindexInput['spaces'] = [];
  const spacesDir = join(dir, 'spaces');
  if (existsSync(spacesDir)) {
    for (const name of readdirSync(spacesDir)) {
      if (!name.endsWith('.json')) continue;
      const abs = join(spacesDir, name);
      const data = JSON.parse(readFileSync(abs, 'utf8')) as SpaceManifest;
      spaces.push({ data });
    }
  }

  const index = rollup({ sidecars, spaces, prior, now });
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf8');
  return { index, indexPath };
}

/** Path relative to repo root, forced to POSIX separators (stable in JSON). */
function relPosix(root: string, abs: string): string {
  return (relative(root, abs).split(sep) as string[]).join('/');
}

// ---- CLI --------------------------------------------------------------------

function parseNow(argv: string[]): string {
  const i = argv.indexOf('--now');
  const nowArg = argv[i + 1] as string | undefined;
  if (i !== -1 && nowArg) return nowArg;
  const env: string | undefined = process.env.CONFLUENCE_REINDEX_NOW;
  if (env) return env;
  // Only the CLI entry point reads the wall clock; the pure rollup never does.
  return new Date().toISOString();
}

function parseRoot(argv: string[]): string {
  const i = argv.indexOf('--root');
  const rootArg = argv[i + 1] as string | undefined;
  if (i !== -1 && rootArg) return rootArg;
  return process.cwd() as string;
}

if (process.argv[2] === '--selftest') {
  runSelfTest();
} else if (process.argv[1] && process.argv[1].endsWith('reindex.ts')) {
  const now = parseNow(process.argv);
  const root = parseRoot(process.argv);
  const { index, indexPath } = reindex(root, now);
  console.log(
    `reindex → ${indexPath}: ${index.items.length} items, ` +
      `${index.orphans.length} orphans, generatedAt=${index.generatedAt}, ` +
      `lastSyncedAt=${index.lastSyncedAt} (unchanged by reindex)`,
  );
}

// ---- self-test (same style as hash.ts / mcp-client.ts / converter.ts) -------

function runSelfTest(): void {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) {
      console.error(`❌ ${msg}`);
      process.exit(1);
    }
    console.log(`✅ ${msg}`);
  };

  const mkSidecar = (over: Partial<ItemSidecar>): ItemSidecar => ({
    source: 'confluence',
    pageId: '0',
    spaceKey: 'PCON',
    type: 'page',
    title: 't',
    url: 'https://commbank.atlassian.net/wiki/x',
    remoteLastModified: 'Jul 30, 2026 02:00',
    contentHash: 'sha256:' + 'a'.repeat(64),
    localEditsHash: 'sha256:' + 'a'.repeat(64),
    status_sync: 'clean',
    lastSyncedAt: null,
    ...over,
  });

  const sidecars: ReindexInput['sidecars'] = [
    {
      file: 'confluence/pages/PCON-100.json',
      data: mkSidecar({
        pageId: '100',
        title: 'Root page',
        ancestors: [],
        labels: ['admin-hub'],
        lastSyncedAt: '2026-07-31T09:00:00.000Z',
      }),
    },
    {
      file: 'confluence/pages/PCON-2042342654.json',
      data: mkSidecar({
        pageId: '2042342654',
        title: 'Child page',
        ancestors: ['100'],
        status_sync: 'local-ahead',
        lastSyncedAt: '2026-08-01T09:00:00.000Z', // newest
      }),
    },
    {
      file: 'confluence/pages/PCON-99.json',
      data: mkSidecar({
        pageId: '99',
        title: 'Gone from remote',
        ancestors: ['100'],
        status_sync: 'orphaned',
        lastSyncedAt: '2026-07-30T09:00:00.000Z',
      }),
    },
    {
      file: 'confluence/blogposts/SEC-500.json',
      data: mkSidecar({
        pageId: '500',
        spaceKey: 'SEC',
        type: 'blogpost',
        title: 'A blogpost',
        lastSyncedAt: '2026-07-29T09:00:00.000Z',
      }),
    },
  ];

  const spaces: ReindexInput['spaces'] = [
    {
      data: {
        source: 'confluence',
        spaceKey: 'PCON',
        name: 'Party Credentials',
        treeHash: 'sha256:' + 'b'.repeat(64),
        lastSyncedAt: '2026-08-01T09:00:00.000Z',
        items: [
          {
            pageId: '100',
            type: 'page',
            file: 'confluence/pages/PCON-100.json',
            title: 'Root page',
            ancestors: [],
            remoteLastModified: 'Jul 30, 2026 02:00',
          },
          {
            pageId: '2042342654',
            type: 'page',
            file: 'confluence/pages/PCON-2042342654.json',
            title: 'Child page',
            ancestors: ['100'],
            remoteLastModified: 'Jul 30, 2026 02:00',
          },
          {
            pageId: '99',
            type: 'page',
            file: 'confluence/pages/PCON-99.json',
            title: 'Gone',
            ancestors: ['100'],
            remoteLastModified: 'Jul 30, 2026 02:00',
          },
        ],
      },
    },
    {
      data: {
        source: 'confluence',
        spaceKey: 'SEC',
        name: 'Security',
        treeHash: 'sha256:' + 'c'.repeat(64),
        lastSyncedAt: '2026-07-29T09:00:00.000Z',
        items: [
          {
            pageId: '500',
            type: 'blogpost',
            file: 'confluence/blogposts/SEC-500.json',
            title: 'A blogpost',
            ancestors: [],
            remoteLastModified: 'Jul 30, 2026 02:00',
          },
        ],
      },
    },
  ];

  const prior: ConfluenceIndex = {
    $schema: './manifest.schema.json',
    generatedAt: '2026-07-01T00:00:00.000Z',
    lastSyncedAt: '2026-06-01T00:00:00.000Z', // stale prior — must be REPLACED by newest sidecar pull, not preserved-from-prior
    counts: {},
    items: [],
    tree: {},
    orphans: [],
  };

  const idx = rollup({ sidecars, spaces, prior, now: '2026-08-02T12:00:00.000Z' });

  // Two-timestamp invariant.
  assert(idx.generatedAt === '2026-08-02T12:00:00.000Z', 'generatedAt moves to injected now');
  assert(
    idx.lastSyncedAt === '2026-08-01T09:00:00.000Z',
    'lastSyncedAt = newest real pull across mirror (NOT now, NOT stale prior)',
  );

  // Orphan excluded from items + counts; recorded in orphans[]; pruned from tree.
  assert(!idx.items.some((i) => i.pageId === '99'), 'orphaned PCON-99 excluded from items');
  assert(idx.orphans.join(',') === 'PCON-99', 'orphans = [PCON-99]');
  assert(!(idx.tree['100'] as string[]).includes('99'), 'orphan edge pruned from parent children');
  assert(
    (idx.tree['100'] as string[]).join(',') === '2042342654',
    'parent keeps its live child only',
  );

  // Tree: space entry with roots; page entries with children.
  const pcon = idx.tree['PCON'] as { name?: string | null; roots: string[] };
  assert(pcon.roots.join(',') === '100', 'PCON root = page 100 (parent outside roster)');
  assert(pcon.name === 'Party Credentials', 'space tree carries the space name');
  assert(Array.isArray(idx.tree['2042342654']), 'leaf page has a (empty) children array');
  assert((idx.tree['2042342654'] as string[]).length === 0, 'leaf child has no children');

  // Counts reflect live (non-orphan) items across types.
  assert(idx.counts.page === 2, 'page count = 2 (orphan excluded)');
  assert(idx.counts.blogpost === 1, 'blogpost count = 1');

  // Items sorted numeric-aware within a space; SEC key ordering stable.
  const keys = idx.items.map((i) => itemKey(i.spaceKey, i.pageId));
  assert(keys.includes('PCON-100') && keys.includes('PCON-2042342654'), 'live PCON items present');
  assert(keys.includes('SEC-500'), 'SEC blogpost present in items');
  assert(
    keys.indexOf('PCON-100') < keys.indexOf('PCON-2042342654'),
    'PCON-100 sorts before PCON-2042342654 (numeric-aware)',
  );

  // Item metadata carried through from the sidecar (sidecar wins).
  const child = idx.items.find((i) => i.pageId === '2042342654')!;
  assert(child.status_sync === 'local-ahead', 'sidecar status_sync carried into index item');
  assert(
    child.file === 'confluence/pages/PCON-2042342654.json',
    'index item points at the sidecar',
  );
  const rootItem = idx.items.find((i) => i.pageId === '100')!;
  assert(rootItem.labels?.join(',') === 'admin-hub', 'labels carried through');

  // Determinism: same input → byte-identical output.
  const idx2 = rollup({ sidecars, spaces, prior, now: '2026-08-02T12:00:00.000Z' });
  assert(JSON.stringify(idx) === JSON.stringify(idx2), 'rollup is deterministic (stable output)');

  // Empty mirror → lastSyncedAt null.
  const fresh = rollup({ sidecars: [], spaces: [], prior: null, now: '2026-08-02T12:00:00.000Z' });
  assert(fresh.lastSyncedAt === null, 'empty mirror → lastSyncedAt null');
  assert(fresh.items.length === 0 && fresh.orphans.length === 0, 'empty mirror → empty rollup');

  // Reindex invariant restated: a reindex over an UNCHANGED mirror at a LATER
  // `now` moves generatedAt but leaves lastSyncedAt at the newest pull.
  const later = rollup({ sidecars, spaces, prior: idx, now: '2026-08-03T00:00:00.000Z' });
  assert(later.generatedAt === '2026-08-03T00:00:00.000Z', 'later reindex advances generatedAt');
  assert(
    later.lastSyncedAt === idx.lastSyncedAt,
    'later reindex leaves lastSyncedAt unchanged (invariant proven)',
  );

  console.log('\nreindex.ts self-test passed.');
}
