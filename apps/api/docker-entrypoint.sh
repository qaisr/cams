#!/bin/sh
set -e

# Compose DATABASE_URL from the parts injected by the task definition:
#   DB_HOST     — RDS Proxy endpoint (env)
#   DB_NAME     — database name (env)
#   DB_USERNAME — from Secrets Manager (ecs.Secret)
#   DB_PASSWORD — from Secrets Manager (ecs.Secret)
# If DATABASE_URL is already set (e.g. local dev), leave it untouched.
if [ -z "${DATABASE_URL:-}" ] && [ -n "${DB_HOST:-}" ]; then
  DB_PORT="${DB_PORT:-5432}"
  export DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require&connection_limit=1"
fi

exec "$@"
