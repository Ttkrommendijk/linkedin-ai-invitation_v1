const refreshNowBtnEl = document.getElementById("refreshNow");
const navPrevBtnEl = document.getElementById("navPrev");
const navNextBtnEl = document.getElementById("navNext");
const refreshStatusEl = document.getElementById("refreshStatus");
const panelFrameEl = document.getElementById("panelFrame");
const LEF_UTILS_SOURCE = globalThis.LEFUtils;
if (
  (!LEF_UTILS_SOURCE || typeof LEF_UTILS_SOURCE !== "object") &&
  !globalThis.__LEFUTILS_MISSING_WARNED__
) {
  globalThis.__LEFUTILS_MISSING_WARNED__ = true;
  console.warn("[lefutils] not found; using local fallbacks");
}
const LEF_UTILS =
  LEF_UTILS_SOURCE && typeof LEF_UTILS_SOURCE === "object"
    ? LEF_UTILS_SOURCE
    : {};
const sendRuntimeMessage =
  typeof LEF_UTILS.sendRuntimeMessage === "function"
    ? LEF_UTILS.sendRuntimeMessage
    : (type, payload = {}, options = {}) => {
        const timeoutMs =
          Number.isFinite(options?.timeoutMs) && options.timeoutMs > 0
            ? options.timeoutMs
            : 20000;
        return new Promise((resolve) => {
          let settled = false;
          const done = (result) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            resolve(result);
          };
          const timeoutId = setTimeout(() => {
            console.error(`[msg] ${type} failed: timeout`);
            done({ ok: false, error: "timeout", data: null });
          }, timeoutMs);
          try {
            chrome.runtime.sendMessage(
              {
                type,
                ...(payload && typeof payload === "object" ? payload : {}),
              },
              (response) => {
                const runtimeError = chrome.runtime?.lastError;
                if (runtimeError) {
                  const errorText = String(
                    runtimeError.message || runtimeError,
                  );
                  console.error(`[msg] ${type} failed: ${errorText}`);
                  done({ ok: false, error: errorText, data: null });
                  return;
                }
                if (response?.ok === false || response?.error) {
                  const errorText =
                    typeof response?.error === "string"
                      ? response.error
                      : response?.error?.message || "unknown error";
                  console.error(`[msg] ${type} failed: ${errorText}`);
                  done({ ok: false, error: errorText, data: response || null });
                  return;
                }
                done({ ok: true, data: response });
              },
            );
          } catch (e) {
            const errorText = e instanceof Error ? e.message : String(e || "");
            console.error(`[msg] ${type} failed: ${errorText}`);
            done({ ok: false, error: errorText, data: null });
          }
        });
      };

const REFRESH_DEBOUNCE_MS = 500;
let refreshTimer = null;
let lastNotifiedUrl = "";
let prevListUrl = "";
let nextListUrl = "";

function isLinkedInProfileLikeUrl(url) {
  if (typeof LEF_UTILS.isLinkedInProfileLikeUrl === "function") {
    return LEF_UTILS.isLinkedInProfileLikeUrl(url);
  }
  if (!url || typeof url !== "string") return false;
  return /^https:\/\/www\.linkedin\.com\/(in|company)\/[^/?#]+/i.test(url);
}

function normalizeLinkedinUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  const noHash = raw.split("#")[0];
  const noQuery = noHash.split("?")[0];
  return noQuery.replace(/\/+$/, "");
}

function setRefreshStatus(text) {
  if (refreshStatusEl) refreshStatusEl.textContent = text;
}

function findNoProfileEl() {
  const localEl = document.getElementById("noProfileState");
  if (localEl) return localEl;
  return (
    panelFrameEl?.contentDocument?.getElementById("noProfileState") || null
  );
}

function setNoProfileStateVisible(isVisible) {
  const noProfileEl = findNoProfileEl();
  if (!noProfileEl) return;

  if (isVisible) noProfileEl.classList.remove("hidden");
  else noProfileEl.classList.add("hidden");

  const detailContentEl =
    noProfileEl.ownerDocument?.getElementById("detailProfileContent") || null;
  if (detailContentEl) {
    if (isVisible) detailContentEl.classList.add("hidden");
    else detailContentEl.classList.remove("hidden");
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function getActiveTabProfileState() {
  const activeTab = await getActiveTab();
  const tabId = activeTab?.id || null;
  const tabUrl = activeTab?.url || "";
  return {
    tabId,
    tabUrl,
    isProfileOpen: isLinkedInProfileLikeUrl(tabUrl),
  };
}

async function computeSideNavTargets() {
  const [{ lef_list_context, lef_list_last_opened_url }, activeState] =
    await Promise.all([
      chrome.storage.local.get([
        "lef_list_context",
        "lef_list_last_opened_url",
      ]),
      getActiveTabProfileState(),
    ]);

  const items = Array.isArray(lef_list_context?.items)
    ? lef_list_context.items
        .map((url) => normalizeLinkedinUrl(url))
        .filter(Boolean)
    : [];

  const normalizedCurrentUrl = normalizeLinkedinUrl(activeState?.tabUrl || "");
  const normalizedLastOpened = normalizeLinkedinUrl(
    lef_list_last_opened_url || "",
  );
  let index = normalizedCurrentUrl ? items.indexOf(normalizedCurrentUrl) : -1;
  if (index < 0 && normalizedLastOpened) {
    index = items.indexOf(normalizedLastOpened);
  }

  prevListUrl = index > 0 ? items[index - 1] : "";
  nextListUrl = index >= 0 && index < items.length - 1 ? items[index + 1] : "";
  if (navPrevBtnEl) navPrevBtnEl.disabled = !prevListUrl;
  if (navNextBtnEl) navNextBtnEl.disabled = !nextListUrl;
}

function resetSideNavTargets() {
  prevListUrl = "";
  nextListUrl = "";
  if (navPrevBtnEl) navPrevBtnEl.disabled = true;
  if (navNextBtnEl) navNextBtnEl.disabled = true;
}

async function navigateToListNeighbor(direction) {
  const targetUrl = direction === "prev" ? prevListUrl : nextListUrl;
  if (!targetUrl) return;

  const activeTab = await getActiveTab();
  if (!Number.isInteger(activeTab?.id)) return;

  await chrome.storage.local.set({ lef_list_last_opened_url: targetUrl });
  await chrome.tabs.update(activeTab.id, { url: targetUrl, active: true });
  scheduleRefresh(`nav-${direction}`);
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

  const dbResult = await sendRuntimeMessage("DB_GET_INVITATION", {
    payload: { linkedin_url },
  });
  const dbResp = dbResult.data || null;

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
  try {
    setRefreshStatus(`Refreshing (${reason})...`);

    const { tabId, isProfileOpen } = await getActiveTabProfileState();

    if (!tabId) {
      resetSideNavTargets();
      setNoProfileStateVisible(true);
      setRefreshStatus("No active tab.");
      return;
    }

    if (!isProfileOpen) {
      resetSideNavTargets();
      setNoProfileStateVisible(true);
      setRefreshStatus("Open a LinkedIn profile/company page.");
      return;
    }

    setNoProfileStateVisible(false);

    const frameWindow = panelFrameEl?.contentWindow;
    const frameDocument = frameWindow?.document;
    if (
      !frameWindow ||
      !frameDocument ||
      typeof frameWindow.loadProfileContextOnOpen !== "function"
    ) {
      resetSideNavTargets();
      setRefreshStatus("Popup UI not ready yet.");
      return;
    }

    resetIframeUiState(frameDocument, frameWindow);

    const extractResp = await extractProfileWithInjectionFallback(tabId);
    if (!extractResp.ok) {
      resetSideNavTargets();
      setRefreshStatus(extractResp.error || "Refresh failed.");
      return;
    }

    await frameWindow.loadProfileContextOnOpen();
    await clearPreviewIfNotInDb(frameDocument, extractResp.profile);
    await computeSideNavTargets();
    setRefreshStatus(`Refreshed (${reason}).`);
  } catch (e) {
    setRefreshStatus(
      e instanceof Error ? e.message : String(e || "Refresh failed."),
    );
    await computeSideNavTargets();
  }
}

function scheduleRefresh(reason) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshFromIframe(reason).catch((error) => {
      const msg = error instanceof Error ? error.message : "Refresh failed.";
      setRefreshStatus(msg || "Refresh failed.");
    });
  }, REFRESH_DEBOUNCE_MS);
}

let sidePanelInitErrorLogged = false;
function logSidePanelInitError(error) {
  if (sidePanelInitErrorLogged) return;
  sidePanelInitErrorLogged = true;
  const msg = error instanceof Error ? error.message : String(error || "");
  console.error(`[LEF][init] sidepanel init failed: ${msg}`);
  if (error && typeof error === "object" && typeof error.stack === "string") {
    console.error(error.stack);
  }
}

function runSidePanelInit() {
  if (!panelFrameEl) return;

  navPrevBtnEl?.addEventListener("click", () => {
    navigateToListNeighbor("prev").catch(() => null);
  });
  navNextBtnEl?.addEventListener("click", () => {
    navigateToListNeighbor("next").catch(() => null);
  });

  refreshNowBtnEl?.addEventListener("click", () => {
    scheduleRefresh("manual");
  });

  panelFrameEl?.addEventListener("load", () => {
    scheduleRefresh("frame-load");
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== "SIDEPANEL_REFRESH_CONTEXT") return;

    const url = msg?.payload?.url || "";
    if (url === lastNotifiedUrl) return;
    lastNotifiedUrl = url;

    scheduleRefresh(msg?.payload?.reason || "background");
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!changes?.lef_list_context && !changes?.lef_list_last_opened_url)
      return;
    computeSideNavTargets().catch(() => null);
  });

  sendRuntimeMessage("SP_REQUEST_REFRESH_SIGNAL").catch(() => null);
  computeSideNavTargets().catch(() => null);

  scheduleRefresh("initial");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    try {
      runSidePanelInit();
    } catch (error) {
      logSidePanelInitError(error);
    }
  });
} else {
  try {
    runSidePanelInit();
  } catch (error) {
    logSidePanelInitError(error);
  }
}
