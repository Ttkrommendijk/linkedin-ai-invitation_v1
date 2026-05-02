function initPromptsModule(deps = {}) {
var messagePromptEl = document.getElementById("messagePrompt");
var messagePromptWrapEl =
  document.getElementById("firstPromptContainer") ||
  document.getElementById("messagePromptWrap");
var toggleMessagePromptBtnEl =
  document.getElementById("togglePrompt") ||
  document.getElementById("toggleMessagePrompt");
var saveMessagePromptBtnEl = document.getElementById("saveMessagePrompt");
var resetMessagePromptBtnEl = document.getElementById("resetMessagePrompt");
var STORAGE_KEY_FIRST_MESSAGE_PROMPT = "firstMessagePrompt";
var DEFAULT_FIRST_MESSAGE_PROMPT = messagePromptEl?.value || "";

var lastSavedFirstMessagePrompt = "";
var isMessagePromptCollapsed = true;

function setMessagePromptCollapsed(collapsed) {
  if (!messagePromptWrapEl || !toggleMessagePromptBtnEl) return;
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

function updateSavePromptButtonState() {
  if (!saveMessagePromptBtnEl || !resetMessagePromptBtnEl || !messagePromptEl) {
    return;
  }
  saveMessagePromptBtnEl.disabled =
    messagePromptEl.value === lastSavedFirstMessagePrompt;
  resetMessagePromptBtnEl.disabled =
    messagePromptEl.value === DEFAULT_FIRST_MESSAGE_PROMPT;
}

async function loadFirstMessagePrompt() {
  if (!messagePromptEl) return;
  const { [STORAGE_KEY_FIRST_MESSAGE_PROMPT]: savedPrompt } =
    await chrome.storage.sync.get([STORAGE_KEY_FIRST_MESSAGE_PROMPT]);

  if (typeof savedPrompt === "string" && savedPrompt.trim()) {
    messagePromptEl.value = savedPrompt;
  }

  lastSavedFirstMessagePrompt = messagePromptEl.value;
  updateSavePromptButtonState();
}

function syncFirstMessagePromptSavedState() {
  lastSavedFirstMessagePrompt = messagePromptEl?.value || "";
  updateSavePromptButtonState();
}

function bindPromptEvents() {
  toggleMessagePromptBtnEl?.addEventListener("click", () => {
    setMessagePromptCollapsed(!isMessagePromptCollapsed);
  });

  messagePromptEl?.addEventListener("input", () => {
    updateSavePromptButtonState();
  });

  saveMessagePromptBtnEl?.addEventListener("click", async () => {
    if (!messagePromptEl) return;
    deps.setFooterUpdatingStatus();
    try {
      const promptValue = messagePromptEl.value;
      await chrome.storage.sync.set({
        [STORAGE_KEY_FIRST_MESSAGE_PROMPT]: promptValue,
      });
      lastSavedFirstMessagePrompt = promptValue;
      updateSavePromptButtonState();
      deps.setFooterStatus("Prompt saved.");
    } finally {
      deps.setFooterReady();
    }
  });

  resetMessagePromptBtnEl?.addEventListener("click", () => {
    if (!messagePromptEl) return;
    messagePromptEl.value = DEFAULT_FIRST_MESSAGE_PROMPT;
    updateSavePromptButtonState();
    deps.setFooterStatus("Prompt reset to default.");
  });
}

return {
  messagePromptEl,
  messagePromptWrapEl,
  toggleMessagePromptBtnEl,
  saveMessagePromptBtnEl,
  resetMessagePromptBtnEl,
  STORAGE_KEY_FIRST_MESSAGE_PROMPT,
  DEFAULT_FIRST_MESSAGE_PROMPT,
  loadFirstMessagePrompt,
  bindPromptEvents,
  setMessagePromptCollapsed,
  updateSavePromptButtonState,
  syncFirstMessagePromptSavedState,
};
}

globalThis.initPromptsModule = initPromptsModule;
