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

  function isCompanyNotesContext() {
    return (
      typeof globalObj.isCompanyProfileMode === "function" &&
      globalObj.isCompanyProfileMode()
    );
  }

  function getActiveNotesContext() {
    const profile = state.currentProfileContext || {};
    if (isCompanyNotesContext()) {
      const companyRow = globalObj.dbCompanyRow || {};
      const companyId = safeTrim(companyRow.company_id || profile.company_id);
      return {
        contextType: "company",
        personId: "",
        companyId,
        dealId: "",
        personName: "",
        companyName: safeTrim(
          companyRow.company_name ||
            profile.company_name ||
            profile.name ||
            profile.full_name,
        ),
      };
    }

    const row = state.dbInvitationRow || {};
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

  function getPersonContext() {
    return getActiveNotesContext();
  }

  function getContextKey(ctx) {
    return [ctx.contextType, ctx.personId, ctx.companyId, ctx.dealId].join("|");
  }

  function toDateInputValue(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime()))
      return new Date().toISOString().slice(0, 10);
    return date.toISOString().slice(0, 10);
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
    const date = new Date(`${toDateInputValue(dateValue)}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!Number.isNaN(date.getTime()) && date.getTime() > today.getTime()) {
      return "planned";
    }
    return rawStatus;
  }

  function getNoteKind(note) {
    if (safeTrim(note?.deal_id)) return "deal";
    if (safeTrim(note?.main_person_id || note?.person_id)) return "person";
    if (safeTrim(note?.company_id)) return "company";
    return "note";
  }

  function getNoteIcon(note) {
    const kind = getNoteKind(note);
    if (kind === "deal") return "💼";
    if (kind === "person") return "👤";
    if (kind === "company") return "🏢";
    return "📝";
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
    dom.detailNotesTabBtnEl?.classList.toggle("active", notesActive);
    dom.detailPromptsTabBtnEl?.classList.toggle("active", !notesActive);
    if (dom.detailNotesPanelEl) dom.detailNotesPanelEl.hidden = !notesActive;
    if (dom.detailPromptsPanelEl) dom.detailPromptsPanelEl.hidden = notesActive;
    if (notesActive) refreshNotes({ force: false });
  }

  function setNotesStatus(text) {
    if (dom.notesStatusEl) dom.notesStatusEl.textContent = text || "";
  }

  function setFilter(nextFilter) {
    if (isCompanyNotesContext()) {
      localState.filter = "company";
      return;
    }
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

  function renderEditor(note, { isNew = false } = {}) {
    const editor = document.createElement("div");
    editor.className = "note-editor";

    const titleInput = document.createElement("input");
    titleInput.className = "note-title-input";
    titleInput.placeholder = "Note title";
    titleInput.value = safeTrim(note?.note_title);
    editor.appendChild(createField({ label: "Title", child: titleInput }));

    const row = document.createElement("div");
    row.className = "note-editor-row note-editor-row-three";

    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.value = toDateInputValue(note?.date || new Date());
    row.appendChild(createField({ label: "Date", child: dateInput }));

    const statusSelect = document.createElement("select");
    ["ready", "planned"].forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      statusSelect.appendChild(option);
    });
    statusSelect.value =
      safeTrim(note?.status) || deriveStatus(dateInput.value, "ready");
    row.appendChild(createField({ label: "Status", child: statusSelect }));

    const typeSelect = document.createElement("select");
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
    row.appendChild(createField({ label: "Type", child: typeSelect }));
    editor.appendChild(row);

    dateInput.addEventListener("change", () => {
      statusSelect.value = deriveStatus(dateInput.value, statusSelect.value);
    });

    const descriptionInput = document.createElement("textarea");
    descriptionInput.className = "note-description-input";
    descriptionInput.placeholder = "Description";
    descriptionInput.value = safeTrim(note?.note_description);
    editor.appendChild(
      createField({ label: "Description", child: descriptionInput }),
    );

    const actions = document.createElement("div");
    actions.className = "note-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn-small-primary";
    saveBtn.textContent = "Save";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn-small-secondary";
    cancelBtn.textContent = "Cancel";
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    editor.appendChild(actions);

    cancelBtn.addEventListener("click", () => {
      if (isNew) localState.isCreating = false;
      localState.expandedNoteId = null;
      renderNotes();
    });

    saveBtn.addEventListener("click", async () => {
      const ctx = getPersonContext();
      const payload = {
        note_id: note?.note_id,
        note_title: titleInput.value,
        note_description: descriptionInput.value,
        date: dateInput.value,
        status: deriveStatus(dateInput.value, statusSelect.value),
        notes_type: typeSelect.value,
        main_person_id: ctx.contextType === "person" ? ctx.personId : "",
        company_id: ctx.companyId,
        deal_id: ctx.dealId || "",
      };
      try {
        saveBtn.disabled = true;
        setNotesStatus("Saving note...");
        const type = isNew ? "DB_CREATE_NOTE" : "DB_UPDATE_NOTE";
        const result = await sendRuntimeMessage(type, { payload });
        const resp = result.data || {};
        if (!result.ok || resp?.ok === false) {
          throw new Error(getErrorMessage(result.error || resp?.error));
        }
        localState.isCreating = false;
        localState.expandedNoteId = null;
        await refreshNotes({ force: true });
      } catch (e) {
        setNotesStatus(getErrorMessage(e));
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
    const left = document.createElement("span");
    left.className = "note-card-summary";
    const icon = document.createElement("span");
    icon.className = "note-type-icon";
    icon.textContent = getNoteIcon(note);
    const date = document.createElement("span");
    date.className = "note-date";
    date.textContent = formatDate(note?.date || note?.created_at);
    const related = document.createElement("span");
    related.className = "note-related-name";
    related.textContent = getRelatedName(note, ctx);
    left.append(icon, date, related);

    const right = document.createElement("span");
    right.className = "note-card-title";
    right.textContent = safeTrim(note?.note_title) || "(no title)";
    header.append(left, right);
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
    header.textContent =
      ctx.contextType === "company"
        ? `New note for ${ctx.companyName || "company"}`
        : `New note for ${ctx.personName || "person"}`;
    card.appendChild(header);
    card.appendChild(
      renderEditor(
        {
          note_title: "",
          note_description: "",
          date: new Date().toISOString(),
          status: "ready",
          notes_type: "note",
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
      empty.textContent =
        ctx.contextType === "company"
          ? ctx.companyId
            ? "No notes found."
            : "Save or register this company before adding notes."
          : ctx.personId
            ? "No notes found."
            : "Save or register this person before adding notes.";
      dom.notesListEl.appendChild(empty);
      return;
    }

    for (const note of localState.notes) {
      dom.notesListEl.appendChild(renderNoteCard(note, ctx));
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
    if (ctx.contextType === "company" && !ctx.companyId) {
      localState.notes = [];
      localState.loadedContextKey = key;
      setNotesStatus("Company must exist before notes can be loaded.");
      renderNotes();
      return;
    }
    if (ctx.contextType === "person" && !ctx.personId) {
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
          filter: ctx.contextType === "company" ? "company" : localState.filter,
          person_id: ctx.personId,
          company_id: ctx.companyId,
          context_type: ctx.contextType,
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

  function onProfileContextChanged() {
    localState.loadedContextKey = "";
    localState.expandedNoteId = null;
    localState.isCreating = false;
    if (isCompanyNotesContext()) {
      localState.filter = "company";
      if (globalObj.PopupCompanyController?.setCompanyDetailTab) {
        // Keep the company tab state, but make sure notes refresh when active.
        const notesActive =
          dom.companyNotesTabBtnEl?.classList.contains("active");
        if (notesActive) refreshNotes({ force: true });
      }
      return;
    }
    if (!dom.detailNotesPanelEl?.hidden) refreshNotes({ force: true });
  }

  function init() {
    bindEvents();
    setActiveSubtab("notes");
  }

  const api = {
    init,
    refreshNotes,
    renderNotes,
    setActiveSubtab,
    onProfileContextChanged,
  };

  globalObj.PopupNotesController = Object.freeze(api);
  globalObj.refreshNotes = refreshNotes;
})(typeof globalThis !== "undefined" ? globalThis : self);
