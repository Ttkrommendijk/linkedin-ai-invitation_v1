const refreshNowBtnEl = document.getElementById("refreshNow");
const refreshStatusEl = document.getElementById("refreshStatus");
const panelFrameEl = document.getElementById("panelFrame");

const REFRESH_DEBOUNCE_MS = 500;
let refreshTimer = null;
let lastNotifiedUrl = "";

function isLinkedInProfileLikeUrl(url) {
  if (!url || typeof url !== "string") return false;
  return /^https:\/\/www\.linkedin\.com\/(in|company)\/[^/?#]+/i.test(url);
}

function setRefreshStatus(text) {
  refreshStatusEl.textContent = text;
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

async function extractProfileFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id;
  if (!tabId) return { ok: false, error: "No active tab." };

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: "EXTRACT_PROFILE_CONTEXT" },
      (resp) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          resolve({ ok: false, error: lastError.message });
          return;
        }
        if (!resp?.ok) {
          const msg =
            resp?.error?.message ||
            (typeof resp?.error === "string"
              ? resp.error
              : "extraction_failed");
          resolve({ ok: false, error: msg });
          return;
        }
        resolve({ ok: true, profile: resp.profile || {} });
      },
    );
  });
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
    await frameWindow.loadProfileContextOnOpen();
    const extractResp = await extractProfileFromActiveTab();
    if (extractResp.ok) {
      await clearPreviewIfNotInDb(frameDocument, extractResp.profile);
    }
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
