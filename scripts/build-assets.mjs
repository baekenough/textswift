import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");

mkdirSync(dist, { recursive: true });

const copyTargets = [
  ["manifest.json", "manifest.json"],
  ["src/popup/popup.html", "src/popup/popup.html"],
  ["src/popup/popup.css", "src/popup/popup.css"],
  ["src/content/content.css", "src/content/content.css"],
  ["native/host/manifest.com.textswift.host.json", "native/host/manifest.com.textswift.host.json"],
  ["scripts/install-native-host.sh", "scripts/install-native-host.sh"],
  ["scripts/benchmark-models.sh", "scripts/benchmark-models.sh"],
  ["scripts/native-host-smoke.mjs", "scripts/native-host-smoke.mjs"],
  ["scripts/playwright-smoke.sh", "scripts/playwright-smoke.sh"],
  ["scripts/playwright-multi-site.sh", "scripts/playwright-multi-site.sh"],
  ["README.md", "README.md"],
  ["icons/icon-16.png", "icons/icon-16.png"],
  ["icons/icon-32.png", "icons/icon-32.png"],
  ["icons/icon-48.png", "icons/icon-48.png"],
  ["icons/icon-128.png", "icons/icon-128.png"]
];

for (const [from, to] of copyTargets) {
  const source = resolve(root, from);
  const target = resolve(dist, to);

  if (!existsSync(source)) {
    continue;
  }

  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}
