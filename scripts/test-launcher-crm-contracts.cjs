const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let saved = {id:'person',linkedin_url:'https://www.linkedin.com/in/person/',status:'registered'};
let patches = [];
const rows = ['b','a','c'].map(x=>({url:`https://www.linkedin.com/in/${x}/`,most_relevant_date:'same'}));
const ctx = {URL,URLSearchParams,console,
  LEFSupabaseService:{getSupabaseRequestContext:async()=>({supabaseUrl:'https://example.test',supabaseAnonKey:'test',accessToken:'test'})},
  LEFOpenAIService:{fetchWithTimeout:async(url,options)=>{
    const u=new URL(url);
    if(u.pathname.includes('overview')) {
      const order=u.searchParams.get('order');
      assert.match(order,/,url\.asc$/);
      const sorted=[...rows].sort((a,b)=>a.url.localeCompare(b.url));
      const offset=Number(u.searchParams.get('offset'));
      return {ok:true,headers:{get:()=>`0-0/${rows.length}`},json:async()=>sorted.slice(offset,offset+1)};
    }
    if(options.method==='PATCH') {
      const patch=JSON.parse(options.body); patches.push(patch); Object.assign(saved,patch);
      return {ok:true,json:async()=>[{id:saved.id}]};
    }
    return {ok:true,json:async()=>[saved]};
  }}
};
vm.createContext(ctx);
for(const file of ['src/shared/utils.js','src/background/supabase-overview.js','src/background/supabase-invitations.js'])
  vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
(async()=>{
  const seen=[];
  for(let page=1;page<=3;page++) {
    const r=await ctx.LEFSupabaseOverview.supabaseListInvitationsOverview({page,pageSize:1,sortField:'most_relevant_date',sortDir:'desc',filters:{campaign:'HDI EXPERIENCE 26'}});
    seen.push(r.rows[0].url);
  }
  assert.equal(new Set(seen).size,3,'Tied dates must not repeat/omit contacts');
  const reconcile=ctx.LEFSupabaseInvitations.supabaseSetAcceptedAtNow;
  await reconcile({id:'person',reconcile_existing_connection:true});
  assert.equal(saved.accepted,true); assert.equal(saved.status,'accepted'); assert.ok(saved.invited_at); assert.ok(saved.accepted_at);
  saved.status='message responded'; saved.invited_at='original-invite'; saved.accepted_at='original-acceptance';
  await reconcile({id:'person',reconcile_existing_connection:true});
  assert.equal(saved.status,'message responded'); assert.equal(saved.invited_at,'original-invite'); assert.equal(saved.accepted_at,'original-acceptance');
  patches=[];
  await reconcile({id:'person'});
  assert.equal(patches[0].status,'accepted'); assert.equal('invited_at' in patches[0],false,'Legacy callers unchanged');
  console.log('PASS: tied-date pagination, connected reconciliation, historical dates/later status preserved, legacy contract unchanged. Mocked only.');
})().catch(e=>{console.error(e);process.exitCode=1});
