import { existsSync, readFileSync } from "node:fs";
import { detectEnvironment } from "../utils/detect.js";
import { currentPlatform, nativeHostManifestPath } from "../utils/platform.js";

export function runStatus(cliDir: string): void {
  console.log("[textswift status]");
  console.log("");

  // OS
  const os = currentPlatform();
  printCheck("Platform", os === "darwin", os ?? process.platform, os === null ? "only macOS supported" : undefined);

  // Environment
  const env = detectEnvironment(cliDir);

  printCheck("Node.js", true, env.nodeBin);
  printCheck("Codex CLI", env.codexBin !== null, env.codexBin ?? "not found");
  printCheck("Codex login", env.codexLoggedIn, env.codexLoggedIn ? "authenticated" : "not logged in");
  printCheck("Host script", env.hostScriptPath !== null, env.hostScriptPath ?? "not built (run: npm run build)");

  // Native host manifest
  const manifestPath = nativeHostManifestPath();
  const manifestExists = existsSync(manifestPath);
  let manifestInfo = manifestExists ? "installed" : "not installed";

  if (manifestExists) {
    try {
      const content = JSON.parse(readFileSync(manifestPath, "utf8")) as { allowed_origins?: string[] };
      const origins = content.allowed_origins ?? [];
      if (origins.length > 0 && origins[0] !== undefined) {
        const extensionId = origins[0].replace("chrome-extension://", "").replace("/", "");
        manifestInfo += ` (extension: ${extensionId})`;
      }
    } catch {
      manifestInfo += " (unreadable)";
    }
  }

  printCheck("Native manifest", manifestExists, manifestInfo);
  console.log("");
}

function printCheck(label: string, ok: boolean, detail: string, note?: string): void {
  const icon = ok ? "\u2713" : "\u2717";
  const line = `  ${icon} ${label}: ${detail}`;
  console.log(note ? `${line} (${note})` : line);
}
