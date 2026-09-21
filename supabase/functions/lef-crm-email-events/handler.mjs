import { validId } from '../lef-crm-mcp/email.mjs';

// Standard Webhooks/Svix HMAC over the original request bytes; no JSON reserialization.
export async function verifySignature(raw, headers, secret, now = Date.now()) {
  const id = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signatures = headers.get('svix-signature');
  if (!id || !timestamp || !signatures || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  try {
    const key = await crypto.subtle.importKey('raw',Uint8Array.from(atob(secret.replace(/^whsec_/,'')),c=>c.charCodeAt(0)),{name:'HMAC',hash:'SHA-256'},false,['verify']);
    const bytes = new TextEncoder().encode(`${id}.${timestamp}.${raw}`);
    for (const signature of signatures.split(' ')) {
      const [version,value] = signature.split(',');
      if (version === 'v1' && value && await crypto.subtle.verify('HMAC',key,Uint8Array.from(atob(value),c=>c.charCodeAt(0)),bytes)) return true;
    }
  } catch { return false; }
  return false;
}

export function createEventHandler({db, now=()=>Date.now()}) {
  const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
  const page = body => new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>LEF — Emails</title><body>${body}</body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; form-action 'self'; frame-ancestors 'none'"}});
  async function suppress(row,reason) {
    await db('crm_email_suppressions?on_conflict=owner_user_id,email',{method:'POST',headers:{prefer:'resolution=ignore-duplicates'},body:JSON.stringify({owner_user_id:row.owner_user_id,email:row.recipient,reason})});
  }
  return async req => {
    try {
      const url = new URL(req.url);
      if (url.pathname.endsWith('/unsubscribe')) {
        if (!['GET','POST'].includes(req.method)) return json({error:'method_not_allowed'},405);
        let token;
        try { token=validId(url.searchParams.get('token')); } catch { return json({error:'invalid_link'},400); }
        const rows = await db(`crm_email_messages?unsubscribe_token=eq.${token}&is_test=eq.false&select=owner_user_id,recipient`);
        if (!rows[0]) return json({error:'invalid_link'},404);
        if (req.method === 'GET') return page('<h1>Emails da LEF</h1><p>Confirme para não receber mais emails de campanhas.</p><form method="post"><button type="submit">Cancelar inscrição</button></form>');
        await suppress(rows[0],'unsubscribe');
        return page('<h1>Inscrição cancelada</h1><p>Você não receberá novos emails de campanhas da LEF.</p>');
      }
      if (req.method !== 'POST') return json({error:'method_not_allowed'},405);
      const raw=await req.text();
      if (raw.length>100000) return json({error:'payload_too_large'},413);
      const configs=await db('crm_email_settings?webhook_secret=not.is.null&select=owner_user_id,webhook_secret');
      let owner;
      for (const config of configs) if (await verifySignature(raw,req.headers,config.webhook_secret,now())) { owner=config.owner_user_id;break; }
      if (!owner) return json({error:'invalid_signature'},401);
      const event=JSON.parse(raw);
      const columns={'email.sent':'accepted_at','email.delivered':'delivered_at','email.bounced':'bounced_at','email.complained':'complained_at','email.clicked':'clicked_at','email.failed':'failed_at','email.suppressed':'failed_at'};
      if (!columns[event.type]) return json({ignored:true});
      const providerId=event.data?.email_id;
      if (typeof providerId!=='string' || !providerId) return json({error:'invalid_event'},400);
      const rows=await db(`crm_email_messages?provider_id=eq.${encodeURIComponent(providerId)}&owner_user_id=eq.${owner}&select=*`);
      // Return a retryable status: the callback can beat the send-result write.
      if (!rows[0]) return json({error:'email_not_yet_recorded'},503);
      const row=rows[0];
      const at=new Date(event.created_at);
      if (!Number.isFinite(at.getTime())) return json({error:'invalid_timestamp'},400);
      const column=columns[event.type];
      if (event.type==='email.bounced' || event.type==='email.complained' || event.type==='email.suppressed') await suppress(row,event.type==='email.complained'?'complaint':'bounce');
      // Effects are idempotent; write the event last so a partial failure is retried.
      await db(`crm_email_messages?id=eq.${row.id}&owner_user_id=eq.${owner}&${column}=is.null`,{method:'PATCH',body:JSON.stringify({[column]:at.toISOString()})});
      await db('crm_email_events?on_conflict=event_id',{method:'POST',headers:{prefer:'resolution=ignore-duplicates'},body:JSON.stringify({event_id:req.headers.get('svix-id'),message_id:row.id,event_type:event.type,occurred_at:at.toISOString()})});
      return json({received:true});
    } catch { return json({error:'event_processing_failed'},500); }
  };
}
