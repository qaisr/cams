#!/usr/bin/env bash
# Seeds LocalStack with a Secrets Manager secret for DB credentials.
# Runs automatically when LocalStack is ready.

set -e

echo "⚙️  Seeding LocalStack..."

AWS_CMD="aws --endpoint-url=http://localhost:4566 --region ap-southeast-2"

$AWS_CMD secretsmanager create-secret \
  --name "app-local-db-credentials" \
  --secret-string '{"username":"postgres","password":"postgres","dbname":"app_local","host":"postgres","port":5432}' \
  2>/dev/null ||
  $AWS_CMD secretsmanager put-secret-value \
    --secret-id "app-local-db-credentials" \
    --secret-string '{"username":"postgres","password":"postgres","dbname":"app_local","host":"postgres","port":5432}'

$AWS_CMD events create-event-bus \
  --name "app-local-bus" \
  2>/dev/null || echo "Event bus already exists"

echo "✅ LocalStack seeding complete"
