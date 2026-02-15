# TextSwift Status (2026-02-13)

Workspace: `/Users/sangyi/workspace/business/textswift`

## Scope

- Extension target scope is all standard web pages:
  - `http://*/*`
  - `https://*/*`
- Native host path is enabled and reuses local Codex auth (`codex exec`).
- No API key is embedded in extension code.
- Extension does not parse `auth.json`.

## Model policy

- Primary: `gpt-5.3-spark`
- Fallback: `gpt-5.1-codex-mini`
- Benchmark script persists preferred model based on measured latency.

## Current UX behavior

Content inline UX:

- Inline icon is selection-driven.
- Icon and panel are hidden by default before any selection.
- After selection, inline icon appears near selected range.
- Clicking inline `TS` opens panel and starts translation immediately.
- `Close` hides inline panel/icon for current selection.
- Clearing selection hides inline panel/icon immediately.

Popup UX:

- Popup translate flow remains available from extension action button.
- Copy/retry/language selectors are maintained.

Status text UX:

- Success messages are user-oriented.
- Internal transport/model/latency diagnostics are not shown in normal success text.

## Validation snapshot

Latest executed checks in this workspace:

- `npm run typecheck`
- `npm run build`
- `npm run smoke:inline`
- `npm run smoke:playwright`
- `npm run smoke:sites`
- `bash scripts/manual-checklist.sh`

All passed during this session.

## Known operational note

When behavior seems inconsistent after updates (old icon/panel behavior, stale errors), it is usually stale content scripts in existing tabs.

Required refresh sequence:

1. Open `chrome://extensions`
2. Click **Reload** for TextSwift
3. Refresh or reopen target tabs
