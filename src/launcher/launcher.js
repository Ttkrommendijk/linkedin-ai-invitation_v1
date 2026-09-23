// One launcher control surface. CRM and settings retain their existing controllers.
window.lefCommands = [];
window.lefApproval = null;
const el = id => document.getElementById(id);
let currentView = 'recipients';
let latestState = {rows: [], running: false};
let renderedRows = '';
let loadRequested = false;
let batchNonce = null;
const waiting = new Set(['queued', 'working', 'awaiting_approval']);
const attention = new Set(['error', 'ambiguous', 'confirmed_sync_error', 'confirmed']);
const outcomes = {queued:'Waiting', working:'In progress', awaiting_approval:'Awaiting your approval',
  dry_run:'Dry-run checked · not sent', invited:'Invitation confirmed', connected_reconciled:'Already connected · CRM updated',
  skipped_pending:'Skipped · invitation pending', skipped_crm:'Skipped · CRM already records contact',
  skipped_manual:'Excluded by you', skipped_user:'Skipped by you', resume_excluded:'Before resume point', error:'Needs attention · not sent',
  ambiguous:'Send uncertain · manual review', confirmed_sync_error:'Sent · CRM update needed', confirmed:'Sent · updating CRM'};
const steps = {queued:'Waiting', open:'Opening profile', open_profile:'Opening profile', wait_profile:'Waiting for profile',
  browse:'Reviewing profile', inspect:'Checking connection', crm:'Checking person and company', company:'Checking company',
  company_selection:'Selecting employer', ready:'Checks complete', approval:'Approval', connect:'Connect',
  menu_connect:'Connect menu', connect_intent:'Connect clicked', dialog:'Invitation dialog', send_intent:'Send attempted',
  confirm:'Checking confirmation', linkedin_confirmation:'LinkedIn confirmed', sync:'Updating CRM', crm_sync:'CRM updated', skip:'Skipped'};
function showView(view) {
  currentView = view;
  el('execution-settings').hidden = view !== 'settings';
  for (const name of ['recipients','results','settings']) el(`${name}-view`).hidden = view !== name;
  el('crm-container').hidden = view === 'results';
  document.querySelectorAll('[data-view]').forEach(button => {
    if (button.dataset.view === view) button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
  const doc = el('crm').contentDocument;
  if (doc?.getElementById('tabOverviewBtn')) {
    doc.documentElement.dataset.launcherView = view === 'settings' ? 'settings' : 'recipients';
    doc.getElementById(view === 'settings' ? 'tabConfigBtn' : 'tabOverviewBtn').click();
    if (view !== 'settings') doc.getElementById('listPersonsTabBtn').click();
  }
}
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
el('crm').addEventListener('load', () => {
  const doc = el('crm').contentDocument;
  const style = doc.createElement('style');
  style.textContent = `
    #topTabs,#listTabsRow,#commFooter{display:none!important}
    #innerContentContainer > .tab-panel{display:none!important}
    html[data-launcher-view="recipients"] #tabOverview{display:block!important}
    html[data-launcher-view="settings"] #tabConfig{display:block!important}
    #personsListPanel{display:block!important}#companiesListPanel{display:none!important}
    #personsListPanel table col:first-child{visibility:collapse;width:0!important}
    #configGeneralPanel .row:has(#strategy),#configGeneralPanel .row:has(#navPacingEnabled){display:none!important}
    html,body,#sidePanelRoot{background:white!important}#innerContentContainer{padding:12px 20px!important}
  `;
  doc.head.append(style);
  // Person/company drill-down belongs to the full extension, not the recipient picker.
  doc.getElementById('personsListPanel').addEventListener('click', event => {
    if (event.target.closest('tbody a,tbody button')) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  showView(currentView);
  el('crm-container').classList.add('ready');
});
for (const action of ['load','start','pause','skip','review','approve','approve_batch','retry','sync','browser']) {
  el(action).addEventListener('click', () => {
    window.lefCommands.push({action, dry: el('dry').checked, resume: el('resume').value.trim(), approval: window.lefApproval,
      batch:true, batch_nonce:batchNonce});
    if (action === 'approve') el('approval').hidden = true;
    if (action === 'load') loadRequested = true;
    if (action === 'start') showView('results');
  });
}
const cancelBatch = () => { window.lefCommands.push({action:'pause'}); el('batch-dialog').close(); };
el('cancel_batch').addEventListener('click', cancelBatch);
el('batch-dialog').addEventListener('cancel', event => { event.preventDefault(); cancelBatch(); });
function modeChanged() {
  const dry = el('dry').checked;
  el('mode-help').textContent = dry ? 'Check profiles only. No invitations or CRM updates.' : 'Live mode. Approve the displayed batch once before it starts.';
  el('start').textContent = dry ? 'Start dry-run' : 'Start invitations';
}
el('dry').addEventListener('change', modeChanged);
function renderResults(state) {
  const rows = state.rows || [];
  const filter = el('result-filter').value;
  const signature = JSON.stringify([rows, filter, state.running]);
  if (signature === renderedRows) return;
  renderedRows = signature;
  const visible = rows.filter(row => filter === 'all' || (filter === 'waiting' ? waiting.has(row.outcome) : filter === 'attention' ? attention.has(row.outcome) : !waiting.has(row.outcome)));
  const body = document.createDocumentFragment();
  for (const row of visible) {
    const tr = document.createElement('tr');
    const cells = Array.from({length:7}, () => {const td=document.createElement('td'); tr.append(td); return td;});
    cells[0].textContent = row.position + 1;
    const link = document.createElement('a');
    // Only validated profile links become clickable; all supplied labels are plain text.
    if (/^https:\/\/www\.linkedin\.com\/in\/[^/?#]+\/$/.test(row.url)) link.href = row.url;
    link.target = '_blank'; link.rel = 'noopener'; link.textContent = row.name || row.url.split('/').filter(Boolean).pop(); link.title = row.url;
    cells[1].append(link);
    cells[2].textContent = row.company || (row.lookup_error ? 'CRM lookup failed' : row.details_loaded === false ? 'Not loaded yet' : '-');
    cells[2].title = row.lookup_error ? 'CRM details could not be refreshed; showing saved information.' : (row.company_source || 'Registered company');
    const eligible=!row.send_attempted && !row.confirmed && ['queued','working','awaiting_approval','dry_run','error'].includes(row.outcome);
    function action(label,action) {
      const button=document.createElement('button');button.type='button';button.textContent=label;
      button.disabled=Boolean(state.running);button.title=state.running?'Pause before editing the queue.':label;
      button.addEventListener('click',()=>{window.lefCommands.push({action,url:row.url});button.disabled=true;});
      cells[3].append(button);
    }
    if(eligible){action('Skip person','exclude_person');if(row.company)action('Skip company','exclude_company');}
    else if(row.outcome==='skipped_manual' && !row.send_attempted)action('Restore','restore_person');
    const badge = document.createElement('span');
    badge.className = 'outcome' + (attention.has(row.outcome) ? ' attention' : row.outcome === 'invited' || row.outcome === 'connected_reconciled' ? ' success' : '');
    badge.textContent = outcomes[row.outcome] || row.outcome; cells[4].append(badge);
    cells[5].textContent = steps[row.step] || row.step;
    cells[6].textContent = row.error || (row.outcome === 'queued' ? 'Ready when you press Start.' : '');
    body.append(tr);
  }
  el('results').replaceChildren(body);
  el('empty-results').hidden = visible.length > 0;
  el('empty-results').textContent = rows.length ? 'No people match this view.' : 'No recipients loaded yet.';
  el('visible-count').textContent = `${visible.length} of ${rows.length} people`;
}
el('result-filter').addEventListener('change', () => renderResults(latestState));
// Display preferences only: independent of CRM grid preferences and batch progress.
const resultsTable = el('results').closest('table');
const resultColumns = document.createElement('colgroup');
const widthKey = 'lefLauncherResultColumnWidths';
let resultWidths = [70, 230, 210, 220, 220, 160, 350];
const applyResultWidths = () => {
  [...resultColumns.children].forEach((col, i) => { col.style.width = `${resultWidths[i]}px`; });
  resultsTable.style.width = `${resultWidths.reduce((sum, width) => sum + width, 0)}px`;
};
const saveResultWidths = () => chrome.storage.local.set({[widthKey]: resultWidths});
for (const [index, header] of [...resultsTable.tHead.rows[0].cells].entries()) {
  resultColumns.append(document.createElement('col'));
  const handle = document.createElement('span');
  handle.className = 'result-resize-handle';
  handle.tabIndex = 0;
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-label', `Resize ${header.textContent} column`);
  handle.title = 'Drag to resize. Arrow keys adjust width.';
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX, startWidth = resultWidths[index];
    handle.setPointerCapture(event.pointerId);
    document.body.classList.add('resizing-column');
    const move = e => {
      resultWidths[index] = Math.max(70, Math.min(1200, startWidth + e.clientX - startX));
      applyResultWidths();
    };
    const finish = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('lostpointercapture', finish);
      document.body.classList.remove('resizing-column');
      saveResultWidths();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('lostpointercapture', finish);
  });
  handle.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    resultWidths[index] = Math.max(70, Math.min(1200, resultWidths[index] + (event.key === 'ArrowRight' ? 10 : -10)));
    applyResultWidths();
    saveResultWidths();
  });
  header.append(handle);
}
resultsTable.prepend(resultColumns);
applyResultWidths();
chrome.storage.local.get(widthKey).then(saved => {
  let widths = saved[widthKey];
  if(Array.isArray(widths) && widths.length===5) widths=[widths[0],widths[1],210,220,...widths.slice(2)];
  if (Array.isArray(widths) && widths.length === 7 && widths.every(w => Number.isFinite(w) && w >= 70 && w <= 1200)) {
    resultWidths = widths;
    applyResultWidths();
  }
  resultsTable.dataset.widthsReady = 'true';
});
window.lefRender = state => {
  latestState = state;
  const rows = state.rows || [];
  const request = state.batch_request;
  if (request && batchNonce !== request.nonce) {
    batchNonce = request.nonce;
    el('batch-description').textContent = `${request.urls.length} recipients in saved order. Maximum ${request.urls.length} invitations. Review this exact list before starting.`;
    const names = new Map(rows.map(row => [row.url, row.name]));
    const list = document.createDocumentFragment();
    for (const url of request.urls) {
      const item = document.createElement('li');
      item.textContent = names.get(url) ? `${names.get(url)} — ${url}` : url;
      list.append(item);
    }
    el('batch-recipients').replaceChildren(list);
    el('batch-dialog').showModal();
  } else if (!request) {
    batchNonce = null;
    el('batch-dialog').close();
  }
  const count = test => rows.filter(test).length;
  el('status').textContent = state.status;
  el('log').textContent = state.log.join('\n');
  el('current-profile').textContent = state.current ? `Current profile: ${state.current}` : '';
  window.lefApproval = state.approval || null;
  el('approval').hidden = !state.approval;
  el('recipient').textContent = state.approval ? `Send one invitation without a note to ${state.approval.url}? Approval expires in 60 seconds.` : '';
  el('result-count').textContent = rows.length;
  el('waiting-count').textContent = count(r => waiting.has(r.outcome));
  el('checked-count').textContent = count(r => r.outcome === 'dry_run');
  el('sent-count').textContent = count(r => r.outcome === 'invited');
  el('skipped-count').textContent = count(r => r.outcome.startsWith('skipped') || ['connected_reconciled','resume_excluded'].includes(r.outcome));
  el('error-count').textContent = count(r => attention.has(r.outcome));
  const selection = rows.length ? `${rows.length} saved recipients · ${state.campaign || 'saved selection'}. Grid filter changes do not replace this saved batch.` : 'No recipients loaded.';
  el('batch-summary').textContent = selection;
  el('saved-selection').textContent = selection;
  el('load').textContent = rows.length ? 'Resume saved recipients' : 'Load recipients';
  el('resume-options').hidden = rows.length > 0;
  for (const id of ['load','review','retry','sync','dry','resume']) el(id).disabled = state.running;
  el('start').disabled = state.running || !rows.some(r => waiting.has(r.outcome) && !r.send_attempted);
  el('pause').disabled = !state.running;
  el('skip').disabled = !state.current;
  el('review').disabled ||= !rows.some(r => r.outcome === 'dry_run' && !r.send_attempted);
  el('retry').disabled ||= !rows.some(r => r.outcome === 'error' && !r.send_attempted);
  el('sync').disabled ||= !rows.some(r => r.confirmed && r.outcome !== 'invited');
  renderResults(state);
  if (loadRequested && rows.length) { loadRequested = false; showView('results'); }
};
el('panel').addEventListener('click', async () => {
  try { const w = await chrome.windows.getCurrent(); await chrome.sidePanel.open({windowId:w.id}); }
  catch (e) { el('status').textContent = e.message; }
});

let scheduleSignature = '';
let scheduleDirty = false;
let lastScheduleState = null;
el('schedule-form').addEventListener('input', () => { scheduleDirty = true; });
el('schedule-form').addEventListener('submit', event => {
  event.preventDefault();
  const settings = {window_hours:Number(el('limit-window').value), invites:Number(el('limit-invites').value), gap_minutes:Number(el('limit-gap').value),
    profiles:Number(el('limit-profiles').value), companies:Number(el('limit-companies').value),
    start:el('work-start').value, end:el('work-end').value,
    days:[...el('work-days').querySelectorAll('input:checked')].map(e => Number(e.value))};
  window.lefCommands.push({action:'save_schedule', settings});
  scheduleDirty = false;
  scheduleSignature = '';
});
// The window selector applies immediately while paused; other edits retain Save.
el('limit-window').addEventListener('change', () => {
  if (!latestState.running) el('schedule-form').requestSubmit();
});
function renderStartEstimate(state) {
  const schedule = state.schedule;
  const estimate = schedule?.start_estimate?.[el('dry').checked ? 'dry' : 'live'];
  const format = at => new Date(at*1000).toLocaleString('en-GB',{timeZone:'America/Sao_Paulo'});
  if (state.running && state.next_action_at) {
    el('next-action').textContent = `Next eligible action: ${format(state.next_action_at)} Sao Paulo`;
  } else if (estimate) {
    const eligible = (state.rows || []).some(r => waiting.has(r.outcome) && !r.send_attempted);
    el('next-action').textContent = !eligible ? 'Load or requeue recipients before starting.'
      : !estimate.at ? `Cannot start: ${estimate.reason}`
      : `If you press Start now: ${estimate.reason === 'Ready now' ? 'ready now' : format(estimate.at) + ' Sao Paulo'} — ${estimate.reason}. Live sending still requires approval and fresh profile checks.`;
  }
}
el('dry').addEventListener('change', () => { if (lastScheduleState) renderStartEstimate(lastScheduleState); });
el('clear-hold').addEventListener('click', () => window.lefCommands.push({action:'clear_hold'}));
const renderBase = window.lefRender;
window.lefRender = state => {
  renderBase(state);
  const schedule = state.schedule;
  if (!schedule) return;
  lastScheduleState = state;
  const s = schedule.settings;
  if (schedule.pace) el('review-pace').textContent = `Relaxed review: about ${Math.round(schedule.pace.profile_seconds)} seconds per profile, ${Math.round(schedule.pace.step_seconds)} seconds around Experience scrolling/clicks, and ${Math.round(schedule.pace.company_seconds)} seconds reading a company. Derived from working hours and daily invitation limit.`;
  const signature = JSON.stringify(s);
  if (!scheduleDirty && signature !== scheduleSignature) {
    for (const [id,key] of [['limit-invites','invites'],['limit-gap','gap_minutes'],['limit-profiles','profiles'],['limit-companies','companies'],['work-start','start'],['work-end','end']]) el(id).value = s[key];
    el('work-days').querySelectorAll('input').forEach(e => { e.checked = s.days.includes(Number(e.value)); });
    el('limit-window').value = s.window_hours || 24;
    scheduleSignature = signature;
  }
  el('schedule-form').querySelectorAll('input,select,button').forEach(e => { e.disabled = state.running; });
  el('schedule-hold').textContent = schedule.hold;
  el('clear-hold').hidden = !schedule.hold;
  el('clear-hold').disabled = state.running;
  const u = schedule.used;
  el('budget-status').textContent = `Rolling ${s.window_hours || 24}h used: invitations ${u.invite}/${s.invites} | profile loads ${u.profile}/${s.profiles} | company loads ${u.company}/${s.companies}`;
  el('next-action').textContent = state.next_action_at ? `Next eligible action: ${new Date(state.next_action_at*1000).toLocaleString('en-GB',{timeZone:'America/Sao_Paulo'})} Sao Paulo` : '';
  renderStartEstimate(state);
};
