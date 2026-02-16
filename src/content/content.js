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

function extractChatHistoryFromInteropShadow() {
  const host = document.querySelector("#interop-outlet");
  const root = host?.shadowRoot;
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

  const headingCandidates = Array.from(root.querySelectorAll("*")).filter(
    (el) =>
      /(enviou a seguinte mensagem|enviou as seguintes mensagens)/i.test(
        cleanText(el.textContent || ""),
      ),
  );
  console.log("[LEF][chat] heading candidates", {
    count: headingCandidates.length,
  });
  if (!headingCandidates.length) {
    return {
      noMessageBox: true,
      code: "NO_MESSAGE_BOX",
      error: "Message overlay not open",
      user_warning: "Please open a message box.",
      meta: { headingCount: 0 },
      messages: [],
      diag: { headingCount: 0 },
    };
  }

  let threadRoot = null;
  let bestCount = -1;
  for (const heading of headingCandidates) {
    let node = heading;
    while (node && node !== root) {
      const count = node.querySelectorAll
        ? Array.from(node.querySelectorAll("*")).filter((el) =>
            /(enviou a seguinte mensagem|enviou as seguintes mensagens)/i.test(
              cleanText(el.textContent || ""),
            ),
          ).length
        : 0;
      if (count > bestCount) {
        bestCount = count;
        threadRoot = node;
      }
      node = node.parentElement;
    }
  }

  console.log("[LEF][chat] thread root", {
    found: !!threadRoot,
    tag: threadRoot?.tagName || "",
    className: threadRoot?.className || "",
    headingCountInRoot: bestCount,
  });
  if (!threadRoot) {
    const err = new Error("Could not locate message thread root in overlay.");
    err.diag = { headingCount: headingCandidates.length };
    throw err;
  }

  const profileName = cleanText(
    document.querySelector("main h1")?.innerText || "",
  ).toLowerCase();
  const seen = new Set();
  const messages = [];
  const headingsInRoot = headingCandidates.filter((h) =>
    threadRoot.contains(h),
  );

  for (const heading of headingsInRoot) {
    const headingText = cleanText(heading.textContent || "");
    const senderMatch = headingText.match(/^(.+?)\s+enviou/i);
    const sender = cleanText(senderMatch?.[1] || "");
    const tsMatch = headingText.match(/às\s+(\d{1,2}:\d{2})/i);
    const ts = cleanText(tsMatch?.[1] || "");
    const group =
      heading.closest("li,article,section,div") || heading.parentElement;
    if (!group) continue;

    let bestText = "";
    const candidates = Array.from(group.querySelectorAll("div,span,p")).map(
      (el) => cleanText(el.textContent || ""),
    );
    for (const txt of candidates) {
      if (!txt) continue;
      if (txt === headingText) continue;
      if (isUiNoiseLine(txt)) continue;
      if (txt.length > bestText.length) bestText = txt;
    }
    if (!bestText) continue;

    const key = `${sender}|${ts}|${bestText}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let direction = "unknown";
    if (sender && profileName) {
      direction = sender.toLowerCase() === profileName ? "them" : "me";
    }

    messages.push({ text: bestText, direction, sender, ts });
  }

  const firstTs = messages[0]?.ts;
  const lastTs = messages[messages.length - 1]?.ts;
  if (firstTs && lastTs) {
    const toMinutes = (v) => {
      const [h, m] = v.split(":").map((n) => Number(n));
      return h * 60 + m;
    };
    if (toMinutes(firstTs) > toMinutes(lastTs)) {
      messages.reverse();
    }
  }

  console.log("[LEF][chat] extracted", {
    count: messages.length,
    sample: messages.slice(0, 3),
  });
  if (!messages.length) {
    const err = new Error(
      "Message overlay not open or no messages rendered. Open the message box and try again.",
    );
    err.diag = {
      headingCount: headingsInRoot.length,
      bodiesInRoot: threadRoot.querySelectorAll("*").length,
      rootClass: threadRoot.className || "",
      composerFound: !!root.querySelector("textarea, [contenteditable='true']"),
      url: window.location.href,
    };
    throw err;
  }

  return {
    messages,
    diag: {
      headingCount: headingsInRoot.length,
      rootClass: threadRoot.className || "",
      composerFound: !!root.querySelector("textarea, [contenteditable='true']"),
      url: window.location.href,
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
      const meta = {
        reqId,
        extractedCount: Array.isArray(messages) ? messages.length : 0,
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
