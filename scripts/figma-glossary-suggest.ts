#!/usr/bin/env tsx
/*
 * figma-glossary-suggest.ts — OFFLINE fuzzy matcher that PROPOSES `inferred`
 * Figma↔Lumen glossary entries (Plan 02b §1 / Phase 5 F1).
 *
 * WHY a script: `/figma-glossary suggest` needs a deterministic, dry-run engine
 * that maps Figma component names (from figma/_index.json.componentUsage) to
 * Lumen code components (folders under apps/web/src/components/) — closing the
 * gap the raw convention scan silently misses (e.g. TopNavigationBars ↔
 * DefaultTopAppBarScaffold, which fuzzy match alone will NOT find; that pairing
 * is a human-verified glossary entry, never a suggestion).
 *
 * Contract (every invariant is load-bearing — see Phase 5 brief §Part A):
 *   - PURE / OFFLINE. Reads the derived index + the Lumen component tree +
 *     the committed glossary on disk. NO Figma reads, NO MCP — a suggest is
 *     never a sync and never advances `lastSyncedAt`.
 *   - DRY-RUN ONLY. Emits proposals to stdout; it NEVER writes the glossary.
 *     A human approves the subset and adds each via `/figma-glossary add` (which
 *     writes a `verified` entry). Proposals are always `source: "inferred"`.
 *   - AUTHORITATIVE WINS: any Figma name already resolved by a glossary entry
 *     (by figmaName OR alias, case-insensitive) is skipped — the glossary is
 *     the authority (BD2/D22); the scan may only propose the unresolved ones.
 *   - Fuzzy score is a normalized edit-distance similarity in [0,1]; only
 *     matches at or above `MIN_CONFIDENCE` are proposed, best Lumen match per
 *     Figma name, ties broken by Lumen name asc for determinism.
 *
 * The `now` clock is never read — this script has no timestamps in its output.
 *
 *   Run:       tsx scripts/figma-glossary-suggest.ts [--root <dir>] [--json]
 *   Self-test: tsx scripts/figma-glossary-suggest.ts --selftest
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ---- shapes -----------------------------------------------------------------

type GlossarySource = 'verified' | 'inferred';

interface GlossaryEntry {
  figmaName: string;
  lumenComponent: string;
  lumenPath: string;
  aliases: string[];
  confidence: number;
  source: GlossarySource;
}

interface Glossary {
  _note?: string;
  entries: GlossaryEntry[];
  unresolvedPolicy?: string;
}

/** A Lumen component discovered on disk. */
interface LumenComponent {
  name: string; // folder name, e.g. "DefaultTopAppBarScaffold"
  path: string; // repo-relative, e.g. "apps/web/src/components/navigation/DefaultTopAppBarScaffold"
}

/** A dry-run proposal — always inferred, never written by this script. */
interface Proposal {
  figmaName: string;
  lumenComponent: string;
  lumenPath: string;
  aliases: [];
  confidence: number; // rounded fuzzy score
  source: 'inferred';
}

interface SuggestInput {
  /** Figma component names seen in the mirror (index.componentUsage keys). */
  figmaNames: string[];
  lumen: LumenComponent[];
  glossary: Glossary;
}

// Only propose matches at least this similar. Below this the pairing is noise a
// human would reject; the honest output is "unresolved → ask" (propose-then-ask).
const MIN_CONFIDENCE = 0.6;

// ---- pure fuzzy-match core (no I/O, unit-testable) --------------------------

/** Levenshtein edit distance between two strings. */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  let curr: number[] = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Normalized similarity in [0,1]; 1 = identical, case-insensitive. */
export function similarity(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x === y) return 1;
  const maxLen = Math.max(x.length, y.length);
  if (maxLen === 0) return 1;
  return 1 - editDistance(x, y) / maxLen;
}

/** All names the glossary already resolves (figmaName + aliases), lower-cased. */
export function resolvedNames(glossary: Glossary): Set<string> {
  const set = new Set<string>();
  for (const e of glossary.entries) {
    set.add(e.figmaName.toLowerCase());
    for (const a of e.aliases) set.add(a.toLowerCase());
  }
  return set;
}

/**
 * Pure suggestion engine. For every Figma name NOT already resolved by the
 * glossary, find the best Lumen component above MIN_CONFIDENCE and emit an
 * `inferred` proposal. Deterministic: proposals sorted by figmaName asc; per
 * name the best Lumen match wins, ties broken by lumen name asc.
 */
export function suggest(input: SuggestInput): Proposal[] {
  const resolved = resolvedNames(input.glossary);
  const proposals: Proposal[] = [];

  for (const figmaName of input.figmaNames) {
    if (resolved.has(figmaName.toLowerCase())) continue; // authoritative wins

    let best: { c: LumenComponent; score: number } | null = null;
    for (const c of input.lumen) {
      const score = similarity(figmaName, c.name);
      if (best === null || score > best.score || (score === best.score && c.name < best.c.name)) {
        best = { c, score };
      }
    }

    if (best && best.score >= MIN_CONFIDENCE) {
      proposals.push({
        figmaName,
        lumenComponent: best.c.name,
        lumenPath: best.c.path,
        aliases: [],
        confidence: Math.round(best.score * 100) / 100,
        source: 'inferred',
      });
    }
  }

  return proposals.sort((a, b) => a.figmaName.localeCompare(b.figmaName));
}

// ---- I/O layer (impure; reads the tree, calls the pure engine) --------------

/** Discover Lumen components: leaf folders two levels under components/. */
export function readLumenComponents(root: string): LumenComponent[] {
  const base = join(root, 'apps', 'web', 'src', 'components');
  const out: LumenComponent[] = [];
  if (!existsSync(base) || !statSync(base).isDirectory()) return out;
  for (const group of readdirSync(base).sort()) {
    const groupDir = join(base, group);
    if (!statSync(groupDir).isDirectory()) continue;
    for (const comp of readdirSync(groupDir).sort()) {
      const compDir = join(groupDir, comp);
      if (!statSync(compDir).isDirectory()) continue;
      out.push({ name: comp, path: `apps/web/src/components/${group}/${comp}` });
    }
  }
  return out;
}

function readGlossary(root: string): Glossary {
  const p = join(root, '.claude', 'config', 'figma-lumen-glossary.json');
  if (!existsSync(p)) return { entries: [] };
  return JSON.parse(readFileSync(p, 'utf8')) as Glossary;
}

/** Figma component names from figma/_index.json.componentUsage keys. */
function readFigmaNames(root: string): string[] {
  const p = join(root, 'figma', '_index.json');
  if (!existsSync(p)) return [];
  const idx = JSON.parse(readFileSync(p, 'utf8')) as { componentUsage?: Record<string, unknown> };
  return Object.keys(idx.componentUsage ?? {}).sort();
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

  // Similarity sanity.
  assert(similarity('ResultTemplate', 'ResultTemplate') === 1, 'identical → 1.0');
  assert(similarity('resulttemplate', 'ResultTemplate') === 1, 'case-insensitive → 1.0');
  assert(similarity('Button', 'Buton') > 0.7, 'near match Button/Buton > 0.7');
  assert(
    similarity('TopNavigationBars', 'DefaultTopAppBarScaffold') < 0.6,
    'verified pair is NOT fuzzy-findable',
  );

  const glossary: Glossary = {
    entries: [
      {
        figmaName: 'TopNavigationBars',
        lumenComponent: 'DefaultTopAppBarScaffold',
        lumenPath: 'apps/web/src/components/navigation/DefaultTopAppBarScaffold',
        aliases: ['TopNav', 'AppBar'],
        confidence: 1.0,
        source: 'verified',
      },
    ],
  };

  const lumen: LumenComponent[] = [
    { name: 'Button', path: 'apps/web/src/components/ui/Button' },
    { name: 'Dialog', path: 'apps/web/src/components/composite/Dialog' },
    {
      name: 'DefaultTopAppBarScaffold',
      path: 'apps/web/src/components/navigation/DefaultTopAppBarScaffold',
    },
  ];

  // 'Button' → exact Lumen match; 'AppBar' is a glossary alias → skipped;
  // 'Zzz' → no match above threshold → no proposal (unresolved → ask).
  const proposals = suggest({
    figmaNames: ['Button', 'AppBar', 'Zzz'],
    lumen,
    glossary,
  });

  assert(proposals.length === 1, 'only the unresolved, matchable name proposed');
  assert(proposals[0].figmaName === 'Button', 'proposal is for Button');
  assert(proposals[0].lumenComponent === 'Button', 'Button → Button (exact)');
  assert(proposals[0].confidence === 1.0, 'exact match confidence 1.0');
  assert(proposals[0].source === 'inferred', 'every proposal is inferred, never verified');
  assert(
    !proposals.some((p) => p.figmaName === 'AppBar'),
    'glossary alias AppBar is authoritative → not proposed',
  );
  assert(!proposals.some((p) => p.figmaName === 'Zzz'), 'below-threshold name → no proposal');

  // Determinism.
  const again = suggest({ figmaNames: ['Zzz', 'AppBar', 'Button'], lumen, glossary });
  assert(
    JSON.stringify(again) === JSON.stringify(proposals),
    'suggest is deterministic (input order-independent)',
  );

  console.log('\nfigma-glossary-suggest.ts self-test passed.');
}

// ---- CLI --------------------------------------------------------------------

function parseRoot(argv: string[]): string {
  const i = argv.indexOf('--root');
  const rootArg = argv[i + 1] as string | undefined;
  if (i !== -1 && rootArg) return rootArg;
  return process.cwd() as string;
}

if (process.argv[2] === '--selftest') {
  runSelfTest();
} else if (process.argv[1] && process.argv[1].endsWith('figma-glossary-suggest.ts')) {
  const root = parseRoot(process.argv);
  const json = process.argv.includes('--json');

  const figmaNames = readFigmaNames(root);
  const lumen = readLumenComponents(root);
  const glossary = readGlossary(root);
  const proposals = suggest({ figmaNames, lumen, glossary });

  if (json) {
    console.log(JSON.stringify({ proposals }, null, 2));
  } else if (figmaNames.length === 0) {
    console.log(
      'No Figma components in figma/_index.json.componentUsage yet ' +
        '(populated by Phase-4 codegen). Nothing to suggest — DRY RUN.',
    );
  } else if (proposals.length === 0) {
    console.log(
      `Scanned ${figmaNames.length} Figma name(s) against ${lumen.length} Lumen component(s): ` +
        'no fuzzy match above the confidence floor. Unresolved names → propose-then-ask. DRY RUN.',
    );
  } else {
    console.log(
      `DRY RUN — ${proposals.length} proposed inferred entr${proposals.length === 1 ? 'y' : 'ies'} ` +
        `(scanned ${figmaNames.length} Figma name(s) vs ${lumen.length} Lumen component(s)). ` +
        'NOTHING written. Approve a subset, then add each via `/figma-glossary add`:\n',
    );
    for (const p of proposals) {
      console.log(
        `  ${p.figmaName}  →  ${p.lumenComponent}  (${p.lumenPath})  ` +
          `confidence ${p.confidence}  [inferred]`,
      );
    }
  }
}
