
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
    PopupCompanyController.setCompanyPeopleRows([]);
    PopupCompanyController.setSelectedExistingCompanyForLinkState(null);
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
    ? Math.min(
        companyOverviewPage * companyOverviewPageSize,
        companyOverviewTotal,
      )
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
        value: (row) => row?.company_size || "0",
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
          throw new Error(
            getErrorMessage(result.error) || "Company not found.",
          );
        }
        dbCompanyRow = companyRow;
        const linkedinId = safeTrim(
          companyRow?.linkedin_id || row?.linkedin_url || "",
        );
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
      "companies_company_size",
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
