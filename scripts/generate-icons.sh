#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT_DIR/assets/textswift-516.png"
OUT_DIR="$ROOT_DIR/icons"

if [[ ! -f "$SOURCE" ]]; then
  echo "Source icon not found: $SOURCE"
  exit 1
fi

mkdir -p "$OUT_DIR"

for size in 16 32 48 128; do
  sips -z "$size" "$size" "$SOURCE" --out "$OUT_DIR/icon-${size}.png" >/dev/null
  echo "Generated icon-${size}.png"
done

echo "Done. Icons in $OUT_DIR"
