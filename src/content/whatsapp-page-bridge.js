(function () {
  if (window.__LEF_WHATSAPP_PAGE_BRIDGE_INSTALLED__) {
    window.postMessage(
      {
        source: "LEF_WHATSAPP_PAGE_BRIDGE",
        type: "LEF_WA_BRIDGE_READY",
        url: window.location.href,
        reason: "already_installed",
      },
      "*",
    );
    return;
  }

  window.__LEF_WHATSAPP_PAGE_BRIDGE_INSTALLED__ = true;

  const TITLE_SELECTOR = '[data-testid="conversation-info-header-chat-title"]';
  const OUTBOUND_TYPE = "LEF_WA_ACTIVE_CHAT_PHONE";
  const REQUEST_TYPE = "LEF_WA_REQUEST_ACTIVE_CHAT";
  const SOURCE = "LEF_WHATSAPP_PAGE_BRIDGE";
  const VALID_EXTRACT_REASON = "active_header_phoneNumber_object";
  const BLOCKED_KEYS =
    /^(msgs|_models|models|collection|children|child|sibling|return|alternate|firstEffect|lastEffect|stateNode|ref|refs)$/i;
  let lastPhone = "";
  let timer = null;

  function getFiberKey(el) {
    if (!el) return "";
    return Object.keys(el).find((key) => key.includes("reactFiber")) || "";
  }

  function getTitleText(el) {
    return (el?.innerText || el?.textContent || "")
      .replace(/ /g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizePhone(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  function readPhoneNumberObject(value) {
    if (!value || typeof value !== "object") return null;

    const server = String(value.server || "").trim();
    const user = normalizePhone(value.user);
    const serialized = String(value._serialized || "").trim();

    if (server === "c.us" && /^\d{8,}$/.test(user)) {
      return {
        phone: user,
        historyChatId: `${user}@c.us`,
      };
    }

    if (serialized.endsWith("@c.us")) {
      const phone = normalizePhone(serialized.split("@")[0]);
      if (/^\d{8,}$/.test(phone)) {
        return {
          phone,
          historyChatId: `${phone}@c.us`,
        };
      }
    }

    return null;
  }

  function findPhoneNumberObject(root, path = "", seen = new WeakSet()) {
    if (!root || typeof root !== "object") return null;
    if (seen.has(root)) return null;
    seen.add(root);

    for (const [key, value] of Object.entries(root)) {
      if (BLOCKED_KEYS.test(key)) continue;

      const nextPath = path ? `${path}.${key}` : key;
      const keyLooksLikePhoneNumber = /(?:^|_)phoneNumber$/i.test(key);

      if (keyLooksLikePhoneNumber) {
        const found = readPhoneNumberObject(value);
        if (found) {
          return {
            ...found,
            extractPath: nextPath,
          };
        }
      }

      if (value && typeof value === "object") {
        const found = findPhoneNumberObject(value, nextPath, seen);
        if (found) return found;
      }
    }

    return null;
  }

  function findActiveChat() {
    const el = document.querySelector(TITLE_SELECTOR);
    const titleText = getTitleText(el);

    if (!el) {
      return {
        phone: "",
        historyChatId: "",
        titleText,
        extractReason: "title_not_found",
        extractPath: "",
      };
    }

    const fk = getFiberKey(el);
    if (!fk) {
      return {
        phone: "",
        historyChatId: "",
        titleText,
        extractReason: "fiber_key_not_found",
        extractPath: "",
      };
    }

    let node = el[fk];
    let level = 0;

    while (node && level < 40) {
      const found = findPhoneNumberObject(
        {
          props: node.memoizedProps,
          state: node.memoizedState,
          context: node.context,
          dependencies: node.dependencies,
        },
        `fiber_level_${level}`,
      );

      if (found?.phone) {
        return {
          phone: found.phone,
          historyChatId: found.historyChatId,
          titleText,
          extractReason: VALID_EXTRACT_REASON,
          extractPath: found.extractPath || "",
        };
      }

      node = node.return;
      level += 1;
    }

    return {
      phone: "",
      historyChatId: "",
      titleText,
      extractReason: "phoneNumber_object_not_found",
      extractPath: "",
    };
  }

  function buildPayload(result, reason, requestId) {
    return {
      source: SOURCE,
      type: OUTBOUND_TYPE,
      phone: result.phone || "",
      url: window.location.href,
      reason: reason || "change",
      extract_reason: result.extractReason || "unknown",
      extractReason: result.extractReason || "unknown",
      titleText: result.titleText || "",
      historyChatId: result.historyChatId || "",
      extractPath: result.extractPath || "",
      requestId,
    };
  }

  function publish(reason, requestId = 0) {
    const result = findActiveChat();
    const phone = result.phone || "";
    const extractReason = result.extractReason || "unknown";

    if (extractReason !== VALID_EXTRACT_REASON) {
      if (reason !== "request") return;
      window.postMessage(buildPayload(result, reason, requestId), "*");
      return;
    }

    if (phone === lastPhone && reason !== "request") return;
    lastPhone = phone;

    window.postMessage(buildPayload(result, reason, requestId), "*");
  }

  function schedule(reason) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => publish(reason), 250);
  }

  function patchHistory(name) {
    const original = history[name];
    if (typeof original !== "function") return;
    history[name] = function (...args) {
      const out = original.apply(this, args);
      schedule(name);
      return out;
    };
  }

  patchHistory("pushState");
  patchHistory("replaceState");
  window.addEventListener("popstate", () => schedule("popstate"));
  window.addEventListener("focus", () => schedule("focus"));
  document.addEventListener("visibilitychange", () => schedule("visibilitychange"));
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== REQUEST_TYPE) return;
    publish("request", Number(event.data?.requestId || 0));
  });

  const observer = new MutationObserver(() => schedule("mutation"));
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.postMessage(
    {
      source: SOURCE,
      type: "LEF_WA_BRIDGE_READY",
      url: window.location.href,
      reason: "installed",
    },
    "*",
  );
  schedule("installed");
})();
