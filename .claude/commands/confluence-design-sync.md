---
description: >
  Composes: mirror read (confluence/_index.json) + codebase grep (apps/api, packages/database,
  packages/validation, infra/). Reconciles a mirrored Confluence design page against the
  PingID/NestJS-Fastify/Prisma/Zod/CDK codebase reality → two-column drift report (doc says /
  code does), cited both sides. READ-ONLY. Offers /confluence enhance to fix the doc — never
  edits code. Thin Phase-5 verb over Phase-1–4 primitives.
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# /confluence design-sync

> **Composes:** `confluence/_index.json` (mirror read) + codebase grep (`apps/api`,
> `packages/database/prisma/schema.prisma`, `packages/validation`, `infra/`).
> **No new remote primitives.** The page is read from the local mirror; the codebase is
> grepped locally. Live `/confluence read` is offered when the page is not yet mirrored.
> **Read-only.** Cites both sides.

## Input

`$ARGUMENTS` — a `pageId` or a Confluence page URL (`…/pages/{id}/…`).

The target must be a **design** or **technical** page (architecture spec, API design,
data-model description, flow diagram). This verb is not useful on meeting-notes or
policy pages — say so and stop if the page title or body does not look like a design doc.

## Pre-flight

1. **Mirror check.** Look up `pageId` in `confluence/_index.json.items`. If found, use the
   mirrored body (`confluence/pages/{SPACE}-{id}.md`).
   If NOT found, say: _"This page is not in the local mirror. Run `/confluence pull <pageId>`
   first, or use `/confluence read <url>` for a live (non-cached) view."_ — then STOP.
2. **Staleness gate.** Read `confluence/_index.json.lastSyncedAt`. If older than 24 h, offer:
   _"Mirror last synced {when}. Drift report may be stale. Sync now?"_
   → **[Sync & answer / Answer from mirror anyway / Cancel]**.

## Algorithm

### Step 1 — Extract claims from the design page

Read the mirrored body (`confluence/pages/{SPACE}-{id}.md`). Extract **claims** — concrete
technical assertions that can be verified against code. Focus on:

| Claim category | What to look for in the doc |
|---|---|
| **Endpoints** | HTTP method + path patterns: `POST /api/v1/…`, `GET /users/:id`, OpenAPI path refs |
| **Auth / security** | "authenticated via PingID", "JWT RS256", "JWKS endpoint", guard names (`@RequirePermissions`) |
| **Data model** | Field names, types, enum values, relationships mentioned in the doc |
| **Validation rules** | Zod schema names, field constraints (min/max, regex, required/optional) |
| **Infrastructure** | CDK stack names, ECS/Fargate service names, environment variable names, secrets paths |
| **Business rules** | Processing flows with specific conditional logic (if X then Y) |

Emit the claims as a structured internal list:
`{ category, claim_text, source_anchor }` where `source_anchor` is the `##` heading the
claim came from.

### Step 2 — Grep codebase for the reality

For each claim category, grep the canonical codebase locations:

| Claim category | Grep targets |
|---|---|
| Endpoints | `apps/api/src/**/*.controller.ts` — `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete` decorators; `packages/api-spec/generated/openapi.json` paths |
| Auth / security | `apps/api/src/**/*.ts` — `@Public()`, `JwtAuthGuard`, `RequirePermissions`, `JwksClient`, `PINGID_` env vars |
| Data model | `packages/database/prisma/schema.prisma` — model field names, types, enums |
| Validation rules | `packages/validation/src/**/*.ts` — Zod schema names and field definitions |
| Infrastructure | `infra/**/*.ts` — CDK construct IDs, ECS service names, `secretsmanager.Secret` IDs, `ssm.StringParameter` names |
| Business rules | `apps/api/src/**/*.service.ts` — method names and conditional branches corresponding to flow logic |

Use `grep -rn` with appropriate patterns. Record each match as:
`{ file_path, line_number, matched_text }`.

### Step 3 — Build the drift report

For each extracted claim, compare it to what was found in the code:

| Status | Condition |
|---|---|
| **Match** | Code confirms the claim exactly or within naming conventions |
| **Partial match** | Code contains a related construct but with a different name, path, or constraint |
| **Missing in code** | The claim was not found anywhere in the searched locations |
| **Missing in doc** | Code has something relevant that the doc does not mention (found via the grep set but not claimed in the doc) |

Emit a **two-column drift report**:

```
## Drift Report — [SPACE-{id}] "{Page title}" vs codebase

| # | Claim category | Doc says | Code does | Status |
|---|---|---|---|---|
| 1 | Endpoint | `POST /api/v1/users` | `POST /api/v1/users` in `users.controller.ts:42` | Match |
| 2 | Auth | "JWT RS256 via PingID JWKS" | `JwksRsaModule` + `PINGID_JWKS_URI` in `auth.module.ts:18` | Match |
| 3 | Data model | `User.temporaryPin` field | Not found in `schema.prisma` | Missing in code |
| 4 | Validation | `CreateUserSchema` min length 8 | min length 6 in `validation/src/user.ts:14` | Partial match |
…
```

Below the table, emit a **Summary**:
- N claims extracted from doc
- N matched, N partial, N missing-in-code, N missing-in-doc
- Overall drift severity: `low` (all match or partial) / `medium` (some missing) / `high` (many missing or contradictions)

### Step 4 — Citations

```
## Sources

Doc:
- [{SPACE}-{id} v{n}] "{Page title}" — confluence mirror (pulled {lastSyncedAt ISO})
  anchor: {list of ## headings where claims were found}

Code:
- {file_path}:{line_number} — {matched_text snippet} (grepped {ISO now})
…
```

**Every code citation includes the file path and line number.** Every doc citation includes
the page version and the section anchor. No claim without a source.

### Step 5 — Offer next action (never auto-apply)

If `Missing in doc` rows exist:
> _Consider `/confluence enhance {pageId}` to propose updates to the design page._
> _The enhancement will go through the Phase-4 gated pipeline (dry-run → approve → push)._

If `Missing in code` rows exist:
> _The doc describes features not yet implemented. No code changes from this verb._
> _Consider opening a JIRA issue via `/jira-create` to track the gap._

**Never edit code from this verb.** The only mutation path for the doc is Phase-4
`/confluence enhance`.

## Guardrails

- **Read-only.** No MCP calls, no file edits, no mirror mutations.
- **Confluence-only mutation path** — `/confluence enhance` (Phase 4) for doc fixes; this
  verb never edits application code (R3).
- **Citation contract** — every drift row cites both the doc source and the code location.
- **Staleness gate applies** (mirror-derived). Live `/confluence read` is offered if the
  page is not in the mirror.
- **Not a compiler** — claim extraction and grep matching are best-effort NLP; flag
  ambiguous matches as `Partial match`, not as `Match`.

## Cross-references

- Router: `.claude/commands/confluence.md`
- Confluence mirror: `confluence/_index.json` + `confluence/pages/{SPACE}-{id}.md`
- Fix doc gaps: `/confluence enhance <pageId>` (Phase 4 write-back engine)
- Track code gaps: `/jira-create` (Phase 4 write-back engine)
- Mermaid rules: `@.claude/standards/mermaid-standards.md` (if a diagram is emitted)
