#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOST_SCRIPT="$ROOT_DIR/dist/native/host/textswift-host.js"
HOST_LAUNCHER="$ROOT_DIR/native/host/textswift-host-launcher.sh"
TEMPLATE_MANIFEST="$ROOT_DIR/native/host/manifest.com.textswift.host.json"
TARGET_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
TARGET_MANIFEST="$TARGET_DIR/com.textswift.host.json"

usage() {
  cat <<USAGE
Usage:
  $(basename "$0") --extension-id <chrome-extension-id>

Notes:
- Run from project root after `npm run build`.
- This script installs only a local development native host manifest.
USAGE
}

EXTENSION_ID=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --extension-id)
      EXTENSION_ID="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$EXTENSION_ID" ]]; then
  echo "--extension-id is required."
  usage
  exit 1
fi

if [[ ! -f "$HOST_SCRIPT" ]]; then
  echo "Host script not found: $HOST_SCRIPT"
  echo "Run: npm run build"
  exit 1
fi

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "node binary not found in PATH."
  echo "Install Node.js and try again."
  exit 1
fi

CODEX_BIN="$(command -v codex || true)"
if [[ -z "$CODEX_BIN" ]]; then
  echo "codex binary not found in PATH."
  echo "Install Codex CLI or ensure PATH includes it, then retry."
  exit 1
fi

if [[ ! -f "$TEMPLATE_MANIFEST" ]]; then
  echo "Template manifest not found: $TEMPLATE_MANIFEST"
  exit 1
fi

mkdir -p "$TARGET_DIR"
chmod +x "$HOST_SCRIPT"

cat > "$HOST_LAUNCHER" <<LAUNCHER
#!/bin/bash
set -euo pipefail
export TEXTSWIFT_CODEX_BIN="$CODEX_BIN"
export PATH="$(dirname "$NODE_BIN"):$(dirname "$CODEX_BIN"):/usr/bin:/bin:/usr/sbin:/sbin"
exec "$NODE_BIN" "$HOST_SCRIPT"
LAUNCHER
chmod +x "$HOST_LAUNCHER"

sed \
  -e "s#__HOST_PATH__#$HOST_LAUNCHER#g" \
  -e "s#__EXTENSION_ID__#$EXTENSION_ID#g" \
  "$TEMPLATE_MANIFEST" > "$TARGET_MANIFEST"

cat <<DONE
Native host installed.
- Manifest: $TARGET_MANIFEST
- Host path: $HOST_LAUNCHER
- Node path: $NODE_BIN
- Codex path: $CODEX_BIN
- Extension id: $EXTENSION_ID

Next:
1) Close and reopen Chrome.
2) In extension popup, set Transport = Native Messaging.
3) Click "Ping host".
DONE
