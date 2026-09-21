(function initTodayController(globalObj) {
  const utils = globalObj.PopupUtils || globalObj.LEFUtils || {};
  const sendRuntimeMessage = utils.sendRuntimeMessage || globalObj.sendRuntimeMessage;
  const safeTrim = utils.safeTrim || ((value) => (value == null ? "" : String(value).trim()));
  const getErrorMessage = utils.getErrorMessage || globalObj.getErrorMessage || ((e) => String(e || "Unexpected error."));

  const state = { loaded: false, loading: false };

  function getEl(id) {
    return document.getElementById(id);
  }

  function parseDate(value) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function endOfToday() {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return end;
  }

  function formatDateTime(value) {
    const date = parseDate(value);
    if (!date) return "No date recorded";
    try {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch (_e) {
      return date.toISOString();
    }
  }

  function setStatus(text, isError = false) {
    const statusEl = getEl("todayStatus");
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle("today-status-error", isError);
  }

  function createItem(title, meta, isOverdue = false) {
    const item = document.createElement("div");
    item.className = "today-item";
    if (isOverdue) item.classList.add("today-item-overdue");
    const titleEl = document.createElement("div");
    titleEl.className = "today-item-title";
    titleEl.textContent = safeTrim(title) || "Untitled item";
    const metaEl = document.createElement("div");
    metaEl.className = "today-item-meta";
    metaEl.textContent = safeTrim(meta);
    item.append(titleEl, metaEl);
    return item;
  }

  function renderSection(listId, countId, rows, renderRow, emptyText) {
    const listEl = getEl(listId);
    const countEl = getEl(countId);
    if (countEl) countEl.textContent = String(rows.length);
    if (!listEl) return;
    listEl.replaceChildren();
    if (!rows.length) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "today-empty";
      emptyEl.textContent = emptyText;
      listEl.appendChild(emptyEl);
      return;
    }
    rows.forEach((row) => listEl.appendChild(renderRow(row)));
  }

  function renderUnavailable(listId, countId) {
    const listEl = getEl(listId);
    const countEl = getEl(countId);
    if (countEl) countEl.textContent = "?";
    if (!listEl) return;
    const unavailableEl = document.createElement("div");
    unavailableEl.className = "today-empty today-status-error";
    unavailableEl.textContent = "This source could not be loaded.";
    listEl.replaceChildren(unavailableEl);
  }

  function reminderAttentionDate(row) {
    return row.snoozed_until || row.due_at || row.next_review_at || null;
  }

  function renderReminders(rows) {
    const now = new Date();
    const sorted = [...rows].sort((a, b) => {
      const aDate = parseDate(reminderAttentionDate(a));
      const bDate = parseDate(reminderAttentionDate(b));
      return (aDate?.getTime() || Number.MAX_SAFE_INTEGER) - (bDate?.getTime() || Number.MAX_SAFE_INTEGER);
    });
    renderSection("todayRemindersList", "todayRemindersCount", sorted, (row) => {
      const attentionAt = reminderAttentionDate(row);
      const attentionDate = parseDate(attentionAt);
      const relationship = [row.contact?.full_name, row.company?.company_name, row.deal?.deal_name]
        .map(safeTrim)
        .filter(Boolean)
        .join(" · ");
      const meta = [formatDateTime(attentionAt), relationship].filter(Boolean).join(" · ");
      return createItem(row.title, meta, Boolean(attentionDate && attentionDate < now));
    }, "No active persisted reminders.");
  }

  function renderPlannedWork(rows) {
    const now = new Date();
    const due = rows
      .filter((row) => {
        const status = safeTrim(row.status).toLowerCase();
        const date = parseDate(row.date);
        return date && date <= endOfToday() && status === "planned";
      })
      .sort((a, b) => parseDate(a.date) - parseDate(b.date));
    renderSection("todayWorkList", "todayWorkCount", due, (row) => {
      const relationship = [row.person_name, row.company_name, row.deal_name]
        .map(safeTrim)
        .filter(Boolean)
        .join(" · ");
      const meta = [formatDateTime(row.date), safeTrim(row.notes_type), relationship].filter(Boolean).join(" · ");
      return createItem(row.note_title, meta, parseDate(row.date) < now);
    }, "No recorded work due today or overdue.");
  }

  function renderDeals(rows) {
    const activePhases = new Set(["identification", "confirmed", "first_meeting", "follow", "negotiation"]);
    const active = rows.filter((row) => activePhases.has(safeTrim(row.deal_phase).toLowerCase()));
    renderSection("todayDealsList", "todayDealsCount", active, (row) => {
      const relationship = [row.company_name, row.person_name || row.full_name]
        .map(safeTrim)
        .filter(Boolean)
        .join(" · ");
      return createItem(row.deal_name, [safeTrim(row.deal_phase), relationship].filter(Boolean).join(" · "));
    }, "No active deals recorded.");
  }

  async function loadToday() {
    if (!sendRuntimeMessage || state.loading) return;
    state.loading = true;
    setStatus("Loading current CRM attention items...");
    const refreshBtn = getEl("todayRefreshBtn");
    if (refreshBtn) refreshBtn.disabled = true;
    try {
      const [remindersResult, notesResult, dealsResult] = await Promise.all([
        sendRuntimeMessage("DB_LIST_REMINDERS", { payload: {} }, { timeoutMs: 30000 }),
        sendRuntimeMessage("DB_LIST_NOTES", { payload: { all: true } }, { timeoutMs: 30000 }),
        sendRuntimeMessage("DB_LIST_DEALS", { payload: { all: true } }, { timeoutMs: 30000 }),
      ]);
      const failures = [];
      if (remindersResult.ok) renderReminders(Array.isArray(remindersResult.data?.rows) ? remindersResult.data.rows : []);
      else {
        renderUnavailable("todayRemindersList", "todayRemindersCount");
        failures.push("reminders");
      }
      if (notesResult.ok) renderPlannedWork(Array.isArray(notesResult.data?.rows) ? notesResult.data.rows : []);
      else {
        renderUnavailable("todayWorkList", "todayWorkCount");
        failures.push("planned work");
      }
      if (dealsResult.ok) renderDeals(Array.isArray(dealsResult.data?.rows) ? dealsResult.data.rows : []);
      else {
        renderUnavailable("todayDealsList", "todayDealsCount");
        failures.push("deals");
      }
      state.loaded = true;
      setStatus(failures.length ? `Unavailable: ${failures.join(", ")}. Other sections are current.` : "Current CRM data loaded.", failures.length > 0);
    } catch (error) {
      setStatus(getErrorMessage(error), true);
    } finally {
      state.loading = false;
      if (refreshBtn) refreshBtn.disabled = false;
    }
  }

  function init() {
    getEl("todayRefreshBtn")?.addEventListener("click", () => loadToday());
  }

  globalObj.PopupTodayController = Object.freeze({ init, loadToday });
})(typeof globalThis !== "undefined" ? globalThis : self);
