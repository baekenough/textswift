import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const CODEX_SEARCH_PATHS = [
  "/opt/homebrew/bin/codex",
  `${process.env.HOME}/.local/bin/codex`,
];

export interface Environment {
  nodeBin: string;
  codexBin: string | null;
  codexLoggedIn: boolean;
  hostScriptPath: string | null;
}

export function detectEnvironment(cliDir: string): Environment {
  const nodeBin = process.execPath;
  const codexBin = findCodex();
  const codexLoggedIn = codexBin !== null ? checkCodexLogin(codexBin) : false;

  // cliDir = dist/cli → package root = cliDir/../..
  const packageRoot = resolve(cliDir, "..", "..");
  const hostScript = resolve(packageRoot, "dist", "native", "host", "textswift-host.js");
  const hostScriptPath = existsSync(hostScript) ? hostScript : null;

  return { nodeBin, codexBin, codexLoggedIn, hostScriptPath };
}

function findCodex(): string | null {
  // Try PATH first
  try {
    const result = execFileSync("which", ["codex"], {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    if (result && existsSync(result)) {
      return result;
    }
  } catch {
    // not in PATH
  }

  // Try known locations
  for (const p of CODEX_SEARCH_PATHS) {
    if (existsSync(p)) {
      return p;
    }
  }

  return null;
}

function checkCodexLogin(codexBin: string): boolean {
  try {
    execFileSync(codexBin, ["whoami"], {
      encoding: "utf8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}
