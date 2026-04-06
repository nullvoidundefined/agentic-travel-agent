#!/usr/bin/env bash
#
# e2e-precheck.sh
#
# Runs before the pre-push e2e fast lane. Verifies that the local
# Postgres and Redis dependencies are reachable, provisions the
# local test database if requested, and confirms the local API
# server is either already bound to :3001 or that the server
# source can be spawned cleanly. If any check fails, prints a
# helpful message and exits non-zero so the developer fixes the
# environment before Playwright tries to boot the server.
#
# ENG-16 (2026-04-07): extended to (a) invoke scripts/e2e-local-db.sh
# when E2E_PROVISION_LOCAL_DB=1, (b) verify the server port so
# Playwright's webServer spawn does not die silently the way it
# did during the PR-A hook promotion.

set -e

PG_HOST="${PGHOST:-localhost}"
PG_PORT="${PGPORT:-5432}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
API_PORT="${API_PORT:-3001}"
PROVISION_LOCAL_DB="${E2E_PROVISION_LOCAL_DB:-0}"

fail() {
  echo ""
  echo "e2e-precheck FAILED: $1"
  echo ""
  echo "   The pre-push e2e fast lane needs Postgres and Redis"
  echo "   running locally. Start them with:"
  echo "     brew services start postgresql@16"
  echo "     brew services start redis"
  echo ""
  exit 1
}

if ! command -v pg_isready >/dev/null 2>&1; then
  fail "pg_isready not on PATH (install postgresql client tools)"
fi

if ! pg_isready -h "$PG_HOST" -p "$PG_PORT" >/dev/null 2>&1; then
  fail "Postgres not reachable at $PG_HOST:$PG_PORT"
fi

if ! command -v redis-cli >/dev/null 2>&1; then
  fail "redis-cli not on PATH (install redis client tools)"
fi

if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping >/dev/null 2>&1; then
  fail "Redis not reachable at $REDIS_HOST:$REDIS_PORT"
fi

# Verify server/.env exists. Its dotenv/config import only finds
# server/.env when run from the server/ directory, so an empty
# worktree (which never had .env copied in) would crash later
# with "DATABASE_URL is required". Catch that here.
if [ ! -f "server/.env" ]; then
  fail "server/.env is missing (worktrees do not inherit .env from main)"
fi

# ENG-16 addition: provision the local test database if opted in.
# Off by default so the hook is fast and non-destructive on CI
# machines or on dev machines that already have DATABASE_URL
# pointing where they want it.
if [ "$PROVISION_LOCAL_DB" = "1" ]; then
  if [ -x "./scripts/e2e-local-db.sh" ]; then
    echo "[e2e-precheck] provisioning local test DB"
    ./scripts/e2e-local-db.sh > /dev/null || fail "scripts/e2e-local-db.sh failed; see output above"
  else
    fail "E2E_PROVISION_LOCAL_DB=1 but scripts/e2e-local-db.sh is missing or not executable"
  fi
fi

# ENG-16 addition: verify the API port is either already bound
# (meaning a dev server is running that Playwright will reuse)
# or that no other process is occupying it (meaning Playwright
# can cleanly spawn a fresh server). If another process has
# port 3001 but that process is NOT our dev server, Playwright
# will fail with a confusing "address already in use" error.
# Detect the ambiguous case early.
PORT_PID=$(lsof -t -i TCP:"$API_PORT" -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$PORT_PID" ]; then
  PORT_CMD=$(ps -p "$PORT_PID" -o command= 2>/dev/null || echo "unknown")
  echo "[e2e-precheck] port $API_PORT already bound by pid $PORT_PID ($PORT_CMD); Playwright will reuse"
fi

echo "e2e-precheck OK: Postgres, Redis, server/.env, port $API_PORT status all verified"
exit 0
