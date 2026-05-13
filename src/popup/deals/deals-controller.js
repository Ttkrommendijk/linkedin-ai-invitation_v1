// Owns reusable read only deals UI for person and company contexts.
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
    return { isCompany, companyId, companyName };
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

  function renderDealCard(deal) {
    const dealId = safeTrim(deal?.deal_id);
    const expanded = localState.expandedDealId === dealId;
    const card = document.createElement("div");
    card.className = "deal-card note-card";

    const header = document.createElement("button");
    header.type = "button";
    header.className = "deal-card-header note-card-header";

    const left = document.createElement("span");
    left.className = "note-card-summary";
    const icon = document.createElement("span");
    icon.className = "note-type-icon";
    icon.textContent = "💼";
    const date = document.createElement("span");
    date.className = "note-date";
    date.textContent = formatDate(deal?.created_at);
    const phase = document.createElement("span");
    phase.className = "note-related-name";
    phase.textContent = safeTrim(deal?.deal_phase) || "Deal";
    left.append(icon, date, phase);

    const right = document.createElement("span");
    right.className = "note-card-title";
    right.textContent = safeTrim(deal?.deal_name) || "(no title)";
    header.append(left, right);
    header.addEventListener("click", () => {
      localState.expandedDealId = expanded ? null : dealId;
      renderDeals();
    });
    card.appendChild(header);

    if (expanded) {
      const body = document.createElement("div");
      body.className = "deal-card-body note-card-body";

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
      card.appendChild(body);
    }

    return card;
  }

  function renderDeals() {
    if (!dom.dealsListEl) return;
    const ctx = getDealsContext();
    dom.dealsListEl.innerHTML = "";

    if (!localState.deals.length) {
      const empty = document.createElement("div");
      empty.className = "notes-empty deals-empty";
      empty.textContent = ctx.companyId
        ? "No deals found."
        : ctx.isCompany
          ? "Save or register this company before loading deals."
          : "Link this person to a company before loading deals.";
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
      setDealsStatus(localState.deals.length ? "" : "No deals found.");
      renderDeals();
    } catch (e) {
      localState.deals = [];
      setDealsStatus(getErrorMessage(e));
      renderDeals();
    }
  }

  function init() {}

  const api = {
    init,
    refreshDeals,
    renderDeals,
  };

  globalObj.PopupDealsController = Object.freeze(api);
  globalObj.refreshDeals = refreshDeals;
})(typeof globalThis !== "undefined" ? globalThis : self);
