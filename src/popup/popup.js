const apiKeyEl = document.getElementById("apiKey");
const modelEl = document.getElementById("model");
const strategyEl = document.getElementById("strategy");
const focusEl = document.getElementById("focus");
const messageLanguageEl = document.getElementById("messageLanguage");
const inviteLanguageEl = document.getElementById("inviteLanguage");
const firstMessageAdditionalPromptEl = document.getElementById(
  "firstMessageAdditionalPrompt",
);
const messagePromptEl = document.getElementById("messagePrompt");
const messagePromptWrapEl =
  document.getElementById("firstPromptContainer") ||
  document.getElementById("messagePromptWrap");
const toggleMessagePromptBtnEl =
  document.getElementById("togglePrompt") ||
  document.getElementById("toggleMessagePrompt");
const saveMessagePromptBtnEl = document.getElementById("saveMessagePrompt");
const resetMessagePromptBtnEl = document.getElementById("resetMessagePrompt");
const generateFirstMessageBtnEl = document.getElementById(
  "generateFirstMessage",
);
const markMessageSentBtnEl =
  document.getElementById("markFirstMessageSent") ||
  document.getElementById("markMessageSent");
const copyFirstMessageBtnEl = document.getElementById("copyFirstMessage");
const saveFirstMessageIconEl = document.getElementById("saveFirstMessageIcon");
const initialMessageSectionEl = document.getElementById(
  "initialMessageSection",
);
const firstMessagePreviewSectionEl = document.getElementById(
  "firstMessagePreviewSection",
);
const acceptedModeEl = document.getElementById("acceptedMode");
const firstMessageSentModeEl = document.getElementById("firstMessageSentMode");
const followupSectionEl = document.getElementById("followupSection");
const followupObjectiveEl = document.getElementById("followupObjective");
const includeStrategyEl = document.getElementById("includeStrategy");
const generateFollowupBtnEl = document.getElementById("generateFollowup");
const footerStatusEl = document.getElementById("commFooterText");
// DO NOT write to .textContent directly; use setFooterStatus()
const followupPreviewEl = document.getElementById("followupPreview");
const copyFollowupBtnEl = document.getElementById("copyFollowup");

const EMOJI_CHECK = "\u2705";
const SYMBOL_ELLIPSIS = "\u2026";
const UI_TEXT = {
  unexpectedError: "Unexpected error.",
  configSaved: "Config saved.",
  openLinkedInProfileFirst: "Open a LinkedIn profile first.",
  missingLinkedinUrl: "Missing LinkedIn URL in profile context.",
  markedInvited: `Marked as invited ${EMOJI_CHECK}`,
  markedAccepted: `Marked as accepted ${EMOJI_CHECK}`,
  dbErrorPrefix: "DB error:",
  copiedToClipboard: "Copied to clipboard.",
  copyFailedPrefix: "Copy failed:",
  preparingProfile: `Preparing profile${SYMBOL_ELLIPSIS}`,
  setApiKeyInConfig: "Please set your API key in Config.",
  couldNotExtractProfileContext:
    "Could not extract profile context (open a LinkedIn profile page and reopen the popup).",
  callingOpenAI: `Calling OpenAI${SYMBOL_ELLIPSIS}`,
  errorPrefix: "Error:",
  generatedClickCopy: "Generated. Click Copy.",
  noMessageGenerated: "No message generated.",
  dbErrorAppendPrefix: " | DB error:",
  generatingFirstMessage: `Generating first message${SYMBOL_ELLIPSIS}`,
  messagePromptRequired: "Message prompt is required.",
  generatedButDbErrorPrefix: "Generated, but DB error:",
  firstMessageGenerated: `First message generated ${EMOJI_CHECK}`,
  markedFirstMessageSent: `Marked as first message sent ${EMOJI_CHECK}`,
  promptSaved: "Prompt saved.",
  promptReset: "Prompt reset to default.",
  openedSidePanel: "Opened side panel.",
  sidePanelNotAvailable: "Side panel not available.",
  lifecycleOpenLinkedInProfileFirst: "Open a LinkedIn profile first.",
  lifecycleNotInDatabase: "Not in database",
  lifecycleGenerated: "Generated",
  lifecycleInvited: "Invited",
  lifecycleAccepted: "Accepted",
  lifecycleFirstMessageGenerated: "First message generated",
  lifecycleFirstMessageSent: "First message sent",
  lifecycleInDatabase: "In database",
};
const STORAGE_KEY_FIRST_MESSAGE_PROMPT = "firstMessagePrompt";
const STORAGE_KEY_MESSAGE_LANGUAGE = "message_language";
const SUPPORTED_LANGUAGES = ["Portuguese", "English", "Dutch", "Spanish"];
const DEFAULT_FIRST_MESSAGE_PROMPT = messagePromptEl?.value || "";
const LEF_UTILS = globalThis.LEFUtils || {};
const safeTrim = LEF_UTILS.safeTrim;
const normalizeWhitespace = LEF_UTILS.normalizeWhitespace;
const sanitizeHeadlineJobTitle = LEF_UTILS.sanitizeHeadlineJobTitle;
const sendRuntimeMessage =
  typeof LEF_UTILS.sendRuntimeMessage === "function"
    ? LEF_UTILS.sendRuntimeMessage
    : async (type, payload = {}) => {
        try {
          const response = await chrome.runtime.sendMessage({
            type,
            ...(payload && typeof payload === "object" ? payload : {}),
          });
          if (response?.ok === false || response?.error) {
            const errorText =
              typeof response?.error === "string"
                ? response.error
                : response?.error?.message || "unknown error";
            return { ok: false, error: errorText, data: response || null };
          }
          return { ok: true, data: response };
        } catch (e) {
          return {
            ok: false,
            error: e instanceof Error ? e.message : String(e || ""),
            data: null,
          };
        }
      };
const debugLog =
  typeof LEF_UTILS.debugLog === "function" ? LEF_UTILS.debugLog : () => {};
const IS_SIDE_PANEL_CONTEXT = (() => {
  try {
    return (
      window.location.pathname.includes("sidepanel.html") ||
      window.top.location.pathname.includes("sidepanel.html")
    );
  } catch (_e) {
    return window.location.pathname.includes("sidepanel.html");
  }
})();

function debug(...args) {
  debugLog(...args);
}

const previewEl = document.getElementById("preview");
const firstMessagePreviewEl = document.getElementById("firstMessagePreview");
const copyInviteIconEl = document.getElementById("copyInviteIcon");
const saveInviteBtnEl = document.getElementById("saveInviteBtn");
const openSidePanelBtnEl = document.getElementById("openSidePanel");
const detailPersonNameEl = document.getElementById("detailPersonName");
const detailCompanyEl = document.getElementById("detailCompany");
const detailHeadlineEl = document.getElementById("detailHeadline");
const enrichProfileBtnEl = document.getElementById("enrichProfileBtn");
const statusStepperEl = document.getElementById("statusStepper");
const stepRegisterEl = document.getElementById("step-register");
const stepInvitedEl = document.getElementById("step-invited");
const stepAcceptedEl = document.getElementById("step-accepted");
const stepFirstMessageSentEl = document.getElementById(
  "step-first-message-sent",
);
const stepMessageRespondedEl = document.getElementById(
  "step-message-responded",
);
const statusBackBtnEl = document.getElementById("statusBackBtn");
const statusForwardBtnEl = document.getElementById("statusForwardBtn");
const detailTabInviteBtnEl = document.getElementById("detailTabInviteBtn");
const detailTabFirstMessageBtnEl = document.getElementById(
  "detailTabFirstMessageBtn",
);
const detailTabFollowBtnEl = document.getElementById("detailTabFollowBtn");
const detailInviteSectionEl = document.getElementById("detailInviteSection");
const detailMessageMountEl = document.getElementById("detailMessageMount");

if (!generateFirstMessageBtnEl) {
  console.error("[first-message] missing #generateFirstMessage");
}
if (!firstMessagePreviewEl) {
  console.error("[first-message] missing #firstMessagePreview");
}
if (!saveInviteBtnEl) {
  console.error("[save] missing #saveInviteBtn");
}
if (!saveFirstMessageIconEl) {
  console.error("[save] missing #saveFirstMessageIcon");
}
if (!openSidePanelBtnEl) {
  console.error("[sidepanel] missing #openSidePanel");
}

const tabMainBtn = document.getElementById("tabMainBtn");
const tabMessageBtn = document.getElementById("tabMessageBtn");
const tabOverviewBtn = document.getElementById("tabOverviewBtn");
const tabConfigBtn = document.getElementById("tabConfigBtn");
const tabMain = document.getElementById("tabMain");
const tabMessage = document.getElementById("tabMessage");
const tabOverview = document.getElementById("tabOverview");
const tabConfig = document.getElementById("tabConfig");

const overviewCampaignFilterEl = document.getElementById(
  "overviewCampaignFilter",
);
const overviewArchivedFilterEl = document.getElementById(
  "overviewArchivedFilter",
);
const overviewStatusFilterEl = document.getElementById("overviewStatusFilter");
const overviewSearchEl = document.getElementById("overviewSearch");
const overviewTbodyEl = document.getElementById("overviewTbody");
const overviewLoadingEl = document.getElementById("overviewLoading");
const overviewPageSizeEl = document.getElementById("overviewPageSize");
const overviewPrevBtnEl = document.getElementById("overviewPrevBtn");
const overviewNextBtnEl = document.getElementById("overviewNextBtn");
const overviewCountLabelEl = document.getElementById("overviewCountLabel");

const webhookBaseUrlEl = document.getElementById("webhookBaseUrl");
const webhookSecretEl = document.getElementById("webhookSecret");

let lastProfileContextSent = {};
let lastProfileContextEnriched = null;
let currentProfileContext = null;
let firstMessage = "";
let lastSavedFirstMessagePrompt = "";
let isMessagePromptCollapsed = true;
let dbInvitationRow = null;
let extractedChatMessages = [];
let outreachMessageStatus = "accepted";
let overviewPage = 1;
let overviewPageSize = 25;
let overviewTotal = null;
let overviewSortField = "most_relevant_date";
let overviewSortDir = "desc";
let overviewFilters = { campaign: "", archived: "", status: "" };
let overviewSearch = "";
let overviewSearchDebounceTimer = null;
let chatExtractSeq = 0;
let detailInnerTab = "invite";
let statusBackTarget = null;
let statusForwardTarget = null;
let currentLanguage = "Portuguese";
let inviteCopyIconResetTimer = null;
let firstMessageCopyIconResetTimer = null;
let followupCopyIconResetTimer = null;
let readyResetTimer = null;
const OVERVIEW_ENABLED = Boolean(
  IS_SIDE_PANEL_CONTEXT && tabOverviewBtn && tabOverview,
);

function getLifecycleStatusValue(dbRow) {
  return (dbRow?.status || "").trim().toLowerCase();
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

function isPostSendMode() {
  return getLifecycleStatusValue(dbInvitationRow) === "first message sent";
}

function getOutreachStatusFromDbRow() {
  const status = getLifecycleStatusValue(dbInvitationRow);
  return status === "first message sent" || status === "first_message_sent"
    ? "first_message_sent"
    : "accepted";
}

function renderMessageTab(status) {
  // First/Follow visibility is controlled only by inner tab selection.
  // Status must not hide first-message UI.
  void status;
}

function coalesceDbThenScraped(dbValue, scrapedValue) {
  return dbValue && String(dbValue).trim() !== ""
    ? String(dbValue)
    : scrapedValue || "";
}

function renderDetailHeader() {
  const scrapedName = (
    currentProfileContext?.name ||
    currentProfileContext?.full_name ||
    ""
  ).trim();
  const scrapedCompany = (currentProfileContext?.company || "").trim();
  const scrapedHeadline = (currentProfileContext?.headline || "").trim();

  const dbName = (
    dbInvitationRow?.full_name ||
    dbInvitationRow?.name ||
    ""
  ).trim();
  const dbCompany = (dbInvitationRow?.company || "").trim();
  const dbHeadline = (dbInvitationRow?.headline || "").trim();

  const name = coalesceDbThenScraped(dbName, scrapedName).trim() || "-";
  const company =
    coalesceDbThenScraped(dbCompany, scrapedCompany).trim() || "-";
  const headline =
    coalesceDbThenScraped(dbHeadline, scrapedHeadline).trim() || "-";

  debug("detail header source", {
    nameSource: dbName ? "db" : "scraped",
    companySource: dbCompany ? "db" : "scraped",
    headlineSource: dbHeadline ? "db" : "scraped",
  });

  if (detailPersonNameEl) detailPersonNameEl.textContent = name;
  if (detailCompanyEl) detailCompanyEl.textContent = company;
  if (detailHeadlineEl) detailHeadlineEl.textContent = headline;
}

function updatePhaseButtons() {
  if (!statusStepperEl) return;

  const status = (dbInvitationRow?.status || "").trim().toLowerCase();
  const stepEls = [
    stepRegisterEl,
    stepInvitedEl,
    stepAcceptedEl,
    stepFirstMessageSentEl,
    stepMessageRespondedEl,
  ];

  let completedIndex = -1;
  let activeIndex = -1;
  statusBackTarget = null;
  statusForwardTarget = null;

  if (!dbInvitationRow) {
    completedIndex = -1;
    activeIndex = -1;
    statusForwardTarget = "registered";
  } else if (status === "registered" || status === "generated") {
    completedIndex = -1;
    activeIndex = 0;
    statusForwardTarget = "invited";
  } else if (status === "invited") {
    completedIndex = 0;
    activeIndex = 1;
    statusBackTarget = "registered";
    statusForwardTarget = "accepted";
  } else if (status === "accepted") {
    completedIndex = 1;
    activeIndex = 2;
    statusBackTarget = "invited";
    statusForwardTarget = "first message sent";
  } else if (
    status === "first message sent" ||
    status === "first_message_sent"
  ) {
    completedIndex = 2;
    activeIndex = 3;
    statusBackTarget = "accepted";
    statusForwardTarget = "message responded";
  } else if (status === "message responded" || status === "message_responded") {
    completedIndex = 4;
    activeIndex = -1;
    statusBackTarget = "first message sent";
    statusForwardTarget = null;
  }

  stepEls.forEach((stepEl, index) => {
    if (!stepEl) return;
    const circleEl = stepEl.querySelector(".status-circle");
    const isCompleted = completedIndex >= 0 && index <= completedIndex;
    const isActive = activeIndex === index;
    if (circleEl) {
      circleEl.classList.toggle("completed", isCompleted);
      circleEl.classList.toggle("active", isActive);
    }
  });

  if (statusBackBtnEl) {
    if (statusBackTarget === "registered") {
      statusBackBtnEl.textContent = "← Back";
      statusBackBtnEl.hidden = false;
    } else if (statusBackTarget === "invited") {
      statusBackBtnEl.textContent = "← Back";
      statusBackBtnEl.hidden = false;
    } else if (statusBackTarget === "accepted") {
      statusBackBtnEl.textContent = "← Back";
      statusBackBtnEl.hidden = false;
    } else if (statusBackTarget === "first message sent") {
      statusBackBtnEl.textContent = "← Back";
      statusBackBtnEl.hidden = false;
    } else {
      statusBackBtnEl.hidden = true;
      statusBackBtnEl.textContent = "";
    }
  }

  if (statusForwardBtnEl) {
    if (statusForwardTarget === "registered") {
      statusForwardBtnEl.textContent = "Register";
      statusForwardBtnEl.hidden = false;
    } else if (statusForwardTarget === "invited") {
      statusForwardBtnEl.textContent = "Mark as Invited";
      statusForwardBtnEl.hidden = false;
    } else if (statusForwardTarget === "accepted") {
      statusForwardBtnEl.textContent = "Mark as Accepted";
      statusForwardBtnEl.hidden = false;
    } else if (statusForwardTarget === "first message sent") {
      statusForwardBtnEl.textContent = "Mark as First message sent";
      statusForwardBtnEl.hidden = false;
    } else if (statusForwardTarget === "message responded") {
      statusForwardBtnEl.textContent = "Mark as Message responded";
      statusForwardBtnEl.hidden = false;
    } else {
      statusForwardBtnEl.hidden = true;
      statusForwardBtnEl.textContent = "";
    }
  }
}

function setDetailInnerTab(tab) {
  detailInnerTab = tab;
  if (detailTabInviteBtnEl)
    detailTabInviteBtnEl.classList.toggle("active", tab === "invite");
  if (detailTabFirstMessageBtnEl)
    detailTabFirstMessageBtnEl.classList.toggle("active", tab === "first");
  if (detailTabFollowBtnEl)
    detailTabFollowBtnEl.classList.toggle("active", tab === "follow");

  if (detailInviteSectionEl) detailInviteSectionEl.hidden = tab !== "invite";
  if (tabMessage) tabMessage.hidden = tab === "invite";

  if (tab === "first") {
    if (acceptedModeEl) acceptedModeEl.hidden = false;
    if (firstMessageSentModeEl) firstMessageSentModeEl.hidden = true;
  } else if (tab === "follow") {
    if (acceptedModeEl) acceptedModeEl.hidden = true;
    if (firstMessageSentModeEl) firstMessageSentModeEl.hidden = false;
  } else {
    if (acceptedModeEl) acceptedModeEl.hidden = true;
    if (firstMessageSentModeEl) firstMessageSentModeEl.hidden = true;
  }
}

function updateGenerateFirstMessageButtonLabel() {
  generateFirstMessageBtnEl.textContent = isPostSendMode()
    ? "Create new message"
    : "Generate first message";
}

function getErrorMessage(error) {
  if (error && typeof error === "object" && typeof error.message === "string") {
    return error.message;
  }
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }
  return UI_TEXT.unexpectedError;
}

function formatChatHistory(messages) {
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
}

function normalizeChatText(value) {
  return typeof normalizeWhitespace === "function"
    ? normalizeWhitespace(value || "")
    : typeof safeTrim === "function"
      ? safeTrim(value || "")
      : "";
}

function toChatLogEntry(message, index) {
  const direction =
    message?.direction === "them"
      ? "them"
      : message?.direction === "me"
        ? "me"
        : "unknown";
  const dateLabel = (message?.heading || message?.dateLabel || "")
    .toString()
    .trim();
  const time = (message?.time || message?.ts || "").toString().trim();
  const ts = (message?.ts || message?.time || "").toString().trim();
  const normalizedText = normalizeChatText(message?.text || "");
  const key = `${direction}|${dateLabel}|${ts || time}|${normalizedText}`;
  return {
    i: index,
    liIndex: message?.liIndex ?? -1,
    direction,
    dateLabel,
    time,
    ts,
    textLen: normalizedText.length,
    text: normalizedText,
    key,
    dayHeading: dateLabel,
    dt_label: (message?.dt_label || `${dateLabel} ${time}`.trim()).trim(),
    name: (message?.name || "").toString().trim(),
    sortTsIso: "",
    displayLocal: "",
    datetimeForDebug:
      (message?.dt_label || `${dateLabel} ${time}`.trim()).trim() ||
      "NO_DATETIME",
    msgId: message?.msgId || "",
    domHint: message?.domHint || null,
  };
}

function isMessageBoxMissingError(errorText) {
  const text = String(errorText || "").toLowerCase();
  return (
    text.includes("message overlay not open") ||
    text.includes("interop shadow root not found")
  );
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

function setMessagePromptCollapsed(collapsed) {
  if (!messagePromptWrapEl || !toggleMessagePromptBtnEl) return;
  isMessagePromptCollapsed = collapsed;
  messagePromptWrapEl.hidden = collapsed;
  toggleMessagePromptBtnEl.textContent = collapsed
    ? "Show prompt"
    : "Hide prompt";
  toggleMessagePromptBtnEl.setAttribute(
    "aria-expanded",
    collapsed ? "false" : "true",
  );
}

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

function setFooterStatus(text) {
  if (!footerStatusEl) return;
  const nextText = (text || "Ready").toString().trim() || "Ready";
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

function formatDateTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value || "";
    return `${get("day")} ${get("month")} ${get("year")} ${get("hour")}:${get("minute")}`.trim();
  } catch (_e) {
    try {
      return date.toLocaleString();
    } catch (_e2) {
      return "";
    }
  }
}

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

  if (status === "accepted" || status === "first message sent") {
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

  if (status === "accepted" || status === "first message sent") {
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
  if (status === "accepted") {
    return { key: "accepted", text: UI_TEXT.lifecycleAccepted };
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
  setFooterFetchingStatus();
  const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedin_url) {
    dbInvitationRow = null;
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
      setCommunicationStatus(getErrorMessage(result.error));
      applyLifecycleUiState(dbInvitationRow, { preserveTabs });
      outreachMessageStatus = "accepted";
      renderMessageTab(outreachMessageStatus);
      renderDetailHeader();
      updatePhaseButtons();
      return;
    }

    dbInvitationRow = resp.row || null;
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
    updatePhaseButtons();
  } finally {
    setFooterReady();
  }
}

function hasMessageProfileUrl() {
  return Boolean(getLinkedinUrlFromContext(currentProfileContext));
}

function updateSavePromptButtonState() {
  if (!saveMessagePromptBtnEl || !resetMessagePromptBtnEl || !messagePromptEl) {
    return;
  }
  saveMessagePromptBtnEl.disabled =
    messagePromptEl.value === lastSavedFirstMessagePrompt;
  resetMessagePromptBtnEl.disabled =
    messagePromptEl.value === DEFAULT_FIRST_MESSAGE_PROMPT;
}

function updateFirstMessageCopyIconVisibility() {
  if (!copyFirstMessageBtnEl || !firstMessagePreviewEl) return;
  const hasText = (firstMessagePreviewEl.textContent || "").trim().length > 0;
  if (!hasText) {
    copyFirstMessageBtnEl.textContent = "\u29c9";
  }
  copyFirstMessageBtnEl.hidden = !hasText;
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

function getOverviewLastRelevantDate(row) {
  return row?.most_relevant_date || "";
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatLocalDateTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yy = String(d.getFullYear()).slice(-2);
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${dd}-${mm}-${yy} ${hh}:${mi}`;
}

function buildOverviewQueryState() {
  return {
    page: overviewPage,
    pageSize: overviewPageSize,
    sortField: overviewSortField,
    sortDir: overviewSortDir,
    filters: {
      campaign: overviewFilters.campaign || "",
      archived: overviewFilters.archived || "",
      status: overviewFilters.status || "",
    },
    search: overviewSearch || "",
  };
}

function renderOverviewSortIndicators() {
  const indicatorEls = document.querySelectorAll(
    "[data-overview-sort-indicator]",
  );
  indicatorEls.forEach((el) => {
    const field = el.getAttribute("data-overview-sort-indicator");
    if (field === overviewSortField) {
      el.textContent = overviewSortDir === "asc" ? "▲" : "▼";
    } else {
      el.textContent = "";
    }
  });

  const sortBtns = document.querySelectorAll("[data-overview-sort]");
  sortBtns.forEach((btn) => {
    const field = btn.getAttribute("data-overview-sort");
    btn.classList.toggle("is-active", field === overviewSortField);
  });
}

function renderOverviewPagination() {
  const totalKnown = Number.isFinite(overviewTotal);
  const start =
    overviewTotal === 0 ? 0 : (overviewPage - 1) * overviewPageSize + 1;
  const end = totalKnown
    ? Math.min(overviewPage * overviewPageSize, overviewTotal)
    : overviewPage * overviewPageSize;
  overviewCountLabelEl.textContent = totalKnown
    ? `${start}-${end} of ${overviewTotal}`
    : "Total: ?";
  overviewPrevBtnEl.disabled = overviewPage <= 1;
  overviewNextBtnEl.disabled = totalKnown
    ? overviewPage * overviewPageSize >= overviewTotal
    : false;
}

function renderOverviewTable(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  overviewTbodyEl.innerHTML = "";
  if (!safeRows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.textContent = "No rows.";
    tr.appendChild(td);
    overviewTbodyEl.appendChild(tr);
    return;
  }

  for (const row of safeRows) {
    const tr = document.createElement("tr");

    const openTd = document.createElement("td");
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "cell-btn";
    openBtn.textContent = "Open";
    openBtn.addEventListener("click", () => {
      openLinkedIn(row?.url || "");
    });
    openTd.appendChild(openBtn);
    tr.appendChild(openTd);

    const archiveTd = document.createElement("td");
    const archiveBtn = document.createElement("button");
    archiveBtn.type = "button";
    archiveBtn.className = "cell-btn";
    archiveBtn.textContent = "Archive";
    archiveBtn.disabled = String(row?.archived || "") === "1";
    archiveBtn.addEventListener("click", async () => {
      await archiveRow(row?.url || "");
    });
    archiveTd.appendChild(archiveBtn);
    tr.appendChild(archiveTd);

    const nameTd = document.createElement("td");
    nameTd.className = "overview-cell-text";
    nameTd.textContent = row?.name || "";
    tr.appendChild(nameTd);

    const companyTd = document.createElement("td");
    companyTd.className = "overview-cell-text";
    companyTd.textContent = row?.company || "";
    tr.appendChild(companyTd);

    const statusTd = document.createElement("td");
    statusTd.className = "overview-cell-text";
    statusTd.textContent = row?.status || "";
    tr.appendChild(statusTd);

    const dateTd = document.createElement("td");
    dateTd.className = "overview-cell-text";
    dateTd.textContent = formatLocalDateTime(getOverviewLastRelevantDate(row));
    tr.appendChild(dateTd);

    const campaignTd = document.createElement("td");
    campaignTd.className = "overview-cell-text overview-cell-campaign";
    campaignTd.textContent = row?.campaign || "";
    tr.appendChild(campaignTd);

    const archivedTd = document.createElement("td");
    archivedTd.className = "overview-cell-text";
    archivedTd.textContent = row?.archived != null ? String(row.archived) : "";
    tr.appendChild(archivedTd);

    overviewTbodyEl.appendChild(tr);
  }
}

async function fetchOverviewPage() {
  setFooterFetchingStatus();
  overviewLoadingEl.hidden = false;
  try {
    const result = await sendRuntimeMessage("DB_LIST_INVITATIONS_OVERVIEW", {
      payload: buildOverviewQueryState(),
    });
    const resp = result.data || {};
    if (!result.ok) {
      overviewLoadingEl.hidden = true;
      overviewTbodyEl.innerHTML = "";
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 8;
      td.textContent = getErrorMessage(result.error);
      tr.appendChild(td);
      overviewTbodyEl.appendChild(tr);
      overviewTotal = null;
      renderOverviewPagination();
      return;
    }
    overviewTotal = Number.isFinite(resp?.total) ? resp.total : null;
    renderOverviewTable(resp?.rows || []);
    renderOverviewSortIndicators();
    renderOverviewPagination();
  } catch (e) {
    overviewTbodyEl.innerHTML = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.textContent = getErrorMessage(e);
    tr.appendChild(td);
    overviewTbodyEl.appendChild(tr);
  } finally {
    overviewLoadingEl.hidden = true;
    setFooterReady();
  }
}

async function openLinkedIn(url) {
  const targetUrl = String(url || "").trim();
  if (!targetUrl) return;
  const isLinkedInTarget =
    typeof LEF_UTILS.isLinkedInProfileLikeUrl === "function"
      ? LEF_UTILS.isLinkedInProfileLikeUrl(targetUrl)
      : /^https:\/\/www\.linkedin\.com\/(in|company)\/[^/?#]+/i.test(targetUrl);
  if (!isLinkedInTarget) return;
  await sendRuntimeMessage("OPEN_LINKEDIN_URL", {
    payload: { url: targetUrl },
  });
}

async function archiveRow(url) {
  setFooterDbStatus();
  const target = String(url || "").trim();
  if (!target) {
    setFooterReady();
    return;
  }
  try {
    const result = await sendRuntimeMessage("DB_ARCHIVE_INVITATION", {
      payload: { url: target },
    });
    if (!result.ok) {
      setFooterStatus(
        `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(result.error)}`,
      );
      return;
    }
    await fetchOverviewPage();
  } finally {
    setFooterReady();
  }
}

function wireOverviewEvents() {
  if (!OVERVIEW_ENABLED) return;
  document.querySelectorAll("[data-overview-sort]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const field = btn.getAttribute("data-overview-sort");
      if (!field) return;
      if (overviewSortField === field) {
        overviewSortDir = overviewSortDir === "asc" ? "desc" : "asc";
      } else {
        overviewSortField = field;
        overviewSortDir = "asc";
      }
      overviewPage = 1;
      fetchOverviewPage();
    });
  });

  overviewCampaignFilterEl?.addEventListener("input", () => {
    overviewFilters.campaign = overviewCampaignFilterEl.value.trim();
    overviewPage = 1;
    fetchOverviewPage();
  });

  overviewArchivedFilterEl?.addEventListener("change", () => {
    overviewFilters.archived = overviewArchivedFilterEl.value;
    overviewPage = 1;
    fetchOverviewPage();
  });

  overviewStatusFilterEl?.addEventListener("change", () => {
    overviewFilters.status = overviewStatusFilterEl.value;
    overviewPage = 1;
    fetchOverviewPage();
  });

  overviewSearchEl?.addEventListener("input", () => {
    if (overviewSearchDebounceTimer) clearTimeout(overviewSearchDebounceTimer);
    overviewSearchDebounceTimer = setTimeout(() => {
      overviewSearch = overviewSearchEl.value.trim();
      overviewPage = 1;
      fetchOverviewPage();
    }, 250);
  });

  overviewPageSizeEl?.addEventListener("change", () => {
    const nextSize = Number(overviewPageSizeEl.value);
    overviewPageSize = Number.isFinite(nextSize) ? nextSize : 25;
    overviewPage = 1;
    fetchOverviewPage();
  });

  overviewPrevBtnEl?.addEventListener("click", () => {
    if (overviewPage <= 1) return;
    overviewPage -= 1;
    fetchOverviewPage();
  });

  overviewNextBtnEl?.addEventListener("click", () => {
    if (
      Number.isFinite(overviewTotal) &&
      overviewPage * overviewPageSize >= overviewTotal
    ) {
      return;
    }
    overviewPage += 1;
    fetchOverviewPage();
  });
}

function getProfileForGeneration(profile) {
  const p = profile || {};
  const out = {};

  const copyKeys = [
    "url",
    "profile_url",
    "linkedin_url",
    "name",
    "full_name",
    "first_name",
    "headline",
    "company",
    "location",
    "about",
    "recent_experience",
  ];

  for (const key of copyKeys) {
    if (p[key] !== undefined && p[key] !== null) {
      out[key] = p[key];
    }
  }

  if (p.excerpt_fallback) {
    out.excerpt_fallback = p.excerpt_fallback;
  }

  return out;
}

function getLinkedinUrlFromContext(profileContext) {
  return (
    profileContext?.url ||
    profileContext?.profile_url ||
    profileContext?.linkedin_url ||
    null
  );
}

function getFullNameFromContext(profileContext) {
  return profileContext?.name || profileContext?.full_name || null;
}

async function extractProfileContextFromActiveTab() {
  const result = await sendRuntimeMessage("SCRAPE_PROFILE_CONTEXT");
  const resp = result.data || {};
  if (!resp?.ok || !resp?.data?.profile) {
    throw new Error(
      getErrorMessage(result.error || resp?.error) ||
        "profile extraction failed",
    );
  }
  return getProfileForGeneration(resp.data.profile);
}

async function loadProfileContextOnOpen() {
  try {
    const profileContext = await extractProfileContextFromActiveTab();
    currentProfileContext = profileContext;
    lastProfileContextSent = profileContext;
    lastProfileContextEnriched = null;
    updateMessageTabControls();
    await refreshInvitationRowFromDb();
    renderDetailHeader();
    updatePhaseButtons();
    if (IS_SIDE_PANEL_CONTEXT) {
      setActiveTab("detail", { userInitiated: true });
    }
  } catch (_e) {
    currentProfileContext = null;
    lastProfileContextSent = {};
    lastProfileContextEnriched = null;
    dbInvitationRow = null;
    updateMessageTabControls();
    setCommunicationStatus(UI_TEXT.lifecycleOpenLinkedInProfileFirst);
    renderDetailHeader();
    updatePhaseButtons();
    if (IS_SIDE_PANEL_CONTEXT && OVERVIEW_ENABLED) {
      setActiveTab("overview", { userInitiated: true });
    }
  }
}

async function loadFirstMessagePrompt() {
  if (!messagePromptEl) return;
  const { [STORAGE_KEY_FIRST_MESSAGE_PROMPT]: savedPrompt } =
    await chrome.storage.sync.get([STORAGE_KEY_FIRST_MESSAGE_PROMPT]);

  if (typeof savedPrompt === "string" && savedPrompt.trim()) {
    messagePromptEl.value = savedPrompt;
  }

  lastSavedFirstMessagePrompt = messagePromptEl.value;
  updateSavePromptButtonState();
}

function normalizeLanguageValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = SUPPORTED_LANGUAGES.find(
    (lang) => lang.toLowerCase() === raw.toLowerCase(),
  );
  return match || "";
}

function getLanguageSelectElements() {
  return [inviteLanguageEl, messageLanguageEl].filter(Boolean);
}

function getLanguage() {
  return normalizeLanguageValue(currentLanguage) || "Portuguese";
}

async function setLanguage(value, { persist = true } = {}) {
  const normalized = normalizeLanguageValue(value) || "Portuguese";
  currentLanguage = normalized;
  getLanguageSelectElements().forEach((el) => {
    if (el.value !== normalized) {
      el.value = normalized;
    }
  });
  if (currentProfileContext) {
    currentProfileContext.language = normalized;
  }
  if (persist) {
    await chrome.storage.local.set({
      [STORAGE_KEY_MESSAGE_LANGUAGE]: normalized,
    });
  }
}

async function loadMessageLanguage() {
  const { [STORAGE_KEY_MESSAGE_LANGUAGE]: savedLanguage } =
    await chrome.storage.local.get([STORAGE_KEY_MESSAGE_LANGUAGE]);
  if (typeof savedLanguage === "string" && savedLanguage.trim()) {
    await setLanguage(savedLanguage.trim(), { persist: false });
    return;
  }
  await setLanguage("Portuguese", { persist: false });
}

async function copyToClipboard(text) {
  const value = (text || "").trim();
  if (!value) throw new Error("Nothing to copy.");

  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch (_err) {
    // Fallback below
  }

  const ta = document.createElement("textarea");
  ta.value = value;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "-9999px";
  document.body.appendChild(ta);

  ta.select();
  ta.setSelectionRange(0, ta.value.length);

  const ok = document.execCommand("copy");
  document.body.removeChild(ta);

  if (!ok) throw new Error("Copy failed (execCommand).");
}

function setCopyButtonEnabled(enabled) {
  if (copyInviteIconEl) {
    copyInviteIconEl.hidden = !enabled;
  }
}

function setInviteSaveButtonEnabled(enabled) {
  if (saveInviteBtnEl) {
    saveInviteBtnEl.hidden = !enabled;
  }
}

function showInviteCopySuccessCheck() {
  if (!copyInviteIconEl) return;
  copyInviteIconEl.textContent = "\u2713";
  if (inviteCopyIconResetTimer) {
    clearTimeout(inviteCopyIconResetTimer);
  }
  inviteCopyIconResetTimer = setTimeout(() => {
    if (copyInviteIconEl) {
      copyInviteIconEl.textContent = "\u29c9";
    }
    inviteCopyIconResetTimer = null;
  }, 1000);
}

function showFirstMessageCopySuccessCheck() {
  if (!copyFirstMessageBtnEl) return;
  copyFirstMessageBtnEl.textContent = "\u2713";
  if (firstMessageCopyIconResetTimer) {
    clearTimeout(firstMessageCopyIconResetTimer);
  }
  firstMessageCopyIconResetTimer = setTimeout(() => {
    if (copyFirstMessageBtnEl) {
      copyFirstMessageBtnEl.textContent = "\u29c9";
    }
    firstMessageCopyIconResetTimer = null;
  }, 1000);
}

function showFollowupCopySuccessCheck() {
  if (!copyFollowupBtnEl) return;
  copyFollowupBtnEl.textContent = "\u2713";
  if (followupCopyIconResetTimer) {
    clearTimeout(followupCopyIconResetTimer);
  }
  followupCopyIconResetTimer = setTimeout(() => {
    if (copyFollowupBtnEl) {
      copyFollowupBtnEl.textContent = "\u29c9";
    }
    followupCopyIconResetTimer = null;
  }, 1000);
}

function updateInviteCopyIconVisibility() {
  const normalizedPreview =
    typeof normalizeWhitespace === "function"
      ? normalizeWhitespace(previewEl.textContent || "")
      : String(previewEl.textContent || "").trim();
  if (!normalizedPreview && copyInviteIconEl) {
    copyInviteIconEl.textContent = "\u29c9";
  }
  const hasPreview = Boolean(normalizedPreview);
  setCopyButtonEnabled(hasPreview);
  setInviteSaveButtonEnabled(hasPreview);
}

function updateFollowupCopyIconVisibility() {
  if (!copyFollowupBtnEl || !followupPreviewEl) return;
  const hasText = (followupPreviewEl.value || "").trim().length > 0;
  if (!hasText) {
    copyFollowupBtnEl.textContent = "\u29c9";
  }
  copyFollowupBtnEl.hidden = !hasText;
}

async function onInvitationTabOpenedByUser() {
  setFooterStatus(UI_TEXT.preparingProfile);
  await loadProfileContextOnOpen();
}

async function refreshMessagesTab({ reason = "manual_refresh" } = {}) {
  debug("refreshMessagesTab:", reason);
  setFooterStatus(UI_TEXT.preparingProfile);
  await loadProfileContextOnOpen();
  outreachMessageStatus = getOutreachStatusFromDbRow();
  renderMessageTab(outreachMessageStatus);
  updateMessageTabControls();
  await refreshChatHistoryFromActiveTab();
}

async function onMessagesTabOpenedByUser() {
  await refreshMessagesTab({ reason: "tab_click" });
}

function setActiveTab(which, { userInitiated = false } = {}) {
  if (IS_SIDE_PANEL_CONTEXT && !userInitiated) {
    return;
  }
  const detailActive = which === "detail" || which === "invitation";
  const overviewActive = OVERVIEW_ENABLED && which === "overview";
  const configActive = which === "config";

  tabMainBtn.classList.toggle("active", detailActive);
  if (tabOverviewBtn) tabOverviewBtn.classList.toggle("active", overviewActive);
  tabConfigBtn.classList.toggle("active", configActive);

  tabMain.classList.toggle("active", detailActive);
  if (tabOverview) tabOverview.classList.toggle("active", overviewActive);
  tabConfig.classList.toggle("active", configActive);
  if (tabMessage)
    tabMessage.hidden = !detailActive || detailInnerTab === "invite";

  if (overviewActive) {
    fetchOverviewPage();
  }
}

tabMainBtn.addEventListener("click", async () => {
  setFooterFetchingStatus();
  try {
    setActiveTab("detail", { userInitiated: true });
    await onInvitationTabOpenedByUser();
  } finally {
    setFooterReady();
  }
});
tabMessageBtn?.addEventListener("click", async () => {
  setFooterFetchingStatus();
  try {
    setActiveTab("detail", { userInitiated: true });
    await onMessagesTabOpenedByUser();
    setDetailInnerTab("first");
  } finally {
    setFooterReady();
  }
});
tabOverviewBtn?.addEventListener("click", () =>
  setActiveTab("overview", { userInitiated: true }),
);
tabConfigBtn.addEventListener("click", () =>
  setActiveTab("config", { userInitiated: true }),
);

async function loadSettings() {
  const [{ apiKey, webhookSecret }, { model, strategyCore, webhookBaseUrl }] =
    await Promise.all([
      chrome.storage.local.get(["apiKey", "webhookSecret"]),
      chrome.storage.sync.get(["model", "strategyCore", "webhookBaseUrl"]),
    ]);

  if (apiKey) apiKeyEl.value = apiKey;
  if (webhookSecret) webhookSecretEl.value = webhookSecret;

  modelEl.value = model || "gpt-4.1";
  if (strategyCore) strategyEl.value = strategyCore;
  if (webhookBaseUrl) webhookBaseUrlEl.value = webhookBaseUrl;
}
loadSettings();
if (IS_SIDE_PANEL_CONTEXT) {
  document.body.classList.add("is-sidepanel");
}
if (IS_SIDE_PANEL_CONTEXT && openSidePanelBtnEl) {
  openSidePanelBtnEl.classList.add("is-hidden");
}
if (!OVERVIEW_ENABLED) {
  tabOverviewBtn?.classList.add("is-hidden");
  tabOverview?.classList.remove("active");
  tabOverview?.classList.add("is-hidden");
}
if (detailMessageMountEl && tabMessage) {
  tabMessage.classList.remove("tab-panel");
  tabMessage.classList.add("detail-inner-panel");
  detailMessageMountEl.appendChild(tabMessage);
}
if (markMessageSentBtnEl) {
  markMessageSentBtnEl.hidden = true;
}
detailTabInviteBtnEl?.addEventListener("click", async () => {
  setFooterFetchingStatus();
  try {
    setDetailInnerTab("invite");
    await onInvitationTabOpenedByUser();
    setDetailInnerTab("invite");
  } finally {
    setFooterReady();
  }
});
detailTabFirstMessageBtnEl?.addEventListener("click", async () => {
  setFooterFetchingStatus();
  try {
    await onMessagesTabOpenedByUser();
    setDetailInnerTab("first");
  } finally {
    setFooterReady();
  }
});
detailTabFollowBtnEl?.addEventListener("click", async () => {
  setFooterFetchingStatus();
  try {
    await onMessagesTabOpenedByUser();
    setDetailInnerTab("follow");
  } finally {
    setFooterReady();
  }
});
setCopyButtonEnabled(false);
updateInviteCopyIconVisibility();
updateFollowupCopyIconVisibility();
setMessagePromptCollapsed(true);
updateMessageTabControls();
if (OVERVIEW_ENABLED) {
  wireOverviewEvents();
  overviewPageSize = Number(overviewPageSizeEl?.value || 25);
  renderOverviewSortIndicators();
  renderOverviewPagination();
}
setFooterReady();
setCommunicationStatus("Ready");
applyLifecycleUiState(dbInvitationRow);
renderMessageTab(outreachMessageStatus);
setDetailInnerTab("invite");
renderDetailHeader();
updatePhaseButtons();
loadProfileContextOnOpen();
loadFirstMessagePrompt().catch((_e) => {
  lastSavedFirstMessagePrompt = messagePromptEl?.value || "";
  updateSavePromptButtonState();
});
loadMessageLanguage().catch((_e) => {});

toggleMessagePromptBtnEl?.addEventListener("click", () => {
  setMessagePromptCollapsed(!isMessagePromptCollapsed);
});

messagePromptEl?.addEventListener("input", () => {
  updateSavePromptButtonState();
});

getLanguageSelectElements().forEach((el) => {
  el.addEventListener("change", async () => {
    await setLanguage(el.value);
  });
});

saveMessagePromptBtnEl?.addEventListener("click", async () => {
  if (!messagePromptEl) return;
  setFooterUpdatingStatus();
  try {
    const promptValue = messagePromptEl.value;
    await chrome.storage.sync.set({
      [STORAGE_KEY_FIRST_MESSAGE_PROMPT]: promptValue,
    });
    lastSavedFirstMessagePrompt = promptValue;
    updateSavePromptButtonState();
    setFooterStatus(UI_TEXT.promptSaved);
  } finally {
    setFooterReady();
  }
});

resetMessagePromptBtnEl?.addEventListener("click", () => {
  if (!messagePromptEl) return;
  messagePromptEl.value = DEFAULT_FIRST_MESSAGE_PROMPT;
  updateSavePromptButtonState();
  setFooterStatus(UI_TEXT.promptReset);
});

async function saveConfig() {
  const apiKey = (apiKeyEl.value || "").trim();
  const model = (modelEl.value || "gpt-4.1").trim();
  const strategyCore = (strategyEl.value || "").trim();

  const webhookBaseUrl = (webhookBaseUrlEl.value || "")
    .trim()
    .replace(/\/+$/, "");
  const webhookSecret = (webhookSecretEl.value || "").trim();

  await chrome.storage.local.set({ apiKey, webhookSecret });
  await chrome.storage.sync.set({ model, strategyCore, webhookBaseUrl });

  setFooterStatus(UI_TEXT.configSaved);
}

document.getElementById("saveConfig").addEventListener("click", async () => {
  setFooterUpdatingStatus();
  try {
    await saveConfig();
  } finally {
    setFooterReady();
  }
});

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
      profileContextForGeneration = await extractProfileContextFromActiveTab();
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

bindGenerateFirstMessageClickHandler();

async function extractAndPersistProfileDetails() {
  const extracted = await extractProfileDetailsFromLlm();

  setFooterUpdatingStatus();
  const saveResult = await sendRuntimeMessage(
    "DB_UPDATE_PROFILE_DETAILS_ONLY",
    {
      payload: {
        linkedin_url: extracted.linkedin_url,
        company: extracted.company || undefined,
        headline: extracted.headline || undefined,
        language: extracted.language || getLanguage(),
      },
    },
  );
  const saveResp = saveResult.data || {};

  if (!saveResult.ok || !saveResp?.ok) {
    throw new Error(
      `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(saveResult.error || saveResp?.error)}`,
    );
  }
}

async function extractProfileDetailsFromLlm() {
  const profileContext = await extractProfileContextFromActiveTab();
  currentProfileContext = profileContext;
  lastProfileContextSent = profileContext;
  lastProfileContextEnriched = null;
  renderDetailHeader();

  const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedin_url) {
    throw new Error(UI_TEXT.missingLinkedinUrl);
  }

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
    setActiveTab("config");
    throw new Error(UI_TEXT.setApiKeyInConfig);
  }

  const enrichResult = await sendRuntimeMessage("ENRICH_PROFILE", {
    // prompt: buildProfileExtractionPrompt (Enrich/Register)
    payload: {
      apiKey,
      model: (model || "gpt-4.1").trim(),
      profile: { ...currentProfileContext },
    },
  });
  const enrichResp = enrichResult.data || {};

  if (!enrichResult.ok || !enrichResp?.ok) {
    throw new Error(getErrorMessage(enrichResult.error || enrichResp?.error));
  }

  const llmCompany = (enrichResp.company || "").trim();
  const llmHeadline = sanitizeHeadlineJobTitle(enrichResp.headline || "");
  const llmLanguage = (enrichResp.language || "").trim();

  if (llmCompany) {
    currentProfileContext.company = llmCompany;
    if (detailCompanyEl) detailCompanyEl.textContent = llmCompany;
  }
  if (llmHeadline) {
    currentProfileContext.headline = llmHeadline;
    if (detailHeadlineEl) detailHeadlineEl.textContent = llmHeadline;
  }
  const normalizedLlmLanguage = normalizeLanguageValue(llmLanguage);
  if (normalizedLlmLanguage) {
    await setLanguage(normalizedLlmLanguage);
  }

  const nameFromProfile = (getFullNameFromContext(currentProfileContext) || "")
    .toString()
    .trim();
  const nameFromUi = (detailPersonNameEl?.textContent || "").trim();
  const full_name =
    nameFromProfile || (nameFromUi && nameFromUi !== "-" ? nameFromUi : "");

  return {
    linkedin_url,
    full_name,
    company: llmCompany,
    headline: llmHeadline,
    language: getLanguage(),
  };
}

if (!enrichProfileBtnEl) {
  console.error("[LEF] enrichProfileBtn element not found");
} else {
  enrichProfileBtnEl.addEventListener("click", async () => {
    setFooterLlmStatus();
    try {
      await extractAndPersistProfileDetails();
      await refreshInvitationRowFromDb();
      renderDetailHeader();
    } catch (e) {
      console.error("[LEF] enrichProfile failed", e);
      setFooterStatus(`${UI_TEXT.errorPrefix} ${getErrorMessage(e)}`);
    } finally {
      setFooterReady();
    }
  });
}

async function upsertCurrentProfileWithStatus(statusValue) {
  if (!currentProfileContext) return { ok: false, error: "missing_profile" };
  const linkedinUrl = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedinUrl) return { ok: false, error: "missing_url" };
  const fullName = getFullNameFromContext(currentProfileContext);
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
  try {
    const extracted = await extractProfileDetailsFromLlm();
    setFooterDbStatus();
    const result = await sendRuntimeMessage("DB_UPSERT_GENERATED", {
      payload: {
        linkedin_url: extracted.linkedin_url,
        full_name: extracted.full_name || null,
        company: extracted.company || null,
        headline: extracted.headline || null,
        language: extracted.language || getLanguage(),
        status: "registered",
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
  await setStatusOnlyForStepper("invited", UI_TEXT.markedInvited);
}

async function onStepAcceptedClick() {
  await setStatusOnlyForStepper("accepted", UI_TEXT.markedAccepted);
}

async function onStepFirstMessageSentClick() {
  await setStatusOnlyForStepper(
    "first message sent",
    UI_TEXT.markedFirstMessageSent,
  );
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
      return;
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

async function markStatusDirect(statusValue, successText) {
  await setStatusOnlyForStepper(statusValue, successText);
}

statusBackBtnEl?.addEventListener("click", async () => {
  if (!statusBackTarget) return;
  if (statusBackTarget === "registered") {
    await markStatusDirect("registered", "Back to registered");
    return;
  }
  if (statusBackTarget === "invited") {
    await markStatusDirect("invited", "Back to invited");
    return;
  }
  if (statusBackTarget === "accepted") {
    await markStatusDirect("accepted", "Back to accepted");
    return;
  }
  if (statusBackTarget === "first message sent") {
    await markStatusDirect("first message sent", "Back to first message sent");
  }
});

statusForwardBtnEl?.addEventListener("click", async () => {
  if (!statusForwardTarget) return;
  if (statusForwardTarget === "registered") {
    await onStepRegisterClick();
    return;
  }
  if (statusForwardTarget === "invited") {
    await onStepInvitedClick();
    return;
  }
  if (statusForwardTarget === "accepted") {
    await onStepAcceptedClick();
    return;
  }
  if (statusForwardTarget === "first message sent") {
    await onStepFirstMessageSentClick();
    return;
  }
  if (statusForwardTarget === "message responded") {
    await onStepMessageRespondedClick();
  }
});

copyInviteIconEl?.addEventListener("click", async () => {
  try {
    await copyToClipboard(previewEl.textContent || "");
    showInviteCopySuccessCheck();
    setFooterStatus(UI_TEXT.copiedToClipboard);
  } catch (e) {
    setFooterStatus(`${UI_TEXT.copyFailedPrefix} ${getErrorMessage(e)}`);
  }
});

function bindFirstMessageCopyHandler() {
  if (!copyFirstMessageBtnEl) {
    debugLog("[copy] missing #copyFirstMessage");
    return;
  }
  if (!firstMessagePreviewEl) {
    debugLog("[copy] missing #firstMessagePreview");
    return;
  }
  if (copyFirstMessageBtnEl.dataset.bound === "1") return;
  copyFirstMessageBtnEl.dataset.bound = "1";
  copyFirstMessageBtnEl.addEventListener("click", async () => {
    try {
      const previewText =
        firstMessage ||
        ("value" in firstMessagePreviewEl
          ? firstMessagePreviewEl.value
          : firstMessagePreviewEl.textContent) ||
        "";
      await copyToClipboard(previewText);
      showFirstMessageCopySuccessCheck();
      setFooterStatus(UI_TEXT.copiedToClipboard);
    } catch (e) {
      setFooterStatus(`${UI_TEXT.copyFailedPrefix} ${getErrorMessage(e)}`);
    }
    updateMessageTabControls();
  });
}

bindFirstMessageCopyHandler();

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

bindSaveInviteClickHandler();
bindSaveFirstMessageClickHandler();

function bindOpenSidePanelClickHandler() {
  if (!openSidePanelBtnEl) return;
  if (openSidePanelBtnEl.dataset.sidePanelBound === "1") return;
  openSidePanelBtnEl.dataset.sidePanelBound = "1";
  openSidePanelBtnEl.addEventListener("click", async () => {
    setFooterFetchingStatus();
    try {
      debugLog("[sidepanel] open requested from popup click");
      const activeTabResult = await sendRuntimeMessage(
        "GET_ACTIVE_TAB_CONTEXT",
      );
      const activeTabResp = activeTabResult.data || {};
      const tabId = activeTabResp?.data?.tabId;
      if (!Number.isInteger(tabId)) {
        setFooterStatus(UI_TEXT.sidePanelNotAvailable);
        return;
      }
      await chrome.sidePanel.setOptions({
        tabId,
        path: "sidepanel.html",
        enabled: true,
      });
      await chrome.sidePanel.open({ tabId });
      setFooterStatus(UI_TEXT.openedSidePanel);
      window.close();
    } catch (e) {
      console.error("[sidepanel] open failed", e);
      setFooterStatus(UI_TEXT.sidePanelNotAvailable);
    } finally {
      setFooterReady();
    }
  });
}

bindOpenSidePanelClickHandler();

if (!document.getElementById("generate")) {
  console.error("[invite] missing #generate button");
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

    const profileContext = await extractProfileContextFromActiveTab();
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

bindGenerateInviteClickHandler();

markMessageSentBtnEl?.addEventListener("click", async () => {
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

if (!generateFollowupBtnEl) {
  console.error("[followup] missing #generateFollowup");
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

    if (!hasMessageProfileUrl()) {
      setFooterStatus(UI_TEXT.openLinkedInProfileFirst);
      return;
    }

    if (!currentProfileContext) {
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
        profile_context: { ...currentProfileContext },
        profileContext: { ...currentProfileContext },
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

bindGenerateFollowupClickHandler();

function bindFollowupCopyHandler() {
  if (!copyFollowupBtnEl) {
    debugLog("[copy] missing #copyFollowup");
    return;
  }
  if (!followupPreviewEl) {
    debugLog("[copy] missing #followupPreview");
    return;
  }
  if (copyFollowupBtnEl.dataset.bound === "1") return;
  copyFollowupBtnEl.dataset.bound = "1";
  copyFollowupBtnEl.addEventListener("click", async () => {
    try {
      const previewText =
        ("value" in followupPreviewEl
          ? followupPreviewEl.value
          : followupPreviewEl.textContent) || "";
      await copyToClipboard(previewText);
      showFollowupCopySuccessCheck();
      setFooterStatus("Copied");
    } catch (e) {
      const msg = getErrorMessage(e);
      setFooterStatus(msg);
      console.error("[LEF][chat] followup copy failed", e);
    }
  });
}

bindFollowupCopyHandler();

followupPreviewEl?.addEventListener("input", () => {
  updateFollowupCopyIconVisibility();
});

followupObjectiveEl?.addEventListener("input", () => {
  if ((followupObjectiveEl.value || "").trim()) {
    followupObjectiveEl.classList.remove("is-invalid");
  }
});
