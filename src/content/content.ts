/// <reference path="../common/globals.d.ts" />

(() => {
  const MOUNT_VERSION = "2026-02-13.inline.v7";
  const root = window as unknown as TextSwiftGlobal &
    Window & {
      __textswiftMountedVersion?: string;
    };

  if (root.__textswiftMountedVersion === MOUNT_VERSION) {
    return;
  }

  // Remove any stale UI from previous content script versions before remounting.
  for (const staleRoot of Array.from(document.querySelectorAll("#textswift-root"))) {
    staleRoot.remove();
  }
  root.__textswiftMountedVersion = MOUNT_VERSION;

  const uiStates = root.TextSwiftUiStates;
  const messageTypes = root.TextSwiftMessageTypes;
  const transports = root.TextSwiftTransports;
  const runtimeApi = typeof chrome !== "undefined" ? chrome.runtime : undefined;
  const hasChromeRuntime = typeof runtimeApi?.sendMessage === "function";
  const runtimeUnavailableMessage =
    "확장 런타임을 찾을 수 없습니다. chrome://extensions 에서 TextSwift를 새로고침하고 탭도 새로고침하세요.";

  const languageOptions: Array<{ value: string; label: string }> = [
    { value: "en", label: "English" },
    { value: "ko", label: "Korean" },
    { value: "ja", label: "Japanese" },
    { value: "zh", label: "Chinese" },
    { value: "es", label: "Spanish" }
  ];

  let state: TextSwiftUiState = uiStates.IDLE;
  let inlineState: TextSwiftUiState = uiStates.IDLE;
  let selectedText = "";
  let lastRequest: TextSwiftTranslatePayload | null = null;
  let panelOpen = false;
  let inlinePinned = false;
  let inlineSuppressed = false;
  let suppressedSelectionText = "";
  let inlineSelectionArmed = false;
  let pendingInlineText = "";
  let inlineRequestToken = 0;
  let lastSelectionChangedAt = 0;
  let inlineHideTimer: number | null = null;
  let lastSelectionRect: DOMRect | null = null;
  let lastPointerX = Math.round(window.innerWidth * 0.5);
  let lastPointerY = Math.round(window.innerHeight * 0.33);
  let inlineFontSize = 14;
  const FONT_SIZE_MIN = 12;
  const FONT_SIZE_MAX = 24;
  const FONT_SIZE_STEP = 2;

  const rootEl = document.createElement("div");
  rootEl.id = "textswift-root";

  const dock = document.createElement("div");
  dock.className = "textswift-dock textswift-hidden";

  const fab = document.createElement("button");
  fab.className = "textswift-fab";
  fab.type = "button";
  fab.title = "Open TextSwift";

  const fabIcon = document.createElement("img");
  fabIcon.className = "textswift-fab-icon";
  fabIcon.src = typeof chrome !== "undefined" && chrome.runtime?.getURL
    ? chrome.runtime.getURL("icons/icon-48.png")
    : "";
  fabIcon.alt = "TextSwift";
  fab.appendChild(fabIcon);

  const panel = document.createElement("div");
  panel.className = "textswift-panel textswift-hidden";

  const header = document.createElement("div");
  header.className = "textswift-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "textswift-title";
  titleWrap.textContent = "TextSwift";

  const statusChip = document.createElement("span");
  statusChip.className = "textswift-status";
  statusChip.textContent = "Idle";
  titleWrap.appendChild(statusChip);

  const closeButton = document.createElement("button");
  closeButton.className = "textswift-close";
  closeButton.type = "button";
  closeButton.textContent = "×";

  header.appendChild(titleWrap);
  header.appendChild(closeButton);

  const body = document.createElement("div");
  body.className = "textswift-body";

  const selectedLabel = document.createElement("div");
  selectedLabel.className = "textswift-caption";
  selectedLabel.textContent = "Selected text";

  const selectedTextarea = document.createElement("textarea");
  selectedTextarea.className = "textswift-selection";
  selectedTextarea.readOnly = true;
  selectedTextarea.placeholder = "No text selected yet.";

  const languageRow = document.createElement("div");
  languageRow.className = "textswift-language-row";

  const sourceSelect = document.createElement("select");
  sourceSelect.innerHTML = '<option value="auto">Auto detect</option>';

  const targetSelect = document.createElement("select");
  for (const lang of languageOptions) {
    const sourceOption = document.createElement("option");
    sourceOption.value = lang.value;
    sourceOption.textContent = lang.label;
    sourceSelect.appendChild(sourceOption);

    const targetOption = document.createElement("option");
    targetOption.value = lang.value;
    targetOption.textContent = lang.label;
    targetSelect.appendChild(targetOption);
  }

  targetSelect.value = "ko";

  languageRow.appendChild(sourceSelect);
  languageRow.appendChild(targetSelect);

  const actionRow = document.createElement("div");
  actionRow.className = "textswift-actions";

  const translateButton = document.createElement("button");
  translateButton.className = "textswift-button textswift-primary";
  translateButton.type = "button";
  translateButton.textContent = "Translate";
  translateButton.disabled = true;

  const retryButton = document.createElement("button");
  retryButton.className = "textswift-button textswift-secondary";
  retryButton.type = "button";
  retryButton.textContent = "Retry";
  retryButton.disabled = true;

  actionRow.appendChild(translateButton);
  actionRow.appendChild(retryButton);

  const outputLabel = document.createElement("div");
  outputLabel.className = "textswift-caption";
  outputLabel.textContent = "Result";

  const outputTextarea = document.createElement("textarea");
  outputTextarea.className = "textswift-output";
  outputTextarea.readOnly = true;
  outputTextarea.placeholder = "Translation will appear here.";

  const copyButton = document.createElement("button");
  copyButton.className = "textswift-button textswift-secondary";
  copyButton.type = "button";
  copyButton.textContent = "Copy";
  copyButton.disabled = true;

  const hint = document.createElement("p");
  hint.className = "textswift-hint";
  hint.textContent = "텍스트를 선택한 뒤 Translate를 누르세요.";

  body.append(
    selectedLabel,
    selectedTextarea,
    languageRow,
    actionRow,
    outputLabel,
    outputTextarea,
    copyButton,
    hint
  );

  panel.append(header, body);
  dock.append(fab, panel);

  const inlineShell = document.createElement("div");
  inlineShell.className = "textswift-inline-shell textswift-hidden";

  const inlineTrigger = document.createElement("button");
  inlineTrigger.className = "textswift-inline-trigger";
  inlineTrigger.type = "button";
  inlineTrigger.title = "Translate selection";

  const triggerIcon = document.createElement("img");
  triggerIcon.className = "textswift-inline-trigger-icon";
  triggerIcon.src = typeof chrome !== "undefined" && chrome.runtime?.getURL
    ? chrome.runtime.getURL("icons/icon-48.png")
    : "";
  triggerIcon.alt = "TextSwift";
  inlineTrigger.appendChild(triggerIcon);

  const inlinePanel = document.createElement("div");
  inlinePanel.className = "textswift-inline-panel textswift-hidden";

  const inlineStatus = document.createElement("div");
  inlineStatus.className = "textswift-inline-status";
  inlineStatus.textContent = "Ready";

  const inlineResult = document.createElement("div");
  inlineResult.className = "textswift-inline-result";
  inlineResult.textContent = "번역 결과가 여기에 표시됩니다.";

  const inlineHint = document.createElement("p");
  inlineHint.className = "textswift-inline-hint";
  inlineHint.textContent = "아이콘을 눌러 번역하세요.";

  const inlineActions = document.createElement("div");
  inlineActions.className = "textswift-inline-actions";

  const inlineCopy = document.createElement("button");
  inlineCopy.className = "textswift-button textswift-secondary";
  inlineCopy.type = "button";
  inlineCopy.textContent = "Copy";
  inlineCopy.disabled = true;

  const inlineClose = document.createElement("button");
  inlineClose.className = "textswift-button textswift-secondary";
  inlineClose.type = "button";
  inlineClose.textContent = "Close";

  const inlineFontControls = document.createElement("div");
  inlineFontControls.className = "textswift-font-controls";

  const inlineFontDown = document.createElement("button");
  inlineFontDown.className = "textswift-font-btn";
  inlineFontDown.type = "button";
  inlineFontDown.textContent = "A-";
  inlineFontDown.title = "Decrease font size";

  const inlineFontUp = document.createElement("button");
  inlineFontUp.className = "textswift-font-btn";
  inlineFontUp.type = "button";
  inlineFontUp.textContent = "A+";
  inlineFontUp.title = "Increase font size";

  inlineFontControls.append(inlineFontDown, inlineFontUp);

  inlineActions.append(inlineCopy, inlineFontControls, inlineClose);
  inlinePanel.append(inlineStatus, inlineResult, inlineActions, inlineHint);
  inlineShell.append(inlineTrigger, inlinePanel);

  rootEl.append(dock, inlineShell);
  document.documentElement.appendChild(rootEl);

  fab.addEventListener("click", () => {
    panelOpen = !panelOpen;
    panel.classList.toggle("textswift-hidden", !panelOpen);
    if (panelOpen) {
      syncSelection(false);
    }
  });

  closeButton.addEventListener("click", () => {
    panelOpen = false;
    panel.classList.add("textswift-hidden");
  });

  translateButton.addEventListener("click", () => {
    void requestPanelTranslate();
  });

  retryButton.addEventListener("click", () => {
    if (!lastRequest) {
      return;
    }
    void requestPanelTranslate(lastRequest);
  });

  copyButton.addEventListener("click", async () => {
    const value = outputTextarea.value.trim();
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      hint.classList.remove("error");
      hint.textContent = "결과를 클립보드에 복사했습니다.";
    } catch {
      hint.classList.add("error");
      hint.textContent = "복사에 실패했습니다. 브라우저 권한을 확인하세요.";
    }
  });

  inlineTrigger.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    pendingInlineText = captureInlineSelectionForAction();
    clearInlineHideTimer();
  });

  inlineTrigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    inlineSuppressed = false;
    suppressedSelectionText = "";
    clearInlineHideTimer();

    // If panel is already visible, toggle it off
    if (!inlinePanel.classList.contains("textswift-hidden")) {
      inlinePanel.classList.add("textswift-hidden");
      inlinePinned = false;
      return;
    }

    inlinePinned = true;
    inlinePanel.classList.remove("textswift-hidden");

    // If already loading or has a result for the same text, just reshow panel without new request
    const nextText = (pendingInlineText || selectedText).trim();
    if ((inlineState === uiStates.LOADING || inlineState === uiStates.SUCCESS) &&
        lastRequest && lastRequest.text === nextText) {
      return;
    }

    const immediateText = pendingInlineText || captureInlineSelectionForAction();
    pendingInlineText = "";
    void requestInlineTranslate(immediateText);
  });

  inlineCopy.addEventListener("click", async () => {
    const value = inlineResult.textContent?.trim() ?? "";
    if (!value || value === "번역 결과가 여기에 표시됩니다.") {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      inlineHint.classList.remove("error");
      inlineHint.textContent = "결과를 복사했습니다.";
    } catch {
      inlineHint.classList.add("error");
      inlineHint.textContent = "복사에 실패했습니다.";
    }
  });

  const handleInlineClose = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    closeInlineForCurrentSelection();
  };

  inlineClose.addEventListener("pointerdown", handleInlineClose);
  inlineClose.addEventListener("mousedown", handleInlineClose);
  inlineClose.addEventListener("click", handleInlineClose);

  inlineFontUp.addEventListener("click", (event) => {
    event.stopPropagation();
    if (inlineFontSize < FONT_SIZE_MAX) {
      inlineFontSize += FONT_SIZE_STEP;
      inlineResult.style.fontSize = `${inlineFontSize}px`;
    }
  });

  inlineFontDown.addEventListener("click", (event) => {
    event.stopPropagation();
    if (inlineFontSize > FONT_SIZE_MIN) {
      inlineFontSize -= FONT_SIZE_STEP;
      inlineResult.style.fontSize = `${inlineFontSize}px`;
    }
  });

  document.addEventListener("mousedown", (event) => {
    const target = event.target as Node | null;
    if (!target) {
      return;
    }

    if (!inlinePanel.classList.contains("textswift-hidden") && !inlineShell.contains(target)) {
      clearInlineHideTimer();
      inlinePanel.classList.add("textswift-hidden");
      inlinePinned = false;
      if (!selectedText && inlineState !== uiStates.LOADING) {
        hideInlineUi();
      }
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    clearInlineHideTimer();
    inlinePanel.classList.add("textswift-hidden");
    inlinePinned = false;
    if (!selectedText && inlineState !== uiStates.LOADING) {
      hideInlineUi();
    }
  });

  const debouncedSync = debounce(() => syncSelection(false), 70);
  document.addEventListener("selectionchange", () => {
    lastSelectionChangedAt = Date.now();
    debouncedSync();
  });
  document.addEventListener(
    "mouseup",
    (event) => {
      updateLastPointer(event.clientX, event.clientY);
      syncSelection(true);
    },
    true
  );
  document.addEventListener("keyup", () => {
    syncSelection(true);
  });
  window.addEventListener("scroll", debounce(repositionInlineShell, 60), true);
  window.addEventListener("resize", debounce(repositionInlineShell, 60));

  function syncSelection(userTriggered: boolean): void {
    const snapshot = readSelectionSnapshot();
    const previousText = selectedText;
    selectedText = snapshot.text;
    const selectionChanged = selectedText !== previousText;
    selectedTextarea.value = selectedText;

    if (userTriggered && snapshot.active && Date.now() - lastSelectionChangedAt <= 450) {
      inlineSelectionArmed = true;
    }

    if (!snapshot.active) {
      inlineSelectionArmed = false;
    }

    if (selectionChanged) {
      inlineRequestToken += 1;
    }

    if (!selectedText) {
      inlineSuppressed = false;
      suppressedSelectionText = "";
    } else if (inlineSuppressed && selectedText !== suppressedSelectionText) {
      inlineSuppressed = false;
      suppressedSelectionText = "";
    }

    if (inlineSuppressed && selectedText && selectedText === suppressedSelectionText) {
      inlinePanel.classList.add("textswift-hidden");
      inlineShell.classList.add("textswift-hidden");
      translateButton.disabled = !hasChromeRuntime;
      if (!hasChromeRuntime) {
        hint.classList.add("error");
        hint.textContent = runtimeUnavailableMessage;
      } else if (state !== uiStates.LOADING) {
        hint.classList.remove("error");
        hint.textContent = "선택한 텍스트를 번역할 준비가 되었습니다.";
      }
      return;
    }

    if (!inlineSelectionArmed) {
      if (inlineState !== uiStates.LOADING) {
        hideInlineUi();
      }
      if (!hasChromeRuntime) {
        translateButton.disabled = true;
        retryButton.disabled = true;
        hint.classList.add("error");
        hint.textContent = runtimeUnavailableMessage;
      } else {
        translateButton.disabled = !selectedText;
        if (state !== uiStates.LOADING) {
          hint.classList.remove("error");
          hint.textContent = selectedText ? "선택한 텍스트를 번역할 준비가 되었습니다." : "텍스트를 선택하세요.";
        }
      }
      return;
    }

    if (selectionChanged && selectedText) {
      inlinePinned = false;
      inlinePanel.classList.add("textswift-hidden");
      inlineResult.textContent = "번역 결과가 여기에 표시됩니다.";
      inlineCopy.disabled = true;
      setInlineState(uiStates.IDLE, "아이콘을 눌러 번역하세요.");
    }

    if (!selectedText) {
      inlinePinned = false;
      translateButton.disabled = true;
      if (inlineState !== uiStates.LOADING) {
        scheduleInlineHide();
      }

      if (!hasChromeRuntime) {
        hint.classList.add("error");
        hint.textContent = runtimeUnavailableMessage;
        inlineHint.classList.add("error");
        inlineHint.textContent = runtimeUnavailableMessage;
      } else if (state !== uiStates.LOADING) {
        hint.classList.remove("error");
        hint.textContent = "텍스트를 선택한 뒤 Translate를 누르세요.";
      }
      return;
    }

    clearInlineHideTimer();
    const anchorRect = snapshot.rect ?? lastSelectionRect ?? createPointRect(lastPointerX, lastPointerY);
    lastSelectionRect = anchorRect;
    positionInlineShell(anchorRect);
    inlineShell.classList.remove("textswift-hidden");

    if (!hasChromeRuntime) {
      translateButton.disabled = true;
      retryButton.disabled = true;
      inlineTrigger.disabled = true;
      hint.classList.add("error");
      hint.textContent = runtimeUnavailableMessage;
      inlineHint.classList.add("error");
      inlineHint.textContent = runtimeUnavailableMessage;
    } else if (state !== uiStates.LOADING) {
      translateButton.disabled = false;
      hint.classList.remove("error");
      hint.textContent = "선택한 텍스트를 번역할 준비가 되었습니다.";
    }
  }

  async function requestPanelTranslate(overrideRequest?: TextSwiftTranslatePayload): Promise<void> {
    if (!hasChromeRuntime) {
      setState(uiStates.ERROR, runtimeUnavailableMessage);
      return;
    }

    const text = overrideRequest?.text ?? selectedText;

    if (!text.trim()) {
      translateButton.disabled = true;
      hint.classList.add("error");
      hint.textContent = "선택된 텍스트가 없습니다.";
      return;
    }

    const nextTransport =
      overrideRequest?.transport === transports.NATIVE || overrideRequest?.transport === transports.MOCK
        ? overrideRequest.transport
        : null;
    const payload = buildPayload(text, nextTransport);
    lastRequest = { ...payload };

    setState(uiStates.LOADING, "번역을 처리하고 있습니다...");
    outputTextarea.value = "";
    copyButton.disabled = true;
    retryButton.disabled = true;

    try {
      const response = await sendTranslateMessage(payload);

      if (!response.ok) {
        setState(uiStates.ERROR, response.message || "번역 요청에 실패했습니다.");
        retryButton.disabled = false;
        return;
      }

      outputTextarea.value = response.translatedText || "";
      copyButton.disabled = !outputTextarea.value;
      retryButton.disabled = false;

      setState(uiStates.SUCCESS, "번역이 완료되었습니다.");
    } catch (error) {
      setState(uiStates.ERROR, error instanceof Error ? error.message : "백그라운드와 통신할 수 없습니다.");
      retryButton.disabled = false;
    }
  }

  async function requestInlineTranslate(overrideText?: string): Promise<void> {
    if (!hasChromeRuntime) {
      setInlineState(uiStates.ERROR, runtimeUnavailableMessage);
      return;
    }

    const text = (overrideText ?? selectedText).trim();

    if (!text) {
      setInlineState(uiStates.ERROR, "선택된 텍스트가 없습니다.");
      return;
    }

    if (selectedText !== text) {
      selectedText = text;
      selectedTextarea.value = text;
    }

    inlinePanel.classList.remove("textswift-hidden");
    inlineResult.textContent = "";
    inlineCopy.disabled = true;

    const payload = buildPayload(text, null);
    lastRequest = { ...payload };

    setInlineState(uiStates.LOADING, "번역 중...");

    const requestToken = ++inlineRequestToken;

    try {
      const response = await sendTranslateMessage(payload);
      if (requestToken !== inlineRequestToken) {
        return;
      }
      if (!response.ok) {
        setInlineState(uiStates.ERROR, response.message || "번역 요청에 실패했습니다.");
        return;
      }

      inlineResult.textContent = response.translatedText || "";
      inlineCopy.disabled = !inlineResult.textContent;
      setInlineState(uiStates.SUCCESS, "번역이 완료되었습니다.");
    } catch (error) {
      if (requestToken !== inlineRequestToken) {
        return;
      }
      setInlineState(uiStates.ERROR, error instanceof Error ? error.message : "백그라운드 통신 실패");
    }
  }

  function setState(nextState: TextSwiftUiState, message?: string): void {
    state = nextState;

    statusChip.classList.remove("loading", "success", "error");
    if (nextState === uiStates.LOADING) {
      statusChip.textContent = "Loading";
      statusChip.classList.add("loading");
      translateButton.disabled = true;
    } else if (nextState === uiStates.SUCCESS) {
      statusChip.textContent = "Success";
      statusChip.classList.add("success");
      translateButton.disabled = !selectedText;
    } else if (nextState === uiStates.ERROR) {
      statusChip.textContent = "Error";
      statusChip.classList.add("error");
      translateButton.disabled = !selectedText;
      retryButton.disabled = !lastRequest;
    } else {
      statusChip.textContent = "Idle";
      translateButton.disabled = !selectedText;
    }

    if (typeof message === "string") {
      hint.textContent = message;
      hint.classList.toggle("error", nextState === uiStates.ERROR);
    }

    if (!hasChromeRuntime) {
      translateButton.disabled = true;
      retryButton.disabled = true;
    }
  }

  function setInlineState(nextState: TextSwiftUiState, message: string): void {
    inlineState = nextState;

    inlineStatus.classList.remove("loading", "success", "error");
    if (nextState === uiStates.LOADING) {
      inlineStatus.textContent = "Translating...";
      inlineStatus.classList.add("loading");
      inlineTrigger.disabled = false;
    } else if (nextState === uiStates.SUCCESS) {
      inlineStatus.textContent = "Done";
      inlineStatus.classList.add("success");
      inlineTrigger.disabled = false;
    } else if (nextState === uiStates.ERROR) {
      inlineStatus.textContent = "Error";
      inlineStatus.classList.add("error");
      inlineTrigger.disabled = false;
    } else {
      inlineStatus.textContent = "Ready";
      inlineTrigger.disabled = false;
    }

    inlineHint.classList.toggle("error", nextState === uiStates.ERROR);
    inlineHint.textContent = message;

    if (!hasChromeRuntime) {
      inlineTrigger.disabled = true;
    }
  }

  function buildPayload(text: string, transport: TextSwiftTransport | null): TextSwiftTranslatePayload {
    return {
      requestId: root.TextSwiftCreateRequestId(),
      text: text.trim(),
      sourceLang: sourceSelect.value || "auto",
      targetLang: targetSelect.value || "ko",
      transport,
      model: null,
      context: "content"
    };
  }

  function sendTranslateMessage(payload: TextSwiftTranslatePayload): Promise<TextSwiftTranslateResult> {
    if (!hasChromeRuntime || !runtimeApi) {
      return Promise.resolve({
        ok: false,
        requestId: payload.requestId,
        errorCode: "RUNTIME_UNAVAILABLE",
        message: runtimeUnavailableMessage
      });
    }

    return new Promise((resolve, reject) => {
      runtimeApi.sendMessage(
        {
          type: messageTypes.TRANSLATE_REQUEST,
          payload
        },
        (response: TextSwiftTranslateResult | undefined) => {
          const runtimeError = runtimeApi.lastError;
          if (runtimeError) {
            reject(new Error(runtimeError.message || "백그라운드와 통신할 수 없습니다."));
            return;
          }

          resolve(
            response || {
              ok: false,
              errorCode: "EMPTY_RESPONSE",
              message: "빈 응답이 반환되었습니다."
            }
          );
        }
      );
    });
  }

  function captureInlineSelectionForAction(): string {
    const snapshot = readSelectionSnapshot();
    const text = snapshot.text.trim();
    if (!text) {
      return "";
    }

    inlineSelectionArmed = true;
    selectedText = text;
    selectedTextarea.value = text;

    const anchorRect = snapshot.rect ?? lastSelectionRect ?? createPointRect(lastPointerX, lastPointerY);
    lastSelectionRect = anchorRect;
    positionInlineShell(anchorRect);
    inlineShell.classList.remove("textswift-hidden");
    return text;
  }

  function closeInlineForCurrentSelection(): void {
    inlinePinned = false;
    clearInlineHideTimer();
    inlinePanel.classList.add("textswift-hidden");

    // During loading: keep trigger visible so user can reopen
    if (inlineState === uiStates.LOADING) {
      return;
    }

    inlineSuppressed = true;
    suppressedSelectionText = selectedText.trim();
    pendingInlineText = "";
    inlineRequestToken += 1;
    inlineShell.classList.add("textswift-hidden");
    inlineResult.textContent = "번역 결과가 여기에 표시됩니다.";
    inlineCopy.disabled = true;
    setInlineState(uiStates.IDLE, "아이콘을 눌러 번역하세요.");
  }

  function hideInlineUi(): void {
    inlinePanel.classList.add("textswift-hidden");
    inlineShell.classList.add("textswift-hidden");
  }

  type SelectionSnapshot = {
    text: string;
    rect: DOMRect | null;
    active: boolean;
  };

  const selectableInputTypes = new Set([
    "text",
    "search",
    "url",
    "tel",
    "password",
    "email",
    "number"
  ]);

  function scheduleInlineHide(): void {
    clearInlineHideTimer();
    inlineHideTimer = window.setTimeout(() => {
      inlineHideTimer = null;
      if (selectedText) {
        return;
      }
      hideInlineUi();
    }, 0);
  }

  function clearInlineHideTimer(): void {
    if (inlineHideTimer === null) {
      return;
    }
    clearTimeout(inlineHideTimer);
    inlineHideTimer = null;
  }

  function repositionInlineShell(): void {
    if (inlineShell.classList.contains("textswift-hidden")) {
      return;
    }

    const snapshot = readSelectionSnapshot();
    if (snapshot.rect) {
      lastSelectionRect = snapshot.rect;
      positionInlineShell(snapshot.rect);
      return;
    }

    if (lastSelectionRect) {
      positionInlineShell(lastSelectionRect);
    }
  }

  function positionInlineShell(rect: DOMRect | null): void {
    const anchorRect = rect ?? createPointRect(lastPointerX, lastPointerY);

    const panelVisible = !inlinePanel.classList.contains("textswift-hidden");
    const shellWidth = panelVisible ? 432 : 56;
    const shellHeight = panelVisible ? 260 : 56;

    let x = anchorRect.right + 10;
    let y = anchorRect.top - 12;

    if (y < 16) {
      y = anchorRect.bottom + 10;
    }

    x = clamp(x, 12, Math.max(12, window.innerWidth - shellWidth));
    y = clamp(y, 12, Math.max(12, window.innerHeight - shellHeight));

    inlineShell.style.left = `${Math.round(x)}px`;
    inlineShell.style.top = `${Math.round(y)}px`;
  }

  function readSelectionSnapshot(): SelectionSnapshot {
    const controlSelection = readTextControlSelection();
    if (controlSelection) {
      return controlSelection;
    }

    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    const active = Boolean(selection && selection.rangeCount > 0 && !selection.isCollapsed && text);
    return {
      text,
      rect: active ? getSelectionRect(selection) : null,
      active
    };
  }

  function readTextControlSelection(): SelectionSnapshot | null {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLInputElement) {
      if (!selectableInputTypes.has((activeElement.type || "text").toLowerCase())) {
        return null;
      }
      return buildTextControlSelection(activeElement, activeElement.value);
    }

    if (activeElement instanceof HTMLTextAreaElement) {
      return buildTextControlSelection(activeElement, activeElement.value);
    }

    return null;
  }

  function buildTextControlSelection(
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string
  ): SelectionSnapshot | null {
    const start = element.selectionStart;
    const end = element.selectionEnd;
    if (typeof start !== "number" || typeof end !== "number" || start === end) {
      return null;
    }

    const from = Math.min(start, end);
    const to = Math.max(start, end);
    const text = value.slice(from, to).trim();
    if (!text) {
      return null;
    }

    const rect = element.getBoundingClientRect();
    return {
      text,
      rect: rect.width > 0 || rect.height > 0 ? rect : null,
      active: true
    };
  }

  function updateLastPointer(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }

    lastPointerX = clamp(Math.round(x), 0, window.innerWidth);
    lastPointerY = clamp(Math.round(y), 0, window.innerHeight);
  }

  function createPointRect(x: number, y: number): DOMRect {
    const safeX = clamp(Math.round(x), 12, Math.max(12, window.innerWidth - 12));
    const safeY = clamp(Math.round(y), 12, Math.max(12, window.innerHeight - 12));
    return new DOMRect(safeX, safeY, 1, 1);
  }

  function getSelectionRect(selection: Selection | null): DOMRect | null {
    if (!selection || selection.rangeCount < 1) {
      return null;
    }

    try {
      const range = selection.getRangeAt(0);
      let rect: DOMRect | null = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        const rects = range.getClientRects();
        rect = rects.length > 0 ? (rects[0] ?? null) : null;
      }

      if (!rect || (rect.width === 0 && rect.height === 0)) {
        return null;
      }
      return rect;
    } catch {
      return null;
    }
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  function debounce(fn: () => void, waitMs: number): () => void {
    let timer: number | null = null;

    return () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = window.setTimeout(fn, waitMs);
    };
  }

  syncSelection(false);
  setInlineState(uiStates.IDLE, "아이콘을 눌러 번역하세요.");
})();
