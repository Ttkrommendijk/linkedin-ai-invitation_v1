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
  throw new Error(
    "Popup shared constants must be loaded before popup modules.",
  );
}
const STORAGE_KEY_MESSAGE_LANGUAGE = POPUP_STORAGE_KEYS.messageLanguage;
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
if (
  !PopupInvitationController ||
  typeof PopupInvitationController !== "object"
) {
  throw new Error("PopupInvitationController must be loaded before popup.js.");
}
const PopupOverviewController = globalThis.PopupOverviewController;
if (!PopupOverviewController || typeof PopupOverviewController !== "object") {
  throw new Error("PopupOverviewController must be loaded before popup.js.");
}
const PopupCampaignController = globalThis.PopupCampaignController;
if (!PopupCampaignController || typeof PopupCampaignController !== "object") {
  throw new Error("PopupCampaignController must be loaded before popup.js.");
}
const normalizeCampaignValue = PopupCampaignController.normalizeCampaignValue;
const pickCampaignTextColor = PopupCampaignController.pickCampaignTextColor;
const truncateCampaignLabel = PopupCampaignController.truncateCampaignLabel;
const buildCampaignOptionElement =
  PopupCampaignController.buildCampaignOptionElement;
const hasCampaignOption = PopupCampaignController.hasCampaignOption;
const appendCampaignOption = PopupCampaignController.appendCampaignOption;
const updateRenameCampaignButtonState =
  PopupCampaignController.updateRenameCampaignButtonState;
const updateCompanyRenameCampaignButtonState =
  PopupCampaignController.updateCompanyRenameCampaignButtonState;
const updateOverviewCampaignFilterTitle =
  PopupCampaignController.updateOverviewCampaignFilterTitle;
const updateDetailCampaignSelectTitle =
  PopupCampaignController.updateDetailCampaignSelectTitle;
const setCampaignSelectValue = PopupCampaignController.setCampaignSelectValue;
const setNewCampaignRowVisible =
  PopupCampaignController.setNewCampaignRowVisible;
const setRenameCampaignRowVisible =
  PopupCampaignController.setRenameCampaignRowVisible;
const setCompanyNewCampaignRowVisible =
  PopupCampaignController.setCompanyNewCampaignRowVisible;
const setCompanyRenameCampaignRowVisible =
  PopupCampaignController.setCompanyRenameCampaignRowVisible;
const saveLastActiveCampaign = PopupCampaignController.saveLastActiveCampaign;
const loadLastActiveCampaign = PopupCampaignController.loadLastActiveCampaign;
const rebuildCampaignSelectOptions =
  PopupCampaignController.rebuildCampaignSelectOptions;
const rebuildCompanyCampaignSelectOptions =
  PopupCampaignController.rebuildCompanyCampaignSelectOptions;
const rebuildOverviewCampaignFilterOptions =
  PopupCampaignController.rebuildOverviewCampaignFilterOptions;
const rebuildCompanyCampaignFilterOptions =
  PopupCampaignController.rebuildCompanyCampaignFilterOptions;
const renderLinkedCampaignChips =
  PopupCampaignController.renderLinkedCampaignChips;
const renderCompanyLinkedCampaignChips =
  PopupCampaignController.renderCompanyLinkedCampaignChips;
const PopupCompanyController = globalThis.PopupCompanyController;
if (!PopupCompanyController || typeof PopupCompanyController !== "object") {
  throw new Error("PopupCompanyController must be loaded before popup.js.");
}
const setCompanyUrlMismatchBannerVisible =
  PopupCompanyController.setCompanyUrlMismatchBannerVisible;
const refreshCompanyUrlMismatchBanner =
  PopupCompanyController.refreshCompanyUrlMismatchBanner;
const coalesceDbThenScraped = PopupCompanyController.coalesceDbThenScraped;
const autoResizeCommentsField = PopupCompanyController.autoResizeCommentsField;
const updateExistingCompanyLinkUi =
  PopupCompanyController.updateExistingCompanyLinkUi;
const isActiveCompanyOptionRow =
  PopupCompanyController.isActiveCompanyOptionRow;
const setCompanyExistingLinkOptions =
  PopupCompanyController.setCompanyExistingLinkOptions;
const setSelectedExistingCompanyForLink =
  PopupCompanyController.setSelectedExistingCompanyForLink;
const syncSelectedExistingCompanyFromInput =
  PopupCompanyController.syncSelectedExistingCompanyFromInput;
const setCompanyLinkSearchOptions =
  PopupCompanyController.setCompanyLinkSearchOptions;
const setCompanyDropdownSelected =
  PopupCompanyController.setCompanyDropdownSelected;
const syncSelectedCompanyFromDropdownInput =
  PopupCompanyController.syncSelectedCompanyFromDropdownInput;
const hideCompanySuggestionUi = PopupCompanyController.hideCompanySuggestionUi;
const renderLinkedCompanyName = PopupCompanyController.renderLinkedCompanyName;
const renderCompanySuggestionFound =
  PopupCompanyController.renderCompanySuggestionFound;
const renderCompanySuggestionNotFound =
  PopupCompanyController.renderCompanySuggestionNotFound;
const getCompanyNameForPeopleList =
  PopupCompanyController.getCompanyNameForPeopleList;
const renderProfileEditControls =
  PopupCompanyController.renderProfileEditControls;
const applyProfileModeUi = PopupCompanyController.applyProfileModeUi;
const setProfileEditMode = PopupCompanyController.setProfileEditMode;
const renderDetailHeader = PopupCompanyController.renderDetailHeader;
const renderCompanyPeopleList = PopupCompanyController.renderCompanyPeopleList;
const refreshCompanyPeopleList =
  PopupCompanyController.refreshCompanyPeopleList;
const searchExistingCompaniesForCompanyPage =
  PopupCompanyController.searchExistingCompaniesForCompanyPage;
const prepareExistingCompanyLinkDropdown =
  PopupCompanyController.prepareExistingCompanyLinkDropdown;
const searchCompaniesForEditDropdown =
  PopupCompanyController.searchCompaniesForEditDropdown;
const prepareCompanyDropdownForEdit =
  PopupCompanyController.prepareCompanyDropdownForEdit;
const refreshCompanySuggestionUiForCurrentInvitation =
  PopupCompanyController.refreshCompanySuggestionUiForCurrentInvitation;
const PopupAuthController = globalThis.PopupAuthController;
if (!PopupAuthController || typeof PopupAuthController !== "object") {
  throw new Error("PopupAuthController must be loaded before popup.js.");
}
const PopupFreePromptController = globalThis.PopupFreePromptController;
if (
  !PopupFreePromptController ||
  typeof PopupFreePromptController !== "object"
) {
  throw new Error("PopupFreePromptController must be loaded before popup.js.");
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
let companySuggestionLookupSeq = 0;
let isAcceptingCompanySuggestion = false;
let companyLinkSearchDebounceTimer = null;
let dbCompanyRow = null;
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
let readyResetTimer = null;
let overviewContextItems = [];
let messageCountLegacyFixAttemptedUrl = "";
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
    get: () => PopupCompanyController.getCompanyPeopleRows(),
    set: (value) => {
      PopupCompanyController.setCompanyPeopleRows(value);
    },
  },
  selectedExistingCompanyForLink: {
    configurable: true,
    get: () => PopupCompanyController.getSelectedExistingCompanyForLink(),
    set: (value) => {
      PopupCompanyController.setSelectedExistingCompanyForLinkState(value);
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
    get: () => PopupCampaignController.getLinkedPersonCampaignRows(),
    set: (value) => {
      PopupCampaignController.setLinkedPersonCampaignRows(value);
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
const applyLifecycleUiState = PopupLifecycleController.applyLifecycleUiState;
