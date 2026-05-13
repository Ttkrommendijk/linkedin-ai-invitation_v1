// Owns reusable notes UI for person, company and deal contexts.
(function initNotesController(globalObj) {
  const dom = globalObj.PopupDom || {};
  const state = globalObj.PopupState || {};
  const utils = globalObj.PopupUtils || {};
  const sendRuntimeMessage =
    utils.sendRuntimeMessage || globalObj.sendRuntimeMessage;
  const getErrorMessage =
    utils.getErrorMessage ||
    globalObj.getErrorMessage ||
    ((e) => String(e || "Unexpected error."));
  const safeTrim =
    utils.safeTrim || ((value) => (value == null ? "" : String(value).trim()));

  const localState = {
    filter: "company",
    notes: [],
    expandedNoteId: null,
    isCreating: false,
    loadedContextKey: "",
  };

  function hasRequiredDom() {
    return Boolean(
      dom.detailNotesTabBtnEl &&
      dom.detailPromptsTabBtnEl &&
      dom.detailNotesPanelEl &&
      dom.detailPromptsPanelEl &&
      dom.notesListEl,
    );
  }

  function getPersonContext() {
    const row = state.dbInvitationRow || {};
    const profile = state.currentProfileContext || {};
    const personId = safeTrim(row.id || row.person_id);
    const companyId = safeTrim(row.company_id || profile.company_id);
    return {
      contextType: "person",
      personId,
      companyId,
      dealId: "",
      personName: safeTrim(row.full_name || profile.full_name || profile.name),
      companyName: safeTrim(
        row.company || profile.company || profile.company_name,
      ),
    };
  }

  function getContextKey(ctx) {
    return [ctx.contextType, ctx.personId, ctx.companyId, ctx.dealId].join("|");
  }

  function toDateTimeInputValue(value) {
    const date = value ? new Date(value) : new Date();
    const normalized = Number.isNaN(date.getTime()) ? new Date() : date;
    const offsetMs = normalized.getTimezoneOffset() * 60000;
    return new Date(normalized.getTime() - offsetMs).toISOString().slice(0, 16);
  }

  function formatDate(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "-";
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

  function deriveStatus(dateValue, selectedStatus) {
    const rawStatus = safeTrim(selectedStatus) || "ready";
    const date = new Date(dateValue);
    const now = new Date();
    if (!Number.isNaN(date.getTime()) && date.getTime() > now.getTime()) {
      return "planned";
    }
    return rawStatus;
  }

  function normalizeDuration(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return "";
    return String(Math.round(number));
  }

  function getNoteKind(note) {
    if (safeTrim(note?.deal_id)) return "deal";
    if (safeTrim(note?.main_person_id || note?.person_id)) return "person";
    if (safeTrim(note?.company_id)) return "company";
    return "note";
  }

  function getRelatedEntityIcon(note) {
    const kind = getNoteKind(note);
    if (kind === "deal") return "💼";
    if (kind === "person") return "👤";
    if (kind === "company") return "🏢";
    return "📝";
  }

  function getNoteTypeIcon(note) {
    const type = safeTrim(note?.notes_type).toLowerCase();
    if (type === "whatsapp") return "whatsapp";
    if (type === "linkedin") return "in";
    if (type === "meeting") return "calendar";
    if (type === "telefone" || type === "phone" || type === "telephone") return "☎";
    if (type === "email") return "✉";
    return "📝";
  }

  function setNoteTypeIconContent(icon, note) {
    const type = safeTrim(note?.notes_type).toLowerCase();
    icon.classList.remove(
      "note-type-whatsapp-icon",
      "note-type-linkedin-icon",
      "note-type-calendar-icon",
    );

    if (type === "whatsapp") {
      icon.classList.add("note-type-whatsapp-icon");
      icon.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16.02 3.2c-7.02 0-12.72 5.63-12.72 12.56 0 2.21.59 4.37 1.7 6.27l-1.8 6.77 6.96-1.76a12.9 12.9 0 0 0 5.86 1.41c7.01 0 12.72-5.64 12.72-12.57 0-6.94-5.71-12.68-12.72-12.68Zm0 22.95c-1.85 0-3.66-.5-5.24-1.45l-.38-.23-4.13 1.04 1.08-4.01-.25-.4a10.12 10.12 0 0 1-1.55-5.34c0-5.66 4.7-10.26 10.47-10.26s10.46 4.6 10.46 10.26c0 5.66-4.69 10.39-10.46 10.39Zm5.72-7.7c-.31-.16-1.86-.91-2.15-1.02-.29-.1-.5-.16-.71.16-.21.31-.82 1.02-1 1.22-.19.21-.37.23-.68.08-.31-.16-1.32-.48-2.52-1.54-.93-.82-1.56-1.84-1.74-2.15-.18-.31-.02-.48.14-.64.14-.14.31-.37.47-.55.15-.18.2-.31.31-.52.1-.21.05-.39-.03-.55-.08-.16-.71-1.7-.97-2.33-.25-.61-.51-.52-.71-.53h-.61c-.21 0-.55.08-.84.39-.29.31-1.1 1.07-1.1 2.6 0 1.54 1.13 3.03 1.29 3.24.16.21 2.23 3.37 5.41 4.73.76.32 1.35.51 1.81.65.76.24 1.45.21 2 .13.61-.09 1.86-.75 2.13-1.48.26-.73.26-1.35.18-1.48-.08-.13-.29-.21-.6-.37Z" /></svg>`;
      return;
    }

    if (type === "meeting") {
      icon.classList.add("note-type-calendar-icon");
      icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1.5A2.5 2.5 0 0 1 22 6.5v12A2.5 2.5 0 0 1 19.5 21h-15A2.5 2.5 0 0 1 2 18.5v-12A2.5 2.5 0 0 1 4.5 4H6V3a1 1 0 0 1 1-1Zm12.5 8h-15v8.5a.5.5 0 0 0 .5.5h14a.5.5 0 0 0 .5-.5V10ZM5 6a.5.5 0 0 0-.5.5V8h15V6.5A.5.5 0 0 0 19 6H5Zm2 7.25c0-.41.34-.75.75-.75h2.5c.41 0 .75.34.75.75v2.5c0 .41-.34.75-.75.75h-2.5a.75.75 0 0 1-.75-.75v-2.5Z" /></svg>`;
      return;
    }

    icon.textContent = getNoteTypeIcon(note);
  }

  function isNoteOverdue(note) {
    const status = safeTrim(note?.status).toLowerCase();
    if (status === "ready" || status === "done" || status === "completed" || status === "canceled" || status === "cancelled") {
      return false;
    }
    const date = new Date(note?.date);
    return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
  }

  function getNoteStatusIndicator(note) {
    const status = safeTrim(note?.status).toLowerCase();
    if (isNoteOverdue(note)) {
      return { className: "note-status-icon note-status-overdue", text: "⏱", label: "Overdue" };
    }
    if (status === "ready" || status === "done" || status === "completed") {
      return { className: "note-status-icon note-status-ready", text: "✓", label: "Ready" };
    }
    if (status === "canceled" || status === "cancelled") {
      return { className: "note-status-icon note-status-canceled", text: "✕", label: "Canceled" };
    }
    return { className: "note-status-icon note-status-open", text: "○", label: status || "Open" };
  }

  function appendNoteTypeIcon(parent, note) {
    const icon = document.createElement("span");
    icon.className = "note-type-icon note-type-title-icon";
    if (safeTrim(note?.notes_type).toLowerCase() === "linkedin") {
      icon.classList.add("note-type-linkedin-icon");
    }
    setNoteTypeIconContent(icon, note);
    icon.title = safeTrim(note?.notes_type) || "Note";
    parent.appendChild(icon);
  }

  function appendNoteStatusIndicator(parent, note) {
    const indicator = getNoteStatusIndicator(note);
    const icon = document.createElement("span");
    icon.className = indicator.className;
    icon.textContent = indicator.text;
    icon.title = indicator.label;
    icon.setAttribute("aria-label", indicator.label);
    parent.appendChild(icon);
  }

  function getRelatedName(note, ctx) {
    const kind = getNoteKind(note);
    if (kind === "deal") return safeTrim(note?.deal_name) || "Deal";
    if (kind === "person")
      return safeTrim(note?.person_name) || ctx.personName || "Person";
    if (kind === "company")
      return safeTrim(note?.company_name) || ctx.companyName || "Company";
    return "Note";
  }

  function setActiveSubtab(which) {
    const notesActive = which === "notes";
    const dealsActive = which === "deals";
    const promptsActive = which === "prompts";
    dom.detailNotesTabBtnEl?.classList.toggle("active", notesActive);
    dom.detailDealsTabBtnEl?.classList.toggle("active", dealsActive);
    dom.detailPromptsTabBtnEl?.classList.toggle("active", promptsActive);
    if (dom.detailNotesPanelEl) dom.detailNotesPanelEl.hidden = !notesActive;
    if (dom.detailDealsPanelEl) dom.detailDealsPanelEl.hidden = !dealsActive;
    if (dom.detailPromptsPanelEl)
      dom.detailPromptsPanelEl.hidden = !promptsActive;
    if (notesActive) refreshNotes({ force: false });
    if (dealsActive) globalObj.refreshDeals?.({ force: false });
  }

  function setNotesStatus(text) {
    if (dom.notesStatusEl) dom.notesStatusEl.textContent = text || "";
  }

  function setFilter(nextFilter) {
    localState.filter = nextFilter === "person" ? "person" : "company";
    dom.notesFilterCompanyEl?.classList.toggle(
      "active",
      localState.filter === "company",
    );
    dom.notesFilterPersonEl?.classList.toggle(
      "active",
      localState.filter === "person",
    );
    refreshNotes({ force: true });
  }

  function createField({ label, child }) {
    const wrap = document.createElement("label");
    wrap.className = "note-field";
    const caption = document.createElement("small");
    caption.textContent = label;
    wrap.appendChild(caption);
    wrap.appendChild(child);
    return wrap;
  }

  function renderEditor(
    note,
    {
      isNew = false,
      contextOverride = null,
      onSaved = null,
      onCancel = null,
      onDeleted = null,
      statusSetter = null,
    } = {},
  ) {
    const editor = document.createElement("div");
    editor.className = "note-editor";

    const titleInput = document.createElement("input");
    titleInput.className = "form-control note-title-input";
    titleInput.placeholder = "Note title";
    titleInput.value = safeTrim(note?.note_title);
    editor.appendChild(createField({ label: "Title", child: titleInput }));

    const dateStatusRow = document.createElement("div");
    dateStatusRow.className = "note-editor-row note-editor-row-date-status";

    const dateInput = document.createElement("input");
    dateInput.className = "form-control";
    dateInput.type = "datetime-local";
    dateInput.value = toDateTimeInputValue(note?.date || new Date());
    dateStatusRow.appendChild(
      createField({ label: "Date and time", child: dateInput }),
    );

    const statusSelect = document.createElement("select");
    statusSelect.className = "form-control";
    ["ready", "planned", "canceled"].forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      statusSelect.appendChild(option);
    });
    statusSelect.value =
      safeTrim(note?.status) || deriveStatus(dateInput.value, "ready");
    dateStatusRow.appendChild(
      createField({ label: "Status", child: statusSelect }),
    );
    editor.appendChild(dateStatusRow);

    const typeDurationRow = document.createElement("div");
    typeDurationRow.className = "note-editor-row note-editor-row-type-duration";

    const typeSelect = document.createElement("select");
    typeSelect.className = "form-control";
    [
      ["note", "Note"],
      ["email", "Email"],
      ["whatsapp", "WhatsApp"],
      ["linkedin", "LinkedIn"],
      ["telefone", "Telefone"],
      ["meeting", "Meeting"],
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      typeSelect.appendChild(option);
    });
    typeSelect.value = safeTrim(note?.notes_type) || "note";
    typeDurationRow.appendChild(
      createField({ label: "Type", child: typeSelect }),
    );

    const durationInput = document.createElement("input");
    durationInput.className = "form-control";
    durationInput.type = "number";
    durationInput.min = "0";
    durationInput.step = "1";
    durationInput.placeholder = "Duration in minutes";
    durationInput.value = normalizeDuration(note?.duration);
    typeDurationRow.appendChild(
      createField({ label: "Duration in minutes", child: durationInput }),
    );
    editor.appendChild(typeDurationRow);

    dateInput.addEventListener("change", () => {
      statusSelect.value = deriveStatus(dateInput.value, statusSelect.value);
    });

    const descriptionInput = document.createElement("textarea");
    descriptionInput.className = "form-control note-description-input";
    descriptionInput.placeholder = "Description";
    descriptionInput.value = safeTrim(note?.note_description);
    editor.appendChild(
      createField({ label: "Description", child: descriptionInput }),
    );

    const actions = document.createElement("div");
    actions.className = "note-actions";

    const deleteGroup = document.createElement("div");
    deleteGroup.className = "note-actions-left";
    const submitGroup = document.createElement("div");
    submitGroup.className = "note-actions-right";

    let deleteBtn = null;
    if (!isNew && safeTrim(note?.note_id)) {
      deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn-icon-danger note-delete-btn";
      deleteBtn.title = "Delete note permanently";
      deleteBtn.setAttribute("aria-label", "Delete note permanently");
      deleteBtn.textContent = "🗑";
      deleteGroup.appendChild(deleteBtn);
    }

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn-small-primary";
    saveBtn.textContent = "Save";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn-small-secondary";
    cancelBtn.textContent = "Cancel";
    submitGroup.append(saveBtn, cancelBtn);
    actions.append(deleteGroup, submitGroup);
    editor.appendChild(actions);

    cancelBtn.addEventListener("click", () => {
      if (typeof onCancel === "function") {
        onCancel();
        return;
      }
      if (isNew) localState.isCreating = false;
      localState.expandedNoteId = null;
      renderNotes();
    });

    deleteBtn?.addEventListener("click", async () => {
      const noteId = safeTrim(note?.note_id);
      if (!noteId) return;
      const confirmed = globalObj.confirm
        ? globalObj.confirm("Delete this note permanently?")
        : true;
      if (!confirmed) return;
      try {
        deleteBtn.disabled = true;
        saveBtn.disabled = true;
        cancelBtn.disabled = true;
        const setStatus =
          typeof statusSetter === "function" ? statusSetter : setNotesStatus;
        setStatus("Deleting note...");
        const result = await sendRuntimeMessage("DB_DELETE_NOTE", {
          payload: { note_id: noteId },
        });
        const resp = result.data || {};
        if (!result.ok || resp?.ok === false) {
          throw new Error(getErrorMessage(result.error || resp?.error));
        }
        localState.expandedNoteId = null;
        localState.notes = localState.notes.filter(
          (item) => safeTrim(item?.note_id) !== noteId,
        );

        if (typeof onDeleted === "function") {
          await onDeleted(noteId);
        }

        await refreshAllNoteRelatedViews({ statusSetter });
      } catch (e) {
        const setStatus =
          typeof statusSetter === "function" ? statusSetter : setNotesStatus;
        setStatus(getErrorMessage(e));
        deleteBtn.disabled = false;
        saveBtn.disabled = false;
        cancelBtn.disabled = false;
      }
    });

    saveBtn.addEventListener("click", async () => {
      const ctx =
        typeof contextOverride === "function"
          ? contextOverride()
          : contextOverride || getPersonContext();
      if (ctx.requirePersonId && !safeTrim(ctx.personId)) {
        const setStatus =
          typeof statusSetter === "function" ? statusSetter : setNotesStatus;
        setStatus("Select a person before saving this deal note.");
        return;
      }
      const payload = {
        note_id: note?.note_id,
        note_title: titleInput.value,
        note_description: descriptionInput.value,
        date: dateInput.value,
        status: deriveStatus(dateInput.value, statusSelect.value),
        notes_type: typeSelect.value,
        duration: normalizeDuration(durationInput.value) || null,
        main_person_id: ctx.personId,
        company_id: ctx.companyId,
        deal_id: safeTrim(ctx.dealId),
      };
      try {
        saveBtn.disabled = true;
        const setStatus =
          typeof statusSetter === "function" ? statusSetter : setNotesStatus;
        setStatus("Saving note...");
        const type = isNew ? "DB_CREATE_NOTE" : "DB_UPDATE_NOTE";
        const result = await sendRuntimeMessage(type, { payload });
        const resp = result.data || {};
        if (!result.ok || resp?.ok === false) {
          throw new Error(getErrorMessage(result.error || resp?.error));
        }
        if (typeof onSaved === "function") {
          await onSaved(resp.note || null);
          await refreshAllNoteRelatedViews({ statusSetter });
        } else {
          localState.isCreating = false;
          localState.expandedNoteId = null;
          await refreshAllNoteRelatedViews({ statusSetter });
        }
      } catch (e) {
        const setStatus =
          typeof statusSetter === "function" ? statusSetter : setNotesStatus;
        setStatus(getErrorMessage(e));
      } finally {
        saveBtn.disabled = false;
      }
    });

    return editor;
  }

  function renderNoteCard(note, ctx) {
    const noteId = safeTrim(note?.note_id);
    const expanded = localState.expandedNoteId === noteId;
    const card = document.createElement("div");
    card.className = "note-card";

    const header = document.createElement("button");
    header.type = "button";
    header.className = "note-card-header";

    const stack = document.createElement("span");
    stack.className = "note-card-header-stack";

    const topRow = document.createElement("span");
    topRow.className = "note-card-top-row";

    const left = document.createElement("span");
    left.className = "note-card-summary";
    const relatedIcon = document.createElement("span");
    relatedIcon.className = "note-related-icon";
    relatedIcon.textContent = getRelatedEntityIcon(note);
    const date = document.createElement("span");
    date.className = "note-date";
    date.textContent = formatDate(note?.date || note?.created_at);
    const related = document.createElement("span");
    related.className = "note-related-name";
    related.textContent = getRelatedName(note, ctx);
    left.append(relatedIcon, date, related);

    const statusWrap = document.createElement("span");
    statusWrap.className = "note-card-status-wrap";
    appendNoteStatusIndicator(statusWrap, note);
    topRow.append(left, statusWrap);

    const titleRow = document.createElement("span");
    titleRow.className = "note-card-title-row";
    appendNoteTypeIcon(titleRow, note);
    const title = document.createElement("span");
    title.className = "note-card-title";
    title.textContent = safeTrim(note?.note_title) || "(no title)";
    titleRow.appendChild(title);

    stack.append(topRow, titleRow);
    header.appendChild(stack);
    header.addEventListener("click", () => {
      localState.expandedNoteId = expanded ? null : noteId;
      localState.isCreating = false;
      renderNotes();
    });
    card.appendChild(header);

    if (expanded) {
      const body = document.createElement("div");
      body.className = "note-card-body";
      body.appendChild(renderEditor(note));
      card.appendChild(body);
    }

    return card;
  }

  function renderCreateCard() {
    const ctx = getPersonContext();
    const card = document.createElement("div");
    card.className = "note-card note-card-new";
    const header = document.createElement("div");
    header.className = "note-card-header note-card-header-static";
    header.textContent = `New note for ${ctx.personName || "person"}`;
    card.appendChild(header);
    card.appendChild(
      renderEditor(
        {
          note_title: "",
          note_description: "",
          date: new Date().toISOString(),
          status: "ready",
          notes_type: "note",
          duration: "",
        },
        { isNew: true },
      ),
    );
    return card;
  }

  function renderNotes() {
    if (!dom.notesListEl) return;
    const ctx = getPersonContext();
    dom.notesListEl.innerHTML = "";

    if (localState.isCreating) {
      dom.notesListEl.appendChild(renderCreateCard());
    }

    if (!localState.notes.length && !localState.isCreating) {
      const empty = document.createElement("div");
      empty.className = "notes-empty";
      empty.textContent = ctx.personId
        ? "No notes found."
        : "Save or register this person before adding notes.";
      dom.notesListEl.appendChild(empty);
      return;
    }

    for (const note of localState.notes) {
      dom.notesListEl.appendChild(renderNoteCard(note, ctx));
    }
  }

  async function refreshAllNoteRelatedViews({ statusSetter = null } = {}) {
    const setStatus =
      typeof statusSetter === "function" ? statusSetter : setNotesStatus;
    try {
      await refreshNotes({ force: true });
      if (typeof globalObj.refreshDeals === "function") {
        await globalObj.refreshDeals({ force: true });
      }
    } catch (e) {
      setStatus(getErrorMessage(e));
    }
  }

  async function refreshNotes({ force = false } = {}) {
    if (!hasRequiredDom() || !sendRuntimeMessage) return;
    const ctx = getPersonContext();
    const key = `${getContextKey(ctx)}|${localState.filter}`;
    if (
      !force &&
      localState.loadedContextKey === key &&
      localState.notes.length
    ) {
      renderNotes();
      return;
    }
    if (!ctx.personId) {
      localState.notes = [];
      localState.loadedContextKey = key;
      setNotesStatus("Person must exist before notes can be loaded.");
      renderNotes();
      return;
    }
    try {
      setNotesStatus("Loading notes...");
      const result = await sendRuntimeMessage("DB_LIST_NOTES", {
        payload: {
          filter: localState.filter,
          person_id: ctx.personId,
          company_id: ctx.companyId,
        },
      });
      const resp = result.data || {};
      if (!result.ok || resp?.ok === false) {
        throw new Error(getErrorMessage(result.error || resp?.error));
      }
      localState.notes = Array.isArray(resp.rows) ? resp.rows : [];
      localState.loadedContextKey = key;
      setNotesStatus(localState.notes.length ? "" : "No notes found.");
      renderNotes();
    } catch (e) {
      localState.notes = [];
      setNotesStatus(getErrorMessage(e));
      renderNotes();
    }
  }

  function bindEvents() {
    if (!hasRequiredDom()) return;
    dom.detailNotesTabBtnEl.addEventListener("click", () =>
      setActiveSubtab("notes"),
    );
    dom.detailDealsTabBtnEl?.addEventListener("click", () =>
      setActiveSubtab("deals"),
    );
    dom.detailPromptsTabBtnEl.addEventListener("click", () =>
      setActiveSubtab("prompts"),
    );
    dom.notesFilterCompanyEl?.addEventListener("click", () =>
      setFilter("company"),
    );
    dom.notesFilterPersonEl?.addEventListener("click", () =>
      setFilter("person"),
    );
    dom.addNoteBtnEl?.addEventListener("click", () => {
      localState.isCreating = true;
      localState.expandedNoteId = null;
      renderNotes();
    });
  }

  function init() {
    bindEvents();
    setActiveSubtab("notes");
  }

  function renderNoteEditorForContext(options = {}) {
    return renderEditor(
      options.note || {
        note_title: "",
        note_description: "",
        date: new Date().toISOString(),
        status: "ready",
        notes_type: "note",
        duration: "",
      },
      {
        isNew: options.isNew !== false,
        contextOverride: options.contextOverride || null,
        onSaved: options.onSaved || null,
        onCancel: options.onCancel || null,
        onDeleted: options.onDeleted || null,
        statusSetter: options.statusSetter || null,
      },
    );
  }

  const api = {
    init,
    refreshNotes,
    renderNotes,
    refreshAllNoteRelatedViews,
    setActiveSubtab,
    renderNoteEditorForContext,
  };

  globalObj.PopupNotesController = Object.freeze(api);
  globalObj.refreshNotes = refreshNotes;
})(typeof globalThis !== "undefined" ? globalThis : self);
