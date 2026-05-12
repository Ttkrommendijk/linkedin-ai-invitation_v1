function initPopupGridUtils() {
  function safeText(value) {
    return value == null ? "" : String(value);
  }

  function normalizeText(value) {
    return safeText(value).trim().toLowerCase();
  }

  function applySearchFilterSortPage(rows, config = {}) {
    const sourceRows = Array.isArray(rows) ? rows.slice() : [];
    const filters = config.filters || {};
    const search = normalizeText(config.search || "");
    const searchFields = Array.isArray(config.searchFields)
      ? config.searchFields
      : [];
    const sortField = safeText(config.sortField || "");
    const sortDir = String(config.sortDir || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    const page = Number.isFinite(config.page) && config.page > 0 ? Math.floor(config.page) : 1;
    const pageSize =
      Number.isFinite(config.pageSize) && config.pageSize > 0
        ? Math.floor(config.pageSize)
        : 25;
    const filterFn = typeof config.filterFn === "function" ? config.filterFn : null;
    const sortFn = typeof config.sortFn === "function" ? config.sortFn : null;

    let filtered = sourceRows;
    if (filterFn) {
      filtered = filtered.filter((row) => filterFn(row, filters));
    }

    if (search && searchFields.length) {
      filtered = filtered.filter((row) =>
        searchFields.some((field) =>
          normalizeText(row?.[field]).includes(search),
        ),
      );
    }

    if (sortFn && sortField) {
      filtered = filtered
        .slice()
        .sort((a, b) => sortFn(a, b, sortField, sortDir));
    }

    const total = filtered.length;
    const offset = (page - 1) * pageSize;
    const paged = filtered.slice(offset, offset + pageSize);
    return { rows: paged, total };
  }

  function renderGridRows({
    tbodyEl,
    rows,
    columns,
    actions,
    emptyText = "No rows.",
    emptyColSpan = 1,
  }) {
    if (!tbodyEl) return;
    const safeRows = Array.isArray(rows) ? rows : [];
    tbodyEl.innerHTML = "";

    if (!safeRows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = emptyColSpan;
      td.textContent = emptyText;
      tr.appendChild(td);
      tbodyEl.appendChild(tr);
      return;
    }

    for (const row of safeRows) {
      const tr = document.createElement("tr");

      if (Array.isArray(actions) && actions.length) {
        const actionsTd = document.createElement("td");
        const wrap = document.createElement("div");
        wrap.className = "overview-actions-inline";
        for (const action of actions) {
          if (!action || typeof action !== "object") continue;
          const visible =
            typeof action.visible === "function" ? action.visible(row) : true;
          if (!visible) continue;
          const btn = action.createButton ? action.createButton(row) : null;
          if (!btn) continue;
          wrap.appendChild(btn);
        }
        actionsTd.appendChild(wrap);
        tr.appendChild(actionsTd);
      }

      for (const col of columns || []) {
        const td = document.createElement("td");
        if (col?.className) td.className = col.className;
        const value =
          typeof col?.value === "function" ? col.value(row) : row?.[col?.key];
        td.textContent = safeText(value);
        tr.appendChild(td);
      }

      tbodyEl.appendChild(tr);
    }
  }

  return {
    applySearchFilterSortPage,
    renderGridRows,
  };
}

globalThis.initPopupGridUtils = initPopupGridUtils;
