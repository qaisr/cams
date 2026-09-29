#!/usr/bin/env tsx
/*
 * reindex.ts — deterministic, OFFLINE rollup of the JIRA mirror into
 * jira/_index.json (plan 01a §3.2, §6.4; Phase-2 plan §3).
 *
 * WHY a script (not just inline): both `/jira reindex` and `/jira-sync` Step 7
 * need the exact same rollup. Extracting it here removes the duplication — the
 * router (`.claude/commands/jira.md` → `/jira reindex`) runs this via
 * `node_modules/.bin/tsx scripts/jira/reindex.ts` when present, else falls back
 * to its inline rollup.
 *
 * Contract (all four invariants are load-bearing — see the schema `index` def):
 *   - PURE / OFFLINE. Reads the jira sidecars + per-epic manifests on disk. NO
 *     network — never re-queries the board. Rewrites jira/_index.json only.
 *   - `generatedAt` = now (the one field a rebuild always moves).
 *   - `lastSyncedAt` is PRESERVED verbatim from the existing _index.json — a
 *     reindex is not a sync (§3.2 timestamp invariant). If no prior index, null.
 *   - `currentSprint` is COPIED THROUGH from the existing _index.json unchanged
 *     — refreshing it is a pull's job, not a reindex's.
 *   - SIDECAR WINS on any sidecar↔index disagreement.
 *   - Items under jira/_orphaned/ are EXCLUDED from the rollup, and their keys
 *     are pruned from any parent epic's children[] edges (dangling-edge prune).
 *
 * The `now` timestamp is injected (arg / env) so the rollup is deterministic and
 * unit-testable; there is no Date.now() in the pure path.
 *
 *   Run:      tsx scripts/jira/reindex.ts [--now <iso>] [--root <dir>]
 *   Self-test: tsx scripts/jira/reindex.ts --selftest
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// ---- shapes (subset of manifest.schema.json we consume/emit) ----------------

interface Sidecar {
  key: string;
  type: string;
  summary: string;
  status: string;
  statusCategory: string;
  assignee?: string | null;
  storyPoints?: number | null;
  priority?: string | null;
  sprint?: string | null;
  parent?: string | null;
  links?: { blocks?: string[]; blockedBy?: string[]; relates?: string[] };
  remoteUpdatedAt?: string;
}

interface EpicManifest {
  key: string;
  type: 'Epic';
  summary: string;
  status: string;
  statusCategory?: string;
  children: Array<{ key: string; type: string; file: string; status: string }>;
}

interface IndexItem {
  key: string;
  type: string;
  summary: string;
  status: string;
  statusCategory: string;
  assignee: string | null;
  points: number | null;
  priority: string | null;
  sprint: string | null;
  parent: string | null;
  links?: { blocks: string[]; blockedBy: string[]; relates: string[] };
  file: string;
}

export interface JiraIndex {
  $schema?: string;
  project: string;
  generatedAt: string;
  lastSyncedAt: string | null;
  currentSprint?: unknown;
  counts: Record<string, number>;
  items: IndexItem[];
  tree: Record<string, { type: string; summary: string; children: string[] }>;
  backlog: string[];
  orphans: string[];
}

export interface ReindexInput {
  /** Parsed sidecars for non-epic mirrored items (from jira/{stories,tasks,bugs}/*.json). */
  sidecars: Array<{ file: string; data: Sidecar }>;
  /** Parsed per-epic manifests (from jira/epics/*.json). */
  epics: Array<{ file: string; data: EpicManifest }>;
  /** Keys currently parked under jira/_orphaned/ — excluded + pruned. */
  orphanKeys: string[];
  /** The existing index (for lastSyncedAt + currentSprint passthrough), or null. */
  prior: JiraIndex | null;
  /** Project key (from prior index or config). */
  project: string;
  /** Injected timestamp — the ONLY thing that moves on a rebuild. */
  now: string;
}

// ---- the pure rollup (deterministic; no I/O, no clock) ----------------------

/**
 * Roll sidecars + epic manifests into the §3.2 index shape. Pure: same input →
 * same output. Enforces every invariant in the file header.
 */
export function rollup(input: ReindexInput): JiraIndex {
  const orphan = new Set(input.orphanKeys);

  // Sidecar wins: build the canonical item list from sidecars only. Epics are
  // represented in `tree`, not in `items` (items = stories/tasks/bugs).
  const items: IndexItem[] = [];
  const counts: Record<string, number> = {};
  const backlog: string[] = [];

  for (const { file, data } of input.sidecars) {
    if (orphan.has(data.key)) continue; // excluded from the rollup
    const links = {
      blocks: data.links?.blocks ?? [],
      blockedBy: data.links?.blockedBy ?? [],
      relates: data.links?.relates ?? [],
    };
    items.push({
      key: data.key,
      type: data.type,
      summary: data.summary,
      status: data.status,
      statusCategory: data.statusCategory,
      assignee: data.assignee ?? null,
      points: data.storyPoints ?? null,
      priority: data.priority ?? null,
      sprint: data.sprint ?? null,
      parent: data.parent ?? null,
      links,
      file,
    });
    counts[data.type] = (counts[data.type] ?? 0) + 1;
    // backlog = unparented / no-sprint items (sprint is empty) (§3.2).
    if (!data.sprint) backlog.push(data.key);
  }

  // Tree from epic manifests; count epics; prune dangling (orphaned) child edges.
  const tree: JiraIndex['tree'] = {};
  for (const { data } of input.epics) {
    if (orphan.has(data.key)) continue;
    const children = (data.children ?? [])
      .map((c) => c.key)
      .filter((k) => !orphan.has(k)); // dangling-edge prune
    tree[data.key] = { type: data.type, summary: data.summary, children };
    counts[data.type] = (counts[data.type] ?? 0) + 1;
  }

  // Deterministic ordering — sort every collection by key/name so the file diff
  // is stable across runs regardless of directory-read order.
  items.sort((a, b) => cmpKey(a.key, b.key));
  backlog.sort(cmpKey);
  const orphans = [...orphan].sort(cmpKey);
  const sortedTree: JiraIndex['tree'] = {};
  for (const epicKey of Object.keys(tree).sort(cmpKey)) {
    const t = tree[epicKey];
    sortedTree[epicKey] = { ...t, children: [...t.children].sort(cmpKey) };
  }
  const sortedCounts: Record<string, number> = {};
  for (const k of Object.keys(counts).sort()) sortedCounts[k] = counts[k];

  const out: JiraIndex = {
    $schema: input.prior?.$schema ?? './manifest.schema.json',
    project: input.project,
    generatedAt: input.now, // the one field a rebuild always moves
    lastSyncedAt: input.prior?.lastSyncedAt ?? null, // preserved — reindex ≠ sync
    counts: sortedCounts,
    items,
    tree: sortedTree,
    backlog,
    orphans,
  };
  // currentSprint copied through UNCHANGED (never re-queried here).
  if (input.prior && 'currentSprint' in input.prior) {
    out.currentSprint = input.prior.currentSprint;
  }
  return out;
}

/** Numeric-aware key compare so EON-2 sorts before EON-10. */
function cmpKey(a: string, b: string): number {
  const ma = a.match(/^([A-Za-z]+)-(\d+)$/);
  const mb = b.match(/^([A-Za-z]+)-(\d+)$/);
  if (ma && mb && ma[1] === mb[1]) return Number(ma[2]) - Number(mb[2]);
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---- I/O layer (impure; reads the tree, calls the pure rollup) --------------

const TYPE_FOLDERS = ['stories', 'tasks', 'bugs'] as const;

/** Read every sidecar/manifest under `root/jira`, run the rollup, write index. */
export function reindex(root: string, now: string): { index: JiraIndex; indexPath: string } {
  const jiraDir = join(root, 'jira');
  const indexPath = join(jiraDir, '_index.json');
  const prior: JiraIndex | null = existsSync(indexPath)
    ? (JSON.parse(readFileSync(indexPath, 'utf8')) as JiraIndex)
    : null;
  const project = prior?.project ?? 'EON';

  const sidecars: ReindexInput['sidecars'] = [];
  for (const folder of TYPE_FOLDERS) {
    const dir = join(jiraDir, folder);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      const abs = join(dir, name);
      const data = JSON.parse(readFileSync(abs, 'utf8')) as Sidecar;
      sidecars.push({ file: relPosix(root, abs), data });
    }
  }

  const epics: ReindexInput['epics'] = [];
  const epicsDir = join(jiraDir, 'epics');
  if (existsSync(epicsDir)) {
    for (const name of readdirSync(epicsDir)) {
      if (!name.endsWith('.json')) continue;
      const abs = join(epicsDir, name);
      const data = JSON.parse(readFileSync(abs, 'utf8')) as EpicManifest;
      epics.push({ file: relPosix(root, abs), data });
    }
  }

  // Orphan keys = the {KEY}.json files parked under jira/_orphaned/.
  const orphanKeys: string[] = [];
  const orphanedDir = join(jiraDir, '_orphaned');
  if (existsSync(orphanedDir) && statSync(orphanedDir).isDirectory()) {
    for (const name of readdirSync(orphanedDir)) {
      if (name.endsWith('.json')) orphanKeys.push(name.replace(/\.json$/, ''));
    }
  }

  const index = rollup({ sidecars, epics, orphanKeys, prior, project, now });
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
  const env: string | undefined = process.env.JIRA_REINDEX_NOW;
  if (env) return env;
  // Only the CLI entry point is allowed to read the wall clock; the pure rollup
  // never does. This keeps rollup() deterministic and testable.
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
    `reindex → ${indexPath}: ${index.items.length} items, ${Object.keys(index.tree).length} epics, ` +
      `${index.orphans.length} orphans, generatedAt=${index.generatedAt}, lastSyncedAt=${index.lastSyncedAt}`,
  );
}

// ---- self-test (same style as hash.ts / mcp-client.ts) ----------------------

function runSelfTest(): void {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) {
      console.error(`❌ ${msg}`);
      process.exit(1);
    }
    console.log(`✅ ${msg}`);
  };

  const prior: JiraIndex = {
    $schema: './manifest.schema.json',
    project: 'EON',
    generatedAt: '2026-07-01T00:00:00.000Z',
    lastSyncedAt: '2026-07-31T09:00:00.000Z',
    currentSprint: { id: 264759, name: 'EON Sprint 27.1.2', state: 'active' },
    counts: {},
    items: [],
    tree: {},
    backlog: [],
    orphans: [],
  };

  const sidecars: ReindexInput['sidecars'] = [
    {
      file: 'jira/stories/EON-10.json',
      data: {
        key: 'EON-10',
        type: 'Story',
        summary: 'ten',
        status: 'In Progress',
        statusCategory: 'In Progress',
        assignee: 'abbasqa',
        storyPoints: 3,
        priority: 'High',
        sprint: 'EON Sprint 27.1.2',
        parent: 'EON-21',
      },
    },
    {
      file: 'jira/stories/EON-2.json',
      data: {
        key: 'EON-2',
        type: 'Story',
        summary: 'two (backlog)',
        status: 'To Do',
        statusCategory: 'To Do',
        assignee: null,
        storyPoints: null,
        priority: null,
        sprint: null, // → backlog
        parent: 'EON-21',
      },
    },
    {
      file: 'jira/tasks/EON-99.json',
      data: {
        key: 'EON-99',
        type: 'Task',
        summary: 'gone from remote',
        status: 'To Do',
        statusCategory: 'To Do',
        sprint: null,
        parent: 'EON-21',
      },
    },
  ];

  const epics: ReindexInput['epics'] = [
    {
      file: 'jira/epics/EON-21.json',
      data: {
        key: 'EON-21',
        type: 'Epic',
        summary: 'the epic',
        status: 'In Progress',
        children: [
          { key: 'EON-2', type: 'Story', file: 'jira/stories/EON-2.md', status: 'To Do' },
          { key: 'EON-10', type: 'Story', file: 'jira/stories/EON-10.md', status: 'In Progress' },
          { key: 'EON-99', type: 'Task', file: 'jira/tasks/EON-99.md', status: 'To Do' },
        ],
      },
    },
  ];

  // EON-99 is orphaned (parked under _orphaned/).
  const idx = rollup({
    sidecars,
    epics,
    orphanKeys: ['EON-99'],
    prior,
    project: 'EON',
    now: '2026-08-01T12:00:00.000Z',
  });

  // Invariant: generatedAt moves, lastSyncedAt preserved, currentSprint passthrough.
  assert(idx.generatedAt === '2026-08-01T12:00:00.000Z', 'generatedAt moves to injected now');
  assert(idx.lastSyncedAt === '2026-07-31T09:00:00.000Z', 'lastSyncedAt preserved (reindex ≠ sync)');
  assert(
    JSON.stringify(idx.currentSprint) === JSON.stringify(prior.currentSprint),
    'currentSprint copied through unchanged',
  );

  // Orphan excluded from items + counts; pruned from parent children[].
  assert(
    !idx.items.some((i) => i.key === 'EON-99'),
    'orphaned EON-99 excluded from items',
  );
  assert(idx.orphans.length === 1 && idx.orphans[0] === 'EON-99', 'orphans list = [EON-99]');
  assert(
    !idx.tree['EON-21'].children.includes('EON-99'),
    'dangling orphan edge pruned from epic children',
  );
  assert(idx.tree['EON-21'].children.length === 2, 'epic keeps its two live children');

  // Deterministic numeric-aware ordering: EON-2 before EON-10.
  assert(
    idx.items.map((i) => i.key).join(',') === 'EON-2,EON-10',
    'items sorted numeric-aware (EON-2 before EON-10)',
  );
  assert(idx.tree['EON-21'].children.join(',') === 'EON-2,EON-10', 'children sorted numeric-aware');

  // Backlog = no-sprint items only (EON-2), not EON-10.
  assert(idx.backlog.join(',') === 'EON-2', 'backlog = no-sprint items only');

  // Counts reflect live (non-orphan) items + the epic.
  assert(idx.counts.Story === 2, 'Story count = 2 (orphan excluded)');
  assert(idx.counts.Epic === 1, 'Epic count = 1');
  assert(idx.counts.Task === undefined, 'Task count absent (only Task was orphaned)');

  // Determinism: same input → byte-identical output.
  const idx2 = rollup({
    sidecars,
    epics,
    orphanKeys: ['EON-99'],
    prior,
    project: 'EON',
    now: '2026-08-01T12:00:00.000Z',
  });
  assert(JSON.stringify(idx) === JSON.stringify(idx2), 'rollup is deterministic (stable output)');

  // No prior index → lastSyncedAt null, no currentSprint key.
  const fresh = rollup({
    sidecars: [],
    epics: [],
    orphanKeys: [],
    prior: null,
    project: 'EON',
    now: '2026-08-01T12:00:00.000Z',
  });
  assert(fresh.lastSyncedAt === null, 'no prior index → lastSyncedAt null');
  assert(!('currentSprint' in fresh), 'no prior index → currentSprint omitted');

  console.log('\nreindex.ts self-test passed.');
}
