"""Exercise Runner -> Chrome runtime -> background -> overview adapter; fake HTTP only."""
import sys, tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'launcher'))
from main import Runner, EXTENSION, sync_playwright
from ledger import Ledger
with tempfile.TemporaryDirectory() as data, sync_playwright() as pw:
    context=pw.chromium.launch_persistent_context(str(Path(data)/'browser'),channel='chromium',headless=False,args=[f'--disable-extensions-except={EXTENSION}',f'--load-extension={EXTENSION}'])
    worker=next(iter(context.service_workers),None) or context.wait_for_event('serviceworker')
    worker.evaluate('''async () => {
      globalThis.testRequests=[];
      globalThis.fetch=async (url,opts)=>{
        const u=new URL(url);
        if(u.pathname.includes('vw_linkedin_invitations_reminder_overview')){
          testRequests.push(Object.fromEntries(u.searchParams));
          const rows=['zeta','alpha','beta'].map(name=>({url:`https://www.linkedin.com/in/${name}/`,name}));
          return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json','content-range':'0-2/3'}});
        }
        if(u.pathname.endsWith('/user')) return new Response(JSON.stringify({id:'fixture-owner'}),{status:200});
        if(u.pathname.endsWith('/linkedin_invitations')) {
          const slug=['zeta','alpha','beta'].find(value=>decodeURIComponent(u.search).includes('/in/'+value));
          const url='https://www.linkedin.com/in/'+slug+'/';
          return new Response(JSON.stringify([{linkedin_url:url,full_name:'Person '+url.split('/').at(-2),company:'Registered company',company_id:url.includes('/beta/')?null:'linked-id'}]),{status:200});
        }
        if(u.pathname.endsWith('/company'))return new Response(JSON.stringify([{company_id:'linked-id',company_name:'Linked company'}]),{status:200});
        return new Response('[]',{status:200,headers:{'content-type':'application/json'}});
      };
      await LEFSupabaseService.persistSupabaseSession({access_token:'fixture',refresh_token:'fixture',expires_at:Date.now()/1000+3600,user:{id:'fixture-owner'}});
    }''')
    page=context.new_page(); page.goto(worker.url.split('/src/')[0]+'/src/launcher/launcher.html')
    frame=page.locator('#crm').element_handle().content_frame()
    frame.wait_for_function('typeof buildOverviewQueryState === "function"')
    frame.evaluate('''() => {
      const option=new Option('Selected fixture','fixture-id',true,true); option.dataset.campaignName='Selected fixture'; filterCampaignEl.add(option); filterCampaignEl.value='fixture-id';
      overviewFilters.campaign='fixture-id'; overviewSortField='most_relevant_date'; overviewSortDir='desc';
    }''')
    ledger=Ledger(Path(data)/'test.sqlite3');runner=Runner(context,page,ledger)
    runner.load('https://www.linkedin.com/in/zeta/')
    assert [r['url'].split('/')[-2] for r in ledger.rows()]==['zeta','alpha','beta']
    assert ledger.next()['url'].endswith('/alpha/')
    details=ledger.meta('recipient_details')
    assert details['https://www.linkedin.com/in/alpha/']['company']=='Linked company',details
    assert details['https://www.linkedin.com/in/beta/']['company']=='Registered company',details
    runner.command({'action':'exclude_company','url':'https://www.linkedin.com/in/alpha/'})
    assert ledger.next()['url'].endswith('/beta/')
    runner.load('')
    assert ledger.get('https://www.linkedin.com/in/alpha/')['outcome']=='skipped_manual'
    ledger.meta('recipient_details',{})
    ledger.meta('recipient_names',{})
    runner.restore_recipient_display()
    restored=ledger.meta('recipient_details')
    assert restored['https://www.linkedin.com/in/alpha/']['company']=='Linked company'
    assert restored['https://www.linkedin.com/in/beta/']['company']=='Registered company'
    assert restored['https://www.linkedin.com/in/alpha/']['name']=='Person alpha'
    assert ledger.get('https://www.linkedin.com/in/alpha/')['outcome']=='skipped_manual'
    assert not runner.running
    requests=worker.evaluate('testRequests')
    batch=[r for r in requests if r.get('limit')=='10000']
    assert len(batch)==1,requests
    assert batch[0]['offset']=='0' and batch[0]['order']=='most_relevant_date.desc,url.asc',batch
    assert batch[0]['campaigns']=='ilike.*Selected fixture*',batch
    print('PASS: real Chrome messaging/background/overview route; one complete ordered batch and resume. HTTP fixtures; no live writes.')
    ledger.db.close();context.close()
