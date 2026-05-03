function initPromptsModule(deps = {}) {
  // constants
  const EMPTY_OPTION_LABEL = "(no prompt)";
  const UNTITLED_LABEL = "(untitled)";

  // DOM bindings
  const promptSelectEl = document.getElementById("promptSelect");
  const toggleNewPromptBtnEl = document.getElementById("toggleNewPrompt");
  const renamePromptBtnEl = document.getElementById("renamePrompt");
  const renamePromptRowEl = document.getElementById("renamePromptRow");
  const renamePromptNameEl = document.getElementById("renamePromptName");
  const saveRenamePromptBtnEl = document.getElementById("saveRenamePrompt");
  const cancelRenamePromptBtnEl = document.getElementById("cancelRenamePrompt");
  const newPromptRowEl = document.getElementById("newPromptRow");
  const newPromptNameEl = document.getElementById("newPromptName");
  const addPromptBtnEl = document.getElementById("addPrompt");
  const cancelNewPromptBtnEl = document.getElementById("cancelNewPrompt");
  const freePromptInputEl = document.getElementById("freePromptInput");
  const savePromptTextBtnEl = document.getElementById("savePromptTextBtn");

  // state tracking
  let promptRowsCache = [];
  let selectedPromptId = "";
  let originalPromptText = "";

  // helpers
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

  function setPromptSelectValue(idValue) {
    if (!promptSelectEl) return;
    const value = String(idValue || "");
    promptSelectEl.value = value;
    selectedPromptId = value;
    updateRenamePromptButtonState();
  }

  function getPromptById(idValue) {
    const target = String(idValue || "");
    if (!target) return null;
    return (
      promptRowsCache.find((row) => String(row?.id || "") === target) || null
    );
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

  function setRenamePromptRowVisible(visible) {
    if (!renamePromptRowEl) return;
    renamePromptRowEl.hidden = !visible;
    if (renamePromptBtnEl) {
      renamePromptBtnEl.hidden = Boolean(visible);
    }
    if (!visible && renamePromptNameEl) {
      renamePromptNameEl.value = "";
    }
  }

  function updateRenamePromptButtonState() {
    if (!renamePromptBtnEl) return;
    renamePromptBtnEl.hidden = !selectedPromptId;
  }

  // render/update functions
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
    emptyOptionEl.textContent = EMPTY_OPTION_LABEL;
    promptSelectEl.appendChild(emptyOptionEl);

    for (const row of promptRowsCache) {
      const optionEl = document.createElement("option");
      optionEl.value = String(row?.id || "");
      optionEl.textContent = normalizePromptName(row?.name || UNTITLED_LABEL);
      optionEl.title = normalizePromptName(row?.name || UNTITLED_LABEL);
      promptSelectEl.appendChild(optionEl);
    }

    setPromptSelectValue(selectedBefore);
    if (selectedBefore && !getPromptById(selectedBefore)) {
      setPromptSelectValue("");
    }
    setRenamePromptRowVisible(false);
    updateRenamePromptButtonState();
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
    if (!selectedPromptId || !deps.sendRuntimeMessage || !freePromptInputEl) {
      return;
    }
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
    if (row) row.prompt = promptText;
    originalPromptText = promptText;
    updatePromptSaveButtonVisibility();
  }

  async function renameSelectedPromptName(name) {
    if (!selectedPromptId || !deps.sendRuntimeMessage) {
      throw new Error("Select a prompt first.");
    }
    const promptName = normalizePromptName(name);
    if (!promptName) {
      throw new Error("Prompt name is required.");
    }
    const result = await deps.sendRuntimeMessage("UPDATE_PROMPT_NAME", {
      payload: {
        id: selectedPromptId,
        name: promptName,
      },
    });
    if (!result.ok) {
      throw new Error(result.error || "Could not rename prompt.");
    }
    const row = getPromptById(selectedPromptId);
    if (row) row.name = promptName;
    promptRowsCache.sort((a, b) =>
      normalizePromptName(a?.name || "").localeCompare(
        normalizePromptName(b?.name || ""),
      ),
    );
    rebuildPromptSelectOptions();
    setPromptSelectValue(selectedPromptId);
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
    const created = toPromptRow(result?.data?.prompt || null);
    if (!created?.id) {
      throw new Error("Could not create prompt.");
    }
    promptRowsCache.push({
      id: created.id,
      name: created.name || name,
      prompt: created.prompt || promptText,
    });
    promptRowsCache.sort((a, b) => a.name.localeCompare(b.name));
    setPromptSelectValue(created.id);
    rebuildPromptSelectOptions();
    applyPromptSelectionById(created.id);
    setNewPromptRowVisible(false);
  }

  // event listeners
  function bindPromptManagementEvents() {
    setNewPromptRowVisible(false);
    setRenamePromptRowVisible(false);
    updateRenamePromptButtonState();
    promptSelectEl?.addEventListener("change", () => {
      applyPromptSelectionById(promptSelectEl.value || "");
      updateRenamePromptButtonState();
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
      setRenamePromptRowVisible(false);
      setNewPromptRowVisible(true);
      newPromptNameEl?.focus();
    });
    renamePromptBtnEl?.addEventListener("click", () => {
      if (!selectedPromptId) return;
      const row = getPromptById(selectedPromptId);
      setNewPromptRowVisible(false);
      setRenamePromptRowVisible(true);
      if (renamePromptNameEl) {
        renamePromptNameEl.value = normalizePromptName(row?.name || "");
        renamePromptNameEl.focus();
        renamePromptNameEl.select();
      }
    });
    cancelNewPromptBtnEl?.addEventListener("click", () => {
      setNewPromptRowVisible(false);
    });
    cancelRenamePromptBtnEl?.addEventListener("click", () => {
      setRenamePromptRowVisible(false);
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
    saveRenamePromptBtnEl?.addEventListener("click", async () => {
      if (saveRenamePromptBtnEl) saveRenamePromptBtnEl.disabled = true;
      deps.setFooterUpdatingStatus?.();
      try {
        await renameSelectedPromptName(renamePromptNameEl?.value || "");
        setRenamePromptRowVisible(false);
        deps.setFooterStatus?.("Prompt renamed.");
      } catch (e) {
        deps.setFooterStatus?.(`Error: ${e?.message || e}`);
      } finally {
        if (saveRenamePromptBtnEl) saveRenamePromptBtnEl.disabled = false;
        deps.setFooterReady?.();
      }
    });
  }

  return {
    loadPromptOptions,
    bindPromptManagementEvents,
  };
}

globalThis.initPromptsModule = initPromptsModule;
