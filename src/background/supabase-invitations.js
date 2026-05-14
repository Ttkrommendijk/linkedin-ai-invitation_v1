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

  function addBrazilianMobileVariants(variants, digits) {
    const add = (value) => {
      const normalized = normalizePhoneDigits(value);
      if (normalized) variants.add(normalized);
    };

    const local = digits.startsWith("55") && digits.length > 11
      ? digits.slice(2)
      : digits;

    if (local.length === 11 && local[2] === "9") {
      const withoutNinthDigit = `${local.slice(0, 2)}${local.slice(3)}`;
      add(withoutNinthDigit);
      add(`55${withoutNinthDigit}`);
    }

    if (local.length === 10) {
      const withNinthDigit = `${local.slice(0, 2)}9${local.slice(2)}`;
      add(withNinthDigit);
      add(`55${withNinthDigit}`);
    }
  }

  function getPhoneMatchVariants(value) {
    const digits = normalizePhoneDigits(value);
    if (!digits) return [];

    const variants = new Set([digits]);
    if (digits.startsWith("55") && digits.length > 11) variants.add(digits.slice(2));
    if (!digits.startsWith("55") && digits.length >= 10 && digits.length <= 11) {
      variants.add(`55${digits}`);
    }
    addBrazilianMobileVariants(variants, digits);

    const baseVariants = Array.from(variants);
    baseVariants.forEach((variant) => {
      if (variant.length >= 11) variants.add(variant.slice(-11));
      if (variant.length >= 10) variants.add(variant.slice(-10));
      if (variant.length >= 9) variants.add(variant.slice(-9));
      if (variant.length >= 8) variants.add(variant.slice(-8));
    });

    return Array.from(variants).filter(Boolean);
  }

  function phonesMatch(left, right) {
    const leftVariants = getPhoneMatchVariants(left);
    const rightVariants = getPhoneMatchVariants(right);
    if (!leftVariants.length || !rightVariants.length) return false;

    return leftVariants.some((leftVariant) =>
      rightVariants.some(
        (rightVariant) =>
          leftVariant === rightVariant ||
          leftVariant.endsWith(rightVariant) ||
          rightVariant.endsWith(leftVariant),
      ),
    );
  }

  async function supabaseFindInvitationsByPhone({ phone, limit = 10 } = {}) {
    const normalizedPhone = normalizePhoneDigits(phone);
    if (!normalizedPhone) return [];

    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const select = "id,linkedin_url,status,message,generated_at,invited_at,accepted,accepted_at,first_message,first_message_generated_at,first_message_sent_at,message_count,company,company_id,headline,comments,phone,email,language,full_name,campaign";
    const variants = getPhoneMatchVariants(normalizedPhone);
    const suffixes = Array.from(
      new Set(
        variants
          .flatMap((value) => [value, value.slice(-8), value.slice(-4)])
          .filter((value) => value && value.length >= 4),
      ),
    );
    const filters = suffixes
      .map((value) => `phone.ilike.*${encodeURIComponent(value)}*`)
      .join(",");
    const query = filters ? `or=(${filters})&` : "";
    const url = `${supabaseUrl}/rest/v1/linkedin_invitations?${query}select=${select}&limit=${safeLimit}`;

    console.log("[LEF][WA][debug] phone lookup", {
      inputPhone: phone,
      normalizedPhone,
      suffixes,
      safeLimit,
    });

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
    const matches = candidates.filter((row) => phonesMatch(row?.phone, normalizedPhone));

    console.log("[LEF][WA][debug] phone lookup results", {
      candidates: candidates.length,
      matches: matches.length,
      matchedPhones: matches.map((row) => row?.phone).filter(Boolean).slice(0, 10),
    });

    return matches;
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
