#!/usr/bin/env tsx
/*
 * validate.ts — schema-validate any Figma-mirror JSON artifact against
 * figma/manifest.schema.json (Plan 02, Phase 3).
 *
 * WHY: the schema is the enforced contract (additionalProperties:false). Every
 * scaffolded/synced/reindexed artifact must prove-validate against it, so the
 * scaffold step, the sync engine, the reindex, and the Phase-3 exit-criteria
 * check all funnel through this one helper rather than re-implementing ajv wiring.
 *
 * The top-level schema is a `oneOf` over the five layers (figmaDomain,
 * figmaFileManifest, figmaNodeMeta, figmaIndex, figmaDesigners). You can:
 *   - validate against the whole oneOf (auto-detect the layer): validate(obj)
 *   - validate against a specific $def by name:                  validate(obj, 'figmaIndex')
 *
 * Pure w.r.t. inputs (compiles the schema once, in-process). ajv is already a
 * transitive dep (v8, draft-07 default) — no new dependency.
 *
 *   Run:       tsx scripts/figma/validate.ts <file.json> [defName]
 *   Directory: tsx scripts/figma/validate.ts figma            (validates every *.json in the mirror)
 *   Self-test: tsx scripts/figma/validate.ts --selftest
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export type DefName =
  | 'figmaDomain'
  | 'figmaFileManifest'
  | 'figmaNodeMeta'
  | 'figmaIndex'
  | 'figmaDesigners';

export interface ValidateResult {
  valid: boolean;
  /** Which $def matched (when auto-detecting via the top-level oneOf), if determinable. */
  matched?: DefName;
  errors: string[];
}

// ---- schema loading ---------------------------------------------------------

const SCHEMA_REL = 'figma/manifest.schema.json';

/** Absolute path to figma/manifest.schema.json, resolved from repo root. */
function schemaPath(root: string): string {
  return join(root, SCHEMA_REL) as string;
}

/** Repo root — scripts are always invoked from the repository root via tsx. */
function repoRoot(): string {
  return process.cwd() as string;
}

let _ajv: Ajv | null = null;
let _schema: Record<string, unknown> | null = null;

function loadAjv(root: string): { ajv: Ajv; schema: Record<string, unknown> } {
  if (_ajv && _schema) return { ajv: _ajv, schema: _schema };
  const raw = readFileSync(schemaPath(root), 'utf8');
  const schema = JSON.parse(raw) as Record<string, unknown>;
  // allErrors so a single call surfaces every violation, not just the first.
  // strict:false because the schema uses `description` on many nodes and draft-07
  // idioms ajv-strict would flag; the contract we care about is structural.
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv); // enables format:"date-time" checking
  ajv.addSchema(schema, schema['$id'] as string);
  _ajv = ajv;
  _schema = schema;
  return { ajv, schema };
}

// ---- validation -------------------------------------------------------------

/**
 * Validate `data` against the mirror schema. With no `def`, validates against
 * the top-level `oneOf` and reports which layer matched. With a `def`, validates
 * against that single `$def` (sharper errors when the layer is known).
 */
export function validate(data: unknown, def?: DefName, root: string = repoRoot()): ValidateResult {
  const { ajv, schema } = loadAjv(root);
  const id = schema['$id'] as string;

  if (def) {
    const ref = `${id}#/$defs/${def}`;
    const fn = ajv.getSchema(ref);
    if (!fn) return { valid: false, errors: [`unknown $def: ${def}`] };
    const valid = fn(data) as boolean;
    return {
      valid,
      matched: valid ? def : undefined,
      errors: valid ? [] : (fn.errors ?? []).map(fmtErr),
    };
  }

  // Auto-detect: try the whole schema (the oneOf) first.
  const whole = ajv.getSchema(id);
  const validWhole = whole ? (whole(data) as boolean) : false;

  // Determine which single layer matched, for a friendlier report.
  const defs: DefName[] = [
    'figmaDomain',
    'figmaFileManifest',
    'figmaNodeMeta',
    'figmaIndex',
    'figmaDesigners',
  ];
  let matched: DefName | undefined;
  for (const d of defs) {
    const fn = ajv.getSchema(`${id}#/$defs/${d}`);
    if (fn && (fn(data) as boolean)) {
      matched = d;
      break;
    }
  }

  if (validWhole) return { valid: true, matched, errors: [] };
  // Not valid against oneOf → collect the errors of the layer it most resembles
  // (the one with the fewest errors), else the top-level oneOf error.
  return { valid: false, matched, errors: bestErrors(ajv, id, defs, data) };
}

function bestErrors(ajv: Ajv, id: string, defs: DefName[], data: unknown): string[] {
  let best: { def: DefName; errs: string[] } | null = null;
  for (const d of defs) {
    const fn = ajv.getSchema(`${id}#/$defs/${d}`);
    if (!fn) continue;
    void fn(data);
    const errs = (fn.errors ?? []).map(fmtErr);
    if (!best || errs.length < best.errs.length) best = { def: d, errs };
  }
  if (!best) return ['does not match any known figma-mirror layer'];
  return [`closest layer: ${best.def}`, ...best.errs];
}

function fmtErr(e: { instancePath?: string; message?: string; params?: unknown }): string {
  const at = e.instancePath && e.instancePath.length ? e.instancePath : '(root)';
  const extra =
    e.params && typeof e.params === 'object' && 'allowedValues' in e.params
      ? ` [allowed: ${((e.params as { allowedValues: unknown[] }).allowedValues ?? []).join(', ')}]`
      : e.params && typeof e.params === 'object' && 'additionalProperty' in e.params
        ? ` [extra: ${(e.params as { additionalProperty: string }).additionalProperty}]`
        : '';
  return `${at}: ${e.message ?? 'invalid'}${extra}`;
}

// ---- directory sweep (used by the exit-criteria check) ----------------------

/** Which $def a mirror file validates as, keyed by its known path shape. */
function defForPath(relPath: string): DefName | undefined {
  const p = relPath.replace(/\\/g, '/');
  if (p.endsWith('figma/.manifest.json')) return 'figmaDomain';
  if (p.endsWith('figma/_index.json')) return 'figmaIndex';
  if (p.endsWith('figma/_designers.json')) return 'figmaDesigners';
  if (/figma\/files\/[^/]+\.json$/.test(p)) return 'figmaFileManifest';
  if (/figma\/nodes\/[^/]+\.meta\.json$/.test(p)) return 'figmaNodeMeta';
  return undefined; // manifest.schema.json itself, or an unknown file → skip
}

export interface SweepEntry {
  file: string;
  def?: DefName;
  result?: ValidateResult;
  skipped?: boolean;
}

/** Validate every recognised *.json under `figma/`, returning per-file results. */
export function validateMirror(root: string = repoRoot()): SweepEntry[] {
  const figmaDir = join(root, 'figma');
  const out: SweepEntry[] = [];
  if (!existsSync(figmaDir)) return out;

  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) {
        // Skip assets/ (binary + non-schema files live there).
        if (name === 'assets') continue;
        walk(abs);
        continue;
      }
      if (!name.endsWith('.json')) continue;
      const rel = relPosix(root, abs);
      if (rel.endsWith('figma/manifest.schema.json')) continue; // the schema itself
      const def = defForPath(rel);
      if (!def) {
        out.push({ file: rel, skipped: true });
        continue;
      }
      const data = JSON.parse(readFileSync(abs, 'utf8'));
      out.push({ file: rel, def, result: validate(data, def, root) });
    }
  };
  walk(figmaDir);
  return out;
}

function relPosix(root: string, abs: string): string {
  return (relative(root, abs).split(sep) as string[]).join('/');
}

// ---- CLI --------------------------------------------------------------------

const argv = process.argv;
if (argv[2] === '--selftest') {
  runSelfTest();
} else if (argv[1] && argv[1].endsWith('validate.ts')) {
  const target = argv[2];
  if (!target) {
    console.error('usage: tsx scripts/figma/validate.ts <file.json | figma> [defName]');
    process.exit(2);
  }
  const root = repoRoot();
  const abs = join(root, target);
  const isDir = existsSync(abs) && statSync(abs).isDirectory();
  if (isDir || target === 'figma') {
    const entries = validateMirror(root);
    let bad = 0;
    for (const e of entries) {
      if (e.skipped) {
        console.log(`⏭  ${e.file} (not a schema layer — skipped)`);
        continue;
      }
      if (e.result?.valid) {
        console.log(`✅ ${e.file} → ${e.def}`);
      } else {
        bad++;
        console.error(`❌ ${e.file} → ${e.def}`);
        for (const err of e.result?.errors ?? []) console.error(`     ${err}`);
      }
    }
    console.log(`\n${entries.length} files, ${bad} invalid.`);
    process.exit(bad ? 1 : 0);
  } else {
    const def = argv[3] as DefName | undefined;
    const data = JSON.parse(readFileSync(abs, 'utf8'));
    const r = validate(data, def, root);
    if (r.valid) {
      console.log(`✅ ${target} valid${r.matched ? ` (${r.matched})` : ''}`);
    } else {
      console.error(`❌ ${target} invalid${r.matched ? ` (closest: ${r.matched})` : ''}`);
      for (const err of r.errors) console.error(`   ${err}`);
      process.exit(1);
    }
  }
}

// ---- self-test --------------------------------------------------------------

function runSelfTest(): void {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) {
      console.error(`❌ ${msg}`);
      process.exit(1);
    }
    console.log(`✅ ${msg}`);
  };

  const goodNode = {
    source: 'figma',
    nodeId: '299:12006',
    fileKey: '2MbwX0rxNA1uhgDwlC7Z6G',
    name: 'E2E flow',
    pipeline: 'B',
    renderHash: 'sha256:' + 'a'.repeat(64),
    structureHash: 'sha256:' + 'b'.repeat(64),
    localEditsHash: 'sha256:' + 'c'.repeat(64),
    status_sync: 'clean',
    buildStatus: 'not-built',
    handshakeStatus: 'none',
    designer: 'qaiser.abbas',
    componentRef: null,
    lastSyncedAt: '2026-08-01T00:00:00.000Z',
    generatedAt: '2026-08-01T00:00:00.000Z',
  };
  const r1 = validate(goodNode, 'figmaNodeMeta');
  assert(r1.valid, 'valid figmaNodeMeta passes');

  // additionalProperties:false is enforced.
  const badExtra = { ...goodNode, bogus: 1 };
  const r2 = validate(badExtra, 'figmaNodeMeta');
  assert(!r2.valid, 'unknown property is rejected (additionalProperties:false)');

  // bad enum value rejected (proves reconciled enum is live).
  const badEnum = { ...goodNode, status_sync: 'in-sync' }; // the OLD, now-removed value
  const r3 = validate(badEnum, 'figmaNodeMeta');
  assert(!r3.valid, 'removed enum value "in-sync" is rejected (reconciled statusSync live)');

  // node id must be colon form.
  const badId = { ...goodNode, nodeId: '299-12006' };
  assert(!validate(badId, 'figmaNodeMeta').valid, 'hyphen node id rejected (colon form required)');

  // auto-detect picks the right layer.
  const auto = validate(goodNode);
  assert(auto.valid && auto.matched === 'figmaNodeMeta', 'auto-detect matches figmaNodeMeta');

  // a minimal valid index.
  const goodIndex = {
    generatedAt: '2026-08-01T00:00:00.000Z',
    lastSyncedAt: null,
    counts: {},
    files: [],
    items: [],
    byPipeline: {},
    byDesigner: {},
    byStatus: {},
  };
  assert(validate(goodIndex, 'figmaIndex').valid, 'minimal figmaIndex passes');

  // a minimal valid designers projection.
  const goodDesigners = {
    generatedAt: '2026-08-01T00:00:00.000Z',
    designers: [
      { handle: 'qaiser.abbas', name: 'Qaiser Abbas', figma: 'qaiser.abbas@ppcc.com.au' },
    ],
  };
  assert(validate(goodDesigners, 'figmaDesigners').valid, 'minimal figmaDesigners passes');

  console.log('\nvalidate.ts self-test passed.');
}
