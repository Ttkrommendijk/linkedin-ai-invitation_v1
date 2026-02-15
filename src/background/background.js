function characterLimitInstruction(maxChars) {
  return `Write a LinkedIn connection invitation in Portuguese with MAX ${maxChars} characters (including spaces). STRICT.

Primary objective: maximize connection acceptance rate (not replies).
Output must be a single paragraph (no line breaks). Aim for 220â€“280 characters.

MANDATORY STRUCTURE:
1. Start the message with OlÃ¡ {first name from profile}. If first name is missing/unknown, start with "OlÃ¡," (no name).
2. Brief factual reference from the profile.
3. Clear strategic linkage to my own atuaÃ§Ã£o (shared domain or complexity).
4. Short, low-friction closing sentence ONLY about connecting.

Tone: peer-level, neutral, specific, not salesy.
Avoid praise, flattery, or emotional adjectives.
Use profile-observation verbs only (e.g., "vi no seu perfil", "notei", "observei").
Never invent facts.

CLOSING RULES (STRICT):
- Do NOT end with a question.
- Do NOT mention meetings, calls, troca de experiÃªncias, agenda, conversar, apresentar.
- Closing must only express openness to connect.
Examples:
"Seria um prazer conectar."
"Seria Ã³timo adicionar vocÃª Ã  minha rede."
"Vamos nos conectar."

Do NOT ask deep conceptual or technical questions.
Do NOT introduce new themes in the final sentence.

No emojis. No bullet points.`;
}

function normalizeProfileField(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.map(normalizeProfileField).filter(Boolean).join(" | ").trim();
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

function sanitizeProfileExcerpt(text, maxChars = 800) {
  if (!text) return "";
  let cleaned = String(text);

  // Remove emails.
  cleaned = cleaned.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    "[redacted-email]",
  );

  // Remove phone-like patterns.
  cleaned = cleaned.replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[redacted-phone]");

  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (cleaned.length > maxChars) {
    cleaned = cleaned.slice(0, maxChars).trim();
  }
  return cleaned;
}

function buildUserInput({ positioning, focus, profile, strategyCore }) {
  const fullName =
    normalizeProfileField(profile?.full_name) ||
    normalizeProfileField(profile?.name) ||
    normalizeProfileField(profile?.fullName);

  const headline = normalizeProfileField(profile?.headline);

  const company =
    normalizeProfileField(profile?.company) ||
    normalizeProfileField(profile?.current_company) ||
    normalizeProfileField(profile?.company_name);

  const location = normalizeProfileField(profile?.location);

  const about =
    normalizeProfileField(profile?.about) ||
    normalizeProfileField(profile?.summary);

  const recentExperience =
    normalizeProfileField(profile?.recent_experience) ||
    normalizeProfileField(profile?.recentExperience) ||
    normalizeProfileField(profile?.experience);

  const profileUrl =
    normalizeProfileField(profile?.profile_url) ||
    normalizeProfileField(profile?.url) ||
    normalizeProfileField(profile?.linkedin_url);

  const missingKeyFields = !headline && !about;
  const fallbackExcerpt = missingKeyFields
    ? sanitizeProfileExcerpt(profile?.raw, 800)
    : "";

  return `
strategy_core:
${strategyCore || "(none)"}

my_positioning:
${positioning || "(none)"}

profile_focus (optional):
${focus || "(none)"}

profile_context:
- profile_url: ${profileUrl || "(unknown)"}
- full_name: ${fullName || "(unknown)"}
- headline: ${headline || "(unknown)"}
- company: ${company || "(unknown)"}
- location: ${location || "(unknown)"}
- about: ${about || "(unknown)"}
- recent_experience: ${recentExperience || "(unknown)"}${
    fallbackExcerpt
      ? `

profile_excerpt_fallback (sanitized, max 800 chars):
${fallbackExcerpt}`
      : ""
  }
`;
}

async function callOpenAIResponses({
  apiKey,
  model,
  positioning,
  focus,
  strategyCore,
  profile,
}) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      // token cap is now just a safety net; chars are enforced below
      max_output_tokens: 120,
      input: [
        {
          role: "system",
          content: [
            { type: "input_text", text: characterLimitInstruction(300) },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildUserInput({
                positioning,
                focus,
                profile,
                strategyCore,
              }),
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${txt || res.statusText}`);
  }

  const data = await res.json();

  const text =
    (data.output_text || "").trim() ||
    (
      data.output?.[0]?.content?.find((c) => c.type === "output_text")?.text ||
      ""
    ).trim();

  // HARD enforce 300 characters
  const MAX_CHARS = 300;

  let finalText = (text || "").trim();

  // normalize whitespace so LinkedIn paste wonâ€™t expand length
  finalText = finalText
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (finalText.length > MAX_CHARS) {
    finalText = finalText.slice(0, MAX_CHARS - 3).trim() + "...";
  }

  return finalText;
}

async function getSupabaseConfig() {
  const [{ webhookSecret }, { webhookBaseUrl }] = await Promise.all([
    chrome.storage.local.get(["webhookSecret"]),
    chrome.storage.sync.get(["webhookBaseUrl"]),
  ]);

  if (!webhookBaseUrl || !webhookSecret) {
    throw new Error(
      "Missing config. Set webhookBaseUrl = Supabase URL and webhookSecret = Supabase publishable key.",
    );
  }

  return {
    supabaseUrl: webhookBaseUrl.replace(/\/+$/, ""),
    supabaseAnonKey: webhookSecret,
  };
}

async function supabaseUpsertInvitation(row) {
  const { supabaseUrl, supabaseAnonKey } = await getSupabaseConfig();

  const url = `${supabaseUrl}/rest/v1/linkedin_invitations?on_conflict=linkedin_url`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Supabase upsert failed ${res.status}: ${txt}`);
  }
}

async function supabaseMarkStatus({ linkedin_url, status }) {
  const { supabaseUrl, supabaseAnonKey } = await getSupabaseConfig();

  const patch = { status };
  const nowIso = new Date().toISOString();
  if (status === "invited") patch.invited_at = nowIso;
  if (status === "accepted") patch.accepted_at = nowIso;

  const url = `${supabaseUrl}/rest/v1/linkedin_invitations?linkedin_url=eq.${encodeURIComponent(linkedin_url)}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Supabase update failed ${res.status}: ${txt}`);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // generate invite (existing handler)
  console.log("onMessage:", msg?.type);
  if (msg?.type === "GENERATE_INVITE") {
    (async () => {
      try {
        const message = await callOpenAIResponses(msg.payload);
        sendResponse({ ok: true, message });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true; // async
  }

  // db: upsert on generate
  if (msg?.type === "DB_UPSERT_GENERATED") {
    (async () => {
      try {
        await supabaseUpsertInvitation(msg.payload);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg?.type === "DB_MARK_STATUS") {
    (async () => {
      try {
        await supabaseMarkStatus(msg.payload);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  // default
  sendResponse({ ok: false, error: "unknown_message_type" });
  return false;
});
