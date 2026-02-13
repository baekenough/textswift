import { removeNativeHostManifest } from "../utils/manifest.js";
import { nativeHostManifestPath } from "../utils/platform.js";

export function runUninstall(): void {
  const path = nativeHostManifestPath();
  const removed = removeNativeHostManifest();

  if (removed) {
    console.log("[textswift uninstall] Native host manifest removed.");
    console.log(`  Removed: ${path}`);
    console.log("");
    console.log("  Restart Chrome to complete removal.");
  } else {
    console.log("[textswift uninstall] No native host manifest found.");
    console.log(`  Expected: ${path}`);
  }
}
