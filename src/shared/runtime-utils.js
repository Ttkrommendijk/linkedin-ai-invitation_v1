(function initLEFRuntimeUtils(globalObj) {
  const LEF_UTILS = globalObj.LEFUtils || {};

  const safeTrim =
    typeof LEF_UTILS.safeTrim === "function"
      ? LEF_UTILS.safeTrim
      : (value) => (value == null ? "" : String(value).trim());

  const normalizeWhitespace =
    typeof LEF_UTILS.normalizeWhitespace === "function"
      ? LEF_UTILS.normalizeWhitespace
      : (value) => safeTrim(value).replace(/\s+/g, " ");

  const sanitizeHeadlineJobTitle =
    typeof LEF_UTILS.sanitizeHeadlineJobTitle === "function"
      ? LEF_UTILS.sanitizeHeadlineJobTitle
      : (value) => normalizeWhitespace(value);

  const normalizeError =
    typeof LEF_UTILS.normalizeError === "function"
      ? LEF_UTILS.normalizeError
      : (err, code = "UNKNOWN_ERROR", details) => {
          const message =
            err instanceof Error ? err.message : String(err || "unknown error");
          const out = { code, message };
          const errDetails =
            details ||
            (err && typeof err === "object" && "details" in err
              ? err.details
              : undefined);
          if (errDetails) out.details = errDetails;
          return out;
        };

  const normalizeProfileField =
    typeof LEF_UTILS.normalizeProfileField === "function"
      ? LEF_UTILS.normalizeProfileField
      : (value) => {
          if (value == null) return "";
          if (typeof value === "string") return value.trim();
          if (Array.isArray(value)) {
            return value
              .map(normalizeProfileField)
              .filter(Boolean)
              .join(" | ")
              .trim();
          }
          if (typeof value === "object") {
            return Object.values(value)
              .map(normalizeProfileField)
              .filter(Boolean)
              .join(" | ")
              .trim();
          }
          return String(value).trim();
        };

  const clampText =
    typeof LEF_UTILS.clampText === "function"
      ? LEF_UTILS.clampText
      : (text, maxChars) => {
          let out = safeTrim(text || "");
          out = out
            .replace(/\r\n/g, "\n")
            .replace(/\n+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          if (out.length > maxChars) {
            out = out.slice(0, maxChars - 3).trim() + "...";
          }
          return out;
        };

  const isLinkedInProfileLikeUrl =
    typeof LEF_UTILS.isLinkedInProfileLikeUrl === "function"
      ? LEF_UTILS.isLinkedInProfileLikeUrl
      : (url) =>
          /^https:\/\/www\.linkedin\.com\/(in|company|school)\/[^/?#]+/i.test(
            safeTrim(url),
          );

  const canonicalizeLinkedInUrl =
    typeof LEF_UTILS.canonicalizeLinkedInUrl === "function"
      ? LEF_UTILS.canonicalizeLinkedInUrl
      : (rawUrl) => {
          const input = safeTrim(rawUrl);
          if (!input) return "";
          try {
            const parsed = new URL(input);
            const parts = (parsed.pathname || "").split("/").filter(Boolean);
            if (parts.length >= 2 && /^(company|school)$/i.test(parts[0])) {
              return `https://www.linkedin.com/${parts[0].toLowerCase()}/${parts[1]}/`;
            }
            const pathname = (parsed.pathname || "").replace(/\/+$/, "") || "/";
            if (pathname === "/") return "https://www.linkedin.com/";
            return `https://www.linkedin.com${pathname}/`;
          } catch (_e) {
            const noHash = input.split("#")[0];
            const noQuery = noHash.split("?")[0];
            const match = noQuery.match(
              /^https:\/\/www\.linkedin\.com\/(company|school)\/([^/?#\/]+)/i,
            );
            if (match) {
              return `https://www.linkedin.com/${match[1].toLowerCase()}/${match[2]}/`;
            }
            const noTrailing = noQuery.replace(/\/+$/, "");
            if (!noTrailing) return "";
            return noTrailing.endsWith("/") ? noTrailing : `${noTrailing}/`;
          }
        };

  const normalizeLinkedinCompanyUrl = (value) =>
    canonicalizeLinkedInUrl(normalizeProfileField(value));

  const normalizeLinkedinInvitationUrl = (value) =>
    canonicalizeLinkedInUrl(normalizeProfileField(value));

  globalObj.LEFRuntimeUtils = Object.freeze({
    safeTrim,
    normalizeWhitespace,
    sanitizeHeadlineJobTitle,
    normalizeError,
    normalizeProfileField,
    clampText,
    isLinkedInProfileLikeUrl,
    canonicalizeLinkedInUrl,
    normalizeLinkedinCompanyUrl,
    normalizeLinkedinInvitationUrl,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
