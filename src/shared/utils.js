(function initLEFUtils(globalObj) {
  const DEBUG = false;

  function debugLog(...args) {
    if (!DEBUG) return;
    console.log(...args);
  }

  function sendRuntimeMessage(type, payload = {}, options = {}) {
    const timeoutMs =
      Number.isFinite(options?.timeoutMs) && options.timeoutMs > 0
        ? options.timeoutMs
        : 20000;

    return new Promise((resolve) => {
      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(result);
      };

      const timeoutId = setTimeout(() => {
        console.error(`[msg] ${type} failed: timeout`);
        done({ ok: false, error: "timeout", data: null });
      }, timeoutMs);

      try {
        const message = {
          type,
          ...(payload && typeof payload === "object" ? payload : {}),
        };

        chrome.runtime.sendMessage(message, (response) => {
          const runtimeError = chrome.runtime?.lastError;
          if (runtimeError) {
            const errorText = String(runtimeError.message || runtimeError);
            console.error(`[msg] ${type} failed: ${errorText}`);
            done({ ok: false, error: errorText, data: null });
            return;
          }

          if (response?.ok === false || response?.error) {
            const errorText =
              typeof response?.error === "string"
                ? response.error
                : response?.error?.message || "unknown error";
            console.error(`[msg] ${type} failed: ${errorText}`);
            done({ ok: false, error: errorText, data: response || null });
            return;
          }

          done({ ok: true, data: response });
        });
      } catch (e) {
        const errorText = e instanceof Error ? e.message : String(e || "");
        console.error(`[msg] ${type} failed: ${errorText}`);
        done({ ok: false, error: errorText, data: null });
      }
    });
  }

  function safeTrim(value) {
    if (value == null) return "";
    return String(value).trim();
  }

  function normalizeWhitespace(value) {
    return safeTrim(value).replace(/\s+/g, " ");
  }

  function isLinkedInProfileLikeUrl(url) {
    const normalized = safeTrim(url);
    if (!normalized) return false;
    return /^https:\/\/www\.linkedin\.com\/(in|company)\/[^/?#]+/i.test(
      normalized,
    );
  }

  function sanitizeHeadlineJobTitle(value) {
    let out = normalizeWhitespace(value);
    if (!out) return "";

    const patterns = [
      /^\d+\s*[\u00BA\u00B0]\s+/i,
      /^\d+\s*[-\u2013.]\s+/i,
      /^#\s*\d+\s+/i,
      /^(i|ii|iii|iv|v|vi|vii|viii|ix|x)\s+/i,
    ];

    let changed = true;
    while (changed) {
      changed = false;
      for (const pattern of patterns) {
        const next = out.replace(pattern, "").trim();
        if (next !== out) {
          out = next;
          changed = true;
        }
      }
    }

    return normalizeWhitespace(out);
  }

  globalObj.LEFUtils = Object.freeze({
    DEBUG,
    debugLog,
    sendRuntimeMessage,
    safeTrim,
    normalizeWhitespace,
    isLinkedInProfileLikeUrl,
    sanitizeHeadlineJobTitle,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
