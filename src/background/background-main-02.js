
const ROUTES = {
  GET_ACTIVE_TAB_CONTEXT: {
    errorCode: "UNKNOWN_ERROR",
    handler: async () => {
      const tab = await getActiveTabInCurrentWindow();
      return {
        ok: true,
        data: {
          tabId: Number.isInteger(tab?.id) ? tab.id : null,
          url: tab?.url || "",
        },
      };
    },
  },
  SCRAPE_PROFILE_CONTEXT: {
    errorCode: "EXTRACTION_FAILED",
    handler: async () => {
      const tab = await getActiveTabInCurrentWindow();
      if (!Number.isInteger(tab?.id)) {
        return {
          ok: false,
          error: normalizeError("No active tab found.", "EXTRACTION_FAILED"),
        };
      }
      const resp = await sendMessageToTab(tab.id, {
        type: "EXTRACT_PROFILE_CONTEXT",
      });
      if (!resp?.ok || !resp?.profile) {
        const errorMessage =
          typeof resp?.error === "string"
            ? resp.error
            : resp?.error?.message || "profile extraction failed";
        return {
          ok: false,
          error: normalizeError(errorMessage, "EXTRACTION_FAILED"),
        };
      }
      return { ok: true, data: { profile: resp.profile } };
    },
  },
  FETCH_CHAT_HISTORY: {
    errorCode: "EXTRACTION_FAILED",
    handler: async ({ msg }) => {
      const tab = await getActiveTabInCurrentWindow();
      if (!Number.isInteger(tab?.id)) {
        return {
          ok: true,
          data: {
            messages: [],
            chat_history: "",
            meta: { no_active_tab: true },
          },
        };
      }
      const reqId = String(msg?.payload?.reqId || `chat_${Date.now()}`);
      const resp = await sendMessageToTab(tab.id, {
        type: "EXTRACT_CHAT_HISTORY",
        reqId,
      });
      if (!resp?.ok) {
        return {
          ok: true,
          data: { messages: [], chat_history: "", meta: resp?.meta || {} },
        };
      }
      const messages = Array.isArray(resp?.messages) ? resp.messages : [];
      const chat_history = messages
        .map((m) => (m?.text || "").toString().trim())
        .filter(Boolean)
        .join("\n");
      return {
        ok: true,
        data: { messages, chat_history, meta: resp?.meta || {} },
      };
    },
  },
  OPEN_LINKEDIN_URL: {
    errorCode: "UNKNOWN_ERROR",
    handler: async ({ msg }) => {
      const targetUrl = normalizeProfileField(msg?.payload?.url);
      const openInNewTab = Boolean(msg?.payload?.new_tab);
      if (!isLinkedInProfileLikeUrl(targetUrl)) {
        return { ok: true };
      }
      if (openInNewTab) {
        await chrome.tabs.create({ url: targetUrl, active: true });
        return { ok: true };
      }
      const tab = await getActiveTabInCurrentWindow();
      if (Number.isInteger(tab?.id)) {
        await chrome.tabs.update(tab.id, { url: targetUrl, active: true });
      } else {
        await chrome.tabs.create({ url: targetUrl, active: true });
      }
      return { ok: true };
    },
  },
  GENERATE_INVITE: {
    errorCode: "GENERATION_FAILED",
    includeDetails: true,
    handler: async ({ msg }) => {
      emitUiStatus("Sending to LLM\u2026");
      const generation = await globalThis.LEFOpenAIService.callOpenAIInviteGeneration(
        msg.payload,
      );
      return {
        ok: true,
        invite_text: generation.invite_text,
      };
    },
  },
  ENRICH_PROFILE: {
    errorCode: "GENERATION_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Sending to LLM\u2026");
      const extraction = await callOpenAIProfileExtraction(msg.payload || {});
      return {
        ok: true,
        company: extraction.company || "",
        headline: sanitizeHeadlineJobTitle(extraction.headline || ""),
        language: extraction.language || "",
      };
    },
  },
  ENRICH_COMPANY_PROFILE: {
    errorCode: "GENERATION_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Sending to LLM\u2026");
      try {
        const extraction = await callOpenAICompanyExtraction(msg.payload || {});
        console.log("[LEF][company AI extraction result]", extraction);
        return { ok: true, ...extraction };
      } catch (e) {
        console.log("[LEF][company save failed]", e);
        throw e;
      }
    },
  },
  GENERATE_FREE_PROMPT: {
    errorCode: "GENERATION_FAILED",
    includeDetails: true,
    handler: async ({ msg }) => {
      emitUiStatus("Sending to LLM\u2026");
      const text = await callOpenAIFreePrompt(msg.payload || {});
      return { ok: true, text };
    },
  },
  SUPABASE_AUTH_SIGNUP: {
    errorCode: "SUPABASE_AUTH_SIGNUP_FAILED",
    handler: async ({ msg }) => {
      const result = await callSupabaseAuthSignup(msg?.payload || {});
      return {
        ok: true,
        session: result.session || null,
        message: result.message || "Signup successful.",
      };
    },
  },
  SUPABASE_AUTH_LOGIN: {
    errorCode: "SUPABASE_AUTH_LOGIN_FAILED",
    handler: async ({ msg }) => {
      const session = await callSupabaseAuthLogin(msg?.payload || {});
      return { ok: true, session };
    },
  },
  SUPABASE_AUTH_RESET_PASSWORD: {
    errorCode: "SUPABASE_AUTH_RESET_PASSWORD_FAILED",
    handler: async ({ msg }) => {
      await callSupabaseAuthResetPassword(msg?.payload || {});
      return { ok: true };
    },
  },
  SUPABASE_AUTH_LOGOUT: {
    errorCode: "SUPABASE_AUTH_LOGOUT_FAILED",
    handler: async () => {
      await callSupabaseAuthLogout();
      return { ok: true };
    },
  },
  SUPABASE_AUTH_GET_SESSION: {
    errorCode: "SUPABASE_AUTH_SESSION_FAILED",
    handler: async () => {
      let session = await readSupabaseSessionFromStorage();
      if (session && isSupabaseSessionExpired(session)) {
        try {
          session = await refreshSupabaseSession(session);
        } catch (_e) {
          await clearSupabaseSession();
          session = null;
        }
      }
      return { ok: true, session };
    },
  },
  DB_UPSERT_GENERATED: {
    errorCode: "SUPABASE_UPSERT_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Communicating to database\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseUpsertInvitation(msg.payload);
      return { ok: true };
    },
  },
  DB_UPDATE_FIRST_MESSAGE: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseUpdateFirstMessage(msg.payload);
      return { ok: true };
    },
  },
  DB_MARK_STATUS: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Communicating to database\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseMarkStatus(msg.payload);
      return { ok: true };
    },
  },
  DB_MARK_FIRST_MESSAGE_SENT: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Communicating to database\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseMarkFirstMessageSent(
        msg.payload || {},
      );
      return { ok: true };
    },
  },
  DB_SET_STATUS_ONLY: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Communicating to database\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseSetStatusOnly(msg.payload);
      return { ok: true };
    },
  },
  DB_SET_ACCEPTED_AT_NOW: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Communicating to database\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseSetAcceptedAtNow(
        msg.payload || {},
      );
      return { ok: true };
    },
  },
  DB_CLEAR_ACCEPTED_AT: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Communicating to database\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseClearAcceptedAt(
        msg.payload || {},
      );
      return { ok: true };
    },
  },
  DB_INCREMENT_MESSAGE_COUNT: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseIncrementMessageCount(
        msg?.payload || {},
      );
      return { ok: true };
    },
  },
  DB_SET_MESSAGE_COUNT: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseSetMessageCount(
        msg?.payload || {},
      );
      return { ok: true };
    },
  },
  DB_UPDATE_PROFILE_DETAILS_ONLY: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseUpdateProfileDetailsOnly(
        msg.payload || {},
      );
      return { ok: true };
    },
  },
  DB_UPDATE_PROFILE_FIELDS: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseUpdateProfileFields(
        msg.payload || {},
      );
      return { ok: true };
    },
  },
  DB_GET_INVITATION: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      const row = await LEF_SUPABASE_INVITATIONS.supabaseGetInvitationByLinkedinUrl(
        msg?.payload?.linkedin_url,
      );
      return { ok: true, row };
    },
  },
  DB_FIND_COMPANY_BY_NAME: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      const company = await LEF_SUPABASE_COMPANY.supabaseFindCompanyByName(
        msg?.payload || {},
      );
      return { ok: true, company };
    },
  },
  DB_GET_COMPANY_BY_ID: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      const company = await LEF_SUPABASE_COMPANY.supabaseGetCompanyById(
        msg?.payload || {},
      );
      return { ok: true, company };
    },
  },
  DB_GET_COMPANY_BY_LINKEDIN_ID: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      const company = await LEF_SUPABASE_COMPANY.supabaseGetCompanyByLinkedinId(
        msg?.payload || {},
      );
      return { ok: true, company };
    },
  },
  DB_LIST_INVITATIONS_BY_COMPANY: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      const rows = await LEF_SUPABASE_COMPANY.supabaseListInvitationsByCompany(
        msg?.payload || {},
      );
      return { ok: true, rows };
    },
  },
  DB_SEARCH_COMPANIES: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      const companies = await LEF_SUPABASE_COMPANY.supabaseSearchCompanies(
        msg?.payload || {},
      );
      return { ok: true, companies };
    },
  },
  DB_SEARCH_UNLINKED_COMPANIES: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      timingLog("db_search_unlinked_companies_called", {
        term: normalizeProfileField(msg?.payload?.term),
        limit: msg?.payload?.limit,
      });
      console.log("[LEF][company search]", {
        ts: Date.now(),
        term: normalizeProfileField(msg?.payload?.term),
        limit: msg?.payload?.limit,
      });
      const companies = await LEF_SUPABASE_COMPANY.supabaseSearchUnlinkedCompanies(
        msg?.payload || {},
      );
      return { ok: true, companies };
    },
  },
  DB_CONFIRM_COMPANY_LINK: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_COMPANY.supabaseConfirmCompanyLink(msg?.payload || {});
      return { ok: true };
    },
  },
  DB_UPSERT_COMPANY_PROFILE: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      try {
        const existing = await LEF_SUPABASE_COMPANY.supabaseGetCompanyByLinkedinId(
          msg?.payload || {},
        );
        const company = await LEF_SUPABASE_COMPANY.supabaseUpsertCompanyProfile(
          msg?.payload || {},
        );
        console.log(
          existing
            ? "[LEF][company row updated]"
            : "[LEF][company row created]",
          {
            linkedin_id: normalizeLinkedinCompanyUrl(msg?.payload?.linkedin_id),
          },
        );
        return { ok: true, company };
      } catch (e) {
        console.log("[LEF][company save failed]", e);
        throw e;
      }
    },
  },
  DB_UPDATE_COMPANY_BY_ID: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      try {
        const company = await LEF_SUPABASE_COMPANY.supabaseUpdateCompanyById(
          msg?.payload || {},
        );
        console.log("[LEF][company row updated]", {
          company_id: LEF_SUPABASE_COMPANY.normalizeProfileField(
            msg?.payload?.company_id,
          ),
          linkedin_id: LEF_SUPABASE_COMPANY.normalizeLinkedinCompanyUrl(
            msg?.payload?.linkedin_id,
          ),
        });
        return { ok: true, company };
      } catch (e) {
        console.log("[LEF][company save failed]", e);
        throw e;
      }
    },
  },
  GET_PROMPTS: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async () => {
      emitUiStatus("Fetching\u2026");
      const prompts = await LEF_SUPABASE_PROMPTS.supabaseGetPrompts();
      return { ok: true, prompts };
    },
  },
  CREATE_PROMPT: {
    errorCode: "SUPABASE_UPSERT_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      const prompt = await LEF_SUPABASE_PROMPTS.supabaseCreatePrompt(
        msg?.payload || {},
      );
      return { ok: true, prompt };
    },
  },
  UPDATE_PROMPT: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      const prompt = await LEF_SUPABASE_PROMPTS.supabaseUpdatePrompt(
        msg?.payload || {},
      );
      return { ok: true, prompt };
    },
  },
  UPDATE_PROMPT_NAME: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      const prompt = await LEF_SUPABASE_PROMPTS.supabaseUpdatePromptName(
        msg?.payload || {},
      );
      return { ok: true, prompt };
    },
  },
  DB_LIST_NOTES: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching notes\u2026");
      const rows = await LEF_SUPABASE_NOTES.supabaseListNotes(
        msg?.payload || {},
      );
      return { ok: true, rows };
    },
  },
  DB_LIST_DEALS: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching deals...");
      const rows = await LEF_SUPABASE_DEALS.supabaseListDeals(
        msg?.payload || {},
      );
      return { ok: true, rows };
    },
  },
  DB_CREATE_DEAL: {
    errorCode: "SUPABASE_UPSERT_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Saving deal...");
      const deal = await LEF_SUPABASE_DEALS.supabaseCreateDeal(
        msg?.payload || {},
      );
      return { ok: true, deal };
    },
  },
  DB_UPDATE_DEAL: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating deal...");
      const deal = await LEF_SUPABASE_DEALS.supabaseUpdateDeal(
        msg?.payload || {},
      );
      return { ok: true, deal };
    },
  },
  DB_CREATE_NOTE: {
    errorCode: "SUPABASE_UPSERT_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Saving note\u2026");
      const note = await LEF_SUPABASE_NOTES.supabaseCreateNote(
        msg?.payload || {},
      );
      return { ok: true, note };
    },
  },
  DB_UPDATE_NOTE: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Saving note\u2026");
      const note = await LEF_SUPABASE_NOTES.supabaseUpdateNote(
        msg?.payload || {},
      );
      return { ok: true, note };
    },
  },
  DB_ARCHIVE_NOTE: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Archiving note\u2026");
      await LEF_SUPABASE_NOTES.supabaseArchiveNote(msg?.payload || {});
      return { ok: true };
    },
  },


  DB_DELETE_NOTE: {
    errorCode: "SUPABASE_DELETE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Deleting note...");
      await LEF_SUPABASE_NOTES.supabaseDeleteNote(msg?.payload || {});
      return { ok: true };
    },
  },
  DB_LIST_CAMPAIGNS: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async () => {
      emitUiStatus("Fetching\u2026");
      const campaign_rows = await LEF_SUPABASE_CAMPAIGNS.supabaseListCampaigns();
      const campaigns = campaign_rows
        .map((row) => normalizeProfileField(row?.campaign_name))
        .filter(Boolean);
      return { ok: true, campaigns, campaign_rows };
    },
  },
  DB_CREATE_CAMPAIGN: {
    errorCode: "SUPABASE_UPSERT_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      const campaign = await LEF_SUPABASE_CAMPAIGNS.supabaseCreateCampaign(
        msg?.payload || {},
      );
      return { ok: true, campaign };
    },
  },
  DB_UPDATE_CAMPAIGN: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      const campaign = await LEF_SUPABASE_CAMPAIGNS.supabaseUpdateCampaign(
        msg?.payload || {},
      );
      return { ok: true, campaign };
    },
  },
  DB_ARCHIVE_CAMPAIGN: {
    requiresAuth: true,
    handler: async (msg) => {
      const campaign = await LEF_SUPABASE_CAMPAIGNS.supabaseArchiveCampaign(
        msg.payload || {},
      );
      return { ok: true, campaign };
    },
  },

  DB_LIST_PERSON_CAMPAIGNS: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      const rows = await LEF_SUPABASE_CAMPAIGNS.supabaseListPersonCampaigns(
        msg?.payload || {},
      );
      return { ok: true, rows };
    },
  },
  DB_LINK_PERSON_CAMPAIGN: {
    errorCode: "SUPABASE_UPSERT_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_CAMPAIGNS.supabaseLinkPersonCampaign(
        msg?.payload || {},
      );
      return { ok: true };
    },
  },
  DB_UNLINK_PERSON_CAMPAIGN: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_CAMPAIGNS.supabaseUnlinkPersonCampaign(
        msg?.payload || {},
      );
      return { ok: true };
    },
  },
  DB_LIST_INVITATIONS_OVERVIEW: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      const result = await LEF_SUPABASE_OVERVIEW.supabaseListInvitationsOverview(
        msg?.payload || {},
      );
      return { ok: true, rows: result.rows, total: result.total };
    },
  },
  DB_LIST_COMPANIES: {
    errorCode: "SUPABASE_GET_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Fetching\u2026");
      const result = await LEF_SUPABASE_COMPANY.supabaseListCompaniesOverview(
        msg?.payload || {},
      );
      return { ok: true, rows: result.rows, total: result.total };
    },
  },
  DB_ARCHIVE_COMPANY: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_COMPANY.supabaseArchiveCompany(msg?.payload || {});
      return { ok: true };
    },
  },
  DB_ARCHIVE_INVITATION: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseArchiveInvitation(
        msg?.payload || {},
      );
      return { ok: true };
    },
  },
  DB_SET_ARCHIVED: {
    errorCode: "SUPABASE_UPDATE_FAILED",
    handler: async ({ msg }) => {
      emitUiStatus("Updating\u2026");
      await LEF_SUPABASE_INVITATIONS.supabaseSetArchived(msg?.payload || {});
      return { ok: true };
    },
  },
  SP_REQUEST_REFRESH_SIGNAL: {
    errorCode: "UNKNOWN_ERROR",
    handler: async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const url = tab?.url || "";
      if (
        tab?.id &&
        globalThis.LEFNavigationWatcher?.scheduleSidePanelRefresh &&
        isLinkedInProfileLikeUrl(url)
      ) {
        globalThis.LEFNavigationWatcher.scheduleSidePanelRefresh(
          tab.id,
          url,
          "sidepanel.request",
          { force: true },
        );
      }
      return { ok: true };
    },
  },
};

function executeRoute({ routes, msg, sender, sendResponse }) {
  const req = msg || {};
  debug("onMessage:", msg?.type);
  console.log("[LEF][chat] received type", req.type);

  const route = routes[msg?.type];
  if (!route || typeof route.handler !== "function") {
    console.error("[LEF][chat] unknown type", req.type);
    sendResponse({
      ok: false,
      error: normalizeError("unknown_message_type", "UNKNOWN_MESSAGE_TYPE"),
    });
    return false;
  }

  (async () => {
    try {
      const out = await route.handler({
        msg,
        sender,
        payload: msg?.payload || {},
      });
      if (out && typeof out === "object" && "ok" in out) {
        sendResponse(out);
        return;
      }
      if (out && typeof out === "object") {
        sendResponse({ ok: true, ...out });
        return;
      }
      sendResponse({ ok: true, data: out });
    } catch (e) {
      const details =
        route.includeDetails && e && typeof e === "object" ? e.details : undefined;
      sendResponse({
        ok: false,
        error: normalizeError(e, route.errorCode || "UNKNOWN_ERROR", details),
      });
    }
  })();

  return true;
}
