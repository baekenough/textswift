#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/output/playwright"
mkdir -p "$OUTPUT_DIR"

command -v npx >/dev/null 2>&1

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"

if [[ ! -x "$PWCLI" ]]; then
  echo "Playwright wrapper not found: $PWCLI"
  exit 1
fi

"$PWCLI" close-all >/dev/null 2>&1 || true

"$PWCLI" open https://kiro.dev --browser chrome >/dev/null
"$PWCLI" snapshot > "$OUTPUT_DIR/kiro.snapshot.txt"
"$PWCLI" run-code 'async (page) => { await page.waitForLoadState("domcontentloaded"); const title = await page.title(); if (!title.includes("Kiro")) { throw new Error(`Unexpected title: ${title}`); } }' >/dev/null
"$PWCLI" screenshot --full-page --filename "$OUTPUT_DIR/kiro-home.png" >/dev/null

"$PWCLI" goto "file://$ROOT_DIR/dist/src/popup/popup.html" >/dev/null
"$PWCLI" snapshot > "$OUTPUT_DIR/popup.snapshot.before.txt"
"$PWCLI" run-code 'async (page) => {
  await page.fill("#source-text", "TextSwift smoke test input.");
  await page.click("#translate-btn");
  await page.waitForTimeout(100);
  const result = await page.$eval("#result-text", (el) => el.value);
  if (!result || !result.includes("[popup-harness:")) {
    throw new Error(`Unexpected translation output: ${result}`);
  }
  const stateChip = await page.textContent("#state-chip");
  if (!stateChip || !stateChip.includes("Success")) {
    throw new Error(`Unexpected state chip: ${stateChip}`);
  }
}' >/dev/null
"$PWCLI" screenshot --full-page --filename "$OUTPUT_DIR/popup-harness.png" >/dev/null
"$PWCLI" close-all >/dev/null

echo "Playwright smoke passed."
echo "- Artifact: $OUTPUT_DIR/kiro-home.png"
echo "- Artifact: $OUTPUT_DIR/popup-harness.png"
