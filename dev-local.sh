#!/usr/bin/env bash
# Start API (8080) + Vite storefront (18539) for local development.
# Prerequisites: PostgreSQL running, database created, schema pushed, seed run:
#   export DATABASE_URL=...
#   pnpm --filter @workspace/db run push
#   pnpm --filter @workspace/scripts run seed

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

: "${DATABASE_URL:=postgresql://$(whoami)@localhost:5432/pixelcodes}"
: "${ENCRYPTION_KEY:=pixelcodes-local-dev-encryption-key-2026}"
export DATABASE_URL ENCRYPTION_KEY

API_PORT="${API_PORT:-8080}"
STORE_PORT="${STORE_PORT:-18539}"
BASE_PATH="${BASE_PATH:-/}"

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

wait_for_api() {
  local url="http://127.0.0.1:${API_PORT}/api/healthz"
  local i=0
  local max=120
  echo "Waiting for API at ${url} ..."
  while ! curl -sf "$url" >/dev/null; do
    i=$((i + 1))
    if [[ "$i" -ge "$max" ]]; then
      echo "Timeout: API did not become ready on port ${API_PORT}" >&2
      exit 1
    fi
    sleep 1
  done
  echo "API is up."
}

(
  export PORT="$API_PORT" NODE_ENV=development
  exec pnpm --filter @workspace/api-server run dev
) &
API_PID=$!

wait_for_api

export PORT="$STORE_PORT" BASE_PATH="$BASE_PATH"
exec pnpm --filter @workspace/storefront run dev
