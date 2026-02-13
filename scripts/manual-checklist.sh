#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT_DIR"

echo "[1/10] npm install"
npm install >/dev/null

echo "[2/10] typecheck"
npm run typecheck >/dev/null

echo "[3/10] unit tests"
npm run test:unit >/dev/null

echo "[4/10] build"
npm run build >/dev/null

echo "[5/10] native host smoke (mock)"
npm run smoke:native:mock >/dev/null

echo "[6/10] playwright smoke"
npm run smoke:playwright >/dev/null

echo "[7/10] inline icon harness smoke"
npm run smoke:inline >/dev/null

echo "[8/10] multi-site playwright smoke"
npm run smoke:sites >/dev/null

echo "[9/10] native host smoke (codex)"
npm run smoke:native >/dev/null

echo "[10/10] benchmark (short, codex)"
TEXTSWIFT_BENCHMARK_MODE=codex TEXTSWIFT_BENCHMARK_ITERATIONS=1 bash scripts/benchmark-models.sh >/dev/null

echo ""
echo "Automated checks passed. Manual UI checks to run in Chrome:"
echo "- Load unpacked extension from $ROOT_DIR/dist"
echo "- On any http/https page, verify no floating TS button before text selection"
echo "- Select page text and confirm inline TextSwift icon appears near selection"
echo "- Select text inside an input/textarea and confirm inline icon still appears"
echo "- Select text -> Translate -> states: Loading/Success/Error"
echo "- Popup translate + copy + retry"
echo "- Native translation succeeds on popup (no developer controls shown)"
