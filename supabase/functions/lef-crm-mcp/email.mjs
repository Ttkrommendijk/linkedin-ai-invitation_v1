// CRM-owned email delivery. No browser or MCP result may contain provider secrets.
export const emailTools = [
  { name: 'get_crm_email_status', description: 'Read the authenticated owner\'s Resend email setup. Does not send or expose secrets.', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_campaign_email_contacts', description: 'Read one page of owned active CRM contacts in an existing campaign. Campaign membership does not establish permission to email or booth attendance. Follow next_after until null.', inputSchema: { type: 'object', required: ['campaign_id'], properties: { campaign_id: { type: 'string', format: 'uuid' }, after: { type: 'string', format: 'uuid' } } } },
  { name: 'prepare_crm_email', description: 'Save and preview one immutable email draft; never sends. Reuse message_key for the same intended message. Select an exact owned CRM contact and assert permission_to_email only with evidence of permission. Show the complete returned preview before requesting send approval. Test mode sends only to the configured owner address.', inputSchema: { type: 'object', required: ['message_key','subject','body_text'], properties: { message_key: { type: 'string', minLength: 1, maxLength: 150 }, subject: { type: 'string', minLength: 1, maxLength: 200 }, body_text: { type: 'string', minLength: 1, maxLength: 10000 }, contact_id: { type: 'string', format: 'uuid' }, campaign_id: { type: 'string', format: 'uuid' }, permission_to_email: { type: 'boolean' }, is_test: { type: 'boolean' } } } },
  { name: 'send_crm_email', description: 'Send exactly one previously previewed immutable CRM email through Resend. Requires explicit user approval immediately before sending of the exact recipient and message. Never infer approval from campaign setup. Repeated calls do not resend; uncertain outcomes require investigation.', inputSchema: { type: 'object', required: ['email_id','confirmed'], properties: { email_id: { type: 'string', format: 'uuid' }, confirmed: { type: 'boolean', const: true } } } },
  { name: 'get_crm_email', description: 'Read an owned email draft, sent content and delivery/click evidence. Accepted means submitted to Resend, not delivered. Clicked does not mean a diagnostic was completed.', inputSchema: { type: 'object', required: ['email_id'], properties: { email_id: { type: 'string', format: 'uuid' } } } },
];

export function validId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw Error('A valid UUID is required');
  return value;
}
export function address(value) {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value.trim())) throw Error('A single valid email address is required');
  return value.trim().toLowerCase();
}
function text(value, max, field) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw Error(`${field} is required (maximum ${max} characters)`);
  return value.trim();
}
const enc = encodeURIComponent;
const escapeHtml = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderEmail(row, publicUrl) {
  const unsubscribe = `${publicUrl}/unsubscribe?token=${row.unsubscribe_token}`;
  const footer = row.is_test ? '' : `\n\nPara não receber mais emails da LEF: ${unsubscribe}`;
  const plain = row.body_text + footer;
  // Only HTTPS URLs become links. Everything else remains escaped literal text.
  const html = '<div style="font-family:Arial,sans-serif;line-height:1.5">' + escapeHtml(plain).replace(/https:\/\/[^\s<>]+/g, url => `<a href="${url}">${url}</a>`).replace(/\n/g, '<br>') + '</div>';
  return { from: row.from_address, to: [row.recipient], reply_to: row.reply_to, subject: row.subject, text: plain, html,
    tags: [{ name: 'lef_email_id', value: row.id }],
    ...(row.is_test ? {} : { headers: { 'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }),
  };
}

export function createEmailService({ db, env, fetcher = fetch, now = () => new Date() }) {
  const apiKey = async () => env('RESEND_API_KEY') || await db('rpc/crm_resend_api_key', { method:'POST', body:'{}' });
  const publicUrl = `${env('SUPABASE_URL')}/functions/v1/lef-crm-email-events`;
  async function settings(userId) {
    const rows = await db(`crm_email_settings?owner_user_id=eq.${validId(userId)}&select=*`);
    if (!rows[0]) throw Error('Email is not configured for this CRM owner');
    return rows[0];
  }
  async function ownMessage(id, userId) {
    const rows = await db(`crm_email_messages?id=eq.${validId(id)}&owner_user_id=eq.${validId(userId)}&select=*`);
    if (!rows[0]) throw Error('Email not found for this owner');
    return rows[0];
  }
  async function contact(id, userId) {
    const rows = await db(`linkedin_invitations?id=eq.${validId(id)}&uuid=eq.${validId(userId)}&archived=eq.false&select=id,email,full_name`);
    if (!rows[0]) throw Error('Active contact not found for this owner');
    return rows[0];
  }
  async function campaignMembership(campaignId, contactId) {
    const campaigns = await db(`campaign?campaign_id=eq.${validId(campaignId)}&archived=eq.false&select=campaign_id`);
    const members = await db(`person_campaign?campaign_id=eq.${validId(campaignId)}&person_id=eq.${validId(contactId)}&select=person_id`);
    if (!campaigns.length || !members.length) throw Error('Contact is not in this active campaign');
  }
  async function suppressed(userId, email) {
    return (await db(`crm_email_suppressions?owner_user_id=eq.${validId(userId)}&email=eq.${enc(email)}&select=reason`))[0];
  }
  function preview(row) {
    const payload = renderEmail(row, publicUrl);
    const { unsubscribe_token, ...safe } = row;
    return { ...safe, body_as_sent: payload.text, html_as_sent: payload.html, requires_send_confirmation: row.state === 'draft' };
  }
  async function prepare(args, userId) {
    const config = await settings(userId);
    if (!config.enabled || !await apiKey()) throw Error('CRM email sending is not configured');
    const isTest = args.is_test === true;
    if (isTest && (args.contact_id || args.campaign_id)) throw Error('Test emails cannot be linked to customer records');
    if (!isTest && args.permission_to_email !== true) throw Error('Confirm permission to email this contact before preparing a customer email');
    const person = isTest ? null : await contact(args.contact_id, userId);
    const recipient = address(isTest ? config.test_address : person.email);
    if (await suppressed(userId, recipient)) throw Error('Recipient is suppressed from email');
    if (args.campaign_id) await campaignMembership(args.campaign_id, person.id);
    const input = { owner_user_id: userId, contact_id: person?.id || null, campaign_id: args.campaign_id || null, is_test: isTest,
      message_key: text(args.message_key,150,'message_key'), recipient,
      from_address: config.from_address, reply_to: address(config.reply_to), subject: text(args.subject,200,'subject'), body_text: text(args.body_text,10000,'body_text') };
    if (/[\r\n]/.test(input.subject)) throw Error('Subject must be one line');
    const rows = await db('crm_email_messages?on_conflict=owner_user_id,message_key,recipient', { method:'POST', headers:{ prefer:'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify(input) });
    const row = rows[0] || (await db(`crm_email_messages?owner_user_id=eq.${userId}&message_key=eq.${enc(input.message_key)}&recipient=eq.${enc(recipient)}&select=*`))[0];
    if (!row || Object.keys(input).some(key => row[key] !== input[key])) throw Error('This message key already exists with different content. Review the existing email; use a new key only for an intentionally new message');
    return preview(row);
  }
  async function send(args, userId) {
    if (args.confirmed !== true) throw Error('Immediate explicit approval of the email preview is required');
    const config = await settings(userId);
    const key = await apiKey();
    if (!config.enabled || !key) throw Error('CRM email sending is not configured');
    const row = await ownMessage(args.email_id,userId);
    if (row.state !== 'draft') return preview(row);
    if (row.from_address !== config.from_address || row.reply_to !== config.reply_to) throw Error('Sender settings changed. Prepare a new draft');
    if (row.is_test) {
      if (row.recipient !== address(config.test_address)) throw Error('Test address changed. Prepare a new draft');
    } else {
      if (!config.webhook_secret) throw Error('Delivery webhook must be configured before customer sending');
      const person = await contact(row.contact_id,userId);
      if (address(person.email) !== row.recipient) throw Error('Contact email changed. Prepare and approve a new draft');
      if (row.campaign_id) await campaignMembership(row.campaign_id,row.contact_id);
    }
    const patch = (data, filter='') => db(`crm_email_messages?id=eq.${row.id}&owner_user_id=eq.${userId}${filter}`, { method:'PATCH', headers:{prefer:'return=representation'},body:JSON.stringify(data) });
    if (await suppressed(userId,row.recipient)) {
      await patch({state:'suppressed'},'&state=eq.draft');
      throw Error('Recipient is suppressed from email');
    }
    const at = now().toISOString();
    const claimed = await patch({state:'sending',approved_at:at,attempted_at:at},'&state=eq.draft');
    if (!claimed.length) return preview(await ownMessage(row.id,userId));
    let response;
    try {
      response = await fetcher('https://api.resend.com/emails', { method:'POST', headers:{ authorization:`Bearer ${key}`, 'content-type':'application/json', 'Idempotency-Key':`crm-email/${row.id}` }, body:JSON.stringify(renderEmail(row,publicUrl)), signal:AbortSignal.timeout(15000) });
    } catch {
      await patch({state:'uncertain',last_error:'Provider response unavailable; investigate before any further send'},'&state=eq.sending');
      return preview(await ownMessage(row.id,userId));
    }
    if (!response.ok) {
      const uncertain = response.status >= 500 || response.status === 408 || response.status === 409;
      await patch({state:uncertain?'uncertain':'rejected',last_error:`Resend HTTP ${response.status}`},'&state=eq.sending');
      return preview(await ownMessage(row.id,userId));
    }
    let result;
    try { result = await response.json(); } catch { result = {}; }
    if (typeof result.id !== 'string' || !result.id) {
      await patch({state:'uncertain',last_error:'Provider response did not contain an email ID'},'&state=eq.sending');
      return preview(await ownMessage(row.id,userId));
    }
    // A database failure here leaves 'sending'; never resubmit automatically.
    await patch({state:'accepted',provider_id:result.id,accepted_at:now().toISOString(),last_error:null});
    return preview(await ownMessage(row.id,userId));
  }
  async function call(name,args,userId) {
    if (name === 'get_crm_email_status') {
      const c = await settings(userId);
      return { provider:'resend',enabled:c.enabled,api_key_configured:!!await apiKey(),from:c.from_address,reply_to:c.reply_to,test_address:c.test_address,webhook_configured:!!c.webhook_secret,webhook_url:publicUrl,customer_send_requires_confirmation:true };
    }
    if (name === 'prepare_crm_email') return prepare(args,userId);
    if (name === 'send_crm_email') return send(args,userId);
    if (name === 'get_crm_email') return preview(await ownMessage(args.email_id,userId));
    if (name === 'list_campaign_email_contacts') {
      await settings(userId);
      const campaign = validId(args.campaign_id);
      const rows = await db(`linkedin_invitations?select=id,full_name,email,person_campaign!inner(campaign_id)&uuid=eq.${validId(userId)}&archived=eq.false&person_campaign.campaign_id=eq.${campaign}&order=id.asc&limit=50${args.after?'&id=gt.'+validId(args.after):''}`);
      const contacts = [];
      for (const row of rows) {
        let email = null;
        try { email = address(row.email); } catch { /* Missing/invalid addresses remain explicit. */ }
        contacts.push({id:row.id,full_name:row.full_name,email,exclusion_reason:email ? (await suppressed(userId,email))?.reason || null : 'missing_or_invalid_email',permission_to_email:'not_established_by_campaign_membership'});
      }
      return {campaign_id:campaign,contacts,next_after:rows.length?rows.at(-1).id:null};
    }
    throw Error('Unknown email operation');
  }
  return { call, prepare, send };
}
