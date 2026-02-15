import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const hostPath = resolve(root, "dist/native/host/textswift-host.js");
const mode = process.argv.includes("--mock") ? "mock" : "codex";

const pingResponse = await requestHost({
  type: "ping",
  requestId: `ping-${Date.now()}`
});

if (!pingResponse.ok) {
  throw new Error(`Ping failed: ${JSON.stringify(pingResponse)}`);
}

const translateResponse = await requestHost({
  type: "translate",
  requestId: `translate-${Date.now()}`,
  text: "Kiro helps teams ship reliable software quickly.",
  sourceLang: "auto",
  targetLang: "ko",
  model: "gpt-5.3-spark"
});

if (!translateResponse.ok || typeof translateResponse.translatedText !== "string" || !translateResponse.translatedText.trim()) {
  throw new Error(`Translate failed: ${JSON.stringify(translateResponse)}`);
}

const invalidResponse = await requestHost({
  type: "translate",
  requestId: `invalid-${Date.now()}`,
  text: "",
  sourceLang: "auto",
  targetLang: "ko",
  model: "gpt-5.3-spark"
});

if (invalidResponse.ok !== false || invalidResponse.errorCode !== "EMPTY_TEXT") {
  throw new Error(`Invalid payload handling failed: ${JSON.stringify(invalidResponse)}`);
}

console.log(`Native host smoke passed (mode=${mode}).`);
console.log(`- ping host: ${pingResponse.host || "unknown"}`);
console.log(`- translate latencyMs: ${translateResponse.latencyMs}`);
console.log(`- translate model: ${translateResponse.model}`);

async function requestHost(payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [hostPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        TEXTSWIFT_HOST_FORCE_MOCK: mode === "mock" ? "1" : "0"
      }
    });

    const requestBuffer = Buffer.from(JSON.stringify(payload), "utf8");
    const header = Buffer.alloc(4);
    header.writeUInt32LE(requestBuffer.length, 0);

    const chunks = [];
    let stderrBuf = "";

    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => {
      stderrBuf += chunk.toString();
    });

    child.on("error", (error) => reject(error));

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`host exited with code ${code}: ${stderrBuf}`));
        return;
      }

      try {
        const responseBuf = Buffer.concat(chunks);
        if (responseBuf.length < 4) {
          throw new Error("invalid native response: missing header");
        }

        const len = responseBuf.readUInt32LE(0);
        const body = responseBuf.subarray(4, 4 + len).toString("utf8");
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    child.stdin.write(Buffer.concat([header, requestBuffer]));
    child.stdin.end();
  });
}
