/// <reference path="../common/globals.d.ts" />

importScripts("../common/message-types.js", "../common/storage.js");

const root = globalThis as TextSwiftGlobal;

const RATE_LIMIT_WINDOW_MS = 500;
const MAX_TEXT_LENGTH = 12000;
const NATIVE_TIMEOUT_MS = 45000;
const BENCHMARK_DEFAULT_ITERATIONS = 2;
const BENCHMARK_MAX_ITERATIONS = 5;
const TRANSLATION_CACHE_TTL_MS = 2 * 60 * 1000;
const TRANSLATION_CACHE_MAX_ITEMS = 120;

const tabRateLimitMap = new Map<number, number>();
let benchmarkRunPromise: Promise<TextSwiftBenchmarkResult> | null = null;
const translationCache = new Map<string, { expiresAt: number; result: CachedTranslateResult }>();
const inFlightTranslations = new Map<string, Promise<CachedTranslateResult>>();

interface TextSwiftAppError extends Error {
  errorCode: string;
}

type CachedTranslateResult = Omit<TextSwiftTranslateSuccess, "ok" | "requestId">;

interface NativeTranslateRequest {
  type: "translate";
  requestId: string;
  text: string;
  sourceLang: string;
  targetLang: string;
  model: string;
}

interface NativeTranslateResponse {
  ok: boolean;
  requestId?: string;
  host?: string;
  translatedText?: string;
  model?: string;
  latencyMs?: number;
  errorCode?: string;
  message?: string;
}

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const settings = await root.TextSwiftStorage.getSettings();
    await root.TextSwiftStorage.updateSettings(settings);
  } catch (error) {
    await logDebug("onInstalled storage init failed", error);
  }
});

chrome.runtime.onMessage.addListener((message: { type?: TextSwiftMessageType; payload?: unknown }, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((error) => {
      const mapped = mapError(error);
      sendResponse({
        ok: false,
        errorCode: mapped.errorCode,
        message: mapped.message
      });
    });

  return true;
});

async function handleMessage(
  message: { type?: TextSwiftMessageType; payload?: unknown },
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  if (!message?.type) {
    return {
      ok: false,
      errorCode: "INVALID_MESSAGE",
      message: "Message type is required."
    };
  }

  switch (message.type) {
    case root.TextSwiftMessageTypes.SETTINGS_GET:
      return {
        ok: true,
        settings: await root.TextSwiftStorage.getSettings()
      };

    case root.TextSwiftMessageTypes.SETTINGS_UPDATE: {
      const settings = await root.TextSwiftStorage.updateSettings(
        ((message.payload as Partial<TextSwiftSettings>) ?? {})
      );
      return { ok: true, settings };
    }

    case root.TextSwiftMessageTypes.HOST_PING:
      return pingNativeHost();

    case root.TextSwiftMessageTypes.BENCHMARK_GET:
      return {
        ok: true,
        benchmark: await root.TextSwiftStorage.getBenchmarkState()
      };

    case root.TextSwiftMessageTypes.BENCHMARK_RUN:
      return handleBenchmarkRun(message.payload as { iterations?: number } | undefined);

    case root.TextSwiftMessageTypes.TRANSLATE_REQUEST:
      return handleTranslateRequest((message.payload as Partial<TextSwiftTranslatePayload>) ?? {}, sender);

    default:
      return {
        ok: false,
        errorCode: "UNKNOWN_MESSAGE_TYPE",
        message: `Unsupported message type: ${message.type}`
      };
  }
}

async function handleBenchmarkRun(payload?: { iterations?: number }): Promise<TextSwiftBenchmarkResult | TextSwiftTranslateFailure> {
  const iterations = normalizeIterations(payload?.iterations);

  if (!benchmarkRunPromise) {
    benchmarkRunPromise = runBenchmarkInternal(iterations).finally(() => {
      benchmarkRunPromise = null;
    });
  }

  try {
    return await benchmarkRunPromise;
  } catch (error) {
    const mapped = mapError(error);
    return {
      ok: false,
      errorCode: mapped.errorCode,
      message: mapped.message
    };
  }
}

function normalizeIterations(raw: number | undefined): number {
  if (!Number.isFinite(raw)) {
    return BENCHMARK_DEFAULT_ITERATIONS;
  }
  const safe = Math.floor(Number(raw));
  if (safe < 1) {
    return BENCHMARK_DEFAULT_ITERATIONS;
  }
  if (safe > BENCHMARK_MAX_ITERATIONS) {
    return BENCHMARK_MAX_ITERATIONS;
  }
  return safe;
}

/**
 * Runs a small real-world benchmark over short/medium/long payloads and
 * persists the fastest model selection for subsequent translation requests.
 */
async function runBenchmarkInternal(iterations: number): Promise<TextSwiftBenchmarkResult> {
  const models: [TextSwiftModel, TextSwiftModel] = [
    root.TextSwiftModels.FAST_PRIMARY,
    root.TextSwiftModels.FAST_FALLBACK
  ];
  const samples: Record<"short" | "medium" | "long", string> = {
    short: "TextSwift translates selected text quickly.",
    medium:
      "Kiro helps teams move from idea to production with composable workflows, observable execution, and reliable collaboration.",
    long: [
      "TextSwift is a browser extension focused on in-context translation.",
      "Popup mode and content widget mode should have consistent behavior.",
      "Native messaging allows local Codex auth reuse without exposing credentials.",
      "Model speed is measured with repeated runs and percentile latency.",
      "The final UX should remain responsive even during longer translations."
    ].join("\n\n")
  };

  const runs: TextSwiftBenchmarkRun[] = [];

  for (const model of models) {
    for (const [textSize, text] of Object.entries(samples) as Array<["short" | "medium" | "long", string]>) {
      for (let i = 0; i < iterations; i += 1) {
        const requestId = root.TextSwiftCreateRequestId();
        const startedAt = Date.now();

        try {
          const result = await translateWithNative({
            requestId,
            text,
            sourceLang: "auto",
            targetLang: "ko",
            model
          });

          runs.push({
            model,
            textSize,
            latencyMs: result.latencyMs,
            ok: true,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          const mapped = mapError(error);
          runs.push({
            model,
            textSize,
            latencyMs: Date.now() - startedAt,
            ok: false,
            errorCode: mapped.errorCode,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }

  const successfulRuns = runs.filter((row) => row.ok).length;
  if (successfulRuns === 0) {
    const codes = Array.from(new Set(runs.map((row) => row.errorCode).filter(Boolean))).join(", ");
    throw createError(
      "BENCHMARK_FAILED",
      `No successful benchmark runs. Check native host/codex setup.${codes ? ` (${codes})` : ""}`
    );
  }

  const summary = summarizeBenchmark(models, runs);
  const primaryModel = models[0];
  const secondaryModel = models[1];
  const recommendedModel = pickRecommendedModel(summary, primaryModel);
  const fallbackModel = recommendedModel === primaryModel ? secondaryModel : primaryModel;
  const updatedAt = new Date().toISOString();

  await root.TextSwiftStorage.updateBenchmarkState({
    runs,
    preferredModel: recommendedModel,
    updatedAt
  });

  await root.TextSwiftStorage.updateSettings({
    preferredModel: recommendedModel,
    fallbackModel
  });

  return {
    ok: true,
    summary,
    recommendedModel,
    fallbackModel,
    updatedAt
  };
}

function summarizeBenchmark(
  models: TextSwiftModel[],
  runs: TextSwiftBenchmarkRun[]
): TextSwiftBenchmarkSummaryItem[] {
  return models.map((model) => {
    const targetRuns = runs.filter((row) => row.model === model);
    const latencies = targetRuns.filter((row) => row.ok).map((row) => row.latencyMs);
    const failures = targetRuns.filter((row) => !row.ok).length;

    return {
      model,
      runs: targetRuns.length,
      failures,
      p50Ms: percentile(latencies, 50),
      p95Ms: percentile(latencies, 95)
    };
  });
}

function pickRecommendedModel(
  summary: TextSwiftBenchmarkSummaryItem[],
  fallback: TextSwiftModel
): TextSwiftModel {
  const sorted = [...summary].sort((a, b) => {
    if (a.failures !== b.failures) {
      return a.failures - b.failures;
    }
    if (a.p95Ms !== b.p95Ms) {
      return a.p95Ms - b.p95Ms;
    }
    return a.p50Ms - b.p50Ms;
  });

  return sorted[0]?.model ?? fallback;
}

function percentile(values: number[], p: number): number {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

async function handleTranslateRequest(
  payload: Partial<TextSwiftTranslatePayload>,
  sender: chrome.runtime.MessageSender
): Promise<TextSwiftTranslateResult> {
  const requestId = payload.requestId ?? root.TextSwiftCreateRequestId();
  const normalized = normalizeTranslatePayload(payload, requestId);

  enforceRateLimit(sender);

  const settings = await root.TextSwiftStorage.getSettings();
  const transport =
    normalized.transport ?? settings.transport ?? (root.TextSwiftTransports.MOCK as TextSwiftTransport);
  const modelChain = buildModelChain(normalized.model, settings);

  let lastError: unknown = null;

  for (const model of modelChain) {
    const cacheKey = createTranslationCacheKey({
      text: normalized.text,
      sourceLang: normalized.sourceLang,
      targetLang: normalized.targetLang,
      model,
      transport
    });

    const cached = readTranslationCache(cacheKey);
    if (cached) {
      return {
        ok: true,
        requestId,
        ...cached,
        cached: true
      };
    }

    try {
      const result = await getOrCreateTranslation({
        cacheKey,
        requestId,
        text: normalized.text,
        sourceLang: normalized.sourceLang,
        targetLang: normalized.targetLang,
        model,
        transport
      });

      return {
        ok: true,
        requestId,
        ...result
      };
    } catch (error) {
      lastError = error;
      await logDebug("translate attempt failed", {
        requestId,
        model,
        transport,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const mapped = mapError(lastError);
  return {
    ok: false,
    requestId,
    errorCode: mapped.errorCode,
    message: mapped.message
  };
}

/**
 * Deduplicates identical in-flight translation requests and reuses recent results.
 */
async function getOrCreateTranslation(request: {
  cacheKey: string;
  requestId: string;
  text: string;
  sourceLang: string;
  targetLang: string;
  model: string;
  transport: TextSwiftTransport;
}): Promise<CachedTranslateResult> {
  const existing = inFlightTranslations.get(request.cacheKey);
  if (existing) {
    return existing;
  }

  const promise = (
    request.transport === root.TextSwiftTransports.NATIVE
      ? translateWithNative({
          requestId: request.requestId,
          text: request.text,
          sourceLang: request.sourceLang,
          targetLang: request.targetLang,
          model: request.model
        })
      : translateWithMock({
          requestId: request.requestId,
          text: request.text,
          sourceLang: request.sourceLang,
          targetLang: request.targetLang,
          model: request.model
        })
  )
    .then((result) => {
      writeTranslationCache(request.cacheKey, result);
      return result;
    })
    .finally(() => {
      inFlightTranslations.delete(request.cacheKey);
    });

  inFlightTranslations.set(request.cacheKey, promise);
  return promise;
}

function createTranslationCacheKey(request: {
  text: string;
  sourceLang: string;
  targetLang: string;
  model: string;
  transport: TextSwiftTransport;
}): string {
  // Full text is included for correctness; size is bounded by MAX_TEXT_LENGTH.
  return [request.transport, request.model, request.sourceLang, request.targetLang, request.text].join("|");
}

function readTranslationCache(cacheKey: string): CachedTranslateResult | null {
  const entry = translationCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    translationCache.delete(cacheKey);
    return null;
  }

  return entry.result;
}

function writeTranslationCache(cacheKey: string, result: CachedTranslateResult): void {
  pruneTranslationCache();
  translationCache.set(cacheKey, {
    expiresAt: Date.now() + TRANSLATION_CACHE_TTL_MS,
    result
  });

  while (translationCache.size > TRANSLATION_CACHE_MAX_ITEMS) {
    const firstKey = translationCache.keys().next().value;
    if (!firstKey) {
      break;
    }
    translationCache.delete(firstKey);
  }
}

function pruneTranslationCache(): void {
  const now = Date.now();
  for (const [key, value] of translationCache.entries()) {
    if (value.expiresAt <= now) {
      translationCache.delete(key);
    }
  }
}

function normalizeTranslatePayload(
  payload: Partial<TextSwiftTranslatePayload>,
  requestId: string
): Required<Pick<TextSwiftTranslatePayload, "requestId" | "text" | "sourceLang" | "targetLang">> & {
  model: string | null;
  transport: TextSwiftTransport | null;
} {
  const text = typeof payload.text === "string" ? payload.text.trim() : "";

  if (!text) {
    throw createError("EMPTY_TEXT", "Text is required for translation.");
  }

  if (text.length > MAX_TEXT_LENGTH) {
    throw createError("PAYLOAD_TOO_LARGE", "Selected text is too long.");
  }

  const transport =
    payload.transport === root.TextSwiftTransports.MOCK || payload.transport === root.TextSwiftTransports.NATIVE
      ? (payload.transport as TextSwiftTransport)
      : null;

  return {
    requestId,
    text,
    sourceLang: sanitizeLang(payload.sourceLang, "auto"),
    targetLang: sanitizeLang(payload.targetLang, "ko"),
    model: typeof payload.model === "string" && payload.model.trim() ? payload.model.trim() : null,
    transport
  };
}

function sanitizeLang(lang: unknown, fallback: string): string {
  if (typeof lang !== "string") {
    return fallback;
  }

  const trimmed = lang.trim().toLowerCase();
  return trimmed || fallback;
}

function enforceRateLimit(sender: chrome.runtime.MessageSender): void {
  const tabId = sender.tab?.id;
  if (typeof tabId !== "number") {
    return;
  }

  const now = Date.now();
  const last = tabRateLimitMap.get(tabId) ?? 0;

  if (now - last < RATE_LIMIT_WINDOW_MS) {
    throw createError("RATE_LIMITED", "Too many requests. Please wait a moment.");
  }

  tabRateLimitMap.set(tabId, now);
}

function buildModelChain(explicitModel: string | null, settings: TextSwiftSettings): string[] {
  const chain = [explicitModel, settings.preferredModel, settings.fallbackModel].filter(
    (value): value is string => Boolean(value)
  );

  if (!chain.length) {
    return [root.TextSwiftModels.FAST_PRIMARY, root.TextSwiftModels.FAST_FALLBACK];
  }

  return Array.from(new Set(chain));
}

async function translateWithMock(request: {
  requestId: string;
  text: string;
  sourceLang: string;
  targetLang: string;
  model: string;
}): Promise<Omit<TextSwiftTranslateSuccess, "ok" | "requestId">> {
  const startedAt = Date.now();
  const delayMs = Math.min(1400, 260 + Math.floor(request.text.length * 1.1));
  await sleep(delayMs);

  const condensed = request.text.replace(/\s+/g, " ").trim();
  const translatedText = `[mock ${request.targetLang}] ${condensed}`;

  return {
    translatedText,
    model: request.model,
    latencyMs: Date.now() - startedAt,
    transport: root.TextSwiftTransports.MOCK
  };
}

async function translateWithNative(request: {
  requestId: string;
  text: string;
  sourceLang: string;
  targetLang: string;
  model: string;
}): Promise<Omit<TextSwiftTranslateSuccess, "ok" | "requestId">> {
  const startedAt = Date.now();

  const payload: NativeTranslateRequest = {
    type: "translate",
    requestId: request.requestId,
    text: request.text,
    sourceLang: request.sourceLang,
    targetLang: request.targetLang,
    model: request.model
  };

  const response = await withTimeout(
    sendNativeMessage(payload),
    NATIVE_TIMEOUT_MS,
    () => createError("MODEL_TIMEOUT", "Native host response timed out.")
  );

  if (!response?.ok || typeof response.translatedText !== "string") {
    throw createError(
      response?.errorCode ?? "NATIVE_BAD_RESPONSE",
      response?.message ?? "Invalid response from native host."
    );
  }

  return {
    translatedText: response.translatedText,
    model: response.model ?? request.model,
    latencyMs: Number.isFinite(response.latencyMs) ? Number(response.latencyMs) : Date.now() - startedAt,
    transport: root.TextSwiftTransports.NATIVE
  };
}

async function pingNativeHost(): Promise<Record<string, unknown>> {
  try {
    const response = await sendNativeMessage({
      type: "ping",
      requestId: root.TextSwiftCreateRequestId(),
      timestamp: Date.now()
    });

    const checkedAt = new Date().toISOString();

    await root.TextSwiftStorage.updateSettings({
      nativeHostAvailable: true,
      nativeHostCheckedAt: checkedAt
    });

    return {
      ok: true,
      host: response?.host ?? root.TextSwiftNativeHostName,
      nativeHostAvailable: true,
      checkedAt
    };
  } catch (error) {
    const checkedAt = new Date().toISOString();

    await root.TextSwiftStorage.updateSettings({
      nativeHostAvailable: false,
      nativeHostCheckedAt: checkedAt
    });

    const mapped = mapError(error);
    return {
      ok: false,
      errorCode: mapped.errorCode,
      message: mapped.message,
      nativeHostAvailable: false,
      checkedAt
    };
  }
}

function sendNativeMessage(payload: object): Promise<NativeTranslateResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(root.TextSwiftNativeHostName, payload, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(createError("NATIVE_HOST_UNAVAILABLE", err.message ?? "Native host is unavailable."));
        return;
      }

      resolve((response ?? {}) as NativeTranslateResponse);
    });
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => TextSwiftAppError): Promise<T> {
  let timer: number | null = null;

  return new Promise((resolve, reject) => {
    timer = self.setTimeout(() => {
      reject(onTimeout());
    }, timeoutMs);

    promise
      .then((value) => {
        if (timer !== null) {
          clearTimeout(timer);
        }
        resolve(value);
      })
      .catch((error) => {
        if (timer !== null) {
          clearTimeout(timer);
        }
        reject(error);
      });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createError(errorCode: string, message: string): TextSwiftAppError {
  const error = new Error(message) as TextSwiftAppError;
  error.errorCode = errorCode;
  return error;
}

function mapError(error: unknown): { errorCode: string; message: string } {
  if (
    typeof error === "object" &&
    error !== null &&
    "errorCode" in error &&
    typeof (error as TextSwiftAppError).errorCode === "string"
  ) {
    const casted = error as TextSwiftAppError;
    return {
      errorCode: casted.errorCode,
      message: casted.message || "Unexpected error"
    };
  }

  return {
    errorCode: "UNEXPECTED",
    message: error instanceof Error ? error.message : "Unexpected error"
  };
}

async function logDebug(message: string, extra?: unknown): Promise<void> {
  try {
    const settings = await root.TextSwiftStorage.getSettings();
    if (!settings.debug) {
      return;
    }
    console.log("[TextSwift]", message, extra ?? "");
  } catch {
    // Ignore logging failures.
  }
}
