/**
 * Sync command wrappers from .claude/commands/ to framework areas
 *
 * Source of truth:
 *   - .claude/commands/*.md
 *
 * Destinations (wrapper-only):
 *   - .vscode/ppcc-framework/prompts/*.prompt.md
 *   - .github/prompts/*.prompt.md
 *   - .vscode/ppcc-framework/commands/*.instructions.md
 *
 * SAFETY: This script ONLY READS from .claude/ and WRITES to other areas.
 * Never modify, delete, or overwrite anything in .claude/ folder.
 * .claude/ is the source of truth and must remain read-only.
 *
 * Usage: node .claude/scripts/sync-prompts.js [--check] [--quiet]
 *   --check   : Check what needs syncing without making changes
 *   --quiet   : Suppress output (exit code indicates status)
 *
 * Exit codes:
 *   0 = All synced or no changes needed
 *   1 = Errors occurred
 *   2 = Changes needed (in --check mode)
 */

const fs = require('fs');
const path = require('path');

const srcDir = '.claude/commands';
const checkMode = process.argv.includes('--check');
const quietMode = process.argv.includes('--quiet');

const wrappers = [
  {
    name: 'vscode-prompts',
    dir: '.vscode/ppcc-framework/prompts',
    suffix: '.prompt.md',
    render: (commandName) =>
      [
        '---',
        `name: ${commandName}`,
        `description: Slash discoverability wrapper for canonical ${commandName} prompt.`,
        'applyTo: "**"',
        '---',
        '',
        `# Wrapper: ${commandName}`,
        '',
        `Canonical prompt: \`../../../.claude/commands/${commandName}.md\``,
        '',
        'Delegate to the canonical prompt and keep this wrapper thin.',
        '',
      ].join('\n'),
  },
  {
    name: 'github-prompts',
    dir: '.github/prompts',
    suffix: '.prompt.md',
    render: (commandName) =>
      [
        '---',
        `name: ${commandName}`,
        `description: Slash discoverability wrapper for canonical ${commandName} prompt.`,
        'applyTo: "**"',
        '---',
        '',
        `# Wrapper: ${commandName}`,
        '',
        `Canonical prompt: \`../../.vscode/ppcc-framework/prompts/${commandName}.prompt.md\``,
        '',
        'Delegate to the canonical prompt and keep this wrapper thin.',
        '',
      ].join('\n'),
  },
  {
    name: 'vscode-commands',
    dir: '.vscode/ppcc-framework/commands',
    suffix: '.instructions.md',
    render: (commandName) =>
      [
        '---',
        `name: ${commandName}`,
        `description: Backward-compatible wrapper for the canonical ${commandName} prompt.`,
        'applyTo: "**"',
        '---',
        '',
        `# Wrapper: ${commandName}`,
        '',
        `Canonical prompt: \`../prompts/${commandName}.prompt.md\``,
        '',
        'Use the canonical prompt as the source of truth. Keep this wrapper thin.',
        '',
      ].join('\n'),
  },
];

function log(message) {
  if (!quietMode) {
    console.log(message);
  }
}

function logError(message) {
  if (!quietMode) {
    console.error('ERROR:', message);
  }
}

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getSourceCommands() {
  return fs
    .readdirSync(srcDir)
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => fileName.slice(0, -3))
    .sort();
}

function scanWrapperStatus(wrapper, commandNames) {
  ensureDirectory(wrapper.dir);

  const missing = [];
  const outdated = [];

  for (const commandName of commandNames) {
    const filePath = path.join(wrapper.dir, commandName + wrapper.suffix);
    const expected = wrapper.render(commandName);

    if (!fs.existsSync(filePath)) {
      missing.push(commandName);
      continue;
    }

    const current = fs.readFileSync(filePath, 'utf8');
    if (current !== expected) {
      outdated.push(commandName);
    }
  }

  return { missing, outdated };
}

function writeWrappers(wrapper, commandNames) {
  ensureDirectory(wrapper.dir);

  let created = 0;
  let updated = 0;

  for (const commandName of commandNames) {
    const filePath = path.join(wrapper.dir, commandName + wrapper.suffix);
    const isCreate = !fs.existsSync(filePath);
    const content = wrapper.render(commandName);

    fs.writeFileSync(filePath, content, 'utf8');

    if (isCreate) {
      log(`✓ Created: ${filePath}`);
      created += 1;
    } else {
      log(`✓ Updated: ${filePath}`);
      updated += 1;
    }
  }

  return { created, updated };
}

try {
  const commandNames = getSourceCommands();

  let totalMissing = [];
  let totalOutdated = [];

  for (const wrapper of wrappers) {
    const status = scanWrapperStatus(wrapper, commandNames);
    totalMissing = [...new Set([...totalMissing, ...status.missing])];
    totalOutdated = [...new Set([...totalOutdated, ...status.outdated])];
  }

  const needsSync = [...new Set([...totalMissing, ...totalOutdated])].sort();

  if (checkMode) {
    if (needsSync.length === 0) {
      log('✓ All wrappers in sync');
      process.exit(0);
    }

    if (totalMissing.length > 0) {
      log(`Missing: ${totalMissing.sort().join(', ')}`);
    }
    if (totalOutdated.length > 0) {
      log(`Outdated: ${totalOutdated.sort().join(', ')}`);
    }

    process.exit(2);
  }

  if (needsSync.length === 0) {
    log('✓ All wrappers in sync');
    process.exit(0);
  }

  let totalCreated = 0;
  let totalUpdated = 0;

  for (const wrapper of wrappers) {
    const result = writeWrappers(wrapper, needsSync);
    totalCreated += result.created;
    totalUpdated += result.updated;
  }

  log(`\nSync complete: ${totalCreated} created, ${totalUpdated} updated`);
  process.exit(0);
} catch (err) {
  logError(err.message);
  process.exit(1);
}
