function initMessagesModule(_deps = {}) {
  function getOutreachStatusFromDbRow() {
    return "accepted";
  }

  function renderMessageTab(_status) {}

  async function refreshChatHistoryFromActiveTab() {
    return { messages: [], chatHistory: "" };
  }

  async function fetchChatHistory() {
    return { messages: [], chatHistory: "" };
  }

  function updateFirstMessageCopyIconVisibility() {}

  function updateFirstMessageSaveIconVisibility() {}

  function updateMessageTabControls() {}

  async function refreshMessagesTab() {
    return false;
  }

  async function onMessagesTabOpenedByUser() {
    return false;
  }

  function bindMessagesWorkflowEvents() {}

  return {
    getOutreachStatusFromDbRow,
    renderMessageTab,
    refreshChatHistoryFromActiveTab,
    fetchChatHistory,
    updateFirstMessageCopyIconVisibility,
    updateFirstMessageSaveIconVisibility,
    updateMessageTabControls,
    refreshMessagesTab,
    onMessagesTabOpenedByUser,
    bindMessagesWorkflowEvents,
  };
}

globalThis.initMessagesModule = initMessagesModule;
