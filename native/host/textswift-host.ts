#!/usr/bin/env node

import { spawn } from "node:child_process";
import { appendFile, mkdir, mkdtemp, readFile, rename, rm, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { env, stderr, stdin, stdout } from "node:process";
import {
  buildTranslationPrompt,
  createAppError,
  mapCodexFailure,
  sanitizeTranslation,
  type AppErrorLike,
  type ProcessResult
} from "./host-core.js";

interface NativeRequestBase {
  type?: string;
  requestId?: string;
}

interface TranslateRequest extends NativeRequestBase {
  type: "translate";
  requestId: string;
  text: string;
  sourceLang: string;
  targetLang: string;
  model: string;
}

interface NativeResponse {
  ok: boolean;
  requestId?: string;
  host?: string;
  translatedText?: string;
  model?: string;
  latencyMs?: number;
  errorCode?: string;
  message?: string;
  mode?: "mock" | "codex";
}

interface CodexExecPlan {
  command: string;
  args: string[];
  stdinPrompt: string;
  outputPath: string;
  timeoutMs: number;
  tempDir: string;
}

const HOST_NAME = "com.textswift.host";
const MAX_TEXT_LENGTH = 12000;
const CODEX_TIMEOUT_MS = 45_000;
const LOG_ROTATE_BYTES = 2 * 1024 * 1024;
const HOST_MODE: "mock" | "codex" = env.TEXTSWIFT_HOST_FORCE_MOCK === "1" ? "mock" : "codex";
const CODEX_BIN = env.TEXTSWIFT_CODEX_BIN || "codex";
const CODEX_REASONING_EFFORT = env.TEXTSWIFT_CODEX_REASONING_EFFORT || "low";
const HOST_LOG_PATH = env.TEXTSWIFT_HOST_LOG_PATH || join(homedir(), "Library/Logs/textswift-host.log");

let inputBuffer = Buffer.alloc(0);

stdin.on("data", (chunk: Buffer) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);

  while (inputBuffer.length >= 4) {
    const messageLength = inputBuffer.readUInt32LE(0);
    if (inputBuffer.length < 4 + messageLength) {
      break;
    }

    const body = inputBuffer.subarray(4, 4 + messageLength).toString("utf8");
    inputBuffer = inputBuffer.subarray(4 + messageLength);

    void handleIncoming(body);
  }
});

stdin.on("error", (error) => {
  logStderr(`stdin error: ${error.message}`);
});

function logStderr(message: string): void {
  stderr.write(`[TextSwift Host] ${message}\n`);
}

async function handleIncoming(rawJson: string): Promise<void> {
  let payload: NativeRequestBase;

  try {
    payload = JSON.parse(rawJson) as NativeRequestBase;
  } catch {
    writeMessage({
      ok: false,
      errorCode: "INVALID_JSON",
      message: "Request body is not valid JSON.",
      mode: HOST_MODE
    });
    return;
  }

  if (payload.type === "ping") {
    await logEvent(payload.requestId ?? "ping", "ping", { mode: HOST_MODE });
    writeMessage({
      ok: true,
      host: HOST_NAME,
      mode: HOST_MODE
    });
    return;
  }

  if (payload.type === "translate") {
    const response = await handleTranslate(payload as TranslateRequest);
    writeMessage(response);
    return;
  }

  writeMessage({
    ok: false,
    requestId: payload.requestId,
    errorCode: "UNKNOWN_TYPE",
    message: `Unsupported request type: ${payload.type ?? "undefined"}`,
    mode: HOST_MODE
  });
}

async function handleTranslate(request: TranslateRequest): Promise<NativeResponse> {
  const startedAt = Date.now();

  try {
    validateTranslateRequest(request);

    await logEvent(request.requestId, "translate_start", {
      mode: HOST_MODE,
      model: request.model,
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
      textLength: request.text.length
    });

    const translatedText =
      HOST_MODE === "mock" ? mockTranslate(request) : await runCodexTranslate(request);

    const latencyMs = Date.now() - startedAt;

    await logEvent(request.requestId, "translate_success", {
      mode: HOST_MODE,
      model: request.model,
      latencyMs
    });

    return {
      ok: true,
      requestId: request.requestId,
      translatedText,
      model: request.model,
      latencyMs,
      mode: HOST_MODE
    };
  } catch (error) {
    const appError = isAppError(error)
      ? error
      : createAppError("UNEXPECTED", error instanceof Error ? error.message : "Unexpected host error");

    await logEvent(request.requestId || "unknown", "translate_error", {
      mode: HOST_MODE,
      model: request.model,
      errorCode: appError.errorCode,
      message: appError.message
    });

    return {
      ok: false,
      requestId: request.requestId,
      errorCode: appError.errorCode,
      message: appError.message,
      mode: HOST_MODE
    };
  }
}

function validateTranslateRequest(request: TranslateRequest): void {
  if (!request.requestId) {
    throw createAppError("MISSING_REQUEST_ID", "requestId is required.");
  }

  if (typeof request.text !== "string" || !request.text.trim()) {
    throw createAppError("EMPTY_TEXT", "text is required.");
  }

  if (request.text.length > MAX_TEXT_LENGTH) {
    throw createAppError("PAYLOAD_TOO_LARGE", `text must be <= ${MAX_TEXT_LENGTH} chars.`);
  }

  if (typeof request.targetLang !== "string" || !request.targetLang.trim()) {
    throw createAppError("MISSING_TARGET_LANG", "targetLang is required.");
  }

  if (typeof request.model !== "string" || !request.model.trim()) {
    throw createAppError("MISSING_MODEL", "model is required.");
  }
}

async function runCodexTranslate(request: TranslateRequest): Promise<string> {
  const plan = await buildCodexExecPlan(request);

  try {
    const processResult = await runProcess(plan);

    if (processResult.exitCode !== 0) {
      throw mapCodexFailure(processResult);
    }

    const raw = await readFile(plan.outputPath, "utf8");
    return sanitizeTranslation(raw);
  } finally {
    await rm(plan.tempDir, { recursive: true, force: true }).catch(() => {
      // ignore temp cleanup failures
    });
  }
}

async function buildCodexExecPlan(request: TranslateRequest): Promise<CodexExecPlan> {
  const tempDir = await mkdtemp(join(tmpdir(), "textswift-host-"));
  const outputPath = join(tempDir, "last-message.txt");

  const prompt = buildTranslationPrompt({
    sourceLang: request.sourceLang,
    targetLang: request.targetLang,
    text: request.text
  });

  return {
    command: CODEX_BIN,
    args: [
      "exec",
      "-m",
      request.model,
      "-c",
      `model_reasoning_effort="${CODEX_REASONING_EFFORT}"`,
      "-c",
      'reasoning_summaries="none"',
      "--skip-git-repo-check",
      "--ephemeral",
      "--color",
      "never",
      "--output-last-message",
      outputPath,
      "-"
    ],
    stdinPrompt: prompt,
    outputPath,
    timeoutMs: CODEX_TIMEOUT_MS,
    tempDir
  };
}

function runProcess(plan: CodexExecPlan): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const child = spawn(plan.command, plan.args, {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";
    let timedOut = false;
    let spawnErrorCode: string | undefined;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1200).unref();
    }, plan.timeoutMs);

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdoutBuffer += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderrBuffer += chunk.toString();
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      spawnErrorCode = error.code;
      stderrBuffer += error.message;
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        exitCode: typeof code === "number" ? code : 1,
        stdout: stdoutBuffer,
        stderr: stderrBuffer,
        timedOut,
        spawnErrorCode
      });
    });

    child.stdin.write(plan.stdinPrompt);
    child.stdin.end();
  });
}

function mockTranslate(request: TranslateRequest): string {
  const normalized = request.text.replace(/\s+/g, " ").trim();
  return `[native-mock:${request.model}:${request.sourceLang}->${request.targetLang}] ${normalized}`;
}

function writeMessage(payload: NativeResponse): void {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  stdout.write(Buffer.concat([header, body]));
}

function isAppError(error: unknown): error is AppErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "errorCode" in error &&
    typeof (error as AppErrorLike).errorCode === "string"
  );
}

async function logEvent(requestId: string, event: string, data: Record<string, unknown>): Promise<void> {
  const record = {
    timestamp: new Date().toISOString(),
    requestId,
    event,
    ...data
  };

  try {
    await rotateLogIfNeeded();
    await mkdir(dirname(HOST_LOG_PATH), { recursive: true });
    await appendFile(HOST_LOG_PATH, `${JSON.stringify(record)}\n`, "utf8");
  } catch (error) {
    logStderr(`log write failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function rotateLogIfNeeded(): Promise<void> {
  try {
    const info = await stat(HOST_LOG_PATH);
    if (info.size < LOG_ROTATE_BYTES) {
      return;
    }

    await mkdir(dirname(HOST_LOG_PATH), { recursive: true });
    await rename(HOST_LOG_PATH, `${HOST_LOG_PATH}.1`).catch(() => {
      // ignore rename errors
    });
  } catch {
    // ignore stat/rotate failures
  }
}
