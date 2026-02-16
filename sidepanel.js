const refreshNowBtnEl = document.getElementById("refreshNow");
const refreshStatusEl = document.getElementById("refreshStatus");
const panelFrameEl = document.getElementById("panelFrame");
const LEF_UTILS = globalThis.LEFUtils || {};

const REFRESH_DEBOUNCE_MS = 500;
let refreshTimer = null;
let lastNotifiedUrl = "";

function isLinkedInProfileLikeUrl(url) {
  if (typeof LEF_UTILS.isLinkedInProfileLikeUrl === "function") {
    return LEF_UTILS.isLinkedInProfileLikeUrl(url);
  }
  if (!url || typeof url !== "string") return false;
  return /^https:\/\/www\.linkedin\.com\/(in|company)\/[^/?#]+/i.test(url);
}

function setRefreshStatus(text) {
  refreshStatusEl.textContent = text;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

function sendExtractMessage(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: "EXTRACT_PROFILE_CONTEXT" },
      (resp) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          resolve({
            ok: false,
            lastErrorMessage: lastError.message,
            resp: null,
          });
          return;
        }
        resolve({ ok: true, resp });
      },
    );
  });
}

function shouldRetryWithInjection(lastErrorMessage) {
  const msg = String(lastErrorMessage || "").toLowerCase();
  return (
    msg.includes("receiving end does not exist") ||
    msg.includes("could not establish connection")
  );
}

async function extractProfileWithInjectionFallback(tabId) {
  let firstAttempt = await sendExtractMessage(tabId);
  if (
    !firstAttempt.ok &&
    shouldRetryWithInjection(firstAttempt.lastErrorMessage)
  ) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["src/content/content.js"],
      });
    } catch (e) {
      return {
        ok: false,
        error:
          e instanceof Error ? e.message : String(e || "Injection failed."),
      };
    }
    firstAttempt = await sendExtractMessage(tabId);
  }

  if (!firstAttempt.ok) {
    return {
      ok: false,
      error:
        firstAttempt.lastErrorMessage || "No response from content script.",
    };
  }

  if (!firstAttempt.resp?.ok) {
    const msg =
      firstAttempt.resp?.error?.message ||
      (typeof firstAttempt.resp?.error === "string"
        ? firstAttempt.resp.error
        : "Extraction failed.");
    return { ok: false, error: msg };
  }

  return { ok: true, profile: firstAttempt.resp.profile || {} };
}

function resetIframeUiState(frameDocument, frameWindow) {
  const statusEl = frameDocument.getElementById("status");
  const messageStatusEl = frameDocument.getElementById("messageStatus");
  const previewEl = frameDocument.getElementById("preview");
  const firstMessagePreviewEl = frameDocument.getElementById(
    "firstMessagePreview",
  );
  const followupPreviewEl = frameDocument.getElementById("followupPreview");
  const copyBtnEl = frameDocument.getElementById("copyBtn");
  const copyFirstMessageBtnEl =
    frameDocument.getElementById("copyFirstMessage");
  const copyFollowupBtnEl = frameDocument.getElementById("copyFollowup");

  if (statusEl) statusEl.textContent = "Idle";
  if (messageStatusEl) messageStatusEl.textContent = "Idle";
  if (previewEl) previewEl.textContent = "";
  if (firstMessagePreviewEl) firstMessagePreviewEl.textContent = "";
  if (followupPreviewEl) followupPreviewEl.value = "";
  if (copyBtnEl) copyBtnEl.disabled = true;
  if (copyFirstMessageBtnEl) copyFirstMessageBtnEl.disabled = true;
  if (copyFollowupBtnEl) copyFollowupBtnEl.disabled = true;

  if (typeof frameWindow.updateMessageTabControls === "function") {
    frameWindow.updateMessageTabControls();
  }
}

function getLinkedinUrlFromProfile(profile) {
  return profile?.url || profile?.profile_url || profile?.linkedin_url || null;
}

async function clearPreviewIfNotInDb(frameDocument, profile) {
  const linkedin_url = getLinkedinUrlFromProfile(profile);
  if (!linkedin_url) return;

  const dbResp = await chrome.runtime
    .sendMessage({
      type: "DB_GET_INVITATION",
      payload: { linkedin_url },
    })
    .catch(() => null);

  if (dbResp?.ok && !dbResp.row) {
    const previewEl = frameDocument.getElementById("preview");
    const firstMessagePreviewEl = frameDocument.getElementById(
      "firstMessagePreview",
    );
    const followupPreviewEl = frameDocument.getElementById("followupPreview");
    const copyBtnEl = frameDocument.getElementById("copyBtn");
    const copyFirstMessageBtnEl =
      frameDocument.getElementById("copyFirstMessage");
    const copyFollowupBtnEl = frameDocument.getElementById("copyFollowup");
    if (previewEl) previewEl.textContent = "";
    if (firstMessagePreviewEl) firstMessagePreviewEl.textContent = "";
    if (followupPreviewEl) followupPreviewEl.value = "";
    if (copyBtnEl) copyBtnEl.disabled = true;
    if (copyFirstMessageBtnEl) copyFirstMessageBtnEl.disabled = true;
    if (copyFollowupBtnEl) copyFollowupBtnEl.disabled = true;
  }
}

async function refreshFromIframe(reason = "manual") {
  setRefreshStatus(`Refreshing (${reason})...`);

  const activeTab = await getActiveTab();
  const tabId = activeTab?.id;
  const tabUrl = activeTab?.url || "";

  if (!tabId) {
    setRefreshStatus("No active tab.");
    return;
  }

  if (!isLinkedInProfileLikeUrl(tabUrl)) {
    setRefreshStatus("Open a LinkedIn profile/company page.");
    return;
  }

  const frameWindow = panelFrameEl?.contentWindow;
  const frameDocument = frameWindow?.document;
  if (
    !frameWindow ||
    !frameDocument ||
    typeof frameWindow.loadProfileContextOnOpen !== "function"
  ) {
    setRefreshStatus("Popup UI not ready yet.");
    return;
  }

  resetIframeUiState(frameDocument, frameWindow);

  try {
    const extractResp = await extractProfileWithInjectionFallback(tabId);
    if (!extractResp.ok) {
      setRefreshStatus(extractResp.error || "Refresh failed.");
      return;
    }

    await frameWindow.loadProfileContextOnOpen();
    await clearPreviewIfNotInDb(frameDocument, extractResp.profile);
    setRefreshStatus(`Refreshed (${reason}).`);
  } catch (e) {
    setRefreshStatus(
      e instanceof Error ? e.message : String(e || "Refresh failed."),
    );
  }
}

function scheduleRefresh(reason) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshFromIframe(reason).catch(() => {
      setRefreshStatus("Refresh failed.");
    });
  }, REFRESH_DEBOUNCE_MS);
}

refreshNowBtnEl.addEventListener("click", () => {
  scheduleRefresh("manual");
});

panelFrameEl.addEventListener("load", () => {
  scheduleRefresh("frame-load");
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "SIDEPANEL_REFRESH_CONTEXT") return;

  const url = msg?.payload?.url || "";
  if (!isLinkedInProfileLikeUrl(url)) return;
  if (url === lastNotifiedUrl) return;
  lastNotifiedUrl = url;

  scheduleRefresh(msg?.payload?.reason || "background");
});

chrome.runtime
  .sendMessage({ type: "SP_REQUEST_REFRESH_SIGNAL" })
  .catch(() => null);

scheduleRefresh("initial");
