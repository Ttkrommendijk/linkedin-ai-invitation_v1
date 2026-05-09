(function initSupabasePrompts(globalObj) {
  const LEF_UTILS = globalObj.LEFUtils || {};
  const LEF_SUPABASE = globalObj.LEFSupabaseService || {};
  const LEF_OPENAI = globalObj.LEFOpenAIService || {};

  const normalizeProfileField = LEF_UTILS.normalizeProfileField;

  const getSupabaseRequestContext = LEF_SUPABASE.getSupabaseRequestContext;
  const fetchWithTimeout = LEF_OPENAI.fetchWithTimeout;
  const createProviderHttpError = LEF_OPENAI.createProviderHttpError;

  async function supabaseGetPrompts() {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const url = `${supabaseUrl}/rest/v1/prompt?select=prompt_id,prompt_name,prompt_text&order=prompt_name.asc.nullslast`;
    const res = await fetchWithTimeout(
      url,
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
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw createProviderHttpError("supabase", res.status, txt);
    }
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function supabaseCreatePrompt({ name, prompt }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const normalizedName = normalizeProfileField(name);
    if (!normalizedName) {
      throw new Error("Prompt name is required.");
    }
    const url = `${supabaseUrl}/rest/v1/prompt`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify([
          {
            prompt_name: normalizedName,
            prompt_text: normalizeProfileField(prompt),
          },
        ]),
      },
      15000,
      "Supabase request",
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw createProviderHttpError("supabase", res.status, txt);
    }
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async function supabaseUpdatePrompt({ id, prompt }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const targetId = normalizeProfileField(id);
    if (!targetId) {
      throw new Error("Prompt id is required.");
    }
    const url = `${supabaseUrl}/rest/v1/prompt?prompt_id=eq.${encodeURIComponent(targetId)}`;
    const payload = {};
    if (prompt !== undefined) {
      payload.prompt_text = normalizeProfileField(prompt);
    }
    if (Object.keys(payload).length === 0) {
      throw new Error("Nothing to update.");
    }
    const res = await fetchWithTimeout(
      url,
      {
        method: "PATCH",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      },
      15000,
      "Supabase request",
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw createProviderHttpError("supabase", res.status, txt);
    }
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async function supabaseUpdatePromptName({ id, name }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const targetId = normalizeProfileField(id);
    const normalizedName = normalizeProfileField(name);
    if (!targetId) {
      throw new Error("Prompt id is required.");
    }
    if (!normalizedName) {
      throw new Error("Prompt name is required.");
    }
    const url = `${supabaseUrl}/rest/v1/prompt?prompt_id=eq.${encodeURIComponent(targetId)}`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "PATCH",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          prompt_name: normalizedName,
        }),
      },
      15000,
      "Supabase request",
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw createProviderHttpError("supabase", res.status, txt);
    }
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  globalObj.LEFSupabasePrompts = Object.freeze({
    supabaseGetPrompts,
    supabaseCreatePrompt,
    supabaseUpdatePrompt,
    supabaseUpdatePromptName,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
