#!/usr/bin/env tsx
/*
 * reindex.ts — deterministic, OFFLINE rollup of the Figma mirror into
 * figma/_index.json + figma/_designers.json (Plan 02, Phase 3 §3.3/§3.4/§6.1).
 *
 * WHY a script (not just inline): both `/figma reindex` and the `/sync-figma`
 * apply step need the exact same rollup. Extracting it here removes the
 * duplication — the `/figma` router runs this via `tsx scripts/figma/reindex.ts`.
 *
 * Contract (every invariant is load-bearing — see the schema `figmaIndex` def):
 *   - PURE / OFFLINE. Reads the node metas + per-file manifests + domain
 *     manifest on disk, and .claude/config/people.json for the designer
 *     projection. NO Figma reads — a reindex is never a sync.
 *   - `generatedAt` = now (the one field a rebuild always moves — D4).
 *   - `lastSyncedAt` is DERIVED from real pull state already on disk (the max
 *     non-null lastSyncedAt across the per-file manifests). A reindex reads it
 *     off disk but NEVER advances it — only a pull writes a newer manifest
 *     lastSyncedAt (D4 two-timestamp invariant). If nothing has ever been
 *     pulled, it is null.
 *   - SIDECAR WINS: every item field comes from the node meta; the index never
 *     invents state. The per-file manifest supplies only the page/frame tree.
 *   - Items whose sidecar reports status_sync "orphaned" are still listed (the
 *     sidecar remains after the remote node is gone) but bucketed under
 *     byStatus.orphaned, mirroring the sidecar-wins rule.
 *
 * `_designers.json` is a projection of people.json filtered to Figma-bearing
 * people (D8/FN12) — not a separate roster; regenerated here on every reindex.
 *
 * The `now` timestamp is injected (arg / env) so the rollup is deterministic and
 * unit-testable; there is no Date.now() in the pure path.
 *
 *   Run:       tsx scripts/figma/reindex.ts [--now <iso>] [--root <dir>]
 *   Self-test: tsx scripts/figma/reindex.ts --selftest
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// ---- shapes (subset of manifest.schema.json we consume/emit) ----------------

type Pipeline = 'A' | 'B' | 'C';
type StatusSync = 'clean' | 'render-ahead' | 'structure-ahead' | 'diverged' | 'new' | 'orphaned';
type BuildStatus = 'not-built' | 'partial' | 'built';
type HandshakeStatus = 'not-required' | 'pending' | 'cleared' | 'rejected';

/** figma/nodes/<slug>.meta.json — the authoritative per-node state (sidecar wins). */
interface NodeMeta {
  source: 'figma';
  nodeId: string;
  fileKey: string;
  name: string;
  pipeline: Pipeline;
  renderHash: string;
  structureHash: string;
  localEditsHash: string;
  status_sync: StatusSync;
  buildStatus: BuildStatus;
  handshakeStatus: HandshakeStatus;
  designer?: string | null;
  componentRef?: string | null;
  assets?: string[];
  artifacts?: Record<string, string>;
  lastSyncedAt: string | null;
  generatedAt: string;
}

/** figma/files/{fileKey}.json — page/frame roster + this file's last pull time. */
interface FileManifest {
  source: 'figma';
  fileKey: string;
  name: string;
  nodeTreeHash?: string;
  pages: Array<{ nodeId: string; name: string; frames?: string[] }>;
  nodes: Array<{
    nodeId: string;
    name: string;
    pipeline: Pipeline;
    file: string;
    status_sync: StatusSync;
  }>;
  lastSyncedAt: string | null;
}

/** .claude/config/people.json — the roster we project designers out of. */
interface Person {
  id: string;
  displayName?: string;
  aliases?: string[];
  figma?: string;
}

// ---- emitted shapes (figmaIndex / figmaDesigners) ---------------------------

interface IndexFile {
  fileKey: string;
  name: string;
  nodeCount: number;
  lastSyncedAt: string | null;
}

interface IndexItem {
  nodeId: string;
  fileKey: string;
  name: string;
  pipeline: Pipeline;
  status_sync: StatusSync;
  buildStatus: BuildStatus;
  handshakeStatus: HandshakeStatus;
  designer: string | null;
  file: string;
}

export interface FigmaIndex {
  generatedAt: string;
  lastSyncedAt: string | null;
  counts: Record<string, number>;
  files: IndexFile[];
  items: IndexItem[];
  frameTree: Record<string, Record<string, string[]>>;
  componentUsage: Record<string, string[]>;
  buildCoverage: { built: string[]; partial: string[]; 'not-built': string[] };
  mapsTo: Array<{ nodeId: string; componentRef: string }>;
  byPipeline: Record<string, string[]>;
  byDesigner: Record<string, string[]>;
  byStatus: Record<string, string[]>;
}

interface Designer {
  handle: string;
  name: string | null;
  aliases: string[];
  figma: string;
}

export interface FigmaDesigners {
  generatedAt: string;
  designers: Designer[];
}

export interface ReindexInput {
  /** Parsed node metas (from figma/nodes/*.meta.json), with their repo-relative path. */
  nodes: Array<{ file: string; data: NodeMeta }>;
  /** Parsed per-file manifests (from figma/files/*.json). */
  files: Array<{ data: FileManifest }>;
  /** people.json people[] — projected to designers[] filtered to Figma-bearers. */
  people: Person[];
  /** Injected timestamp — the ONLY thing that moves on a rebuild. */
  now: string;
}

// ---- the pure rollup (deterministic; no I/O, no clock) ----------------------

/**
 * Roll node metas + file manifests into the §3.3 figmaIndex shape. Pure: same
 * input → same output. Enforces every invariant in the file header.
 */
export function rollup(input: ReindexInput): FigmaIndex {
  // --- items come from node metas ONLY (sidecar wins) ---
  const items: IndexItem[] = input.nodes.map(({ file, data }) => ({
    nodeId: data.nodeId,
    fileKey: data.fileKey,
    name: data.name,
    pipeline: data.pipeline,
    status_sync: data.status_sync,
    buildStatus: data.buildStatus,
    handshakeStatus: data.handshakeStatus,
    designer: data.designer ?? null,
    file,
  }));
  items.sort((a, b) => cmpNode(a.nodeId, b.nodeId));

  // --- reverse-lookup buckets ---
  const byPipeline: Record<string, string[]> = {};
  const byDesigner: Record<string, string[]> = {};
  const byStatus: Record<string, string[]> = {};
  const buildCoverage: FigmaIndex['buildCoverage'] = {
    built: [],
    partial: [],
    'not-built': [],
  };
  const counts: Record<string, number> = {};

  const bump = (m: Record<string, number>, k: string) => {
    m[k] = (m[k] ?? 0) + 1;
  };

  for (const it of items) {
    (byPipeline[it.pipeline] ??= []).push(it.nodeId);
    (byStatus[it.status_sync] ??= []).push(it.nodeId);
    if (it.designer) (byDesigner[it.designer] ??= []).push(it.nodeId);
    buildCoverage[it.buildStatus].push(it.nodeId);

    // Aggregate counts (namespaced so pipeline/status/build never collide).
    bump(counts, 'nodes');
    bump(counts, `pipeline:${it.pipeline}`);
    bump(counts, `status:${it.status_sync}`);
    bump(counts, `build:${it.buildStatus}`);
  }

  // --- files summary + frameTree (from per-file manifests) ---
  const files: IndexFile[] = [];
  const frameTree: FigmaIndex['frameTree'] = {};
  const nodesByFile = new Map<string, number>();
  for (const it of items) nodesByFile.set(it.fileKey, (nodesByFile.get(it.fileKey) ?? 0) + 1);

  for (const { data } of input.files) {
    files.push({
      fileKey: data.fileKey,
      name: data.name,
      nodeCount: nodesByFile.get(data.fileKey) ?? data.nodes.length,
      lastSyncedAt: data.lastSyncedAt,
    });
    const perPage: Record<string, string[]> = {};
    for (const page of data.pages) {
      perPage[page.nodeId] = [...(page.frames ?? [])].sort(cmpNode);
    }
    frameTree[data.fileKey] = perPage;
  }
  files.sort((a, b) => (a.fileKey < b.fileKey ? -1 : a.fileKey > b.fileKey ? 1 : 0));

  // --- lastSyncedAt: max non-null across per-file manifests (D4). NEVER
  //     advanced by a reindex — this only reads the pull state on disk. ---
  const lastSyncedAt = maxIso(input.files.map((f) => f.data.lastSyncedAt));

  return {
    generatedAt: input.now, // the one field a rebuild always moves
    lastSyncedAt, // derived from disk pull-state; never advanced here
    counts: sortObj(counts),
    files,
    items,
    frameTree: sortNestedTree(frameTree),
    componentUsage: {}, // populated by Phase-4 codegen
    buildCoverage: {
      built: [...buildCoverage.built].sort(cmpNode),
      partial: [...buildCoverage.partial].sort(cmpNode),
      'not-built': [...buildCoverage['not-built']].sort(cmpNode),
    },
    mapsTo: [], // populated by Phase-4 codegen
    byPipeline: sortBuckets(byPipeline),
    byDesigner: sortBuckets(byDesigner),
    byStatus: sortBuckets(byStatus),
  };
}

/**
 * Project people.json → figma/_designers.json: keep only people carrying a
 * `figma` handle (D8). Pure; deterministic (sorted by handle).
 */
export function projectDesigners(people: Person[], now: string): FigmaDesigners {
  const designers: Designer[] = people
    .filter((p) => typeof p.figma === 'string' && p.figma.length > 0)
    .map((p) => ({
      handle: p.id,
      name: p.displayName ?? null,
      aliases: [...(p.aliases ?? [])].sort(),
      figma: p.figma as string,
    }))
    .sort((a, b) => (a.handle < b.handle ? -1 : a.handle > b.handle ? 1 : 0));
  return { generatedAt: now, designers };
}

// ---- deterministic helpers --------------------------------------------------

/** Numeric-aware node-id compare so 299:2 sorts before 299:10. */
function cmpNode(a: string, b: string): number {
  const ma = a.match(/^(\d+):(\d+)$/);
  const mb = b.match(/^(\d+):(\d+)$/);
  if (ma && mb) {
    if (ma[1] !== mb[1]) return Number(ma[1]) - Number(mb[1]);
    return Number(ma[2]) - Number(mb[2]);
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortObj(m: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(m).sort()) out[k] = m[k];
  return out;
}

function sortBuckets(m: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const k of Object.keys(m).sort()) out[k] = [...m[k]].sort(cmpNode);
  return out;
}

function sortNestedTree(
  t: Record<string, Record<string, string[]>>,
): Record<string, Record<string, string[]>> {
  const out: Record<string, Record<string, string[]>> = {};
  for (const fk of Object.keys(t).sort()) {
    const inner: Record<string, string[]> = {};
    for (const page of Object.keys(t[fk]).sort(cmpNode))
      inner[page] = [...t[fk][page]].sort(cmpNode);
    out[fk] = inner;
  }
  return out;
}

/** Max ISO-8601 string among the non-null values, else null. */
function maxIso(values: Array<string | null>): string | null {
  let best: string | null = null;
  for (const v of values) {
    if (v == null) continue;
    if (best === null || v > best) best = v;
  }
  return best;
}

// ---- I/O layer (impure; reads the tree, calls the pure rollup) --------------

/** Read every node meta / file manifest under `root/figma` + people.json, roll up, write both derived files. */
export function reindex(
  root: string,
  now: string,
): { index: FigmaIndex; designers: FigmaDesigners; indexPath: string; designersPath: string } {
  const figmaDir = join(root, 'figma');
  const indexPath = join(figmaDir, '_index.json');
  const designersPath = join(figmaDir, '_designers.json');

  // Node metas: figma/nodes/*.meta.json
  const nodes: ReindexInput['nodes'] = [];
  const nodesDir = join(figmaDir, 'nodes');
  if (existsSync(nodesDir) && statSync(nodesDir).isDirectory()) {
    for (const name of readdirSync(nodesDir).sort()) {
      if (!name.endsWith('.meta.json')) continue;
      const abs = join(nodesDir, name);
      const data = JSON.parse(readFileSync(abs, 'utf8')) as NodeMeta;
      nodes.push({ file: relPosix(root, abs), data });
    }
  }

  // Per-file manifests: figma/files/*.json
  const files: ReindexInput['files'] = [];
  const filesDir = join(figmaDir, 'files');
  if (existsSync(filesDir) && statSync(filesDir).isDirectory()) {
    for (const name of readdirSync(filesDir).sort()) {
      if (!name.endsWith('.json')) continue;
      const abs = join(filesDir, name);
      const data = JSON.parse(readFileSync(abs, 'utf8')) as FileManifest;
      files.push({ data });
    }
  }

  // people.json → designer projection
  const people = readPeople(root);

  const index = rollup({ nodes, files, people, now });
  const designers = projectDesigners(people, now);

  writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf8');
  writeFileSync(designersPath, JSON.stringify(designers, null, 2) + '\n', 'utf8');
  return { index, designers, indexPath, designersPath };
}

function readPeople(root: string): Person[] {
  const p = join(root, '.claude', 'config', 'people.json');
  if (!existsSync(p)) return [];
  const parsed = JSON.parse(readFileSync(p, 'utf8')) as { people?: Person[] };
  return parsed.people ?? [];
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
  const env: string | undefined = process.env.FIGMA_REINDEX_NOW;
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
  const { index, designers, indexPath, designersPath } = reindex(root, now);
  console.log(
    `reindex → ${indexPath}: ${index.items.length} nodes across ${index.files.length} files, ` +
      `generatedAt=${index.generatedAt}, lastSyncedAt=${index.lastSyncedAt}`,
  );
  console.log(
    `reindex → ${designersPath}: ${designers.designers.length} designers projected from people.json`,
  );
}

// ---- self-test (same style as hash.ts / jira reindex.ts) --------------------

function runSelfTest(): void {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) {
      console.error(`❌ ${msg}`);
      process.exit(1);
    }
    console.log(`✅ ${msg}`);
  };

  const h = (c: string) => 'sha256:' + c.repeat(64);

  const mkNode = (over: Partial<NodeMeta>): { file: string; data: NodeMeta } => ({
    file: `figma/nodes/${over.nodeId?.replace(':', '_') ?? 'x'}.meta.json`,
    data: {
      source: 'figma',
      nodeId: '299:12006',
      fileKey: '2MbwX0rxNA1uhgDwlC7Z6G',
      name: 'E2E flow',
      pipeline: 'B',
      renderHash: h('a'),
      structureHash: h('b'),
      localEditsHash: h('c'),
      status_sync: 'clean',
      buildStatus: 'not-built',
      handshakeStatus: 'not-required',
      designer: 'qaiser.abbas',
      lastSyncedAt: '2026-08-01T00:00:00.000Z',
      generatedAt: '2026-07-01T00:00:00.000Z',
      ...over,
    },
  });

  const nodes = [
    // built + cleared → a clean "built" (handshake gate satisfied).
    mkNode({
      nodeId: '299:12006',
      status_sync: 'clean',
      buildStatus: 'built',
      handshakeStatus: 'cleared',
    }),
    mkNode({
      nodeId: '299:2',
      status_sync: 'render-ahead',
      buildStatus: 'not-built',
      designer: null,
    }),
    // built + pending → representable in the index; coverage renders it as
    // "built (⚠ handshake pending)". Proves the Phase-5 vocab flows through.
    mkNode({
      nodeId: '299:10',
      status_sync: 'clean',
      buildStatus: 'built',
      handshakeStatus: 'pending',
      designer: 'qaiser.abbas',
    }),
  ];

  const files: ReindexInput['files'] = [
    {
      data: {
        source: 'figma',
        fileKey: '2MbwX0rxNA1uhgDwlC7Z6G',
        name: 'Future State Exploration',
        pages: [{ nodeId: '299:0', name: 'Page 1', frames: ['299:10', '299:2', '299:12006'] }],
        nodes: nodes.map((n) => ({
          nodeId: n.data.nodeId,
          name: n.data.name,
          pipeline: n.data.pipeline,
          file: n.file,
          status_sync: n.data.status_sync,
        })),
        lastSyncedAt: '2026-08-01T00:00:00.000Z',
      },
    },
  ];

  const people: Person[] = [
    {
      id: 'qaiser.abbas',
      displayName: 'Qaiser Abbas',
      aliases: ['qa', 'abbas'],
      figma: 'qaiser.abbas@ppcc.com.au',
    },
    { id: 'van.nguyen', displayName: 'Van Nguyen', aliases: ['van'] }, // no figma → excluded
  ];

  const idx = rollup({ nodes, files, people, now: '2026-08-02T12:00:00.000Z' });

  // Two-timestamp invariant.
  assert(idx.generatedAt === '2026-08-02T12:00:00.000Z', 'generatedAt moves to injected now');
  assert(
    idx.lastSyncedAt === '2026-08-01T00:00:00.000Z',
    'lastSyncedAt derived from file manifest, not advanced by reindex',
  );

  // Items come from sidecars, numeric-aware node sort (299:2 < 299:10 < 299:12006).
  assert(
    idx.items.map((i) => i.nodeId).join(',') === '299:2,299:10,299:12006',
    'items sorted numeric-aware by node id',
  );
  assert(
    idx.items.length === 3,
    'all 3 node metas become items (orphan still listed — sidecar wins)',
  );

  // Reverse buckets.
  assert(idx.byPipeline.B.length === 3, 'byPipeline B holds all 3 (all pipeline B)');
  assert(
    idx.byStatus.clean?.join(',') === '299:10,299:12006',
    'byStatus.clean = [299:10,299:12006]',
  );
  assert(idx.byStatus['render-ahead']?.join(',') === '299:2', 'byStatus.render-ahead = [299:2]');
  assert(
    idx.byDesigner['qaiser.abbas']?.join(',') === '299:10,299:12006',
    'byDesigner keyed by handle, null designer excluded',
  );
  assert(idx.byDesigner[''] === undefined, 'null designer not bucketed under empty key');

  // Build coverage buckets (299:10 and 299:12006 both built).
  assert(
    idx.buildCoverage.built.join(',') === '299:10,299:12006',
    'buildCoverage.built = [299:10,299:12006]',
  );
  assert(idx.buildCoverage.partial.length === 0, 'buildCoverage.partial empty');
  assert(idx.buildCoverage['not-built'].join(',') === '299:2', 'buildCoverage.not-built = [299:2]');

  // Handshake vocab flows through: built+cleared is clean; built+pending is
  // representable (coverage surfaces it as "built (⚠ handshake pending)").
  const byId = Object.fromEntries(idx.items.map((i) => [i.nodeId, i]));
  assert(byId['299:12006'].handshakeStatus === 'cleared', '299:12006 handshakeStatus = cleared');
  assert(byId['299:10'].handshakeStatus === 'pending', '299:10 handshakeStatus = pending');
  assert(byId['299:2'].handshakeStatus === 'not-required', '299:2 handshakeStatus = not-required');
  assert(
    byId['299:10'].buildStatus === 'built' && byId['299:10'].handshakeStatus === 'pending',
    'built + pending is representable in the index (⚠ handshake pending case)',
  );

  // Counts.
  assert(idx.counts.nodes === 3, 'counts.nodes = 3');
  assert(idx.counts['status:clean'] === 2, 'counts.status:clean = 2');
  assert(idx.counts['build:built'] === 2, 'counts.build:built = 2');

  // Files summary + frameTree.
  assert(idx.files.length === 1 && idx.files[0].nodeCount === 3, 'files[0].nodeCount = 3');
  assert(
    idx.frameTree['2MbwX0rxNA1uhgDwlC7Z6G']['299:0'].join(',') === '299:2,299:10,299:12006',
    'frameTree frames sorted numeric-aware',
  );

  // Phase-4-reserved fields empty in Phase 3.
  assert(Object.keys(idx.componentUsage).length === 0, 'componentUsage empty (Phase 4)');
  assert(idx.mapsTo.length === 0, 'mapsTo empty (Phase 4)');

  // Determinism.
  const idx2 = rollup({ nodes, files, people, now: '2026-08-02T12:00:00.000Z' });
  assert(JSON.stringify(idx) === JSON.stringify(idx2), 'rollup is deterministic (stable output)');

  // No files → lastSyncedAt null.
  const empty = rollup({ nodes: [], files: [], people, now: '2026-08-02T12:00:00.000Z' });
  assert(empty.lastSyncedAt === null, 'no file manifests → lastSyncedAt null');

  // Designer projection (D8): only Figma-bearers, sorted, aliases carried.
  const proj = projectDesigners(people, '2026-08-02T12:00:00.000Z');
  assert(proj.designers.length === 1, 'only Figma-bearing people projected (van excluded)');
  assert(proj.designers[0].handle === 'qaiser.abbas', 'projected handle = people.json id');
  assert(proj.designers[0].figma === 'qaiser.abbas@ppcc.com.au', 'figma handle carried verbatim');
  assert(proj.designers[0].aliases.join(',') === 'abbas,qa', 'aliases carried + sorted');
  assert(proj.generatedAt === '2026-08-02T12:00:00.000Z', 'designers generatedAt = injected now');

  console.log('\nreindex.ts self-test passed.');
}
