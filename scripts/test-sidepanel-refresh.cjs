const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const timers = new Map();
let timerId = 0;
let loads = 0;
let hold;
let success = true;
let active = { tabId: 1, isProfileOpen: true, tabUrl: 'https://www.linkedin.com/in/person' };
const frame = { contentWindow: { document: {}, loadProfileContextOnOpen: async () => {
  loads++;
  if (hold) await hold;
  return success;
} } };
const context = {
  URL, console: { log() {}, warn() {}, error: console.error },
  setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
  clearTimeout(id) { timers.delete(id); },
  document: { readyState: 'loading', addEventListener() {}, getElementById(id) { return id === 'panelFrame' ? frame : null; } },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'src/shared/utils.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'sidepanel.js'), 'utf8'), context);
context.getActive = () => active;
vm.runInContext(`getActiveTabProfileState = async () => getActive();
  resetSideNavTargets = () => {}; setNoProfileStateVisible = () => {};
  resetIframeUiState = () => {}; computeSideNavTargets = async () => {};`, context);

async function main() {
  const refresh = context.refreshFromIframe;
  await refresh('tabs-url');
  active.tabUrl += '/';
  for (const reason of ['tabs-complete', 'webNavigation.onCommitted', 'history-state']) await refresh(reason);
  assert.equal(loads, 1, 'Equivalent navigation events must reuse the completed load');
  await refresh('manual');
  assert.equal(loads, 2, 'Manual refresh must bypass deduplication');
  context.scheduleNavigationRefresh('tabs-complete');
  assert.equal(timers.size, 1, 'Only debounce timer, no settled refresh');
  timers.clear();
  let release;
  hold = new Promise(resolve => { release = resolve; });
  active.tabUrl = 'https://www.linkedin.com/in/second/';
  const pending = refresh('tabs-url');
  await Promise.resolve();
  active.tabUrl = 'https://www.linkedin.com/in/third/';
  await refresh('tabs-url');
  assert.equal(loads, 3, 'Loads must not overlap');
  release(); hold = null; await pending;
  assert.equal(timers.size, 1, 'Latest navigation is queued');
  timers.clear();
  await refresh('tabs-url');
  assert.equal(loads, 4, 'Latest profile must load after previous refresh');
  active.tabId = 2;
  await refresh('tabs-activated');
  assert.equal(loads, 5, 'Switching tabs must load even the same URL');
  success = false; active.tabUrl = 'https://www.linkedin.com/in/failure/';
  await refresh('tabs-url'); await refresh('tabs-complete');
  assert.equal(loads, 7, 'Failed loads must remain retryable');
  console.log('PASS: slash/event deduplication, manual refresh, no settled timer, serialization, queued navigation, tab switch, failure retry');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
