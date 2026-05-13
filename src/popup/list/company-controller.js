(function initPopupCompanyController(globalObj) { const PopupDom = globalObj.PopupDom;
if (!PopupDom || typeof PopupDom !== "object") { throw new Error("PopupDom must be loaded before popup-company-controller.js.");
} const PopupUtils = globalObj.PopupUtils;
if (!PopupUtils || typeof PopupUtils !== "object") { throw new Error("PopupUtils must be loaded before popup-company-controller.js.");
} const PopupState = globalObj.PopupState;
if (!PopupState || typeof PopupState !== "object") { throw new Error("PopupState must be loaded before popup-company-controller.js.");
} const PopupLogger = globalObj.PopupLogger;
if (!PopupLogger || typeof PopupLogger !== "object") { throw new Error("PopupLogger must be loaded before popup-company-controller.js.");
} const {
acceptCompanySuggestionBtnEl, companyExistingLinkButtonEl,
companyExistingLinkInputEl, companyExistingLinkOptionsEl,
companyExistingLinkSectionEl, companyExistingLinkStatusEl,
companyLinkSearchInputEl, companyLinkSearchOptionsEl,
companyPeopleListEl, companyPeopleSectionEl,
companyProfileTabsRowEl, companyPersonsTabBtnEl, companyNotesTabBtnEl, companyDealsTabBtnEl,
companyCampaignControlsEl, companyLinkedEmployeeNumberEl,
companyLinkedIndicatorEl, companyLinkedNameEl,
companyLinkedRowEl, companyQuickLinkBtn,
companySuggestionWarningEl, companyUrlMismatchBannerEl,
detailCompanyEl, detailCompanyLabelEl,
detailPhoneEl, detailPhoneLabelEl,
detailEmailEl, detailEmailLabelEl,
emailProfileBtnEl, whatsappProfileBtnEl,
detailCommentsEl, detailCommentsLabelEl,
detailEmployeeNumberEl, detailEmployeeNumberLabelEl,
detailHeadlineEl, detailHeadlineLabelEl,
detailItMembersEl, detailItMembersLabelEl,
detailCityEl, detailCityLabelEl,
detailPersonNameEl, enrichProfileBtnEl,
editProfileBtnEl, saveProfileFieldsBtnEl,
cancelProfileEditBtnEl, personNotRegisteredStateEl,
tabMain, campaignGroupEl,
campaignDividerEl, statusStepperEl,
stepperUnderlayEl, statusDividerEl,
detailTabsDividerEl, detailTabsRowEl,
detailInviteSectionEl, detailMessageMountEl,
tabMessage, tabFreePromptEl,
acceptedModeEl, firstMessageSentModeEl,
} = PopupDom; const safeTrim =
typeof PopupUtils.safeTrim === "function" ? PopupUtils.safeTrim
: (value) => (value == null ? "" : String(value).trim()); const state = {
selectedExistingCompanyForLink: null, selectedCompanyForEditDropdown: null,
companySuggestionState: null, companyPeopleRows: [],
companyExistingLinkResults: [], companyLinkSearchResults: [],
};
emailProfileBtnEl?.addEventListener("click", openEmailForCurrentPerson);
whatsappProfileBtnEl?.addEventListener("click", openWhatsappForCurrentPerson);
function requireFn(name) {
const fn = globalObj[name]; if (typeof fn !== "function") {
throw new Error(
`popup-company-controller.js requires global function ${name} to be defined.`, );
} return fn;
} function getSelectedExistingCompanyForLink() {
return state.selectedExistingCompanyForLink;
} function setSelectedExistingCompanyForLinkState(value) {
state.selectedExistingCompanyForLink = value || null; }
function getSelectedCompanyForEditDropdown() { return state.selectedCompanyForEditDropdown;
} function setSelectedCompanyForEditDropdown(value) {
state.selectedCompanyForEditDropdown = value || null; }
function getCompanySuggestionState() { return state.companySuggestionState;
} function setCompanySuggestionState(value) {
state.companySuggestionState = value || null; }
function getCompanyPeopleRows() { return state.companyPeopleRows;
} function setCompanyPeopleRows(value) {
state.companyPeopleRows = Array.isArray(value) ? value : []; }
function normalizeLinkedinCompanyCompareUrl(value) { const canonicalizeLinkedInUrl = requireFn("canonicalizeLinkedInUrl");
const canonical = canonicalizeLinkedInUrl(value || ""); return String(canonical || "").replace(/\/+$/, "").toLowerCase();
} function bindCompanyEvents() {
return requireFn("bindCompanyEvents")();
} function setCompanyUrlMismatchBannerVisible(visible) {
if (!companyUrlMismatchBannerEl) return; companyUrlMismatchBannerEl.hidden = !visible;
} async function refreshCompanyUrlMismatchBanner() {
const selectedCompanyFromListLinkedinUrl = globalObj.selectedCompanyFromListLinkedinUrl || "";
const selectedUrl = normalizeLinkedinCompanyCompareUrl( selectedCompanyFromListLinkedinUrl,
); if (!selectedUrl) {
setCompanyUrlMismatchBannerVisible(false); return;
} const getActiveTabForProfileCheck = requireFn("getActiveTabForProfileCheck");
const canonicalizeLinkedInUrl = requireFn("canonicalizeLinkedInUrl"); const detectLinkedInPageType = requireFn("detectLinkedInPageType");
const activeTab = await getActiveTabForProfileCheck().catch(() => null); const activeUrl = canonicalizeLinkedInUrl(activeTab?.url || "");
const activePage = detectLinkedInPageType(activeUrl); if (activePage.page_type !== "company") {
setCompanyUrlMismatchBannerVisible(false); return;
} const activeCompanyUrl = normalizeLinkedinCompanyCompareUrl(
activePage.linkedin_id, );
setCompanyUrlMismatchBannerVisible( Boolean(activeCompanyUrl && activeCompanyUrl !== selectedUrl),
); }
function coalesceDbThenScraped(dbValue, scrapedValue) { return dbValue && String(dbValue).trim() !== ""
? String(dbValue) : scrapedValue || "";
} function autoResizeCommentsField() {
if (!detailCommentsEl) return; detailCommentsEl.style.height = "auto";
detailCommentsEl.style.height = `${detailCommentsEl.scrollHeight}px`; }
function getValidContactValue(value) {
const text = safeTrim(value);
return text && text !== "-" ? text : "";
}
function getPersonEmailValue() {
return getValidContactValue(PopupState.dbInvitationRow?.email);
}
function getPersonPhoneValue() {
return getValidContactValue(PopupState.dbInvitationRow?.phone);
}
function normalizeWhatsappPhone(value) {
const digits = getValidContactValue(value).replace(/\D/g, "");
return digits.length >= 8 ? digits : "";
}
function setContactActionVisible(el, visible) {
if (!el) return;
el.hidden = !visible;
el.classList.toggle("is-hidden", !visible);
el.style.display = visible ? "" : "none";
el.setAttribute("aria-hidden", visible ? "false" : "true");
}
function updatePersonContactActions() {
const isCompanyProfileMode = requireFn("isCompanyProfileMode"); const isCompany = isCompanyProfileMode();
const isEditing = Boolean(globalObj.isProfileEditMode);
const showEmail = !isCompany && !isEditing && Boolean(getPersonEmailValue());
const showWhatsapp = !isCompany && !isEditing && Boolean(normalizeWhatsappPhone(getPersonPhoneValue()));
setContactActionVisible(emailProfileBtnEl, showEmail);
setContactActionVisible(whatsappProfileBtnEl, showWhatsapp);
}
function openEmailForCurrentPerson() {
const email = getPersonEmailValue(); if (!email) return;
window.open(`mailto:${encodeURIComponent(email)}`, "_blank");
}
async function openExternalAppUrl({ targetUrl, appUrlPatterns }) {
const url = safeTrim(targetUrl);
const patterns = Array.isArray(appUrlPatterns)
? appUrlPatterns.map(safeTrim).filter(Boolean)
: [];
if (!url) return;
if (!chrome?.tabs?.query || !chrome?.tabs?.update || !chrome?.tabs?.create) {
window.open(url, "_blank");
return;
}
try {
const tabs = patterns.length ? await chrome.tabs.query({ url: patterns }) : [];
const tab = tabs.find((item) => Number.isInteger(item?.id));
if (tab) {
await chrome.tabs.update(tab.id, { url, active: true });
if (Number.isInteger(tab.windowId) && chrome?.windows?.update) {
await chrome.windows.update(tab.windowId, { focused: true }).catch(() => null);
}
return;
}
await chrome.tabs.create({ url, active: true });
} catch (_e) {
window.open(url, "_blank");
}
}
async function openWhatsappForCurrentPerson() {
const phone = normalizeWhatsappPhone(getPersonPhoneValue()); if (!phone) return;
await openExternalAppUrl({
targetUrl: `https://web.whatsapp.com/send?phone=${encodeURIComponent(phone)}`,
appUrlPatterns: ["https://web.whatsapp.com/*"],
});
}
function renderProfileEditControls() { const isCompanyProfileMode = requireFn("isCompanyProfileMode");
const getDetailNameLinkedinUrl = requireFn("getDetailNameLinkedinUrl"); const isLinkedInProfileLikeUrl = requireFn("isLinkedInProfileLikeUrl");
const isCompany = isCompanyProfileMode(); const isProfileEditMode = Boolean(globalObj.isProfileEditMode);
const isProfileSaveInFlight = Boolean(globalObj.isProfileSaveInFlight); const dbCompanyRow = globalObj.dbCompanyRow || null;
const detailNameUrl = getDetailNameLinkedinUrl(); const isDetailNameLinkable =
!isProfileEditMode && isLinkedInProfileLikeUrl(detailNameUrl); if (enrichProfileBtnEl) {
enrichProfileBtnEl.hidden = isProfileEditMode; enrichProfileBtnEl.disabled = isProfileEditMode;
} if (editProfileBtnEl) {
editProfileBtnEl.hidden = isProfileEditMode; editProfileBtnEl.textContent = isCompany && !dbCompanyRow ? "Create" : "\u270E";
editProfileBtnEl.title = isCompany && !dbCompanyRow ? "Create company" : "Edit";
editProfileBtnEl.setAttribute( "aria-label",
isCompany && !dbCompanyRow ? "Create company" : "Edit", );
} if (saveProfileFieldsBtnEl) {
saveProfileFieldsBtnEl.hidden = !isProfileEditMode; saveProfileFieldsBtnEl.disabled = isProfileSaveInFlight;
} if (cancelProfileEditBtnEl) {
cancelProfileEditBtnEl.hidden = !isProfileEditMode; cancelProfileEditBtnEl.disabled = isProfileSaveInFlight;
} for (const fieldEl of [
detailPersonNameEl, detailCompanyEl,
detailPhoneEl, detailEmailEl,
detailEmployeeNumberEl, detailHeadlineEl,
detailCommentsEl, detailCityEl,
detailItMembersEl, ]) {
if (!fieldEl) continue; fieldEl.readOnly = !isProfileEditMode;
} if (detailPersonNameEl) {
detailPersonNameEl.classList.toggle("is-linkable", isDetailNameLinkable); if (isDetailNameLinkable) {
detailPersonNameEl.title = isCompany ? "Open company page"
: "Open person profile"; } else {
detailPersonNameEl.removeAttribute("title"); }
} if (companyLinkSearchInputEl) {
companyLinkSearchInputEl.hidden = !isProfileEditMode; }
if (companyLinkedNameEl) { companyLinkedNameEl.hidden = isProfileEditMode;
} if (companyLinkedEmployeeNumberEl) {
companyLinkedEmployeeNumberEl.hidden = isCompany ||
!safeTrim(PopupState.dbInvitationRow?.company_id) || !safeTrim(companyLinkedEmployeeNumberEl.textContent);
} if (acceptCompanySuggestionBtnEl && isProfileEditMode) {
acceptCompanySuggestionBtnEl.hidden = true; }
if (companyQuickLinkBtn && isProfileEditMode) { companyQuickLinkBtn.hidden = true;
} if (companyLinkedIndicatorEl) {
const showLinkedIndicator = !isCompany &&
isProfileEditMode && Boolean(safeTrim(PopupState.dbInvitationRow?.company_id));
companyLinkedIndicatorEl.hidden = !showLinkedIndicator; companyLinkedIndicatorEl.style.display = showLinkedIndicator
? "inline-flex" : "none";
} if (isCompany) {
if (companyLinkedRowEl) companyLinkedRowEl.hidden = true; if (companySuggestionWarningEl) companySuggestionWarningEl.hidden = true;
if (companyLinkedNameEl) companyLinkedNameEl.hidden = true; if (companyLinkedEmployeeNumberEl) companyLinkedEmployeeNumberEl.hidden = true;
if (companyLinkSearchInputEl) companyLinkSearchInputEl.hidden = true; if (companyLinkedIndicatorEl) {
companyLinkedIndicatorEl.hidden = true; companyLinkedIndicatorEl.style.display = "none";
} if (companyLinkSearchOptionsEl) companyLinkSearchOptionsEl.innerHTML = "";
if (acceptCompanySuggestionBtnEl) acceptCompanySuggestionBtnEl.hidden = true; if (companyQuickLinkBtn) companyQuickLinkBtn.hidden = true;
}
updatePersonContactActions();
applyProfileModeUi();
}
function setCompanyDetailTab(which = "persons") {
const isCompanyProfileMode = requireFn("isCompanyProfileMode");
const isCompany = isCompanyProfileMode();
const showNotes = isCompany && which === "notes";
const showDeals = isCompany && which === "deals";
const showPersons = isCompany && !showNotes && !showDeals;
if (companyPersonsTabBtnEl) companyPersonsTabBtnEl.classList.toggle("active", showPersons);
if (companyNotesTabBtnEl) companyNotesTabBtnEl.classList.toggle("active", showNotes);
if (companyDealsTabBtnEl) companyDealsTabBtnEl.classList.toggle("active", showDeals);
if (companyPeopleSectionEl) companyPeopleSectionEl.hidden = !isCompany || !showPersons;
if (PopupDom.detailNotesPanelEl) PopupDom.detailNotesPanelEl.hidden = !isCompany || !showNotes;
if (PopupDom.detailDealsPanelEl) PopupDom.detailDealsPanelEl.hidden = !isCompany || !showDeals;
if (PopupDom.detailPromptsPanelEl && isCompany) PopupDom.detailPromptsPanelEl.hidden = true;
if (PopupDom.notesFilterCompanyEl?.parentElement) {
  PopupDom.notesFilterCompanyEl.parentElement.hidden = isCompany;
}
if (showNotes) {
  globalObj.refreshNotes?.({ force: true });
}
if (showDeals) {
  globalObj.refreshDeals?.({ force: true });
}
}
function getActiveCompanyDetailTab() {
if (companyDealsTabBtnEl?.classList.contains("active")) return "deals";
return companyNotesTabBtnEl?.classList.contains("active") ? "notes" : "persons";
} function applyProfileModeUi() {
const isCompanyProfileMode = requireFn("isCompanyProfileMode"); const isCompany = isCompanyProfileMode();
const isProfileEditMode = Boolean(globalObj.isProfileEditMode); const dbCompanyRow = globalObj.dbCompanyRow || null;
const shouldShowExistingCompanyDropdown = isCompany && !dbCompanyRow; const shouldShowProfileNotRegistered =
!isProfileEditMode && ((!isCompany && !PopupState.dbInvitationRow) || (isCompany && !dbCompanyRow));
document.documentElement.classList.toggle("company-profile-mode", isCompany); document.body?.classList.toggle("company-profile-mode", isCompany);
  tabMain?.classList.toggle("company-profile-mode", isCompany);
  if (companyProfileTabsRowEl) {
    companyProfileTabsRowEl.hidden = !isCompany;
    companyProfileTabsRowEl.style.display = isCompany ? "" : "none";
  }
if (detailCompanyLabelEl) {
detailCompanyLabelEl.textContent = "Company:"; detailCompanyLabelEl.hidden =
isCompany || shouldShowProfileNotRegistered ||
(!isProfileEditMode && !isCompany); }
if (detailCompanyEl) { detailCompanyEl.hidden =
isCompany || shouldShowProfileNotRegistered ||
(!isProfileEditMode && Boolean(safeTrim(PopupState.dbInvitationRow?.company_id))); }
if (detailPhoneLabelEl) detailPhoneLabelEl.hidden = isCompany || shouldShowProfileNotRegistered || !isProfileEditMode;
if (detailPhoneEl) detailPhoneEl.hidden = isCompany || shouldShowProfileNotRegistered || !isProfileEditMode;
if (detailEmailLabelEl) detailEmailLabelEl.hidden = isCompany || shouldShowProfileNotRegistered || !isProfileEditMode;
if (detailEmailEl) detailEmailEl.hidden = isCompany || shouldShowProfileNotRegistered || !isProfileEditMode;
if (detailEmployeeNumberLabelEl) detailEmployeeNumberLabelEl.hidden = !isCompany; if (detailEmployeeNumberEl) detailEmployeeNumberEl.hidden = !isCompany;
if (detailHeadlineLabelEl) { detailHeadlineLabelEl.textContent = isCompany ? "Sector:" : "Job title:";
detailHeadlineLabelEl.hidden = shouldShowProfileNotRegistered || (!isCompany && !isProfileEditMode);
} if (detailCommentsLabelEl) {
detailCommentsLabelEl.textContent = "Comments:"; detailCommentsLabelEl.hidden = isCompany || shouldShowProfileNotRegistered;
} if (detailCommentsEl) {
detailCommentsEl.hidden = isCompany || shouldShowProfileNotRegistered; }
if (detailCityLabelEl) detailCityLabelEl.hidden = !isCompany; if (detailCityEl) detailCityEl.hidden = !isCompany;
if (detailItMembersLabelEl) detailItMembersLabelEl.hidden = !isCompany; if (detailItMembersEl) detailItMembersEl.hidden = !isCompany;
if (detailPersonNameEl) { detailPersonNameEl.placeholder = isCompany ? "Company name" : "";
} if (detailCompanyEl) detailCompanyEl.placeholder = "";
if (detailPhoneEl) detailPhoneEl.placeholder = "Phone";
if (detailEmailEl) detailEmailEl.placeholder = "Email";
if (detailEmployeeNumberEl) { detailEmployeeNumberEl.placeholder = isCompany ? "Employee number" : "";
} if (detailHeadlineEl) detailHeadlineEl.placeholder = isCompany ? "Sector" : "";
if (detailCommentsEl) detailCommentsEl.placeholder = ""; if (detailCityEl) detailCityEl.placeholder = isCompany ? "City" : "";
if (detailItMembersEl) detailItMembersEl.placeholder = isCompany ? "IT members" : ""; if (companyPeopleSectionEl) companyPeopleSectionEl.hidden = !isCompany;
if (personNotRegisteredStateEl) { personNotRegisteredStateEl.hidden = !shouldShowProfileNotRegistered;
personNotRegisteredStateEl.textContent = isCompany ? "Company is not yet registered"
: "Person is not yet registered"; }
if (!isCompany) setCompanyUrlMismatchBannerVisible(false); if (companyExistingLinkSectionEl) {
companyExistingLinkSectionEl.hidden = !shouldShowExistingCompanyDropdown; companyExistingLinkSectionEl.style.display =
shouldShowExistingCompanyDropdown ? "" : "none"; }
updateExistingCompanyLinkUi(); const hideInvitationUi = isCompany;
for (const el of [ campaignGroupEl,
campaignDividerEl, statusStepperEl,
stepperUnderlayEl, statusDividerEl,
detailTabsDividerEl, detailTabsRowEl,
detailInviteSectionEl, detailMessageMountEl,
tabMessage, tabFreePromptEl,
acceptedModeEl, firstMessageSentModeEl,
]) { if (!el) continue;
el.hidden = hideInvitationUi; el.style.display = hideInvitationUi ? "none" : "";
} if (isCompany) {
    setCompanyDetailTab(getActiveCompanyDetailTab());
} else {
  if (companyProfileTabsRowEl) {
    companyProfileTabsRowEl.hidden = true;
    companyProfileTabsRowEl.style.display = "none";
  }
  if (PopupDom.detailDealsPanelEl) {
    PopupDom.detailDealsPanelEl.hidden = !PopupDom.detailDealsTabBtnEl?.classList.contains("active");
  }
}
if (PopupDom.notesFilterCompanyEl?.parentElement) {
  PopupDom.notesFilterCompanyEl.parentElement.hidden = isCompany;
}
if (companyLinkedRowEl) {
const hasQuickLinkSuggestion = !isCompany &&
!isProfileEditMode && Boolean(state.companySuggestionState?.company_id);
const shouldForceHideLinkedRow = isCompany || (shouldShowProfileNotRegistered && !hasQuickLinkSuggestion);
PopupLogger.debug("[LEF][quick-link][row-visibility]", { isCompany,
isProfileEditMode, shouldShowProfileNotRegistered,
hasQuickLinkSuggestion, shouldForceHideLinkedRow,
companySuggestionId: safeTrim(state.companySuggestionState?.company_id), });
if (shouldForceHideLinkedRow) companyLinkedRowEl.hidden = true; }
if (companySuggestionWarningEl) companySuggestionWarningEl.hidden = true; if (acceptCompanySuggestionBtnEl) acceptCompanySuggestionBtnEl.hidden = true;
if (companyQuickLinkBtn) companyQuickLinkBtn.hidden = true;
updatePersonContactActions(); if (isCompany) {
if (companyLinkedNameEl) companyLinkedNameEl.hidden = true; if (companyLinkedEmployeeNumberEl) companyLinkedEmployeeNumberEl.hidden = true;
if (companyLinkSearchInputEl) companyLinkSearchInputEl.hidden = true; if (companyLinkSearchOptionsEl) companyLinkSearchOptionsEl.innerHTML = "";
} }
function updateExistingCompanyLinkUi(statusText) { const isCompanyProfileMode = requireFn("isCompanyProfileMode");
const dbCompanyRow = globalObj.dbCompanyRow || null; const hasSelection = Boolean(
safeTrim(state.selectedExistingCompanyForLink?.company_id), );
if (companyExistingLinkStatusEl) { companyExistingLinkStatusEl.textContent =
statusText || "Company URL not registered"; companyExistingLinkStatusEl.hidden =
!isCompanyProfileMode() || Boolean(dbCompanyRow); }
if (companyExistingLinkButtonEl) { companyExistingLinkButtonEl.disabled = !hasSelection;
} }
function isActiveCompanyOptionRow(row) { if (!row || typeof row !== "object") return false;
const raw = row?.archived; if (raw == null || raw === "") return true;
if (raw === true || raw === 1) return false; const normalized = String(raw).trim().toLowerCase();
return normalized !== "1" && normalized !== "true";
} function setCompanyExistingLinkOptions(rows) {
state.companyExistingLinkResults = (Array.isArray(rows) ? rows : []).filter( isActiveCompanyOptionRow,
); if (!companyExistingLinkOptionsEl) return;
companyExistingLinkOptionsEl.innerHTML = ""; for (const row of state.companyExistingLinkResults) {
const name = safeTrim(row?.company_name); const id = safeTrim(row?.company_id);
if (!name || !id) continue; const optionEl = document.createElement("option");
optionEl.value = name; optionEl.dataset.companyId = id;
companyExistingLinkOptionsEl.appendChild(optionEl); }
} function setSelectedExistingCompanyForLink(row) {
const id = safeTrim(row?.company_id); const name = safeTrim(row?.company_name);
state.selectedExistingCompanyForLink = id && name ? { ...row, company_id: id, company_name: name } : null;
if (companyExistingLinkInputEl) companyExistingLinkInputEl.value = name; updateExistingCompanyLinkUi();
} function syncSelectedExistingCompanyFromInput() {
const typed = safeTrim(companyExistingLinkInputEl?.value); if (!typed) {
state.selectedExistingCompanyForLink = null; updateExistingCompanyLinkUi();
return; }
const matched = state.companyExistingLinkResults.find( (row) => safeTrim(row?.company_name).toLowerCase() === typed.toLowerCase(),
); state.selectedExistingCompanyForLink = matched?.company_id ? matched : null;
updateExistingCompanyLinkUi(); }
async function searchExistingCompaniesForCompanyPage(term) { const sanitizeCompanySearchTerm = requireFn("sanitizeCompanySearchTerm");
const timingLog = requireFn("timingLog"); const sendRuntimeMessage = requireFn("sendRuntimeMessage");
const query = sanitizeCompanySearchTerm(term); timingLog("DB search triggered with term", { term: query });
if (!query) { setCompanyExistingLinkOptions([]);
setSelectedExistingCompanyForLinkState(null); updateExistingCompanyLinkUi();
return; }
const result = await sendRuntimeMessage("DB_SEARCH_UNLINKED_COMPANIES", { payload: { term: query, limit: 10 },
}); const resp = result.data || {};
const rows = result.ok ? resp?.companies || [] : []; setCompanyExistingLinkOptions(rows);
syncSelectedExistingCompanyFromInput(); updateExistingCompanyLinkUi(
rows.length ? "Company URL not registered"
: "Company URL not registered. No matching unlinked company found.", );
PopupLogger.debug("[LEF][company link search]", { term: query, count: rows.length }); }
async function prepareExistingCompanyLinkDropdown({ allowSearch = true } = {}) { const isCompanyProfileMode = requireFn("isCompanyProfileMode");
const sanitizeCompanySearchTerm = requireFn("sanitizeCompanySearchTerm"); setSelectedExistingCompanyForLinkState(null);
setCompanyExistingLinkOptions([]); if (!isCompanyProfileMode() || globalObj.dbCompanyRow) {
if (companyExistingLinkSectionEl) { companyExistingLinkSectionEl.hidden = true;
companyExistingLinkSectionEl.style.display = "none"; }
if (companyExistingLinkInputEl) companyExistingLinkInputEl.value = ""; updateExistingCompanyLinkUi();
return; }
if (companyExistingLinkSectionEl) { companyExistingLinkSectionEl.hidden = false;
companyExistingLinkSectionEl.style.display = ""; }
const scrapedName = sanitizeCompanySearchTerm(getCompanyNameForPeopleList()); if (companyExistingLinkInputEl) companyExistingLinkInputEl.value = scrapedName;
updateExistingCompanyLinkUi(); if (allowSearch && !globalObj.dbCompanyRow && scrapedName) {
await searchExistingCompaniesForCompanyPage(scrapedName); }
} function setProfileEditMode(nextMode) {
const isCompanyProfileMode = requireFn("isCompanyProfileMode"); globalObj.isProfileEditMode = Boolean(nextMode);
renderProfileEditControls(); if (globalObj.isProfileEditMode && !isCompanyProfileMode()) {
prepareCompanyDropdownForEdit().catch(() => null); detailPersonNameEl?.focus();
detailPersonNameEl?.select(); return;
} if (globalObj.isProfileEditMode) {
detailPersonNameEl?.focus(); detailPersonNameEl?.select();
return; }
setSelectedCompanyForEditDropdown(null); renderDetailHeader({ force: true });
} function renderDetailHeader(options) {
const { force = false } = options || {}; const isCompanyProfileMode = requireFn("isCompanyProfileMode");
const debug = typeof globalObj.debug === "function" ? globalObj.debug : () => {}; const isProfileEditMode = Boolean(globalObj.isProfileEditMode);
if (isCompanyProfileMode()) { const scraped = PopupState.currentProfileContext || {};
const row = globalObj.dbCompanyRow || {}; const companyName = coalesceDbThenScraped(
row.company_name, scraped.company_name || scraped.name || scraped.full_name || "",
); const employeeNumber = coalesceDbThenScraped(
row.employee_number, scraped.employee_number || "",
); const sector = coalesceDbThenScraped(row.sector, scraped.sector || "");
const city = coalesceDbThenScraped(row.city, scraped.city || ""); const itMembers = coalesceDbThenScraped(
row.it_members, scraped.it_members || "",
); if (!(isProfileEditMode && !force)) {
if (detailPersonNameEl) detailPersonNameEl.value = companyName.trim() || "-"; if (detailEmployeeNumberEl) {
detailEmployeeNumberEl.value = employeeNumber.trim() || "-"; }
if (detailHeadlineEl) detailHeadlineEl.value = sector.trim() || "-"; if (detailItMembersEl) detailItMembersEl.value = itMembers.trim() || "-";
if (detailCityEl) detailCityEl.value = city.trim() || "-"; }
if (PopupState.currentProfileContext) { PopupState.currentProfileContext.it_members = itMembers.trim();
} applyProfileModeUi();
renderProfileEditControls(); return;
} const scrapedName = (
PopupState.currentProfileContext?.name || PopupState.currentProfileContext?.full_name ||
"" ).trim();
const scrapedCompany = (PopupState.currentProfileContext?.company || "").trim(); const scrapedHeadline = (PopupState.currentProfileContext?.headline || "").trim();
const scrapedComments = (PopupState.currentProfileContext?.comments || "").trim(); const dbName = (
PopupState.dbInvitationRow?.full_name || PopupState.dbInvitationRow?.name ||
"" ).trim();
const dbCompany = (PopupState.dbInvitationRow?.company || "").trim(); const dbHeadline = (PopupState.dbInvitationRow?.headline || "").trim();
const dbComments = (PopupState.dbInvitationRow?.comments || "").trim(); const name = coalesceDbThenScraped(dbName, scrapedName).trim() || "-";
const company = coalesceDbThenScraped(dbCompany, scrapedCompany).trim() || "-";
const headline = coalesceDbThenScraped(dbHeadline, scrapedHeadline).trim() || "-";
const dbPhone = safeTrim(PopupState.dbInvitationRow?.phone); const scrapedPhone = safeTrim(PopupState.currentProfileContext?.phone);
const dbEmail = safeTrim(PopupState.dbInvitationRow?.email); const scrapedEmail = safeTrim(PopupState.currentProfileContext?.email);
const comments = coalesceDbThenScraped(dbComments, scrapedComments).trim() || "-";
const phone = coalesceDbThenScraped(dbPhone, scrapedPhone).trim() || "-";
const email = coalesceDbThenScraped(dbEmail, scrapedEmail).trim() || "-";
debug("detail header source", { nameSource: dbName ? "db" : "scraped",
companySource: dbCompany ? "db" : "scraped", headlineSource: dbHeadline ? "db" : "scraped",
}); if (isProfileEditMode && !force) return;
if (detailPersonNameEl) detailPersonNameEl.value = name; if (detailCompanyEl) detailCompanyEl.value = company;
if (detailPhoneEl) detailPhoneEl.value = phone; if (detailEmailEl) detailEmailEl.value = email;
if (detailEmployeeNumberEl) detailEmployeeNumberEl.value = "-"; if (detailHeadlineEl) detailHeadlineEl.value = headline;
if (detailCommentsEl) detailCommentsEl.value = comments; if (detailCityEl) detailCityEl.value = "-";
if (detailItMembersEl) detailItMembersEl.value = "-"; autoResizeCommentsField();
applyProfileModeUi(); renderProfileEditControls();
} function getCompanyNameForPeopleList() {
const dbCompanyRow = globalObj.dbCompanyRow || null; return safeTrim(
dbCompanyRow?.company_name || PopupState.currentProfileContext?.company_name ||
PopupState.currentProfileContext?.name || PopupState.currentProfileContext?.full_name ||
"", );
} function renderCompanyPeopleList() {
const isCompanyProfileMode = requireFn("isCompanyProfileMode"); const sendRuntimeMessage = requireFn("sendRuntimeMessage");
const getErrorMessage = requireFn("getErrorMessage"); const setFooterUpdatingStatus = requireFn("setFooterUpdatingStatus");
const setFooterStatus = requireFn("setFooterStatus"); const setFooterReady = requireFn("setFooterReady");
const refreshCompanyPeopleListFn = refreshCompanyPeopleList; const PopupCampaignController = globalObj.PopupCampaignController;
if (!companyPeopleSectionEl || !companyPeopleListEl) return; const isCompany = isCompanyProfileMode();
companyPeopleSectionEl.hidden = !isCompany; companyPeopleListEl.innerHTML = "";
if (companyCampaignControlsEl) { const hasRegisteredCompany = Boolean(
safeTrim(globalObj.dbCompanyRow?.company_id), );
companyCampaignControlsEl.hidden = !(isCompany && hasRegisteredCompany && state.companyPeopleRows.length > 0);
} PopupCampaignController?.renderCompanyLinkedCampaignChips?.();
if (!isCompany) return; if (!state.companyPeopleRows.length) {
const emptyEl = document.createElement("div"); emptyEl.className = "company-people-empty";
emptyEl.textContent = "No registered people found"; companyPeopleListEl.appendChild(emptyEl);
return; }
for (const row of state.companyPeopleRows) { const linkedinUrl = safeTrim(row?.linkedin_url);
const name = safeTrim(row?.full_name || row?.name) || "-"; const headline = safeTrim(row?.headline) || "-";
const isConnected = row?.accepted === true; const rowEl = document.createElement("div");
rowEl.className = "company-person-card"; rowEl.dataset.linkedinUrl = linkedinUrl;
if (linkedinUrl) { rowEl.setAttribute("role", "button");
rowEl.setAttribute("tabindex", "0"); rowEl.title = "Open person profile";
} const textEl = document.createElement("div");
textEl.className = "company-person-text"; const nameEl = document.createElement("div");
nameEl.className = "company-person-name"; const nameLabelEl = document.createElement("span");
nameLabelEl.className = "company-person-name-label"; nameLabelEl.textContent = name;
const statusEl = document.createElement("span"); statusEl.className = isConnected
? "company-person-connection is-connected" : "company-person-connection is-not-connected";
statusEl.textContent = isConnected ? "Connected" : "Not connected"; nameEl.appendChild(nameLabelEl);
nameEl.appendChild(statusEl); const headlineEl = document.createElement("div");
headlineEl.className = "company-person-function"; headlineEl.textContent = headline;
const personCampaignsEl = document.createElement("div"); personCampaignsEl.className = "company-person-campaigns";
const personCampaignRows = Array.isArray(row?.campaign_rows) ? row.campaign_rows
: []; for (const campaignRow of personCampaignRows) {
const campaignId = safeTrim(campaignRow?.campaign_id); const campaignName = safeTrim(campaignRow?.campaign_name);
const campaignColor = safeTrim(campaignRow?.color); if (!campaignId || !campaignName) continue;
const chipEl = document.createElement("span"); chipEl.className = "campaign-chip";
if (/^#[0-9a-f]{6}$/i.test(campaignColor)) { chipEl.style.backgroundColor = campaignColor;
chipEl.style.color = PopupCampaignController?.pickCampaignTextColor?.(campaignColor) ||
"#111827"; }
chipEl.title = "Click to set campaign color"; const nameChipEl = document.createElement("span");
nameChipEl.className = "campaign-chip-name"; nameChipEl.textContent = campaignName;
chipEl.appendChild(nameChipEl); const removeBtn = document.createElement("button");
removeBtn.type = "button"; removeBtn.className = "campaign-chip-remove";
removeBtn.textContent = "\u00d7"; removeBtn.title = "Remove link";
removeBtn.addEventListener("click", async (event) => { event.preventDefault();
event.stopPropagation(); const personId = safeTrim(row?.id);
if (!personId) return; setFooterUpdatingStatus();
try { const result = await sendRuntimeMessage("DB_UNLINK_PERSON_CAMPAIGN", {
payload: { person_id: personId, campaign_id: campaignId }, });
if (!result.ok) throw new Error(getErrorMessage(result.error)); await refreshCompanyPeopleListFn();
setFooterStatus("Campaign link removed."); } catch (e) {
setFooterStatus(`DB error: ${getErrorMessage(e)}`); } finally {
setFooterReady(); }
}); chipEl.appendChild(removeBtn);
chipEl.addEventListener("click", async (event) => { event.preventDefault();
event.stopPropagation(); if (event.target === removeBtn) return;
await PopupCampaignController?.openCampaignColorPicker?.({ campaignId,
campaignColor, onSaved: refreshCompanyPeopleListFn,
}); });
personCampaignsEl.appendChild(chipEl); }
textEl.appendChild(nameEl); textEl.appendChild(headlineEl);
textEl.appendChild(personCampaignsEl); rowEl.appendChild(textEl);
companyPeopleListEl.appendChild(rowEl); }
} async function refreshCompanyPeopleList() {
const isCompanyProfileMode = requireFn("isCompanyProfileMode"); const sendRuntimeMessage = requireFn("sendRuntimeMessage");
const PopupCampaignController = globalObj.PopupCampaignController; state.companyPeopleRows = [];
PopupCampaignController?.setCompanyLinkedCampaignRows?.([]); renderCompanyPeopleList();
if (!isCompanyProfileMode()) return; const company_id = safeTrim(globalObj.dbCompanyRow?.company_id);
if (!company_id) return; const result = await sendRuntimeMessage("DB_LIST_INVITATIONS_BY_COMPANY", {
payload: { company_id }, });
const resp = result.data || {}; const baseRows = result.ok && Array.isArray(resp?.rows) ? resp.rows : [];
const enrichedRows = await Promise.all( baseRows.map(async (row) => {
const personId = safeTrim(row?.id); if (!personId) return { ...row, campaign_rows: [] };
const campaignsResult = await sendRuntimeMessage("DB_LIST_PERSON_CAMPAIGNS", { payload: { person_id: personId },
}); const campaignsResp = campaignsResult.data || {};
return {
...row, campaign_rows:
campaignsResult.ok && Array.isArray(campaignsResp?.rows) ? campaignsResp.rows
: [], };
}), );
state.companyPeopleRows = enrichedRows; PopupCampaignController?.setCompanyLinkedCampaignRows?.(Array.from(
new Map( enrichedRows
.flatMap((row) => (Array.isArray(row?.campaign_rows) ? row.campaign_rows : [])) .map((row) => [safeTrim(row?.campaign_id), row])
.filter(([id]) => Boolean(id)), ).values(),
)); renderCompanyPeopleList();
PopupCampaignController?.rebuildCompanyCampaignSelectOptions?.(); }
function buildCompanyProfileSavePayload() { return requireFn("buildCompanyProfileSavePayload")();
} function hideCompanySuggestionUi() {
state.companySuggestionState = null; state.selectedCompanyForEditDropdown = null;
state.companyLinkSearchResults = []; if (companyLinkedRowEl) companyLinkedRowEl.hidden = true;
if (companySuggestionWarningEl) companySuggestionWarningEl.hidden = true; if (companyLinkedNameEl) {
companyLinkedNameEl.hidden = false; companyLinkedNameEl.textContent = "-";
companyLinkedNameEl.classList.remove("is-linked", "is-unlinked"); }
if (companyLinkedEmployeeNumberEl) { companyLinkedEmployeeNumberEl.hidden = true;
companyLinkedEmployeeNumberEl.textContent = ""; }
if (companyLinkedIndicatorEl) { companyLinkedIndicatorEl.hidden = true;
companyLinkedIndicatorEl.style.display = "none"; }
if (companyLinkSearchInputEl) { companyLinkSearchInputEl.hidden = true;
companyLinkSearchInputEl.value = ""; }
if (companyLinkSearchOptionsEl) companyLinkSearchOptionsEl.innerHTML = ""; if (acceptCompanySuggestionBtnEl) {
acceptCompanySuggestionBtnEl.disabled = false; acceptCompanySuggestionBtnEl.hidden = true;
} }
function renderLinkedCompanyName(companyName, companyUrl = "", companySize = "") { const isProfileEditMode = Boolean(globalObj.isProfileEditMode);
if (companyLinkedNameEl) { companyLinkedNameEl.hidden = isProfileEditMode;
companyLinkedNameEl.textContent = safeTrim(companyName) || "-"; companyLinkedNameEl.classList.add("is-linked");
companyLinkedNameEl.classList.remove("is-unlinked"); const normalizedCompanyUrl = safeTrim(companyUrl);
if (normalizedCompanyUrl) { companyLinkedNameEl.dataset.companyUrl = normalizedCompanyUrl;
companyLinkedNameEl.classList.add("has-company-url"); companyLinkedNameEl.setAttribute("role", "button");
companyLinkedNameEl.setAttribute("tabindex", "0"); companyLinkedNameEl.title = "Open company profile";
} else { delete companyLinkedNameEl.dataset.companyUrl;
companyLinkedNameEl.classList.remove("has-company-url"); companyLinkedNameEl.removeAttribute("role");
companyLinkedNameEl.removeAttribute("tabindex"); companyLinkedNameEl.removeAttribute("title");
} }
if (companyLinkedEmployeeNumberEl) { const employeeText = safeTrim(companySize);
companyLinkedEmployeeNumberEl.textContent = employeeText ? `(${employeeText})`
: ""; companyLinkedEmployeeNumberEl.hidden = !employeeText;
} if (companyLinkedRowEl) companyLinkedRowEl.hidden = false;
if (companySuggestionWarningEl) companySuggestionWarningEl.hidden = true; if (acceptCompanySuggestionBtnEl) acceptCompanySuggestionBtnEl.hidden = true;
} function renderCompanySuggestionFound(companyRow) {
state.companySuggestionState = companyRow || null; const isProfileEditMode = Boolean(globalObj.isProfileEditMode);
if (companyLinkedNameEl) { companyLinkedNameEl.hidden = isProfileEditMode;
companyLinkedNameEl.textContent = safeTrim(companyRow?.company_name) || "-"; companyLinkedNameEl.classList.add("is-unlinked");
companyLinkedNameEl.classList.remove("is-linked"); }
if (companyLinkedEmployeeNumberEl) { companyLinkedEmployeeNumberEl.hidden = true;
companyLinkedEmployeeNumberEl.textContent = ""; }
if (companyLinkedRowEl) companyLinkedRowEl.hidden = false; if (companySuggestionWarningEl) companySuggestionWarningEl.hidden = true;
if (acceptCompanySuggestionBtnEl) { acceptCompanySuggestionBtnEl.hidden = true;
} if (companyQuickLinkBtn) {
companyQuickLinkBtn.hidden = isProfileEditMode; }
} function renderCompanySuggestionNotFound() {
state.companySuggestionState = null; if (companyLinkedRowEl) companyLinkedRowEl.hidden = true;
if (companySuggestionWarningEl) companySuggestionWarningEl.hidden = false; if (acceptCompanySuggestionBtnEl) acceptCompanySuggestionBtnEl.hidden = true;
if (companyQuickLinkBtn) companyQuickLinkBtn.hidden = true; }
async function refreshCompanySuggestionUiForCurrentInvitation() { const sendRuntimeMessage = requireFn("sendRuntimeMessage");
const getErrorMessage = requireFn("getErrorMessage"); hideCompanySuggestionUi();
const savedCompany = safeTrim( PopupState.dbInvitationRow?.company ||
PopupState.currentProfileContext?.company || detailCompanyEl?.value ||
companyLinkedNameEl?.textContent, );
const savedCompanyId = safeTrim(PopupState.dbInvitationRow?.company_id); PopupLogger.debug("[LEF][quick-link][refresh-start]", {
savedCompany, savedCompanyId,
dbCompany: safeTrim(PopupState.dbInvitationRow?.company), ctxCompany: safeTrim(PopupState.currentProfileContext?.company),
detailCompany: safeTrim(detailCompanyEl?.value), linkedNameText: safeTrim(companyLinkedNameEl?.textContent),
}); if (!savedCompany || savedCompany === "-") return;
if (savedCompanyId) { PopupLogger.debug("[LEF][quick-link][skip-existing-link]", { savedCompanyId });
const result = await sendRuntimeMessage("DB_GET_COMPANY_BY_ID", { payload: { company_id: savedCompanyId },
}); const companyRow = result.ok ? result.data?.company || null : null;
renderLinkedCompanyName( safeTrim(companyRow?.company_name) || savedCompany,
safeTrim(companyRow?.linkedin_id), safeTrim(companyRow?.company_size),
); return;
} if (detailCompanyEl) detailCompanyEl.hidden = false;
const result = await sendRuntimeMessage("DB_FIND_COMPANY_BY_NAME", { payload: { company_name: savedCompany },
}); const companyRow = result.ok ? result.data?.company || null : null;
PopupLogger.debug("[LEF][quick-link][find-by-name-result]", { query: savedCompany,
ok: result.ok, matchedCompanyId: safeTrim(companyRow?.company_id),
matchedCompanyName: safeTrim(companyRow?.company_name), error: result.ok ? "" : getErrorMessage(result.error),
}); if (companyRow?.company_id && safeTrim(companyRow?.company_name)) {
PopupLogger.debug("[LEF][company suggestion] exact match found", { company_id: companyRow.company_id,
company_name: companyRow.company_name, });
renderCompanySuggestionFound({ company_id: companyRow.company_id,
company_name: companyRow.company_name, linkedin_id: companyRow.linkedin_id || "",
employee_number: companyRow.employee_number || "", company_size: companyRow.company_size || "", });
return; }
PopupLogger.debug("[LEF][company suggestion] no exact match found", { company_name: savedCompany,
}); renderCompanySuggestionNotFound();
} function setCompanyLinkSearchOptions(rows) {
state.companyLinkSearchResults = (Array.isArray(rows) ? rows : []).filter( isActiveCompanyOptionRow,
); if (!companyLinkSearchOptionsEl) return;
companyLinkSearchOptionsEl.innerHTML = ""; for (const row of state.companyLinkSearchResults) {
const name = safeTrim(row?.company_name); const id = safeTrim(row?.company_id);
if (!name || !id) continue; const optionEl = document.createElement("option");
optionEl.value = name; optionEl.dataset.companyId = id;
companyLinkSearchOptionsEl.appendChild(optionEl); }
} function setCompanyDropdownSelected(row) {
const id = safeTrim(row?.company_id); const name = safeTrim(row?.company_name);
state.selectedCompanyForEditDropdown = id && name ? { company_id: id, company_name: name } : null;
if (companyLinkSearchInputEl) companyLinkSearchInputEl.value = name; PopupLogger.debug("[LEF][company dropdown] company selected", {
company_id: id, company_name: name,
}); }
async function searchCompaniesForEditDropdown(term) { const sendRuntimeMessage = requireFn("sendRuntimeMessage");
const query = safeTrim(term); if (!query) {
setCompanyLinkSearchOptions([]); return;
} const result = await sendRuntimeMessage("DB_SEARCH_COMPANIES", {
payload: { term: query, limit: 10 }, });
const resp = result.data || {}; const rows = result.ok ? resp?.companies || [] : [];
setCompanyLinkSearchOptions(rows); PopupLogger.debug("[LEF][company dropdown] company search results", {
term: query, count: rows.length,
}); }
async function prepareCompanyDropdownForEdit() { const sendRuntimeMessage = requireFn("sendRuntimeMessage");
const getErrorMessage = requireFn("getErrorMessage"); if (!PopupState.dbInvitationRow || !companyLinkedRowEl || !companyLinkSearchInputEl) return;
const savedCompany = safeTrim(PopupState.dbInvitationRow?.company); const savedCompanyId = safeTrim(PopupState.dbInvitationRow?.company_id);
setSelectedCompanyForEditDropdown(null); setCompanyLinkSearchOptions([]);
companyLinkedRowEl.hidden = false; companyLinkSearchInputEl.hidden = false;
companyLinkSearchInputEl.value = ""; if (companyLinkedNameEl) companyLinkedNameEl.hidden = true;
if (acceptCompanySuggestionBtnEl) acceptCompanySuggestionBtnEl.hidden = true; if (companySuggestionWarningEl) companySuggestionWarningEl.hidden = true;
PopupLogger.debug("[LEF][company dropdown] initial load", { company_id: savedCompanyId,
company_name: savedCompany, });
if (savedCompanyId) { const result = await sendRuntimeMessage("DB_GET_COMPANY_BY_ID", {
payload: { company_id: savedCompanyId }, });
const companyRow = result.ok ? result.data?.company || null : null; if (
isActiveCompanyOptionRow(companyRow) && companyRow?.company_id &&
safeTrim(companyRow?.company_name) ) {
setCompanyDropdownSelected(companyRow); setCompanyLinkSearchOptions([companyRow]);
} return;
} if (!savedCompany) return;
const result = await sendRuntimeMessage("DB_FIND_COMPANY_BY_NAME", { payload: { company_name: savedCompany },
}); const companyRow = result.ok ? result.data?.company || null : null;
PopupLogger.debug("[LEF][quick-link][find-by-name-result]", { query: savedCompany,
ok: result.ok, matchedCompanyId: safeTrim(companyRow?.company_id),
matchedCompanyName: safeTrim(companyRow?.company_name), error: result.ok ? "" : getErrorMessage(result.error),
}); if (companyRow?.company_id && safeTrim(companyRow?.company_name)) {
PopupLogger.debug("[LEF][company dropdown] exact match found", { company_id: companyRow.company_id,
company_name: companyRow.company_name, });
setCompanyDropdownSelected(companyRow); setCompanyLinkSearchOptions([companyRow]);
return; }
PopupLogger.debug("[LEF][company dropdown] no exact match found", { company_name: savedCompany,
}); }
function syncSelectedCompanyFromDropdownInput() { const typed = safeTrim(companyLinkSearchInputEl?.value);
if (!typed) { state.selectedCompanyForEditDropdown = null;
return; }
const matched = state.companyLinkSearchResults.find( (row) => safeTrim(row?.company_name).toLowerCase() === typed.toLowerCase(),
); if (matched?.company_id) {
setCompanyDropdownSelected(matched); }
} companyPersonsTabBtnEl?.addEventListener("click", () => setCompanyDetailTab("persons"));
companyNotesTabBtnEl?.addEventListener("click", () => setCompanyDetailTab("notes"));
companyDealsTabBtnEl?.addEventListener("click", () => setCompanyDetailTab("deals"));
function renderCurrentCompany() {
return renderDetailHeader({ force: true });
} function refreshCurrentCompanyContext() {
return requireFn("refreshCompanyRowFromDb")();
} async function saveCompanyDetails() {
const btn = globalObj.PopupDom?.saveProfileFieldsBtnEl || null; if (!btn) return false;
btn.click(); return true;
} async function savePersonDetails() {
const btn = globalObj.PopupDom?.saveProfileFieldsBtnEl || null; if (!btn) return false;
btn.click(); return true;
} function linkCompanyToCurrentPerson() {
return requireFn("linkSelectedExistingCompany")();
} async function unlinkCompanyFromCurrentPerson() {
throw new Error("unlinkCompanyFromCurrentPerson is not yet extracted.");
} function renderCompanySuggestions(term = "") {
return searchCompaniesForEditDropdown(term);
} globalObj.PopupCompanyController = Object.freeze({
bindCompanyEvents, getSelectedExistingCompanyForLink,
setSelectedExistingCompanyForLinkState, getSelectedCompanyForEditDropdown,
setSelectedCompanyForEditDropdown, getCompanySuggestionState,
setCompanySuggestionState, getCompanyPeopleRows,
setCompanyPeopleRows, setCompanyUrlMismatchBannerVisible,
refreshCompanyUrlMismatchBanner, coalesceDbThenScraped,
autoResizeCommentsField, renderProfileEditControls,
applyProfileModeUi, setCompanyDetailTab, updateExistingCompanyLinkUi,
isActiveCompanyOptionRow, setCompanyExistingLinkOptions,
setSelectedExistingCompanyForLink, syncSelectedExistingCompanyFromInput,
searchExistingCompaniesForCompanyPage, prepareExistingCompanyLinkDropdown,
setProfileEditMode, renderDetailHeader,
getCompanyNameForPeopleList, renderCompanyPeopleList,
refreshCompanyPeopleList, buildCompanyProfileSavePayload,
renderCurrentCompany, refreshCurrentCompanyContext,
saveCompanyDetails, savePersonDetails,
linkCompanyToCurrentPerson, unlinkCompanyFromCurrentPerson,
hideCompanySuggestionUi, renderLinkedCompanyName,
renderCompanySuggestionFound, renderCompanySuggestionNotFound,
refreshCompanySuggestionUiForCurrentInvitation, setCompanyLinkSearchOptions,
setCompanyDropdownSelected, searchCompaniesForEditDropdown,
searchExistingCompaniesForCompanyPage, prepareCompanyDropdownForEdit,
syncSelectedCompanyFromDropdownInput, renderCompanySuggestions,
}); })(typeof globalThis !== "undefined" ? globalThis : self);
