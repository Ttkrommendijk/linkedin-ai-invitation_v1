// Owns pure or near-pure popup helpers and low-level utility wrappers.
// Do not add workflow orchestration, DOM flow logic, or controller behavior here.
(function initPopupUtils(globalObj) {
  const LEF_UTILS_SOURCE = globalObj.LEFUtils;
  if (
    (!LEF_UTILS_SOURCE || typeof LEF_UTILS_SOURCE !== "object") &&
    !globalObj.__LEFUTILS_MISSING_WARNED__
  ) {
    globalObj.__LEFUTILS_MISSING_WARNED__ = true;
    console.warn("[lefutils] not found; using local fallbacks");
  }

  const LEF_UTILS =
    LEF_UTILS_SOURCE && typeof LEF_UTILS_SOURCE === "object"
      ? LEF_UTILS_SOURCE
      : {};

  function safeTrimFallback(value) {
    return value == null ? "" : String(value).trim();
  }

  function normalizeWhitespaceFallback(value) {
    return safeTrimFallback(value).replace(/\s+/g, " ");
  }

  function sanitizeHeadlineJobTitleFallback(value) {
    return normalizeWhitespaceFallback(value);
  }

  const safeTrim =
    typeof LEF_UTILS.safeTrim === "function"
      ? LEF_UTILS.safeTrim
      : safeTrimFallback;

  const normalizeWhitespace =
    typeof LEF_UTILS.normalizeWhitespace === "function"
      ? LEF_UTILS.normalizeWhitespace
      : normalizeWhitespaceFallback;

  const sanitizeHeadlineJobTitle =
    typeof LEF_UTILS.sanitizeHeadlineJobTitle === "function"
      ? LEF_UTILS.sanitizeHeadlineJobTitle
      : sanitizeHeadlineJobTitleFallback;

  const sendRuntimeMessage =
    typeof LEF_UTILS.sendRuntimeMessage === "function"
      ? LEF_UTILS.sendRuntimeMessage
      : (type, payload = {}, options = {}) => {
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
              chrome.runtime.sendMessage(
                {
                  type,
                  ...(payload && typeof payload === "object" ? payload : {}),
                },
                (response) => {
                  const runtimeError = chrome.runtime?.lastError;
                  if (runtimeError) {
                    const errorText = String(
                      runtimeError.message || runtimeError,
                    );
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
                    done({
                      ok: false,
                      error: errorText,
                      data: response || null,
                    });
                    return;
                  }
                  done({ ok: true, data: response });
                },
              );
            } catch (e) {
              const errorText = e instanceof Error ? e.message : String(e || "");
              done({ ok: false, error: errorText, data: null });
            }
          });
        };

  const debugLog =
    typeof LEF_UTILS.debugLog === "function" ? LEF_UTILS.debugLog : () => {};

  function isSidePanelContext() {
    try {
      return (
        globalObj.location.pathname.includes("sidepanel.html") ||
        globalObj.top.location.pathname.includes("sidepanel.html")
      );
    } catch (_e) {
      return globalObj.location.pathname.includes("sidepanel.html");
    }
  }

  function getErrorMessage(error, fallback = "Unexpected error.") {
    if (typeof LEF_UTILS.getErrorMessage === "function") {
      return LEF_UTILS.getErrorMessage(error, fallback);
    }
    if (error && typeof error === "object" && typeof error.message === "string") {
      return error.message;
    }
    if (error instanceof Error && typeof error.message === "string") {
      return error.message;
    }
    return fallback;
  }

  function formatChatHistory(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return "No chat messages found.";
    }
    const lines = [];
    let lastHeading = "";
    let lastGroupKey = "";
    for (const m of messages) {
      const dateLabel = (m?.heading || m?.dateLabel || "").trim();
      const name = (m?.name || "").trim() || "Unknown";
      const time = (m?.time || m?.ts || "").trim();
      const text = (m?.text || "").trim();
      if (!text || !time) continue;
      if (dateLabel && dateLabel !== lastHeading) {
        if (lines.length && lines[lines.length - 1] !== "") lines.push("");
        lines.push(dateLabel);
        lastHeading = dateLabel;
        lastGroupKey = "";
      }
      const groupKey = `${name}||${time}`;
      if (groupKey !== lastGroupKey) {
        if (lines.length && lines[lines.length - 1] !== "") lines.push("");
        lines.push(`${name}  ${time}`);
        lastGroupKey = groupKey;
      }
      lines.push(text);
    }
    return lines.join("\n");
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
      const ta = globalObj.document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "-9999px";
      globalObj.document.body.appendChild(ta);

      ta.select();
      ta.setSelectionRange(0, ta.value.length);

      const ok = globalObj.document.execCommand("copy");
      globalObj.document.body.removeChild(ta);

      if (!ok) {
        return { ok: false, error: "Copy failed (execCommand)." };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: getErrorMessage(e) };
    }
  }

  function formatDateTime(isoString) {
    if (typeof LEF_UTILS.formatDateTime === "function") {
      return LEF_UTILS.formatDateTime(isoString, "America/Sao_Paulo");
    }
    if (!isoString) return "";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "";

    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(date);
      const get = (type) => parts.find((p) => p.type === type)?.value || "";
      return `${get("day")} ${get("month")} ${get("year")} ${get("hour")}:${get("minute")}`.trim();
    } catch (_e) {
      try {
        return date.toLocaleString();
      } catch (_e2) {
        return "";
      }
    }
  }

  function getLinkedinUrlFromContext(profileContext) {
    return (
      profileContext?.url ||
      profileContext?.profile_url ||
      profileContext?.linkedin_url ||
      null
    );
  }

  function getFullNameFromContext(profileContext) {
    return profileContext?.name || profileContext?.full_name || null;
  }

  function getProfileForGeneration(profile) {
    const p = profile || {};
    const out = {};

    const copyKeys = [
      "url",
      "profile_url",
      "linkedin_url",
      "name",
      "full_name",
      "first_name",
      "headline",
      "company",
      "location",
      "about",
      "recent_experience",
    ];

    for (const key of copyKeys) {
      if (p[key] !== undefined && p[key] !== null) {
        out[key] = p[key];
      }
    }

    if (p.excerpt_fallback) {
      out.excerpt_fallback = p.excerpt_fallback;
    }

    return out;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatLocalDateTime(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "";
    const dd = pad2(date.getDate());
    const mm = pad2(date.getMonth() + 1);
    const yy = String(date.getFullYear()).slice(-2);
    const hh = pad2(date.getHours());
    const mi = pad2(date.getMinutes());
    return `${dd}-${mm}-${yy} ${hh}:${mi}`;
  }

  function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function shouldOpenInNewTab(event) {
    return Boolean(event?.ctrlKey || event?.metaKey);
  }

  globalObj.PopupUtils = Object.freeze({
    LEF_UTILS,
    safeTrim,
    normalizeWhitespace,
    sanitizeHeadlineJobTitle,
    sendRuntimeMessage,
    debugLog,
    isSidePanelContext,
    getErrorMessage,
    formatChatHistory,
    copyToClipboard,
    formatDateTime,
    getLinkedinUrlFromContext,
    getFullNameFromContext,
    getProfileForGeneration,
    pad2,
    formatLocalDateTime,
    clampNumber,
    shouldOpenInNewTab,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
