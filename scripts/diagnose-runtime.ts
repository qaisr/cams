/**
 * Port-aware runtime pre-flight for the runtime-diagnostics workflow.
 *
 * Given a URL or bare port, it determines which dev service should own the
 * port, checks whether the port is listening, identifies the owning process,
 * and classifies it as:
 *   - known dev server belonging to THIS repo  (safe to kill)
 *   - dev server belonging to ANOTHER repo     (never auto-kill — report)
 *   - infra process (Postgres 5432 / LocalStack 4566) (never kill)
 *   - unrelated / unknown process               (never kill — report)
 *
 * Pure diagnostics by default. Pass --kill to terminate the occupant, but only
 * when it is a known dev server whose command line points inside this repo.
 * Pass --force-kill ONLY after the user has explicitly authorised killing a
 * known dev server that belongs to another repo (never for infra/unrelated).
 *
 * Usage:
 *   tsx scripts/diagnose-runtime.ts <url|port> [--kill] [--force-kill] [--json]
 *   tsx scripts/diagnose-runtime.ts http://localhost:6006/?path=/docs/foo
 *   tsx scripts/diagnose-runtime.ts 3001 --kill
 *   tsx scripts/diagnose-runtime.ts 6006 --force-kill   # cross-repo, user-approved
 */
import { execSync } from 'node:child_process';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..');

interface ServiceDef {
  port: number;
  name: string;
  /** command to start it from the repo root */
  start: string;
  /** substrings expected in the owning process command line */
  commandHints: string[];
  killable: boolean;
}

const SERVICES: ServiceDef[] = [
  {
    port: 3000,
    name: 'web (Next.js)',
    start: 'pnpm --filter @repo/web dev',
    commandHints: ['next', 'next dev', 'next-server'],
    killable: true,
  },
  {
    port: 3001,
    name: 'api (NestJS)',
    start: 'pnpm --filter @repo/api start:dev',
    commandHints: ['nest', 'nest start', 'main'],
    killable: true,
  },
  {
    port: 6006,
    name: 'storybook',
    start: 'pnpm sb',
    commandHints: ['storybook', 'storybook dev'],
    killable: true,
  },
  {
    port: 5000,
    name: 'aux dev server',
    start: '(project-specific)',
    commandHints: ['node'],
    killable: true,
  },
  {
    port: 8080,
    name: 'aux dev server',
    start: '(project-specific)',
    commandHints: ['node'],
    killable: true,
  },
  // Infra — managed by docker; NEVER killed by this tool.
  {
    port: 5432,
    name: 'PostgreSQL (docker)',
    start: 'pnpm infra:up',
    commandHints: ['postgres', 'docker', 'com.docker'],
    killable: false,
  },
  {
    port: 4566,
    name: 'LocalStack (docker)',
    start: 'pnpm infra:up',
    commandHints: ['localstack', 'docker', 'com.docker'],
    killable: false,
  },
];

type Classification = 'free' | 'known-this-repo' | 'known-other-repo' | 'infra' | 'unrelated';

interface Report {
  input: string;
  port: number | null;
  service: string;
  listening: boolean;
  pid: number | null;
  command: string | null;
  cwdPath: string | null;
  classification: Classification;
  killable: boolean;
  killed: boolean;
  startCommand: string;
  message: string;
}

function parsePort(input: string): number | null {
  if (/^\d+$/.test(input)) return Number(input);
  try {
    const url = new URL(input.includes('://') ? input : `http://${input}`);
    if (url.port) return Number(url.port);
    if (url.protocol === 'https:') return 443;
    if (url.protocol === 'http:') return 80;
  } catch {
    /* fallthrough */
  }
  const match = input.match(/:(\d{2,5})\b/);
  return match ? Number(match[1]) : null;
}

function getListenerPid(port: number): number | null {
  try {
    const out = execSync(`lsof -ti:${port} -sTCP:LISTEN`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const first = out.split('\n').filter(Boolean)[0];
    return first ? Number(first) : null;
  } catch {
    return null; // lsof exits non-zero when nothing is listening
  }
}

function getCommand(pid: number): string | null {
  try {
    const out = execSync(`ps -o command= -p ${pid}`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return String(out).trim();
  } catch {
    return null;
  }
}

/**
 * Best-effort working directory of the process, used to decide whether a dev
 * server belongs to THIS repo. Falls back to scanning the command line for the
 * repo root path.
 */
function getProcessPath(pid: number, command: string | null): string | null {
  try {
    const raw = execSync(`lsof -a -p ${pid} -d cwd -Fn`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const out = String(raw);
    const line = out.split('\n').find((l) => l.startsWith('n'));
    if (line) return line.slice(1).trim();
  } catch {
    /* fallthrough to command scan */
  }
  return command;
}

function belongsToThisRepo(pathOrCommand: string | null): boolean {
  if (!pathOrCommand) return false;
  return pathOrCommand.includes(REPO_ROOT);
}

function classify(
  service: ServiceDef | undefined,
  pid: number | null,
  command: string | null,
  procPath: string | null,
): Classification {
  if (pid === null) return 'free';
  if (service && !service.killable) return 'infra';

  const matchesKnownServer =
    !!service &&
    service.commandHints.some((h) => (command ?? '').toLowerCase().includes(h.toLowerCase()));

  if (!matchesKnownServer) return 'unrelated';
  return belongsToThisRepo(procPath) || belongsToThisRepo(command)
    ? 'known-this-repo'
    : 'known-other-repo';
}

function main(): void {
  const args = process.argv.slice(2);
  const wantKill = args.includes('--kill');
  // --force-kill authorises killing a KNOWN dev server that belongs to another
  // repo. It is ONLY passed after the user has explicitly chosen "kill it".
  // It never applies to infra or unrelated processes.
  const forceKill = args.includes('--force-kill');
  const wantJson = args.includes('--json');
  const input = args.find((a) => !a.startsWith('--')) ?? 'http://localhost:3000';

  const port = parsePort(input);
  const service = port !== null ? SERVICES.find((s) => s.port === port) : undefined;
  const pid = port !== null ? getListenerPid(port) : null;
  const command = pid !== null ? getCommand(pid) : null;
  const procPath = pid !== null ? getProcessPath(pid, command) : null;
  const classification = classify(service, pid, command, procPath);

  let killed = false;
  let message = '';

  switch (classification) {
    case 'free':
      message = `Port ${port} is free. Start ${service?.name ?? 'the service'} with: ${service?.start ?? 'the appropriate dev command'}`;
      break;
    case 'infra':
      message = `Port ${port} is held by ${service?.name} (PID ${pid}). This is infra — NEVER kill it. Manage with pnpm infra:up / pnpm infra:down.`;
      break;
    case 'unrelated':
      message = `Port ${port} is held by an UNRELATED process (PID ${pid}): ${command}. Refusing to kill. Free it manually or choose another port.`;
      break;
    case 'known-other-repo':
      if (forceKill) {
        try {
          execSync(`kill ${pid}`, { stdio: 'ignore' });
          killed = true;
          message = `Killed ${service?.name} (PID ${pid}) from another repo, as authorised by the user (--force-kill).`;
        } catch (err) {
          message = `Failed to kill PID ${pid}: ${(err as Error).message}`;
        }
      } else {
        message = [
          `Port ${port} is held by a ${service?.name} from ANOTHER repo (PID ${pid}): ${command}.`,
          `This server does not belong to ${REPO_ROOT} — NOT auto-killing.`,
          `Ask the user to choose:`,
          `  1) Kill it — re-run with --force-kill to terminate PID ${pid}, then start this repo's server.`,
          `  2) Kill it themselves — user runs: kill ${pid}`,
          `  3) Use another port — start this repo's server on a different port instead.`,
        ].join('\n');
      }
      break;
    case 'known-this-repo':
      if (wantKill) {
        try {
          execSync(`kill ${pid}`, { stdio: 'ignore' });
          killed = true;
          message = `Killed ${service?.name} (PID ${pid}) from this repo. Restart with: ${service?.start}`;
        } catch (err) {
          message = `Failed to kill PID ${pid}: ${(err as Error).message}`;
        }
      } else {
        message = `Port ${port} is held by this repo's ${service?.name} (PID ${pid}). Re-run with --kill to restart it, then: ${service?.start}`;
      }
      break;
  }

  const report: Report = {
    input,
    port,
    service: service?.name ?? 'unknown',
    listening: pid !== null,
    pid,
    command,
    cwdPath: procPath,
    classification,
    killable: classification === 'known-this-repo',
    killed,
    startCommand: service?.start ?? '(unknown)',
    message,
  };

  if (wantJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    process.stdout.write(
      [
        `Input:          ${report.input}`,
        `Port:           ${report.port ?? '(none)'}`,
        `Service:        ${report.service}`,
        `Listening:      ${report.listening ? `yes (PID ${report.pid})` : 'no'}`,
        report.command ? `Command:        ${report.command}` : '',
        `Classification: ${report.classification}`,
        `Killable here:  ${report.killable}`,
        report.killed ? 'Killed:         yes' : '',
        '',
        report.message,
        '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  // Non-zero exit when a refusal or failure occurred, so callers can branch.
  if (classification === 'unrelated') process.exit(2);
  if (classification === 'known-other-repo' && !killed) process.exit(2);
  if (wantKill && classification === 'known-this-repo' && !killed) process.exit(1);
}

main();
