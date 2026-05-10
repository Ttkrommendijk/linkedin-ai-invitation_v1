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

      let profileForGeneration = null;
      if (includeProfile) {
        const activeTab = await profileController.getActiveTabForProfileCheck?.().catch(() => null);
        const pageInfo = globalObj.detectLinkedInPageType(activeTab?.url || "");
        profileForGeneration = await profileController.getFreshScrapeForPage?.(pageInfo, {
          source: "free_prompt",
        });
        const linkedinUrl = globalObj.getLinkedinUrlFromContext(profileForGeneration);
        if (!profileForGeneration || !linkedinUrl) {
          globalObj.setFooterStatus?.(
            "Profile context is missing. Open a LinkedIn profile and try again.",
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
      if (!apiKey) {
        const typed = (dom.apiKeyEl?.value || "").trim();
        if (typed) {
          apiKey = typed;
          await chrome.storage.local.set({ apiKey });
        }
      }
      if (!apiKey) {
        globalObj.setFooterStatus?.(globalObj.UI_TEXT.setApiKeyInConfig);
        return;
      }

      const strategyCoreRaw = (dom.strategyEl?.value || "").trim();
      const payload = {
        apiKey,
        model: (model || "gpt-4.1").trim(),
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

      globalObj.setFooterStatus?.(globalObj.UI_TEXT.callingOpenAI);
      const send = utils.sendRuntimeMessage || globalObj.sendRuntimeMessage;
      const result = await send("GENERATE_FREE_PROMPT", {
        payload,
      });
      const resp = result.data || {};
      if (!result.ok || !resp?.ok) {
        throw new Error(globalObj.getErrorMessage(result.error || resp?.error));
      }

      const generatedText = (resp.text || "").trim();
      if (dom.freePromptPreviewEl) {
        dom.freePromptPreviewEl.textContent = generatedText;
      }
      messageController.updateFreePromptCopyButtonState?.();
      globalObj.setFooterStatus?.(
        generatedText ? "Ready" : globalObj.UI_TEXT.noMessageGenerated,
      );
    } catch (e) {
      if (dom.freePromptPreviewEl) {
        dom.freePromptPreviewEl.textContent = "";
      }
      messageController.updateFreePromptCopyButtonState?.();
      globalObj.setFooterStatus?.(
        `${globalObj.UI_TEXT.errorPrefix} ${globalObj.getErrorMessage(e)}`,
      );
    }
  }

  function bindGenerateFreePromptClickHandler() {
    if (!dom.generateFreePromptBtnEl) return;
    if (dom.generateFreePromptBtnEl.dataset.freePromptBound === "1") return;
    dom.generateFreePromptBtnEl.dataset.freePromptBound = "1";
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
    bindFreePromptEvents,
    clearFreePromptPreview,
    getFreePromptLanguage,
    setFreePromptLanguage,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
