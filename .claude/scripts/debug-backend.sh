#!/bin/bash

# NestJS Backend Debug Script — Comprehensive logging and troubleshooting
# Usage: ./debug-backend.sh [issue-description]

set -e

ISSUE_DESC="${1:-general-debugging}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="logs/debug-${TIMESTAMP}"
mkdir -p "$LOG_DIR"

echo "========================================="
echo "NestJS Backend Debug Script"
echo "========================================="
echo "Issue: $ISSUE_DESC"
echo "Logs will be saved to: $LOG_DIR"
echo ""

# Step 1: Kill any existing server on port 3001
echo "Step 1: Stopping any existing servers on port 3001..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || echo "No existing process on port 3001"
sleep 2
echo "✓ Port 3001 cleared"
echo ""

# Step 2: Check database connectivity and logs
echo "Step 2: Checking database..."
DB_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -1)
if [ -z "$DB_CONTAINER" ]; then
  echo "✗ PostgreSQL container not found!"
  echo "Starting Docker Compose..."
  docker compose up -d postgres
  sleep 5
  DB_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -1)
fi

echo "Database container: $DB_CONTAINER"
docker exec "$DB_CONTAINER" psql -U postgres -d app_local -c "SELECT version();" >"$LOG_DIR/db-version.log" 2>&1 || echo "Could not connect to database"
docker exec "$DB_CONTAINER" psql -U postgres -d app_local -c "\dt" >"$LOG_DIR/db-tables.log" 2>&1
echo "✓ Database logs saved"
echo ""

# Step 3: Enable Prisma query logging via DEBUG env var
echo "Step 3: Prisma query logging will be enabled via DEBUG=prisma:*"
echo "✓ Will be set when starting backend"
echo ""

# Step 4: Start NestJS backend with verbose logging
echo "Step 4: Starting NestJS backend with debug logging..."

# Load base env vars from apps/api/.env if it exists
if [ -f "apps/api/.env" ]; then
  set -o allexport
  source apps/api/.env
  set +o allexport
fi

export NODE_ENV=development
export LOG_LEVEL=debug
export DEBUG=prisma:query,prisma:info,prisma:warn

# Start backend in background with Node inspector
nohup sh -c 'cd apps/api && NODE_OPTIONS="--inspect=0.0.0.0:9229" pnpm dev' \
  >"$LOG_DIR/backend-stdout.log" 2>"$LOG_DIR/backend-stderr.log" &

BACKEND_PID=$!
echo "Backend starting with PID: $BACKEND_PID"
echo "$BACKEND_PID" >"$LOG_DIR/backend.pid"
echo ""

# Step 5: Wait for backend to start
echo "Step 5: Waiting for NestJS to start..."
MAX_WAIT=60
WAIT_COUNT=0
until curl -s http://localhost:3001/health >/dev/null 2>&1 ||
  curl -s http://localhost:3001/api/v1/health >/dev/null 2>&1; do
  if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo "✗ Backend failed to start within ${MAX_WAIT}s"
    echo "Check logs at: $LOG_DIR/backend-stderr.log"
    tail -50 "$LOG_DIR/backend-stderr.log"
    exit 1
  fi
  echo -n "."
  sleep 1
  WAIT_COUNT=$((WAIT_COUNT + 1))
done
echo ""
echo "✓ Backend is ready (took ${WAIT_COUNT}s)"
echo "  Node inspector: ws://localhost:9229 (attach VS Code debugger)"
echo ""

# Step 6: Get auth token (mock login for local dev)
echo "Step 6: Authenticating via mock endpoint..."
LOGIN_RESPONSE=$(curl -s -X POST "http://localhost:3001/api/v1/auth/mock/token" \
  -H 'Content-Type: application/json' \
  -d '{"lanId":"user-admin","groups":["app-admin"]}' 2>/dev/null || echo '{}')
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
echo "$LOGIN_RESPONSE" >"$LOG_DIR/auth-response.json"
if [ -n "$TOKEN" ]; then
  echo "✓ Authentication successful"
  echo "  Token: ${TOKEN:0:30}..."
else
  echo "⚠️  Could not obtain mock token — set TOKEN manually for API tests"
fi
echo ""

# Step 7: Test the failing endpoint with verbose output
echo "Step 7: Testing endpoint..."
ENDPOINT="${DEBUG_ENDPOINT:-/api/v1/health}"
echo "Making request to: GET http://localhost:3001${ENDPOINT}"

curl -v -X GET "http://localhost:3001${ENDPOINT}" \
  -H "Authorization: Bearer ${TOKEN:-test}" \
  -H "Accept: application/json" \
  >"$LOG_DIR/api-response.json" 2>"$LOG_DIR/api-verbose.log"

HTTP_CODE=$(curl -s -o "$LOG_DIR/api-response-code.json" -w "%{http_code}" \
  -X GET "http://localhost:3001${ENDPOINT}" \
  -H "Authorization: Bearer ${TOKEN:-test}")

echo "HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "✓ Endpoint returned $HTTP_CODE"
  head -50 "$LOG_DIR/api-response-code.json"
else
  echo "✗ Endpoint returned $HTTP_CODE"
  cat "$LOG_DIR/api-response-code.json"
fi
echo ""

# Step 8: Capture database logs after the request
echo "Step 8: Capturing database container logs..."
sleep 2
docker logs "$DB_CONTAINER" --tail 100 >"$LOG_DIR/db-container-logs.log" 2>&1
echo "✓ Database logs captured"
echo ""

# Step 9: Capture backend logs after the request
echo "Step 9: Capturing backend logs..."
sleep 1
tail -100 "$LOG_DIR/backend-stdout.log" >"$LOG_DIR/backend-latest-stdout.log"
tail -100 "$LOG_DIR/backend-stderr.log" >"$LOG_DIR/backend-latest-stderr.log"
echo "✓ Backend logs captured"
echo ""

# Step 10: Analysis summary
echo "========================================="
echo "Debug Summary"
echo "========================================="
echo "Issue:       $ISSUE_DESC"
echo "HTTP Status: $HTTP_CODE"
echo "Backend PID: $BACKEND_PID"
echo "Log dir:     $LOG_DIR"
echo ""
echo "Key log files:"
echo "  - $LOG_DIR/backend-stderr.log        (NestJS startup + errors)"
echo "  - $LOG_DIR/backend-stdout.log        (Prisma queries when DEBUG=prisma:*)"
echo "  - $LOG_DIR/api-response.json         (API response body)"
echo "  - $LOG_DIR/api-verbose.log           (Full request/response headers)"
echo "  - $LOG_DIR/db-container-logs.log     (PostgreSQL container logs)"
echo ""

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo "Error Analysis:"
  echo "==============="
  echo ""
  echo "API Error Response:"
  cat "$LOG_DIR/api-response-code.json" 2>/dev/null || echo "(empty)"
  echo ""
  echo "Recent Backend Errors:"
  grep -i "error\|exception\|failed\|WARN\|ERROR" "$LOG_DIR/backend-latest-stderr.log" 2>/dev/null | tail -20 ||
    echo "No obvious errors found in stderr"
  echo ""
  echo "Recent Prisma Queries (DEBUG=prisma:*):"
  grep -i "prisma:query" "$LOG_DIR/backend-latest-stdout.log" 2>/dev/null | tail -10 ||
    echo "No Prisma queries found — set DEBUG=prisma:* to enable"
fi

echo ""
echo "========================================="
echo "Debug session complete"
echo "Backend is still running (PID: $BACKEND_PID)"
echo "VS Code debugger: attach to ws://localhost:9229"
echo "To stop: kill $BACKEND_PID"
echo "========================================="
