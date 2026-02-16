const apiKeyEl = document.getElementById("apiKey");
const modelEl = document.getElementById("model");
const strategyEl = document.getElementById("strategy");
const focusEl = document.getElementById("focus");
const messageLanguageEl = document.getElementById("messageLanguage");
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
const LIFECYCLE_STYLE_MAP = {
  neutral: { background: "#f3f4f6", color: "#374151" },
  not_in_database: { background: "#fee2e2", color: "#7f1d1d" },
  generated: { background: "#dbeafe", color: "#1d4ed8" }, // blue
  invited: { background: "#ffedd5", color: "#c2410c" }, // orange
  accepted: { background: "#dcfce7", color: "#166534" }, // green
  first_message_generated: { background: "#bbf7d0", color: "#14532d" }, // dark green
  first_message_sent: { background: "#ede9fe", color: "#6d28d9" }, // purple
};
const DEFAULT_FIRST_MESSAGE_PROMPT = messagePromptEl.value;
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

const statusEl = document.getElementById("status");
const messageStatusEl = document.getElementById("messageStatus");
const previewEl = document.getElementById("preview");
const firstMessagePreviewEl = document.getElementById("firstMessagePreview");
const profileContextPreviewEl = document.getElementById(
  "profileContextPreview",
);
const profileContextPreviewWrapEl = document.getElementById(
  "profileContextPreviewWrap",
);
const toggleProfileContextPreviewBtnEl = document.getElementById(
  "toggleProfileContextPreview",
);
const lifecycleBarEl = document.getElementById("lifecycleBar");
const lifecycleBarTextEl = document.getElementById("lifecycleBarText");
const copyBtnEl = document.getElementById("copyBtn");
const openSidePanelBtnEl = document.getElementById("openSidePanel");
const invitedAtLabelEl = document.getElementById("invitedAtLabel");
const acceptedAtLabelEl = document.getElementById("acceptedAtLabel");

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
let isProfileContextCollapsed = true;
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

function setMessageTabModeUi(status) {
  renderMessageTab(status);
}

async function loadOutreachMessageStatus() {
  const { message_status } = await chrome.storage.local.get(["message_status"]);
  const normalized =
    message_status === "first_message_sent"
      ? "first_message_sent"
      : getOutreachStatusFromDbRow();
  outreachMessageStatus = normalized || "accepted";
  console.log("[LEF][chat] status loaded", outreachMessageStatus);
  renderMessageTab(outreachMessageStatus);
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
  return messages
    .map((m) => {
      const text = (m?.text || "").trim();
      if (!text) return "";
      if (m?.direction === "them") return `- them: ${text}`;
      if (m?.direction === "me") return `- me: ${text}`;
      return `- ${text}`;
    })
    .filter(Boolean)
    .join("\n\n");
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
  console.log("[LEF][chat] refresh requested");
  chatHistoryEl.value = "Loading chat history...";
  extractedChatMessages = [];

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log("[LEF][chat] active tab", { tabId: tab?.id, url: tab?.url });

  if (!tab?.id) {
    chatHistoryEl.value = "Could not find active tab.";
    return;
  }

  console.log("[LEF][chat] sending EXTRACT_CHAT_HISTORY to tab", tab.id);
  chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_CHAT_HISTORY" }, (resp) => {
    const lastErr = chrome.runtime.lastError;
    if (lastErr) {
      console.error("[LEF][chat] sendMessage lastError", lastErr.message);
      chatHistoryEl.value = `sendMessage error: ${lastErr.message}`;
      return;
    }

    if (!resp) {
      console.warn("[LEF][chat] no response from content script");
      chatHistoryEl.value =
        "No response from content script. Ensure you're on https://www.linkedin.com/in/* and reload the extension/page.";
      return;
    }

    if (!resp.ok) {
      console.warn("[LEF][chat] extract failed", resp.error);
      if (resp.stack) console.warn("[LEF][chat] stack", resp.stack);
      if (isMessageBoxMissingError(resp.error)) {
        chatHistoryEl.value = "Please open a message box.";
        return;
      }
      chatHistoryEl.value = `extract error: ${resp.error || "unknown"}${
        resp.stack ? `\n\nstack:\n${resp.stack}` : ""
      }`;
      return;
    }

    console.log("[LEF][chat] extract ok", {
      count: resp.messages?.length || 0,
    });
    extractedChatMessages = Array.isArray(resp.messages) ? resp.messages : [];
    chatHistoryEl.value = formatChatHistory(resp.messages);
  });
}

function renderProfileContext() {
  profileContextPreviewEl.textContent = JSON.stringify(
    {
      sent_to_ai: lastProfileContextSent || {},
      enriched_from_llm: lastProfileContextEnriched,
    },
    null,
    2,
  );
}

function setProfileContextPreviewCollapsed(collapsed) {
  isProfileContextCollapsed = collapsed;
  profileContextPreviewWrapEl.hidden = collapsed;
  toggleProfileContextPreviewBtnEl.textContent = collapsed ? "Show" : "Hide";
  toggleProfileContextPreviewBtnEl.setAttribute(
    "aria-expanded",
    collapsed ? "false" : "true",
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

function setLifecycleBar(stateKey, text) {
  const style = LIFECYCLE_STYLE_MAP[stateKey] || LIFECYCLE_STYLE_MAP.neutral;
  lifecycleBarEl.style.backgroundColor = style.background;
  lifecycleBarEl.style.color = style.color;
  lifecycleBarTextEl.textContent = text;
}

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
  const markInvitedBtn = document.getElementById("markInvited");
  const markAcceptedBtn = document.getElementById("markAccepted");
  const generateBtn = document.getElementById("generate");

  if (!markInvitedBtn || !markAcceptedBtn || !generateBtn) return;
  updateGenerateFirstMessageButtonLabel();

  markInvitedBtn.classList.remove("is-highlighted");
  markAcceptedBtn.classList.remove("is-highlighted");

  markInvitedBtn.disabled = false;
  markAcceptedBtn.disabled = false;
  generateBtn.disabled = false;
  invitedAtLabelEl.hidden = true;
  acceptedAtLabelEl.hidden = true;
  invitedAtLabelEl.querySelector("small").textContent = "";
  acceptedAtLabelEl.querySelector("small").textContent = "";

  const status = getLifecycleStatusValue(dbRow);
  const canMarkInvited = status === "generated";
  markInvitedBtn.disabled = !canMarkInvited;
  const canMarkAccepted = status === "invited";
  markAcceptedBtn.disabled = !canMarkAccepted;
  const dbMessage = (dbRow?.message || "").trim();
  if (dbMessage) {
    previewEl.textContent = dbMessage;
    setCopyButtonEnabled(true);
  }

  if (status === "generated") {
    setActiveTab("invitation");
    if (dbMessage) {
      previewEl.textContent = dbMessage;
      setCopyButtonEnabled(true);
    }
    markInvitedBtn.classList.add("is-highlighted");
    return;
  }

  if (status === "invited") {
    setActiveTab("invitation");
    if (dbMessage) {
      previewEl.textContent = dbMessage;
      setCopyButtonEnabled(true);
    }
    markInvitedBtn.disabled = true;
    generateBtn.disabled = true;
    markAcceptedBtn.classList.add("is-highlighted");
    return;
  }

  if (status === "accepted" || status === "first message sent") {
    setActiveTab("message");
    markInvitedBtn.disabled = true;
    generateBtn.disabled = true;
    markAcceptedBtn.disabled = true;
    if (dbMessage) {
      previewEl.textContent = dbMessage;
      setCopyButtonEnabled(true);
    }
  }

  const invitedAtText = formatDateTime(dbRow?.invited_at);
  if (markInvitedBtn.disabled && invitedAtText) {
    invitedAtLabelEl.hidden = false;
    invitedAtLabelEl.querySelector("small").textContent =
      `Invitation sent: ${invitedAtText}`;
    if (dbMessage) {
      previewEl.textContent = dbMessage;
      setCopyButtonEnabled(true);
    }
  }

  const acceptedAtText = formatDateTime(dbRow?.accepted_at);
  const acceptedOrBeyond =
    status === "accepted" || status === "first message sent";
  if ((acceptedOrBeyond || markAcceptedBtn.disabled) && acceptedAtText) {
    acceptedAtLabelEl.hidden = false;
    acceptedAtLabelEl.querySelector("small").textContent =
      `Invitation accepted: ${acceptedAtText}`;
  }

  if (acceptedOrBeyond) {
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
  const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedin_url) {
    dbInvitationRow = null;
    setLifecycleBar("neutral", UI_TEXT.lifecycleOpenLinkedInProfileFirst);
    applyLifecycleUiState(dbInvitationRow);
    outreachMessageStatus = "accepted";
    renderMessageTab(outreachMessageStatus);
    return;
  }

  const resp = await chrome.runtime.sendMessage({
    type: "DB_GET_INVITATION",
    payload: { linkedin_url },
  });

  if (!resp?.ok) {
    dbInvitationRow = null;
    setLifecycleBar("neutral", getErrorMessage(resp?.error));
    applyLifecycleUiState(dbInvitationRow);
    outreachMessageStatus = "accepted";
    renderMessageTab(outreachMessageStatus);
    return;
  }

  dbInvitationRow = resp.row || null;
  debug("DB invitation row fetched:", {
    has_row: Boolean(dbInvitationRow),
    message_length: (dbInvitationRow?.message || "").length,
  });
  const lifecycle = deriveLifecycleState(dbInvitationRow);
  setLifecycleBar(lifecycle.key, lifecycle.text);
  applyLifecycleUiState(dbInvitationRow);
  outreachMessageStatus = getOutreachStatusFromDbRow();
  if (outreachMessageStatus === "first_message_sent") {
    await chrome.storage.local.set({ message_status: "first_message_sent" });
  }
  renderMessageTab(outreachMessageStatus);
  updateMessageTabControls();
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
  }
}

async function openLinkedIn(url) {
  const targetUrl = String(url || "").trim();
  if (!targetUrl) return;
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
  const target = String(url || "").trim();
  if (!target) return;
  const resp = await chrome.runtime.sendMessage({
    type: "DB_ARCHIVE_INVITATION",
    payload: { url: target },
  });
  if (!resp?.ok) {
    statusEl.textContent = `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`;
    return;
  }
  await fetchOverviewPage();
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
    renderProfileContext();
    updateMessageTabControls();
    await refreshInvitationRowFromDb();
  } catch (_e) {
    currentProfileContext = null;
    lastProfileContextSent = {};
    lastProfileContextEnriched = null;
    dbInvitationRow = null;
    renderProfileContext();
    updateMessageTabControls();
    setLifecycleBar("neutral", UI_TEXT.lifecycleOpenLinkedInProfileFirst);
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

async function loadMessageLanguage() {
  const { [STORAGE_KEY_MESSAGE_LANGUAGE]: savedLanguage } =
    await chrome.storage.local.get([STORAGE_KEY_MESSAGE_LANGUAGE]);
  if (
    messageLanguageEl &&
    typeof savedLanguage === "string" &&
    savedLanguage.trim()
  ) {
    messageLanguageEl.value = savedLanguage.trim();
  }
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
  const invitationActive = which === "invitation";
  const messageActive = which === "message";
  const overviewActive = OVERVIEW_ENABLED && which === "overview";
  const configActive = which === "config";

  tabMainBtn.classList.toggle("active", invitationActive);
  tabMessageBtn.classList.toggle("active", messageActive);
  if (tabOverviewBtn) tabOverviewBtn.classList.toggle("active", overviewActive);
  tabConfigBtn.classList.toggle("active", configActive);

  tabMain.classList.toggle("active", invitationActive);
  tabMessage.classList.toggle("active", messageActive);
  if (tabOverview) tabOverview.classList.toggle("active", overviewActive);
  tabConfig.classList.toggle("active", configActive);

  if (overviewActive) {
    fetchOverviewPage();
  }
}

tabMainBtn.addEventListener("click", async () => {
  setActiveTab("invitation", { userInitiated: true });
  await onInvitationTabOpenedByUser();
});
tabMessageBtn.addEventListener("click", async () => {
  setActiveTab("message", { userInitiated: true });
  await onMessagesTabOpenedByUser();
});
tabOverviewBtn?.addEventListener("click", () =>
  setActiveTab("overview", { userInitiated: true }),
);
tabConfigBtn.addEventListener("click", () =>
  setActiveTab("config", { userInitiated: true }),
);
refreshChatHistoryBtnEl?.addEventListener("click", async () => {
  await refreshMessagesTab({ reason: "manual_refresh" });
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
setCopyButtonEnabled(false);
renderProfileContext();
setProfileContextPreviewCollapsed(true);
setMessagePromptCollapsed(true);
updateMessageTabControls();
if (OVERVIEW_ENABLED) {
  wireOverviewEvents();
  overviewPageSize = Number(overviewPageSizeEl?.value || 25);
  renderOverviewSortIndicators();
  renderOverviewPagination();
}
setLifecycleBar("neutral", UI_TEXT.lifecycleOpenLinkedInProfileFirst);
applyLifecycleUiState(dbInvitationRow);
renderMessageTab(outreachMessageStatus);
loadProfileContextOnOpen();
loadFirstMessagePrompt().catch((_e) => {
  lastSavedFirstMessagePrompt = messagePromptEl.value;
  updateSavePromptButtonState();
});
loadMessageLanguage().catch((_e) => {});

toggleProfileContextPreviewBtnEl.addEventListener("click", () => {
  setProfileContextPreviewCollapsed(!isProfileContextCollapsed);
});

toggleMessagePromptBtnEl.addEventListener("click", () => {
  setMessagePromptCollapsed(!isMessagePromptCollapsed);
});

messagePromptEl.addEventListener("input", () => {
  updateSavePromptButtonState();
});

messageLanguageEl?.addEventListener("change", async () => {
  await chrome.storage.local.set({
    [STORAGE_KEY_MESSAGE_LANGUAGE]: messageLanguageEl.value,
  });
});

saveMessagePromptBtnEl.addEventListener("click", async () => {
  const promptValue = messagePromptEl.value;
  await chrome.storage.sync.set({
    [STORAGE_KEY_FIRST_MESSAGE_PROMPT]: promptValue,
  });
  lastSavedFirstMessagePrompt = promptValue;
  updateSavePromptButtonState();
  messageStatusEl.textContent = UI_TEXT.promptSaved;
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
  await saveConfig();
});

document.getElementById("markInvited").addEventListener("click", async () => {
  if (!currentProfileContext) {
    statusEl.textContent = UI_TEXT.openLinkedInProfileFirst;
    return;
  }

  const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedin_url) {
    statusEl.textContent = UI_TEXT.missingLinkedinUrl;
    return;
  }

  const resp = await chrome.runtime.sendMessage({
    type: "DB_MARK_STATUS",
    payload: { linkedin_url, status: "invited" },
  });

  statusEl.textContent = resp?.ok
    ? UI_TEXT.markedInvited
    : `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`;

  if (resp?.ok) {
    await refreshInvitationRowFromDb();
  }
});

document.getElementById("markAccepted").addEventListener("click", async () => {
  if (getLifecycleStatusValue(dbInvitationRow) === "accepted") {
    setActiveTab("message");
    return;
  }

  if (!currentProfileContext) {
    statusEl.textContent = UI_TEXT.openLinkedInProfileFirst;
    return;
  }

  const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedin_url) {
    statusEl.textContent = UI_TEXT.missingLinkedinUrl;
    return;
  }

  const resp = await chrome.runtime.sendMessage({
    type: "DB_MARK_STATUS",
    payload: { linkedin_url, status: "accepted" },
  });

  statusEl.textContent = resp?.ok
    ? UI_TEXT.markedAccepted
    : `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`;

  if (resp?.ok) {
    await refreshInvitationRowFromDb();
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
  statusEl.textContent = UI_TEXT.preparingProfile;
  previewEl.textContent = "";
  setCopyButtonEnabled(false);

  await chrome.storage.sync.set({
    strategyCore: (strategyEl.value || "").trim(),
  });

  const focus = (focusEl.value || "").trim();

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
  renderProfileContext();

  statusEl.textContent = UI_TEXT.callingOpenAI;

  debug("Sending minimized profile context to invitation generation.");
  const resp = await chrome.runtime.sendMessage({
    type: "GENERATE_INVITE",
    payload: {
      apiKey,
      model: (model || "gpt-4.1").trim(),
      positioning: positioning || "",
      focus,
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
  const llmCompany = (resp.company || "").trim();
  const llmHeadline = (resp.headline || "").trim();

  lastProfileContextEnriched = {
    company: llmCompany,
    headline: llmHeadline,
  };
  debug("enriched_from_llm assigned:", lastProfileContextEnriched);
  renderProfileContext();

  if (!currentProfileContext.company && llmCompany) {
    currentProfileContext.company = llmCompany;
  }
  if (!currentProfileContext.headline && llmHeadline) {
    currentProfileContext.headline = llmHeadline;
  }

  previewEl.textContent = inviteText;
  setCopyButtonEnabled(Boolean(inviteText));
  statusEl.textContent = inviteText
    ? UI_TEXT.generatedClickCopy
    : UI_TEXT.noMessageGenerated;

  const upsertCompany = llmCompany || currentProfileContext.company || null;
  const upsertHeadline = llmHeadline || currentProfileContext.headline || null;
  const linkedinUrl = getLinkedinUrlFromContext(currentProfileContext);
  const fullName = getFullNameFromContext(currentProfileContext);

  chrome.runtime
    .sendMessage({
      type: "DB_UPSERT_GENERATED",
      payload: {
        linkedin_url: linkedinUrl,
        full_name: fullName,
        company: upsertCompany,
        headline: upsertHeadline,
        message: inviteText,
        focus,
        positioning: positioning || "",
        generated_at: new Date().toISOString(),
        status: "generated",
      },
    })
    .then((dbResp) => {
      debug("DB_UPSERT_GENERATED payload sent:", {
        linkedin_url: linkedinUrl,
        full_name: fullName,
        company: upsertCompany,
        headline: upsertHeadline,
        message: inviteText,
        focus,
        positioning: positioning || "",
        generated_at: "ISO_TIMESTAMP",
        status: "generated",
      });
      return dbResp;
    })
    .then((dbResp) => {
      if (!dbResp?.ok) {
        statusEl.textContent += `${UI_TEXT.dbErrorAppendPrefix} ${getErrorMessage(dbResp?.error)}`;
      } else {
        return refreshInvitationRowFromDb();
      }
    })
    .catch((e) => {
      statusEl.textContent += `${UI_TEXT.dbErrorAppendPrefix} ${getErrorMessage(e)}`;
    });
});

document
  .getElementById("generateFirstMessage")
  .addEventListener("click", async () => {
    const postSendMode = isPostSendMode();

    if (!hasMessageProfileUrl()) {
      messageStatusEl.textContent = UI_TEXT.openLinkedInProfileFirst;
      updateMessageTabControls();
      return;
    }

    messageStatusEl.textContent = UI_TEXT.generatingFirstMessage;
    firstMessagePreviewEl.textContent = "";

    const prompt = (messagePromptEl.value || "").trim();
    const language = (messageLanguageEl?.value || "Portuguese").trim();
    if (!prompt) {
      messageStatusEl.textContent = UI_TEXT.messagePromptRequired;
      return;
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
    renderProfileContext();

    const resp = await chrome.runtime.sendMessage({
      type: "GENERATE_FIRST_MESSAGE",
      payload: {
        apiKey,
        model: (model || "gpt-4.1").trim(),
        prompt,
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
});

generateFollowupBtnEl?.addEventListener("click", async () => {
  const objective = (followupObjectiveEl?.value || "").trim();
  const last10 = extractedChatMessages.slice(-10);
  const strategy = (strategyEl.value || "").trim();
  const includeStrategy = includeStrategyEl ? includeStrategyEl.checked : true;
  const language = (messageLanguageEl?.value || "Portuguese").trim();
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

  try {
    const request = {
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
