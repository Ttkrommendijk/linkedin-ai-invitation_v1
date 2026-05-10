// Owns Supabase auth tab/UI rendering and auth actions.
(function initPopupAuthController(globalObj) {
  const dom = globalObj.PopupDom;
  const utils = globalObj.PopupUtils || {};
  const logger = globalObj.PopupLogger || { warn: () => {}, error: () => {} };
  if (!dom || typeof dom !== "object") {
    throw new Error("PopupDom must be loaded before popup-auth-controller.js.");
  }

  function getErrorMessage(errorLike) {
    if (typeof utils.getErrorMessage === "function") {
      return utils.getErrorMessage(errorLike);
    }
    if (errorLike instanceof Error) return errorLike.message || "Unexpected error.";
    return String(errorLike || "Unexpected error.");
  }

  function setFooterStatus(text) {
    if (typeof globalObj.setFooterStatus === "function") {
      globalObj.setFooterStatus(text);
      return;
    }
    if (dom.footerStatusEl) dom.footerStatusEl.textContent = String(text || "");
  }

  let authInnerTab = "signup";
  let authIsLoggedIn = false;

  function renderSupabaseAuthUiState() {
    if (dom.supabaseAuthFormsEl) {
      dom.supabaseAuthFormsEl.hidden = authIsLoggedIn;
    }
    if (dom.supabaseLoggedInPanelEl) {
      dom.supabaseLoggedInPanelEl.hidden = !authIsLoggedIn;
    }
    if (authIsLoggedIn) {
      if (dom.authSignupPanelEl) dom.authSignupPanelEl.hidden = true;
      if (dom.authLoginPanelEl) dom.authLoginPanelEl.hidden = true;
      return;
    }
    const signupActive = authInnerTab !== "login";
    if (dom.authSignupPanelEl) dom.authSignupPanelEl.hidden = !signupActive;
    if (dom.authLoginPanelEl) dom.authLoginPanelEl.hidden = signupActive;
  }

  function setAuthInnerTab(which) {
    authInnerTab = which === "login" ? "login" : "signup";
    const signupActive = authInnerTab !== "login";
    if (dom.authInnerSignupBtnEl) {
      dom.authInnerSignupBtnEl.classList.toggle("active", signupActive);
    }
    if (dom.authInnerLoginBtnEl) {
      dom.authInnerLoginBtnEl.classList.toggle("active", !signupActive);
    }
    renderSupabaseAuthUiState();
  }

  function normalizeSupabaseAuthError(errorLike) {
    const raw = getErrorMessage(errorLike);
    const text = String(raw || "").toLowerCase();
    if (text.includes("invalid login credentials")) {
      return "Invalid email or password.";
    }
    if (text.includes("user already registered")) {
      return "User already exists.";
    }
    if (text.includes("password should be")) {
      return "Password is too weak.";
    }
    if (text.includes("session expired")) {
      return "Session expired, please login.";
    }
    return raw || "Unexpected error.";
  }

  function applySupabaseAuthUi(session) {
    const userEmail = String(session?.user?.email || "").trim();
    authIsLoggedIn = Boolean(userEmail);
    if (dom.supabaseUserEmailEl) {
      dom.supabaseUserEmailEl.textContent = userEmail || "";
    }
    if (dom.supabaseLogoutBtnEl) {
      dom.supabaseLogoutBtnEl.hidden = !authIsLoggedIn;
    }
    renderSupabaseAuthUiState();
  }

  async function sendAuthMessage(type, payload = undefined) {
    const send = utils.sendRuntimeMessage || globalObj.sendRuntimeMessage;
    if (typeof send !== "function") {
      throw new Error("sendRuntimeMessage is not available for auth controller.");
    }
    return send(type, payload == null ? undefined : { payload });
  }

  async function refreshSupabaseAuthUi() {
    const result = await sendAuthMessage("SUPABASE_AUTH_GET_SESSION");
    if (!result.ok) {
      applySupabaseAuthUi(null);
      return;
    }
    const data = result.data || {};
    applySupabaseAuthUi(data?.session || null);
  }

  async function handleSupabaseSignup() {
    const name = (dom.supabaseSignupNameEl?.value || "").trim();
    const email = (dom.supabaseSignupEmailEl?.value || "").trim();
    const password = (dom.supabaseSignupPasswordEl?.value || "").trim();
    if (!email || !password) {
      setFooterStatus("Email and password are required.");
      return;
    }
    setFooterStatus("Signing up...");
    const result = await sendAuthMessage("SUPABASE_AUTH_SIGNUP", { name, email, password });
    if (!result.ok) {
      setFooterStatus(normalizeSupabaseAuthError(result.error));
      return;
    }
    await refreshSupabaseAuthUi();
    const message = (result.data && result.data.message) || "Signup successful.";
    setFooterStatus(message);
  }

  async function handleSupabaseLogin() {
    const email = (dom.supabaseLoginEmailEl?.value || "").trim();
    const password = (dom.supabaseLoginPasswordEl?.value || "").trim();
    if (!email || !password) {
      setFooterStatus("Email and password are required.");
      return;
    }
    setFooterStatus("Logging in...");
    const result = await sendAuthMessage("SUPABASE_AUTH_LOGIN", { email, password });
    if (!result.ok) {
      setFooterStatus(normalizeSupabaseAuthError(result.error));
      return;
    }
    await refreshSupabaseAuthUi();
    setFooterStatus("Logged in.");
  }

  async function handleSupabaseResetPassword() {
    const email = (
      dom.supabaseLoginEmailEl?.value ||
      dom.supabaseSignupEmailEl?.value ||
      ""
    ).trim();
    if (!email) {
      setFooterStatus("Enter an email first.");
      return;
    }
    setFooterStatus("Sending reset email...");
    const result = await sendAuthMessage("SUPABASE_AUTH_RESET_PASSWORD", { email });
    if (!result.ok) {
      setFooterStatus(normalizeSupabaseAuthError(result.error));
      return;
    }
    setFooterStatus("Password reset email sent.");
  }

  async function handleSupabaseLogout() {
    setFooterStatus("Logging out...");
    const result = await sendAuthMessage("SUPABASE_AUTH_LOGOUT");
    if (!result.ok) {
      setFooterStatus(normalizeSupabaseAuthError(result.error));
      return;
    }
    await refreshSupabaseAuthUi();
    setFooterStatus("Logged out.");
  }

  function bindAuthEvents() {
    dom.authInnerSignupBtnEl?.addEventListener("click", () =>
      setAuthInnerTab("signup"),
    );
    dom.authInnerLoginBtnEl?.addEventListener("click", () =>
      setAuthInnerTab("login"),
    );
    dom.supabaseSignupBtnEl?.addEventListener("click", () => {
      handleSupabaseSignup().catch((e) => {
        logger.warn("[LEF][auth] signup failed", e);
        setFooterStatus(normalizeSupabaseAuthError(e));
      });
    });
    dom.supabaseLoginBtnEl?.addEventListener("click", () => {
      handleSupabaseLogin().catch((e) => {
        logger.warn("[LEF][auth] login failed", e);
        setFooterStatus(normalizeSupabaseAuthError(e));
      });
    });
    dom.supabaseResetPasswordBtnEl?.addEventListener("click", () => {
      handleSupabaseResetPassword().catch((e) => {
        logger.warn("[LEF][auth] reset-password failed", e);
        setFooterStatus(normalizeSupabaseAuthError(e));
      });
    });
    dom.supabaseLogoutBtnEl?.addEventListener("click", () => {
      handleSupabaseLogout().catch((e) => {
        logger.warn("[LEF][auth] logout failed", e);
        setFooterStatus(normalizeSupabaseAuthError(e));
      });
    });
  }

  globalObj.PopupAuthController = Object.freeze({
    bindAuthEvents,
    refreshSupabaseAuthUi,
    setAuthInnerTab,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
