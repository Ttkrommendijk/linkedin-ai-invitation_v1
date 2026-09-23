(function (root) {
  const key = 'lefOpenAIProvider';
  const usesCodex = async () => (await chrome.storage.local.get(key))[key] === 'codex';
  async function loadSettings() {
    const settings=await chrome.storage.sync.get(['codexModel','codexReasoning','apiReasoning']);
    for(const id of ['codexModel','codexReasoning','apiReasoning']) {
      const field=document.getElementById(id);if(field)field.value=settings[id] || '';
    }
  }
  async function saveSettings() {
    const settings={};
    for(const id of ['codexModel','codexReasoning','apiReasoning']) {
      const field=document.getElementById(id);if(field)settings[id]=field.value.trim();
    }
    await chrome.storage.sync.set(settings);
  }
  function relay(request) {
    return new Promise((resolve,reject) => {
      const port=chrome.runtime.connect({name:'lef-codex'});
      let settled=false;
      const timer=setTimeout(()=>finish(null,'Codex did not respond in time. No API fallback was attempted.'),195000);
      function finish(result,error) {
        if(settled)return;
        settled=true;clearTimeout(timer);port.disconnect();
        if(error)reject(new Error(error));else resolve(result);
      }
      port.onMessage.addListener(result=>finish(result));
      port.onDisconnect.addListener(()=>{
        void chrome.runtime.lastError;
        finish(null,'Codex login requires the LEF.exe launcher tab to remain open. No API fallback was attempted.');
      });
      port.postMessage(request);
    });
  }
  async function bridge(action, payload={}) {
    const request={action,...payload};
    const result = typeof root.lefOpenAI === 'function' ? await root.lefOpenAI(request) : await relay(request);
    if (!result?.ok) throw new Error(result?.error || 'Codex connection failed');
    return result.data;
  }
  async function request(type, envelope, fallback) {
    const ai = /^(ENRICH_|GENERATE_|OPENAI_|FREE_PROMPT)/.test(type);
    if (!ai) return fallback();
    const codex=await usesCodex();
    const saved=await chrome.storage.sync.get(['model','codexModel','codexReasoning','apiReasoning']);
    const payload=envelope?.payload || {};
    const model=(payload.modelOverride || (codex?saved.codexModel:saved.model || payload.model) || (codex?'':'gpt-4.1')).trim();
    const reasoning=(payload.reasoningOverride || (codex?saved.codexReasoning:saved.apiReasoning) || '').trim();
    if(!codex) return fallback({...envelope,payload:{...payload,model,reasoningEffort:reasoning}});
    try {
      if (!['ENRICH_PROFILE','ENRICH_COMPANY_PROFILE','GENERATE_FREE_PROMPT'].includes(type)) throw new Error('This action is not supported with Codex. Use the Prompts tab to generate text or switch to API key.');
      if(type==='GENERATE_FREE_PROMPT') {
        if(!payload.prompt?.trim())throw new Error('Prompt is required.');
        const prompt=payload.prompt+'\n\nUse only the supplied context. Do not invent facts. Return the final message in the text field.\n\n'+root.LEFPrompts.buildPromptContextInput({...payload,paragraphs:true});
        const data=await bridge('enrich',{type,prompt,model,reasoning});
        return {ok:true,data:{...data,text:root.LEFUtils.clampText(data.text,1200,true)}};
      }
      const profile = envelope?.payload?.profile || {};
      const company = type === 'ENRICH_COMPANY_PROFILE';
      const instructions = company ? root.LEFPrompts.buildCompanyExtractionPrompt() : root.LEFPrompts.buildProfileExtractionPrompt();
      const input = company ? JSON.stringify(profile) : root.LEFPrompts.buildFirstMessageUserInput({profile});
      const data = await bridge('enrich',{type,prompt:instructions+'\n\nCollected profile data:\n'+input,model,reasoning});
      return {ok:true,data};
    } catch (error) { return {ok:false,error:error.message,data:null}; }
  }
  root.LEFOpenAIConnection = Object.freeze({usesCodex,request,loadSettings,saveSettings});
  async function init() {
    const panel=document.getElementById('configGeneralPanel');
    if (!panel) return;
    document.getElementById('configGeneralTabBtn').textContent='OpenAI';
    const box=document.createElement('div');box.className='row';box.id='openai-provider';
    box.innerHTML='<fieldset><legend>OpenAI connection</legend><label><input type="radio" name="openai-provider" value="api" checked> Use API key</label> <label><input type="radio" name="openai-provider" value="codex"> Use Codex login</label></fieldset><div id="codex-login-panel" hidden><p>Use your ChatGPT account for person and company enrichment. Your account usage limits apply. No automatic API fallback.</p><button type="button" id="codex-login">Sign in with ChatGPT</button> <button type="button" id="codex-status">Refresh status</button> <button type="button" id="codex-logout">Sign out</button><p id="codex-connection-status" role="status">Not connected.</p></div><p id="codex-availability"></p>';
    panel.prepend(box);
    const efforts=[['','Model default'],['low','Low / Light'],['medium','Medium'],['high','High'],['xhigh','Extra high'],['max','Max']];
    function reasoningField(id,label) {
      const row=document.createElement('div');row.className='row';
      const title=document.createElement('label');title.htmlFor=id;title.textContent=label;
      const select=document.createElement('select');select.id=id;select.className='form-control';
      for(const [value,text] of efforts)select.add(new Option(text,value));
      row.append(title,select);return row;
    }
    const codexPanel=box.querySelector('#codex-login-panel');
    codexPanel.querySelector('p').textContent='Use your ChatGPT account for enrichment and prompt generation. Account usage limits apply. No automatic API fallback.';
    const modelRow=document.createElement('div');modelRow.className='row';
    modelRow.innerHTML='<label for="codexModel">Codex model (blank uses Codex default)</label><input id="codexModel" class="form-control" placeholder="e.g. gpt-5.6-sol">';
    codexPanel.append(modelRow,reasoningField('codexReasoning','Codex reasoning'));
    const apiModelRow=document.getElementById('model').closest('.row');
    apiModelRow.querySelector('label').textContent='API model (saved)';
    apiModelRow.after(reasoningField('apiReasoning','API reasoning (use Model default for GPT-4.1)'));
    const generate=document.getElementById('generateFreePrompt');
    if(generate) {
      const overrides=document.createElement('div');overrides.className='row';
      overrides.innerHTML='<label for="promptModelOverride">Model for this generation (blank uses OpenAI settings)</label><input id="promptModelOverride" class="form-control" placeholder="e.g. gpt-5.6-sol"><small>Uses the API/Codex connection selected in OpenAI settings. Does not change saved defaults.</small>';
      generate.closest('.row').before(overrides);
      const effort=reasoningField('promptReasoningOverride','Reasoning for this generation');
      effort.querySelector('option').textContent='Use OpenAI settings';overrides.after(effort);
    }
    await loadSettings();
    const status=box.querySelector('#codex-connection-status');
    let available=typeof root.lefOpenAI==='function';
    if(!available) {
      box.querySelector('[value=codex]').disabled=true;
      try {status.textContent=(await bridge('status')).message;available=true;}
      catch(e){status.textContent=e.message;}
    }
    box.querySelector('[value=codex]').disabled=!available;
    box.querySelector('#codex-availability').textContent=available?'':'Codex login is available in LEF.exe.';
    async function show() {
      const codex=await usesCodex();
      box.querySelector('[value=codex]').checked=codex;
      box.querySelector('[value=api]').checked=!codex;
      box.querySelector('#codex-login-panel').hidden=!codex;
      document.getElementById('apiKey').closest('.row').hidden=codex;
      apiModelRow.hidden=codex;
      document.getElementById('apiReasoning').closest('.row').hidden=codex;
    }
    for (const radio of box.querySelectorAll('input[name="openai-provider"]')) radio.addEventListener('change',async()=>{
      await chrome.storage.local.set({[key]:radio.value});await show();
    });
    for (const [id,action] of [['codex-login','login'],['codex-status','status'],['codex-logout','logout']]) {
      box.querySelector('#'+id).addEventListener('click',async()=>{
        const buttons=box.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
        status.textContent='Checking Codex connection...';
        try { status.textContent=(await bridge(action)).message; }
        catch (e) { status.textContent=e.message; }
        finally { buttons.forEach(b=>b.disabled=false); }
      });
    }
    await show();
    if (available && await usesCodex()) {
      try {status.textContent=(await bridge('status')).message;} catch(e){status.textContent=e.message;}
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);else init();
})(globalThis);
