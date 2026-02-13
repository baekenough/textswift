(() => {
  const root = globalThis as TextSwiftGlobal;

  const STORAGE_KEY_SETTINGS = "textswift_settings";
  const STORAGE_KEY_BENCHMARK = "textswift_benchmark";

  const ensureStorage = (): void => {
    if (!chrome?.storage?.local) {
      throw new Error("Chrome storage API is unavailable.");
    }
  };

  const cloneDefaults = (): TextSwiftSettings => {
    return JSON.parse(JSON.stringify(root.TextSwiftDefaultSettings));
  };

  const readLocal = async <T extends string>(keys: T[]): Promise<Record<T, unknown>> => {
    ensureStorage();

    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message));
          return;
        }
        resolve((result ?? {}) as Record<T, unknown>);
      });
    });
  };

  const writeLocal = async (values: Record<string, unknown>): Promise<void> => {
    ensureStorage();

    return new Promise((resolve, reject) => {
      chrome.storage.local.set(values, () => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message));
          return;
        }
        resolve();
      });
    });
  };

  const getSettings = async (): Promise<TextSwiftSettings> => {
    const defaults = cloneDefaults();
    const stored = await readLocal([STORAGE_KEY_SETTINGS]);
    return {
      ...defaults,
      ...((stored[STORAGE_KEY_SETTINGS] as Partial<TextSwiftSettings>) ?? {})
    };
  };

  const updateSettings = async (partial: Partial<TextSwiftSettings>): Promise<TextSwiftSettings> => {
    const settings = await getSettings();
    const next: TextSwiftSettings = {
      ...settings,
      ...(partial ?? {})
    };
    await writeLocal({ [STORAGE_KEY_SETTINGS]: next });
    return next;
  };

  const getBenchmarkState = async (): Promise<TextSwiftBenchmarkState> => {
    const stored = await readLocal([STORAGE_KEY_BENCHMARK]);
    const raw = stored[STORAGE_KEY_BENCHMARK] as Partial<TextSwiftBenchmarkState> | undefined;

    return {
      runs: Array.isArray(raw?.runs) ? raw.runs : [],
      preferredModel: (raw?.preferredModel as TextSwiftModel) ?? root.TextSwiftModels.FAST_PRIMARY,
      updatedAt: raw?.updatedAt ?? null
    };
  };

  const updateBenchmarkState = async (
    state: TextSwiftBenchmarkState
  ): Promise<TextSwiftBenchmarkState> => {
    const next: TextSwiftBenchmarkState = {
      runs: Array.isArray(state.runs) ? state.runs : [],
      preferredModel: state.preferredModel,
      updatedAt: new Date().toISOString()
    };
    await writeLocal({ [STORAGE_KEY_BENCHMARK]: next });
    return next;
  };

  root.TextSwiftStorage = {
    getSettings,
    updateSettings,
    getBenchmarkState,
    updateBenchmarkState,
    STORAGE_KEY_SETTINGS,
    STORAGE_KEY_BENCHMARK
  };
})();
