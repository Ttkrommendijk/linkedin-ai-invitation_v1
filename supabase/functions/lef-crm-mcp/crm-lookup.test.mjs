import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { emailTools, createEmailService } from './email.mjs';
const source=readFileSync(process.env.CRM_SOURCE || new URL('./index.ts',import.meta.url),'utf8');
const owner='7c17efbe-d8bf-4012-96b5-5d9a29968fcb';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rows=Array.from({length:2301},(_,i)=>({id:id(i+1),uuid:owner,archived:false,full_name:i===2300?'Rafael Garcia':'Person '+i,company:'SCFN',headline:'Analista',company_id:null}));
function harness(cap=1000,failPage=false){
 const calls=[];
 const db=async(path,init={})=>{
  calls.push(path); assert.equal(init.method||'GET','GET','No writes during duplicate reuse');
  const u=new URL('https://example.test/'+path),p=u.searchParams;
  if(u.pathname!='/linkedin_invitations')return [];
  assert.equal(p.get('uuid'),'eq.'+owner);
  let data=rows.filter(x=>p.get('archived')!=='eq.false'||!x.archived);
  if(p.get('id')?.startsWith('eq.'))data=data.filter(x=>x.id===p.get('id').slice(3));
  if(p.get('id')?.startsWith('gt.')){if(failPage)throw Error('page failed');data=data.filter(x=>x.id>p.get('id').slice(3));}
  return data.slice(0,Math.min(cap,Number(p.get('limit')||cap)));
 };
 const ctx=vm.createContext({URL,Response,Request,console,Date,emailTools,createEmailService,Deno:{env:{get:()=>''},serve:()=>{}},mockDb:db});
 vm.runInContext(stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm,''))+'\ndb=mockDb;globalThis.api={searchContacts,getContactContext,createContact};',ctx);
 return {api:ctx.api,calls};
}
test('existing normalized filtering and result limit',async()=>{const {api}=harness();const r=await api.searchContacts({query:'PERSON',company:'scfn',role:'analista',limit:2},owner);assert.equal(r.count,2);});
test('late contact found despite server cap below requested page size',async()=>{const {api}=harness(37);const r=await api.searchContacts({query:'Rafael Garcia'},owner);assert.equal(r.contacts[0]?.id,id(2301));});
test('exact ID lookup uses database predicate',async()=>{const {api,calls}=harness();const r=await api.getContactContext({contact_id:id(2301)},owner);assert.equal(r.contact.id,id(2301));assert.ok(calls[0].includes('id=eq.'+id(2301)));});
test('late duplicate reused with no writes',async()=>{const {api}=harness();const r=await api.createContact({confirmed:true,full_name:'Rafael Garcia',company_name:'SCFN'},owner);assert.equal(r.reused,true);});
test('later page failure never becomes a false no-match',async()=>{const {api}=harness(37,true);await assert.rejects(api.searchContacts({query:'Rafael Garcia'},owner),/page failed/);});
test('exact missing ID stays not found',async()=>{const {api}=harness();await assert.rejects(api.getContactContext({contact_id:id(9999)},owner),/not found/);});
