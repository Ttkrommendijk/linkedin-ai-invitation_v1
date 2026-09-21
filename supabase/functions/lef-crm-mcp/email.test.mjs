import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { createEmailService, renderEmail } from './email.mjs';
import { createEventHandler, verifySignature } from '../lef-crm-email-events/handler.mjs';

const owner=randomUUID(), other=randomUUID(), contactId=randomUUID(), campaign=randomUUID();
const secret='whsec_'+Buffer.from('test-secret-for-hmac-verification').toString('base64');
const base={message_key:'hdi-thanks-v1',subject:'Obrigado',body_text:'Obrigado! https://example.com/diagnostico',contact_id:contactId,campaign_id:campaign,permission_to_email:true};
function harness(provider=async()=>new Response(JSON.stringify({id:randomUUID()}))) {
  const tables={crm_email_settings:[{owner_user_id:owner,from_address:'Tiago — LEF <tiago@mail.lef.tec.br>',reply_to:'tiago@lef.tec.br',test_address:'tiago@lef.tec.br',enabled:true,webhook_secret:secret}],linkedin_invitations:[{id:contactId,uuid:owner,email:'visitor@example.com',full_name:'Visitor',archived:false}],campaign:[{campaign_id:campaign,archived:false}],person_campaign:[{campaign_id:campaign,person_id:contactId}],crm_email_messages:[],crm_email_suppressions:[],crm_email_events:[]};
  const requests=[];
  const db=async(path,init={})=>{
    const u=new URL('https://db.test/'+path),table=u.pathname.slice(1),p=u.searchParams;
    assert.ok(tables[table],table);
    const matches=row=>[...p].every(([key,value])=>{
      if (['select','on_conflict','order','limit'].includes(key))return true;
      if(value==='not.is.null')return row[key]!=null;
      if(value==='is.null')return row[key]==null;
      if(value.startsWith('eq.'))return String(row[key])===value.slice(3);
      throw Error('Unknown filter '+key+'='+value);
    });
    if(init.method==='POST') {
      const input=JSON.parse(init.body);
      const unique=(p.get('on_conflict')||'').split(',');
      if(p.has('on_conflict')&&tables[table].some(row=>unique.every(key=>row[key]===input[key])))return [];
      const row={...input};
      if(table==='crm_email_messages')Object.assign(row,{id:randomUUID(),state:'draft',unsubscribe_token:randomUUID()});
      tables[table].push(row);return structuredClone([row]);
    }
    const found=tables[table].filter(matches);
    if(init.method==='PATCH')for(const row of found)Object.assign(row,JSON.parse(init.body));
    return structuredClone(found);
  };
  const service=createEmailService({db,env:name=>name==='RESEND_API_KEY'?'test-provider-key':'https://project.test',fetcher:async(...args)=>{requests.push(args);return provider(...args);}});
  return {tables,db,service,requests,events:createEventHandler({db})};
}
test('status never returns signing or API secrets',async()=>{const h=harness();const s=await h.service.call('get_crm_email_status',{},owner);assert.equal(s.api_key_configured,true);assert.ok(!JSON.stringify(s).includes(secret));assert.ok(!JSON.stringify(s).includes('test-provider-key'));});
test('missing environment key uses server-only Vault RPC without exposing the key',async()=>{
  const h=harness();let vaultReads=0;
  const service=createEmailService({env:()=>undefined,db:async(path,init)=>{
    if(path==='rpc/crm_resend_api_key'){vaultReads++;assert.equal(init.method,'POST');return 'vault-secret-value';}
    return h.db(path,init);
  }});
  const status=await service.call('get_crm_email_status',{},owner);
  assert.equal(status.api_key_configured,true);assert.equal(vaultReads,1);
  assert.ok(!JSON.stringify(status).includes('vault-secret-value'));
  await assert.rejects(service.call('get_crm_email_status',{},other),/owner/);
  assert.equal(vaultReads,1);
});
test('preparation checks ownership, permission and campaign before writes',async()=>{const h=harness();await assert.rejects(h.service.prepare(base,other),/owner/);await assert.rejects(h.service.prepare({...base,permission_to_email:false},owner),/permission/);h.tables.person_campaign=[];await assert.rejects(h.service.prepare(base,owner),/campaign/);assert.equal(h.tables.crm_email_messages.length,0);assert.equal(h.requests.length,0);});
test('preview is immutable and idempotent; changed content conflicts',async()=>{const h=harness();const a=await h.service.prepare(base,owner),b=await h.service.prepare(base,owner);assert.equal(a.id,b.id);assert.match(a.body_as_sent,/Cancelar|receber mais/);await assert.rejects(h.service.prepare({...base,subject:'Changed'},owner),/different content/);assert.equal(h.requests.length,0);});
test('owner and immediate confirmation required before sending',async()=>{const h=harness();const d=await h.service.prepare(base,owner);await assert.rejects(h.service.send({email_id:d.id},owner),/approval/);await assert.rejects(h.service.send({email_id:d.id,confirmed:true},other),/owner/);assert.equal(h.requests.length,0);});
test('concurrent approval and later retries send once with stable idempotency',async()=>{const h=harness();const d=await h.service.prepare(base,owner);await Promise.all([h.service.send({email_id:d.id,confirmed:true},owner),h.service.send({email_id:d.id,confirmed:true},owner)]);await h.service.send({email_id:d.id,confirmed:true},owner);assert.equal(h.requests.length,1);const [,init]=h.requests[0];assert.equal(init.headers['Idempotency-Key'],'crm-email/'+d.id);const body=JSON.parse(init.body);assert.deepEqual(body.to,['visitor@example.com']);assert.equal(body.reply_to,'tiago@lef.tec.br');assert.equal(h.tables.crm_email_messages[0].state,'accepted');});
test('changed address and unsubscribed recipient block previously prepared draft',async()=>{const h=harness();const d=await h.service.prepare(base,owner);h.tables.linkedin_invitations[0].email='changed@example.com';await assert.rejects(h.service.send({email_id:d.id,confirmed:true},owner),/changed/);h.tables.linkedin_invitations[0].email='visitor@example.com';h.tables.crm_email_suppressions.push({owner_user_id:owner,email:'visitor@example.com',reason:'unsubscribe'});await assert.rejects(h.service.send({email_id:d.id,confirmed:true},owner),/suppressed/);assert.equal(h.requests.length,0);});
test('timeout is uncertain and never automatically retried',async()=>{const h=harness(async()=>{throw Error('timeout');});const d=await h.service.prepare(base,owner);const r=await h.service.send({email_id:d.id,confirmed:true},owner);assert.equal(r.state,'uncertain');await h.service.send({email_id:d.id,confirmed:true},owner);assert.equal(h.requests.length,1);});
test('provider rejection is recorded without leaking response content',async()=>{const h=harness(async()=>new Response('sensitive debug',{status:403}));const d=await h.service.prepare(base,owner);const r=await h.service.send({email_id:d.id,confirmed:true},owner);assert.equal(r.state,'rejected');assert.equal(r.last_error,'Resend HTTP 403');});
test('test mode uses only configured owner address with no CRM customer link',async()=>{const h=harness();const d=await h.service.prepare({message_key:'setup-test',subject:'Test',body_text:'Test',is_test:true},owner);assert.equal(d.recipient,'tiago@lef.tec.br');assert.equal(d.contact_id,null);await assert.rejects(h.service.prepare({...base,is_test:true},owner),/customer/);});
test('email rendering escapes active HTML and provides unsubscribe headers',()=>{const p=renderEmail({id:randomUUID(),unsubscribe_token:randomUUID(),body_text:'<script>alert(1)</script>\nhttps://example.com/?a=1&b=2'},'https://project.test/events');assert.ok(!p.html.includes('<script>'));assert.match(p.html,/&lt;script&gt;/);assert.match(p.headers['List-Unsubscribe'],/^<https:\/\//);});
function signedRequest(event,adjust=0) {
  const raw=JSON.stringify(event),id='msg_test',stamp=String(Math.floor(Date.now()/1000)+adjust);
  const sig=createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`${id}.${stamp}.${raw}`).digest('base64');
  return new Request('https://project.test/events',{method:'POST',headers:{'svix-id':id,'svix-timestamp':stamp,'svix-signature':'v1,'+sig},body:raw});
}
test('signature verifies raw bytes and rejects forgery and stale timestamps',async()=>{const r=signedRequest({type:'email.delivered'}),raw=await r.text();assert.equal(await verifySignature(raw,r.headers,secret),true);assert.equal(await verifySignature(raw+' ',r.headers,secret),false);const old=signedRequest({},-600);assert.equal(await verifySignature(await old.text(),old.headers,secret),false);});
test('signed callback records evidence once and suppresses bounced addresses',async()=>{const h=harness();const d=await h.service.prepare(base,owner);const sent=await h.service.send({email_id:d.id,confirmed:true},owner);const event={type:'email.bounced',created_at:new Date().toISOString(),data:{email_id:sent.provider_id}};assert.equal((await h.events(signedRequest(event))).status,200);assert.equal((await h.events(signedRequest(event))).status,200);assert.equal(h.tables.crm_email_events.length,1);assert.equal(h.tables.crm_email_suppressions.length,1);assert.ok(h.tables.crm_email_messages[0].bounced_at);assert.equal(h.tables.crm_email_messages[0].state,'accepted');});
test('forged callbacks have no effects; unknown provider IDs request retry',async()=>{const h=harness();assert.equal((await h.events(new Request('https://project.test/events',{method:'POST',body:'{}'}))).status,401);assert.equal((await h.events(signedRequest({type:'email.sent',created_at:new Date().toISOString(),data:{email_id:randomUUID()}}))).status,503);assert.equal(h.tables.crm_email_events.length,0);});
test('unsubscribe GET asks confirmation; POST suppresses and is idempotent',async()=>{const h=harness();await h.service.prepare(base,owner);const row=h.tables.crm_email_messages[0];const url='https://project.test/events/unsubscribe?token='+row.unsubscribe_token;assert.equal((await h.events(new Request(url))).status,200);assert.equal(h.tables.crm_email_suppressions.length,0);assert.equal((await h.events(new Request(url,{method:'POST'}))).status,200);assert.equal((await h.events(new Request(url,{method:'POST'}))).status,200);assert.equal(h.tables.crm_email_suppressions.length,1);});
