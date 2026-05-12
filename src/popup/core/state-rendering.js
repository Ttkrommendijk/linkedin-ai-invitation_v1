const renderMessageTab = PopupLifecycleController.renderMessageTab;

function getMessageCountValue(dbRow) {
  const value = Number(dbRow?.message_count);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function isMessageSentOrBeyondStatus(statusValue) {
  const normalized = String(statusValue || "")
    .trim()
    .toLowerCase();
  return (
    normalized === "first message sent" ||
    normalized === "first_message_sent" ||
    normalized === "message responded" ||
    normalized === "message_responded"
  );
}

function getEffectiveMessageCount(dbRow) {
  const rawCount = getMessageCountValue(dbRow);
  if (isMessageSentOrBeyondStatus(getLifecycleStatusValue(dbRow))) {
    return Math.max(1, rawCount);
  }
  return rawCount;
}

function isAcceptedRow(dbRow) {
  if (dbRow?.accepted === true) return true;
  if (dbRow?.accepted === false) return false;
  return dbRow?.accepted_at != null && String(dbRow.accepted_at).trim() !== "";
}

function getActiveTopTabKey() {
  if (tabOverview?.classList.contains("active")) return "overview";
  if (tabConfig?.classList.contains("active")) return "config";
  return "detail";
}

function captureActiveTabState() {
  return {
    topTab: getActiveTopTabKey(),
    detailTab: detailInnerTab,
  };
}

function restoreActiveTabState(tabState) {
  if (!tabState) return;
  const topTab = tabState.topTab || "detail";
  setActiveTab(topTab, { userInitiated: true });
  if (topTab === "detail" && tabState.detailTab) {
    setDetailInnerTab(tabState.detailTab);
  }
}

const normalizeSupabaseUrl = PopupConfigController.normalizeSupabaseUrl;
const getEffectiveSupabaseUrl = PopupConfigController.getEffectiveSupabaseUrl;
const saveSupabaseUrlOverride = PopupConfigController.saveSupabaseUrlOverride;
const mergeNavPacingConfig = PopupConfigController.mergeNavPacingConfig;
const loadNavPacingConfigForUi = PopupConfigController.loadNavPacingConfigForUi;
const saveNavPacingEnabled = PopupConfigController.saveNavPacingEnabled;

function updateFilterClearButton(inputEl, clearBtnEl) {
  if (!clearBtnEl) return;
  clearBtnEl.hidden = !safeTrim(inputEl?.value);
}

function clearFilterInput(inputEl, clearBtnEl) {
  if (!inputEl) return;
  inputEl.value = "";
  updateFilterClearButton(inputEl, clearBtnEl);
  inputEl.dispatchEvent(new Event("input", { bubbles: true }));
  inputEl.focus();
}

function collectOverviewFilterUiState() {
  return {
    campaign: filterCampaignEl?.value || "",
    archived: overviewArchivedFilterEl?.value || "",
    status: overviewStatusFilterEl?.value || "",
    accepted: filterAcceptedEl?.value || "",
    search: overviewSearchEl?.value || "",
    sort_key: overviewSortField || "most_relevant_date",
    sort_dir: overviewSortDir === "asc" ? "asc" : "desc",
  };
}

function collectCompanyFilterUiState() {
  return {
    campaign: companyOverviewFilters.campaign || "",
    archived: companyOverviewFilters.archived || "",
    search: companySearchEl?.value || companyOverviewSearch || "",
    sort_key: companyOverviewSortField || "company_name",
    sort_dir: companyOverviewSortDir === "asc" ? "asc" : "desc",
    page_size: String(
      companyOverviewPageSizeEl?.value || companyOverviewPageSize || 25,
    ),
  };
}

async function persistOverviewFiltersToStorage() {
  await chrome.storage.local.set({
    [STORAGE_KEY_LIST_FILTERS]: {
      persons: collectOverviewFilterUiState(),
      companies: collectCompanyFilterUiState(),
    },
  });
}

async function restoreOverviewFiltersFromStorage() {
  const data = await chrome.storage.local.get([STORAGE_KEY_LIST_FILTERS]);
  const saved = data?.[STORAGE_KEY_LIST_FILTERS];
  if (!saved || typeof saved !== "object") {
    updateOverviewCampaignFilterTitle();
    updateFilterClearButton(overviewSearchEl, overviewSearchClearBtnEl);
    updateFilterClearButton(companySearchEl, companySearchClearBtnEl);
    return;
  }

  const savedPersons =
    saved && typeof saved.persons === "object" ? saved.persons : saved;
  const savedCompanies =
    saved && typeof saved.companies === "object" ? saved.companies : null;

  const savedCampaign = String(savedPersons?.campaign || "");
  const savedArchived = String(savedPersons?.archived || "");
  const savedStatus = String(savedPersons?.status || "");
  const savedAccepted = String(savedPersons?.accepted || "");
  const savedSearch = String(savedPersons?.search || "");
  const savedSortKey = String(savedPersons?.sort_key || "");
  const savedSortDir = String(savedPersons?.sort_dir || "").toLowerCase();

  const allowedSortFields = new Set([
    "name",
    "full_name",
    "company",
    "headline",
    "status",
    "most_relevant_date",
    "campaigns",
    "archived",
  ]);
  if (savedSortKey === "campaign") {
    overviewSortField = "campaigns";
  }
  if (allowedSortFields.has(savedSortKey)) {
    overviewSortField = savedSortKey === "full_name" ? "name" : savedSortKey;
  }
  if (savedSortDir === "asc" || savedSortDir === "desc") {
    overviewSortDir = savedSortDir;
  }

  if (overviewArchivedFilterEl) {
    const archivedOptionExists = Array.from(
      overviewArchivedFilterEl.options || [],
    ).some((option) => option.value === savedArchived);
    overviewArchivedFilterEl.value = archivedOptionExists ? savedArchived : "";
  }
  if (overviewStatusFilterEl) {
    const statusOptionExists = Array.from(
      overviewStatusFilterEl.options || [],
    ).some((option) => option.value === savedStatus);
    overviewStatusFilterEl.value = statusOptionExists ? savedStatus : "";
  }
  if (overviewSearchEl) {
    overviewSearchEl.value = savedSearch;
  }
  if (filterAcceptedEl) {
    const acceptedOptionExists = Array.from(
      filterAcceptedEl.options || [],
    ).some((option) => option.value === savedAccepted);
    filterAcceptedEl.value = acceptedOptionExists ? savedAccepted : "";
  }
  if (filterCampaignEl) {
    const campaignOptionExists = Array.from(
      filterCampaignEl.options || [],
    ).some((option) => option.value === savedCampaign);
    filterCampaignEl.value = campaignOptionExists ? savedCampaign : "";
  }

  overviewFilters.campaign = filterCampaignEl?.value || "";
  overviewFilters.archived = overviewArchivedFilterEl?.value || "";
  overviewFilters.status = overviewStatusFilterEl?.value || "";
  overviewFilters.accepted = filterAcceptedEl?.value || "";
  overviewSearch = overviewSearchEl?.value || "";
  updateFilterClearButton(overviewSearchEl, overviewSearchClearBtnEl);
  personGridState.sortField = overviewSortField;
  personGridState.sortDir = overviewSortDir;
  personGridState.filters = { ...overviewFilters };
  personGridState.search = overviewSearch;
  updateOverviewCampaignFilterTitle();

  if (savedCompanies && typeof savedCompanies === "object") {
    const companySortKey = String(savedCompanies.sort_key || "");
    const companySortDir = String(savedCompanies.sort_dir || "").toLowerCase();
    const companySearch = String(savedCompanies.search || "");
    const companyArchived = String(savedCompanies.archived || "");
    const companyCampaign = String(savedCompanies.campaign || "");
    const companyPageSize = Number(savedCompanies.page_size || 25);
    const companyAllowedSortFields = new Set([
      "company_name",
      "linked_person_count",
      "customer_potential_score",
      "employee_number",
      "sector",
      "campaigns",
      "archived",
    ]);

    if (companyAllowedSortFields.has(companySortKey)) {
      companyOverviewSortField = companySortKey;
    }
    if (companySortDir === "asc" || companySortDir === "desc") {
      companyOverviewSortDir = companySortDir;
    }

    if (companyArchivedFilterEl) {
      const archivedOptionExists = Array.from(
        companyArchivedFilterEl.options || [],
      ).some((option) => option.value === companyArchived);
      companyArchivedFilterEl.value = archivedOptionExists
        ? companyArchived
        : "";
    }
    if (companyCampaignFilterEl) {
      const selectedOption = Array.from(
        companyCampaignFilterEl.options || [],
      ).find(
        (option) =>
          String(option?.dataset?.campaignName || "") === companyCampaign,
      );
      companyCampaignFilterEl.value = selectedOption
        ? selectedOption.value
        : "";
    }
    if (companySearchEl) {
      companySearchEl.value = companySearch;
    }
    if (companyOverviewPageSizeEl && Number.isFinite(companyPageSize)) {
      const pageSizeValue = String(companyPageSize);
      const hasPageSize = Array.from(
        companyOverviewPageSizeEl.options || [],
      ).some((option) => option.value === pageSizeValue);
      if (hasPageSize) {
        companyOverviewPageSizeEl.value = pageSizeValue;
      }
    }

    companyOverviewFilters.archived = companyArchivedFilterEl?.value || "";
    companyOverviewFilters.campaign = companyCampaignFilterEl
      ?.selectedOptions?.[0]
      ? String(
          companyCampaignFilterEl.selectedOptions[0].dataset?.campaignName ||
            "",
        )
      : "";
    companyOverviewSearch = companySearchEl?.value || "";
    updateFilterClearButton(companySearchEl, companySearchClearBtnEl);
    companyOverviewPageSize = Number(companyOverviewPageSizeEl?.value || 25);
    companyGridState.sortField = companyOverviewSortField;
    companyGridState.sortDir = companyOverviewSortDir;
    companyGridState.filters = { ...companyOverviewFilters };
    companyGridState.search = companyOverviewSearch;
    companyGridState.pageSize = companyOverviewPageSize;
  }
  updateFilterClearButton(companySearchEl, companySearchClearBtnEl);
}

const isPostSendMode = PopupLifecycleController.isPostSendMode;

async function linkSelectedExistingCompany() {
  syncSelectedExistingCompanyFromInput();
  const selectedExistingCompanyForLink =
    PopupCompanyController.getSelectedExistingCompanyForLink();
  const company_id = safeTrim(selectedExistingCompanyForLink?.company_id);
  if (!company_id) {
    updateExistingCompanyLinkUi("Select a company to link.");
    return false;
  }
  const payload = {
    ...buildCompanyProfileSavePayload(),
    company_id,
    company_name:
      safeTrim(selectedExistingCompanyForLink?.company_name) ||
      safeTrim(detailPersonNameEl?.value),
  };
  if (!payload.linkedin_id) {
    setFooterStatus("Missing linkedin_id.");
    return false;
  }
  setFooterUpdatingStatus();
  const result = await sendRuntimeMessage("DB_UPDATE_COMPANY_BY_ID", {
    payload,
  });
  const resp = result.data || {};
  if (!result.ok || !resp?.ok) {
    throw new Error(getErrorMessage(result.error || resp?.error));
  }
  PopupLogger.debug("[LEF][company link accepted]", {
    company_id,
    linkedin_id: payload.linkedin_id,
  });
  await refreshCompanyRowFromDb();
  setFooterStatus("Linked.");
  return true;
}

function updateStepperInteractivity() {
  if (!statusStepperEl) return;

  const rawStatus = getLifecycleStatusValue(PopupState.dbInvitationRow);
  const status =
    rawStatus === POPUP_STATUS_CONSTANTS.accepted
      ? POPUP_STATUS_CONSTANTS.invited
      : rawStatus;
  const hasRow = Boolean(PopupState.dbInvitationRow);
  const isAccepted = isAcceptedRow(PopupState.dbInvitationRow);
  const normalizedStatus =
    status === "first_message_sent"
      ? "first message sent"
      : status === "message_responded"
        ? "message responded"
        : status;
  const statusRank = (() => {
    if (normalizedStatus === "registered" || normalizedStatus === "generated") {
      return 1;
    }
    if (normalizedStatus === POPUP_STATUS_CONSTANTS.invited) return 2;
    if (normalizedStatus === POPUP_STATUS_CONSTANTS.firstMessageSent) return 3;
    if (normalizedStatus === "message responded") return 4;
    return 0;
  })();
  const isInvitedPlus = statusRank >= 2;
  const acceptedFalse = !isAccepted;
  const acceptedClickable = hasRow && isInvitedPlus;
  const acceptedForward = acceptedClickable && acceptedFalse;

  const allowed = {
    registered: false,
    invited: false,
    accepted: false,
    first_message_sent: false,
    message_responded: false,
  };
  const hoverable = {
    registered: false,
    invited: false,
    accepted: false,
    first_message_sent: false,
    message_responded: false,
  };
  let forwardTarget = null;
  const forwardSteps = new Set();
  let backTarget = null;
  let backAction = null;

  if (!hasRow) {
    forwardTarget = "registered";
    forwardSteps.add("registered");
  } else if (
    normalizedStatus === "registered" ||
    normalizedStatus === "generated"
  ) {
    forwardTarget = "invited";
    forwardSteps.add("invited");
  } else if (normalizedStatus === POPUP_STATUS_CONSTANTS.invited) {
    allowed.first_message_sent = true;
    forwardTarget = "first_message_sent";
    forwardSteps.add("first_message_sent");
    backTarget = POPUP_STATUS_CONSTANTS.invited;
    backAction = "status_registered";
    hoverable.first_message_sent = true;
  } else if (normalizedStatus === POPUP_STATUS_CONSTANTS.firstMessageSent) {
    forwardTarget = "message_responded";
    forwardSteps.add("message_responded");
    backTarget = "first_message_sent";
    backAction = "status_invited";
  } else if (normalizedStatus === "message responded") {
    backTarget = "message_responded";
    backAction = "status_first_message_sent";
  }

  if (acceptedClickable) {
    allowed.accepted = true;
    hoverable.accepted = true;
    if (acceptedForward) {
      forwardSteps.add("accepted");
    }
  }

  forwardSteps.forEach((stepKey) => {
    allowed[stepKey] = true;
  });
  if (backTarget) allowed[backTarget] = true;
  if (backTarget) hoverable[backTarget] = true;

  stepperAllowedActions = allowed;
  stepperForwardTarget = forwardTarget;
  stepperForwardSteps = forwardSteps;
  stepperBackTarget = backTarget;
  stepperBackAction = backAction;
  stepperStatusStage = normalizedStatus;

  const applyStepState = (stepEl, stepKey, { done = false }) => {
    if (!stepEl) return;
    stepEl.classList.toggle("step-clickable", Boolean(allowed[stepKey]));
    stepEl.classList.toggle("step-forward", forwardSteps.has(stepKey));
    stepEl.classList.toggle("step-hoverable", Boolean(hoverable[stepKey]));
    stepEl.classList.toggle("step-done", Boolean(done));
  };

  applyStepState(stepRegisterEl, "registered", { done: statusRank >= 1 });
  applyStepState(stepInvitedEl, "invited", { done: statusRank >= 2 });
  applyStepState(stepAcceptedEl, "accepted", {
    done: isAccepted,
  });
  applyStepState(stepFirstMessageSentEl, "first_message_sent", {
    done: statusRank >= 3,
  });
  applyStepState(stepMessageRespondedEl, "message_responded", {
    done: statusRank >= 4,
  });
  const messageCount = getEffectiveMessageCount(PopupState.dbInvitationRow);
  if (messageCountBadgeEl) {
    messageCountBadgeEl.hidden = messageCount <= 0;
    messageCountBadgeEl.textContent = String(messageCount);
  }
  if (messageCountControlsEl) {
    messageCountControlsEl.hidden = messageCount <= 0;
  }
  if (messageCountDecrementEl) {
    messageCountDecrementEl.disabled =
      messageCount <= 0 ||
      (isMessageSentOrBeyondStatus(
        getLifecycleStatusValue(PopupState.dbInvitationRow),
      ) &&
        messageCount <= 1);
  }
  positionMessageCountControls();
}

function positionMessageCountControls() {
  if (!messageCountControlsEl || !statusStepperEl || !stepFirstMessageSentEl) {
    return;
  }
  const stepperRect = statusStepperEl.getBoundingClientRect();
  const stepRect = stepFirstMessageSentEl.getBoundingClientRect();
  if (!stepperRect.width || !stepRect.width) return;
  const centerX = stepRect.left - stepperRect.left + stepRect.width / 2;
  messageCountControlsEl.style.left = `${Math.round(centerX)}px`;
}

function updatePhaseButtons() {
  updateStepperInteractivity();
}

function setDetailInnerTab(tab) {
  if (isCompanyProfileMode()) {
    detailInnerTab = tab;
    applyProfileModeUi();
    return;
  }
  detailInnerTab = "free_prompt";
  if (detailInviteSectionEl) detailInviteSectionEl.hidden = true;
  if (tabMessage) tabMessage.hidden = true;
  if (tabFreePromptEl) {
    tabFreePromptEl.classList.add("active");
  }
}

const updateGenerateFirstMessageButtonLabel =
  PopupLifecycleController.updateGenerateFirstMessageButtonLabel;

const getErrorMessage =
  typeof POPUP_UTILS.getErrorMessage === "function"
    ? POPUP_UTILS.getErrorMessage
    : (error) =>
        error && typeof error === "object" && typeof error.message === "string"
          ? error.message
          : error instanceof Error && typeof error.message === "string"
            ? error.message
            : UI_TEXT.unexpectedError;

const formatChatHistory =
  typeof POPUP_UTILS.formatChatHistory === "function"
    ? POPUP_UTILS.formatChatHistory
    : (messages) => {
        if (!Array.isArray(messages) || messages.length === 0) {
          return "No chat messages found.";
        }
        const lines = [];
        let lastHeading = "";
        let lastGroupKey = "";
        for (const m of messages) {
          const dateLabel = (m?.heading || m?.dateLabel || "").trim();
          const name = (m?.name || "").trim() || "Unknown";
          const time = (m?.time || m?.ts || "").trim();
          const text = (m?.text || "").trim();
          if (!text || !time) continue;
          if (dateLabel && dateLabel !== lastHeading) {
            if (lines.length && lines[lines.length - 1] !== "") lines.push("");
            lines.push(dateLabel);
            lastHeading = dateLabel;
            lastGroupKey = "";
          }
          const groupKey = `${name}||${time}`;
          if (groupKey !== lastGroupKey) {
            if (lines.length && lines[lines.length - 1] !== "") lines.push("");
            lines.push(`${name}  ${time}`);
            lastGroupKey = groupKey;
          }
          lines.push(text);
        }
        return lines.join("\n");
      };

const normalizeChatText = PopupChatController.normalizeChatText;
const toChatLogEntry = PopupChatController.toChatLogEntry;
const isMessageBoxMissingError = PopupChatController.isMessageBoxMissingError;

function setCommunicationStatus(text) {
  setFooterStatus(text || "Ready");
}

function isInProgressFooterStatus(text) {
  return (
    text === "Sending to LLM\u2026" ||
    text === "Fetching\u2026" ||
    text === "Updating\u2026" ||
    text === "Communicating to database\u2026"
  );
}

// DEBUG-only encoding diagnostics for status text; used to verify ellipsis/code points.
function debugStatusEncoding(text) {
  const value = (text || "").toString();
  const tail = Array.from(value).slice(-5);
  const tailHex = tail.map((ch) => ch.codePointAt(0).toString(16));
  debug("[encoding][status]", { value, tail, tailHex });
}

function setFooterStatus(text) {
  if (!footerStatusEl) return;
  const nextText = (text || "Ready").toString().trim() || "Ready";
  debugStatusEncoding(nextText);
  if (readyResetTimer) {
    clearTimeout(readyResetTimer);
    readyResetTimer = null;
  }
  footerStatusEl.textContent = nextText;
  if (nextText === "Ready") return;
  if (isInProgressFooterStatus(nextText)) return;
  readyResetTimer = setTimeout(() => {
    setFooterStatus("Ready");
  }, 2000);
}

function setFooterReady() {
  if (readyResetTimer) return;
  setFooterStatus("Ready");
}

function setFooterFetchingStatus() {
  setFooterStatus("Fetching\u2026");
}

function setFooterUpdatingStatus() {
  setFooterStatus("Updating\u2026");
}

function setFooterDbStatus() {
  setFooterStatus("Communicating to database\u2026");
}

function setFooterLlmStatus() {
  setFooterStatus("Sending to LLM\u2026");
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "ui_status") return;
  if (msg?.text === "Ready") return;
  setFooterStatus(msg?.text || "Ready");
});

const formatDateTime = POPUP_UTILS.formatDateTime;

async function refreshCompanyRowFromDb({
  linkedin_id: linkedinIdOverride,
  allowNameSearch = true,
} = {}) {
  setFooterFetchingStatus();
  const linkedin_id =
    safeTrim(linkedinIdOverride) || normalizeCompanyLinkedinId();
  if (!linkedin_id) {
    dbCompanyRow = null;
    PopupCompanyController.setCompanyPeopleRows([]);
    PopupCompanyController.setSelectedExistingCompanyForLinkState(null);
    renderDetailHeader();
    renderCompanyPeopleList();
    await prepareExistingCompanyLinkDropdown({ allowSearch: allowNameSearch });
    setFooterReady();
    return;
  }
  try {
    const result = await sendRuntimeMessage("DB_GET_COMPANY_BY_LINKEDIN_ID", {
      payload: { linkedin_id },
    });
    dbCompanyRow = result.ok ? result.data?.company || null : null;
    renderDetailHeader();
    await prepareExistingCompanyLinkDropdown({ allowSearch: allowNameSearch });
    await refreshCompanyPeopleList();
  } finally {
    setFooterReady();
  }
}

function getOverviewLastRelevantDate(row) {
  return row?.most_relevant_date || "";
}

const pad2 = POPUP_UTILS.pad2;
const formatLocalDateTime = POPUP_UTILS.formatLocalDateTime;

function buildOverviewQueryState() {
  const selectedCampaignOption =
    filterCampaignEl?.options?.[filterCampaignEl.selectedIndex] || null;
  const selectedCampaignName = String(
    selectedCampaignOption?.dataset?.campaignName || "",
  ).trim();
  const campaignFilterValue =
    overviewFilters.campaign === "__no_campaign__"
      ? ""
      : selectedCampaignName || "";
  return {
    page: overviewPage,
    pageSize: overviewPageSize,
    sortField: overviewSortField,
    sortDir: overviewSortDir,
    filters: {
      campaign: campaignFilterValue,
      archived: overviewFilters.archived || "",
      status: overviewFilters.status || "",
      accepted: overviewFilters.accepted || "",
    },
    search: overviewSearch || "",
  };
}
