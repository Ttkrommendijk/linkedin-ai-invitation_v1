function initConfigModule(deps = {}) {
var apiKeyEl = document.getElementById("apiKey");
var modelEl = document.getElementById("model");
var strategyEl = document.getElementById("strategy");
var webhookBaseUrlEl = document.getElementById("webhookBaseUrl");
var webhookSecretEl = document.getElementById("webhookSecret");
var navPacingEnabledEl = document.getElementById("navPacingEnabled");
var STORAGE_KEY_SUPABASE_URL = "supabase_url";

async function loadSettings() {
  const [
    { apiKey, webhookSecret, [STORAGE_KEY_SUPABASE_URL]: supabaseUrlLocal },
    { model, strategyCore, webhookBaseUrl },
  ] = await Promise.all([
    chrome.storage.local.get([
      "apiKey",
      "webhookSecret",
      STORAGE_KEY_SUPABASE_URL,
    ]),
    chrome.storage.sync.get(["model", "strategyCore", "webhookBaseUrl"]),
  ]);

  if (apiKeyEl && apiKey) apiKeyEl.value = apiKey;
  if (webhookSecretEl && webhookSecret) webhookSecretEl.value = webhookSecret;

  if (modelEl) modelEl.value = model || "gpt-4.1";
  if (strategyEl && strategyCore) strategyEl.value = strategyCore;
  if (webhookBaseUrlEl) {
    webhookBaseUrlEl.value = deps.getEffectiveSupabaseUrl(
      supabaseUrlLocal,
      webhookBaseUrl,
    );
  }
  const navPacingConfig = await deps.loadNavPacingConfigForUi();
  if (navPacingEnabledEl) {
    navPacingEnabledEl.checked = Boolean(navPacingConfig.enabled);
  }
}

async function saveConfig() {
  const apiKey = (apiKeyEl.value || "").trim();
  const model = (modelEl.value || "gpt-4.1").trim();
  const strategyCore = (strategyEl.value || "").trim();

  const webhookBaseUrl = await deps.saveSupabaseUrlOverride(
    webhookBaseUrlEl?.value || "",
    { showStatus: false },
  );
  const localConfigPayload = { apiKey };
  if (webhookSecretEl) {
    localConfigPayload.webhookSecret = (webhookSecretEl.value || "").trim();
  }

  await chrome.storage.local.set(localConfigPayload);
  await chrome.storage.sync.set({ model, strategyCore, webhookBaseUrl });

  deps.setFooterStatus("Config saved.");
}

function bindConfigEvents() {
  const saveConfigBtnEl = document.getElementById("saveConfig");
  if (saveConfigBtnEl && saveConfigBtnEl.dataset.configBound !== "1") {
    saveConfigBtnEl.dataset.configBound = "1";
    saveConfigBtnEl.addEventListener("click", async () => {
      deps.setFooterUpdatingStatus();
      try {
        await saveConfig();
      } finally {
        deps.setFooterReady();
      }
    });
  }

  if (webhookBaseUrlEl && webhookBaseUrlEl.dataset.configBound !== "1") {
    webhookBaseUrlEl.dataset.configBound = "1";
    webhookBaseUrlEl.addEventListener("change", async () => {
      await deps.saveSupabaseUrlOverride(webhookBaseUrlEl.value || "");
    });
  }

  if (navPacingEnabledEl && navPacingEnabledEl.dataset.configBound !== "1") {
    navPacingEnabledEl.dataset.configBound = "1";
    navPacingEnabledEl.addEventListener("change", async () => {
      await deps.saveNavPacingEnabled(Boolean(navPacingEnabledEl.checked));
    });
  }
}

return {
  apiKeyEl,
  modelEl,
  strategyEl,
  webhookBaseUrlEl,
  webhookSecretEl,
  navPacingEnabledEl,
  loadSettings,
  saveConfig,
  bindConfigEvents,
};
}

globalThis.initConfigModule = initConfigModule;
