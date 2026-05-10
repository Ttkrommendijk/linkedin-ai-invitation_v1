(function initPopupStatusConstants(globalObj) {
  globalObj.PopupStatusConstants = Object.freeze({
    generated: "generated",
    invited: "invited",
    accepted: "accepted",
    firstMessageSent: "first message sent",
    firstMessageSentSnake: "first_message_sent",
    loadingChatHistory: "Loading chat history...",
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
