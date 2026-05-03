function initPersonModule(deps = {}) {
Object.assign(globalThis, deps);
function applyLifecycleUiState(dbRow, { preserveTabs = false } = {}) {
  const generateBtn = document.getElementById("generate");

  if (!generateBtn) return;
  updateGenerateFirstMessageButtonLabel();

  generateBtn.disabled = false;

  const status = getLifecycleStatusValue(dbRow);
  const dbMessage = (dbRow?.message || "").trim();
  if (dbMessage) {
    previewEl.textContent = dbMessage;
    updateInviteCopyIconVisibility();
  }

  if (status === "generated") {
    if (!preserveTabs) {
      setActiveTab("detail");
      setDetailInnerTab("invite");
    }
    if (dbMessage) {
      previewEl.textContent = dbMessage;
      updateInviteCopyIconVisibility();
    }
    return;
  }

  if (status === "invited") {
    if (!preserveTabs) {
      setActiveTab("detail");
      setDetailInnerTab("invite");
    }
    if (dbMessage) {
      previewEl.textContent = dbMessage;
      updateInviteCopyIconVisibility();
    }
    generateBtn.disabled = true;
    return;
  }

  if (
    status === "first message sent" ||
    status === "first_message_sent" ||
    status === "message responded" ||
    status === "message_responded"
  ) {
    if (!preserveTabs) {
      setActiveTab("detail");
      setDetailInnerTab("first");
    }
    generateBtn.disabled = true;
    if (dbMessage) {
      previewEl.textContent = dbMessage;
      updateInviteCopyIconVisibility();
    }
  }

  updateInviteCopyIconVisibility();

  if (
    status === "first message sent" ||
    status === "first_message_sent" ||
    status === "message responded" ||
    status === "message_responded" ||
    status === "accepted"
  ) {
    const dbFirstMessage = (dbRow?.first_message || "").trim();
    if (dbFirstMessage) {
      firstMessagePreviewEl.textContent = dbFirstMessage;
      firstMessage = dbFirstMessage;
    }
  }
}

function deriveLifecycleState(row) {
  if (!row) {
    return { key: "not_in_database", text: UI_TEXT.lifecycleNotInDatabase };
  }

  const status = (row.status || "").trim().toLowerCase();
  if (status === "generated") {
    return { key: "generated", text: UI_TEXT.lifecycleGenerated };
  }
  if (status === "invited") {
    return { key: "invited", text: UI_TEXT.lifecycleInvited };
  }
  if (status === "first message sent") {
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

async function refreshInvitationRowFromDb({ preserveTabs = false } = {}) {
  if (isCompanyProfileMode()) {
    await refreshCompanyRowFromDb();
    return;
  }
  setFooterFetchingStatus();
  const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedin_url) {
    dbInvitationRow = null;
    hideCompanySuggestionUi();
    setCampaignSelectValue("");
    setCommunicationStatus(UI_TEXT.lifecycleOpenLinkedInProfileFirst);
    applyLifecycleUiState(dbInvitationRow, { preserveTabs });
    outreachMessageStatus = "accepted";
    renderMessageTab(outreachMessageStatus);
    renderDetailHeader();
    updatePhaseButtons();
    setFooterReady();
    return;
  }

  try {
    const result = await sendRuntimeMessage("DB_GET_INVITATION", {
      payload: { linkedin_url },
    });
    const resp = result.data || {};
    if (!result.ok) {
      dbInvitationRow = null;
      hideCompanySuggestionUi();
      setCommunicationStatus(getErrorMessage(result.error));
      applyLifecycleUiState(dbInvitationRow, { preserveTabs });
      outreachMessageStatus = "accepted";
      renderMessageTab(outreachMessageStatus);
      renderDetailHeader();
      updatePhaseButtons();
      return;
    }

    dbInvitationRow = resp.row || null;
    await maybeAutocorrectLegacyMessageCount();
    await applyCampaignSelectionFromProfile();
    await setLanguage(
      dbInvitationRow?.language ||
        currentProfileContext?.language ||
        getLanguage(),
      { persist: false },
    );
    debug("DB invitation row fetched:", {
      has_row: Boolean(dbInvitationRow),
      message_length: (dbInvitationRow?.message || "").length,
    });
    applyLifecycleUiState(dbInvitationRow, { preserveTabs });
    outreachMessageStatus = getOutreachStatusFromDbRow();
    if (outreachMessageStatus === "first_message_sent") {
      await chrome.storage.local.set({ message_status: "first_message_sent" });
    }
    renderMessageTab(outreachMessageStatus);
    updateMessageTabControls();
    renderDetailHeader();
    await refreshPersonCampaignLinks();
    await refreshCompanySuggestionUiForCurrentInvitation();
    updatePhaseButtons();
  } finally {
    setFooterReady();
  }
}

async function maybeAutocorrectLegacyMessageCount() {
  const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedin_url || !dbInvitationRow) return;
  if (!isMessageSentOrBeyondStatus(getLifecycleStatusValue(dbInvitationRow))) {
    return;
  }
  const currentCount = getMessageCountValue(dbInvitationRow);
  if (currentCount > 0) return;
  if (messageCountLegacyFixAttemptedUrl === linkedin_url) return;
  messageCountLegacyFixAttemptedUrl = linkedin_url;
  const result = await sendRuntimeMessage("DB_SET_MESSAGE_COUNT", {
    payload: { linkedin_url, message_count: 1 },
  });
  const resp = result.data || {};
  if (resp?.ok) {
    dbInvitationRow = { ...dbInvitationRow, message_count: 1 };
    return;
  }
  setFooterStatus(
    `Could not correct message count: ${getErrorMessage(resp?.error || result.error)}`,
  );
}

function hasMessageProfileUrl() {
  return Boolean(getLinkedinUrlFromContext(currentProfileContext));
}

function setCopyButtonEnabled(enabled) {
  if (copyInviteIconEl) {
    copyInviteIconEl.hidden = !enabled;
    copyInviteIconEl.disabled = !enabled;
  }
}

function setInviteSaveButtonEnabled(enabled) {
  if (saveInviteBtnEl) {
    saveInviteBtnEl.hidden = !enabled;
  }
}

function showInviteCopySuccessCheck() {
  if (!copyInviteIconEl) return;
  setCopyIconSuccessState(copyInviteIconEl);
  if (inviteCopyIconResetTimer) {
    clearTimeout(inviteCopyIconResetTimer);
  }
  inviteCopyIconResetTimer = setTimeout(() => {
    if (copyInviteIconEl) {
      setCopyIconDefaultState(copyInviteIconEl);
    }
    inviteCopyIconResetTimer = null;
  }, 900);
}

function updateInviteCopyIconVisibility() {
  const normalizedPreview =
    typeof normalizeWhitespace === "function"
      ? normalizeWhitespace(previewEl.textContent || "")
      : String(previewEl.textContent || "").trim();
  if (!normalizedPreview && copyInviteIconEl) {
    setCopyIconDefaultState(copyInviteIconEl);
  }
  const hasPreview = Boolean(normalizedPreview);
  setCopyButtonEnabled(hasPreview);
  setInviteSaveButtonEnabled(hasPreview);
}

async function onInvitationTabOpenedByUser() {
  setFooterStatus(UI_TEXT.preparingProfile);
  await loadProfileContextOnOpen();
}

async function upsertCurrentProfileWithStatus(statusValue) {
  if (!currentProfileContext) return { ok: false, error: "missing_profile" };
  const linkedinUrl = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedinUrl) return { ok: false, error: "missing_url" };
  const message = (previewEl.textContent || "").trim();
  const [{ model, positioning, strategyCore }] = await Promise.all([
    chrome.storage.sync.get(["model", "positioning", "strategyCore"]),
  ]);
  const result = await sendRuntimeMessage("DB_UPSERT_GENERATED", {
    payload: {
      linkedin_url: linkedinUrl,
      language: getLanguage(),
      message,
      generated_at: new Date().toISOString(),
    },
  });
  return result.data || {};
}

async function onStepRegisterClick() {
  const activeTabsBeforeRegister = captureActiveTabState();
  let footerHandled = false;
  setFooterLlmStatus();
  const campaignIdForRegister = safeTrim(campaignSelectEl?.value || "");
  try {
    const activeTab = await getActiveTabForProfileCheck().catch(() => null);
    const pageInfo = detectLinkedInPageType(activeTab?.url || "");
    if (pageInfo.page_type !== "person") {
      throw new Error("Active page is not a LinkedIn person profile.");
    }
    const profileContext = await getFreshScrapeForPage(pageInfo, {
      source: "register_click",
    });
    const extracted = await extractProfileDetailsFromLlm(profileContext);
    setFooterDbStatus();
    const result = await sendRuntimeMessage("DB_UPSERT_GENERATED", {
      payload: {
        linkedin_url: extracted.linkedin_url,
        full_name: extracted.full_name || null,
        company: extracted.company || null,
        headline: extracted.headline || null,
        language: extracted.language || getLanguage(),
        status: "registered",
        campaign: null,
      },
    });
    const resp = result.data || {};
    setFooterStatus(
      resp?.ok
        ? "Registered"
        : `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`,
    );
    if (resp?.ok) {
      await refreshInvitationRowFromDb({ preserveTabs: true });
      const personId = safeTrim(dbInvitationRow?.id);
      if (campaignIdForRegister && personId) {
        const linkResult = await sendRuntimeMessage("DB_LINK_PERSON_CAMPAIGN", {
          payload: {
            person_id: personId,
            campaign_id: campaignIdForRegister,
          },
        });
        if (!linkResult.ok) {
          throw new Error(getErrorMessage(linkResult.error));
        }
        await refreshPersonCampaignLinks();
      }
      setFooterStatus("Successfully set status registered");
      footerHandled = true;
    } else {
      setFooterStatus(
        `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`,
      );
      footerHandled = true;
    }
  } catch (e) {
    setFooterStatus(`${UI_TEXT.errorPrefix} ${getErrorMessage(e)}`);
    footerHandled = true;
  } finally {
    restoreActiveTabState(activeTabsBeforeRegister);
    if (!footerHandled) setFooterReady();
  }
}

async function onStepInvitedClick() {
  await setMarkedStatusForStepper("invited", UI_TEXT.markedInvited);
}

async function onStepAcceptedClick() {
  await setAcceptedToggleForStepper();
}

async function onStepFirstMessageSentClick() {
  if (isMarkingMessageSent) return;
  isMarkingMessageSent = true;
  let footerHandled = false;
  setFooterDbStatus();
  try {
    const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
    if (!linkedin_url) {
      setFooterStatus(UI_TEXT.openLinkedInProfileFirst);
      footerHandled = true;
      return;
    }
    const result = await sendRuntimeMessage("DB_MARK_FIRST_MESSAGE_SENT", {
      payload: { linkedin_url },
    });
    const resp = result.data || {};
    if (resp?.ok) {
      await refreshInvitationRowFromDb({ preserveTabs: true });
      setFooterStatus("Successfully set status first message sent");
      footerHandled = true;
    } else {
      setFooterStatus(
        `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error || result.error)}`,
      );
      footerHandled = true;
    }
  } finally {
    isMarkingMessageSent = false;
    if (!footerHandled) setFooterReady();
  }
}

async function onStepMessageRespondedClick() {
  await setStatusOnlyForStepper(
    "message responded",
    "Marked as message responded",
  );
}

async function setStatusOnlyForStepper(statusValue, successText) {
  let footerHandled = false;
  setFooterDbStatus();
  try {
    const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
    if (!linkedin_url) {
      setFooterStatus(UI_TEXT.openLinkedInProfileFirst);
      footerHandled = true;
      return { ok: false };
    }
    const payloadStatus =
      statusValue === "message responded" ? "message responded" : statusValue;
    const result = await sendRuntimeMessage("DB_SET_STATUS_ONLY", {
      payload: { linkedin_url, status: payloadStatus },
    });
    const resp = result.data || {};
    setFooterStatus(
      resp?.ok
        ? successText
        : `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`,
    );
    if (resp?.ok) {
      await refreshInvitationRowFromDb();
      setFooterStatus(`Successfully set status ${payloadStatus}`);
      footerHandled = true;
      return { ok: true };
    } else {
      setFooterStatus(
        `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`,
      );
      footerHandled = true;
      return { ok: false };
    }
  } finally {
    if (!footerHandled) setFooterReady();
  }
  return { ok: false };
}

async function setMarkedStatusForStepper(statusValue, successText) {
  let footerHandled = false;
  setFooterDbStatus();
  try {
    const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
    if (!linkedin_url) {
      setFooterStatus(UI_TEXT.openLinkedInProfileFirst);
      footerHandled = true;
      return { ok: false };
    }
    const result = await sendRuntimeMessage("DB_MARK_STATUS", {
      payload: { linkedin_url, status: statusValue },
    });
    const resp = result.data || {};
    setFooterStatus(
      resp?.ok
        ? successText
        : `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`,
    );
    if (resp?.ok) {
      await refreshInvitationRowFromDb({ preserveTabs: true });
      setFooterStatus(`Successfully set status ${statusValue}`);
      footerHandled = true;
      return { ok: true };
    } else {
      setFooterStatus(
        `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`,
      );
      footerHandled = true;
      return { ok: false };
    }
  } finally {
    if (!footerHandled) setFooterReady();
  }
  return { ok: false };
}

async function setAcceptedToggleForStepper() {
  let footerHandled = false;
  setFooterDbStatus();
  try {
    const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
    if (!linkedin_url) {
      setFooterStatus(UI_TEXT.openLinkedInProfileFirst);
      footerHandled = true;
      return;
    }
    const hasAccepted = isAcceptedRow(dbInvitationRow);
    const messageType = hasAccepted
      ? "DB_CLEAR_ACCEPTED_AT"
      : "DB_SET_ACCEPTED_AT_NOW";
    const result = await sendRuntimeMessage(messageType, {
      payload: { linkedin_url },
    });
    const resp = result.data || {};
    const successText = hasAccepted ? "Accepted cleared" : "Marked as accepted";
    setFooterStatus(
      resp?.ok
        ? successText
        : `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`,
    );
    if (resp?.ok) {
      await refreshInvitationRowFromDb({ preserveTabs: true });
      await refreshOverviewListContextSnapshot();
      footerHandled = true;
    } else {
      setFooterStatus(
        `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`,
      );
      footerHandled = true;
    }
  } finally {
    if (!footerHandled) setFooterReady();
  }
}

async function adjustMessageCountForCurrentProfile(delta) {
  const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedin_url) {
    setFooterStatus(UI_TEXT.openLinkedInProfileFirst);
    return false;
  }
  const result = await sendRuntimeMessage("DB_INCREMENT_MESSAGE_COUNT", {
    payload: { linkedin_url, delta },
  });
  const resp = result.data || {};
  if (!resp?.ok) {
    setFooterStatus(
      `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error || result.error)}`,
    );
    return false;
  }
  await refreshInvitationRowFromDb({ preserveTabs: true });
  await refreshOverviewListContextSnapshot();
  return true;
}

async function setMessageCountForCurrentProfile(message_count) {
  const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedin_url) {
    setFooterStatus(UI_TEXT.openLinkedInProfileFirst);
    return false;
  }
  const result = await sendRuntimeMessage("DB_SET_MESSAGE_COUNT", {
    payload: { linkedin_url, message_count },
  });
  const resp = result.data || {};
  if (!resp?.ok) {
    setFooterStatus(
      `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error || result.error)}`,
    );
    await refreshInvitationRowFromDb({ preserveTabs: true });
    return false;
  }
  await refreshInvitationRowFromDb({ preserveTabs: true });
  await refreshOverviewListContextSnapshot();
  return true;
}

function bindStepperClickHandlers() {
  if (!statusStepperEl) return;
  if (statusStepperEl.dataset.stepperBound === "1") return;
  statusStepperEl.dataset.stepperBound = "1";
  statusStepperEl.addEventListener("click", async (event) => {
    const targetEl =
      event.target instanceof Element
        ? event.target.closest(".status-step")
        : null;
    if (!targetEl) return;
    const stepKey = targetEl.getAttribute("data-step") || "";
    if (!stepKey || !stepperAllowedActions[stepKey]) return;

    if (stepperForwardSteps.has(stepKey)) {
      if (stepKey === "registered") {
        await onStepRegisterClick();
        return;
      }
      if (stepKey === "invited") {
        await onStepInvitedClick();
        return;
      }
      if (stepKey === "accepted") {
        await onStepAcceptedClick();
        return;
      }
      if (stepKey === "first_message_sent") {
        await onStepFirstMessageSentClick();
        return;
      }
      if (stepKey === "message_responded") {
        await onStepMessageRespondedClick();
      }
      return;
    }

    if (stepKey === stepperBackTarget) {
      if (stepperBackAction === "status_registered") {
        await setStatusOnlyForStepper("registered", "Back to registered");
        return;
      }
      if (stepperBackAction === "status_invited") {
        const backResult = await setStatusOnlyForStepper(
          "invited",
          "Back to invited",
        );
        if (backResult?.ok) {
          await setMessageCountForCurrentProfile(0);
        }
        return;
      }
      if (stepperBackAction === "status_first_message_sent") {
        await setStatusOnlyForStepper(
          "first message sent",
          "Back to first message sent",
        );
        return;
      }
      if (stepperBackAction === "clear_accepted") {
        await onStepAcceptedClick();
      }
    }

    if (stepKey === "accepted") {
      await onStepAcceptedClick();
    }
  });
}

async function handleSaveInviteClick() {
  setFooterDbStatus();
  try {
    const resp = await upsertCurrentProfileWithStatus("generated");
    if (!resp?.ok) {
      setFooterStatus(
        `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`,
      );
      return;
    }
    setFooterStatus("Saved.");
    await refreshInvitationRowFromDb();
  } finally {
    setFooterReady();
  }
}

function bindSaveInviteClickHandler() {
  if (!saveInviteBtnEl) return;
  if (saveInviteBtnEl.dataset.saveBound === "1") return;
  saveInviteBtnEl.dataset.saveBound = "1";
  saveInviteBtnEl.addEventListener("click", handleSaveInviteClick);
}

async function handleGenerateInviteClick() {
  setFooterLlmStatus();
  try {
    previewEl.textContent = "";
    updateInviteCopyIconVisibility();

    const [{ apiKey: apiKeyLocal }, { model, positioning, strategyCore }] =
      await Promise.all([
        chrome.storage.local.get(["apiKey"]),
        chrome.storage.sync.get(["model", "positioning", "strategyCore"]),
      ]);

    let apiKey = (apiKeyLocal || "").trim();
    if (!apiKey) {
      const typed = (apiKeyEl.value || "").trim();
      if (typed) {
        apiKey = typed;
        await chrome.storage.local.set({ apiKey });
      }
    }
    if (!apiKey) {
      setFooterStatus(UI_TEXT.setApiKeyInConfig);
      return;
    }

    const activeTab = await getActiveTabForProfileCheck().catch(() => null);
    const pageInfo = detectLinkedInPageType(activeTab?.url || "");
    if (pageInfo.page_type !== "person") {
      throw new Error("Active page is not a LinkedIn person profile.");
    }
    const profileContext = await getFreshScrapeForPage(pageInfo, {
      source: "invite",
    });
    currentProfileContext = profileContext;
    lastProfileContextSent = profileContext;
    lastProfileContextEnriched = null;
    renderDetailHeader();

    const result = await sendRuntimeMessage("GENERATE_INVITE", {
      // prompt: buildInviteTextPrompt (Generate invite button)
      payload: {
        apiKey,
        model: (model || "gpt-4.1").trim(),
        positioning: positioning || "",
        focus: (focusEl?.value || "").trim(),
        language: getLanguage(),
        strategyCore: strategyCore || "",
        profile: { ...profileContext },
      },
    });
    const resp = result.data || {};

    if (!result.ok || !resp?.ok) {
      throw new Error(getErrorMessage(result.error || resp?.error));
    }

    previewEl.textContent = (resp.invite_text || "").trim();
    updateInviteCopyIconVisibility();
    setFooterStatus(
      previewEl.textContent
        ? UI_TEXT.generatedClickCopy
        : UI_TEXT.noMessageGenerated,
    );
  } catch (e) {
    console.error("[invite] generate failed", e);
    setFooterStatus(`${UI_TEXT.errorPrefix} ${getErrorMessage(e)}`);
  } finally {
    setFooterReady();
  }
}

function bindGenerateInviteClickHandler() {
  const generateInviteBtnEl = document.getElementById("generate");
  if (!generateInviteBtnEl) return;
  if (generateInviteBtnEl.dataset.generateInviteBound === "1") return;
  generateInviteBtnEl.dataset.generateInviteBound = "1";
  generateInviteBtnEl.addEventListener("click", handleGenerateInviteClick);
}

function bindInviteCopyClickHandler() {
  if (!copyInviteIconEl) return;
  if (copyInviteIconEl.dataset.copyBound === "1") return;
  copyInviteIconEl.dataset.copyBound = "1";
  copyInviteIconEl.addEventListener("click", async () => {
    const copyResult = await copyToClipboard(previewEl.textContent || "");
    if (copyResult.ok) {
      showInviteCopySuccessCheck();
      setFooterStatus(UI_TEXT.copiedToClipboard);
    } else {
      setFooterStatus(
        `${UI_TEXT.copyFailedPrefix} ${getErrorMessage(copyResult.error)}`,
      );
    }
  });
}

function bindPersonWorkflowEvents() {
  return;
}

  return {
    applyLifecycleUiState,
    deriveLifecycleState,
    refreshInvitationRowFromDb,
    maybeAutocorrectLegacyMessageCount,
    hasMessageProfileUrl,
    setCopyButtonEnabled,
    setInviteSaveButtonEnabled,
    showInviteCopySuccessCheck,
    updateInviteCopyIconVisibility,
    onInvitationTabOpenedByUser,
    upsertCurrentProfileWithStatus,
    onStepRegisterClick,
    onStepInvitedClick,
    onStepAcceptedClick,
    onStepFirstMessageSentClick,
    onStepMessageRespondedClick,
    setStatusOnlyForStepper,
    setMarkedStatusForStepper,
    setAcceptedToggleForStepper,
    adjustMessageCountForCurrentProfile,
    setMessageCountForCurrentProfile,
    bindStepperClickHandlers,
    handleSaveInviteClick,
    bindSaveInviteClickHandler,
    handleGenerateInviteClick,
    bindGenerateInviteClickHandler,
    bindInviteCopyClickHandler,
    bindPersonWorkflowEvents,
  };
}

globalThis.initPersonModule = initPersonModule;
