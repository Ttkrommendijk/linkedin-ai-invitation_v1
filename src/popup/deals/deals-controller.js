// Owns reusable deals UI for person and company contexts.
(function initDealsController(globalObj) {
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
    deals: [],
    expandedDealId: null,
    editingDealId: null,
    addingNoteDealId: null,
    dealNotesByDealId: {},
    dealNotesLoadingByDealId: {},
    isCreating: false,
    loadedCompanyId: "",
    companyPeopleRows: [],
    loadedCompanyPeopleId: "",
    companyPeopleLoading: false,
  };

  function hasRequiredDom() {
    return Boolean(dom.detailDealsPanelEl && dom.dealsListEl);
  }

  function isCompanyProfileMode() {
    return typeof globalObj.isCompanyProfileMode === "function"
      ? globalObj.isCompanyProfileMode()
      : false;
  }

  function getDealsContext() {
    const row = state.dbInvitationRow || {};
    const profile = state.currentProfileContext || {};
    const companyRow = globalObj.dbCompanyRow || {};
    const isCompany = isCompanyProfileMode();
    const companyId = isCompany
      ? safeTrim(companyRow.company_id || profile.company_id)
      : safeTrim(row.company_id || profile.company_id);
    const companyName = isCompany
      ? safeTrim(companyRow.company_name || profile.company_name || profile.company)
      : safeTrim(row.company || profile.company || profile.company_name);
    const personId = isCompany ? "" : safeTrim(row.id || row.person_id);
    const personName = isCompany
      ? ""
      : safeTrim(row.full_name || profile.full_name || profile.name);
    return { isCompany, companyId, companyName, personId, personName };
  }

  function getCompanyPeopleRows() {
    const controller = globalObj.PopupCompanyController;
    const controllerRows =
      typeof controller?.getCompanyPeopleRows === "function"
        ? controller.getCompanyPeopleRows()
        : [];
    const rowsById = new Map();
    const addRow = (row) => {
      const id = safeTrim(row?.id || row?.person_id || row?.main_person_id);
      if (!id || rowsById.has(id)) return;
      rowsById.set(id, row);
    };
    for (const row of Array.isArray(controllerRows) ? controllerRows : []) addRow(row);
    for (const row of Array.isArray(localState.companyPeopleRows) ? localState.companyPeopleRows : []) addRow(row);

    const ctx = getDealsContext();
    if (ctx.personId) {
      addRow({
        id: ctx.personId,
        full_name: ctx.personName || "Current person",
        company_id: ctx.companyId,
      });
    }
    return Array.from(rowsById.values());
  }

  async function ensureCompanyPeopleRows({ force = false } = {}) {
    const ctx = getDealsContext();
    if (!ctx.companyId || !sendRuntimeMessage || localState.companyPeopleLoading) return;
    if (!force && localState.loadedCompanyPeopleId === ctx.companyId) return;
    localState.companyPeopleLoading = true;
    try {
      const result = await sendRuntimeMessage("DB_LIST_INVITATIONS_BY_COMPANY", {
        payload: { company_id: ctx.companyId },
      });
      const resp = result.data || {};
      if (!result.ok || resp?.ok === false) {
        throw new Error(getErrorMessage(result.error || resp?.error));
      }
      localState.companyPeopleRows = Array.isArray(resp.rows) ? resp.rows : [];
      localState.loadedCompanyPeopleId = ctx.companyId;
    } catch (e) {
      localState.companyPeopleRows = [];
      localState.loadedCompanyPeopleId = "";
      setDealsStatus(getErrorMessage(e));
    } finally {
      localState.companyPeopleLoading = false;
    }
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
    if (isNoteOverdue(note)) return { className: "note-status-icon note-status-overdue", text: "⏱", label: "Overdue" };
    if (status === "ready" || status === "done" || status === "completed") return { className: "note-status-icon note-status-ready", text: "✓", label: "Ready" };
    if (status === "canceled" || status === "cancelled") return { className: "note-status-icon note-status-canceled", text: "✕", label: "Canceled" };
    return { className: "note-status-icon note-status-open", text: "○", label: status || "Open" };
  }

  function appendDealNoteTypeIcon(parent, note) {
    const icon = document.createElement("span");
    icon.className = "note-type-icon note-type-title-icon";
    if (safeTrim(note?.notes_type).toLowerCase() === "linkedin") {
      icon.classList.add("note-type-linkedin-icon");
    }
    setNoteTypeIconContent(icon, note);
    icon.title = safeTrim(note?.notes_type) || "Note";
    parent.appendChild(icon);
  }

  function appendDealNoteStatusIndicator(parent, note) {
    const indicator = getNoteStatusIndicator(note);
    const icon = document.createElement("span");
    icon.className = indicator.className;
    icon.textContent = indicator.text;
    icon.title = indicator.label;
    icon.setAttribute("aria-label", indicator.label);
    parent.appendChild(icon);
  }

  function formatMoney(value) {
    if (value === null || value === undefined || value === "") return "";
    const number = Number(value);
    if (!Number.isFinite(number)) return safeTrim(value);
    try {
      return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
      }).format(number);
    } catch (_e) {
      return String(number);
    }
  }

  function createField({ label, child }) {
    const wrap = document.createElement("label");
    wrap.className = "deal-field";
    const caption = document.createElement("small");
    caption.textContent = label;
    wrap.appendChild(caption);
    wrap.appendChild(child);
    return wrap;
  }

  function createMiniNoteCard(note) {
    const card = document.createElement("div");
    card.className = "deal-linked-note-card";

    const top = document.createElement("div");
    top.className = "deal-linked-note-top";

    const noteInfo = document.createElement("div");
    noteInfo.className = "deal-linked-note-info";

    const meta = document.createElement("div");
    meta.className = "deal-linked-note-meta";
    const metaText = document.createElement("span");
    metaText.textContent = [
      formatDate(note?.date || note?.created_at),
      safeTrim(note?.person_name),
    ]
      .filter(Boolean)
      .join(" | ");
    meta.appendChild(metaText);
    appendDealNoteStatusIndicator(meta, note);

    const title = document.createElement("div");
    title.className = "deal-linked-note-title";
    appendDealNoteTypeIcon(title, note);
    const titleText = document.createElement("span");
    titleText.textContent = safeTrim(note?.note_title) || "(no title)";
    title.appendChild(titleText);

    noteInfo.append(meta, title);
    top.append(noteInfo);

    const description = document.createElement("div");
    description.className = "deal-linked-note-description";
    description.textContent = safeTrim(note?.note_description) || "No details available.";

    const editorWrap = document.createElement("div");
    editorWrap.hidden = true;

    function ensureEditor() {
      if (editorWrap.childElementCount) return true;
      const noteApi = globalObj.PopupNotesController;
      if (typeof noteApi?.renderNoteEditorForContext !== "function") return false;

      editorWrap.appendChild(
        noteApi.renderNoteEditorForContext({
          note,
          isNew: false,
          onSaved: async () => {
            editorWrap.hidden = true;
            await refreshDeals({ force: true });
          },
          onDeleted: async () => {
            editorWrap.hidden = true;
            await refreshDeals({ force: true });
          },
          onCancel: () => {
            editorWrap.hidden = true;
          },
          statusSetter: setDealsStatus,
        }),
      );
      return true;
    }

    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Edit note ${safeTrim(note?.note_title) || "without title"}`);
    card.addEventListener("click", (event) => {
      if (event.target?.closest?.(".note-editor, button, input, select, textarea, a")) return;
      if (ensureEditor()) editorWrap.hidden = !editorWrap.hidden;
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (ensureEditor()) editorWrap.hidden = !editorWrap.hidden;
    });

    card.append(top, description, editorWrap);
    return card;
  }

  async function loadDealNotes(dealId, { force = false } = {}) {
    const ctx = getDealsContext();
    if (!dealId || !ctx.companyId || !sendRuntimeMessage) return;
    if (!force && Array.isArray(localState.dealNotesByDealId[dealId])) return;
    if (localState.dealNotesLoadingByDealId[dealId]) return;
    localState.dealNotesLoadingByDealId[dealId] = true;
    try {
      const result = await sendRuntimeMessage("DB_LIST_NOTES", {
        payload: {
          filter: "deal",
          deal_id: dealId,
          company_id: ctx.companyId,
        },
      });
      const resp = result.data || {};
      if (!result.ok || resp?.ok === false) {
        throw new Error(getErrorMessage(result.error || resp?.error));
      }
      localState.dealNotesByDealId[dealId] = Array.isArray(resp.rows)
        ? resp.rows
        : [];
    } catch (e) {
      localState.dealNotesByDealId[dealId] = [];
      setDealsStatus(getErrorMessage(e));
    } finally {
      localState.dealNotesLoadingByDealId[dealId] = false;
      if (localState.expandedDealId === dealId) renderDeals();
    }
  }

  function renderPersonSelect(selectedPersonId = "") {
    const rows = getCompanyPeopleRows();
    const select = document.createElement("select");
    select.className = "form-control deal-note-person-select";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = rows.length ? "No main contact" : "No linked persons found";
    select.appendChild(placeholder);

    for (const row of rows) {
      const personId = safeTrim(row?.id || row?.person_id || row?.main_person_id);
      if (!personId) continue;
      const option = document.createElement("option");
      option.value = personId;
      option.textContent = safeTrim(row?.full_name || row?.name) || "Unnamed person";
      select.appendChild(option);
    }
    select.value = safeTrim(selectedPersonId);
    return select;
  }

  function renderDealNoteEditor(deal) {
    const ctx = getDealsContext();
    const dealId = safeTrim(deal?.deal_id);
    const wrap = document.createElement("div");
    wrap.className = "deal-note-editor-wrap";

    let personSelect = null;
    if (ctx.isCompany) {
      personSelect = renderPersonSelect();
      wrap.appendChild(createField({ label: "Person", child: personSelect }));
    }

    const noteApi = globalObj.PopupNotesController;
    if (typeof noteApi?.renderNoteEditorForContext !== "function") {
      const missing = document.createElement("div");
      missing.className = "notes-empty";
      missing.textContent = "Note form is not available.";
      wrap.appendChild(missing);
      return wrap;
    }

    const editor = noteApi.renderNoteEditorForContext({
      isNew: true,
      contextOverride: () => ({
        contextType: "deal",
        personId: ctx.isCompany ? safeTrim(personSelect?.value) : ctx.personId,
        companyId: ctx.companyId,
        dealId,
        personName: ctx.isCompany ? "" : ctx.personName,
        companyName: ctx.companyName,
        requirePersonId: ctx.isCompany,
      }),
      onCancel: () => {
        localState.addingNoteDealId = null;
        renderDeals();
      },
      onSaved: async () => {
        localState.addingNoteDealId = null;
        await loadDealNotes(dealId, { force: true });
        await globalObj.PopupNotesController?.refreshAllNoteRelatedViews?.({
          statusSetter: setDealsStatus,
        });
      },
      statusSetter: setDealsStatus,
    });
    wrap.appendChild(editor);
    return wrap;
  }

  function renderEditor(deal = {}) {
    const dealId = safeTrim(deal?.deal_id);
    const isEditing = Boolean(dealId);
    const editor = document.createElement("div");
    editor.className = "deal-editor";

    const nameInput = document.createElement("input");
    nameInput.className = "form-control deal-name-input";
    nameInput.placeholder = "Deal title";
    nameInput.value = safeTrim(deal?.deal_name);
    editor.appendChild(createField({ label: "Title", child: nameInput }));

    const row = document.createElement("div");
    row.className = "deal-editor-row";

    const phaseInput = document.createElement("select");
    phaseInput.className = "form-control deal-phase-input";
    const phaseOptions = [
      ["", "Select phase"],
      ["identification", "Identification"],
      ["confirmed", "Confirmed"],
      ["first_meeting", "First meeting"],
      ["follow", "Follow"],
      ["negotiation", "Negotiation"],
      ["closed", "Closed"],
      ["cancelled", "Cancelled"],
    ];
    const currentPhase = safeTrim(deal?.deal_phase);
    for (const [value, label] of phaseOptions) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      phaseInput.appendChild(option);
    }
    phaseInput.value = currentPhase;
    row.appendChild(createField({ label: "Phase", child: phaseInput }));

    const valueInput = document.createElement("input");
    valueInput.className = "form-control deal-value-input";
    valueInput.type = "number";
    valueInput.step = "0.01";
    valueInput.placeholder = "Optional value";
    valueInput.value = safeTrim(deal?.deal_value);
    row.appendChild(createField({ label: "Value", child: valueInput }));
    editor.appendChild(row);

    const ctx = getDealsContext();
    const defaultMainContactId = isEditing ? safeTrim(deal?.main_contact_id) : ctx.personId;
    const mainContactSelect = renderPersonSelect(defaultMainContactId);
    editor.appendChild(
      createField({ label: "Main contact", child: mainContactSelect }),
    );

    const descriptionInput = document.createElement("textarea");
    descriptionInput.className = "form-control deal-description-input";
    descriptionInput.placeholder = "Details";
    descriptionInput.value = safeTrim(deal?.deal_description);
    editor.appendChild(
      createField({ label: "Details", child: descriptionInput }),
    );

    const actions = document.createElement("div");
    actions.className = "deal-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn-small-primary";
    saveBtn.textContent = isEditing ? "Update deal" : "Save deal";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn-small-secondary";
    cancelBtn.textContent = "Cancel";
    actions.append(saveBtn, cancelBtn);
    editor.appendChild(actions);

    cancelBtn.addEventListener("click", () => {
      localState.isCreating = false;
      localState.editingDealId = null;
      renderDeals();
    });

    saveBtn.addEventListener("click", async () => {
      const ctx = getDealsContext();
      const dealName = safeTrim(nameInput.value);
      const dealPhase = safeTrim(phaseInput.value);
      if (!ctx.companyId) {
        setDealsStatus(
          isEditing
            ? "Link or save the company before editing this deal."
            : "Link or save the company before creating a deal.",
        );
        return;
      }
      if (!dealName) {
        setDealsStatus("Deal title is required.");
        nameInput.focus();
        return;
      }
      if (!dealPhase) {
        setDealsStatus("Deal phase is required.");
        phaseInput.focus();
        return;
      }

      const rawValue = safeTrim(valueInput.value);
      const payload = {
        deal_name: dealName,
        deal_description: descriptionInput.value,
        deal_value: rawValue ? Number(rawValue) : null,
        company_id: ctx.companyId,
        deal_phase: dealPhase,
        main_contact_id: safeTrim(mainContactSelect.value) || null,
      };

      try {
        saveBtn.disabled = true;
        setDealsStatus(isEditing ? "Updating deal..." : "Saving deal...");
        const messageType = isEditing ? "DB_UPDATE_DEAL" : "DB_CREATE_DEAL";
        const result = await sendRuntimeMessage(messageType, {
          payload: isEditing ? { ...payload, deal_id: dealId } : payload,
        });
        const resp = result.data || {};
        if (!result.ok || resp?.ok === false) {
          throw new Error(getErrorMessage(result.error || resp?.error));
        }
        localState.isCreating = false;
        localState.editingDealId = null;
        localState.expandedDealId = safeTrim(resp.deal?.deal_id) || dealId || null;
        await refreshDeals({ force: true });
      } catch (e) {
        setDealsStatus(getErrorMessage(e));
      } finally {
        saveBtn.disabled = false;
      }
    });

    return editor;
  }

  function renderCreateCard() {
    const ctx = getDealsContext();
    const card = document.createElement("div");
    card.className = "deal-card note-card note-card-new";
    const header = document.createElement("div");
    header.className = "deal-card-header note-card-header note-card-header-static";
    header.textContent = ctx.companyName
      ? `New deal for ${ctx.companyName}`
      : "New deal";
    card.appendChild(header);
    card.appendChild(renderEditor({ deal_phase: "" }));
    return card;
  }

  function renderDealNotes(deal) {
    const dealId = safeTrim(deal?.deal_id);
    const section = document.createElement("div");
    section.className = "deal-linked-notes-section";

    const header = document.createElement("div");
    header.className = "deal-linked-notes-header";
    const title = document.createElement("strong");
    title.textContent = "Linked notes";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn-small-primary deal-add-note-btn";
    addBtn.textContent = "+ Add note";
    addBtn.addEventListener("click", () => {
      localState.addingNoteDealId = dealId;
      renderDeals();
    });
    header.append(title, addBtn);
    section.appendChild(header);

    if (localState.addingNoteDealId === dealId) {
      section.appendChild(renderDealNoteEditor(deal));
    }

    if (localState.dealNotesLoadingByDealId[dealId]) {
      const loading = document.createElement("div");
      loading.className = "notes-empty";
      loading.textContent = "Loading linked notes...";
      section.appendChild(loading);
      return section;
    }

    const notes = localState.dealNotesByDealId[dealId];
    if (!Array.isArray(notes)) {
      const loading = document.createElement("div");
      loading.className = "notes-empty";
      loading.textContent = "Loading linked notes...";
      section.appendChild(loading);
      loadDealNotes(dealId, { force: false });
      return section;
    }

    if (!notes.length) {
      const empty = document.createElement("div");
      empty.className = "notes-empty";
      empty.textContent = "No notes linked to this deal.";
      section.appendChild(empty);
      return section;
    }

    const list = document.createElement("div");
    list.className = "deal-linked-notes-list";
    for (const note of notes) list.appendChild(createMiniNoteCard(note));
    section.appendChild(list);
    return section;
  }

  function renderDealCard(deal) {
    const dealId = safeTrim(deal?.deal_id);
    const expanded = localState.expandedDealId === dealId;
    const card = document.createElement("div");
    card.className = "deal-card note-card";

    const header = document.createElement("div");
    header.className = "deal-card-header note-card-header";
    header.setAttribute("role", "button");
    header.tabIndex = 0;

    const left = document.createElement("span");
    left.className = "note-card-summary deal-card-summary";
    const icon = document.createElement("span");
    icon.className = "note-type-icon";
    icon.textContent = "💼";
    const date = document.createElement("span");
    date.className = "note-date";
    date.textContent = formatDate(deal?.created_at);
    const title = document.createElement("span");
    title.className = "note-card-title deal-card-title";
    title.textContent = safeTrim(deal?.deal_name) || "(no title)";
    left.append(icon, date, title);

    const right = document.createElement("span");
    right.className = "deal-card-actions";
    const phase = document.createElement("span");
    phase.className = "deal-phase-pill";
    phase.textContent = safeTrim(deal?.deal_phase) || "Deal";
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "deal-edit-btn";
    editBtn.title = "Edit deal";
    editBtn.setAttribute("aria-label", "Edit deal");
    editBtn.innerHTML = "✎";
    editBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      localState.isCreating = false;
      localState.expandedDealId = dealId;
      localState.editingDealId = dealId;
      localState.addingNoteDealId = null;
      await ensureCompanyPeopleRows();
      renderDeals();
    });

    right.append(phase, editBtn);
    header.append(left, right);
    const toggleExpanded = () => {
      localState.expandedDealId = expanded ? null : dealId;
      localState.editingDealId = null;
      localState.addingNoteDealId = null;
      localState.isCreating = false;
      renderDeals();
    };
    header.addEventListener("click", toggleExpanded);
    header.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleExpanded();
      }
    });
    card.appendChild(header);

    if (expanded) {
      const body = document.createElement("div");
      body.className = "deal-card-body note-card-body";

      if (localState.editingDealId === dealId) {
        body.appendChild(renderEditor(deal));
        card.appendChild(body);
        return card;
      }

      const meta = document.createElement("div");
      meta.className = "deal-meta";
      const value = formatMoney(deal?.deal_value);
      const mainContactName = getCompanyPeopleRows().find(
        (row) => safeTrim(row?.id || row?.person_id || row?.main_person_id) === safeTrim(deal?.main_contact_id),
      );
      meta.textContent = [
        safeTrim(deal?.deal_phase) ? `Phase: ${safeTrim(deal.deal_phase)}` : "",
        value ? `Value: ${value}` : "",
        safeTrim(mainContactName?.full_name || mainContactName?.name)
          ? `Main contact: ${safeTrim(mainContactName?.full_name || mainContactName?.name)}`
          : "",
        `Created: ${formatDate(deal?.created_at)}`,
      ]
        .filter(Boolean)
        .join(" | ");
      body.appendChild(meta);

      const description = document.createElement("div");
      description.className = "deal-description";
      description.textContent =
        safeTrim(deal?.deal_description) || "No details available.";
      body.appendChild(description);
      body.appendChild(renderDealNotes(deal));
      card.appendChild(body);
    }

    return card;
  }

  function renderDeals() {
    if (!dom.dealsListEl) return;
    const ctx = getDealsContext();
    dom.dealsListEl.innerHTML = "";

    if (localState.isCreating) {
      dom.dealsListEl.appendChild(renderCreateCard());
    }

    if (!localState.deals.length && !localState.isCreating) {
      const empty = document.createElement("div");
      empty.className = "notes-empty deals-empty";
      empty.textContent = ctx.companyId
        ? "No deals found."
        : ctx.isCompany
          ? "Save or register this company before creating deals."
          : "Link this person to a company before creating deals.";
      dom.dealsListEl.appendChild(empty);
      return;
    }

    for (const deal of localState.deals) {
      dom.dealsListEl.appendChild(renderDealCard(deal));
    }
  }

  function setDealsStatus(text) {
    if (dom.dealsStatusEl) dom.dealsStatusEl.textContent = text || "";
  }

  async function refreshDeals({ force = false } = {}) {
    if (!hasRequiredDom() || !sendRuntimeMessage) return;
    const ctx = getDealsContext();
    if (!ctx.companyId) {
      localState.deals = [];
      localState.loadedCompanyId = "";
      localState.dealNotesByDealId = {};
      localState.companyPeopleRows = [];
      localState.loadedCompanyPeopleId = "";
      setDealsStatus("");
      renderDeals();
      return;
    }
    if (!force && localState.loadedCompanyId === ctx.companyId && localState.deals.length) {
      renderDeals();
      return;
    }
    try {
      setDealsStatus("Loading deals...");
      const result = await sendRuntimeMessage("DB_LIST_DEALS", {
        payload: { company_id: ctx.companyId },
      });
      const resp = result.data || {};
      if (!result.ok || resp?.ok === false) {
        throw new Error(getErrorMessage(result.error || resp?.error));
      }
      localState.deals = Array.isArray(resp.rows) ? resp.rows : [];
      localState.loadedCompanyId = ctx.companyId;
      localState.dealNotesByDealId = {};
      setDealsStatus(localState.deals.length ? "" : "No deals found.");
      renderDeals();
    } catch (e) {
      localState.deals = [];
      setDealsStatus(getErrorMessage(e));
      renderDeals();
    }
  }

  function bindEvents() {
    if (!hasRequiredDom()) return;
    dom.addDealBtnEl?.addEventListener("click", async () => {
      const ctx = getDealsContext();
      if (!ctx.companyId) {
        setDealsStatus(
          ctx.isCompany
            ? "Save or register this company before creating deals."
            : "Link this person to a company before creating deals.",
        );
      }
      localState.isCreating = true;
      localState.expandedDealId = null;
      localState.editingDealId = null;
      localState.addingNoteDealId = null;
      await ensureCompanyPeopleRows();
      renderDeals();
    });
  }

  function init() {
    bindEvents();
  }

  const api = {
    init,
    refreshDeals,
    renderDeals,
    ensureCompanyPeopleRows,
  };

  globalObj.PopupDealsController = Object.freeze(api);
  globalObj.refreshDeals = refreshDeals;
})(typeof globalThis !== "undefined" ? globalThis : self);
