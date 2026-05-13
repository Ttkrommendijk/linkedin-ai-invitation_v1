
function canonicalizeLinkedInUrl(rawUrl) {
  if (typeof LEF_UTILS.canonicalizeLinkedInUrl === "function") {
    return LEF_UTILS.canonicalizeLinkedInUrl(rawUrl);
  }
  const input = String(rawUrl || "").trim();
  if (!input) return "";
  try {
    const parsed = new URL(input);
    const parts = (parsed.pathname || "").split("/").filter(Boolean);
    if (parts.length >= 2 && /^(company|school)$/i.test(parts[0])) {
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
  if (
    /^https:\/\/www\.linkedin\.com\/(company|school)\/[^/?#]+/i.test(
      linkedin_id,
    )
  ) {
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
  const companyRule =
    /^https:\/\/www\.linkedin\.com\/(company|school)\/[^/?#]+/i.test(
      normalizedUrl,
    );
  const fallbackMatch = isLinkedInProfileLikeUrl(normalizedUrl);
  if (inRule) return { isProfileOpen: true, matchedRule: "/in/" };
  if (companyRule)
    return { isProfileOpen: true, matchedRule: "/company|school/" };
  return {
    isProfileOpen: Boolean(fallbackMatch),
    matchedRule: fallbackMatch ? "fallback" : "none",
  };
}

const getActiveTabForProfileCheck =
  PopupProfileController.getActiveTabForProfileCheck;
const logEmptyStateDebugOnce = PopupProfileController.logEmptyStateDebugOnce;
const findNoProfileEl = PopupProfileController.findNoProfileEl;
const setNoProfileStateVisible =
  PopupProfileController.setNoProfileStateVisible;
const getNoProfileDomDebugInfo =
  PopupProfileController.getNoProfileDomDebugInfo;
const ensureNoProfileStateUi = PopupProfileController.ensureNoProfileStateUi;

const getFullNameFromContext =
  typeof POPUP_UTILS.getFullNameFromContext === "function"
    ? POPUP_UTILS.getFullNameFromContext
    : (profileContext) =>
        profileContext?.name || profileContext?.full_name || null;
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

const clearFreePromptPreview = PopupFreePromptController.clearFreePromptPreview;

const applyProfileExtractionFailureState =
  PopupProfileController.applyProfileExtractionFailureState;
const refreshAll = PopupProfileController.refreshAll;
const loadProfileContextOnOpen =
  PopupProfileController.loadProfileContextOnOpen;

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

const getFreePromptLanguage = PopupFreePromptController.getFreePromptLanguage;
const setFreePromptLanguage = PopupFreePromptController.setFreePromptLanguage;

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
ta.classList.add("form-textarea");
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
const updateFollowupCopyIconVisibility =
  PopupMessageController.updateFollowupCopyIconVisibility || (() => {});
const updateFreePromptCopyButtonState =
  PopupMessageController.updateFreePromptCopyButtonState || (() => {});

let popupInitErrorLogged = false;
function logPopupInitError(error) {
  if (popupInitErrorLogged) return;
  popupInitErrorLogged = true;
  PopupLogger.error(`[LEF][init] popup init failed: ${getErrorMessage(error)}`);
  if (error && typeof error === "object" && typeof error.stack === "string") {
    PopupLogger.error(error.stack);
  }
}

function readCompanyProfileSaveField(fieldEl, fallback = "") {
  const rawValue = fieldEl?.value || "";
  const value = rawValue.trim() === "-" ? "" : rawValue;
  return normalizeWhitespace(value || fallback || "");
}

function buildCompanyProfileSavePayload() {
  const scraped = PopupState.currentProfileContext || {};
  const row = dbCompanyRow || {};

  return {
    linkedin_id: normalizeCompanyLinkedinId(scraped),
    company_name: readCompanyProfileSaveField(
      detailPersonNameEl,
      row.company_name ||
        scraped.company_name ||
        scraped.name ||
        scraped.full_name,
    ),
    employee_number: readCompanyProfileSaveField(
      detailEmployeeNumberEl,
      row.employee_number || scraped.employee_number,
    ),
    sector: readCompanyProfileSaveField(
      detailHeadlineEl,
      row.sector || scraped.sector,
    ),
    city: readCompanyProfileSaveField(detailCityEl, row.city || scraped.city),
    it_members: readCompanyProfileSaveField(
      detailItMembersEl,
      row.it_members || scraped.it_members,
    ),
  };
}

function runPopupInit() {
  globalThis.canonicalizeLinkedInUrl = canonicalizeLinkedInUrl;
  globalThis.detectLinkedInPageType = detectLinkedInPageType;
  globalThis.isCompanyProfileMode = isCompanyProfileMode;
  globalThis.getScrapeUrl = getScrapeUrl;
  globalThis.getProfileMatchForUrl = getProfileMatchForUrl;
  globalThis.getActiveTabForProfileCheck = getActiveTabForProfileCheck;
  globalThis.getDetailNameLinkedinUrl = getDetailNameLinkedinUrl;
  globalThis.isLinkedInProfileLikeUrl = isLinkedInProfileLikeUrl;
  globalThis.sanitizeCompanySearchTerm = sanitizeCompanySearchTerm;
  globalThis.debug = debug;
  globalThis.timingLog = timingLog;
  globalThis.clearFreePromptPreview = clearFreePromptPreview;
  globalThis.updatePhaseButtons = updatePhaseButtons;
  globalThis.refreshCompanyRowFromDb = refreshCompanyRowFromDb;
  globalThis.linkSelectedExistingCompany = linkSelectedExistingCompany;
  globalThis.searchCompaniesForEditDropdown = searchCompaniesForEditDropdown;
  globalThis.bindCompanyEvents = bindCompanyEvents;
  globalThis.setCompanyUrlMismatchBannerVisible =
    setCompanyUrlMismatchBannerVisible;
  globalThis.refreshCompanyUrlMismatchBanner = refreshCompanyUrlMismatchBanner;
  globalThis.coalesceDbThenScraped = coalesceDbThenScraped;
  globalThis.autoResizeCommentsField = autoResizeCommentsField;
  globalThis.renderProfileEditControls = renderProfileEditControls;
  globalThis.applyProfileModeUi = applyProfileModeUi;
  globalThis.updateExistingCompanyLinkUi = updateExistingCompanyLinkUi;
  globalThis.isActiveCompanyOptionRow = isActiveCompanyOptionRow;
  globalThis.setCompanyExistingLinkOptions = setCompanyExistingLinkOptions;
  globalThis.setSelectedExistingCompanyForLink =
    setSelectedExistingCompanyForLink;
  globalThis.syncSelectedExistingCompanyFromInput =
    syncSelectedExistingCompanyFromInput;
  globalThis.searchExistingCompaniesForCompanyPage =
    searchExistingCompaniesForCompanyPage;
  globalThis.prepareExistingCompanyLinkDropdown =
    prepareExistingCompanyLinkDropdown;
  globalThis.setProfileEditMode = setProfileEditMode;
  globalThis.renderDetailHeader = renderDetailHeader;
  globalThis.getCompanyNameForPeopleList = getCompanyNameForPeopleList;
  globalThis.renderCompanyPeopleList = renderCompanyPeopleList;
  globalThis.refreshCompanyPeopleList = refreshCompanyPeopleList;
  globalThis.buildCompanyProfileSavePayload = buildCompanyProfileSavePayload;
  globalThis.hideCompanySuggestionUi = hideCompanySuggestionUi;
  globalThis.renderLinkedCompanyName = renderLinkedCompanyName;
  globalThis.renderCompanySuggestionFound = renderCompanySuggestionFound;
  globalThis.renderCompanySuggestionNotFound = renderCompanySuggestionNotFound;
  globalThis.refreshCompanySuggestionUiForCurrentInvitation =
    refreshCompanySuggestionUiForCurrentInvitation;
  globalThis.setCompanyLinkSearchOptions = setCompanyLinkSearchOptions;
  globalThis.setCompanyDropdownSelected = setCompanyDropdownSelected;
  globalThis.prepareCompanyDropdownForEdit = prepareCompanyDropdownForEdit;
  globalThis.syncSelectedCompanyFromDropdownInput =
    syncSelectedCompanyFromDropdownInput;
  globalThis.loadProfileContextOnOpen = loadProfileContextOnOpen;
  globalThis.sendRuntimeMessage = sendRuntimeMessage;
  globalThis.getErrorMessage = getErrorMessage;
  globalThis.getMessageCountValue = getMessageCountValue;
  globalThis.isMessageSentOrBeyondStatus = isMessageSentOrBeyondStatus;
  globalThis.getLanguage = getLanguage;
  globalThis.setLanguage = setLanguage;
  globalThis.normalizeCompanyLinkedinId = normalizeCompanyLinkedinId;
  globalThis.setFooterUpdatingStatus = setFooterUpdatingStatus;
  globalThis.setFooterStatus = setFooterStatus;
  globalThis.setFooterReady = setFooterReady;
  globalThis.getCompanyPeopleRows = PopupCompanyController.getCompanyPeopleRows;
  globalThis.applyLifecycleUiState = applyLifecycleUiState;
  globalThis.renderMessageTab = renderMessageTab;
  globalThis.setCopyIconDefaultState = setCopyIconDefaultState;
  globalThis.setCopyIconSuccessState = setCopyIconSuccessState;
  globalThis.updateFollowupCopyIconVisibility =
    updateFollowupCopyIconVisibility;
  // Temporary interop for incremental campaign extraction.
  globalThis.applyCampaignSelectionFromProfile =
    PopupCampaignController.applyCampaignSelectionFromProfile;
  globalThis.setCampaignSelectValue = setCampaignSelectValue;
  globalThis.refreshPersonCampaignLinks =
    PopupCampaignController.refreshPersonCampaignLinks;
  globalThis.renderLinkedCampaignChips = renderLinkedCampaignChips;
  globalThis.setOverviewCampaignFilterValue = (value) => {
    overviewFilters.campaign = value == null ? "" : String(value);
  };
  globalThis.setCompanyOverviewCampaignFilterValue = (value) => {
    companyOverviewFilters.campaign = value == null ? "" : String(value);
  };
  // Temporary interop for incremental overview extraction.
  globalThis.wireOverviewEvents = wireOverviewEvents;
  globalThis.fetchOverviewPage = fetchOverviewPage;
  globalThis.fetchCompaniesOverviewPage = fetchCompaniesOverviewPage;
  globalThis.setActiveListTab = setActiveListTab;
  globalThis.restoreOverviewFiltersFromStorage =
    restoreOverviewFiltersFromStorage;
  globalThis.loadOverviewColumnPrefs = loadOverviewColumnPrefs;
  globalThis.scheduleOverviewAutoSize = scheduleOverviewAutoSize;
  globalThis.scheduleCompanyOverviewAutoSize = scheduleCompanyOverviewAutoSize;
  globalThis.renderOverviewSortIndicators = renderOverviewSortIndicators;
  globalThis.renderOverviewPagination = renderOverviewPagination;
  globalThis.renderCompanyOverviewSortIndicators =
    renderCompanyOverviewSortIndicators;
  globalThis.renderCompanyOverviewPagination = renderCompanyOverviewPagination;
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
  configGeneralTabBtnEl?.addEventListener("click", () =>
    setConfigInnerTab("general"),
  );
  configSupabaseTabBtnEl?.addEventListener("click", () =>
    setConfigInnerTab("supabase"),
  );

  bindConfigEvents();
  loadSettings().catch((_e) => {});
  const supabaseAuthUiPromise =
    PopupAuthController.refreshSupabaseAuthUi().catch(() => null);
  PopupAuthController.setAuthInnerTab("signup");
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
  PopupAuthController.bindAuthEvents();
  setCopyButtonEnabled(false);
  updateInviteCopyIconVisibility();
  updateFollowupCopyIconVisibility();
  bindPromptManagementEvents();
  PopupFreePromptController.bindFreePromptEvents();
  PopupCompanyController.bindCompanyEvents();
  bindMessagesWorkflowEvents();
  bindStepperClickHandlers();
  updateMessageTabControls();
  if (OVERVIEW_ENABLED) {
    PopupOverviewController.wireOverviewEvents();
    PopupOverviewController.loadOverviewColumnPrefs()
      .then(() => {
        PopupOverviewController.scheduleOverviewAutoSize();
        PopupOverviewController.scheduleCompanyOverviewAutoSize();
      })
      .catch(() => {
        PopupOverviewController.scheduleOverviewAutoSize();
        PopupOverviewController.scheduleCompanyOverviewAutoSize();
      });
    if (document.documentElement.dataset.overviewResizeBound !== "1") {
      document.documentElement.dataset.overviewResizeBound = "1";
      window.addEventListener("resize", () => {
        PopupOverviewController.scheduleOverviewAutoSize();
        PopupOverviewController.scheduleCompanyOverviewAutoSize();
      });
    }
    overviewPageSize = Number(overviewPageSizeEl?.value || 25);
    personGridState.pageSize = overviewPageSize;
    PopupOverviewController.renderOverviewSortIndicators();
    PopupOverviewController.renderOverviewPagination();
    companyOverviewPageSize = Number(companyOverviewPageSizeEl?.value || 25);
    companyGridState.pageSize = companyOverviewPageSize;
    PopupOverviewController.renderCompanyOverviewSortIndicators();
    PopupOverviewController.renderCompanyOverviewPagination();
    PopupOverviewController.setActiveListTab("persons");
  }
  setFooterReady();
  setCommunicationStatus("Ready");
  applyLifecycleUiState(PopupState.dbInvitationRow);
  renderMessageTab(PopupState.outreachMessageStatus);
  setDetailInnerTab("free_prompt");
  if (globalThis.PopupNotesController?.init) {
    globalThis.PopupNotesController.init();
  }
  if (globalThis.PopupDealsController?.init) {
    globalThis.PopupDealsController.init();
  }
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
  PopupCampaignController.loadCampaignOptions({ keepSelected: true })
    .then(() => PopupCampaignController.applyCampaignSelectionFromProfile())
    .catch((_e) => {})
    .finally(() => {
      PopupOverviewController.restoreOverviewFiltersFromStorage()
        .then(() => {
          if (tabOverview?.classList.contains("active")) {
            overviewPage = 1;
            personGridState.page = overviewPage;
            if (activeListTab === "companies") {
              PopupOverviewController.fetchCompaniesOverviewPage();
            } else {
              PopupOverviewController.fetchOverviewPage();
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

  PopupCampaignController.bindCampaignEvents();
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
