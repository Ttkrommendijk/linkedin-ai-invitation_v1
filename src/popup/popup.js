const apiKeyEl = document.getElementById("apiKey");
const modelEl = document.getElementById("model");
const strategyEl = document.getElementById("strategy");
const focusEl = document.getElementById("focus");
const messageLanguageEl = document.getElementById("messageLanguage");
const inviteLanguageEl = document.getElementById("inviteLanguage");
const messagePromptEl = document.getElementById("messagePrompt");
const messagePromptWrapEl =
  document.getElementById("firstPromptContainer") ||
  document.getElementById("messagePromptWrap");
const toggleMessagePromptBtnEl =
  document.getElementById("togglePrompt") ||
  document.getElementById("toggleMessagePrompt");
const toggleInvitePromptBtnEl = document.getElementById("toggleInvitePrompt");
const invitePromptWrapEl = document.getElementById("invitePromptWrap");
const invitePromptPreviewEl = document.getElementById("invitePromptPreview");
const saveMessagePromptBtnEl = document.getElementById("saveMessagePrompt");
const resetMessagePromptBtnEl = document.getElementById("resetMessagePrompt");
const generateFirstMessageBtnEl = document.getElementById(
  "generateFirstMessage",
);
const markMessageSentBtnEl =
  document.getElementById("markFirstMessageSent") ||
  document.getElementById("markMessageSent");
const copyFirstMessageBtnEl = document.getElementById("copyFirstMessage");
const chatHistoryEl = document.getElementById("chatHistory");
const refreshChatHistoryBtnEl = document.getElementById("refreshChatHistory");
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
const commStatusEl =
  document.getElementById("commStatusBar") ||
  document.getElementById("commStatus");
const footerStatusEl = document.getElementById("commFooterText");
const followupPreviewEl = document.getElementById("followupPreview");
const copyFollowupBtnEl = document.getElementById("copyFollowup");

const EMOJI_CHECK = "\u2705";
const SYMBOL_ELLIPSIS = "\u2026";
const DEBUG = false;
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
const DEFAULT_FIRST_MESSAGE_PROMPT = messagePromptEl.value;
const LEF_UTILS = globalThis.LEFUtils || {};
const LEF_PROMPTS = globalThis.LEFPrompts || {};
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
  if (DEBUG) console.log(...args);
}

const statusEl = document.getElementById("status") || commStatusEl;
const messageStatusEl =
  document.getElementById("messageStatus") || commStatusEl;
const previewEl = document.getElementById("preview");
const firstMessagePreviewEl = document.getElementById("firstMessagePreview");
const copyBtnEl = document.getElementById("copyBtn");
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
let isInvitePromptCollapsed = true;
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
const OVERVIEW_ENABLED = Boolean(
  IS_SIDE_PANEL_CONTEXT && tabOverviewBtn && tabOverview,
);

function getLifecycleStatusValue(dbRow) {
  return (dbRow?.status || "").trim().toLowerCase();
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
  const isFirstMessageSent = status === "first_message_sent";
  if (acceptedModeEl) acceptedModeEl.hidden = isFirstMessageSent;
  if (firstMessageSentModeEl)
    firstMessageSentModeEl.hidden = !isFirstMessageSent;
  if (initialMessageSectionEl)
    initialMessageSectionEl.hidden = isFirstMessageSent;
  if (firstMessagePreviewSectionEl) {
    firstMessagePreviewSectionEl.hidden = isFirstMessageSent;
  }
  if (followupSectionEl) followupSectionEl.hidden = !isFirstMessageSent;
  if (commStatusEl) commStatusEl.textContent = status;
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

function sanitizeHeadlineJobTitle(value) {
  let out = (value || "").toString().trim();
  if (!out) return "";
  const patterns = [
    /^\s*\d+\s*[º°]\s+/i,
    /^\s*\d+\s*[-–.]\s+/i,
    /^\s*#\s*\d+\s+/i,
    /^\s*(i|ii|iii|iv|v|vi|vii|viii|ix|x)\s+/i,
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of patterns) {
      const next = out.replace(pattern, "").trim();
      if (next !== out) {
        out = next;
        changed = true;
      }
    }
  }
  return out;
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
  if (typeof LEF_UTILS.normalizeWhitespace === "function") {
    return LEF_UTILS.normalizeWhitespace(value || "");
  }
  return (value || "").toString().trim().replace(/\s+/g, " ");
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
  if (!chatHistoryEl) return;
  chatHistoryEl.value = "Loading chat history...";
  extractedChatMessages = [];
  const reqId = `chat_${Date.now()}_${++chatExtractSeq}`;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.groupCollapsed(
    `[LEF][chat][${reqId}] refreshChatHistoryFromActiveTab`,
  );
  console.log("tab", { id: tab?.id, url: tab?.url });
  console.log("state", { IS_SIDE_PANEL_CONTEXT, outreachMessageStatus });
  console.groupEnd();

  if (!tab?.id) {
    chatHistoryEl.value = "Could not find active tab.";
    return;
  }

  chrome.tabs.sendMessage(
    tab.id,
    { type: "EXTRACT_CHAT_HISTORY", reqId },
    (resp) => {
      console.groupCollapsed(`[LEF][chat][${reqId}] response`);
      console.log("ok", resp?.ok);
      console.log("error", resp?.error);
      console.log("meta", resp?.meta || null);
      console.log("extract_meta", resp?.meta || null);
      console.log(
        "count_raw",
        Array.isArray(resp?.messages) ? resp.messages.length : null,
      );
      const lastErr = chrome.runtime.lastError;
      if (lastErr) {
        console.error("[LEF][chat] sendMessage lastError", lastErr.message);
        chatHistoryEl.value = `sendMessage error: ${lastErr.message}`;
        console.groupEnd();
        return;
      }

      if (!resp) {
        console.warn("[LEF][chat] no response from content script");
        chatHistoryEl.value =
          "No response from content script. Ensure you're on https://www.linkedin.com/in/* and reload the extension/page.";
        console.groupEnd();
        return;
      }

      if (!resp.ok) {
        if (resp?.code === "NO_MESSAGE_BOX" || resp?.user_warning) {
          chatHistoryEl.value =
            resp?.user_warning || "Please open a message box.";
          console.log("[LEF][chat] warning", {
            code: resp?.code || null,
            user_warning: resp?.user_warning || null,
          });
          console.groupEnd();
          return;
        }
        console.warn("[LEF][chat] extract failed", resp.error);
        if (resp.stack) console.warn("[LEF][chat] stack", resp.stack);
        if (isMessageBoxMissingError(resp.error)) {
          chatHistoryEl.value = "Please open a message box.";
          console.groupEnd();
          return;
        }
        chatHistoryEl.value = `extract error: ${resp.error || "unknown"}${
          resp.stack ? `\n\nstack:\n${resp.stack}` : ""
        }`;
        console.groupEnd();
        return;
      }

      const messages = Array.isArray(resp.messages) ? resp.messages : [];
      console.groupCollapsed(`[LEF][chat][${reqId}] popup received messages`);
      console.log("rawCount", messages.length);
      console.log("ordering_meta", {
        hasAnySortTsIso: false,
        dayHeadingSample:
          messages.find((m) => (m?.dateLabel || "").trim())?.dateLabel || "",
        sortTsIsoSample: "",
      });
      messages.forEach((m, i) => {
        const entry = toChatLogEntry(m, i);
        const datetime = entry.datetimeForDebug;
        if (!entry.dt_label) {
          console.error(
            `[LEF][chat][${reqId}] missing dt_label at index ${i}`,
            entry,
          );
        }
        const previewText =
          entry.text.length > 120
            ? `${entry.text.slice(0, 117).trim()}...`
            : entry.text;
        console.log(
          `[LEF][chat][${reqId}] [${String(i).padStart(2, "0")}] [li:${entry.liIndex}] ${entry.dayHeading || "NO_HEADING"} | ${entry.name || "Unknown"} | ${entry.time || "NO_TIME"} | ${previewText}`,
        );
        console.log(entry);
      });
      extractedChatMessages = messages;
      chatHistoryEl.value = formatChatHistory(messages);
      console.log("render", {
        extractedCount: extractedChatMessages.length,
        renderedChars: (chatHistoryEl.value || "").length,
      });
      console.groupEnd();
      console.groupEnd();
    },
  );
}

function setMessagePromptCollapsed(collapsed) {
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

function setInvitePromptCollapsed(collapsed) {
  isInvitePromptCollapsed = collapsed;
  if (invitePromptWrapEl) {
    invitePromptWrapEl.hidden = collapsed;
  }
  if (!toggleInvitePromptBtnEl) return;
  toggleInvitePromptBtnEl.textContent = collapsed ? "Show" : "Hide";
  toggleInvitePromptBtnEl.setAttribute(
    "aria-expanded",
    collapsed ? "false" : "true",
  );
}

async function loadInvitePromptPreview() {
  if (!invitePromptPreviewEl) return;
  const promptText =
    typeof LEF_PROMPTS.buildInviteTextPrompt === "function"
      ? LEF_PROMPTS.buildInviteTextPrompt({
          language: "Portuguese",
          additionalPrompt: "",
        })
      : "";
  invitePromptPreviewEl.value = String(promptText).trim();
}

function setCommunicationStatus(text) {
  setFooterStatus(text || "Ready");
  if (!commStatusEl) return;
  commStatusEl.textContent = text || "Ready";
}

function setFooterStatus(text) {
  if (!footerStatusEl) return;
  footerStatusEl.textContent = text || "Ready";
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

function applyLifecycleUiState(dbRow) {
  const generateBtn = document.getElementById("generate");

  if (!generateBtn) return;
  updateGenerateFirstMessageButtonLabel();

  generateBtn.disabled = false;

  const status = getLifecycleStatusValue(dbRow);
  const dbMessage = (dbRow?.message || "").trim();
  if (dbMessage) {
    previewEl.textContent = dbMessage;
    setCopyButtonEnabled(true);
  }

  if (status === "generated") {
    setActiveTab("detail");
    setDetailInnerTab("invite");
    if (dbMessage) {
      previewEl.textContent = dbMessage;
      setCopyButtonEnabled(true);
    }
    return;
  }

  if (status === "invited") {
    setActiveTab("detail");
    setDetailInnerTab("invite");
    if (dbMessage) {
      previewEl.textContent = dbMessage;
      setCopyButtonEnabled(true);
    }
    generateBtn.disabled = true;
    return;
  }

  if (status === "accepted" || status === "first message sent") {
    setActiveTab("detail");
    setDetailInnerTab("first");
    generateBtn.disabled = true;
    if (dbMessage) {
      previewEl.textContent = dbMessage;
      setCopyButtonEnabled(true);
    }
  }

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

async function refreshInvitationRowFromDb() {
  setFooterFetchingStatus();
  const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedin_url) {
    dbInvitationRow = null;
    setCommunicationStatus(UI_TEXT.lifecycleOpenLinkedInProfileFirst);
    applyLifecycleUiState(dbInvitationRow);
    outreachMessageStatus = "accepted";
    renderMessageTab(outreachMessageStatus);
    renderDetailHeader();
    updatePhaseButtons();
    setFooterStatus("Ready");
    return;
  }

  try {
    const resp = await chrome.runtime.sendMessage({
      type: "DB_GET_INVITATION",
      payload: { linkedin_url },
    });

    if (!resp?.ok) {
      dbInvitationRow = null;
      setCommunicationStatus(getErrorMessage(resp?.error));
      applyLifecycleUiState(dbInvitationRow);
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
    applyLifecycleUiState(dbInvitationRow);
    outreachMessageStatus = getOutreachStatusFromDbRow();
    if (outreachMessageStatus === "first_message_sent") {
      await chrome.storage.local.set({ message_status: "first_message_sent" });
    }
    renderMessageTab(outreachMessageStatus);
    updateMessageTabControls();
    renderDetailHeader();
    updatePhaseButtons();
  } finally {
    setFooterStatus("Ready");
  }
}

function hasMessageProfileUrl() {
  return Boolean(getLinkedinUrlFromContext(currentProfileContext));
}

function updateSavePromptButtonState() {
  saveMessagePromptBtnEl.disabled =
    messagePromptEl.value === lastSavedFirstMessagePrompt;
  resetMessagePromptBtnEl.disabled =
    messagePromptEl.value === DEFAULT_FIRST_MESSAGE_PROMPT;
}

function updateMessageTabControls() {
  const hasProfileUrl = hasMessageProfileUrl();
  const hasGeneratedFirstMessage = Boolean(
    (firstMessagePreviewEl.textContent || "").trim(),
  );
  const isFirstMessageSent = outreachMessageStatus === "first_message_sent";

  generateFirstMessageBtnEl.disabled = !hasProfileUrl;
  copyFirstMessageBtnEl.disabled = !hasGeneratedFirstMessage;
  markMessageSentBtnEl.disabled =
    isFirstMessageSent || !(hasProfileUrl && hasGeneratedFirstMessage);
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
    const resp = await chrome.runtime.sendMessage({
      type: "DB_LIST_INVITATIONS_OVERVIEW",
      payload: buildOverviewQueryState(),
    });
    if (!resp?.ok) {
      overviewLoadingEl.hidden = true;
      overviewTbodyEl.innerHTML = "";
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 8;
      td.textContent = getErrorMessage(resp?.error);
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
    setFooterStatus("Ready");
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
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (activeTab?.id) {
    await chrome.tabs.update(activeTab.id, { url: targetUrl, active: true });
    return;
  }
  await chrome.tabs.create({ url: targetUrl, active: true });
}

async function archiveRow(url) {
  setFooterDbStatus();
  const target = String(url || "").trim();
  if (!target) {
    setFooterStatus("Ready");
    return;
  }
  try {
    const resp = await chrome.runtime.sendMessage({
      type: "DB_ARCHIVE_INVITATION",
      payload: { url: target },
    });
    if (!resp?.ok) {
      statusEl.textContent = `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`;
      return;
    }
    await fetchOverviewPage();
  } finally {
    setFooterStatus("Ready");
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  const ctx = await chrome.tabs
    .sendMessage(tab.id, { type: "EXTRACT_PROFILE_CONTEXT" })
    .catch(() => null);

  if (!ctx?.ok) {
    throw new Error(getErrorMessage(ctx?.error) || "profile extraction failed");
  }

  return getProfileForGeneration(ctx.profile);
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
  copyBtnEl.disabled = !enabled;
}

async function onInvitationTabOpenedByUser() {
  statusEl.textContent = UI_TEXT.preparingProfile;
  await loadProfileContextOnOpen();
}

async function refreshMessagesTab({ reason = "manual_refresh" } = {}) {
  debug("refreshMessagesTab:", reason);
  messageStatusEl.textContent = UI_TEXT.preparingProfile;
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
    setFooterStatus("Ready");
  }
});
tabMessageBtn?.addEventListener("click", async () => {
  setFooterFetchingStatus();
  try {
    setActiveTab("detail", { userInitiated: true });
    await onMessagesTabOpenedByUser();
    setDetailInnerTab("first");
  } finally {
    setFooterStatus("Ready");
  }
});
tabOverviewBtn?.addEventListener("click", () =>
  setActiveTab("overview", { userInitiated: true }),
);
tabConfigBtn.addEventListener("click", () =>
  setActiveTab("config", { userInitiated: true }),
);
refreshChatHistoryBtnEl?.addEventListener("click", async () => {
  setFooterFetchingStatus();
  try {
    await refreshMessagesTab({ reason: "manual_refresh" });
  } finally {
    setFooterStatus("Ready");
  }
});

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
    setFooterStatus("Ready");
  }
});
detailTabFirstMessageBtnEl?.addEventListener("click", async () => {
  setFooterFetchingStatus();
  try {
    await onMessagesTabOpenedByUser();
    setDetailInnerTab("first");
  } finally {
    setFooterStatus("Ready");
  }
});
detailTabFollowBtnEl?.addEventListener("click", async () => {
  setFooterFetchingStatus();
  try {
    await onMessagesTabOpenedByUser();
    setDetailInnerTab("follow");
  } finally {
    setFooterStatus("Ready");
  }
});
setCopyButtonEnabled(false);
setInvitePromptCollapsed(true);
setMessagePromptCollapsed(true);
updateMessageTabControls();
if (OVERVIEW_ENABLED) {
  wireOverviewEvents();
  overviewPageSize = Number(overviewPageSizeEl?.value || 25);
  renderOverviewSortIndicators();
  renderOverviewPagination();
}
setFooterStatus("Ready");
setCommunicationStatus("Ready");
applyLifecycleUiState(dbInvitationRow);
renderMessageTab(outreachMessageStatus);
setDetailInnerTab("invite");
renderDetailHeader();
updatePhaseButtons();
loadProfileContextOnOpen();
loadInvitePromptPreview().catch((_e) => {});
loadFirstMessagePrompt().catch((_e) => {
  lastSavedFirstMessagePrompt = messagePromptEl.value;
  updateSavePromptButtonState();
});
loadMessageLanguage().catch((_e) => {});

toggleInvitePromptBtnEl?.addEventListener("click", () => {
  setInvitePromptCollapsed(!isInvitePromptCollapsed);
});

toggleMessagePromptBtnEl.addEventListener("click", () => {
  setMessagePromptCollapsed(!isMessagePromptCollapsed);
});

messagePromptEl.addEventListener("input", () => {
  updateSavePromptButtonState();
});

getLanguageSelectElements().forEach((el) => {
  el.addEventListener("change", async () => {
    await setLanguage(el.value);
  });
});

saveMessagePromptBtnEl.addEventListener("click", async () => {
  setFooterUpdatingStatus();
  try {
    const promptValue = messagePromptEl.value;
    await chrome.storage.sync.set({
      [STORAGE_KEY_FIRST_MESSAGE_PROMPT]: promptValue,
    });
    lastSavedFirstMessagePrompt = promptValue;
    updateSavePromptButtonState();
    messageStatusEl.textContent = UI_TEXT.promptSaved;
  } finally {
    setFooterStatus("Ready");
  }
});

resetMessagePromptBtnEl.addEventListener("click", () => {
  messagePromptEl.value = DEFAULT_FIRST_MESSAGE_PROMPT;
  updateSavePromptButtonState();
  messageStatusEl.textContent = UI_TEXT.promptReset;
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

  statusEl.textContent = UI_TEXT.configSaved;
  messageStatusEl.textContent = UI_TEXT.configSaved;
}

document.getElementById("saveConfig").addEventListener("click", async () => {
  setFooterUpdatingStatus();
  try {
    await saveConfig();
  } finally {
    setFooterStatus("Ready");
  }
});

async function extractAndPersistProfileDetails() {
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

  const enrichResp = await chrome.runtime.sendMessage({
    // prompt: buildProfileExtractionPrompt (Enrich)
    type: "ENRICH_PROFILE",
    payload: {
      apiKey,
      model: (model || "gpt-4.1").trim(),
      profile: { ...currentProfileContext },
    },
  });

  if (!enrichResp?.ok) {
    throw new Error(getErrorMessage(enrichResp?.error));
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

  setFooterUpdatingStatus();
  const saveResp = await chrome.runtime.sendMessage({
    type: "DB_UPDATE_PROFILE_DETAILS_ONLY",
    payload: {
      linkedin_url,
      company: llmCompany || undefined,
      headline: llmHeadline || undefined,
      language: getLanguage(),
    },
  });

  if (!saveResp?.ok) {
    throw new Error(
      `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(saveResp?.error)}`,
    );
  }
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
      statusEl.textContent = `${UI_TEXT.errorPrefix} ${getErrorMessage(e)}`;
    } finally {
      setFooterStatus("Ready");
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
  const resp = await chrome.runtime.sendMessage({
    type: "DB_UPSERT_GENERATED",
    payload: {
      linkedin_url: linkedinUrl,
      full_name: fullName,
      company: currentProfileContext.company || null,
      headline: currentProfileContext.headline || null,
      language: getLanguage(),
      message,
      focus: (focusEl.value || "").trim(),
      positioning: positioning || "",
      generated_at: new Date().toISOString(),
      status: statusValue,
    },
  });
  return resp;
}

async function onStepRegisterClick() {
  setFooterLlmStatus();
  try {
    await extractAndPersistProfileDetails();
    await setStatusOnlyForStepper("registered", "Registered");
  } catch (e) {
    statusEl.textContent = `${UI_TEXT.errorPrefix} ${getErrorMessage(e)}`;
    setFooterStatus("Ready");
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
  setFooterDbStatus();
  try {
    const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
    if (!linkedin_url) {
      statusEl.textContent = UI_TEXT.openLinkedInProfileFirst;
      return;
    }
    const payloadStatus =
      statusValue === "message responded" ? "message responded" : statusValue;
    const resp = await chrome.runtime.sendMessage({
      type: "DB_SET_STATUS_ONLY",
      payload: { linkedin_url, status: payloadStatus },
    });
    statusEl.textContent = resp?.ok
      ? successText
      : `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`;
    if (resp?.ok) await refreshInvitationRowFromDb();
  } finally {
    setFooterStatus("Ready");
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

copyBtnEl.addEventListener("click", async () => {
  try {
    await copyToClipboard(previewEl.textContent || "");
    statusEl.textContent = UI_TEXT.copiedToClipboard;
  } catch (e) {
    statusEl.textContent = `${UI_TEXT.copyFailedPrefix} ${getErrorMessage(e)}`;
  }
});

if (openSidePanelBtnEl && !IS_SIDE_PANEL_CONTEXT) {
  openSidePanelBtnEl.addEventListener("click", async () => {
    if (!chrome.sidePanel?.open) {
      statusEl.textContent = UI_TEXT.sidePanelNotAvailable;
      return;
    }

    try {
      const currentWindow = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: currentWindow.id });
      statusEl.textContent = UI_TEXT.openedSidePanel;
      window.close();
    } catch (_e) {
      statusEl.textContent = UI_TEXT.sidePanelNotAvailable;
    }
  });
}

document.getElementById("generate").addEventListener("click", async () => {
  setFooterFetchingStatus();
  try {
    statusEl.textContent = UI_TEXT.preparingProfile;
    previewEl.textContent = "";
    setCopyButtonEnabled(false);

    await chrome.storage.sync.set({
      strategyCore: (strategyEl.value || "").trim(),
    });

    const additionalPrompt = (focusEl.value || "").trim();
    const inviteLanguage = getLanguage();

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
      statusEl.textContent = UI_TEXT.setApiKeyInConfig;
      setActiveTab("config");
      return;
    }

    if (!currentProfileContext) {
      statusEl.textContent = UI_TEXT.couldNotExtractProfileContext;
      return;
    }

    const profileContextForGeneration = { ...currentProfileContext };
    lastProfileContextSent = profileContextForGeneration;
    lastProfileContextEnriched = null;

    statusEl.textContent = UI_TEXT.callingOpenAI;
    setFooterLlmStatus();
    debug("Sending minimized profile context to invitation generation.");
    const resp = await chrome.runtime.sendMessage({
      // prompt: buildInviteTextPrompt (Generate invite)
      type: "GENERATE_INVITE",
      payload: {
        apiKey,
        model: (model || "gpt-4.1").trim(),
        positioning: positioning || "",
        focus: additionalPrompt,
        language: inviteLanguage,
        strategyCore: strategyCore || "",
        profile: profileContextForGeneration,
      },
    });

    if (!resp?.ok) {
      statusEl.textContent = `${UI_TEXT.errorPrefix} ${getErrorMessage(resp?.error)}`;
      return;
    }

    debug("GENERATE_INVITE full response:", resp);

    const inviteText = (resp.invite_text || "").trim();

    previewEl.textContent = inviteText;
    setCopyButtonEnabled(Boolean(inviteText));
    statusEl.textContent = inviteText
      ? UI_TEXT.generatedClickCopy
      : UI_TEXT.noMessageGenerated;
  } finally {
    setFooterStatus("Ready");
  }
});

document
  .getElementById("generateFirstMessage")
  .addEventListener("click", async () => {
    setFooterFetchingStatus();
    try {
      const postSendMode = isPostSendMode();

      if (!hasMessageProfileUrl()) {
        messageStatusEl.textContent = UI_TEXT.openLinkedInProfileFirst;
        updateMessageTabControls();
        return;
      }

      messageStatusEl.textContent = UI_TEXT.generatingFirstMessage;
      firstMessagePreviewEl.textContent = "";

      const language = getLanguage();

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
        messageStatusEl.textContent = UI_TEXT.setApiKeyInConfig;
        setActiveTab("config");
        return;
      }

      if (!currentProfileContext) {
        messageStatusEl.textContent = UI_TEXT.couldNotExtractProfileContext;
        return;
      }

      const profileContextForGeneration = { ...currentProfileContext };
      lastProfileContextSent = profileContextForGeneration;

      setFooterLlmStatus();
      const resp = await chrome.runtime.sendMessage({
        // prompt: buildFirstMessagePrompt (Generate first message button)
        type: "GENERATE_FIRST_MESSAGE",
        payload: {
          apiKey,
          model: (model || "gpt-4.1").trim(),
          language,
          profile: profileContextForGeneration,
        },
      });

      if (!resp?.ok) {
        messageStatusEl.textContent = `${UI_TEXT.errorPrefix} ${getErrorMessage(resp?.error)}`;
        updateMessageTabControls();
        return;
      }

      firstMessage = (resp.first_message || "").trim();
      firstMessagePreviewEl.textContent = firstMessage;
      updateMessageTabControls();

      if (postSendMode) {
        messageStatusEl.textContent = UI_TEXT.firstMessageGenerated;
        return;
      }

      const linkedinUrl = getLinkedinUrlFromContext(currentProfileContext);
      if (!linkedinUrl) {
        messageStatusEl.textContent = UI_TEXT.missingLinkedinUrl;
        return;
      }

      setFooterUpdatingStatus();
      const dbResp = await chrome.runtime.sendMessage({
        type: "DB_UPDATE_FIRST_MESSAGE",
        payload: {
          linkedin_url: linkedinUrl,
          first_message: firstMessage,
          first_message_generated_at: new Date().toISOString(),
        },
      });

      if (!dbResp?.ok) {
        messageStatusEl.textContent = `${UI_TEXT.generatedButDbErrorPrefix} ${getErrorMessage(dbResp?.error)}`;
        updateMessageTabControls();
        return;
      }

      messageStatusEl.textContent = UI_TEXT.firstMessageGenerated;
      await refreshInvitationRowFromDb();
      updateMessageTabControls();
    } finally {
      setFooterStatus("Ready");
    }
  });

copyFirstMessageBtnEl.addEventListener("click", async () => {
  try {
    await copyToClipboard(
      firstMessage || firstMessagePreviewEl.textContent || "",
    );
    messageStatusEl.textContent = UI_TEXT.copiedToClipboard;
  } catch (e) {
    messageStatusEl.textContent = `${UI_TEXT.copyFailedPrefix} ${getErrorMessage(e)}`;
  }
  updateMessageTabControls();
});

markMessageSentBtnEl?.addEventListener("click", async () => {
  setFooterDbStatus();
  try {
    if (!currentProfileContext) {
      messageStatusEl.textContent = UI_TEXT.openLinkedInProfileFirst;
      return;
    }

    const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
    if (!linkedin_url) {
      messageStatusEl.textContent = UI_TEXT.missingLinkedinUrl;
      return;
    }

    const resp = await chrome.runtime.sendMessage({
      type: "DB_MARK_STATUS",
      payload: { linkedin_url, status: "first message sent" },
    });

    messageStatusEl.textContent = resp?.ok
      ? UI_TEXT.markedFirstMessageSent
      : `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`;

    if (resp?.ok) {
      outreachMessageStatus = "first_message_sent";
      await chrome.storage.local.set({ message_status: "first_message_sent" });
      renderMessageTab(outreachMessageStatus);
      await refreshInvitationRowFromDb();
    }
    updateMessageTabControls();
  } finally {
    setFooterStatus("Ready");
  }
});

generateFollowupBtnEl?.addEventListener("click", async () => {
  setFooterFetchingStatus();
  try {
    const objective = (followupObjectiveEl?.value || "").trim();
    const last10 = extractedChatMessages.slice(-10);
    const strategy = (strategyEl.value || "").trim();
    const includeStrategy = includeStrategyEl
      ? includeStrategyEl.checked
      : true;
    const language = getLanguage();
    console.log("[LEF][chat] followup includeStrategy", includeStrategy);
    console.log("[LEF][chat] followup generate clicked", {
      language,
      objectiveLen: objective.length,
      last10Count: last10.length,
    });

    if (!objective) {
      if (commStatusEl) commStatusEl.textContent = "Objective is required.";
      return;
    }

    if (!hasMessageProfileUrl()) {
      if (commStatusEl)
        commStatusEl.textContent = UI_TEXT.openLinkedInProfileFirst;
      return;
    }

    if (!currentProfileContext) {
      if (commStatusEl) {
        commStatusEl.textContent = UI_TEXT.couldNotExtractProfileContext;
      }
      return;
    }

    if (commStatusEl) commStatusEl.textContent = "Generating...";
    setFooterLlmStatus();

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
      if (commStatusEl) commStatusEl.textContent = UI_TEXT.setApiKeyInConfig;
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
    console.log("[LEF][chat] followup payload", {
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
        contextLast10,
        profileContext: { ...currentProfileContext },
        language,
      },
    };
    console.log("[LEF][chat] sending type", request.type);
    const resp = await chrome.runtime.sendMessage(request);

    if (!resp?.ok) {
      const msg = getErrorMessage(resp?.error);
      console.error("[LEF][chat] followup generate failed", msg);
      if (commStatusEl) commStatusEl.textContent = msg;
      if (followupPreviewEl) followupPreviewEl.value = msg;
      return;
    }

    const text = (resp.text || resp.first_message || "").trim();
    if (followupPreviewEl) followupPreviewEl.value = text;
    if (commStatusEl) commStatusEl.textContent = "Ready";
    console.log("[LEF][chat] followup generated", { chars: text.length });
  } catch (e) {
    const msg = getErrorMessage(e);
    console.error("[LEF][chat] followup exception", e);
    if (commStatusEl) commStatusEl.textContent = msg;
    if (followupPreviewEl) followupPreviewEl.value = msg;
  } finally {
    setFooterStatus("Ready");
  }
});

copyFollowupBtnEl?.addEventListener("click", async () => {
  try {
    await copyToClipboard((followupPreviewEl?.value || "").trim());
    if (commStatusEl) commStatusEl.textContent = "Copied";
  } catch (e) {
    const msg = getErrorMessage(e);
    if (commStatusEl) commStatusEl.textContent = msg;
    console.error("[LEF][chat] followup copy failed", e);
  }
});
