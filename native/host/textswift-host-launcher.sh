#!/bin/bash
set -euo pipefail
export TEXTSWIFT_CODEX_BIN="/opt/homebrew/bin/codex"
export PATH="/Users/sangyi/.nvm/versions/node/v24.13.0/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
exec "/Users/sangyi/.nvm/versions/node/v24.13.0/bin/node" "/Users/sangyi/workspace/business/textswift/dist/native/host/textswift-host.js"
