const apiKeyEl = document.getElementById("apiKey");
const modelEl = document.getElementById("model");
const strategyEl = document.getElementById("strategy");
const focusEl = document.getElementById("focus");
const messagePromptEl = document.getElementById("messagePrompt");
const messagePromptWrapEl = document.getElementById("messagePromptWrap");
const toggleMessagePromptBtnEl = document.getElementById("toggleMessagePrompt");
const saveMessagePromptBtnEl = document.getElementById("saveMessagePrompt");
const generateFirstMessageBtnEl = document.getElementById(
  "generateFirstMessage",
);
const markMessageSentBtnEl = document.getElementById("markMessageSent");
const copyFirstMessageBtnEl = document.getElementById("copyFirstMessage");

const EMOJI_CHECK = "\u2705";
const SYMBOL_ELLIPSIS = "\u2026";
const DEBUG = false;
const UI_TEXT = {
  unexpectedError: "Unexpected error.",
  configSaved: "Config saved.",
  openLinkedInProfileFirst: "Open a LinkedIn profile first.",
  missingLinkedinUrl: "Missing LinkedIn URL in profile context.",
  markedInvited: `Marked as invited ${EMOJI_CHECK}`,
  markedAccepted: `Marked as accepted ${EMOJI_CHECK}`,
  dbErrorPrefix: "DB error:",
  copiedToClipboard: "Copied to clipboard.",
  copyFailedPrefix: "Copy failed:",
  preparingProfile: `Preparing profile${SYMBOL_ELLIPSIS}`,
  setApiKeyInConfig: "Please set your API key in Config.",
  couldNotExtractProfileContext:
    "Could not extract profile context (open a LinkedIn profile page and reopen the popup).",
  callingOpenAI: `Calling OpenAI${SYMBOL_ELLIPSIS}`,
  errorPrefix: "Error:",
  generatedClickCopy: "Generated. Click Copy.",
  noMessageGenerated: "No message generated.",
  dbErrorAppendPrefix: " | DB error:",
  generatingFirstMessage: `Generating first message${SYMBOL_ELLIPSIS}`,
  messagePromptRequired: "Message prompt is required.",
  generatedButDbErrorPrefix: "Generated, but DB error:",
  firstMessageGenerated: `First message generated ${EMOJI_CHECK}`,
  markedFirstMessageSent: `Marked as first message sent ${EMOJI_CHECK}`,
  promptSaved: "Prompt saved.",
  lifecycleOpenLinkedInProfileFirst: "Open a LinkedIn profile first.",
  lifecycleNotInDatabase: "Not in database",
  lifecycleGenerated: "Generated",
  lifecycleInvited: "Invited",
  lifecycleAccepted: "Accepted",
  lifecycleFirstMessageGenerated: "First message generated",
  lifecycleFirstMessageSent: "First message sent",
  lifecycleInDatabase: "In database",
};
const STORAGE_KEY_FIRST_MESSAGE_PROMPT = "firstMessagePrompt";
const LIFECYCLE_STYLE_MAP = {
  neutral: { background: "#f3f4f6", color: "#374151" },
  not_in_database: { background: "#fee2e2", color: "#7f1d1d" },
  generated: { background: "#dbeafe", color: "#1d4ed8" }, // blue
  invited: { background: "#ffedd5", color: "#c2410c" }, // orange
  accepted: { background: "#dcfce7", color: "#166534" }, // green
  first_message_generated: { background: "#bbf7d0", color: "#14532d" }, // dark green
  first_message_sent: { background: "#ede9fe", color: "#6d28d9" }, // purple
};

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
const profileContextPreviewWrapEl = document.getElementById(
  "profileContextPreviewWrap",
);
const toggleProfileContextPreviewBtnEl = document.getElementById(
  "toggleProfileContextPreview",
);
const lifecycleBarEl = document.getElementById("lifecycleBar");
const lifecycleBarTextEl = document.getElementById("lifecycleBarText");
const copyBtnEl = document.getElementById("copyBtn");
const invitedAtLabelEl = document.getElementById("invitedAtLabel");
const acceptedAtLabelEl = document.getElementById("acceptedAtLabel");

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
let lastSavedFirstMessagePrompt = "";
let isProfileContextCollapsed = true;
let isMessagePromptCollapsed = true;
let dbInvitationRow = null;

function getLifecycleStatusValue(dbRow) {
  return (dbRow?.status || "").trim().toLowerCase();
}

function isPostSendMode() {
  return getLifecycleStatusValue(dbInvitationRow) === "first message sent";
}

function updateGenerateFirstMessageButtonLabel() {
  generateFirstMessageBtnEl.textContent = isPostSendMode()
    ? "Create new message"
    : "Generate first message";
}

function getErrorMessage(error) {
  if (error && typeof error === "object" && typeof error.message === "string") {
    return error.message;
  }
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }
  return UI_TEXT.unexpectedError;
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

function setProfileContextPreviewCollapsed(collapsed) {
  isProfileContextCollapsed = collapsed;
  profileContextPreviewWrapEl.hidden = collapsed;
  toggleProfileContextPreviewBtnEl.textContent = collapsed ? "Show" : "Hide";
  toggleProfileContextPreviewBtnEl.setAttribute(
    "aria-expanded",
    collapsed ? "false" : "true",
  );
}

function setMessagePromptCollapsed(collapsed) {
  isMessagePromptCollapsed = collapsed;
  messagePromptWrapEl.hidden = collapsed;
  toggleMessagePromptBtnEl.textContent = collapsed
    ? "Show prompt"
    : "Hide prompt";
  toggleMessagePromptBtnEl.setAttribute(
    "aria-expanded",
    collapsed ? "false" : "true",
  );
}

function setLifecycleBar(stateKey, text) {
  const style = LIFECYCLE_STYLE_MAP[stateKey] || LIFECYCLE_STYLE_MAP.neutral;
  lifecycleBarEl.style.backgroundColor = style.background;
  lifecycleBarEl.style.color = style.color;
  lifecycleBarTextEl.textContent = text;
}

function formatDateTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value || "";
    return `${get("day")} ${get("month")} ${get("year")} ${get("hour")}:${get("minute")}`.trim();
  } catch (_e) {
    try {
      return date.toLocaleString();
    } catch (_e2) {
      return "";
    }
  }
}

function applyLifecycleUiState(dbRow) {
  const markInvitedBtn = document.getElementById("markInvited");
  const markAcceptedBtn = document.getElementById("markAccepted");
  const generateBtn = document.getElementById("generate");

  if (!markInvitedBtn || !markAcceptedBtn || !generateBtn) return;
  updateGenerateFirstMessageButtonLabel();

  markInvitedBtn.classList.remove("is-highlighted");
  markAcceptedBtn.classList.remove("is-highlighted");

  markInvitedBtn.disabled = false;
  markAcceptedBtn.disabled = false;
  generateBtn.disabled = false;
  invitedAtLabelEl.hidden = true;
  acceptedAtLabelEl.hidden = true;
  invitedAtLabelEl.querySelector("small").textContent = "";
  acceptedAtLabelEl.querySelector("small").textContent = "";

  const status = getLifecycleStatusValue(dbRow);
  const dbMessage = (dbRow?.message || "").trim();
  if (dbMessage) {
    previewEl.textContent = dbMessage;
    setCopyButtonEnabled(true);
  }

  if (status === "generated") {
    setActiveTab("invitation");
    if (dbMessage) {
      previewEl.textContent = dbMessage;
      setCopyButtonEnabled(true);
    }
    markInvitedBtn.classList.add("is-highlighted");
    return;
  }

  if (status === "invited") {
    setActiveTab("invitation");
    if (dbMessage) {
      previewEl.textContent = dbMessage;
      setCopyButtonEnabled(true);
    }
    markInvitedBtn.disabled = true;
    generateBtn.disabled = true;
    markAcceptedBtn.classList.add("is-highlighted");
    return;
  }

  if (status === "accepted" || status === "first message sent") {
    setActiveTab("message");
    markInvitedBtn.disabled = true;
    generateBtn.disabled = true;
    markAcceptedBtn.disabled = true;
    if (dbMessage) {
      previewEl.textContent = dbMessage;
      setCopyButtonEnabled(true);
    }
  }

  const invitedAtText = formatDateTime(dbRow?.invited_at);
  if (markInvitedBtn.disabled && invitedAtText) {
    invitedAtLabelEl.hidden = false;
    invitedAtLabelEl.querySelector("small").textContent =
      `Invitation sent: ${invitedAtText}`;
    if (dbMessage) {
      previewEl.textContent = dbMessage;
      setCopyButtonEnabled(true);
    }
  }

  const acceptedAtText = formatDateTime(dbRow?.accepted_at);
  const acceptedOrBeyond =
    status === "accepted" || status === "first message sent";
  if ((acceptedOrBeyond || markAcceptedBtn.disabled) && acceptedAtText) {
    acceptedAtLabelEl.hidden = false;
    acceptedAtLabelEl.querySelector("small").textContent =
      `Invitation accepted: ${acceptedAtText}`;
  }

  if (acceptedOrBeyond) {
    const dbFirstMessage = (dbRow?.first_message || "").trim();
    if (dbFirstMessage) {
      firstMessagePreviewEl.textContent = dbFirstMessage;
      firstMessage = dbFirstMessage;
    }
  }
}

function deriveLifecycleState(row) {
  if (!row) {
    return { key: "not_in_database", text: UI_TEXT.lifecycleNotInDatabase };
  }

  const status = (row.status || "").trim().toLowerCase();
  if (status === "generated") {
    return { key: "generated", text: UI_TEXT.lifecycleGenerated };
  }
  if (status === "invited") {
    return { key: "invited", text: UI_TEXT.lifecycleInvited };
  }
  if (status === "accepted") {
    return { key: "accepted", text: UI_TEXT.lifecycleAccepted };
  }
  if (status === "first message sent") {
    return {
      key: "first_message_sent",
      text: UI_TEXT.lifecycleFirstMessageSent,
    };
  }
  if ((row.first_message || "").trim()) {
    return {
      key: "first_message_generated",
      text: UI_TEXT.lifecycleFirstMessageGenerated,
    };
  }
  if (status) {
    return { key: "neutral", text: row.status };
  }
  return { key: "neutral", text: UI_TEXT.lifecycleInDatabase };
}

async function refreshInvitationRowFromDb() {
  const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedin_url) {
    dbInvitationRow = null;
    setLifecycleBar("neutral", UI_TEXT.lifecycleOpenLinkedInProfileFirst);
    applyLifecycleUiState(dbInvitationRow);
    return;
  }

  const resp = await chrome.runtime.sendMessage({
    type: "DB_GET_INVITATION",
    payload: { linkedin_url },
  });

  if (!resp?.ok) {
    dbInvitationRow = null;
    setLifecycleBar("neutral", getErrorMessage(resp?.error));
    applyLifecycleUiState(dbInvitationRow);
    return;
  }

  dbInvitationRow = resp.row || null;
  debug("DB invitation row fetched:", {
    has_row: Boolean(dbInvitationRow),
    message_length: (dbInvitationRow?.message || "").length,
  });
  const lifecycle = deriveLifecycleState(dbInvitationRow);
  setLifecycleBar(lifecycle.key, lifecycle.text);
  applyLifecycleUiState(dbInvitationRow);
  updateMessageTabControls();
}

function hasMessageProfileUrl() {
  return Boolean(getLinkedinUrlFromContext(currentProfileContext));
}

function updateSavePromptButtonState() {
  saveMessagePromptBtnEl.disabled =
    messagePromptEl.value === lastSavedFirstMessagePrompt;
}

function updateMessageTabControls() {
  const hasProfileUrl = hasMessageProfileUrl();
  const hasGeneratedFirstMessage = Boolean(
    (firstMessagePreviewEl.textContent || "").trim(),
  );
  const isFirstMessageSent = isPostSendMode();

  generateFirstMessageBtnEl.disabled = !hasProfileUrl;
  copyFirstMessageBtnEl.disabled = !hasGeneratedFirstMessage;
  markMessageSentBtnEl.disabled =
    isFirstMessageSent || !(hasProfileUrl && hasGeneratedFirstMessage);
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
    updateMessageTabControls();
    await refreshInvitationRowFromDb();
  } catch (_e) {
    currentProfileContext = null;
    lastProfileContextSent = {};
    lastProfileContextEnriched = null;
    dbInvitationRow = null;
    renderProfileContext();
    updateMessageTabControls();
    setLifecycleBar("neutral", UI_TEXT.lifecycleOpenLinkedInProfileFirst);
  }
}

async function loadFirstMessagePrompt() {
  const { [STORAGE_KEY_FIRST_MESSAGE_PROMPT]: savedPrompt } =
    await chrome.storage.sync.get([STORAGE_KEY_FIRST_MESSAGE_PROMPT]);

  if (typeof savedPrompt === "string" && savedPrompt.trim()) {
    messagePromptEl.value = savedPrompt;
  }

  lastSavedFirstMessagePrompt = messagePromptEl.value;
  updateSavePromptButtonState();
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
loadSettings();
setCopyButtonEnabled(false);
renderProfileContext();
setProfileContextPreviewCollapsed(true);
setMessagePromptCollapsed(true);
updateMessageTabControls();
setLifecycleBar("neutral", UI_TEXT.lifecycleOpenLinkedInProfileFirst);
applyLifecycleUiState(dbInvitationRow);
loadProfileContextOnOpen();
loadFirstMessagePrompt().catch((_e) => {
  lastSavedFirstMessagePrompt = messagePromptEl.value;
  updateSavePromptButtonState();
});

toggleProfileContextPreviewBtnEl.addEventListener("click", () => {
  setProfileContextPreviewCollapsed(!isProfileContextCollapsed);
});

toggleMessagePromptBtnEl.addEventListener("click", () => {
  setMessagePromptCollapsed(!isMessagePromptCollapsed);
});

messagePromptEl.addEventListener("input", () => {
  updateSavePromptButtonState();
});

saveMessagePromptBtnEl.addEventListener("click", async () => {
  const promptValue = messagePromptEl.value;
  await chrome.storage.sync.set({
    [STORAGE_KEY_FIRST_MESSAGE_PROMPT]: promptValue,
  });
  lastSavedFirstMessagePrompt = promptValue;
  updateSavePromptButtonState();
  messageStatusEl.textContent = UI_TEXT.promptSaved;
});

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

  statusEl.textContent = UI_TEXT.configSaved;
  messageStatusEl.textContent = UI_TEXT.configSaved;
}

document.getElementById("saveConfig").addEventListener("click", async () => {
  await saveConfig();
});

document.getElementById("markInvited").addEventListener("click", async () => {
  if (!currentProfileContext) {
    statusEl.textContent = UI_TEXT.openLinkedInProfileFirst;
    return;
  }

  const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedin_url) {
    statusEl.textContent = UI_TEXT.missingLinkedinUrl;
    return;
  }

  const resp = await chrome.runtime.sendMessage({
    type: "DB_MARK_STATUS",
    payload: { linkedin_url, status: "invited" },
  });

  statusEl.textContent = resp?.ok
    ? UI_TEXT.markedInvited
    : `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`;

  if (resp?.ok) {
    await refreshInvitationRowFromDb();
  }
});

document.getElementById("markAccepted").addEventListener("click", async () => {
  if (getLifecycleStatusValue(dbInvitationRow) === "accepted") {
    setActiveTab("message");
    return;
  }

  if (!currentProfileContext) {
    statusEl.textContent = UI_TEXT.openLinkedInProfileFirst;
    return;
  }

  const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedin_url) {
    statusEl.textContent = UI_TEXT.missingLinkedinUrl;
    return;
  }

  const resp = await chrome.runtime.sendMessage({
    type: "DB_MARK_STATUS",
    payload: { linkedin_url, status: "accepted" },
  });

  statusEl.textContent = resp?.ok
    ? UI_TEXT.markedAccepted
    : `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`;

  if (resp?.ok) {
    await refreshInvitationRowFromDb();
  }
});

copyBtnEl.addEventListener("click", async () => {
  try {
    await copyToClipboard(previewEl.textContent || "");
    statusEl.textContent = UI_TEXT.copiedToClipboard;
  } catch (e) {
    statusEl.textContent = `${UI_TEXT.copyFailedPrefix} ${getErrorMessage(e)}`;
  }
});

document.getElementById("generate").addEventListener("click", async () => {
  statusEl.textContent = UI_TEXT.preparingProfile;
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
    statusEl.textContent = UI_TEXT.setApiKeyInConfig;
    setActiveTab("config");
    return;
  }

  if (!currentProfileContext) {
    statusEl.textContent = UI_TEXT.couldNotExtractProfileContext;
    return;
  }

  const profileContextForGeneration = { ...currentProfileContext };
  lastProfileContextSent = profileContextForGeneration;
  lastProfileContextEnriched = null;
  renderProfileContext();

  statusEl.textContent = UI_TEXT.callingOpenAI;

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
    statusEl.textContent = `${UI_TEXT.errorPrefix} ${getErrorMessage(resp?.error)}`;
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
    ? UI_TEXT.generatedClickCopy
    : UI_TEXT.noMessageGenerated;

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
        statusEl.textContent += `${UI_TEXT.dbErrorAppendPrefix} ${getErrorMessage(dbResp?.error)}`;
      } else {
        return refreshInvitationRowFromDb();
      }
    })
    .catch((e) => {
      statusEl.textContent += `${UI_TEXT.dbErrorAppendPrefix} ${getErrorMessage(e)}`;
    });
});

document
  .getElementById("generateFirstMessage")
  .addEventListener("click", async () => {
    const postSendMode = isPostSendMode();

    if (!hasMessageProfileUrl()) {
      messageStatusEl.textContent = UI_TEXT.openLinkedInProfileFirst;
      updateMessageTabControls();
      return;
    }

    messageStatusEl.textContent = UI_TEXT.generatingFirstMessage;
    firstMessagePreviewEl.textContent = "";

    const prompt = (messagePromptEl.value || "").trim();
    if (!prompt) {
      messageStatusEl.textContent = UI_TEXT.messagePromptRequired;
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
      messageStatusEl.textContent = UI_TEXT.setApiKeyInConfig;
      setActiveTab("config");
      return;
    }

    if (!currentProfileContext) {
      messageStatusEl.textContent = UI_TEXT.couldNotExtractProfileContext;
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
      messageStatusEl.textContent = `${UI_TEXT.errorPrefix} ${getErrorMessage(resp?.error)}`;
      updateMessageTabControls();
      return;
    }

    firstMessage = (resp.first_message || "").trim();
    firstMessagePreviewEl.textContent = firstMessage;
    updateMessageTabControls();

    if (postSendMode) {
      messageStatusEl.textContent = UI_TEXT.firstMessageGenerated;
      return;
    }

    const linkedinUrl = getLinkedinUrlFromContext(currentProfileContext);
    if (!linkedinUrl) {
      messageStatusEl.textContent = UI_TEXT.missingLinkedinUrl;
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
      messageStatusEl.textContent = `${UI_TEXT.generatedButDbErrorPrefix} ${getErrorMessage(dbResp?.error)}`;
      updateMessageTabControls();
      return;
    }

    messageStatusEl.textContent = UI_TEXT.firstMessageGenerated;
    await refreshInvitationRowFromDb();
    updateMessageTabControls();
  });

copyFirstMessageBtnEl.addEventListener("click", async () => {
  try {
    await copyToClipboard(
      firstMessage || firstMessagePreviewEl.textContent || "",
    );
    messageStatusEl.textContent = UI_TEXT.copiedToClipboard;
  } catch (e) {
    messageStatusEl.textContent = `${UI_TEXT.copyFailedPrefix} ${getErrorMessage(e)}`;
  }
  updateMessageTabControls();
});

document
  .getElementById("markMessageSent")
  .addEventListener("click", async () => {
    if (!currentProfileContext) {
      messageStatusEl.textContent = UI_TEXT.openLinkedInProfileFirst;
      return;
    }

    const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
    if (!linkedin_url) {
      messageStatusEl.textContent = UI_TEXT.missingLinkedinUrl;
      return;
    }

    const resp = await chrome.runtime.sendMessage({
      type: "DB_MARK_STATUS",
      payload: { linkedin_url, status: "first message sent" },
    });

    messageStatusEl.textContent = resp?.ok
      ? UI_TEXT.markedFirstMessageSent
      : `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`;

    if (resp?.ok) {
      await refreshInvitationRowFromDb();
    }
    updateMessageTabControls();
  });
