try {
  importScripts("../shared/utils.js");
} catch (_e) {
  // Optional shared helper; background keeps local fallbacks.
}
try {
  importScripts("../prompts.js");
} catch (_e) {
  // Optional shared helper; background keeps local fallbacks.
}

const LEF_UTILS = globalThis.LEFUtils || {};
const LEF_PROMPTS = globalThis.LEFPrompts || {};

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

function sanitizeHeadlineJobTitle(value) {
  let out = normalizeProfileField(value || "");
  if (!out) return "";

  const patterns = [
    /^\s*\d+\s*[º°]\s+/i,
    /^\s*\d+\s*[-–.]\s+/i,
    /^\s*#\s*\d+\s+/i,
    /^\s*(i|ii|iii|iv|v|vi|vii|viii|ix|x)\s+/i,
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of patterns) {
      const next = out.replace(pattern, "").trim();
      if (next !== out) {
        out = next;
        changed = true;
      }
    }
  }
  return out;
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
  void maxChars;
  return LEF_PROMPTS.buildInviteTextPrompt({
    language: "Portuguese",
    additionalPrompt: "",
  });
}

function firstMessageInstruction(maxChars, language = "auto") {
  void maxChars;
  return LEF_PROMPTS.buildFirstMessagePrompt({ language, userPrompt: "" });
}

function followupMessageInstruction(language = "auto") {
  return LEF_PROMPTS.buildFollowupPrompt({
    language,
    objective: "",
    includeStrategy: false,
    strategyText: "",
    chatHistory: [],
  });
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

  const allowedKeys = new Set(["invite_text"]);
  const keys = Object.keys(parsed);
  const hasInvalidKeys = keys.some((k) => !allowedKeys.has(k));
  const hasRequiredKeys = "invite_text" in parsed;

  if (hasInvalidKeys || !hasRequiredKeys) {
    const err = new Error("Model returned unexpected JSON schema.");
    err.details = { reason: "invalid_json" };
    throw err;
  }

  return {
    invite_text: clampText(normalizeProfileField(parsed.invite_text), 300),
  };
}

function parseProfileExtractionJson(rawText) {
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

  const allowedKeys = new Set(["company", "headline", "language"]);
  const keys = Object.keys(parsed);
  const hasInvalidKeys = keys.some((k) => !allowedKeys.has(k));
  const hasRequiredKeys =
    "company" in parsed && "headline" in parsed && "language" in parsed;

  if (hasInvalidKeys || !hasRequiredKeys) {
    const err = new Error("Model returned unexpected JSON schema.");
    err.details = { reason: "invalid_json" };
    throw err;
  }

  return {
    company: normalizeProfileField(parsed.company),
    headline: sanitizeHeadlineJobTitle(parsed.headline),
    language: normalizeProfileField(parsed.language),
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
  const primaryText = normalizeProfileField(
    data?.output?.[0]?.content?.[0]?.text || "",
  );
  if (primaryText) {
    try {
      const parsed = JSON.parse(primaryText);
      return {
        parsed: parseInviteGenerationJson(JSON.stringify(parsed)),
        rawText: primaryText,
        usedOutputParsed: false,
      };
    } catch (e) {
      const err = new Error("Model returned invalid JSON.");
      err.details = {
        reason: "invalid_json",
        source: "output.0.content.0.text",
      };
      throw err;
    }
  }

  // Preferred path for structured outputs.
  if (data?.output_parsed && typeof data.output_parsed === "object") {
    const parsed = {
      invite_text: data.output_parsed.invite_text,
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

function parseProfileExtractionFromResponseData(data) {
  const primaryText = normalizeProfileField(
    data?.output?.[0]?.content?.[0]?.text || "",
  );
  if (primaryText) {
    try {
      const parsed = JSON.parse(primaryText);
      return {
        parsed: parseProfileExtractionJson(JSON.stringify(parsed)),
        rawText: primaryText,
        usedOutputParsed: false,
      };
    } catch (_e) {
      const err = new Error("Model returned invalid JSON.");
      err.details = {
        reason: "invalid_json",
        source: "output.0.content.0.text",
      };
      throw err;
    }
  }

  if (data?.output_parsed && typeof data.output_parsed === "object") {
    const parsed = {
      company: data.output_parsed.company,
      headline: data.output_parsed.headline,
      language: data.output_parsed.language,
    };
    return {
      parsed: parseProfileExtractionJson(JSON.stringify(parsed)),
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
      parsed: parseProfileExtractionJson(rawText),
      rawText,
      usedOutputParsed: false,
    };
  } catch (_directErr) {
    const firstBrace = rawText.indexOf("{");
    const lastBrace = rawText.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const jsonSlice = rawText.slice(firstBrace, lastBrace + 1);
      return {
        parsed: parseProfileExtractionJson(jsonSlice),
        rawText,
        usedOutputParsed: false,
      };
    }
    throw _directErr;
  }
}

function profileContextBlock(profile) {
  return LEF_PROMPTS.buildFirstMessageUserInput({ profile });
}

function buildInviteUserInput({ positioning, profile, strategyCore }) {
  return LEF_PROMPTS.buildInviteUserInput({
    positioning,
    profile,
    strategyCore,
  });
}

function buildStandardInvitePrompt(focus) {
  return LEF_PROMPTS.buildInviteTextPrompt({
    language: "Portuguese",
    additionalPrompt: normalizeProfileField(focus),
  });
}

function buildFirstMessageUserInput({ profile }) {
  return LEF_PROMPTS.buildFirstMessageUserInput({ profile });
}

function buildFollowupUserInput({
  objective,
  strategy,
  includeStrategy,
  contextLast10,
  profileContext,
}) {
  return LEF_PROMPTS.buildFollowupUserInput({
    objective,
    strategy,
    includeStrategy,
    contextLast10,
    profileContext,
  });
}

async function callOpenAIInviteGeneration({
  apiKey,
  model,
  positioning,
  focus,
  strategyCore,
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
              },
              required: ["invite_text"],
            },
          },
        },
        input: [
          {
            role: "system",
            content: [
              // prompt: buildInviteTextPrompt (Generate invite)
              {
                type: "input_text",
                text: LEF_PROMPTS.buildInviteTextPrompt({
                  language: normalizeProfileField(language) || "Portuguese",
                  additionalPrompt: normalizeProfileField(focus),
                }),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildInviteUserInput({
                  positioning,
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
    });
  } catch (e) {
    debug("GENERATE_INVITE parse succeeded:", false);
    throw e;
  }

  debug("GENERATE_INVITE parse succeeded:", parseSucceeded);
  return parsedPayload;
}

async function callOpenAIProfileExtraction({ apiKey, model, profile }) {
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
            name: "profile_extraction",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                company: { type: "string" },
                headline: { type: "string" },
                language: { type: "string" },
              },
              required: ["company", "headline", "language"],
            },
          },
        },
        input: [
          {
            role: "system",
            content: [
              // prompt: buildProfileExtractionPrompt (Enrich)
              {
                type: "input_text",
                text: LEF_PROMPTS.buildProfileExtractionPrompt(),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildFirstMessageUserInput({ profile }),
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
  const result = parseProfileExtractionFromResponseData(data);
  return result.parsed;
}

async function callOpenAIFirstMessage({ apiKey, model, profile, language }) {
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
                // prompt: buildFirstMessagePrompt (Generate first message action)
                text: firstMessageInstruction(600, language || "Portuguese"),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildFirstMessageUserInput({ profile }),
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
                // prompt: buildFollowupPrompt (Generate follow-up action)
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

async function supabaseSetStatusOnly({ linkedin_url, status }) {
  const { supabaseUrl, supabaseAnonKey } = await getSupabaseConfig();
  const url = `${supabaseUrl}/rest/v1/linkedin_invitations?on_conflict=linkedin_url`;
  const row = { linkedin_url, status };

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

async function supabaseUpdateProfileDetailsOnly({
  linkedin_url,
  company,
  headline,
  language,
}) {
  const { supabaseUrl, supabaseAnonKey } = await getSupabaseConfig();
  const url = `${supabaseUrl}/rest/v1/linkedin_invitations?linkedin_url=eq.${encodeURIComponent(linkedin_url)}`;
  const patch = {};
  const safeCompany = normalizeProfileField(company);
  const safeHeadline = sanitizeHeadlineJobTitle(headline);
  const safeLanguage = normalizeProfileField(language);
  if (safeCompany) patch.company = safeCompany;
  if (safeHeadline) patch.headline = safeHeadline;
  if (safeLanguage) patch.language = safeLanguage;
  if (!Object.keys(patch).length) return;

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
  const url = `${supabaseUrl}/rest/v1/linkedin_invitations?linkedin_url=eq.${encodeURIComponent(linkedin_url)}&select=linkedin_url,status,message,generated_at,invited_at,accepted_at,first_message,first_message_generated_at,first_message_sent_at,company,headline,language,full_name,focus,positioning`;

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
  if (typeof LEF_UTILS.isLinkedInProfileLikeUrl === "function") {
    return LEF_UTILS.isLinkedInProfileLikeUrl(url);
  }
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

function emitUiStatus(text) {
  try {
    chrome.runtime.sendMessage({ type: "ui_status", text }, () => {
      void chrome.runtime.lastError;
    });
  } catch (_e) {
    // Ignore when popup/sidepanel is closed.
  }
}

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

  if (msg?.type === "GET_STANDARD_INVITE_PROMPT") {
    sendResponse({ ok: true, prompt: buildStandardInvitePrompt("") });
    return false;
  }

  if (msg?.type === "GENERATE_INVITE") {
    (async () => {
      emitUiStatus("Sending to LLM…");
      try {
        // prompt: buildInviteTextPrompt (Generate invite)
        const generation = await callOpenAIInviteGeneration(msg.payload);
        sendResponse({
          ok: true,
          invite_text: generation.invite_text,
        });
      } catch (e) {
        const details =
          e && typeof e === "object" && e.details ? e.details : undefined;
        sendResponse({
          ok: false,
          error: normalizeError(e, "GENERATION_FAILED", details),
        });
      } finally {
        emitUiStatus("Ready");
      }
    })();
    return true;
  }

  if (msg?.type === "ENRICH_PROFILE") {
    (async () => {
      emitUiStatus("Sending to LLM…");
      try {
        // prompt: buildProfileExtractionPrompt (Enrich)
        const extraction = await callOpenAIProfileExtraction(msg.payload || {});
        sendResponse({
          ok: true,
          company: extraction.company || "",
          headline: sanitizeHeadlineJobTitle(extraction.headline || ""),
          language: extraction.language || "",
        });
      } catch (e) {
        sendResponse({
          ok: false,
          error: normalizeError(e, "GENERATION_FAILED"),
        });
      } finally {
        emitUiStatus("Ready");
      }
    })();
    return true;
  }

  if (msg?.type === "GENERATE_FIRST_MESSAGE") {
    (async () => {
      emitUiStatus("Sending to LLM…");
      try {
        // prompt: buildFirstMessagePrompt
        const first_message = await callOpenAIFirstMessage(msg.payload);
        sendResponse({ ok: true, first_message });
      } catch (e) {
        sendResponse({
          ok: false,
          error: normalizeError(e, "GENERATION_FAILED"),
        });
      } finally {
        emitUiStatus("Ready");
      }
    })();
    return true;
  }

  if (req.type === "GENERATE_FOLLOWUP_MESSAGE") {
    (async () => {
      emitUiStatus("Sending to LLM…");
      try {
        // prompt: buildFollowupPrompt
        const text = await callOpenAIFollowupMessage(req.payload);
        sendResponse({ ok: true, text });
      } catch (e) {
        sendResponse({
          ok: false,
          error: normalizeError(e, "GENERATION_FAILED"),
        });
      } finally {
        emitUiStatus("Ready");
      }
    })();
    return true;
  }

  if (msg?.type === "DB_UPSERT_GENERATED") {
    (async () => {
      emitUiStatus("Communicating to database…");
      try {
        await supabaseUpsertInvitation(msg.payload);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({
          ok: false,
          error: normalizeError(e, "SUPABASE_UPSERT_FAILED"),
        });
      } finally {
        emitUiStatus("Ready");
      }
    })();
    return true;
  }

  if (msg?.type === "DB_UPDATE_FIRST_MESSAGE") {
    (async () => {
      emitUiStatus("Updating…");
      try {
        await supabaseUpdateFirstMessage(msg.payload);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({
          ok: false,
          error: normalizeError(e, "SUPABASE_UPDATE_FAILED"),
        });
      } finally {
        emitUiStatus("Ready");
      }
    })();
    return true;
  }

  if (msg?.type === "DB_MARK_STATUS") {
    (async () => {
      emitUiStatus("Communicating to database…");
      try {
        await supabaseMarkStatus(msg.payload);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({
          ok: false,
          error: normalizeError(e, "SUPABASE_UPDATE_FAILED"),
        });
      } finally {
        emitUiStatus("Ready");
      }
    })();
    return true;
  }

  if (msg?.type === "DB_SET_STATUS_ONLY") {
    (async () => {
      emitUiStatus("Communicating to database…");
      try {
        await supabaseSetStatusOnly(msg.payload);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({
          ok: false,
          error: normalizeError(e, "SUPABASE_UPDATE_FAILED"),
        });
      } finally {
        emitUiStatus("Ready");
      }
    })();
    return true;
  }

  if (msg?.type === "DB_UPDATE_PROFILE_DETAILS_ONLY") {
    (async () => {
      emitUiStatus("Updating…");
      try {
        await supabaseUpdateProfileDetailsOnly(msg.payload || {});
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({
          ok: false,
          error: normalizeError(e, "SUPABASE_UPDATE_FAILED"),
        });
      } finally {
        emitUiStatus("Ready");
      }
    })();
    return true;
  }

  if (msg?.type === "DB_GET_INVITATION") {
    (async () => {
      emitUiStatus("Fetching…");
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
      } finally {
        emitUiStatus("Ready");
      }
    })();
    return true;
  }

  if (msg?.type === "DB_LIST_INVITATIONS_OVERVIEW") {
    (async () => {
      emitUiStatus("Fetching…");
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
      } finally {
        emitUiStatus("Ready");
      }
    })();
    return true;
  }

  if (msg?.type === "DB_ARCHIVE_INVITATION") {
    (async () => {
      emitUiStatus("Updating…");
      try {
        await supabaseArchiveInvitation(msg?.payload || {});
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({
          ok: false,
          error: normalizeError(e, "SUPABASE_UPDATE_FAILED"),
        });
      } finally {
        emitUiStatus("Ready");
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
