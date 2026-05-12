function initMessagesModule(_deps = {}) {
  const lifecycleController = globalThis.PopupLifecycleController;
  if (!lifecycleController || typeof lifecycleController !== "object") {
    throw new Error("PopupLifecycleController must be loaded before popup-messages.js.");
  }
  const chatController = globalThis.PopupChatController;
  if (!chatController || typeof chatController !== "object") {
    throw new Error("PopupChatController must be loaded before popup-messages.js.");
  }
  const messageController = globalThis.PopupMessageController;
  if (!messageController || typeof messageController !== "object") {
    throw new Error("PopupMessageController must be loaded before popup-messages.js.");
  }

  const getOutreachStatusFromDbRow =
    lifecycleController.getOutreachStatusFromDbRow;

  const renderMessageTab = lifecycleController.renderMessageTab;

  const refreshChatHistoryFromActiveTab =
    chatController.refreshChatHistoryFromActiveTab;

  const fetchChatHistory = chatController.fetchChatHistory;

  const updateFirstMessageCopyIconVisibility =
    messageController.updateFirstMessageCopyIconVisibility;

  const updateFirstMessageSaveIconVisibility =
    messageController.updateFirstMessageSaveIconVisibility;

  const updateMessageTabControls =
    messageController.updateMessageTabControls;

  const refreshMessagesTab =
    messageController.refreshMessagesTab;

  const onMessagesTabOpenedByUser =
    messageController.onMessagesTabOpenedByUser;

  const bindMessagesWorkflowEvents =
    chatController.bindChatHistoryEvents;
  if (
    typeof getOutreachStatusFromDbRow !== "function" ||
    typeof renderMessageTab !== "function" ||
    typeof refreshChatHistoryFromActiveTab !== "function" ||
    typeof fetchChatHistory !== "function" ||
    typeof updateFirstMessageCopyIconVisibility !== "function" ||
    typeof updateFirstMessageSaveIconVisibility !== "function" ||
    typeof updateMessageTabControls !== "function" ||
    typeof refreshMessagesTab !== "function" ||
    typeof onMessagesTabOpenedByUser !== "function" ||
    typeof bindMessagesWorkflowEvents !== "function"
  ) {
    throw new Error(
      "popup-messages.js requires lifecycle/chat/message controller functions to be loaded.",
    );
  }

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
