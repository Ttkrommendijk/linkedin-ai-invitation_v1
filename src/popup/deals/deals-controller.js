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
    if (typeof controller?.getCompanyPeopleRows === "function") {
      return controller.getCompanyPeopleRows();
    }
    return [];
  }


  function normalizeNoteStatus(note) {
    return safeTrim(note?.status).toLowerCase();
  }

  function isNoteOverdue(note) {
    const status = normalizeNoteStatus(note);
    if (status === "ready" || status === "done" || status === "canceled" || status === "cancelled") {
      return false;
    }
    const date = new Date(note?.date || note?.created_at);
    return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
  }

  function getNoteStatusMeta(note) {
    const status = normalizeNoteStatus(note);
    if (isNoteOverdue(note)) {
      return { key: "overdue", icon: "⏰", label: "Overdue" };
    }
    if (status === "ready" || status === "done") {
      return { key: "ready", icon: "✓", label: "Ready" };
    }
    if (status === "canceled" || status === "cancelled") {
      return { key: "canceled", icon: "⊘", label: "Canceled" };
    }
    return { key: status || "open", icon: "○", label: status || "Open" };
  }

  function createNoteStatusIcon(note) {
    const meta = getNoteStatusMeta(note);
    const el = document.createElement("span");
    el.className = `note-status-icon note-status-icon-${meta.key}`;
    el.textContent = meta.icon;
    el.title = meta.label;
    el.setAttribute("aria-label", meta.label);
    return el;
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
    const statusMeta = getNoteStatusMeta(note);
    card.classList.add(`note-card-status-${statusMeta.key}`);

    const top = document.createElement("div");
    top.className = "deal-linked-note-top";

    const title = document.createElement("div");
    title.className = "deal-linked-note-title";
    title.textContent = safeTrim(note?.note_title) || "(no title)";

    const statusIcon = createNoteStatusIcon(note);

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "deal-note-edit-btn";
    editBtn.innerHTML = "✎";
    editBtn.title = "Edit note";

    top.append(title, statusIcon, editBtn);

    const meta = document.createElement("div");
    meta.className = "deal-linked-note-meta";
    meta.textContent = [
      formatDate(note?.date || note?.created_at),
      safeTrim(note?.notes_type),
      safeTrim(note?.person_name),
    ]
      .filter(Boolean)
      .join(" | ");

    const description = document.createElement("div");
    description.className = "deal-linked-note-description";
    description.textContent = safeTrim(note?.note_description) || "No details available.";

    const editorWrap = document.createElement("div");
    editorWrap.hidden = true;

    editBtn.addEventListener("click", () => {
      editorWrap.hidden = !editorWrap.hidden;

      if (!editorWrap.childElementCount) {
        const noteApi = globalObj.PopupNotesController;

        if (typeof noteApi?.renderNoteEditorForContext === "function") {
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
        }
      }
    });

    card.append(top, meta, description, editorWrap);
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
    placeholder.textContent = rows.length ? "Select person" : "No linked persons found";
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
    editBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      localState.isCreating = false;
      localState.expandedDealId = dealId;
      localState.editingDealId = dealId;
      localState.addingNoteDealId = null;
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
      meta.textContent = [
        safeTrim(deal?.deal_phase) ? `Phase: ${safeTrim(deal.deal_phase)}` : "",
        value ? `Value: ${value}` : "",
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
    dom.addDealBtnEl?.addEventListener("click", () => {
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
  };

  globalObj.PopupDealsController = Object.freeze(api);
  globalObj.refreshDeals = refreshDeals;
})(typeof globalThis !== "undefined" ? globalThis : self);
