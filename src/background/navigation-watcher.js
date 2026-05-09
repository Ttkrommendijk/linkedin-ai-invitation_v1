(function initNavigationWatcher(globalObj) {
  const LEF_UTILS = globalObj.LEFUtils || {};

  const SIDEPANEL_REFRESH_DEBOUNCE_MS = 500;
  const sidePanelRefreshTimers = new Map();
  const lastSidePanelUrlByTab = new Map();
  let lastActivatedLinkedInTabId = null;

  function isLinkedInProfileLikeUrl(url) {
    if (typeof LEF_UTILS.isLinkedInProfileLikeUrl === "function") {
      return LEF_UTILS.isLinkedInProfileLikeUrl(url);
    }
    if (!url || typeof url !== "string") return false;
    return /^https:\/\/www\.linkedin\.com\/(in|company|school)\/[^/?#]+/i.test(
      url,
    );
  }

  function canonicalizeLinkedInUrl(rawUrl) {
    if (typeof LEF_UTILS.canonicalizeLinkedInUrl === "function") {
      return LEF_UTILS.canonicalizeLinkedInUrl(rawUrl);
    }

    const input = String(rawUrl || "").trim();
    if (!input) return "";

    try {
      const parsed = new URL(input);
      const parts = (parsed.pathname || "").split("/").filter(Boolean);

      if (parts.length >= 2 && /^(company|school)$/i.test(parts[0])) {
        return `https://www.linkedin.com/${parts[0].toLowerCase()}/${parts[1]}/`;
      }

      const pathname = (parsed.pathname || "").replace(/\/+$/, "") || "/";
      if (pathname === "/") return "https://www.linkedin.com/";
      return `https://www.linkedin.com${pathname}/`;
    } catch (_e) {
      const noHash = input.split("#")[0];
      const noQuery = noHash.split("?")[0];
      const match = noQuery.match(
        /^https:\/\/www\.linkedin\.com\/(company|school)\/([^/?#\/]+)/i,
      );

      if (match) {
        return `https://www.linkedin.com/${match[1].toLowerCase()}/${match[2]}/`;
      }

      const noTrailing = noQuery.replace(/\/+$/, "");
      if (!noTrailing) return "";
      return noTrailing.endsWith("/") ? noTrailing : `${noTrailing}/`;
    }
  }

  function detectLinkedInPageType(rawUrl) {
    const linkedin_id = canonicalizeLinkedInUrl(rawUrl || "");
    const result = { page_type: "unsupported", linkedin_id };

    if (!/^https:\/\/www\.linkedin\.com\//i.test(linkedin_id)) return result;

    if (/^https:\/\/www\.linkedin\.com\/in\/[^/?#]+/i.test(linkedin_id)) {
      result.page_type = "person";
      return result;
    }

    if (
      /^https:\/\/www\.linkedin\.com\/(company|school)\/[^/?#]+/i.test(
        linkedin_id,
      )
    ) {
      result.page_type = "company";
      return result;
    }

    return result;
  }

  function timingLog(eventName, details = {}) {
    console.log("[LEF][timing]", eventName, {
      ts: Date.now(),
      ...details,
    });
  }

  async function notifySidePanelRefresh({ tabId, url, reason }) {
    try {
      await chrome.runtime.sendMessage({
        type: "SIDEPANEL_REFRESH_CONTEXT",
        payload: { tabId, url, reason },
      });
    } catch (_e) {
      // Side panel may not be open; ignore.
    }
  }

  function scheduleSidePanelRefresh(
    tabId,
    url,
    reason,
    { force = false } = {},
  ) {
    if (!Number.isInteger(tabId) || !isLinkedInProfileLikeUrl(url)) return;

    const existingTimer = sidePanelRefreshTimers.get(tabId);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(async () => {
      sidePanelRefreshTimers.delete(tabId);

      const prevUrl = lastSidePanelUrlByTab.get(tabId);
      if (!force && prevUrl === url) return;

      lastSidePanelUrlByTab.set(tabId, url);
      await notifySidePanelRefresh({ tabId, url, reason });
    }, SIDEPANEL_REFRESH_DEBOUNCE_MS);

    sidePanelRefreshTimers.set(tabId, timer);
  }

  function initNavigationWatcher() {
    chrome.tabs.onActivated.addListener(async ({ tabId }) => {
      try {
        const tab = await chrome.tabs.get(tabId);

        timingLog("tab_url_change", {
          source: "tabs.onActivated",
          tabId,
          url: tab?.url || "",
          page: detectLinkedInPageType(tab?.url || ""),
        });

        const shouldForceRefresh = lastActivatedLinkedInTabId !== tabId;
        lastActivatedLinkedInTabId = tabId;

        scheduleSidePanelRefresh(tabId, tab?.url || "", "tabs.onActivated", {
          force: shouldForceRefresh,
        });
      } catch (_e) {
        // Ignore transient tab errors.
      }
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (typeof changeInfo.url === "string") {
        timingLog("tab_url_change", {
          source: "tabs.onUpdated.url",
          tabId,
          url: changeInfo.url,
          page: detectLinkedInPageType(changeInfo.url),
        });

        scheduleSidePanelRefresh(tabId, changeInfo.url, "tabs.onUpdated.url");
        return;
      }

      if (changeInfo.status === "complete") {
        timingLog("tab_url_change", {
          source: "tabs.onUpdated.complete",
          tabId,
          url: tab?.url || "",
          page: detectLinkedInPageType(tab?.url || ""),
        });

        scheduleSidePanelRefresh(
          tabId,
          tab?.url || "",
          "tabs.onUpdated.complete",
        );
      }
    });

    chrome.webNavigation.onCommitted.addListener((details) => {
      if (details.frameId !== 0) return;

      timingLog("tab_url_change", {
        source: "webNavigation.onCommitted",
        tabId: details.tabId,
        url: details.url,
        page: detectLinkedInPageType(details.url),
      });

      scheduleSidePanelRefresh(
        details.tabId,
        details.url,
        "webNavigation.onCommitted",
      );
    });

    chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
      if (details.frameId !== 0) return;

      timingLog("tab_url_change", {
        source: "webNavigation.onHistoryStateUpdated",
        tabId: details.tabId,
        url: details.url,
        page: detectLinkedInPageType(details.url),
      });

      scheduleSidePanelRefresh(
        details.tabId,
        details.url,
        "webNavigation.onHistoryStateUpdated",
      );
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
      const timer = sidePanelRefreshTimers.get(tabId);
      if (timer) clearTimeout(timer);

      sidePanelRefreshTimers.delete(tabId);
      lastSidePanelUrlByTab.delete(tabId);
    });
  }

  globalObj.LEFNavigationWatcher = Object.freeze({
    initNavigationWatcher,
    detectLinkedInPageType,
    scheduleSidePanelRefresh,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
