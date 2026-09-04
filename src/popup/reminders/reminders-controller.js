(function initReminderController(globalObj) {
  const utils = globalObj.PopupUtils || globalObj.LEFUtils || {};
  const send = utils.sendRuntimeMessage || globalObj.sendRuntimeMessage;
  const trim = utils.safeTrim || ((v) => String(v ?? "").trim());
  const errorText = utils.getErrorMessage || globalObj.getErrorMessage || ((e) => String(e));
  let rows = [];

  const getEl = (id) => document.getElementById(id);
  function formatDate(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "No date";
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }
  function attentionDate(row) {
    return row.status === "snoozed" ? row.snoozed_until : row.due_at || row.next_review_at;
  }

  function render() {
    const list = getEl("detailRemindersList");
    if (!list) return;
    list.innerHTML = "";
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "notes-empty";
      empty.textContent = "No active reminders.";
      list.appendChild(empty);
      return;
    }
    rows.forEach((row) => {
      const card = document.createElement("div");
      card.className = "detail-reminder-card";
      const summary = document.createElement("div");
      summary.className = "detail-reminder-summary";
      const when = attentionDate(row);
      summary.textContent = `💡 ${trim(row.title) || "Reminder"} · ${formatDate(when)}`;
      summary.title = row.due_at ? `Due ${formatDate(row.due_at)}` : `Review ${formatDate(row.next_review_at)}`;
      const action = document.createElement("button");
      action.type = "button";
      action.className = "btn-small-secondary";
      action.textContent = "Log interaction and complete";
      const form = document.createElement("div");
      form.className = "reminder-complete-form";
      form.hidden = true;
      const title = document.createElement("input");
      title.className = "form-control";
      title.placeholder = "Interaction title";
      title.value = trim(row.title);
      const details = document.createElement("textarea");
      details.className = "form-control";
      details.placeholder = "What happened?";
      const save = document.createElement("button");
      save.type = "button";
      save.className = "btn-small-primary";
      save.textContent = "Save interaction and complete";
      action.addEventListener("click", () => { form.hidden = !form.hidden; });
      save.addEventListener("click", async () => {
        if (!trim(details.value)) {
          getEl("detailRemindersStatus").textContent = "Describe what happened before completing the reminder.";
          return;
        }
        save.disabled = true;
        try {
          const result = await send("DB_COMPLETE_REMINDER_WITH_NOTE", { payload: {
            reminder_id: row.id,
            note_title: title.value,
            note_description: details.value,
            date: new Date().toISOString(),
            notes_type: "note",
          }});
          if (!result.ok) throw result.error || new Error("Could not complete reminder.");
          await refresh({ force: true });
          await globalObj.PopupNotesController?.refreshAllNoteRelatedViews?.({});
        } catch (e) {
          getEl("detailRemindersStatus").textContent = errorText(e);
        } finally { save.disabled = false; }
      });
      form.append(title, details, save);
      card.append(summary, action, form);
      list.appendChild(card);
    });
  }

  async function refresh() {
    if (!send) return;
    const context = globalObj.PopupNotesController?.getPersonContext?.() || {};
    const payload = context.personId
      ? { contact_id: context.personId }
      : context.companyId ? { company_id: context.companyId } : null;
    if (!payload) { rows = []; render(); return; }
    const status = getEl("detailRemindersStatus");
    if (status) status.textContent = "Loading…";
    try {
      const result = await send("DB_LIST_REMINDERS", { payload });
      if (!result.ok) throw result.error || new Error("Could not load reminders.");
      rows = Array.isArray(result.data?.rows) ? result.data.rows : [];
      if (status) status.textContent = rows.length ? `${rows.length} active` : "";
      render();
    } catch (e) {
      rows = [];
      if (status) status.textContent = errorText(e);
      render();
    }
  }

  globalObj.PopupRemindersController = Object.freeze({ refresh, render });
})(typeof globalThis !== "undefined" ? globalThis : self);
