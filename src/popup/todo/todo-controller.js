(function initTodoController(globalObj) {
  const utils = globalObj.PopupUtils || globalObj.LEFUtils || {};
  const sendRuntimeMessage = utils.sendRuntimeMessage || globalObj.sendRuntimeMessage;
  const safeTrim = utils.safeTrim || ((value) => (value == null ? "" : String(value).trim()));
  const getErrorMessage = utils.getErrorMessage || globalObj.getErrorMessage || ((e) => String(e || "Unexpected error."));
  const grid = typeof globalObj.initPopupGridUtils === "function" ? globalObj.initPopupGridUtils() : null;

  const state = {
    active: "notes",
    notes: [],
    deals: [],
    notesGrid: { sortField: "date", sortDir: "asc" },
    dealsGrid: { sortField: "deal_phase", sortDir: "asc" },
    loadedNotes: false,
    loadedDeals: false,
  };

  function getEl(id) {
    return document.getElementById(id);
  }

  function textButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell-btn todo-link-btn";
    button.textContent = label || "-";
    button.addEventListener("click", onClick);
    return button;
  }

  function normalize(value) {
    return safeTrim(value).toLowerCase();
  }

  function parseDate(value) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function startOfWeek(date) {
    const out = startOfDay(date);
    const day = out.getDay() || 7;
    out.setDate(out.getDate() - day + 1);
    return out;
  }

  function formatDate(value) {
    const date = parseDate(value);
    if (!date) return "";
    try {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
    } catch (_e) {
      return date.toISOString().slice(0, 10);
    }
  }

  function matchesDateOption(rowDate, option) {
    if (!option || option === "all") return true;
    const date = parseDate(rowDate);
    if (!date) return option !== "today" && option !== "past";
    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (option === "today") return date >= today && date < tomorrow;
    if (option === "past") return date < today;
    if (option === "this_week") {
      const start = startOfWeek(new Date());
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return date >= start && date < end;
    }
    if (option === "this_month") {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return date >= start && date < end;
    }
    return true;
  }

  function getDealStatusPhases(status) {
    const key = safeTrim(status) || "open";
    if (key === "to_develop") return ["identification", "confirmed"];
    if (key === "follow") return ["first_meeting", "follow"];
    if (key === "full_attention") return ["follow", "negotiation"];
    if (key === "all") return [];
    return ["identification", "confirmed", "first_meeting", "follow", "negotiation"];
  }

  function getFilteredNotes() {
    const status = normalize(getEl("todoNotesStatusFilter")?.value);
    const type = normalize(getEl("todoNotesTypeFilter")?.value);
    const dateOption = safeTrim(getEl("todoNotesDateFilter")?.value) || "today";
    const search = normalize(getEl("todoNotesSearch")?.value);
    return state.notes.filter((note) => {
      if (status && normalize(note.status) !== status) return false;
      if (type && normalize(note.notes_type) !== type) return false;
      if (!matchesDateOption(note.date, dateOption)) return false;
      if (search) {
        const haystack = [note.note_title, note.person_name, note.company_name]
          .map(normalize)
          .join(" ");
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }

  function getFilteredDeals() {
    const phases = getDealStatusPhases(getEl("todoDealsStatusFilter")?.value);
    const search = normalize(getEl("todoDealsSearch")?.value);
    const allowed = new Set(phases);

    return state.deals.filter((deal) => {
      if (phases.length && !allowed.has(normalize(deal.deal_phase))) {
        return false;
      }

      if (search) {
        const haystack = [
          deal.deal_name,
          deal.company_name,
          deal.person_name,
          deal.full_name,
        ]
          .map(normalize)
          .join(" ");

        if (!haystack.includes(search)) {
          return false;
        }
      }

      return true;
    });
  }

  async function openCompanyDetail(row, { openDeals = false } = {}) {
    const companyId = safeTrim(row.company_id);
    if (!companyId || !sendRuntimeMessage) return;
    const result = await sendRuntimeMessage("DB_GET_COMPANY_BY_ID", {
      payload: { company_id: companyId },
    });
    const companyRow = result.ok ? result.data?.company || null : null;
    if (!companyRow) return;
    globalObj.dbCompanyRow = companyRow;
    const linkedinId = safeTrim(companyRow.linkedin_id || row.company_linkedin_id || "");
    globalObj.selectedCompanyFromListLinkedinUrl = linkedinId;
    if (globalObj.PopupState) {
      globalObj.PopupState.currentProfileContext = {
        url: linkedinId,
        linkedin_id: linkedinId,
        is_company_profile: true,
        company_name: safeTrim(companyRow.company_name || row.company_name),
      };
    }
    globalObj.setNoProfileStateVisible?.(false);
    globalObj.renderDetailHeader?.({ force: true });
    await globalObj.refreshCompanyPeopleList?.();
    await globalObj.refreshCompanyUrlMismatchBanner?.();
    globalObj.setActiveTab?.("detail", { userInitiated: true });
    if (openDeals) globalObj.PopupNotesController?.setActiveSubtab?.("deals");
  }

  async function openPersonDetail(row) {
    let linkedinUrl = safeTrim(row.linkedin_url || row.person_linkedin_url || row.url);
    let personName = safeTrim(row.person_name);
    let companyName = safeTrim(row.company_name);
    let headline = safeTrim(row.headline);
    const personId = safeTrim(row.main_person_id || row.person_id);
    if (!linkedinUrl && personId && sendRuntimeMessage) {
      const result = await sendRuntimeMessage("DB_GET_INVITATION_BY_ID", {
        payload: { id: personId },
      });
      const personRow = result.ok ? result.data?.row || null : null;
      linkedinUrl = safeTrim(personRow?.linkedin_url);
      personName = personName || safeTrim(personRow?.full_name);
      companyName = companyName || safeTrim(personRow?.company);
      headline = headline || safeTrim(personRow?.headline);
    }
    if (!linkedinUrl) return;
    if (globalObj.openPersonDetailsFromOverviewRow) {
      await globalObj.openPersonDetailsFromOverviewRow({
        url: linkedinUrl,
        name: personName,
        company: companyName,
        headline,
      });
      return;
    }
    if (globalObj.PopupState) {
      globalObj.PopupState.currentProfileContext = {
        url: linkedinUrl,
        linkedin_url: linkedinUrl,
        name: personName,
        full_name: personName,
        company: companyName,
      };
    }
    await globalObj.refreshInvitationRowFromDb?.({ preserveTabs: true });
    globalObj.renderDetailHeader?.({ force: true });
    globalObj.setActiveTab?.("detail", { userInitiated: true });
  }

  function renderNotes() {
    const tbodyEl = getEl("todoNotesTbody");
    const tableEl = getEl("todoNotesGrid");
    const statusEl = getEl("todoNotesStatus");
    const rows = getFilteredNotes();
    if (statusEl) statusEl.textContent = `${rows.length} notes`;
    grid?.renderStandardGrid({
      tableEl,
      tbodyEl,
      rows,
      state: state.notesGrid,
      onStateChange: (next) => {
        state.notesGrid = next;
        renderNotes();
      },
      emptyText: "No notes found.",
      columns: [
        { key: "note_title", label: "Note title", width: "180px", className: "overview-cell-text" },
        { key: "date", label: "Date of execution", width: "130px", className: "overview-cell-text", value: (row) => formatDate(row.date), sortValue: (row) => row.date || "" },
        { key: "status", label: "Status", width: "95px", className: "overview-cell-text" },
        { key: "person_name", label: "Linked person name", width: "150px", className: "overview-cell-text", value: (row) => textButton(row.person_name || row.full_name || "-", () => openPersonDetail(row)) },
        { key: "company_name", label: "Linked company name", width: "160px", className: "overview-cell-text", value: (row) => textButton(row.company_name, () => openCompanyDetail(row)) },
        { key: "deal_name", label: "Linked deal name", width: "150px", className: "overview-cell-text", value: (row) => textButton(row.deal_name, () => openCompanyDetail(row, { openDeals: true })) },
      ],
    });
  }

  function renderDeals() {
    const tbodyEl = getEl("todoDealsTbody");
    const tableEl = getEl("todoDealsGrid");
    const statusEl = getEl("todoDealsStatus");
    const rows = getFilteredDeals();
    if (statusEl) statusEl.textContent = `${rows.length} deals`;
    grid?.renderStandardGrid({
      tableEl,
      tbodyEl,
      rows,
      state: state.dealsGrid,
      onStateChange: (next) => {
        state.dealsGrid = next;
        renderDeals();
      },
      emptyText: "No deals found.",
      columns: [
        { key: "deal_phase", label: "Deal phase", width: "140px", className: "overview-cell-text" },
        { key: "company_name", label: "Company", width: "190px", className: "overview-cell-text", value: (row) => textButton(row.company_name, () => openCompanyDetail(row)) },
        { key: "person_name", label: "Person name", width: "170px", className: "overview-cell-text", value: (row) => textButton(row.person_name || row.full_name || "-", () => openPersonDetail(row)) },
      ],
    });
  }

  async function loadNotes() {
    if (!sendRuntimeMessage) return;
    const statusEl = getEl("todoNotesStatus");
    if (statusEl) statusEl.textContent = "Loading notes...";
    const result = await sendRuntimeMessage("DB_LIST_NOTES", { payload: { all: true } }, { timeoutMs: 30000 });
    const resp = result.data || {};
    state.notes = result.ok && Array.isArray(resp.rows) ? resp.rows : [];
    state.loadedNotes = true;
    renderNotes();
  }

  async function loadDeals() {
    if (!sendRuntimeMessage) return;
    const statusEl = getEl("todoDealsStatus");
    if (statusEl) statusEl.textContent = "Loading deals...";
    const result = await sendRuntimeMessage("DB_LIST_DEALS", { payload: { all: true } }, { timeoutMs: 30000 });
    const resp = result.data || {};
    state.deals = result.ok && Array.isArray(resp.rows) ? resp.rows : [];
    state.loadedDeals = true;
    renderDeals();
  }

  function setActiveTodoTab(which) {
    state.active = which === "deals" ? "deals" : "notes";
    const notesActive = state.active === "notes";
    getEl("todoNotesTabBtn")?.classList.toggle("active", notesActive);
    getEl("todoDealsTabBtn")?.classList.toggle("active", !notesActive);
    const notesPanel = getEl("todoNotesPanel");
    const dealsPanel = getEl("todoDealsPanel");
    if (notesPanel) notesPanel.hidden = !notesActive;
    if (dealsPanel) dealsPanel.hidden = notesActive;
    if (notesActive && !state.loadedNotes) loadNotes().catch((e) => { const el = getEl("todoNotesStatus"); if (el) el.textContent = getErrorMessage(e); });
    if (!notesActive && !state.loadedDeals) loadDeals().catch((e) => { const el = getEl("todoDealsStatus"); if (el) el.textContent = getErrorMessage(e); });
  }

  function bindEvents() {
    getEl("todoNotesTabBtn")?.addEventListener("click", () => setActiveTodoTab("notes"));
    getEl("todoDealsTabBtn")?.addEventListener("click", () => setActiveTodoTab("deals"));
    ["todoNotesStatusFilter", "todoNotesTypeFilter", "todoNotesDateFilter", "todoNotesSearch"].forEach((id) => {
      getEl(id)?.addEventListener("input", renderNotes);
      getEl(id)?.addEventListener("change", renderNotes);
    });
    ["todoDealsStatusFilter", "todoDealsSearch"].forEach((id) => {
      getEl(id)?.addEventListener("input", renderDeals);
      getEl(id)?.addEventListener("change", renderDeals);
    });
  }

  function init() {
    bindEvents();
  }

  globalObj.PopupTodoController = Object.freeze({ init, setActiveTodoTab, loadNotes, loadDeals });
})(typeof globalThis !== "undefined" ? globalThis : self);
