function initMessagesModule(deps = {}) {
Object.assign(globalThis, deps);
function getOutreachStatusFromDbRow() {
  const status = getLifecycleStatusValue(dbInvitationRow);
  return status === "first message sent" ||
    status === "first_message_sent" ||
    status === "message responded" ||
    status === "message_responded"
    ? "first_message_sent"
    : "accepted";
}

function renderMessageTab(status) {
  // First/Follow visibility is controlled only by inner tab selection.
  // Status must not hide first-message UI.
  void status;
}

async function refreshChatHistoryFromActiveTab() {
  const result = await fetchChatHistory();
  extractedChatMessages = result.messages;
}

async function fetchChatHistory() {
  const reqId = `chat_${Date.now()}_${++chatExtractSeq}`;
  const result = await sendRuntimeMessage("FETCH_CHAT_HISTORY", {
    payload: { reqId },
  });
  if (!result.ok) {
    return { messages: [], chatHistory: "" };
  }
  const resp = result.data || {};
  const messages = Array.isArray(resp?.data?.messages)
    ? resp.data.messages
    : [];
  const chatHistory =
    typeof resp?.data?.chat_history === "string"
      ? resp.data.chat_history
      : formatChatHistory(messages);
  return { messages, chatHistory };
}

function updateFirstMessageCopyIconVisibility() {
  if (!copyFirstMessageBtnEl || !firstMessagePreviewEl) return;
  const hasText = (firstMessagePreviewEl.textContent || "").trim().length > 0;
  if (!hasText) {
    setCopyIconDefaultState(copyFirstMessageBtnEl);
  }
  copyFirstMessageBtnEl.hidden = !hasText;
  copyFirstMessageBtnEl.disabled = !hasText;
}

function updateFirstMessageSaveIconVisibility() {
  if (!saveFirstMessageIconEl || !firstMessagePreviewEl) return;
  saveFirstMessageIconEl.hidden =
    (firstMessagePreviewEl.textContent || "").trim().length === 0;
}

function updateMessageTabControls() {
  const hasProfileUrl = hasMessageProfileUrl();
  const hasGeneratedFirstMessage = Boolean(
    (firstMessagePreviewEl.textContent || "").trim(),
  );
  const isFirstMessageSent = outreachMessageStatus === "first_message_sent";

  if (generateFirstMessageBtnEl) {
    generateFirstMessageBtnEl.disabled = !hasProfileUrl;
  }
  if (markMessageSentBtnEl) {
    markMessageSentBtnEl.disabled =
      isFirstMessageSent || !(hasProfileUrl && hasGeneratedFirstMessage);
  }
  updateFirstMessageCopyIconVisibility();
  updateFirstMessageSaveIconVisibility();
}

async function refreshMessagesTab({ reason = "manual_refresh" } = {}) {
  debug("refreshMessagesTab:", reason);
  setFooterStatus(UI_TEXT.preparingProfile);
  const hasOpenProfile = await loadProfileContextOnOpen();
  if (!hasOpenProfile) return;
  outreachMessageStatus = getOutreachStatusFromDbRow();
  renderMessageTab(outreachMessageStatus);
  updateMessageTabControls();
  await refreshChatHistoryFromActiveTab();
}

async function onMessagesTabOpenedByUser() {
  await refreshMessagesTab({ reason: "tab_click" });
}

async function handleGenerateFirstMessageClick() {
  const activeTabsBeforeGeneration = captureActiveTabState();
  let hadError = false;
  setFooterLlmStatus();
  try {
    setFooterStatus(UI_TEXT.generatingFirstMessage);
    if (firstMessagePreviewEl) {
      firstMessagePreviewEl.textContent = "";
    }
    updateFirstMessageCopyIconVisibility();

    const [{ apiKey: apiKeyLocal }, { model }] = await Promise.all([
      chrome.storage.local.get(["apiKey"]),
      chrome.storage.sync.get(["model"]),
    ]);
    const language = getLanguage();
    const additionalPrompt = (
      firstMessageAdditionalPromptEl?.value || ""
    ).trim();

    let apiKey = (apiKeyLocal || "").trim();
    if (!apiKey) {
      const typed = (apiKeyEl.value || "").trim();
      if (typed) {
        apiKey = typed;
        await chrome.storage.local.set({ apiKey });
      }
    }
    if (!apiKey) {
      const msg = UI_TEXT.setApiKeyInConfig;
      setFooterStatus(msg);
      return;
    }

    let profileContextForGeneration = null;
    try {
      const activeTab = await getActiveTabForProfileCheck().catch(() => null);
      const pageInfo = detectLinkedInPageType(activeTab?.url || "");
      if (pageInfo.page_type !== "person") {
        throw new Error("Active page is not a LinkedIn person profile.");
      }
      profileContextForGeneration = await getFreshScrapeForPage(pageInfo, {
        source: "first_message",
      });
    } catch (e) {
      const msg = UI_TEXT.couldNotExtractProfileContext;
      console.error("[first-message] scrape failed", e);
      setFooterStatus(msg);
      return;
    }

    const linkedinUrl = getLinkedinUrlFromContext(profileContextForGeneration);
    if (!linkedinUrl) {
      const msg = UI_TEXT.openLinkedInProfileFirst;
      setFooterStatus(msg);
      return;
    }

    currentProfileContext = profileContextForGeneration;
    lastProfileContextSent = { ...profileContextForGeneration };

    const result = await sendRuntimeMessage("GENERATE_FIRST_MESSAGE", {
      // prompt: buildFirstMessageTextPrompt (Generate first message button)
      payload: {
        apiKey,
        model: (model || "gpt-4.1").trim(),
        language,
        additionalPrompt,
        profile: profileContextForGeneration,
      },
    });
    const resp = result.data || {};

    if (!result.ok || !resp?.ok) {
      throw new Error(getErrorMessage(result.error || resp?.error));
    }

    firstMessage = (resp.first_message || "").trim();
    if (firstMessagePreviewEl) {
      firstMessagePreviewEl.textContent = firstMessage;
    }
    updateMessageTabControls();
    setFooterStatus(UI_TEXT.firstMessageGenerated);

    if (!isPostSendMode()) {
      setFooterUpdatingStatus();
      const dbResult = await sendRuntimeMessage("DB_UPDATE_FIRST_MESSAGE", {
        payload: {
          linkedin_url: linkedinUrl,
          first_message: firstMessage,
          first_message_generated_at: new Date().toISOString(),
        },
      });
      const dbResp = dbResult.data || {};
      if (!dbResult.ok || !dbResp?.ok) {
        setFooterStatus(
          `${UI_TEXT.generatedButDbErrorPrefix} ${getErrorMessage(dbResult.error || dbResp?.error)}`,
        );
      } else {
        await refreshInvitationRowFromDb({ preserveTabs: true });
        updateMessageTabControls();
      }
    }
  } catch (e) {
    hadError = true;
    console.error("[first-message] generate failed", e);
    setFooterStatus(`${UI_TEXT.errorPrefix} ${getErrorMessage(e)}`);
  } finally {
    restoreActiveTabState(activeTabsBeforeGeneration);
    if (hadError) {
      setFooterStatus("Error");
    } else {
      setFooterReady();
    }
  }
}

function bindGenerateFirstMessageClickHandler() {
  if (!generateFirstMessageBtnEl) return;
  if (generateFirstMessageBtnEl.dataset.firstMessageBound === "1") return;
  generateFirstMessageBtnEl.dataset.firstMessageBound = "1";
  generateFirstMessageBtnEl.addEventListener(
    "click",
    handleGenerateFirstMessageClick,
  );
}

function bindMessagePreviewCopyHandlers() {
  if (document.documentElement.dataset.messageCopyBound === "1") return;
  document.documentElement.dataset.messageCopyBound = "1";
  document.addEventListener("click", async (event) => {
    const eventTarget = event.target;
    const targetEl =
      eventTarget instanceof Element
        ? eventTarget
        : eventTarget instanceof Node
          ? eventTarget.parentElement
          : null;
    const clickedBtn = targetEl?.closest("#copyFirstMessage, #copyFollowup");
    if (!clickedBtn) return;

    const isFirstMessageCopy = clickedBtn.id === "copyFirstMessage";
    const previewNode = document.getElementById(
      isFirstMessageCopy ? "firstMessagePreview" : "followupPreview",
    );
    if (!previewNode) {
      setFooterStatus(
        `${UI_TEXT.copyFailedPrefix} ${getErrorMessage("Missing preview element.")}`,
      );
      return;
    }

    const previewText = isFirstMessageCopy
      ? previewNode.textContent || ""
      : previewNode.value || "";
    if (!previewText.trim()) {
      setFooterStatus(UI_TEXT.nothingToCopy);
      return;
    }

    const copyResult = await copyToClipboard(previewText);
    if (!copyResult.ok) {
      const errorText = getErrorMessage(copyResult.error);
      setFooterStatus(`${UI_TEXT.copyFailedPrefix} ${errorText}`);
      if (!isFirstMessageCopy) {
        console.error("[LEF][chat] followup copy failed", errorText);
      }
      return;
    }

    if (isFirstMessageCopy) {
      showFirstMessageCopySuccessCheck(clickedBtn);
      updateMessageTabControls();
    } else {
      showFollowupCopySuccessCheck(clickedBtn);
    }
    setFooterStatus(UI_TEXT.copiedToClipboard);
  });
}

function bindFirstMessageCopyHandler() {
  if (!copyFirstMessageBtnEl) {
    debugLog("[copy] missing #copyFirstMessage");
    return;
  }
  bindMessagePreviewCopyHandlers();
}

async function handleSaveFirstMessageClick() {
  const activeTabsBeforeSave = captureActiveTabState();
  setFooterUpdatingStatus();
  try {
    const textToSave = (
      firstMessage ||
      firstMessagePreviewEl?.textContent ||
      ""
    ).trim();
    if (!textToSave) {
      return;
    }

    const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
    if (!linkedin_url) {
      setFooterStatus(UI_TEXT.openLinkedInProfileFirst);
      return;
    }

    const result = await sendRuntimeMessage("DB_UPDATE_FIRST_MESSAGE", {
      payload: {
        linkedin_url,
        first_message: textToSave,
        first_message_generated_at: new Date().toISOString(),
      },
    });
    const resp = result.data || {};

    if (!result.ok || !resp?.ok) {
      throw new Error(getErrorMessage(result.error || resp?.error));
    }

    setFooterStatus("Saved.");
    await refreshInvitationRowFromDb({ preserveTabs: true });
    updateMessageTabControls();
  } catch (e) {
    console.error("[first-message] save failed", e);
    setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
  } finally {
    restoreActiveTabState(activeTabsBeforeSave);
    setFooterReady();
  }
}

function bindSaveFirstMessageClickHandler() {
  if (!saveFirstMessageIconEl) return;
  if (saveFirstMessageIconEl.dataset.saveBound === "1") return;
  saveFirstMessageIconEl.dataset.saveBound = "1";
  saveFirstMessageIconEl.addEventListener("click", handleSaveFirstMessageClick);
}

function bindMarkMessageSentHandler() {
  if (!markMessageSentBtnEl) return;
  if (markMessageSentBtnEl.dataset.markBound === "1") return;
  markMessageSentBtnEl.dataset.markBound = "1";
  markMessageSentBtnEl.addEventListener("click", async () => {
    setFooterDbStatus();
    try {
      if (!currentProfileContext) {
        setFooterStatus(UI_TEXT.openLinkedInProfileFirst);
        return;
      }

      const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
      if (!linkedin_url) {
        setFooterStatus(UI_TEXT.missingLinkedinUrl);
        return;
      }

      const result = await sendRuntimeMessage("DB_MARK_STATUS", {
        payload: { linkedin_url, status: "first message sent" },
      });
      const resp = result.data || {};

      setFooterStatus(
        resp?.ok
          ? UI_TEXT.markedFirstMessageSent
          : `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`,
      );

      if (resp?.ok) {
        outreachMessageStatus = "first_message_sent";
        await chrome.storage.local.set({ message_status: "first_message_sent" });
        renderMessageTab(outreachMessageStatus);
        await refreshInvitationRowFromDb();
      }
      updateMessageTabControls();
    } finally {
      setFooterReady();
    }
  });
}

async function handleGenerateFollowupClick() {
  setFooterLlmStatus();
  try {
    const objective = (followupObjectiveEl?.value || "").trim();
    const strategy = (strategyEl.value || "").trim();
    const includeStrategy = includeStrategyEl
      ? includeStrategyEl.checked
      : true;
    const language = getLanguage();
    const chatResult = await fetchChatHistory().catch((e) => {
      debugLog("[followup] chat history fetch failed", {
        message: getErrorMessage(e),
      });
      return { messages: [], chatHistory: "" };
    });
    extractedChatMessages = Array.isArray(chatResult.messages)
      ? chatResult.messages
      : [];
    const chatHistory = (chatResult.chatHistory || "").trim();
    const last10 = extractedChatMessages.slice(-10);
    debugLog("[LEF][chat] followup generate clicked", {
      includeStrategy,
      language,
      objectiveLen: objective.length,
      last10Count: last10.length,
      chatHistoryChars: chatHistory.length,
    });

    if (!objective) {
      if (followupObjectiveEl) {
        followupObjectiveEl.classList.add("is-invalid");
        followupObjectiveEl.focus();
      }
      setFooterStatus("Objective is required.");
      return;
    }
    followupObjectiveEl?.classList.remove("is-invalid");

    const activeTab = await getActiveTabForProfileCheck().catch(() => null);
    const pageInfo = detectLinkedInPageType(activeTab?.url || "");
    if (pageInfo.page_type !== "person") {
      setFooterStatus(UI_TEXT.openLinkedInProfileFirst);
      return;
    }

    const profileContextForFollowup = await getFreshScrapeForPage(pageInfo, {
      source: "followup",
    });
    if (!profileContextForFollowup) {
      setFooterStatus(UI_TEXT.couldNotExtractProfileContext);
      return;
    }

    setFooterStatus("Generating...");

    const [{ apiKey: apiKeyLocal }, { model }] = await Promise.all([
      chrome.storage.local.get(["apiKey"]),
      chrome.storage.sync.get(["model"]),
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
      setActiveTab("config");
      return;
    }

    const contextLast10 = last10.map((m) => ({
      direction:
        m?.direction === "them"
          ? "them"
          : m?.direction === "me"
            ? "me"
            : "unknown",
      text: (m?.text || "").trim(),
      ts: (m?.ts || "").trim(),
    }));
    debugLog("[LEF][chat] followup payload", {
      language,
      objectiveLen: objective.length,
      ctxCount: contextLast10.length,
    });

    const request = {
      // prompt: buildFollowupPrompt (Generate follow-up button)
      type: "GENERATE_FOLLOWUP_MESSAGE",
      payload: {
        apiKey,
        model: (model || "gpt-4.1").trim(),
        objective,
        strategy: includeStrategy ? strategy : "",
        includeStrategy,
        chat_history: chatHistory,
        contextLast10,
        profile_context: { ...profileContextForFollowup },
        profileContext: { ...profileContextForFollowup },
        language,
      },
    };
    debugLog("[LEF][chat] sending type", request.type);
    const result = await sendRuntimeMessage(request.type, {
      payload: request.payload,
    });
    const resp = result.data || {};

    if (!result.ok || !resp?.ok) {
      const msg = getErrorMessage(result.error || resp?.error);
      console.error("[LEF][chat] followup generate failed", msg);
      setFooterStatus(msg);
      if (followupPreviewEl) followupPreviewEl.value = msg;
      updateFollowupCopyIconVisibility();
      return;
    }

    const text = (resp.text || resp.first_message || "").trim();
    if (followupPreviewEl) followupPreviewEl.value = text;
    updateFollowupCopyIconVisibility();
    setFooterStatus("Generated.");
    debugLog("[LEF][chat] followup generated", { chars: text.length });
  } catch (e) {
    const msg = getErrorMessage(e);
    console.error("[LEF][chat] followup exception", e);
    setFooterStatus(msg);
    if (followupPreviewEl) followupPreviewEl.value = msg;
    updateFollowupCopyIconVisibility();
  } finally {
    setFooterReady();
  }
}

function bindGenerateFollowupClickHandler() {
  if (!generateFollowupBtnEl) return;
  if (generateFollowupBtnEl.dataset.followupBound === "1") return;
  generateFollowupBtnEl.dataset.followupBound = "1";
  generateFollowupBtnEl.addEventListener("click", handleGenerateFollowupClick);
}

function bindFollowupCopyHandler() {
  if (!copyFollowupBtnEl) {
    debugLog("[copy] missing #copyFollowup");
    return;
  }
  bindMessagePreviewCopyHandlers();
}

function bindMessagesWorkflowEvents() {
  bindGenerateFirstMessageClickHandler();
  bindFirstMessageCopyHandler();
  bindSaveFirstMessageClickHandler();
  bindMarkMessageSentHandler();
  bindGenerateFollowupClickHandler();
  bindFollowupCopyHandler();
  setCopyIconDefaultState(copyFirstMessageBtnEl);
  setCopyIconDefaultState(copyFollowupBtnEl);
  followupPreviewEl?.addEventListener("input", () => {
    updateFollowupCopyIconVisibility();
  });
  followupObjectiveEl?.addEventListener("input", () => {
    if ((followupObjectiveEl.value || "").trim()) {
      followupObjectiveEl.classList.remove("is-invalid");
    }
  });
}

  return {
    getOutreachStatusFromDbRow,
    renderMessageTab,
    refreshChatHistoryFromActiveTab,
    fetchChatHistory,
    updateFirstMessageCopyIconVisibility,
    updateFirstMessageSaveIconVisibility,
    updateMessageTabControls,
    refreshMessagesTab,
    onMessagesTabOpenedByUser,
    handleGenerateFirstMessageClick,
    bindGenerateFirstMessageClickHandler,
    bindMessagePreviewCopyHandlers,
    bindFirstMessageCopyHandler,
    handleSaveFirstMessageClick,
    bindSaveFirstMessageClickHandler,
    bindMarkMessageSentHandler,
    handleGenerateFollowupClick,
    bindGenerateFollowupClickHandler,
    bindFollowupCopyHandler,
    bindMessagesWorkflowEvents,
  };
}

globalThis.initMessagesModule = initMessagesModule;
