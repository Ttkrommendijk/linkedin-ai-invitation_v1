// Refactored popup entrypoint. Behavior lives in the categorized popup-main modules.


const companySubTabsEl = document.getElementById("companySubTabs");
const companyPersonsBtnEl = document.getElementById("companyPersonsBtn");
const companyNotesBtnEl = document.getElementById("companyNotesBtn");

function isCompanyProfileContext() {
  const url =
    currentProfileContext?.url ||
    currentProfileContext?.profile_url ||
    currentProfileContext?.linkedin_url ||
    "";
  return url.includes("/company/");
}

function applyCompanyProfileUi() {
  if (!companySubTabsEl) return;

  const isCompany = isCompanyProfileContext();

  companySubTabsEl.classList.toggle("is-hidden", !isCompany);

  const filterWrap = document.getElementById("notesFilterWrap");
  if (filterWrap) {
    filterWrap.classList.toggle("notes-hidden", isCompany);
  }
}

companyPersonsBtnEl?.addEventListener("click", () => {
  companyPersonsBtnEl.classList.add("active");
  companyNotesBtnEl?.classList.remove("active");
});

companyNotesBtnEl?.addEventListener("click", () => {
  companyNotesBtnEl.classList.add("active");
  companyPersonsBtnEl?.classList.remove("active");
});

(function initWhatsappSyncUi(globalObj) {
  const state = globalObj.PopupState;
  if (!state || globalObj.__LEF_WHATSAPP_SYNC_UI_LOADED__) return;
  globalObj.__LEF_WHATSAPP_SYNC_UI_LOADED__ = true;

  const panel = document.createElement("section");
  panel.id = "whatsappSyncPanel";
  panel.className = "whatsapp-sync-panel is-hidden";
  panel.innerHTML = `
    <div class="whatsapp-sync-panel-title">WhatsApp match</div>
    <div id="whatsappSyncPanelBody" class="whatsapp-sync-panel-body"></div>
  `;
  document.body.appendChild(panel);

  const bodyEl = panel.querySelector("#whatsappSyncPanelBody");

  function clean(value) {
    return String(value || "").trim();
  }

  function rowToProfileContext(row, phone) {
    return {
      id: row?.id || null,
      url: clean(row?.linkedin_url),
      profile_url: clean(row?.linkedin_url),
      linkedin_url: clean(row?.linkedin_url),
      name: clean(row?.full_name),
      full_name: clean(row?.full_name),
      headline: clean(row?.headline),
      company: clean(row?.company),
      phone: clean(row?.phone) || phone,
      email: clean(row?.email),
      language: clean(row?.language),
    };
  }

  function showPanel(html) {
    if (!bodyEl) return;
    bodyEl.innerHTML = html;
    panel.classList.remove("is-hidden");
  }

  function hidePanelLater() {
    setTimeout(() => panel.classList.add("is-hidden"), 1800);
  }

  function renderLifecycleForSelectedRow(row) {
    if (typeof globalObj.applyLifecycleUiState === "function") {
      globalObj.applyLifecycleUiState(row, { preserveTabs: false });
    }
    if (typeof globalObj.renderDetailHeader === "function") {
      globalObj.renderDetailHeader();
    }
    if (typeof globalObj.updatePhaseButtons === "function") {
      globalObj.updatePhaseButtons();
    }
    if (typeof globalObj.renderMessageTab === "function") {
      state.outreachMessageStatus =
        globalObj.PopupLifecycleController?.getOutreachStatusFromDbRow?.() ||
        state.outreachMessageStatus;
      globalObj.renderMessageTab(state.outreachMessageStatus);
    }
    if (typeof globalObj.updateMessageTabControls === "function") {
      globalObj.updateMessageTabControls();
    }
    if (typeof globalObj.refreshPersonCampaignLinks === "function") {
      globalObj.refreshPersonCampaignLinks().catch(() => null);
    }
    if (typeof globalObj.refreshNotes === "function") {
      globalObj.refreshNotes({ force: true }).catch(() => null);
    }
  }

  function selectWhatsappCandidate(row, phone) {
    state.currentProfileContext = rowToProfileContext(row, phone);
    state.lastProfileContextSent = state.currentProfileContext;
    state.lastProfileContextEnriched = null;
    state.dbInvitationRow = row || null;

    if (typeof globalObj.setActiveTab === "function") {
      globalObj.setActiveTab("detail", { userInitiated: false });
    }
    renderLifecycleForSelectedRow(row);
    if (typeof globalObj.renderProfileContext === "function") {
      globalObj.renderProfileContext();
    }
    if (typeof globalObj.setFooterStatus === "function") {
      globalObj.setFooterStatus(`WhatsApp match selected: ${clean(row?.full_name) || phone}`);
    }
    showPanel(`<div>Selected ${clean(row?.full_name) || phone}</div>`);
    hidePanelLater();
  }

  function renderCandidates(rows, phone) {
    const buttons = rows
      .map((row, index) => {
        const label = clean(row?.full_name) || clean(row?.company) || clean(row?.linkedin_url) || `Candidate ${index + 1}`;
        const subtitle = [clean(row?.company), clean(row?.headline)].filter(Boolean).join(" | ");
        return `<button type="button" class="whatsapp-sync-candidate" data-index="${index}">
          <span>${label}</span>
          <small>${subtitle || clean(row?.phone) || phone}</small>
        </button>`;
      })
      .join("");
    showPanel(`<div>${rows.length} candidates found for ${phone}</div>${buttons}`);
    bodyEl.querySelectorAll(".whatsapp-sync-candidate").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.index);
        selectWhatsappCandidate(rows[index], phone);
      });
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== "WHATSAPP_SYNC_RESULT") return false;
    const phone = clean(msg?.payload?.phone);
    const rows = Array.isArray(msg?.payload?.rows) ? msg.payload.rows : [];

    if (!phone) return false;
    if (rows.length === 1) {
      selectWhatsappCandidate(rows[0], phone);
      return false;
    }
    if (rows.length > 1) {
      renderCandidates(rows, phone);
      if (typeof globalObj.setFooterStatus === "function") {
        globalObj.setFooterStatus(`Multiple WhatsApp matches for ${phone}.`);
      }
      return false;
    }

    state.currentProfileContext = { phone, whatsapp_phone: phone };
    state.dbInvitationRow = null;
    if (typeof globalObj.applyLifecycleUiState === "function") {
      globalObj.applyLifecycleUiState(null, { preserveTabs: false });
    }
    if (typeof globalObj.renderDetailHeader === "function") {
      globalObj.renderDetailHeader();
    }
    showPanel(`<div>No person found for ${phone}</div>`);
    if (typeof globalObj.setFooterStatus === "function") {
      globalObj.setFooterStatus(`Person not found for WhatsApp number ${phone}.`);
    }
    return false;
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
