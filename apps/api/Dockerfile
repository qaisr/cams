# Multi-stage build for the CANS NestJS API (Fargate).
# Build context is the monorepo root (see .dockerignore).

# ---- deps: install the full workspace with dev deps for the build ----
FROM node:20-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages ./packages
RUN pnpm install --frozen-lockfile

# ---- build: generate Prisma client + Zod, then compile the API ----
FROM deps AS build
WORKDIR /repo
COPY . .
# Prisma client + zod-prisma-types generation, then nest build.
RUN pnpm --filter @repo/database generate \
  && pnpm --filter @repo/api build

# ---- runtime: slim image running the long-lived Fastify server ----
FROM node:20-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
ENV NODE_ENV=production
WORKDIR /repo

# Copy the installed workspace (incl. generated Prisma client) and build output.
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3001
WORKDIR /repo/apps/api
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/apps/api/src/main"]
