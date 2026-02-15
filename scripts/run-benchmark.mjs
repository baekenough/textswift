import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const hostPath = resolve(root, "dist/native/host/textswift-host.js");

const MODELS = ["gpt-5.1-codex-mini", "gpt-5.3-spark"];
const ITERATIONS = normalizeIterations(process.env.TEXTSWIFT_BENCHMARK_ITERATIONS);
const HOST_MODE = process.env.TEXTSWIFT_BENCHMARK_MODE === "mock" ? "mock" : "codex";

const samples = {
  short: "Kiro improves developer workflow clarity.",
  medium:
    "Kiro helps teams move from idea to production with composable workflows, observable execution, and reliable collaboration. Keep tone natural and concise.",
  long:
    [
      "TextSwift is a browser extension prototype focused on translation UX.",
      "The current milestone validates popup and content widget behavior before real model calls.",
      "Native messaging is introduced to support local Codex-auth reuse without exposing secrets.",
      "Model selection should favor lower tail latency under realistic payloads.",
      "Benchmark scripts must be reproducible and easy to compare between runs."
    ].join("\n\n")
};

const rows = [];

for (const model of MODELS) {
  for (const [size, text] of Object.entries(samples)) {
    for (let i = 0; i < ITERATIONS; i += 1) {
      const request = {
        type: "translate",
        requestId: `${model}-${size}-${i}`,
        text,
        sourceLang: "auto",
        targetLang: "ko",
        model
      };

      const started = Date.now();
      const response = await requestHost(request);
      const endToEnd = Date.now() - started;

      rows.push({
        model,
        size,
        iteration: i + 1,
        ok: response.ok,
        hostLatencyMs: response.latencyMs ?? null,
        roundTripMs: endToEnd,
        errorCode: response.errorCode ?? ""
      });
    }
  }
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

const summary = [];
for (const model of MODELS) {
  const modelRows = rows.filter((r) => r.model === model);
  const latencies = modelRows.filter((r) => r.ok).map((r) => r.roundTripMs);
  const failures = modelRows.filter((r) => !r.ok).length;

  summary.push({
    model,
    runs: modelRows.length,
    failures,
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95)
  });
}

const winner = [...summary]
  .filter((s) => s.failures === 0)
  .sort((a, b) => a.p95Ms - b.p95Ms)[0] ??
  [...summary].sort((a, b) => a.failures - b.failures || a.p95Ms - b.p95Ms)[0];

console.log(`TextSwift benchmark (native/${HOST_MODE})`);
console.table(summary);
console.log(`Recommended fastest model (current benchmark): ${winner.model}`);
console.log(`Iterations per sample: ${ITERATIONS}`);
console.log(
  HOST_MODE === "mock"
    ? "Note: running in mock mode. Set TEXTSWIFT_BENCHMARK_MODE=codex for real latency."
    : "Note: running in real codex mode."
);

async function requestHost(payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [hostPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        TEXTSWIFT_HOST_FORCE_MOCK: HOST_MODE === "mock" ? "1" : "0"
      }
    });

    const requestBuffer = Buffer.from(JSON.stringify(payload), "utf8");
    const header = Buffer.alloc(4);
    header.writeUInt32LE(requestBuffer.length, 0);

    const chunks = [];
    child.stdout.on("data", (chunk) => {
      chunks.push(chunk);
    });

    let stderrBuf = "";
    child.stderr.on("data", (chunk) => {
      stderrBuf += chunk.toString();
    });

    child.on("error", (error) => reject(error));

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`host exited with code ${code}: ${stderrBuf}`));
        return;
      }

      const responseBuf = Buffer.concat(chunks);
      if (responseBuf.length < 4) {
        reject(new Error("invalid native response: missing header"));
        return;
      }

      const len = responseBuf.readUInt32LE(0);
      const body = responseBuf.subarray(4, 4 + len).toString("utf8");
      resolve(JSON.parse(body));
    });

    child.stdin.write(Buffer.concat([header, requestBuffer]));
    child.stdin.end();
  });
}

function normalizeIterations(raw) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 2;
  }
  const safe = Math.floor(parsed);
  if (safe < 1) {
    return 1;
  }
  if (safe > 5) {
    return 5;
  }
  return safe;
}
