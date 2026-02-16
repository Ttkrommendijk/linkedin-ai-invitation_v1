function cleanText(s) {
  return (s || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeExcerpt(text, maxChars = 800) {
  if (!text) return "";
  let cleaned = String(text);
  cleaned = cleaned.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    "[redacted-email]",
  );
  cleaned = cleaned.replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[redacted-phone]");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (cleaned.length > maxChars) cleaned = cleaned.slice(0, maxChars).trim();
  return cleaned;
}

function nameFromTitle() {
  const t = cleanText(document.title);
  if (!t) return "";
  return cleanText(t.split("|")[0]);
}

function extractFirstName(fullName) {
  const name = cleanText(fullName);
  if (!name) return "";

  const prefixes = [
    "dr.",
    "dr",
    "dra.",
    "dra",
    "sr.",
    "sr",
    "sra.",
    "sra",
    "mr.",
    "mr",
    "mrs.",
    "mrs",
    "ms.",
    "ms",
  ];
  const parts = name.split(" ").filter(Boolean);

  while (parts.length && prefixes.includes(parts[0].toLowerCase())) {
    parts.shift();
  }

  if (!parts.length) return "";
  return parts[0];
}

function firstNonEmptyText(selectors) {
  for (const sel of selectors) {
    const text = cleanText(document.querySelector(sel)?.innerText || "");
    if (text) return text;
  }
  return "";
}

function extractProfile() {
  const url = window.location.href;

  let name =
    cleanText(document.querySelector("h1")?.innerText) ||
    cleanText(
      document.querySelector('[data-anonymize="person-name"]')?.innerText,
    );

  if (!name) name = nameFromTitle();

  const first_name = extractFirstName(name);

  let headline =
    cleanText(document.querySelector("main .text-body-medium")?.innerText) ||
    cleanText(document.querySelector('[data-anonymize="headline"]')?.innerText);

  if (!headline) {
    const candidates = Array.from(
      document.querySelectorAll("main .text-body-medium"),
    )
      .map((el) => cleanText(el.innerText))
      .filter(Boolean);
    headline = candidates.find((t) => t.length > 10) || "";
  }

  const profile_location = firstNonEmptyText([
    '[data-anonymize="location"]',
    "main .pv-text-details__left-panel .text-body-small",
    "main .text-body-small.inline.t-black--light.break-words",
  ]);

  const about = firstNonEmptyText([
    'section[id*="about"] .display-flex.ph5.pv3',
    'section[id*="about"] span[aria-hidden="true"]',
    'section[id*="about"] .inline-show-more-text',
  ]);

  const recent_experience = firstNonEmptyText([
    'section[id*="experience"] li:first-child span[aria-hidden="true"]',
    'section[id*="experience"] li:first-child .t-14.t-normal',
  ]);

  const main = cleanText(document.querySelector("main")?.innerText || "");
  const truncatedMain = main.slice(0, 6000);
  const excerptFallback = sanitizeExcerpt(truncatedMain, 800);

  const profile = {
    url,
    name,
    first_name,
    headline,
    company: "",
    location: profile_location,
    about,
    recent_experience,
  };

  if (excerptFallback) {
    profile.excerpt_fallback = excerptFallback;
  }

  return profile;
}

function isUiNoiseLine(text) {
  const t = cleanText(text).toLowerCase();
  if (!t) return true;
  const noise = [
    "arraste",
    "selecione seu arquivo",
    "anexar",
    "abrir teclado",
    "emoji",
    "emojis",
    "gif",
    "gifs",
    "pressione enter",
    "clique enviar",
    "abrir opções",
    "maximizar",
    "campo da mensagem",
    "enviar abrir",
    "ver perfil",
  ];
  if (noise.some((n) => t.includes(n))) return true;
  if (/^\S.+\s+\d{1,2}:\d{2}$/.test(cleanText(text))) return true;
  return false;
}

function normalizeChatText(value) {
  return (value || "").toString().trim().replace(/\s+/g, " ");
}

function toChatLogEntry(message, index) {
  const direction =
    message?.direction === "them"
      ? "them"
      : message?.direction === "me"
        ? "me"
        : "unknown";
  const time = (message?.time || "").toString().trim();
  const ts = (message?.ts || "").toString().trim();
  const normalizedText = normalizeChatText(message?.text || "");
  const heading = (message?.heading || message?.dateLabel || "")
    .toString()
    .trim();
  const key = `${direction}|${heading}|${ts || time}|${normalizedText}`;
  return {
    i: index,
    liIndex: message?.liIndex ?? -1,
    direction,
    time,
    ts,
    textLen: normalizedText.length,
    text: normalizedText,
    key,
    heading,
    dt_label:
      message?.dt_label || `${heading} ${ts || time}`.trim() || "NO_DATETIME",
    name: (message?.name || "").toString().trim(),
    sortTsIso: message?.sortTsIso || "",
    displayLocal: message?.displayLocal || "",
    msgId: message?.msgId || "",
    domHint: message?.domHint || null,
  };
}

function extractChatHistoryFromInteropShadow() {
  const host = document.querySelector("#interop-outlet");
  const root = host?.shadowRoot;
  const selectorsUsed = [
    "#interop-outlet",
    "ul.msg-s-message-list-content",
    "list.children",
    "time.msg-s-message-list__time-heading",
    ".msg-s-event-listitem",
    "time.msg-s-message-group__timestamp",
    "p.msg-s-event-listitem__body",
    ".msg-s-event-listitem__body",
  ];
  console.log("[LEF][chat] interop", {
    hostFound: !!host,
    shadowRootFound: !!root,
  });

  if (!root) {
    const err = new Error(
      "interop shadow root not found; open the message overlay first",
    );
    err.diag = { hostFound: !!host, shadowRootFound: !!root };
    throw err;
  }

  const list = root.querySelector("ul.msg-s-message-list-content");
  if (!list) {
    return {
      noMessageBox: true,
      code: "NO_MESSAGE_BOX",
      error: "Message overlay not open",
      user_warning: "Please open a message box.",
      meta: {
        listFound: false,
        selectorsUsed,
        domNodesFound: root.querySelectorAll("*").length,
      },
      messages: [],
      diag: { listFound: false },
    };
  }

  const items = Array.from(list.children);
  let currentHeadingText = "";
  let lastGroupTimeText = "";
  let lastGroupNameText = "";
  let lastGroupDirection = "unknown";

  const messages = [];
  let eventCount = 0;
  let bodyCount = 0;
  let skippedMissingHeading = 0;
  let skippedMissingTime = 0;
  let skippedEmptyBody = 0;
  let skippedMissingEvent = 0;
  let inheritedTimeCount = 0;
  let inheritedNameCount = 0;

  items.forEach((li, liIndex) => {
    const headingEl = li.querySelector("time.msg-s-message-list__time-heading");
    if (headingEl) {
      currentHeadingText = (headingEl.textContent || "").trim();
      return;
    }

    const eventEl = li.querySelector(".msg-s-event-listitem");
    if (!eventEl) {
      skippedMissingEvent += 1;
      return;
    }
    eventCount += 1;

    const tsEl =
      eventEl.querySelector("time.msg-s-message-group__timestamp") ||
      eventEl.querySelector("time");

    let effectiveTimeText = (tsEl?.textContent || "").trim();
    if (effectiveTimeText) {
      lastGroupTimeText = effectiveTimeText;
    } else if (lastGroupTimeText) {
      effectiveTimeText = lastGroupTimeText;
      inheritedTimeCount += 1;
    } else {
      skippedMissingTime += 1;
      console.warn("[LEF][chat][extract] skip missing time", {
        liIndex,
        hasHeading: Boolean(currentHeadingText),
        hasEvent: true,
      });
      return;
    }

    const senderNameEl =
      eventEl.querySelector(".msg-s-message-group__name") ||
      eventEl.querySelector(".msg-s-event-listitem__name");

    let effectiveNameText = (senderNameEl?.textContent || "").trim();
    if (effectiveNameText) {
      lastGroupNameText = effectiveNameText;
    } else if (lastGroupNameText) {
      effectiveNameText = lastGroupNameText;
      inheritedNameCount += 1;
    }

    const className = (eventEl.className || "").toLowerCase();
    let effectiveDirection = "unknown";
    if (className.includes("from-me") || className.includes("outgoing")) {
      effectiveDirection = "me";
    } else if (
      className.includes("from-other") ||
      className.includes("incoming")
    ) {
      effectiveDirection = "them";
    } else if (lastGroupDirection) {
      effectiveDirection = lastGroupDirection;
    }
    lastGroupDirection = effectiveDirection;

    let bodyEls = Array.from(
      eventEl.querySelectorAll("p.msg-s-event-listitem__body"),
    );
    if (!bodyEls.length) {
      bodyEls = Array.from(eventEl.querySelectorAll(".msg-s-event-listitem__body"));
    }
    bodyCount += bodyEls.length;

    if (!currentHeadingText) {
      skippedMissingHeading += bodyEls.length || 1;
      console.warn("[LEF][chat][extract] skip missing heading", {
        liIndex,
        hasHeading: false,
        hasTime: Boolean(effectiveTimeText),
        hasBody: bodyEls.length > 0,
      });
      return;
    }

    bodyEls.forEach((bodyEl) => {
      const bodyText = (bodyEl?.innerText || "").trim();
      if (!bodyText) {
        skippedEmptyBody += 1;
        return;
      }

      const message = {
        i: messages.length,
        liIndex,
        heading: currentHeadingText,
        dateLabel: currentHeadingText,
        time: effectiveTimeText,
        dt_label: `${currentHeadingText} ${effectiveTimeText}`.trim(),
        name: effectiveNameText || "",
        direction: effectiveDirection || "unknown",
        text: bodyText,
      };
      messages.push(message);

      const preview = bodyText.replace(/\s+/g, " ").slice(0, 80);
      console.log(
        `[LEF][chat][extract] [li:${liIndex}] ${message.dt_label} | ${message.name || "unknown"} | ${preview}`,
      );
    });
  });

  console.groupCollapsed("[LEF][chat][extract] summary");
  console.log("totalLiItems", items.length);
  console.log("eventCount", eventCount);
  console.log("bodyCount", bodyCount);
  console.log("messagesProduced", messages.length);
  console.log("skippedMissingHeading", skippedMissingHeading);
  console.log("skippedMissingTime", skippedMissingTime);
  console.log("skippedEmptyBody", skippedEmptyBody);
  console.log("skippedMissingEvent", skippedMissingEvent);
  console.log("inheritedTimeCount", inheritedTimeCount);
  console.log("inheritedNameCount", inheritedNameCount);
  messages.forEach((m, i) => {
    const preview = (m.text || "").replace(/\s+/g, " ").slice(0, 80);
    console.log(
      `[${i}] [li:${m.liIndex}] ${m.dt_label} | ${m.name || "unknown"} | ${preview}`,
    );
  });
  console.groupEnd();

  return {
    messages,
    diag: {
      listFound: true,
      liCount: items.length,
      eventCount,
      bodyCount,
      messagesProduced: messages.length,
      skippedMissingHeading,
      skippedMissingTime,
      skippedEmptyBody,
      skippedMissingEvent,
      inheritedTimeCount,
      inheritedNameCount,
      url: window.location.href,
      selectorsUsed,
      domNodesFound: root.querySelectorAll("*").length,
      traversalOrder: "top-to-bottom",
      reversedOrder: false,
    },
  };
}
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "EXTRACT_PROFILE_CONTEXT") {
    try {
      const profile = extractProfile();
      sendResponse({ ok: true, profile });
    } catch (e) {
      sendResponse({
        ok: false,
        error: {
          code: "EXTRACTION_FAILED",
          message: e instanceof Error ? e.message : String(e || "unknown"),
        },
      });
    }
    return true;
  }

  if (msg?.type === "EXTRACT_CHAT_HISTORY") {
    const reqId = String(msg?.reqId || "no_req_id");
    console.log("[LEF][chat] handler entry", { reqId, href: location.href });
    try {
      const result = extractChatHistoryFromInteropShadow();
      if (result?.noMessageBox) {
        console.groupCollapsed(`[LEF][chat][${reqId}] content messages (raw)`);
        console.log("context", {
          href: location.href,
          selectorsUsed: result?.meta?.selectorsUsed || [],
          domNodesFound: result?.meta?.domNodesFound || 0,
          messagesProduced: 0,
          traversalOrder: "top-to-bottom",
          reversed: false,
        });
        console.groupEnd();
        sendResponse({
          ok: false,
          code: "NO_MESSAGE_BOX",
          error: "Message overlay not open",
          user_warning: "Please open a message box.",
          meta: { reqId, headingCount: result?.meta?.headingCount || 0 },
        });
        return true;
      }
      const { messages, diag } = result;
      console.groupCollapsed(`[LEF][chat][${reqId}] content messages (raw)`);
      console.log("context", {
        href: location.href,
        selectorsUsed: diag?.selectorsUsed || [],
        domNodesFound: diag?.domNodesFound || 0,
        messagesProduced: Array.isArray(messages) ? messages.length : 0,
        headingCount: diag?.headingCount || 0,
        traversalOrder: diag?.traversalOrder || "top-to-bottom",
        reversed: Boolean(diag?.reversedOrder),
      });
      (Array.isArray(messages) ? messages : []).forEach((m, i) => {
        console.log(toChatLogEntry(m, i));
      });
      console.groupEnd();
      const meta = {
        reqId,
        extractedCount: Array.isArray(messages) ? messages.length : 0,
        rawExtractedCount: diag?.rawExtractedCount ?? null,
        datedCount: diag?.datedCount ?? null,
        droppedNoDateCount: diag?.droppedNoDateCount ?? null,
      };
      console.log("[LEF][chat] handler success", meta);
      sendResponse({ ok: true, messages, diag, meta });
    } catch (e) {
      console.error(
        "[LEF][chat] handler exception",
        { reqId },
        e?.message || String(e),
        e?.stack,
      );
      sendResponse({
        ok: false,
        error: e?.message || String(e || "unknown"),
        stack: e?.stack || "",
        diag: e?.diag || null,
        meta: { reqId },
      });
    }
    return true;
  }

  return false;
});
