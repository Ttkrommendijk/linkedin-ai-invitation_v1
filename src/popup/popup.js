const apiKeyEl = document.getElementById("apiKey");
const modelEl = document.getElementById("model");
const positioningEl = document.getElementById("positioning");
const strategyEl = document.getElementById("strategy");
const focusEl = document.getElementById("focus");

const statusEl = document.getElementById("status");
const previewEl = document.getElementById("preview");

const tabMainBtn = document.getElementById("tabMainBtn");
const tabConfigBtn = document.getElementById("tabConfigBtn");
const tabMain = document.getElementById("tabMain");
const tabConfig = document.getElementById("tabConfig");

const webhookBaseUrlEl = document.getElementById("webhookBaseUrl");
const webhookSecretEl = document.getElementById("webhookSecret");

async function copyToClipboard(text) {
  const value = (text || "").trim();
  if (!value) throw new Error("Nothing to copy.");

  // Try modern clipboard API first (best when called from Copy button click)
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch (err) {
    // Fallback below
  }

  // Fallback: execCommand copy
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "-9999px";
  document.body.appendChild(ta);

  ta.select();
  ta.setSelectionRange(0, ta.value.length);

  const ok = document.execCommand("copy");
  document.body.removeChild(ta);

  if (!ok) throw new Error("Copy failed (execCommand).");
}


function setActiveTab(which) {
  const mainActive = which === "main";
  tabMainBtn.classList.toggle("active", mainActive);
  tabConfigBtn.classList.toggle("active", !mainActive);
  tabMain.classList.toggle("active", mainActive);
  tabConfig.classList.toggle("active", !mainActive);
}

tabMainBtn.addEventListener("click", () => setActiveTab("main"));
tabConfigBtn.addEventListener("click", () => setActiveTab("config"));

async function loadSettings() {
  const [{ apiKey, webhookSecret }, { model, positioning, strategyCore, webhookBaseUrl }] =
    await Promise.all([
      chrome.storage.local.get(["apiKey", "webhookSecret"]),
      chrome.storage.sync.get(["model", "positioning", "strategyCore", "webhookBaseUrl"])
    ]);

  if (apiKey) apiKeyEl.value = apiKey;
  if (webhookSecret) webhookSecretEl.value = webhookSecret;

  modelEl.value = model || "gpt-4.1";
  if (positioning) positioningEl.value = positioning;
  if (strategyCore) strategyEl.value = strategyCore;
  if (webhookBaseUrl) webhookBaseUrlEl.value = webhookBaseUrl;
}
loadSettings();

async function saveConfig() {
  const apiKey = (apiKeyEl.value || "").trim();
  const model = (modelEl.value || "gpt-4.1").trim();
  const strategyCore = (strategyEl.value || "").trim();

  const webhookBaseUrl = (webhookBaseUrlEl.value || "").trim().replace(/\/+$/, "");
  const webhookSecret = (webhookSecretEl.value || "").trim();

  await chrome.storage.local.set({ apiKey, webhookSecret });
  await chrome.storage.sync.set({ model, strategyCore, webhookBaseUrl });

  statusEl.textContent = "Config saved.";
}

async function savePositioning() {
  const positioning = (positioningEl.value || "").trim();
  await chrome.storage.sync.set({ positioning });
}

document.getElementById("saveConfig").addEventListener("click", async () => {
  await saveConfig();
});

document.getElementById("markInvited").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const ctx = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PROFILE_CONTEXT" }).catch(() => null);
  if (!ctx?.ok) { statusEl.textContent = "Open a LinkedIn profile first."; return; }

  const resp = await chrome.runtime.sendMessage({
    type: "DB_MARK_STATUS",
    payload: { linkedin_url: ctx.profile.url, status: "invited" }
  });

  statusEl.textContent = resp?.ok ? "Marked as invited ✅" : `DB error: ${resp?.error || "unknown"}`;
});

document.getElementById("markAccepted").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const ctx = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PROFILE_CONTEXT" }).catch(() => null);
  if (!ctx?.ok) { statusEl.textContent = "Open a LinkedIn profile first."; return; }

  const resp = await chrome.runtime.sendMessage({
    type: "DB_MARK_STATUS",
    payload: { linkedin_url: ctx.profile.url, status: "accepted" }
  });

  statusEl.textContent = resp?.ok ? "Marked as accepted ✅" : `DB error: ${resp?.error || "unknown"}`;
});

document.getElementById("copyBtn").addEventListener("click", async () => {
  try {
    await copyToClipboard(previewEl.textContent || "");
    statusEl.textContent = "Copied to clipboard ✅";
  } catch (e) {
    statusEl.textContent = `Copy failed: ${String(e?.message || e)}`;
  }
});

document.getElementById("generate").addEventListener("click", async () => {
  statusEl.textContent = "Extracting profile…";
  previewEl.textContent = "";

  await savePositioning();
  await chrome.storage.sync.set({ strategyCore: (strategyEl.value || "").trim() });

  const focus = (focusEl.value || "").trim();

const [{ apiKey: apiKeyLocal }, { model, positioning, strategyCore }] = await Promise.all([
  chrome.storage.local.get(["apiKey"]),
  chrome.storage.sync.get(["model", "positioning", "strategyCore"])
]);

// fallback: if local is empty but user typed the key in the field, use it and persist it
let apiKey = (apiKeyLocal || "").trim();
if (!apiKey) {
  const typed = (apiKeyEl.value || "").trim();
  if (typed) {
    apiKey = typed;
    await chrome.storage.local.set({ apiKey }); // persist so next time it works
  }
}

statusEl.textContent = `apiKey local: ${apiKey ? "YES" : "NO"}`;

console.log("apiKeyLocal:", apiKeyLocal);
console.log("apiKeyInput:", apiKeyEl.value);
if (!apiKey) {
  statusEl.textContent = "Please set your API key in Config.";
  setActiveTab("config");
  return;
}

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    statusEl.textContent = "No active tab found.";
    return;
  }

  const ctx = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PROFILE_CONTEXT" }).catch(() => null);
  if (!ctx?.ok) {
    statusEl.textContent = "Could not extract profile context (are you on a LinkedIn profile page?).";
    return;
  }

  statusEl.textContent = "Calling OpenAI…";

  const resp = await chrome.runtime.sendMessage({
    type: "GENERATE_INVITE",
    payload: {
      apiKey,
      model: (model || "gpt-4.1").trim(),
      positioning: positioning || "",
      focus,
      strategyCore: strategyCore || "",
      profile: ctx.profile
    }
  });

  if (!resp?.ok) {
    statusEl.textContent = `Error: ${resp?.error || "unknown"}`;
    return;
  }

const message = (resp.message || "").trim();
previewEl.textContent = message;

// 1) COPY FIRST (so user always gets it)
try {
  await copyToClipboard(message);
  statusEl.textContent = `Copied to clipboard ✅ (${message.length} chars)`;
} catch (e) {
  statusEl.textContent = `Copy failed: ${String(e?.message || e)}`;
}

// 2) DB WRITE SECOND (fire-and-forget, don't block copy)
chrome.runtime.sendMessage({
  type: "DB_UPSERT_GENERATED",
  payload: {
    linkedin_url: ctx.profile.url,
    full_name: ctx.profile.name || null,
    company: ctx.profile.company || null,
    headline: ctx.profile.headline || null,
    message,
    focus,
    positioning: positioning || "",
    generated_at: new Date().toISOString(),
    status: "generated"
  }
}).then((dbResp) => {
  if (!dbResp?.ok) {
    // don't overwrite the copy success; just append info
    statusEl.textContent += ` | DB error: ${dbResp?.error || "unknown"}`;
  }
}).catch((e) => {
  statusEl.textContent += ` | DB error: ${String(e?.message || e)}`;
});


});
