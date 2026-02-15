function cleanText(s) {
  return (s || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickBestCompanyName(s) {
  const t = cleanText(s);
  if (!t) return "";

  // remove common noise
  const cleaned = t
    .replace(/\b(tempo integral|part-time|autônomo|contrato|estágio|freelance)\b/gi, "")
    .replace(/\s+[·•|-]\s+.*$/, "") // cut after separators
    .trim();

  // avoid returning generic words
  const bad = new Set([
    "linkedin",
    "confira",
    "ver perfil",
    "ver mais",
    "empresa",
    "company",
    "experiência",
    "experience"
  ]);

  if (!cleaned) return "";
  if (bad.has(cleaned.toLowerCase())) return "";
  if (cleaned.length < 2) return "";

  return cleaned;
}

function textFromEls(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const t = pickBestCompanyName(el?.innerText || el?.textContent || "");
    if (t) return t;
  }
  return "";
}

function getCompanyFromLdJson() {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  for (const s of scripts) {
    try {
      const json = JSON.parse(s.textContent || "{}");

      // LinkedIn often uses a graph/array format
      const items = Array.isArray(json) ? json : (json["@graph"] ? json["@graph"] : [json]);

      for (const item of items) {
        const worksFor = item?.worksFor;
        if (worksFor) {
          if (typeof worksFor === "string") {
            const t = pickBestCompanyName(worksFor);
            if (t) return t;
          }
          if (Array.isArray(worksFor)) {
            for (const wf of worksFor) {
              const t = pickBestCompanyName(wf?.name || wf);
              if (t) return t;
            }
          } else {
            const t = pickBestCompanyName(worksFor?.name);
            if (t) return t;
          }
        }
      }
    } catch (_e) {
      // ignore parse errors
    }
  }
  return "";
}


function nameFromTitle() {
  // Often: "Sérgio Ribeiro | LinkedIn"
  const t = cleanText(document.title);
  if (!t) return "";
  return cleanText(t.split("|")[0]);
}

function extractFirstName(fullName) {
  const name = cleanText(fullName);
  if (!name) return "";

  // Remove common prefixes to avoid "Dr.", "Sr.", etc. being used as first name
  const prefixes = ["dr.", "dr", "dra.", "dra", "sr.", "sr", "sra.", "sra", "mr.", "mr", "mrs.", "mrs", "ms.", "ms"];
  const parts = name.split(" ").filter(Boolean);

  while (parts.length && prefixes.includes(parts[0].toLowerCase())) {
    parts.shift();
  }

  // If still empty, return ""
  if (!parts.length) return "";

  // First token as first name
  return parts[0];
}

function extractCompany(truncatedMain) {
  // A) DOM: top card company link / current position area (best signal)
  const domCompany = textFromEls([
    // current role/company often appears as a link in the top card
    'main a[href*="/company/"] span[aria-hidden="true"]',
    'main a[href*="/company/"]',

    // some layouts show a "current company" line near the header area
    'main .pv-text-details__right-panel span[aria-hidden="true"]',
    'main .pv-text-details__right-panel span',

    // alternative top card containers
    'main .pv-top-card--list-bullet li span[aria-hidden="true"]',
    'main .pv-top-card--list li span[aria-hidden="true"]'
  ]);
  if (domCompany) return domCompany;

  // B) LD+JSON structured data (surprisingly solid when present)
  const ld = getCompanyFromLdJson();
  if (ld) return ld;

  // C) DOM: first experience item company (fallback)
  // Tries to grab the company line within the Experience section
  const exp = (() => {
    const expSection =
      document.querySelector('section[id*="experience"]') ||
      Array.from(document.querySelectorAll("section")).find(s =>
        /experi[eê]ncia|experience/i.test(cleanText(s.innerText).slice(0, 80))
      );

    if (!expSection) return "";

    // Within experience cards, company is commonly the "secondary" line
    const candidateEls = expSection.querySelectorAll(
      'a[href*="/company/"] span[aria-hidden="true"], a[href*="/company/"], span.t-14.t-normal'
    );

    for (const el of candidateEls) {
      const t = pickBestCompanyName(el?.innerText || el?.textContent || "");
      if (t) return t;
    }
    return "";
  })();
  if (exp) return exp;

  // D) Raw text regex (last resort)
  const t = cleanText(truncatedMain);

  let m = t.match(/@\s*([A-ZÀ-ÖØ-Ý][\wÀ-ÖØ-öø-ÿ.&\- ]{2,60})/);
  if (m?.[1]) return pickBestCompanyName(m[1]);

  m = t.match(/\bExperiência\b[^]*?\n?[^\n]{0,120}\s+([A-ZÀ-ÖØ-Ý][\wÀ-ÖØ-öø-ÿ.&\- ]{2,60})\s*·/i);
  if (m?.[1]) return pickBestCompanyName(m[1]);

  return "";
}




function extractProfile() {
  const url = location.href;

  // Name
  let name =
    cleanText(document.querySelector("h1")?.innerText) ||
    cleanText(document.querySelector('[data-anonymize="person-name"]')?.innerText);

  if (!name) {
    name = nameFromTitle();
  }

  const first_name = extractFirstName(name);

  // Headline (best-effort)
  let headline =
    cleanText(document.querySelector("main .text-body-medium")?.innerText) ||
    cleanText(document.querySelector('[data-anonymize="headline"]')?.innerText);

  if (!headline) {
    const candidates = Array.from(document.querySelectorAll("main .text-body-medium"))
      .map(el => cleanText(el.innerText))
      .filter(Boolean);

    headline = candidates.find(t => t.length > 10) || "";
  }

  // Main page visible text (limit size)
  const main = cleanText(document.querySelector("main")?.innerText || "");
  const truncatedMain = main.slice(0, 6000);

 //Company
const company = extractCompany(truncatedMain);


return {
    url,
    name,
    first_name,
    headline,
    company,
    raw: truncatedMain
  };
}


chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "EXTRACT_PROFILE_CONTEXT") {
    try {
      const profile = extractProfile();

      console.log("EXTRACTED PROFILE:", {
        headline: profile.headline,
        raw_preview: (profile.raw || "").slice(0, 1200)
      });

      sendResponse({ ok: true, profile });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
    return true; // async response allowed
  }

  return false;
});

