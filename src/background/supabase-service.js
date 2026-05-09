(function initSupabaseService(globalObj) {
  const LEF_UTILS = globalObj.LEFUtils || {};

  async function getSupabaseConfig() {
    const [
      { webhookSecret, [STORAGE_KEY_SUPABASE_URL]: supabaseUrlLocal },
      { webhookBaseUrl },
    ] = await Promise.all([
      chrome.storage.local.get(["webhookSecret", STORAGE_KEY_SUPABASE_URL]),
      chrome.storage.sync.get(["webhookBaseUrl"]),
    ]);

    const supabaseUrl = String(
      supabaseUrlLocal || webhookBaseUrl || DEFAULT_SUPABASE_URL,
    )
      .trim()
      .replace(/\/+$/, "");

    if (!supabaseUrl || !webhookSecret) {
      throw new Error(
        "Missing config. Set Supabase URL and Supabase publishable key.",
      );
    }

    return {
      supabaseUrl,
      supabaseAnonKey: webhookSecret,
    };
  }

  function normalizeSupabaseSession(rawSession) {
    const session =
      rawSession && typeof rawSession === "object" ? rawSession : null;
    if (!session) return null;
    const accessToken = normalizeProfileField(session.access_token);
    const refreshToken = normalizeProfileField(session.refresh_token);
    if (!accessToken || !refreshToken) return null;
    const expiresAt = Number(session.expires_at);
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: normalizeProfileField(session.token_type) || "bearer",
      expires_in: Number(session.expires_in) || 0,
      expires_at: Number.isFinite(expiresAt) ? expiresAt : 0,
      user:
        session.user && typeof session.user === "object" ? session.user : null,
    };
  }

  async function readSupabaseSessionFromStorage() {
    if (cachedSupabaseSession) return cachedSupabaseSession;
    const data = await chrome.storage.local.get([STORAGE_KEY_SUPABASE_SESSION]);
    cachedSupabaseSession = normalizeSupabaseSession(
      data?.[STORAGE_KEY_SUPABASE_SESSION] || null,
    );
    return cachedSupabaseSession;
  }

  async function persistSupabaseSession(session) {
    const normalized = normalizeSupabaseSession(session);
    cachedSupabaseSession = normalized;
    await chrome.storage.local.set({
      [STORAGE_KEY_SUPABASE_SESSION]: normalized,
    });
  }

  async function clearSupabaseSession() {
    cachedSupabaseSession = null;
    await chrome.storage.local.remove([STORAGE_KEY_SUPABASE_SESSION]);
  }

  function isSupabaseSessionExpired(session) {
    const expiresAt = Number(session?.expires_at || 0);
    if (!expiresAt) return false;
    return expiresAt - 45 <= Math.floor(Date.now() / 1000);
  }

  async function fetchSupabaseAuthUser({
    supabaseUrl,
    supabaseAnonKey,
    accessToken,
  }) {
    const url = `${supabaseUrl}/auth/v1/user`;
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
      "Supabase auth",
    );
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  }

  async function refreshSupabaseSession(session) {
    const { supabaseUrl, supabaseAnonKey } = await getSupabaseConfig();
    const url = `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refresh_token: session?.refresh_token || "",
        }),
      },
      15000,
      "Supabase auth",
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw createProviderHttpError("supabase", res.status, txt);
    }
    const payload = await res.json();
    const normalized = normalizeSupabaseSession(payload);
    if (!normalized) {
      throw new Error("Session expired, please login");
    }
    if (!normalized.user) {
      normalized.user = await fetchSupabaseAuthUser({
        supabaseUrl,
        supabaseAnonKey,
        accessToken: normalized.access_token,
      });
    }
    await persistSupabaseSession(normalized);
    return normalized;
  }

  async function ensureSupabaseSession() {
    let session = await readSupabaseSessionFromStorage();
    if (!session) {
      throw new Error("Please login to Supabase");
    }
    if (isSupabaseSessionExpired(session)) {
      try {
        session = await refreshSupabaseSession(session);
      } catch (_e) {
        await clearSupabaseSession();
        throw new Error("Session expired, please login");
      }
    }
    return session;
  }

  async function getSupabaseRequestContext() {
    const { supabaseUrl, supabaseAnonKey } = await getSupabaseConfig();
    const session = await ensureSupabaseSession();
    return {
      supabaseUrl,
      supabaseAnonKey,
      accessToken: session.access_token,
      userId: normalizeProfileField(session?.user?.id),
      session,
    };
  }

  async function callSupabaseAuthSignup({ name, email, password }) {
    const { supabaseUrl, supabaseAnonKey } = await getSupabaseConfig();
    const url = `${supabaseUrl}/auth/v1/signup`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizeProfileField(email),
          password: String(password || ""),
          data: {
            name: normalizeProfileField(name) || null,
          },
        }),
      },
      15000,
      "Supabase auth",
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data?.msg || data?.error_description || data?.error;
      throw new Error(normalizeProfileField(errMsg) || "Signup failed.");
    }
    const session = normalizeSupabaseSession(data);
    if (session) {
      if (!session.user) {
        session.user = await fetchSupabaseAuthUser({
          supabaseUrl,
          supabaseAnonKey,
          accessToken: session.access_token,
        });
      }
      await persistSupabaseSession(session);
    }
    const requiresEmailConfirmation = !session;
    return {
      session,
      message: requiresEmailConfirmation
        ? "Signup successful. Check your email to confirm your account."
        : "Signup successful.",
    };
  }

  async function callSupabaseAuthLogin({ email, password }) {
    const { supabaseUrl, supabaseAnonKey } = await getSupabaseConfig();
    const url = `${supabaseUrl}/auth/v1/token?grant_type=password`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizeProfileField(email),
          password: String(password || ""),
        }),
      },
      15000,
      "Supabase auth",
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data?.msg || data?.error_description || data?.error;
      throw new Error(normalizeProfileField(errMsg) || "Login failed.");
    }
    const session = normalizeSupabaseSession(data);
    if (!session) {
      throw new Error("Login failed.");
    }
    if (!session.user) {
      session.user = await fetchSupabaseAuthUser({
        supabaseUrl,
        supabaseAnonKey,
        accessToken: session.access_token,
      });
    }
    await persistSupabaseSession(session);
    return session;
  }

  async function callSupabaseAuthResetPassword({ email }) {
    const { supabaseUrl, supabaseAnonKey } = await getSupabaseConfig();
    const url = `${supabaseUrl}/auth/v1/recover`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizeProfileField(email),
        }),
      },
      15000,
      "Supabase auth",
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data?.msg || data?.error_description || data?.error;
      throw new Error(
        normalizeProfileField(errMsg) || "Reset password failed.",
      );
    }
  }

  async function callSupabaseAuthLogout() {
    const session = await readSupabaseSessionFromStorage();
    if (session?.access_token) {
      const { supabaseUrl, supabaseAnonKey } = await getSupabaseConfig();
      const url = `${supabaseUrl}/auth/v1/logout`;
      await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        },
        15000,
        "Supabase auth",
      ).catch(() => null);
    }
    await clearSupabaseSession();
  }

  globalObj.LEFSupabaseService = Object.freeze({
    getSupabaseConfig,

    normalizeSupabaseSession,
    readSupabaseSessionFromStorage,
    persistSupabaseSession,
    clearSupabaseSession,
    isSupabaseSessionExpired,

    fetchSupabaseAuthUser,
    refreshSupabaseSession,
    ensureSupabaseSession,
    getSupabaseRequestContext,

    callSupabaseAuthSignup,
    callSupabaseAuthLogin,
    callSupabaseAuthResetPassword,
    callSupabaseAuthLogout,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
