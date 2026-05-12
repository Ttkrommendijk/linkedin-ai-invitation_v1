// Owns lifecycle status derivation and lifecycle UI rendering helpers.
// Does not own DB calls, invite generation, or message generation logic.
(function initPopupLifecycleController(globalObj) {
  const statusConstants = globalObj.PopupStatusConstants;
  if (!statusConstants || typeof statusConstants !== "object") {
    throw new Error(
      "PopupStatusConstants must be loaded before popup-lifecycle-controller.js.",
    );
  }
  const popupDom = globalObj.PopupDom;
  if (!popupDom || typeof popupDom !== "object") {
    throw new Error("PopupDom must be loaded before popup-lifecycle-controller.js.");
  }
  const popupState = globalObj.PopupState;
  if (!popupState || typeof popupState !== "object") {
    throw new Error("PopupState must be loaded before popup-lifecycle-controller.js.");
  }
  function getLifecycleStatusValue(dbRow) {
    return (dbRow?.status || "").trim().toLowerCase();
  }

  function isPostSendMode() {
    const status = getLifecycleStatusValue(popupState.dbInvitationRow);
    return (
      status === statusConstants.firstMessageSent ||
      status === statusConstants.firstMessageSentSnake ||
      status === "message responded" ||
      status === "message_responded"
    );
  }

  function getOutreachStatusFromDbRow() {
    return statusConstants.accepted;
  }

  function deriveLifecycleState(row) {
    if (!row) {
      return { key: "not_in_database", text: UI_TEXT.lifecycleNotInDatabase };
    }

    const status = (row.status || "").trim().toLowerCase();
    if (status === statusConstants.generated) {
      return { key: "generated", text: UI_TEXT.lifecycleGenerated };
    }
    if (status === statusConstants.invited) {
      return { key: "invited", text: UI_TEXT.lifecycleInvited };
    }
    if (status === statusConstants.firstMessageSent) {
      return {
        key: "first_message_sent",
        text: UI_TEXT.lifecycleFirstMessageSent,
      };
    }
    if ((row.first_message || "").trim()) {
      return {
        key: "first_message_generated",
        text: UI_TEXT.lifecycleFirstMessageGenerated,
      };
    }
    if (status) {
      return { key: "neutral", text: row.status };
    }
    return { key: "neutral", text: UI_TEXT.lifecycleInDatabase };
  }

  function setLifecycleBar() {}

  function updateGenerateFirstMessageButtonLabel() {
    return;
  }

  function setMessageTabModeUi() {}

  function renderMessageTab(_status) {}

  function applyLifecycleUiState(dbRow, { preserveTabs = false } = {}) {
    const dom = popupDom;
    const state = popupState;
    const generateBtn = document.getElementById("generate");

    if (!generateBtn) return;
    updateGenerateFirstMessageButtonLabel();

    generateBtn.disabled = false;

    const status = getLifecycleStatusValue(dbRow);
    const dbMessage = (dbRow?.message || "").trim();
    if (dbMessage) {
      dom.previewEl.textContent = dbMessage;
      globalObj.updateInviteCopyIconVisibility?.();
    }

    if (status === statusConstants.generated) {
      if (!preserveTabs) {
        globalObj.setActiveTab?.("detail");
        globalObj.setDetailInnerTab?.("invite");
      }
      if (dbMessage) {
        dom.previewEl.textContent = dbMessage;
        globalObj.updateInviteCopyIconVisibility?.();
      }
      return;
    }

    if (status === statusConstants.invited) {
      if (!preserveTabs) {
        globalObj.setActiveTab?.("detail");
        globalObj.setDetailInnerTab?.("invite");
      }
      if (dbMessage) {
        dom.previewEl.textContent = dbMessage;
        globalObj.updateInviteCopyIconVisibility?.();
      }
      generateBtn.disabled = true;
      return;
    }

    if (
      status === statusConstants.firstMessageSent ||
      status === statusConstants.firstMessageSentSnake ||
      status === "message responded" ||
      status === "message_responded"
    ) {
      if (!preserveTabs) {
        globalObj.setActiveTab?.("detail");
        globalObj.setDetailInnerTab?.("first");
      }
      generateBtn.disabled = true;
      if (dbMessage) {
        dom.previewEl.textContent = dbMessage;
        globalObj.updateInviteCopyIconVisibility?.();
      }
    }

    globalObj.updateInviteCopyIconVisibility?.();

    if (
      status === statusConstants.firstMessageSent ||
      status === statusConstants.firstMessageSentSnake ||
      status === "message responded" ||
      status === "message_responded" ||
      status === statusConstants.accepted
    ) {
      const dbFirstMessage = (dbRow?.first_message || "").trim();
      if (dbFirstMessage) {
        dom.firstMessagePreviewEl.textContent = dbFirstMessage;
        state.firstMessage = dbFirstMessage;
      }
    }
  }

  globalObj.PopupLifecycleController = Object.freeze({
    getLifecycleStatusValue,
    isPostSendMode,
    getOutreachStatusFromDbRow,
    deriveLifecycleState,
    setLifecycleBar,
    applyLifecycleUiState,
    updateGenerateFirstMessageButtonLabel,
    renderMessageTab,
    setMessageTabModeUi,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
