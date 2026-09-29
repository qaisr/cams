---
description: Generate technical documentation — README, architecture overview, setup guides, module docs
agent: build
subtask: false
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: medium
---

# Technical Documentation

## Input

$ARGUMENTS (doc type and scope)
Examples:

- `/docs-technical README for the whole project`
- `/docs-technical setup guide for local development`
- `/docs-technical module doc for apps/api/src/modules/order/order.service.ts`
- `/docs-technical architecture overview`

## Process

### Step 1: Read Context

- Read `@specs/functional-specifications.md`
- Read referenced files if path given
- Read existing README if generating/updating one:

```bash
!`cat README.md 2>/dev/null | head -50 || echo "No README yet"`
```

### Step 2: Generate by Doc Type

#### README.md (project root)

```markdown
# {App Name}

> {One-line description from functional spec}

## Overview
{2-3 paragraphs: what it does, who uses it, key value}

## Architecture
{brief description — link to full architecture doc}
```mermaid
{high-level diagram}
```

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node | 20+ | nvm |
| pnpm | 9+ | npm i -g pnpm |
| Docker | 24+ | Docker Desktop |
| AWS CLI | v2 | AWS docs |
| CDK | v2 | npm i -g aws-cdk |

## Quick Start

```bash
# 1. Clone and set up
git clone {repo-url}
cd {app-name}

# 2. Start local dependencies
docker compose up postgres localstack -d

# 3. Start API
pnpm --filter @repo/api dev

# 4. Start Frontend
pnpm --filter @repo/web dev

# 5. Open browser
open http://localhost:3000
```

## Project Structure

{structure from CLAUDE.md}

## Development

See [Development Guide](.claude/docs/DEVELOPMENT-GUIDE.md)

## Testing

```bash
pnpm --filter @repo/api test     # API tests
pnpm --filter @repo/web test     # Frontend tests
```

## Deployment

See [Deployment Guide](.claude/workflows/deployment.md)

## Contributing

{contribution guidelines}

## Licence

{licence}

```

#### Module/Service Documentation
```typescript
/**
 * {ServiceName} — {one-line description}
 *
 * Responsibilities:
 * - {responsibility 1}
 * - {responsibility 2}
 *
 * Dependencies:
 * - {Dependency1}: {why}
 * - {Dependency2}: {why}
 *
 * @example
 * const result = await service.doThing({ id });
 */

#### Setup Guide

```markdown
# Local Development Setup

## Prerequisites
{list with version requirements}

## First Time Setup
{numbered steps from docker-compose.yml and README}

## Environment Variables
| Variable | Description | Example | Required |
|---|---|---|---|
{from application.yml}

## Common Issues
{from any troubleshooting found in code/comments}
```

#### Architecture Overview

Read `.claude/docs/architecture/` and produce a consolidated document
with all diagrams, component descriptions, and key decisions summary.

### Step 3: Inline Code Documentation

If a specific file is referenced and lacks Javadoc/JSDoc:

**TypeScript — add JSDoc to all public methods**

```typescript
/**
 * {Brief description}.
 *
 * @param {paramName} - {description}
 * @returns {description}
 * @throws {Error} when {condition}
 *
 * @example
 * const result = await doThing({ id: '123' });
 */
```

### Step 4: Save Output

| Doc Type | Save Location |
|---|---|
| README | `README.md` (root) |
| API README | `api/README.md` |
| Frontend README | `frontend/README.md` |
| Setup guide | `docs/local-development.md` |
| Architecture | `.claude/docs/architecture/overview.md` |
| Module docs | Inline in source files |

### Step 5: Verify Links

Check any cross-reference links in the generated doc:

```bash
!`grep -o '\[.*\]([^)]*\.md)' {output_file} | grep -v "^http"`
```

Verify referenced markdown files exist.

## Cross-References

- Diagram standard (binding, for any Mermaid diagram): `@.claude/standards/mermaid-standards.md`
- API docs: `/docs-api`
- Runbook: `/docs-runbook`
- Changelog: `/changelog-update`
- Architecture: `/design-architecture`
