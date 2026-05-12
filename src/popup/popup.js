// Refactored popup entrypoint. Behavior lives in the categorized popup-main modules.


const companySubTabsEl = document.getElementById("companySubTabs");
const companyPersonsBtnEl = document.getElementById("companyPersonsBtn");
const companyNotesBtnEl = document.getElementById("companyNotesBtn");

function isCompanyProfileContext() {
  const url =
    currentProfileContext?.url ||
    currentProfileContext?.profile_url ||
    currentProfileContext?.linkedin_url ||
    "";
  return url.includes("/company/");
}

function applyCompanyProfileUi() {
  if (!companySubTabsEl) return;

  const isCompany = isCompanyProfileContext();

  companySubTabsEl.classList.toggle("is-hidden", !isCompany);

  const filterWrap = document.getElementById("notesFilterWrap");
  if (filterWrap) {
    filterWrap.classList.toggle("notes-hidden", isCompany);
  }
}

companyPersonsBtnEl?.addEventListener("click", () => {
  companyPersonsBtnEl.classList.add("active");
  companyNotesBtnEl?.classList.remove("active");
});

companyNotesBtnEl?.addEventListener("click", () => {
  companyNotesBtnEl.classList.add("active");
  companyPersonsBtnEl?.classList.remove("active");
});
