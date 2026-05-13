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

  async function fetchDealRows(url, { supabaseAnonKey, accessToken }) {
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

  function normalizeDealRow(row = {}) {
    const company = row.company && typeof row.company === "object" ? row.company : {};
    return {
      ...row,
      company_name:
        normalizeProfileField(row.company_name) || normalizeProfileField(company.company_name),
      company_linkedin_id:
        normalizeProfileField(row.company_linkedin_id) || normalizeProfileField(company.linkedin_id),
      person_name: normalizeProfileField(row.person_name || row.full_name),
      person_linkedin_url: normalizeProfileField(row.person_linkedin_url || row.linkedin_url),
    };
  }

  async function supabaseListDeals(payload = {}) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const companyId = normalizeProfileField(payload.company_id);
    const listAll = payload.all === true;
    if (!companyId && !listAll) return [];

    if (listAll) {
      const viewParams = {
        select:
          "deal_id,created_at,deal_name,deal_description,deal_value,company_id,company_name,company_linkedin_id,person_name,person_linkedin_url,deal_phase",
        order: "created_at.desc",
      };
      const viewUrl = `${supabaseUrl}/rest/v1/deals_view?${buildQuery(viewParams)}`;
      try {
        const rows = await fetchDealRows(viewUrl, { supabaseAnonKey, accessToken });
        return rows.map(normalizeDealRow);
      } catch (_viewError) {
        const fallbackParams = {
          select:
            "deal_id,created_at,deal_name,deal_description,deal_value,company_id,deal_phase,company(company_name,linkedin_id)",
          order: "created_at.desc",
        };
        const fallbackUrl = `${supabaseUrl}/rest/v1/deal?${buildQuery(fallbackParams)}`;
        const rows = await fetchDealRows(fallbackUrl, { supabaseAnonKey, accessToken });
        return rows.map(normalizeDealRow);
      }
    }

    const params = {
      select: "deal_id,created_at,deal_name,deal_description,deal_value,company_id,deal_phase",
      company_id: `eq.${companyId}`,
      order: "created_at.desc",
    };

    const url = `${supabaseUrl}/rest/v1/deal?${buildQuery(params)}`;
    const rows = await fetchDealRows(url, { supabaseAnonKey, accessToken });
    return rows.map(normalizeDealRow);
  }


  async function supabaseCreateDeal(payload = {}) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const companyId = normalizeProfileField(payload.company_id);
    const dealName = normalizeProfileField(payload.deal_name);
    const dealPhase = normalizeProfileField(payload.deal_phase);
    if (!companyId) throw new Error("company_id is required to create a deal.");
    if (!dealName) throw new Error("deal_name is required to create a deal.");
    if (!dealPhase) throw new Error("deal_phase is required to create a deal.");

    const row = {
      deal_name: dealName,
      deal_description: normalizeProfileField(payload.deal_description) || null,
      deal_value:
        payload.deal_value === null || payload.deal_value === undefined || payload.deal_value === ""
          ? null
          : Number(payload.deal_value),
      company_id: companyId,
      deal_phase: dealPhase,
    };

    const url = `${supabaseUrl}/rest/v1/deal`;
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
        body: JSON.stringify(row),
      },
      15000,
      "Supabase request",
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw createProviderHttpError("supabase", res.status, txt);
    }
    const rows = await res.json();
    return Array.isArray(rows) ? rows[0] || null : rows || null;
  }


  async function supabaseUpdateDeal(payload = {}) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const dealId = normalizeProfileField(payload.deal_id);
    const companyId = normalizeProfileField(payload.company_id);
    const dealName = normalizeProfileField(payload.deal_name);
    const dealPhase = normalizeProfileField(payload.deal_phase);
    if (!dealId) throw new Error("deal_id is required to update a deal.");
    if (!companyId) throw new Error("company_id is required to update a deal.");
    if (!dealName) throw new Error("deal_name is required to update a deal.");
    if (!dealPhase) throw new Error("deal_phase is required to update a deal.");

    const patch = {
      deal_name: dealName,
      deal_description: normalizeProfileField(payload.deal_description) || null,
      deal_value:
        payload.deal_value === null || payload.deal_value === undefined || payload.deal_value === ""
          ? null
          : Number(payload.deal_value),
      company_id: companyId,
      deal_phase: dealPhase,
    };

    const params = buildQuery({
      deal_id: `eq.${dealId}`,
      select: "deal_id,created_at,deal_name,deal_description,deal_value,company_id,deal_phase",
    });
    const url = `${supabaseUrl}/rest/v1/deal?${params}`;
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
        body: JSON.stringify(patch),
      },
      15000,
      "Supabase request",
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw createProviderHttpError("supabase", res.status, txt);
    }
    const rows = await res.json();
    return Array.isArray(rows) ? rows[0] || null : rows || null;
  }


  globalObj.LEFSupabaseDeals = Object.freeze({
    supabaseListDeals,
    supabaseCreateDeal,
    supabaseUpdateDeal,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
