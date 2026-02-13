#!/usr/bin/env node

import { parseArgs } from "node:util";
import { runSetup } from "./commands/setup.js";
import { runStatus } from "./commands/status.js";
import { runUninstall } from "./commands/uninstall.js";

const HELP = `
TextSwift CLI — Native Messaging Host Setup

Usage:
  textswift                  Show this help
  textswift setup [id]       Register native host (id = Chrome extension ID)
  textswift status           Show installation status
  textswift uninstall        Remove native host manifest

Options:
  --help, -h                 Show this help
  --postinstall              Auto-setup mode (used by npm postinstall)

Examples:
  textswift setup abcdefghijklmnopqrstuvwxyzabcdef
  textswift status
  textswift uninstall
`.trim();

function main(): void {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h", default: false },
      postinstall: { type: "boolean", default: false },
    },
  });

  if (values.help || (positionals.length === 0 && !values.postinstall)) {
    console.log(HELP);
    return;
  }

  if (values.postinstall) {
    runSetup(__dirname, undefined, true);
    return;
  }

  const command = positionals[0] as string | undefined;

  switch (command) {
    case "setup": {
      const extensionId = positionals[1] as string | undefined;
      runSetup(__dirname, extensionId, false);
      break;
    }
    case "status":
      runStatus(__dirname);
      break;
    case "uninstall":
      runUninstall();
      break;
    default:
      console.log(`Unknown command: ${command}`);
      console.log("");
      console.log(HELP);
      process.exitCode = 1;
  }
}

main();
