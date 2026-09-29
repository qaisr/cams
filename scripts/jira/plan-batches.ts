#!/usr/bin/env tsx
/*
 * plan-batches.ts — pure batch partitioner for large-scale JIRA pulls (plan:
 * Batched, Resumable, Subagent-Driven Large-Scale Sync §2.2). Twin of
 * scripts/confluence/plan-batches.ts (subtree/ancestor grouping).
 *
 * WHY a script (not just inline): `/jira-sync --pull` switches into BATCHED MODE
 * when the cheap cheap-fields scan shows more than `largeSyncThreshold` issues
 * actually need pulling. Instead of driving all of them in one Claude context,
 * the orchestrator partitions the pending set into bounded batches, writes a
 * durable `jira/.pull-runs/<run_id>.json` tracker, and spawns ONE fresh subagent
 * per batch. This file owns ONLY the partitioning — the pure, deterministic
 * `pendingRoster → batches[]` step. It never talks to JIRA, touches disk, or
 * reads a clock.
 *
 * Contract (load-bearing):
 *   - PURE. No I/O, no network, no Date.now()/Math.random(). Same input → same
 *     batch order + contents (a re-plan of an unchanged roster is identical).
 *   - Batch UNIT = epic. JIRA's grouping already exists: each Epic (+ its
 *     children) is one candidate batch. Items with NO parent epic fall into the
 *     synthetic `backlog` / `sprint` batches (the other two scope-query buckets).
 *   - FALLBACK = fixed-size chunks. Any candidate batch (epic, backlog, or
 *     sprint) larger than `maxBatchPages` is split into stable maxBatchPages-sized
 *     chunks. ONE-PASS guarantee: no emitted batch ever exceeds maxBatchPages, so
 *     no nested/recursive re-batching is ever needed.
 *   - Only PENDING items (status_sync in {remote-ahead,new}) are passed in — a
 *     `clean` issue needs no body fetch and is never queued. The caller filters.
 *
 * Key ordering matches scripts/jira/reindex.ts's cmpKey (EON-9 before EON-10),
 * so batch order is stable across runs.
 *
 *   Self-test: tsx scripts/jira/plan-batches.ts --selftest
 */

// ---- shapes -----------------------------------------------------------------

/** A pending issue as captured by the cheap scope scan (`/jira-sync` Step 2). */
export interface EpicRosterItemForPlan {
  key: string;
  /** The parent epic key, or null for a backlog/sprint item with no epic. */
  parentEpic: string | null;
  updated: string;
  /** Which scope bucket surfaced this item when it has no parent epic. Ignored
   *  when parentEpic is set. Defaults to 'backlog'. */
  bucket?: 'backlog' | 'sprint';
}

export interface PlanBatchesOpts {
  /** Max issues per batch (`maxBatchPages` in config, default 8). */
  maxBatchPages: number;
}

export type BatchStatus = 'pending' | 'in-progress' | 'done' | 'withheld' | 'failed';

export interface Batch {
  /** "epic:<KEY>" | "chunk:<KEY>-<n>" | "backlog" | "chunk:backlog-<n>" |
   *  "sprint" | "chunk:sprint-<n>". */
  batchId: string;
  unit: 'epic' | 'chunk' | 'backlog' | 'sprint';
  /** The epic key this batch's issues belong to, or null (backlog/sprint). */
  epic: string | null;
  keys: string[];
  status: BatchStatus;
}

// ---- the pure partitioner ---------------------------------------------------

/**
 * Partition the pending roster into epic batches with a fixed-size chunk
 * fallback, plus synthetic backlog/sprint batches for parent-less items (§2.2).
 * Pure and deterministic. Every emitted batch is created `status: "pending"`.
 */
export function planBatches(roster: EpicRosterItemForPlan[], opts: PlanBatchesOpts): Batch[] {
  const maxBatch = Math.max(1, Math.floor(opts.maxBatchPages));

  // Stable base order: key-aware (EON-9 before EON-10). All grouping preserves
  // this order, so the output is deterministic.
  const items = [...roster].sort((a, b) => cmpKey(a.key, b.key));

  const epicOrder: string[] = []; // epic keys in first-seen order
  const epicItems = new Map<string, string[]>(); // epic → child keys
  const backlog: string[] = [];
  const sprint: string[] = [];

  for (const it of items) {
    if (it.parentEpic) {
      if (!epicItems.has(it.parentEpic)) {
        epicItems.set(it.parentEpic, []);
        epicOrder.push(it.parentEpic);
      }
      epicItems.get(it.parentEpic)!.push(it.key);
    } else if (it.bucket === 'sprint') {
      sprint.push(it.key);
    } else {
      backlog.push(it.key);
    }
  }

  const batches: Batch[] = [];

  // One (or more, if chunked) batch per epic, in key-aware epic order.
  for (const epic of [...epicOrder].sort(cmpKey)) {
    const keys = epicItems.get(epic)!;
    if (keys.length <= maxBatch) {
      batches.push(mkBatch(`epic:${epic}`, 'epic', epic, keys));
    } else {
      chunk(keys, maxBatch).forEach((c, i) =>
        batches.push(mkBatch(`chunk:${epic}-${i + 1}`, 'chunk', epic, c)),
      );
    }
  }

  // Synthetic backlog + sprint batches (chunked by cap), backlog before sprint.
  emitBucket(batches, 'backlog', backlog, maxBatch);
  emitBucket(batches, 'sprint', sprint, maxBatch);

  return batches;
}

/** Emit a parent-less bucket ('backlog'|'sprint') as one or more batches. */
function emitBucket(
  batches: Batch[],
  bucket: 'backlog' | 'sprint',
  keys: string[],
  maxBatch: number,
): void {
  if (keys.length === 0) return;
  if (keys.length <= maxBatch) {
    batches.push(mkBatch(bucket, bucket, null, keys));
    return;
  }
  chunk(keys, maxBatch).forEach((c, i) =>
    batches.push(mkBatch(`chunk:${bucket}-${i + 1}`, 'chunk', null, c)),
  );
}

function mkBatch(batchId: string, unit: Batch['unit'], epic: string | null, keys: string[]): Batch {
  return { batchId, unit, epic, keys: [...keys], status: 'pending' };
}

/** Split into stable fixed-size chunks preserving input order. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Compare JIRA keys: same project prefix → numeric-aware on the number; else
 *  lexicographic. Matches scripts/jira/reindex.ts's cmpKey. */
function cmpKey(a: string, b: string): number {
  const ma = a.match(/^([A-Za-z]+)-(\d+)$/);
  const mb = b.match(/^([A-Za-z]+)-(\d+)$/);
  if (ma && mb && ma[1] === mb[1]) return Number(ma[2]) - Number(mb[2]);
  return a < b ? -1 : a > b ? 1 : 0;
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

  const mk = (
    key: string,
    parentEpic: string | null,
    bucket?: 'backlog' | 'sprint',
  ): EpicRosterItemForPlan => ({ key, parentEpic, updated: '2026-08-01T00:00:00.000Z', bucket });

  const roster: EpicRosterItemForPlan[] = [
    mk('EON-11', 'EON-10'),
    mk('EON-12', 'EON-10'),
    mk('EON-21', 'EON-20'),
    mk('EON-30', null, 'backlog'),
    mk('EON-31', null, 'backlog'),
    mk('EON-40', null, 'sprint'),
    mk('EON-9', 'EON-10'), // out of numeric order in input — tests stable sort
  ];

  const batches = planBatches(roster, { maxBatchPages: 8 });
  const byId = Object.fromEntries(batches.map((b) => [b.batchId, b]));

  // Epic grouping.
  assert(!!byId['epic:EON-10'], 'epic EON-10 emitted as an epic batch');
  assert(
    byId['epic:EON-10'].keys.join(',') === 'EON-9,EON-11,EON-12',
    'epic EON-10 carries its children key-ordered (EON-9,EON-11,EON-12)',
  );
  assert(byId['epic:EON-20'].keys.join(',') === 'EON-21', 'epic EON-20 carries its single child');

  // Synthetic buckets.
  assert(!!byId['backlog'], 'parent-less backlog items → synthetic backlog batch');
  assert(
    byId['backlog'].keys.join(',') === 'EON-30,EON-31',
    'backlog batch carries both backlog items',
  );
  assert(byId['backlog'].epic === null, 'backlog batch has null epic');
  assert(!!byId['sprint'], 'parent-less sprint items → synthetic sprint batch');
  assert(byId['sprint'].keys.join(',') === 'EON-40', 'sprint batch carries the sprint item');

  // Every key placed exactly once.
  const placed = batches.flatMap((b) => b.keys).sort(cmpKey);
  assert(
    placed.join(',') === 'EON-9,EON-11,EON-12,EON-21,EON-30,EON-31,EON-40',
    'every pending issue placed exactly once',
  );

  // Ordering: epics (key-aware) before backlog before sprint.
  assert(
    batches.map((b) => b.batchId).join(',') === 'epic:EON-10,epic:EON-20,backlog,sprint',
    'batch order: epics key-aware, then backlog, then sprint',
  );

  // Determinism.
  assert(
    JSON.stringify(batches) === JSON.stringify(planBatches(roster, { maxBatchPages: 8 })),
    'planner is deterministic (stable output)',
  );

  // All start pending.
  assert(
    batches.every((b) => b.status === 'pending'),
    'every emitted batch starts status:pending',
  );

  // ---- chunk fallback: an epic bigger than maxBatchPages ---------------------
  const bigRoster: EpicRosterItemForPlan[] = [];
  for (let i = 1; i <= 60; i++) bigRoster.push(mk(`EON-${1000 + i}`, 'EON-500'));
  const bigBatches = planBatches(bigRoster, { maxBatchPages: 8 });
  assert(bigBatches.length === 8, 'a 60-child epic splits into ceil(60/8)=8 chunk batches');
  assert(
    bigBatches.every((b) => b.keys.length <= 8),
    'NO emitted batch exceeds maxBatchPages',
  );
  assert(
    bigBatches.every((b) => b.unit === 'chunk' && b.epic === 'EON-500'),
    'all chunks carry unit=chunk and the same epic',
  );
  assert(
    bigBatches.reduce((n, b) => n + b.keys.length, 0) === 60,
    'chunking covers all 60 children',
  );
  assert(
    bigBatches[0].batchId === 'chunk:EON-500-1' && bigBatches[7].batchId === 'chunk:EON-500-8',
    'chunk batchIds are stable-numbered chunk:<EPIC>-<n>',
  );

  // A large backlog chunks too.
  const bigBacklog: EpicRosterItemForPlan[] = [];
  for (let i = 1; i <= 20; i++) bigBacklog.push(mk(`EON-${2000 + i}`, null, 'backlog'));
  const backlogBatches = planBatches(bigBacklog, { maxBatchPages: 8 });
  assert(
    backlogBatches.length === 3 && backlogBatches.every((b) => b.keys.length <= 8),
    'a 20-item backlog splits into 3 chunks of ≤8',
  );
  assert(
    backlogBatches[0].batchId === 'chunk:backlog-1',
    'backlog chunk batchIds are chunk:backlog-<n>',
  );

  // ---- edge cases ------------------------------------------------------------
  assert(planBatches([], { maxBatchPages: 8 }).length === 0, 'empty roster → zero batches');

  console.log('\nplan-batches.ts self-test passed.');
}
