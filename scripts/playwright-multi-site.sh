#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/output/playwright/sites"
mkdir -p "$OUTPUT_DIR"

command -v npx >/dev/null 2>&1

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"

if [[ ! -x "$PWCLI" ]]; then
  echo "Playwright wrapper not found: $PWCLI"
  exit 1
fi

SITES=(
  "https://kiro.dev"
  "https://www.kiro.dev"
  "https://example.com"
  "https://developer.mozilla.org/en-US/"
  "https://news.ycombinator.com/"
  "https://www.reddit.com/r/ClaudeAI/new/"
)

"$PWCLI" close-all >/dev/null 2>&1 || true

first_url="${SITES[0]}"
"$PWCLI" open "$first_url" --browser chrome >/dev/null

for site in "${SITES[@]}"; do
  slug="$(printf '%s' "$site" | sed -E 's#https?://##; s#[^a-zA-Z0-9]+#-#g; s#(^-|-$)##g')"

  "$PWCLI" goto "$site" >/dev/null
  "$PWCLI" run-code 'async (page) => {
    await page.waitForLoadState("domcontentloaded");
    const title = await page.title();
    if (!title || !title.trim()) {
      throw new Error("Empty title");
    }
    const textLen = await page.evaluate(() => document.body?.innerText?.trim().length || 0);
    if (textLen < 20) {
      throw new Error(`Body text too short: ${textLen}`);
    }
  }' >/dev/null

  "$PWCLI" screenshot --full-page --filename "$OUTPUT_DIR/${slug}.png" >/dev/null
  "$PWCLI" snapshot > "$OUTPUT_DIR/${slug}.snapshot.txt"
done

"$PWCLI" close-all >/dev/null

echo "Playwright multi-site verification passed."
echo "- Sites checked: ${#SITES[@]}"
echo "- Artifacts: $OUTPUT_DIR"
