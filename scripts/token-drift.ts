#!/usr/bin/env tsx
/*
 * token-drift.ts — deterministic token-drift diff/classify engine
 * (Plan 02b §3 / Phase 6 F3).
 *
 * DETECTION ONLY. This engine compares two resolved token sets — the
 * Figma-derived DTCG set and the Lumen-consumed set — and reports the drift.
 * It NEVER rewrites a token, a Lumen config, or the baseline (BD4 / D21).
 *
 * The /figma-token-drift command owns the two MCP steps (EXPORT via
 * get_variable_defs, READ Lumen tokens via get-lumen-css-tokens). This script
 * owns the pure, in-memory, OFFLINE core — pipeline steps 2, 3-support, 5, 6:
 *
 *   NORMALIZE  flattenDtcg()   — nested DTCG tree → flat { path → {value,type} }
 *   DIFF       diffTokens()    — two flat sets → added/removed/valueChanged/typeChanged
 *   CLASSIFY   classifyDrift() — each drift entry → semantic | global (D21 tiering)
 *
 * NO MCP, NO network, NO filesystem writes. Importable and unit-testable in
 * isolation; the /figma-token-drift command feeds it live token sets, and the
 * `.claude/hooks/token-drift-check` advisory hook feeds it on-disk snapshots.
 *
 *   tsx scripts/token-drift.ts --selftest
 */

// ---- DTCG types (W3C Design Tokens, stable TR 2025.10) ---------------------

/** A single DTCG token: `$value` + `$type`. Extra `$`-prefixed keys ignored. */
export interface DtcgToken {
  $value: string | number;
  $type: string;
  [k: `$${string}`]: unknown;
}

/** A DTCG group is a nested tree of groups and tokens. */
export interface DtcgGroup {
  [key: string]: DtcgGroup | DtcgToken;
}

/** A flat, resolved token — the comparable unit. `path` is dot-joined. */
export interface FlatToken {
  path: string;
  value: string;
  type: string;
}

export type FlatTokenSet = Record<string, FlatToken>;

// ---- NORMALIZE (step 2 support) --------------------------------------------

function isToken(node: DtcgGroup | DtcgToken): node is DtcgToken {
  return typeof node === 'object' && node !== null && '$value' in node;
}

/**
 * Flatten a nested DTCG tree into a flat `{ 'a.b.c' → FlatToken }` map.
 * Dot-joined path is the stable identity used for diffing. Values are
 * stringified so `#1e1e1e` and `16` compare uniformly.
 */
export function flattenDtcg(tree: DtcgGroup, prefix = ''): FlatTokenSet {
  const out: FlatTokenSet = {};
  for (const key of Object.keys(tree).sort()) {
    if (key.startsWith('$')) continue; // group-level metadata ($description etc.)
    const node = tree[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (isToken(node)) {
      out[path] = { path, value: String(node.$value), type: String(node.$type) };
    } else {
      Object.assign(out, flattenDtcg(node, path));
    }
  }
  return out;
}

// ---- DIFF (step 5) ---------------------------------------------------------

export interface DriftEntry {
  path: string;
  bucket: 'added' | 'removed' | 'valueChanged' | 'typeChanged';
  /** Figma-derived side (the "source of truth" the design declares). */
  figma?: FlatToken;
  /** Lumen-consumed side (what code actually resolves). */
  lumen?: FlatToken;
  /** semantic vs global — filled by classifyDrift(). */
  tier?: TokenTier;
}

export interface DriftReport {
  added: DriftEntry[]; // in Figma, absent in Lumen
  removed: DriftEntry[]; // in Lumen, absent in Figma
  valueChanged: DriftEntry[]; // same path+type, different $value
  typeChanged: DriftEntry[]; // same path, different $type
}

/**
 * Diff Figma-derived tokens against Lumen-consumed tokens.
 *   added        — declared in Figma, not consumed by Lumen
 *   removed      — consumed by Lumen, not declared in Figma
 *   typeChanged  — same path, `$type` differs (checked before value)
 *   valueChanged — same path & type, `$value` differs
 */
export function diffTokens(figma: FlatTokenSet, lumen: FlatTokenSet): DriftReport {
  const report: DriftReport = { added: [], removed: [], valueChanged: [], typeChanged: [] };
  const paths = new Set([...Object.keys(figma), ...Object.keys(lumen)]);

  for (const path of [...paths].sort()) {
    const f = figma[path];
    const l = lumen[path];
    if (f && !l) {
      report.added.push({ path, bucket: 'added', figma: f });
    } else if (!f && l) {
      report.removed.push({ path, bucket: 'removed', lumen: l });
    } else if (f && l) {
      if (f.type !== l.type) {
        report.typeChanged.push({ path, bucket: 'typeChanged', figma: f, lumen: l });
      } else if (f.value !== l.value) {
        report.valueChanged.push({ path, bucket: 'valueChanged', figma: f, lumen: l });
      }
    }
  }
  return report;
}

// ---- CLASSIFY (step 6 — semantic vs global, D21) ---------------------------

export type TokenTier = 'semantic' | 'global';

/**
 * A token is GLOBAL/primitive when its path is a raw value scale
 * (e.g. `color.blue.500`, `palette.*`, `primitive.*`, `global.*`), and
 * SEMANTIC otherwise (`color.primary.default`, `text.body`, `surface.*`).
 * D21 prefers semantic tokens: semantic drift ranks HIGHER than global-only.
 *
 * Heuristic, deterministic, and conservative — defaults to `semantic` (the
 * higher-severity bucket) when a path does not clearly look primitive, so
 * drift is never silently down-ranked.
 */
export function classifyTier(path: string): TokenTier {
  const segments = path.toLowerCase().split('.');
  const GLOBAL_ROOTS = new Set([
    'palette',
    'primitive',
    'primitives',
    'global',
    'globals',
    'ref',
    'reference',
    'scale',
  ]);
  if (GLOBAL_ROOTS.has(segments[0])) return 'global';
  // A trailing numeric step scale (blue.500, gray.100) is a primitive ramp.
  const last = segments[segments.length - 1];
  if (/^\d+$/.test(last)) return 'global';
  return 'semantic';
}

/** Annotate every drift entry with its tier (mutates + returns the report). */
export function classifyDrift(report: DriftReport): DriftReport {
  for (const bucket of Object.values(report)) {
    for (const entry of bucket as DriftEntry[]) {
      entry.tier = classifyTier(entry.path);
    }
  }
  return report;
}

// ---- summary helper (used by the command + hook for the REPORT step) -------

export interface DriftSummary {
  total: number;
  byBucket: Record<keyof DriftReport, number>;
  semantic: number;
  global: number;
  /** true when there is any semantic-tier drift — the higher-severity signal. */
  hasSemanticDrift: boolean;
}

export function summarize(report: DriftReport): DriftSummary {
  const buckets = ['added', 'removed', 'valueChanged', 'typeChanged'] as const;
  const all: DriftEntry[] = buckets.flatMap((b) => report[b]);
  const semantic = all.filter((e) => e.tier === 'semantic').length;
  const global = all.filter((e) => e.tier === 'global').length;
  return {
    total: all.length,
    byBucket: {
      added: report.added.length,
      removed: report.removed.length,
      valueChanged: report.valueChanged.length,
      typeChanged: report.typeChanged.length,
    },
    semantic,
    global,
    hasSemanticDrift: semantic > 0,
  };
}

/** One-shot: flatten both sides → diff → classify. Pure, offline. */
export function detectDrift(figmaTree: DtcgGroup, lumenTree: DtcgGroup): DriftReport {
  return classifyDrift(diffTokens(flattenDtcg(figmaTree), flattenDtcg(lumenTree)));
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

  // Two synthetic DTCG sets exercising all four diff buckets + both tiers.
  const figma: DtcgGroup = {
    color: {
      primary: { default: { $value: '#1e1e1e', $type: 'color' } }, // valueChanged (semantic)
      tertiary: { default: { $value: '#faec20', $type: 'color' } }, // added (semantic)
      blue: { '500': { $value: '#0000ff', $type: 'color' } }, // added (global — numeric leaf)
    },
    spacing: {
      md: { $value: '16', $type: 'dimension' }, // typeChanged (semantic): number→string in Lumen
    },
    typography: {
      body: { $value: 'PPCC Beacon Sans Regular 16px', $type: 'typography' }, // unchanged
    },
  };

  const lumen: DtcgGroup = {
    color: {
      primary: { default: { $value: '#000000', $type: 'color' } }, // valueChanged vs figma
      // tertiary + blue.500 absent → they are "added" (in figma, not lumen)
      legacy: { default: { $value: '#cccccc', $type: 'color' } }, // removed (in lumen, not figma; semantic)
    },
    spacing: {
      md: { $value: '16px', $type: 'string' }, // type differs (dimension→string)
    },
    typography: {
      body: { $value: 'PPCC Beacon Sans Regular 16px', $type: 'typography' }, // unchanged
    },
  };

  // flattenDtcg
  const flatF = flattenDtcg(figma);
  assert(flatF['color.primary.default'].value === '#1e1e1e', 'flattenDtcg resolves nested $value');
  assert(flatF['color.primary.default'].type === 'color', 'flattenDtcg resolves nested $type');
  assert(flatF['spacing.md'].value === '16', 'flattenDtcg stringifies numeric $value');
  assert(
    !Object.keys(flatF).some((k) => k.endsWith('.$description')),
    'flattenDtcg skips $-prefixed group metadata',
  );

  // determinism
  assert(
    JSON.stringify(flattenDtcg(figma)) === JSON.stringify(flattenDtcg(figma)),
    'flattenDtcg is deterministic (sorted keys)',
  );

  // diff — all four buckets
  const report = detectDrift(figma, lumen);
  assert(
    report.added.some((e) => e.path === 'color.tertiary.default'),
    'diff: added detects Figma-only token',
  );
  assert(
    report.added.some((e) => e.path === 'color.blue.500'),
    'diff: added detects Figma-only global token',
  );
  assert(
    report.removed.some((e) => e.path === 'color.legacy.default'),
    'diff: removed detects Lumen-only token',
  );
  assert(
    report.valueChanged.some((e) => e.path === 'color.primary.default'),
    'diff: valueChanged detects same-path different-value',
  );
  assert(
    report.typeChanged.some((e) => e.path === 'spacing.md'),
    'diff: typeChanged detects $type mismatch',
  );
  assert(
    !report.valueChanged.some((e) => e.path === 'spacing.md'),
    'diff: a type change is NOT double-counted as a value change',
  );
  assert(
    !report.added
      .concat(report.removed, report.valueChanged, report.typeChanged)
      .some((e) => e.path === 'typography.body'),
    'diff: an identical token produces no drift entry',
  );

  // classify — semantic vs global (D21)
  const tier = (path: string) =>
    report.added
      .concat(report.removed, report.valueChanged, report.typeChanged)
      .find((e) => e.path === path)?.tier;
  assert(
    classifyTier('color.primary.default') === 'semantic',
    'classify: color.primary.default → semantic',
  );
  assert(classifyTier('color.blue.500') === 'global', 'classify: numeric-leaf ramp → global');
  assert(classifyTier('palette.red.base') === 'global', 'classify: palette.* root → global');
  assert(
    classifyTier('surface.raised') === 'semantic',
    'classify: default is semantic (conservative)',
  );
  assert(tier('color.blue.500') === 'global', 'classify: added blue.500 annotated global');
  assert(
    tier('color.tertiary.default') === 'semantic',
    'classify: added tertiary annotated semantic',
  );

  // summary — buckets + tier counts
  const s = summarize(report);
  assert(
    s.total ===
      s.byBucket.added + s.byBucket.removed + s.byBucket.valueChanged + s.byBucket.typeChanged,
    'summary: total equals the sum of buckets',
  );
  assert(s.semantic + s.global === s.total, 'summary: semantic + global equals total');
  assert(s.hasSemanticDrift === true, 'summary: semantic drift present is flagged');

  console.log('\ntoken-drift.ts self-test passed.');
}
