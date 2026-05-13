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

try {
  importScripts("./navigation-watcher.js");
} catch (_e) {
  // Optional background helper; background keeps working without it.
}

try {
  importScripts("./openai-service.js");
} catch (e) {
  console.error("[LEF] failed to import openai-service.js", e);
}

try {
  importScripts("./supabase-service.js");
  importScripts("./supabase-invitations.js");
  importScripts("./supabase-company.js");
  importScripts("./supabase-prompts.js");
  importScripts("./supabase-campaigns.js");
  importScripts("./supabase-notes.js");
  importScripts("./supabase-deals.js");
  importScripts("./supabase-overview.js");
} catch (e) {
  console.error("[LEF] failed to import supabase modules", e);
}

if (globalThis.LEFNavigationWatcher?.initNavigationWatcher) {
  globalThis.LEFNavigationWatcher.initNavigationWatcher();
}

const LEF_UTILS = globalThis.LEFUtils || {};
const LEF_PROMPTS = globalThis.LEFPrompts || {};

const LEF_OPENAI = globalThis.LEFOpenAIService || {};

const LEF_SUPABASE = globalThis.LEFSupabaseService || {};
const LEF_SUPABASE_INVITATIONS = globalThis.LEFSupabaseInvitations || {};
const LEF_SUPABASE_COMPANY = globalThis.LEFSupabaseCompany || {};
const LEF_SUPABASE_PROMPTS = globalThis.LEFSupabasePrompts || {};
const LEF_SUPABASE_CAMPAIGNS = globalThis.LEFSupabaseCampaigns || {};
const LEF_SUPABASE_NOTES = globalThis.LEFSupabaseNotes || {};
const LEF_SUPABASE_DEALS = globalThis.LEFSupabaseDeals || {};
const LEF_SUPABASE_OVERVIEW = globalThis.LEFSupabaseOverview || {};

const fetchWithTimeout = LEF_OPENAI.fetchWithTimeout;
const fetchOpenAIWithRetry = LEF_OPENAI.fetchOpenAIWithRetry;
const createProviderHttpError = LEF_OPENAI.createProviderHttpError;
const extractRawModelText = LEF_OPENAI.extractRawModelText;

const callOpenAIFreePrompt = LEF_OPENAI.callOpenAIFreePrompt;

const buildFirstMessageUserInput = LEF_PROMPTS.buildFirstMessageUserInput;

const getSupabaseConfig = LEF_SUPABASE.getSupabaseConfig;

const normalizeSupabaseSession = LEF_SUPABASE.normalizeSupabaseSession;

const readSupabaseSessionFromStorage =
  LEF_SUPABASE.readSupabaseSessionFromStorage;

const persistSupabaseSession = LEF_SUPABASE.persistSupabaseSession;

const clearSupabaseSession = LEF_SUPABASE.clearSupabaseSession;

const isSupabaseSessionExpired = LEF_SUPABASE.isSupabaseSessionExpired;

const fetchSupabaseAuthUser = LEF_SUPABASE.fetchSupabaseAuthUser;

const refreshSupabaseSession = LEF_SUPABASE.refreshSupabaseSession;

const ensureSupabaseSession = LEF_SUPABASE.ensureSupabaseSession;

const getSupabaseRequestContext = LEF_SUPABASE.getSupabaseRequestContext;

const safeTrim =
  typeof LEF_UTILS.safeTrim === "function"
    ? LEF_UTILS.safeTrim
    : (value) => (value == null ? "" : String(value).trim());

const normalizeWhitespace =
  typeof LEF_UTILS.normalizeWhitespace === "function"
    ? LEF_UTILS.normalizeWhitespace
    : (value) => safeTrim(value).replace(/\s+/g, " ");

const sanitizeHeadlineJobTitle =
  typeof LEF_UTILS.sanitizeHeadlineJobTitle === "function"
    ? LEF_UTILS.sanitizeHeadlineJobTitle
    : (value) => normalizeWhitespace(value);

const normalizeError =
  typeof LEF_UTILS.normalizeError === "function"
    ? LEF_UTILS.normalizeError
    : (err, code = "UNKNOWN_ERROR", details) => {
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
      };

const normalizeProfileField =
  typeof LEF_UTILS.normalizeProfileField === "function"
    ? LEF_UTILS.normalizeProfileField
    : (value) => {
        if (value == null) return "";
        if (typeof value === "string") return value.trim();
        if (Array.isArray(value)) {
          return value
            .map(normalizeProfileField)
            .filter(Boolean)
            .join(" | ")
            .trim();
        }
        if (typeof value === "object") {
          return Object.values(value)
            .map(normalizeProfileField)
            .filter(Boolean)
            .join(" | ")
            .trim();
        }
        return String(value).trim();
      };

const clampText =
  typeof LEF_UTILS.clampText === "function"
    ? LEF_UTILS.clampText
    : (text, maxChars) => {
        let out = safeTrim(text || "");
        out = out
          .replace(/\r\n/g, "\n")
          .replace(/\n+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (out.length > maxChars) {
          out = out.slice(0, maxChars - 3).trim() + "...";
        }
        return out;
      };

const isLinkedInProfileLikeUrl =
  typeof LEF_UTILS.isLinkedInProfileLikeUrl === "function"
    ? LEF_UTILS.isLinkedInProfileLikeUrl
    : (url) =>
        /^https:\/\/www\.linkedin\.com\/(in|company|school)\/[^/?#]+/i.test(
          safeTrim(url),
        );

const canonicalizeLinkedInUrl =
  typeof LEF_UTILS.canonicalizeLinkedInUrl === "function"
    ? LEF_UTILS.canonicalizeLinkedInUrl
    : (rawUrl) => {
        const input = safeTrim(rawUrl);
        if (!input) return "";
        try {
          const parsed = new URL(input);
          const parts = (parsed.pathname || "").split("/").filter(Boolean);
          if (parts.length >= 2 && /^(company|school)$/i.test(parts[0])) {
            return `https://www.linkedin.com/${parts[0].toLowerCase()}/${parts[1]}/`;
          }
          const pathname = (parsed.pathname || "").replace(/\/+$/, "") || "/";
          if (pathname === "/") return "https://www.linkedin.com/";
          return `https://www.linkedin.com${pathname}/`;
        } catch (_e) {
          const noHash = input.split("#")[0];
          const noQuery = noHash.split("?")[0];
          const match = noQuery.match(
            /^https:\/\/www\.linkedin\.com\/(company|school)\/([^/?#\/]+)/i,
          );
          if (match) {
            return `https://www.linkedin.com/${match[1].toLowerCase()}/${match[2]}/`;
          }
          const noTrailing = noQuery.replace(/\/+$/, "");
          if (!noTrailing) return "";
          return noTrailing.endsWith("/") ? noTrailing : `${noTrailing}/`;
        }
      };

const DEBUG = false;
const STORAGE_KEY_SUPABASE_SESSION = "lef_supabase_session_v1";
const STORAGE_KEY_SUPABASE_URL = "supabase_url";
const DEFAULT_SUPABASE_URL = "https://nkhujuqjnbzsfqyqfndc.supabase.co";

function debug(...args) {
  if (DEBUG) console.log(...args);
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

function parseCompanyExtractionJson(rawText) {
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
  const allowedKeys = new Set([
    "company_name",
    "employee_number",
    "sector",
    "city",
    "it_members",
  ]);
  const keys = Object.keys(parsed);
  const hasInvalidKeys = keys.some((k) => !allowedKeys.has(k));
  if (hasInvalidKeys) {
    const err = new Error("Model returned unexpected JSON schema.");
    err.details = { reason: "invalid_json" };
    throw err;
  }
  return {
    company_name: normalizeProfileField(parsed.company_name),
    employee_number: normalizeProfileField(parsed.employee_number),
    sector: normalizeProfileField(parsed.sector),
    city: normalizeProfileField(parsed.city),
    it_members: normalizeProfileField(parsed.it_members),
  };
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

function buildStandardInvitePrompt(focus) {
  return LEF_PROMPTS.buildInviteTextPrompt({
    language: "Portuguese",
    additionalPrompt: normalizeProfileField(focus),
  });
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

async function callOpenAICompanyExtraction({ apiKey, model, profile }) {
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
        max_output_tokens: 180,
        text: {
          format: {
            type: "json_schema",
            name: "company_extraction",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                company_name: { type: "string" },
                employee_number: { type: "string" },
                sector: { type: "string" },
                city: { type: "string" },
                it_members: { type: "string" },
              },
              required: [
                "company_name",
                "employee_number",
                "sector",
                "city",
                "it_members",
              ],
            },
          },
        },
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: LEF_PROMPTS.buildCompanyExtractionPrompt(),
              },
            ],
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: JSON.stringify(profile || {}) },
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
  if (data?.output_parsed && typeof data.output_parsed === "object") {
    return parseCompanyExtractionJson(JSON.stringify(data.output_parsed));
  }
  const rawText = extractRawModelText(data);
  return parseCompanyExtractionJson(rawText || "{}");
}

function normalizeLinkedinCompanyUrl(value) {
  return canonicalizeLinkedInUrl(normalizeProfileField(value));
}

function normalizeLinkedinInvitationUrl(value) {
  return canonicalizeLinkedInUrl(normalizeProfileField(value));
}

let cachedSupabaseSession = null;

async function supabaseIncrementMessageCount({ linkedin_url, delta }) {
  const { supabaseUrl, supabaseAnonKey, accessToken } =
    await getSupabaseRequestContext();
  const targetUrl = normalizeLinkedinInvitationUrl(linkedin_url);
  if (!targetUrl) {
    throw new Error("Missing linkedin_url.");
  }
  const numericDelta = Number(delta);
  if (!Number.isFinite(numericDelta) || numericDelta === 0) return;

  const getUrl = `${supabaseUrl}/rest/v1/linkedin_invitations?linkedin_url=eq.${encodeURIComponent(targetUrl)}&select=message_count&limit=1`;
  const getRes = await fetchWithTimeout(
    getUrl,
    {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
    15000,
    "Supabase request",
  );
  if (!getRes.ok) {
    const txt = await getRes.text().catch(() => "");
    throw createProviderHttpError("supabase", getRes.status, txt);
  }
  const rows = await getRes.json();
  const current = Number(rows?.[0]?.message_count);
  const safeCurrent = Number.isFinite(current) ? Math.floor(current) : 0;
  const next = Math.max(0, safeCurrent + Math.trunc(numericDelta));

  const patchUrl = `${supabaseUrl}/rest/v1/linkedin_invitations?linkedin_url=eq.${encodeURIComponent(targetUrl)}`;
  const patchRes = await fetchWithTimeout(
    patchUrl,
    {
      method: "PATCH",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ message_count: next }),
    },
    15000,
    "Supabase request",
  );
  if (!patchRes.ok) {
    const txt = await patchRes.text().catch(() => "");
    throw createProviderHttpError("supabase", patchRes.status, txt);
  }
}

async function supabaseSetMessageCount({ linkedin_url, message_count }) {
  const { supabaseUrl, supabaseAnonKey, accessToken } =
    await getSupabaseRequestContext();
  const targetUrl = normalizeLinkedinInvitationUrl(linkedin_url);
  if (!targetUrl) {
    throw new Error("Missing linkedin_url.");
  }
  const numeric = Number(message_count);
  const safeCount = Number.isFinite(numeric)
    ? Math.max(0, Math.floor(numeric))
    : 0;
  const patchUrl = `${supabaseUrl}/rest/v1/linkedin_invitations?linkedin_url=eq.${encodeURIComponent(targetUrl)}`;
  const patchRes = await fetchWithTimeout(
    patchUrl,
    {
      method: "PATCH",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ message_count: safeCount }),
    },
    15000,
    "Supabase request",
  );
  if (!patchRes.ok) {
    const txt = await patchRes.text().catch(() => "");
    throw createProviderHttpError("supabase", patchRes.status, txt);
  }
}

function toCompanyOverviewSortField(value) {
  const allowed = new Set([
    "customer_potential_score",
    "company_name",
    "employee_number",
    "linked_person_count",
    "sector",
    "campaigns",
    "archived",
  ]);
  const field = String(value || "");
  return allowed.has(field) ? field : "company_name";
}

function emitUiStatus(text) {
  try {
    chrome.runtime.sendMessage({ type: "ui_status", text }, () => {
      void chrome.runtime.lastError;
    });
  } catch (_e) {
    // Ignore when popup/sidepanel is closed.
  }
}

async function getActiveTabInCurrentWindow() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function sendMessageToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (_e) {
    return null;
  }
}

const ROUTES = {
  GET_ACTIVE_TAB_CONTEXT: {
    errorCode: "UNKNOWN_ERROR",
    handler: async () => {
      const tab = await getActiveTabInCurrentWindow();
      return {
        ok: true,
        data: {
          tabId: Number.isInteger(tab?.id) ? tab.id : null,
          url: tab?.url || "",
        },
      };
    },
  },
  SCRAPE_PROFILE_CONTEXT: {
    errorCode: "EXTRACTION_FAILED",
    handler: async () => {
      const tab = await getActiveTabInCurrentWindow();
      if (!Number.isInteger(tab?.id)) {
        return {
          ok: false,
          error: normalizeError("No active tab found.", "EXTRACTION_FAILED"),
        };
      }
      const resp = await sendMessageToTab(tab.id, {
        type: "EXTRACT_PROFILE_CONTEXT",
      });
      if (!resp?.ok || !resp?.profile) {
        const errorMessage =
          typeof resp?.error === "string"
            ? resp.error
            : resp?.error?.message || "profile extraction failed";
        return {
          ok: false,
          error: normalizeError(errorMessage, "EXTRACTION_FAILED"),
        };
      }
      return { ok: true, data: { profile: resp.profile } };
    },
  },
  FETCH_CHAT_HISTORY: {
    errorCode: "EXTRACTION_FAILED",
    handler: async ({ msg }) => {
      const tab = await getActiveTabInCurrentWindow();
      if (!Number.isInteger(tab?.id)) {
        return {
          ok: true,
          data: {
            messages: [],
            chat_history: "",
            meta: { no_active_tab: true },
          },
        };
      }
      const reqId = String(msg?.payload?.reqId || `chat_${Date.now()}`);
      const resp = await sendMessageToTab(tab.id, {
        type: "EXTRACT_CHAT_HISTORY",
        reqId,
      });
      if (!resp?.ok) {
        return {
          ok: true,
          data: { messages: [], chat_history: "", meta: resp?.meta || {} },
        };
      }
      const messages = Array.isArray(resp?.messages) ? resp.messages : [];
      const chat_history = messages
        .map((m) => (m?.text || "").toString().trim())
        .filter(Boolean)
        .join("\n");
      return {
        ok: true,
        data: { messages, chat_history, meta: resp?.meta || {} },
      };
    },
  },
  OPEN_LINKEDIN_URL: {
    errorCode: "UNKNOWN_ERROR",
    handler: async ({ msg }) => {
      const targetUrl = normalizeProfileField(msg?.payload?.url);
      const openInNewTab = Boolean(msg?.payload?.new_tab);
      if (!isLinkedInProfileLikeUrl(targetUrl)) {
        return { ok: true };
      }
      if (openInNewTab) {
        await chrome.tabs.create({ url: targetUrl, active: true });
        return { ok: true };
      }
      const tab = await getActiveTabInCurrentWindow();
      if (Number.isInteger(tab?.id)) {
        await chrome.tabs.update(tab.id, { url: targetUrl, active: true });
      } else {
        await chrome.tabs.create({ url: targetUrl, active: true });
      }
      return { ok: true };
    },
  },
  GENERATE_INVITE: {
    errorCode: "GENERATION_FAILED",
    includeDetails: true,
    handler: async ({ msg }) => {
      emitUiStatus("Sending to LLM\u2026");
      const generation = await globalThis.LEFOpenAIService.callOpenAIInviteGeneration(
        msg.payload,
      );
      return {
        ok: true,
        invite_text: generation.invite_text,
      };
    },
  },
  ENRICH_PROFILE: {
    errorCode: "GENERATION_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Sending to LLM\u2026");
      const extraction = await callOpenAIProfileExtraction(msg.payload || {});
      return {
        ok: true,
        company: extraction.company || "",
        headline: sanitizeHeadlineJobTitle(extraction.headline || ""),
        language: extraction.language || "",
      };
    },
  },
  ENRICH_COMPANY_PROFILE: {
    errorCode: "GENERATION_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Sending to LLM\u2026");
      try {
        const extraction = await callOpenAICompanyExtraction(msg.payload || {});
        console.log("[LEF][company AI extraction result]", extraction);
        return { ok: true, ...extraction };
      } catch (e) {
        console.log("[LEF][company save failed]", e);
        throw e;
      }
    },
  },
  GENERATE_FREE_PROMPT: {
    errorCode: "GENERATION_FAILED",
    includeDetails: true,
    handler: async ({ msg }) => {
      emitUiStatus("Sending to LLM\u2026");
      const text = await callOpenAIFreePrompt(msg.payload || {});
      return { ok: true, text };
    },
  },
  SUPABASE_AUTH_SIGNUP: {
    errorCode: "SUPABASE_AUTH_SIGNUP_FAILED",
    handler: async ({ msg }) => {
      const result = await callSupabaseAuthSignup(msg?.payload || {});
      return {
        ok: true,
        session: result.session || null,
        message: result.message || "Signup successful.",
      };
    },
  },
  SUPABASE_AUTH_LOGIN: {
    errorCode: "SUPABASE_AUTH_LOGIN_FAILED",
    handler: async ({ msg }) => {
      const session = await callSupabaseAuthLogin(msg?.payload || {});
      return { ok: true, session };
    },
  },
  SUPABASE_AUTH_RESET_PASSWORD: {
    errorCode: "SUPABASE_AUTH_RESET_PASSWORD_FAILED",
    handler: async ({ msg }) => {
      await callSupabaseAuthResetPassword(msg?.payload || {});
      return { ok: true };
    },
  },
  SUPABASE_AUTH_LOGOUT: {
    errorCode: "SUPABASE_AUTH_LOGOUT_FAILED",
    handler: async () => {
      await callSupabaseAuthLogout();
      return { ok: true };
    },
  },
  SUPABASE_AUTH_GET_SESSION: {
    errorCode: "SUPABASE_AUTH_SESSION_FAILED",
    handler: async () => {
      let session = await readSupabaseSessionFromStorage();
      if (session && isSupabaseSessionExpired(session)) {
        try {
          session = await refreshSupabaseSession(session);
        } catch (_e) {
          await clearSupabaseSession();
          session = null;
        }
      }
      return { ok: true, session };
    },
  },
  DB_UPSERT_GENERATED: {
    errorCode: "SUPABASE_UPSERT_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Communicating to database\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseUpsertInvitation(msg.payload);
      return { ok: true };
    },
  },
  DB_UPDATE_FIRST_MESSAGE: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseUpdateFirstMessage(msg.payload);
      return { ok: true };
    },
  },
  DB_MARK_STATUS: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Communicating to database\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseMarkStatus(msg.payload);
      return { ok: true };
    },
  },
  DB_MARK_FIRST_MESSAGE_SENT: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Communicating to database\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseMarkFirstMessageSent(
        msg.payload || {},
      );
      return { ok: true };
    },
  },
  DB_SET_STATUS_ONLY: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Communicating to database\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseSetStatusOnly(msg.payload);
      return { ok: true };
    },
  },
  DB_SET_ACCEPTED_AT_NOW: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Communicating to database\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseSetAcceptedAtNow(
        msg.payload || {},
      );
      return { ok: true };
    },
  },
  DB_CLEAR_ACCEPTED_AT: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Communicating to database\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseClearAcceptedAt(
        msg.payload || {},
      );
      return { ok: true };
    },
  },
  DB_INCREMENT_MESSAGE_COUNT: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseIncrementMessageCount(
        msg?.payload || {},
      );
      return { ok: true };
    },
  },
  DB_SET_MESSAGE_COUNT: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseSetMessageCount(
        msg?.payload || {},
      );
      return { ok: true };
    },
  },
  DB_UPDATE_PROFILE_DETAILS_ONLY: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseUpdateProfileDetailsOnly(
        msg.payload || {},
      );
      return { ok: true };
    },
  },
  DB_UPDATE_PROFILE_FIELDS: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseUpdateProfileFields(
        msg.payload || {},
      );
      return { ok: true };
    },
  },
  DB_GET_INVITATION: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      const row = await LEF_SUPABASE_INVITATIONS.supabaseGetInvitationByLinkedinUrl(
        msg?.payload?.linkedin_url,
      );
      return { ok: true, row };
    },
  },
  DB_GET_INVITATION_BY_ID: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching…");
      const row = await LEF_SUPABASE_INVITATIONS.supabaseGetInvitationById(
        msg?.payload?.id,
      );
      return { ok: true, row };
    },
  },
  DB_FIND_COMPANY_BY_NAME: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      const company = await LEF_SUPABASE_COMPANY.supabaseFindCompanyByName(
        msg?.payload || {},
      );
      return { ok: true, company };
    },
  },
  DB_GET_COMPANY_BY_ID: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      const company = await LEF_SUPABASE_COMPANY.supabaseGetCompanyById(
        msg?.payload || {},
      );
      return { ok: true, company };
    },
  },
  DB_GET_COMPANY_BY_LINKEDIN_ID: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      const company = await LEF_SUPABASE_COMPANY.supabaseGetCompanyByLinkedinId(
        msg?.payload || {},
      );
      return { ok: true, company };
    },
  },
  DB_LIST_INVITATIONS_BY_COMPANY: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      const rows = await LEF_SUPABASE_COMPANY.supabaseListInvitationsByCompany(
        msg?.payload || {},
      );
      return { ok: true, rows };
    },
  },
  DB_SEARCH_COMPANIES: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      const companies = await LEF_SUPABASE_COMPANY.supabaseSearchCompanies(
        msg?.payload || {},
      );
      return { ok: true, companies };
    },
  },
  DB_SEARCH_UNLINKED_COMPANIES: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      timingLog("db_search_unlinked_companies_called", {
        term: normalizeProfileField(msg?.payload?.term),
        limit: msg?.payload?.limit,
      });
      console.log("[LEF][company search]", {
        ts: Date.now(),
        term: normalizeProfileField(msg?.payload?.term),
        limit: msg?.payload?.limit,
      });
      const companies = await LEF_SUPABASE_COMPANY.supabaseSearchUnlinkedCompanies(
        msg?.payload || {},
      );
      return { ok: true, companies };
    },
  },
  DB_CONFIRM_COMPANY_LINK: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_COMPANY.supabaseConfirmCompanyLink(msg?.payload || {});
      return { ok: true };
    },
  },
  DB_UPSERT_COMPANY_PROFILE: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      try {
        const existing = await LEF_SUPABASE_COMPANY.supabaseGetCompanyByLinkedinId(
          msg?.payload || {},
        );
        const company = await LEF_SUPABASE_COMPANY.supabaseUpsertCompanyProfile(
          msg?.payload || {},
        );
        console.log(
          existing
            ? "[LEF][company row updated]"
            : "[LEF][company row created]",
          {
            linkedin_id: normalizeLinkedinCompanyUrl(msg?.payload?.linkedin_id),
          },
        );
        return { ok: true, company };
      } catch (e) {
        console.log("[LEF][company save failed]", e);
        throw e;
      }
    },
  },
  DB_UPDATE_COMPANY_BY_ID: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      try {
        const company = await LEF_SUPABASE_COMPANY.supabaseUpdateCompanyById(
          msg?.payload || {},
        );
        console.log("[LEF][company row updated]", {
          company_id: LEF_SUPABASE_COMPANY.normalizeProfileField(
            msg?.payload?.company_id,
          ),
          linkedin_id: LEF_SUPABASE_COMPANY.normalizeLinkedinCompanyUrl(
            msg?.payload?.linkedin_id,
          ),
        });
        return { ok: true, company };
      } catch (e) {
        console.log("[LEF][company save failed]", e);
        throw e;
      }
    },
  },
  GET_PROMPTS: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async () => {
      emitUiStatus("Fetching\u2026");
      const prompts = await LEF_SUPABASE_PROMPTS.supabaseGetPrompts();
      return { ok: true, prompts };
    },
  },
  CREATE_PROMPT: {
    errorCode: "SUPABASE_UPSERT_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      const prompt = await LEF_SUPABASE_PROMPTS.supabaseCreatePrompt(
        msg?.payload || {},
      );
      return { ok: true, prompt };
    },
  },
  UPDATE_PROMPT: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      const prompt = await LEF_SUPABASE_PROMPTS.supabaseUpdatePrompt(
        msg?.payload || {},
      );
      return { ok: true, prompt };
    },
  },
  UPDATE_PROMPT_NAME: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      const prompt = await LEF_SUPABASE_PROMPTS.supabaseUpdatePromptName(
        msg?.payload || {},
      );
      return { ok: true, prompt };
    },
  },
  DB_LIST_NOTES: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching notes\u2026");
      const rows = await LEF_SUPABASE_NOTES.supabaseListNotes(
        msg?.payload || {},
      );
      return { ok: true, rows };
    },
  },
  DB_LIST_DEALS: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching deals...");
      const rows = await LEF_SUPABASE_DEALS.supabaseListDeals(
        msg?.payload || {},
      );
      return { ok: true, rows };
    },
  },
  DB_CREATE_DEAL: {
    errorCode: "SUPABASE_UPSERT_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Saving deal...");
      const deal = await LEF_SUPABASE_DEALS.supabaseCreateDeal(
        msg?.payload || {},
      );
      return { ok: true, deal };
    },
  },
  DB_UPDATE_DEAL: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating deal...");
      const deal = await LEF_SUPABASE_DEALS.supabaseUpdateDeal(
        msg?.payload || {},
      );
      return { ok: true, deal };
    },
  },
  DB_CREATE_NOTE: {
    errorCode: "SUPABASE_UPSERT_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Saving note\u2026");
      const note = await LEF_SUPABASE_NOTES.supabaseCreateNote(
        msg?.payload || {},
      );
      return { ok: true, note };
    },
  },
  DB_UPDATE_NOTE: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Saving note\u2026");
      const note = await LEF_SUPABASE_NOTES.supabaseUpdateNote(
        msg?.payload || {},
      );
      return { ok: true, note };
    },
  },
  DB_ARCHIVE_NOTE: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Archiving note\u2026");
      await LEF_SUPABASE_NOTES.supabaseArchiveNote(msg?.payload || {});
      return { ok: true };
    },
  },

  DB_DELETE_NOTE: {
    errorCode: "SUPABASE_DELETE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Deleting note...");
      await LEF_SUPABASE_NOTES.supabaseDeleteNote(msg?.payload || {});
      return { ok: true };
    },
  },
  DB_LIST_CAMPAIGNS: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async () => {
      emitUiStatus("Fetching\u2026");
      const campaign_rows = await LEF_SUPABASE_CAMPAIGNS.supabaseListCampaigns();
      const campaigns = campaign_rows
        .map((row) => normalizeProfileField(row?.campaign_name))
        .filter(Boolean);
      return { ok: true, campaigns, campaign_rows };
    },
  },
  DB_CREATE_CAMPAIGN: {
    errorCode: "SUPABASE_UPSERT_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      const campaign = await LEF_SUPABASE_CAMPAIGNS.supabaseCreateCampaign(
        msg?.payload || {},
      );
      return { ok: true, campaign };
    },
  },
  DB_UPDATE_CAMPAIGN: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      const campaign = await LEF_SUPABASE_CAMPAIGNS.supabaseUpdateCampaign(
        msg?.payload || {},
      );
      return { ok: true, campaign };
    },
  },

  DB_ARCHIVE_CAMPAIGN: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating…");
      const campaign = await LEF_SUPABASE_CAMPAIGNS.supabaseArchiveCampaign(
        msg?.payload || {},
      );
      return { ok: true, campaign };
    },
  },
  DB_LIST_PERSON_CAMPAIGNS: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      const rows = await LEF_SUPABASE_CAMPAIGNS.supabaseListPersonCampaigns(
        msg?.payload || {},
      );
      return { ok: true, rows };
    },
  },
  DB_LINK_PERSON_CAMPAIGN: {
    errorCode: "SUPABASE_UPSERT_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_CAMPAIGNS.supabaseLinkPersonCampaign(
        msg?.payload || {},
      );
      return { ok: true };
    },
  },
  DB_UNLINK_PERSON_CAMPAIGN: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_CAMPAIGNS.supabaseUnlinkPersonCampaign(
        msg?.payload || {},
      );
      return { ok: true };
    },
  },
  DB_LIST_INVITATIONS_OVERVIEW: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      const result = await LEF_SUPABASE_OVERVIEW.supabaseListInvitationsOverview(
        msg?.payload || {},
      );
      return { ok: true, rows: result.rows, total: result.total };
    },
  },
  DB_LIST_COMPANIES: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      const result = await LEF_SUPABASE_COMPANY.supabaseListCompaniesOverview(
        msg?.payload || {},
      );
      return { ok: true, rows: result.rows, total: result.total };
    },
  },
  DB_ARCHIVE_COMPANY: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_COMPANY.supabaseArchiveCompany(msg?.payload || {});
      return { ok: true };
    },
  },
  DB_ARCHIVE_INVITATION: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseArchiveInvitation(
        msg?.payload || {},
      );
      return { ok: true };
    },
  },
  DB_SET_ARCHIVED: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseSetArchived(msg?.payload || {});
      return { ok: true };
    },
  },
  SP_REQUEST_REFRESH_SIGNAL: {
    errorCode: "UNKNOWN_ERROR",
    handler: async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const url = tab?.url || "";
      if (
        tab?.id &&
        globalThis.LEFNavigationWatcher?.scheduleSidePanelRefresh &&
        isLinkedInProfileLikeUrl(url)
      ) {
        globalThis.LEFNavigationWatcher.scheduleSidePanelRefresh(
          tab.id,
          url,
          "sidepanel.request",
          { force: true },
        );
      }
      return { ok: true };
    },
  },
};

function executeRoute({ routes, msg, sender, sendResponse }) {
  const req = msg || {};
  debug("onMessage:", msg?.type);
  console.log("[LEF][chat] received type", req.type);

  const route = routes[msg?.type];
  if (!route || typeof route.handler !== "function") {
    console.error("[LEF][chat] unknown type", req.type);
    sendResponse({
      ok: false,
      error: normalizeError("unknown_message_type", "UNKNOWN_MESSAGE_TYPE"),
    });
    return false;
  }

  (async () => {
    try {
      const out = await route.handler({
        msg,
        sender,
        payload: msg?.payload || {},
      });
      if (out && typeof out === "object" && "ok" in out) {
        sendResponse(out);
        return;
      }
      if (out && typeof out === "object") {
        sendResponse({ ok: true, ...out });
        return;
      }
      sendResponse({ ok: true, data: out });
    } catch (e) {
      const details =
        route.includeDetails && e && typeof e === "object" ? e.details : undefined;
      sendResponse({
        ok: false,
        error: normalizeError(e, route.errorCode || "UNKNOWN_ERROR", details),
      });
    }
  })();

  return true;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) =>
  executeRoute({
    routes: ROUTES,
    msg,
    sender,
    sendResponse,
  }),
);
