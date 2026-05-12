// Owns chat history extraction formatting/state helpers and chat refresh wiring.
// Does not own message generation or invitation workflows.
(function initPopupChatController(globalObj) {
  const utils = globalObj.PopupUtils;
  if (!utils || typeof utils !== "object") {
    throw new Error("PopupUtils must be loaded before popup-chat-controller.js.");
  }
  const state = globalObj.PopupState;
  if (!state || typeof state !== "object") {
    throw new Error("PopupState must be loaded before popup-chat-controller.js.");
  }

  function normalizeChatText(value) {
    return typeof utils.normalizeWhitespace === "function"
      ? utils.normalizeWhitespace(value || "")
      : typeof utils.safeTrim === "function"
        ? utils.safeTrim(value || "")
        : "";
  }

  function toChatLogEntry(message, index) {
    const direction =
      message?.direction === "them"
        ? "them"
        : message?.direction === "me"
          ? "me"
          : "unknown";
    const dateLabel = (message?.heading || message?.dateLabel || "")
      .toString()
      .trim();
    const time = (message?.time || message?.ts || "").toString().trim();
    const ts = (message?.ts || message?.time || "").toString().trim();
    const normalizedText = normalizeChatText(message?.text || "");
    const key = `${direction}|${dateLabel}|${ts || time}|${normalizedText}`;
    return {
      i: index,
      liIndex: message?.liIndex ?? -1,
      direction,
      dateLabel,
      time,
      ts,
      textLen: normalizedText.length,
      text: normalizedText,
      key,
      dayHeading: dateLabel,
      dt_label: (message?.dt_label || `${dateLabel} ${time}`.trim()).trim(),
      name: (message?.name || "").toString().trim(),
      sortTsIso: "",
      displayLocal: "",
      datetimeForDebug:
        (message?.dt_label || `${dateLabel} ${time}`.trim()).trim() ||
        "NO_DATETIME",
      msgId: message?.msgId || "",
      domHint: message?.domHint || null,
    };
  }

  function isMessageBoxMissingError(errorText) {
    const text = String(errorText || "").toLowerCase();
    return (
      text.includes("message overlay not open") ||
      text.includes("interop shadow root not found")
    );
  }

  function setExtractedChatMessages(messages) {
    state.extractedChatMessages = Array.isArray(messages) ? messages : [];
    return state.extractedChatMessages;
  }

  async function refreshChatHistoryFromActiveTab() {
    setExtractedChatMessages([]);
    return { messages: [], chatHistory: "" };
  }

  async function fetchChatHistory() {
    setExtractedChatMessages([]);
    return { messages: [], chatHistory: "" };
  }

  function bindChatHistoryEvents() {}

  globalObj.PopupChatController = Object.freeze({
    normalizeChatText,
    toChatLogEntry,
    isMessageBoxMissingError,
    setExtractedChatMessages,
    refreshChatHistoryFromActiveTab,
    fetchChatHistory,
    bindChatHistoryEvents,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
