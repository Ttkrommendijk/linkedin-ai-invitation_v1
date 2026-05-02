(function initPopupTabs(globalObj) {
  function getEl(id) {
    return document.getElementById(id);
  }

  function setConfigInnerTab(which) {
    const supabaseActive = which === "supabase";
    const configGeneralTabBtnEl = getEl("configGeneralTabBtn");
    const configSupabaseTabBtnEl = getEl("configSupabaseTabBtn");
    const configGeneralPanelEl = getEl("configGeneralPanel");
    const tabSupabaseAuth = getEl("tabSupabaseAuth");

    configGeneralTabBtnEl?.classList.toggle("active", !supabaseActive);
    configSupabaseTabBtnEl?.classList.toggle("active", supabaseActive);
    configGeneralPanelEl?.classList.toggle("active", !supabaseActive);
    if (configGeneralPanelEl) configGeneralPanelEl.hidden = supabaseActive;
    tabSupabaseAuth?.classList.toggle("active", supabaseActive);
    if (tabSupabaseAuth) tabSupabaseAuth.hidden = !supabaseActive;
  }

  function setActiveTab(which, { userInitiated = false } = {}) {
    if (globalObj.IS_SIDE_PANEL_CONTEXT && !userInitiated) {
      return;
    }

    const tabMainBtn = getEl("tabMainBtn");
    const tabOverviewBtn = getEl("tabOverviewBtn");
    const tabConfigBtn = getEl("tabConfigBtn");
    const tabSupabaseAuthBtn = getEl("tabSupabaseAuthBtn");
    const tabMain = getEl("tabMain");
    const tabMessage = getEl("tabMessage");
    const tabOverview = getEl("tabOverview");
    const tabConfig = getEl("tabConfig");

    if (!tabMainBtn || !tabConfigBtn || !tabMain || !tabConfig) {
      return;
    }

    const freePromptActive = which === "free_prompt";
    const detailActive =
      which === "detail" || which === "invitation" || freePromptActive;
    const overviewActive = globalObj.OVERVIEW_ENABLED && which === "overview";
    const configActive = which === "config" || which === "supabase_login";
    const supabaseAuthActive = which === "supabase_login";

    tabMainBtn.classList.toggle("active", detailActive);
    if (tabOverviewBtn) tabOverviewBtn.classList.toggle("active", overviewActive);
    tabConfigBtn.classList.toggle("active", configActive);
    if (tabSupabaseAuthBtn)
      tabSupabaseAuthBtn.classList.toggle("active", supabaseAuthActive);

    tabMain.classList.toggle("active", detailActive);
    if (tabOverview) tabOverview.classList.toggle("active", overviewActive);
    tabConfig.classList.toggle("active", configActive);
    setConfigInnerTab(supabaseAuthActive ? "supabase" : "general");

    const detailInnerTab = globalObj.getDetailInnerTab?.();
    if (tabMessage) {
      tabMessage.hidden =
        globalObj.isCompanyProfileMode?.() ||
        !detailActive ||
        detailInnerTab === "invite" ||
        detailInnerTab === "free_prompt";
    }

    if (globalObj.isCompanyProfileMode?.()) {
      globalObj.applyProfileModeUi?.();
    }

    if (freePromptActive) {
      globalObj.setDetailInnerTab?.("free_prompt");
    }

    if (overviewActive) {
      globalObj.fetchOverviewPage?.();
    }
  }

  globalObj.setConfigInnerTab = setConfigInnerTab;
  globalObj.setActiveTab = setActiveTab;
})(globalThis);
