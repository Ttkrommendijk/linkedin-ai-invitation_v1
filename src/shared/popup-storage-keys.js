(function initPopupStorageKeys(globalObj) {
  globalObj.PopupStorageKeys = Object.freeze({
    apiKey: "apiKey",
    model: "model",
    firstMessagePrompt: "firstMessagePrompt",
    messageLanguage: "message_language",
    freePromptLanguage: "free_prompt_language",
    webhookBaseUrl: "webhookBaseUrl",
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
