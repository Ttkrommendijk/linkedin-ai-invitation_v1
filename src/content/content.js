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

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "EXTRACT_PROFILE_CONTEXT") {
    try {
      const profile = extractProfile();
      sendResponse({ ok: true, profile });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
    return true;
  }

  return false;
});
