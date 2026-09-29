# Codebase Report

Generated: 2026-06-01
Scope: Current monorepo implementation snapshot

## Executive Summary

This repository is aligned to a TypeScript-first architecture across frontend and backend:

- Frontend: Next.js App Router in apps/web
- Backend: NestJS in apps/api
- Data: PostgreSQL via Prisma in packages/database
- Validation and contracts: Zod + generated OpenAPI + client hook generation
- Infrastructure: AWS Fargate + internal ALB + CDK v2 patterns

The platform is structured for an OpenAPI/Zod/Prisma single-source-of-truth workflow and monorepo delivery with pnpm workspaces + Turborepo.

## Detected Technology Profile

| Area | Technology |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | Next.js + TypeScript |
| Backend | NestJS + TypeScript |
| ORM / DB Access | Prisma |
| Database | PostgreSQL |
| Validation | Zod |
| API Contract | OpenAPI (generated from Zod pipeline) |
| Client Generation | orval / OpenAPI TS client generation |
| Testing | Jest, Supertest, Playwright, Testcontainers patterns |
| Infrastructure | AWS CDK v2 + Fargate + Internal ALB |
| Security | PingID-based route protection model |
| Quality | ESLint, Prettier, Sonar, Snyk |

## Repository Layout

- apps/api: NestJS API runtime (Fargate service, Fastify adapter)
- apps/web: Next.js application and generated API hooks
- packages/database: Prisma schema, migrations, generated artifacts
- packages/validation: shared Zod schemas and OpenAPI metadata
- packages/api-spec: generated OpenAPI artifacts
- infra: CDK stacks for cloud resources
- .claude: framework commands, standards, workflows, templates, and patterns

## Core Engineering Conventions

- Edit sources, not generated artifacts.
- Treat Prisma schema as the foundational data contract.
- Use Zod-first validation and generate OpenAPI from shared schemas.
- Use generated hooks/clients instead of manually maintained API clients.
- Keep all routes protected by default unless explicitly public.

## Recommended Ongoing Checks

1. Keep generation pipeline deterministic and version-locked.
2. Enforce lint/test/typecheck gates in CI for every package.
3. Review auth/authorization guards whenever new endpoints are added.
4. Validate migration safety before release for every schema change.
5. Keep .claude standards and command examples synchronized with actual paths.
