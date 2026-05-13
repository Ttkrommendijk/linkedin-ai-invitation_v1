function initTabsModule(deps = {}) {
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
    if (deps.IS_SIDE_PANEL_CONTEXT && !userInitiated) {
      return;
    }

    const tabMainBtn = getEl("tabMainBtn");
    const tabOverviewBtn = getEl("tabOverviewBtn");
    const tabConfigBtn = getEl("tabConfigBtn");
    const tabTodoBtn = getEl("tabTodoBtn");
    const tabSupabaseAuthBtn = getEl("tabSupabaseAuthBtn");
    const tabMain = getEl("tabMain");
    const tabMessage = getEl("tabMessage");
    const tabOverview = getEl("tabOverview");
    const tabConfig = getEl("tabConfig");
    const tabTodo = getEl("tabTodo");

    if (!tabMainBtn || !tabConfigBtn || !tabMain || !tabConfig) {
      return;
    }

    const freePromptActive = which === "free_prompt";
    const detailActive =
      which === "detail" || which === "invitation" || freePromptActive;
    const overviewActive = deps.OVERVIEW_ENABLED && which === "overview";
    const todoActive = which === "todo";
    const configActive = which === "config" || which === "supabase_login";
    const supabaseAuthActive = which === "supabase_login";

    tabMainBtn.classList.toggle("active", detailActive);
    if (tabOverviewBtn) tabOverviewBtn.classList.toggle("active", overviewActive);
    if (tabTodoBtn) tabTodoBtn.classList.toggle("active", todoActive);
    tabConfigBtn.classList.toggle("active", configActive);
    if (tabSupabaseAuthBtn)
      tabSupabaseAuthBtn.classList.toggle("active", supabaseAuthActive);

    tabMain.classList.toggle("active", detailActive);
    if (tabOverview) tabOverview.classList.toggle("active", overviewActive);
    if (tabTodo) tabTodo.classList.toggle("active", todoActive);
    tabConfig.classList.toggle("active", configActive);
    setConfigInnerTab(supabaseAuthActive ? "supabase" : "general");

    const detailInnerTab = deps.getDetailInnerTab?.();
    if (tabMessage) {
      tabMessage.hidden =
        deps.isCompanyProfileMode?.() ||
        !detailActive ||
        detailInnerTab === "invite" ||
        detailInnerTab === "free_prompt";
    }

    if (deps.isCompanyProfileMode?.()) {
      deps.applyProfileModeUi?.();
    }

    if (freePromptActive) {
      deps.setDetailInnerTab?.("free_prompt");
    }

    if (overviewActive) {
      deps.fetchOverviewPage?.();
    }

    if (todoActive) {
      globalThis.PopupTodoController?.setActiveTodoTab?.("notes");
    }
  }

  return { setConfigInnerTab, setActiveTab };
}

globalThis.initTabsModule = initTabsModule;
