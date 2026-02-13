(() => {
  const root = globalThis as TextSwiftGlobal;

  const MESSAGE_TYPES: TextSwiftMessageTypeMap = {
    TRANSLATE_REQUEST: "textswift/translate-request",
    TRANSLATE_RESULT: "textswift/translate-result",
    TRANSLATE_ERROR: "textswift/translate-error",
    SETTINGS_GET: "textswift/settings-get",
    SETTINGS_UPDATE: "textswift/settings-update",
    HOST_PING: "textswift/host-ping",
    BENCHMARK_GET: "textswift/benchmark-get",
    BENCHMARK_RUN: "textswift/benchmark-run"
  };

  const UI_STATES: TextSwiftUiStateMap = {
    IDLE: "idle",
    LOADING: "loading",
    SUCCESS: "success",
    ERROR: "error"
  };

  const MODELS: TextSwiftModelMap = {
    FAST_PRIMARY: "gpt-5.3-codex-low",
    FAST_FALLBACK: "gpt-5.1-codex-mini"
  };

  const TRANSPORTS: TextSwiftTransportMap = {
    MOCK: "mock",
    NATIVE: "native"
  };

  const NATIVE_HOST_NAME = "com.textswift.host";

  const DEFAULT_SETTINGS: TextSwiftSettings = Object.freeze({
    sourceLang: "auto",
    targetLang: "ko",
    preferredModel: MODELS.FAST_PRIMARY,
    fallbackModel: MODELS.FAST_FALLBACK,
    transport: TRANSPORTS.NATIVE,
    debug: false,
    nativeHostCheckedAt: null,
    nativeHostAvailable: false
  });

  const createRequestId = (): string => {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }

    return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  };

  root.TextSwiftMessageTypes = MESSAGE_TYPES;
  root.TextSwiftUiStates = UI_STATES;
  root.TextSwiftModels = MODELS;
  root.TextSwiftTransports = TRANSPORTS;
  root.TextSwiftNativeHostName = NATIVE_HOST_NAME;
  root.TextSwiftDefaultSettings = DEFAULT_SETTINGS;
  root.TextSwiftCreateRequestId = createRequestId;
})();
