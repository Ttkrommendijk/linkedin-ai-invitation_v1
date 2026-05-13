(function initSupabaseDeals(globalObj) {
  const LEF_UTILS = globalObj.LEFUtils || {};
  const LEF_SUPABASE = globalObj.LEFSupabaseService || {};
  const LEF_OPENAI = globalObj.LEFOpenAIService || {};

  const normalizeProfileField =
    typeof LEF_UTILS.normalizeProfileField === "function"
      ? LEF_UTILS.normalizeProfileField
      : (value) => (value == null ? "" : String(value).trim());

  const getSupabaseRequestContext = LEF_SUPABASE.getSupabaseRequestContext;
  const fetchWithTimeout = LEF_OPENAI.fetchWithTimeout;
  const createProviderHttpError = LEF_OPENAI.createProviderHttpError;

  function buildQuery(params) {
    return Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");
  }

  async function supabaseListDeals(payload = {}) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const companyId = normalizeProfileField(payload.company_id);
    if (!companyId) return [];

    const params = {
      select: "deal_id,created_at,deal_name,deal_description,deal_value,company_id,deal_phase",
      company_id: `eq.${companyId}`,
      order: "created_at.desc",
    };

    const url = `${supabaseUrl}/rest/v1/deal?${buildQuery(params)}`;
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

  globalObj.LEFSupabaseDeals = Object.freeze({
    supabaseListDeals,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
