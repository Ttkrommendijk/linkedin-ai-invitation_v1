// Owns company/person detail edit/link orchestration entrypoints.
// Company/detail state and low-risk helpers live here while async flows continue to migrate.
(function initPopupCompanyController(globalObj) {
  const PopupDom = globalObj.PopupDom;
  if (!PopupDom || typeof PopupDom !== "object") {
    throw new Error("PopupDom must be loaded before popup-company-controller.js.");
  }
  const PopupUtils = globalObj.PopupUtils;
  if (!PopupUtils || typeof PopupUtils !== "object") {
    throw new Error("PopupUtils must be loaded before popup-company-controller.js.");
  }
  const PopupState = globalObj.PopupState;
  if (!PopupState || typeof PopupState !== "object") {
    throw new Error("PopupState must be loaded before popup-company-controller.js.");
  }
  const PopupLogger = globalObj.PopupLogger;
  if (!PopupLogger || typeof PopupLogger !== "object") {
    throw new Error("PopupLogger must be loaded before popup-company-controller.js.");
  }

  const {
    acceptCompanySuggestionBtnEl,
    companyExistingLinkButtonEl,
    companyExistingLinkInputEl,
    companyExistingLinkOptionsEl,
    companyExistingLinkSectionEl,
    companyExistingLinkStatusEl,
    companyLinkSearchInputEl,
    companyLinkSearchOptionsEl,
    companyLinkedEmployeeNumberEl,
    companyLinkedIndicatorEl,
    companyLinkedNameEl,
    companyLinkedRowEl,
    companyQuickLinkBtn,
    companySuggestionWarningEl,
    companyUrlMismatchBannerEl,
    detailCompanyEl,
    detailCommentsEl,
  } = PopupDom;
  const safeTrim =
    typeof PopupUtils.safeTrim === "function"
      ? PopupUtils.safeTrim
      : (value) => (value == null ? "" : String(value).trim());
  const state = {
    selectedExistingCompanyForLink: null,
    selectedCompanyForEditDropdown: null,
    companySuggestionState: null,
    companyPeopleRows: [],
    companyExistingLinkResults: [],
    companyLinkSearchResults: [],
  };

  function requireFn(name) {
    const fn = globalObj[name];
    if (typeof fn !== "function") {
      throw new Error(
        `popup-company-controller.js requires global function ${name} to be defined.`,
      );
    }
    return fn;
  }

  function getSelectedExistingCompanyForLink() {
    return state.selectedExistingCompanyForLink;
  }

  function setSelectedExistingCompanyForLinkState(value) {
    state.selectedExistingCompanyForLink = value || null;
  }

  function getSelectedCompanyForEditDropdown() {
    return state.selectedCompanyForEditDropdown;
  }

  function setSelectedCompanyForEditDropdown(value) {
    state.selectedCompanyForEditDropdown = value || null;
  }

  function getCompanySuggestionState() {
    return state.companySuggestionState;
  }

  function setCompanySuggestionState(value) {
    state.companySuggestionState = value || null;
  }

  function getCompanyPeopleRows() {
    return state.companyPeopleRows;
  }

  function setCompanyPeopleRows(value) {
    state.companyPeopleRows = Array.isArray(value) ? value : [];
  }

  function normalizeLinkedinCompanyCompareUrl(value) {
    const canonicalizeLinkedInUrl = requireFn("canonicalizeLinkedInUrl");
    const canonical = canonicalizeLinkedInUrl(value || "");
    return String(canonical || "").replace(/\/+$/, "").toLowerCase();
  }

  function bindCompanyEvents() {
    return requireFn("bindCompanyEvents")();
  }

  function setCompanyUrlMismatchBannerVisible(visible) {
    if (!companyUrlMismatchBannerEl) return;
    companyUrlMismatchBannerEl.hidden = !visible;
  }

  async function refreshCompanyUrlMismatchBanner() {
    const selectedCompanyFromListLinkedinUrl =
      globalObj.selectedCompanyFromListLinkedinUrl || "";
    const selectedUrl = normalizeLinkedinCompanyCompareUrl(
      selectedCompanyFromListLinkedinUrl,
    );
    if (!selectedUrl) {
      setCompanyUrlMismatchBannerVisible(false);
      return;
    }
    const getActiveTabForProfileCheck = requireFn("getActiveTabForProfileCheck");
    const canonicalizeLinkedInUrl = requireFn("canonicalizeLinkedInUrl");
    const detectLinkedInPageType = requireFn("detectLinkedInPageType");
    const activeTab = await getActiveTabForProfileCheck().catch(() => null);
    const activeUrl = canonicalizeLinkedInUrl(activeTab?.url || "");
    const activePage = detectLinkedInPageType(activeUrl);
    if (activePage.page_type !== "company") {
      setCompanyUrlMismatchBannerVisible(false);
      return;
    }
    const activeCompanyUrl = normalizeLinkedinCompanyCompareUrl(
      activePage.linkedin_id,
    );
    setCompanyUrlMismatchBannerVisible(
      Boolean(activeCompanyUrl && activeCompanyUrl !== selectedUrl),
    );
  }

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
    return requireFn("renderProfileEditControls")();
  }

  function applyProfileModeUi() {
    return requireFn("applyProfileModeUi")();
  }

  function updateExistingCompanyLinkUi(statusText) {
    const isCompanyProfileMode = requireFn("isCompanyProfileMode");
    const dbCompanyRow = globalObj.dbCompanyRow || null;
    const hasSelection = Boolean(
      safeTrim(state.selectedExistingCompanyForLink?.company_id),
    );
    if (companyExistingLinkStatusEl) {
      companyExistingLinkStatusEl.textContent =
        statusText || "Company URL not registered";
      companyExistingLinkStatusEl.hidden =
        !isCompanyProfileMode() || Boolean(dbCompanyRow);
    }
    if (companyExistingLinkButtonEl) {
      companyExistingLinkButtonEl.disabled = !hasSelection;
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
    state.companyExistingLinkResults = (Array.isArray(rows) ? rows : []).filter(
      isActiveCompanyOptionRow,
    );
    if (!companyExistingLinkOptionsEl) return;
    companyExistingLinkOptionsEl.innerHTML = "";
    for (const row of state.companyExistingLinkResults) {
      const name = safeTrim(row?.company_name);
      const id = safeTrim(row?.company_id);
      if (!name || !id) continue;
      const optionEl = document.createElement("option");
      optionEl.value = name;
      optionEl.dataset.companyId = id;
      companyExistingLinkOptionsEl.appendChild(optionEl);
    }
  }

  function setSelectedExistingCompanyForLink(row) {
    const id = safeTrim(row?.company_id);
    const name = safeTrim(row?.company_name);
    state.selectedExistingCompanyForLink =
      id && name ? { ...row, company_id: id, company_name: name } : null;
    if (companyExistingLinkInputEl) companyExistingLinkInputEl.value = name;
    updateExistingCompanyLinkUi();
  }

  function syncSelectedExistingCompanyFromInput() {
    const typed = safeTrim(companyExistingLinkInputEl?.value);
    if (!typed) {
      state.selectedExistingCompanyForLink = null;
      updateExistingCompanyLinkUi();
      return;
    }
    const matched = state.companyExistingLinkResults.find(
      (row) => safeTrim(row?.company_name).toLowerCase() === typed.toLowerCase(),
    );
    state.selectedExistingCompanyForLink = matched?.company_id ? matched : null;
    updateExistingCompanyLinkUi();
  }

  function searchExistingCompaniesForCompanyPage(term) {
    return requireFn("searchExistingCompaniesForCompanyPage")(term);
  }

  function prepareExistingCompanyLinkDropdown(scrapedCompanyName) {
    return requireFn("prepareExistingCompanyLinkDropdown")(scrapedCompanyName);
  }

  function setProfileEditMode(nextMode) {
    return requireFn("setProfileEditMode")(nextMode);
  }

  function renderDetailHeader(options) {
    return requireFn("renderDetailHeader")(options || {});
  }

  function getCompanyNameForPeopleList() {
    const dbCompanyRow = globalObj.dbCompanyRow || null;
    return safeTrim(
      dbCompanyRow?.company_name ||
        PopupState.currentProfileContext?.company_name ||
        PopupState.currentProfileContext?.name ||
        PopupState.currentProfileContext?.full_name ||
        "",
    );
  }

  function renderCompanyPeopleList() {
    return requireFn("renderCompanyPeopleList")();
  }

  function buildCompanyProfileSavePayload() {
    return requireFn("buildCompanyProfileSavePayload")();
  }

  function hideCompanySuggestionUi() {
    state.companySuggestionState = null;
    state.selectedCompanyForEditDropdown = null;
    state.companyLinkSearchResults = [];
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
    const isProfileEditMode = Boolean(globalObj.isProfileEditMode);
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
    state.companySuggestionState = companyRow || null;
    const isProfileEditMode = Boolean(globalObj.isProfileEditMode);
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
    state.companySuggestionState = null;
    if (companyLinkedRowEl) companyLinkedRowEl.hidden = true;
    if (companySuggestionWarningEl) companySuggestionWarningEl.hidden = false;
    if (acceptCompanySuggestionBtnEl) acceptCompanySuggestionBtnEl.hidden = true;
    if (companyQuickLinkBtn) companyQuickLinkBtn.hidden = true;
  }

  function refreshCompanySuggestionUiForCurrentInvitation() {
    return requireFn("refreshCompanySuggestionUiForCurrentInvitation")();
  }

  function setCompanyLinkSearchOptions(rows) {
    state.companyLinkSearchResults = (Array.isArray(rows) ? rows : []).filter(
      isActiveCompanyOptionRow,
    );
    if (!companyLinkSearchOptionsEl) return;
    companyLinkSearchOptionsEl.innerHTML = "";
    for (const row of state.companyLinkSearchResults) {
      const name = safeTrim(row?.company_name);
      const id = safeTrim(row?.company_id);
      if (!name || !id) continue;
      const optionEl = document.createElement("option");
      optionEl.value = name;
      optionEl.dataset.companyId = id;
      companyLinkSearchOptionsEl.appendChild(optionEl);
    }
  }

  function setCompanyDropdownSelected(row) {
    const id = safeTrim(row?.company_id);
    const name = safeTrim(row?.company_name);
    state.selectedCompanyForEditDropdown =
      id && name ? { company_id: id, company_name: name } : null;
    if (companyLinkSearchInputEl) companyLinkSearchInputEl.value = name;
    PopupLogger.debug("[LEF][company dropdown] company selected", {
      company_id: id,
      company_name: name,
    });
  }

  function prepareCompanyDropdownForEdit() {
    return requireFn("prepareCompanyDropdownForEdit")();
  }

  function syncSelectedCompanyFromDropdownInput() {
    const typed = safeTrim(companyLinkSearchInputEl?.value);
    if (!typed) {
      state.selectedCompanyForEditDropdown = null;
      return;
    }
    const matched = state.companyLinkSearchResults.find(
      (row) => safeTrim(row?.company_name).toLowerCase() === typed.toLowerCase(),
    );
    if (matched?.company_id) {
      setCompanyDropdownSelected(matched);
    }
  }

  function renderCurrentCompany() {
    return requireFn("renderDetailHeader")({ force: true });
  }

  function refreshCurrentCompanyContext() {
    return requireFn("refreshCompanyRowFromDb")();
  }

  async function saveCompanyDetails() {
    const btn = globalObj.PopupDom?.saveProfileFieldsBtnEl || null;
    if (!btn) return false;
    btn.click();
    return true;
  }

  async function savePersonDetails() {
    const btn = globalObj.PopupDom?.saveProfileFieldsBtnEl || null;
    if (!btn) return false;
    btn.click();
    return true;
  }

  function linkCompanyToCurrentPerson() {
    return requireFn("linkSelectedExistingCompany")();
  }

  async function unlinkCompanyFromCurrentPerson() {
    throw new Error("unlinkCompanyFromCurrentPerson is not yet extracted.");
  }

  function renderCompanySuggestions(term = "") {
    return requireFn("searchCompaniesForEditDropdown")(term);
  }

  globalObj.PopupCompanyController = Object.freeze({
    bindCompanyEvents,
    getSelectedExistingCompanyForLink,
    setSelectedExistingCompanyForLinkState,
    getSelectedCompanyForEditDropdown,
    setSelectedCompanyForEditDropdown,
    getCompanySuggestionState,
    setCompanySuggestionState,
    getCompanyPeopleRows,
    setCompanyPeopleRows,
    setCompanyUrlMismatchBannerVisible,
    refreshCompanyUrlMismatchBanner,
    coalesceDbThenScraped,
    autoResizeCommentsField,
    renderProfileEditControls,
    applyProfileModeUi,
    updateExistingCompanyLinkUi,
    isActiveCompanyOptionRow,
    setCompanyExistingLinkOptions,
    setSelectedExistingCompanyForLink,
    syncSelectedExistingCompanyFromInput,
    searchExistingCompaniesForCompanyPage,
    prepareExistingCompanyLinkDropdown,
    setProfileEditMode,
    renderDetailHeader,
    getCompanyNameForPeopleList,
    renderCompanyPeopleList,
    buildCompanyProfileSavePayload,
    renderCurrentCompany,
    refreshCurrentCompanyContext,
    saveCompanyDetails,
    savePersonDetails,
    linkCompanyToCurrentPerson,
    unlinkCompanyFromCurrentPerson,
    hideCompanySuggestionUi,
    renderLinkedCompanyName,
    renderCompanySuggestionFound,
    renderCompanySuggestionNotFound,
    refreshCompanySuggestionUiForCurrentInvitation,
    setCompanyLinkSearchOptions,
    setCompanyDropdownSelected,
    searchExistingCompaniesForCompanyPage,
    prepareCompanyDropdownForEdit,
    syncSelectedCompanyFromDropdownInput,
    renderCompanySuggestions,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
