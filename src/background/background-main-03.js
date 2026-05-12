
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) =>
  executeRoute({
    routes: ROUTES,
    msg,
    sender,
    sendResponse,
  }),
);
