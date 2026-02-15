function characterLimitInstruction(maxChars) {
  return `Write a LinkedIn connection invitation in Portuguese with MAX ${maxChars} characters (including spaces). STRICT.

Primary objective: maximize connection acceptance rate (not replies).
Output must be a single paragraph (no line breaks). Aim for 220–280 characters.

MANDATORY STRUCTURE:
1. Start the message with Olá {first name from profile}. If first name is missing/unknown, start with "Olá," (no name).
2. Brief factual reference from the profile.
3. Clear strategic linkage to my own atuação (shared domain or complexity).
4. Short, low-friction closing sentence ONLY about connecting.

Tone: peer-level, neutral, specific, not salesy.
Avoid praise, flattery, or emotional adjectives.
Use profile-observation verbs only (e.g., "vi no seu perfil", "notei", "observei").
Never invent facts.

CLOSING RULES (STRICT):
- Do NOT end with a question.
- Do NOT mention meetings, calls, troca de experiências, agenda, conversar, apresentar.
- Closing must only express openness to connect.
Examples:
"Seria um prazer conectar."
"Seria ótimo adicionar você à minha rede."
"Vamos nos conectar."

Do NOT ask deep conceptual or technical questions.
Do NOT introduce new themes in the final sentence.

No emojis. No bullet points.`;
}

function buildUserInput({ positioning, focus, profile, strategyCore }) {
  return `
strategy_core:
${strategyCore || "(none)"}

my_positioning:
${positioning || "(none)"}

profile_focus (optional):
${focus || "(none)"}

profile_context:
- url: ${profile.url}
- name: ${profile.name || "(unknown)"}
- headline: ${profile.headline || "(unknown)"}
- visible_text: ${profile.raw}
`;
}

async function callOpenAIResponses({ apiKey, model, positioning, focus, strategyCore, profile }) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      // token cap is now just a safety net; chars are enforced below
      max_output_tokens: 120,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: characterLimitInstruction(300) }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: buildUserInput({ positioning, focus, profile, strategyCore }) }]
        }
      ]
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${txt || res.statusText}`);
  }

  const data = await res.json();

  const text =
    (data.output_text || "").trim() ||
    (data.output?.[0]?.content?.find(c => c.type === "output_text")?.text || "").trim();

  // HARD enforce 300 characters
    const MAX_CHARS = 300;

    let finalText = (text || "").trim();

    // normalize whitespace so LinkedIn paste won’t expand length
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
    chrome.storage.sync.get(["webhookBaseUrl"])
  ]);

  if (!webhookBaseUrl || !webhookSecret) {
    throw new Error("Missing config. Set webhookBaseUrl = Supabase URL and webhookSecret = Supabase publishable key.");
  }

  return {
    supabaseUrl: webhookBaseUrl.replace(/\/+$/, ""),
    supabaseAnonKey: webhookSecret
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
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(row)
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
      Prefer: "return=minimal"
    },
    body: JSON.stringify(patch)
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Supabase update failed ${res.status}: ${txt}`);
  }
}



chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // generate invite (existing handler)
   console.log("onMessage:", msg?.type, msg);
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


