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



  function compareValues(a, b, dir) {
    const av = safeText(a).toLowerCase();
    const bv = safeText(b).toLowerCase();
    if (av < bv) return dir === "desc" ? 1 : -1;
    if (av > bv) return dir === "desc" ? -1 : 1;
    return 0;
  }

  function clearElement(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function appendCellContent(td, content) {
    if (content instanceof Node) {
      td.appendChild(content);
      return;
    }
    td.textContent = safeText(content);
  }

  function makeResizeHandle(th, tableEl) {
    const handle = document.createElement("span");
    handle.className = "col-resize-handle";
    handle.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startWidth = th.offsetWidth;
      document.body.classList.add("is-col-resizing");
      const onMove = (moveEvent) => {
        const width = Math.max(70, startWidth + moveEvent.clientX - startX);
        th.style.width = `${width}px`;
        if (tableEl) tableEl.style.tableLayout = "fixed";
      };
      const onUp = () => {
        document.body.classList.remove("is-col-resizing");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
    return handle;
  }

  function renderStandardGrid({
    tableEl,
    tbodyEl,
    rows,
    columns,
    state,
    onStateChange,
    emptyText = "No rows.",
  }) {
    if (!tableEl || !tbodyEl || !Array.isArray(columns)) return;
    const gridState = state || {};
    const sortField = safeText(gridState.sortField || columns[0]?.key || "");
    const sortDir = String(gridState.sortDir || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    const sourceRows = Array.isArray(rows) ? rows.slice() : [];
    const sortedRows = sortField
      ? sourceRows.sort((a, b) => {
          const col = columns.find((candidate) => candidate.key === sortField);
          const getValue = col?.sortValue || col?.value;
          const av = typeof getValue === "function" ? getValue(a) : a?.[sortField];
          const bv = typeof getValue === "function" ? getValue(b) : b?.[sortField];
          return compareValues(av, bv, sortDir);
        })
      : sourceRows;

    const headerRow = tableEl.querySelector("thead tr");
    if (headerRow) {
      clearElement(headerRow);
      for (const col of columns) {
        const th = document.createElement("th");
        if (col.width) th.style.width = col.width;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sort-btn";
        btn.textContent = col.label || col.key || "";
        if (col.key === sortField) {
          btn.classList.add("is-active");
          const indicator = document.createElement("span");
          indicator.className = "sort-indicator";
          indicator.textContent = sortDir === "asc" ? "▲" : "▼";
          btn.appendChild(document.createTextNode(" "));
          btn.appendChild(indicator);
        }
        btn.addEventListener("click", () => {
          const nextDir = sortField === col.key && sortDir === "asc" ? "desc" : "asc";
          onStateChange?.({ ...gridState, sortField: col.key, sortDir: nextDir });
        });
        th.appendChild(btn);
        th.appendChild(makeResizeHandle(th, tableEl));
        headerRow.appendChild(th);
      }
    }

    clearElement(tbodyEl);
    if (!sortedRows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = columns.length || 1;
      td.textContent = emptyText;
      tr.appendChild(td);
      tbodyEl.appendChild(tr);
      return;
    }
    for (const row of sortedRows) {
      const tr = document.createElement("tr");
      for (const col of columns) {
        const td = document.createElement("td");
        if (col.className) td.className = col.className;
        const content = typeof col.value === "function" ? col.value(row) : row?.[col.key];
        appendCellContent(td, content);
        tr.appendChild(td);
      }
      tbodyEl.appendChild(tr);
    }
  }

  return {
    applySearchFilterSortPage,
    renderGridRows,
    renderStandardGrid,
  };
}

globalThis.initPopupGridUtils = initPopupGridUtils;
