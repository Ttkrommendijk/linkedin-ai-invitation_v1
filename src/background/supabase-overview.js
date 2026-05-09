(function initSupabaseOverview(globalObj) {
  const LEF_UTILS = globalObj.LEFUtils || {};
  const LEF_SUPABASE = globalObj.LEFSupabaseService || {};
  const LEF_OPENAI = globalObj.LEFOpenAIService || {};

  const normalizeProfileField = LEF_UTILS.normalizeProfileField;

  const getSupabaseRequestContext = LEF_SUPABASE.getSupabaseRequestContext;
  const fetchWithTimeout = LEF_OPENAI.fetchWithTimeout;
  const createProviderHttpError = LEF_OPENAI.createProviderHttpError;

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
      "headline",
      "status",
      "most_relevant_date",
      "campaigns",
      "archived",
    ]);
    const field = String(value || "");
    if (field === "full_name") return "name";
    if (field === "campaign") return "campaigns";
    return allowed.has(field) ? field : "most_relevant_date";
  }

  function toOverviewStatusFilterValue(value) {
    const normalized = normalizeProfileField(value).toLowerCase();
    if (!normalized) return "";
    if (normalized === "registered") return "registered";
    if (normalized === "invited") return "invited";
    if (normalized === "first message sent") return "first message sent";
    if (normalized === "message responded") return "message responded";
    return "";
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

  async function supabaseListInvitationsOverview({
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
    const safeSortField = toOverviewSortField(sortField);
    const safeSortDir = toOverviewSortDir(sortDir);
    const offset = (safePage - 1) * safePageSize;

    const params = new URLSearchParams();
    params.set(
      "select",
      "url,name,company,headline,most_relevant_date,archived,campaigns,status,accepted",
    );
    params.set("limit", String(safePageSize));
    params.set("offset", String(offset));
    params.set("order", `${safeSortField}.${safeSortDir}`);

    if (filters?.campaign) {
      const campaignName = String(filters.campaign).trim().replace(/\*/g, "");
      if (campaignName) {
        params.set("campaigns", `ilike.*${campaignName}*`);
      }
    }
    if (filters?.archived === "0" || filters?.archived === "1") {
      params.set("archived", `eq.${filters.archived}`);
    }
    const statusFilter = toOverviewStatusFilterValue(filters?.status);
    if (statusFilter === "registered") {
      params.set("status", "in.(registered,generated)");
    } else if (statusFilter) {
      params.set("status", `eq.${statusFilter}`);
    }
    if (filters?.accepted === "true" || filters?.accepted === "false") {
      params.set("accepted", `eq.${filters.accepted}`);
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

    const rows = await res.json();
    const contentRange = res.headers.get("content-range") || "";
    const totalMatch = contentRange.match(/\/(\d+|\*)$/);
    const total =
      totalMatch && totalMatch[1] !== "*" ? Number(totalMatch[1]) : null;

    return { rows: Array.isArray(rows) ? rows : [], total };
  }

  globalObj.LEFSupabaseOverview = Object.freeze({
    toOverviewInt,
    toOverviewSortDir,
    toOverviewSortField,
    toOverviewStatusFilterValue,
    toCompanyOverviewSortField,
    supabaseListInvitationsOverview,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
