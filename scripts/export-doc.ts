#!/usr/bin/env tsx
/*
 * export-doc.ts — orchestration helper for the /export command.
 *
 * Handles the multi-step pipelines that are awkward as inline bash:
 *   bundle   — inline ONE level of local .md links into a single Markdown file
 *   mermaid  — extract ```mermaid blocks from a .md and render each to png/svg/pdf
 *   md2html  — pandoc Markdown -> standalone PPCC-styled HTML (mermaid pre-rendered)
 *   md2pdf   — md2html then Chrome headless --print-to-pdf
 *
 * DOCX / PPTX / plain revealjs are done by the /export command with pandoc
 * directly (see .claude/commands/export.md); this script covers the steps that
 * need link-graph parsing, mermaid rendering, or Chrome.
 *
 * Tooling (all install-gated by the command, not here):
 *   pandoc                         (docs)
 *   npx -y @mermaid-js/mermaid-cli (mermaid render)
 *   Google Chrome (headless)       (HTML -> PDF)
 *
 * Usage:
 *   tsx scripts/export-doc.ts bundle  <root.md> --out <bundled.md>
 *   tsx scripts/export-doc.ts mermaid <input.md> --out-dir <dir> --format png|svg|pdf
 *   tsx scripts/export-doc.ts md2html <input.md> --out <out.html> [--css <file>] [--title <t>]
 *   tsx scripts/export-doc.ts md2pdf  <input.md> --out <out.pdf>  [--css <file>] [--title <t>]
 *
 * Nothing is deleted; outputs are written to the given paths (the command
 * places them under specs/exports/). Sources are never modified.
 */

import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ASSETS = path.join(ROOT, '.claude/assets/export');
const DEFAULT_DOC_CSS = path.join(ASSETS, 'ppcc-doc.css');

// ---------- tiny arg parser ----------
type Args = { _: string[]; [k: string]: string | boolean | string[] };
function parseArgs(argv: string[]): Args {
  const out: Args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function die(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function requireBin(bin: string, hint: string): void {
  try {
    execSync(`command -v ${bin}`, { stdio: 'ignore' });
  } catch {
    die(`Required tool "${bin}" not found. ${hint}`);
  }
}

function chromePath(): string {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    try {
      if (c.includes('/')) {
        if (existsSync(c)) return c;
      } else {
        execSync(`command -v ${c}`, { stdio: 'ignore' });
        return c;
      }
    } catch {
      /* keep trying */
    }
  }
  die(
    'Google Chrome / Chromium not found for PDF printing. Set CHROME_PATH, or export --to html and print manually.',
  );
}

// ---------- front-matter + link helpers ----------
function stripFrontMatter(md: string): string {
  if (md.startsWith('---')) {
    const end = md.indexOf('\n---', 3);
    if (end !== -1) {
      const after = md.indexOf('\n', end + 1);
      return md.slice(after + 1);
    }
  }
  return md;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Shift every ATX heading down by `by` levels (max 6), skipping fenced code.
function offsetHeadings(md: string, by: number): string {
  const lines = md.split('\n');
  let inFence = false;
  return lines
    .map((line) => {
      const fence = line.match(/^\s*(```|~~~)/);
      if (fence) inFence = !inFence;
      if (inFence) return line;
      const h = line.match(/^(#{1,6})(\s+.*)$/);
      if (h) {
        const level = Math.min(6, h[1].length + by);
        return '#'.repeat(level) + h[2];
      }
      return line;
    })
    .join('\n');
}

type MdLink = { link: string; text: string; abs: string };

function collectLinks(text: string, baseDir: string, seen: Set<string>): MdLink[] {
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  const out: MdLink[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const label = m[1];
    let target = m[2].trim().split(/\s+/)[0]; // drop optional "title"
    if (/^(https?:|mailto:|#)/i.test(target)) continue;
    target = target.split('#')[0];
    if (!target.toLowerCase().endsWith('.md')) continue;
    const abs = path.resolve(baseDir, target);
    if (!abs.startsWith(ROOT)) continue;
    if (!existsSync(abs)) continue;
    if (seen.has(abs)) continue;
    seen.add(abs);
    out.push({ link: target, text: label, abs });
  }
  return out;
}

/**
 * One level of local relative .md links, in document order, de-duplicated.
 *
 * Heuristic to avoid pulling incidental prose references (e.g. framework files)
 * into a deliverable: if the document contains Markdown TABLE rows with .md
 * links (an index/TOC table, as our BRD/strategy docs use), bundle ONLY those.
 * Otherwise fall back to every local .md link in the body. An explicit
 * --include list from the caller overrides both (handled in cmdBundle).
 * Skips: external (http/mailto), pure anchors, non-.md, files outside repo root.
 */
function findLocalMdLinks(md: string, baseDir: string): MdLink[] {
  const body = stripFrontMatter(md);
  const tableRows = body
    .split('\n')
    .filter((l) => /^\s*\|/.test(l) && /\]\([^)]+\.md/i.test(l))
    .join('\n');
  const fromTable = collectLinks(tableRows, baseDir, new Set());
  if (fromTable.length > 0) return fromTable;
  return collectLinks(body, baseDir, new Set());
}

// ---------- commands ----------

function cmdBundle(args: Args): void {
  const root = args._[1];
  const out = args.out as string;
  if (!root || !out) die('bundle: need <root.md> --out <bundled.md>');
  const rootAbs = path.resolve(root);
  if (!existsSync(rootAbs)) die(`bundle: root not found: ${root}`);

  const baseDir = path.dirname(rootAbs);
  const rootMd = readFileSync(rootAbs, 'utf8');

  // --include lets the command pass an explicit, ordered list (comma-separated
  // paths relative to the root doc), overriding the auto-detected links. Use
  // this when Claude has read the doc's index table and wants precise control.
  let links: MdLink[];
  if (typeof args.include === 'string') {
    const seen = new Set<string>();
    links = [];
    for (const raw of args.include
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      const abs = path.resolve(baseDir, raw);
      if (!abs.startsWith(ROOT)) die(`bundle: --include path outside repo: ${raw}`);
      if (!existsSync(abs)) die(`bundle: --include file not found: ${raw}`);
      if (seen.has(abs)) continue;
      seen.add(abs);
      links.push({ link: raw, text: path.basename(raw, '.md'), abs });
    }
  } else {
    links = findLocalMdLinks(rootMd, baseDir);
  }

  // Build the bundle: root body (front-matter stripped) + each linked file.
  const parts: string[] = [stripFrontMatter(rootMd).trimEnd()];
  const bundledAbs = new Set(links.map((l) => l.abs));

  for (const l of links) {
    const anchor = slugify(l.text);
    const childRaw = stripFrontMatter(readFileSync(l.abs, 'utf8'));
    const child = offsetHeadings(childRaw, 1).trimEnd();
    parts.push(
      '\n\n<div style="page-break-before: always"></div>\n',
      `\n# ${l.text} {#${anchor}}\n`,
      child,
    );
  }

  let bundle = parts.join('\n');

  // Rewrite intra-bundle links to anchors; mark not-included local .md links.
  bundle = bundle.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (whole, text: string, target: string) => {
    const clean = target.trim().split(/\s+/)[0];
    if (/^(https?:|mailto:|#)/i.test(clean)) return whole;
    const bare = clean.split('#')[0];
    if (!bare.toLowerCase().endsWith('.md')) return whole;
    const abs = path.resolve(baseDir, bare);
    if (bundledAbs.has(abs)) {
      const match = links.find((x) => x.abs === abs)!;
      return `[${text}](#${slugify(match.text)})`;
    }
    return `${text} (not included)`;
  });

  mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  writeFileSync(path.resolve(out), bundle, 'utf8');
  console.log(`✅ bundled ${links.length} linked file(s) → ${out}`);
  for (const l of links) console.log(`   + ${path.relative(ROOT, l.abs)}`);
}

/** Extract ```mermaid blocks and render each via mermaid-cli. Returns output paths. */
function cmdMermaid(args: Args): string[] {
  const input = args._[1];
  const outDir = (args['out-dir'] as string) || path.dirname(path.resolve(input));
  const format = ((args.format as string) || 'svg').toLowerCase();
  if (!input) die('mermaid: need <input.md> [--out-dir <dir>] [--format png|svg|pdf]');
  if (!['png', 'svg', 'pdf'].includes(format)) die(`mermaid: bad format ${format}`);

  const md = readFileSync(path.resolve(input), 'utf8');
  const re = /```mermaid\s*\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) blocks.push(m[1].trim());

  if (blocks.length === 0) {
    console.log('ℹ️  no ```mermaid blocks found');
    return [];
  }
  mkdirSync(outDir, { recursive: true });
  const stem = path.basename(input, path.extname(input));
  const tmp = mkdtempSync(path.join(tmpdir(), 'mmd-'));
  const outputs: string[] = [];
  try {
    blocks.forEach((code, i) => {
      const src = path.join(tmp, `d${i}.mmd`);
      writeFileSync(src, code, 'utf8');
      const suffix = blocks.length > 1 ? `-${i + 1}` : '';
      const outFile = path.join(outDir, `${stem}${suffix}.${format}`);
      // -b transparent keeps diagrams clean on any background.
      execFileSync(
        'npx',
        ['-y', '@mermaid-js/mermaid-cli', '-i', src, '-o', outFile, '-b', 'transparent'],
        { stdio: 'inherit' },
      );
      outputs.push(outFile);
      console.log(`✅ diagram ${i + 1}/${blocks.length} → ${path.relative(ROOT, outFile)}`);
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return outputs;
}

/**
 * Replace ```mermaid blocks in `md` with rendered <img> (SVG data-uri) and
 * return the rewritten Markdown. Used before pandoc so diagrams appear inline.
 */
function inlineMermaidAsSvg(md: string, workDir: string): string {
  const re = /```mermaid\s*\n([\s\S]*?)```/g;
  let idx = 0;
  return md.replace(re, (_whole, code: string) => {
    const src = path.join(workDir, `inline-${idx}.mmd`);
    const out = path.join(workDir, `inline-${idx}.svg`);
    writeFileSync(src, code.trim(), 'utf8');
    try {
      execFileSync(
        'npx',
        ['-y', '@mermaid-js/mermaid-cli', '-i', src, '-o', out, '-b', 'transparent'],
        { stdio: 'inherit' },
      );
      const svg = readFileSync(out, 'utf8');
      idx++;
      // Embed inline so pandoc's standalone HTML is self-contained.
      return `\n<figure>\n${svg}\n</figure>\n`;
    } catch {
      idx++;
      console.error('⚠️  mermaid render failed — leaving code block (NEEDS REVIEW)');
      return `\n\`\`\`\n${code}\n\`\`\`\n`;
    }
  });
}

function cmdMd2Html(args: Args): string {
  requireBin('pandoc', 'Install with: brew install pandoc');
  const input = args._[1];
  const out = (args.out as string) || input.replace(/\.md$/, '.html');
  const css = (args.css as string) || DEFAULT_DOC_CSS;
  const title = (args.title as string) || path.basename(input, '.md');
  if (!input) die('md2html: need <input.md> --out <out.html>');

  const md = readFileSync(path.resolve(input), 'utf8');
  const work = mkdtempSync(path.join(tmpdir(), 'exp-'));
  try {
    const rewritten = inlineMermaidAsSvg(md, work);
    const mdTmp = path.join(work, 'doc.md');
    writeFileSync(mdTmp, rewritten, 'utf8');
    mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    execFileSync(
      'pandoc',
      [
        mdTmp,
        '-f',
        'gfm+raw_html',
        '-t',
        'html5',
        '--standalone',
        '--toc',
        '--toc-depth=3',
        '--metadata',
        `title=${title}`,
        '--syntax-highlighting=tango',
        '--css',
        path.resolve(css),
        '--embed-resources',
        '-o',
        path.resolve(out),
      ],
      { stdio: 'inherit' },
    );
    console.log(`✅ HTML → ${out}`);
    const resolved: string = path.resolve(out);
    return resolved;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function cmdMd2Pdf(args: Args): void {
  const input = args._[1];
  const out = (args.out as string) || input.replace(/\.md$/, '.pdf');
  if (!input) die('md2pdf: need <input.md> --out <out.pdf>');
  const chrome = chromePath();

  // 1) build HTML into a temp file
  const work = mkdtempSync(path.join(tmpdir(), 'pdf-'));
  const htmlTmp = path.join(work, 'doc.html');
  try {
    cmdMd2Html({ ...args, _: ['md2html', input], out: htmlTmp });
    // 2) Chrome headless print
    mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    execFileSync(
      chrome,
      [
        '--headless',
        '--disable-gpu',
        '--no-pdf-header-footer',
        `--print-to-pdf=${path.resolve(out)}`,
        `file://${htmlTmp}`,
      ],
      { stdio: 'inherit' },
    );
    console.log(`✅ PDF → ${out}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// ---------- dispatch ----------
const args = parseArgs(process.argv.slice(2));
const sub = args._[0];
switch (sub) {
  case 'bundle':
    cmdBundle(args);
    break;
  case 'mermaid':
    cmdMermaid(args);
    break;
  case 'md2html':
    cmdMd2Html(args);
    break;
  case 'md2pdf':
    cmdMd2Pdf(args);
    break;
  default:
    die(`Unknown subcommand "${sub ?? ''}". Use: bundle | mermaid | md2html | md2pdf`);
}
