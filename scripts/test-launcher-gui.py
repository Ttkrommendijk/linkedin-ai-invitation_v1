"""Offline GUI verification in Chromium with the real unpacked extension."""
import json
import os
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = str(root / '.launcher-browsers')
output = root / 'build/gui-verification'
output.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='lef-gui-') as profile_dir, sync_playwright() as pw:
    context = pw.chromium.launch_persistent_context(profile_dir, channel='chromium', headless=False,
        viewport={'width':1440,'height':1000}, args=[f'--disable-extensions-except={root}',f'--load-extension={root}'])
    codex_requests=[]
    def codex_fixture(source, request):
        codex_requests.append(request)
        if request['action']=='enrich':
            if request['type']=='ENRICH_COMPANY_PROFILE':
                return {'ok':True,'data':{'ok':True,'company_name':'Fixture company','employee_number':'11-50','sector':'IT','city':'Curitiba','it_members':''}}
            return {'ok':True,'data':{'ok':True,'company':'Fixture company','headline':'IT Manager','language':'Portuguese'}}
        return {'ok':True,'data':{'connected':True,'message':'Connected with ChatGPT.'}}
    context.expose_binding('lefOpenAI',codex_fixture)
    worker = next(iter(context.service_workers), None) or context.wait_for_event('serviceworker')
    worker.evaluate("async()=>chrome.storage.local.set({lefOpenAIProvider:'api'})")
    worker.evaluate("async()=>chrome.storage.local.remove('lefLauncherResultColumnWidths')")
    page = context.new_page()
    errors=[]
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(f"chrome-extension://{worker.url.split('/')[2]}/src/launcher/launcher.html")
    page.locator('#crm-container.ready').wait_for()
    frame=page.frame_locator('#crm')
    assert frame.locator('#personsListPanel').is_visible()
    assert not frame.locator('#topTabs').is_visible()
    assert not frame.locator('#listCompaniesTabBtn').is_visible()
    crm = page.locator('#crm').element_handle().content_frame()
    crm.evaluate("async () => { await chrome.storage.local.remove(STORAGE_KEY_LIST_COLUMN_WIDTHS); await loadOverviewColumnPrefs(); autoSizeGridColumns(document.querySelector('#personsListPanel table'), document.querySelector('#overviewTbody'), 'persons'); }")
    name_header = frame.locator('#personsListPanel th').nth(1)
    name_handle = name_header.locator('.col-resize-handle')
    before_name = name_header.bounding_box()['width']
    box = name_handle.bounding_box()
    page.mouse.move(box['x']+4, box['y']+box['height']/2)
    page.mouse.down()
    page.mouse.move(box['x']+84, box['y']+box['height']/2, steps=8)
    page.mouse.up()
    assert name_header.bounding_box()['width'] > before_name + 50
    saved_name = frame.locator('#personsListPanel col').nth(1).evaluate('e => e.style.width')
    page.wait_for_timeout(300)  # Existing preference writer is debounced by 180 ms.
    page.reload()
    page.locator('#crm-container.ready').wait_for()
    crm = page.locator('#crm').element_handle().content_frame()
    crm.evaluate("async () => { await loadOverviewColumnPrefs(); autoSizeGridColumns(document.querySelector('#personsListPanel table'), document.querySelector('#overviewTbody'), 'persons'); }")
    assert frame.locator('#personsListPanel col').nth(1).evaluate('e => e.style.width') == saved_name
    page.locator('[data-view=settings]').click()
    assert frame.locator('#apiKey').is_visible()
    assert frame.locator('#configGeneralTabBtn').inner_text()=='OpenAI'
    frame.locator('input[name=openai-provider][value=codex]').check()
    frame.locator('#codex-login-panel').wait_for()
    assert not frame.locator('#apiKey').is_visible()
    frame.locator('#codex-login').click()
    frame.locator('#codex-connection-status').filter(has_text='Connected with ChatGPT.').wait_for()
    assert codex_requests[-1]['action']=='login'
    frame.locator('#codexModel').fill('gpt-5.6-sol')
    frame.locator('#codexReasoning').select_option('low')
    crm.evaluate('async()=>PopupConfigController.saveConfig()')
    saved=worker.evaluate("async()=>chrome.storage.sync.get(['model','codexModel','codexReasoning'])")
    assert saved=={'model':'gpt-4.1','codexModel':'gpt-5.6-sol','codexReasoning':'low'},saved
    response=crm.evaluate("async()=>LEFOpenAIConnection.request('ENRICH_PROFILE',{payload:{apiKey:'sk-fixture-must-not-cross',profile:{name:'Fixture',headline:'IT Manager'}}},()=>{throw Error('API fallback forbidden')})")
    assert response['data']['headline']=='IT Manager'
    assert codex_requests[-1]['model']=='gpt-5.6-sol' and codex_requests[-1]['reasoning']=='low'
    response=crm.evaluate("async()=>LEFOpenAIConnection.request('ENRICH_COMPANY_PROFILE',{payload:{profile:{name:'Fixture company',employees:'11-50'}}},()=>{throw Error('API fallback forbidden')})")
    assert response['data']['employee_number']=='11-50'
    assert 'Fixture company' in codex_requests[-1]['prompt']
    page.screenshot(path=str(output/'openai-codex.png'), full_page=True)
    assert 'sk-fixture-must-not-cross' not in json.dumps(codex_requests)
    response=crm.evaluate("async()=>LEFOpenAIConnection.request('GENERATE_INVITE',{},()=>{throw Error('API fallback forbidden')})")
    assert not response['ok'] and 'not supported with Codex' in response['error']
    frame.locator('input[name=openai-provider][value=api]').check()
    frame.locator('#apiKey').wait_for()
    response=crm.evaluate("async()=>LEFOpenAIConnection.request('GENERATE_FREE_PROMPT',{payload:{modelOverride:'gpt-5.6-terra',reasoningOverride:'low'}},updated=>updated)")
    assert response['payload']['model']=='gpt-5.6-terra' and response['payload']['reasoningEffort']=='low'
    assert frame.locator('#model').input_value()=='gpt-4.1'
    assert frame.locator('#model').is_visible()
    frame.locator('#configSupabaseTabBtn').click()
    assert frame.locator('#webhookBaseUrl').is_visible()
    page.screenshot(path=str(output/'settings.png'), full_page=True)
    page.locator('[data-view=recipients]').click()
    assert frame.locator('#filterCampaign').is_visible()
    page.screenshot(path=str(output/'recipients.png'), full_page=True)
    rows=[]
    for i,outcome in enumerate(['queued','dry_run','invited','skipped_pending','ambiguous','connected_reconciled','confirmed_sync_error']):
        rows.append({'url':f'https://www.linkedin.com/in/fixture-{i}/','position':i,'name':f'Example person {i+1}',
            'step':'queued' if i==0 else 'sync','outcome':outcome,'error':'Recorded fixture outcome',
            'confirmed':int(outcome in ('invited','confirmed_sync_error')),'send_attempted':int(outcome in ('invited','ambiguous','confirmed_sync_error'))})
    rows[1]['name']='<img src=x onerror=alert(1)>'
    rows[0]['company']='Example company'
    state={'rows':rows,'status':'Paused. Ready to continue when you press Start.','running':False,'current':None,'log':[], 'campaign':'Example campaign','approval':None}
    page.evaluate('s=>lefRender(s)',state)
    page.locator('[data-view=results]').click()
    assert page.locator('#results tr').count()==7
    assert page.locator('#results img').count()==0
    assert page.locator('#results tr').first.locator('td').nth(2).inner_text()=='Example company'
    page.locator('#results tr').first.get_by_role('button',name='Skip company',exact=True).click()
    assert page.evaluate('lefCommands.at(-1)')=={'action':'exclude_company','url':rows[0]['url']}
    assert page.locator('#results tr').nth(1).inner_text().find('not sent')>=0
    assert page.locator('#sent-count').inner_text()=='1'
    assert page.locator('#error-count').inner_text()=='2'
    assert page.locator('#start').is_enabled()
    assert page.locator('#pause').is_disabled()
    page.locator('#result-filter').select_option('attention')
    assert page.locator('#results tr').count()==2
    page.locator('#result-filter').select_option('all')
    page.locator('table[data-widths-ready=true]').wait_for()
    result_header = page.locator('#results-view th').nth(1)
    before_result = result_header.bounding_box()['width']
    box = result_header.locator('.result-resize-handle').bounding_box()
    page.mouse.move(box['x']+4, box['y']+box['height']/2)
    page.mouse.down()
    page.mouse.move(box['x']+94, box['y']+box['height']/2, steps=8)
    page.mouse.up()
    assert abs(result_header.bounding_box()['width'] - before_result - 90) < 2
    result_header.locator('.result-resize-handle').press('ArrowRight')
    expected_width = result_header.bounding_box()['width']
    page.wait_for_function('!document.body.classList.contains("resizing-column")')
    page.reload()
    page.locator('#crm-container.ready').wait_for()
    page.evaluate('s=>lefRender(s)',state)
    page.locator('[data-view=results]').click()
    page.locator('table[data-widths-ready=true]').wait_for()
    assert abs(result_header.bounding_box()['width'] - expected_width) < 2
    page.screenshot(path=str(output/'results.png'), full_page=True)
    page.locator('#dry').uncheck()
    assert page.locator('#start').inner_text()=='Start invitations'
    state['batch_request']={'nonce':'fixture-batch','urls':[rows[0]['url'],rows[1]['url']],'expires':9999999999}
    page.evaluate('s=>lefRender(s)',state)
    assert page.locator('#batch-dialog').is_visible()
    assert page.locator('#batch-recipients li').count()==2
    page.locator('#approve_batch').click()
    assert page.evaluate('lefCommands.at(-1).batch_nonce')=='fixture-batch'
    assert page.evaluate('lefCommands.at(-1).action')=='approve_batch'
    state['batch_request']=None
    state.update(running=True,current=rows[0]['url'])
    page.evaluate('s=>lefRender(s)',state)
    assert page.locator('#start').is_disabled()
    assert page.locator('#pause').is_enabled()
    assert page.locator('#load').is_disabled()
    page.locator('#pause').click()
    assert page.evaluate('lefCommands.at(-1).action')=='pause'
    state.update(running=False, schedule={'settings':{'invites':10,'gap_minutes':30,'profiles':30,'companies':10,'start':'09:00','end':'17:00','days':[0,1,2,3,4]},'used':{'invite':2,'profile':5,'company':1},'hold':'Review warning'},next_action_at=1790000000)
    page.evaluate('s=>lefRender(s)',state)
    page.locator('[data-view=settings]').click()
    assert page.locator('#execution-settings').is_visible()
    state['schedule']['pace']={'profile_seconds':144,'step_seconds':4.8,'company_seconds':24}
    page.evaluate('s=>lefRender(s)',state)
    assert '144 seconds' in page.locator('#review-pace').inner_text()
    assert page.locator('#limit-invites').input_value()=='10'
    page.locator('#limit-invites').fill('15')
    page.evaluate('s=>lefRender(s)',state)
    assert page.locator('#limit-invites').input_value()=='15', 'Render overwrote unsaved settings'
    page.locator('#limit-window').select_option('12')
    command=page.evaluate('lefCommands.at(-1)')
    assert command['action']=='save_schedule' and command['settings']['invites']==15
    assert command['settings']['window_hours']==12
    state['schedule']['settings']=command['settings']
    state['schedule']['start_estimate']={'live':{'at':1790000000,'reason':'Invite rolling 12-hour limit reached'},'dry':{'at':1790000000,'reason':'Ready now'}}
    page.evaluate('s=>lefRender(s)',state)
    assert 'Rolling 12h used' in page.locator('#budget-status').inner_text()
    assert '2/15' in page.locator('#budget-status').inner_text()
    assert 'If you press Start now:' in page.locator('#next-action').inner_text()
    assert 'Sao Paulo' in page.locator('#next-action').inner_text()
    page.locator('#dry').check()
    assert 'ready now' in page.locator('#next-action').inner_text()
    page.locator('#clear-hold').click()
    assert page.evaluate('lefCommands.at(-1).action')=='clear_hold'
    page.screenshot(path=str(output/'execution-settings.png'),full_page=True)
    state['running']=True
    page.evaluate('s=>lefRender(s)',state)
    assert page.locator('#save-schedule').is_disabled()
    assert page.locator('#limit-window').is_disabled()
    assert page.locator('#clear-hold').is_disabled()
    assert frame.locator('#execution-settings').count()==0, 'Executable settings leaked into popup'
    assert not errors,errors
    (output/'result.json').write_text(json.dumps({'passed':True,'page_errors':errors,'checks':['Persons-only embed','settings/API key/login','ordered journal table','outcome distinction','safe labels','filters','running controls','pause command','Persons drag and saved width','results drag/keyboard and saved width']},indent=2))
    context.close()
