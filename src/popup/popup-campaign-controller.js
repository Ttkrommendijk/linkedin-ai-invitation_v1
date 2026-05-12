// Owns campaign-related orchestration and bindings.
// During incremental extraction, this controller centralizes campaign state and low-risk helpers first.
(function initPopupCampaignController(globalObj) {
  const PopupDom = globalObj.PopupDom;
  if (!PopupDom || typeof PopupDom !== "object") {
    throw new Error(
      "PopupDom must be loaded before popup-campaign-controller.js.",
    );
  }
  const PopupUtils = globalObj.PopupUtils;
  if (!PopupUtils || typeof PopupUtils !== "object") {
    throw new Error(
      "PopupUtils must be loaded before popup-campaign-controller.js.",
    );
  }
  const PopupState = globalObj.PopupState;
  if (!PopupState || typeof PopupState !== "object") {
    throw new Error(
      "PopupState must be loaded before popup-campaign-controller.js.",
    );
  }

  const {
    campaignSelectEl,
    addCampaignBtnEl,
    cancelNewCampaignBtnEl,
    cancelRenameCampaignBtnEl,
    companyAddCampaignBtnEl,
    companyCancelNewCampaignBtnEl,
    companyCancelRenameCampaignBtnEl,
    renameCampaignRowEl,
    newCampaignRowEl,
    toggleNewCampaignBtnEl,
    newCampaignNameEl,
    renameCampaignNameEl,
    saveRenameCampaignBtnEl,
    renameCampaignBtnEl,
    companySaveRenameCampaignBtnEl,
    companyRenameCampaignBtnEl,
    companyCampaignSelectEl,
    companyRenameCampaignRowEl,
    companyNewCampaignRowEl,
    companyToggleNewCampaignBtnEl,
    companyNewCampaignNameEl,
    companyRenameCampaignNameEl,
    filterCampaignEl,
    companyCampaignFilterEl,
    linkedCampaignsListEl,
    companyLinkedCampaignsListEl,
  } = PopupDom;
  const safeTrim =
    typeof PopupUtils.safeTrim === "function"
      ? PopupUtils.safeTrim
      : (value) => (value == null ? "" : String(value).trim());
  const OVERVIEW_CAMPAIGN_LABEL_MAX = 52;
  const STORAGE_KEY_LAST_ACTIVE_CAMPAIGN = "last_active_campaign";
  const state = {
    knownCampaignValues: [],
    knownCampaignRows: [],
    linkedPersonCampaignRows: [],
    companyLinkedCampaignRows: [],
  };
  const getErrorMessageFromUtils =
    typeof PopupUtils.getErrorMessage === "function"
      ? PopupUtils.getErrorMessage
      : null;

  function requireFn(name) {
    const fn = globalObj[name];
    if (typeof fn !== "function") {
      throw new Error(
        `popup-campaign-controller.js requires global function ${name} to be defined.`,
      );
    }
    return fn;
  }

  function getKnownCampaignValues() {
    return state.knownCampaignValues;
  }

  function setKnownCampaignValues(value) {
    state.knownCampaignValues = Array.isArray(value) ? value : [];
  }

  function getKnownCampaignRows() {
    return state.knownCampaignRows;
  }

  function setKnownCampaignRows(value) {
    state.knownCampaignRows = Array.isArray(value) ? value : [];
  }

  function getLinkedPersonCampaignRows() {
    return state.linkedPersonCampaignRows;
  }

  function setLinkedPersonCampaignRows(value) {
    state.linkedPersonCampaignRows = Array.isArray(value) ? value : [];
  }

  function getCompanyLinkedCampaignRows() {
    return state.companyLinkedCampaignRows;
  }

  function setCompanyLinkedCampaignRows(value) {
    state.companyLinkedCampaignRows = Array.isArray(value) ? value : [];
  }

  function normalizeCampaignValue(value) {
    return safeTrim(value);
  }

  function pickCampaignTextColor(hexColor) {
    const raw = String(hexColor || "").trim();
    const match = raw.match(/^#?([0-9a-f]{6})$/i);
    if (!match) return "#374151";
    const hex = match[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.55 ? "#ffffff" : "#111827";
  }

  function truncateCampaignLabel(value, maxLen = OVERVIEW_CAMPAIGN_LABEL_MAX) {
    const full = String(value || "");
    if (full.length <= maxLen) return full;
    return `${full.slice(0, maxLen - 1).trim()}\u2026`;
  }

  function buildCampaignOptionElement(campaignRow) {
    const campaignId = String(campaignRow?.campaign_id || "").trim();
    const campaignName = normalizeCampaignValue(campaignRow?.campaign_name || "");
    if (!campaignId || !campaignName) return null;
    const optionEl = document.createElement("option");
    optionEl.value = campaignId;
    optionEl.textContent = truncateCampaignLabel(campaignName);
    optionEl.title = campaignName;
    optionEl.dataset.campaignId = campaignId;
    optionEl.dataset.campaignName = campaignName;
    return optionEl;
  }

  function hasCampaignOption(campaignId) {
    if (!campaignSelectEl) return false;
    const normalizedId = String(campaignId || "").trim();
    if (!normalizedId) return false;
    return Array.from(campaignSelectEl.options || []).some(
      (option) => String(option.value || "").trim() === normalizedId,
    );
  }

  function appendCampaignOption(campaignRow) {
    if (!campaignSelectEl) return;
    const campaignId = String(campaignRow?.campaign_id || "").trim();
    if (!campaignId || hasCampaignOption(campaignId)) return;
    const optionEl = buildCampaignOptionElement(campaignRow);
    if (!optionEl) return;
    campaignSelectEl.appendChild(optionEl);
  }

  function updateRenameCampaignButtonState() {
    if (!renameCampaignBtnEl || !campaignSelectEl) return;
    const hasSelection = Boolean(String(campaignSelectEl.value || "").trim());
    renameCampaignBtnEl.hidden = !hasSelection;
  }

  function updateCompanyRenameCampaignButtonState() {
    if (!companyRenameCampaignBtnEl || !companyCampaignSelectEl) return;
    companyRenameCampaignBtnEl.hidden = !String(
      companyCampaignSelectEl.value || "",
    ).trim();
  }

  function updateOverviewCampaignFilterTitle() {
    if (!filterCampaignEl) return;
    const selectedOption =
      filterCampaignEl.options[filterCampaignEl.selectedIndex];
    if (!selectedOption) {
      filterCampaignEl.title = "";
      return;
    }
    const selectedValue = String(selectedOption.value || "");
    if (
      selectedValue &&
      selectedValue !== "__no_campaign__" &&
      selectedValue !== ""
    ) {
      filterCampaignEl.title = selectedValue;
      return;
    }
    filterCampaignEl.title = selectedOption.text || "";
  }

  function updateDetailCampaignSelectTitle() {
    if (!campaignSelectEl) return;
    const selectedOption =
      campaignSelectEl.options[campaignSelectEl.selectedIndex];
    if (!selectedOption) {
      campaignSelectEl.title = "";
      return;
    }
    const selectedValue = String(selectedOption.value || "");
    campaignSelectEl.title = selectedValue || selectedOption.text || "";
  }

  function setCampaignSelectValue(campaignId) {
    if (!campaignSelectEl) return;
    const normalizedId = String(campaignId || "").trim();
    let nextValue = "";
    if (normalizedId) {
      const row = state.knownCampaignRows.find(
        (item) => String(item?.campaign_id || "").trim() === normalizedId,
      );
      if (row) {
        appendCampaignOption(row);
        nextValue = normalizedId;
      }
    }
    campaignSelectEl.value = nextValue;
    updateDetailCampaignSelectTitle();
    updateRenameCampaignButtonState();
  }

  function setNewCampaignRowVisible(visible) {
    if (!newCampaignRowEl) return;
    newCampaignRowEl.hidden = !visible;
    if (toggleNewCampaignBtnEl) {
      toggleNewCampaignBtnEl.hidden = Boolean(visible);
    }
    if (!visible && newCampaignNameEl) {
      newCampaignNameEl.value = "";
    }
  }

  function setRenameCampaignRowVisible(visible) {
    if (!renameCampaignRowEl) return;
    renameCampaignRowEl.hidden = !visible;
    if (renameCampaignBtnEl) {
      renameCampaignBtnEl.hidden = Boolean(visible);
    }
    if (!visible && renameCampaignNameEl) {
      renameCampaignNameEl.value = "";
    }
  }

  function setCompanyNewCampaignRowVisible(visible) {
    if (!companyNewCampaignRowEl) return;
    companyNewCampaignRowEl.hidden = !visible;
    if (companyToggleNewCampaignBtnEl) {
      companyToggleNewCampaignBtnEl.hidden = Boolean(visible);
    }
    if (!visible && companyNewCampaignNameEl) {
      companyNewCampaignNameEl.value = "";
    }
  }

  function setCompanyRenameCampaignRowVisible(visible) {
    if (!companyRenameCampaignRowEl) return;
    companyRenameCampaignRowEl.hidden = !visible;
    if (companyRenameCampaignBtnEl) {
      companyRenameCampaignBtnEl.hidden = Boolean(visible);
    }
    if (!visible && companyRenameCampaignNameEl) {
      companyRenameCampaignNameEl.value = "";
    }
  }

  async function saveLastActiveCampaign(value) {
    await chrome.storage.local.set({
      [STORAGE_KEY_LAST_ACTIVE_CAMPAIGN]: normalizeCampaignValue(value),
    });
  }

  async function loadLastActiveCampaign() {
    const data = await chrome.storage.local.get([
      STORAGE_KEY_LAST_ACTIVE_CAMPAIGN,
    ]);
    const stored = normalizeCampaignValue(
      data?.[STORAGE_KEY_LAST_ACTIVE_CAMPAIGN] || "",
    );
    if (!stored) return "";
    const byId = state.knownCampaignRows.find(
      (row) => String(row?.campaign_id || "").trim() === stored,
    );
    if (byId) return String(byId.campaign_id || "").trim();
    const byName = state.knownCampaignRows.find(
      (row) =>
        normalizeCampaignValue(row?.campaign_name || "").toLowerCase() ===
        stored.toLowerCase(),
    );
    return byName ? String(byName.campaign_id || "").trim() : "";
  }

  function rebuildCampaignSelectOptions(campaignRows) {
    if (!campaignSelectEl) return;
    while (campaignSelectEl.firstChild) {
      campaignSelectEl.removeChild(campaignSelectEl.firstChild);
    }
    const emptyOptionEl = document.createElement("option");
    emptyOptionEl.value = "";
    emptyOptionEl.textContent = "Select campaign";
    campaignSelectEl.appendChild(emptyOptionEl);
    for (const campaignRow of campaignRows || []) {
      appendCampaignOption(campaignRow);
    }
    setRenameCampaignRowVisible(false);
    updateRenameCampaignButtonState();
  }

  function rebuildCompanyCampaignSelectOptions() {
    if (!companyCampaignSelectEl) return;
    const selectedBefore = String(companyCampaignSelectEl.value || "").trim();
    while (companyCampaignSelectEl.firstChild) {
      companyCampaignSelectEl.removeChild(companyCampaignSelectEl.firstChild);
    }
    const emptyOptionEl = document.createElement("option");
    emptyOptionEl.value = "";
    emptyOptionEl.textContent = "Select campaign";
    companyCampaignSelectEl.appendChild(emptyOptionEl);
    for (const campaignRow of state.knownCampaignRows) {
      const optionEl = buildCampaignOptionElement(campaignRow);
      if (!optionEl) continue;
      companyCampaignSelectEl.appendChild(optionEl);
    }
    const hasSelected = Array.from(companyCampaignSelectEl.options || []).some(
      (opt) => String(opt.value || "").trim() === selectedBefore,
    );
    companyCampaignSelectEl.value = hasSelected ? selectedBefore : "";
    updateCompanyRenameCampaignButtonState();
  }

  function rebuildOverviewCampaignFilterOptions(campaignRows) {
    if (!filterCampaignEl) return;
    const selectedBefore = String(filterCampaignEl.value || "").trim();
    while (filterCampaignEl.firstChild) {
      filterCampaignEl.removeChild(filterCampaignEl.firstChild);
    }
    const allOptionEl = document.createElement("option");
    allOptionEl.value = "";
    allOptionEl.textContent = "All campaigns";
    filterCampaignEl.appendChild(allOptionEl);
    const noCampaignOptionEl = document.createElement("option");
    noCampaignOptionEl.value = "__no_campaign__";
    noCampaignOptionEl.textContent = "No campaign";
    filterCampaignEl.appendChild(noCampaignOptionEl);

    const uniqueRows = Array.from(
      new Map(
        (campaignRows || [])
          .map((row) => ({
            campaign_id: String(row?.campaign_id || "").trim(),
            campaign_name: normalizeCampaignValue(row?.campaign_name || ""),
          }))
          .filter((row) => row.campaign_id && row.campaign_name)
          .map((row) => [row.campaign_id, row]),
      ).values(),
    );
    uniqueRows.forEach((row) => {
      const optionEl = buildCampaignOptionElement(row);
      if (!optionEl) return;
      filterCampaignEl.appendChild(optionEl);
    });

    if (
      selectedBefore &&
      uniqueRows.some((row) => row.campaign_id === selectedBefore)
    ) {
      filterCampaignEl.value = selectedBefore;
    } else {
      filterCampaignEl.value = "";
    }
    updateOverviewCampaignFilterTitle();
  }

  function rebuildCompanyCampaignFilterOptions(campaignRows) {
    if (!companyCampaignFilterEl) return;
    const selectedBefore = String(companyCampaignFilterEl.value || "").trim();
    while (companyCampaignFilterEl.firstChild) {
      companyCampaignFilterEl.removeChild(companyCampaignFilterEl.firstChild);
    }
    const allOptionEl = document.createElement("option");
    allOptionEl.value = "";
    allOptionEl.textContent = "All campaigns";
    companyCampaignFilterEl.appendChild(allOptionEl);

    const uniqueRows = Array.from(
      new Map(
        (campaignRows || [])
          .map((row) => ({
            campaign_id: String(row?.campaign_id || "").trim(),
            campaign_name: normalizeCampaignValue(row?.campaign_name || ""),
          }))
          .filter((row) => row.campaign_id && row.campaign_name)
          .map((row) => [row.campaign_id, row]),
      ).values(),
    );
    uniqueRows.forEach((row) => {
      const optionEl = buildCampaignOptionElement(row);
      if (!optionEl) return;
      companyCampaignFilterEl.appendChild(optionEl);
    });
    if (
      selectedBefore &&
      uniqueRows.some((row) => row.campaign_id === selectedBefore)
    ) {
      companyCampaignFilterEl.value = selectedBefore;
    } else {
      companyCampaignFilterEl.value = "";
    }
  }

  function renderLinkedCampaignChips() {
    if (!linkedCampaignsListEl) return;
    const sendRuntimeMessage = requireFn("sendRuntimeMessage");
    const setFooterUpdatingStatus = requireFn("setFooterUpdatingStatus");
    const setFooterStatus = requireFn("setFooterStatus");
    const setFooterReady = requireFn("setFooterReady");
    const getErrorMessage = requireFn("getErrorMessage");
    const refreshPersonCampaignLinksFn = refreshPersonCampaignLinks;
    const refreshCompanyPeopleList = requireFn("refreshCompanyPeopleList");

    linkedCampaignsListEl.innerHTML = "";
    const pickTextColorForBg = (hexColor) => {
      const raw = String(hexColor || "").trim();
      const match = raw.match(/^#?([0-9a-f]{6})$/i);
      if (!match) return "#374151";
      const hex = match[1];
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance < 0.55 ? "#ffffff" : "#111827";
    };
    const applyCampaignChipColor = (chipEl, campaignColor) => {
      if (!chipEl) return;
      if (/^#[0-9a-f]{6}$/i.test(campaignColor)) {
        chipEl.style.backgroundColor = campaignColor;
        chipEl.style.color = pickTextColorForBg(campaignColor);
      }
    };
    const bindCampaignChipColorPicker = (chipEl, campaignId, campaignColor) => {
      chipEl.addEventListener("click", async (event) => {
        if (event.target.classList?.contains("campaign-chip-remove")) return;
        const colorInputEl = document.createElement("input");
colorInputEl.classList.add("form-control");
        colorInputEl.type = "color";
        colorInputEl.value = /^#[0-9a-f]{6}$/i.test(campaignColor)
          ? campaignColor
          : "#2563eb";
        colorInputEl.style.position = "fixed";
        colorInputEl.style.left = "-9999px";
        document.body.appendChild(colorInputEl);
        colorInputEl.addEventListener(
          "input",
          async () => {
            setFooterUpdatingStatus();
            try {
              const result = await sendRuntimeMessage("DB_UPDATE_CAMPAIGN", {
                payload: { campaign_id: campaignId, color: colorInputEl.value },
              });
              if (!result.ok) {
                throw new Error(getErrorMessage(result.error));
              }
              await refreshPersonCampaignLinksFn();
              await refreshCompanyPeopleList();
              setFooterStatus("Campaign color updated.");
            } catch (e) {
              setFooterStatus(`DB error: ${getErrorMessage(e)}`);
            } finally {
              setFooterReady();
              colorInputEl.remove();
            }
          },
          { once: true },
        );
        colorInputEl.click();
      });
    };
    for (const row of state.linkedPersonCampaignRows) {
      const campaignId = String(row?.campaign_id || "").trim();
      const campaignName = normalizeCampaignValue(row?.campaign_name || "");
      const campaignColor = normalizeCampaignValue(row?.color || "");
      if (!campaignId || !campaignName) continue;
      const chipEl = document.createElement("span");
      chipEl.className = "campaign-chip";
      applyCampaignChipColor(chipEl, campaignColor);
      chipEl.title = "Click to set campaign color";
      const nameEl = document.createElement("span");
      nameEl.className = "campaign-chip-name";
      nameEl.textContent = campaignName;
      chipEl.appendChild(nameEl);
      bindCampaignChipColorPicker(chipEl, campaignId, campaignColor);
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "campaign-chip-remove";
      removeBtn.textContent = "\u00d7";
      removeBtn.title = "Remove link";
      removeBtn.setAttribute("aria-label", `Remove ${campaignName}`);
      removeBtn.addEventListener("click", async () => {
        const personId = safeTrim(PopupState.dbInvitationRow?.id);
        if (!personId) return;
        setFooterUpdatingStatus();
        try {
          const result = await sendRuntimeMessage("DB_UNLINK_PERSON_CAMPAIGN", {
            payload: { person_id: personId, campaign_id: campaignId },
          });
          if (!result.ok) {
            throw new Error(getErrorMessage(result.error));
          }
          await refreshPersonCampaignLinksFn();
          setFooterStatus("Campaign link removed.");
        } catch (e) {
          setFooterStatus(`DB error: ${getErrorMessage(e)}`);
        } finally {
          setFooterReady();
        }
      });
      chipEl.appendChild(removeBtn);
      linkedCampaignsListEl.appendChild(chipEl);
    }
  }

  function renderCompanyLinkedCampaignChips() {
    if (!companyLinkedCampaignsListEl) return;
    const sendRuntimeMessage = requireFn("sendRuntimeMessage");
    const setFooterUpdatingStatus = requireFn("setFooterUpdatingStatus");
    const setFooterStatus = requireFn("setFooterStatus");
    const setFooterReady = requireFn("setFooterReady");
    const getErrorMessage = requireFn("getErrorMessage");
    const refreshCompanyPeopleList = requireFn("refreshCompanyPeopleList");
    const getCompanyPeopleRows = requireFn("getCompanyPeopleRows");

    companyLinkedCampaignsListEl.innerHTML = "";
    for (const row of state.companyLinkedCampaignRows) {
      const campaignId = safeTrim(row?.campaign_id);
      const campaignName = safeTrim(row?.campaign_name);
      const campaignColor = safeTrim(row?.color);
      if (!campaignId || !campaignName) continue;
      const chipEl = document.createElement("span");
      chipEl.className = "campaign-chip";
      if (/^#[0-9a-f]{6}$/i.test(campaignColor)) {
        chipEl.style.backgroundColor = campaignColor;
        chipEl.style.color = pickCampaignTextColor(campaignColor);
      }
      chipEl.title = "Click to set campaign color";
      const nameEl = document.createElement("span");
      nameEl.className = "campaign-chip-name";
      nameEl.textContent = campaignName;
      chipEl.appendChild(nameEl);
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "campaign-chip-remove";
      removeBtn.textContent = "\u00d7";
      removeBtn.title = "Remove link from all linked persons";
      removeBtn.setAttribute(
        "aria-label",
        `Remove ${campaignName} from all linked persons`,
      );
      removeBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const personIds = Array.from(
          new Set(
            getCompanyPeopleRows()
              .map((personRow) => safeTrim(personRow?.id))
              .filter((id) => Boolean(id)),
          ),
        );
        if (!personIds.length) return;
        setFooterUpdatingStatus();
        try {
          await Promise.all(
            personIds.map((personId) =>
              sendRuntimeMessage("DB_UNLINK_PERSON_CAMPAIGN", {
                payload: { person_id: personId, campaign_id: campaignId },
              }),
            ),
          );
          await refreshCompanyPeopleList();
          setFooterStatus("Campaign link removed from all linked persons.");
        } catch (e) {
          setFooterStatus(`DB error: ${getErrorMessage(e)}`);
        } finally {
          setFooterReady();
        }
      });
      chipEl.appendChild(removeBtn);
      chipEl.addEventListener("click", async () => {
        await openCampaignColorPicker({
          campaignId,
          campaignColor,
          onSaved: refreshCompanyPeopleList,
        });
      });
      companyLinkedCampaignsListEl.appendChild(chipEl);
    }
  }

  async function openCampaignColorPicker({
    campaignId,
    campaignColor,
    onSaved = null,
  } = {}) {
    const sendRuntimeMessage = requireFn("sendRuntimeMessage");
    const setFooterUpdatingStatus = requireFn("setFooterUpdatingStatus");
    const setFooterStatus = requireFn("setFooterStatus");
    const setFooterReady = requireFn("setFooterReady");
    const getErrorMessage =
      getErrorMessageFromUtils || requireFn("getErrorMessage");
    const normalizedCampaignId = safeTrim(campaignId);
    if (!normalizedCampaignId) return;
    const colorInputEl = document.createElement("input");
    colorInputEl.type = "color";
    colorInputEl.value = /^#[0-9a-f]{6}$/i.test(campaignColor || "")
      ? campaignColor
      : "#2563eb";
    colorInputEl.style.position = "fixed";
    colorInputEl.style.left = "-9999px";
    document.body.appendChild(colorInputEl);
    colorInputEl.addEventListener(
      "input",
      async () => {
        setFooterUpdatingStatus();
        try {
          const result = await sendRuntimeMessage("DB_UPDATE_CAMPAIGN", {
            payload: { campaign_id: normalizedCampaignId, color: colorInputEl.value },
          });
          if (!result.ok) {
            throw new Error(getErrorMessage(result.error));
          }
          if (typeof onSaved === "function") {
            await onSaved();
          }
          setFooterStatus("Campaign color updated.");
        } catch (e) {
          setFooterStatus(`DB error: ${getErrorMessage(e)}`);
        } finally {
          setFooterReady();
          colorInputEl.remove();
        }
      },
      { once: true },
    );
    colorInputEl.click();
  }

  async function loadCampaignOptions({ keepSelected = true } = {}) {
    const sendRuntimeMessage = requireFn("sendRuntimeMessage");
    const selectedBefore =
      campaignSelectEl && keepSelected
        ? String(campaignSelectEl.value || "").trim()
        : "";
    const result = await sendRuntimeMessage("DB_LIST_CAMPAIGNS");
    const resp = result.data || {};
    const campaignRowsRaw =
      result.ok && Array.isArray(resp?.campaign_rows) ? resp.campaign_rows : [];
    setKnownCampaignRows(
      campaignRowsRaw
        .map((row) => ({
          campaign_id: String(row?.campaign_id || "").trim(),
          campaign_name: normalizeCampaignValue(row?.campaign_name || ""),
        }))
        .filter((row) => row.campaign_id && row.campaign_name),
    );
    setKnownCampaignValues(getKnownCampaignRows().map((row) => row.campaign_name));
    if (campaignSelectEl) {
      rebuildCampaignSelectOptions(getKnownCampaignRows());
    }
    rebuildOverviewCampaignFilterOptions(getKnownCampaignRows());
    rebuildCompanyCampaignFilterOptions(getKnownCampaignRows());
    const setOverviewCampaignFilterValue = requireFn(
      "setOverviewCampaignFilterValue",
    );
    const setCompanyOverviewCampaignFilterValue = requireFn(
      "setCompanyOverviewCampaignFilterValue",
    );
    setOverviewCampaignFilterValue(filterCampaignEl?.value || "");
    setCompanyOverviewCampaignFilterValue(
      companyCampaignFilterEl?.selectedOptions?.[0]
        ? String(
            companyCampaignFilterEl.selectedOptions[0].dataset?.campaignName || "",
          )
        : "",
    );
    rebuildCompanyCampaignSelectOptions();
    if (campaignSelectEl) {
      setCampaignSelectValue(selectedBefore);
    }
  }

  function refreshPersonCampaignLinks() {
    return (async () => {
      const sendRuntimeMessage = requireFn("sendRuntimeMessage");
      setLinkedPersonCampaignRows([]);
      if (!PopupState.dbInvitationRow?.id) {
        renderLinkedCampaignChips();
        return;
      }
      const result = await sendRuntimeMessage("DB_LIST_PERSON_CAMPAIGNS", {
        payload: { person_id: PopupState.dbInvitationRow.id },
      });
      const resp = result.data || {};
      if (!result.ok || !Array.isArray(resp?.rows)) {
        renderLinkedCampaignChips();
        return;
      }
      setLinkedPersonCampaignRows(resp.rows);
      renderLinkedCampaignChips();
    })();
  }

  function refreshCompanyPeopleList() {
    return requireFn("refreshCompanyPeopleList")();
  }

  async function applyCampaignSelectionFromProfile() {
    if (!campaignSelectEl) return;
    if (PopupState.dbInvitationRow) {
      setCampaignSelectValue("");
      return;
    }
    const lastActiveCampaignId = await loadLastActiveCampaign();
    if (!lastActiveCampaignId) {
      setCampaignSelectValue("");
      return;
    }
    setCampaignSelectValue(lastActiveCampaignId);
  }

  async function linkCampaignToCurrentPerson(campaignId) {
    const sendRuntimeMessage = requireFn("sendRuntimeMessage");
    const setFooterStatus = requireFn("setFooterStatus");
    const getErrorMessage =
      getErrorMessageFromUtils || requireFn("getErrorMessage");
    const normalizedCampaignId = String(campaignId || "").trim();
    if (!normalizedCampaignId) return;
    if (!PopupState.dbInvitationRow?.id) {
      setFooterStatus("Person must exist/generated first.");
      return;
    }
    const result = await sendRuntimeMessage("DB_LINK_PERSON_CAMPAIGN", {
      payload: {
        person_id: PopupState.dbInvitationRow.id,
        campaign_id: normalizedCampaignId,
      },
    });
    if (!result.ok) {
      throw new Error(getErrorMessage(result.error));
    }
    await refreshPersonCampaignLinks();
  }

  async function handleCampaignSelection(campaignId) {
    const setFooterStatus = requireFn("setFooterStatus");
    const normalizedCampaignId = String(campaignId || "").trim();
    await saveLastActiveCampaign(normalizedCampaignId);
    if (!normalizedCampaignId) return;
    await linkCampaignToCurrentPerson(normalizedCampaignId);
    setFooterStatus("Campaign linked.");
  }

  async function renameSelectedCampaign(campaignName) {
    const sendRuntimeMessage = requireFn("sendRuntimeMessage");
    const getErrorMessage =
      getErrorMessageFromUtils || requireFn("getErrorMessage");
    const campaignId = String(campaignSelectEl?.value || "").trim();
    const nextName = normalizeCampaignValue(campaignName);
    if (!campaignId) throw new Error("Select a campaign first.");
    if (!nextName) throw new Error("Campaign name is required.");
    const result = await sendRuntimeMessage("DB_UPDATE_CAMPAIGN", {
      payload: {
        campaign_id: campaignId,
        campaign_name: nextName,
      },
    });
    if (!result.ok) {
      throw new Error(getErrorMessage(result.error));
    }
    await loadCampaignOptions({ keepSelected: true });
    setCampaignSelectValue(campaignId);
    await saveLastActiveCampaign(campaignId);
  }

  function bindCampaignEvents() {
    const sendRuntimeMessage = requireFn("sendRuntimeMessage");
    const getErrorMessage =
      getErrorMessageFromUtils || requireFn("getErrorMessage");
    const setFooterStatus = requireFn("setFooterStatus");
    const setFooterReady = requireFn("setFooterReady");
    const setFooterUpdatingStatus = requireFn("setFooterUpdatingStatus");
    const refreshCompanyPeopleList = requireFn("refreshCompanyPeopleList");
    const getCompanyPeopleRows = requireFn("getCompanyPeopleRows");

    campaignSelectEl?.addEventListener("change", async () => {
      updateDetailCampaignSelectTitle();
      updateRenameCampaignButtonState();
      if (!campaignSelectEl.value) {
        await saveLastActiveCampaign("");
        return;
      }
      setFooterUpdatingStatus();
      try {
        await handleCampaignSelection(campaignSelectEl.value);
      } catch (e) {
        setFooterStatus(`DB error: ${getErrorMessage(e)}`);
      } finally {
        setFooterReady();
      }
    });

    toggleNewCampaignBtnEl?.addEventListener("click", () => {
      setRenameCampaignRowVisible(false);
      setNewCampaignRowVisible(true);
      newCampaignNameEl?.focus();
    });

    renameCampaignBtnEl?.addEventListener("click", () => {
      const selectedId = String(campaignSelectEl?.value || "").trim();
      if (!selectedId) return;
      const row = getKnownCampaignRows().find(
        (item) => String(item?.campaign_id || "").trim() === selectedId,
      );
      setNewCampaignRowVisible(false);
      setRenameCampaignRowVisible(true);
      if (renameCampaignNameEl) {
        renameCampaignNameEl.value = normalizeCampaignValue(row?.campaign_name || "");
        renameCampaignNameEl.focus();
        renameCampaignNameEl.select();
      }
    });

    addCampaignBtnEl?.addEventListener("click", async () => {
      const campaignName = normalizeCampaignValue(newCampaignNameEl?.value || "");
      if (!campaignName) return;
      setFooterUpdatingStatus();
      try {
        const createResult = await sendRuntimeMessage("DB_CREATE_CAMPAIGN", {
          payload: { campaign_name: campaignName },
        });
        const createResp = createResult.data || {};
        if (!createResult.ok || !createResp?.campaign?.campaign_id) {
          throw new Error(getErrorMessage(createResult.error || createResp?.error));
        }
        const createdCampaignId = String(createResp.campaign.campaign_id || "").trim();
        await loadCampaignOptions({ keepSelected: true });
        setCampaignSelectValue(createdCampaignId);
        if (PopupState.dbInvitationRow?.id) {
          await handleCampaignSelection(createdCampaignId);
        } else {
          setFooterStatus("Person must exist/generated first.");
        }
        setNewCampaignRowVisible(false);
      } catch (e) {
        setFooterStatus(`DB error: ${getErrorMessage(e)}`);
      } finally {
        setFooterReady();
      }
    });

    cancelNewCampaignBtnEl?.addEventListener("click", () => {
      setNewCampaignRowVisible(false);
    });

    cancelRenameCampaignBtnEl?.addEventListener("click", () => {
      setRenameCampaignRowVisible(false);
    });

    saveRenameCampaignBtnEl?.addEventListener("click", async () => {
      setFooterUpdatingStatus();
      if (saveRenameCampaignBtnEl) saveRenameCampaignBtnEl.disabled = true;
      try {
        await renameSelectedCampaign(renameCampaignNameEl?.value || "");
        setRenameCampaignRowVisible(false);
        setFooterStatus("Campaign renamed.");
      } catch (e) {
        setFooterStatus(`DB error: ${getErrorMessage(e)}`);
      } finally {
        if (saveRenameCampaignBtnEl) saveRenameCampaignBtnEl.disabled = false;
        setFooterReady();
      }
    });

    companyCampaignSelectEl?.addEventListener("change", async () => {
      updateCompanyRenameCampaignButtonState();
      const campaignId = safeTrim(companyCampaignSelectEl.value);
      if (!campaignId) return;
      const personIds = Array.from(
        new Set(
          getCompanyPeopleRows()
            .map((row) => safeTrim(row?.id))
            .filter((id) => Boolean(id)),
        ),
      );
      if (!personIds.length) return;
      setFooterUpdatingStatus();
      try {
        await Promise.all(
          personIds.map((personId) =>
            sendRuntimeMessage("DB_LINK_PERSON_CAMPAIGN", {
              payload: { person_id: personId, campaign_id: campaignId },
            }),
          ),
        );
        await refreshCompanyPeopleList();
        setFooterStatus("Campaign linked to all persons.");
        companyCampaignSelectEl.value = "";
        updateCompanyRenameCampaignButtonState();
      } catch (e) {
        setFooterStatus(`DB error: ${getErrorMessage(e)}`);
      } finally {
        setFooterReady();
      }
    });

    companyToggleNewCampaignBtnEl?.addEventListener("click", () => {
      setCompanyRenameCampaignRowVisible(false);
      setCompanyNewCampaignRowVisible(true);
      companyNewCampaignNameEl?.focus();
    });

    companyCancelNewCampaignBtnEl?.addEventListener("click", () => {
      setCompanyNewCampaignRowVisible(false);
    });

    companyAddCampaignBtnEl?.addEventListener("click", async () => {
      const campaignName = normalizeCampaignValue(companyNewCampaignNameEl?.value || "");
      if (!campaignName) return;
      setFooterUpdatingStatus();
      try {
        const createResult = await sendRuntimeMessage("DB_CREATE_CAMPAIGN", {
          payload: { campaign_name: campaignName },
        });
        const createResp = createResult.data || {};
        if (!createResult.ok || !createResp?.campaign?.campaign_id) {
          throw new Error(getErrorMessage(createResult.error || createResp?.error));
        }
        await loadCampaignOptions({ keepSelected: true });
        setCompanyNewCampaignRowVisible(false);
        setFooterStatus("Campaign created.");
      } catch (e) {
        setFooterStatus(`DB error: ${getErrorMessage(e)}`);
      } finally {
        setFooterReady();
      }
    });

    companyRenameCampaignBtnEl?.addEventListener("click", () => {
      const selectedId = safeTrim(companyCampaignSelectEl?.value);
      if (!selectedId) return;
      const row = getKnownCampaignRows().find(
        (item) => safeTrim(item?.campaign_id) === selectedId,
      );
      setCompanyNewCampaignRowVisible(false);
      setCompanyRenameCampaignRowVisible(true);
      if (companyRenameCampaignNameEl) {
        companyRenameCampaignNameEl.value = normalizeCampaignValue(
          row?.campaign_name || "",
        );
        companyRenameCampaignNameEl.focus();
        companyRenameCampaignNameEl.select();
      }
    });

    companyCancelRenameCampaignBtnEl?.addEventListener("click", () => {
      setCompanyRenameCampaignRowVisible(false);
    });

    companySaveRenameCampaignBtnEl?.addEventListener("click", async () => {
      const campaignId = safeTrim(companyCampaignSelectEl?.value);
      const campaignName = normalizeCampaignValue(
        companyRenameCampaignNameEl?.value || "",
      );
      if (!campaignId || !campaignName) return;
      setFooterUpdatingStatus();
      if (companySaveRenameCampaignBtnEl) {
        companySaveRenameCampaignBtnEl.disabled = true;
      }
      try {
        const result = await sendRuntimeMessage("DB_UPDATE_CAMPAIGN", {
          payload: { campaign_id: campaignId, campaign_name: campaignName },
        });
        if (!result.ok) throw new Error(getErrorMessage(result.error));
        await loadCampaignOptions({ keepSelected: true });
        setCompanyRenameCampaignRowVisible(false);
        companyCampaignSelectEl.value = campaignId;
        updateCompanyRenameCampaignButtonState();
        await refreshCompanyPeopleList();
        setFooterStatus("Campaign renamed.");
      } catch (e) {
        setFooterStatus(`DB error: ${getErrorMessage(e)}`);
      } finally {
        if (companySaveRenameCampaignBtnEl) {
          companySaveRenameCampaignBtnEl.disabled = false;
        }
        setFooterReady();
      }
    });
  }



  async function archiveSelectedCampaign() {
    const campaignId = safeTrim(campaignSelectEl?.value);
    if (!campaignId) return;
    const confirmed = window.confirm(
      "Archive this campaign? It will disappear from active selections.",
    );
    if (!confirmed) return;

    try {
      const result = await sendRuntimeMessage("DB_ARCHIVE_CAMPAIGN", {
        payload: { campaign_id: campaignId },
      });

      if (!result.ok) {
        throw new Error(getErrorMessage(result.error));
      }

      await loadCampaignOptions({ keepSelected: false });
      setFooterStatus("Campaign archived.");
    } catch (e) {
      setFooterStatus(`DB error: ${getErrorMessage(e)}`);
    }
  }


  globalObj.PopupCampaignController = Object.freeze({
    getKnownCampaignValues,
    setKnownCampaignValues,
    getKnownCampaignRows,
    setKnownCampaignRows,
    getLinkedPersonCampaignRows,
    setLinkedPersonCampaignRows,
    getCompanyLinkedCampaignRows,
    setCompanyLinkedCampaignRows,
    normalizeCampaignValue,
    pickCampaignTextColor,
    truncateCampaignLabel,
    buildCampaignOptionElement,
    hasCampaignOption,
    appendCampaignOption,
    updateRenameCampaignButtonState,
    updateCompanyRenameCampaignButtonState,
    updateOverviewCampaignFilterTitle,
    updateDetailCampaignSelectTitle,
    setCampaignSelectValue,
    setNewCampaignRowVisible,
    setRenameCampaignRowVisible,
    setCompanyNewCampaignRowVisible,
    setCompanyRenameCampaignRowVisible,
    saveLastActiveCampaign,
    loadLastActiveCampaign,
    rebuildCampaignSelectOptions,
    rebuildCompanyCampaignSelectOptions,
    rebuildOverviewCampaignFilterOptions,
    rebuildCompanyCampaignFilterOptions,
    renderLinkedCampaignChips,
    renderCompanyLinkedCampaignChips,
    openCampaignColorPicker,
    loadCampaignOptions,
    applyCampaignSelectionFromProfile,
    refreshPersonCampaignLinks,
    linkCampaignToCurrentPerson,
    handleCampaignSelection,
    renameSelectedCampaign,
    archiveSelectedCampaign,
    refreshCompanyPeopleList,
    bindCampaignEvents,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
