(function initSupabaseCampaigns(globalObj) {
  const LEF_UTILS = globalObj.LEFUtils || {};
  const LEF_SUPABASE = globalObj.LEFSupabaseService || {};
  const LEF_OPENAI = globalObj.LEFOpenAIService || {};

  const normalizeProfileField = LEF_UTILS.normalizeProfileField;

  const getSupabaseRequestContext = LEF_SUPABASE.getSupabaseRequestContext;
  const fetchWithTimeout = LEF_OPENAI.fetchWithTimeout;
  const createProviderHttpError = LEF_OPENAI.createProviderHttpError;

  async function supabaseListCampaigns() {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const url = `${supabaseUrl}/rest/v1/campaign?select=campaign_id,campaign_name&order=campaign_name.asc`;
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

  async function supabaseCreateCampaign({ campaign_name }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const normalizedName = normalizeProfileField(campaign_name);
    if (!normalizedName) {
      throw new Error("Campaign name is required.");
    }
    const url = `${supabaseUrl}/rest/v1/campaign`;
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
        body: JSON.stringify([{ campaign_name: normalizedName }]),
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

  async function supabaseUpdateCampaign({ campaign_id, campaign_name, color }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const targetId = normalizeProfileField(campaign_id);
    const normalizedName = normalizeProfileField(campaign_name);
    const normalizedColor = normalizeProfileField(color);
    if (!targetId) {
      throw new Error("Campaign id is required.");
    }
    const payload = {};
    if (normalizedName) {
      payload.campaign_name = normalizedName;
    }
    if (normalizedColor) {
      payload.color = normalizedColor;
    }
    if (Object.keys(payload).length === 0) {
      throw new Error("Nothing to update.");
    }
    const url = `${supabaseUrl}/rest/v1/campaign?campaign_id=eq.${encodeURIComponent(targetId)}`;
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

  async function supabaseListPersonCampaigns({ person_id }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const normalizedPersonId = normalizeProfileField(person_id);
    if (!normalizedPersonId) return [];
    const url = `${supabaseUrl}/rest/v1/person_campaign?select=campaign_id,campaign:campaign(campaign_id,campaign_name,color)&person_id=eq.${encodeURIComponent(normalizedPersonId)}&order=campaign_id.asc`;
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
    return (Array.isArray(rows) ? rows : [])
      .map((row) => {
        const campaignObj = Array.isArray(row?.campaign)
          ? row.campaign[0]
          : row?.campaign || {};
        return {
          campaign_id: normalizeProfileField(
            row?.campaign_id || campaignObj?.campaign_id,
          ),
          campaign_name: normalizeProfileField(campaignObj?.campaign_name),
          color: normalizeProfileField(campaignObj?.color),
        };
      })
      .filter((row) => row.campaign_id && row.campaign_name);
  }

  async function supabaseLinkPersonCampaign({ person_id, campaign_id }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const normalizedPersonId = normalizeProfileField(person_id);
    const normalizedCampaignId = normalizeProfileField(campaign_id);
    if (!normalizedPersonId || !normalizedCampaignId) {
      throw new Error("Missing person_id or campaign_id.");
    }
    const existingUrl = `${supabaseUrl}/rest/v1/person_campaign?select=person_id,campaign_id&person_id=eq.${encodeURIComponent(normalizedPersonId)}&campaign_id=eq.${encodeURIComponent(normalizedCampaignId)}&limit=1`;
    const existingRes = await fetchWithTimeout(
      existingUrl,
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
    if (!existingRes.ok) {
      const txt = await existingRes.text().catch(() => "");
      throw createProviderHttpError("supabase", existingRes.status, txt);
    }
    const existingRows = await existingRes.json();
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      return;
    }
    const insertUrl = `${supabaseUrl}/rest/v1/person_campaign`;
    const insertRes = await fetchWithTimeout(
      insertUrl,
      {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify([
          { person_id: normalizedPersonId, campaign_id: normalizedCampaignId },
        ]),
      },
      15000,
      "Supabase request",
    );
    if (!insertRes.ok) {
      const txt = await insertRes.text().catch(() => "");
      throw createProviderHttpError("supabase", insertRes.status, txt);
    }
  }

  async function supabaseUnlinkPersonCampaign({ person_id, campaign_id }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const normalizedPersonId = normalizeProfileField(person_id);
    const normalizedCampaignId = normalizeProfileField(campaign_id);
    if (!normalizedPersonId || !normalizedCampaignId) {
      throw new Error("Missing person_id or campaign_id.");
    }
    const url = `${supabaseUrl}/rest/v1/person_campaign?person_id=eq.${encodeURIComponent(normalizedPersonId)}&campaign_id=eq.${encodeURIComponent(normalizedCampaignId)}`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "DELETE",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
      },
      15000,
      "Supabase request",
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw createProviderHttpError("supabase", res.status, txt);
    }
  }

  globalObj.LEFSupabaseCampaigns = Object.freeze({
    supabaseListCampaigns,
    supabaseCreateCampaign,
    supabaseUpdateCampaign,
    supabaseListPersonCampaigns,
    supabaseLinkPersonCampaign,
    supabaseUnlinkPersonCampaign,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
