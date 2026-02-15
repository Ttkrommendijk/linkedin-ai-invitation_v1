const apiKeyEl = document.getElementById("apiKey");
const modelEl = document.getElementById("model");
const strategyEl = document.getElementById("strategy");
const focusEl = document.getElementById("focus");
const messagePromptEl = document.getElementById("messagePrompt");
const savePromptBtnEl = document.getElementById("savePromptBtn");
const resetPromptBtnEl = document.getElementById("resetPromptBtn");
const promptStatusEl = document.getElementById("promptStatus");

const EMOJI_CHECK = "\u2705";
const SYMBOL_ELLIPSIS = "\u2026";
const DEBUG = true; // set DEBUG=false after diagnosis
const STORAGE_KEY_FIRST_MESSAGE_PROMPT = "firstMessagePrompt";
const PROMPT_SAVE_DEBOUNCE_MS = 600;
const TEXT_PROMPT_SAVED = "Prompt saved.";
const TEXT_PROMPT_LOADED = "Prompt loaded.";
const TEXT_PROMPT_IDLE = "Prompt status: idle";
const DEFAULT_FIRST_MESSAGE_PROMPT =
  "Escreva a melhor primeira mensagem no LinkedIn apos aceitarem a conexao, em portugues. Agradeca pela conexao e cite uma referencia factual do perfil (cargo, empresa, projeto, area ou conquista), sem inventar fatos. Tom de par para par, amigavel, neutro, objetivo e sem linguagem comercial. Nao faca pitch de servicos. Objetivo: abrir uma conversa leve; reuniao pode ser sugerida apenas de forma sutil. Maximo de 2 paragrafos curtos e no maximo 1 pergunta leve. Sem emojis, sem hashtags e sem bullet points.";

function debug(...args) {
  if (DEBUG) console.log(...args);
}

const statusEl = document.getElementById("status");
const messageStatusEl = document.getElementById("messageStatus");
const previewEl = document.getElementById("preview");
const firstMessagePreviewEl = document.getElementById("firstMessagePreview");
const profileContextPreviewEl = document.getElementById(
  "profileContextPreview",
);
const copyBtnEl = document.getElementById("copyBtn");

const tabMainBtn = document.getElementById("tabMainBtn");
const tabMessageBtn = document.getElementById("tabMessageBtn");
const tabConfigBtn = document.getElementById("tabConfigBtn");
const tabMain = document.getElementById("tabMain");
const tabMessage = document.getElementById("tabMessage");
const tabConfig = document.getElementById("tabConfig");

const webhookBaseUrlEl = document.getElementById("webhookBaseUrl");
const webhookSecretEl = document.getElementById("webhookSecret");

let lastProfileContextSent = {};
let lastProfileContextEnriched = null;
let currentProfileContext = null;
let firstMessage = "";
let promptSaveTimer = null;

function getErrorMessage(error) {
  if (error && typeof error === "object" && typeof error.message === "string") {
    return error.message;
  }
  return String(error || "unknown");
}

function renderProfileContext() {
  profileContextPreviewEl.textContent = JSON.stringify(
    {
      sent_to_ai: lastProfileContextSent || {},
      enriched_from_llm: lastProfileContextEnriched,
    },
    null,
    2,
  );
}

function getProfileForGeneration(profile) {
  const p = profile || {};
  const out = {};

  const copyKeys = [
    "url",
    "profile_url",
    "linkedin_url",
    "name",
    "full_name",
    "first_name",
    "headline",
    "company",
    "location",
    "about",
    "recent_experience",
  ];

  for (const key of copyKeys) {
    if (p[key] !== undefined && p[key] !== null) {
      out[key] = p[key];
    }
  }

  if (p.excerpt_fallback) {
    out.excerpt_fallback = p.excerpt_fallback;
  }

  return out;
}

function getLinkedinUrlFromContext(profileContext) {
  return (
    profileContext?.url ||
    profileContext?.profile_url ||
    profileContext?.linkedin_url ||
    null
  );
}

function getFullNameFromContext(profileContext) {
  return profileContext?.name || profileContext?.full_name || null;
}

async function extractProfileContextFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  const ctx = await chrome.tabs
    .sendMessage(tab.id, { type: "EXTRACT_PROFILE_CONTEXT" })
    .catch(() => null);

  if (!ctx?.ok) {
    throw new Error(getErrorMessage(ctx?.error) || "profile extraction failed");
  }

  return getProfileForGeneration(ctx.profile);
}

async function loadProfileContextOnOpen() {
  try {
    const profileContext = await extractProfileContextFromActiveTab();
    currentProfileContext = profileContext;
    lastProfileContextSent = profileContext;
    lastProfileContextEnriched = null;
    renderProfileContext();
  } catch (_e) {
    currentProfileContext = null;
    lastProfileContextSent = {};
    lastProfileContextEnriched = null;
    renderProfileContext();
  }
}

async function copyToClipboard(text) {
  const value = (text || "").trim();
  if (!value) throw new Error("Nothing to copy.");

  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch (_err) {
    // Fallback below
  }

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

function setCopyButtonEnabled(enabled) {
  copyBtnEl.disabled = !enabled;
}

function setPromptStatus(text) {
  if (promptStatusEl) {
    promptStatusEl.textContent = text;
  }
}

async function saveFirstMessagePrompt(value) {
  const raw = String(value || "");
  const toStore = raw.trim() ? raw : DEFAULT_FIRST_MESSAGE_PROMPT;
  await chrome.storage.sync.set({
    [STORAGE_KEY_FIRST_MESSAGE_PROMPT]: toStore,
  });
  if (messagePromptEl.value !== toStore) {
    messagePromptEl.value = toStore;
  }
  setPromptStatus(TEXT_PROMPT_SAVED);
}

function schedulePromptSave() {
  if (promptSaveTimer) {
    clearTimeout(promptSaveTimer);
  }
  setPromptStatus(`Saving${SYMBOL_ELLIPSIS}`);
  promptSaveTimer = setTimeout(() => {
    saveFirstMessagePrompt(messagePromptEl.value).catch((e) => {
      setPromptStatus(`Save failed: ${getErrorMessage(e)}`);
    });
  }, PROMPT_SAVE_DEBOUNCE_MS);
}

async function loadFirstMessagePrompt() {
  const stored = await chrome.storage.sync.get([
    STORAGE_KEY_FIRST_MESSAGE_PROMPT,
  ]);
  const saved = stored?.[STORAGE_KEY_FIRST_MESSAGE_PROMPT];
  if (typeof saved === "string" && saved.trim()) {
    messagePromptEl.value = saved;
  } else {
    messagePromptEl.value = DEFAULT_FIRST_MESSAGE_PROMPT;
  }
  setPromptStatus(TEXT_PROMPT_LOADED);
}

function setActiveTab(which) {
  const invitationActive = which === "invitation";
  const messageActive = which === "message";
  const configActive = which === "config";

  tabMainBtn.classList.toggle("active", invitationActive);
  tabMessageBtn.classList.toggle("active", messageActive);
  tabConfigBtn.classList.toggle("active", configActive);

  tabMain.classList.toggle("active", invitationActive);
  tabMessage.classList.toggle("active", messageActive);
  tabConfig.classList.toggle("active", configActive);
}

tabMainBtn.addEventListener("click", () => setActiveTab("invitation"));
tabMessageBtn.addEventListener("click", () => setActiveTab("message"));
tabConfigBtn.addEventListener("click", () => setActiveTab("config"));

async function loadSettings() {
  const [{ apiKey, webhookSecret }, { model, strategyCore, webhookBaseUrl }] =
    await Promise.all([
      chrome.storage.local.get(["apiKey", "webhookSecret"]),
      chrome.storage.sync.get(["model", "strategyCore", "webhookBaseUrl"]),
    ]);

  if (apiKey) apiKeyEl.value = apiKey;
  if (webhookSecret) webhookSecretEl.value = webhookSecret;

  modelEl.value = model || "gpt-4.1";
  if (strategyCore) strategyEl.value = strategyCore;
  if (webhookBaseUrl) webhookBaseUrlEl.value = webhookBaseUrl;
}

function initPopup() {
  setPromptStatus(TEXT_PROMPT_IDLE);

  loadSettings();
  loadFirstMessagePrompt().catch((e) => {
    setPromptStatus(`Load failed: ${getErrorMessage(e)}`);
  });
  setCopyButtonEnabled(false);
  renderProfileContext();
  loadProfileContextOnOpen();

  messagePromptEl.addEventListener("input", () => {
    schedulePromptSave();
  });

  messagePromptEl.addEventListener("blur", async () => {
    if (promptSaveTimer) {
      clearTimeout(promptSaveTimer);
      promptSaveTimer = null;
    }
    try {
      await saveFirstMessagePrompt(messagePromptEl.value);
    } catch (e) {
      setPromptStatus(`Save failed: ${getErrorMessage(e)}`);
    }
  });

  savePromptBtnEl.addEventListener("click", async () => {
    if (promptSaveTimer) {
      clearTimeout(promptSaveTimer);
      promptSaveTimer = null;
    }
    try {
      await saveFirstMessagePrompt(messagePromptEl.value);
    } catch (e) {
      setPromptStatus(`Save failed: ${getErrorMessage(e)}`);
    }
  });

  resetPromptBtnEl.addEventListener("click", async () => {
    if (promptSaveTimer) {
      clearTimeout(promptSaveTimer);
      promptSaveTimer = null;
    }
    messagePromptEl.value = DEFAULT_FIRST_MESSAGE_PROMPT;
    try {
      await saveFirstMessagePrompt(messagePromptEl.value);
      setPromptStatus("Prompt reset to default.");
    } catch (e) {
      setPromptStatus(`Reset failed: ${getErrorMessage(e)}`);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPopup);
} else {
  initPopup();
}

async function saveConfig() {
  const apiKey = (apiKeyEl.value || "").trim();
  const model = (modelEl.value || "gpt-4.1").trim();
  const strategyCore = (strategyEl.value || "").trim();

  const webhookBaseUrl = (webhookBaseUrlEl.value || "")
    .trim()
    .replace(/\/+$/, "");
  const webhookSecret = (webhookSecretEl.value || "").trim();

  await chrome.storage.local.set({ apiKey, webhookSecret });
  await chrome.storage.sync.set({ model, strategyCore, webhookBaseUrl });

  statusEl.textContent = "Config saved.";
  messageStatusEl.textContent = "Config saved.";
}

document.getElementById("saveConfig").addEventListener("click", async () => {
  await saveConfig();
});

document.getElementById("markInvited").addEventListener("click", async () => {
  if (!currentProfileContext) {
    statusEl.textContent = "Open a LinkedIn profile first.";
    return;
  }

  const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedin_url) {
    statusEl.textContent = "Missing LinkedIn URL in profile context.";
    return;
  }

  const resp = await chrome.runtime.sendMessage({
    type: "DB_MARK_STATUS",
    payload: { linkedin_url, status: "invited" },
  });

  statusEl.textContent = resp?.ok
    ? `Marked as invited ${EMOJI_CHECK}`
    : `DB error: ${getErrorMessage(resp?.error)}`;
});

document.getElementById("markAccepted").addEventListener("click", async () => {
  if (!currentProfileContext) {
    statusEl.textContent = "Open a LinkedIn profile first.";
    return;
  }

  const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedin_url) {
    statusEl.textContent = "Missing LinkedIn URL in profile context.";
    return;
  }

  const resp = await chrome.runtime.sendMessage({
    type: "DB_MARK_STATUS",
    payload: { linkedin_url, status: "accepted" },
  });

  statusEl.textContent = resp?.ok
    ? `Marked as accepted ${EMOJI_CHECK}`
    : `DB error: ${getErrorMessage(resp?.error)}`;
});

copyBtnEl.addEventListener("click", async () => {
  try {
    await copyToClipboard(previewEl.textContent || "");
    statusEl.textContent = "Copied to clipboard.";
  } catch (e) {
    statusEl.textContent = `Copy failed: ${String(e?.message || e)}`;
  }
});

document.getElementById("generate").addEventListener("click", async () => {
  statusEl.textContent = `Preparing profile${SYMBOL_ELLIPSIS}`;
  previewEl.textContent = "";
  setCopyButtonEnabled(false);

  await chrome.storage.sync.set({
    strategyCore: (strategyEl.value || "").trim(),
  });

  const focus = (focusEl.value || "").trim();

  const [{ apiKey: apiKeyLocal }, { model, positioning, strategyCore }] =
    await Promise.all([
      chrome.storage.local.get(["apiKey"]),
      chrome.storage.sync.get(["model", "positioning", "strategyCore"]),
    ]);

  let apiKey = (apiKeyLocal || "").trim();
  if (!apiKey) {
    const typed = (apiKeyEl.value || "").trim();
    if (typed) {
      apiKey = typed;
      await chrome.storage.local.set({ apiKey });
    }
  }

  if (!apiKey) {
    statusEl.textContent = "Please set your API key in Config.";
    setActiveTab("config");
    return;
  }

  if (!currentProfileContext) {
    statusEl.textContent =
      "Could not extract profile context (open a LinkedIn profile page and reopen the popup).";
    return;
  }

  const profileContextForGeneration = { ...currentProfileContext };
  lastProfileContextSent = profileContextForGeneration;
  lastProfileContextEnriched = null;
  renderProfileContext();

  statusEl.textContent = `Calling OpenAI${SYMBOL_ELLIPSIS}`;

  debug("Sending minimized profile context to invitation generation.");
  const resp = await chrome.runtime.sendMessage({
    type: "GENERATE_INVITE",
    payload: {
      apiKey,
      model: (model || "gpt-4.1").trim(),
      positioning: positioning || "",
      focus,
      strategyCore: strategyCore || "",
      profile: profileContextForGeneration,
    },
  });

  if (!resp?.ok) {
    statusEl.textContent = `Error: ${getErrorMessage(resp?.error)}`;
    return;
  }

  debug("GENERATE_INVITE full response:", resp);

  const inviteText = (resp.invite_text || "").trim();
  const llmCompany = (resp.company || "").trim();
  const llmHeadline = (resp.headline || "").trim();

  lastProfileContextEnriched = {
    company: llmCompany,
    headline: llmHeadline,
  };
  debug("enriched_from_llm assigned:", lastProfileContextEnriched);
  renderProfileContext();

  if (!currentProfileContext.company && llmCompany) {
    currentProfileContext.company = llmCompany;
  }
  if (!currentProfileContext.headline && llmHeadline) {
    currentProfileContext.headline = llmHeadline;
  }

  previewEl.textContent = inviteText;
  setCopyButtonEnabled(Boolean(inviteText));
  statusEl.textContent = inviteText
    ? "Generated. Click Copy."
    : "No message generated.";

  const upsertCompany = llmCompany || currentProfileContext.company || null;
  const upsertHeadline = llmHeadline || currentProfileContext.headline || null;
  const linkedinUrl = getLinkedinUrlFromContext(currentProfileContext);
  const fullName = getFullNameFromContext(currentProfileContext);

  chrome.runtime
    .sendMessage({
      type: "DB_UPSERT_GENERATED",
      payload: {
        linkedin_url: linkedinUrl,
        full_name: fullName,
        company: upsertCompany,
        headline: upsertHeadline,
        message: inviteText,
        focus,
        positioning: positioning || "",
        generated_at: new Date().toISOString(),
        status: "generated",
      },
    })
    .then((dbResp) => {
      debug("DB_UPSERT_GENERATED payload sent:", {
        linkedin_url: linkedinUrl,
        full_name: fullName,
        company: upsertCompany,
        headline: upsertHeadline,
        message: inviteText,
        focus,
        positioning: positioning || "",
        generated_at: "ISO_TIMESTAMP",
        status: "generated",
      });
      return dbResp;
    })
    .then((dbResp) => {
      if (!dbResp?.ok) {
        statusEl.textContent += ` | DB error: ${getErrorMessage(dbResp?.error)}`;
      }
    })
    .catch((e) => {
      statusEl.textContent += ` | DB error: ${getErrorMessage(e)}`;
    });
});

document
  .getElementById("generateFirstMessage")
  .addEventListener("click", async () => {
    messageStatusEl.textContent = `Generating first message${SYMBOL_ELLIPSIS}`;
    firstMessagePreviewEl.textContent = "";

    const prompt = (messagePromptEl.value || "").trim();
    if (!prompt) {
      messageStatusEl.textContent = "Message prompt is required.";
      return;
    }

    const [{ apiKey: apiKeyLocal }, { model }] = await Promise.all([
      chrome.storage.local.get(["apiKey"]),
      chrome.storage.sync.get(["model"]),
    ]);

    let apiKey = (apiKeyLocal || "").trim();
    if (!apiKey) {
      const typed = (apiKeyEl.value || "").trim();
      if (typed) {
        apiKey = typed;
        await chrome.storage.local.set({ apiKey });
      }
    }

    if (!apiKey) {
      messageStatusEl.textContent = "Please set your API key in Config.";
      setActiveTab("config");
      return;
    }

    if (!currentProfileContext) {
      messageStatusEl.textContent =
        "Could not extract profile context (open a LinkedIn profile page and reopen the popup).";
      return;
    }

    const profileContextForGeneration = { ...currentProfileContext };
    lastProfileContextSent = profileContextForGeneration;
    renderProfileContext();

    const resp = await chrome.runtime.sendMessage({
      type: "GENERATE_FIRST_MESSAGE",
      payload: {
        apiKey,
        model: (model || "gpt-4.1").trim(),
        prompt,
        profile: profileContextForGeneration,
      },
    });

    if (!resp?.ok) {
      messageStatusEl.textContent = `Error: ${getErrorMessage(resp?.error)}`;
      return;
    }

    firstMessage = (resp.first_message || "").trim();
    firstMessagePreviewEl.textContent = firstMessage;

    const linkedinUrl = getLinkedinUrlFromContext(currentProfileContext);
    if (!linkedinUrl) {
      messageStatusEl.textContent = "Missing LinkedIn URL in profile context.";
      return;
    }

    const dbResp = await chrome.runtime.sendMessage({
      type: "DB_UPDATE_FIRST_MESSAGE",
      payload: {
        linkedin_url: linkedinUrl,
        first_message: firstMessage,
        first_message_generated_at: new Date().toISOString(),
      },
    });

    if (!dbResp?.ok) {
      messageStatusEl.textContent = `Generated, but DB error: ${getErrorMessage(dbResp?.error)}`;
      return;
    }

    messageStatusEl.textContent = `First message generated ${EMOJI_CHECK}`;
  });

document
  .getElementById("markMessageSent")
  .addEventListener("click", async () => {
    if (!currentProfileContext) {
      messageStatusEl.textContent = "Open a LinkedIn profile first.";
      return;
    }

    const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
    if (!linkedin_url) {
      messageStatusEl.textContent = "Missing LinkedIn URL in profile context.";
      return;
    }

    const resp = await chrome.runtime.sendMessage({
      type: "DB_MARK_STATUS",
      payload: { linkedin_url, status: "first message sent" },
    });

    messageStatusEl.textContent = resp?.ok
      ? `Marked as first message sent ${EMOJI_CHECK}`
      : `DB error: ${getErrorMessage(resp?.error)}`;
  });
