"""Exercise real Chrome popup/side-panel targets, not tabs displaying their HTML."""
import os,json,tempfile,time
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
extension=Path(os.environ.get('LEF_TEST_EXTENSION',root))
os.environ['PLAYWRIGHT_BROWSERS_PATH']=str(root/'.launcher-browsers')
with tempfile.TemporaryDirectory(prefix='lef-native-') as profile, sync_playwright() as pw:
    context=pw.chromium.launch_persistent_context(profile,channel='chromium',headless=False,
        args=[f'--disable-extensions-except={extension}',f'--load-extension={extension}'])
    calls=[]
    def native(source,request):
        calls.append((source['frame'].url,request['action']))
        if request['action']=='enrich':
            if request['type']=='GENERATE_FREE_PROMPT':
                assert request['model']=='gpt-5.6-sol',request
                assert request['reasoning']=='low',request
                assert 'Private strategy fixture' not in request['prompt']
                assert 'blank line' in request['prompt']
                return {'ok':True,'data':{'ok':True,'text':'Hello fixture,\n\nMain point.\n\nClosing.'}}
            assert request['model']=='gpt-5.6-terra',request
            assert request['reasoning']=='medium',request
            if request['type']=='ENRICH_COMPANY_PROFILE':
                return {'ok':False,'error':'Fixture: Codex usage limit reached.'}
            return {'ok':True,'data':{'ok':True,'company':'Fixture','headline':'IT Manager','language':'Portuguese'}}
        return {'ok':True,'data':{'connected':True,'message':'Connected with ChatGPT.'}}
    context.expose_binding('lefOpenAI',native)
    worker=next(iter(context.service_workers),None) or context.wait_for_event('serviceworker')
    worker.evaluate("async()=>chrome.storage.local.set({lefOpenAIProvider:'codex'})")
    worker.evaluate("async()=>chrome.storage.sync.set({model:'gpt-4.1',codexModel:'gpt-5.6-terra',codexReasoning:'medium'})")
    page=context.new_page();page.goto(worker.url.rsplit('/',3)[0]+'/src/launcher/launcher.html')
    page.locator('.activity > summary').click();page.locator('#panel').click()
    page.wait_for_timeout(500)
    worker.evaluate('async()=>chrome.action.openPopup()');page.wait_for_timeout(500)
    cdp=context.new_cdp_session(page);responses={}
    def received(event):
        response=json.loads(event['message'])
        if 'id' in response: responses[response['id']]=response
    cdp.on('Target.receivedMessageFromTarget',received)
    views=[]
    for target in cdp.send('Target.getTargets')['targetInfos']:
        if target['url'].endswith('/src/popup/popup.html'): view='popup';window='window'
        elif target['url'].endswith('/sidepanel.html') and '/src/popup/' not in target['url']: view='side_panel';window="document.getElementById('panelFrame').contentWindow"
        else: continue
        ident=len(views)+1;views.append(view)
        session=cdp.send('Target.attachToTarget',{'targetId':target['targetId'],'flatten':False})['sessionId']
        expression="""(async()=>{
          const w=WINDOW;
          const success=await w.sendRuntimeMessage('ENRICH_PROFILE',{payload:{profile:{headline:'IT Manager'}}});
          const failure=await w.sendRuntimeMessage('ENRICH_COMPANY_PROFILE',{payload:{profile:{name:'Fixture'}}});
          w.document.getElementById('freePromptInput').value='Write a greeting';
          w.document.getElementById('freePromptIncludeProfile').checked=false;
          w.document.getElementById('freePromptIncludeStrategy').checked=false;
          w.document.getElementById('strategy').value='Private strategy fixture';
          w.document.getElementById('promptModelOverride').value='gpt-5.6-sol';
          w.document.getElementById('promptReasoningOverride').value='low';
          w.document.getElementById('freePromptPreview').textContent='Old message must disappear';
          const send=w.sendRuntimeMessage;let release;
          w.sendRuntimeMessage=async(...args)=>{await new Promise(r=>release=r);return send(...args);};
          w.document.getElementById('generateFreePrompt').click();
          for(let i=0;i<50 && !release;i++)await new Promise(r=>setTimeout(r,20));
          w.setFooterStatus('Ready');
          const pending={empty:!w.document.getElementById('freePromptPreview').textContent,
            disabled:w.document.getElementById('generateFreePrompt').disabled,
            label:w.document.getElementById('generateFreePrompt').textContent,
            footer:w.document.getElementById('commFooterText').textContent};
          release();
          for(let i=0;i<50 && !w.document.getElementById('freePromptPreview').textContent;i++) await new Promise(r=>setTimeout(r,50));
          let copied='';w.copyToClipboard=async text=>{copied=text;return {ok:true};};
          w.document.getElementById('copyFreePrompt').click();
          await new Promise(r=>setTimeout(r,50));
          const preview=w.document.getElementById('freePromptPreview').textContent;
          const completion=w.document.getElementById('freePromptGenerationStatus').textContent;
          w.sendRuntimeMessage=async()=>({ok:false,error:'Fixture generation failure'});
          w.document.getElementById('generateFreePrompt').click();
          for(let i=0;i<50 && w.document.getElementById('generateFreePrompt').disabled;i++)await new Promise(r=>setTimeout(r,20));
          return {binding:typeof w.lefOpenAI,success,error:w.getErrorMessage(failure.error),
            copied,
            pending,completion,preview,
            failed:w.document.getElementById('freePromptGenerationStatus').textContent,
            recovered:!w.document.getElementById('generateFreePrompt').disabled && !w.document.getElementById('freePromptPreview').textContent,
            enabled:!w.document.querySelector('#openai-provider [value=codex]').disabled};
        })()""".replace('WINDOW',window)
        cdp.send('Target.sendMessageToTarget',{'sessionId':session,'message':json.dumps({'id':ident,'method':'Runtime.evaluate','params':{'expression':expression,'awaitPromise':True,'returnByValue':True}})})
    deadline=time.monotonic()+15
    while len(responses)<len(views) and time.monotonic()<deadline: page.wait_for_timeout(100)
    assert set(views)=={'popup','side_panel'},views
    for ident,view in enumerate(views,1):
        result=responses[ident]['result']['result'].get('value')
        assert result and result['binding']=='undefined',(view,responses[ident])
        assert result['success']['data']['headline']=='IT Manager',(view,result)
        assert result['error']=='Fixture: Codex usage limit reached.',(view,result)
        assert result['enabled'],(view,result)
        assert result['preview']=='Hello fixture,\n\nMain point.\n\nClosing.',(view,result)
        assert result['copied']==result['preview'],(view,result)
        assert result['pending']=={'empty':True,'disabled':True,'label':'Generating...','footer':'Generating message...'},(view,result)
        assert result['completion']=='New message generated. Ready to copy.',(view,result)
        assert result['failed']=='Generation failed: Fixture generation failure' and result['recovered'],(view,result)
    assert all(url.endswith('/src/launcher/launcher.html') for url,action in calls if action=='enrich'),calls
    context.close()
    print('PASS: real popup and side panel relay enrichment; readable errors; no direct native binding required.')
