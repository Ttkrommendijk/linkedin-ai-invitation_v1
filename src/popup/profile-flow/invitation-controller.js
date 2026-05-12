// Owns invitation generation and invitation lifecycle actions.
// Does not own first-message or follow-up generation.
(function initPopupInvitationController(globalObj) {
  const popupLogger = globalObj.PopupLogger;
  if (!popupLogger || typeof popupLogger !== "object") {
    throw new Error("PopupLogger must be loaded before popup-invitation-controller.js.");
  }
  const profileController = globalObj.PopupProfileController;
  if (!profileController || typeof profileController !== "object") {
    throw new Error(
      "PopupProfileController must be loaded before popup-invitation-controller.js.",
    );
  }
  const lifecycleController = globalObj.PopupLifecycleController;
  if (!lifecycleController || typeof lifecycleController !== "object") {
    throw new Error(
      "PopupLifecycleController must be loaded before popup-invitation-controller.js.",
    );
  }
  const messageTypes =
    globalObj.PopupMessageTypes;
  const storageKeys =
    globalObj.PopupStorageKeys;
  const statusConstants =
    globalObj.PopupStatusConstants;
  if (!messageTypes || !storageKeys || !statusConstants) {
    throw new Error("Popup shared constants must be loaded before popup modules.");
  }
  const dom = globalObj.PopupDom;
  if (!dom || typeof dom !== "object") {
    throw new Error("PopupDom must be loaded before popup-invitation-controller.js.");
  }
  const state = globalObj.PopupState;
  if (!state || typeof state !== "object") {
    throw new Error("PopupState must be loaded before popup-invitation-controller.js.");
  }

  let inviteCopyIconResetTimer = null;

  function setCopyButtonEnabled(enabled) {
    if (dom.copyInviteIconEl) {
      dom.copyInviteIconEl.hidden = !enabled;
      dom.copyInviteIconEl.disabled = !enabled;
    }
  }

  function setInviteSaveButtonEnabled(enabled) {
    if (dom.saveInviteBtnEl) {
      dom.saveInviteBtnEl.hidden = !enabled;
    }
  }

  function showInviteCopySuccessCheck() {
    if (!dom.copyInviteIconEl) return;
    globalObj.setCopyIconSuccessState(dom.copyInviteIconEl);
    if (inviteCopyIconResetTimer) {
      clearTimeout(inviteCopyIconResetTimer);
    }
    inviteCopyIconResetTimer = setTimeout(() => {
      if (dom.copyInviteIconEl) {
        globalObj.setCopyIconDefaultState(dom.copyInviteIconEl);
      }
      inviteCopyIconResetTimer = null;
    }, 900);
  }

  function updateInviteCopyIconVisibility() {
    const normalizedPreview =
      typeof globalObj.normalizeWhitespace === "function"
        ? globalObj.normalizeWhitespace(dom.previewEl.textContent || "")
        : String(dom.previewEl.textContent || "").trim();
    if (!normalizedPreview && dom.copyInviteIconEl) {
      globalObj.setCopyIconDefaultState(dom.copyInviteIconEl);
    }
    const hasPreview = Boolean(normalizedPreview);
    setCopyButtonEnabled(hasPreview);
    setInviteSaveButtonEnabled(hasPreview);
  }

  async function maybeAutocorrectLegacyMessageCount() {
    const linkedin_url = globalObj.getLinkedinUrlFromContext(state.currentProfileContext);
    if (!linkedin_url || !state.dbInvitationRow) return;
    if (
      !globalObj.isMessageSentOrBeyondStatus(
        lifecycleController.getLifecycleStatusValue(state.dbInvitationRow),
      )
    ) {
      return;
    }
    const currentCount = globalObj.getMessageCountValue(state.dbInvitationRow);
    if (currentCount > 0) return;
    if (globalObj.messageCountLegacyFixAttemptedUrl === linkedin_url) return;
    globalObj.messageCountLegacyFixAttemptedUrl = linkedin_url;
    const result = await globalObj.sendRuntimeMessage(messageTypes.DB_SET_MESSAGE_COUNT, {
      payload: { linkedin_url, message_count: 1 },
    });
    const resp = result.data || {};
    if (resp?.ok) {
      state.dbInvitationRow = { ...state.dbInvitationRow, message_count: 1 };
      return;
    }
    globalObj.setFooterStatus(
      `Could not correct message count: ${globalObj.getErrorMessage(resp?.error || result.error)}`,
    );
  }

  async function refreshInvitationRowFromDb({ preserveTabs = false } = {}) {
    if (globalObj.isCompanyProfileMode()) {
      await globalObj.refreshCompanyRowFromDb();
      return;
    }
    globalObj.setFooterFetchingStatus();
    const linkedin_url = globalObj.getLinkedinUrlFromContext(state.currentProfileContext);
    if (!linkedin_url) {
      state.dbInvitationRow = null;
      globalObj.hideCompanySuggestionUi();
      globalObj.setCampaignSelectValue("");
      globalObj.setCommunicationStatus(globalObj.UI_TEXT.lifecycleOpenLinkedInProfileFirst);
      globalObj.applyLifecycleUiState(state.dbInvitationRow, { preserveTabs });
      state.outreachMessageStatus = statusConstants.accepted;
      globalObj.renderMessageTab(state.outreachMessageStatus);
      globalObj.renderDetailHeader();
      globalObj.updatePhaseButtons();
      globalObj.setFooterReady();
      return;
    }

    try {
      const result = await globalObj.sendRuntimeMessage(messageTypes.DB_GET_INVITATION, {
        payload: { linkedin_url },
      });
      const resp = result.data || {};
      if (!result.ok) {
        state.dbInvitationRow = null;
        globalObj.hideCompanySuggestionUi();
        globalObj.setCommunicationStatus(globalObj.getErrorMessage(result.error));
        globalObj.applyLifecycleUiState(state.dbInvitationRow, { preserveTabs });
        state.outreachMessageStatus = statusConstants.accepted;
        globalObj.renderMessageTab(state.outreachMessageStatus);
        globalObj.renderDetailHeader();
        globalObj.updatePhaseButtons();
        return;
      }

      state.dbInvitationRow = resp.row || null;
      await maybeAutocorrectLegacyMessageCount();
      await globalObj.applyCampaignSelectionFromProfile();
      await globalObj.setLanguage(
        state.dbInvitationRow?.language ||
          state.currentProfileContext?.language ||
          globalObj.getLanguage(),
        { persist: false },
      );
      globalObj.debug("DB invitation row fetched:", {
        has_row: Boolean(state.dbInvitationRow),
        message_length: (state.dbInvitationRow?.message || "").length,
      });
      globalObj.applyLifecycleUiState(state.dbInvitationRow, { preserveTabs });
      state.outreachMessageStatus = lifecycleController.getOutreachStatusFromDbRow();
      if (state.outreachMessageStatus === "first_message_sent") {
        await chrome.storage.local.set({ message_status: "first_message_sent" });
      }
      globalObj.renderMessageTab(state.outreachMessageStatus);
      globalObj.updateMessageTabControls();
      globalObj.renderDetailHeader();
      await globalObj.refreshPersonCampaignLinks();
      await globalObj.refreshNotes?.({ force: true });
      await globalObj.refreshCompanySuggestionUiForCurrentInvitation();
      globalObj.updatePhaseButtons();
    } finally {
      globalObj.setFooterReady();
    }
  }

  async function upsertCurrentProfileWithStatus(_statusValue) {
    if (!state.currentProfileContext) return { ok: false, error: "missing_profile" };
    const linkedinUrl = globalObj.getLinkedinUrlFromContext(state.currentProfileContext);
    if (!linkedinUrl) return { ok: false, error: "missing_url" };
    const message = (dom.previewEl.textContent || "").trim();
    await Promise.all([
      chrome.storage.sync.get([storageKeys.model, "positioning", "strategyCore"]),
    ]);
    const result = await globalObj.sendRuntimeMessage(messageTypes.DB_UPSERT_GENERATED, {
      payload: {
        linkedin_url: linkedinUrl,
        language: globalObj.getLanguage(),
        message,
        generated_at: new Date().toISOString(),
      },
    });
    return result.data || {};
  }

  async function generateInvite() {
    globalObj.setFooterLlmStatus();
    try {
      dom.previewEl.textContent = "";
      updateInviteCopyIconVisibility();

      const [{ [storageKeys.apiKey]: apiKeyLocal }, { model, positioning, strategyCore }] =
        await Promise.all([
          chrome.storage.local.get([storageKeys.apiKey]),
          chrome.storage.sync.get([storageKeys.model, "positioning", "strategyCore"]),
        ]);

      let apiKey = (apiKeyLocal || "").trim();
      if (!apiKey) {
        const typed = (dom.apiKeyEl.value || "").trim();
        if (typed) {
          apiKey = typed;
          await chrome.storage.local.set({ [storageKeys.apiKey]: apiKey });
        }
      }
      if (!apiKey) {
        globalObj.setFooterStatus(globalObj.UI_TEXT.setApiKeyInConfig);
        return;
      }

      const activeTab = await profileController
        .getActiveTabForProfileCheck()
        .catch(() => null);
      const pageInfo = globalObj.detectLinkedInPageType(activeTab?.url || "");
      if (pageInfo.page_type !== "person") {
        throw new Error("Active page is not a LinkedIn person profile.");
      }
      const profileContext = await profileController.getFreshScrapeForPage(pageInfo, {
        source: "invite",
      });
      state.currentProfileContext = profileContext;
      state.lastProfileContextSent = profileContext;
      state.lastProfileContextEnriched = null;
      globalObj.renderDetailHeader();

      const result = await globalObj.sendRuntimeMessage(messageTypes.GENERATE_INVITE, {
        payload: {
          apiKey,
          model: (model || "gpt-4.1").trim(),
          positioning: positioning || "",
          focus: (dom.focusEl?.value || "").trim(),
          language: globalObj.getLanguage(),
          strategyCore: strategyCore || "",
          profile: { ...profileContext },
        },
      });
      const resp = result.data || {};

      if (!result.ok || !resp?.ok) {
        throw new Error(globalObj.getErrorMessage(result.error || resp?.error));
      }

      dom.previewEl.textContent = (resp.invite_text || "").trim();
      updateInviteCopyIconVisibility();
      globalObj.setFooterStatus(
        dom.previewEl.textContent
          ? globalObj.UI_TEXT.generatedClickCopy
          : globalObj.UI_TEXT.noMessageGenerated,
      );
    } catch (e) {
      popupLogger.error("[invite] generate failed", e);
      globalObj.setFooterStatus(`${globalObj.UI_TEXT.errorPrefix} ${globalObj.getErrorMessage(e)}`);
    } finally {
      globalObj.setFooterReady();
    }
  }

  async function handleSaveInviteClick() {
    globalObj.setFooterDbStatus();
    try {
      const resp = await upsertCurrentProfileWithStatus(statusConstants.generated);
      if (!resp?.ok) {
        globalObj.setFooterStatus(
          `${globalObj.UI_TEXT.dbErrorPrefix} ${globalObj.getErrorMessage(resp?.error)}`,
        );
        return;
      }
      globalObj.setFooterStatus("Saved.");
      await refreshInvitationRowFromDb();
    } finally {
      globalObj.setFooterReady();
    }
  }

  async function saveInvite() {
    return handleSaveInviteClick();
  }

  async function markInvited() {
    globalObj.setFooterDbStatus();
    let footerHandled = false;
    try {
      const linkedin_url = globalObj.getLinkedinUrlFromContext(state.currentProfileContext);
      if (!linkedin_url) {
        globalObj.setFooterStatus(globalObj.UI_TEXT.openLinkedInProfileFirst);
        footerHandled = true;
        return { ok: false };
      }
      const result = await globalObj.sendRuntimeMessage(messageTypes.DB_MARK_STATUS, {
        payload: { linkedin_url, status: statusConstants.invited },
      });
      const resp = result.data || {};
      globalObj.setFooterStatus(
        resp?.ok
          ? globalObj.UI_TEXT.markedInvited
          : `${globalObj.UI_TEXT.dbErrorPrefix} ${globalObj.getErrorMessage(resp?.error)}`,
      );
      if (resp?.ok) {
        await refreshInvitationRowFromDb({ preserveTabs: true });
        globalObj.setFooterStatus("Successfully set status invited");
        footerHandled = true;
        return { ok: true };
      }
      footerHandled = true;
      return { ok: false };
    } finally {
      if (!footerHandled) globalObj.setFooterReady();
    }
  }

  async function markAccepted() {
    let footerHandled = false;
    globalObj.setFooterDbStatus();
    try {
      const linkedin_url = globalObj.getLinkedinUrlFromContext(state.currentProfileContext);
      if (!linkedin_url) {
        globalObj.setFooterStatus(globalObj.UI_TEXT.openLinkedInProfileFirst);
        footerHandled = true;
        return;
      }
      const hasAccepted = globalObj.isAcceptedRow(state.dbInvitationRow);
      const messageType = hasAccepted
        ? messageTypes.DB_CLEAR_ACCEPTED_AT
        : messageTypes.DB_SET_ACCEPTED_AT_NOW;
      const result = await globalObj.sendRuntimeMessage(messageType, {
        payload: { linkedin_url },
      });
      const resp = result.data || {};
      const successText = hasAccepted ? "Accepted cleared" : "Marked as accepted";
      globalObj.setFooterStatus(
        resp?.ok
          ? successText
          : `${globalObj.UI_TEXT.dbErrorPrefix} ${globalObj.getErrorMessage(resp?.error)}`,
      );
      if (resp?.ok) {
        await refreshInvitationRowFromDb({ preserveTabs: true });
        await globalObj.refreshOverviewListContextSnapshot();
        footerHandled = true;
      } else {
        footerHandled = true;
      }
    } finally {
      if (!footerHandled) globalObj.setFooterReady();
    }
  }

  function bindInvitationEvents() {
    const generateInviteBtnEl = document.getElementById("generate");
    if (generateInviteBtnEl && generateInviteBtnEl.dataset.generateInviteBound !== "1") {
      generateInviteBtnEl.dataset.generateInviteBound = "1";
      generateInviteBtnEl.addEventListener("click", generateInvite);
    }

    if (dom.saveInviteBtnEl && dom.saveInviteBtnEl.dataset.saveBound !== "1") {
      dom.saveInviteBtnEl.dataset.saveBound = "1";
      dom.saveInviteBtnEl.addEventListener("click", handleSaveInviteClick);
    }

    if (dom.copyInviteIconEl && dom.copyInviteIconEl.dataset.copyBound !== "1") {
      dom.copyInviteIconEl.dataset.copyBound = "1";
      dom.copyInviteIconEl.addEventListener("click", async () => {
        const copyResult = await globalObj.copyToClipboard(dom.previewEl.textContent || "");
        if (copyResult.ok) {
          showInviteCopySuccessCheck();
          globalObj.setFooterStatus(globalObj.UI_TEXT.copiedToClipboard);
        } else {
          globalObj.setFooterStatus(
            `${globalObj.UI_TEXT.copyFailedPrefix} ${globalObj.getErrorMessage(copyResult.error)}`,
          );
        }
      });
    }
  }

  globalObj.PopupInvitationController = Object.freeze({
    bindInvitationEvents,
    generateInvite,
    saveInvite,
    markInvited,
    markAccepted,
    refreshInvitationRowFromDb,
    setCopyButtonEnabled,
    updateInviteCopyIconVisibility,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
