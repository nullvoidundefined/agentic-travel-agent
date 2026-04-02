#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PIDS=()

cleanup() {
  echo "Cleaning up..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT

echo "=== Smoke Test: agentic-travel-agent ==="

# Start server
cd "$PROJECT_DIR/server"
PORT=3001 npx tsx src/index.ts &>/dev/null &
PIDS+=($!)

# Start web-client
cd "$PROJECT_DIR/web-client"
npx next dev --port 3000 &>/dev/null &
PIDS+=($!)

echo "Waiting for services to start..."

# Wait for server (port 3001)
for i in $(seq 1 20); do
  if curl -s -o /dev/null http://localhost:3001/health 2>/dev/null; then
    echo "Server ready on port 3001"
    break
  fi
  if [ "$i" -eq 20 ]; then
    echo "FAIL: Server did not start on port 3001 within 20 seconds"
    exit 1
  fi
  sleep 1
done

# Wait for frontend (port 3000)
for i in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:3000 2>/dev/null; then
    echo "Frontend ready on port 3000"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "FAIL: Frontend did not start on port 3000 within 30 seconds"
    exit 1
  fi
  sleep 1
done

# Run health checks (csrf-app = false)
"$SCRIPT_DIR/health-check.sh" http://localhost:3001 http://localhost:3000 false
