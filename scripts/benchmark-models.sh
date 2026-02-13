#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -f "$ROOT_DIR/dist/native/host/textswift-host.js" ]]; then
  echo "Build output missing. Running build first..."
  (cd "$ROOT_DIR" && npm run build >/dev/null)
fi

node "$ROOT_DIR/scripts/run-benchmark.mjs"
