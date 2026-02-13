(() => {
  const root = globalThis as TextSwiftGlobal;

  const DICT: Record<string, Record<string, string>> = {
    en: {
      idle: "Ready",
      loading: "Translating...",
      success: "Done",
      error: "Translation failed"
    },
    ko: {
      idle: "준비됨",
      loading: "번역 중...",
      success: "완료",
      error: "번역 실패"
    }
  };

  const t = (locale: string, key: string): string => {
    const safeLocale = Object.prototype.hasOwnProperty.call(DICT, locale) ? locale : "en";
    const english = DICT.en ?? {};
    return DICT[safeLocale]?.[key] ?? english[key] ?? key;
  };

  root.TextSwiftI18n = { t };
})();
