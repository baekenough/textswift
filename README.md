# TextSwift

Instant in-page translation powered by Codex

---

## Features

- **Inline Selection Translation**: Select text on any webpage and translate instantly with a single click
- **Popup Translation Panel**: Standalone translation interface accessible from the Chrome toolbar
- **Multi-Language Support**: Translate between English, Korean, Japanese, Chinese, Spanish, and more
- **Secure Native Messaging**: No API keys embedded in extension; reuses local Codex CLI authentication
- **Model Benchmarking**: Automated performance testing to select the fastest translation model
- **Clean UX**: Non-intrusive interface that appears only when needed

---

## How It Works

```
┌─────────────┐
│   Web Page  │  User selects text
└──────┬──────┘
       │
       v
┌─────────────┐
│  Extension  │  Click TS icon
│  Content    │
│  Script     │
└──────┬──────┘
       │
       v
┌─────────────┐
│ Background  │  Send translation request
│  Service    │
│  Worker     │
└──────┬──────┘
       │
       v
┌─────────────┐
│   Native    │  Execute: codex exec translate
│   Messaging │
│    Host     │
└──────┬──────┘
       │
       v
┌─────────────┐
│   Codex     │  Return translated text
│     CLI     │
└─────────────┘
```

---

## Supported Languages

- English
- Korean
- Japanese
- Chinese
- Spanish

Additional languages planned for future releases.

---

## Installation

### Prerequisites

- Node.js 18+ and npm
- Google Chrome
- Codex CLI installed with an active subscription
- macOS (for native host installation script)

### Build Steps

1. **Clone the repository** (if applicable) and navigate to the project directory.

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Build the extension and native host artifacts**:

   ```bash
   npm run build
   ```

4. **Load unpacked extension in Chrome**:

   - Open `chrome://extensions`
   - Enable **Developer mode** (toggle in top-right corner)
   - Click **Load unpacked**
   - Select the `dist/` folder from the project directory

5. **Install the native messaging host**:

   After loading the extension, copy the extension ID from `chrome://extensions` and run:

   ```bash
   bash scripts/install-native-host.sh --extension-id YOUR_EXTENSION_ID
   ```

   Replace `YOUR_EXTENSION_ID` with the actual extension ID from Chrome.

6. **Restart Chrome** to complete the installation.

---

## Usage

### Inline Translation

1. Navigate to any web page
2. Select the text you want to translate
3. Click the **TS** icon that appears next to your selection
4. View the instant translation in the inline panel
5. Click **Close** to dismiss the panel

The inline icon and panel appear only when text is selected and disappear when the selection is cleared.

### Popup Translation

1. Click the TextSwift extension icon in the Chrome toolbar
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
| `npm run checklist` | Run all quality checks (type + unit + smoke + benchmark) |

### Quality Assurance

Run the full checklist before committing:

```bash
npm run checklist
```

This command executes type checking, unit tests, smoke tests, and benchmark tests to ensure all functionality is working correctly.

---

## Model Strategy

TextSwift uses a primary/fallback model chain for optimal performance and reliability:

- **Primary Model**: `gpt-5.3-codex-low` (faster, cost-effective)
- **Fallback Model**: `gpt-5.1-codex-mini` (reliable backup)

### Benchmarking

To determine the fastest model for your environment:

```bash
bash scripts/benchmark-models.sh
```

The benchmark script reports p50/p95 latency and recommends the optimal model based on your system and network performance.

**Run a quick real benchmark** (1 iteration):

```bash
TEXTSWIFT_BENCHMARK_MODE=codex TEXTSWIFT_BENCHMARK_ITERATIONS=1 bash scripts/benchmark-models.sh
```

**Run a mock benchmark** (for testing without API calls):

```bash
TEXTSWIFT_BENCHMARK_MODE=mock bash scripts/benchmark-models.sh
```

---

## Troubleshooting

### Issue: Icon/panel remains visible before text selection

- **Cause**: Stale content script from a previous build is still mounted on the tab
- **Fix**:
  1. Navigate to `chrome://extensions`
  2. Find TextSwift and click **Reload**
  3. Refresh or reopen the target web page

### Issue: "Cannot read properties of undefined (reading 'sendMessage')"

- **Cause**: Content script running without extension runtime binding (stale or mismatched load)
- **Fix**:
  1. Reload the extension from `chrome://extensions`
  2. Reload the web page

### Issue: Extension context invalidated

- **Cause**: Extension was reloaded while content scripts were still active
- **Fix**:
  1. Close and reopen the affected browser tabs
  2. Alternatively, refresh the tabs after reloading the extension

---

## Security Constraints

- No API keys are embedded or used directly in the extension
- The extension does not parse or access Codex authentication files
- Native host reuses local Codex CLI authentication via `codex exec` command
- All translation requests are processed through the secure native messaging channel

---

## Milestones

- **Milestone 1**: UI-only extension (popup + content widget + state UI) ✓
- **Milestone 2**: Native messaging channel connected ✓
- **Milestone 3**: Real `codex exec` translation path with timeout/error handling and fallback model chain ✓

---

## License

MIT
