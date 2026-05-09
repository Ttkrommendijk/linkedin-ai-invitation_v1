(function initSupabaseCompany(globalObj) {
  const LEF_UTILS = globalObj.LEFUtils || {};
  const LEF_SUPABASE = globalObj.LEFSupabaseService || {};
  const LEF_OPENAI = globalObj.LEFOpenAIService || {};

  const normalizeProfileField = LEF_UTILS.normalizeProfileField;
  const canonicalizeLinkedInUrl = LEF_UTILS.canonicalizeLinkedInUrl;

  const getSupabaseRequestContext = LEF_SUPABASE.getSupabaseRequestContext;
  const fetchWithTimeout = LEF_OPENAI.fetchWithTimeout;
  const createProviderHttpError = LEF_OPENAI.createProviderHttpError;

  function normalizeLinkedinCompanyUrl(value) {
    return canonicalizeLinkedInUrl(normalizeProfileField(value));
  }

  function normalizeLinkedinInvitationUrl(value) {
    return canonicalizeLinkedInUrl(normalizeProfileField(value));
  }

  function toOverviewInt(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
  }

  function toOverviewSortDir(value) {
    return String(value || "").toLowerCase() === "asc" ? "asc" : "desc";
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

  // paste company functions here

  async function supabaseFindCompanyByName({ company_name }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const normalizedName = normalizeProfileField(company_name);
    if (!normalizedName) return null;
    const headers = {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    const queries = [
      `company_name=eq.${encodeURIComponent(normalizedName)}&archived=eq.0`,
      `company_name=ilike.${encodeURIComponent(normalizedName)}&archived=eq.0`,
    ];

    for (const query of queries) {
      const url = `${supabaseUrl}/rest/v1/company?select=company_id,company_name,archived&${query}&limit=1`;
      const res = await fetchWithTimeout(
        url,
        {
          method: "GET",
          headers,
        },
        15000,
        "Supabase request",
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw createProviderHttpError("supabase", res.status, txt);
      }
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        return rows[0] || null;
      }
    }

    return null;
  }

  async function supabaseGetCompanyById({ company_id }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const normalizedCompanyId = normalizeProfileField(company_id);
    if (!normalizedCompanyId) return null;
    const url = `${supabaseUrl}/rest/v1/company?select=company_id,company_name,linkedin_id,archived,employee_number,it_members,sector,city&company_id=eq.${encodeURIComponent(normalizedCompanyId)}&limit=1`;
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
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows[0] || null;
  }

  async function supabaseSearchCompanies({ term, limit }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const normalizedTerm = normalizeProfileField(term);
    if (!normalizedTerm) return [];
    const parsedLimit = Number(limit);
    const safeLimit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(50, Math.floor(parsedLimit))
        : 10;
    const url = `${supabaseUrl}/rest/v1/company?select=company_id,company_name,archived&company_name=ilike.${encodeURIComponent(`*${normalizedTerm}*`)}&archived=eq.0&order=company_name.asc&limit=${safeLimit}`;
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

  async function supabaseSearchUnlinkedCompanies({ term, limit }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const normalizedTerm = normalizeProfileField(term);
    if (!normalizedTerm) return [];
    const parsedLimit = Number(limit);
    const safeLimit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(50, Math.floor(parsedLimit))
        : 10;
    const params = new URLSearchParams();
    params.set(
      "select",
      "company_id,linkedin_id,company_name,employee_number,it_members,sector,city",
    );
    params.set("company_name", `ilike.*${normalizedTerm}*`);
    params.set("or", "(linkedin_id.is.null,linkedin_id.eq.)");
    params.set("archived", "eq.0");
    params.set("order", "company_name.asc");
    params.set("limit", String(safeLimit));
    const url = `${supabaseUrl}/rest/v1/company?${params.toString()}`;
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

  async function supabaseConfirmCompanyLink({
    linkedin_url,
    company_id,
    company_name,
  }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const targetUrl = normalizeLinkedinInvitationUrl(linkedin_url);
    if (!targetUrl) throw new Error("Missing linkedin_url.");
    const normalizedCompanyId = normalizeProfileField(company_id);
    const normalizedCompanyName = normalizeProfileField(company_name);
    if (!normalizedCompanyId) throw new Error("Missing company_id.");
    if (!normalizedCompanyName) throw new Error("Missing company_name.");
    const url = `${supabaseUrl}/rest/v1/linkedin_invitations?linkedin_url=eq.${encodeURIComponent(targetUrl)}`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "PATCH",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          company_id: normalizedCompanyId,
          company: normalizedCompanyName,
        }),
      },
      15000,
      "Supabase request",
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw createProviderHttpError("supabase", res.status, txt);
    }
  }

  async function supabaseGetCompanyByLinkedinId({ linkedin_id }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const normalizedLinkedinId = normalizeLinkedinCompanyUrl(linkedin_id);
    if (!normalizedLinkedinId) return null;
    const url = `${supabaseUrl}/rest/v1/company?select=company_id,linkedin_id,company_name,employee_number,it_members,sector,city&linkedin_id=eq.${encodeURIComponent(normalizedLinkedinId)}&limit=1`;
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
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async function supabaseListInvitationsByCompany({ company_id }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const normalizedCompanyId = normalizeProfileField(company_id);
    if (!normalizedCompanyId) return [];

    const params = new URLSearchParams();
    params.set(
      "select",
      "id,linkedin_url,full_name,headline,company,company_id,accepted",
    );
    params.set("order", "full_name.asc.nullslast");
    params.set("limit", "50");
    params.set("company_id", `eq.${normalizedCompanyId}`);
    const url = `${supabaseUrl}/rest/v1/linkedin_invitations?${params.toString()}`;
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

  async function supabaseUpsertCompanyProfile(payload) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const linkedin_id = normalizeLinkedinCompanyUrl(payload?.linkedin_id);
    if (!linkedin_id) throw new Error("Missing linkedin_id.");
    const companyPatch = {
      linkedin_id,
      company_name: normalizeProfileField(payload?.company_name),
      employee_number: normalizeProfileField(payload?.employee_number),
      it_members: normalizeProfileField(payload?.it_members),
      sector: normalizeProfileField(payload?.sector),
      city: normalizeProfileField(payload?.city),
    };
    const url = `${supabaseUrl}/rest/v1/company?on_conflict=linkedin_id`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify([companyPatch]),
      },
      15000,
      "Supabase request",
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw createProviderHttpError("supabase", res.status, txt);
    }
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async function supabaseUpdateCompanyById(payload) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const company_id = normalizeProfileField(payload?.company_id);
    if (!company_id) throw new Error("Missing company_id.");
    const patch = {
      linkedin_id: normalizeLinkedinCompanyUrl(payload?.linkedin_id),
      company_name: normalizeProfileField(payload?.company_name),
      employee_number: normalizeProfileField(payload?.employee_number),
      it_members: normalizeProfileField(payload?.it_members),
      sector: normalizeProfileField(payload?.sector),
      city: normalizeProfileField(payload?.city),
    };
    for (const key of Object.keys(patch)) {
      if (patch[key] === "") delete patch[key];
    }
    if (!Object.keys(patch).length) return null;
    const url = `${supabaseUrl}/rest/v1/company?company_id=eq.${encodeURIComponent(company_id)}`;
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
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async function supabaseListCompaniesOverview({
    page,
    pageSize,
    sortField,
    sortDir,
    filters,
    search,
  }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const safePage = toOverviewInt(page, 1);
    const safePageSize = toOverviewInt(pageSize, 25);
    const safeSortField = toCompanyOverviewSortField(sortField);
    const safeSortDir = toOverviewSortDir(sortDir);
    const offset = (safePage - 1) * safePageSize;

    const params = new URLSearchParams();
    params.set(
      "select",
      "company_id,company_name,linkedin_id,archived,employee_number,linked_person_count,customer_potential_score,sector,campaigns",
    );
    params.set("limit", String(safePageSize));
    params.set("offset", String(offset));
    params.set("order", `${safeSortField}.${safeSortDir}`);
    if (filters?.archived === "0" || filters?.archived === "1") {
      params.set("archived", `eq.${filters.archived}`);
    }
    if (filters?.campaign) {
      const campaignName = String(filters.campaign).trim().replace(/\*/g, "");
      if (campaignName) {
        params.set("campaigns", `ilike.*${campaignName}*`);
      }
    }
    if (search && String(search).trim()) {
      const q = String(search).trim().replace(/\*/g, "");
      params.set(
        "or",
        `(company_name.ilike.*${q}*,employee_number.ilike.*${q}*,sector.ilike.*${q}*,campaigns.ilike.*${q}*)`,
      );
    }

    const url = `${supabaseUrl}/rest/v1/vw_company_overview?${params.toString()}`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
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

    const companies = await res.json();
    const contentRange = res.headers.get("content-range") || "";
    const totalMatch = contentRange.match(/\/(\d+|\*)$/);
    const total =
      totalMatch && totalMatch[1] !== "*" ? Number(totalMatch[1]) : null;
    const rows = (Array.isArray(companies) ? companies : []).map((row) => ({
      company_id: normalizeProfileField(row?.company_id),
      company_name: normalizeProfileField(row?.company_name),
      linkedin_url: normalizeLinkedinCompanyUrl(row?.linkedin_id),
      archived: row?.archived ?? 0,
      employee_number: normalizeProfileField(row?.employee_number),
      linked_person_count: Number(row?.linked_person_count || 0),
      customer_potential_score: Number(row?.customer_potential_score || 0),
      sector: normalizeProfileField(row?.sector),
      campaigns: normalizeProfileField(row?.campaigns),
    }));
    return { rows, total };
  }

  async function supabaseArchiveCompany({ company_id, archived }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const targetCompanyId = normalizeProfileField(company_id);
    if (!targetCompanyId) {
      throw new Error("Missing company_id.");
    }
    const endpoint = `${supabaseUrl}/rest/v1/company?company_id=eq.${encodeURIComponent(targetCompanyId)}`;
    const res = await fetchWithTimeout(
      endpoint,
      {
        method: "PATCH",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ archived: archived ? 1 : 0 }),
      },
      15000,
      "Supabase request",
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw createProviderHttpError("supabase", res.status, txt);
    }
  }

  globalObj.LEFSupabaseCompany = Object.freeze({
    supabaseFindCompanyByName,
    supabaseGetCompanyById,
    supabaseSearchCompanies,
    supabaseSearchUnlinkedCompanies,
    supabaseConfirmCompanyLink,
    supabaseGetCompanyByLinkedinId,
    supabaseListInvitationsByCompany,
    supabaseUpsertCompanyProfile,
    supabaseUpdateCompanyById,
    supabaseListCompaniesOverview,
    supabaseArchiveCompany,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
