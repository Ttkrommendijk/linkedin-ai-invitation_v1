// Owns message-tab interaction helpers and message UI state transitions.
// Does not own invitation lifecycle or profile scraping/loading.
(function initPopupMessageController(globalObj) {
  const popupDom = globalObj.PopupDom;
  if (!popupDom || typeof popupDom !== "object") {
    throw new Error("PopupDom must be loaded before popup-message-controller.js.");
  }
  const COPY_ICON_GLYPH = "\u29c9";
  const COPY_TOOLTIP_DEFAULT = "Copy to clipboard";
  const COPY_TOOLTIP_SUCCESS = "Copied";

  let firstMessageCopyIconResetTimer = null;
  let followupCopyIconResetTimer = null;
  let freePromptCopyIconResetTimer = null;

  function getDom() {
    return popupDom;
  }

  function setCopyIconDefaultState(buttonEl) {
    if (!buttonEl) return;
    buttonEl.textContent = COPY_ICON_GLYPH;
    buttonEl.title = COPY_TOOLTIP_DEFAULT;
    buttonEl.setAttribute("aria-label", COPY_TOOLTIP_DEFAULT);
  }

  function setCopyIconSuccessState(buttonEl) {
    if (!buttonEl) return;
    buttonEl.textContent = "\u2713";
    buttonEl.title = COPY_TOOLTIP_SUCCESS;
    buttonEl.setAttribute("aria-label", COPY_TOOLTIP_SUCCESS);
  }

  function showFirstMessageCopySuccessCheck(buttonEl) {
    const dom = getDom();
    const btn = buttonEl || dom.copyFirstMessageBtnEl;
    if (!btn) return;
    setCopyIconSuccessState(btn);
    if (firstMessageCopyIconResetTimer) {
      clearTimeout(firstMessageCopyIconResetTimer);
    }
    firstMessageCopyIconResetTimer = setTimeout(() => {
      if (btn) setCopyIconDefaultState(btn);
      firstMessageCopyIconResetTimer = null;
    }, 800);
  }

  function showFollowupCopySuccessCheck(buttonEl) {
    const dom = getDom();
    const btn = buttonEl || dom.copyFollowupBtnEl;
    if (!btn) return;
    setCopyIconSuccessState(btn);
    if (followupCopyIconResetTimer) {
      clearTimeout(followupCopyIconResetTimer);
    }
    followupCopyIconResetTimer = setTimeout(() => {
      if (btn) setCopyIconDefaultState(btn);
      followupCopyIconResetTimer = null;
    }, 800);
  }

  function showFreePromptCopySuccessCheck(buttonEl) {
    const dom = getDom();
    const btn = buttonEl || dom.copyFreePromptBtnEl;
    if (!btn) return;
    setCopyIconSuccessState(btn);
    if (freePromptCopyIconResetTimer) {
      clearTimeout(freePromptCopyIconResetTimer);
    }
    freePromptCopyIconResetTimer = setTimeout(() => {
      if (btn) setCopyIconDefaultState(btn);
      freePromptCopyIconResetTimer = null;
    }, 800);
  }

  function updateFollowupCopyIconVisibility() {
    const dom = getDom();
    if (!dom.copyFollowupBtnEl || !dom.followupPreviewEl) return;
    const hasText = (dom.followupPreviewEl.value || "").trim().length > 0;
    if (!hasText) {
      setCopyIconDefaultState(dom.copyFollowupBtnEl);
    }
    dom.copyFollowupBtnEl.hidden = !hasText;
    dom.copyFollowupBtnEl.disabled = !hasText;
  }

  function updateFreePromptCopyButtonState() {
    const dom = getDom();
    if (!dom.copyFreePromptBtnEl || !dom.freePromptPreviewEl) return;
    const hasText = (dom.freePromptPreviewEl.textContent || "").trim().length > 0;
    if (!hasText) {
      setCopyIconDefaultState(dom.copyFreePromptBtnEl);
    }
    dom.copyFreePromptBtnEl.hidden = !hasText;
    dom.copyFreePromptBtnEl.disabled = !hasText;
  }

  function updateFirstMessageCopyIconVisibility() {}

  function updateFirstMessageSaveIconVisibility() {}

  function updateMessageTabControls() {}

  async function refreshMessagesTab() {
    return false;
  }

  async function onMessagesTabOpenedByUser() {
    return false;
  }

  globalObj.PopupMessageController = Object.freeze({
    setCopyIconDefaultState,
    setCopyIconSuccessState,
    showFirstMessageCopySuccessCheck,
    showFollowupCopySuccessCheck,
    showFreePromptCopySuccessCheck,
    updateFollowupCopyIconVisibility,
    updateFreePromptCopyButtonState,
    updateFirstMessageCopyIconVisibility,
    updateFirstMessageSaveIconVisibility,
    updateMessageTabControls,
    refreshMessagesTab,
    onMessagesTabOpenedByUser,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
