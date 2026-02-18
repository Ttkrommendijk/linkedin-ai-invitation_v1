(function initLEFUtils(globalObj) {
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
    safeTrim,
    normalizeWhitespace,
    isLinkedInProfileLikeUrl,
    sanitizeHeadlineJobTitle,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
