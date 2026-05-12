
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
  scheduleGridAutoSize(
    "companies",
    companyOverviewTableEl,
    companyOverviewTbodyEl,
  );
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
      : /^https:\/\/www\.linkedin\.com\/(in|company|school)\/[^/?#]+/i.test(
          targetUrl,
        );
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
        companyOverviewSortDir =
          companyOverviewSortDir === "asc" ? "desc" : "asc";
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
    const campaignName = String(
      selectedOption?.dataset?.campaignName || "",
    ).trim();
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

function isCompanyProfileMode(
  profileContext = PopupState.currentProfileContext,
) {
  if (safeTrim(dbCompanyRow?.company_id)) return true;
  const url = String(getLinkedinUrlFromContext(profileContext) || "");
  return /linkedin\.com\/(company|school)\//i.test(url);
}

function normalizeCompanyLinkedinId(
  profileContext = PopupState.currentProfileContext,
) {
  const raw =
    profileContext?.linkedin_id ||
    getLinkedinUrlFromContext(profileContext) ||
    "";
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
    PopupState.dbInvitationRow?.linkedin_url ||
      getLinkedinUrlFromContext(PopupState.currentProfileContext),
  );
}

function isLinkedInProfileLikeUrl(url) {
  if (typeof LEF_UTILS.isLinkedInProfileLikeUrl === "function") {
    return LEF_UTILS.isLinkedInProfileLikeUrl(url);
  }
  if (!url || typeof url !== "string") return false;
  return /^https:\/\/www\.linkedin\.com\/(in|company|school)\/[^/?#]+/i.test(
    url,
  );
}
