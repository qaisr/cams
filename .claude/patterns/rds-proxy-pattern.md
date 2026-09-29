# RDS Proxy Pattern — Prisma + Fargate

## Why RDS Proxy with Fargate

A long-lived Fargate service maintains a persistent connection pool to PostgreSQL.
RDS Proxy sits in front of RDS to pool and multiplex those connections, protecting
`max_connections` under autoscale bursts (multiple Fargate tasks, each with a pool).

## Prisma Client Singleton (connection-safe, single pool per process behind RDS Proxy)

```typescript
// packages/database/src/client.ts
import { PrismaClient } from "@prisma/client";

// One PrismaClient instance per process — long-lived Fargate containers
// reuse it across every request without re-connecting on each invocation.
let prisma: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "warn", "error"]
          : ["warn", "error"],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  return prisma;
}

// NestJS provider
export const PrismaService = getPrismaClient();
```

## Connection URL Format (RDS Proxy)

```bash
# Standard Postgres (local / direct RDS)
DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"

# RDS Proxy (Fargate production — DATABASE_URL composed by docker-entrypoint.sh
# from Secrets Manager creds + proxy host at container startup)
DATABASE_URL="postgresql://user:pass@my-proxy.proxy-xxx.ap-southeast-2.rds.amazonaws.com:5432/mydb?sslmode=require"

# Key parameter for Fargate:
# sslmode=require — required for RDS Proxy IAM auth
# No connection_limit=1 needed — Fargate tasks hold a persistent pool; Proxy multiplexes
```

## IAM Auth for RDS Proxy (production)

```typescript
// src/config/database.ts — generate IAM token at service startup
import { Signer } from "@aws-sdk/rds-signer";

export async function getDatabaseUrl(): Promise<string> {
  if (process.env.USE_IAM_AUTH !== "true") {
    return process.env.DATABASE_URL!;
  }

  const signer = new Signer({
    region: process.env.AWS_REGION!,
    hostname: process.env.DB_PROXY_HOST!,
    port: 5432,
    username: process.env.DB_USERNAME!,
  });

  const token = await signer.getAuthToken();
  return (
    `postgresql://${process.env.DB_USERNAME}:${encodeURIComponent(token)}` +
    `@${process.env.DB_PROXY_HOST}:5432/${process.env.DB_NAME}` +
    `?sslmode=require`
  );
}
```

## Prisma Migrations in CI (not in the running service)

```bash
# Run via separate CI job or CodeBuild step — NEVER inside the Fargate service handler
npx prisma migrate deploy

# The running Fargate service only reads/writes — never runs migrations
```

## Fargate Service Startup

The NestJS Fastify app starts via `apps/api/src/main.ts`. The `DATABASE_URL`
is assembled at container startup by `apps/api/docker-entrypoint.sh` from
Secrets Manager credentials and the RDS Proxy host — the running service never
rebuilds the connection string per request.

## Local Dev (Direct Postgres)

```bash
# docker-compose.yml provides local Postgres — no proxy needed
DATABASE_URL="postgresql://myapp:myapp@localhost:5432/myapp"
USE_IAM_AUTH=false
```

## Cross-References

- Database standards: `@.claude/standards/database-standards.md`
- Local modes: `@.claude/workflows/local-runtime-modes.md`

## Token Optimization

**Load when** configuring RDS Proxy for Fargate connection pooling. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
