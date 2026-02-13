#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/output/playwright"
mkdir -p "$OUTPUT_DIR"

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"

if [[ ! -x "$PWCLI" ]]; then
  echo "Playwright wrapper not found: $PWCLI"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required for inline harness smoke test."
  exit 1
fi

PORT="$(python3 - <<'PY'
import socket
s = socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
)"

TMP_DIR="$(mktemp -d)"
TMP_JS="$(mktemp)"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  "$PWCLI" close-all >/dev/null 2>&1 || true
  rm -f "$TMP_JS"
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cat > "$TMP_DIR/index.html" <<'EOF'
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>TextSwift Inline Harness</title>
  </head>
  <body style="font-family: sans-serif; padding: 24px; line-height: 1.6">
    <p id="p1">TextSwift should show an inline icon when this paragraph text is selected by the user.</p>
    <textarea id="ta" style="width: 520px; height: 120px; display: block; margin-top: 20px">
Textarea selection should also trigger the inline icon visibility logic.
    </textarea>
    <script>
      window.chrome = {
        runtime: {
          sendMessage: function (_message, cb) {
            if (typeof cb === "function") {
              cb({
                ok: true,
                translatedText: "ok",
                model: "gpt-5.3-codex-low",
                latencyMs: 1,
                transport: "mock"
              });
            }
          },
          lastError: null
        }
      };
    </script>
    <script src="/dist/src/common/message-types.js"></script>
    <script src="/dist/src/content/content.js"></script>
  </body>
</html>
EOF

ln -s "$ROOT_DIR/dist" "$TMP_DIR/dist"

cat > "$TMP_JS" <<'EOF'
async (page) => {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(200);

  const initialVisibility = await page.evaluate(() => {
    const shell = document.querySelector(".textswift-inline-shell");
    const panel = document.querySelector(".textswift-inline-panel");
    const dock = document.querySelector(".textswift-dock");
    return {
      shellVisible: !!shell && !shell.classList.contains("textswift-hidden"),
      panelVisible: !!panel && !panel.classList.contains("textswift-hidden"),
      dockVisible: !!dock && !dock.classList.contains("textswift-hidden")
    };
  });

  if (initialVisibility.shellVisible || initialVisibility.panelVisible || initialVisibility.dockVisible) {
    throw new Error(`Inline UI should be hidden before selection: ${JSON.stringify(initialVisibility)}`);
  }

  await page.evaluate(() => {
    const node = document.getElementById("p1")?.firstChild;
    if (!node) {
      throw new Error("Paragraph text node not found");
    }
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 24);
    const selection = window.getSelection();
    if (!selection) {
      throw new Error("No selection object");
    }
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
  });

  await page.waitForTimeout(220);

  const paragraphResult = await page.evaluate(() => {
    const shell = document.querySelector(".textswift-inline-shell");
    const source = document.querySelector(".textswift-inline-source");
    if (!shell || !source) {
      return { exists: false, hidden: true, source: "" };
    }
    return {
      exists: true,
      hidden: shell.classList.contains("textswift-hidden"),
      source: (source.textContent || "").trim()
    };
  });

  if (!paragraphResult.exists || paragraphResult.hidden) {
    throw new Error(`Paragraph selection failed: ${JSON.stringify(paragraphResult)}`);
  }

  await page.evaluate(() => {
    const trigger = document.querySelector(".textswift-inline-trigger");
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error("Inline trigger not found");
    }
    trigger.click();
  });

  await page.waitForTimeout(180);

  const panelOpenResult = await page.evaluate(() => {
    const panel = document.querySelector(".textswift-inline-panel");
    if (!panel) {
      return { exists: false, hidden: true };
    }
    return {
      exists: true,
      hidden: panel.classList.contains("textswift-hidden")
    };
  });

  if (!panelOpenResult.exists || panelOpenResult.hidden) {
    throw new Error(`Inline panel did not open: ${JSON.stringify(panelOpenResult)}`);
  }

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll(".textswift-inline-actions .textswift-button"));
    const closeButton = buttons.find((button) => (button.textContent || "").trim() === "Close");
    if (!(closeButton instanceof HTMLButtonElement)) {
      throw new Error("Inline close button not found");
    }
    closeButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "mouse" }));
  });

  await page.waitForTimeout(220);

  const closeResult = await page.evaluate(() => {
    const shell = document.querySelector(".textswift-inline-shell");
    const panel = document.querySelector(".textswift-inline-panel");
    return {
      shellHidden: !shell || shell.classList.contains("textswift-hidden"),
      panelHidden: !panel || panel.classList.contains("textswift-hidden")
    };
  });

  if (!closeResult.shellHidden || !closeResult.panelHidden) {
    throw new Error(`Inline close did not hide UI: ${JSON.stringify(closeResult)}`);
  }

  await page.evaluate(() => {
    const textarea = document.getElementById("ta");
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error("Textarea not found");
    }
    textarea.focus();
    textarea.setSelectionRange(0, 22);
    document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));
  });

  await page.waitForTimeout(220);

  const textareaResult = await page.evaluate(() => {
    const shell = document.querySelector(".textswift-inline-shell");
    const source = document.querySelector(".textswift-inline-source");
    if (!shell || !source) {
      return { exists: false, hidden: true, source: "" };
    }
    return {
      exists: true,
      hidden: shell.classList.contains("textswift-hidden"),
      source: (source.textContent || "").trim()
    };
  });

  if (!textareaResult.exists || textareaResult.hidden || !textareaResult.source.includes("Textarea selection")) {
    throw new Error(`Textarea selection failed: ${JSON.stringify(textareaResult)}`);
  }
}
EOF

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$TMP_DIR" >/tmp/textswift-inline-harness.log 2>&1 &
SERVER_PID="$!"
sleep 1

"$PWCLI" close-all >/dev/null 2>&1 || true
"$PWCLI" open "http://127.0.0.1:$PORT/" --browser chrome >/dev/null
"$PWCLI" run-code "$(cat "$TMP_JS")" >/dev/null
"$PWCLI" screenshot --full-page --filename "$OUTPUT_DIR/inline-harness.png" >/dev/null
"$PWCLI" close-all >/dev/null

echo "Playwright inline harness passed."
echo "- Artifact: $OUTPUT_DIR/inline-harness.png"
