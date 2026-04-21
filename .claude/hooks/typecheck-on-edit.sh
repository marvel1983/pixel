#!/usr/bin/env bash
# PostToolUse hook: runs `pnpm run typecheck` after Edit/Write on .ts/.tsx files.
# Runs async (does not block Claude). Exits 2 on errors so asyncRewake wakes
# the model with the error output so it can self-correct.

set -u

file=$(jq -r '.tool_input.file_path // ""' 2>/dev/null)
case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Atomic lock — skip if another typecheck is already running (mkdir is atomic).
lock=/tmp/pxc-typecheck.lock
if ! mkdir "$lock" 2>/dev/null; then
  exit 0
fi
trap 'rmdir "$lock" 2>/dev/null || true' EXIT

cd "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || exit 0

out=$(pnpm run typecheck 2>&1)
code=$?

if [ "$code" -ne 0 ]; then
  echo "typecheck failed (triggered by: $file)"
  echo "---"
  echo "$out" | tail -40
  exit 2
fi
exit 0
