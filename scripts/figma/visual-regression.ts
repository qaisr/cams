#!/usr/bin/env tsx
/*
 * visual-regression.ts — deterministic staleness + diff-verdict core for the
 * Figma visual-regression feature (Plan 02b F5 / Phase 6; BD6).
 *
 * DETECTION ONLY, OFFLINE, NO MCP, NO network. The Playwright screenshot capture
 * and the mirror `.png` read are performed by the /figma-visual-regression
 * command; THIS script owns the pure, testable core:
 *
 *   stalenessVerdict()  — is the committed baseline still valid for this node?
 *                         Compares the manifest entry's baselineRenderHash to the
 *                         node's CURRENT renderHash (from <slug>.meta.json). If they
 *                         differ, the mirror `.png` has moved on and the baseline is
 *                         STALE — the diff must be refused until /figma pull refreshes
 *                         it (MCP, local dev only).
 *   diffVerdict()       — given a computed diffRatio and a per-entry threshold,
 *                         pass (ratio <= threshold) or fail.
 *   evaluateEntry()     — combine the two: stale short-circuits to "stale"; else the
 *                         diff verdict stands.
 *
 * The command feeds diffRatio (from a Playwright pixel diff) + the on-disk hashes;
 * this core decides trust/stale/pass/fail. Reuses renderHash semantics from
 * scripts/figma/hash.ts (the `sha256:`-prefixed byte hash).
 *
 *   tsx scripts/figma/visual-regression.ts --selftest
 */

// ---- manifest types (Plan 02b §5.3) ---------------------------------------

export type RegressionStatus = 'pass' | 'fail' | 'stale';

/** Outcome of the most recent run for an entry (written back by the command). */
export interface LastResult {
  status: RegressionStatus;
  diffRatio: number;
  ranAt: string; // ISO timestamp — supplied by the command's clock, never invented here
}

/** One screen under visual regression. */
export interface RegressionEntry {
  slug: string;
  nodeId: string; // colon form in JSON (D5), e.g. "299:12210"
  route: string; // app route the Playwright shot navigates to
  threshold: number; // max acceptable diffRatio (0..1), e.g. 0.02 = 2%
  baselineRenderHash: string; // node renderHash at the time the baseline .png was captured
  lastResult?: LastResult | null;
}

export interface RegressionManifest {
  entries: RegressionEntry[];
}

// ---- staleness (BD6 — renderHash equality guards the baseline) -------------

export type StalenessVerdict = 'fresh' | 'stale';

/**
 * The baseline `.png` is only trustworthy while the node's render is unchanged.
 * Compare the entry's recorded `baselineRenderHash` to the node's CURRENT
 * `renderHash` (read by the caller from `<slug>.meta.json`). Equal → fresh;
 * different → stale (the design moved on; refuse the diff, tell the user to
 * `/figma pull` then refresh the baseline).
 */
export function stalenessVerdict(
  baselineRenderHash: string,
  currentRenderHash: string,
): StalenessVerdict {
  return baselineRenderHash === currentRenderHash ? 'fresh' : 'stale';
}

// ---- diff verdict ----------------------------------------------------------

/**
 * A pixel diffRatio (0..1, from the Playwright comparison the command runs) is a
 * PASS when it is at or below the entry's threshold, else a FAIL. Ratios outside
 * [0,1] are clamped defensively; NaN is treated as a fail (never a silent pass).
 */
export function diffVerdict(diffRatio: number, threshold: number): 'pass' | 'fail' {
  if (Number.isNaN(diffRatio)) return 'fail';
  const ratio = Math.min(1, Math.max(0, diffRatio));
  return ratio <= threshold ? 'pass' : 'fail';
}

// ---- combined per-entry evaluation -----------------------------------------

export interface EntryEvaluation {
  slug: string;
  status: RegressionStatus;
  staleness: StalenessVerdict;
  /** null when the baseline is stale — the diff is NOT trusted, so no ratio is reported. */
  diffRatio: number | null;
  threshold: number;
  reason: string;
}

/**
 * Combine staleness + diff. A STALE baseline short-circuits to `stale` and the
 * diffRatio is discarded (we never trust a diff against a moved baseline — BD6).
 * A FRESH baseline yields the pass/fail diff verdict.
 */
export function evaluateEntry(
  entry: Pick<RegressionEntry, 'slug' | 'threshold'>,
  currentRenderHash: string,
  baselineRenderHash: string,
  diffRatio: number,
): EntryEvaluation {
  const staleness = stalenessVerdict(baselineRenderHash, currentRenderHash);
  if (staleness === 'stale') {
    return {
      slug: entry.slug,
      status: 'stale',
      staleness,
      diffRatio: null,
      threshold: entry.threshold,
      reason:
        'baseline renderHash differs from the node current renderHash — mirror .png moved; ' +
        'refuse diff, run /figma pull then refresh the baseline',
    };
  }
  const verdict = diffVerdict(diffRatio, entry.threshold);
  return {
    slug: entry.slug,
    status: verdict,
    staleness,
    diffRatio,
    threshold: entry.threshold,
    reason:
      verdict === 'pass'
        ? `diffRatio ${diffRatio} <= threshold ${entry.threshold}`
        : `diffRatio ${diffRatio} > threshold ${entry.threshold}`,
  };
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

  const H_A = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const H_B = 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

  // (a) equal hash → fresh → diff trusted
  assert(
    stalenessVerdict(H_A, H_A) === 'fresh',
    'staleness: equal renderHash → fresh (diff trusted)',
  );
  // (b) unequal hash → stale
  assert(stalenessVerdict(H_A, H_B) === 'stale', 'staleness: unequal renderHash → stale');

  // (c) diffRatio ≤ / > threshold → pass / fail
  assert(diffVerdict(0.004, 0.02) === 'pass', 'diff: ratio below threshold → pass');
  assert(diffVerdict(0.02, 0.02) === 'pass', 'diff: ratio equal to threshold → pass (inclusive)');
  assert(diffVerdict(0.05, 0.02) === 'fail', 'diff: ratio above threshold → fail');
  assert(diffVerdict(NaN, 0.02) === 'fail', 'diff: NaN ratio → fail (never a silent pass)');
  assert(diffVerdict(1.5, 0.02) === 'fail', 'diff: out-of-range ratio clamped → fail');

  // combined evaluation
  const entry = { slug: 'entity-onboarding-confirm', threshold: 0.02 };

  const fresh = evaluateEntry(entry, H_A, H_A, 0.004);
  assert(fresh.status === 'pass', 'evaluate: fresh + low ratio → pass');
  assert(fresh.diffRatio === 0.004, 'evaluate: pass reports the trusted diffRatio');

  const freshFail = evaluateEntry(entry, H_A, H_A, 0.09);
  assert(freshFail.status === 'fail', 'evaluate: fresh + high ratio → fail');

  const stale = evaluateEntry(entry, H_B, H_A, 0.004);
  assert(stale.status === 'stale', 'evaluate: stale baseline short-circuits regardless of ratio');
  assert(stale.diffRatio === null, 'evaluate: stale discards the untrusted diffRatio');
  assert(
    /refuse diff/.test(stale.reason),
    'evaluate: stale reason instructs /figma pull + refresh baseline',
  );

  console.log('\nvisual-regression.ts self-test passed.');
}
