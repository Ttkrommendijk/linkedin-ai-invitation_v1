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
    return /^https:\/\/www\.linkedin\.com\/(in|company|school)\/[^/?#]+/i.test(
      normalized,
    );
  }

  function canonicalizeLinkedInUrl(rawUrl) {
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

  function cleanText(value) {
    return normalizeWhitespace(String(value || "").replace(/\u00A0/g, " "));
  }

  function sanitizeExcerpt(text, maxChars = 800) {
    if (!text) return "";
    let cleaned = String(text);
    cleaned = cleaned.replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[redacted-email]",
    );
    cleaned = cleaned.replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[redacted-phone]");
    cleaned = normalizeWhitespace(cleaned);
    if (cleaned.length > maxChars) cleaned = cleaned.slice(0, maxChars).trim();
    return cleaned;
  }

  function normalizeError(err, code = "UNKNOWN_ERROR", details) {
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
  }

  function getErrorMessage(error, fallback = "Unexpected error.") {
    if (
      error &&
      typeof error === "object" &&
      typeof error.message === "string"
    ) {
      return error.message;
    }
    if (error instanceof Error && typeof error.message === "string") {
      return error.message;
    }
    return fallback;
  }

  function normalizeProfileField(value) {
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
  }

  function clampText(text, maxChars) {
    let out = (text || "").trim();
    out = out
      .replace(/\r\n/g, "\n")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (out.length > maxChars) {
      out = out.slice(0, maxChars - 3).trim() + "...";
    }
    return out;
  }

  function formatDateTime(isoString, timeZone = "America/Sao_Paulo") {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "";

    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(date);
      const get = (type) =>
        parts.find((part) => part.type === type)?.value || "";
      return `${get("day")} ${get("month")} ${get("year")} ${get("hour")}:${get("minute")}`.trim();
    } catch (_e) {
      try {
        return date.toLocaleString();
      } catch (_e2) {
        return "";
      }
    }
  }

  async function copyToClipboard(text) {
    const value = typeof text === "string" ? text : String(text ?? "");

    if (
      globalObj.navigator?.clipboard &&
      typeof globalObj.navigator.clipboard.writeText === "function"
    ) {
      try {
        await globalObj.navigator.clipboard.writeText(value);
        return { ok: true };
      } catch (_err) {
        // Fallback below.
      }
    }

    try {
      const doc = globalObj.document;
      if (!doc?.createElement) {
        return { ok: false, error: "Clipboard unavailable." };
      }

      const ta = doc.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "-9999px";
      doc.body.appendChild(ta);

      ta.select();
      ta.setSelectionRange(0, ta.value.length);

      const ok = doc.execCommand("copy");
      doc.body.removeChild(ta);

      if (!ok) {
        return { ok: false, error: "Copy failed (execCommand)." };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: getErrorMessage(e) };
    }
  }

  globalObj.LEFUtils = Object.freeze({
    DEBUG,
    debugLog,
    sendRuntimeMessage,
    safeTrim,
    normalizeWhitespace,
    isLinkedInProfileLikeUrl,
    canonicalizeLinkedInUrl,
    sanitizeHeadlineJobTitle,
    cleanText,
    sanitizeExcerpt,
    normalizeError,
    getErrorMessage,
    normalizeProfileField,
    clampText,
    formatDateTime,
    copyToClipboard,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
