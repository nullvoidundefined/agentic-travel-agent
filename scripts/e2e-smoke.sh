#!/usr/bin/env bash
#
# e2e-smoke.sh
#
# Fast preflight that runs AFTER the server and web-client are
# up but BEFORE the Playwright suite. Catches the kind of
# environment misconfiguration that, when not caught here,
# causes every spec to fail and burns the entire CI run.
#
# Source: ENG-14 (2026-04-06). Run 4 of PR #9 spent 15 minutes
# retrying 35 specs three times each because CORS_ORIGIN
# defaulted to localhost:5173 (Vite) and Next.js was on :3000.
# A 5-second smoke check would have failed in seconds with a
# clear "CORS misconfigured" message instead.
#
# Checks (each must pass):
# 1. Server /health returns 200 with valid JSON
# 2. Server CORS preflight from Origin: localhost:3000 returns 204
#    with the right Access-Control-Allow-Origin header
# 3. Web-client root URL returns 200 (Next.js dev server is up)
#
# Exit non-zero on the first failure with a help message.

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3001}"
WEB_BASE="${WEB_BASE:-http://localhost:3000}"
EXPECTED_ORIGIN="${EXPECTED_ORIGIN:-http://localhost:3000}"

fail() {
  echo ""
  echo "e2e-smoke FAILED: $1"
  echo ""
  echo "  This check runs before Playwright spins up. Catching the"
  echo "  failure here saves the cost of retrying every spec three"
  echo "  times before a full-suite failure."
  echo ""
  exit 1
}

# 1. Server health
HEALTH_STATUS=$(curl -sf -o /tmp/e2e-smoke-health.json -w '%{http_code}' "$API_BASE/health" || true)
if [ "$HEALTH_STATUS" != "200" ]; then
  fail "GET $API_BASE/health returned status $HEALTH_STATUS (expected 200). The server is not running or not bound to $API_BASE."
fi
if ! grep -q '"status"' /tmp/e2e-smoke-health.json 2>/dev/null; then
  fail "GET $API_BASE/health returned 200 but the body has no 'status' field. Body: $(cat /tmp/e2e-smoke-health.json)"
fi

# 2. CORS preflight
CORS_STATUS=$(curl -sf -o /dev/null -w '%{http_code}' \
  -X OPTIONS \
  -H "Origin: $EXPECTED_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, X-Requested-With" \
  "$API_BASE/auth/login" || true)
if [ "$CORS_STATUS" != "204" ]; then
  fail "OPTIONS $API_BASE/auth/login from Origin: $EXPECTED_ORIGIN returned status $CORS_STATUS (expected 204). CORS_ORIGIN is misconfigured (current: ${CORS_ORIGIN:-unset})."
fi

CORS_HEADER=$(curl -sf -D - -o /dev/null \
  -X OPTIONS \
  -H "Origin: $EXPECTED_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, X-Requested-With" \
  "$API_BASE/auth/login" 2>/dev/null | grep -i '^access-control-allow-origin:' || true)
if [ -z "$CORS_HEADER" ]; then
  fail "OPTIONS $API_BASE/auth/login from Origin: $EXPECTED_ORIGIN succeeded but no Access-Control-Allow-Origin header returned. CORS middleware not allowing $EXPECTED_ORIGIN."
fi

# 3. Web-client root
WEB_STATUS=$(curl -sf -o /dev/null -w '%{http_code}' "$WEB_BASE/" || true)
if [ "$WEB_STATUS" != "200" ]; then
  fail "GET $WEB_BASE/ returned status $WEB_STATUS (expected 200). The Next.js dev server is not running or not bound to $WEB_BASE."
fi

echo "e2e-smoke OK: server health, CORS preflight from $EXPECTED_ORIGIN, and Next.js root all green"
exit 0
