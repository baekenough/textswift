type TextSwiftUiState = "idle" | "loading" | "success" | "error";
type TextSwiftTransport = "mock" | "native";
type TextSwiftModel = "gpt-5.1-codex-mini" | "gpt-5.3-codex-low";

type TextSwiftMessageType =
  | "textswift/translate-request"
  | "textswift/translate-result"
  | "textswift/translate-error"
  | "textswift/settings-get"
  | "textswift/settings-update"
  | "textswift/host-ping"
  | "textswift/benchmark-get"
  | "textswift/benchmark-run";

interface TextSwiftMessageTypeMap {
  TRANSLATE_REQUEST: "textswift/translate-request";
  TRANSLATE_RESULT: "textswift/translate-result";
  TRANSLATE_ERROR: "textswift/translate-error";
  SETTINGS_GET: "textswift/settings-get";
  SETTINGS_UPDATE: "textswift/settings-update";
  HOST_PING: "textswift/host-ping";
  BENCHMARK_GET: "textswift/benchmark-get";
  BENCHMARK_RUN: "textswift/benchmark-run";
}

interface TextSwiftUiStateMap {
  IDLE: "idle";
  LOADING: "loading";
  SUCCESS: "success";
  ERROR: "error";
}

interface TextSwiftModelMap {
  FAST_PRIMARY: "gpt-5.3-codex-low";
  FAST_FALLBACK: "gpt-5.1-codex-mini";
}

interface TextSwiftTransportMap {
  MOCK: "mock";
  NATIVE: "native";
}

interface TextSwiftSettings {
  sourceLang: string;
  targetLang: string;
  preferredModel: TextSwiftModel;
  fallbackModel: TextSwiftModel;
  transport: TextSwiftTransport;
  debug: boolean;
  nativeHostCheckedAt: string | null;
  nativeHostAvailable: boolean;
}

interface TextSwiftBenchmarkRun {
  model: TextSwiftModel;
  textSize: "short" | "medium" | "long";
  latencyMs: number;
  ok: boolean;
  errorCode?: string;
  timestamp: string;
}

interface TextSwiftBenchmarkState {
  runs: TextSwiftBenchmarkRun[];
  preferredModel: TextSwiftModel;
  updatedAt: string | null;
}

interface TextSwiftBenchmarkSummaryItem {
  model: TextSwiftModel;
  runs: number;
  failures: number;
  p50Ms: number;
  p95Ms: number;
}

interface TextSwiftBenchmarkResult {
  ok: true;
  summary: TextSwiftBenchmarkSummaryItem[];
  recommendedModel: TextSwiftModel;
  fallbackModel: TextSwiftModel;
  updatedAt: string;
}

interface TextSwiftTranslatePayload {
  requestId: string;
  text: string;
  sourceLang: string;
  targetLang: string;
  model?: string | null;
  transport?: string | null;
  context?: "popup" | "content";
}

interface TextSwiftTranslateSuccess {
  ok: true;
  requestId: string;
  translatedText: string;
  model: string;
  latencyMs: number;
  transport: TextSwiftTransport;
  cached?: boolean;
}

interface TextSwiftTranslateFailure {
  ok: false;
  requestId?: string;
  errorCode: string;
  message: string;
}

type TextSwiftTranslateResult = TextSwiftTranslateSuccess | TextSwiftTranslateFailure;

interface TextSwiftStorageApi {
  getSettings(): Promise<TextSwiftSettings>;
  updateSettings(partial: Partial<TextSwiftSettings>): Promise<TextSwiftSettings>;
  getBenchmarkState(): Promise<TextSwiftBenchmarkState>;
  updateBenchmarkState(state: TextSwiftBenchmarkState): Promise<TextSwiftBenchmarkState>;
  STORAGE_KEY_SETTINGS: string;
  STORAGE_KEY_BENCHMARK: string;
}

type TextSwiftGlobal = typeof globalThis & {
  TextSwiftMessageTypes: Readonly<TextSwiftMessageTypeMap>;
  TextSwiftUiStates: Readonly<TextSwiftUiStateMap>;
  TextSwiftModels: Readonly<TextSwiftModelMap>;
  TextSwiftTransports: Readonly<TextSwiftTransportMap>;
  TextSwiftNativeHostName: string;
  TextSwiftDefaultSettings: Readonly<TextSwiftSettings>;
  TextSwiftCreateRequestId: () => string;
  TextSwiftStorage: TextSwiftStorageApi;
  TextSwiftI18n: {
    t(locale: string, key: string): string;
  };
};
