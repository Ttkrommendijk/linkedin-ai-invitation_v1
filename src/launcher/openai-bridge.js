// Native extension views are not Playwright pages. Relay their requests through
// the one launcher page that owns the executable binding; never forward secrets.
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'lef-codex' || typeof globalThis.lefOpenAI !== 'function') return;
  const sender = port.sender;
  const allowed = chrome.runtime.getURL('src/popup/');
  if (sender?.id !== chrome.runtime.id || !sender.url?.startsWith(allowed)) {
    port.disconnect();
    return;
  }
  let handled = false;
  port.onMessage.addListener(async request => {
    if (handled) return;
    handled = true;
    let result;
    try { result = await globalThis.lefOpenAI(request); }
    catch (_) { result = {ok:false,error:'The LEF executable connection failed. Reopen LEF.exe and try again.'}; }
    try { port.postMessage(result); } catch (_) { /* View closed; do not retry. */ }
  });
});
