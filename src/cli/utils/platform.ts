import { homedir, platform } from "node:os";
import { join } from "node:path";

export type SupportedPlatform = "darwin";

const HOST_NAME = "com.textswift.host";

export function currentPlatform(): SupportedPlatform | null {
  const os = platform();
  if (os === "darwin") {
    return "darwin";
  }
  return null;
}

export function nativeHostManifestDir(): string {
  return join(
    homedir(),
    "Library",
    "Application Support",
    "Google",
    "Chrome",
    "NativeMessagingHosts"
  );
}

export function nativeHostManifestPath(): string {
  return join(nativeHostManifestDir(), `${HOST_NAME}.json`);
}

export function hostName(): string {
  return HOST_NAME;
}
