// popup.js is startup/orchestration only.
// Business logic should live in popup controllers.
// Do not add new flow logic here unless it is startup wiring.
const POPUP_DOM = globalThis.PopupDom;
if (!POPUP_DOM || typeof POPUP_DOM !== "object") {
  throw new Error("PopupDom must be loaded before popup.js.");
}
const {
  focusEl,
  messageLanguageEl,
  inviteLanguageEl,
  freePromptLanguageEl,
  campaignSelectEl,
  renameCampaignBtnEl,
  renameCampaignRowEl,
  renameCampaignNameEl,
  saveRenameCampaignBtnEl,
  cancelRenameCampaignBtnEl,
  newCampaignRowEl,
  toggleNewCampaignBtnEl,
  newCampaignNameEl,
  addCampaignBtnEl,
  cancelNewCampaignBtnEl,
  linkedCampaignsListEl,
  firstMessageAdditionalPromptEl,
  generateFirstMessageBtnEl,
  markMessageSentBtnEl,
  copyFirstMessageBtnEl,
  saveFirstMessageIconEl,
  initialMessageSectionEl,
  firstMessagePreviewSectionEl,
  acceptedModeEl,
  firstMessageSentModeEl,
  followupSectionEl,
  followupObjectiveEl,
  includeStrategyEl,
  generateFollowupBtnEl,
  footerStatusEl,
  followupPreviewEl,
  copyFollowupBtnEl,
  freePromptInputEl,
  freePromptIncludeProfileEl,
  freePromptIncludeStrategyEl,
  generateFreePromptBtnEl,
  freePromptPreviewEl,
  copyFreePromptBtnEl,
  previewEl,
  firstMessagePreviewEl,
  copyInviteIconEl,
  saveInviteBtnEl,
  openSidePanelBtnEl,
  detailPersonNameEl,
  detailCompanyEl,
  detailEmployeeNumberEl,
  detailHeadlineEl,
  detailCommentsEl,
  detailCityEl,
  detailItMembersEl,
  detailCompanyLabelEl,
  detailEmployeeNumberLabelEl,
  detailHeadlineLabelEl,
  detailCommentsLabelEl,
  detailCityLabelEl,
  detailItMembersLabelEl,
  companyExistingLinkSectionEl,
  companyExistingLinkInputEl,
  companyExistingLinkStatusEl,
  companyExistingLinkButtonEl,
  companyExistingLinkOptionsEl,
  companyPeopleSectionEl,
  companyPeopleListEl,
  companyCampaignControlsEl,
  companyLinkedCampaignsListEl,
  companyCampaignSelectEl,
  companyRenameCampaignBtnEl,
  companyRenameCampaignRowEl,
  companyRenameCampaignNameEl,
  companySaveRenameCampaignBtnEl,
  companyCancelRenameCampaignBtnEl,
  companyToggleNewCampaignBtnEl,
  companyNewCampaignRowEl,
  companyNewCampaignNameEl,
  companyAddCampaignBtnEl,
  companyCancelNewCampaignBtnEl,
  enrichProfileBtnEl,
  editProfileBtnEl,
  saveProfileFieldsBtnEl,
  cancelProfileEditBtnEl,
  acceptCompanySuggestionBtnEl,
  companyLinkedRowEl,
  companyLinkedNameEl,
  companyLinkedEmployeeNumberEl,
  companyLinkSearchInputEl,
  companyLinkedIndicatorEl,
  companyLinkSearchOptionsEl,
  companyQuickLinkBtn,
  companySuggestionWarningEl,
  personNotRegisteredStateEl,
  companyUrlMismatchBannerEl,
  campaignGroupEl,
  campaignDividerEl,
  statusDividerEl,
  detailTabsDividerEl,
  detailTabsRowEl,
  statusStepperEl,
  stepRegisterEl,
  stepInvitedEl,
  stepAcceptedEl,
  stepFirstMessageSentEl,
  stepperUnderlayEl,
  messageCountBadgeEl,
  messageCountControlsEl,
  messageCountDecrementEl,
  messageCountIncrementEl,
  stepMessageRespondedEl,
  detailInviteSectionEl,
  detailMessageMountEl,
  tabFreePromptEl,
  tabMainBtn,
  tabMessageBtn,
  tabOverviewBtn,
  tabConfigBtn,
  tabSupabaseAuthBtn,
  tabMain,
  tabMessage,
  tabOverview,
  tabConfig,
  tabSupabaseAuth,
  configGeneralTabBtnEl,
  configSupabaseTabBtnEl,
  configGeneralPanelEl,
  authInnerSignupBtnEl,
  authInnerLoginBtnEl,
  supabaseAuthFormsEl,
  authSignupPanelEl,
  authLoginPanelEl,
  supabaseSignupNameEl,
  supabaseSignupEmailEl,
  supabaseSignupPasswordEl,
  supabaseSignupBtnEl,
  supabaseLoginEmailEl,
  supabaseLoginPasswordEl,
  supabaseLoginBtnEl,
  supabaseResetPasswordBtnEl,
  supabaseLoggedInPanelEl,
  supabaseUserEmailEl,
  supabaseLogoutBtnEl,
  filterCampaignEl,
  overviewArchivedFilterEl,
  overviewStatusFilterEl,
  filterAcceptedEl,
  overviewSearchEl,
  overviewSearchClearBtnEl,
  overviewTbodyEl,
  overviewPageSizeEl,
  overviewPrevBtnEl,
  overviewNextBtnEl,
  overviewCountLabelEl,
  overviewTableEl,
  companyOverviewTableEl,
  listPersonsTabBtnEl,
  listCompaniesTabBtnEl,
  personsListPanelEl,
  companiesListPanelEl,
  companyArchivedFilterEl,
  companyCampaignFilterEl,
  companySearchEl,
  companySearchClearBtnEl,
  companyOverviewTbodyEl,
  companyOverviewPageSizeEl,
  companyOverviewPrevBtnEl,
  companyOverviewNextBtnEl,
  companyOverviewCountLabelEl,
} = POPUP_DOM;
// DO NOT write to .textContent directly; use setFooterStatus()

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
const POPUP_MESSAGE_TYPES = globalThis.PopupMessageTypes;
const POPUP_STORAGE_KEYS = globalThis.PopupStorageKeys;
const POPUP_STATUS_CONSTANTS = globalThis.PopupStatusConstants;
if (!POPUP_MESSAGE_TYPES || !POPUP_STORAGE_KEYS || !POPUP_STATUS_CONSTANTS) {
  throw new Error("Popup shared constants must be loaded before popup modules.");
}
const STORAGE_KEY_MESSAGE_LANGUAGE = POPUP_STORAGE_KEYS.messageLanguage;
const STORAGE_KEY_FREE_PROMPT_LANGUAGE = POPUP_STORAGE_KEYS.freePromptLanguage;
const STORAGE_KEY_LAST_ACTIVE_CAMPAIGN = "last_active_campaign";
const STORAGE_KEY_LIST_FILTERS = "lef_list_filters_v1";
const STORAGE_KEY_LIST_COLUMN_WIDTHS = "lef_list_column_widths_v1";
const STORAGE_KEY_NAV_PACING = "lef_nav_pacing_v1";
const DEFAULT_SUPABASE_URL = "https://nkhujuqjnbzsfqyqfndc.supabase.co";
const DEFAULT_NAV_PACING_CONFIG = Object.freeze({
  enabled: true,
  burst_free_count: 3,
  cooldown_min_ms: 1200,
  cooldown_max_ms: 3200,
  quiet_reset_ms: 12000,
});
const SUPPORTED_LANGUAGES = ["Portuguese", "English", "Dutch", "Spanish"];
const POPUP_UTILS = globalThis.PopupUtils;
if (!POPUP_UTILS || typeof POPUP_UTILS !== "object") {
  throw new Error("PopupUtils must be loaded before popup.js.");
}
const PopupLogger = globalThis.PopupLogger;
if (!PopupLogger || typeof PopupLogger !== "object") {
  throw new Error("PopupLogger must be loaded before popup.js.");
}
const LEF_UTILS = POPUP_UTILS.LEF_UTILS || globalThis.LEFUtils || {};
const PopupState = globalThis.PopupState;
if (!PopupState || typeof PopupState !== "object") {
  throw new Error("PopupState must be loaded before popup.js.");
}
const PopupLifecycleController = globalThis.PopupLifecycleController;
if (!PopupLifecycleController || typeof PopupLifecycleController !== "object") {
  throw new Error("PopupLifecycleController must be loaded before popup.js.");
}
const PopupConfigController = globalThis.PopupConfigController;
if (!PopupConfigController || typeof PopupConfigController !== "object") {
  throw new Error("PopupConfigController must be loaded before popup.js.");
}
const PopupChatController = globalThis.PopupChatController;
if (!PopupChatController || typeof PopupChatController !== "object") {
  throw new Error("PopupChatController must be loaded before popup.js.");
}
const PopupMessageController = globalThis.PopupMessageController;
if (!PopupMessageController || typeof PopupMessageController !== "object") {
  throw new Error("PopupMessageController must be loaded before popup.js.");
}
const PopupProfileController = globalThis.PopupProfileController;
if (!PopupProfileController || typeof PopupProfileController !== "object") {
  throw new Error("PopupProfileController must be loaded before popup.js.");
}
const PopupInvitationController = globalThis.PopupInvitationController;
if (!PopupInvitationController || typeof PopupInvitationController !== "object") {
  throw new Error("PopupInvitationController must be loaded before popup.js.");
}
const DEBUG_EMPTY_STATE = false;
const safeTrim =
  typeof POPUP_UTILS.safeTrim === "function"
    ? POPUP_UTILS.safeTrim
    : (value) => (value == null ? "" : String(value).trim());
const normalizeWhitespace =
  typeof POPUP_UTILS.normalizeWhitespace === "function"
    ? POPUP_UTILS.normalizeWhitespace
    : (value) => safeTrim(value).replace(/\s+/g, " ");
const sanitizeHeadlineJobTitle =
  typeof POPUP_UTILS.sanitizeHeadlineJobTitle === "function"
    ? POPUP_UTILS.sanitizeHeadlineJobTitle
    : normalizeWhitespace;
const sendRuntimeMessage =
  typeof POPUP_UTILS.sendRuntimeMessage === "function"
    ? POPUP_UTILS.sendRuntimeMessage
    : LEF_UTILS.sendRuntimeMessage;
const debugLog =
  typeof POPUP_UTILS.debugLog === "function" ? POPUP_UTILS.debugLog : () => {};
const IS_SIDE_PANEL_CONTEXT =
  typeof POPUP_UTILS.isSidePanelContext === "function"
    ? POPUP_UTILS.isSidePanelContext()
    : false;

function debug(...args) {
  debugLog(...args);
}

if (!openSidePanelBtnEl) {
  PopupLogger.error("[sidepanel] missing #openSidePanel");
}

let latestPersonScrape = null;
let latestCompanyScrape = null;
let isProfileEditMode = false;
let isProfileSaveInFlight = false;
let companySuggestion = null;
let companySuggestionLookupSeq = 0;
let isAcceptingCompanySuggestion = false;
let companyLinkSearchDebounceTimer = null;
let companyLinkSearchResults = [];
let selectedCompanyForSave = null;
let dbCompanyRow = null;
let companyPeopleRows = [];
let companyLinkedCampaignRows = [];
let companyExistingLinkResults = [];
let selectedExistingCompanyForLink = null;
let companyExistingLinkDebounceTimer = null;
let selectedCompanyFromListLinkedinUrl = "";
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
let gridAutoSizeTimers = {};
let overviewColumnWidths = {};
let overviewColumnOverridden = {};
let gridColumnPersistTimer = null;
let overviewContextRefreshPromise = null;
let companyOverviewPage = 1;
let companyOverviewPageSize = 25;
let companyOverviewTotal = null;
let companyOverviewSortField = "company_name";
let companyOverviewSortDir = "asc";
let companyOverviewSearch = "";
let companyOverviewFilters = { archived: "", campaign: "" };
let companyOverviewSearchDebounceTimer = null;
let companyOverviewRows = [];
let activeListTab = "persons";
const personGridState = {
  page: 1,
  pageSize: 25,
  total: null,
  sortField: "most_relevant_date",
  sortDir: "desc",
  filters: {
    campaign: "",
    archived: "",
    status: "",
    accepted: "",
  },
  search: "",
};
const companyGridState = {
  page: 1,
  pageSize: 25,
  total: null,
  sortField: "company_name",
  sortDir: "asc",
  filters: { archived: "", campaign: "" },
  search: "",
};
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
let isMarkingMessageSent = false;
let currentLanguage = "Portuguese";
let firstMessageCopyIconResetTimer = null;
let followupCopyIconResetTimer = null;
let freePromptCopyIconResetTimer = null;
let readyResetTimer = null;
let knownCampaignValues = [];
let knownCampaignRows = [];
let linkedPersonCampaignRows = [];
let overviewContextItems = [];
let supabaseAuthIsLoggedIn = false;
let supabaseAuthInnerTab = "signup";
let messageCountLegacyFixAttemptedUrl = "";
const OVERVIEW_CAMPAIGN_LABEL_MAX = 52;
const COPY_ICON_GLYPH = "\u29c9";
const COPY_TOOLTIP_DEFAULT = "Copy to clipboard";
const COPY_TOOLTIP_SUCCESS = "Copied";
const OVERVIEW_ENABLED = Boolean(
  IS_SIDE_PANEL_CONTEXT && tabOverviewBtn && tabOverview,
);
const state = {
  profile: null,
  dbRow: null,
  messageStatus: null,
};
let popupModulesInitialized = false;
globalThis.DEBUG_EMPTY_STATE = DEBUG_EMPTY_STATE;
Object.defineProperties(globalThis, {
  latestPersonScrape: {
    configurable: true,
    get: () => latestPersonScrape,
    set: (value) => {
      latestPersonScrape = value;
    },
  },
  latestCompanyScrape: {
    configurable: true,
    get: () => latestCompanyScrape,
    set: (value) => {
      latestCompanyScrape = value;
    },
  },
  isProfileEditMode: {
    configurable: true,
    get: () => isProfileEditMode,
    set: (value) => {
      isProfileEditMode = Boolean(value);
    },
  },
  isProfileSaveInFlight: {
    configurable: true,
    get: () => isProfileSaveInFlight,
    set: (value) => {
      isProfileSaveInFlight = Boolean(value);
    },
  },
  dbCompanyRow: {
    configurable: true,
    get: () => dbCompanyRow,
    set: (value) => {
      dbCompanyRow = value;
    },
  },
  companyPeopleRows: {
    configurable: true,
    get: () => companyPeopleRows,
    set: (value) => {
      companyPeopleRows = Array.isArray(value) ? value : [];
    },
  },
  selectedExistingCompanyForLink: {
    configurable: true,
    get: () => selectedExistingCompanyForLink,
    set: (value) => {
      selectedExistingCompanyForLink = value;
    },
  },
  selectedCompanyFromListLinkedinUrl: {
    configurable: true,
    get: () => selectedCompanyFromListLinkedinUrl,
    set: (value) => {
      selectedCompanyFromListLinkedinUrl = value == null ? "" : String(value);
    },
  },
  linkedPersonCampaignRows: {
    configurable: true,
    get: () => linkedPersonCampaignRows,
    set: (value) => {
      linkedPersonCampaignRows = Array.isArray(value) ? value : [];
    },
  },
  messageCountLegacyFixAttemptedUrl: {
    configurable: true,
    get: () => messageCountLegacyFixAttemptedUrl,
    set: (value) => {
      messageCountLegacyFixAttemptedUrl = value == null ? "" : String(value);
    },
  },
});
globalThis.previewEl = previewEl;
globalThis.firstMessagePreviewEl = firstMessagePreviewEl;
globalThis.followupPreviewEl = followupPreviewEl;
const LEF_GRID =
  typeof globalThis.initPopupGridUtils === "function"
    ? globalThis.initPopupGridUtils()
    : null;

function fetchActiveListTabPage() {
  if (activeListTab === "companies") {
    return fetchCompaniesOverviewPage();
  }
  return fetchOverviewPage();
}

function initPopupModules() {
  if (popupModulesInitialized) return;
  const tabsApi = initTabsModule({
    IS_SIDE_PANEL_CONTEXT,
    OVERVIEW_ENABLED,
    getDetailInnerTab: () => detailInnerTab,
    isCompanyProfileMode,
    applyProfileModeUi,
    setDetailInnerTab,
    fetchOverviewPage: fetchActiveListTabPage,
  });
  const configApi = PopupConfigController.configure({
    state,
    setFooterStatus,
    setFooterUpdatingStatus,
    setFooterReady,
    setLanguage,
    setFreePromptLanguage,
  });
  const promptsApi = initPromptsModule({
    state,
    sendRuntimeMessage,
    setFooterUpdatingStatus,
    setFooterStatus,
    setFooterReady,
  });
  const personApi = initPersonModule({ state });
  const messagesApi = initMessagesModule({ state });
  Object.assign(
    globalThis,
    tabsApi,
    configApi,
    promptsApi,
    personApi,
    messagesApi,
  );
  popupModulesInitialized = true;
}

function timingLog(eventName, details = {}) {
  PopupLogger.debug("[LEF][timing]", eventName, {
    ts: Date.now(),
    ...details,
  });
}

const getLifecycleStatusValue =
  PopupLifecycleController.getLifecycleStatusValue;
const applyLifecycleUiState =
  PopupLifecycleController.applyLifecycleUiState;
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

function normalizeCampaignValue(value) {
  return safeTrim(value);
}

function normalizeLinkedinCompanyCompareUrl(value) {
  const canonical = canonicalizeLinkedInUrl(value || "");
  return String(canonical || "").replace(/\/+$/, "").toLowerCase();
}

function setCompanyUrlMismatchBannerVisible(visible) {
  if (!companyUrlMismatchBannerEl) return;
  companyUrlMismatchBannerEl.hidden = !visible;
}

async function refreshCompanyUrlMismatchBanner() {
  const selectedUrl = normalizeLinkedinCompanyCompareUrl(
    selectedCompanyFromListLinkedinUrl,
  );
  if (!selectedUrl) {
    setCompanyUrlMismatchBannerVisible(false);
    return;
  }
  const activeTab = await getActiveTabForProfileCheck().catch(() => null);
  const activeUrl = canonicalizeLinkedInUrl(activeTab?.url || "");
  const activePage = detectLinkedInPageType(activeUrl);
  if (activePage.page_type !== "company") {
    setCompanyUrlMismatchBannerVisible(false);
    return;
  }
  const activeCompanyUrl = normalizeLinkedinCompanyCompareUrl(activePage.linkedin_id);
  setCompanyUrlMismatchBannerVisible(Boolean(activeCompanyUrl && activeCompanyUrl !== selectedUrl));
}

function pickCampaignTextColor(hexColor) {
  const raw = String(hexColor || "").trim();
  const match = raw.match(/^#?([0-9a-f]{6})$/i);
  if (!match) return "#374151";
  const hex = match[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.55 ? "#ffffff" : "#111827";
}

async function openCampaignColorPicker({
  campaignId,
  campaignColor,
  onSaved = null,
} = {}) {
  const normalizedCampaignId = safeTrim(campaignId);
  if (!normalizedCampaignId) return;
  const colorInputEl = document.createElement("input");
  colorInputEl.type = "color";
  colorInputEl.value = /^#[0-9a-f]{6}$/i.test(campaignColor || "")
    ? campaignColor
    : "#2563eb";
  colorInputEl.style.position = "fixed";
  colorInputEl.style.left = "-9999px";
  document.body.appendChild(colorInputEl);
  colorInputEl.addEventListener(
    "input",
    async () => {
      setFooterUpdatingStatus();
      try {
        const result = await sendRuntimeMessage("DB_UPDATE_CAMPAIGN", {
          payload: { campaign_id: normalizedCampaignId, color: colorInputEl.value },
        });
        if (!result.ok) {
          throw new Error(getErrorMessage(result.error));
        }
        if (typeof onSaved === "function") {
          await onSaved();
        }
        setFooterStatus("Campaign color updated.");
      } catch (e) {
        setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
      } finally {
        setFooterReady();
        colorInputEl.remove();
      }
    },
    { once: true },
  );
  colorInputEl.click();
}

const normalizeSupabaseUrl = PopupConfigController.normalizeSupabaseUrl;
const getEffectiveSupabaseUrl = PopupConfigController.getEffectiveSupabaseUrl;
const saveSupabaseUrlOverride =
  PopupConfigController.saveSupabaseUrlOverride;
const mergeNavPacingConfig = PopupConfigController.mergeNavPacingConfig;
const loadNavPacingConfigForUi =
  PopupConfigController.loadNavPacingConfigForUi;
const saveNavPacingEnabled = PopupConfigController.saveNavPacingEnabled;

function truncateCampaignLabel(value, maxLen = OVERVIEW_CAMPAIGN_LABEL_MAX) {
  const full = String(value || "");
  if (full.length <= maxLen) return full;
  return `${full.slice(0, maxLen - 1).trim()}\u2026`;
}

function buildCampaignOptionElement(campaignRow) {
  const campaignId = String(campaignRow?.campaign_id || "").trim();
  const campaignName = normalizeCampaignValue(campaignRow?.campaign_name || "");
  if (!campaignId || !campaignName) return null;
  const optionEl = document.createElement("option");
  optionEl.value = campaignId;
  optionEl.textContent = truncateCampaignLabel(campaignName);
  optionEl.title = campaignName;
  optionEl.dataset.campaignId = campaignId;
  optionEl.dataset.campaignName = campaignName;
  return optionEl;
}

function hasCampaignOption(campaignId) {
  if (!campaignSelectEl) return false;
  const normalizedId = String(campaignId || "").trim();
  if (!normalizedId) return false;
  return Array.from(campaignSelectEl.options || []).some(
    (option) => String(option.value || "").trim() === normalizedId,
  );
}

function appendCampaignOption(campaignRow) {
  if (!campaignSelectEl) return;
  const campaignId = String(campaignRow?.campaign_id || "").trim();
  if (!campaignId || hasCampaignOption(campaignId)) return;
  const optionEl = buildCampaignOptionElement(campaignRow);
  if (!optionEl) return;
  campaignSelectEl.appendChild(optionEl);
}

function setCampaignSelectValue(campaignId) {
  if (!campaignSelectEl) return;
  const normalizedId = String(campaignId || "").trim();
  let nextValue = "";
  if (normalizedId) {
    const row = knownCampaignRows.find(
      (item) => String(item?.campaign_id || "").trim() === normalizedId,
    );
    if (row) {
      appendCampaignOption(row);
      nextValue = normalizedId;
    }
  }
  campaignSelectEl.value = nextValue;
  updateDetailCampaignSelectTitle();
  updateRenameCampaignButtonState();
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

function setRenameCampaignRowVisible(visible) {
  if (!renameCampaignRowEl) return;
  renameCampaignRowEl.hidden = !visible;
  if (renameCampaignBtnEl) {
    renameCampaignBtnEl.hidden = Boolean(visible);
  }
  if (!visible && renameCampaignNameEl) {
    renameCampaignNameEl.value = "";
  }
}

function updateRenameCampaignButtonState() {
  if (!renameCampaignBtnEl || !campaignSelectEl) return;
  const hasSelection = Boolean(String(campaignSelectEl.value || "").trim());
  renameCampaignBtnEl.hidden = !hasSelection;
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
  const stored = normalizeCampaignValue(
    data?.[STORAGE_KEY_LAST_ACTIVE_CAMPAIGN] || "",
  );
  if (!stored) return "";
  const byId = knownCampaignRows.find(
    (row) => String(row?.campaign_id || "").trim() === stored,
  );
  if (byId) return String(byId.campaign_id || "").trim();
  const byName = knownCampaignRows.find(
    (row) =>
      normalizeCampaignValue(row?.campaign_name || "").toLowerCase() ===
      stored.toLowerCase(),
  );
  return byName ? String(byName.campaign_id || "").trim() : "";
}

function rebuildCampaignSelectOptions(campaignRows) {
  if (!campaignSelectEl) return;
  while (campaignSelectEl.firstChild) {
    campaignSelectEl.removeChild(campaignSelectEl.firstChild);
  }
  const emptyOptionEl = document.createElement("option");
  emptyOptionEl.value = "";
  emptyOptionEl.textContent = "Select campaign";
  campaignSelectEl.appendChild(emptyOptionEl);
  for (const campaignRow of campaignRows || []) {
    appendCampaignOption(campaignRow);
  }
  setRenameCampaignRowVisible(false);
  updateRenameCampaignButtonState();
}

function rebuildCompanyCampaignSelectOptions() {
  if (!companyCampaignSelectEl) return;
  const selectedBefore = String(companyCampaignSelectEl.value || "").trim();
  while (companyCampaignSelectEl.firstChild) {
    companyCampaignSelectEl.removeChild(companyCampaignSelectEl.firstChild);
  }
  const emptyOptionEl = document.createElement("option");
  emptyOptionEl.value = "";
  emptyOptionEl.textContent = "Select campaign";
  companyCampaignSelectEl.appendChild(emptyOptionEl);
  for (const campaignRow of knownCampaignRows) {
    const optionEl = buildCampaignOptionElement(campaignRow);
    if (!optionEl) continue;
    companyCampaignSelectEl.appendChild(optionEl);
  }
  const hasSelected = Array.from(companyCampaignSelectEl.options || []).some(
    (opt) => String(opt.value || "").trim() === selectedBefore,
  );
  companyCampaignSelectEl.value = hasSelected ? selectedBefore : "";
  updateCompanyRenameCampaignButtonState();
}

function renderCompanyLinkedCampaignChips() {
  if (!companyLinkedCampaignsListEl) return;
  companyLinkedCampaignsListEl.innerHTML = "";
  for (const row of companyLinkedCampaignRows) {
    const campaignId = safeTrim(row?.campaign_id);
    const campaignName = safeTrim(row?.campaign_name);
    const campaignColor = safeTrim(row?.color);
    if (!campaignId || !campaignName) continue;
    const chipEl = document.createElement("span");
    chipEl.className = "campaign-chip";
    if (/^#[0-9a-f]{6}$/i.test(campaignColor)) {
      chipEl.style.backgroundColor = campaignColor;
      chipEl.style.color = pickCampaignTextColor(campaignColor);
    }
    chipEl.title = "Click to set campaign color";
    const nameEl = document.createElement("span");
    nameEl.className = "campaign-chip-name";
    nameEl.textContent = campaignName;
    chipEl.appendChild(nameEl);
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "campaign-chip-remove";
    removeBtn.textContent = "\u00d7";
    removeBtn.title = "Remove link from all linked persons";
    removeBtn.setAttribute(
      "aria-label",
      `Remove ${campaignName} from all linked persons`,
    );
    removeBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const personIds = Array.from(
        new Set(
          companyPeopleRows
            .map((personRow) => safeTrim(personRow?.id))
            .filter((id) => Boolean(id)),
        ),
      );
      if (!personIds.length) return;
      setFooterUpdatingStatus();
      try {
        await Promise.all(
          personIds.map((personId) =>
            sendRuntimeMessage("DB_UNLINK_PERSON_CAMPAIGN", {
              payload: { person_id: personId, campaign_id: campaignId },
            }),
          ),
        );
        await refreshCompanyPeopleList();
        setFooterStatus("Campaign link removed from all linked persons.");
      } catch (e) {
        setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
      } finally {
        setFooterReady();
      }
    });
    chipEl.appendChild(removeBtn);
    chipEl.addEventListener("click", async () => {
      await openCampaignColorPicker({
        campaignId,
        campaignColor,
        onSaved: refreshCompanyPeopleList,
      });
    });
    companyLinkedCampaignsListEl.appendChild(chipEl);
  }
}

function setCompanyNewCampaignRowVisible(visible) {
  if (!companyNewCampaignRowEl) return;
  companyNewCampaignRowEl.hidden = !visible;
  if (companyToggleNewCampaignBtnEl) {
    companyToggleNewCampaignBtnEl.hidden = Boolean(visible);
  }
  if (!visible && companyNewCampaignNameEl) {
    companyNewCampaignNameEl.value = "";
  }
}

function setCompanyRenameCampaignRowVisible(visible) {
  if (!companyRenameCampaignRowEl) return;
  companyRenameCampaignRowEl.hidden = !visible;
  if (companyRenameCampaignBtnEl) {
    companyRenameCampaignBtnEl.hidden = Boolean(visible);
  }
  if (!visible && companyRenameCampaignNameEl) {
    companyRenameCampaignNameEl.value = "";
  }
}

function updateCompanyRenameCampaignButtonState() {
  if (!companyRenameCampaignBtnEl || !companyCampaignSelectEl) return;
  companyRenameCampaignBtnEl.hidden = !String(companyCampaignSelectEl.value || "").trim();
}

function rebuildOverviewCampaignFilterOptions(campaignRows) {
  if (!filterCampaignEl) return;
  const selectedBefore = String(filterCampaignEl.value || "").trim();
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

  const uniqueRows = Array.from(
    new Map(
      (campaignRows || [])
        .map((row) => ({
          campaign_id: String(row?.campaign_id || "").trim(),
          campaign_name: normalizeCampaignValue(row?.campaign_name || ""),
        }))
        .filter((row) => row.campaign_id && row.campaign_name)
        .map((row) => [row.campaign_id, row]),
    ).values(),
  );
  uniqueRows.forEach((row) => {
    const optionEl = buildCampaignOptionElement(row);
    if (!optionEl) return;
    filterCampaignEl.appendChild(optionEl);
  });

  if (
    selectedBefore &&
    uniqueRows.some((row) => row.campaign_id === selectedBefore)
  ) {
    filterCampaignEl.value = selectedBefore;
  } else {
    filterCampaignEl.value = "";
    overviewFilters.campaign = "";
  }
  updateOverviewCampaignFilterTitle();
}

function rebuildCompanyCampaignFilterOptions(campaignRows) {
  if (!companyCampaignFilterEl) return;
  const selectedBefore = String(companyCampaignFilterEl.value || "").trim();
  while (companyCampaignFilterEl.firstChild) {
    companyCampaignFilterEl.removeChild(companyCampaignFilterEl.firstChild);
  }
  const allOptionEl = document.createElement("option");
  allOptionEl.value = "";
  allOptionEl.textContent = "All campaigns";
  companyCampaignFilterEl.appendChild(allOptionEl);

  const uniqueRows = Array.from(
    new Map(
      (campaignRows || [])
        .map((row) => ({
          campaign_id: String(row?.campaign_id || "").trim(),
          campaign_name: normalizeCampaignValue(row?.campaign_name || ""),
        }))
        .filter((row) => row.campaign_id && row.campaign_name)
        .map((row) => [row.campaign_id, row]),
    ).values(),
  );
  uniqueRows.forEach((row) => {
    const optionEl = buildCampaignOptionElement(row);
    if (!optionEl) return;
    companyCampaignFilterEl.appendChild(optionEl);
  });
  if (
    selectedBefore &&
    uniqueRows.some((row) => row.campaign_id === selectedBefore)
  ) {
    companyCampaignFilterEl.value = selectedBefore;
  } else {
    companyCampaignFilterEl.value = "";
    companyOverviewFilters.campaign = "";
  }
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
    page_size: String(companyOverviewPageSizeEl?.value || companyOverviewPageSize || 25),
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
      companyArchivedFilterEl.value = archivedOptionExists ? companyArchived : "";
    }
    if (companyCampaignFilterEl) {
      const selectedOption = Array.from(companyCampaignFilterEl.options || []).find(
        (option) => String(option?.dataset?.campaignName || "") === companyCampaign,
      );
      companyCampaignFilterEl.value = selectedOption ? selectedOption.value : "";
    }
    if (companySearchEl) {
      companySearchEl.value = companySearch;
    }
    if (companyOverviewPageSizeEl && Number.isFinite(companyPageSize)) {
      const pageSizeValue = String(companyPageSize);
      const hasPageSize = Array.from(companyOverviewPageSizeEl.options || []).some(
        (option) => option.value === pageSizeValue,
      );
      if (hasPageSize) {
        companyOverviewPageSizeEl.value = pageSizeValue;
      }
    }

    companyOverviewFilters.archived = companyArchivedFilterEl?.value || "";
    companyOverviewFilters.campaign = companyCampaignFilterEl?.selectedOptions?.[0]
      ? String(companyCampaignFilterEl.selectedOptions[0].dataset?.campaignName || "")
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

async function loadCampaignOptions({ keepSelected = true } = {}) {
  const selectedBefore =
    campaignSelectEl && keepSelected
      ? String(campaignSelectEl.value || "").trim()
      : "";
  const result = await sendRuntimeMessage("DB_LIST_CAMPAIGNS");
  const resp = result.data || {};
  const campaignRowsRaw =
    result.ok && Array.isArray(resp?.campaign_rows)
      ? resp.campaign_rows
      : [];
  knownCampaignRows = campaignRowsRaw
    .map((row) => ({
      campaign_id: String(row?.campaign_id || "").trim(),
      campaign_name: normalizeCampaignValue(row?.campaign_name || ""),
    }))
    .filter((row) => row.campaign_id && row.campaign_name);
  knownCampaignValues = knownCampaignRows.map((row) => row.campaign_name);
  if (campaignSelectEl) {
    rebuildCampaignSelectOptions(knownCampaignRows);
  }
  rebuildOverviewCampaignFilterOptions(knownCampaignRows);
  rebuildCompanyCampaignFilterOptions(knownCampaignRows);
  rebuildCompanyCampaignSelectOptions();
  if (campaignSelectEl) {
    setCampaignSelectValue(selectedBefore);
  }
}

async function applyCampaignSelectionFromProfile() {
  if (!campaignSelectEl) return;
  if (PopupState.dbInvitationRow) {
    setCampaignSelectValue("");
    return;
  }
  const lastActiveCampaignId = await loadLastActiveCampaign();
  if (!lastActiveCampaignId) {
    setCampaignSelectValue("");
    return;
  }
  setCampaignSelectValue(lastActiveCampaignId);
}

function renderLinkedCampaignChips() {
  if (!linkedCampaignsListEl) return;
  linkedCampaignsListEl.innerHTML = "";
  const pickTextColorForBg = (hexColor) => {
    const raw = String(hexColor || "").trim();
    const match = raw.match(/^#?([0-9a-f]{6})$/i);
    if (!match) return "#374151";
    const hex = match[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.55 ? "#ffffff" : "#111827";
  };
  const applyCampaignChipColor = (chipEl, campaignColor) => {
    if (!chipEl) return;
    if (/^#[0-9a-f]{6}$/i.test(campaignColor)) {
      chipEl.style.backgroundColor = campaignColor;
      chipEl.style.color = pickTextColorForBg(campaignColor);
    }
  };
  const bindCampaignChipColorPicker = (chipEl, campaignId, campaignColor) => {
    chipEl.addEventListener("click", async (event) => {
      if (event.target.classList?.contains("campaign-chip-remove")) return;
      const colorInputEl = document.createElement("input");
      colorInputEl.type = "color";
      colorInputEl.value = /^#[0-9a-f]{6}$/i.test(campaignColor)
        ? campaignColor
        : "#2563eb";
      colorInputEl.style.position = "fixed";
      colorInputEl.style.left = "-9999px";
      document.body.appendChild(colorInputEl);
      colorInputEl.addEventListener(
        "input",
        async () => {
          setFooterUpdatingStatus();
          try {
            const result = await sendRuntimeMessage("DB_UPDATE_CAMPAIGN", {
              payload: { campaign_id: campaignId, color: colorInputEl.value },
            });
            if (!result.ok) {
              throw new Error(getErrorMessage(result.error));
            }
            await refreshPersonCampaignLinks();
            await refreshCompanyPeopleList();
            setFooterStatus("Campaign color updated.");
          } catch (e) {
            setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
          } finally {
            setFooterReady();
            colorInputEl.remove();
          }
        },
        { once: true },
      );
      colorInputEl.click();
    });
  };
  for (const row of linkedPersonCampaignRows) {
    const campaignId = String(row?.campaign_id || "").trim();
    const campaignName = normalizeCampaignValue(row?.campaign_name || "");
    const campaignColor = normalizeCampaignValue(row?.color || "");
    if (!campaignId || !campaignName) continue;
    const chipEl = document.createElement("span");
    chipEl.className = "campaign-chip";
    applyCampaignChipColor(chipEl, campaignColor);
    chipEl.title = "Click to set campaign color";
    const nameEl = document.createElement("span");
    nameEl.className = "campaign-chip-name";
    nameEl.textContent = campaignName;
    chipEl.appendChild(nameEl);
    bindCampaignChipColorPicker(chipEl, campaignId, campaignColor);
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "campaign-chip-remove";
    removeBtn.textContent = "\u00d7";
    removeBtn.title = "Remove link";
    removeBtn.setAttribute("aria-label", `Remove ${campaignName}`);
    removeBtn.addEventListener("click", async () => {
      const personId = safeTrim(PopupState.dbInvitationRow?.id);
      if (!personId) return;
      setFooterUpdatingStatus();
      try {
        const result = await sendRuntimeMessage("DB_UNLINK_PERSON_CAMPAIGN", {
          payload: { person_id: personId, campaign_id: campaignId },
        });
        if (!result.ok) {
          throw new Error(getErrorMessage(result.error));
        }
        await refreshPersonCampaignLinks();
        setFooterStatus("Campaign link removed.");
      } catch (e) {
        setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
      } finally {
        setFooterReady();
      }
    });
    chipEl.appendChild(removeBtn);
    linkedCampaignsListEl.appendChild(chipEl);
  }
}

async function refreshPersonCampaignLinks() {
  linkedPersonCampaignRows = [];
  if (!PopupState.dbInvitationRow?.id) {
    renderLinkedCampaignChips();
    return;
  }
  const result = await sendRuntimeMessage("DB_LIST_PERSON_CAMPAIGNS", {
    payload: { person_id: PopupState.dbInvitationRow.id },
  });
  const resp = result.data || {};
  if (!result.ok || !Array.isArray(resp?.rows)) {
    renderLinkedCampaignChips();
    return;
  }
  linkedPersonCampaignRows = resp.rows;
  renderLinkedCampaignChips();
}

async function linkCampaignToCurrentPerson(campaignId) {
  const normalizedCampaignId = String(campaignId || "").trim();
  if (!normalizedCampaignId) return;
  if (!PopupState.dbInvitationRow?.id) {
    setFooterStatus("Person must exist/generated first.");
    return;
  }
  const result = await sendRuntimeMessage("DB_LINK_PERSON_CAMPAIGN", {
    payload: {
      person_id: PopupState.dbInvitationRow.id,
      campaign_id: normalizedCampaignId,
    },
  });
  if (!result.ok) {
    throw new Error(getErrorMessage(result.error));
  }
  await refreshPersonCampaignLinks();
}

async function handleCampaignSelection(campaignId) {
  const normalizedCampaignId = String(campaignId || "").trim();
  await saveLastActiveCampaign(normalizedCampaignId);
  if (!normalizedCampaignId) return;
  await linkCampaignToCurrentPerson(normalizedCampaignId);
  setFooterStatus("Campaign linked.");
}

async function renameSelectedCampaign(campaignName) {
  const campaignId = String(campaignSelectEl?.value || "").trim();
  const nextName = normalizeCampaignValue(campaignName);
  if (!campaignId) throw new Error("Select a campaign first.");
  if (!nextName) throw new Error("Campaign name is required.");
  const result = await sendRuntimeMessage("DB_UPDATE_CAMPAIGN", {
    payload: {
      campaign_id: campaignId,
      campaign_name: nextName,
    },
  });
  if (!result.ok) {
    throw new Error(getErrorMessage(result.error));
  }
  await loadCampaignOptions({ keepSelected: true });
  setCampaignSelectValue(campaignId);
  await saveLastActiveCampaign(campaignId);
}

const isPostSendMode = PopupLifecycleController.isPostSendMode;

function coalesceDbThenScraped(dbValue, scrapedValue) {
  return dbValue && String(dbValue).trim() !== ""
    ? String(dbValue)
    : scrapedValue || "";
}

function autoResizeCommentsField() {
  if (!detailCommentsEl) return;
  detailCommentsEl.style.height = "auto";
  detailCommentsEl.style.height = `${detailCommentsEl.scrollHeight}px`;
}

function renderProfileEditControls() {
  const isCompany = isCompanyProfileMode();
  const detailNameUrl = getDetailNameLinkedinUrl();
  const isDetailNameLinkable =
    !isProfileEditMode && isLinkedInProfileLikeUrl(detailNameUrl);
  if (enrichProfileBtnEl) {
    enrichProfileBtnEl.hidden = isProfileEditMode;
    enrichProfileBtnEl.disabled = isProfileEditMode;
  }
  if (editProfileBtnEl) {
    editProfileBtnEl.hidden = isProfileEditMode;
    editProfileBtnEl.textContent = isCompany && !dbCompanyRow ? "Create" : "\u270E";
    editProfileBtnEl.title =
      isCompany && !dbCompanyRow ? "Create company" : "Edit";
    editProfileBtnEl.setAttribute(
      "aria-label",
      isCompany && !dbCompanyRow ? "Create company" : "Edit",
    );
  }
  if (saveProfileFieldsBtnEl) {
    saveProfileFieldsBtnEl.hidden = !isProfileEditMode;
    saveProfileFieldsBtnEl.disabled = isProfileSaveInFlight;
  }
  if (cancelProfileEditBtnEl) {
    cancelProfileEditBtnEl.hidden = !isProfileEditMode;
    cancelProfileEditBtnEl.disabled = isProfileSaveInFlight;
  }
  for (const fieldEl of [
    detailPersonNameEl,
    detailCompanyEl,
    detailEmployeeNumberEl,
    detailHeadlineEl,
    detailCommentsEl,
    detailCityEl,
    detailItMembersEl,
  ]) {
    if (!fieldEl) continue;
    fieldEl.readOnly = !isProfileEditMode;
  }
  if (detailPersonNameEl) {
    detailPersonNameEl.classList.toggle("is-linkable", isDetailNameLinkable);
    if (isDetailNameLinkable) {
      detailPersonNameEl.title = isCompany
        ? "Open company page"
        : "Open person profile";
    } else {
      detailPersonNameEl.removeAttribute("title");
    }
  }
  if (companyLinkSearchInputEl) {
    companyLinkSearchInputEl.hidden = !isProfileEditMode;
  }
  if (companyLinkedNameEl) {
    companyLinkedNameEl.hidden = isProfileEditMode;
  }
  if (companyLinkedEmployeeNumberEl) {
    companyLinkedEmployeeNumberEl.hidden =
      isCompany ||
      !safeTrim(PopupState.dbInvitationRow?.company_id) ||
      !safeTrim(companyLinkedEmployeeNumberEl.textContent);
  }
  if (acceptCompanySuggestionBtnEl && isProfileEditMode) {
    acceptCompanySuggestionBtnEl.hidden = true;
  }
  if (companyQuickLinkBtn && isProfileEditMode) {
    companyQuickLinkBtn.hidden = true;
  }
  if (companyLinkedIndicatorEl) {
    const showLinkedIndicator =
      !isCompany && isProfileEditMode && Boolean(safeTrim(PopupState.dbInvitationRow?.company_id));
    companyLinkedIndicatorEl.hidden = !showLinkedIndicator;
    companyLinkedIndicatorEl.style.display = showLinkedIndicator
      ? "inline-flex"
      : "none";
  }
  if (isCompany) {
    if (companyLinkedRowEl) companyLinkedRowEl.hidden = true;
    if (companySuggestionWarningEl) companySuggestionWarningEl.hidden = true;
    if (companyLinkedNameEl) companyLinkedNameEl.hidden = true;
    if (companyLinkedEmployeeNumberEl) companyLinkedEmployeeNumberEl.hidden = true;
    if (companyLinkSearchInputEl) companyLinkSearchInputEl.hidden = true;
    if (companyLinkedIndicatorEl) {
      companyLinkedIndicatorEl.hidden = true;
      companyLinkedIndicatorEl.style.display = "none";
    }
    if (companyLinkSearchOptionsEl) companyLinkSearchOptionsEl.innerHTML = "";
    if (acceptCompanySuggestionBtnEl) acceptCompanySuggestionBtnEl.hidden = true;
    if (companyQuickLinkBtn) companyQuickLinkBtn.hidden = true;
  }
  applyProfileModeUi();
}

function applyProfileModeUi() {
  const isCompany = isCompanyProfileMode();
  const shouldShowExistingCompanyDropdown = isCompany && !dbCompanyRow;
  const shouldShowProfileNotRegistered =
    !isProfileEditMode &&
    ((!isCompany && !PopupState.dbInvitationRow) || (isCompany && !dbCompanyRow));
  document.documentElement.classList.toggle("company-profile-mode", isCompany);
  document.body?.classList.toggle("company-profile-mode", isCompany);
  tabMain?.classList.toggle("company-profile-mode", isCompany);
  if (detailCompanyLabelEl) {
    detailCompanyLabelEl.textContent = "Company:";
    detailCompanyLabelEl.hidden =
      isCompany ||
      shouldShowProfileNotRegistered ||
      (!isProfileEditMode && !isCompany);
  }
  if (detailCompanyEl) {
    detailCompanyEl.hidden =
      isCompany ||
      shouldShowProfileNotRegistered ||
      (!isProfileEditMode && Boolean(safeTrim(PopupState.dbInvitationRow?.company_id)));
  }
  if (detailEmployeeNumberLabelEl) {
    detailEmployeeNumberLabelEl.hidden = !isCompany;
  }
  if (detailEmployeeNumberEl) {
    detailEmployeeNumberEl.hidden = !isCompany;
  }
  if (detailHeadlineLabelEl) {
    detailHeadlineLabelEl.textContent = isCompany ? "Sector:" : "Job title:";
    detailHeadlineLabelEl.hidden =
      shouldShowProfileNotRegistered || (!isCompany && !isProfileEditMode);
  }
  if (detailCommentsLabelEl) {
    detailCommentsLabelEl.textContent = "Comments:";
    detailCommentsLabelEl.hidden = isCompany || shouldShowProfileNotRegistered;
  }
  if (detailCommentsEl) {
    detailCommentsEl.hidden = isCompany || shouldShowProfileNotRegistered;
  }
  if (detailCityLabelEl) {
    detailCityLabelEl.hidden = !isCompany;
  }
  if (detailCityEl) {
    detailCityEl.hidden = !isCompany;
  }
  if (detailItMembersLabelEl) {
    detailItMembersLabelEl.hidden = !isCompany;
  }
  if (detailItMembersEl) {
    detailItMembersEl.hidden = !isCompany;
  }
  if (detailPersonNameEl) detailPersonNameEl.placeholder = isCompany ? "Company name" : "";
  if (detailCompanyEl) detailCompanyEl.placeholder = "";
  if (detailEmployeeNumberEl) {
    detailEmployeeNumberEl.placeholder = isCompany ? "Employee number" : "";
  }
  if (detailHeadlineEl) detailHeadlineEl.placeholder = isCompany ? "Sector" : "";
  if (detailCommentsEl) detailCommentsEl.placeholder = "";
  if (detailCityEl) detailCityEl.placeholder = isCompany ? "City" : "";
  if (detailItMembersEl) detailItMembersEl.placeholder = isCompany ? "IT members" : "";
  if (companyPeopleSectionEl) {
    companyPeopleSectionEl.hidden = !isCompany;
  }
  if (personNotRegisteredStateEl) {
    personNotRegisteredStateEl.hidden = !shouldShowProfileNotRegistered;
    personNotRegisteredStateEl.textContent = isCompany
      ? "Company is not yet registered"
      : "Person is not yet registered";
  }
  if (!isCompany) {
    setCompanyUrlMismatchBannerVisible(false);
  }
  if (companyExistingLinkSectionEl) {
    companyExistingLinkSectionEl.hidden = !shouldShowExistingCompanyDropdown;
    companyExistingLinkSectionEl.style.display =
      shouldShowExistingCompanyDropdown ? "" : "none";
  }
  updateExistingCompanyLinkUi();

  const hideInvitationUi = isCompany;
  for (const el of [
    campaignGroupEl,
    campaignDividerEl,
    statusStepperEl,
    stepperUnderlayEl,
    statusDividerEl,
    detailTabsDividerEl,
    detailTabsRowEl,
    detailInviteSectionEl,
    detailMessageMountEl,
    tabMessage,
    tabFreePromptEl,
    acceptedModeEl,
    firstMessageSentModeEl,
  ]) {
    if (!el) continue;
    el.hidden = hideInvitationUi;
    el.style.display = hideInvitationUi ? "none" : "";
  }
  if (companyLinkedRowEl) {
    const hasQuickLinkSuggestion =
      !isCompany &&
      !isProfileEditMode &&
      Boolean(companySuggestion?.company_id);
    const shouldForceHideLinkedRow =
      isCompany || (shouldShowProfileNotRegistered && !hasQuickLinkSuggestion);
    PopupLogger.debug("[LEF][quick-link][row-visibility]", {
      isCompany,
      isProfileEditMode,
      shouldShowProfileNotRegistered,
      hasQuickLinkSuggestion,
      shouldForceHideLinkedRow,
      companySuggestionId: safeTrim(companySuggestion?.company_id),
    });
    if (shouldForceHideLinkedRow) {
      companyLinkedRowEl.hidden = true;
    }
  }
  if (companySuggestionWarningEl) companySuggestionWarningEl.hidden = true;
  if (acceptCompanySuggestionBtnEl) acceptCompanySuggestionBtnEl.hidden = true;
  if (companyQuickLinkBtn) companyQuickLinkBtn.hidden = true;
  if (isCompany) {
    if (companyLinkedNameEl) companyLinkedNameEl.hidden = true;
    if (companyLinkedEmployeeNumberEl) companyLinkedEmployeeNumberEl.hidden = true;
    if (companyLinkSearchInputEl) companyLinkSearchInputEl.hidden = true;
    if (companyLinkSearchOptionsEl) companyLinkSearchOptionsEl.innerHTML = "";
  }
}

function updateExistingCompanyLinkUi(statusText) {
  if (companyExistingLinkStatusEl) {
    companyExistingLinkStatusEl.textContent =
      statusText || "Company URL not registered";
    companyExistingLinkStatusEl.hidden =
      !isCompanyProfileMode() || Boolean(dbCompanyRow);
  }
  if (companyExistingLinkButtonEl) {
    companyExistingLinkButtonEl.disabled = !safeTrim(
      selectedExistingCompanyForLink?.company_id,
    );
  }
}

function isActiveCompanyOptionRow(row) {
  if (!row || typeof row !== "object") return false;
  const raw = row?.archived;
  if (raw == null || raw === "") return true;
  if (raw === true || raw === 1) return false;
  const normalized = String(raw).trim().toLowerCase();
  return normalized !== "1" && normalized !== "true";
}

function setCompanyExistingLinkOptions(rows) {
  companyExistingLinkResults = (Array.isArray(rows) ? rows : []).filter(
    isActiveCompanyOptionRow,
  );
  if (!companyExistingLinkOptionsEl) return;
  companyExistingLinkOptionsEl.innerHTML = "";
  for (const row of companyExistingLinkResults) {
    const name = safeTrim(row?.company_name);
    const id = safeTrim(row?.company_id);
    if (!name || !id) continue;
    const optionEl = document.createElement("option");
    optionEl.value = name;
    optionEl.dataset.companyId = id;
    companyExistingLinkOptionsEl.appendChild(optionEl);
  }
}

function setSelectedExistingCompanyForLink(companyRow) {
  const company_id = safeTrim(companyRow?.company_id);
  const company_name = safeTrim(companyRow?.company_name);
  selectedExistingCompanyForLink =
    company_id && company_name ? { ...companyRow, company_id, company_name } : null;
  if (companyExistingLinkInputEl) companyExistingLinkInputEl.value = company_name;
  updateExistingCompanyLinkUi();
}

function syncSelectedExistingCompanyFromInput() {
  const typed = safeTrim(companyExistingLinkInputEl?.value);
  if (!typed) {
    selectedExistingCompanyForLink = null;
    updateExistingCompanyLinkUi();
    return;
  }
  const matched = companyExistingLinkResults.find(
    (row) => safeTrim(row?.company_name).toLowerCase() === typed.toLowerCase(),
  );
  if (matched?.company_id) setSelectedExistingCompanyForLink(matched);
  else {
    selectedExistingCompanyForLink = null;
    updateExistingCompanyLinkUi();
  }
}

async function searchExistingCompaniesForCompanyPage(term) {
  const query = sanitizeCompanySearchTerm(term);
  timingLog("DB search triggered with term", { term: query });
  if (!query) {
    setCompanyExistingLinkOptions([]);
    selectedExistingCompanyForLink = null;
    updateExistingCompanyLinkUi();
    return;
  }
  const result = await sendRuntimeMessage("DB_SEARCH_UNLINKED_COMPANIES", {
    payload: { term: query, limit: 10 },
  });
  const resp = result.data || {};
  const rows = result.ok ? resp?.companies || [] : [];
  setCompanyExistingLinkOptions(rows);
  syncSelectedExistingCompanyFromInput();
  updateExistingCompanyLinkUi(
    rows.length
      ? "Company URL not registered"
      : "Company URL not registered. No matching unlinked company found.",
  );
  PopupLogger.debug("[LEF][company link search]", { term: query, count: rows.length });
}

async function prepareExistingCompanyLinkDropdown({ allowSearch = true } = {}) {
  selectedExistingCompanyForLink = null;
  setCompanyExistingLinkOptions([]);
  if (!isCompanyProfileMode() || dbCompanyRow) {
    if (companyExistingLinkSectionEl) {
      companyExistingLinkSectionEl.hidden = true;
      companyExistingLinkSectionEl.style.display = "none";
    }
    if (companyExistingLinkInputEl) companyExistingLinkInputEl.value = "";
    updateExistingCompanyLinkUi();
    return;
  }
  if (companyExistingLinkSectionEl) {
    companyExistingLinkSectionEl.hidden = false;
    companyExistingLinkSectionEl.style.display = "";
  }
  const scrapedName = sanitizeCompanySearchTerm(getCompanyNameForPeopleList());
  if (companyExistingLinkInputEl) companyExistingLinkInputEl.value = scrapedName;
  updateExistingCompanyLinkUi();
  if (allowSearch && !dbCompanyRow && scrapedName) {
    await searchExistingCompaniesForCompanyPage(scrapedName);
  }
}

function setProfileEditMode(nextMode) {
  isProfileEditMode = Boolean(nextMode);
  renderProfileEditControls();
  if (isProfileEditMode && !isCompanyProfileMode()) {
    prepareCompanyDropdownForEdit().catch(() => null);
    detailPersonNameEl?.focus();
    detailPersonNameEl?.select();
    return;
  }
  if (isProfileEditMode) {
    detailPersonNameEl?.focus();
    detailPersonNameEl?.select();
    return;
  }
  selectedCompanyForSave = null;
  renderDetailHeader({ force: true });
}

function renderDetailHeader({ force = false } = {}) {
  if (isCompanyProfileMode()) {
    const scraped = PopupState.currentProfileContext || {};
    const row = dbCompanyRow || {};
    const companyName = coalesceDbThenScraped(
      row.company_name,
      scraped.company_name || scraped.name || scraped.full_name || "",
    );
    const employeeNumber = coalesceDbThenScraped(
      row.employee_number,
      scraped.employee_number || "",
    );
    const sector = coalesceDbThenScraped(row.sector, scraped.sector || "");
    const city = coalesceDbThenScraped(row.city, scraped.city || "");
    const itMembers = coalesceDbThenScraped(
      row.it_members,
      scraped.it_members || "",
    );
    if (!(isProfileEditMode && !force)) {
      if (detailPersonNameEl) detailPersonNameEl.value = companyName.trim() || "-";
      if (detailEmployeeNumberEl) {
        detailEmployeeNumberEl.value = employeeNumber.trim() || "-";
      }
      if (detailHeadlineEl) detailHeadlineEl.value = sector.trim() || "-";
      if (detailItMembersEl) detailItMembersEl.value = itMembers.trim() || "-";
      if (detailCityEl) detailCityEl.value = city.trim() || "-";
    }
    if (PopupState.currentProfileContext) PopupState.currentProfileContext.it_members = itMembers.trim();
    applyProfileModeUi();
    renderProfileEditControls();
    return;
  }

  const scrapedName = (
    PopupState.currentProfileContext?.name ||
    PopupState.currentProfileContext?.full_name ||
    ""
  ).trim();
  const scrapedCompany = (PopupState.currentProfileContext?.company || "").trim();
  const scrapedHeadline = (PopupState.currentProfileContext?.headline || "").trim();
  const scrapedComments = (PopupState.currentProfileContext?.comments || "").trim();

  const dbName = (
    PopupState.dbInvitationRow?.full_name ||
    PopupState.dbInvitationRow?.name ||
    ""
  ).trim();
  const dbCompany = (PopupState.dbInvitationRow?.company || "").trim();
  const dbHeadline = (PopupState.dbInvitationRow?.headline || "").trim();
  const dbComments = (PopupState.dbInvitationRow?.comments || "").trim();

  const name = coalesceDbThenScraped(dbName, scrapedName).trim() || "-";
  const company =
    coalesceDbThenScraped(dbCompany, scrapedCompany).trim() || "-";
  const headline =
    coalesceDbThenScraped(dbHeadline, scrapedHeadline).trim() || "-";
  const comments =
    coalesceDbThenScraped(dbComments, scrapedComments).trim() || "-";

  debug("detail header source", {
    nameSource: dbName ? "db" : "scraped",
    companySource: dbCompany ? "db" : "scraped",
    headlineSource: dbHeadline ? "db" : "scraped",
  });

  if (isProfileEditMode && !force) return;

  if (detailPersonNameEl) detailPersonNameEl.value = name;
  if (detailCompanyEl) detailCompanyEl.value = company;
  if (detailEmployeeNumberEl) detailEmployeeNumberEl.value = "-";
  if (detailHeadlineEl) detailHeadlineEl.value = headline;
  if (detailCommentsEl) detailCommentsEl.value = comments;
  if (detailCityEl) detailCityEl.value = "-";
  if (detailItMembersEl) detailItMembersEl.value = "-";
  autoResizeCommentsField();
  applyProfileModeUi();
  renderProfileEditControls();
}

function getCompanyNameForPeopleList() {
  return safeTrim(
    dbCompanyRow?.company_name ||
      PopupState.currentProfileContext?.company_name ||
      PopupState.currentProfileContext?.name ||
      PopupState.currentProfileContext?.full_name ||
      "",
  );
}

function renderCompanyPeopleList() {
  if (!companyPeopleSectionEl || !companyPeopleListEl) return;
  const isCompany = isCompanyProfileMode();
  companyPeopleSectionEl.hidden = !isCompany;
  companyPeopleListEl.innerHTML = "";
  if (companyCampaignControlsEl) {
    const hasRegisteredCompany = Boolean(safeTrim(dbCompanyRow?.company_id));
    companyCampaignControlsEl.hidden =
      !(isCompany && hasRegisteredCompany && companyPeopleRows.length > 0);
  }
  renderCompanyLinkedCampaignChips();
  if (!isCompany) return;

  if (!companyPeopleRows.length) {
    const emptyEl = document.createElement("div");
    emptyEl.className = "company-people-empty";
    emptyEl.textContent = "No registered people found";
    companyPeopleListEl.appendChild(emptyEl);
    return;
  }

  for (const row of companyPeopleRows) {
    const linkedinUrl = safeTrim(row?.linkedin_url);
    const name = safeTrim(row?.full_name || row?.name) || "-";
    const headline = safeTrim(row?.headline) || "-";
    const isConnected = row?.accepted === true;
    const rowEl = document.createElement("div");
    rowEl.className = "company-person-card";
    rowEl.dataset.linkedinUrl = linkedinUrl;
    if (linkedinUrl) {
      rowEl.setAttribute("role", "button");
      rowEl.setAttribute("tabindex", "0");
      rowEl.title = "Open person profile";
    }

    const textEl = document.createElement("div");
    textEl.className = "company-person-text";
    const nameEl = document.createElement("div");
    nameEl.className = "company-person-name";
    const nameLabelEl = document.createElement("span");
    nameLabelEl.className = "company-person-name-label";
    nameLabelEl.textContent = name;
    const statusEl = document.createElement("span");
    statusEl.className = isConnected
      ? "company-person-connection is-connected"
      : "company-person-connection is-not-connected";
    statusEl.textContent = isConnected ? "Connected" : "Not connected";
    nameEl.appendChild(nameLabelEl);
    nameEl.appendChild(statusEl);
    const headlineEl = document.createElement("div");
    headlineEl.className = "company-person-function";
    headlineEl.textContent = headline;
    const personCampaignsEl = document.createElement("div");
    personCampaignsEl.className = "company-person-campaigns";
    const personCampaignRows = Array.isArray(row?.campaign_rows)
      ? row.campaign_rows
      : [];
    for (const campaignRow of personCampaignRows) {
      const campaignId = safeTrim(campaignRow?.campaign_id);
      const campaignName = safeTrim(campaignRow?.campaign_name);
      const campaignColor = safeTrim(campaignRow?.color);
      if (!campaignId || !campaignName) continue;
      const chipEl = document.createElement("span");
      chipEl.className = "campaign-chip";
      if (/^#[0-9a-f]{6}$/i.test(campaignColor)) {
        chipEl.style.backgroundColor = campaignColor;
        chipEl.style.color = pickCampaignTextColor(campaignColor);
      }
      chipEl.title = "Click to set campaign color";
      const nameChipEl = document.createElement("span");
      nameChipEl.className = "campaign-chip-name";
      nameChipEl.textContent = campaignName;
      chipEl.appendChild(nameChipEl);
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "campaign-chip-remove";
      removeBtn.textContent = "\u00d7";
      removeBtn.title = "Remove link";
      removeBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const personId = safeTrim(row?.id);
        if (!personId) return;
        setFooterUpdatingStatus();
        try {
          const result = await sendRuntimeMessage("DB_UNLINK_PERSON_CAMPAIGN", {
            payload: { person_id: personId, campaign_id: campaignId },
          });
          if (!result.ok) throw new Error(getErrorMessage(result.error));
          await refreshCompanyPeopleList();
          setFooterStatus("Campaign link removed.");
        } catch (e) {
          setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
        } finally {
          setFooterReady();
        }
      });
      chipEl.appendChild(removeBtn);
      chipEl.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.target === removeBtn) return;
        await openCampaignColorPicker({
          campaignId,
          campaignColor,
          onSaved: refreshCompanyPeopleList,
        });
      });
      personCampaignsEl.appendChild(chipEl);
    }

    textEl.appendChild(nameEl);
    textEl.appendChild(headlineEl);
    textEl.appendChild(personCampaignsEl);
    rowEl.appendChild(textEl);
    companyPeopleListEl.appendChild(rowEl);
  }
}

async function refreshCompanyPeopleList() {
  companyPeopleRows = [];
  companyLinkedCampaignRows = [];
  renderCompanyPeopleList();
  if (!isCompanyProfileMode()) return;
  const company_id = safeTrim(dbCompanyRow?.company_id);
  if (!company_id) return;
  const result = await sendRuntimeMessage("DB_LIST_INVITATIONS_BY_COMPANY", {
    payload: { company_id },
  });
  const resp = result.data || {};
  const baseRows = result.ok && Array.isArray(resp?.rows) ? resp.rows : [];
  const enrichedRows = await Promise.all(
    baseRows.map(async (row) => {
      const personId = safeTrim(row?.id);
      if (!personId) return { ...row, campaign_rows: [] };
      const campaignsResult = await sendRuntimeMessage("DB_LIST_PERSON_CAMPAIGNS", {
        payload: { person_id: personId },
      });
      const campaignsResp = campaignsResult.data || {};
      return {
        ...row,
        campaign_rows:
          campaignsResult.ok && Array.isArray(campaignsResp?.rows)
            ? campaignsResp.rows
            : [],
      };
    }),
  );
  companyPeopleRows = enrichedRows;
  companyLinkedCampaignRows = Array.from(
    new Map(
      enrichedRows
        .flatMap((row) => (Array.isArray(row?.campaign_rows) ? row.campaign_rows : []))
        .map((row) => [safeTrim(row?.campaign_id), row])
        .filter(([id]) => Boolean(id)),
    ).values(),
  );
  renderCompanyPeopleList();
  rebuildCompanyCampaignSelectOptions();
}

function buildCompanyProfileSavePayload() {
  const payload = {
    linkedin_id: normalizeCompanyLinkedinId(PopupState.currentProfileContext),
    company_name: normalizeWhitespace(
      (detailPersonNameEl?.value || "").trim() === "-"
        ? ""
        : detailPersonNameEl?.value || "",
    ),
    employee_number: normalizeWhitespace(
      (detailEmployeeNumberEl?.value || "").trim() === "-"
        ? ""
        : detailEmployeeNumberEl?.value || "",
    ),
    sector: normalizeWhitespace(
      (detailHeadlineEl?.value || "").trim() === "-"
        ? ""
        : detailHeadlineEl?.value || "",
    ),
    city: normalizeWhitespace(
      (detailCityEl?.value || "").trim() === "-"
        ? ""
        : detailCityEl?.value || "",
    ),
    it_members: normalizeWhitespace(
      (detailItMembersEl?.value || "").trim() === "-"
        ? ""
        : detailItMembersEl?.value || "",
    ),
  };
  return payload;
}

async function linkSelectedExistingCompany() {
  syncSelectedExistingCompanyFromInput();
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

function hideCompanySuggestionUi() {
  companySuggestion = null;
  selectedCompanyForSave = null;
  companyLinkSearchResults = [];
  if (companyLinkedRowEl) companyLinkedRowEl.hidden = true;
  if (companySuggestionWarningEl) companySuggestionWarningEl.hidden = true;
  if (companyLinkedNameEl) {
    companyLinkedNameEl.hidden = false;
    companyLinkedNameEl.textContent = "-";
    companyLinkedNameEl.classList.remove("is-linked", "is-unlinked");
  }
  if (companyLinkedEmployeeNumberEl) {
    companyLinkedEmployeeNumberEl.hidden = true;
    companyLinkedEmployeeNumberEl.textContent = "";
  }
  if (companyLinkedIndicatorEl) {
    companyLinkedIndicatorEl.hidden = true;
    companyLinkedIndicatorEl.style.display = "none";
  }
  if (companyLinkSearchInputEl) {
    companyLinkSearchInputEl.hidden = true;
    companyLinkSearchInputEl.value = "";
  }
  if (companyLinkSearchOptionsEl) companyLinkSearchOptionsEl.innerHTML = "";
  if (acceptCompanySuggestionBtnEl) {
    acceptCompanySuggestionBtnEl.disabled = false;
    acceptCompanySuggestionBtnEl.hidden = true;
  }
}

function renderLinkedCompanyName(companyName, companyUrl = "", employeeNumber = "") {
  if (companyLinkedNameEl) {
    companyLinkedNameEl.hidden = isProfileEditMode;
    companyLinkedNameEl.textContent = safeTrim(companyName) || "-";
    companyLinkedNameEl.classList.add("is-linked");
    companyLinkedNameEl.classList.remove("is-unlinked");
    const normalizedCompanyUrl = safeTrim(companyUrl);
    if (normalizedCompanyUrl) {
      companyLinkedNameEl.dataset.companyUrl = normalizedCompanyUrl;
      companyLinkedNameEl.classList.add("has-company-url");
      companyLinkedNameEl.setAttribute("role", "button");
      companyLinkedNameEl.setAttribute("tabindex", "0");
      companyLinkedNameEl.title = "Open company profile";
    } else {
      delete companyLinkedNameEl.dataset.companyUrl;
      companyLinkedNameEl.classList.remove("has-company-url");
      companyLinkedNameEl.removeAttribute("role");
      companyLinkedNameEl.removeAttribute("tabindex");
      companyLinkedNameEl.removeAttribute("title");
    }
  }
  if (companyLinkedEmployeeNumberEl) {
    const employeeText = safeTrim(employeeNumber);
    companyLinkedEmployeeNumberEl.textContent = employeeText
      ? `(${employeeText})`
      : "";
    companyLinkedEmployeeNumberEl.hidden = !employeeText;
  }
  if (companyLinkedRowEl) companyLinkedRowEl.hidden = false;
  if (companySuggestionWarningEl) companySuggestionWarningEl.hidden = true;
  if (acceptCompanySuggestionBtnEl) acceptCompanySuggestionBtnEl.hidden = true;
}

function renderCompanySuggestionFound(companyRow) {
  companySuggestion = companyRow || null;
  if (companyLinkedNameEl) {
    companyLinkedNameEl.hidden = isProfileEditMode;
    companyLinkedNameEl.textContent = safeTrim(companyRow?.company_name) || "-";
    companyLinkedNameEl.classList.add("is-unlinked");
    companyLinkedNameEl.classList.remove("is-linked");
  }
  if (companyLinkedEmployeeNumberEl) {
    companyLinkedEmployeeNumberEl.hidden = true;
    companyLinkedEmployeeNumberEl.textContent = "";
  }
  if (companyLinkedRowEl) companyLinkedRowEl.hidden = false;
  if (companySuggestionWarningEl) companySuggestionWarningEl.hidden = true;
  if (acceptCompanySuggestionBtnEl) {
    acceptCompanySuggestionBtnEl.hidden = true;
  }
  if (companyQuickLinkBtn) {
    companyQuickLinkBtn.hidden = isProfileEditMode;
  }
}

function renderCompanySuggestionNotFound() {
  companySuggestion = null;
  if (companyLinkedRowEl) companyLinkedRowEl.hidden = true;
  if (companySuggestionWarningEl) companySuggestionWarningEl.hidden = false;
  if (acceptCompanySuggestionBtnEl) acceptCompanySuggestionBtnEl.hidden = true;
  if (companyQuickLinkBtn) companyQuickLinkBtn.hidden = true;
}

async function refreshCompanySuggestionUiForCurrentInvitation() {
  hideCompanySuggestionUi();
  const savedCompany = safeTrim(
    PopupState.dbInvitationRow?.company ||
      PopupState.currentProfileContext?.company ||
      detailCompanyEl?.value ||
      companyLinkedNameEl?.textContent,
  );
  const savedCompanyId = safeTrim(PopupState.dbInvitationRow?.company_id);
  PopupLogger.debug("[LEF][quick-link][refresh-start]", {
    savedCompany,
    savedCompanyId,
    dbCompany: safeTrim(PopupState.dbInvitationRow?.company),
    ctxCompany: safeTrim(PopupState.currentProfileContext?.company),
    detailCompany: safeTrim(detailCompanyEl?.value),
    linkedNameText: safeTrim(companyLinkedNameEl?.textContent),
  });
  if (!savedCompany || savedCompany === "-") return;

  if (savedCompanyId) {
    PopupLogger.debug("[LEF][quick-link][skip-existing-link]", { savedCompanyId });
    const result = await sendRuntimeMessage("DB_GET_COMPANY_BY_ID", {
      payload: { company_id: savedCompanyId },
    });
    const companyRow = result.ok ? result.data?.company || null : null;
    renderLinkedCompanyName(
      safeTrim(companyRow?.company_name) || savedCompany,
      safeTrim(companyRow?.linkedin_id),
      safeTrim(companyRow?.employee_number),
    );
    return;
  }
  if (detailCompanyEl) detailCompanyEl.hidden = false;

  const result = await sendRuntimeMessage("DB_FIND_COMPANY_BY_NAME", {
    payload: { company_name: savedCompany },
  });
  const companyRow = result.ok ? result.data?.company || null : null;
  PopupLogger.debug("[LEF][quick-link][find-by-name-result]", {
    query: savedCompany,
    ok: result.ok,
    matchedCompanyId: safeTrim(companyRow?.company_id),
    matchedCompanyName: safeTrim(companyRow?.company_name),
    error: result.ok ? "" : getErrorMessage(result.error),
  });
  if (companyRow?.company_id && safeTrim(companyRow?.company_name)) {
    PopupLogger.debug("[LEF][company suggestion] exact match found", {
      company_id: companyRow.company_id,
      company_name: companyRow.company_name,
    });
    renderCompanySuggestionFound({
      company_id: companyRow.company_id,
      company_name: companyRow.company_name,
      linkedin_id: companyRow.linkedin_id || "",
      employee_number: companyRow.employee_number || "",
    });
    return;
  }
  PopupLogger.debug("[LEF][company suggestion] no exact match found", {
    company_name: savedCompany,
  });
  renderCompanySuggestionNotFound();
}

function setCompanyLinkSearchOptions(rows) {
  companyLinkSearchResults = (Array.isArray(rows) ? rows : []).filter(
    isActiveCompanyOptionRow,
  );
  if (!companyLinkSearchOptionsEl) return;
  companyLinkSearchOptionsEl.innerHTML = "";
  for (const row of companyLinkSearchResults) {
    const name = safeTrim(row?.company_name);
    const id = safeTrim(row?.company_id);
    if (!name || !id) continue;
    const optionEl = document.createElement("option");
    optionEl.value = name;
    optionEl.dataset.companyId = id;
    companyLinkSearchOptionsEl.appendChild(optionEl);
  }
}

function setCompanyDropdownSelected(companyRow) {
  const id = safeTrim(companyRow?.company_id);
  const name = safeTrim(companyRow?.company_name);
  selectedCompanyForSave = id && name ? { company_id: id, company_name: name } : null;
  if (companyLinkSearchInputEl) companyLinkSearchInputEl.value = name;
  PopupLogger.debug("[LEF][company dropdown] company selected", {
    company_id: id,
    company_name: name,
  });
}

async function searchCompaniesForEditDropdown(term) {
  const query = safeTrim(term);
  if (!query) {
    setCompanyLinkSearchOptions([]);
    return;
  }
  const result = await sendRuntimeMessage("DB_SEARCH_COMPANIES", {
    payload: { term: query, limit: 10 },
  });
  const resp = result.data || {};
  const rows = result.ok ? resp?.companies || [] : [];
  setCompanyLinkSearchOptions(rows);
  PopupLogger.debug("[LEF][company dropdown] company search results", {
    term: query,
    count: rows.length,
  });
}

async function prepareCompanyDropdownForEdit() {
  if (!PopupState.dbInvitationRow || !companyLinkedRowEl || !companyLinkSearchInputEl) return;
  const savedCompany = safeTrim(PopupState.dbInvitationRow?.company);
  const savedCompanyId = safeTrim(PopupState.dbInvitationRow?.company_id);
  selectedCompanyForSave = null;
  setCompanyLinkSearchOptions([]);
  companyLinkedRowEl.hidden = false;
  companyLinkSearchInputEl.hidden = false;
  companyLinkSearchInputEl.value = "";
  if (companyLinkedNameEl) companyLinkedNameEl.hidden = true;
  if (acceptCompanySuggestionBtnEl) acceptCompanySuggestionBtnEl.hidden = true;
  if (companySuggestionWarningEl) companySuggestionWarningEl.hidden = true;

  PopupLogger.debug("[LEF][company dropdown] initial load", {
    company_id: savedCompanyId,
    company_name: savedCompany,
  });

  if (savedCompanyId) {
    const result = await sendRuntimeMessage("DB_GET_COMPANY_BY_ID", {
      payload: { company_id: savedCompanyId },
    });
    const companyRow = result.ok ? result.data?.company || null : null;
    if (
      isActiveCompanyOptionRow(companyRow) &&
      companyRow?.company_id &&
      safeTrim(companyRow?.company_name)
    ) {
      setCompanyDropdownSelected(companyRow);
      setCompanyLinkSearchOptions([companyRow]);
    }
    return;
  }

  if (!savedCompany) return;
  const result = await sendRuntimeMessage("DB_FIND_COMPANY_BY_NAME", {
    payload: { company_name: savedCompany },
  });
  const companyRow = result.ok ? result.data?.company || null : null;
  PopupLogger.debug("[LEF][quick-link][find-by-name-result]", {
    query: savedCompany,
    ok: result.ok,
    matchedCompanyId: safeTrim(companyRow?.company_id),
    matchedCompanyName: safeTrim(companyRow?.company_name),
    error: result.ok ? "" : getErrorMessage(result.error),
  });
  if (companyRow?.company_id && safeTrim(companyRow?.company_name)) {
    PopupLogger.debug("[LEF][company dropdown] exact match found", {
      company_id: companyRow.company_id,
      company_name: companyRow.company_name,
    });
    setCompanyDropdownSelected(companyRow);
    setCompanyLinkSearchOptions([companyRow]);
    return;
  }
  PopupLogger.debug("[LEF][company dropdown] no exact match found", {
    company_name: savedCompany,
  });
}

function syncSelectedCompanyFromDropdownInput() {
  const typed = safeTrim(companyLinkSearchInputEl?.value);
  if (!typed) {
    selectedCompanyForSave = null;
    return;
  }
  const matched = companyLinkSearchResults.find(
    (row) => safeTrim(row?.company_name).toLowerCase() === typed.toLowerCase(),
  );
  if (matched?.company_id) {
    setCompanyDropdownSelected(matched);
  }
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
      (isMessageSentOrBeyondStatus(getLifecycleStatusValue(PopupState.dbInvitationRow)) &&
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
    companyPeopleRows = [];
    selectedExistingCompanyForLink = null;
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
  const selectedCampaignName =
    String(selectedCampaignOption?.dataset?.campaignName || "").trim();
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

function isOverviewRowNoCampaign(row) {
  const campaignValue = row?.campaigns;
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
  personGridState.total = overviewTotal;
}

function setActiveListTab(which) {
  const next = which === "companies" ? "companies" : "persons";
  activeListTab = next;
  if (listPersonsTabBtnEl) {
    listPersonsTabBtnEl.classList.toggle("active", next === "persons");
  }
  if (listCompaniesTabBtnEl) {
    listCompaniesTabBtnEl.classList.toggle("active", next === "companies");
  }
  if (personsListPanelEl) {
    personsListPanelEl.hidden = next !== "persons";
  }
  if (companiesListPanelEl) {
    companiesListPanelEl.hidden = next !== "companies";
  }
  if (next === "persons") {
    fetchOverviewPage();
  } else {
    fetchCompaniesOverviewPage();
  }
}

function renderOverviewTable(rows) {
  const safeRows = applyOverviewClientFilters(rows);
  if (!LEF_GRID) return;
  LEF_GRID.renderGridRows({
    tbodyEl: overviewTbodyEl,
    rows: safeRows,
    emptyColSpan: 7,
    actions: [
      {
        createButton: (row) => {
          const openBtn = createOverviewIconButton({
            title: "Open",
            ariaLabel: "Open",
            pathD:
              "M10 2h4v4h-1.8V4.9L7.5 9.6 6.4 8.5 11.1 3.8H10V2ZM3 4h4v1.5H4.5v6h6V9H12v4H3V4Z",
          });
          openBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openLinkedIn(row?.url || "", { newTab: shouldOpenInNewTab(event) });
          });
          return openBtn;
        },
      },
      {
        createButton: (row) => {
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
          archiveBtn.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await setArchivedRow(row?.url || "", !isArchived);
          });
          return archiveBtn;
        },
      },
    ],
    columns: [
      { className: "overview-cell-text", value: (row) => row?.name || "" },
      { className: "overview-cell-text", value: (row) => row?.company || "" },
      { className: "overview-cell-text", value: (row) => row?.headline || "" },
      { className: "overview-cell-text", value: (row) => row?.status || "" },
      {
        className: "overview-cell-text",
        value: (row) => formatLocalDateTime(getOverviewLastRelevantDate(row)),
      },
      {
        className: "overview-cell-text overview-cell-campaign",
        value: (row) => row?.campaigns || "",
      },
    ],
  });
  bindOverviewNameDetailActions(safeRows);
  scheduleOverviewAutoSize();
}

async function openPersonDetailsFromOverviewRow(row) {
  const linkedinUrl = canonicalizeLinkedInUrl(row?.url || "");
  if (!isLinkedInProfileLikeUrl(linkedinUrl)) return;
  setFooterFetchingStatus();
  try {
    selectedCompanyFromListLinkedinUrl = "";
    setCompanyUrlMismatchBannerVisible(false);
    dbCompanyRow = null;
    companyPeopleRows = [];
    selectedExistingCompanyForLink = null;
    PopupState.lastProfileContextEnriched = null;
    PopupState.currentProfileContext = {
      url: linkedinUrl,
      linkedin_url: linkedinUrl,
      name: safeTrim(row?.name),
      full_name: safeTrim(row?.name),
      company: safeTrim(row?.company),
      headline: safeTrim(row?.headline),
    };
    PopupState.lastProfileContextSent = PopupState.currentProfileContext;
    await refreshInvitationRowFromDb({ preserveTabs: true });
    setNoProfileStateVisible(false);
    renderDetailHeader({ force: true });
    updatePhaseButtons();
    setActiveTab("detail", { userInitiated: true });
    setFooterStatus("Profile details loaded.");
  } catch (e) {
    setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
  } finally {
    setFooterReady();
  }
}

function bindOverviewNameDetailActions(rows) {
  if (!overviewTbodyEl || !Array.isArray(rows)) return;
  const bodyRows = Array.from(overviewTbodyEl.querySelectorAll("tr"));
  bodyRows.forEach((tr, index) => {
    const row = rows[index];
    const linkedinUrl = safeTrim(row?.url);
    if (!isLinkedInProfileLikeUrl(linkedinUrl)) return;
    const nameCell = tr.children[1];
    if (!nameCell) return;
    nameCell.classList.add("overview-person-name-clickable");
    nameCell.title = "Open profile details";
    nameCell.setAttribute("role", "button");
    nameCell.setAttribute("tabindex", "0");
    const openProfile = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await openPersonDetailsFromOverviewRow(row);
    };
    nameCell.addEventListener("click", openProfile);
    nameCell.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      await openProfile(event);
    });
  });
}

function isCompanyRowArchived(row) {
  if (row?.archived === true || row?.archived === 1) return true;
  const normalized = String(row?.archived ?? "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true";
}

function renderCompanyOverviewSortIndicators() {
  const indicators = document.querySelectorAll("[data-company-sort-indicator]");
  indicators.forEach((el) => {
    const field = el.getAttribute("data-company-sort-indicator");
    el.textContent =
      field === companyOverviewSortField
        ? companyOverviewSortDir === "asc"
          ? "▲"
          : "▼"
        : "";
  });
}

function renderCompanyOverviewPagination() {
  const totalKnown = Number.isFinite(companyOverviewTotal);
  const start =
    companyOverviewTotal === 0
      ? 0
      : (companyOverviewPage - 1) * companyOverviewPageSize + 1;
  const end = totalKnown
    ? Math.min(companyOverviewPage * companyOverviewPageSize, companyOverviewTotal)
    : companyOverviewPage * companyOverviewPageSize;
  if (companyOverviewCountLabelEl) {
    companyOverviewCountLabelEl.textContent = totalKnown
      ? `${start}-${end} of ${companyOverviewTotal}`
      : "Total: ?";
  }
  if (companyOverviewPrevBtnEl) {
    companyOverviewPrevBtnEl.disabled = companyOverviewPage <= 1;
  }
  if (companyOverviewNextBtnEl) {
    companyOverviewNextBtnEl.disabled = totalKnown
      ? companyOverviewPage * companyOverviewPageSize >= companyOverviewTotal
      : false;
  }
  companyGridState.total = companyOverviewTotal;
}

function renderCompanyOverviewTable(rows) {
  if (!LEF_GRID) return;
  LEF_GRID.renderGridRows({
    tbodyEl: companyOverviewTbodyEl,
    rows,
    emptyColSpan: 7,
    actions: [
      {
        visible: (row) => isLinkedInProfileLikeUrl(row?.linkedin_url || ""),
        createButton: (row) => {
          const openBtn = createOverviewIconButton({
            title: "Open",
            ariaLabel: "Open",
            pathD:
              "M10 2h4v4h-1.8V4.9L7.5 9.6 6.4 8.5 11.1 3.8H10V2ZM3 4h4v1.5H4.5v6h6V9H12v4H3V4Z",
          });
          openBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openLinkedIn(row?.linkedin_url || "", {
              newTab: shouldOpenInNewTab(event),
            });
          });
          return openBtn;
        },
      },
      {
        createButton: (row) => {
          const isArchived = isCompanyRowArchived(row);
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
          archiveBtn.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await setArchivedCompanyRow(row?.company_id, !isArchived);
          });
          return archiveBtn;
        },
      },
    ],
    columns: [
      {
        className: "overview-cell-text",
        value: (row) => Number(row?.customer_potential_score || 0),
      },
      {
        className: "overview-cell-text",
        value: (row) => row?.company_name || "",
      },
      {
        className: "overview-cell-text",
        value: (row) => row?.linked_person_count ?? 0,
      },
      {
        className: "overview-cell-text",
        value: (row) => row?.employee_number || "0",
      },
      { className: "overview-cell-text", value: (row) => row?.sector || "" },
      { className: "overview-cell-text", value: (row) => row?.campaigns || "" },
    ],
  });
  bindCompanyLinkedPersonsActions(rows);
  bindCompanyNameDetailsActions(rows);
  scheduleCompanyOverviewAutoSize();
}

function bindCompanyLinkedPersonsActions(rows) {
  if (!companyOverviewTbodyEl || !Array.isArray(rows)) return;
  const bodyRows = Array.from(companyOverviewTbodyEl.querySelectorAll("tr"));
  bodyRows.forEach((tr, index) => {
    const row = rows[index];
    if (!row) return;
    const linkedCount = Number(row?.linked_person_count || 0);
    if (!Number.isFinite(linkedCount) || linkedCount <= 0) return;
    const companyName = String(row?.company_name || "").trim();
    if (!companyName) return;
    const linkedCountCell = tr.children[3];
    if (!linkedCountCell) return;
    linkedCountCell.classList.add("overview-linked-persons-clickable");
    linkedCountCell.title = `Show persons from ${companyName}`;
    linkedCountCell.addEventListener("click", () => {
      if (overviewSearchEl) {
        overviewSearchEl.value = companyName;
        overviewSearchEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
      setActiveListTab("persons");
    });
  });
}

function bindCompanyNameDetailsActions(rows) {
  if (!companyOverviewTbodyEl || !Array.isArray(rows)) return;
  const bodyRows = Array.from(companyOverviewTbodyEl.querySelectorAll("tr"));
  bodyRows.forEach((tr, index) => {
    const row = rows[index];
    if (!row) return;
    const companyId = safeTrim(row?.company_id);
    if (!companyId) return;
    const companyNameCell = tr.children[2];
    if (!companyNameCell) return;
    companyNameCell.classList.add("overview-company-name-clickable");
    companyNameCell.title = "Open company details";
    companyNameCell.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      setFooterFetchingStatus();
      try {
        const result = await sendRuntimeMessage("DB_GET_COMPANY_BY_ID", {
          payload: { company_id: companyId },
        });
        const companyRow = result.ok ? result.data?.company || null : null;
        if (!companyRow) {
          throw new Error(getErrorMessage(result.error) || "Company not found.");
        }
        dbCompanyRow = companyRow;
        const linkedinId = safeTrim(companyRow?.linkedin_id || row?.linkedin_url || "");
        selectedCompanyFromListLinkedinUrl = linkedinId;
        PopupState.currentProfileContext = {
          url: linkedinId,
          linkedin_id: linkedinId,
          is_company_profile: true,
          company_name: safeTrim(companyRow?.company_name),
        };
        setNoProfileStateVisible(false);
        renderDetailHeader({ force: true });
        await refreshCompanyPeopleList();
        await refreshCompanyUrlMismatchBanner();
        setActiveTab("detail", { userInitiated: true });
        setFooterStatus("Company details loaded.");
      } catch (e) {
        setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
      } finally {
        setFooterReady();
      }
    });
  });
}

async function fetchCompaniesOverviewPage() {
  if (!companyOverviewTbodyEl) return;
  try {
    const result = await sendRuntimeMessage("DB_LIST_COMPANIES", {
      payload: {
        page: companyOverviewPage,
        pageSize: companyOverviewPageSize,
        sortField: companyOverviewSortField,
        sortDir: companyOverviewSortDir,
        filters: companyOverviewFilters,
        search: companyOverviewSearch,
      },
    });
    const resp = result.data || {};
    if (!result.ok) {
      LEF_GRID?.renderGridRows({
        tbodyEl: companyOverviewTbodyEl,
        rows: [],
        emptyColSpan: 7,
        emptyText: getErrorMessage(result.error),
      });
      companyOverviewTotal = null;
      renderCompanyOverviewPagination();
      scheduleCompanyOverviewAutoSize();
      return;
    }
    companyOverviewRows = Array.isArray(resp?.rows) ? resp.rows : [];
    companyOverviewTotal = Number.isFinite(resp?.total)
      ? resp.total
      : companyOverviewRows.length;
    renderCompanyOverviewTable(companyOverviewRows);
    renderCompanyOverviewSortIndicators();
    renderCompanyOverviewPagination();
  } catch (e) {
    LEF_GRID?.renderGridRows({
      tbodyEl: companyOverviewTbodyEl,
      rows: [],
      emptyColSpan: 7,
      emptyText: getErrorMessage(e),
    });
    companyOverviewTotal = null;
    renderCompanyOverviewPagination();
    scheduleCompanyOverviewAutoSize();
  }
}

function getGridColumnBounds(kind, index) {
  if (kind === "companies") {
    const bounds = [
      { min: 72, max: 220 },
      { min: 80, max: 140 },
      { min: 120, max: 320 },
      { min: 90, max: 180 },
      { min: 90, max: 180 },
      { min: 100, max: 260 },
      { min: 100, max: 260 },
    ];
    return bounds[index] || { min: 70, max: 420 };
  }
  const bounds = [
    { min: 72, max: 220 },
    { min: 90, max: 260 },
    { min: 90, max: 260 },
    { min: 90, max: 260 },
    { min: 80, max: 180 },
    { min: 110, max: 180 },
    { min: 100, max: 240 },
  ];
  return bounds[index] || { min: 70, max: 420 };
}

function getGridColumnKey(kind, index) {
  if (kind === "companies") {
    const keys = [
      "companies_actions",
      "companies_customer_potential_score",
      "companies_company_name",
      "companies_linked_person_count",
      "companies_employee_number",
      "companies_sector",
      "companies_campaigns",
    ];
    return keys[index] || `companies_col_${index}`;
  }
  const keys = [
    "persons_actions",
    "persons_name",
    "persons_company",
    "persons_headline",
    "persons_status",
    "persons_most_relevant_date",
    "persons_campaign",
  ];
  return keys[index] || `persons_col_${index}`;
}

const clampNumber = POPUP_UTILS.clampNumber;

function ensureGridColgroup(tableEl, columnCount) {
  if (!tableEl) return null;
  let colgroupEl = tableEl.querySelector("colgroup");
  if (!colgroupEl) {
    colgroupEl = document.createElement("colgroup");
    tableEl.insertBefore(colgroupEl, tableEl.firstChild);
  }
  while (colgroupEl.children.length < columnCount) {
    colgroupEl.appendChild(document.createElement("col"));
  }
  return colgroupEl;
}

function schedulePersistOverviewColumnPrefs() {
  if (gridColumnPersistTimer) {
    clearTimeout(gridColumnPersistTimer);
  }
  gridColumnPersistTimer = setTimeout(async () => {
    gridColumnPersistTimer = null;
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

function ensureGridResizeHandles(tableEl, kind) {
  if (!tableEl) return;
  const headerRow = tableEl.tHead?.rows?.[0] || null;
  if (!headerRow) return;
  Array.from(headerRow.cells || []).forEach((thEl, index) => {
    thEl.dataset.colKey = getGridColumnKey(kind, index);
    let handleEl = thEl.querySelector(".col-resize-handle");
    if (!handleEl) {
      handleEl = document.createElement("div");
      handleEl.className = "col-resize-handle";
      thEl.appendChild(handleEl);
    }
    handleEl.dataset.colIndex = String(index);
    handleEl.dataset.colKey = getGridColumnKey(kind, index);
  });
}

function bindGridResizeEvents(tableEl, kind) {
  if (!tableEl) return;
  if (tableEl.dataset.resizeBound === "1") return;
  tableEl.dataset.resizeBound = "1";
  tableEl.addEventListener("pointerdown", (event) => {
    const targetEl =
      event.target instanceof Element
        ? event.target.closest(".col-resize-handle")
        : null;
    if (!targetEl) return;
    const colIndex = Number(targetEl.dataset.colIndex || -1);
    if (!Number.isFinite(colIndex) || colIndex < 0) return;
    const colKey = getGridColumnKey(kind, colIndex);
    const headerRow = tableEl.tHead?.rows?.[0] || null;
    if (!headerRow) return;
    const columnCount = headerRow.cells.length;
    const colgroupEl = ensureGridColgroup(tableEl, columnCount);
    if (!colgroupEl) return;
    const colEl = colgroupEl.children[colIndex];
    const headerCell = headerRow.cells[colIndex];
    if (!colEl || !headerCell) return;

    event.preventDefault();
    event.stopPropagation();

    const { min, max } = getGridColumnBounds(kind, colIndex);
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

function autoSizeGridColumns(tableEl, tbodyEl, kind) {
  if (!tableEl) return;
  if (document.body.classList.contains("is-col-resizing")) return;
  const headerRow = tableEl.tHead?.rows?.[0] || null;
  if (!headerRow) return;

  ensureGridResizeHandles(tableEl, kind);
  bindGridResizeEvents(tableEl, kind);

  const bodyRows = Array.from(tbodyEl?.rows || []).filter(
    (row) => row && row.offsetParent !== null,
  );
  const paddingBuffer = 20;
  const columnCount = headerRow.cells.length;
  const colgroupEl = ensureGridColgroup(tableEl, columnCount);
  if (!colgroupEl) return;

  for (let index = 0; index < columnCount; index += 1) {
    const colKey = getGridColumnKey(kind, index);
    const headerCell = headerRow.cells[index];
    const colEl = colgroupEl.children[index];
    if (!colEl) continue;
    if (overviewColumnOverridden[colKey]) {
      const { min, max } = getGridColumnBounds(kind, index);
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

    const { min, max } = getGridColumnBounds(kind, index);
    const width = clampNumber(widest + paddingBuffer, min, max);
    colEl.style.width = `${width}px`;
    overviewColumnWidths[colKey] = Math.round(width);
  }
}

function scheduleGridAutoSize(kind, tableEl, tbodyEl) {
  if (gridAutoSizeTimers[kind]) {
    clearTimeout(gridAutoSizeTimers[kind]);
  }
  gridAutoSizeTimers[kind] = setTimeout(() => {
    gridAutoSizeTimers[kind] = null;
    if (document.body.classList.contains("is-col-resizing")) {
      scheduleGridAutoSize(kind, tableEl, tbodyEl);
      return;
    }
    autoSizeGridColumns(tableEl, tbodyEl, kind);
  }, 180);
}

function scheduleOverviewAutoSize() {
  scheduleGridAutoSize("persons", overviewTableEl, overviewTbodyEl);
}

function scheduleCompanyOverviewAutoSize() {
  scheduleGridAutoSize("companies", companyOverviewTableEl, companyOverviewTbodyEl);
}

async function fetchOverviewPage() {
  setFooterStatus("Loading overview...");
  let contextRefreshPromise = null;
  let shouldSetReady = true;
  try {
    const result = await sendRuntimeMessage("DB_LIST_INVITATIONS_OVERVIEW", {
      payload: buildOverviewQueryState(),
    });
    const resp = result.data || {};
    if (!result.ok) {
      overviewTbodyEl.innerHTML = "";
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 7;
      td.textContent = getErrorMessage(result.error);
      tr.appendChild(td);
      overviewTbodyEl.appendChild(tr);
      overviewTotal = null;
      renderOverviewPagination();
      scheduleOverviewAutoSize();
      setFooterStatus(getErrorMessage(result.error));
      shouldSetReady = false;
      return;
    }
    overviewTotal = Number.isFinite(resp?.total) ? resp.total : null;
    const visibleRows = applyOverviewClientFilters(resp?.rows || []);
    renderOverviewTable(visibleRows);
    contextRefreshPromise = persistOverviewListContext(visibleRows);
    overviewContextRefreshPromise = contextRefreshPromise;
    await contextRefreshPromise;
    renderOverviewSortIndicators();
    renderOverviewPagination();
  } catch (e) {
    overviewTbodyEl.innerHTML = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.textContent = getErrorMessage(e);
    tr.appendChild(td);
    overviewTbodyEl.appendChild(tr);
    scheduleOverviewAutoSize();
    setFooterStatus(getErrorMessage(e));
    shouldSetReady = false;
  } finally {
    if (overviewContextRefreshPromise === contextRefreshPromise) {
      overviewContextRefreshPromise = null;
    }
    if (shouldSetReady) {
      setFooterReady();
    }
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

function buildOverviewListContextItemsFromRows(rows) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).reduce((items, row) => {
    const canonicalUrl = canonicalizeLinkedInUrl(row?.url || "");
    if (!isLinkedInProfileLikeUrl(canonicalUrl) || seen.has(canonicalUrl)) {
      return items;
    }
    seen.add(canonicalUrl);
    items.push(canonicalUrl);
    return items;
  }, []);
}

async function persistOverviewListContext(rows = null) {
  const items = Array.isArray(rows)
    ? buildOverviewListContextItemsFromRows(rows)
    : await buildOverviewListContextItems();
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

const shouldOpenInNewTab = POPUP_UTILS.shouldOpenInNewTab;

async function openLinkedIn(url, { newTab = false } = {}) {
  const targetUrl = String(url || "").trim();
  if (!targetUrl) return;
  const isLinkedInTarget =
    typeof LEF_UTILS.isLinkedInProfileLikeUrl === "function"
      ? LEF_UTILS.isLinkedInProfileLikeUrl(targetUrl)
    : /^https:\/\/www\.linkedin\.com\/(in|company|school)\/[^/?#]+/i.test(targetUrl);
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
    payload: { url: targetUrl, new_tab: Boolean(newTab) },
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

async function setArchivedCompanyRow(companyId, archived) {
  setFooterDbStatus();
  const target = String(companyId || "").trim();
  if (!target) {
    setFooterReady();
    return;
  }
  try {
    const result = await sendRuntimeMessage("DB_ARCHIVE_COMPANY", {
      payload: { company_id: target, archived: Boolean(archived) },
    });
    if (!result.ok) {
      setFooterStatus(
        `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(result.error)}`,
      );
      return;
    }
    await fetchCompaniesOverviewPage();
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
      personGridState.sortField = overviewSortField;
      personGridState.sortDir = overviewSortDir;
      persistOverviewFiltersToStorage().catch(() => null);
      overviewPage = 1;
      personGridState.page = overviewPage;
      fetchOverviewPage();
    });
  });

  filterCampaignEl?.addEventListener("change", () => {
    overviewFilters.campaign = normalizeCampaignValue(filterCampaignEl.value);
    personGridState.filters.campaign = overviewFilters.campaign;
    updateOverviewCampaignFilterTitle();
    persistOverviewFiltersToStorage().catch(() => null);
    overviewPage = 1;
    personGridState.page = overviewPage;
    fetchOverviewPage();
  });

  overviewArchivedFilterEl?.addEventListener("change", () => {
    overviewFilters.archived = overviewArchivedFilterEl.value;
    personGridState.filters.archived = overviewFilters.archived;
    persistOverviewFiltersToStorage().catch(() => null);
    overviewPage = 1;
    personGridState.page = overviewPage;
    fetchOverviewPage();
  });

  overviewStatusFilterEl?.addEventListener("change", () => {
    overviewFilters.status = overviewStatusFilterEl.value;
    personGridState.filters.status = overviewFilters.status;
    persistOverviewFiltersToStorage().catch(() => null);
    overviewPage = 1;
    personGridState.page = overviewPage;
    fetchOverviewPage();
  });

  filterAcceptedEl?.addEventListener("change", () => {
    overviewFilters.accepted = filterAcceptedEl.value || "";
    personGridState.filters.accepted = overviewFilters.accepted;
    persistOverviewFiltersToStorage().catch(() => null);
    overviewPage = 1;
    personGridState.page = overviewPage;
    fetchOverviewPage();
  });

  overviewSearchEl?.addEventListener("input", () => {
    updateFilterClearButton(overviewSearchEl, overviewSearchClearBtnEl);
    persistOverviewFiltersToStorage().catch(() => null);
    if (overviewSearchDebounceTimer) clearTimeout(overviewSearchDebounceTimer);
    overviewSearchDebounceTimer = setTimeout(() => {
      overviewSearch = overviewSearchEl.value.trim();
      personGridState.search = overviewSearch;
      overviewPage = 1;
      personGridState.page = overviewPage;
      fetchOverviewPage();
    }, 250);
  });

  overviewSearchClearBtnEl?.addEventListener("click", () => {
    clearFilterInput(overviewSearchEl, overviewSearchClearBtnEl);
  });

  overviewPageSizeEl?.addEventListener("change", () => {
    const nextSize = Number(overviewPageSizeEl.value);
    overviewPageSize = Number.isFinite(nextSize) ? nextSize : 25;
    personGridState.pageSize = overviewPageSize;
    overviewPage = 1;
    personGridState.page = overviewPage;
    fetchOverviewPage();
  });

  overviewPrevBtnEl?.addEventListener("click", () => {
    if (overviewPage <= 1) return;
    overviewPage -= 1;
    personGridState.page = overviewPage;
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
    personGridState.page = overviewPage;
    fetchOverviewPage();
  });

  document.querySelectorAll("[data-company-sort]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const field = btn.getAttribute("data-company-sort");
      if (!field) return;
      if (companyOverviewSortField === field) {
        companyOverviewSortDir = companyOverviewSortDir === "asc" ? "desc" : "asc";
      } else {
        companyOverviewSortField = field;
        companyOverviewSortDir =
          field === "customer_potential_score" ? "desc" : "asc";
      }
      companyGridState.sortField = companyOverviewSortField;
      companyGridState.sortDir = companyOverviewSortDir;
      persistOverviewFiltersToStorage().catch(() => null);
      companyOverviewPage = 1;
      companyGridState.page = companyOverviewPage;
      fetchCompaniesOverviewPage();
    });
  });

  companyArchivedFilterEl?.addEventListener("change", () => {
    companyOverviewFilters.archived = companyArchivedFilterEl.value || "";
    companyGridState.filters.archived = companyOverviewFilters.archived;
    persistOverviewFiltersToStorage().catch(() => null);
    companyOverviewPage = 1;
    companyGridState.page = companyOverviewPage;
    fetchCompaniesOverviewPage();
  });

  companyCampaignFilterEl?.addEventListener("change", () => {
    const selectedOption =
      companyCampaignFilterEl.options[companyCampaignFilterEl.selectedIndex];
    const campaignName = String(selectedOption?.dataset?.campaignName || "").trim();
    companyOverviewFilters.campaign = campaignName;
    companyGridState.filters.campaign = campaignName;
    persistOverviewFiltersToStorage().catch(() => null);
    companyOverviewPage = 1;
    companyGridState.page = companyOverviewPage;
    fetchCompaniesOverviewPage();
  });

  companySearchEl?.addEventListener("input", () => {
    updateFilterClearButton(companySearchEl, companySearchClearBtnEl);
    persistOverviewFiltersToStorage().catch(() => null);
    if (companyOverviewSearchDebounceTimer) {
      clearTimeout(companyOverviewSearchDebounceTimer);
    }
    companyOverviewSearchDebounceTimer = setTimeout(() => {
      companyOverviewSearch = (companySearchEl.value || "").trim();
      companyGridState.search = companyOverviewSearch;
      companyOverviewPage = 1;
      companyGridState.page = companyOverviewPage;
      fetchCompaniesOverviewPage();
    }, 250);
  });

  companySearchClearBtnEl?.addEventListener("click", () => {
    clearFilterInput(companySearchEl, companySearchClearBtnEl);
  });

  companyOverviewPageSizeEl?.addEventListener("change", () => {
    const nextSize = Number(companyOverviewPageSizeEl.value);
    companyOverviewPageSize = Number.isFinite(nextSize) ? nextSize : 25;
    companyGridState.pageSize = companyOverviewPageSize;
    persistOverviewFiltersToStorage().catch(() => null);
    companyOverviewPage = 1;
    companyGridState.page = companyOverviewPage;
    fetchCompaniesOverviewPage();
  });

  companyOverviewPrevBtnEl?.addEventListener("click", () => {
    if (companyOverviewPage <= 1) return;
    companyOverviewPage -= 1;
    companyGridState.page = companyOverviewPage;
    fetchCompaniesOverviewPage();
  });

  companyOverviewNextBtnEl?.addEventListener("click", () => {
    if (
      Number.isFinite(companyOverviewTotal) &&
      companyOverviewPage * companyOverviewPageSize >= companyOverviewTotal
    ) {
      return;
    }
    companyOverviewPage += 1;
    companyGridState.page = companyOverviewPage;
    fetchCompaniesOverviewPage();
  });

  listPersonsTabBtnEl?.addEventListener("click", () => {
    setActiveListTab("persons");
  });
  listCompaniesTabBtnEl?.addEventListener("click", () => {
    setActiveListTab("companies");
  });
}

const getLinkedinUrlFromContext =
  typeof POPUP_UTILS.getLinkedinUrlFromContext === "function"
    ? POPUP_UTILS.getLinkedinUrlFromContext
    : (profileContext) =>
        profileContext?.url ||
        profileContext?.profile_url ||
        profileContext?.linkedin_url ||
        null;

const getProfileForGeneration =
  typeof POPUP_UTILS.getProfileForGeneration === "function"
    ? POPUP_UTILS.getProfileForGeneration
    : (profile) => {
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
      };

function isCompanyProfileMode(profileContext = PopupState.currentProfileContext) {
  if (safeTrim(dbCompanyRow?.company_id)) return true;
  const url = String(getLinkedinUrlFromContext(profileContext) || "");
  return /linkedin\.com\/(company|school)\//i.test(url);
}

function normalizeCompanyLinkedinId(profileContext = PopupState.currentProfileContext) {
  const raw =
    profileContext?.linkedin_id || getLinkedinUrlFromContext(profileContext) || "";
  return canonicalizeLinkedInUrl(raw);
}

function getDetailNameLinkedinUrl() {
  if (isCompanyProfileMode()) {
    return (
      safeTrim(dbCompanyRow?.linkedin_id) ||
      normalizeCompanyLinkedinId(PopupState.currentProfileContext)
    );
  }
  return safeTrim(
    PopupState.dbInvitationRow?.linkedin_url || getLinkedinUrlFromContext(PopupState.currentProfileContext),
  );
}

function isLinkedInProfileLikeUrl(url) {
  if (typeof LEF_UTILS.isLinkedInProfileLikeUrl === "function") {
    return LEF_UTILS.isLinkedInProfileLikeUrl(url);
  }
  if (!url || typeof url !== "string") return false;
  return /^https:\/\/www\.linkedin\.com\/(in|company|school)\/[^/?#]+/i.test(url);
}

function canonicalizeLinkedInUrl(rawUrl) {
  if (typeof LEF_UTILS.canonicalizeLinkedInUrl === "function") {
    return LEF_UTILS.canonicalizeLinkedInUrl(rawUrl);
  }
  const input = String(rawUrl || "").trim();
  if (!input) return "";
  try {
    const parsed = new URL(input);
    const parts = (parsed.pathname || "")
      .split("/")
      .filter(Boolean);
    if (
      parts.length >= 2 &&
      /^(company|school)$/i.test(parts[0])
    ) {
      return `https://www.linkedin.com/${parts[0].toLowerCase()}/${parts[1]}/`;
    }
    const pathname = (parsed.pathname || "").replace(/\/+$/, "") || "/";
    if (pathname === "/") return "https://www.linkedin.com/";
    return `https://www.linkedin.com${pathname}/`;
  } catch (_e) {
    const noHash = input.split("#")[0];
    const noQuery = noHash.split("?")[0];
    const match = noQuery.match(
      /^https:\/\/www\.linkedin\.com\/(company|school)\/([^/?#\/]+)/i,
    );
    if (match) {
      return `https://www.linkedin.com/${match[1].toLowerCase()}/${match[2]}/`;
    }
    const noTrailing = noQuery.replace(/\/+$/, "");
    if (!noTrailing) return "";
    return noTrailing.endsWith("/") ? noTrailing : `${noTrailing}/`;
  }
}

function detectLinkedInPageType(rawUrl) {
  const linkedin_id = canonicalizeLinkedInUrl(rawUrl || "");
  const result = { page_type: "unsupported", linkedin_id };
  if (!/^https:\/\/www\.linkedin\.com\//i.test(linkedin_id)) return result;
  if (/^https:\/\/www\.linkedin\.com\/in\/[^/?#]+/i.test(linkedin_id)) {
    result.page_type = "person";
    return result;
  }
  if (/^https:\/\/www\.linkedin\.com\/(company|school)\/[^/?#]+/i.test(linkedin_id)) {
    result.page_type = "company";
    return result;
  }
  return result;
}

function getScrapeUrl(scrape) {
  return canonicalizeLinkedInUrl(
    scrape?.linkedin_id || getLinkedinUrlFromContext(scrape) || "",
  );
}

function sanitizeCompanySearchTerm(value) {
  return safeTrim(value)
    .replace(/^\(\d+\)\s*/, "")
    .replace(/\s*:\s*(vis[aã]o geral|overview).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getProfileMatchForUrl(url) {
  const normalizedUrl = String(url || "");
  const inRule = /^https:\/\/www\.linkedin\.com\/in\/[^/?#]+/i.test(
    normalizedUrl,
  );
  const companyRule = /^https:\/\/www\.linkedin\.com\/(company|school)\/[^/?#]+/i.test(
    normalizedUrl,
  );
  const fallbackMatch = isLinkedInProfileLikeUrl(normalizedUrl);
  if (inRule) return { isProfileOpen: true, matchedRule: "/in/" };
  if (companyRule) return { isProfileOpen: true, matchedRule: "/company|school/" };
  return {
    isProfileOpen: Boolean(fallbackMatch),
    matchedRule: fallbackMatch ? "fallback" : "none",
  };
}

const getActiveTabForProfileCheck =
  PopupProfileController.getActiveTabForProfileCheck;
const logEmptyStateDebugOnce = PopupProfileController.logEmptyStateDebugOnce;
const findNoProfileEl = PopupProfileController.findNoProfileEl;
const setNoProfileStateVisible = PopupProfileController.setNoProfileStateVisible;
const getNoProfileDomDebugInfo =
  PopupProfileController.getNoProfileDomDebugInfo;
const ensureNoProfileStateUi = PopupProfileController.ensureNoProfileStateUi;

const getFullNameFromContext =
  typeof POPUP_UTILS.getFullNameFromContext === "function"
    ? POPUP_UTILS.getFullNameFromContext
    : (profileContext) => profileContext?.name || profileContext?.full_name || null;
globalThis.UI_TEXT = UI_TEXT;
globalThis.IS_SIDE_PANEL_CONTEXT = IS_SIDE_PANEL_CONTEXT;
globalThis.safeTrim = safeTrim;
globalThis.getErrorMessage = getErrorMessage;
globalThis.getLinkedinUrlFromContext = getLinkedinUrlFromContext;
globalThis.getProfileForGeneration = getProfileForGeneration;

const extractProfileContextFromActiveTab =
  PopupProfileController.extractProfileContextFromActiveTab;
const extractCompanyContextFromActiveTab =
  PopupProfileController.extractCompanyContextFromActiveTab;
const getFreshScrapeForPage = PopupProfileController.getFreshScrapeForPage;
const extractAndPersistProfileDetails =
  PopupProfileController.extractAndPersistProfileDetails;

function clearFreePromptPreview() {
  if (freePromptPreviewEl) freePromptPreviewEl.textContent = "";
  updateFreePromptCopyButtonState();
}

const applyProfileExtractionFailureState =
  PopupProfileController.applyProfileExtractionFailureState;
const refreshAll = PopupProfileController.refreshAll;
const loadProfileContextOnOpen = PopupProfileController.loadProfileContextOnOpen;

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
  if (PopupState.currentProfileContext) {
    PopupState.currentProfileContext.language = normalized;
  }
  if (persist) {
    await chrome.storage.local.set({
      [STORAGE_KEY_MESSAGE_LANGUAGE]: normalized,
    });
  }
}

const loadMessageLanguage = PopupConfigController.loadMessageLanguage;

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

const loadFreePromptLanguage = PopupConfigController.loadFreePromptLanguage;

const copyToClipboard =
  typeof POPUP_UTILS.copyToClipboard === "function"
    ? POPUP_UTILS.copyToClipboard
    : async (text) => {
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
      };
globalThis.copyToClipboard = copyToClipboard;

const setCopyIconDefaultState =
  PopupMessageController.setCopyIconDefaultState || (() => {});
const setCopyIconSuccessState =
  PopupMessageController.setCopyIconSuccessState || (() => {});
const showFirstMessageCopySuccessCheck =
  PopupMessageController.showFirstMessageCopySuccessCheck || (() => {});
const showFollowupCopySuccessCheck =
  PopupMessageController.showFollowupCopySuccessCheck || (() => {});
const showFreePromptCopySuccessCheck =
  PopupMessageController.showFreePromptCopySuccessCheck || (() => {});
const updateFollowupCopyIconVisibility =
  PopupMessageController.updateFollowupCopyIconVisibility || (() => {});
const updateFreePromptCopyButtonState =
  PopupMessageController.updateFreePromptCopyButtonState || (() => {});

function setAuthInnerTab(which) {
  supabaseAuthInnerTab = which === "login" ? "login" : "signup";
  const signupActive = supabaseAuthInnerTab !== "login";
  if (authInnerSignupBtnEl)
    authInnerSignupBtnEl.classList.toggle("active", signupActive);
  if (authInnerLoginBtnEl)
    authInnerLoginBtnEl.classList.toggle("active", !signupActive);
  renderSupabaseAuthUiState();
}

function renderSupabaseAuthUiState() {
  if (supabaseAuthFormsEl) {
    supabaseAuthFormsEl.hidden = supabaseAuthIsLoggedIn;
  }
  if (supabaseLoggedInPanelEl) {
    supabaseLoggedInPanelEl.hidden = !supabaseAuthIsLoggedIn;
  }
  if (supabaseAuthIsLoggedIn) {
    if (authSignupPanelEl) authSignupPanelEl.hidden = true;
    if (authLoginPanelEl) authLoginPanelEl.hidden = true;
    return;
  }
  const signupActive = supabaseAuthInnerTab !== "login";
  if (authSignupPanelEl) authSignupPanelEl.hidden = !signupActive;
  if (authLoginPanelEl) authLoginPanelEl.hidden = signupActive;
}

function normalizeSupabaseAuthError(errorLike) {
  const raw = getErrorMessage(errorLike);
  const text = String(raw || "").toLowerCase();
  if (text.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }
  if (text.includes("user already registered")) {
    return "User already exists.";
  }
  if (text.includes("password should be")) {
    return "Password is too weak.";
  }
  if (text.includes("session expired")) {
    return "Session expired, please login.";
  }
  return raw || "Unexpected error.";
}

function applySupabaseAuthUi(session) {
  const userEmail = String(session?.user?.email || "").trim();
  supabaseAuthIsLoggedIn = Boolean(userEmail);
  if (supabaseUserEmailEl) {
    supabaseUserEmailEl.textContent = userEmail || "";
  }
  if (supabaseLogoutBtnEl) {
    supabaseLogoutBtnEl.hidden = !supabaseAuthIsLoggedIn;
  }
  renderSupabaseAuthUiState();
}

async function refreshSupabaseAuthUi() {
  const result = await sendRuntimeMessage("SUPABASE_AUTH_GET_SESSION");
  if (!result.ok) {
    applySupabaseAuthUi(null);
    return;
  }
  const data = result.data || {};
  applySupabaseAuthUi(data?.session || null);
}

async function handleSupabaseSignup() {
  const name = (supabaseSignupNameEl?.value || "").trim();
  const email = (supabaseSignupEmailEl?.value || "").trim();
  const password = (supabaseSignupPasswordEl?.value || "").trim();
  if (!email || !password) {
    setFooterStatus("Email and password are required.");
    return;
  }
  setFooterStatus("Signing up...");
  const result = await sendRuntimeMessage("SUPABASE_AUTH_SIGNUP", {
    payload: { name, email, password },
  });
  if (!result.ok) {
    setFooterStatus(normalizeSupabaseAuthError(result.error));
    return;
  }
  await refreshSupabaseAuthUi();
  const message = (result.data && result.data.message) || "Signup successful.";
  setFooterStatus(message);
}

async function handleSupabaseLogin() {
  const email = (supabaseLoginEmailEl?.value || "").trim();
  const password = (supabaseLoginPasswordEl?.value || "").trim();
  if (!email || !password) {
    setFooterStatus("Email and password are required.");
    return;
  }
  setFooterStatus("Logging in...");
  const result = await sendRuntimeMessage("SUPABASE_AUTH_LOGIN", {
    payload: { email, password },
  });
  if (!result.ok) {
    setFooterStatus(normalizeSupabaseAuthError(result.error));
    return;
  }
  await refreshSupabaseAuthUi();
  setFooterStatus("Logged in.");
}

async function handleSupabaseResetPassword() {
  const email = (
    supabaseLoginEmailEl?.value ||
    supabaseSignupEmailEl?.value ||
    ""
  ).trim();
  if (!email) {
    setFooterStatus("Enter an email first.");
    return;
  }
  setFooterStatus("Sending reset email...");
  const result = await sendRuntimeMessage("SUPABASE_AUTH_RESET_PASSWORD", {
    payload: { email },
  });
  if (!result.ok) {
    setFooterStatus(normalizeSupabaseAuthError(result.error));
    return;
  }
  setFooterStatus("Password reset email sent.");
}

async function handleSupabaseLogout() {
  setFooterStatus("Logging out...");
  const result = await sendRuntimeMessage("SUPABASE_AUTH_LOGOUT");
  if (!result.ok) {
    setFooterStatus(normalizeSupabaseAuthError(result.error));
    return;
  }
  await refreshSupabaseAuthUi();
  setFooterStatus("Logged out.");
}

let popupInitErrorLogged = false;
function logPopupInitError(error) {
  if (popupInitErrorLogged) return;
  popupInitErrorLogged = true;
  PopupLogger.error(`[LEF][init] popup init failed: ${getErrorMessage(error)}`);
  if (error && typeof error === "object" && typeof error.stack === "string") {
    PopupLogger.error(error.stack);
  }
}

function runPopupInit() {
  globalThis.canonicalizeLinkedInUrl = canonicalizeLinkedInUrl;
  globalThis.detectLinkedInPageType = detectLinkedInPageType;
  globalThis.isCompanyProfileMode = isCompanyProfileMode;
  globalThis.getScrapeUrl = getScrapeUrl;
  globalThis.getProfileMatchForUrl = getProfileMatchForUrl;
  globalThis.setCompanyUrlMismatchBannerVisible = setCompanyUrlMismatchBannerVisible;
  globalThis.timingLog = timingLog;
  globalThis.renderLinkedCampaignChips = renderLinkedCampaignChips;
  globalThis.setCampaignSelectValue = setCampaignSelectValue;
  globalThis.clearFreePromptPreview = clearFreePromptPreview;
  globalThis.renderDetailHeader = renderDetailHeader;
  globalThis.updatePhaseButtons = updatePhaseButtons;
  globalThis.refreshCompanyRowFromDb = refreshCompanyRowFromDb;
  globalThis.refreshCompanySuggestionUiForCurrentInvitation =
    refreshCompanySuggestionUiForCurrentInvitation;
  globalThis.loadProfileContextOnOpen = loadProfileContextOnOpen;
  globalThis.sendRuntimeMessage = sendRuntimeMessage;
  globalThis.getMessageCountValue = getMessageCountValue;
  globalThis.isMessageSentOrBeyondStatus = isMessageSentOrBeyondStatus;
  globalThis.getLanguage = getLanguage;
  globalThis.setLanguage = setLanguage;
  globalThis.normalizeCompanyLinkedinId = normalizeCompanyLinkedinId;
  globalThis.setFooterUpdatingStatus = setFooterUpdatingStatus;
  globalThis.applyLifecycleUiState = applyLifecycleUiState;
  globalThis.renderMessageTab = renderMessageTab;
  globalThis.setCopyIconDefaultState = setCopyIconDefaultState;
  globalThis.setCopyIconSuccessState = setCopyIconSuccessState;
  globalThis.updateFollowupCopyIconVisibility = updateFollowupCopyIconVisibility;
  initPopupModules();
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
  tabSupabaseAuthBtn?.addEventListener("click", () =>
    setActiveTab("supabase_login", { userInitiated: true }),
  );
  configGeneralTabBtnEl?.addEventListener("click", () => setConfigInnerTab("general"));
  configSupabaseTabBtnEl?.addEventListener("click", () =>
    setConfigInnerTab("supabase"),
  );

  bindConfigEvents();
  loadSettings().catch((_e) => {});
  const supabaseAuthUiPromise = refreshSupabaseAuthUi().catch(() => null);
  setAuthInnerTab("signup");
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
  authInnerSignupBtnEl?.addEventListener("click", () =>
    setAuthInnerTab("signup"),
  );
  authInnerLoginBtnEl?.addEventListener("click", () =>
    setAuthInnerTab("login"),
  );
  supabaseSignupBtnEl?.addEventListener("click", () => {
    handleSupabaseSignup().catch((e) => {
      setFooterStatus(normalizeSupabaseAuthError(e));
    });
  });
  supabaseLoginBtnEl?.addEventListener("click", () => {
    handleSupabaseLogin().catch((e) => {
      setFooterStatus(normalizeSupabaseAuthError(e));
    });
  });
  supabaseResetPasswordBtnEl?.addEventListener("click", () => {
    handleSupabaseResetPassword().catch((e) => {
      setFooterStatus(normalizeSupabaseAuthError(e));
    });
  });
  supabaseLogoutBtnEl?.addEventListener("click", () => {
    handleSupabaseLogout().catch((e) => {
      setFooterStatus(normalizeSupabaseAuthError(e));
    });
  });
  setCopyButtonEnabled(false);
  updateInviteCopyIconVisibility();
  updateFollowupCopyIconVisibility();
  bindPromptManagementEvents();
  bindMessagesWorkflowEvents();
  bindStepperClickHandlers();
  updateMessageTabControls();
  if (OVERVIEW_ENABLED) {
    wireOverviewEvents();
    loadOverviewColumnPrefs()
      .then(() => {
        scheduleOverviewAutoSize();
        scheduleCompanyOverviewAutoSize();
      })
      .catch(() => {
        scheduleOverviewAutoSize();
        scheduleCompanyOverviewAutoSize();
      });
    if (document.documentElement.dataset.overviewResizeBound !== "1") {
      document.documentElement.dataset.overviewResizeBound = "1";
      window.addEventListener("resize", () => {
        scheduleOverviewAutoSize();
        scheduleCompanyOverviewAutoSize();
      });
    }
    overviewPageSize = Number(overviewPageSizeEl?.value || 25);
    personGridState.pageSize = overviewPageSize;
    renderOverviewSortIndicators();
    renderOverviewPagination();
    companyOverviewPageSize = Number(companyOverviewPageSizeEl?.value || 25);
    companyGridState.pageSize = companyOverviewPageSize;
    renderCompanyOverviewSortIndicators();
    renderCompanyOverviewPagination();
    setActiveListTab("persons");
  }
  setFooterReady();
  setCommunicationStatus("Ready");
  applyLifecycleUiState(PopupState.dbInvitationRow);
  renderMessageTab(PopupState.outreachMessageStatus);
  setDetailInnerTab("free_prompt");
  renderDetailHeader();
  updatePhaseButtons();
  loadProfileContextOnOpen().catch((_e) => {});
  supabaseAuthUiPromise.finally(() => {
    loadPromptOptions().catch((e) => {
      PopupLogger.warn("[LEF][prompt] failed to load prompt options", e);
      setFooterStatus(`Prompt load error: ${getErrorMessage(e)}`);
    });
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
            personGridState.page = overviewPage;
            if (activeListTab === "companies") {
              fetchCompaniesOverviewPage();
            } else {
              fetchOverviewPage();
            }
          }
        })
        .catch(() => null);
    });
  setNewCampaignRowVisible(false);
  setRenameCampaignRowVisible(false);
  setCompanyNewCampaignRowVisible(false);
  setCompanyRenameCampaignRowVisible(false);
  updateCompanyRenameCampaignButtonState();

  getLanguageSelectElements().forEach((el) => {
    el.addEventListener("change", async () => {
      await setLanguage(el.value);
    });
  });
  freePromptLanguageEl?.addEventListener("change", async () => {
    await setFreePromptLanguage(freePromptLanguageEl.value);
  });
  messageCountIncrementEl?.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setFooterDbStatus();
    try {
      await adjustMessageCountForCurrentProfile(1);
    } finally {
      setFooterReady();
    }
  });
  messageCountDecrementEl?.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const statusValue = getLifecycleStatusValue(PopupState.dbInvitationRow);
    const effectiveCount = getEffectiveMessageCount(PopupState.dbInvitationRow);
    if (isMessageSentOrBeyondStatus(statusValue) && effectiveCount <= 1) {
      setFooterStatus(
        "To remove the last message, revert status via the process flow.",
      );
      return;
    }
    if (effectiveCount <= 0) return;
    setFooterDbStatus();
    try {
      await adjustMessageCountForCurrentProfile(-1);
    } finally {
      setFooterReady();
    }
  });

  campaignSelectEl?.addEventListener("change", async () => {
    updateDetailCampaignSelectTitle();
    updateRenameCampaignButtonState();
    if (!campaignSelectEl.value) {
      await saveLastActiveCampaign("");
      return;
    }
    setFooterUpdatingStatus();
    try {
      await handleCampaignSelection(campaignSelectEl.value);
    } catch (e) {
      setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
    } finally {
      setFooterReady();
    }
  });

  toggleNewCampaignBtnEl?.addEventListener("click", () => {
    setRenameCampaignRowVisible(false);
    setNewCampaignRowVisible(true);
    newCampaignNameEl?.focus();
  });

  renameCampaignBtnEl?.addEventListener("click", () => {
    const selectedId = String(campaignSelectEl?.value || "").trim();
    if (!selectedId) return;
    const row = knownCampaignRows.find(
      (item) => String(item?.campaign_id || "").trim() === selectedId,
    );
    setNewCampaignRowVisible(false);
    setRenameCampaignRowVisible(true);
    if (renameCampaignNameEl) {
      renameCampaignNameEl.value = normalizeCampaignValue(row?.campaign_name || "");
      renameCampaignNameEl.focus();
      renameCampaignNameEl.select();
    }
  });

  addCampaignBtnEl?.addEventListener("click", async () => {
    const campaignName = normalizeCampaignValue(
      newCampaignNameEl?.value || "",
    );
    if (!campaignName) return;
    setFooterUpdatingStatus();
    try {
      const createResult = await sendRuntimeMessage("DB_CREATE_CAMPAIGN", {
        payload: { campaign_name: campaignName },
      });
      const createResp = createResult.data || {};
      if (!createResult.ok || !createResp?.campaign?.campaign_id) {
        throw new Error(getErrorMessage(createResult.error || createResp?.error));
      }
      const createdCampaignId = String(
        createResp.campaign.campaign_id || "",
      ).trim();
      await loadCampaignOptions({ keepSelected: true });
      setCampaignSelectValue(createdCampaignId);
      if (PopupState.dbInvitationRow?.id) {
        await handleCampaignSelection(createdCampaignId);
      } else {
        setFooterStatus("Person must exist/generated first.");
      }
      setNewCampaignRowVisible(false);
    } catch (e) {
      setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
    } finally {
      setFooterReady();
    }
  });

  cancelNewCampaignBtnEl?.addEventListener("click", () => {
    setNewCampaignRowVisible(false);
  });

  cancelRenameCampaignBtnEl?.addEventListener("click", () => {
    setRenameCampaignRowVisible(false);
  });

  saveRenameCampaignBtnEl?.addEventListener("click", async () => {
    setFooterUpdatingStatus();
    if (saveRenameCampaignBtnEl) saveRenameCampaignBtnEl.disabled = true;
    try {
      await renameSelectedCampaign(renameCampaignNameEl?.value || "");
      setRenameCampaignRowVisible(false);
      setFooterStatus("Campaign renamed.");
    } catch (e) {
      setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
    } finally {
      if (saveRenameCampaignBtnEl) saveRenameCampaignBtnEl.disabled = false;
      setFooterReady();
    }
  });

  companyCampaignSelectEl?.addEventListener("change", async () => {
    updateCompanyRenameCampaignButtonState();
    const campaignId = safeTrim(companyCampaignSelectEl.value);
    if (!campaignId) return;
    const personIds = Array.from(
      new Set(
        companyPeopleRows
          .map((row) => safeTrim(row?.id))
          .filter((id) => Boolean(id)),
      ),
    );
    if (!personIds.length) return;
    setFooterUpdatingStatus();
    try {
      await Promise.all(
        personIds.map((personId) =>
          sendRuntimeMessage("DB_LINK_PERSON_CAMPAIGN", {
            payload: { person_id: personId, campaign_id: campaignId },
          }),
        ),
      );
      await refreshCompanyPeopleList();
      setFooterStatus("Campaign linked to all persons.");
      companyCampaignSelectEl.value = "";
      updateCompanyRenameCampaignButtonState();
    } catch (e) {
      setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
    } finally {
      setFooterReady();
    }
  });

  companyToggleNewCampaignBtnEl?.addEventListener("click", () => {
    setCompanyRenameCampaignRowVisible(false);
    setCompanyNewCampaignRowVisible(true);
    companyNewCampaignNameEl?.focus();
  });

  companyCancelNewCampaignBtnEl?.addEventListener("click", () => {
    setCompanyNewCampaignRowVisible(false);
  });

  companyAddCampaignBtnEl?.addEventListener("click", async () => {
    const campaignName = normalizeCampaignValue(companyNewCampaignNameEl?.value || "");
    if (!campaignName) return;
    setFooterUpdatingStatus();
    try {
      const createResult = await sendRuntimeMessage("DB_CREATE_CAMPAIGN", {
        payload: { campaign_name: campaignName },
      });
      const createResp = createResult.data || {};
      if (!createResult.ok || !createResp?.campaign?.campaign_id) {
        throw new Error(getErrorMessage(createResult.error || createResp?.error));
      }
      await loadCampaignOptions({ keepSelected: true });
      setCompanyNewCampaignRowVisible(false);
      setFooterStatus("Campaign created.");
    } catch (e) {
      setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
    } finally {
      setFooterReady();
    }
  });

  companyRenameCampaignBtnEl?.addEventListener("click", () => {
    const selectedId = safeTrim(companyCampaignSelectEl?.value);
    if (!selectedId) return;
    const row = knownCampaignRows.find(
      (item) => safeTrim(item?.campaign_id) === selectedId,
    );
    setCompanyNewCampaignRowVisible(false);
    setCompanyRenameCampaignRowVisible(true);
    if (companyRenameCampaignNameEl) {
      companyRenameCampaignNameEl.value = normalizeCampaignValue(
        row?.campaign_name || "",
      );
      companyRenameCampaignNameEl.focus();
      companyRenameCampaignNameEl.select();
    }
  });

  companyCancelRenameCampaignBtnEl?.addEventListener("click", () => {
    setCompanyRenameCampaignRowVisible(false);
  });

  companySaveRenameCampaignBtnEl?.addEventListener("click", async () => {
    const campaignId = safeTrim(companyCampaignSelectEl?.value);
    const campaignName = normalizeCampaignValue(companyRenameCampaignNameEl?.value || "");
    if (!campaignId || !campaignName) return;
    setFooterUpdatingStatus();
    if (companySaveRenameCampaignBtnEl) companySaveRenameCampaignBtnEl.disabled = true;
    try {
      const result = await sendRuntimeMessage("DB_UPDATE_CAMPAIGN", {
        payload: { campaign_id: campaignId, campaign_name: campaignName },
      });
      if (!result.ok) throw new Error(getErrorMessage(result.error));
      await loadCampaignOptions({ keepSelected: true });
      setCompanyRenameCampaignRowVisible(false);
      companyCampaignSelectEl.value = campaignId;
      updateCompanyRenameCampaignButtonState();
      await refreshCompanyPeopleList();
      setFooterStatus("Campaign renamed.");
    } catch (e) {
      setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
    } finally {
      if (companySaveRenameCampaignBtnEl) companySaveRenameCampaignBtnEl.disabled = false;
      setFooterReady();
    }
  });
  window.addEventListener("resize", () => {
    positionMessageCountControls();
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

async function extractCompanyDetailsFromLlm(scrapedProfileContext = null) {
  const profileContext = scrapedProfileContext;
  if (!profileContext) {
    PopupLogger.debug("[LEF][llm] blocked because scrape missing", {
      page_type: "company",
    });
    throw new Error("Missing company scrape.");
  }
  PopupState.currentProfileContext = profileContext;
  PopupState.lastProfileContextSent = profileContext;
  const linkedin_id = normalizeCompanyLinkedinId(profileContext);
  if (!linkedin_id) throw new Error("Missing linkedin_id.");
  if (!isCompanyProfileMode(profileContext)) {
    throw new Error("Active LinkedIn page is not a company profile.");
  }
  PopupLogger.debug("[LEF][company profile detected]", { linkedin_id });
  PopupLogger.debug("[LEF][company scrape result]", {
    company_name: profileContext.company_name || "",
    employee_number: profileContext.employee_number || "",
    sector: profileContext.sector || "",
    city: profileContext.city || "",
    it_members: profileContext.it_members || "",
  });

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

  PopupLogger.debug("[LEF][company LLM payload]", {
    linkedin_id,
    company_name: profileContext.company_name || "",
    employee_number: profileContext.employee_number || "",
    sector: profileContext.sector || "",
    city: profileContext.city || "",
    it_members: profileContext.it_members || "",
    excerpt_chars: String(profileContext.company_page_excerpt || "").length,
  });
  const rawExcerpt = String(profileContext.company_page_excerpt || "");
  const personLikeSignals = [
    /enviar mensagem/i,
    /sales navigator/i,
    /conex[õo]es em comum/i,
    /dados de contato/i,
    /gerente de ti/i,
  ];
  const personLikeHits = personLikeSignals.reduce(
    (sum, pattern) => (pattern.test(rawExcerpt) ? sum + 1 : sum),
    0,
  );
  const isPersonLikeExcerpt = personLikeHits >= 2;
  const companyPayload = {
    url: linkedin_id,
    is_company_profile: true,
    linkedin_id,
    company_name: profileContext.company_name || "",
    employee_number: profileContext.employee_number || "",
    sector: profileContext.sector || "",
    city: profileContext.city || "",
    it_members: profileContext.it_members || "",
    company_page_excerpt: isPersonLikeExcerpt ? "" : rawExcerpt,
  };
  PopupLogger.debug("[LEF][company ai] payload", companyPayload);
  PopupLogger.debug("[LEF][ai] payload sent", companyPayload);
  const enrichResult = await sendRuntimeMessage("ENRICH_COMPANY_PROFILE", {
    payload: {
      apiKey,
      model: (model || "gpt-4.1").trim(),
      profile: companyPayload,
    },
  });
  const enrichResp = enrichResult.data || {};
  if (!enrichResult.ok || !enrichResp?.ok) {
    throw new Error(getErrorMessage(enrichResult.error || enrichResp?.error));
  }
  PopupLogger.debug("[LEF][company AI extraction result]", enrichResp);
  return {
    linkedin_id,
    company_name: safeTrim(enrichResp.company_name || profileContext.company_name),
    employee_number: safeTrim(
      enrichResp.employee_number || profileContext.employee_number,
    ),
    sector: safeTrim(enrichResp.sector || profileContext.sector),
    city: safeTrim(enrichResp.city || profileContext.city),
    it_members: safeTrim(enrichResp.it_members || profileContext.it_members),
  };
}

async function extractProfileDetailsFromLlm(scrapedProfileContext = null) {
  const profileContext = scrapedProfileContext;
  if (!profileContext) {
    PopupLogger.debug("[LEF][llm] blocked because scrape missing", {
      page_type: "person",
    });
    throw new Error("Missing person scrape.");
  }
  PopupState.currentProfileContext = profileContext;
  PopupState.lastProfileContextSent = profileContext;
  PopupState.lastProfileContextEnriched = null;
  renderDetailHeader();

  const linkedin_url = getLinkedinUrlFromContext(PopupState.currentProfileContext);
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

  const personPayload = { ...profileContext };
  PopupLogger.debug("[LEF][ai] payload sent", personPayload);
  const enrichResult = await sendRuntimeMessage("ENRICH_PROFILE", {
    // prompt: buildProfileExtractionPrompt (Enrich/Register)
    payload: {
      apiKey,
      model: (model || "gpt-4.1").trim(),
      profile: personPayload,
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
    PopupState.currentProfileContext.company = llmCompany;
    if (detailCompanyEl) detailCompanyEl.value = llmCompany;
  }
  if (llmHeadline) {
    PopupState.currentProfileContext.headline = llmHeadline;
    if (detailHeadlineEl) detailHeadlineEl.value = llmHeadline;
  }
  const normalizedLlmLanguage = normalizeLanguageValue(llmLanguage);
  if (normalizedLlmLanguage) {
    await setLanguage(normalizedLlmLanguage);
  }

  const nameFromProfile = (getFullNameFromContext(PopupState.currentProfileContext) || "")
    .toString()
    .trim();
  const nameFromUi = (detailPersonNameEl?.value || "").trim();
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
  PopupLogger.error("[LEF] enrichProfileBtn element not found");
} else {
  enrichProfileBtnEl.addEventListener("click", async () => {
    PopupLogger.debug("[LEF][ai] button clicked", { ts: Date.now() });
    setFooterLlmStatus();
    try {
      await extractAndPersistProfileDetails();
      await refreshInvitationRowFromDb();
      renderDetailHeader();
    } catch (e) {
      PopupLogger.error("[LEF] enrichProfile failed", e);
      setFooterStatus(`${UI_TEXT.errorPrefix} ${getErrorMessage(e)}`);
    } finally {
      setFooterReady();
    }
  });
}

function bindProfileEditControls() {
  editProfileBtnEl?.addEventListener("click", () => {
    setProfileEditMode(true);
  });

  cancelProfileEditBtnEl?.addEventListener("click", () => {
    if (isProfileSaveInFlight) return;
    selectedCompanyForSave = null;
    setProfileEditMode(false);
  });

  saveProfileFieldsBtnEl?.addEventListener("click", async () => {
    if (isProfileSaveInFlight) return;

    const targetUrl = getLinkedinUrlFromContext(PopupState.currentProfileContext);
    if (!targetUrl) {
      setFooterStatus(isCompanyProfileMode() ? "Missing linkedin_id." : UI_TEXT.missingLinkedinUrl);
      return;
    }

    isProfileSaveInFlight = true;
    renderProfileEditControls();
    setFooterUpdatingStatus();

    try {
      if (isCompanyProfileMode()) {
        syncSelectedExistingCompanyFromInput();
        const linkedExistingCompanyId = safeTrim(
          selectedExistingCompanyForLink?.company_id,
        );
        const linkedExistingCompanyName = safeTrim(
          selectedExistingCompanyForLink?.company_name,
        );
        const isCreateFlow = !dbCompanyRow && !linkedExistingCompanyId;
        let payload = buildCompanyProfileSavePayload();
        if (isCreateFlow) {
          const pageInfo = detectLinkedInPageType(targetUrl);
          const companyContext = await getFreshScrapeForPage(pageInfo, {
            source: "company_create",
            force: true,
          });
          const enrichedPayload = await extractCompanyDetailsFromLlm(companyContext);
          payload = {
            ...payload,
            ...enrichedPayload,
            company_name: safeTrim(enrichedPayload.company_name || payload.company_name),
            employee_number: safeTrim(
              enrichedPayload.employee_number || payload.employee_number,
            ),
            sector: safeTrim(enrichedPayload.sector || payload.sector),
            city: safeTrim(enrichedPayload.city || payload.city),
            it_members: safeTrim(enrichedPayload.it_members || payload.it_members),
          };
        }
        const result = linkedExistingCompanyId
          ? await sendRuntimeMessage("DB_UPDATE_COMPANY_BY_ID", {
              payload: {
                ...payload,
                company_id: linkedExistingCompanyId,
                company_name: linkedExistingCompanyName || payload.company_name,
              },
            })
          : await sendRuntimeMessage("DB_UPSERT_COMPANY_PROFILE", {
              payload,
            });
        const resp = result.data || {};
        if (!result.ok || !resp?.ok) {
          throw new Error(getErrorMessage(result.error || resp?.error));
        }
        if (PopupState.currentProfileContext) {
          PopupState.currentProfileContext.company_name = payload.company_name;
          PopupState.currentProfileContext.employee_number = payload.employee_number;
          PopupState.currentProfileContext.sector = payload.sector;
          PopupState.currentProfileContext.city = payload.city;
          PopupState.currentProfileContext.it_members = payload.it_members;
        }
        isProfileEditMode = false;
        renderProfileEditControls();
        await refreshCompanyRowFromDb();
        setFooterStatus("Saved.");
        return;
      }

      const full_name = normalizeWhitespace(
        (detailPersonNameEl?.value || "").trim() === "-"
          ? ""
          : detailPersonNameEl?.value || "",
      );
      const company = normalizeWhitespace(
        (detailCompanyEl?.value || "").trim() === "-"
          ? ""
          : detailCompanyEl?.value || "",
      );
      const headline = sanitizeHeadlineJobTitle(
        (detailHeadlineEl?.value || "").trim() === "-"
          ? ""
          : detailHeadlineEl?.value || "",
      );
      const comments = safeTrim(
        (detailCommentsEl?.value || "").trim() === "-"
          ? ""
          : detailCommentsEl?.value || "",
      );
      syncSelectedCompanyFromDropdownInput();
      const selectedCompanyId = safeTrim(selectedCompanyForSave?.company_id);
      const selectedCompanyName = safeTrim(selectedCompanyForSave?.company_name);
      const companyToSave = selectedCompanyName || company;

      const result = await sendRuntimeMessage("DB_UPDATE_PROFILE_FIELDS", {
        payload: {
          linkedin_url: targetUrl,
          full_name,
          company: companyToSave,
          company_id: selectedCompanyId || undefined,
          headline,
          comments,
        },
      });
      const resp = result.data || {};

      if (!result.ok || !resp?.ok) {
        throw new Error(getErrorMessage(result.error || resp?.error));
      }

      if (PopupState.currentProfileContext) {
        PopupState.currentProfileContext.name = full_name;
        PopupState.currentProfileContext.full_name = full_name;
        PopupState.currentProfileContext.company = companyToSave;
        PopupState.currentProfileContext.headline = headline;
        PopupState.currentProfileContext.comments = comments;
      }
      if (PopupState.dbInvitationRow) {
        PopupState.dbInvitationRow.full_name = full_name;
        PopupState.dbInvitationRow.company = companyToSave;
        if (selectedCompanyId) PopupState.dbInvitationRow.company_id = selectedCompanyId;
        PopupState.dbInvitationRow.headline = headline;
        PopupState.dbInvitationRow.comments = comments;
      }
      if (selectedCompanyId) {
        PopupLogger.debug("[LEF][company dropdown] company saved", {
          company_id: selectedCompanyId,
          company_name: companyToSave,
        });
      }

      isProfileEditMode = false;
      renderProfileEditControls();
      await refreshInvitationRowFromDb({ preserveTabs: true });
      setFooterStatus("Saved.");
    } catch (e) {
      setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
    } finally {
      isProfileSaveInFlight = false;
      renderProfileEditControls();
    }
  });
}

bindProfileEditControls();

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
      PopupLogger.error("[sidepanel] open failed", e);
      setFooterStatus(UI_TEXT.sidePanelNotAvailable);
    } finally {
      setFooterReady();
    }
  });
}

bindOpenSidePanelClickHandler();

async function handleAcceptCompanySuggestion() {
  if (isAcceptingCompanySuggestion) return;
  if (!companySuggestion?.company_id || !companySuggestion?.company_name) return;
  const linkedin_url = getLinkedinUrlFromContext(PopupState.currentProfileContext);
  if (!linkedin_url) {
    setFooterStatus(UI_TEXT.missingLinkedinUrl);
    return;
  }

  isAcceptingCompanySuggestion = true;
  if (acceptCompanySuggestionBtnEl) acceptCompanySuggestionBtnEl.disabled = true;
  setFooterUpdatingStatus();
  try {
    const result = await sendRuntimeMessage("DB_CONFIRM_COMPANY_LINK", {
      payload: {
        linkedin_url,
        company_id: companySuggestion.company_id,
        company_name: companySuggestion.company_name,
      },
    });
    const resp = result.data || {};
    if (!result.ok || !resp?.ok) {
      throw new Error(getErrorMessage(result.error || resp?.error));
    }
    PopupLogger.debug("[LEF][company suggestion accepted]", {
      linkedin_url,
      company_id: companySuggestion.company_id,
      company_name: companySuggestion.company_name,
    });
    await refreshInvitationRowFromDb({ preserveTabs: true });
    setFooterStatus("Saved.");
  } catch (e) {
    setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
  } finally {
    isAcceptingCompanySuggestion = false;
    if (acceptCompanySuggestionBtnEl) acceptCompanySuggestionBtnEl.disabled = false;
    if (companyQuickLinkBtn) companyQuickLinkBtn.disabled = false;
  }
}

acceptCompanySuggestionBtnEl?.addEventListener("click", handleAcceptCompanySuggestion);

companyLinkSearchInputEl?.addEventListener("input", () => {
  selectedCompanyForSave = null;
  if (companyLinkSearchDebounceTimer) {
    clearTimeout(companyLinkSearchDebounceTimer);
  }
  companyLinkSearchDebounceTimer = setTimeout(() => {
    searchCompaniesForEditDropdown(companyLinkSearchInputEl.value || "").catch(
      () => null,
    );
  }, 250);
});

companyLinkSearchInputEl?.addEventListener("change", () => {
  syncSelectedCompanyFromDropdownInput();
});

detailPersonNameEl?.addEventListener("click", async (event) => {
  if (isProfileEditMode) return;
  const targetUrl = getDetailNameLinkedinUrl();
  if (!isLinkedInProfileLikeUrl(targetUrl)) return;
  await openLinkedIn(targetUrl, { newTab: shouldOpenInNewTab(event) });
});

detailPersonNameEl?.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (isProfileEditMode) return;
  const targetUrl = getDetailNameLinkedinUrl();
  if (!isLinkedInProfileLikeUrl(targetUrl)) return;
  event.preventDefault();
  await openLinkedIn(targetUrl, { newTab: shouldOpenInNewTab(event) });
});

companyLinkedNameEl?.addEventListener("click", async (event) => {
  if (isProfileEditMode || isCompanyProfileMode()) return;
  const companyUrl = safeTrim(companyLinkedNameEl.dataset.companyUrl || "");
  if (!companyUrl) return;
  await openLinkedIn(companyUrl, { newTab: shouldOpenInNewTab(event) });
});

companyLinkedNameEl?.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (isProfileEditMode || isCompanyProfileMode()) return;
  const companyUrl = safeTrim(companyLinkedNameEl.dataset.companyUrl || "");
  if (!companyUrl) return;
  event.preventDefault();
  await openLinkedIn(companyUrl, { newTab: shouldOpenInNewTab(event) });
});

companyExistingLinkInputEl?.addEventListener("input", () => {
  selectedExistingCompanyForLink = null;
  updateExistingCompanyLinkUi();
  if (companyExistingLinkDebounceTimer) {
    clearTimeout(companyExistingLinkDebounceTimer);
  }
  companyExistingLinkDebounceTimer = setTimeout(() => {
    searchExistingCompaniesForCompanyPage(
      companyExistingLinkInputEl.value || "",
    ).catch(() => null);
  }, 250);
});

companyExistingLinkInputEl?.addEventListener("change", () => {
  syncSelectedExistingCompanyFromInput();
});

companyExistingLinkButtonEl?.addEventListener("click", async () => {
  try {
    if (companyExistingLinkButtonEl) companyExistingLinkButtonEl.disabled = true;
    await linkSelectedExistingCompany();
  } catch (e) {
    setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
  } finally {
    updateExistingCompanyLinkUi();
    setFooterReady();
  }
});

companyQuickLinkBtn?.addEventListener("click", async () => {
  if (isProfileEditMode || isCompanyProfileMode()) return;
  PopupLogger.debug("[LEF][quick-link][click]", {
    suggestionCompanyId: safeTrim(companySuggestion?.company_id),
    suggestionCompanyName: safeTrim(companySuggestion?.company_name),
  });
  if (companyQuickLinkBtn) companyQuickLinkBtn.disabled = true;
  await handleAcceptCompanySuggestion();
});

companyUrlMismatchBannerEl?.addEventListener("click", async (event) => {
  const targetUrl = safeTrim(selectedCompanyFromListLinkedinUrl);
  if (!targetUrl) return;
  await openLinkedIn(targetUrl, { newTab: shouldOpenInNewTab(event) });
});

companyPeopleListEl?.addEventListener("click", async (event) => {
  const target =
    event.target instanceof Element
      ? event.target.closest(".company-person-card")
      : null;
  if (!target) return;
  const linkedinUrl = safeTrim(target.dataset.linkedinUrl || "");
  if (!linkedinUrl) return;
  await openLinkedIn(linkedinUrl, { newTab: shouldOpenInNewTab(event) });
});

companyPeopleListEl?.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target =
    event.target instanceof Element
      ? event.target.closest(".company-person-card")
      : null;
  if (!target) return;
  const linkedinUrl = safeTrim(target.dataset.linkedinUrl || "");
  if (!linkedinUrl) return;
  event.preventDefault();
  await openLinkedIn(linkedinUrl, { newTab: shouldOpenInNewTab(event) });
});

detailCommentsEl?.addEventListener("input", () => {
  autoResizeCommentsField();
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
      const activeTab = await getActiveTabForProfileCheck().catch(() => null);
      const pageInfo = detectLinkedInPageType(activeTab?.url || "");
      profileForGeneration = await getFreshScrapeForPage(pageInfo, {
        source: "free_prompt",
      });
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
      include_profile: includeProfile,
      include_strategy: includeStrategy,
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
setCopyIconDefaultState(copyFreePromptBtnEl);
updateFreePromptCopyButtonState();


