/**
 * Shared core logic for the native host.
 * This file stays pure so it can be unit-tested without spawning child processes.
 */

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  spawnErrorCode?: string;
}

export interface AppErrorLike extends Error {
  errorCode: string;
}

export interface TranslationPromptInput {
  sourceLang: string;
  targetLang: string;
  text: string;
}

export function createAppError(errorCode: string, message: string): AppErrorLike {
  const err = new Error(message) as AppErrorLike;
  err.errorCode = errorCode;
  return err;
}

/**
 * Builds a deterministic translator prompt used by `codex exec`.
 */
export function buildTranslationPrompt(input: TranslationPromptInput): string {
  const sourceGuide =
    input.sourceLang === "auto"
      ? "Detect the source language automatically."
      : `Source language is ${input.sourceLang}.`;

  return [
    "You are a professional translator.",
    sourceGuide,
    `Translate the user text into ${input.targetLang}.`,
    "Keep meaning and tone.",
    "Do not add explanations.",
    "Return only translated text.",
    "Text:",
    "\"\"\"",
    input.text,
    "\"\"\""
  ].join("\n");
}

/**
 * Converts raw Codex output into plain translated text.
 * Handles fenced code blocks and plain quoted strings.
 */
export function sanitizeTranslation(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw createAppError("EMPTY_OUTPUT", "Model returned an empty translation.");
  }

  const fenced = trimmed.match(/^```(?:\w+)?\n([\s\S]*?)\n```$/);
  const unfenced = fenced?.[1]?.trim() || trimmed;

  const unquoted =
    unfenced.length >= 2 &&
    ((unfenced.startsWith("\"") && unfenced.endsWith("\"")) ||
      (unfenced.startsWith("'") && unfenced.endsWith("'")))
      ? unfenced.slice(1, -1).trim()
      : unfenced;

  if (!unquoted) {
    throw createAppError("EMPTY_OUTPUT", "Model returned an empty translation.");
  }

  return unquoted;
}

/**
 * Maps low-level `codex exec` failures to user-facing error codes.
 */
export function mapCodexFailure(result: ProcessResult): AppErrorLike {
  if (result.timedOut) {
    return createAppError("MODEL_TIMEOUT", "Translation timed out. Please retry.");
  }

  if (result.spawnErrorCode === "ENOENT") {
    return createAppError("CODEX_NOT_FOUND", "`codex` CLI is not installed or not in PATH.");
  }

  const combined = `${result.stderr}\n${result.stdout}`.toLowerCase();

  if (combined.includes("codex login") || combined.includes("not logged") || combined.includes("unauthorized")) {
    return createAppError("CODEX_AUTH_REQUIRED", "Codex auth missing or expired. Run `codex login` and retry.");
  }

  if (combined.includes("model") && combined.includes("not found")) {
    return createAppError("MODEL_NOT_FOUND", "Requested model is unavailable.");
  }

  if (combined.includes("rate limit")) {
    return createAppError("MODEL_RATE_LIMIT", "Model rate limit reached. Retry shortly.");
  }

  const compact = (result.stderr || result.stdout || "codex exec failed")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);

  return createAppError("MODEL_EXEC_FAILED", compact || "codex exec failed");
}
