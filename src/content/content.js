const LEF_UTILS = globalThis.LEFUtils || {};
const debugLog =
  typeof LEF_UTILS.debugLog === "function" ? LEF_UTILS.debugLog : () => {};
const safeTrim =
  typeof LEF_UTILS.safeTrim === "function"
    ? LEF_UTILS.safeTrim
    : (value) => (value == null ? "" : String(value).trim());
const normalizeWhitespace =
  typeof LEF_UTILS.normalizeWhitespace === "function"
    ? LEF_UTILS.normalizeWhitespace
    : (value) => safeTrim(value).replace(/\s+/g, " ");

function timingLog(eventName, details = {}) {
  console.log("[LEF][timing]", eventName, {
    ts: Date.now(),
    url: window.location.href,
    ...details,
  });
}

function cleanText(s) {
  return normalizeWhitespace(String(s || "").replace(/\u00A0/g, " "));
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

function hasPersonLikeContent(text) {
  const t = cleanText(text).toLowerCase();
  if (!t) return false;
  return (
    t.includes("enviar mensagem") ||
    t.includes("sales navigator") ||
    t.includes("conexões em comum") ||
    t.includes("dados de contato") ||
    t.includes("gerente de ti") ||
    t.includes("analista") ||
    t.includes("coordenador")
  );
}

function buildCompanyPageExcerpt(companyName, rawMainText, rawBodyText = "") {
  const cleanedCompany = cleanText(companyName);
  const combinedText = `${rawMainText || ""}\n${rawBodyText || ""}`;
  if (
    !hasCompanyLandingContent(combinedText, cleanedCompany) ||
    hasPersonProfileSectionMarkers(rawMainText)
  ) {
    return "";
  }
  const lines = String(rawMainText || "")
    .split(/\r?\n+/)
    .map((line) => cleanText(line))
    .filter(Boolean);

  const contextKeywords = [
    "visão geral",
    "overview",
    "sobre",
    "about",
    "setor",
    "industry",
    "sede",
    "headquarters",
    "funcionários",
    "employees",
    "vagas",
    "jobs",
    "publicações",
    "posts",
    "site",
  ];

  const filtered = lines.filter((line) => {
    const lower = line.toLowerCase();
    if (hasPersonLikeContent(line)) return false;
    if (cleanedCompany && lower.includes(cleanedCompany.toLowerCase())) return true;
    return contextKeywords.some((keyword) => lower.includes(keyword));
  });

  let excerptSource = "";
  if (filtered.length) {
    excerptSource = filtered.slice(0, 28).join(" ");
  } else {
    const companyIndex = lines.findIndex((line) => {
      const lower = line.toLowerCase();
      return (
        cleanedCompany &&
        lower.includes(cleanedCompany.toLowerCase()) &&
        !hasPersonLikeContent(line)
      );
    });
    const sourceLines =
      companyIndex >= 0 ? lines.slice(companyIndex, companyIndex + 36) : lines;
    const safeFallback = sourceLines.filter(
      (line) => !hasPersonLikeContent(line),
    );
    excerptSource = safeFallback.slice(0, 22).join(" ");
  }
  if (!excerptSource) {
    const bodyLines = String(rawBodyText || "")
      .split(/\r?\n+/)
      .map((line) => cleanText(line))
      .filter(Boolean);
    const safeBodyFallback = bodyLines.filter((line) => !hasPersonLikeContent(line));
    excerptSource = safeBodyFallback.slice(0, 28).join(" ");
  }
  if (!excerptSource) return "";
  return sanitizeExcerpt(excerptSource, 2200);
}

const COMPANY_PROFILE_URL_RE = /linkedin\.com\/(company|school)\//i;
let mainContainerReadyLogged = false;

function canonicalizeLinkedinUrl(rawUrl) {
  const input = cleanText(rawUrl);
  if (!input) return "";
  try {
    const parsed = new URL(input);
    const pathname = (parsed.pathname || "").replace(/\/+$/, "");
    return `https://www.linkedin.com${pathname}`;
  } catch (_e) {
    const noHash = input.split("#")[0];
    const noQuery = noHash.split("?")[0];
    return noQuery.replace(/\/+$/, "");
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function isCompanyProfileUrl(url = window.location.href) {
  return COMPANY_PROFILE_URL_RE.test(String(url || ""));
}

function detectLinkedInPageType(rawUrl = window.location.href) {
  const linkedin_id = canonicalizeLinkedinUrl(rawUrl || "");
  const result = { page_type: "unsupported", linkedin_id };
  if (!/^https:\/\/www\.linkedin\.com\//i.test(linkedin_id)) return result;
  if (/^https:\/\/www\.linkedin\.com\/in\/[^/?#]+/i.test(linkedin_id)) {
    result.page_type = "person";
    return result;
  }
  if (/^https:\/\/www\.linkedin\.com\/(company|school)\/[^/?#]+/i.test(linkedin_id)) {
    result.page_type = "company";
    return result;
  }
  return result;
}

function getCompanyTopCardName() {
  return firstNonEmptyText([
    ".org-top-card-summary__title",
    ".org-top-card-primary-content__title",
    "main h1",
  ]);
}

function getCompanyCandidateName() {
  return normalizeCompanyTitleName(getCompanyTopCardName() || nameFromTitle());
}

function hasCompanyPageMarkers(text) {
  const t = cleanText(text);
  if (!t) return false;
  return /\b(overview|about|posts|jobs|employees|followers|industry|headquarters|inÃ­cio|sobre|publicaÃ§Ãµes|vagas|funcionÃ¡rios|seguidores|setor|sede|ex-alunos)\b/i.test(
    t,
  );
}

function hasPersonProfileSectionMarkers(text) {
  const t = cleanText(text).toLowerCase();
  if (!t) return false;
  return (
    t.includes("formaÃ§Ã£o acadÃªmica") ||
    t.includes("formação acadêmica") ||
    t.includes("licenÃ§as e certificados") ||
    t.includes("licenças e certificados") ||
    t.includes("competÃªncias") ||
    t.includes("competências") ||
    t.includes("recomendaÃ§Ãµes") ||
    t.includes("recomendações") ||
    t.includes("exibir credencial")
  );
}

function hasCompanyLandingContent(text, companyName = "") {
  const t = cleanText(text).toLowerCase();
  const normalizedName = normalizeCompanyTitleName(companyName).toLowerCase();
  if (!t || !normalizedName || !t.includes(normalizedName)) return false;
  const markers = [
    "seguidores",
    "followers",
    "funcionÃ¡rios",
    "funcionários",
    "employees",
    "publicaÃ§Ãµes",
    "publicações",
    "posts",
    "vagas",
    "jobs",
    "visÃ£o geral",
    "visão geral",
    "overview",
    "sobre",
    "about",
    "ex-alunos",
    "alumni",
  ];
  const markerCount = markers.reduce(
    (count, marker) => count + (t.includes(marker) ? 1 : 0),
    0,
  );
  return markerCount >= 2;
}

function normalizeCompanyTitleName(value) {
  return cleanText(value)
    .replace(/^\(\d+\)\s*/, "")
    .replace(/\s*:\s*(vis[aã]o geral|overview).*$/i, "")
    .trim();
}

function companyNameMatchesDocumentTitle(companyName) {
  const normalizedName = normalizeCompanyTitleName(companyName).toLowerCase();
  const normalizedTitle = normalizeCompanyTitleName(
    (document.title || "").split("|")[0],
  ).toLowerCase();
  if (!normalizedName || !normalizedTitle) return false;
  return (
    normalizedTitle.includes(normalizedName) ||
    normalizedName.includes(normalizedTitle)
  );
}

function hasCompanyProfileDom() {
  const companyName = getCompanyTopCardName();
  if (!companyName || /^\(\d+\)/.test(companyName)) return false;

  const mainText = cleanText(document.querySelector("main")?.innerText || "");
  if (!mainText) return false;

  const hasOrgTopCard = Boolean(
    document.querySelector(
      ".org-top-card, .org-top-card-summary, .org-top-card-primary-content",
    ),
  );
  if (hasOrgTopCard) return true;

  return (
    companyNameMatchesDocumentTitle(companyName) &&
    /\b(Início|Publicações|Vagas|Ex-alunos|Visão geral|Overview|Posts|Jobs|Alumni)\b/i.test(
      mainText,
    )
  );
}

function hasMainCompanyContainer() {
  return Boolean(document.querySelector("main"));
}

function hasCompanyDomMarkers() {
  return Boolean(
    document.querySelector(
      ".org-top-card, .org-top-card-summary, .org-top-card-primary-content, .org-page-navigation, .org-about-module, .org-about-company-module, [data-test-id='about-us']",
    ),
  );
}

function getCompanyPageText() {
  const mainText = document.querySelector("main")?.innerText || "";
  const bodyText = document.body?.innerText || "";
  return cleanText(mainText || bodyText);
}

function isPersonPageReadyForExtraction() {
  if (detectLinkedInPageType().page_type !== "person") return false;
  if (!hasMainCompanyContainer()) return false;
  if (hasCompanyDomMarkers()) return false;
  return Boolean(cleanText(document.querySelector("main h1")?.innerText || ""));
}

function isStableCompanyProfileDom(companyName = getCompanyCandidateName()) {
  const text = getCompanyPageText();
  if (!text || hasPersonProfileSectionMarkers(text)) return false;
  return hasCompanyLandingContent(text, companyName);
}

function isCompanyPageReadyForExtraction() {
  const companyName = getCompanyCandidateName();
  return (
    detectLinkedInPageType().page_type === "company" &&
    hasMainCompanyContainer() &&
    Boolean(companyName) &&
    isStableCompanyProfileDom(companyName)
  );
}

async function waitForDomReady(matcher, { timeoutMs = 2500 } = {}) {
  if (matcher()) return;
  await new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timeoutId);
      resolve();
    };
    const observer = new MutationObserver(() => {
      if (matcher()) done();
    });
    const timeoutId = setTimeout(done, timeoutMs);
    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
}

async function waitForPersonProfileDom({ timeoutMs = 2500 } = {}) {
  await waitForDomReady(isPersonPageReadyForExtraction, { timeoutMs });
}

async function waitForCompanyProfileDom({ timeoutMs = 2500 } = {}) {
  await waitForDomReady(isCompanyPageReadyForExtraction, { timeoutMs });
}

function extractProfile() {
  const url = window.location.href;
  const isCompanyProfile = isCompanyProfileUrl(url);

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

  if (isCompanyProfile) {
    const companyName =
      firstNonEmptyText([
        "main h1",
        ".org-top-card-summary__title",
        ".org-top-card-primary-content__title",
      ]) || nameFromTitle();
    const topCardText = firstNonEmptyText([
      ".org-top-card-summary__tagline",
      ".org-top-card-summary-info-list",
      ".org-about-company-module__company-size-definition-text",
      "main",
    ]);
    const employeeNumber = cleanText(
      (topCardText.match(
        /(\d[\d.,\s-]{0,40}(employees|funcion[aá]rios|colaboradores))/i,
      ) || [""])[0],
    );
    const sector = firstNonEmptyText([
      '[data-test-id="about-us__industry"] dd',
      ".org-page-details__definition-text",
    ]);
    const city = firstNonEmptyText([
      '[data-test-id="about-us__headquarters"] dd',
      ".org-location-card .t-14",
      ".org-top-card-summary-info-list__info-item",
    ]);
    const itMembers = cleanText(
      (truncatedMain.match(
        /(\d[\d.,\s-]{0,30}(IT|information technology|engenharia|technology)\s+(members|funcion[aá]rios|people|pessoas))/i,
      ) || [""])[0],
    );
    profile.is_company_profile = true;
    profile.company_name = companyName || "";
    profile.employee_number = employeeNumber || "";
    profile.sector = sector || "";
    profile.city = city || "";
    profile.it_members = itMembers || "";
    profile.linkedin_id = url;
    profile.company_page_excerpt = sanitizeExcerpt(truncatedMain, 2200);
    timingLog("company_extraction_result", {
      company_name: profile.company_name || "",
      raw_text_length: main.length,
      excerpt_length: String(profile.company_page_excerpt || "").length,
      ready_state: document.readyState,
      has_main: hasMainCompanyContainer(),
    });
    console.log("[LEF][company scrape result]", {
      company_name: profile.company_name || "",
      employee_number: profile.employee_number || "",
      sector: profile.sector || "",
      city: profile.city || "",
      it_members: profile.it_members || "",
      linkedin_id: profile.linkedin_id || "",
    });
  }

  if (excerptFallback) {
    profile.excerpt_fallback = excerptFallback;
  }

  return profile;
}

function extractCompanyContext() {
  const url = canonicalizeLinkedinUrl(window.location.href);
  if (!isCompanyProfileUrl(url)) {
    throw new Error("Active page is not a LinkedIn company page.");
  }

  const rawMain = document.querySelector("main")?.innerText || "";
  const rawBody = document.body?.innerText || "";
  const main = cleanText(rawMain);
  const truncatedMain = main.slice(0, 6000);
  const companyNameRaw =
    firstNonEmptyText([
      "main h1",
      ".org-top-card-summary__title",
      ".org-top-card-primary-content__title",
    ]) || nameFromTitle();
  const companyName = normalizeCompanyTitleName(companyNameRaw);
  const topCardText = firstNonEmptyText([
    ".org-top-card-summary__tagline",
    ".org-top-card-summary-info-list",
    ".org-about-company-module__company-size-definition-text",
  ]);
  const employeeNumber = cleanText(
    (topCardText.match(
      /(\d[\d.,\s-]{0,40}(employees|funcion[aÃ¡]rios|colaboradores))/i,
    ) || [""])[0],
  );
  const sector = firstNonEmptyText([
    '[data-test-id="about-us__industry"] dd',
    ".org-page-details__definition-text",
  ]);
  const city = firstNonEmptyText([
    '[data-test-id="about-us__headquarters"] dd',
    ".org-location-card .t-14",
    ".org-top-card-summary-info-list__info-item",
  ]);
  const itMembers = cleanText(
    (truncatedMain.match(
      /(\d[\d.,\s-]{0,30}(IT|information technology|engenharia|technology)\s+(members|funcion[aÃ¡]rios|people|pessoas))/i,
    ) || [""])[0],
  );

  let companyExcerpt = buildCompanyPageExcerpt(companyName, rawMain, rawBody);
  if (hasPersonLikeContent(companyExcerpt)) {
    companyExcerpt = "";
  }
  if (!companyExcerpt && isStableCompanyProfileDom(companyName)) {
    companyExcerpt = sanitizeExcerpt(
      [companyName, topCardText, sector, city].filter(Boolean).join(" "),
      2200,
    );
  }
  return {
    url,
    is_company_profile: true,
    linkedin_id: url,
    company_name: companyName || "",
    employee_number: employeeNumber || "",
    sector: sector || "",
    city: city || "",
    it_members: itMembers || "",
    company_page_excerpt: companyExcerpt,
  };
}

function isStaleCompanyContext(company) {
  const companyName = normalizeCompanyTitleName(company?.company_name || "");
  if (!companyName) return true;
  const excerpt = cleanText(company?.company_page_excerpt || "");
  if (!isStableCompanyProfileDom(companyName)) return true;
  if (!excerpt) return true;
  if (hasPersonLikeContent(excerpt)) return true;
  if (hasPersonProfileSectionMarkers(excerpt)) return true;
  if (!hasCompanyLandingContent(excerpt, companyName)) return true;
  return false;
}

async function extractFreshCompanyContext({ timeoutMs = 3000 } = {}) {
  const startedAt = Date.now();
  let lastCompany = null;
  while (Date.now() - startedAt < timeoutMs) {
    await waitForCompanyProfileDom({
      timeoutMs: Math.max(100, timeoutMs - (Date.now() - startedAt)),
    });
    if (!isCompanyPageReadyForExtraction()) {
      continue;
    }
    lastCompany = extractCompanyContext();
    if (!isStaleCompanyContext(lastCompany)) {
      return lastCompany;
    }
    timingLog("company_context_stale_retry", {
      company_name: lastCompany?.company_name || "",
      excerpt_length: String(lastCompany?.company_page_excerpt || "").length,
      ready_state: document.readyState,
      has_main: hasMainCompanyContainer(),
      has_company_dom: hasCompanyProfileDom(),
      has_stable_company_dom: isStableCompanyProfileDom(
        lastCompany?.company_name || "",
      ),
    });
    await delay(100);
  }
  if (lastCompany && !isStaleCompanyContext(lastCompany)) {
    timingLog("company_context_timeout_fallback", {
      company_name: lastCompany.company_name || "",
      ready_state: document.readyState,
      has_main: hasMainCompanyContainer(),
      has_company_dom: hasCompanyProfileDom(),
      has_stable_company_dom: isStableCompanyProfileDom(
        lastCompany.company_name || "",
      ),
    });
    return lastCompany;
  }
  throw new Error(
    `Company page not ready for extraction. Last company_name: ${lastCompany?.company_name || getCompanyCandidateName() || ""}`,
  );
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
  return normalizeWhitespace(String(value || ""));
}

function looksLikeSenderName(value) {
  const text = (value || "").toString().trim();
  if (!text) return false;
  if (text.length < 2) return false;
  if (text.length > 80) return false;
  if (/^\d{1,2}:\d{2}$/.test(text)) return false;
  if (/^ver perfil/i.test(text)) return false;
  if (/enviou a seguinte mensagem|enviou as seguintes mensagens/i.test(text))
    return false;
  if (isUiNoiseLine(text)) return false;
  return true;
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
  debugLog("[LEF][chat] interop", {
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
  let headingLiCount = 0;
  let liWithHeadingAndEventCount = 0;
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
      headingLiCount += 1;
    }

    const eventEl = li.querySelector(".msg-s-event-listitem");
    if (headingEl && eventEl) {
      liWithHeadingAndEventCount += 1;
    }
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
      debugLog("[LEF][chat][extract] skip missing time", {
        liIndex,
        hasHeading: Boolean(currentHeadingText),
        hasEvent: true,
      });
      return;
    }

    const senderNameCandidates = [
      eventEl.querySelector(".msg-s-message-group__name"),
      eventEl.querySelector(
        "[data-control-name='view_profile'] .hoverable-link-text",
      ),
      eventEl.querySelector("a[href*='/in/'] .hoverable-link-text"),
      eventEl.querySelector("span[aria-hidden='true']"),
    ];
    let effectiveNameText = "";
    for (const el of senderNameCandidates) {
      const candidate = (el?.innerText || el?.textContent || "").trim();
      if (looksLikeSenderName(candidate)) {
        effectiveNameText = candidate;
        break;
      }
    }
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
      bodyEls = Array.from(
        eventEl.querySelectorAll(".msg-s-event-listitem__body"),
      );
    }
    bodyCount += bodyEls.length;

    if (!currentHeadingText) {
      skippedMissingHeading += bodyEls.length || 1;
      debugLog("[LEF][chat][extract] skip missing heading", {
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

      debugLog("[LEF][chat][extract] message captured", {
        liIndex,
        textLen: bodyText.length,
      });
    });
  });

  debugLog("[LEF][chat][extract] summary", {
    totalLiItems: items.length,
    eventCount,
    bodyCount,
    messagesProduced: messages.length,
    headingLiCount,
    liWithHeadingAndEventCount,
    skippedMissingHeading,
    skippedMissingTime,
    skippedEmptyBody,
    skippedMissingEvent,
    inheritedTimeCount,
    inheritedNameCount,
  });

  return {
    messages,
    meta: {
      totalLi: items.length,
      headingLiCount,
      liWithHeadingAndEventCount,
      extractedCount: messages.length,
      skippedNoHeadingCount: skippedMissingHeading,
      skippedNoTimeCount: skippedMissingTime,
      skippedNoBodyCount: skippedEmptyBody,
      inheritedTimeCount,
      inheritedNameCount,
    },
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

timingLog("content_script_loaded", { ready_state: document.readyState });
document.addEventListener("readystatechange", () => {
  timingLog("document_readystatechange", { ready_state: document.readyState });
  if (
    !mainContainerReadyLogged &&
    document.readyState === "complete" &&
    hasMainCompanyContainer()
  ) {
    mainContainerReadyLogged = true;
    timingLog("main_container_available", { ready_state: document.readyState });
  }
});
window.addEventListener("load", () => {
  timingLog("window_load", { ready_state: document.readyState });
  if (!mainContainerReadyLogged && hasMainCompanyContainer()) {
    mainContainerReadyLogged = true;
    timingLog("main_container_available", { ready_state: document.readyState });
  }
});
if (hasMainCompanyContainer()) {
  mainContainerReadyLogged = true;
  timingLog("main_container_available", { ready_state: document.readyState });
}
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "EXTRACT_PROFILE_CONTEXT") {
    (async () => {
      try {
        timingLog("extraction_requested", {
          page_type: detectLinkedInPageType().page_type,
          is_company_profile: isCompanyProfileUrl(),
          ready_state: document.readyState,
          has_main: hasMainCompanyContainer(),
        });
        if (detectLinkedInPageType().page_type !== "person") {
          sendResponse({
            ok: false,
            error: {
              code: "WRONG_EXTRACTOR",
              message: "Use EXTRACT_COMPANY_CONTEXT for company pages.",
            },
          });
          return;
        }
        await waitForPersonProfileDom();
        if (!isPersonPageReadyForExtraction()) {
          sendResponse({
            ok: false,
            error: {
              code: "STALE_DOM",
              message: "Person page DOM is not ready.",
            },
          });
          return;
        }
        timingLog("extraction_running", {
          is_company_profile: isCompanyProfileUrl(),
        });
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
    })();
    return true;
  }

  if (msg?.type === "EXTRACT_COMPANY_CONTEXT") {
    (async () => {
      try {
        timingLog("company_context_extraction_requested", {
          page_type: detectLinkedInPageType().page_type,
          ready_state: document.readyState,
          has_main: hasMainCompanyContainer(),
        });
        if (detectLinkedInPageType().page_type !== "company") {
          sendResponse({
            ok: false,
            error: {
              code: "WRONG_EXTRACTOR",
              message: "Use EXTRACT_PROFILE_CONTEXT for person pages.",
            },
          });
          return;
        }
        const company = await extractFreshCompanyContext();
        console.log("[LEF][company ai] scraped company context", company);
        sendResponse({ ok: true, company });
      } catch (e) {
        sendResponse({
          ok: false,
          error: {
            code: "COMPANY_EXTRACTION_FAILED",
            message: e instanceof Error ? e.message : String(e || "unknown"),
          },
        });
      }
    })();
    return true;
  }

  if (msg?.type === "EXTRACT_CHAT_HISTORY") {
    const reqId = String(msg?.reqId || "no_req_id");
    debugLog("[LEF][chat] handler entry", { reqId, href: location.href });
    try {
      const result = extractChatHistoryFromInteropShadow();
      if (result?.noMessageBox) {
        debugLog("[LEF][chat] no message box", {
          reqId,
          href: location.href,
          selectorsUsed: result?.meta?.selectorsUsed || [],
          domNodesFound: result?.meta?.domNodesFound || 0,
          messagesProduced: 0,
          traversalOrder: "top-to-bottom",
          reversed: false,
        });
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
      debugLog("[LEF][chat] extracted messages", {
        reqId,
        href: location.href,
        selectorsUsed: diag?.selectorsUsed || [],
        domNodesFound: diag?.domNodesFound || 0,
        messagesProduced: Array.isArray(messages) ? messages.length : 0,
        headingCount: diag?.headingCount || 0,
        traversalOrder: diag?.traversalOrder || "top-to-bottom",
        reversed: Boolean(diag?.reversedOrder),
      });
      const meta = {
        reqId,
        ...(result?.meta || {}),
        extractedCount:
          result?.meta?.extractedCount ??
          (Array.isArray(messages) ? messages.length : 0),
      };
      debugLog("[LEF][chat] handler success", meta);
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
