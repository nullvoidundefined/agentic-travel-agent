#!/usr/bin/env bash
#
# e2e-local-db.sh
#
# Provisions a local Postgres test database for the e2e suite
# so the local fast lane does not depend on the prod Neon
# connection string. Idempotent: running it twice is a no-op
# if the database and schema are already present.
#
# Source: ENG-16 (2026-04-07). The first e2e-fast hook
# promotion attempt (PR-A) failed because my dev environment
# used the prod Neon DB, and /auth/register round-trips took
# long enough to blow the helper timeout. PR-F bumped the
# timeout to 30s as a band-aid; this script provisions a
# local test DB so the band-aid is no longer needed.
#
# Creates:
#   - A Postgres database named $E2E_LOCAL_DB_NAME (default:
#     voyager_test) if it does not exist.
#   - Runs node-pg-migrate up against that database.
#
# Env:
#   E2E_LOCAL_DB_NAME  default: voyager_test
#   E2E_LOCAL_DB_USER  default: $USER
#   E2E_LOCAL_DB_HOST  default: localhost
#   E2E_LOCAL_DB_PORT  default: 5432
#
# Outputs:
#   The constructed DATABASE_URL as a shell export statement
#   that callers can `eval` to set the env var:
#     eval "$(./scripts/e2e-local-db.sh)"

set -e

DB_NAME="${E2E_LOCAL_DB_NAME:-voyager_test}"
DB_USER="${E2E_LOCAL_DB_USER:-${USER}}"
DB_HOST="${E2E_LOCAL_DB_HOST:-localhost}"
DB_PORT="${E2E_LOCAL_DB_PORT:-5432}"

DATABASE_URL_LOCAL="postgres://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Log progress to stderr so stdout stays clean for the
# `eval "$(...)"` pattern.
log() {
  echo "[e2e-local-db] $*" >&2
}

# Prerequisites
if ! command -v psql >/dev/null 2>&1; then
  log "psql is not on PATH. Install Postgres client tools."
  exit 1
fi
if ! command -v createdb >/dev/null 2>&1; then
  log "createdb is not on PATH. Install Postgres client tools."
  exit 1
fi

# Create database if missing
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
  log "database $DB_NAME already exists at $DB_HOST:$DB_PORT"
else
  log "creating database $DB_NAME at $DB_HOST:$DB_PORT"
  createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
fi

# Run migrations against it. node-pg-migrate reads DATABASE_URL
# from the environment.
log "running migrations against $DATABASE_URL_LOCAL"
(
  cd "$(dirname "$0")/../server" || exit 1
  DATABASE_URL="$DATABASE_URL_LOCAL" pnpm migrate:up >/dev/null 2>&1 || {
    log "migration failed; aborting"
    exit 1
  }
)

log "ready at $DATABASE_URL_LOCAL"

# Emit the export statement on stdout so callers can eval it
echo "export DATABASE_URL='$DATABASE_URL_LOCAL'"
