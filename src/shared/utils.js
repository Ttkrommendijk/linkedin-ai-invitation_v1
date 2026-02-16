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

  globalObj.LEFUtils = Object.freeze({
    safeTrim,
    normalizeWhitespace,
    isLinkedInProfileLikeUrl,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
