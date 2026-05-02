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
var promptSelectEl = document.getElementById("promptSelect");
var toggleNewPromptBtnEl = document.getElementById("toggleNewPrompt");
var newPromptRowEl = document.getElementById("newPromptRow");
var newPromptNameEl = document.getElementById("newPromptName");
var addPromptBtnEl = document.getElementById("addPrompt");
var cancelNewPromptBtnEl = document.getElementById("cancelNewPrompt");
var freePromptInputEl = document.getElementById("freePromptInput");
var savePromptTextBtnEl = document.getElementById("savePromptTextBtn");
var promptRowsCache = [];
var selectedPromptId = "";
var originalPromptText = "";

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

function normalizePromptText(value) {
  return String(value || "");
}

function normalizePromptName(value) {
  return String(value || "").trim();
}

function toPromptRow(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    id: String(raw.prompt_id ?? raw.id ?? ""),
    name: normalizePromptName(raw.prompt_name ?? raw.name ?? ""),
    prompt: normalizePromptText(raw.prompt_text ?? raw.prompt ?? ""),
  };
}

function setNewPromptRowVisible(visible) {
  if (!newPromptRowEl) return;
  newPromptRowEl.hidden = !visible;
  if (toggleNewPromptBtnEl) {
    toggleNewPromptBtnEl.hidden = Boolean(visible);
  }
  if (!visible && newPromptNameEl) {
    newPromptNameEl.value = "";
  }
}

function setPromptSelectValue(idValue) {
  if (!promptSelectEl) return;
  const value = String(idValue || "");
  promptSelectEl.value = value;
  selectedPromptId = value;
}

function getPromptById(idValue) {
  const target = String(idValue || "");
  if (!target) return null;
  return (
    promptRowsCache.find((row) => String(row?.id || "") === target) || null
  );
}

function updatePromptSaveButtonVisibility() {
  if (!savePromptTextBtnEl || !freePromptInputEl) return;
  const hasSelectedPrompt = Boolean(selectedPromptId);
  const current = normalizePromptText(freePromptInputEl.value);
  const changed = current !== normalizePromptText(originalPromptText);
  savePromptTextBtnEl.hidden = !(hasSelectedPrompt && changed);
}

function applyPromptSelectionById(idValue) {
  const row = getPromptById(idValue);
  setPromptSelectValue(row?.id || "");
  const promptText = normalizePromptText(row?.prompt || "");
  if (freePromptInputEl) {
    freePromptInputEl.value = promptText;
  }
  originalPromptText = promptText;
  updatePromptSaveButtonVisibility();
}

function rebuildPromptSelectOptions() {
  if (!promptSelectEl) return;
  const selectedBefore = String(selectedPromptId || promptSelectEl.value || "");
  while (promptSelectEl.firstChild) {
    promptSelectEl.removeChild(promptSelectEl.firstChild);
  }
  const emptyOptionEl = document.createElement("option");
  emptyOptionEl.value = "";
  emptyOptionEl.textContent = "(no prompt)";
  promptSelectEl.appendChild(emptyOptionEl);
  for (const row of promptRowsCache) {
    const optionEl = document.createElement("option");
    optionEl.value = String(row?.id || "");
    optionEl.textContent = normalizePromptName(row?.name || "(untitled)");
    optionEl.title = normalizePromptName(row?.name || "(untitled)");
    promptSelectEl.appendChild(optionEl);
  }
  setPromptSelectValue(selectedBefore);
  if (selectedBefore && !getPromptById(selectedBefore)) {
    setPromptSelectValue("");
  }
}

async function loadPromptOptions() {
  if (!promptSelectEl || !deps.sendRuntimeMessage) return;
  console.log("[LEF][prompt] loading prompt options");
  const result = await deps.sendRuntimeMessage("GET_PROMPTS");
  if (!result.ok) {
    throw new Error(result.error || "Could not load prompts.");
  }
  const rows = Array.isArray(result?.data?.prompts) ? result.data.prompts : [];
  console.log("[LEF][prompt] prompt options loaded", { count: rows.length });
  promptRowsCache = rows.map(toPromptRow).filter(Boolean);
  rebuildPromptSelectOptions();
}

async function saveSelectedPromptText() {
  if (!selectedPromptId || !deps.sendRuntimeMessage || !freePromptInputEl) return;
  const promptText = normalizePromptText(freePromptInputEl.value);
  const result = await deps.sendRuntimeMessage("UPDATE_PROMPT", {
    payload: {
      id: selectedPromptId,
      prompt: promptText,
    },
  });
  if (!result.ok) {
    throw new Error(result.error || "Could not save prompt.");
  }
  const row = getPromptById(selectedPromptId);
  if (row) {
    row.prompt = promptText;
  }
  originalPromptText = promptText;
  updatePromptSaveButtonVisibility();
}

async function createPromptFromInline() {
  const name = normalizePromptName(newPromptNameEl?.value || "");
  if (!name) {
    throw new Error("Prompt name is required.");
  }
  const promptText = normalizePromptText(freePromptInputEl?.value || "");
  const result = await deps.sendRuntimeMessage("CREATE_PROMPT", {
    payload: {
      name,
      prompt: promptText,
    },
  });
  if (!result.ok) {
    throw new Error(result.error || "Could not create prompt.");
  }
  const created = result?.data?.prompt || null;
  const createdRow = toPromptRow(created);
  if (!createdRow?.id) {
    throw new Error("Could not create prompt.");
  }
  promptRowsCache.push({
    id: createdRow.id,
    name: createdRow.name || name,
    prompt: createdRow.prompt || promptText,
  });
  promptRowsCache.sort((a, b) => a.name.localeCompare(b.name));
  setPromptSelectValue(String(createdRow.id));
  rebuildPromptSelectOptions();
  applyPromptSelectionById(String(createdRow.id));
  setNewPromptRowVisible(false);
}

function bindPromptManagementEvents() {
  promptSelectEl?.addEventListener("change", () => {
    applyPromptSelectionById(promptSelectEl.value || "");
  });
  freePromptInputEl?.addEventListener("input", () => {
    updatePromptSaveButtonVisibility();
  });
  savePromptTextBtnEl?.addEventListener("click", async () => {
    if (savePromptTextBtnEl) savePromptTextBtnEl.disabled = true;
    deps.setFooterUpdatingStatus?.();
    try {
      await saveSelectedPromptText();
      deps.setFooterStatus?.("Prompt saved.");
    } catch (e) {
      deps.setFooterStatus?.(`Error: ${e?.message || e}`);
    } finally {
      if (savePromptTextBtnEl) savePromptTextBtnEl.disabled = false;
      deps.setFooterReady?.();
    }
  });
  toggleNewPromptBtnEl?.addEventListener("click", () => {
    setNewPromptRowVisible(true);
    newPromptNameEl?.focus();
  });
  cancelNewPromptBtnEl?.addEventListener("click", () => {
    setNewPromptRowVisible(false);
  });
  addPromptBtnEl?.addEventListener("click", async () => {
    deps.setFooterUpdatingStatus?.();
    try {
      await createPromptFromInline();
      deps.setFooterStatus?.("Prompt created.");
    } catch (e) {
      deps.setFooterStatus?.(`Error: ${e?.message || e}`);
    } finally {
      deps.setFooterReady?.();
    }
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
  loadPromptOptions,
  bindPromptManagementEvents,
  setMessagePromptCollapsed,
  updateSavePromptButtonState,
  syncFirstMessagePromptSavedState,
};
}

globalThis.initPromptsModule = initPromptsModule;
