# TextSwift - Handoff Document

Last updated: 2026-02-13
Workspace: /Users/sangyi/workspace/business/textswift

## 1) Current State

- Project directory exists and is empty.
- No extension files have been created yet.
- Prior attempt to scaffold files in another sandboxed session failed due write permission limits.
- This handoff is the source of truth for the next session.

## 2) Product Goal

Build a Chrome extension named **TextSwift** that translates text on `https://kiro.dev/*`.

Phase strategy:
- Phase A: UI-only prototype (no model call), to validate UX and interaction patterns.
- Phase B: Connect model-backed translation with local Codex-auth execution path.
- Phase C: harden reliability, performance, and packaging.

## 3) User Constraints and Decisions

- Brand decision accepted: **TextSwift**.
- Target site for initial UX: `kiro.dev`.
- Spark is not available for general use in this project right now.
- For testing, use either:
  - `gpt-5.3-spark`
  - `gpt-5.1-codex-mini`
- Priority is speed. Use whichever is faster in real measurements.

## 4) Recommended Architecture (Practical + Secure)

Do **not** parse or read `~/.codex/auth.json` from the extension.

Use this architecture:
1. Chrome extension (MV3)
- Content script: selection detection + in-page translation overlay.
- Popup page: manual text translation panel.
- Background service worker: messaging hub, state, and request queueing.

2. Native messaging host (local helper)
- Receives translate requests from extension.
- Executes local `codex exec` so existing local Codex login is reused.
- Returns translated text to extension.

3. Translation backend behavior
- First run benchmark: compare `gpt-5.3-spark` vs `gpt-5.1-codex-mini` on same short/medium/long text.
- Persist fastest model choice in local extension storage.
- Provide a fallback model if primary fails.

## 5) Scope for MVP

In-scope:
- Select text on kiro.dev and translate with one click.
- Popup mode for manual paste/translate.
- Language direction control (auto->ko, ko->en, etc.).
- Copy translated output.
- Basic loading/error states.

Out-of-scope (for MVP):
- Full-page live replacement translation.
- Offline translation.
- Multi-provider routing.
- Cross-browser support.

## 6) UX Spec (MVP)

### A. Content Script Widget

- Floating action button at lower-right.
- Click opens panel with:
  - Selected text preview.
  - Target language selector.
  - `Translate` button.
  - Output box.
  - `Copy` button.
- If no selection, disable Translate and show hint text.

### B. Popup UI

- Source textarea.
- From/To language selectors + swap button.
- Translate button.
- Result panel with copy action.
- Visual style tuned to kiro.dev mood (dark + vivid accent).

### C. States

- Idle
- Loading
- Success
- Error (with retry)

## 7) Technical Spec

## 7.1 Extension File Layout

```text
/Users/sangyi/workspace/business/textswift/
  manifest.json
  src/
    background/
      service-worker.js
    content/
      content.js
      content.css
    popup/
      popup.html
      popup.css
      popup.js
    common/
      message-types.js
      storage.js
      i18n.js
  native/
    host/
      textswift-host.js
      manifest.com.textswift.host.json
  scripts/
    install-native-host.sh
    benchmark-models.sh
  README.md
  HANDOFF.md
```

## 7.2 MV3 permissions

- `activeTab`
- `storage`
- host permissions:
  - `https://kiro.dev/*`
  - `https://www.kiro.dev/*`

## 7.3 Message Contract (extension <-> native host)

Request:
```json
{
  "type": "translate",
  "requestId": "uuid",
  "text": "...",
  "sourceLang": "auto",
  "targetLang": "ko",
  "model": "gpt-5.1-codex-mini"
}
```

Success response:
```json
{
  "ok": true,
  "requestId": "uuid",
  "translatedText": "...",
  "model": "gpt-5.1-codex-mini",
  "latencyMs": 812
}
```

Error response:
```json
{
  "ok": false,
  "requestId": "uuid",
  "errorCode": "MODEL_TIMEOUT",
  "message": "..."
}
```

## 7.4 Native host behavior

- Validate payload size and required fields.
- Build deterministic translation prompt.
- Execute `codex exec` (non-interactive).
- Parse output safely.
- Return JSON response.

Prompt template (baseline):

```text
You are a professional translator.
Translate the user text from {sourceLang} to {targetLang}.
Keep original meaning and tone.
Do not add explanations.
Output only translated text.
Text:
"""
{input}
"""
```

## 8) Model Selection Strategy (Speed-first)

Do not guess. Measure.

Benchmark plan:
1. Prepare 3 payloads: short (1 sentence), medium (1 paragraph), long (5 paragraphs).
2. Run 5 iterations per model:
   - `gpt-5.3-spark`
   - `gpt-5.1-codex-mini`
3. Record p50 and p95 latency + failure count.
4. Choose model with lower p95 and acceptable quality.
5. Store chosen model in extension storage.

Default if benchmark not run yet:
- Start with `gpt-5.1-codex-mini` as likely lower latency baseline.
- Fallback to `gpt-5.3-spark` on repeated failures.

## 9) Quality and Safety Requirements

- Never expose API keys in extension source.
- Avoid direct token file parsing from extension.
- Validate and sanitize all native host responses.
- Timeout and cancellation support for long calls.
- Debounce repeated translate clicks.
- Rate-limit per-tab requests.

## 10) Error Handling Matrix

- No selection: show inline hint; keep Translate disabled.
- Native host missing: show setup instructions.
- Codex auth missing/expired: show re-auth instruction.
- Model timeout: auto-retry once, then show retry CTA.
- Non-JSON response: treat as parse error and log safely.

## 11) Logging and Debug Plan

- Extension: console logs gated by `DEBUG=true`.
- Native host: append structured logs to local file (rotation optional).
- Include requestId in all logs for traceability.

## 12) Milestone Plan

Milestone 1: UI-only prototype (no model)
- Build popup + content widget.
- Mock translate output and state transitions.
- Validate on `kiro.dev` manually.

Milestone 2: Native messaging integration
- Implement host manifest + installer script.
- Wire extension background <-> native host messages.
- Return deterministic mock response through native channel first.

Milestone 3: Real translation path
- Replace mock native response with `codex exec` call.
- Add timeout/retry/fallback model.
- Add model benchmark script and persisted selection.

Milestone 4: hardening and packaging
- Add minimal tests.
- Add setup docs.
- Prepare zip for local distribution.

## 13) Test Checklist

Manual:
- Load unpacked extension succeeds.
- Popup opens and all controls work.
- Content widget appears on kiro.dev only.
- Selected text is captured correctly.
- Loading/error/retry states are visible.
- Copy action works.

Integration:
- Native messaging handshake works.
- Invalid payload returns clean error.
- Timeout handling works.
- Fallback model path works.

Performance:
- Translation request p95 under target threshold.
- UI remains responsive during translation.

## 14) Definition of Done (MVP)

- User can select text on kiro.dev and get translated text within extension UI.
- Local Codex login reuse works via native host.
- Fastest model between tested options is auto-selected and persisted.
- Common failure modes show actionable errors.
- Basic setup instructions are documented and reproducible.

## 15) Next Session Bootstrap Commands

```bash
cd /Users/sangyi/workspace/business/textswift

# 1) Scaffold extension UI first
mkdir -p src/background src/content src/popup src/common native/host scripts

# 2) Build MV3 UI-only baseline
# (manifest + popup + content widget)

# 3) Add background messaging skeleton
# (no model yet)
```

## 16) Next Session Prompt (Copy/Paste)

```text
Continue implementation in /Users/sangyi/workspace/business/textswift based on HANDOFF.md.
Start with Milestone 1 (UI-only MVP for kiro.dev), then Milestone 2 (native messaging skeleton).
Do not connect direct API keys in extension.
Keep architecture compatible with local codex auth reuse via native host.
After coding, run a quick manual verification checklist and summarize results.
```

## 17) Notes for Future Branding Risk Checks

- Chosen name: TextSwift (accepted by project owner).
- If public distribution starts, run formal trademark clearance again for target markets and classes.

