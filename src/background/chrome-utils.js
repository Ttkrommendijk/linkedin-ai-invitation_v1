(function initChromeUtils(globalObj) {
  const LEF_RUNTIME_UTILS = globalObj.LEFRuntimeUtils || {};

  const normalizeProfileField = LEF_RUNTIME_UTILS.normalizeProfileField;
  const isLinkedInProfileLikeUrl = LEF_RUNTIME_UTILS.isLinkedInProfileLikeUrl;

  function emitUiStatus(text) {
    try {
      chrome.runtime.sendMessage({ type: "ui_status", text }, () => {
        void chrome.runtime.lastError;
      });
    } catch (_e) {
      // Ignore when popup/sidepanel is closed.
    }
  }

  async function getActiveTabInCurrentWindow() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  }

  async function sendMessageToTab(tabId, message) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (_e) {
      return null;
    }
  }

  async function openLinkedInUrl({ url, new_tab }) {
    const targetUrl = normalizeProfileField(url);
    const openInNewTab = Boolean(new_tab);
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
  }

  globalObj.LEFChromeUtils = Object.freeze({
    emitUiStatus,
    getActiveTabInCurrentWindow,
    sendMessageToTab,
    openLinkedInUrl,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
