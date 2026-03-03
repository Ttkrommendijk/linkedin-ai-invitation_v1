const apiKeyEl = document.getElementById("apiKey");
const modelEl = document.getElementById("model");
const strategyEl = document.getElementById("strategy");
const focusEl = document.getElementById("focus");
const messageLanguageEl = document.getElementById("messageLanguage");
const inviteLanguageEl = document.getElementById("inviteLanguage");
const freePromptLanguageEl = document.getElementById("freePromptLanguage");
const campaignSelectEl = document.getElementById("campaignSelect");
const newCampaignRowEl = document.getElementById("newCampaignRow");
const toggleNewCampaignBtnEl = document.getElementById("toggleNewCampaign");
const newCampaignNameEl = document.getElementById("newCampaignName");
const addCampaignBtnEl = document.getElementById("addCampaign");
const cancelNewCampaignBtnEl = document.getElementById("cancelNewCampaign");
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
const freePromptInputEl = document.getElementById("freePromptInput");
const freePromptIncludeProfileEl = document.getElementById(
  "freePromptIncludeProfile",
);
const freePromptIncludeStrategyEl = document.getElementById(
  "freePromptIncludeStrategy",
);
const generateFreePromptBtnEl = document.getElementById("generateFreePrompt");
const freePromptPreviewEl = document.getElementById("freePromptPreview");
const copyFreePromptBtnEl = document.getElementById("copyFreePrompt");

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
  nothingToCopy: "Nothing to copy.",
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
const STORAGE_KEY_FREE_PROMPT_LANGUAGE = "free_prompt_language";
const STORAGE_KEY_LAST_ACTIVE_CAMPAIGN = "last_active_campaign";
const STORAGE_KEY_LIST_FILTERS = "lef_list_filters_v1";
const STORAGE_KEY_LIST_COLUMN_WIDTHS = "lef_list_column_widths_v1";
const SUPPORTED_LANGUAGES = ["Portuguese", "English", "Dutch", "Spanish"];
const DEFAULT_FIRST_MESSAGE_PROMPT = messagePromptEl?.value || "";
const LEF_UTILS_SOURCE = globalThis.LEFUtils;
if (
  (!LEF_UTILS_SOURCE || typeof LEF_UTILS_SOURCE !== "object") &&
  !globalThis.__LEFUTILS_MISSING_WARNED__
) {
  globalThis.__LEFUTILS_MISSING_WARNED__ = true;
  console.warn("[lefutils] not found; using local fallbacks");
}
const LEF_UTILS =
  LEF_UTILS_SOURCE && typeof LEF_UTILS_SOURCE === "object"
    ? LEF_UTILS_SOURCE
    : {};
const DEBUG_EMPTY_STATE = false;
function safeTrimFallback(v) {
  return v == null ? "" : String(v).trim();
}
function normalizeWhitespaceFallback(v) {
  return safeTrimFallback(v).replace(/\s+/g, " ");
}
function sanitizeHeadlineJobTitleFallback(v) {
  return normalizeWhitespaceFallback(v);
}
const safeTrim =
  typeof LEF_UTILS.safeTrim === "function"
    ? LEF_UTILS.safeTrim
    : safeTrimFallback;
const normalizeWhitespace =
  typeof LEF_UTILS.normalizeWhitespace === "function"
    ? LEF_UTILS.normalizeWhitespace
    : normalizeWhitespaceFallback;
const sanitizeHeadlineJobTitle =
  typeof LEF_UTILS.sanitizeHeadlineJobTitle === "function"
    ? LEF_UTILS.sanitizeHeadlineJobTitle
    : sanitizeHeadlineJobTitleFallback;
const sendRuntimeMessage =
  typeof LEF_UTILS.sendRuntimeMessage === "function"
    ? LEF_UTILS.sendRuntimeMessage
    : (type, payload = {}, options = {}) => {
        const timeoutMs =
          Number.isFinite(options?.timeoutMs) && options.timeoutMs > 0
            ? options.timeoutMs
            : 20000;
        return new Promise((resolve) => {
          let settled = false;
          const done = (result) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            resolve(result);
          };
          const timeoutId = setTimeout(() => {
            console.error(`[msg] ${type} failed: timeout`);
            done({ ok: false, error: "timeout", data: null });
          }, timeoutMs);
          try {
            chrome.runtime.sendMessage(
              {
                type,
                ...(payload && typeof payload === "object" ? payload : {}),
              },
              (response) => {
                const runtimeError = chrome.runtime?.lastError;
                if (runtimeError) {
                  const errorText = String(
                    runtimeError.message || runtimeError,
                  );
                  console.error(`[msg] ${type} failed: ${errorText}`);
                  done({ ok: false, error: errorText, data: null });
                  return;
                }
                if (response?.ok === false || response?.error) {
                  const errorText =
                    typeof response?.error === "string"
                      ? response.error
                      : response?.error?.message || "unknown error";
                  console.error(`[msg] ${type} failed: ${errorText}`);
                  done({ ok: false, error: errorText, data: response || null });
                  return;
                }
                done({ ok: true, data: response });
              },
            );
          } catch (e) {
            const errorText = e instanceof Error ? e.message : String(e || "");
            done({ ok: false, error: errorText, data: null });
          }
        });
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
const detailTabInviteBtnEl = document.getElementById("detailTabInviteBtn");
const detailTabFirstMessageBtnEl = document.getElementById(
  "detailTabFirstMessageBtn",
);
const detailTabFreePromptBtnEl = document.getElementById("tabFreePromptBtn");
const detailTabFollowBtnEl = document.getElementById("detailTabFollowBtn");
const detailInviteSectionEl = document.getElementById("detailInviteSection");
const detailMessageMountEl = document.getElementById("detailMessageMount");
const tabFreePromptEl = document.getElementById("tabFreePrompt");

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

const filterCampaignEl = document.getElementById("filterCampaign");
const overviewArchivedFilterEl = document.getElementById(
  "overviewArchivedFilter",
);
const overviewStatusFilterEl = document.getElementById("overviewStatusFilter");
const filterAcceptedEl = document.getElementById("filterAccepted");
const overviewSearchEl = document.getElementById("overviewSearch");
const overviewTbodyEl = document.getElementById("overviewTbody");
const overviewLoadingEl = document.getElementById("overviewLoading");
const overviewPageSizeEl = document.getElementById("overviewPageSize");
const overviewPrevBtnEl = document.getElementById("overviewPrevBtn");
const overviewNextBtnEl = document.getElementById("overviewNextBtn");
const overviewCountLabelEl = document.getElementById("overviewCountLabel");
const overviewTableEl = document.querySelector("#tabOverview .overview-table");

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
let overviewFilters = {
  campaign: "",
  archived: "",
  status: "",
  accepted: "",
};
let overviewSearch = "";
let overviewSearchDebounceTimer = null;
let overviewAutoSizeTimer = null;
let overviewColumnWidths = {};
let overviewColumnOverridden = {};
let overviewColumnPersistTimer = null;
let overviewContextRefreshPromise = null;
let chatExtractSeq = 0;
let detailInnerTab = "invite";
let stepperAllowedActions = {
  registered: false,
  invited: false,
  accepted: false,
  first_message_sent: false,
  message_responded: false,
};
let stepperForwardTarget = null;
let stepperBackTarget = null;
let stepperBackAction = null;
let stepperStatusStage = "";
let stepperForwardSteps = new Set();
let currentLanguage = "Portuguese";
let inviteCopyIconResetTimer = null;
let firstMessageCopyIconResetTimer = null;
let followupCopyIconResetTimer = null;
let freePromptCopyIconResetTimer = null;
let readyResetTimer = null;
let knownCampaignValues = [];
let overviewContextItems = [];
const OVERVIEW_CAMPAIGN_LABEL_MAX = 52;
const COPY_ICON_GLYPH = "\u29c9";
const COPY_TOOLTIP_DEFAULT = "Copy to clipboard";
const COPY_TOOLTIP_SUCCESS = "Copied";
const OVERVIEW_ENABLED = Boolean(
  IS_SIDE_PANEL_CONTEXT && tabOverviewBtn && tabOverview,
);

function getLifecycleStatusValue(dbRow) {
  return (dbRow?.status || "").trim().toLowerCase();
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

function normalizeCampaignValue(value) {
  return safeTrim(value);
}

function truncateCampaignLabel(value, maxLen = OVERVIEW_CAMPAIGN_LABEL_MAX) {
  const full = String(value || "");
  if (full.length <= maxLen) return full;
  return `${full.slice(0, maxLen - 1).trim()}\u2026`;
}

function buildCampaignOptionElement(value) {
  const fullCampaignValue = normalizeCampaignValue(value);
  const optionEl = document.createElement("option");
  optionEl.value = fullCampaignValue;
  optionEl.textContent = truncateCampaignLabel(fullCampaignValue);
  optionEl.title = fullCampaignValue;
  optionEl.dataset.full = fullCampaignValue;
  return optionEl;
}

function hasCampaignOption(value) {
  if (!campaignSelectEl) return false;
  const normalized = normalizeCampaignValue(value);
  if (!normalized) return false;
  return Array.from(campaignSelectEl.options || []).some(
    (option) => normalizeCampaignValue(option.value) === normalized,
  );
}

function appendCampaignOption(value) {
  if (!campaignSelectEl) return;
  const normalized = normalizeCampaignValue(value);
  if (!normalized || hasCampaignOption(normalized)) return;
  const optionEl = buildCampaignOptionElement(normalized);
  campaignSelectEl.appendChild(optionEl);
}

function setCampaignSelectValue(value) {
  if (!campaignSelectEl) return;
  const normalized = normalizeCampaignValue(value);
  if (normalized) appendCampaignOption(normalized);
  campaignSelectEl.value = normalized || "";
  updateDetailCampaignSelectTitle();
}

function setNewCampaignRowVisible(visible) {
  if (!newCampaignRowEl) return;
  newCampaignRowEl.hidden = !visible;
  if (toggleNewCampaignBtnEl) {
    toggleNewCampaignBtnEl.hidden = Boolean(visible);
  }
  if (!visible && newCampaignNameEl) {
    newCampaignNameEl.value = "";
  }
}

async function saveLastActiveCampaign(value) {
  await chrome.storage.local.set({
    [STORAGE_KEY_LAST_ACTIVE_CAMPAIGN]: normalizeCampaignValue(value),
  });
}

async function loadLastActiveCampaign() {
  const data = await chrome.storage.local.get([
    STORAGE_KEY_LAST_ACTIVE_CAMPAIGN,
  ]);
  return normalizeCampaignValue(data?.[STORAGE_KEY_LAST_ACTIVE_CAMPAIGN] || "");
}

function rebuildCampaignSelectOptions(campaignValues) {
  if (!campaignSelectEl) return;
  while (campaignSelectEl.firstChild) {
    campaignSelectEl.removeChild(campaignSelectEl.firstChild);
  }
  const emptyOptionEl = document.createElement("option");
  emptyOptionEl.value = "";
  emptyOptionEl.textContent = "(no campaign)";
  campaignSelectEl.appendChild(emptyOptionEl);
  for (const campaignValue of campaignValues) {
    appendCampaignOption(campaignValue);
  }
}

function rebuildOverviewCampaignFilterOptions(campaignValues) {
  if (!filterCampaignEl) return;
  const selectedBefore = normalizeCampaignValue(filterCampaignEl.value);
  while (filterCampaignEl.firstChild) {
    filterCampaignEl.removeChild(filterCampaignEl.firstChild);
  }
  const allOptionEl = document.createElement("option");
  allOptionEl.value = "";
  allOptionEl.textContent = "All campaigns";
  filterCampaignEl.appendChild(allOptionEl);
  const noCampaignOptionEl = document.createElement("option");
  noCampaignOptionEl.value = "__no_campaign__";
  noCampaignOptionEl.textContent = "No campaign";
  filterCampaignEl.appendChild(noCampaignOptionEl);

  const uniqueValues = Array.from(
    new Set(
      (campaignValues || [])
        .map((value) => normalizeCampaignValue(value))
        .filter(Boolean),
    ),
  );
  uniqueValues.forEach((campaignValue) => {
    const optionEl = buildCampaignOptionElement(campaignValue);
    filterCampaignEl.appendChild(optionEl);
  });

  if (
    selectedBefore &&
    uniqueValues.some((campaignValue) => campaignValue === selectedBefore)
  ) {
    filterCampaignEl.value = selectedBefore;
  } else {
    filterCampaignEl.value = "";
    overviewFilters.campaign = "";
  }
  updateOverviewCampaignFilterTitle();
}

function updateOverviewCampaignFilterTitle() {
  if (!filterCampaignEl) return;
  const selectedOption =
    filterCampaignEl.options[filterCampaignEl.selectedIndex];
  if (!selectedOption) {
    filterCampaignEl.title = "";
    return;
  }
  const selectedValue = String(selectedOption.value || "");
  if (
    selectedValue &&
    selectedValue !== "__no_campaign__" &&
    selectedValue !== ""
  ) {
    filterCampaignEl.title = selectedValue;
    return;
  }
  filterCampaignEl.title = selectedOption.text || "";
}

function updateDetailCampaignSelectTitle() {
  if (!campaignSelectEl) return;
  const selectedOption =
    campaignSelectEl.options[campaignSelectEl.selectedIndex];
  if (!selectedOption) {
    campaignSelectEl.title = "";
    return;
  }
  const selectedValue = String(selectedOption.value || "");
  campaignSelectEl.title = selectedValue || selectedOption.text || "";
}

function collectOverviewFilterUiState() {
  return {
    campaign: filterCampaignEl?.value || "",
    archived: overviewArchivedFilterEl?.value || "",
    status: overviewStatusFilterEl?.value || "",
    accepted: filterAcceptedEl?.value || "",
    search: overviewSearchEl?.value || "",
  };
}

async function persistOverviewFiltersToStorage() {
  await chrome.storage.local.set({
    [STORAGE_KEY_LIST_FILTERS]: collectOverviewFilterUiState(),
  });
}

async function restoreOverviewFiltersFromStorage() {
  const data = await chrome.storage.local.get([STORAGE_KEY_LIST_FILTERS]);
  const saved = data?.[STORAGE_KEY_LIST_FILTERS];
  if (!saved || typeof saved !== "object") {
    updateOverviewCampaignFilterTitle();
    return;
  }

  const savedCampaign = String(saved.campaign || "");
  const savedArchived = String(saved.archived || "");
  const savedStatus = String(saved.status || "");
  const savedAccepted = String(saved.accepted || "");
  const savedSearch = String(saved.search || "");

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
  updateOverviewCampaignFilterTitle();
}

async function loadCampaignOptions({ keepSelected = true } = {}) {
  const selectedBefore =
    campaignSelectEl && keepSelected
      ? normalizeCampaignValue(campaignSelectEl.value)
      : "";
  const result = await sendRuntimeMessage("DB_LIST_CAMPAIGNS");
  const resp = result.data || {};
  const campaigns =
    result.ok && Array.isArray(resp?.campaigns) ? resp.campaigns : [];
  knownCampaignValues = campaigns
    .map((campaignValue) => normalizeCampaignValue(campaignValue))
    .filter(Boolean);
  if (campaignSelectEl) {
    rebuildCampaignSelectOptions(knownCampaignValues);
  }
  rebuildOverviewCampaignFilterOptions(knownCampaignValues);
  if (campaignSelectEl) {
    setCampaignSelectValue(selectedBefore);
  }
}

async function applyCampaignSelectionFromProfile() {
  if (!campaignSelectEl) return;
  if (dbInvitationRow) {
    setCampaignSelectValue(dbInvitationRow?.campaign || "");
    return;
  }
  const lastActiveCampaign = await loadLastActiveCampaign();
  setCampaignSelectValue(lastActiveCampaign);
}

async function persistCampaignForCurrentProfile(campaignValue) {
  const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedin_url) return;
  const normalizedCampaign = normalizeCampaignValue(campaignValue);

  if (dbInvitationRow) {
    const result = await sendRuntimeMessage("DB_UPDATE_CAMPAIGN", {
      payload: { linkedin_url, campaign: normalizedCampaign },
    });
    if (!result.ok) {
      setFooterStatus(
        `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(result.error)}`,
      );
      return;
    }
    dbInvitationRow = { ...dbInvitationRow, campaign: normalizedCampaign };
    return;
  }

  const full_name = getFullNameFromContext(currentProfileContext);
  const result = await sendRuntimeMessage("DB_UPSERT_CAMPAIGN_MINIMAL", {
    payload: { linkedin_url, full_name, campaign: normalizedCampaign },
  });
  if (!result.ok) {
    setFooterStatus(
      `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(result.error)}`,
    );
    return;
  }
  dbInvitationRow = {
    ...(dbInvitationRow || {}),
    linkedin_url,
    full_name: full_name || dbInvitationRow?.full_name || null,
    campaign: normalizedCampaign,
  };
  renderDetailHeader();
}

async function handleCampaignSelection(campaignValue) {
  const normalizedCampaign = normalizeCampaignValue(campaignValue);
  await saveLastActiveCampaign(normalizedCampaign);
  await persistCampaignForCurrentProfile(normalizedCampaign);
}

function isPostSendMode() {
  const status = getLifecycleStatusValue(dbInvitationRow);
  return (
    status === "first message sent" ||
    status === "first_message_sent" ||
    status === "message responded" ||
    status === "message_responded"
  );
}

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

function updateStepperInteractivity() {
  if (!statusStepperEl) return;

  const rawStatus = getLifecycleStatusValue(dbInvitationRow);
  const status = rawStatus === "accepted" ? "invited" : rawStatus;
  const hasRow = Boolean(dbInvitationRow);
  const isAccepted = isAcceptedRow(dbInvitationRow);
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
    if (normalizedStatus === "invited") return 2;
    if (normalizedStatus === "first message sent") return 3;
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
  } else if (normalizedStatus === "invited") {
    allowed.first_message_sent = true;
    forwardTarget = "first_message_sent";
    forwardSteps.add("first_message_sent");
    backTarget = "invited";
    backAction = "status_registered";
    hoverable.first_message_sent = true;
  } else if (normalizedStatus === "first message sent") {
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
}

function updatePhaseButtons() {
  updateStepperInteractivity();
}

function setDetailInnerTab(tab) {
  detailInnerTab = tab;
  if (detailTabInviteBtnEl)
    detailTabInviteBtnEl.classList.toggle("active", tab === "invite");
  if (detailTabFirstMessageBtnEl)
    detailTabFirstMessageBtnEl.classList.toggle("active", tab === "first");
  if (detailTabFreePromptBtnEl)
    detailTabFreePromptBtnEl.classList.toggle("active", tab === "free_prompt");
  if (detailTabFollowBtnEl)
    detailTabFollowBtnEl.classList.toggle("active", tab === "follow");

  if (detailInviteSectionEl) detailInviteSectionEl.hidden = tab !== "invite";
  if (tabMessage) tabMessage.hidden = tab === "invite" || tab === "free_prompt";
  if (tabFreePromptEl) {
    tabFreePromptEl.classList.toggle("active", tab === "free_prompt");
  }

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
  setFooterFetchingStatus();
  const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedin_url) {
    dbInvitationRow = null;
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
      setCommunicationStatus(getErrorMessage(result.error));
      applyLifecycleUiState(dbInvitationRow, { preserveTabs });
      outreachMessageStatus = "accepted";
      renderMessageTab(outreachMessageStatus);
      renderDetailHeader();
      updatePhaseButtons();
      return;
    }

    dbInvitationRow = resp.row || null;
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
  const campaignFilterValue =
    overviewFilters.campaign === "__no_campaign__"
      ? ""
      : overviewFilters.campaign || "";
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

function isOverviewRowNoCampaign(row) {
  const campaignValue = row?.campaign;
  return campaignValue == null || String(campaignValue).trim() === "";
}

function isOverviewRowAccepted(row) {
  return row?.accepted === true;
}

function applyOverviewClientFilters(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return safeRows.filter((row) => {
    if (
      overviewFilters.campaign === "__no_campaign__" &&
      !isOverviewRowNoCampaign(row)
    ) {
      return false;
    }
    if (overviewFilters.accepted === "true") {
      return isOverviewRowAccepted(row);
    }
    if (overviewFilters.accepted === "false") {
      return !isOverviewRowAccepted(row);
    }
    return true;
  });
}

function isOverviewRowArchived(row) {
  if (row?.archived === true || row?.archived === 1) return true;
  const normalized = String(row?.archived ?? "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true";
}

function createOverviewIconButton({
  title,
  ariaLabel,
  className = "",
  viewBox = "0 0 16 16",
  pathD = "",
  stroke = false,
}) {
  const buttonEl = document.createElement("button");
  buttonEl.type = "button";
  buttonEl.className = `icon-btn ${className}`.trim();
  buttonEl.title = title;
  buttonEl.setAttribute("aria-label", ariaLabel);
  buttonEl.style.marginTop = "0";
  buttonEl.style.minHeight = "24px";
  buttonEl.style.width = "24px";

  const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svgEl.setAttribute("viewBox", viewBox);
  svgEl.setAttribute("width", "14");
  svgEl.setAttribute("height", "14");
  svgEl.setAttribute("aria-hidden", "true");
  const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pathEl.setAttribute("d", pathD);
  if (stroke) {
    pathEl.setAttribute("fill", "none");
    pathEl.setAttribute("stroke", "currentColor");
    pathEl.setAttribute("stroke-width", "1.8");
    pathEl.setAttribute("stroke-linecap", "round");
    pathEl.setAttribute("stroke-linejoin", "round");
  } else {
    pathEl.setAttribute("fill", "currentColor");
  }
  svgEl.appendChild(pathEl);
  buttonEl.appendChild(svgEl);
  return buttonEl;
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
  const safeRows = applyOverviewClientFilters(rows);
  overviewTbodyEl.innerHTML = "";
  if (!safeRows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.textContent = "No rows.";
    tr.appendChild(td);
    overviewTbodyEl.appendChild(tr);
    scheduleOverviewAutoSize();
    return;
  }

  for (const row of safeRows) {
    const tr = document.createElement("tr");

    const openTd = document.createElement("td");
    const openBtn = createOverviewIconButton({
      title: "Open",
      ariaLabel: "Open",
      pathD:
        "M10 2h4v4h-1.8V4.9L7.5 9.6 6.4 8.5 11.1 3.8H10V2ZM3 4h4v1.5H4.5v6h6V9H12v4H3V4Z",
    });
    openBtn.addEventListener("click", () => {
      openLinkedIn(row?.url || "");
    });
    openTd.appendChild(openBtn);
    tr.appendChild(openTd);

    const archiveTd = document.createElement("td");
    const isArchived = isOverviewRowArchived(row);
    const archiveBtn = isArchived
      ? createOverviewIconButton({
          title: "Restore",
          ariaLabel: "Restore",
          className: "icon-green",
          pathD:
            "M8 1.8a6.2 6.2 0 1 0 4.4 10.6l-1.1-1.1A4.7 4.7 0 1 1 12.7 8H10l2.7 2.6L15.3 8h-2A6.2 6.2 0 0 0 8 1.8Z",
        })
      : createOverviewIconButton({
          title: "Archive",
          ariaLabel: "Archive",
          className: "icon-red",
          pathD:
            "M2 3.5 3.2 2h9.6L14 3.5V5H2V3.5Zm1 2.5h10v7.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Zm2 2v1.5h6V8H5Z",
        });
    archiveBtn.addEventListener("click", async () => {
      await setArchivedRow(row?.url || "", !isArchived);
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
  scheduleOverviewAutoSize();
}

function getOverviewColumnBounds(index) {
  // Column index map: 0 Open, 1 Archive action, 2 Name, 3 Company,
  // 4 Status, 5 Most relevant date, 6 Campaign, 7 Archived.
  const bounds = [
    { min: 56, max: 64 },
    { min: 56, max: 64 },
    { min: 90, max: 260 },
    { min: 90, max: 260 },
    { min: 80, max: 180 },
    { min: 110, max: 180 },
    { min: 100, max: 240 },
    { min: 70, max: 90 },
  ];
  return bounds[index] || { min: 70, max: 420 };
}

function getOverviewColumnKey(index) {
  const keys = [
    "open",
    "archive_action",
    "name",
    "company",
    "status",
    "most_relevant_date",
    "campaign",
    "archived",
  ];
  return keys[index] || `col_${index}`;
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function ensureOverviewColgroup(columnCount) {
  if (!overviewTableEl) return null;
  let colgroupEl = overviewTableEl.querySelector("colgroup");
  if (!colgroupEl) {
    colgroupEl = document.createElement("colgroup");
    overviewTableEl.insertBefore(colgroupEl, overviewTableEl.firstChild);
  }
  while (colgroupEl.children.length < columnCount) {
    colgroupEl.appendChild(document.createElement("col"));
  }
  return colgroupEl;
}

function schedulePersistOverviewColumnPrefs() {
  if (overviewColumnPersistTimer) {
    clearTimeout(overviewColumnPersistTimer);
  }
  overviewColumnPersistTimer = setTimeout(async () => {
    overviewColumnPersistTimer = null;
    await chrome.storage.local.set({
      [STORAGE_KEY_LIST_COLUMN_WIDTHS]: {
        version: 1,
        updated_at: new Date().toISOString(),
        widths: overviewColumnWidths,
        overridden: overviewColumnOverridden,
      },
    });
  }, 180);
}

async function loadOverviewColumnPrefs() {
  const data = await chrome.storage.local.get([STORAGE_KEY_LIST_COLUMN_WIDTHS]);
  const saved = data?.[STORAGE_KEY_LIST_COLUMN_WIDTHS];
  if (!saved || typeof saved !== "object") {
    overviewColumnWidths = {};
    overviewColumnOverridden = {};
    return;
  }
  overviewColumnWidths =
    saved.widths && typeof saved.widths === "object" ? saved.widths : {};
  overviewColumnOverridden =
    saved.overridden && typeof saved.overridden === "object"
      ? saved.overridden
      : {};
}

function ensureOverviewResizeHandles() {
  if (!overviewTableEl) return;
  const headerRow = overviewTableEl.tHead?.rows?.[0] || null;
  if (!headerRow) return;
  Array.from(headerRow.cells || []).forEach((thEl, index) => {
    thEl.dataset.colKey = getOverviewColumnKey(index);
    let handleEl = thEl.querySelector(".col-resize-handle");
    if (!handleEl) {
      handleEl = document.createElement("div");
      handleEl.className = "col-resize-handle";
      thEl.appendChild(handleEl);
    }
    handleEl.dataset.colIndex = String(index);
    handleEl.dataset.colKey = getOverviewColumnKey(index);
  });
}

function bindOverviewResizeEvents() {
  if (!overviewTableEl) return;
  if (overviewTableEl.dataset.resizeBound === "1") return;
  overviewTableEl.dataset.resizeBound = "1";
  overviewTableEl.addEventListener("pointerdown", (event) => {
    const targetEl =
      event.target instanceof Element
        ? event.target.closest(".col-resize-handle")
        : null;
    if (!targetEl) return;
    const colIndex = Number(targetEl.dataset.colIndex || -1);
    if (!Number.isFinite(colIndex) || colIndex < 0) return;
    const colKey = getOverviewColumnKey(colIndex);
    const headerRow = overviewTableEl.tHead?.rows?.[0] || null;
    if (!headerRow) return;
    const columnCount = headerRow.cells.length;
    const colgroupEl = ensureOverviewColgroup(columnCount);
    if (!colgroupEl) return;
    const colEl = colgroupEl.children[colIndex];
    const headerCell = headerRow.cells[colIndex];
    if (!colEl || !headerCell) return;

    event.preventDefault();
    event.stopPropagation();

    const { min, max } = getOverviewColumnBounds(colIndex);
    const currentWidth = parseFloat(colEl.style.width);
    const initialWidth =
      Number.isFinite(currentWidth) && currentWidth > 0
        ? currentWidth
        : headerCell.getBoundingClientRect().width;
    const startX = event.clientX;
    document.body.classList.add("is-col-resizing");

    const onPointerMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const nextWidth = clampNumber(initialWidth + deltaX, min, max);
      colEl.style.width = `${nextWidth}px`;
      overviewColumnWidths[colKey] = Math.round(nextWidth);
    };

    const onPointerUp = () => {
      document.body.classList.remove("is-col-resizing");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      overviewColumnOverridden[colKey] = true;
      schedulePersistOverviewColumnPrefs();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  });
}

function autoSizeOverviewColumns() {
  if (!overviewTableEl) return;
  if (document.body.classList.contains("is-col-resizing")) return;
  const headerRow = overviewTableEl.tHead?.rows?.[0] || null;
  if (!headerRow) return;

  ensureOverviewResizeHandles();
  bindOverviewResizeEvents();

  const bodyRows = Array.from(overviewTbodyEl?.rows || []).filter(
    (row) => row && row.offsetParent !== null,
  );
  const paddingBuffer = 20;
  const columnCount = headerRow.cells.length;
  const colgroupEl = ensureOverviewColgroup(columnCount);
  if (!colgroupEl) return;

  for (let index = 0; index < columnCount; index += 1) {
    const colKey = getOverviewColumnKey(index);
    const headerCell = headerRow.cells[index];
    const colEl = colgroupEl.children[index];
    if (!colEl) continue;
    if (overviewColumnOverridden[colKey]) {
      const { min, max } = getOverviewColumnBounds(index);
      const savedWidth = Number(overviewColumnWidths[colKey]);
      if (Number.isFinite(savedWidth) && savedWidth > 0) {
        colEl.style.width = `${clampNumber(savedWidth, min, max)}px`;
      }
      continue;
    }
    let widest = headerCell ? headerCell.scrollWidth : 0;

    for (const row of bodyRows) {
      const cell = row.cells[index];
      if (!cell) continue;
      widest = Math.max(widest, cell.scrollWidth);
    }

    const { min, max } = getOverviewColumnBounds(index);
    const width = clampNumber(widest + paddingBuffer, min, max);
    colEl.style.width = `${width}px`;
    overviewColumnWidths[colKey] = Math.round(width);
  }
}

function scheduleOverviewAutoSize() {
  if (overviewAutoSizeTimer) {
    clearTimeout(overviewAutoSizeTimer);
  }
  overviewAutoSizeTimer = setTimeout(() => {
    overviewAutoSizeTimer = null;
    if (document.body.classList.contains("is-col-resizing")) {
      scheduleOverviewAutoSize();
      return;
    }
    autoSizeOverviewColumns();
  }, 180);
}

async function fetchOverviewPage() {
  setFooterFetchingStatus();
  overviewLoadingEl.hidden = false;
  let contextRefreshPromise = null;
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
      scheduleOverviewAutoSize();
      return;
    }
    overviewTotal = Number.isFinite(resp?.total) ? resp.total : null;
    const visibleRows = applyOverviewClientFilters(resp?.rows || []);
    renderOverviewTable(visibleRows);
    contextRefreshPromise = persistOverviewListContext();
    overviewContextRefreshPromise = contextRefreshPromise;
    await contextRefreshPromise;
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
    scheduleOverviewAutoSize();
  } finally {
    if (overviewContextRefreshPromise === contextRefreshPromise) {
      overviewContextRefreshPromise = null;
    }
    overviewLoadingEl.hidden = true;
    setFooterReady();
  }
}

async function buildOverviewListContextItems() {
  const queryBase = buildOverviewQueryState();
  const pageSize = 200;
  const maxPages = 100;
  let page = 1;
  const allItems = [];
  const seen = new Set();

  while (page <= maxPages) {
    const result = await sendRuntimeMessage("DB_LIST_INVITATIONS_OVERVIEW", {
      payload: {
        ...queryBase,
        page,
        pageSize,
      },
    });
    if (!result.ok) break;
    const resp = result.data || {};
    const sourceRows = Array.isArray(resp?.rows) ? resp.rows : [];
    const filteredRows = applyOverviewClientFilters(sourceRows);
    filteredRows.forEach((row) => {
      const canonicalUrl = canonicalizeLinkedInUrl(row?.url || "");
      if (!isLinkedInProfileLikeUrl(canonicalUrl)) {
        return;
      }
      if (seen.has(canonicalUrl)) return;
      seen.add(canonicalUrl);
      allItems.push(canonicalUrl);
    });
    if (sourceRows.length < pageSize) break;
    if (Number.isFinite(resp?.total) && page * pageSize >= resp.total) break;
    page += 1;
  }

  return allItems;
}

async function persistOverviewListContext() {
  const items = await buildOverviewListContextItems();
  overviewContextItems = items;
  const queryBase = buildOverviewQueryState();
  await chrome.storage.local.set({
    lef_list_context: {
      version: 1,
      updated_at: new Date().toISOString(),
      items,
      source: "overview",
      sort: {
        field: queryBase.sortField,
        dir: queryBase.sortDir,
      },
    },
  });
}

async function refreshOverviewListContextSnapshot() {
  if (!OVERVIEW_ENABLED) return;
  try {
    await persistOverviewListContext();
  } catch (_e) {}
}

async function openLinkedIn(url) {
  const targetUrl = String(url || "").trim();
  if (!targetUrl) return;
  const isLinkedInTarget =
    typeof LEF_UTILS.isLinkedInProfileLikeUrl === "function"
      ? LEF_UTILS.isLinkedInProfileLikeUrl(targetUrl)
      : /^https:\/\/www\.linkedin\.com\/(in|company)\/[^/?#]+/i.test(targetUrl);
  if (!isLinkedInTarget) return;
  if (overviewContextRefreshPromise) {
    try {
      await overviewContextRefreshPromise;
    } catch (_e) {}
  }
  const canonicalTargetUrl = canonicalizeLinkedInUrl(targetUrl);
  const canonicalSessionItems = (overviewContextItems || [])
    .map((itemUrl) => canonicalizeLinkedInUrl(itemUrl))
    .filter(Boolean);
  const contextIndex = canonicalSessionItems.indexOf(canonicalTargetUrl);
  const navSessionId = String(Date.now());
  await chrome.storage.local.set({
    lef_list_last_opened_url: canonicalTargetUrl,
    lef_list_last_opened_key: canonicalTargetUrl,
    lef_list_last_opened_index:
      Number.isFinite(contextIndex) && contextIndex >= 0 ? contextIndex : null,
    lef_nav_session_id: navSessionId,
    lef_nav_session_items: canonicalSessionItems,
    lef_nav_session_anchor: canonicalTargetUrl,
  });
  await sendRuntimeMessage("OPEN_LINKEDIN_URL", {
    payload: { url: targetUrl },
  });
}

async function archiveRow(url) {
  await setArchivedRow(url, true);
}

async function setArchivedRow(url, archived) {
  setFooterDbStatus();
  const target = String(url || "").trim();
  if (!target) {
    setFooterReady();
    return;
  }
  try {
    const result = await sendRuntimeMessage("DB_SET_ARCHIVED", {
      payload: { linkedin_url: target, archived: Boolean(archived) },
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

  filterCampaignEl?.addEventListener("change", () => {
    overviewFilters.campaign = normalizeCampaignValue(filterCampaignEl.value);
    updateOverviewCampaignFilterTitle();
    persistOverviewFiltersToStorage().catch(() => null);
    overviewPage = 1;
    fetchOverviewPage();
  });

  overviewArchivedFilterEl?.addEventListener("change", () => {
    overviewFilters.archived = overviewArchivedFilterEl.value;
    persistOverviewFiltersToStorage().catch(() => null);
    overviewPage = 1;
    fetchOverviewPage();
  });

  overviewStatusFilterEl?.addEventListener("change", () => {
    overviewFilters.status = overviewStatusFilterEl.value;
    persistOverviewFiltersToStorage().catch(() => null);
    overviewPage = 1;
    fetchOverviewPage();
  });

  filterAcceptedEl?.addEventListener("change", () => {
    overviewFilters.accepted = filterAcceptedEl.value || "";
    persistOverviewFiltersToStorage().catch(() => null);
    overviewPage = 1;
    fetchOverviewPage();
  });

  overviewSearchEl?.addEventListener("input", () => {
    persistOverviewFiltersToStorage().catch(() => null);
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

function isLinkedInProfileLikeUrl(url) {
  if (typeof LEF_UTILS.isLinkedInProfileLikeUrl === "function") {
    return LEF_UTILS.isLinkedInProfileLikeUrl(url);
  }
  if (!url || typeof url !== "string") return false;
  return /^https:\/\/www\.linkedin\.com\/(in|company)\/[^/?#]+/i.test(url);
}

function canonicalizeLinkedInUrl(rawUrl) {
  if (typeof LEF_UTILS.canonicalizeLinkedInUrl === "function") {
    return LEF_UTILS.canonicalizeLinkedInUrl(rawUrl);
  }
  const input = String(rawUrl || "").trim();
  if (!input) return "";
  try {
    const parsed = new URL(input);
    const pathname = (parsed.pathname || "").replace(/\/+$/, "") || "/";
    return `https://www.linkedin.com${pathname}`;
  } catch (_e) {
    const noHash = input.split("#")[0];
    const noQuery = noHash.split("?")[0];
    const noTrailing = noQuery.replace(/\/+$/, "");
    return noTrailing || "";
  }
}

function getProfileMatchForUrl(url) {
  const normalizedUrl = String(url || "");
  const inRule = /^https:\/\/www\.linkedin\.com\/in\/[^/?#]+/i.test(
    normalizedUrl,
  );
  const companyRule = /^https:\/\/www\.linkedin\.com\/company\/[^/?#]+/i.test(
    normalizedUrl,
  );
  const fallbackMatch = isLinkedInProfileLikeUrl(normalizedUrl);
  if (inRule) return { isProfileOpen: true, matchedRule: "/in/" };
  if (companyRule) return { isProfileOpen: true, matchedRule: "/company/" };
  return {
    isProfileOpen: Boolean(fallbackMatch),
    matchedRule: fallbackMatch ? "fallback" : "none",
  };
}

async function getActiveTabForProfileCheck() {
  const [queriedTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!queriedTab) return null;
  if (queriedTab.url || !Number.isInteger(queriedTab.id)) return queriedTab;
  try {
    const refreshedTab = await chrome.tabs.get(queriedTab.id);
    return refreshedTab || queriedTab;
  } catch (_e) {
    return queriedTab;
  }
}

let emptyStateDebugLogged = false;
function logEmptyStateDebugOnce(payload) {
  if (!DEBUG_EMPTY_STATE || emptyStateDebugLogged) return;
  emptyStateDebugLogged = true;
  console.log("[LEF][empty-state]", payload);
}

function findNoProfileEl() {
  return document.getElementById("noProfileState");
}

function setNoProfileStateVisible(visible) {
  ensureNoProfileStateUi();
  const noProfileEl = findNoProfileEl();
  if (!noProfileEl) return;

  if (visible) noProfileEl.classList.remove("hidden");
  else noProfileEl.classList.add("hidden");

  const detailContentEl = document.getElementById("detailProfileContent");
  if (detailContentEl) {
    if (visible) detailContentEl.classList.add("hidden");
    else detailContentEl.classList.remove("hidden");
  }
}

function getNoProfileDomDebugInfo() {
  const localEl = document.getElementById("noProfileState");
  const frameEl = document.querySelector("iframe");
  const frameNoProfileEl =
    frameEl?.contentDocument?.getElementById("noProfileState") || null;
  const targetEl = localEl || frameNoProfileEl || null;
  return {
    localExists: Boolean(localEl),
    iframeExists: Boolean(frameEl),
    iframeNoProfileExists: Boolean(frameNoProfileEl),
    targetDocument: localEl ? "popup" : frameNoProfileEl ? "iframe" : "none",
    hasClassHidden: targetEl ? targetEl.classList.contains("hidden") : null,
  };
}

function ensureNoProfileStateUi() {
  const tabMainEl = document.getElementById("tabMain");
  if (!tabMainEl) return;

  let detailProfileContentEl = document.getElementById("detailProfileContent");
  if (!detailProfileContentEl) {
    const existing = document.getElementById("detailProfileContent");
    if (existing) {
      detailProfileContentEl = existing;
    } else {
      const wrapper = document.createElement("div");
      wrapper.id = "detailProfileContent";
      while (tabMainEl.firstChild) {
        wrapper.appendChild(tabMainEl.firstChild);
      }
      tabMainEl.appendChild(wrapper);
      detailProfileContentEl = wrapper;
    }
  }

  const noProfileMatches = tabMainEl.querySelectorAll("#noProfileState");
  if (noProfileMatches.length > 1) {
    for (let i = 1; i < noProfileMatches.length; i += 1) {
      noProfileMatches[i].remove();
    }
  }

  let noProfileStateEl = document.getElementById("noProfileState");
  if (!noProfileStateEl) {
    const existing = document.getElementById("noProfileState");
    if (existing) {
      return;
    }
    const stateEl = document.createElement("div");
    stateEl.id = "noProfileState";
    stateEl.className = "empty-state hidden";
    stateEl.setAttribute("aria-live", "polite");

    const innerEl = document.createElement("div");
    innerEl.className = "empty-state-inner";

    const iconEl = document.createElement("div");
    iconEl.className = "empty-state-icon";
    iconEl.setAttribute("aria-hidden", "true");
    iconEl.textContent = "\u{1F464}";

    const textEl = document.createElement("div");
    textEl.className = "empty-state-text";
    textEl.textContent = "Please open a profile in linkedin";

    innerEl.appendChild(iconEl);
    innerEl.appendChild(textEl);
    stateEl.appendChild(innerEl);
    tabMainEl.insertBefore(stateEl, detailProfileContentEl);
  }
}

function getFullNameFromContext(profileContext) {
  return profileContext?.name || profileContext?.full_name || null;
}

async function extractProfileContextFromActiveTab() {
  const activeTab = await getActiveTabForProfileCheck().catch(() => null);
  if (!Number.isInteger(activeTab?.id)) {
    throw new Error("No active tab found.");
  }

  let resp = null;
  try {
    resp = await chrome.tabs.sendMessage(activeTab.id, {
      type: "EXTRACT_PROFILE_CONTEXT",
    });
  } catch (e) {
    throw new Error(
      getErrorMessage(e) || UI_TEXT.couldNotExtractProfileContext,
    );
  }

  if (!resp || !resp?.ok || !resp?.profile) {
    throw new Error(
      getErrorMessage(resp?.error) || UI_TEXT.couldNotExtractProfileContext,
    );
  }
  return getProfileForGeneration(resp.profile);
}

function applyProfileExtractionFailureState(statusText) {
  currentProfileContext = null;
  lastProfileContextSent = {};
  lastProfileContextEnriched = null;
  dbInvitationRow = null;
  setCampaignSelectValue("");
  if (previewEl) previewEl.textContent = "";
  if (firstMessagePreviewEl) firstMessagePreviewEl.textContent = "";
  if (followupPreviewEl) followupPreviewEl.value = "";
  if (freePromptPreviewEl) freePromptPreviewEl.textContent = "";
  updateInviteCopyIconVisibility();
  updateMessageTabControls();
  updateFollowupCopyIconVisibility();
  updateFreePromptCopyButtonState();
  setCommunicationStatus(statusText || UI_TEXT.couldNotExtractProfileContext);
  applyLifecycleUiState(dbInvitationRow);
  outreachMessageStatus = "accepted";
  renderMessageTab(outreachMessageStatus);
  renderDetailHeader();
  updatePhaseButtons();
}

async function refreshAll() {
  const activeTab = await getActiveTabForProfileCheck().catch(() => null);
  const tabUrl = activeTab?.url || "";
  const { isProfileOpen, matchedRule } = getProfileMatchForUrl(tabUrl);

  if (!isProfileOpen) {
    setNoProfileStateVisible(true);
    logEmptyStateDebugOnce({
      tabId: activeTab?.id ?? null,
      tabUrl: tabUrl || null,
      tabStatus: activeTab?.status || null,
      isProfileOpen,
      matchedRule,
      dom: getNoProfileDomDebugInfo(),
    });
    currentProfileContext = null;
    lastProfileContextSent = {};
    lastProfileContextEnriched = null;
    dbInvitationRow = null;
    setCampaignSelectValue("");
    updateMessageTabControls();
    applyLifecycleUiState(dbInvitationRow);
    outreachMessageStatus = "accepted";
    renderMessageTab(outreachMessageStatus);
    setCommunicationStatus(UI_TEXT.lifecycleOpenLinkedInProfileFirst);
    renderDetailHeader();
    updatePhaseButtons();
    return false;
  }

  try {
    setNoProfileStateVisible(false);
    logEmptyStateDebugOnce({
      tabId: activeTab?.id ?? null,
      tabUrl: tabUrl || null,
      tabStatus: activeTab?.status || null,
      isProfileOpen,
      matchedRule,
      dom: getNoProfileDomDebugInfo(),
    });
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
    return true;
  } catch (_e) {
    setNoProfileStateVisible(false);
    applyProfileExtractionFailureState(
      getErrorMessage(_e) || UI_TEXT.couldNotExtractProfileContext,
    );
    return false;
  }
}

async function loadProfileContextOnOpen() {
  try {
    return await refreshAll();
  } catch (_e) {
    setNoProfileStateVisible(false);
    applyProfileExtractionFailureState(UI_TEXT.couldNotExtractProfileContext);
    return false;
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

function getFreePromptLanguage() {
  return normalizeLanguageValue(freePromptLanguageEl?.value) || getLanguage();
}

async function setFreePromptLanguage(value, { persist = true } = {}) {
  if (!freePromptLanguageEl) return;
  const normalized = normalizeLanguageValue(value) || "Portuguese";
  freePromptLanguageEl.value = normalized;
  if (persist) {
    await chrome.storage.local.set({
      [STORAGE_KEY_FREE_PROMPT_LANGUAGE]: normalized,
    });
  }
}

async function loadFreePromptLanguage() {
  const data = await chrome.storage.local.get([
    STORAGE_KEY_FREE_PROMPT_LANGUAGE,
    STORAGE_KEY_MESSAGE_LANGUAGE,
  ]);
  const savedFreePromptLanguage = normalizeLanguageValue(
    data?.[STORAGE_KEY_FREE_PROMPT_LANGUAGE],
  );
  if (savedFreePromptLanguage) {
    await setFreePromptLanguage(savedFreePromptLanguage, { persist: false });
    return;
  }
  const savedMessageLanguage = normalizeLanguageValue(
    data?.[STORAGE_KEY_MESSAGE_LANGUAGE],
  );
  if (savedMessageLanguage) {
    await setFreePromptLanguage(savedMessageLanguage, { persist: false });
    return;
  }
  await setFreePromptLanguage("Portuguese", { persist: false });
}

async function copyToClipboard(text) {
  const value = typeof text === "string" ? text : String(text ?? "");

  if (
    navigator?.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(value);
      return { ok: true };
    } catch (_err) {
      // Fallback below.
    }
  }

  try {
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

    if (!ok) {
      return { ok: false, error: "Copy failed (execCommand)." };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
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

function showFirstMessageCopySuccessCheck(buttonEl) {
  const btn = buttonEl || copyFirstMessageBtnEl;
  if (!btn) return;
  setCopyIconSuccessState(btn);
  if (firstMessageCopyIconResetTimer) {
    clearTimeout(firstMessageCopyIconResetTimer);
  }
  firstMessageCopyIconResetTimer = setTimeout(() => {
    if (btn) {
      setCopyIconDefaultState(btn);
    }
    firstMessageCopyIconResetTimer = null;
  }, 800);
}

function showFollowupCopySuccessCheck(buttonEl) {
  const btn = buttonEl || copyFollowupBtnEl;
  if (!btn) return;
  setCopyIconSuccessState(btn);
  if (followupCopyIconResetTimer) {
    clearTimeout(followupCopyIconResetTimer);
  }
  followupCopyIconResetTimer = setTimeout(() => {
    if (btn) {
      setCopyIconDefaultState(btn);
    }
    followupCopyIconResetTimer = null;
  }, 800);
}

function showFreePromptCopySuccessCheck(buttonEl) {
  const btn = buttonEl || copyFreePromptBtnEl;
  if (!btn) return;
  setCopyIconSuccessState(btn);
  if (freePromptCopyIconResetTimer) {
    clearTimeout(freePromptCopyIconResetTimer);
  }
  freePromptCopyIconResetTimer = setTimeout(() => {
    if (btn) {
      setCopyIconDefaultState(btn);
    }
    freePromptCopyIconResetTimer = null;
  }, 800);
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

function updateFollowupCopyIconVisibility() {
  if (!copyFollowupBtnEl || !followupPreviewEl) return;
  const hasText = (followupPreviewEl.value || "").trim().length > 0;
  if (!hasText) {
    setCopyIconDefaultState(copyFollowupBtnEl);
  }
  copyFollowupBtnEl.hidden = !hasText;
  copyFollowupBtnEl.disabled = !hasText;
}

function updateFreePromptCopyButtonState() {
  if (!copyFreePromptBtnEl || !freePromptPreviewEl) return;
  const hasText = (freePromptPreviewEl.textContent || "").trim().length > 0;
  if (!hasText) {
    setCopyIconDefaultState(copyFreePromptBtnEl);
  }
  copyFreePromptBtnEl.hidden = !hasText;
  copyFreePromptBtnEl.disabled = !hasText;
}

async function onInvitationTabOpenedByUser() {
  setFooterStatus(UI_TEXT.preparingProfile);
  await loadProfileContextOnOpen();
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

function setActiveTab(which, { userInitiated = false } = {}) {
  if (IS_SIDE_PANEL_CONTEXT && !userInitiated) {
    return;
  }
  if (!tabMainBtn || !tabConfigBtn || !tabMain || !tabConfig) {
    return;
  }
  const freePromptActive = which === "free_prompt";
  const detailActive =
    which === "detail" || which === "invitation" || freePromptActive;
  const overviewActive = OVERVIEW_ENABLED && which === "overview";
  const configActive = which === "config";

  tabMainBtn.classList.toggle("active", detailActive);
  if (tabOverviewBtn) tabOverviewBtn.classList.toggle("active", overviewActive);
  tabConfigBtn.classList.toggle("active", configActive);

  tabMain.classList.toggle("active", detailActive);
  if (tabOverview) tabOverview.classList.toggle("active", overviewActive);
  tabConfig.classList.toggle("active", configActive);
  if (tabMessage)
    tabMessage.hidden =
      !detailActive ||
      detailInnerTab === "invite" ||
      detailInnerTab === "free_prompt";

  if (freePromptActive) {
    setDetailInnerTab("free_prompt");
  }

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

  if (apiKeyEl && apiKey) apiKeyEl.value = apiKey;
  if (webhookSecretEl && webhookSecret) webhookSecretEl.value = webhookSecret;

  if (modelEl) modelEl.value = model || "gpt-4.1";
  if (strategyEl && strategyCore) strategyEl.value = strategyCore;
  if (webhookBaseUrlEl && webhookBaseUrl)
    webhookBaseUrlEl.value = webhookBaseUrl;
}
let popupInitErrorLogged = false;
function logPopupInitError(error) {
  if (popupInitErrorLogged) return;
  popupInitErrorLogged = true;
  console.error(`[LEF][init] popup init failed: ${getErrorMessage(error)}`);
  if (error && typeof error === "object" && typeof error.stack === "string") {
    console.error(error.stack);
  }
}

function runPopupInit() {
  tabMainBtn?.addEventListener("click", async () => {
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
  tabConfigBtn?.addEventListener("click", () =>
    setActiveTab("config", { userInitiated: true }),
  );

  loadSettings().catch((_e) => {});
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
  detailTabFreePromptBtnEl?.addEventListener("click", () => {
    setActiveTab("free_prompt", { userInitiated: true });
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
  bindStepperClickHandlers();
  updateMessageTabControls();
  if (OVERVIEW_ENABLED) {
    wireOverviewEvents();
    loadOverviewColumnPrefs()
      .then(() => {
        scheduleOverviewAutoSize();
      })
      .catch(() => {
        scheduleOverviewAutoSize();
      });
    if (document.documentElement.dataset.overviewResizeBound !== "1") {
      document.documentElement.dataset.overviewResizeBound = "1";
      window.addEventListener("resize", () => {
        scheduleOverviewAutoSize();
      });
    }
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
  loadProfileContextOnOpen().catch((_e) => {});
  loadFirstMessagePrompt().catch((_e) => {
    lastSavedFirstMessagePrompt = messagePromptEl?.value || "";
    updateSavePromptButtonState();
  });
  loadMessageLanguage().catch((_e) => {});
  loadFreePromptLanguage().catch((_e) => {});
  loadCampaignOptions({ keepSelected: true })
    .then(() => applyCampaignSelectionFromProfile())
    .catch((_e) => {})
    .finally(() => {
      restoreOverviewFiltersFromStorage()
        .then(() => {
          if (tabOverview?.classList.contains("active")) {
            overviewPage = 1;
            fetchOverviewPage();
          }
        })
        .catch(() => null);
    });
  setNewCampaignRowVisible(false);

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
  freePromptLanguageEl?.addEventListener("change", async () => {
    await setFreePromptLanguage(freePromptLanguageEl.value);
  });

  campaignSelectEl?.addEventListener("change", async () => {
    updateDetailCampaignSelectTitle();
    await handleCampaignSelection(campaignSelectEl.value);
  });

  toggleNewCampaignBtnEl?.addEventListener("click", () => {
    setNewCampaignRowVisible(true);
    newCampaignNameEl?.focus();
  });

  addCampaignBtnEl?.addEventListener("click", async () => {
    const newCampaignValue = normalizeCampaignValue(
      newCampaignNameEl?.value || "",
    );
    if (!newCampaignValue) return;
    setCampaignSelectValue(newCampaignValue);
    await handleCampaignSelection(newCampaignValue);
    await loadCampaignOptions({ keepSelected: true });
    setCampaignSelectValue(newCampaignValue);
    setNewCampaignRowVisible(false);
  });

  cancelNewCampaignBtnEl?.addEventListener("click", () => {
    setNewCampaignRowVisible(false);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    try {
      runPopupInit();
    } catch (error) {
      logPopupInitError(error);
    }
  });
} else {
  try {
    runPopupInit();
  } catch (error) {
    logPopupInitError(error);
  }
}

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

const saveConfigBtnEl = document.getElementById("saveConfig");
if (saveConfigBtnEl) {
  saveConfigBtnEl.addEventListener("click", async () => {
    setFooterUpdatingStatus();
    try {
      await saveConfig();
    } finally {
      setFooterReady();
    }
  });
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
  await setMarkedStatusForStepper("invited", UI_TEXT.markedInvited);
}

async function onStepAcceptedClick() {
  await setAcceptedToggleForStepper();
}

async function onStepFirstMessageSentClick() {
  await setMarkedStatusForStepper(
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

async function setMarkedStatusForStepper(statusValue, successText) {
  let footerHandled = false;
  setFooterDbStatus();
  try {
    const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
    if (!linkedin_url) {
      setFooterStatus(UI_TEXT.openLinkedInProfileFirst);
      footerHandled = true;
      return;
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
        await setStatusOnlyForStepper("invited", "Back to invited");
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

copyInviteIconEl?.addEventListener("click", async () => {
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

async function handleGenerateFreePromptClick() {
  try {
    const prompt = (freePromptInputEl?.value || "").trim();
    const includeProfile = freePromptIncludeProfileEl
      ? freePromptIncludeProfileEl.checked
      : true;
    const includeStrategy = freePromptIncludeStrategyEl
      ? freePromptIncludeStrategyEl.checked
      : true;

    if (!prompt) {
      setFooterStatus("Prompt is required.");
      updateFreePromptCopyButtonState();
      return;
    }

    let profileForGeneration = null;
    if (includeProfile) {
      profileForGeneration = currentProfileContext;
      const linkedinUrl = getLinkedinUrlFromContext(profileForGeneration);
      if (!profileForGeneration || !linkedinUrl) {
        setFooterStatus(
          "Profile context is missing. Open a LinkedIn profile and try again.",
        );
        updateFreePromptCopyButtonState();
        return;
      }
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
      setFooterStatus(UI_TEXT.setApiKeyInConfig);
      return;
    }

    const strategyCoreRaw = (strategyEl?.value || "").trim();
    const payload = {
      apiKey,
      model: (model || "gpt-4.1").trim(),
      language: getFreePromptLanguage(),
      prompt,
      includeProfile,
      includeStrategy,
    };
    if (includeProfile && profileForGeneration) {
      payload.profile = { ...profileForGeneration };
    }
    if (includeStrategy) {
      payload.strategyCore = strategyCoreRaw || "(none)";
    }

    setFooterStatus(UI_TEXT.callingOpenAI);
    const result = await sendRuntimeMessage("GENERATE_FREE_PROMPT", {
      payload,
    });
    const resp = result.data || {};
    if (!result.ok || !resp?.ok) {
      throw new Error(getErrorMessage(result.error || resp?.error));
    }

    const generatedText = (resp.text || "").trim();
    if (freePromptPreviewEl) {
      freePromptPreviewEl.textContent = generatedText;
    }
    updateFreePromptCopyButtonState();
    setFooterStatus(generatedText ? "Ready" : UI_TEXT.noMessageGenerated);
  } catch (e) {
    if (freePromptPreviewEl) {
      freePromptPreviewEl.textContent = "";
    }
    updateFreePromptCopyButtonState();
    setFooterStatus(`${UI_TEXT.errorPrefix} ${getErrorMessage(e)}`);
  }
}

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

function bindGenerateFreePromptClickHandler() {
  if (!generateFreePromptBtnEl) return;
  if (generateFreePromptBtnEl.dataset.freePromptBound === "1") return;
  generateFreePromptBtnEl.dataset.freePromptBound = "1";
  generateFreePromptBtnEl.addEventListener(
    "click",
    handleGenerateFreePromptClick,
  );
}

bindGenerateFreePromptClickHandler();

function bindFollowupCopyHandler() {
  if (!copyFollowupBtnEl) {
    debugLog("[copy] missing #copyFollowup");
    return;
  }
  bindMessagePreviewCopyHandlers();
}

bindFollowupCopyHandler();

function bindCopyFreePromptHandler() {
  if (!copyFreePromptBtnEl || !freePromptPreviewEl) return;
  if (copyFreePromptBtnEl.dataset.freePromptCopyBound === "1") return;
  copyFreePromptBtnEl.dataset.freePromptCopyBound = "1";
  copyFreePromptBtnEl.addEventListener("click", async () => {
    const previewText = freePromptPreviewEl.textContent || "";
    if (!previewText.trim()) {
      setFooterStatus(UI_TEXT.nothingToCopy);
      return;
    }
    const copyResult = await copyToClipboard(previewText);
    if (!copyResult.ok) {
      setFooterStatus(
        `${UI_TEXT.copyFailedPrefix} ${getErrorMessage(copyResult.error)}`,
      );
      return;
    }
    showFreePromptCopySuccessCheck(copyFreePromptBtnEl);
    setFooterStatus(UI_TEXT.copiedToClipboard);
  });
}

bindCopyFreePromptHandler();
setCopyIconDefaultState(copyInviteIconEl);
setCopyIconDefaultState(copyFirstMessageBtnEl);
setCopyIconDefaultState(copyFollowupBtnEl);
setCopyIconDefaultState(copyFreePromptBtnEl);
updateFreePromptCopyButtonState();

followupPreviewEl?.addEventListener("input", () => {
  updateFollowupCopyIconVisibility();
});

followupObjectiveEl?.addEventListener("input", () => {
  if ((followupObjectiveEl.value || "").trim()) {
    followupObjectiveEl.classList.remove("is-invalid");
  }
});
