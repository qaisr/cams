#!/usr/bin/env tsx
/*
 * plan-batches.ts — pure batch partitioner for large-scale Confluence pulls
 * (plan: Batched, Resumable, Subagent-Driven Large-Scale Sync §2). Twin of
 * scripts/jira/plan-batches.ts (epic-based grouping).
 *
 * WHY a script (not just inline): `/confluence-sync --pull` switches into
 * BATCHED MODE when the cheap roster scan shows more than `largeSyncThreshold`
 * pages actually need pulling. Instead of driving all of them in one Claude
 * context (the 44-page overflow this whole feature fixes), the orchestrator
 * partitions the pending set into bounded batches, writes a durable
 * `confluence/.pull-runs/<run_id>.json` tracker, and spawns ONE fresh subagent
 * per batch. This file owns ONLY the partitioning — the pure, deterministic
 * `pendingRoster → batches[]` step. It never talks to Confluence, never touches
 * disk, never reads a clock.
 *
 * Contract (load-bearing):
 *   - PURE. No I/O, no network, no Date.now()/Math.random(). Same input → same
 *     batch order + contents (the orchestrator persists the result as the
 *     tracker's batches[]; a re-plan of an unchanged roster must be identical).
 *   - Batch UNIT = subtree/ancestor branch. Each top-level branch under the
 *     configured scope ancestor(s) (a page whose in-scope parent IS a scope root,
 *     i.e. a direct child of the root) becomes one candidate batch carrying that
 *     branch-root page plus all its pending descendants.
 *   - FALLBACK = fixed-size chunks. Any candidate batch larger than
 *     `maxBatchPages` is split into stable maxBatchPages-sized chunks. This is a
 *     ONE-PASS guarantee: no emitted batch ever exceeds maxBatchPages, however
 *     skewed the input tree — so no nested/recursive re-batching is ever needed.
 *   - A pending page with no in-scope branch (bare-pageId target, or a page whose
 *     ancestry never touches a scope root) falls into a final FLAT chunk pass.
 *   - Only PENDING pages (status_sync in {remote-ahead,new}) are passed in — a
 *     `clean` page needs no body fetch and is never queued. The caller filters.
 *
 * Numeric-aware ordering reuses cmpNumericKey from ./hash (single source), so
 * "9" sorts before "10" and batch order is stable across runs.
 *
 *   Self-test: tsx scripts/confluence/plan-batches.ts --selftest
 */

import { cmpNumericKey } from './hash';

// ---- shapes -----------------------------------------------------------------

/** A pending page as captured by the cheap roster scan (`/confluence-sync`
 *  Step 2). `ancestors` is root-to-leaf order (the shape the sidecar stores,
 *  per manifest.schema.json#/$defs/itemSidecar/properties/ancestors) — pass
 *  `[]` when the ancestor chain isn't obtainable for a page; the page then
 *  falls into the flat pass (see topLevelBranchRoot) rather than being
 *  mis-grouped. There is no `version: number` field: the schema's per-item
 *  change-signal is `remoteLastModified` (opaque string), not a numeric
 *  version — this planner doesn't need either, since batching only groups by
 *  ancestry, not by change-recency. */
export interface RosterPageForPlan {
  pageId: string;
  spaceKey: string;
  ancestors: string[];
}

export interface PlanBatchesOpts {
  /** The configured scope roots for this space (`spaces[].ancestors` in
   *  confluence-sync.config.yml, e.g. ["2083293743"] for the EON Squad folder).
   *  A page's top-level branch is the ancestor that is a direct child of one of
   *  these roots (or the page itself, if it is a direct child of a root). */
  scopeAncestors: string[];
  /** Max pages per batch (`maxBatchPages` in config, default 8). A branch bigger
   *  than this is chunked; the invariant is enforced here in one pass. */
  maxBatchPages: number;
}

export type BatchStatus = 'pending' | 'in-progress' | 'done' | 'withheld' | 'failed';

export interface Batch {
  /** "ancestor:<branchRoot>" | "chunk:<branchRoot>-<n>" | "flat:<n>". */
  batchId: string;
  unit: 'ancestor' | 'chunk' | 'flat';
  /** The top-level branch-root pageId this batch descends from, or null (flat). */
  branchRoot: string | null;
  pageIds: string[];
  status: BatchStatus;
}

// ---- the pure partitioner ---------------------------------------------------

/**
 * Partition the pending roster into subtree-branch batches with a fixed-size
 * chunk fallback (§2.1). Pure and deterministic. Every emitted batch is created
 * `status: "pending"`; the orchestrator advances status as subagents complete.
 */
export function planBatches(roster: RosterPageForPlan[], opts: PlanBatchesOpts): Batch[] {
  const roots = new Set(opts.scopeAncestors);
  const maxBatch = Math.max(1, Math.floor(opts.maxBatchPages));

  // Stable base order for everything downstream: numeric-aware by pageId. All
  // grouping preserves this order, so the output is deterministic.
  const pages = [...roster].sort((a, b) => cmpNumericKey(a.pageId, b.pageId));

  // Assign each page to its top-level branch root. The branch root is the
  // ancestor that is a DIRECT CHILD of a scope root; if the page itself is a
  // direct child of a scope root (or its ancestry never touches a root), the
  // page is its own branch root — or, with no scope roots configured at all,
  // there is no branch and the page goes to the flat pass (branchRoot=null).
  const branchOrder: string[] = []; // branch roots in first-seen order
  const branchPages = new Map<string, string[]>(); // branchRoot → pageIds
  const flat: string[] = []; // pages with no in-scope branch

  for (const p of pages) {
    const branchRoot = topLevelBranchRoot(p, roots);
    if (branchRoot === null) {
      flat.push(p.pageId);
      continue;
    }
    if (!branchPages.has(branchRoot)) {
      branchPages.set(branchRoot, []);
      branchOrder.push(branchRoot);
    }
    branchPages.get(branchRoot)!.push(p.pageId);
  }

  const batches: Batch[] = [];

  // One (or more, if chunked) batch per branch, in numeric-aware branch order.
  for (const branchRoot of [...branchOrder].sort(cmpNumericKey)) {
    const ids = branchPages.get(branchRoot)!;
    if (ids.length <= maxBatch) {
      batches.push(mkBatch(`ancestor:${branchRoot}`, 'ancestor', branchRoot, ids));
    } else {
      const chunks = chunk(ids, maxBatch);
      chunks.forEach((c, i) =>
        batches.push(mkBatch(`chunk:${branchRoot}-${i + 1}`, 'chunk', branchRoot, c)),
      );
    }
  }

  // Final flat pass for pages with no in-scope branch.
  chunk(flat, maxBatch).forEach((c, i) => batches.push(mkBatch(`flat:${i + 1}`, 'flat', null, c)));

  return batches;
}

/**
 * The top-level branch root for a page: the ancestor entry that is a direct
 * child of a scope root (walking root-to-leaf, the first ancestor whose OWN
 * parent is a scope root). If the page itself is a direct child of a scope root,
 * the page is its own branch root. Returns null when no scope roots are
 * configured, or when the page's ancestry never passes through a scope root.
 */
function topLevelBranchRoot(page: RosterPageForPlan, roots: Set<string>): string | null {
  if (roots.size === 0) return null;

  // The scope-relative chain is [ ...ancestors, pageId ] root-to-leaf. Find the
  // last ancestor that IS a scope root; the element immediately after it is the
  // top-level branch root (the direct child of the root).
  const chain = [...page.ancestors, page.pageId];
  let lastRootIdx = -1;
  for (let i = 0; i < chain.length; i++) {
    if (roots.has(chain[i])) lastRootIdx = i;
  }
  if (lastRootIdx === -1) return null; // ancestry never touches a scope root
  const branchIdx = lastRootIdx + 1;
  if (branchIdx >= chain.length) return null; // the page IS the root itself — no branch
  return chain[branchIdx];
}

function mkBatch(
  batchId: string,
  unit: Batch['unit'],
  branchRoot: string | null,
  pageIds: string[],
): Batch {
  return { batchId, unit, branchRoot, pageIds: [...pageIds], status: 'pending' };
}

/** Split into stable fixed-size chunks preserving input order. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---- self-test --------------------------------------------------------------

if (process.argv[2] === '--selftest') {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) {
      console.error(`❌ ${msg}`);
      process.exit(1);
    }
    console.log(`✅ ${msg}`);
  };

  const ROOT = '2083293743'; // EON Squad folder (from confluence-sync.config.yml)
  const mk = (pageId: string, ancestors: string[]): RosterPageForPlan => ({
    pageId,
    spaceKey: 'SEC',
    ancestors,
  });

  // Tree under the scope root ROOT:
  //   ROOT
  //   ├── 100 (branch A)          → its own branch root, 100
  //   │    └── 101                → branch root 100
  //   ├── 200 (branch B)          → branch root 200
  //   │    ├── 201                → branch root 200
  //   │    └── 202 → 203          → branch root 200
  //   └── (page 900, no ROOT in ancestry) → flat
  const roster: RosterPageForPlan[] = [
    mk('101', [ROOT, '100']),
    mk('100', [ROOT]),
    mk('202', [ROOT, '200']),
    mk('203', [ROOT, '200', '202']),
    mk('201', [ROOT, '200']),
    mk('200', [ROOT]),
    mk('900', ['5555']), // ancestry never touches ROOT → flat
  ];

  const batches = planBatches(roster, { scopeAncestors: [ROOT], maxBatchPages: 8 });
  const byId = Object.fromEntries(batches.map((b) => [b.batchId, b]));

  // Branch grouping: 100+101 → branch 100; 200+201+202+203 → branch 200.
  assert(!!byId['ancestor:100'], 'branch 100 emitted as an ancestor batch');
  assert(
    byId['ancestor:100'].pageIds.sort(cmpNumericKey).join(',') === '100,101',
    'branch 100 carries its root + descendant (100,101)',
  );
  assert(!!byId['ancestor:200'], 'branch 200 emitted as an ancestor batch');
  assert(
    byId['ancestor:200'].pageIds.sort(cmpNumericKey).join(',') === '200,201,202,203',
    'branch 200 carries the whole subtree (200,201,202,203)',
  );

  // The page with no in-scope branch → flat batch.
  const flatBatch = batches.find((b) => b.unit === 'flat')!;
  assert(!!flatBatch, 'a page with no in-scope ancestry lands in a flat batch');
  assert(flatBatch.pageIds.join(',') === '900', 'flat batch carries the un-branched page (900)');
  assert(flatBatch.branchRoot === null, 'flat batch has null branchRoot');

  // Every page is placed exactly once across all batches.
  const placed = batches.flatMap((b) => b.pageIds).sort(cmpNumericKey);
  assert(
    placed.join(',') === '100,101,200,201,202,203,900',
    'every pending page placed exactly once',
  );

  // All emitted batches start pending.
  assert(
    batches.every((b) => b.status === 'pending'),
    'every emitted batch starts status:pending',
  );

  // Deterministic: same input → byte-identical batch plan.
  const again = planBatches(roster, { scopeAncestors: [ROOT], maxBatchPages: 8 });
  assert(
    JSON.stringify(batches) === JSON.stringify(again),
    'planner is deterministic (stable output)',
  );

  // Batch ORDER is numeric-aware on branch root (100 before 200 before flat).
  const branchBatches = batches.filter((b) => b.unit !== 'flat');
  assert(
    branchBatches[0].branchRoot === '100' && branchBatches[1].branchRoot === '200',
    'branches ordered numeric-aware (100 before 200)',
  );

  // ---- chunk fallback: a single branch bigger than maxBatchPages -------------
  // 60 descendants under one branch root, maxBatchPages 8 → ceil(60/8)=8 batches,
  // none exceeding 8, all under the same branchRoot, covering every page once.
  const BIG = '300';
  const bigRoster: RosterPageForPlan[] = [mk(BIG, [ROOT])];
  for (let i = 1; i <= 59; i++) bigRoster.push(mk(String(3000 + i), [ROOT, BIG]));

  const bigBatches = planBatches(bigRoster, { scopeAncestors: [ROOT], maxBatchPages: 8 });
  assert(bigBatches.length === 8, 'a 60-page branch splits into ceil(60/8)=8 chunk batches');
  assert(
    bigBatches.every((b) => b.pageIds.length <= 8),
    'NO emitted batch exceeds maxBatchPages (one-pass invariant, no nested re-batching)',
  );
  assert(
    bigBatches.every((b) => b.unit === 'chunk' && b.branchRoot === BIG),
    'all chunks carry unit=chunk and the same branchRoot',
  );
  assert(
    bigBatches.reduce((n, b) => n + b.pageIds.length, 0) === 60,
    'chunking covers all 60 pages',
  );
  assert(
    bigBatches.map((b) => b.batchId).join(',') ===
      'chunk:300-1,chunk:300-2,chunk:300-3,chunk:300-4,chunk:300-5,chunk:300-6,chunk:300-7,chunk:300-8',
    'chunk batchIds are stable-numbered chunk:<root>-<n>',
  );

  // ---- edge cases ------------------------------------------------------------
  assert(
    planBatches([], { scopeAncestors: [ROOT], maxBatchPages: 8 }).length === 0,
    'empty roster → zero batches',
  );

  // No scope ancestors configured → everything is flat (still chunked by cap).
  const noScope = planBatches(roster, { scopeAncestors: [], maxBatchPages: 8 });
  assert(
    noScope.every((b) => b.unit === 'flat' && b.branchRoot === null),
    'no scope roots configured → all pages go to flat chunks',
  );
  assert(
    noScope.flatMap((b) => b.pageIds).length === roster.length,
    'no-scope flat pass still places every page',
  );

  // A page that is itself a direct child of the root (its own branch), plus a
  // page whose only in-scope ancestor is the root (also its own branch).
  const directChildren = planBatches([mk('700', [ROOT]), mk('800', [ROOT])], {
    scopeAncestors: [ROOT],
    maxBatchPages: 8,
  });
  assert(
    directChildren.length === 2 && directChildren.every((b) => b.unit === 'ancestor'),
    'two direct children of the root → two single-page ancestor branches',
  );

  console.log('\nplan-batches.ts self-test passed.');
}
