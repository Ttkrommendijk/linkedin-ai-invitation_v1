function initPersonModule(deps = {}) {
Object.assign(globalThis, deps);
const MESSAGE_TYPES =
  globalThis.PopupMessageTypes;
const STATUS_CONSTANTS =
  globalThis.PopupStatusConstants;
if (!MESSAGE_TYPES || !STATUS_CONSTANTS) {
  throw new Error("Popup shared constants must be loaded before popup modules.");
}
const profileController = globalThis.PopupProfileController;
if (!profileController || typeof profileController !== "object") {
  throw new Error("PopupProfileController must be loaded before popup-person.js.");
}
const invitationController = globalThis.PopupInvitationController;
if (!invitationController || typeof invitationController !== "object") {
  throw new Error("PopupInvitationController must be loaded before popup-person.js.");
}
const getActiveTabForProfileCheck =
  profileController.getActiveTabForProfileCheck;
const getFreshScrapeForPage = profileController.getFreshScrapeForPage;
const loadProfileContextOnOpen = profileController.loadProfileContextOnOpen;

async function refreshInvitationRowFromDb({ preserveTabs = false } = {}) {
  return invitationController.refreshInvitationRowFromDb({ preserveTabs });
}

const setCopyButtonEnabled =
  invitationController.setCopyButtonEnabled || (() => {});
const updateInviteCopyIconVisibility =
  invitationController.updateInviteCopyIconVisibility || (() => {});

async function onInvitationTabOpenedByUser() {
  setFooterStatus(UI_TEXT.preparingProfile);
  invitationController.bindInvitationEvents();
  await loadProfileContextOnOpen();
}

async function onStepRegisterClick() {
  const activeTabsBeforeRegister = captureActiveTabState();
  let footerHandled = false;
  setFooterLlmStatus();
  const campaignIdForRegister = safeTrim(campaignSelectEl?.value || "");
  try {
    const activeTab = await getActiveTabForProfileCheck().catch(() => null);
    const pageInfo = detectLinkedInPageType(activeTab?.url || "");
    if (pageInfo.page_type !== "person") {
      throw new Error("Active page is not a LinkedIn person profile.");
    }
    const profileContext = await getFreshScrapeForPage(pageInfo, {
      source: "register_click",
    });
    const extracted = await extractProfileDetailsFromLlm(profileContext);
    setFooterDbStatus();
    const result = await sendRuntimeMessage(MESSAGE_TYPES.DB_UPSERT_GENERATED, {
      payload: {
        linkedin_url: extracted.linkedin_url,
        full_name: extracted.full_name || null,
        company: extracted.company || null,
        headline: extracted.headline || null,
        language: extracted.language || getLanguage(),
        status: "registered",
        campaign: null,
      },
    });
    const resp = result.data || {};
    setFooterStatus(
      resp?.ok
        ? "Registered"
        : `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`,
    );
    if (resp?.ok) {
      await refreshInvitationRowFromDb({ preserveTabs: true });
      const personId = safeTrim(dbInvitationRow?.id);
      if (campaignIdForRegister && personId) {
        const linkResult = await sendRuntimeMessage("DB_LINK_PERSON_CAMPAIGN", {
          payload: {
            person_id: personId,
            campaign_id: campaignIdForRegister,
          },
        });
        if (!linkResult.ok) {
          throw new Error(getErrorMessage(linkResult.error));
        }
        await refreshPersonCampaignLinks();
      }
      setFooterStatus("Successfully set status registered");
      footerHandled = true;
    } else {
      setFooterStatus(
        `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`,
      );
      footerHandled = true;
    }
  } catch (e) {
    setFooterStatus(`${UI_TEXT.errorPrefix} ${getErrorMessage(e)}`);
    footerHandled = true;
  } finally {
    restoreActiveTabState(activeTabsBeforeRegister);
    if (!footerHandled) setFooterReady();
  }
}

async function onStepInvitedClick() {
  await invitationController.markInvited();
}

async function onStepAcceptedClick() {
  await invitationController.markAccepted();
}

async function onStepFirstMessageSentClick() {
  if (isMarkingMessageSent) return;
  isMarkingMessageSent = true;
  let footerHandled = false;
  setFooterDbStatus();
  try {
    const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
    if (!linkedin_url) {
      setFooterStatus(UI_TEXT.openLinkedInProfileFirst);
      footerHandled = true;
      return;
    }
    const result = await sendRuntimeMessage(MESSAGE_TYPES.DB_MARK_FIRST_MESSAGE_SENT, {
      payload: { linkedin_url },
    });
    const resp = result.data || {};
    if (resp?.ok) {
      await refreshInvitationRowFromDb({ preserveTabs: true });
      setFooterStatus("Successfully set status first message sent");
      footerHandled = true;
    } else {
      setFooterStatus(
        `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error || result.error)}`,
      );
      footerHandled = true;
    }
  } finally {
    isMarkingMessageSent = false;
    if (!footerHandled) setFooterReady();
  }
}

async function onStepMessageRespondedClick() {
  await setStatusOnlyForStepper(
    "message responded",
    "Marked as message responded",
  );
}

async function setStatusOnlyForStepper(statusValue, successText) {
  let footerHandled = false;
  setFooterDbStatus();
  try {
    const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
    if (!linkedin_url) {
      setFooterStatus(UI_TEXT.openLinkedInProfileFirst);
      footerHandled = true;
      return { ok: false };
    }
    const payloadStatus =
      statusValue === "message responded" ? "message responded" : statusValue;
    const result = await sendRuntimeMessage(MESSAGE_TYPES.DB_SET_STATUS_ONLY, {
      payload: { linkedin_url, status: payloadStatus },
    });
    const resp = result.data || {};
    setFooterStatus(
      resp?.ok
        ? successText
        : `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`,
    );
    if (resp?.ok) {
      await refreshInvitationRowFromDb();
      setFooterStatus(`Successfully set status ${payloadStatus}`);
      footerHandled = true;
      return { ok: true };
    } else {
      setFooterStatus(
        `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error)}`,
      );
      footerHandled = true;
      return { ok: false };
    }
  } finally {
    if (!footerHandled) setFooterReady();
  }
  return { ok: false };
}


async function adjustMessageCountForCurrentProfile(delta) {
  const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedin_url) {
    setFooterStatus(UI_TEXT.openLinkedInProfileFirst);
    return false;
  }
  const result = await sendRuntimeMessage(MESSAGE_TYPES.DB_INCREMENT_MESSAGE_COUNT, {
    payload: { linkedin_url, delta },
  });
  const resp = result.data || {};
  if (!resp?.ok) {
    setFooterStatus(
      `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error || result.error)}`,
    );
    return false;
  }
  await refreshInvitationRowFromDb({ preserveTabs: true });
  await refreshOverviewListContextSnapshot();
  return true;
}

async function setMessageCountForCurrentProfile(message_count) {
  const linkedin_url = getLinkedinUrlFromContext(currentProfileContext);
  if (!linkedin_url) {
    setFooterStatus(UI_TEXT.openLinkedInProfileFirst);
    return false;
  }
  const result = await sendRuntimeMessage(MESSAGE_TYPES.DB_SET_MESSAGE_COUNT, {
    payload: { linkedin_url, message_count },
  });
  const resp = result.data || {};
  if (!resp?.ok) {
    setFooterStatus(
      `${UI_TEXT.dbErrorPrefix} ${getErrorMessage(resp?.error || result.error)}`,
    );
    await refreshInvitationRowFromDb({ preserveTabs: true });
    return false;
  }
  await refreshInvitationRowFromDb({ preserveTabs: true });
  await refreshOverviewListContextSnapshot();
  return true;
}

function bindStepperClickHandlers() {
  if (!statusStepperEl) return;
  if (statusStepperEl.dataset.stepperBound === "1") return;
  statusStepperEl.dataset.stepperBound = "1";
  statusStepperEl.addEventListener("click", async (event) => {
    const targetEl =
      event.target instanceof Element
        ? event.target.closest(".status-step")
        : null;
    if (!targetEl) return;
    const stepKey = targetEl.getAttribute("data-step") || "";
    if (!stepKey || !stepperAllowedActions[stepKey]) return;

    if (stepperForwardSteps.has(stepKey)) {
      if (stepKey === "registered") {
        await onStepRegisterClick();
        return;
      }
      if (stepKey === STATUS_CONSTANTS.invited) {
        await onStepInvitedClick();
        return;
      }
      if (stepKey === STATUS_CONSTANTS.accepted) {
        await onStepAcceptedClick();
        return;
      }
      if (stepKey === "first_message_sent") {
        await onStepFirstMessageSentClick();
        return;
      }
      if (stepKey === "message_responded") {
        await onStepMessageRespondedClick();
      }
      return;
    }

    if (stepKey === stepperBackTarget) {
      if (stepperBackAction === "status_registered") {
        await setStatusOnlyForStepper("registered", "Back to registered");
        return;
      }
      if (stepperBackAction === "status_invited") {
        const backResult = await setStatusOnlyForStepper(
          STATUS_CONSTANTS.invited,
          "Back to invited",
        );
        if (backResult?.ok) {
          await setMessageCountForCurrentProfile(0);
        }
        return;
      }
      if (stepperBackAction === "status_first_message_sent") {
        await setStatusOnlyForStepper(
          STATUS_CONSTANTS.firstMessageSent,
          "Back to first message sent",
        );
        return;
      }
      if (stepperBackAction === "clear_accepted") {
        await onStepAcceptedClick();
      }
    }

    if (stepKey === STATUS_CONSTANTS.accepted) {
      await onStepAcceptedClick();
    }
  });
}

  return {
    refreshInvitationRowFromDb,
    setCopyButtonEnabled,
    updateInviteCopyIconVisibility,
    onInvitationTabOpenedByUser,
    onStepRegisterClick,
    onStepInvitedClick,
    onStepAcceptedClick,
    onStepFirstMessageSentClick,
    onStepMessageRespondedClick,
    setStatusOnlyForStepper,
    adjustMessageCountForCurrentProfile,
    setMessageCountForCurrentProfile,
    bindStepperClickHandlers,
  };
}

globalThis.initPersonModule = initPersonModule;
