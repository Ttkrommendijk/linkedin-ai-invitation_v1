const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/popup/messaging/message-actions.js', 'utf8');
async function check(existing, fail=false, blank=false) {
  let click, status='', refresh=0; const calls=[];
  const payload={linkedin_id:'https://www.linkedin.com/company/movigoo/',company_name:blank?'':'MovigoO',employee_number:'11-50',sector:'IT services',city:'Santiago',it_members:''};
  const ctx=vm.createContext({
    editProfileBtnEl:null,cancelProfileEditBtnEl:null,saveProfileFieldsBtnEl:{addEventListener(_,fn){click=fn;}},
    isProfileSaveInFlight:false,isProfileEditMode:true,PopupState:{currentProfileContext:{url:payload.linkedin_id}},
    getLinkedinUrlFromContext:p=>p.url,isCompanyProfileMode:()=>true,
    renderProfileEditControls(){},setFooterUpdatingStatus(){},setFooterStatus:s=>status=s,
    syncSelectedExistingCompanyFromInput(){},safeTrim:x=>String(x||'').trim(),
    PopupCompanyController:{getSelectedExistingCompanyForLink:()=>existing?{company_id:'existing',company_name:'MovigoO'}:null},
    buildCompanyProfileSavePayload:()=>({...payload}),
    sendRuntimeMessage:async(type,body)=>{calls.push({type,...body});return fail?{ok:false,error:'Save denied'}:{ok:true,data:{ok:true}};},
    refreshCompanyRowFromDb:async()=>{refresh++;},getErrorMessage:e=>String(e),UI_TEXT:{dbErrorPrefix:'Database:'},
    getFreshScrapeForPage(){throw Error('Save must not scrape or invoke AI');},
    extractCompanyDetailsFromLlm(){throw Error('Save must not require an API key');}
  });
  vm.runInContext(source.slice(source.indexOf('function bindProfileEditControls()'),source.indexOf('function bindCompanyEvents()')),ctx);
  vm.runInContext('bindProfileEditControls()',ctx);await click();
  assert.equal(ctx.isProfileSaveInFlight,false);
  if(blank){assert.equal(calls.length,0);assert.match(status,/Enter a company name/);return;}
  assert.equal(calls.length,1);assert.equal(calls[0].type,existing?'DB_UPDATE_COMPANY_BY_ID':'DB_UPSERT_COMPANY_PROFILE');
  assert.equal(calls[0].payload.linkedin_id,payload.linkedin_id);assert.equal(calls[0].payload.city,'Santiago');
  if(existing)assert.equal(calls[0].payload.company_id,'existing');
  if(fail){assert.match(status,/Save denied/);assert.equal(refresh,0);assert.equal(ctx.isProfileEditMode,true);}
  else{assert.equal(status,'Saved.');assert.equal(refresh,1);assert.equal(ctx.isProfileEditMode,false);}
}
(async()=>{await check(false);await check(true);await check(false,true);await check(false,false,true);console.log('Company Save: create, existing link, failure and required name passed; no AI or scraping.');})().catch(e=>{console.error(e);process.exitCode=1;});
