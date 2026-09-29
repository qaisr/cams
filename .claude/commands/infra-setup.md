---
description: Check and auto-fix the local development environment for the CANS platform
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---
# /infra-setup — Local Development Environment Check

## Purpose

Run a 12-point local environment check that validates all prerequisites for development, auto-fixes what it can, and reports clear next steps for anything that requires manual intervention. Also verifies the code generation pipeline and alignment with the project's config strategy.

## When to Use

- First time setting up a new development machine
- After pulling from main and encountering unexpected failures
- Before submitting a PR (to verify environment parity)
- When onboarding a new team member

## Process

### Step 1: Run the Setup Script

Execute the infrastructure setup script:

```bash
bash .claude/scripts/infra-setup.sh
```

### Step 2: Interpret the Output

The script produces a structured report for each of the 12 checks:

- `[✅]` — check passed (no action needed)
- `[⚠️ ]` — check failed but was auto-fixed (review the fix message)
- `[❌]` — check failed and requires manual intervention (follow the printed instructions)

### Step 3: Handle Failures

For any `[❌]` check, follow the instructions printed by the script. Common manual steps:

| Failure | Manual Fix |
|---------|-----------|
| Node.js version wrong | `nvm install 20 && nvm use 20` |
| Docker not running | Open Docker Desktop and wait for it to start |
| `.env.local` needs PingID values | Edit `.env.local` — see `docs/getting-started.md#authentication-setup` |

### Step 4: Re-run to Verify

After fixing manual issues, run `/infra-setup` again to confirm all checks pass.

### Step 5: Post-Setup Validation (After All Checks Pass)

Once the 12 checks pass, verify the full development workflow:

```bash
# 1. Regenerate all types (Prisma → Zod → OpenAPI → orval hooks)
pnpm generate

# 2. Verify the full build succeeds
pnpm build

# 3. Run all unit tests to confirm baseline
pnpm test

# 4. Run integration tests (requires Docker to be running)
pnpm test:integration --runInBand

# 5. Verify Storybook builds (optional — only needed for UI work)
pnpm --filter @repo/web storybook --ci
```

### Step 6: Config Alignment Check

Verify that your local environment config is correctly aligned:

1. **`.env.local`** — must contain all keys from `.env.local.example`. Any missing keys will cause runtime failures.
2. **Environment variable precedence** (highest → lowest):
   - `.env.local` (your machine-specific overrides, never committed)
   - `.env` (project defaults, committed)
4. If `docs/CONFIG-ALIGNMENT-GUIDE.md` exists in the project, review it for the unified config strategy and any project-specific env requirements before finalising your setup.

## Script Location

`.claude/scripts/infra-setup.sh`

## Checks Performed

1. Node.js >= 20
2. pnpm installed
3. Dependencies installed (root + workspaces)
4. Husky hooks executable
5. `.env.local` exists (copied from `.env.local.example` if missing)
6. Docker running
7. LocalStack running as `localstack` (auto-starts if Docker is up)
8. PostgreSQL running as `postgres` (auto-starts if Docker is up)
9. Prisma migrations applied
10. API starts successfully on `:3001`
11. `GET /health` returns `{ status: ok }`
12. `POST /login` (mock) returns accessToken

## Container Naming

All containers use explicit `container_name` values so they are identifiable in Docker Desktop and `docker ps`:

| Service    | Container name    | Port |
|------------|-------------------|------|
| PostgreSQL | `postgres`   | 5432 |
| LocalStack | `localstack` | 4566 |

If you see `postgres-1` or other auto-generated names in Docker Desktop, the `container_name` field is missing from `docker/docker-compose.yml`. Run `pnpm infra:down && pnpm infra:up` to recreate containers with the correct names.

## Notes

- The script is idempotent — safe to run multiple times
- It will never overwrite an existing `.env.local`
- The API process started during check 10 is stopped after check 12
- See `docs/getting-started.md` for the full onboarding guide
- For infrastructure CDK review, use `/infra-review`
- CANS platform features reference: `.claude/project-features.md`
