// Temporary deployment template, removed/disabled immediately after setup.
// Deployment injects an ephemeral SHA-256 token hash and absolute expiry.
// The token itself and the Resend key are never stored in this source file.
import { createEmailService } from '../supabase/functions/lef-crm-mcp/email.mjs';
const tokenHash = '__SETUP_TOKEN_SHA256__';
const expiresAt = '__SETUP_EXPIRES_AT__';
const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ownerEmail = 'tiago@lef.tec.br';
async function db(path: string, init: RequestInit = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`,{...init,headers:{apikey:serviceKey,authorization:`Bearer ${serviceKey}`,'content-type':'application/json',...init.headers},signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw Error(`Database HTTP ${response.status}`);
  const raw=await response.text();return raw?JSON.parse(raw):null;
}
Deno.serve(async req=>{
  const reply=(data: unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
  if(req.method!=='POST' || !Number.isFinite(Date.parse(expiresAt)) || Date.now()>Date.parse(expiresAt))return reply({error:'disabled'},403);
  const bearer=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(bearer))),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==tokenHash)return reply({error:'unauthorized'},401);
  try{
    const config=(await db(`crm_email_settings?test_address=eq.${encodeURIComponent(ownerEmail)}&reply_to=eq.${encodeURIComponent(ownerEmail)}&select=*`))[0];
    if(!config)return reply({error:'owner_configuration_missing'},409);
    const service=createEmailService({db,env:(name: string)=>Deno.env.get(name)});
    const {action}=await req.json();
    if(action==='status')return reply(await service.call('get_crm_email_status',{},config.owner_user_id));
    if(action==='configure_webhook'){
      const key=Deno.env.get('RESEND_API_KEY') || await db('rpc/crm_resend_api_key',{method:'POST',body:'{}'});
      if(!key)return reply({error:'RESEND_API_KEY_missing_from_Edge_Function_secrets'},409);
      const endpoint=`${url}/functions/v1/lef-crm-email-events`;
      const headers={authorization:`Bearer ${key}`,'content-type':'application/json'};
      const listing=await fetch('https://api.resend.com/webhooks',{headers,signal:AbortSignal.timeout(15000)});
      if(!listing.ok){
        const failure=await listing.json().catch(()=>({}));
        return reply({error:'webhook_list_failed',provider_http_status:listing.status,provider_error:typeof failure.name==='string'?failure.name.replace(/[^a-z_]/g,'').slice(0,80):'unknown'},409);
      }
      const list=await listing.json();
      const existing=list.data?.find((item: {endpoint: string})=>item.endpoint===endpoint);
      const response=await fetch(existing?`https://api.resend.com/webhooks/${existing.id}`:'https://api.resend.com/webhooks',{
        method:existing?'GET':'POST',headers,signal:AbortSignal.timeout(15000),
        ...(existing?{}:{body:JSON.stringify({endpoint,events:['email.sent','email.delivered','email.bounced','email.complained','email.clicked','email.failed','email.suppressed']})}),
      });
      if(!response.ok)return reply({error:'webhook_configuration_failed',provider_http_status:response.status},409);
      const hook=await response.json();
      if(!hook.id || !hook.signing_secret)return reply({error:'webhook_secret_missing'},409);
      await db(`crm_email_settings?owner_user_id=eq.${config.owner_user_id}`,{method:'PATCH',body:JSON.stringify({webhook_id:hook.id,webhook_secret:hook.signing_secret})});
      return reply({webhook_configured:true,webhook_id:hook.id,endpoint});
    }
    if(action==='verify_delivery_test'){
      if(!config.webhook_secret)return reply({error:'webhook_secret_missing'},409);
      const draft=await service.prepare({is_test:true,message_key:'resend-webhook-test-2026-09-21',subject:'LEF CRM — teste de confirmação de entrega',body_text:'Olá, Tiago!\n\nEste teste verifica se a confirmação de entrega do Resend chega ao CRM LEF.\n\nAs respostas continuam chegando a tiago@lef.tec.br. Nenhum email da campanha HDI foi enviado.\n\nTiago — LEF'},config.owner_user_id);
      return reply(await service.send({email_id:draft.id,confirmed:true},config.owner_user_id));
    }
    if(action==='send_test'){
      const draft=await service.prepare({is_test:true,message_key:'resend-setup-2026-09-21',subject:'LEF CRM — teste de envio',body_text:'Olá, Tiago!\n\nEste é o teste de envio de emails do CRM LEF pelo Resend.\n\nRemetente: Tiago — LEF <tiago@mail.lef.tec.br>\nRespostas: tiago@lef.tec.br\n\nNenhum email da campanha HDI foi enviado.\n\nTiago — LEF'},config.owner_user_id);
      return reply(await service.send({email_id:draft.id,confirmed:true},config.owner_user_id));
    }
    return reply({error:'unknown_action'},400);
  }catch{return reply({error:'setup_failed'},500);}
});
