(function initSupabaseInvitations(globalObj) {
  const LEF_UTILS = globalObj.LEFUtils || {};
  const LEF_SUPABASE = globalObj.LEFSupabaseService || {};
  const LEF_OPENAI = globalObj.LEFOpenAIService || {};

  const normalizeProfileField = LEF_UTILS.normalizeProfileField;
  const sanitizeHeadlineJobTitle = LEF_UTILS.sanitizeHeadlineJobTitle;
  const canonicalizeLinkedInUrl = LEF_UTILS.canonicalizeLinkedInUrl;

  const getSupabaseRequestContext = LEF_SUPABASE.getSupabaseRequestContext;
  const fetchWithTimeout = LEF_OPENAI.fetchWithTimeout;
  const createProviderHttpError = LEF_OPENAI.createProviderHttpError;

  function normalizeLinkedinInvitationUrl(value) {
    return canonicalizeLinkedInUrl(normalizeProfileField(value));
  }

  // paste invitation functions here

  async function supabaseUpsertInvitation(row) {
    const { supabaseUrl, supabaseAnonKey, accessToken, userId } =
      await getSupabaseRequestContext();
    const url = `${supabaseUrl}/rest/v1/linkedin_invitations?on_conflict=linkedin_url`;
    const payload = {
      ...row,
      linkedin_url: normalizeLinkedinInvitationUrl(row?.linkedin_url),
      uuid: normalizeProfileField(row?.uuid) || userId || null,
    };

    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
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
  }

  async function supabaseUpdateFirstMessage({
    linkedin_url,
    first_message,
    first_message_generated_at,
  }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const targetUrl = normalizeLinkedinInvitationUrl(linkedin_url);
    const url = `${supabaseUrl}/rest/v1/linkedin_invitations?linkedin_url=eq.${encodeURIComponent(targetUrl)}`;
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
          Authorization: `Bearer ${accessToken}`,
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
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const targetUrl = normalizeLinkedinInvitationUrl(linkedin_url);

    const patch = { status };
    const nowIso = new Date().toISOString();
    if (status === "invited") patch.invited_at = nowIso;
    if (status === "accepted") patch.accepted_at = nowIso;
    if (status === "first message sent") patch.first_message_sent_at = nowIso;

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

  async function supabaseMarkFirstMessageSent({ linkedin_url }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const targetUrl = normalizeLinkedinInvitationUrl(linkedin_url);
    if (!targetUrl) {
      throw new Error("Missing linkedin_url.");
    }
    const patch = {
      status: "first message sent",
      first_message_sent_at: new Date().toISOString(),
      message_count: 1,
    };
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
    const { supabaseUrl, supabaseAnonKey, accessToken, userId } =
      await getSupabaseRequestContext();
    const url = `${supabaseUrl}/rest/v1/linkedin_invitations?on_conflict=linkedin_url`;
    const row = {
      linkedin_url: normalizeLinkedinInvitationUrl(linkedin_url),
      status,
      uuid: userId || null,
    };

    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
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

  async function supabaseSetAcceptedAtNow({ linkedin_url }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const targetUrl = normalizeLinkedinInvitationUrl(linkedin_url);
    const url = `${supabaseUrl}/rest/v1/linkedin_invitations?linkedin_url=eq.${encodeURIComponent(targetUrl)}`;
    const patch = {
      accepted: true,
      accepted_at: new Date().toISOString(),
      status: "accepted",
    };

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

  async function supabaseClearAcceptedAt({ linkedin_url }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const targetUrl = normalizeLinkedinInvitationUrl(linkedin_url);
    const url = `${supabaseUrl}/rest/v1/linkedin_invitations?linkedin_url=eq.${encodeURIComponent(targetUrl)}`;
    const patch = {
      accepted: false,
      accepted_at: null,
      status: "invited",
    };

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

  async function supabaseUpdateProfileDetailsOnly({
    linkedin_url,
    company,
    headline,
    language,
  }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const targetUrl = normalizeLinkedinInvitationUrl(linkedin_url);
    const url = `${supabaseUrl}/rest/v1/linkedin_invitations?linkedin_url=eq.${encodeURIComponent(targetUrl)}`;
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
          Authorization: `Bearer ${accessToken}`,
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

  async function supabaseUpdateProfileFields({
    linkedin_url,
    full_name,
    company,
    company_id,
    headline,
    comments,
    phone,
    email,
  }) {
    const targetUrl = normalizeLinkedinInvitationUrl(linkedin_url);
    if (!targetUrl) {
      throw new Error("Missing linkedin_url.");
    }

    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const url = `${supabaseUrl}/rest/v1/linkedin_invitations?linkedin_url=eq.${encodeURIComponent(targetUrl)}`;
    const patch = {
      full_name: normalizeProfileField(full_name),
      company: normalizeProfileField(company),
      headline: sanitizeHeadlineJobTitle(headline),
      comments: normalizeProfileField(comments),
      phone: normalizeProfileField(phone),
      email: normalizeProfileField(email),
    };
    const safeCompanyId = normalizeProfileField(company_id);
    if (safeCompanyId) patch.company_id = safeCompanyId;

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
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const targetUrl = normalizeLinkedinInvitationUrl(linkedin_url);
    if (!targetUrl) return null;
    const targetUrlWithSlash = targetUrl.endsWith("/")
      ? targetUrl
      : `${targetUrl}/`;
    const urlFilter =
      targetUrl === targetUrlWithSlash
        ? `linkedin_url.eq.${encodeURIComponent(targetUrl)}`
        : `linkedin_url.eq.${encodeURIComponent(targetUrl)},linkedin_url.eq.${encodeURIComponent(targetUrlWithSlash)}`;
    const url = `${supabaseUrl}/rest/v1/linkedin_invitations?or=(${urlFilter})&select=id,linkedin_url,status,message,generated_at,invited_at,accepted,accepted_at,first_message,first_message_generated_at,first_message_sent_at,message_count,company,company_id,headline,comments,phone,email,language,full_name,campaign&limit=1`;

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
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows[0] || null;
  }



  async function supabaseGetInvitationById(id) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const targetId = normalizeProfileField(id);
    if (!targetId) return null;
    const url = `${supabaseUrl}/rest/v1/linkedin_invitations?id=eq.${encodeURIComponent(targetId)}&select=id,linkedin_url,status,message,generated_at,invited_at,accepted,accepted_at,first_message,first_message_generated_at,first_message_sent_at,message_count,company,company_id,headline,comments,phone,email,language,full_name,campaign&limit=1`;
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
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

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

  async function supabaseArchiveInvitation({ url }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const targetUrl = normalizeLinkedinInvitationUrl(url);
    const endpoint = `${supabaseUrl}/rest/v1/linkedin_invitations?linkedin_url=eq.${encodeURIComponent(targetUrl)}`;

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

  async function supabaseSetArchived({ linkedin_url, archived }) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const targetUrl = normalizeLinkedinInvitationUrl(linkedin_url);
    if (!targetUrl) {
      throw new Error("Missing linkedin_url.");
    }
    const endpoint = `${supabaseUrl}/rest/v1/linkedin_invitations?linkedin_url=eq.${encodeURIComponent(targetUrl)}`;

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



  function normalizePhoneDigits(value) {
    return String(value || "").replace(/\D+/g, "").replace(/^0+/, "");
  }

  async function supabaseFindInvitationsByPhone({ phone, limit = 10 } = {}) {
    const normalizedPhone = normalizePhoneDigits(phone);
    if (!normalizedPhone) return [];

    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);
    const select = "id,linkedin_url,status,message,generated_at,invited_at,accepted,accepted_at,first_message,first_message_generated_at,first_message_sent_at,message_count,company,company_id,headline,comments,phone,email,language,full_name,campaign";
    const suffix8 = normalizedPhone.slice(-8);
    const suffix4 = normalizedPhone.slice(-4);
    const filters = [normalizedPhone, suffix8, suffix4]
      .filter(Boolean)
      .map((value) => `phone.ilike.*${encodeURIComponent(value)}*`)
      .join(",");
    const url = `${supabaseUrl}/rest/v1/linkedin_invitations?or=(${filters})&select=${select}&limit=${safeLimit}`;

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
    const candidates = Array.isArray(rows) ? rows : [];
    return candidates.filter(
      (row) => normalizePhoneDigits(row?.phone).endsWith(normalizedPhone) ||
        normalizedPhone.endsWith(normalizePhoneDigits(row?.phone)),
    );
  }

  globalObj.LEFSupabaseInvitations = Object.freeze({
    supabaseUpsertInvitation,
    supabaseUpdateFirstMessage,
    supabaseMarkStatus,
    supabaseMarkFirstMessageSent,
    supabaseSetStatusOnly,
    supabaseSetAcceptedAtNow,
    supabaseClearAcceptedAt,
    supabaseUpdateProfileDetailsOnly,
    supabaseUpdateProfileFields,
    supabaseGetInvitationByLinkedinUrl,
    supabaseGetInvitationById,
    supabaseFindInvitationsByPhone,
    supabaseIncrementMessageCount,
    supabaseSetMessageCount,
    supabaseArchiveInvitation,
    supabaseSetArchived,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
