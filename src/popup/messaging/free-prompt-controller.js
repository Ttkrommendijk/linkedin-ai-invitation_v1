// Owns free prompt generation, preview/copy behavior, and free prompt language handling.
(function initPopupFreePromptController(globalObj) {
  const dom = globalObj.PopupDom;
  const utils = globalObj.PopupUtils || {};
  const profileController = globalObj.PopupProfileController || {};
  const messageController = globalObj.PopupMessageController || {};
  if (!dom || typeof dom !== "object") {
    throw new Error("PopupDom must be loaded before popup-free-prompt-controller.js.");
  }

  const STORAGE_KEY_FREE_PROMPT_LANGUAGE =
    (globalObj.PopupStorageKeys && globalObj.PopupStorageKeys.freePromptLanguage) ||
    "freePromptLanguage";
  const SUPPORTED_LANGUAGES = ["Portuguese", "English", "Dutch", "Spanish"];

  function normalizeLanguageValue(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const match = SUPPORTED_LANGUAGES.find(
      (lang) => lang.toLowerCase() === raw.toLowerCase(),
    );
    return match || "";
  }

  function getLanguage() {
    if (typeof globalObj.getLanguage === "function") {
      return globalObj.getLanguage();
    }
    return "Portuguese";
  }

  function clearFreePromptPreview() {
    if (dom.freePromptPreviewEl) dom.freePromptPreviewEl.textContent = "";
    if (typeof messageController.updateFreePromptCopyButtonState === "function") {
      messageController.updateFreePromptCopyButtonState();
    }
  }

  function getFreePromptLanguage() {
    return normalizeLanguageValue(dom.freePromptLanguageEl?.value) || getLanguage();
  }

  async function setFreePromptLanguage(value, { persist = true } = {}) {
    if (!dom.freePromptLanguageEl) return;
    const normalized = normalizeLanguageValue(value) || "Portuguese";
    dom.freePromptLanguageEl.value = normalized;
    if (persist) {
      await chrome.storage.local.set({
        [STORAGE_KEY_FREE_PROMPT_LANGUAGE]: normalized,
      });
    }
  }

  async function handleGenerateFreePromptClick() {
    if (generating) return;
    try {
      const prompt = (dom.freePromptInputEl?.value || "").trim();
      const includeProfile = dom.freePromptIncludeProfileEl
        ? dom.freePromptIncludeProfileEl.checked
        : true;
      const includeStrategy = dom.freePromptIncludeStrategyEl
        ? dom.freePromptIncludeStrategyEl.checked
        : true;

      if (!prompt) {
        globalObj.setFooterStatus?.("Prompt is required.");
        messageController.updateFreePromptCopyButtonState?.();
        return;
      }
      generating = true;
      clearFreePromptPreview();
      dom.generateFreePromptBtnEl.disabled = true;
      dom.generateFreePromptBtnEl.textContent = 'Generating...';
      generationStatus.textContent = 'Generating a new message...';
      dom.freePromptPreviewEl?.setAttribute('aria-busy', 'true');

      let profileForGeneration = null;
      if (includeProfile) {
        const existingContext = globalObj.PopupState?.currentProfileContext || null;
        const existingLinkedinUrl = globalObj.getLinkedinUrlFromContext(existingContext);
        if (existingContext && (existingLinkedinUrl || existingContext.id || existingContext.phone)) {
          profileForGeneration = { ...existingContext };
        } else {
          const activeTab = await profileController.getActiveTabForProfileCheck?.().catch(() => null);
          const pageInfo = globalObj.detectLinkedInPageType(activeTab?.url || "");
          profileForGeneration = await profileController.getFreshScrapeForPage?.(pageInfo, {
            source: "free_prompt",
          });
        }
        const hasUsableProfile = Boolean(
          profileForGeneration &&
            (globalObj.getLinkedinUrlFromContext(profileForGeneration) ||
              profileForGeneration.id ||
              profileForGeneration.phone),
        );
        if (!hasUsableProfile) {
          globalObj.setFooterStatus?.(
            "Profile context is missing. Open a LinkedIn profile, WhatsApp Web conversation, or a person from contacts and try again.",
          );
          messageController.updateFreePromptCopyButtonState?.();
          return;
        }
      }

      const [{ apiKey: apiKeyLocal }, { model }] = await Promise.all([
        chrome.storage.local.get(["apiKey"]),
        chrome.storage.sync.get(["model"]),
      ]);
      let apiKey = (apiKeyLocal || "").trim();
      if (!apiKey && !await globalObj.LEFOpenAIConnection?.usesCodex()) {
        const typed = (dom.apiKeyEl?.value || "").trim();
        if (typed) {
          apiKey = typed;
          await chrome.storage.local.set({ apiKey });
        }
      }
      if (!apiKey && !await globalObj.LEFOpenAIConnection?.usesCodex()) {
        globalObj.setFooterStatus?.(globalObj.UI_TEXT.setApiKeyInConfig);
        return;
      }

      const strategyCoreRaw = (dom.strategyEl?.value || "").trim();
      const payload = {
        apiKey,
        model: (model || "gpt-4.1").trim(),
        modelOverride: document.getElementById("promptModelOverride")?.value.trim() || "",
        reasoningOverride: document.getElementById("promptReasoningOverride")?.value || "",
        language: getFreePromptLanguage(),
        prompt,
        includeProfile,
        includeStrategy,
        include_profile: includeProfile,
        include_strategy: includeStrategy,
      };
      if (includeProfile && profileForGeneration) {
        payload.profile = { ...profileForGeneration };
      }
      if (includeStrategy) {
        payload.strategyCore = strategyCoreRaw || "(none)";
      }

      requestPending = true;
      globalObj.setFooterStatus?.(globalObj.UI_TEXT.callingOpenAI);
      const send = globalObj.sendRuntimeMessage || utils.sendRuntimeMessage;
      const result = await send("GENERATE_FREE_PROMPT", {
        payload,
      });
      requestPending = false;
      const resp = result.data || {};
      if (!result.ok || !resp?.ok) {
        throw new Error(globalObj.getErrorMessage(result.error || resp?.error));
      }

      const generatedText = (resp.text || "").trim();
      if (dom.freePromptPreviewEl) {
        dom.freePromptPreviewEl.textContent = generatedText;
      }
      messageController.updateFreePromptCopyButtonState?.();
      generationStatus.textContent = generatedText ? 'New message generated. Ready to copy.' : 'No message returned.';
      globalObj.setFooterStatus?.(
        generatedText ? "Ready" : globalObj.UI_TEXT.noMessageGenerated,
      );
    } catch (e) {
      requestPending = false;
      if (generationStatus) generationStatus.textContent = `Generation failed: ${globalObj.getErrorMessage(e)}`;
      if (dom.freePromptPreviewEl) {
        dom.freePromptPreviewEl.textContent = "";
      }
      messageController.updateFreePromptCopyButtonState?.();
      globalObj.setFooterStatus?.(
        `${globalObj.UI_TEXT.errorPrefix} ${globalObj.getErrorMessage(e)}`,
      );
    } finally {
      requestPending = false;
      generating = false;
      if (generationStatus?.textContent === 'Generating a new message...') generationStatus.textContent = 'No message generated. Check the status below.';
      if (dom.generateFreePromptBtnEl) {
        dom.generateFreePromptBtnEl.disabled = false;
        dom.generateFreePromptBtnEl.textContent = generateLabel;
      }
      dom.freePromptPreviewEl?.setAttribute('aria-busy', 'false');
    }
  }

  let generating = false;
  let requestPending = false;
  let generationStatus;
  let generateLabel = 'Generate';
  function bindGenerateFreePromptClickHandler() {
    if (!dom.generateFreePromptBtnEl) return;
    if (dom.generateFreePromptBtnEl.dataset.freePromptBound === "1") return;
    dom.generateFreePromptBtnEl.dataset.freePromptBound = "1";
    generateLabel = dom.generateFreePromptBtnEl.textContent;
    generationStatus = document.createElement('p');
    generationStatus.id = 'freePromptGenerationStatus';
    generationStatus.setAttribute('role', 'status');
    dom.generateFreePromptBtnEl.closest('.row').after(generationStatus);
    dom.generateFreePromptBtnEl.addEventListener(
      "click",
      handleGenerateFreePromptClick,
    );
  }

  function bindCopyFreePromptHandler() {
    if (!dom.copyFreePromptBtnEl || !dom.freePromptPreviewEl) return;
    if (dom.copyFreePromptBtnEl.dataset.freePromptCopyBound === "1") return;
    dom.copyFreePromptBtnEl.dataset.freePromptCopyBound = "1";
    dom.copyFreePromptBtnEl.addEventListener("click", async () => {
      const previewText = dom.freePromptPreviewEl.textContent || "";
      if (!previewText.trim()) {
        globalObj.setFooterStatus?.(globalObj.UI_TEXT.nothingToCopy);
        return;
      }
      const copy = globalObj.copyToClipboard;
      const copyResult = await copy(previewText);
      if (!copyResult.ok) {
        globalObj.setFooterStatus?.(
          `${globalObj.UI_TEXT.copyFailedPrefix} ${globalObj.getErrorMessage(copyResult.error)}`,
        );
        return;
      }
      messageController.showFreePromptCopySuccessCheck?.(dom.copyFreePromptBtnEl);
      globalObj.setFooterStatus?.(globalObj.UI_TEXT.copiedToClipboard);
    });
  }

  function bindFreePromptEvents() {
    bindGenerateFreePromptClickHandler();
    bindCopyFreePromptHandler();
  }

  globalObj.PopupFreePromptController = Object.freeze({
    isGenerationPending: () => requestPending,
    bindFreePromptEvents,
    clearFreePromptPreview,
    getFreePromptLanguage,
    setFreePromptLanguage,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
