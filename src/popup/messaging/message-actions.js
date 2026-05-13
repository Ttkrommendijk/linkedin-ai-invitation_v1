
async function extractCompanyDetailsFromLlm(scrapedProfileContext = null) {
  const profileContext = scrapedProfileContext;
  if (!profileContext) {
    PopupLogger.debug("[LEF][llm] blocked because scrape missing", {
      page_type: "company",
    });
    throw new Error("Missing company scrape.");
  }
  PopupState.currentProfileContext = profileContext;
  PopupState.lastProfileContextSent = profileContext;
  const linkedin_id = normalizeCompanyLinkedinId(profileContext);
  if (!linkedin_id) throw new Error("Missing linkedin_id.");
  if (!isCompanyProfileMode(profileContext)) {
    throw new Error("Active LinkedIn page is not a company profile.");
  }
  PopupLogger.debug("[LEF][company profile detected]", { linkedin_id });
  PopupLogger.debug("[LEF][company scrape result]", {
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
    const typed = (apiKeyEl.value || "").trim();
    if (typed) {
      apiKey = typed;
      await chrome.storage.local.set({ apiKey });
    }
  }
  if (!apiKey) {
    setActiveTab("config");
    throw new Error(UI_TEXT.setApiKeyInConfig);
  }

  PopupLogger.debug("[LEF][company LLM payload]", {
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
    /conex[õo]es em comum/i,
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
  PopupLogger.debug("[LEF][company ai] payload", companyPayload);
  PopupLogger.debug("[LEF][ai] payload sent", companyPayload);
  const enrichResult = await sendRuntimeMessage("ENRICH_COMPANY_PROFILE", {
    payload: {
      apiKey,
      model: (model || "gpt-4.1").trim(),
      profile: companyPayload,
    },
  });
  const enrichResp = enrichResult.data || {};
  if (!enrichResult.ok || !enrichResp?.ok) {
    throw new Error(getErrorMessage(enrichResult.error || enrichResp?.error));
  }
  PopupLogger.debug("[LEF][company AI extraction result]", enrichResp);
  return {
    linkedin_id,
    company_name: safeTrim(
      enrichResp.company_name || profileContext.company_name,
    ),
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
    PopupLogger.debug("[LEF][llm] blocked because scrape missing", {
      page_type: "person",
    });
    throw new Error("Missing person scrape.");
  }
  PopupState.currentProfileContext = profileContext;
  PopupState.lastProfileContextSent = profileContext;
  PopupState.lastProfileContextEnriched = null;
  renderDetailHeader();

  const linkedin_url = getLinkedinUrlFromContext(
    PopupState.currentProfileContext,
  );
  if (!linkedin_url) {
    throw new Error(UI_TEXT.missingLinkedinUrl);
  }

  const [{ apiKey: apiKeyLocal }, { model }] = await Promise.all([
    chrome.storage.local.get(["apiKey"]),
    chrome.storage.sync.get(["model"]),
  ]);

  let apiKey = (apiKeyLocal || "").trim();
  if (!apiKey) {
    const typed = (apiKeyEl.value || "").trim();
    if (typed) {
      apiKey = typed;
      await chrome.storage.local.set({ apiKey });
    }
  }

  if (!apiKey) {
    setActiveTab("config");
    throw new Error(UI_TEXT.setApiKeyInConfig);
  }

  const personPayload = { ...profileContext };
  PopupLogger.debug("[LEF][ai] payload sent", personPayload);
  const enrichResult = await sendRuntimeMessage("ENRICH_PROFILE", {
    // prompt: buildProfileExtractionPrompt (Enrich/Register)
    payload: {
      apiKey,
      model: (model || "gpt-4.1").trim(),
      profile: personPayload,
    },
  });
  const enrichResp = enrichResult.data || {};

  if (!enrichResult.ok || !enrichResp?.ok) {
    throw new Error(getErrorMessage(enrichResult.error || enrichResp?.error));
  }

  const llmCompany = (enrichResp.company || "").trim();
  const llmHeadline = sanitizeHeadlineJobTitle(enrichResp.headline || "");
  const llmLanguage = (enrichResp.language || "").trim();

  if (llmCompany) {
    PopupState.currentProfileContext.company = llmCompany;
    if (detailCompanyEl) detailCompanyEl.value = llmCompany;
  }
  if (llmHeadline) {
    PopupState.currentProfileContext.headline = llmHeadline;
    if (detailHeadlineEl) detailHeadlineEl.value = llmHeadline;
  }
  const normalizedLlmLanguage = normalizeLanguageValue(llmLanguage);
  if (normalizedLlmLanguage) {
    await setLanguage(normalizedLlmLanguage);
  }

  const nameFromProfile = (
    getFullNameFromContext(PopupState.currentProfileContext) || ""
  )
    .toString()
    .trim();
  const nameFromUi = (detailPersonNameEl?.value || "").trim();
  const full_name =
    nameFromProfile || (nameFromUi && nameFromUi !== "-" ? nameFromUi : "");

  return {
    linkedin_url,
    full_name,
    company: llmCompany,
    headline: llmHeadline,
    language: getLanguage(),
  };
}

if (!enrichProfileBtnEl) {
  PopupLogger.error("[LEF] enrichProfileBtn element not found");
} else {
  enrichProfileBtnEl.addEventListener("click", async () => {
    PopupLogger.debug("[LEF][ai] button clicked", { ts: Date.now() });
    setFooterLlmStatus();
    try {
      await extractAndPersistProfileDetails();
      await refreshInvitationRowFromDb();
      renderDetailHeader();
    } catch (e) {
      PopupLogger.error("[LEF] enrichProfile failed", e);
      setFooterStatus(`${UI_TEXT.errorPrefix} ${getErrorMessage(e)}`);
    } finally {
      setFooterReady();
    }
  });
}

function bindProfileEditControls() {
  editProfileBtnEl?.addEventListener("click", () => {
    setProfileEditMode(true);
  });

  cancelProfileEditBtnEl?.addEventListener("click", () => {
    if (isProfileSaveInFlight) return;
    PopupCompanyController.setSelectedCompanyForEditDropdown(null);
    setProfileEditMode(false);
  });

  saveProfileFieldsBtnEl?.addEventListener("click", async () => {
    if (isProfileSaveInFlight) return;

    const targetUrl = getLinkedinUrlFromContext(
      PopupState.currentProfileContext,
    );
    if (!targetUrl) {
      setFooterStatus(
        isCompanyProfileMode()
          ? "Missing linkedin_id."
          : UI_TEXT.missingLinkedinUrl,
      );
      return;
    }

    isProfileSaveInFlight = true;
    renderProfileEditControls();
    setFooterUpdatingStatus();

    try {
      if (isCompanyProfileMode()) {
        syncSelectedExistingCompanyFromInput();
        const linkedExistingCompanyId = safeTrim(
          PopupCompanyController.getSelectedExistingCompanyForLink()
            ?.company_id,
        );
        const linkedExistingCompanyName = safeTrim(
          PopupCompanyController.getSelectedExistingCompanyForLink()
            ?.company_name,
        );
        const isCreateFlow = !dbCompanyRow && !linkedExistingCompanyId;
        let payload = buildCompanyProfileSavePayload();
        if (isCreateFlow) {
          const pageInfo = detectLinkedInPageType(targetUrl);
          const companyContext = await getFreshScrapeForPage(pageInfo, {
            source: "company_create",
            force: true,
          });
          const enrichedPayload =
            await extractCompanyDetailsFromLlm(companyContext);
          payload = {
            ...payload,
            ...enrichedPayload,
            company_name: safeTrim(
              enrichedPayload.company_name || payload.company_name,
            ),
            employee_number: safeTrim(
              enrichedPayload.employee_number || payload.employee_number,
            ),
            sector: safeTrim(enrichedPayload.sector || payload.sector),
            city: safeTrim(enrichedPayload.city || payload.city),
            it_members: safeTrim(
              enrichedPayload.it_members || payload.it_members,
            ),
          };
        }
        const result = linkedExistingCompanyId
          ? await sendRuntimeMessage("DB_UPDATE_COMPANY_BY_ID", {
              payload: {
                ...payload,
                company_id: linkedExistingCompanyId,
                company_name: linkedExistingCompanyName || payload.company_name,
              },
            })
          : await sendRuntimeMessage("DB_UPSERT_COMPANY_PROFILE", {
              payload,
            });
        const resp = result.data || {};
        if (!result.ok || !resp?.ok) {
          throw new Error(getErrorMessage(result.error || resp?.error));
        }
        if (PopupState.currentProfileContext) {
          PopupState.currentProfileContext.company_name = payload.company_name;
          PopupState.currentProfileContext.employee_number =
            payload.employee_number;
          PopupState.currentProfileContext.sector = payload.sector;
          PopupState.currentProfileContext.city = payload.city;
          PopupState.currentProfileContext.it_members = payload.it_members;
        }
        isProfileEditMode = false;
        renderProfileEditControls();
        await refreshCompanyRowFromDb();
        setFooterStatus("Saved.");
        return;
      }

      const full_name = normalizeWhitespace(
        (detailPersonNameEl?.value || "").trim() === "-"
          ? ""
          : detailPersonNameEl?.value || "",
      );
      const company = normalizeWhitespace(
        (detailCompanyEl?.value || "").trim() === "-"
          ? ""
          : detailCompanyEl?.value || "",
      );
      const headline = sanitizeHeadlineJobTitle(
        (detailHeadlineEl?.value || "").trim() === "-"
          ? ""
          : detailHeadlineEl?.value || "",
      );
      const comments = safeTrim(
        (detailCommentsEl?.value || "").trim() === "-"
          ? ""
          : detailCommentsEl?.value || "",
      );
      const phone = safeTrim(
        (detailPhoneEl?.value || "").trim() === "-"
          ? ""
          : detailPhoneEl?.value || "",
      );
      const email = safeTrim(
        (detailEmailEl?.value || "").trim() === "-"
          ? ""
          : detailEmailEl?.value || "",
      );
      syncSelectedCompanyFromDropdownInput();
      const selectedCompanyForSave =
        PopupCompanyController.getSelectedCompanyForEditDropdown();
      const selectedCompanyId = safeTrim(selectedCompanyForSave?.company_id);
      const selectedCompanyName = safeTrim(
        selectedCompanyForSave?.company_name,
      );
      const companyToSave = selectedCompanyName || company;

      const result = await sendRuntimeMessage("DB_UPDATE_PROFILE_FIELDS", {
        payload: {
          linkedin_url: targetUrl,
          full_name,
          company: companyToSave,
          company_id: selectedCompanyId || undefined,
          headline,
          comments,
          phone,
          email,
        },
      });
      const resp = result.data || {};

      if (!result.ok || !resp?.ok) {
        throw new Error(getErrorMessage(result.error || resp?.error));
      }

      if (PopupState.currentProfileContext) {
        PopupState.currentProfileContext.name = full_name;
        PopupState.currentProfileContext.full_name = full_name;
        PopupState.currentProfileContext.company = companyToSave;
        PopupState.currentProfileContext.headline = headline;
        PopupState.currentProfileContext.comments = comments;
        PopupState.currentProfileContext.phone = phone;
        PopupState.currentProfileContext.email = email;
      }
      if (PopupState.dbInvitationRow) {
        PopupState.dbInvitationRow.full_name = full_name;
        PopupState.dbInvitationRow.company = companyToSave;
        if (selectedCompanyId)
          PopupState.dbInvitationRow.company_id = selectedCompanyId;
        PopupState.dbInvitationRow.headline = headline;
        PopupState.dbInvitationRow.comments = comments;
        PopupState.dbInvitationRow.phone = phone;
        PopupState.dbInvitationRow.email = email;
      }
      if (selectedCompanyId) {
        PopupLogger.debug("[LEF][company dropdown] company saved", {
          company_id: selectedCompanyId,
          company_name: companyToSave,
        });
      }

      isProfileEditMode = false;
      renderProfileEditControls();
      await refreshInvitationRowFromDb({ preserveTabs: true });
      setFooterStatus("Saved.");
    } catch (e) {
      setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
    } finally {
      isProfileSaveInFlight = false;
      renderProfileEditControls();
    }
  });
}

function bindCompanyEvents() {
  bindProfileEditControls();
}

function bindOpenSidePanelClickHandler() {
  if (!openSidePanelBtnEl) return;
  if (openSidePanelBtnEl.dataset.sidePanelBound === "1") return;
  openSidePanelBtnEl.dataset.sidePanelBound = "1";
  openSidePanelBtnEl.addEventListener("click", async () => {
    setFooterFetchingStatus();
    try {
      debugLog("[sidepanel] open requested from popup click");
      const activeTabResult = await sendRuntimeMessage(
        "GET_ACTIVE_TAB_CONTEXT",
      );
      const activeTabResp = activeTabResult.data || {};
      const tabId = activeTabResp?.data?.tabId;
      if (!Number.isInteger(tabId)) {
        setFooterStatus(UI_TEXT.sidePanelNotAvailable);
        return;
      }
      await chrome.sidePanel.setOptions({
        tabId,
        path: "sidepanel.html",
        enabled: true,
      });
      await chrome.sidePanel.open({ tabId });
      setFooterStatus(UI_TEXT.openedSidePanel);
      window.close();
    } catch (e) {
      PopupLogger.error("[sidepanel] open failed", e);
      setFooterStatus(UI_TEXT.sidePanelNotAvailable);
    } finally {
      setFooterReady();
    }
  });
}

bindOpenSidePanelClickHandler();

async function handleAcceptCompanySuggestion() {
  if (isAcceptingCompanySuggestion) return;
  const companySuggestion = PopupCompanyController.getCompanySuggestionState();
  if (!companySuggestion?.company_id || !companySuggestion?.company_name)
    return;
  const linkedin_url = getLinkedinUrlFromContext(
    PopupState.currentProfileContext,
  );
  if (!linkedin_url) {
    setFooterStatus(UI_TEXT.missingLinkedinUrl);
    return;
  }

  isAcceptingCompanySuggestion = true;
  if (acceptCompanySuggestionBtnEl)
    acceptCompanySuggestionBtnEl.disabled = true;
  setFooterUpdatingStatus();
  try {
    const result = await sendRuntimeMessage("DB_CONFIRM_COMPANY_LINK", {
      payload: {
        linkedin_url,
        company_id: companySuggestion.company_id,
        company_name: companySuggestion.company_name,
      },
    });
    const resp = result.data || {};
    if (!result.ok || !resp?.ok) {
      throw new Error(getErrorMessage(result.error || resp?.error));
    }
    PopupLogger.debug("[LEF][company suggestion accepted]", {
      linkedin_url,
      company_id: companySuggestion.company_id,
      company_name: companySuggestion.company_name,
    });
    await refreshInvitationRowFromDb({ preserveTabs: true });
    setFooterStatus("Saved.");
  } catch (e) {
    setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
  } finally {
    isAcceptingCompanySuggestion = false;
    if (acceptCompanySuggestionBtnEl)
      acceptCompanySuggestionBtnEl.disabled = false;
    if (companyQuickLinkBtn) companyQuickLinkBtn.disabled = false;
  }
}

acceptCompanySuggestionBtnEl?.addEventListener(
  "click",
  handleAcceptCompanySuggestion,
);

companyLinkSearchInputEl?.addEventListener("input", () => {
  PopupCompanyController.setSelectedCompanyForEditDropdown(null);
  if (companyLinkSearchDebounceTimer) {
    clearTimeout(companyLinkSearchDebounceTimer);
  }
  companyLinkSearchDebounceTimer = setTimeout(() => {
    searchCompaniesForEditDropdown(companyLinkSearchInputEl.value || "").catch(
      () => null,
    );
  }, 250);
});

companyLinkSearchInputEl?.addEventListener("change", () => {
  syncSelectedCompanyFromDropdownInput();
});

detailPersonNameEl?.addEventListener("click", async (event) => {
  if (isProfileEditMode) return;
  const targetUrl = getDetailNameLinkedinUrl();
  if (!isLinkedInProfileLikeUrl(targetUrl)) return;
  await openLinkedIn(targetUrl, { newTab: shouldOpenInNewTab(event) });
});

detailPersonNameEl?.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (isProfileEditMode) return;
  const targetUrl = getDetailNameLinkedinUrl();
  if (!isLinkedInProfileLikeUrl(targetUrl)) return;
  event.preventDefault();
  await openLinkedIn(targetUrl, { newTab: shouldOpenInNewTab(event) });
});

companyLinkedNameEl?.addEventListener("click", async (event) => {
  if (isProfileEditMode || isCompanyProfileMode()) return;
  const companyUrl = safeTrim(companyLinkedNameEl.dataset.companyUrl || "");
  if (!companyUrl) return;
  await openLinkedIn(companyUrl, { newTab: shouldOpenInNewTab(event) });
});

companyLinkedNameEl?.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (isProfileEditMode || isCompanyProfileMode()) return;
  const companyUrl = safeTrim(companyLinkedNameEl.dataset.companyUrl || "");
  if (!companyUrl) return;
  event.preventDefault();
  await openLinkedIn(companyUrl, { newTab: shouldOpenInNewTab(event) });
});

companyExistingLinkInputEl?.addEventListener("input", () => {
  PopupCompanyController.setSelectedExistingCompanyForLinkState(null);
  updateExistingCompanyLinkUi();
  if (companyExistingLinkDebounceTimer) {
    clearTimeout(companyExistingLinkDebounceTimer);
  }
  companyExistingLinkDebounceTimer = setTimeout(() => {
    searchExistingCompaniesForCompanyPage(
      companyExistingLinkInputEl.value || "",
    ).catch(() => null);
  }, 250);
});

companyExistingLinkInputEl?.addEventListener("change", () => {
  syncSelectedExistingCompanyFromInput();
});

companyExistingLinkButtonEl?.addEventListener("click", async () => {
  try {
    if (companyExistingLinkButtonEl)
      companyExistingLinkButtonEl.disabled = true;
    await linkSelectedExistingCompany();
  } catch (e) {
    setFooterStatus(`${UI_TEXT.dbErrorPrefix} ${getErrorMessage(e)}`);
  } finally {
    updateExistingCompanyLinkUi();
    setFooterReady();
  }
});

companyQuickLinkBtn?.addEventListener("click", async () => {
  if (isProfileEditMode || isCompanyProfileMode()) return;
  PopupLogger.debug("[LEF][quick-link][click]", {
    suggestionCompanyId: safeTrim(
      PopupCompanyController.getCompanySuggestionState()?.company_id,
    ),
    suggestionCompanyName: safeTrim(
      PopupCompanyController.getCompanySuggestionState()?.company_name,
    ),
  });
  if (companyQuickLinkBtn) companyQuickLinkBtn.disabled = true;
  await handleAcceptCompanySuggestion();
});

companyUrlMismatchBannerEl?.addEventListener("click", async (event) => {
  const targetUrl = safeTrim(selectedCompanyFromListLinkedinUrl);
  if (!targetUrl) return;
  await openLinkedIn(targetUrl, { newTab: shouldOpenInNewTab(event) });
});

companyPeopleListEl?.addEventListener("click", async (event) => {
  const target =
    event.target instanceof Element
      ? event.target.closest(".company-person-card")
      : null;
  if (!target) return;
  const linkedinUrl = safeTrim(target.dataset.linkedinUrl || "");
  if (!linkedinUrl) return;
  await openLinkedIn(linkedinUrl, { newTab: shouldOpenInNewTab(event) });
});

companyPeopleListEl?.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target =
    event.target instanceof Element
      ? event.target.closest(".company-person-card")
      : null;
  if (!target) return;
  const linkedinUrl = safeTrim(target.dataset.linkedinUrl || "");
  if (!linkedinUrl) return;
  event.preventDefault();
  await openLinkedIn(linkedinUrl, { newTab: shouldOpenInNewTab(event) });
});

detailCommentsEl?.addEventListener("input", () => {
  autoResizeCommentsField();
});

setCopyIconDefaultState(copyInviteIconEl);
setCopyIconDefaultState(copyFreePromptBtnEl);
updateFreePromptCopyButtonState();
