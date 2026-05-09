(function initRouterUtils(globalObj) {
  const LEF_RUNTIME_UTILS = globalObj.LEFRuntimeUtils || globalObj.LEFUtils || {};
  const LEF_CHROME_UTILS = globalObj.LEFChromeUtils || {};

  const normalizeError = LEF_RUNTIME_UTILS.normalizeError;
  const emitUiStatus = LEF_CHROME_UTILS.emitUiStatus;

  async function handleAsyncMessage(sendResponse, handler, options = {}) {
    try {
      const result = await handler();
      if (
        result &&
        typeof result === "object" &&
        !Array.isArray(result) &&
        Object.prototype.hasOwnProperty.call(result, "ok")
      ) {
        sendResponse(result);
        return;
      }
      if (result && typeof result === "object" && !Array.isArray(result)) {
        sendResponse({ ok: true, ...result });
        return;
      }
      sendResponse({ ok: true, data: result });
    } catch (e) {
      sendResponse({
        ok: false,
        error: normalizeError(e, options.errorCode || "UNKNOWN_ERROR"),
      });
    }
  }

  async function withUiStatus(text, fn) {
    emitUiStatus(text);
    return fn();
  }

  globalObj.LEFRouterUtils = Object.freeze({
    handleAsyncMessage,
    withUiStatus,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
