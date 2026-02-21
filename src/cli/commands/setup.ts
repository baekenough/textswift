import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { detectEnvironment } from "../utils/detect.js";
import { writeNativeHostManifest, writeLauncher, type ManifestOptions } from "../utils/manifest.js";
import { currentPlatform } from "../utils/platform.js";

// Chrome Web Store extension ID (set after publishing)
const WEB_STORE_EXTENSION_ID = "bkgfdbpinhpdcclcmjhfbmccojlapalo";

export function runSetup(cliDir: string, extensionId?: string, isPostinstall = false): void {
  const prefix = isPostinstall ? "[textswift postinstall]" : "[textswift setup]";

  // 1. OS check
  const os = currentPlatform();
  if (os === null) {
    console.log(`${prefix} Currently only macOS is supported.`);
    console.log(`${prefix} Manual setup: see README.md`);
    return;
  }

  // 2. Detect environment
  const env = detectEnvironment(cliDir);

  // 3. codex check
  if (env.codexBin === null) {
    console.log(`${prefix} codex CLI not found.`);
    console.log(`${prefix} Install: npm install -g @anthropic-ai/claude-code`);
    console.log(`${prefix} Or ensure codex is in PATH, /opt/homebrew/bin, or ~/.local/bin`);
    return;
  }

  if (!env.codexLoggedIn) {
    console.log(`${prefix} codex is not logged in.`);
    console.log(`${prefix} Run: codex login`);
  }

  // 4. Host script check
  if (env.hostScriptPath === null) {
    console.log(`${prefix} Host script not found (dist/native/host/textswift-host.js).`);
    console.log(`${prefix} Run: npm run build`);
    return;
  }

  // 5. Determine extension ID
  const resolvedId = extensionId || WEB_STORE_EXTENSION_ID;

  if (!resolvedId) {
    if (isPostinstall) {
      console.log(`${prefix} No extension ID configured yet.`);
      console.log(`${prefix} After loading the extension in Chrome, run:`);
      console.log(`${prefix}   textswift setup <your-extension-id>`);
      if (!env.codexLoggedIn) {
        console.log(`${prefix} Also run: codex login`);
      }
      openChromeExtensions();
      return;
    }
    console.log(`${prefix} Extension ID is required.`);
    console.log(`${prefix} Usage: textswift setup <extension-id>`);
    console.log(`${prefix} Find your ID at chrome://extensions`);
    return;
  }

  // 6. Build launcher path
  const packageRoot = resolve(cliDir, "..", "..");
  const launcherPath = resolve(packageRoot, "native", "host", "textswift-host-launcher.sh");

  const opts: ManifestOptions = {
    nodeBin: env.nodeBin,
    codexBin: env.codexBin,
    hostScriptPath: env.hostScriptPath,
    extensionId: resolvedId,
    launcherPath,
  };

  // 7. Write launcher + manifest
  writeLauncher(opts);
  const manifestPath = writeNativeHostManifest(opts);

  console.log("");
  console.log(`${prefix} Native host registered successfully!`);
  console.log("");
  console.log(`  Manifest:     ${manifestPath}`);
  console.log(`  Launcher:     ${launcherPath}`);
  console.log(`  Node:         ${env.nodeBin}`);
  console.log(`  Codex:        ${env.codexBin}`);
  console.log(`  Extension ID: ${resolvedId}`);
  console.log("");

  if (isPostinstall) {
    openChromeExtensions();
  }

  if (!env.codexLoggedIn) {
    console.log(`${prefix} Next steps:`);
    console.log(`${prefix}   1. codex login`);
    console.log(`${prefix}   2. Restart Chrome`);
  } else {
    console.log(`${prefix} Restart Chrome to activate native messaging.`);
  }
}

function openChromeExtensions(): void {
  try {
    // Use open command with URL argument (safe, no shell expansion)
    execFileSync("open", ["chrome://extensions"], { stdio: "ignore" });
    console.log("[textswift] Opened chrome://extensions");
  } catch {
    console.log("[textswift] Open chrome://extensions to find your extension ID.");
  }
}
