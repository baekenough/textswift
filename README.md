<div align="center">

<img src="https://raw.githubusercontent.com/baekenough/textswift/main/assets/maki-promition-tile_1400x560.png" alt="TextSwift Banner" width="700">

**Instant in-page translation powered by Codex**

[![npm version](https://img.shields.io/npm/v/@textswift/textswift)](https://www.npmjs.com/package/@textswift/textswift)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Install](#installation) · [Usage](#usage) · [Development](#development) · [Troubleshooting](#troubleshooting)

</div>

---

## Demo

<div align="center">
<img src="https://raw.githubusercontent.com/baekenough/textswift/main/assets/capture_1280x800.png" alt="TextSwift in action" width="720">
<p><em>Select text on any webpage → click the icon → instant translation</em></p>
</div>

---

## Features

| Feature | Description |
|---------|-------------|
| **Inline Translation** | Select text on any webpage and translate instantly with a single click |
| **Popup Panel** | Standalone translation interface from the Chrome toolbar |
| **Multi-Language** | English, Korean, Japanese, Chinese, Spanish, and more |
| **Secure** | No API keys in extension; reuses local Codex CLI authentication |
| **Font Controls** | Adjust translation font size (A+ / A-) for readability |
| **Model Benchmarking** | Automated performance testing to select the fastest model |

---

## How It Works

```
Web Page  →  Content Script  →  Background Worker  →  Native Host  →  Codex CLI
 (select)     (click icon)      (send request)       (codex exec)    (translate)
```

The extension uses Chrome's [Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) to securely communicate with the locally installed Codex CLI. No API keys are stored or transmitted by the extension.

---

## Supported Languages

🇺🇸 English · 🇰🇷 Korean · 🇯🇵 Japanese · 🇨🇳 Chinese · 🇪🇸 Spanish

> Additional languages planned for future releases.

---

## Installation

### Quick Setup

```bash
npm install -g @textswift/textswift
```

This automatically:
1. Detects your Codex CLI installation
2. Registers the Native Messaging Host
3. Opens `chrome://extensions` for extension setup

If Codex is not logged in, run:

```bash
codex login
```

### Chrome Extension

**From Chrome Web Store** (recommended):
> [TextSwift Beta](https://chromewebstore.google.com/detail/textswift-beta/bkgfdbpinhpdcclcmjhfbmccojlapalo)

**Unpacked (development)**:
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `dist/` folder
4. Copy the extension ID, then run:

```bash
textswift setup YOUR_EXTENSION_ID
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `textswift setup [id]` | Register native host (id = Chrome extension ID) |
| `textswift status` | Show installation status |
| `textswift uninstall` | Remove native host manifest |

### Prerequisites

- Node.js 18+ and npm
- Google Chrome
- [Codex CLI](https://github.com/openai/codex) installed and logged in
- macOS (Windows/Linux support planned)

---

## Usage

### Inline Translation

1. Select text on any webpage
2. Click the **TextSwift icon** that appears next to your selection
3. View the instant translation in the inline panel
4. Adjust font size with **A+** / **A-** buttons
5. Click **Close** to dismiss

> The icon stays visible during translation — click it again to reopen the panel.

### Popup Translation

1. Click the TextSwift icon in the Chrome toolbar
2. Paste or type text into the input field
3. Select source and target languages
4. Click **Translate**
5. Copy the result or retry with different settings

---

## Development

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build extension and native host artifacts |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test:unit` | Run unit tests |
| `npm run smoke:native` | Test native messaging with real Codex CLI |
| `npm run smoke:native:mock` | Test native messaging with mock responses |
| `npm run smoke:playwright` | Run Playwright end-to-end tests |
| `npm run smoke:inline` | Validate inline selection icon flow |
| `npm run smoke:sites` | Verify extension on multiple real websites |
| `npm run checklist` | Run all quality checks |

### Quality Assurance

```bash
npm run checklist
```

Runs type checking, unit tests, smoke tests, and benchmarks before committing.

---

## Model Strategy

TextSwift uses a primary/fallback model chain:

| Role | Model | Trait |
|------|-------|-------|
| Primary | `gpt-5.3-spark` | Faster, cost-effective |
| Fallback | `gpt-5.1-codex-mini` | Reliable backup |

### Benchmarking

```bash
# Full benchmark
bash scripts/benchmark-models.sh

# Quick (1 iteration)
TEXTSWIFT_BENCHMARK_MODE=codex TEXTSWIFT_BENCHMARK_ITERATIONS=1 bash scripts/benchmark-models.sh

# Mock (no API calls)
TEXTSWIFT_BENCHMARK_MODE=mock bash scripts/benchmark-models.sh
```

---

## Troubleshooting

<details>
<summary><strong>Icon/panel remains visible before text selection</strong></summary>

Stale content script from a previous build. Reload the extension from `chrome://extensions`, then refresh the page.
</details>

<details>
<summary><strong>"Cannot read properties of undefined (reading 'sendMessage')"</strong></summary>

Content script running without extension runtime binding. Reload both the extension and the web page.
</details>

<details>
<summary><strong>Extension context invalidated</strong></summary>

Extension was reloaded while content scripts were active. Close and reopen the affected tabs.
</details>

---

## Security

- No API keys embedded in the extension
- No access to Codex authentication files
- Native host reuses local Codex CLI auth via `codex exec`
- All requests go through Chrome's secure native messaging channel

---

## Milestones

- [x] UI-only extension (popup + content widget + state UI)
- [x] Native messaging channel connected
- [x] Real `codex exec` translation with timeout/error handling and fallback model chain
- [x] Chrome Web Store publishing
- [ ] Windows / Linux support

---

## License

MIT
