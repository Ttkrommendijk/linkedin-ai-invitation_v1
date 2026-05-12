// Owns popup config/storage load/save logic and related UI wiring.
// Does not own invitation, message-generation, or profile flows.
(function initPopupConfigController(globalObj) {
  const popupDom = globalObj.PopupDom;
  if (!popupDom || typeof popupDom !== "object") {
    throw new Error("PopupDom must be loaded before popup-config-controller.js.");
  }
  const POPUP_STORAGE_KEYS =
    globalObj.PopupStorageKeys;
  if (!POPUP_STORAGE_KEYS) {
    throw new Error("Popup shared constants must be loaded before popup modules.");
  }
  const STORAGE_KEY_SUPABASE_URL = "supabase_url";
  const STORAGE_KEY_MESSAGE_LANGUAGE = POPUP_STORAGE_KEYS.messageLanguage;
  const STORAGE_KEY_FREE_PROMPT_LANGUAGE =
    POPUP_STORAGE_KEYS.freePromptLanguage;
  const STORAGE_KEY_NAV_PACING = "lef_nav_pacing_v1";
  const DEFAULT_SUPABASE_URL = "https://nkhujuqjnbzsfqyqfndc.supabase.co";
  const DEFAULT_NAV_PACING_CONFIG = Object.freeze({
    enabled: true,
    burst_free_count: 3,
    cooldown_min_ms: 1200,
    cooldown_max_ms: 3200,
    quiet_reset_ms: 12000,
  });
  const SUPPORTED_LANGUAGES = ["Portuguese", "English", "Dutch", "Spanish"];

  let deps = {};

  function getEl(id) {
    return document.getElementById(id);
  }

  function getDom() {
    return {
      apiKeyEl: popupDom.apiKeyEl || getEl("apiKey"),
      modelEl: popupDom.modelEl || getEl("model"),
      strategyEl: popupDom.strategyEl || getEl("strategy"),
      webhookBaseUrlEl: popupDom.webhookBaseUrlEl || getEl("webhookBaseUrl"),
      webhookSecretEl: popupDom.webhookSecretEl || getEl("webhookSecret"),
      navPacingEnabledEl:
        popupDom.navPacingEnabledEl || getEl("navPacingEnabled"),
      saveConfigBtnEl: popupDom.saveConfigBtnEl || getEl("saveConfig"),
      inviteLanguageEl: popupDom.inviteLanguageEl || getEl("inviteLanguage"),
      messageLanguageEl:
        popupDom.messageLanguageEl || getEl("messageLanguage"),
      freePromptLanguageEl:
        popupDom.freePromptLanguageEl || getEl("freePromptLanguage"),
    };
  }

  function configure(nextDeps = {}) {
    deps = { ...deps, ...nextDeps };
    const dom = getDom();
    return {
      ...dom,
      loadSettings,
      saveConfig,
      bindConfigEvents,
      loadMessageLanguage,
      loadFreePromptLanguage,
    };
  }

  function normalizeSupabaseUrl(value) {
    return String(value || "")
      .trim()
      .replace(/\/+$/, "");
  }

  function getEffectiveSupabaseUrl(localUrl, legacyUrl) {
    const normalizedLocal = normalizeSupabaseUrl(localUrl);
    if (normalizedLocal) return normalizedLocal;
    const normalizedLegacy = normalizeSupabaseUrl(legacyUrl);
    if (normalizedLegacy) return normalizedLegacy;
    return DEFAULT_SUPABASE_URL;
  }

  async function saveSupabaseUrlOverride(rawValue, { showStatus = true } = {}) {
    const { webhookBaseUrlEl } = getDom();
    const normalized = normalizeSupabaseUrl(rawValue);
    if (!normalized) {
      await chrome.storage.local.remove([STORAGE_KEY_SUPABASE_URL]);
      if (webhookBaseUrlEl) webhookBaseUrlEl.value = DEFAULT_SUPABASE_URL;
      if (showStatus) deps.setFooterStatus?.("Supabase URL saved.");
      return DEFAULT_SUPABASE_URL;
    }
    await chrome.storage.local.set({ [STORAGE_KEY_SUPABASE_URL]: normalized });
    if (webhookBaseUrlEl) webhookBaseUrlEl.value = normalized;
    if (showStatus) deps.setFooterStatus?.("Supabase URL saved.");
    return normalized;
  }

  function mergeNavPacingConfig(rawConfig) {
    const cfg =
      rawConfig && typeof rawConfig === "object"
        ? rawConfig
        : Object.create(null);
    return {
      ...DEFAULT_NAV_PACING_CONFIG,
      ...cfg,
      enabled:
        typeof cfg.enabled === "boolean"
          ? cfg.enabled
          : DEFAULT_NAV_PACING_CONFIG.enabled,
    };
  }

  async function loadNavPacingConfigForUi() {
    const data = await chrome.storage.local.get([STORAGE_KEY_NAV_PACING]);
    return mergeNavPacingConfig(data?.[STORAGE_KEY_NAV_PACING]);
  }

  async function saveNavPacingEnabled(enabled) {
    const current = await loadNavPacingConfigForUi();
    const next = {
      ...current,
      enabled: Boolean(enabled),
    };
    await chrome.storage.local.set({
      [STORAGE_KEY_NAV_PACING]: next,
    });
  }

  async function loadSettings() {
    const {
      apiKeyEl,
      modelEl,
      strategyEl,
      webhookBaseUrlEl,
      webhookSecretEl,
      navPacingEnabledEl,
    } = getDom();
    const [
      { apiKey, webhookSecret, [STORAGE_KEY_SUPABASE_URL]: supabaseUrlLocal },
      { model, strategyCore, webhookBaseUrl },
    ] = await Promise.all([
      chrome.storage.local.get([
        POPUP_STORAGE_KEYS.apiKey,
        "webhookSecret",
        STORAGE_KEY_SUPABASE_URL,
      ]),
      chrome.storage.sync.get([POPUP_STORAGE_KEYS.model, "strategyCore", POPUP_STORAGE_KEYS.webhookBaseUrl]),
    ]);

    if (apiKeyEl && apiKey) apiKeyEl.value = apiKey;
    if (webhookSecretEl && webhookSecret) webhookSecretEl.value = webhookSecret;

    if (modelEl) modelEl.value = model || "gpt-4.1";
    if (strategyEl && strategyCore) strategyEl.value = strategyCore;
    if (webhookBaseUrlEl) {
      webhookBaseUrlEl.value = getEffectiveSupabaseUrl(
        supabaseUrlLocal,
        webhookBaseUrl,
      );
    }
    const navPacingConfig = await loadNavPacingConfigForUi();
    if (navPacingEnabledEl) {
      navPacingEnabledEl.checked = Boolean(navPacingConfig.enabled);
    }
  }

  async function saveConfig() {
    const {
      apiKeyEl,
      modelEl,
      strategyEl,
      webhookBaseUrlEl,
      webhookSecretEl,
    } = getDom();
    const apiKey = (apiKeyEl?.value || "").trim();
    const model = (modelEl?.value || "gpt-4.1").trim();
    const strategyCore = (strategyEl?.value || "").trim();

    const webhookBaseUrl = await saveSupabaseUrlOverride(
      webhookBaseUrlEl?.value || "",
      { showStatus: false },
    );
    const localConfigPayload = { [POPUP_STORAGE_KEYS.apiKey]: apiKey };
    if (webhookSecretEl) {
      localConfigPayload.webhookSecret = (webhookSecretEl.value || "").trim();
    }

    await chrome.storage.local.set(localConfigPayload);
    await chrome.storage.sync.set({
      [POPUP_STORAGE_KEYS.model]: model,
      strategyCore,
      [POPUP_STORAGE_KEYS.webhookBaseUrl]: webhookBaseUrl,
    });

    deps.setFooterStatus?.("Config saved.");
  }

  function bindConfigEvents() {
    const { saveConfigBtnEl, webhookBaseUrlEl, navPacingEnabledEl } = getDom();
    if (saveConfigBtnEl && saveConfigBtnEl.dataset.configBound !== "1") {
      saveConfigBtnEl.dataset.configBound = "1";
      saveConfigBtnEl.addEventListener("click", async () => {
        deps.setFooterUpdatingStatus?.();
        try {
          await saveConfig();
        } finally {
          deps.setFooterReady?.();
        }
      });
    }

    if (webhookBaseUrlEl && webhookBaseUrlEl.dataset.configBound !== "1") {
      webhookBaseUrlEl.dataset.configBound = "1";
      webhookBaseUrlEl.addEventListener("change", async () => {
        await saveSupabaseUrlOverride(webhookBaseUrlEl.value || "");
      });
    }

    if (navPacingEnabledEl && navPacingEnabledEl.dataset.configBound !== "1") {
      navPacingEnabledEl.dataset.configBound = "1";
      navPacingEnabledEl.addEventListener("change", async () => {
        await saveNavPacingEnabled(Boolean(navPacingEnabledEl.checked));
      });
    }
  }

  function normalizeLanguageValue(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const match = SUPPORTED_LANGUAGES.find(
      (lang) => lang.toLowerCase() === raw.toLowerCase(),
    );
    return match || "";
  }

  async function loadMessageLanguage() {
    const { [STORAGE_KEY_MESSAGE_LANGUAGE]: savedLanguage } =
      await chrome.storage.local.get([STORAGE_KEY_MESSAGE_LANGUAGE]);
    if (typeof savedLanguage === "string" && savedLanguage.trim()) {
      await deps.setLanguage?.(savedLanguage.trim(), { persist: false });
      return;
    }
    await deps.setLanguage?.("Portuguese", { persist: false });
  }

  async function loadFreePromptLanguage() {
    const data = await chrome.storage.local.get([
      STORAGE_KEY_FREE_PROMPT_LANGUAGE,
      STORAGE_KEY_MESSAGE_LANGUAGE,
    ]);
    const savedFreePromptLanguage = normalizeLanguageValue(
      data?.[STORAGE_KEY_FREE_PROMPT_LANGUAGE],
    );
    if (savedFreePromptLanguage) {
      await deps.setFreePromptLanguage?.(savedFreePromptLanguage, {
        persist: false,
      });
      return;
    }
    const savedMessageLanguage = normalizeLanguageValue(
      data?.[STORAGE_KEY_MESSAGE_LANGUAGE],
    );
    if (savedMessageLanguage) {
      await deps.setFreePromptLanguage?.(savedMessageLanguage, {
        persist: false,
      });
      return;
    }
    await deps.setFreePromptLanguage?.("Portuguese", { persist: false });
  }

  function loadFirstMessagePrompt() {}

  function updateSavePromptButtonState() {}

  globalObj.PopupConfigController = Object.freeze({
    configure,
    loadSettings,
    saveConfig,
    bindConfigEvents,
    normalizeSupabaseUrl,
    getEffectiveSupabaseUrl,
    saveSupabaseUrlOverride,
    mergeNavPacingConfig,
    loadNavPacingConfigForUi,
    saveNavPacingEnabled,
    loadMessageLanguage,
    loadFreePromptLanguage,
    loadFirstMessagePrompt,
    updateSavePromptButtonState,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
