---
name: health-scan
description: On-demand deep scan for tooling integrity, dependency vulnerabilities, outdated packages, deprecations, and formatter-config sync (Prettier = source of truth)
applyTo: "**"
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: medium
---

# Health Scan — Dependency & Tooling Health

**Purpose**: A deliberate, on-demand deep scan for the class of latent problems
that fast git hooks cannot afford to run: dependency vulnerabilities, outdated
packages, deprecation warnings, config corruption, Snyk/SonarQube/Dependabot
findings, and formatter-config drift (keeping `.editorconfig` / `.yamllint` /
VS Code in sync with Prettier, the source of truth).

**Use this command when**:

- Push output shows Snyk / audit / Dependabot warnings you want to triage
- Before a release, or on a regular cadence (a weekly reminder may be scheduled)
- After a dependency change, or when a deprecation warning appears
- After changing `.prettierrc*` (custom width/indent) — resync other formatters
- Investigating why git hooks stopped firing

**Relationship to other guards**:

- The husky `pre-commit` / `pre-push` hooks run only the _fast_ subset
  (hooksPath sanity, stray-dir, husky-deprecation, non-blocking `pnpm audit`,
  Snyk when `SNYK_TOKEN` is set). This command runs the _heavy_ scans those
  hooks intentionally skip.
- `/security-audit` audits **application code** (OWASP, auth, injection).
  `/health-scan` covers **dependency + infrastructure health**.
  They are complementary — run both before a release.

---

## READ-ONLY BY DEFAULT

This command **reports and proposes** fix commands. It does **NOT** auto-run
`snyk fix`, `pnpm upgrade`, `pnpm update`, or edit `package.json` /
`.editorconfig` / `.yamllint` / `.vscode/settings.json` without explicit user
consent — mirroring `commit.md`'s "never auto-fix without showing what will be
fixed" rule. Present findings first, then ask before changing anything.

---

## Phase 0 — Tooling Integrity (fast, always runs)

Catch the config/tooling drift that silently breaks the toolchain.

```bash
# 0a. hooksPath must point at husky's wrapper dir
git config core.hooksPath          # expect: .husky/_
```

If the value is anything other than `.husky/_` (e.g. `--version/_`), git hooks
are misfiring. **Fix**: `git config core.hooksPath .husky/_`

```bash
# 0b. Stray husky-install junk at repo root
ls -d ./--* 2>/dev/null             # expect: no matches
```

If a `./--version` (or any `./--*`) directory exists, it is husky-accident junk.
**Fix**: `rm -rf './--version'` (verify it is untracked first: `git status`).

```bash
# 0c. Husky v9→v10 deprecation preamble in hook files.
# Match the real preamble only: shebang on line 1, or a dot-source *command*
# for husky.sh (line begins with `. `) — not an echo string mentioning it.
for h in .husky/pre-commit .husky/pre-push .husky/commit-msg; do
  [ -f "$h" ] || continue
  { [ "$(head -n1 "$h")" = "#!/usr/bin/env sh" ] || grep -qE '^[[:space:]]*\.[[:space:]].*/_/husky\.sh' "$h"; } && echo "$h"
done
```

Any file listed still carries the deprecated v9 preamble. **Fix**: remove the
`#!/usr/bin/env sh` shebang and the `. "$(dirname ...)/_/husky.sh"` sourcing
line. `pre-commit` / `commit-msg` are the migrated reference format.

```bash
# 0d. Installed husky vs declared range — NEVER run `husky --version`
#     (that rewrites core.hooksPath and breaks all hooks — see commit.md)
grep '"husky"' package.json         # declared range
pnpm why husky                      # installed version in the tree
```

---

## Phase 1 — Dependency Vulnerabilities

```bash
# 1a. Local audit (existing script: `pnpm audit`)
pnpm audit --audit-level=high
```

- **`ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS`** → the internal Artifactory registry
  has no audit endpoint. This is expected, not a failure. Fall through to Snyk
  (1b) and Dependabot (1c) for authoritative results.
- High/critical findings → record package, advisory, and fixed-in version.

```bash
# 1b. Snyk (existing scripts) — authoritative for vulnerabilities
pnpm snyk:test        # snyk test --severity-threshold=high --all-projects
```

- If Snyk reports not authenticated → instruct the user to run `pnpm snyk:auth`
  (or `export SNYK_TOKEN=...`). Do NOT attempt to auth non-interactively.
- Honour the ignore rules in `.snyk` — findings listed there are already triaged.
- Fix path (with consent only): `pnpm snyk:fix`; monitor: `pnpm snyk:monitor`.

```bash
# 1c. Dependabot (read-only) — GitHub is authoritative on the default branch
gh api repos/{owner}/{repo}/dependabot/alerts --jq '[.[] | select(.state=="open")] | length' 2>/dev/null
```

- Or point the user to the repo's **Security → Dependabot alerts** dashboard.
- **CI is authoritative**: Snyk and SonarQube DO run in CI here
  (`.github/workflows/security.yml`, `.github/workflows/sonar.yml`,
  `.github/workflows/ci.yml`). Before relying on that, confirm the workflows are
  green on the default branch — a red or skipped security workflow means the
  "CI is authoritative" assumption is temporarily untrue; call it out in the
  report (see Phase 5).

---

## Phase 2 — Outdated Packages

```bash
# 2a. Recursive across the workspace
pnpm outdated -r
```

- Group findings into **major** (breaking — needs review) vs **minor/patch**
  (usually safe).
- Reference the CLAUDE.md dependency rule: **always resolve the latest stable
  with `pnpm view <pkg> version` before writing a version to `package.json`** —
  never copy a version from memory or a template. See
  `.claude/standards/monorepo-standards.md#dependency-installation-rules`.
- The `pnpm upgrade` script (`pnpm update --latest --recursive && pnpm install
&& pnpm build`) exists but is **destructive across the whole tree** — propose
  it only with consent; prefer targeted `pnpm add <pkg>@latest` for specific
  packages (`/upgrade-dependencies` is the guided path).

```bash
# 2b. Unused / missing dependencies (existing script: `pnpm depcheck`)
pnpm depcheck
```

---

## Phase 3 — Formatter Config Sync

**Principle**: **Prettier config is the single source of truth for formatting.**
This means `.prettierrc.json` (its defaults **plus** every entry in
`overrides[]`). All other formatter configs must conform to it — never the
reverse. This phase detects drift and (with consent) rewrites the _downstream_
configs to match. `.prettierrc*` itself is **never** modified here.

### 3a. Derive the effective Prettier values (source of truth)

```bash
# Locate the Prettier config (first match wins)
ls .prettierrc .prettierrc.json .prettierrc.* prettier.config.* 2>/dev/null
```

Read the config and resolve the **effective per-file-type** values. Take the
base values, then apply each `overrides[]` entry for its `files` glob. Current
`.prettierrc.json` resolves to:

- `tabWidth` 2 · `useTabs` false · `endOfLine` lf (base)
- `printWidth` — base **100**; `*.json` → **80**, `*.yaml` → **120**,
  `*.md` → **80**, `*.prisma` → **120**.

Also read `.prettierignore` — files Prettier ignores are **out of scope**;
downstream tools should not police them either (see 3d).

### 3b. Check `.editorconfig`

`max_line_length` is only an IDE hint (it never rewrites files), but it must
**advertise the same numbers** Prettier enforces so the two never appear to
disagree.

| EditorConfig key             | Must equal Prettier                     |
| ---------------------------- | --------------------------------------- |
| `indent_size`                | `tabWidth`                              |
| `indent_style`               | `space` if `useTabs:false`, else `tab`  |
| `end_of_line`                | `endOfLine`                             |
| `max_line_length` (per glob) | effective `printWidth` for that glob    |

Report any mismatch with the exact old→new delta. Example drift:
`[*.{json,jsonc}]` has no `max_line_length` (inherits 100) but Prettier JSON
override is 80 → **add `max_line_length = 80`**.

### 3c. Check `.yamllint`

| yamllint rule              | Must equal Prettier                            |
| -------------------------- | ---------------------------------------------- |
| `rules.indentation.spaces` | `tabWidth`                                     |
| `rules.line-length.max`    | effective `printWidth` for `*.yaml` (120 here) |

Keep `line-length.level: warning` — yamllint stays advisory; Prettier does the
actual wrapping.

### 3d. Check `.yamllint` ignore scope vs `.prettierignore`

If Prettier ignores a path (`.prettierignore`) but yamllint does not
(`.yamllint` `ignore:` block), yamllint's Prettier-derived width would police
files Prettier deliberately leaves alone. Report any such gap and propose adding
the missing paths to yamllint's `ignore:` list. In this repo `.prettierignore`
excludes `.claude/templates/`, `.claude/agents/`, `.claude/commands/`,
`.claude/patterns/`, `.claude/standards/`, `.claude/workflows/`, `.claude/docs/`
and `**/generated/` — yamllint's `ignore:` should mirror the same scope.

### 3e. Check `.vscode/settings.json` (usually ✅)

Confirm it **delegates** to Prettier and carries no contradicting hardcoded
values:

```bash
grep -E '"editor\.defaultFormatter"|"editor\.tabSize"|"editor\.rulers"' .vscode/settings.json
```

- `editor.defaultFormatter` should be `esbenp.prettier-vscode` (globally and per
  language, except `*.prisma` → `Prisma.prisma` and `*.sh` →
  `foxundermoon.shell-format`, which are correct). ✅
- `editor.tabSize` must equal `tabWidth` (2). `editor.rulers` is a visual guide —
  if present it should match the **base** `printWidth` (100). A value that
  contradicts Prettier is drift → report it.

### 3f. Generic drift rule

If a project sets or changes **any** custom `.prettierrc*` value (e.g.
`tabWidth: 4`, a new `overrides[]` entry, a different `endOfLine`), every
downstream config still showing the old value is drift — flag each with its
old→new delta.

### Consent gate (READ-ONLY by default)

Per this command's top-level rule, report the drift and the **exact** edits
first, then ask before writing. When approved:

- Edit **only** the downstream configs (`.editorconfig`, `.yamllint`,
  `.vscode/settings.json`) — **never** `.prettierrc*`.
- Do **NOT** run `pnpm format` / `prettier --write` unless the user separately
  asks. Changing advisory numbers must not trigger source-file reformatting —
  surprise churn is the exact problem this phase exists to prevent.

> Related: `/setup-formatters` is the guided setup/repair path for the whole
> Prettier-owns-formatting / ESLint-owns-quality / VS Code-delegates chain. Use
> it when the sync is broken rather than merely drifted.

---

## Phase 4 — Deprecation Sweep

```bash
# 4a. Deprecated transitive/direct packages surfaced during install
pnpm install 2>&1 | grep -i deprecat
```

- npm/pnpm print `deprecated <pkg>@<ver>: <reason>` lines during resolution.
- For each, note the replacement the maintainer recommends.

```bash
# 4b. Known tool-migration checks
grep '"husky"' package.json         # husky v9 → v10 migration (see Phase 0c)
pnpm why eslint                     # eslint 8 → 9 flat-config migration, etc.
```

---

## Phase 5 — Report

Produce a prioritized summary. Separate **blocking** (must fix before
release/merge) from **advisory** (schedule, non-urgent). Give the exact fix
command per finding.

```
🩺 HEALTH SCAN — <date>

Phase 0 · Tooling integrity
  ✅ core.hooksPath = .husky/_
  ✅ no stray ./--* dirs
  ✅ no deprecated husky lines
  ⚠️  husky ^9.1.7 — v10 available (advisory)

Phase 1 · Vulnerabilities
  ℹ️  pnpm audit — endpoint unavailable on Artifactory (expected)
  ⚠️  Snyk — SNYK_TOKEN not set; run `pnpm snyk:auth` to scan
  ❌ Dependabot — 9 open alerts on default branch → review dashboard

Phase 2 · Outdated
  ⚠️  <n> majors, <n> minors  (see `pnpm outdated -r`)

Phase 3 · Formatter sync (Prettier = source of truth)
  ✅ .editorconfig in sync   ✅ .yamllint in sync   ✅ .vscode delegated
  (or: ⚠️  <n> configs drifted → .editorconfig JSON width 100→80, ...)

Phase 4 · Deprecations
  ✅ none surfaced during install

ℹ️  CI: Snyk (security.yml) + SonarQube (sonar.yml) run in CI and are
    authoritative — confirm they are green on the default branch.

VERDICT: ATTENTION — <n> blocking, <n> advisory
NEXT: <exact fix command per blocking finding>
```

Verdict is **GO** only when there are zero blocking findings.

---

## Related Commands

- `/commit` — fast guards run automatically in hooks; recovery docs live there
- `/setup-formatters` — repair the Prettier/ESLint/VS Code formatter chain
- `/upgrade-dependencies` — guided, non-destructive dependency upgrades
- `/security-audit` — application-code security (OWASP, auth, injection)

## References

- Fast hook guards: `.husky/pre-commit`, `.husky/pre-push`
- Dependency rule: `@.claude/CLAUDE.md` Critical Constraints → Dependency versions
- Monorepo deps: `@.claude/standards/monorepo-standards.md#dependency-installation-rules`
