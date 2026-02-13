/// <reference path="../common/globals.d.ts" />

(() => {
  const root = window as unknown as TextSwiftGlobal;

  const messageTypes = root.TextSwiftMessageTypes;
  const uiStates = root.TextSwiftUiStates;
  const models = root.TextSwiftModels;
  const FIXED_TRANSPORT: TextSwiftTransport = root.TextSwiftTransports.NATIVE;
  const FIXED_MODEL: TextSwiftModel = models.FAST_PRIMARY;
  const FIXED_FALLBACK: TextSwiftModel = models.FAST_FALLBACK;
  const hasChromeRuntime =
    typeof chrome !== "undefined" &&
    Boolean(chrome.runtime) &&
    typeof chrome.runtime.sendMessage === "function";

  const sourceText = getEl<HTMLTextAreaElement>("source-text");
  const resultText = getEl<HTMLTextAreaElement>("result-text");
  const sourceLang = getEl<HTMLSelectElement>("source-lang");
  const targetLang = getEl<HTMLSelectElement>("target-lang");
  const swapBtn = getEl<HTMLButtonElement>("swap-btn");
  const translateBtn = getEl<HTMLButtonElement>("translate-btn");
  const retryBtn = getEl<HTMLButtonElement>("retry-btn");
  const copyBtn = getEl<HTMLButtonElement>("copy-btn");
  const stateChip = getEl<HTMLSpanElement>("state-chip");
  const statusMessage = getEl<HTMLParagraphElement>("status-message");

  const languageOptions: Array<{ value: string; label: string }> = [
    { value: "auto", label: "Auto detect" },
    { value: "en", label: "English" },
    { value: "ko", label: "Korean" },
    { value: "ja", label: "Japanese" },
    { value: "zh", label: "Chinese" },
    { value: "es", label: "Spanish" }
  ];

  let uiState: TextSwiftUiState = uiStates.IDLE;
  let lastPayload: TextSwiftTranslatePayload | null = null;
  const harnessState: {
    settings: TextSwiftSettings;
    benchmark: TextSwiftBenchmarkState;
  } = {
    settings: {
      ...root.TextSwiftDefaultSettings
    },
    benchmark: {
      runs: [],
      preferredModel: root.TextSwiftModels.FAST_PRIMARY,
      updatedAt: null
    }
  };

  void init();

  async function init(): Promise<void> {
    try {
      renderLanguageOptions();
      bindEvents();

      const settingsResult = await sendMessage<{ ok: boolean; settings?: TextSwiftSettings }>({
        type: messageTypes.SETTINGS_GET
      });

      if (settingsResult?.ok && settingsResult.settings) {
        applySettings(settingsResult.settings);
      } else {
        sourceLang.value = "auto";
        targetLang.value = "ko";
      }

      await persistSettings();

      setState(uiStates.IDLE, "텍스트를 입력하고 Translate를 누르세요.");
    } catch (error) {
      setState(uiStates.ERROR, `초기화 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function renderLanguageOptions(): void {
    sourceLang.innerHTML = "";
    targetLang.innerHTML = "";

    for (const option of languageOptions) {
      const sourceOption = document.createElement("option");
      sourceOption.value = option.value;
      sourceOption.textContent = option.label;
      sourceLang.appendChild(sourceOption);

      if (option.value === "auto") {
        continue;
      }

      const targetOption = document.createElement("option");
      targetOption.value = option.value;
      targetOption.textContent = option.label;
      targetLang.appendChild(targetOption);
    }
  }

  function bindEvents(): void {
    translateBtn.addEventListener("click", () => {
      void requestTranslate();
    });

    retryBtn.addEventListener("click", () => {
      if (lastPayload) {
        void requestTranslate(lastPayload);
      }
    });

    copyBtn.addEventListener("click", async () => {
      const value = resultText.value.trim();
      if (!value) {
        return;
      }

      try {
        await navigator.clipboard.writeText(value);
        setState(uiState, "결과를 클립보드에 복사했습니다.");
      } catch {
        setState(uiStates.ERROR, "복사에 실패했습니다.");
      }
    });

    swapBtn.addEventListener("click", async () => {
      if (sourceLang.value === "auto") {
        sourceLang.value = targetLang.value;
      }

      const nextTarget = sourceLang.value === "auto" ? "ko" : sourceLang.value;
      sourceLang.value = targetLang.value;
      targetLang.value = nextTarget;

      await persistSettings();
    });

    sourceLang.addEventListener("change", () => {
      void persistSettings();
    });
    targetLang.addEventListener("change", () => {
      void persistSettings();
    });
  }

  async function persistSettings(): Promise<void> {
    const sourceValue = sourceLang.value || "auto";
    const targetValue = targetLang.value || "ko";

    await sendMessage({
      type: messageTypes.SETTINGS_UPDATE,
      payload: {
        sourceLang: sourceValue,
        targetLang: targetValue,
        transport: FIXED_TRANSPORT,
        preferredModel: FIXED_MODEL,
        fallbackModel: FIXED_FALLBACK
      }
    });
  }

  function applySettings(settings: TextSwiftSettings): void {
    sourceLang.value = settings.sourceLang || "auto";
    if (settings.targetLang) {
      targetLang.value = settings.targetLang;
    }
  }

  async function requestTranslate(overridePayload?: TextSwiftTranslatePayload): Promise<void> {
    const text = overridePayload?.text ?? sourceText.value;

    if (!text.trim()) {
      setState(uiStates.ERROR, "번역할 텍스트를 입력하세요.");
      return;
    }

    const payload: TextSwiftTranslatePayload = {
      requestId: root.TextSwiftCreateRequestId(),
      text: text.trim(),
      sourceLang: sourceLang.value || "auto",
      targetLang: targetLang.value || "ko",
      model: FIXED_MODEL,
      transport: FIXED_TRANSPORT,
      context: "popup"
    };

    lastPayload = { ...payload };

    setState(uiStates.LOADING, "번역 요청을 처리하고 있습니다...");
    resultText.value = "";
    translateBtn.disabled = true;
    retryBtn.disabled = true;
    copyBtn.disabled = true;

    try {
      const response = await sendMessage<TextSwiftTranslateResult>({
        type: messageTypes.TRANSLATE_REQUEST,
        payload
      });

      if (!response?.ok) {
        setState(uiStates.ERROR, response?.message ?? "번역 실패");
        retryBtn.disabled = false;
        return;
      }

      resultText.value = response.translatedText || "";
      copyBtn.disabled = !resultText.value;
      retryBtn.disabled = false;
      setState(uiStates.SUCCESS, "번역이 완료되었습니다.");
    } catch (error) {
      setState(uiStates.ERROR, error instanceof Error ? error.message : "백그라운드 통신 실패");
      retryBtn.disabled = false;
    } finally {
      translateBtn.disabled = false;
    }
  }

  function setState(nextState: TextSwiftUiState, message: string): void {
    uiState = nextState;
    stateChip.classList.remove("loading", "success", "error");

    if (nextState === uiStates.LOADING) {
      stateChip.textContent = "Loading";
      stateChip.classList.add("loading");
    } else if (nextState === uiStates.SUCCESS) {
      stateChip.textContent = "Success";
      stateChip.classList.add("success");
    } else if (nextState === uiStates.ERROR) {
      stateChip.textContent = "Error";
      stateChip.classList.add("error");
    } else {
      stateChip.textContent = "Idle";
    }

    statusMessage.classList.toggle("error", nextState === uiStates.ERROR);
    statusMessage.textContent = message;
  }

  function sendMessage<T = unknown>(message: Record<string, unknown>): Promise<T> {
    if (!hasChromeRuntime) {
      return Promise.resolve(handleHarnessMessage(message) as T);
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }

        resolve(response as T);
      });
    });
  }

  function handleHarnessMessage(message: Record<string, unknown>): unknown {
    const type = message.type as TextSwiftMessageType | undefined;
    const payload = (message.payload as Record<string, unknown> | undefined) ?? {};

    switch (type) {
      case messageTypes.SETTINGS_GET:
        return { ok: true, settings: harnessState.settings };

      case messageTypes.SETTINGS_UPDATE:
        harnessState.settings = {
          ...harnessState.settings,
          ...(payload as Partial<TextSwiftSettings>)
        };
        return { ok: true, settings: harnessState.settings };

      case messageTypes.HOST_PING:
        harnessState.settings = {
          ...harnessState.settings,
          nativeHostAvailable: true,
          nativeHostCheckedAt: new Date().toISOString()
        };
        return {
          ok: true,
          checkedAt: harnessState.settings.nativeHostCheckedAt,
          host: "harness-host"
        };

      case messageTypes.TRANSLATE_REQUEST: {
        const text = typeof payload.text === "string" ? payload.text : "";
        const targetLang = typeof payload.targetLang === "string" ? payload.targetLang : "ko";
        const model =
          typeof payload.model === "string" && payload.model.trim() ? payload.model : harnessState.settings.preferredModel;
        return {
          ok: true,
          requestId: payload.requestId,
          translatedText: `[popup-harness:${targetLang}] ${text.trim()}`,
          model,
          latencyMs: 42,
          transport: "mock"
        };
      }

      case messageTypes.BENCHMARK_GET:
        return { ok: true, benchmark: harnessState.benchmark };

      case messageTypes.BENCHMARK_RUN: {
        const updatedAt = new Date().toISOString();
        harnessState.benchmark = {
          runs: [],
          preferredModel: models.FAST_PRIMARY,
          updatedAt
        };
        harnessState.settings = {
          ...harnessState.settings,
          preferredModel: models.FAST_PRIMARY,
          fallbackModel: models.FAST_FALLBACK
        };
        return {
          ok: true,
          summary: [
            {
              model: models.FAST_PRIMARY,
              runs: 6,
              failures: 0,
              p50Ms: 40,
              p95Ms: 61
            },
            {
              model: models.FAST_FALLBACK,
              runs: 6,
              failures: 0,
              p50Ms: 52,
              p95Ms: 84
            }
          ],
          recommendedModel: models.FAST_PRIMARY,
          fallbackModel: models.FAST_FALLBACK,
          updatedAt
        };
      }

      default:
        return {
          ok: false,
          errorCode: "HARNESS_UNSUPPORTED",
          message: `Unsupported harness message: ${String(type)}`
        };
    }
  }

  function getEl<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) {
      throw new Error(`Element not found: ${id}`);
    }
    return el as T;
  }
})();
