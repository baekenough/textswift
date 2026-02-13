import { chmodSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { hostName, nativeHostManifestDir, nativeHostManifestPath } from "./platform.js";

export interface ManifestOptions {
  nodeBin: string;
  codexBin: string;
  hostScriptPath: string;
  extensionId: string;
  launcherPath: string;
}

export function writeLauncher(opts: ManifestOptions): void {
  const content = [
    "#!/bin/bash",
    "set -euo pipefail",
    `export TEXTSWIFT_CODEX_BIN="${opts.codexBin}"`,
    `export PATH="${dirname(opts.nodeBin)}:${dirname(opts.codexBin)}:/usr/bin:/bin:/usr/sbin:/sbin"`,
    `exec "${opts.nodeBin}" "${opts.hostScriptPath}"`,
    "",
  ].join("\n");

  mkdirSync(dirname(opts.launcherPath), { recursive: true });
  writeFileSync(opts.launcherPath, content, "utf8");
  chmodSync(opts.launcherPath, 0o755);
}

export function writeNativeHostManifest(opts: ManifestOptions): string {
  const manifest = {
    name: hostName(),
    description: "TextSwift Native Messaging Host",
    path: opts.launcherPath,
    type: "stdio",
    allowed_origins: [`chrome-extension://${opts.extensionId}/`],
  };

  const targetDir = nativeHostManifestDir();
  const targetPath = nativeHostManifestPath();

  mkdirSync(targetDir, { recursive: true });
  writeFileSync(targetPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  return targetPath;
}

export function removeNativeHostManifest(): boolean {
  const targetPath = nativeHostManifestPath();
  try {
    unlinkSync(targetPath);
    return true;
  } catch {
    return false;
  }
}
