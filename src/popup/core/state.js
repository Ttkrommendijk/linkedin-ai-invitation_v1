// Owns shared mutable popup state only.
// Do not add DOM lookups, event bindings, or business logic here.
(function initPopupState(globalObj) {
  globalObj.PopupState = {
    lastProfileContextSent: {},
    lastProfileContextEnriched: null,
    currentProfileContext: null,
    firstMessage: "",
    lastSavedFirstMessagePrompt: "",
    isProfileContextCollapsed: false,
    isMessagePromptCollapsed: false,
    dbInvitationRow: null,
    extractedChatMessages: [],
    outreachMessageStatus: "accepted",
  };

  const aliases = [
    "lastProfileContextSent",
    "lastProfileContextEnriched",
    "currentProfileContext",
    "firstMessage",
    "lastSavedFirstMessagePrompt",
    "isProfileContextCollapsed",
    "isMessagePromptCollapsed",
    "dbInvitationRow",
    "extractedChatMessages",
    "outreachMessageStatus",
  ];

  for (const key of aliases) {
    if (Object.prototype.hasOwnProperty.call(globalObj, key)) continue;
    Object.defineProperty(globalObj, key, {
      configurable: true,
      enumerable: false,
      get() {
        return globalObj.PopupState[key];
      },
      set(value) {
        globalObj.PopupState[key] = value;
      },
    });
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
