const DEBUG = false;

function debug(...args) {
  if (DEBUG) console.log(...args);
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

function createProviderHttpError(provider, status, body) {
  const providerLabel = provider === "openai" ? "OpenAI" : "Supabase";
  const err = new Error(`${providerLabel} request failed (${status}).`);
  err.details = {
    provider,
    http_status: status,
    body: String(body || "").slice(0, 1000),
  };
  return err;
}

async function fetchWithTimeout(
  url,
  options,
  timeoutMs = 15000,
  label = "Request",
) {
  const controller = new AbortController();
  const externalSignal = options?.signal;
  let timeoutId;

  const forwardExternalAbort = () => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      forwardExternalAbort();
    } else {
      externalSignal.addEventListener("abort", forwardExternalAbort, {
        once: true,
      });
    }
  }

  timeoutId = setTimeout(() => {
    controller.abort("__timeout__");
  }, timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (
      controller.signal.aborted &&
      controller.signal.reason === "__timeout__"
    ) {
      throw new Error(`${label} timed out.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", forwardExternalAbort);
    }
  }
}

async function fetchOpenAIWithRetry(url, options) {
  let attempt = 0;
  while (attempt < 2) {
    try {
      const res = await fetchWithTimeout(url, options, 15000, "OpenAI request");
      if (res.status >= 500 && res.status <= 599 && attempt === 0) {
        attempt += 1;
        continue;
      }
      return res;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e || "");
      const isTimeout = message === "OpenAI request timed out.";
      const isAbort = e && typeof e === "object" && e.name === "AbortError";
      const isNetwork =
        e instanceof TypeError || /failed to fetch|network/i.test(message);

      if (!isTimeout && !isAbort && isNetwork && attempt === 0) {
        attempt += 1;
        continue;
      }
      throw e;
    }
  }
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

function characterLimitInstruction(maxChars) {
  return `YOU MUST PRODUCE THREE SEPARATE OUTPUTS:
1) invite_text (the LinkedIn invitation)
2) company (extracted company name)
3) headline (job-description style headline)

IMPORTANT SEPARATION OF RULES:
- The invitation rules apply ONLY to invite_text.
- The extraction rules apply ONLY to company and headline.
- Do NOT leave company/headline empty just because invite_text has restrictions.
- company/headline must be derived only from profile_context and profile_excerpt_fallback, but they are NOT limited by invite_text constraints (e.g., questions/closing).

invite_text rules (STRICT):
Write a LinkedIn connection invitation in Portuguese with MAX ${maxChars} characters (including spaces). STRICT.

Primary objective: maximize connection acceptance rate (not replies).
invite_text must be a single paragraph (no line breaks). Aim for 220-280 characters.

MANDATORY STRUCTURE FOR invite_text:
1. Start with "Olá {first name from profile}". If first name is missing/unknown, start with "Olá," (no name).
2. Brief factual reference from the profile.
3. CAUSAL LINKAGE sentence that connects their profile to my own atuação using a cause-and-effect connector.
   - Must use a connector like: "e como também atuo...", "e como eu também atuo...", "por eu também atuar...", "como também atuo...", "por também atuar..."
   - The linkage MUST clearly express: because of (2) + because I also do (3) => it makes sense/it's interesting to connect.
4. Close with a short, low-friction sentence ONLY about connecting OR integrate the closing into the causal linkage (single-sentence close allowed).

STYLE TARGET (VERY IMPORTANT):
Prefer a single flowing sentence where possible, using commas to connect clauses, similar to:
"Olá {nome}, notei ... , e como também atuo ... achei interessante conectar."
This is allowed even if it merges steps (2)-(4), as long as all intents are present.

Tone: peer-level, neutral, specific, not salesy.
Avoid praise, flattery, or emotional adjectives.
Use profile-observation verbs only (e.g., "vi no seu perfil", "notei", "observei").
Never invent facts.

CLOSING RULES (STRICT):
- Do NOT end with a question.
- Do NOT mention meetings, calls, troca de experiências, agenda, conversar, apresentar.
- Closing must only express openness to connect, or the implicit "achei interessante conectar" style.
Examples:
"Seria um prazer conectar."
"Seria ótimo adicionar você à minha rede."
"Vamos nos conectar."
"Achei interessante conectar."
"Faz sentido a gente se conectar."

Do NOT ask deep conceptual or technical questions.
Do NOT introduce new themes in the final sentence.
No emojis. No bullet points.

company extraction rules (STRICT):
- Goal: return ONLY the company/organization name (no role, no extra words).
- Prefer profile_context.company if present and non-empty.
- Otherwise derive from profile_excerpt_fallback using common LinkedIn patterns:
  a) "<cargo> no <empresa>" => company = <empresa>
  b) "<cargo> na <empresa>" => company = <empresa>
  c) "<nome> • <cargo> | <empresa>" => company = <empresa> (the organization immediately after "|")
  d) If multiple orgs appear, prefer the one tied to the current role/title line (top-card style).
- Remove trailing location, separators, follower counts, and UI noise.
- If not confidently identifiable, return "".

headline rules (STRICT):
- Goal: return a job-description style headline for the person (role-focused), not a sales pitch.
- Prefer profile_context.headline if present and non-empty; clean it (remove location/noise).
- Otherwise derive from profile_excerpt_fallback:
  - Extract the current role/title from the top-card style line.
  - If company is known, format as: "<cargo> na/no <company>".
  - Keep it concise (typically 50-120 chars).
  - Do NOT include location, follower counts, “mais de 500 conexões”, or other UI noise.
- If not confidently identifiable, return "".

OUTPUT FORMAT (STRICT):
Return valid JSON only (no markdown, no extra text) with exactly these keys:
{
  "invite_text": string,
  "company": string,
  "headline": string
}
- company/headline must be "" when unknown.
- Never invent facts for company/headline; derive only from profile_context and profile_excerpt_fallback.`;
}

function firstMessageInstruction(maxChars, language = "auto") {
  const langRule =
    language === "auto"
      ? "the dominant language of the provided profile_context and profile_excerpt_fallback"
      : language;

  return `Write a first LinkedIn message in ${langRule} after connection acceptance.

Language rules:
- If language is "auto", detect the dominant language of profile_context and profile_excerpt_fallback and write in that language.
- Do not default to English unless the context is English.
- Do not mix languages.

Constraints:
- Maximum ${maxChars} characters.
- Maximum 2 short paragraphs.
- Maximum 1 light question.
- No emojis, no hashtags, no bullet points.
- Tone must be peer-level, neutral, specific, non-salesy.
- Do not pitch services.
- Objective: start a light conversation; meeting can only be implied softly.
- Never invent facts. Use only profile_context and profile_excerpt_fallback.

Output must be plain text only.`;
}

function followupMessageInstruction(language = "auto") {
  return `Write a reply message for an ongoing LinkedIn conversation.

Language rules:
- If a specific language is provided, respond in that language.
- If language is set to "auto", detect the dominant language used in the conversation context and respond in that same language.
- Never default to English unless the conversation itself is in English.

Tone and style:
- Peer-level, neutral, specific, non-salesy.
- Keep it concise (1–2 short paragraphs).
- Maintain the natural tone of the existing conversation.
- Do not switch language mid-response.

Constraints:
- Use only the provided context.
- Do not invent facts.
- Focus strictly on the user's objective.

Output plain text only.`;
}

function parseInviteGenerationJson(rawText) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (_e) {
    const err = new Error("Model returned invalid JSON.");
    err.details = { reason: "invalid_json" };
    throw err;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    const err = new Error("Model returned invalid JSON object.");
    err.details = { reason: "invalid_json" };
    throw err;
  }

  const allowedKeys = new Set(["invite_text", "company", "headline"]);
  const keys = Object.keys(parsed);
  const hasInvalidKeys = keys.some((k) => !allowedKeys.has(k));
  const hasRequiredKeys =
    "invite_text" in parsed && "company" in parsed && "headline" in parsed;

  if (hasInvalidKeys || !hasRequiredKeys) {
    const err = new Error("Model returned unexpected JSON schema.");
    err.details = { reason: "invalid_json" };
    throw err;
  }

  return {
    invite_text: clampText(normalizeProfileField(parsed.invite_text), 300),
    company: normalizeProfileField(parsed.company),
    headline: normalizeProfileField(parsed.headline),
  };
}

function extractRawModelText(data) {
  const direct = normalizeProfileField(data?.output_text || "");
  if (direct) return direct;

  const contentText =
    data?.output?.[0]?.content?.find((c) => c.type === "output_text")?.text ||
    data?.output?.[0]?.content?.find((c) => c.type === "text")?.text ||
    "";
  return normalizeProfileField(contentText);
}

function parseInviteGenerationFromResponseData(data) {
  // Preferred path for structured outputs.
  if (data?.output_parsed && typeof data.output_parsed === "object") {
    const parsed = {
      invite_text: data.output_parsed.invite_text,
      company: data.output_parsed.company,
      headline: data.output_parsed.headline,
    };
    return {
      parsed: parseInviteGenerationJson(JSON.stringify(parsed)),
      rawText: extractRawModelText(data),
      usedOutputParsed: true,
    };
  }

  const rawText = extractRawModelText(data);
  if (!rawText) {
    const err = new Error("Model returned empty output.");
    err.details = { reason: "empty_output" };
    throw err;
  }

  try {
    return {
      parsed: parseInviteGenerationJson(rawText),
      rawText,
      usedOutputParsed: false,
    };
  } catch (_directErr) {
    // Fallback: parse the first JSON object slice if model returned extra text.
    const firstBrace = rawText.indexOf("{");
    const lastBrace = rawText.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const jsonSlice = rawText.slice(firstBrace, lastBrace + 1);
      return {
        parsed: parseInviteGenerationJson(jsonSlice),
        rawText,
        usedOutputParsed: false,
      };
    }
    throw _directErr;
  }
}

function profileContextBlock(profile) {
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
  const missingKeyFields = !company || !headline || !about;
  const fallbackExcerpt = missingKeyFields
    ? normalizeProfileField(profile?.excerpt_fallback)
    : "";

  return `
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
  }`;
}

function buildInviteUserInput({ positioning, focus, profile, strategyCore }) {
  return `
strategy_core:
${strategyCore || "(none)"}

my_positioning:
${positioning || "(none)"}

profile_focus (optional):
${focus || "(none)"}
${profileContextBlock(profile)}
`;
}

function buildFirstMessageUserInput({ prompt, profile }) {
  return `
message_prompt:
${prompt || "(none)"}
${profileContextBlock(profile)}
`;
}

function buildFollowupUserInput({
  objective,
  strategy,
  includeStrategy,
  contextLast10,
  profileContext,
}) {
  const contextBlock = (Array.isArray(contextLast10) ? contextLast10 : [])
    .slice(-10)
    .map((m) => {
      const direction =
        m?.direction === "them"
          ? "them"
          : m?.direction === "me"
            ? "me"
            : "unknown";
      const text = normalizeProfileField(m?.text);
      return text ? `- ${direction}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");

  return `
Objective:
${objective || "(none)"}

${
  includeStrategy && strategy
    ? `Strategy:
${strategy}`
    : ""
}

Context (last 10 messages, chronological):
${contextBlock || "(none)"}

Instruction:
${
  includeStrategy && strategy
    ? "Respond with this objective using this context (last 10 messages) and respecting this strategy. Output ONLY the message text."
    : "Respond with this objective using this context (last 10 messages). Output ONLY the message text."
}
${profileContextBlock(profileContext || {})}
`;
}

async function callOpenAIInviteGeneration({
  apiKey,
  model,
  positioning,
  focus,
  strategyCore,
  profile,
}) {
  const res = await fetchOpenAIWithRetry(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_output_tokens: 120,
        text: {
          format: {
            type: "json_schema",
            name: "invite_generation",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                invite_text: { type: "string" },
                company: { type: "string" },
                headline: { type: "string" },
              },
              required: ["invite_text", "company", "headline"],
            },
          },
        },
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
                text: buildInviteUserInput({
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
    },
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw createProviderHttpError("openai", res.status, txt || res.statusText);
  }

  debug("GENERATE_INVITE profile summary:", {
    url:
      normalizeProfileField(profile?.url) ||
      normalizeProfileField(profile?.profile_url) ||
      normalizeProfileField(profile?.linkedin_url),
    name:
      normalizeProfileField(profile?.name) ||
      normalizeProfileField(profile?.full_name),
    first_name: normalizeProfileField(profile?.first_name),
    company: normalizeProfileField(profile?.company),
    headline: normalizeProfileField(profile?.headline),
    excerpt_fallback_length: normalizeProfileField(profile?.excerpt_fallback)
      .length,
  });

  const data = await res.json();
  const rawModelTextLength = extractRawModelText(data).length;
  debug("GENERATE_INVITE raw model text length:", rawModelTextLength);

  let parsedPayload;
  let parseSucceeded = false;
  try {
    const result = parseInviteGenerationFromResponseData(data);
    parsedPayload = result.parsed;
    parseSucceeded = true;
    debug("GENERATE_INVITE parse succeeded:", {
      used_output_parsed: result.usedOutputParsed,
      keys: Object.keys(parsedPayload || {}),
      company: parsedPayload.company,
      headline: parsedPayload.headline,
    });
  } catch (e) {
    debug("GENERATE_INVITE parse succeeded:", false);
    throw e;
  }

  debug("GENERATE_INVITE parse succeeded:", parseSucceeded);
  return parsedPayload;
}

async function callOpenAIFirstMessage({
  apiKey,
  model,
  prompt,
  profile,
  language,
}) {
  const res = await fetchOpenAIWithRetry(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_output_tokens: 220,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: firstMessageInstruction(600, language || "Portuguese"),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildFirstMessageUserInput({ prompt, profile }),
              },
            ],
          },
        ],
      }),
    },
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw createProviderHttpError("openai", res.status, txt || res.statusText);
  }

  const data = await res.json();
  const text =
    (data.output_text || "").trim() ||
    (
      data.output?.[0]?.content?.find((c) => c.type === "output_text")?.text ||
      ""
    ).trim();

  return clampText(text, 600);
}

async function callOpenAIFollowupMessage({
  apiKey,
  model,
  objective,
  strategy,
  includeStrategy,
  contextLast10,
  profileContext,
  language,
}) {
  const res = await fetchOpenAIWithRetry(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_output_tokens: 260,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: followupMessageInstruction(language || "Portuguese"),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildFollowupUserInput({
                  objective,
                  strategy,
                  includeStrategy,
                  contextLast10,
                  profileContext,
                }),
              },
            ],
          },
        ],
      }),
    },
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw createProviderHttpError("openai", res.status, txt || res.statusText);
  }

  const data = await res.json();
  const text =
    (data.output_text || "").trim() ||
    (
      data.output?.[0]?.content?.find((c) => c.type === "output_text")?.text ||
      ""
    ).trim();

  return clampText(text, 1000);
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

  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
    },
    15000,
    "Supabase request",
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw createProviderHttpError("supabase", res.status, txt);
  }
}

async function supabaseUpdateFirstMessage({
  linkedin_url,
  first_message,
  first_message_generated_at,
}) {
  const { supabaseUrl, supabaseAnonKey } = await getSupabaseConfig();
  const url = `${supabaseUrl}/rest/v1/linkedin_invitations?linkedin_url=eq.${encodeURIComponent(linkedin_url)}`;
  const patch = {
    first_message,
    first_message_generated_at,
  };

  const res = await fetchWithTimeout(
    url,
    {
      method: "PATCH",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
    },
    15000,
    "Supabase request",
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw createProviderHttpError("supabase", res.status, txt);
  }
}

async function supabaseMarkStatus({ linkedin_url, status }) {
  const { supabaseUrl, supabaseAnonKey } = await getSupabaseConfig();

  const patch = { status };
  const nowIso = new Date().toISOString();
  if (status === "invited") patch.invited_at = nowIso;
  if (status === "accepted") patch.accepted_at = nowIso;
  if (status === "first message sent") patch.first_message_sent_at = nowIso;

  const url = `${supabaseUrl}/rest/v1/linkedin_invitations?linkedin_url=eq.${encodeURIComponent(linkedin_url)}`;

  const res = await fetchWithTimeout(
    url,
    {
      method: "PATCH",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
    },
    15000,
    "Supabase request",
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw createProviderHttpError("supabase", res.status, txt);
  }
}

async function supabaseGetInvitationByLinkedinUrl(linkedin_url) {
  const { supabaseUrl, supabaseAnonKey } = await getSupabaseConfig();
  const url = `${supabaseUrl}/rest/v1/linkedin_invitations?linkedin_url=eq.${encodeURIComponent(linkedin_url)}&select=linkedin_url,status,message,generated_at,invited_at,accepted_at,first_message,first_message_generated_at,first_message_sent_at,company,headline,full_name,focus,positioning`;

  const res = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "count=exact",
      },
    },
    15000,
    "Supabase request",
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw createProviderHttpError("supabase", res.status, txt);
  }

  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0] || null;
}

function toOverviewInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function toOverviewSortDir(value) {
  return String(value || "").toLowerCase() === "asc" ? "asc" : "desc";
}

function toOverviewSortField(value) {
  const allowed = new Set([
    "name",
    "company",
    "status",
    "most_relevant_date",
    "campaign",
    "archived",
  ]);
  const field = String(value || "");
  return allowed.has(field) ? field : "most_relevant_date";
}

async function supabaseListInvitationsOverview({
  page,
  pageSize,
  sortField,
  sortDir,
  filters,
  search,
}) {
  const { supabaseUrl, supabaseAnonKey } = await getSupabaseConfig();
  const safePage = toOverviewInt(page, 1);
  const safePageSize = toOverviewInt(pageSize, 25);
  const safeSortField = toOverviewSortField(sortField);
  const safeSortDir = toOverviewSortDir(sortDir);
  const offset = (safePage - 1) * safePageSize;

  const params = new URLSearchParams();
  params.set(
    "select",
    "url,name,company,most_relevant_date,archived,campaign,status",
  );
  params.set("limit", String(safePageSize));
  params.set("offset", String(offset));
  params.set("order", `${safeSortField}.${safeSortDir}`);

  if (filters?.campaign) {
    params.set("campaign", `eq.${String(filters.campaign).trim()}`);
  }
  if (filters?.archived === "0" || filters?.archived === "1") {
    params.set("archived", `eq.${filters.archived}`);
  }
  if (filters?.status) {
    params.set("status", `eq.${String(filters.status).trim()}`);
  }
  if (search && String(search).trim()) {
    const q = String(search).trim().replace(/\*/g, "");
    params.set("or", `(name.ilike.*${q}*,company.ilike.*${q}*)`);
  }

  const url = `${supabaseUrl}/rest/v1/vw_linkedin_invitations_overview?${params.toString()}`;
  const res = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "count=exact",
      },
    },
    15000,
    "Supabase request",
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw createProviderHttpError("supabase", res.status, txt);
  }

  const rows = await res.json();
  const contentRange = res.headers.get("content-range") || "";
  const totalMatch = contentRange.match(/\/(\d+|\*)$/);
  const total =
    totalMatch && totalMatch[1] !== "*" ? Number(totalMatch[1]) : null;

  return { rows: Array.isArray(rows) ? rows : [], total };
}

async function supabaseArchiveInvitation({ url }) {
  const { supabaseUrl, supabaseAnonKey } = await getSupabaseConfig();
  const endpoint = `${supabaseUrl}/rest/v1/linkedin_invitations?linkedin_url=eq.${encodeURIComponent(url)}`;

  const res = await fetchWithTimeout(
    endpoint,
    {
      method: "PATCH",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ archived: 1 }),
    },
    15000,
    "Supabase request",
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw createProviderHttpError("supabase", res.status, txt);
  }
}

const SIDEPANEL_REFRESH_DEBOUNCE_MS = 500;
const sidePanelRefreshTimers = new Map();
const lastSidePanelUrlByTab = new Map();

function isLinkedInProfileLikeUrl(url) {
  if (!url || typeof url !== "string") return false;
  return /^https:\/\/www\.linkedin\.com\/(in|company)\/[^/?#]+/i.test(url);
}

async function notifySidePanelRefresh({ tabId, url, reason }) {
  try {
    await chrome.runtime.sendMessage({
      type: "SIDEPANEL_REFRESH_CONTEXT",
      payload: { tabId, url, reason },
    });
  } catch (_e) {
    // Side panel may not be open; ignore.
  }
}

function scheduleSidePanelRefresh(tabId, url, reason) {
  if (!Number.isInteger(tabId) || !isLinkedInProfileLikeUrl(url)) return;

  const existingTimer = sidePanelRefreshTimers.get(tabId);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(async () => {
    sidePanelRefreshTimers.delete(tabId);
    const prevUrl = lastSidePanelUrlByTab.get(tabId);
    if (prevUrl === url) return;
    lastSidePanelUrlByTab.set(tabId, url);
    await notifySidePanelRefresh({ tabId, url, reason });
  }, SIDEPANEL_REFRESH_DEBOUNCE_MS);

  sidePanelRefreshTimers.set(tabId, timer);
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    scheduleSidePanelRefresh(tabId, tab?.url || "", "tabs.onActivated");
  } catch (_e) {
    // Ignore transient tab errors.
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (typeof changeInfo.url === "string") {
    scheduleSidePanelRefresh(tabId, changeInfo.url, "tabs.onUpdated.url");
    return;
  }
  if (changeInfo.status === "complete") {
    scheduleSidePanelRefresh(tabId, tab?.url || "", "tabs.onUpdated.complete");
  }
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  scheduleSidePanelRefresh(
    details.tabId,
    details.url,
    "webNavigation.onCommitted",
  );
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return;
  scheduleSidePanelRefresh(
    details.tabId,
    details.url,
    "webNavigation.onHistoryStateUpdated",
  );
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const timer = sidePanelRefreshTimers.get(tabId);
  if (timer) clearTimeout(timer);
  sidePanelRefreshTimers.delete(tabId);
  lastSidePanelUrlByTab.delete(tabId);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const req = msg || {};
  debug("onMessage:", msg?.type);
  console.log("[LEF][chat] received type", req.type);
  if (
    msg?.type === "GENERATE_FIRST_MESSAGE" ||
    msg?.type === "GENERATE_FOLLOWUP_MESSAGE"
  ) {
    console.log("[LEF][chat] LLM type", msg?.type);
  }

  if (msg?.type === "GENERATE_INVITE") {
    (async () => {
      try {
        const generation = await callOpenAIInviteGeneration(msg.payload);
        sendResponse({
          ok: true,
          invite_text: generation.invite_text,
          company: generation.company,
          headline: generation.headline,
        });
      } catch (e) {
        const details =
          e && typeof e === "object" && e.details ? e.details : undefined;
        sendResponse({
          ok: false,
          error: normalizeError(e, "GENERATION_FAILED", details),
        });
      }
    })();
    return true;
  }

  if (msg?.type === "GENERATE_FIRST_MESSAGE") {
    (async () => {
      try {
        const first_message = await callOpenAIFirstMessage(msg.payload);
        sendResponse({ ok: true, first_message });
      } catch (e) {
        sendResponse({
          ok: false,
          error: normalizeError(e, "GENERATION_FAILED"),
        });
      }
    })();
    return true;
  }

  if (req.type === "GENERATE_FOLLOWUP_MESSAGE") {
    (async () => {
      try {
        const text = await callOpenAIFollowupMessage(req.payload);
        sendResponse({ ok: true, text });
      } catch (e) {
        sendResponse({
          ok: false,
          error: normalizeError(e, "GENERATION_FAILED"),
        });
      }
    })();
    return true;
  }

  if (msg?.type === "DB_UPSERT_GENERATED") {
    (async () => {
      try {
        await supabaseUpsertInvitation(msg.payload);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({
          ok: false,
          error: normalizeError(e, "SUPABASE_UPSERT_FAILED"),
        });
      }
    })();
    return true;
  }

  if (msg?.type === "DB_UPDATE_FIRST_MESSAGE") {
    (async () => {
      try {
        await supabaseUpdateFirstMessage(msg.payload);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({
          ok: false,
          error: normalizeError(e, "SUPABASE_UPDATE_FAILED"),
        });
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
        sendResponse({
          ok: false,
          error: normalizeError(e, "SUPABASE_UPDATE_FAILED"),
        });
      }
    })();
    return true;
  }

  if (msg?.type === "DB_GET_INVITATION") {
    (async () => {
      try {
        const row = await supabaseGetInvitationByLinkedinUrl(
          msg?.payload?.linkedin_url,
        );
        sendResponse({ ok: true, row });
      } catch (e) {
        sendResponse({
          ok: false,
          error: normalizeError(e, "SUPABASE_GET_FAILED"),
        });
      }
    })();
    return true;
  }

  if (msg?.type === "DB_LIST_INVITATIONS_OVERVIEW") {
    (async () => {
      try {
        const result = await supabaseListInvitationsOverview(
          msg?.payload || {},
        );
        sendResponse({ ok: true, rows: result.rows, total: result.total });
      } catch (e) {
        sendResponse({
          ok: false,
          error: normalizeError(e, "SUPABASE_GET_FAILED"),
        });
      }
    })();
    return true;
  }

  if (msg?.type === "DB_ARCHIVE_INVITATION") {
    (async () => {
      try {
        await supabaseArchiveInvitation(msg?.payload || {});
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({
          ok: false,
          error: normalizeError(e, "SUPABASE_UPDATE_FAILED"),
        });
      }
    })();
    return true;
  }

  if (msg?.type === "SP_REQUEST_REFRESH_SIGNAL") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        const url = tab?.url || "";
        if (tab?.id && isLinkedInProfileLikeUrl(url)) {
          scheduleSidePanelRefresh(tab.id, url, "sidepanel.request");
        }
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({
          ok: false,
          error: normalizeError(e, "UNKNOWN_ERROR"),
        });
      }
    })();
    return true;
  }

  console.error("[LEF][chat] unknown type", req.type);
  sendResponse({
    ok: false,
    error: normalizeError("unknown_message_type", "UNKNOWN_MESSAGE_TYPE"),
  });
  return false;
});
