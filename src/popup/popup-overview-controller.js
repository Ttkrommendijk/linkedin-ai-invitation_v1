// Owns overview/list orchestration entrypoints.
// Temporary interop delegates to existing popup globals while extraction is incremental.
(function initPopupOverviewController(globalObj) {
  function requireFn(name) {
    const fn = globalObj[name];
    if (typeof fn !== "function") {
      throw new Error(
        `popup-overview-controller.js requires global function ${name} to be defined.`,
      );
    }
    return fn;
  }

  function wireOverviewEvents() {
    return requireFn("wireOverviewEvents")();
  }

  function fetchOverviewPage() {
    return requireFn("fetchOverviewPage")();
  }

  function fetchCompaniesOverviewPage() {
    return requireFn("fetchCompaniesOverviewPage")();
  }

  function setActiveListTab(which) {
    return requireFn("setActiveListTab")(which);
  }

  function restoreOverviewFiltersFromStorage() {
    return requireFn("restoreOverviewFiltersFromStorage")();
  }

  function loadOverviewColumnPrefs() {
    return requireFn("loadOverviewColumnPrefs")();
  }

  function scheduleOverviewAutoSize() {
    return requireFn("scheduleOverviewAutoSize")();
  }

  function scheduleCompanyOverviewAutoSize() {
    return requireFn("scheduleCompanyOverviewAutoSize")();
  }

  function renderOverviewSortIndicators() {
    return requireFn("renderOverviewSortIndicators")();
  }

  function renderOverviewPagination() {
    return requireFn("renderOverviewPagination")();
  }

  function renderCompanyOverviewSortIndicators() {
    return requireFn("renderCompanyOverviewSortIndicators")();
  }

  function renderCompanyOverviewPagination() {
    return requireFn("renderCompanyOverviewPagination")();
  }


  globalObj.PopupOverviewController = Object.freeze({
    wireOverviewEvents,
    fetchOverviewPage,
    fetchCompaniesOverviewPage,
    setActiveListTab,
    restoreOverviewFiltersFromStorage,
    loadOverviewColumnPrefs,
    scheduleOverviewAutoSize,
    scheduleCompanyOverviewAutoSize,
    renderOverviewSortIndicators,
    renderOverviewPagination,
    renderCompanyOverviewSortIndicators,
    renderCompanyOverviewPagination,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
