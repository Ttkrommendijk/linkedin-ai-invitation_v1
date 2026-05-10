// Owns active profile loading, profile refresh, and profile enrichment orchestration.
// Does not own invitation generation or message generation.
(function initPopupProfileController(globalObj) {
  const dom = globalObj.PopupDom;
  if (!dom || typeof dom !== "object") {
    throw new Error("PopupDom must be loaded before popup-profile-controller.js.");
  }
  const utils = globalObj.PopupUtils;
  if (!utils || typeof utils !== "object") {
    throw new Error("PopupUtils must be loaded before popup-profile-controller.js.");
  }
  const state = globalObj.PopupState;
  if (!state || typeof state !== "object") {
    throw new Error("PopupState must be loaded before popup-profile-controller.js.");
  }
  const safeTrim =
    typeof utils.safeTrim === "function"
      ? utils.safeTrim
      : (value) => (value == null ? "" : String(value).trim());
  const sanitizeHeadlineJobTitle =
    typeof utils.sanitizeHeadlineJobTitle === "function"
      ? utils.sanitizeHeadlineJobTitle
      : (value) => safeTrim(value);
  const normalizeLanguageValue = (value) => {
    const raw = safeTrim(value);
    if (!raw) return "";
    const list = ["Portuguese", "English", "Dutch", "Spanish"];
    const match = list.find((lang) => lang.toLowerCase() === raw.toLowerCase());
    return match || "";
  };
  const popupLogger = globalObj.PopupLogger;
  if (!popupLogger || typeof popupLogger !== "object") {
    throw new Error("PopupLogger must be loaded before popup-profile-controller.js.");
  }
  const statusConstants = globalObj.PopupStatusConstants;
  if (!statusConstants || typeof statusConstants !== "object") {
    throw new Error(
      "PopupStatusConstants must be loaded before popup-profile-controller.js.",
    );
  }
  let emptyStateDebugLogged = false;

  function logEmptyStateDebugOnce(payload) {
    if (!globalObj.DEBUG_EMPTY_STATE || emptyStateDebugLogged) return;
    emptyStateDebugLogged = true;
    popupLogger.debug("[LEF][empty-state]", payload);
  }

  function findNoProfileEl() {
    return document.getElementById("noProfileState");
  }

  function setNoProfileStateVisible(visible) {
    ensureNoProfileStateUi();
    const noProfileEl = findNoProfileEl();
    if (!noProfileEl) return;

    if (visible) noProfileEl.classList.remove("hidden");
    else noProfileEl.classList.add("hidden");

    const detailContentEl = document.getElementById("detailProfileContent");
    if (detailContentEl) {
      if (visible) detailContentEl.classList.add("hidden");
      else detailContentEl.classList.remove("hidden");
    }
  }

  function getNoProfileDomDebugInfo() {
    const localEl = document.getElementById("noProfileState");
    const frameEl = document.querySelector("iframe");
    const frameNoProfileEl =
      frameEl?.contentDocument?.getElementById("noProfileState") || null;
    const targetEl = localEl || frameNoProfileEl || null;
    return {
      localExists: Boolean(localEl),
      iframeExists: Boolean(frameEl),
      iframeNoProfileExists: Boolean(frameNoProfileEl),
      targetDocument: localEl ? "popup" : frameNoProfileEl ? "iframe" : "none",
      hasClassHidden: targetEl ? targetEl.classList.contains("hidden") : null,
    };
  }

  function ensureNoProfileStateUi() {
    const tabMainEl = document.getElementById("tabMain");
    if (!tabMainEl) return;

    let detailProfileContentEl = document.getElementById("detailProfileContent");
    if (!detailProfileContentEl) {
      const existing = document.getElementById("detailProfileContent");
      if (existing) {
        detailProfileContentEl = existing;
      } else {
        const wrapper = document.createElement("div");
        wrapper.id = "detailProfileContent";
        while (tabMainEl.firstChild) {
          wrapper.appendChild(tabMainEl.firstChild);
        }
        tabMainEl.appendChild(wrapper);
        detailProfileContentEl = wrapper;
      }
    }

    const noProfileMatches = tabMainEl.querySelectorAll("#noProfileState");
    if (noProfileMatches.length > 1) {
      for (let i = 1; i < noProfileMatches.length; i += 1) {
        noProfileMatches[i].remove();
      }
    }

    const noProfileStateEl = document.getElementById("noProfileState");
    if (!noProfileStateEl) {
      const existing = document.getElementById("noProfileState");
      if (existing) return;

      const stateEl = document.createElement("div");
      stateEl.id = "noProfileState";
      stateEl.className = "empty-state hidden";
      stateEl.setAttribute("aria-live", "polite");

      const innerEl = document.createElement("div");
      innerEl.className = "empty-state-inner";

      const iconEl = document.createElement("div");
      iconEl.className = "empty-state-icon";
      iconEl.setAttribute("aria-hidden", "true");
      iconEl.textContent = "\u{1F464}";

      const textEl = document.createElement("div");
      textEl.className = "empty-state-text";
      textEl.textContent = "Please open a profile in linkedin";

      innerEl.appendChild(iconEl);
      innerEl.appendChild(textEl);
      stateEl.appendChild(innerEl);
      tabMainEl.insertBefore(stateEl, detailProfileContentEl);
    }
  }

  async function getActiveTabForProfileCheck() {
    const [queriedTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!queriedTab) return null;
    if (queriedTab.url || !Number.isInteger(queriedTab.id)) return queriedTab;
    try {
      const refreshedTab = await chrome.tabs.get(queriedTab.id);
      return refreshedTab || queriedTab;
    } catch (_e) {
      return queriedTab;
    }
  }

  async function extractProfileContextFromActiveTab({ source = "" } = {}) {
    const activeTab = await getActiveTabForProfileCheck().catch(() => null);
    if (!Number.isInteger(activeTab?.id)) {
      throw new Error("No active tab found.");
    }
    const activeTabUrl = globalObj.canonicalizeLinkedInUrl(activeTab?.url || "");
    if (globalObj.detectLinkedInPageType(activeTabUrl).page_type !== "person") {
      throw new Error("Active page is not a LinkedIn person profile.");
    }

    let resp = null;
    try {
      resp = await chrome.tabs.sendMessage(activeTab.id, {
        type: "EXTRACT_PROFILE_CONTEXT",
      });
    } catch (e) {
      throw new Error(
        globalObj.getErrorMessage(e) || globalObj.UI_TEXT.couldNotExtractProfileContext,
      );
    }

    if (!resp || !resp?.ok || !resp?.profile) {
      throw new Error(
        globalObj.getErrorMessage(resp?.error) || globalObj.UI_TEXT.couldNotExtractProfileContext,
      );
    }
    const profile = globalObj.getProfileForGeneration(resp.profile);
    const scrapedUrl = globalObj.canonicalizeLinkedInUrl(globalObj.getLinkedinUrlFromContext(profile) || "");
    if (activeTabUrl && scrapedUrl && activeTabUrl !== scrapedUrl) {
      throw new Error("Scraped page URL does not match active tab URL.");
    }
    popupLogger.debug("[LEF][active page scrape]", {
      source,
      active_tab_url: activeTabUrl,
      scraped_url: scrapedUrl,
      is_company_profile: globalObj.isCompanyProfileMode(profile),
    });
    globalObj.latestPersonScrape = profile;
    popupLogger.debug("[LEF][scrape] person saved", {
      linkedin_url: scrapedUrl || activeTabUrl,
    });
    return profile;
  }

  async function extractCompanyContextFromActiveTab({ source = "" } = {}) {
    const activeTab = await getActiveTabForProfileCheck().catch(() => null);
    if (!Number.isInteger(activeTab?.id)) {
      throw new Error("No active tab found.");
    }
    const activeTabUrl = globalObj.canonicalizeLinkedInUrl(activeTab?.url || "");
    if (!/^https:\/\/www\.linkedin\.com\/(company|school)\/[^/?#]+/i.test(activeTabUrl)) {
      throw new Error("Active page is not a LinkedIn company page.");
    }
    popupLogger.debug("[LEF][company ai] company page detected", {
      source,
      url: activeTabUrl,
    });

    const startedAt = Date.now();
    const timeoutMs = 3000;
    const retryDelayMs = 180;
    let resp = null;
    let lastErrorMessage = "";
    let contentBootstrapAttempted = false;

    const isMissingReceiverError = (errorLike) => {
      const text = String(globalObj.getErrorMessage(errorLike) || "").toLowerCase();
      return (
        text.includes("receiving end does not exist") ||
        text.includes("could not establish connection")
      );
    };

    const ensureCompanyContentScriptReady = async () => {
      if (contentBootstrapAttempted) return;
      contentBootstrapAttempted = true;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ["src/content/content.js"],
        });
        popupLogger.debug("[LEF][company ai] content script injected", {
          source,
          tabId: activeTab.id,
        });
      } catch (bootstrapError) {
        popupLogger.debug("[LEF][company ai] content script inject failed", {
          source,
          tabId: activeTab.id,
          error: globalObj.getErrorMessage(bootstrapError),
        });
      }
    };

    while (Date.now() - startedAt < timeoutMs) {
      try {
        resp = await chrome.tabs.sendMessage(activeTab.id, {
          type: "EXTRACT_COMPANY_CONTEXT",
        });
      } catch (e) {
        lastErrorMessage = globalObj.getErrorMessage(e) || "Could not extract company context.";
        if (isMissingReceiverError(e)) {
          await ensureCompanyContentScriptReady();
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }

      if (resp?.ok && resp?.company) break;
      lastErrorMessage =
        globalObj.getErrorMessage(resp?.error) || "Could not extract company context.";
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }

    if (!resp || !resp?.ok || !resp?.company) {
      throw new Error(lastErrorMessage || "Could not extract company context.");
    }

    const company = resp.company || {};
    const linkedin_id = globalObj.canonicalizeLinkedInUrl(company.linkedin_id || company.url || "");
    const companyContext = {
      url: linkedin_id,
      is_company_profile: true,
      linkedin_id,
      company_name: globalObj.safeTrim(company.company_name),
      employee_number: globalObj.safeTrim(company.employee_number),
      sector: globalObj.safeTrim(company.sector),
      city: globalObj.safeTrim(company.city),
      it_members: globalObj.safeTrim(company.it_members),
      company_page_excerpt: globalObj.safeTrim(company.company_page_excerpt),
    };
    if (!linkedin_id) throw new Error("Missing linkedin_id.");
    popupLogger.debug("[LEF][company ai] scraped company context", companyContext);
    globalObj.latestCompanyScrape = companyContext;
    popupLogger.debug("[LEF][scrape] company saved", { linkedin_id });
    return companyContext;
  }

  async function getFreshScrapeForPage(pageInfo, { source = "", force = false } = {}) {
    if (pageInfo?.page_type === "person") {
      if (!force && globalObj.getScrapeUrl(globalObj.latestPersonScrape) === pageInfo.linkedin_id) {
        popupLogger.debug("[LEF][llm] using fresh person scrape", {
          linkedin_url: pageInfo.linkedin_id,
        });
        return globalObj.latestPersonScrape;
      }
      popupLogger.debug("[LEF][scrape] person started", {
        source,
        linkedin_url: pageInfo.linkedin_id,
      });
      try {
        return await extractProfileContextFromActiveTab({ source });
      } catch (e) {
        globalObj.latestPersonScrape = null;
        popupLogger.debug("[LEF][scrape] stale DOM detected", {
          page_type: "person",
          linkedin_url: pageInfo.linkedin_id,
          error: globalObj.getErrorMessage(e),
        });
        throw e;
      }
    }
    if (pageInfo?.page_type === "company") {
      if (!force && globalObj.getScrapeUrl(globalObj.latestCompanyScrape) === pageInfo.linkedin_id) {
        popupLogger.debug("[LEF][llm] using fresh company scrape", {
          linkedin_id: pageInfo.linkedin_id,
        });
        return globalObj.latestCompanyScrape;
      }
      popupLogger.debug("[LEF][scrape] company started", {
        source,
        linkedin_id: pageInfo.linkedin_id,
      });
      try {
        return await extractCompanyContextFromActiveTab({ source });
      } catch (e) {
        globalObj.latestCompanyScrape = null;
        popupLogger.debug("[LEF][scrape] stale DOM detected", {
          page_type: "company",
          linkedin_id: pageInfo.linkedin_id,
          error: globalObj.getErrorMessage(e),
        });
        throw e;
      }
    }
    popupLogger.debug("[LEF][llm] blocked because scrape missing", {
      page_type: pageInfo?.page_type || "unsupported",
    });
    throw new Error("Unsupported LinkedIn page.");
  }

  function applyProfileExtractionFailureState(statusText) {
    globalObj.isProfileEditMode = false;
    globalObj.isProfileSaveInFlight = false;
    globalObj.PopupState.currentProfileContext = null;
    globalObj.PopupState.lastProfileContextSent = {};
    globalObj.PopupState.lastProfileContextEnriched = null;
    globalObj.PopupState.dbInvitationRow = null;
    globalObj.dbCompanyRow = null;
    globalObj.companyPeopleRows = [];
    globalObj.selectedExistingCompanyForLink = null;
    globalObj.linkedPersonCampaignRows = [];
    globalObj.renderLinkedCampaignChips();
    globalObj.setCampaignSelectValue("");
    if (globalObj.previewEl) globalObj.previewEl.textContent = "";
    if (globalObj.firstMessagePreviewEl) globalObj.firstMessagePreviewEl.textContent = "";
    if (globalObj.followupPreviewEl) globalObj.followupPreviewEl.value = "";
    globalObj.clearFreePromptPreview();
    globalObj.updateInviteCopyIconVisibility();
    globalObj.updateMessageTabControls();
    globalObj.updateFollowupCopyIconVisibility();
    globalObj.setCommunicationStatus(
      statusText || globalObj.UI_TEXT.couldNotExtractProfileContext,
    );
    globalObj.applyLifecycleUiState(globalObj.PopupState.dbInvitationRow);
    globalObj.PopupState.outreachMessageStatus = statusConstants.accepted;
    globalObj.renderMessageTab(globalObj.PopupState.outreachMessageStatus);
    globalObj.renderDetailHeader();
    globalObj.updatePhaseButtons();
  }

  async function refreshAll() {
    globalObj.selectedCompanyFromListLinkedinUrl = "";
    globalObj.setCompanyUrlMismatchBannerVisible(false);
    const activeTab = await getActiveTabForProfileCheck().catch(() => null);
    const tabUrl = activeTab?.url || "";
    const pageInfo = globalObj.detectLinkedInPageType(tabUrl);
    popupLogger.debug("[LEF][page] detected", pageInfo);
    globalObj.timingLog("UI refresh requested", {
      source: globalObj.IS_SIDE_PANEL_CONTEXT ? "sidepanel/popup" : "popup",
      tab_url: tabUrl,
    });
    const { isProfileOpen, matchedRule } = globalObj.getProfileMatchForUrl(tabUrl);

    if (!isProfileOpen) {
      setNoProfileStateVisible(true);
      logEmptyStateDebugOnce({
        tabId: activeTab?.id ?? null,
        tabUrl: tabUrl || null,
        tabStatus: activeTab?.status || null,
        isProfileOpen,
        matchedRule,
        dom: getNoProfileDomDebugInfo(),
      });
      globalObj.isProfileEditMode = false;
      globalObj.isProfileSaveInFlight = false;
      globalObj.PopupState.currentProfileContext = null;
      globalObj.PopupState.lastProfileContextSent = {};
      globalObj.PopupState.lastProfileContextEnriched = null;
      globalObj.latestPersonScrape = null;
      globalObj.latestCompanyScrape = null;
      globalObj.PopupState.dbInvitationRow = null;
      globalObj.dbCompanyRow = null;
      globalObj.companyPeopleRows = [];
      globalObj.selectedExistingCompanyForLink = null;
      globalObj.linkedPersonCampaignRows = [];
      globalObj.renderLinkedCampaignChips();
      globalObj.setCampaignSelectValue("");
      globalObj.clearFreePromptPreview();
      globalObj.updateMessageTabControls();
      globalObj.applyLifecycleUiState(globalObj.PopupState.dbInvitationRow);
      globalObj.PopupState.outreachMessageStatus = statusConstants.accepted;
      globalObj.renderMessageTab(globalObj.PopupState.outreachMessageStatus);
      globalObj.setCommunicationStatus(globalObj.UI_TEXT.lifecycleOpenLinkedInProfileFirst);
      globalObj.renderDetailHeader();
      globalObj.updatePhaseButtons();
      return false;
    }

    try {
      setNoProfileStateVisible(false);
      logEmptyStateDebugOnce({
        tabId: activeTab?.id ?? null,
        tabUrl: tabUrl || null,
        tabStatus: activeTab?.status || null,
        isProfileOpen,
        matchedRule,
        dom: getNoProfileDomDebugInfo(),
      });
      if (pageInfo.page_type === "company") {
        popupLogger.debug("[LEF][db] load requested", {
          page_type: "company",
          ts: Date.now(),
          linkedin_id: pageInfo.linkedin_id,
        });
        globalObj.PopupState.currentProfileContext = {
          url: pageInfo.linkedin_id,
          linkedin_id: pageInfo.linkedin_id,
          is_company_profile: true,
        };
        globalObj.PopupState.lastProfileContextSent = globalObj.PopupState.currentProfileContext;
        globalObj.PopupState.lastProfileContextEnriched = null;
        globalObj.dbCompanyRow = null;
        globalObj.companyPeopleRows = [];
        globalObj.selectedExistingCompanyForLink = null;
        globalObj.updateMessageTabControls();
        await globalObj.refreshCompanyRowFromDb({
          linkedin_id: pageInfo.linkedin_id,
          allowNameSearch: false,
        });
        popupLogger.debug(globalObj.dbCompanyRow ? "[LEF][db] load found" : "[LEF][db] load not found", {
          page_type: "company",
          linkedin_id: pageInfo.linkedin_id,
        });
        globalObj.renderDetailHeader();
        globalObj.updatePhaseButtons();
        getFreshScrapeForPage(pageInfo, { source: "refresh", force: true })
          .then((profileContext) => {
            globalObj.PopupState.currentProfileContext = profileContext;
            globalObj.PopupState.lastProfileContextSent = profileContext;
            globalObj.renderDetailHeader();
          })
          .catch(() => null);
        if (globalObj.IS_SIDE_PANEL_CONTEXT) {
          globalObj.setActiveTab("detail", { userInitiated: true });
        }
        return true;
      }

      if (pageInfo.page_type !== "person") {
        throw new Error(globalObj.UI_TEXT.couldNotExtractProfileContext);
      }

      popupLogger.debug("[LEF][db] load requested", {
        page_type: "person",
        linkedin_url: pageInfo.linkedin_id,
      });
      const previousProfileUrl = globalObj.canonicalizeLinkedInUrl(
        globalObj.getLinkedinUrlFromContext(globalObj.PopupState.currentProfileContext) || "",
      );
      if (previousProfileUrl !== pageInfo.linkedin_id) {
        globalObj.clearFreePromptPreview();
      }
      globalObj.PopupState.currentProfileContext = { url: pageInfo.linkedin_id };
      globalObj.PopupState.lastProfileContextSent = globalObj.PopupState.currentProfileContext;
      globalObj.dbCompanyRow = null;
      globalObj.companyPeopleRows = [];
      globalObj.selectedExistingCompanyForLink = null;
      globalObj.PopupState.lastProfileContextEnriched = null;
      globalObj.updateMessageTabControls();
      await globalObj.refreshInvitationRowFromDb();
      popupLogger.debug(globalObj.PopupState.dbInvitationRow ? "[LEF][db] load found" : "[LEF][db] load not found", {
        page_type: "person",
        linkedin_url: pageInfo.linkedin_id,
      });
      getFreshScrapeForPage(pageInfo, {
        source: "refresh",
        force: true,
      })
        .then(async (profileContext) => {
          globalObj.timingLog("extraction completed", {
            scraped_url: globalObj.getLinkedinUrlFromContext(profileContext) || "",
            is_company_profile: globalObj.isCompanyProfileMode(profileContext),
          });
          globalObj.PopupState.currentProfileContext = profileContext;
          globalObj.PopupState.lastProfileContextSent = profileContext;
          globalObj.renderDetailHeader();
          await globalObj.refreshCompanySuggestionUiForCurrentInvitation();
        })
        .catch(() => null);
      globalObj.renderDetailHeader();
      globalObj.updatePhaseButtons();
      if (globalObj.IS_SIDE_PANEL_CONTEXT) {
        globalObj.setActiveTab("detail", { userInitiated: true });
      }
      return true;
    } catch (_e) {
      setNoProfileStateVisible(false);
      applyProfileExtractionFailureState(
        globalObj.getErrorMessage(_e) || globalObj.UI_TEXT.couldNotExtractProfileContext,
      );
      return false;
    }
  }

  async function loadProfileContextOnOpen() {
    try {
      return await refreshAll();
    } catch (_e) {
      setNoProfileStateVisible(false);
      applyProfileExtractionFailureState(globalObj.UI_TEXT.couldNotExtractProfileContext);
      return false;
    }
  }

  async function extractCompanyDetailsFromLlm(scrapedProfileContext = null) {
    const profileContext = scrapedProfileContext;
    if (!profileContext) {
      popupLogger.debug("[LEF][llm] blocked because scrape missing", {
        page_type: "company",
      });
      throw new Error("Missing company scrape.");
    }
    state.currentProfileContext = profileContext;
    state.lastProfileContextSent = profileContext;
    const linkedin_id = globalObj.normalizeCompanyLinkedinId(profileContext);
    if (!linkedin_id) throw new Error("Missing linkedin_id.");
    if (!globalObj.isCompanyProfileMode(profileContext)) {
      throw new Error("Active LinkedIn page is not a company profile.");
    }
    popupLogger.debug("[LEF][company profile detected]", { linkedin_id });
    popupLogger.debug("[LEF][company scrape result]", {
      company_name: profileContext.company_name || "",
      employee_number: profileContext.employee_number || "",
      sector: profileContext.sector || "",
      city: profileContext.city || "",
      it_members: profileContext.it_members || "",
    });

    const [{ apiKey: apiKeyLocal }, { model }] = await Promise.all([
      chrome.storage.local.get(["apiKey"]),
      chrome.storage.sync.get(["model"]),
    ]);
    let apiKey = (apiKeyLocal || "").trim();
    if (!apiKey) {
      const typed = (dom.apiKeyEl?.value || "").trim();
      if (typed) {
        apiKey = typed;
        await chrome.storage.local.set({ apiKey });
      }
    }
    if (!apiKey) {
      globalObj.setActiveTab("config");
      throw new Error(globalObj.UI_TEXT.setApiKeyInConfig);
    }

    popupLogger.debug("[LEF][company LLM payload]", {
      linkedin_id,
      company_name: profileContext.company_name || "",
      employee_number: profileContext.employee_number || "",
      sector: profileContext.sector || "",
      city: profileContext.city || "",
      it_members: profileContext.it_members || "",
      excerpt_chars: String(profileContext.company_page_excerpt || "").length,
    });
    const rawExcerpt = String(profileContext.company_page_excerpt || "");
    const personLikeSignals = [
      /enviar mensagem/i,
      /sales navigator/i,
      /conex[Ãµo]es em comum/i,
      /dados de contato/i,
      /gerente de ti/i,
    ];
    const personLikeHits = personLikeSignals.reduce(
      (sum, pattern) => (pattern.test(rawExcerpt) ? sum + 1 : sum),
      0,
    );
    const isPersonLikeExcerpt = personLikeHits >= 2;
    const companyPayload = {
      url: linkedin_id,
      is_company_profile: true,
      linkedin_id,
      company_name: profileContext.company_name || "",
      employee_number: profileContext.employee_number || "",
      sector: profileContext.sector || "",
      city: profileContext.city || "",
      it_members: profileContext.it_members || "",
      company_page_excerpt: isPersonLikeExcerpt ? "" : rawExcerpt,
    };
    popupLogger.debug("[LEF][company ai] payload", companyPayload);
    popupLogger.debug("[LEF][ai] payload sent", companyPayload);
    const enrichResult = await globalObj.sendRuntimeMessage("ENRICH_COMPANY_PROFILE", {
      payload: {
        apiKey,
        model: (model || "gpt-4.1").trim(),
        profile: companyPayload,
      },
    });
    const enrichResp = enrichResult.data || {};
    if (!enrichResult.ok || !enrichResp?.ok) {
      throw new Error(globalObj.getErrorMessage(enrichResult.error || enrichResp?.error));
    }
    popupLogger.debug("[LEF][company AI extraction result]", enrichResp);
    return {
      linkedin_id,
      company_name: safeTrim(enrichResp.company_name || profileContext.company_name),
      employee_number: safeTrim(
        enrichResp.employee_number || profileContext.employee_number,
      ),
      sector: safeTrim(enrichResp.sector || profileContext.sector),
      city: safeTrim(enrichResp.city || profileContext.city),
      it_members: safeTrim(enrichResp.it_members || profileContext.it_members),
    };
  }

  async function extractProfileDetailsFromLlm(scrapedProfileContext = null) {
    const profileContext = scrapedProfileContext;
    if (!profileContext) {
      popupLogger.debug("[LEF][llm] blocked because scrape missing", {
        page_type: "person",
      });
      throw new Error("Missing person scrape.");
    }
    state.currentProfileContext = profileContext;
    state.lastProfileContextSent = profileContext;
    state.lastProfileContextEnriched = null;
    globalObj.renderDetailHeader();

    const linkedin_url = globalObj.getLinkedinUrlFromContext(state.currentProfileContext);
    if (!linkedin_url) {
      throw new Error(globalObj.UI_TEXT.missingLinkedinUrl);
    }

    const [{ apiKey: apiKeyLocal }, { model }] = await Promise.all([
      chrome.storage.local.get(["apiKey"]),
      chrome.storage.sync.get(["model"]),
    ]);

    let apiKey = (apiKeyLocal || "").trim();
    if (!apiKey) {
      const typed = (dom.apiKeyEl?.value || "").trim();
      if (typed) {
        apiKey = typed;
        await chrome.storage.local.set({ apiKey });
      }
    }

    if (!apiKey) {
      globalObj.setActiveTab("config");
      throw new Error(globalObj.UI_TEXT.setApiKeyInConfig);
    }

    const personPayload = { ...profileContext };
    popupLogger.debug("[LEF][ai] payload sent", personPayload);
    const enrichResult = await globalObj.sendRuntimeMessage("ENRICH_PROFILE", {
      payload: {
        apiKey,
        model: (model || "gpt-4.1").trim(),
        profile: personPayload,
      },
    });
    const enrichResp = enrichResult.data || {};

    if (!enrichResult.ok || !enrichResp?.ok) {
      throw new Error(globalObj.getErrorMessage(enrichResult.error || enrichResp?.error));
    }

    const llmCompany = (enrichResp.company || "").trim();
    const llmHeadline = sanitizeHeadlineJobTitle(enrichResp.headline || "");
    const llmLanguage = (enrichResp.language || "").trim();

    if (llmCompany) {
      state.currentProfileContext.company = llmCompany;
      if (dom.detailCompanyEl) dom.detailCompanyEl.value = llmCompany;
    }
    if (llmHeadline) {
      state.currentProfileContext.headline = llmHeadline;
      if (dom.detailHeadlineEl) dom.detailHeadlineEl.value = llmHeadline;
    }
    const normalizedLlmLanguage = normalizeLanguageValue(llmLanguage);
    if (normalizedLlmLanguage) {
      await globalObj.setLanguage(normalizedLlmLanguage);
    }

    const nameFromProfile = (utils.getFullNameFromContext(state.currentProfileContext) || "")
      .toString()
      .trim();
    const nameFromUi = (dom.detailPersonNameEl?.value || "").trim();
    const full_name =
      nameFromProfile || (nameFromUi && nameFromUi !== "-" ? nameFromUi : "");

    return {
      linkedin_url,
      full_name,
      company: llmCompany,
      headline: llmHeadline,
      language: globalObj.getLanguage(),
    };
  }

  async function extractAndPersistProfileDetails() {
    const activeTab = await getActiveTabForProfileCheck().catch(() => null);
    const activeTabUrl = globalObj.canonicalizeLinkedInUrl(activeTab?.url || "");
    const pageInfo = globalObj.detectLinkedInPageType(activeTabUrl);
    popupLogger.debug("[LEF][ai] active URL", { ts: Date.now(), url: activeTabUrl });
    if (pageInfo.page_type === "company") {
      const companyContext = await getFreshScrapeForPage(pageInfo, {
        source: "llm_click",
      });
      popupLogger.debug("[LEF][llm] using fresh company scrape", {
        linkedin_id: pageInfo.linkedin_id,
      });
      state.currentProfileContext = companyContext;
      state.lastProfileContextSent = companyContext;
      state.lastProfileContextEnriched = null;
      globalObj.renderDetailHeader();
      const extracted = await extractCompanyDetailsFromLlm(companyContext);
      const saveResult = await globalObj.sendRuntimeMessage("DB_UPSERT_COMPANY_PROFILE", {
        payload: extracted,
      });
      const saveResp = saveResult.data || {};
      if (!saveResult.ok || !saveResp?.ok) {
        throw new Error(
          `${globalObj.UI_TEXT.dbErrorPrefix} ${globalObj.getErrorMessage(saveResult.error || saveResp?.error)}`,
        );
      }
      return;
    }

    if (pageInfo.page_type !== "person") {
      throw new Error("Active page is not a LinkedIn person profile.");
    }
    const profileContext = await getFreshScrapeForPage(pageInfo, {
      source: "llm_click",
    });
    popupLogger.debug("[LEF][llm] using fresh person scrape", {
      linkedin_url: pageInfo.linkedin_id,
    });
    state.currentProfileContext = profileContext;
    state.lastProfileContextSent = profileContext;
    state.lastProfileContextEnriched = null;
    globalObj.renderDetailHeader();

    const extracted = await extractProfileDetailsFromLlm(profileContext);

    globalObj.setFooterUpdatingStatus();
    const saveResult = await globalObj.sendRuntimeMessage(
      "DB_UPDATE_PROFILE_DETAILS_ONLY",
      {
        payload: {
          linkedin_url: extracted.linkedin_url,
          company: extracted.company || undefined,
          headline: extracted.headline || undefined,
          language: extracted.language || globalObj.getLanguage(),
        },
      },
    );
    const saveResp = saveResult.data || {};

    if (!saveResult.ok || !saveResp?.ok) {
      throw new Error(
        `${globalObj.UI_TEXT.dbErrorPrefix} ${globalObj.getErrorMessage(saveResult.error || saveResp?.error)}`,
      );
    }
  }

  globalObj.PopupProfileController = Object.freeze({
    logEmptyStateDebugOnce,
    findNoProfileEl,
    setNoProfileStateVisible,
    getNoProfileDomDebugInfo,
    ensureNoProfileStateUi,
    getActiveTabForProfileCheck,
    extractProfileContextFromActiveTab,
    extractCompanyContextFromActiveTab,
    getFreshScrapeForPage,
    extractCompanyDetailsFromLlm,
    extractProfileDetailsFromLlm,
    extractAndPersistProfileDetails,
    applyProfileExtractionFailureState,
    refreshAll,
    loadProfileContextOnOpen,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);

