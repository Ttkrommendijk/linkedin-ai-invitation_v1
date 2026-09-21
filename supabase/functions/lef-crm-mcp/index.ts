import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { emailTools, createEmailService } from './email.mjs';

const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MCP_URL = `${PROJECT_URL}/functions/v1/lef-crm-mcp`;
const AUTH_SERVER = `${PROJECT_URL}/auth/v1`;

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json", ...extra } });
}

function rpcResult(id: unknown, value: unknown) { return json({ jsonrpc: "2.0", id, result: value }); }
function rpcError(id: unknown, code: number, message: string) { return json({ jsonrpc: "2.0", id, error: { code, message } }); }
function toolText(data: unknown, isError = false) { return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], isError }; }
function oauthChallenge() {
  return json({ error: "authentication_required" }, 401, {
    "www-authenticate": `Bearer resource_metadata="${MCP_URL}/.well-known/oauth-protected-resource"`,
  });
}

async function db(path: string, init: RequestInit = {}) {
  const response = await fetch(`${PROJECT_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`database request failed (${response.status}): ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : null;
}

async function authenticate(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7);
  const response = await fetch(`${PROJECT_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  const user = await response.json();
  return { id: user.id as string, email: user.email as string };
}

function uuid(value: unknown, field: string) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error(`${field} must be a UUID`);
  return value;
}

function boundedText(value: unknown, field: string, max: number, required = false) {
  if (value == null && !required) return null;
  if (typeof value !== "string" || (required && !value.trim())) throw new Error(`${field} is invalid`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${field} is too long`);
  return text || null;
}

function timestamp(value: unknown, field: string, required = false) {
  if (value == null && !required) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${field} must be an ISO timestamp`);
  return new Date(value).toISOString();
}

function priority(value: unknown, required = false) {
  if (value == null && !required) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 5) throw new Error("inferred_priority must be an integer from 1 to 5");
  return number;
}

function confidence(value: unknown) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new Error("inference_confidence must be between 0 and 1");
  return number;
}

async function event(userId: string, reminderId: string, eventType: string, data: Record<string, unknown> = {}) {
  await db("crm_reminder_events", { method: "POST", body: JSON.stringify({ reminder_id: reminderId, owner_user_id: userId, event_type: eventType, event_data: data }) });
}

async function ownReminder(userId: string, reminderId: unknown) {
  const id = uuid(reminderId, "reminder_id");
  const rows = await db(`crm_reminders?id=eq.${id}&owner_user_id=eq.${userId}&select=*`);
  if (!rows.length) throw new Error("reminder was not found");
  return rows[0];
}

async function validateCrmLinks(userId: string, args: any) {
  const contactId = args?.contact_id ? uuid(args.contact_id, "contact_id") : null;
  const companyId = args?.company_id ? uuid(args.company_id, "company_id") : null;
  const dealId = args?.deal_id ? uuid(args.deal_id, "deal_id") : null;
  const sourceNoteId = args?.source_note_id == null ? null : Number(args.source_note_id);
  if (sourceNoteId !== null && (!Number.isInteger(sourceNoteId) || sourceNoteId < 1)) throw new Error("source_note_id must be a positive integer");

  if (contactId) {
    const rows = await db(`linkedin_invitations?id=eq.${contactId}&uuid=eq.${userId}&select=id`);
    if (!rows.length) throw new Error("contact_id is not available to this user");
  }
  if (companyId) {
    const companies = await db(`company?company_id=eq.${companyId}&owner_user_id=eq.${userId}&select=company_id&limit=1`);
    const contacts = companies.length ? [] : await db(`linkedin_invitations?company_id=eq.${companyId}&uuid=eq.${userId}&select=id&limit=1`);
    if (!companies.length && !contacts.length) throw new Error("company_id is not owned by or linked to this user");
  }
  if (dealId) {
    const deals = await db(`deal?deal_id=eq.${dealId}&select=deal_id,main_contact_id`);
    if (!deals.length) throw new Error("deal_id was not found");
    const main = deals[0].main_contact_id
      ? await db(`linkedin_invitations?id=eq.${deals[0].main_contact_id}&uuid=eq.${userId}&select=id`)
      : [];
    const linked = await db(`deal_person?deal_id=eq.${dealId}&select=person_id`);
    const linkedIds = linked.map((row: any) => row.person_id);
    const ownedLinked = linkedIds.length
      ? await db(`linkedin_invitations?id=in.(${linkedIds.join(",")})&uuid=eq.${userId}&select=id&limit=1`)
      : [];
    if (!main.length && !ownedLinked.length) throw new Error("deal_id is not linked to one of this user's contacts");
  }
  if (sourceNoteId !== null) {
    const notes = await db(`note?note_id=eq.${sourceNoteId}&select=note_id,creator,main_person_id`);
    if (!notes.length) throw new Error("source_note_id was not found");
    let allowed = notes[0].creator === userId;
    if (!allowed && notes[0].main_person_id) {
      const owned = await db(`linkedin_invitations?id=eq.${notes[0].main_person_id}&uuid=eq.${userId}&select=id`);
      allowed = owned.length > 0;
    }
    if (!allowed) throw new Error("source_note_id is not available to this user");
  }
  return { contactId, companyId, dealId, sourceNoteId };
}

function defaultNextReview(inferredPriority: number | null, dueAt: string | null, override: string | null) {
  const now = Date.now();
  const effective = override === "urgent" ? 5 : override === "high" ? 4 : override === "normal" ? 3 : override === "low" ? 1 : inferredPriority;
  const days = effective === 5 ? 0 : effective === 4 ? 1 : effective === 3 ? 3 : effective === 2 ? 14 : 30;
  const proposed = now + days * 86_400_000;
  return new Date(dueAt ? Math.min(proposed, Date.parse(dueAt)) : proposed).toISOString();
}

async function createReminder(args: any, userId: string) {
  const title = boundedText(args?.title, "title", 300, true)!;
  const details = boundedText(args?.details, "details", 5000);
  const dueAt = timestamp(args?.due_at, "due_at");
  const inferredPriority = priority(args?.inferred_priority);
  const override = args?.priority_override || null;
  if (override && !["low", "normal", "high", "urgent"].includes(override)) throw new Error("priority_override is unsupported");
  const inferredReason = boundedText(args?.inferred_reason, "inferred_reason", 1000);
  if (inferredPriority && !inferredReason) throw new Error("inferred_reason is required with inferred_priority");
  const nextReviewAt = timestamp(args?.next_review_at, "next_review_at") || defaultNextReview(inferredPriority, dueAt, override);
  const sourceType = args?.source_type || "manual";
  if (!["manual","note","gmail","calendar","linkedin","whatsapp","meeting","other"].includes(sourceType)) throw new Error("source_type is unsupported");
  const links = await validateCrmLinks(userId, args);
  const payload = {
    owner_user_id: userId,
    title,
    details,
    due_at: dueAt,
    next_review_at: nextReviewAt,
    priority_override: override,
    inferred_priority: inferredPriority,
    inferred_reason: inferredReason,
    inference_confidence: confidence(args?.inference_confidence),
    assessed_at: inferredPriority ? new Date().toISOString() : null,
    contact_id: links.contactId,
    company_id: links.companyId,
    deal_id: links.dealId,
    source_note_id: links.sourceNoteId,
    source_type: sourceType,
    source_external_id: boundedText(args?.source_external_id, "source_external_id", 500),
    source_url: boundedText(args?.source_url, "source_url", 2000),
    context: args?.context && typeof args.context === "object" && !Array.isArray(args.context) ? args.context : {},
  };
  if (payload.source_external_id) {
    const existing = await db(`crm_reminders?owner_user_id=eq.${userId}&source_type=eq.${sourceType}&source_external_id=eq.${encodeURIComponent(payload.source_external_id)}&select=*`);
    if (existing.length) return { reminder: existing[0], reused: true };
  }
  const rows = await db("crm_reminders", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  const reminder = rows[0];
  if (!reminder) throw new Error("could not create or reuse reminder");
  await event(userId, reminder.id, "created", { inferred_priority: inferredPriority, next_review_at: nextReviewAt });
  return { reminder, reused: false };
}

async function enrich(reminders: any[], userId: string) {
  const contactIds = [...new Set(reminders.map((r) => r.contact_id).filter(Boolean))];
  const companyIds = [...new Set(reminders.map((r) => r.company_id).filter(Boolean))];
  const dealIds = [...new Set(reminders.map((r) => r.deal_id).filter(Boolean))];
  const contacts = contactIds.length ? await db(`linkedin_invitations?id=in.(${contactIds.join(",")})&uuid=eq.${userId}&select=id,full_name,company,email,phone,linkedin_url`) : [];
  const companies = companyIds.length ? await db(`company?company_id=in.(${companyIds.join(",")})&select=company_id,company_name,sector,city`) : [];
  const deals = dealIds.length ? await db(`deal?deal_id=in.(${dealIds.join(",")})&select=deal_id,deal_name,deal_description,deal_value,deal_phase`) : [];
  const cm = new Map(contacts.map((x: any) => [x.id, x]));
  const com = new Map(companies.map((x: any) => [x.company_id, x]));
  const dm = new Map(deals.map((x: any) => [x.deal_id, x]));
  return reminders.map((r) => ({ ...r, contact: cm.get(r.contact_id) || null, company: com.get(r.company_id) || null, deal: dm.get(r.deal_id) || null }));
}

async function listReminders(args: any, userId: string, dueReviewOnly = false) {
  const statuses = args?.status ? [args.status] : ["open", "snoozed"];
  if (statuses.some((s) => !["open","snoozed","completed","cancelled"].includes(s))) throw new Error("status is unsupported");
  const limit = Math.min(Math.max(Number(args?.limit || 100), 1), 200);
  let filter = `owner_user_id=eq.${userId}&status=in.(${statuses.join(",")})`;
  if (dueReviewOnly) filter += `&next_review_at=lte.${encodeURIComponent(new Date().toISOString())}`;
  if (args?.due_before) filter += `&due_at=lte.${encodeURIComponent(timestamp(args.due_before, "due_before", true)!)}`;
  const rows = await db(`crm_reminders?${filter}&select=*&order=next_review_at.asc,due_at.asc.nullslast&limit=${limit}`);
  const reminders = await enrich(rows, userId);
  return { reminders, count: reminders.length, generated_at: new Date().toISOString() };
}

async function assessReminder(args: any, userId: string) {
  const reminder = await ownReminder(userId, args?.reminder_id);
  if (!["open", "snoozed"].includes(reminder.status)) throw new Error("only open or snoozed reminders can be assessed");
  const inferredPriority = priority(args?.inferred_priority, true)!;
  const reason = boundedText(args?.inferred_reason, "inferred_reason", 1000, true)!;
  const nextReviewAt = timestamp(args?.next_review_at, "next_review_at", true)!;
  const rows = await db(`crm_reminders?id=eq.${reminder.id}&owner_user_id=eq.${userId}`, {
    method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify({
      inferred_priority: inferredPriority,
      inferred_reason: reason,
      inference_confidence: confidence(args?.inference_confidence),
      assessed_at: new Date().toISOString(),
      next_review_at: nextReviewAt,
    }),
  });
  await event(userId, reminder.id, "assessed", { inferred_priority: inferredPriority, inferred_reason: reason, next_review_at: nextReviewAt });
  return rows[0];
}

async function recordReview(args: any, userId: string) {
  const reminder = await ownReminder(userId, args?.reminder_id);
  if (!["open", "snoozed"].includes(reminder.status)) throw new Error("reminder is not active");
  const outcome = args?.outcome;
  if (!['surfaced','deferred'].includes(outcome)) throw new Error("outcome must be surfaced or deferred");
  const nextReviewAt = timestamp(args?.next_review_at, "next_review_at", true)!;
  const patch: any = { next_review_at: nextReviewAt };
  if (reminder.status === "snoozed" && Date.parse(reminder.snoozed_until || reminder.next_review_at) <= Date.now()) { patch.status = "open"; patch.snoozed_until = null; }
  if (outcome === "surfaced") { patch.last_surfaced_at = new Date().toISOString(); patch.surface_count = Number(reminder.surface_count || 0) + 1; }
  const rows = await db(`crm_reminders?id=eq.${reminder.id}&owner_user_id=eq.${userId}`, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify(patch) });
  await event(userId, reminder.id, outcome, { next_review_at: nextReviewAt, reason: boundedText(args?.reason, "reason", 1000) });
  return rows[0];
}

async function snoozeReminder(args: any, userId: string) {
  const reminder = await ownReminder(userId, args?.reminder_id);
  const until = timestamp(args?.until, "until", true)!;
  if (Date.parse(until) <= Date.now()) throw new Error("until must be in the future");
  const rows = await db(`crm_reminders?id=eq.${reminder.id}&owner_user_id=eq.${userId}`, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify({ status: "snoozed", snoozed_until: until, next_review_at: until }) });
  await event(userId, reminder.id, "snoozed", { until, reason: boundedText(args?.reason, "reason", 1000) });
  return rows[0];
}

async function decideReminder(args: any, userId: string, action: "complete" | "cancel" | "reopen") {
  if (args?.confirmed !== true) throw new Error("confirmed must be true after explicit user confirmation");
  const reminder = await ownReminder(userId, args?.reminder_id);
  const now = new Date().toISOString();
  const patch = action === "complete"
    ? { status: "completed", completed_at: now, snoozed_until: null }
    : action === "cancel"
      ? { status: "cancelled", completed_at: null, snoozed_until: null }
      : { status: "open", completed_at: null, snoozed_until: null, next_review_at: now };
  const rows = await db(`crm_reminders?id=eq.${reminder.id}&owner_user_id=eq.${userId}`, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify(patch) });
  await event(userId, reminder.id, action === "complete" ? "completed" : action === "cancel" ? "cancelled" : "reopened", { reason: boundedText(args?.reason, "reason", 1000) });
  return rows[0];
}


function normalized(value: unknown) {
  return String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function integerLimit(value: unknown, fallback = 20, max = 100) {
  const number = value == null ? fallback : Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) throw new Error(`limit must be an integer from 1 to ${max}`);
  return number;
}

const CONTACT_FIELDS = "id,full_name,company,headline,email,phone,linkedin_url,company_id,created_at,updated_at,invited_at,accepted_at,first_message_sent_at,message_count";

async function ownedContacts(userId: string) {
  const contacts: any[] = [];
  let after = "";
  // A server cap may be smaller than our requested page. Only an empty page
  // proves completion; never turn a partial read into a no-match result.
  for (let page = 0; page < 1000; page++) {
    const rows = await db(`linkedin_invitations?uuid=eq.${userId}&archived=eq.false&select=${CONTACT_FIELDS}&order=id.asc&limit=500${after ? "&id=gt." + after : ""}`);
    if (!Array.isArray(rows)) throw new Error("contact lookup returned an invalid page");
    if (!rows.length) return contacts;
    for (const row of rows) {
      const next = uuid(row.id, "contact id").toLowerCase();
      if (after && next <= after) throw new Error("contact lookup pagination did not advance");
      after = next;
      contacts.push(row);
    }
  }
  throw new Error("contact lookup incomplete; narrow the request or retry");
}

async function searchContacts(args: any, userId: string) {
  const query = boundedText(args?.query, "query", 300);
  const company = boundedText(args?.company, "company", 300);
  const role = boundedText(args?.role, "role", 300);
  if (!query && !company && !role) throw new Error("provide query, company, or role");
  const limit = integerLimit(args?.limit, 20, 100);
  const contacts = await ownedContacts(userId);
  const q = normalized(query);
  const c = normalized(company);
  const r = normalized(role);
  const matches = contacts.filter((contact: any) => {
    const personText = normalized([contact.full_name, contact.company, contact.headline, contact.email].filter(Boolean).join(" "));
    return (!q || personText.includes(q)) &&
      (!c || normalized(contact.company).includes(c)) &&
      (!r || normalized(contact.headline).includes(r));
  }).slice(0, limit);
  return { contacts: matches, count: matches.length, generated_at: new Date().toISOString() };
}

async function listRecentInteractions(args: any, userId: string) {
  const limit = integerLimit(args?.limit, 20, 100);
  const since = timestamp(args?.since, "since");
  const contactId = args?.contact_id ? uuid(args.contact_id, "contact_id") : null;
  const companyId = args?.company_id ? uuid(args.company_id, "company_id") : null;
  if (contactId) {
    const owned = await db(`linkedin_invitations?id=eq.${contactId}&uuid=eq.${userId}&select=id`);
    if (!owned.length) throw new Error("contact_id is not available to this user");
  }
  if (companyId) {
    const companies = await db(`company?company_id=eq.${companyId}&owner_user_id=eq.${userId}&select=company_id&limit=1`);
    const contacts = companies.length ? [] : await db(`linkedin_invitations?company_id=eq.${companyId}&uuid=eq.${userId}&select=id&limit=1`);
    if (!companies.length && !contacts.length) throw new Error("company_id is not owned by or linked to this user");
  }
  let filter = `creator=eq.${userId}&archived=eq.false`;
  if (since) filter += `&date=gte.${encodeURIComponent(since)}`;
  if (contactId) filter += `&main_person_id=eq.${contactId}`;
  if (companyId) filter += `&company_id=eq.${companyId}`;
  const notes = await db(`note?${filter}&select=note_id,created_at,date,note_title,note_description,notes_type,status,duration,main_person_id,company_id,deal_id&order=date.desc,created_at.desc&limit=${limit}`);
  const contactIds = [...new Set(notes.map((n: any) => n.main_person_id).filter(Boolean))];
  const companyIds = [...new Set(notes.map((n: any) => n.company_id).filter(Boolean))];
  const dealIds = [...new Set(notes.map((n: any) => n.deal_id).filter(Boolean))];
  const contacts = contactIds.length ? await db(`linkedin_invitations?id=in.(${contactIds.join(",")})&uuid=eq.${userId}&select=id,full_name,company,headline,email,phone,linkedin_url`) : [];
  const companies = companyIds.length ? await db(`company?company_id=in.(${companyIds.join(",")})&select=company_id,company_name,sector,city`) : [];
  const deals = dealIds.length ? await db(`deal?deal_id=in.(${dealIds.join(",")})&select=deal_id,deal_name,deal_description,deal_value,deal_phase`) : [];
  const cm = new Map(contacts.map((x: any) => [x.id, x]));
  const com = new Map(companies.map((x: any) => [x.company_id, x]));
  const dm = new Map(deals.map((x: any) => [x.deal_id, x]));
  const interactions = notes.map((note: any) => ({ ...note, person: cm.get(note.main_person_id) || null, company: com.get(note.company_id) || null, deal: dm.get(note.deal_id) || null }));
  return { interactions, count: interactions.length, generated_at: new Date().toISOString() };
}

async function getContactContext(args: any, userId: string) {
  const contactId = args?.contact_id ? uuid(args.contact_id, "contact_id") : null;
  const query = boundedText(args?.query, "query", 300);
  if (!contactId && !query) throw new Error("provide contact_id or query");
  const contacts = contactId
    ? await db(`linkedin_invitations?uuid=eq.${userId}&archived=eq.false&id=eq.${contactId}&select=${CONTACT_FIELDS}&limit=1`)
    : await ownedContacts(userId);
  const matches = contactId
    ? contacts.filter((c: any) => c.id === contactId)
    : contacts.filter((c: any) => normalized([c.full_name, c.company, c.headline, c.email].join(" ")).includes(normalized(query)));
  if (!matches.length) throw new Error("contact was not found");
  if (matches.length > 1) return { ambiguous: true, matches: matches.slice(0, 20), required_action: "Choose one contact and call again with contact_id." };
  const contact = matches[0];
  const interactions = await listRecentInteractions({ contact_id: contact.id, limit: integerLimit(args?.interaction_limit, 10, 50) }, userId);
  const reminders = await db(`crm_reminders?owner_user_id=eq.${userId}&contact_id=eq.${contact.id}&select=*&order=next_review_at.asc&limit=50`);
  let company = null;
  if (contact.company_id) {
    const rows = await db(`company?company_id=eq.${contact.company_id}&select=company_id,company_name,sector,city,employee_number,it_members,company_size`);
    company = rows[0] || null;
  }
  return { contact, company, interactions: interactions.interactions, reminders };
}

async function getCompanyContext(args: any, userId: string) {
  const companyId = args?.company_id ? uuid(args.company_id, "company_id") : null;
  const query = boundedText(args?.query, "query", 300);
  if (!companyId && !query) throw new Error("provide company_id or query");
  const contacts = await ownedContacts(userId);
  const linkedCompanyIds = [...new Set(contacts.map((c: any) => c.company_id).filter(Boolean))];
  const linkedCompanies = linkedCompanyIds.length ? await db(`company?company_id=in.(${linkedCompanyIds.join(",")})&select=company_id,company_name,sector,city,employee_number,it_members,company_size,owner_user_id`) : [];
  const ownedCompanies = await db(`company?owner_user_id=eq.${userId}&archived=eq.false&select=company_id,company_name,sector,city,employee_number,it_members,company_size,owner_user_id&limit=1000`);
  const companies = [...new Map([...linkedCompanies, ...ownedCompanies].map((company: any) => [company.company_id, company])).values()];
  const matches = companyId
    ? companies.filter((c: any) => c.company_id === companyId)
    : companies.filter((c: any) => normalized([c.company_name, c.sector, c.city].join(" ")).includes(normalized(query)));
  if (!matches.length) throw new Error("company was not found among this user's owned or linked companies");
  if (matches.length > 1) return { ambiguous: true, matches: matches.slice(0, 20), required_action: "Choose one company and call again with company_id." };
  const company = matches[0];
  const people = contacts.filter((c: any) => c.company_id === company.company_id);
  const interactions = await listRecentInteractions({ company_id: company.company_id, limit: integerLimit(args?.interaction_limit, 20, 50) }, userId);
  const reminders = await db(`crm_reminders?owner_user_id=eq.${userId}&company_id=eq.${company.company_id}&select=*&order=next_review_at.asc&limit=50`);
  const deals = await db(`deal?company_id=eq.${company.company_id}&select=deal_id,deal_name,deal_description,deal_value,deal_phase,main_contact_id&limit=100`);
  return { company, people, interactions: interactions.interactions, reminders, deals };
}



function requireConfirmation(args: any) {
  if (args?.confirmed !== true) throw new Error("confirmed must be true after the user explicitly approved the exact change");
}

function hasOwn(obj: any, key: string) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}


async function createCompany(args: any, userId: string) {
  requireConfirmation(args);
  const name = boundedText(args?.name, "name", 500, true)!;
  const linkedinId = boundedText(args?.linkedin_id, "linkedin_id", 500);
  const all = await db("company?archived=eq.false&select=company_id,company_name,linkedin_id,sector,city,employee_number,it_members,company_size,owner_user_id&limit=5000");
  const duplicate = all.find((company: any) =>
    normalized(company.company_name) === normalized(name) ||
    (linkedinId && company.linkedin_id === linkedinId)
  );
  if (duplicate) return { company: duplicate, created: false, reused: true, reason: "An existing company matched the supplied name or LinkedIn identifier." };

  const companySize = args?.company_size || null;
  const sizes = ["1 - 100","101 - 250","251 - 500","500 - 1000","1001 - 2500","2501 - 5000","5001 - 10000","10001 - 20000","+ 20000"];
  if (companySize && !sizes.includes(companySize)) throw new Error("company_size is unsupported");
  const payload = {
    company_name: name,
    linkedin_id: linkedinId,
    employee_number: boundedText(args?.employee_number, "employee_number", 100),
    it_members: boundedText(args?.it_members, "it_members", 100),
    sector: boundedText(args?.sector, "sector", 500),
    city: boundedText(args?.city, "city", 500),
    company_size: companySize,
    archived: false,
    owner_user_id: userId,
  };
  const rows = await db("company", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify(payload) });
  if (!rows[0]) throw new Error("company was not created");
  return { company: rows[0], created: true, reused: false };
}

async function createContact(args: any, userId: string) {
  requireConfirmation(args);
  const fullName = boundedText(args?.full_name, "full_name", 500, true)!;
  const email = boundedText(args?.email, "email", 500);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("email is invalid");
  const linkedinUrl = boundedText(args?.linkedin_url, "linkedin_url", 2000);
  if (linkedinUrl) {
    let parsed: URL;
    try { parsed = new URL(linkedinUrl); } catch { throw new Error("linkedin_url must be a valid URL"); }
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("linkedin_url must use http or https");
  }

  let companyId: string | null = null;
  let companyName = boundedText(args?.company_name, "company_name", 500);
  if (args?.company_id) {
    companyId = uuid(args.company_id, "company_id");
    const companies = await db(`company?company_id=eq.${companyId}&archived=eq.false&select=company_id,company_name`);
    if (!companies.length) throw new Error("company_id was not found");
    if (companyName && normalized(companyName) !== normalized(companies[0].company_name)) throw new Error("company_name does not match company_id");
    companyName = companies[0].company_name;
  }

  const contacts = await ownedContacts(userId);
  const duplicates = contacts.filter((contact: any) =>
    (linkedinUrl && normalized(contact.linkedin_url) === normalized(linkedinUrl)) ||
    (email && String(contact.email || "").toLowerCase() === email.toLowerCase()) ||
    (normalized(contact.full_name) === normalized(fullName) &&
      normalized(contact.company || "") === normalized(companyName || ""))
  ).slice(0, 10);
  if (duplicates.length) return { created: false, reused: true, duplicate_candidates: duplicates, reason: "An existing contact matched the supplied LinkedIn URL, email, or name and company." };

  const payload = {
    uuid: userId,
    full_name: fullName,
    company: companyName,
    company_id: companyId,
    headline: boundedText(args?.role, "role", 1000),
    email,
    phone: boundedText(args?.phone, "phone", 100),
    comments: boundedText(args?.comments, "comments", 10000),
    linkedin_url: linkedinUrl,
    archived: false,
    language: args?.language || "portuguese",
    accepted: false,
    status: "generated",
  };
  if (!["portuguese","english","dutch","spanish"].includes(payload.language)) throw new Error("language is unsupported");
  const rows = await db("linkedin_invitations", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify(payload) });
  if (!rows[0]) throw new Error("contact was not created");
  return { contact: rows[0], created: true, reused: false };
}

async function createInteraction(args: any, userId: string) {
  requireConfirmation(args);
  const title = boundedText(args?.title, "title", 500);
  const description = boundedText(args?.description, "description", 10000);
  if (!title && !description) throw new Error("title or description is required");
  const noteType = args?.interaction_type || "note";
  if (!["note","email","whatsapp","linkedin","telefone","meeting"].includes(noteType)) throw new Error("interaction_type is unsupported");
  const links = await validateCrmLinks(userId, {
    contact_id: args?.contact_id,
    company_id: args?.company_id,
    deal_id: args?.deal_id,
  });
  if (!links.contactId && !links.companyId && !links.dealId) throw new Error("link the interaction to a contact, company, or deal");
  if (links.contactId && links.companyId) {
    const linked = await db(`linkedin_invitations?id=eq.${links.contactId}&uuid=eq.${userId}&company_id=eq.${links.companyId}&select=id`);
    if (!linked.length) throw new Error("contact_id is not linked to company_id");
  }
  const duration = args?.duration_minutes == null ? null : Number(args.duration_minutes);
  if (duration !== null && (!Number.isInteger(duration) || duration < 0 || duration > 1440)) throw new Error("duration_minutes must be an integer from 0 to 1440");
  const payload = {
    creator: userId,
    note_title: title,
    note_description: description,
    main_person_id: links.contactId,
    company_id: links.companyId,
    deal_id: links.dealId,
    notes_type: noteType,
    date: timestamp(args?.occurred_at, "occurred_at") || new Date().toISOString(),
    duration,
    status: "ready",
    archived: false,
  };
  const rows = await db("note", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify(payload) });
  if (!rows[0]) throw new Error("interaction was not created");
  return { interaction: rows[0], created: true };
}

async function ownInteraction(userId: string, value: unknown) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new Error("interaction_id must be a positive integer");
  const rows = await db(`note?note_id=eq.${id}&creator=eq.${userId}&select=*`);
  if (!rows.length) throw new Error("interaction was not found or is not owned by this user");
  return rows[0];
}

async function updateInteraction(args: any, userId: string) {
  requireConfirmation(args);
  const interaction = await ownInteraction(userId, args?.interaction_id);
  const patch: any = {};
  if (hasOwn(args, "title")) patch.note_title = boundedText(args.title, "title", 500);
  if (hasOwn(args, "description")) patch.note_description = boundedText(args.description, "description", 10000);
  if (hasOwn(args, "occurred_at")) patch.date = timestamp(args.occurred_at, "occurred_at", true);
  if (hasOwn(args, "interaction_type")) {
    if (!["note","email","whatsapp","linkedin","telefone","meeting"].includes(args.interaction_type)) throw new Error("interaction_type is unsupported");
    patch.notes_type = args.interaction_type;
  }
  if (hasOwn(args, "duration_minutes")) {
    const duration = args.duration_minutes == null ? null : Number(args.duration_minutes);
    if (duration !== null && (!Number.isInteger(duration) || duration < 0 || duration > 1440)) throw new Error("duration_minutes must be an integer from 0 to 1440");
    patch.duration = duration;
  }
  if (args?.contact_id) {
    const links = await validateCrmLinks(userId, { contact_id: args.contact_id });
    patch.main_person_id = links.contactId;
  }
  if (args?.company_id) {
    const links = await validateCrmLinks(userId, { company_id: args.company_id });
    patch.company_id = links.companyId;
  }
  if (args?.deal_id) {
    const links = await validateCrmLinks(userId, { deal_id: args.deal_id });
    patch.deal_id = links.dealId;
  }
  if (!Object.keys(patch).length) throw new Error("no supported fields were provided");
  const rows = await db(`note?note_id=eq.${interaction.note_id}&creator=eq.${userId}`, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify(patch) });
  if (!rows[0]) throw new Error("interaction was not updated");
  return { interaction: rows[0], updated_fields: Object.keys(patch) };
}

async function updateContact(args: any, userId: string) {
  requireConfirmation(args);
  const contactId = uuid(args?.contact_id, "contact_id");
  const owned = await db(`linkedin_invitations?id=eq.${contactId}&uuid=eq.${userId}&select=id`);
  if (!owned.length) throw new Error("contact was not found or is not owned by this user");
  const patch: any = {};
  const fields: Record<string, [string, number]> = {
    full_name: ["full_name", 500],
    company_name: ["company", 500],
    role: ["headline", 1000],
    email: ["email", 500],
    phone: ["phone", 100],
    comments: ["comments", 10000],
    linkedin_url: ["linkedin_url", 2000],
  };
  for (const [input, [column, max]] of Object.entries(fields)) {
    if (hasOwn(args, input)) patch[column] = boundedText(args[input], input, max);
  }
  if (!Object.keys(patch).length) throw new Error("no supported fields were provided");
  patch.updated_at = new Date().toISOString();
  const rows = await db(`linkedin_invitations?id=eq.${contactId}&uuid=eq.${userId}`, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify(patch) });
  if (!rows[0]) throw new Error("contact was not updated");
  return { contact: rows[0], updated_fields: Object.keys(patch).filter((x) => x !== "updated_at") };
}

async function updateDeal(args: any, userId: string) {
  requireConfirmation(args);
  const links = await validateCrmLinks(userId, { deal_id: args?.deal_id });
  const patch: any = {};
  if (hasOwn(args, "name")) patch.deal_name = boundedText(args.name, "name", 500);
  if (hasOwn(args, "description")) patch.deal_description = boundedText(args.description, "description", 10000);
  if (hasOwn(args, "value")) {
    const value = args.value == null ? null : Number(args.value);
    if (value !== null && (!Number.isFinite(value) || value < 0)) throw new Error("value must be a non-negative number");
    patch.deal_value = value;
  }
  if (hasOwn(args, "phase")) {
    if (!["identification","confirmed","first_meeting","follow","negotiation","closed","cancelled"].includes(args.phase)) throw new Error("phase is unsupported");
    patch.deal_phase = args.phase;
  }
  if (args?.main_contact_id) {
    const contact = await validateCrmLinks(userId, { contact_id: args.main_contact_id });
    patch.main_contact_id = contact.contactId;
  }
  if (args?.company_id) {
    const company = await validateCrmLinks(userId, { company_id: args.company_id });
    patch.company_id = company.companyId;
  }
  if (!Object.keys(patch).length) throw new Error("no supported fields were provided");
  const rows = await db(`deal?deal_id=eq.${links.dealId}`, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify(patch) });
  if (!rows[0]) throw new Error("deal was not updated");
  return { deal: rows[0], updated_fields: Object.keys(patch) };
}

async function updateReminder(args: any, userId: string) {
  requireConfirmation(args);
  const reminder = await ownReminder(userId, args?.reminder_id);
  const patch: any = {};
  if (hasOwn(args, "title")) patch.title = boundedText(args.title, "title", 300, true);
  if (hasOwn(args, "details")) patch.details = boundedText(args.details, "details", 5000);
  if (hasOwn(args, "due_at")) patch.due_at = args.due_at == null ? null : timestamp(args.due_at, "due_at", true);
  if (hasOwn(args, "next_review_at")) patch.next_review_at = timestamp(args.next_review_at, "next_review_at", true);
  if (hasOwn(args, "priority_override")) {
    if (args.priority_override !== null && !["low","normal","high","urgent"].includes(args.priority_override)) throw new Error("priority_override is unsupported");
    patch.priority_override = args.priority_override;
  }
  if (args?.contact_id) patch.contact_id = (await validateCrmLinks(userId, { contact_id: args.contact_id })).contactId;
  if (args?.company_id) patch.company_id = (await validateCrmLinks(userId, { company_id: args.company_id })).companyId;
  if (args?.deal_id) patch.deal_id = (await validateCrmLinks(userId, { deal_id: args.deal_id })).dealId;
  if (!Object.keys(patch).length) throw new Error("no supported fields were provided");
  const rows = await db(`crm_reminders?id=eq.${reminder.id}&owner_user_id=eq.${userId}`, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify(patch) });
  if (!rows[0]) throw new Error("reminder was not updated");
  await event(userId, reminder.id, "updated", { updated_fields: Object.keys(patch) });
  return { reminder: rows[0], updated_fields: Object.keys(patch) };
}


const allTools = [
  ...emailTools,

  { name: "create_company", description: "Create a CRM company after explicit user confirmation, or safely reuse an exact existing match. Search first when the name may be ambiguous.", inputSchema: { type: "object", required: ["name","confirmed"], properties: { name: { type: "string", maxLength: 500 }, confirmed: { type: "boolean", const: true }, linkedin_id: { type: "string", maxLength: 500 }, employee_number: { type: "string", maxLength: 100 }, it_members: { type: "string", maxLength: 100 }, sector: { type: "string", maxLength: 500 }, city: { type: "string", maxLength: 500 }, company_size: { type: "string", enum: ["1 - 100","101 - 250","251 - 500","500 - 1000","1001 - 2500","2501 - 5000","5001 - 10000","10001 - 20000","+ 20000"] } } } },
  { name: "create_contact", description: "Create a CRM contact owned by the authenticated user after explicit confirmation. LinkedIn information is optional. Link to an exact existing company_id when known; duplicate candidates are reused instead of creating another record.", inputSchema: { type: "object", required: ["full_name","confirmed"], properties: { full_name: { type: "string", maxLength: 500 }, confirmed: { type: "boolean", const: true }, company_id: { type: "string", format: "uuid" }, company_name: { type: "string", maxLength: 500 }, role: { type: "string", maxLength: 1000 }, email: { type: "string", maxLength: 500 }, phone: { type: "string", maxLength: 100 }, comments: { type: "string", maxLength: 10000 }, linkedin_url: { type: "string", maxLength: 2000 }, language: { type: "string", enum: ["portuguese","english","dutch","spanish"] } } } },

  { name: "create_interaction", description: "Create a CRM interaction or note linked to an exact contact, company, or deal after explicit user confirmation. Use the CRM enum values advertised in this schema; do not guess record IDs.", inputSchema: { type: "object", required: ["confirmed"], properties: { confirmed: { type: "boolean", const: true }, title: { type: "string", maxLength: 500 }, description: { type: "string", maxLength: 10000 }, interaction_type: { type: "string", enum: ["note","email","whatsapp","linkedin","telefone","meeting"] }, occurred_at: { type: "string", format: "date-time" }, duration_minutes: { type: "integer", minimum: 0, maximum: 1440 }, contact_id: { type: "string", format: "uuid" }, company_id: { type: "string", format: "uuid" }, deal_id: { type: "string", format: "uuid" } } } },
  { name: "update_interaction", description: "Update an existing CRM interaction owned by the authenticated user after explicit confirmation. Resolve the exact interaction first; only supplied fields change.", inputSchema: { type: "object", required: ["interaction_id","confirmed"], properties: { interaction_id: { type: "integer", minimum: 1 }, confirmed: { type: "boolean", const: true }, title: { type: ["string","null"], maxLength: 500 }, description: { type: ["string","null"], maxLength: 10000 }, interaction_type: { type: "string", enum: ["note","email","whatsapp","linkedin","telefone","meeting"] }, occurred_at: { type: "string", format: "date-time" }, duration_minutes: { type: ["integer","null"], minimum: 0, maximum: 1440 }, contact_id: { type: "string", format: "uuid" }, company_id: { type: "string", format: "uuid" }, deal_id: { type: "string", format: "uuid" } } } },
  { name: "update_contact", description: "Update allowlisted fields on one exact CRM contact owned by the authenticated user after explicit confirmation. Null clears an optional value.", inputSchema: { type: "object", required: ["contact_id","confirmed"], properties: { contact_id: { type: "string", format: "uuid" }, confirmed: { type: "boolean", const: true }, full_name: { type: ["string","null"], maxLength: 500 }, company_name: { type: ["string","null"], maxLength: 500 }, role: { type: ["string","null"], maxLength: 1000 }, email: { type: ["string","null"], maxLength: 500 }, phone: { type: ["string","null"], maxLength: 100 }, comments: { type: ["string","null"], maxLength: 10000 }, linkedin_url: { type: ["string","null"], maxLength: 2000 } } } },
  { name: "update_deal", description: "Update allowlisted fields on one exact deal linked to the authenticated user's CRM contacts after explicit confirmation.", inputSchema: { type: "object", required: ["deal_id","confirmed"], properties: { deal_id: { type: "string", format: "uuid" }, confirmed: { type: "boolean", const: true }, name: { type: ["string","null"], maxLength: 500 }, description: { type: ["string","null"], maxLength: 10000 }, value: { type: ["number","null"], minimum: 0 }, phase: { type: "string", enum: ["identification","confirmed","first_meeting","follow","negotiation","closed","cancelled"] }, main_contact_id: { type: "string", format: "uuid" }, company_id: { type: "string", format: "uuid" } } } },
  { name: "update_reminder", description: "Update an existing reminder's title, details, due date, review time, explicit priority, or CRM links after explicit confirmation. Use null priority_override to return to inferred priority.", inputSchema: { type: "object", required: ["reminder_id","confirmed"], properties: { reminder_id: { type: "string", format: "uuid" }, confirmed: { type: "boolean", const: true }, title: { type: "string", maxLength: 300 }, details: { type: ["string","null"], maxLength: 5000 }, due_at: { type: ["string","null"], format: "date-time" }, next_review_at: { type: "string", format: "date-time" }, priority_override: { type: ["string","null"], enum: ["low","normal","high","urgent",null] }, contact_id: { type: "string", format: "uuid" }, company_id: { type: "string", format: "uuid" }, deal_id: { type: "string", format: "uuid" } } } },


  { name: "list_recent_interactions", description: "List the authenticated user's latest CRM interactions (notes, email, WhatsApp, LinkedIn, phone, or meetings) with linked person, company, and deal context. Use this for questions such as who the user contacted most recently. Read-only.", inputSchema: { type: "object", properties: { since: { type: "string", format: "date-time" }, contact_id: { type: "string", format: "uuid" }, company_id: { type: "string", format: "uuid" }, limit: { type: "integer", minimum: 1, maximum: 100 } } } },
  { name: "search_contacts", description: "Search the authenticated user's CRM contacts by person name, company, job title or role, or email. Use role for questions such as who is the CIO of a company. Read-only.", inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 300 }, company: { type: "string", maxLength: 300 }, role: { type: "string", maxLength: 300 }, limit: { type: "integer", minimum: 1, maximum: 100 } } } },
  { name: "get_contact_context", description: "Get one CRM contact with company details, recent interactions, and linked reminders. If a text query is ambiguous, returns candidates instead of guessing. Read-only.", inputSchema: { type: "object", properties: { contact_id: { type: "string", format: "uuid" }, query: { type: "string", maxLength: 300 }, interaction_limit: { type: "integer", minimum: 1, maximum: 50 } } } },
  { name: "get_company_context", description: "Get one company with known people and roles, recent interactions, deals, and linked reminders. If a text query is ambiguous, returns candidates instead of guessing. Read-only.", inputSchema: { type: "object", properties: { company_id: { type: "string", format: "uuid" }, query: { type: "string", maxLength: 300 }, interaction_limit: { type: "integer", minimum: 1, maximum: 50 } } } },

  { name: "create_reminder", description: "Create or idempotently reuse a general reminder from natural-language intent. Dates and explicit priority are optional; inferred priority must include a reason when supplied.", inputSchema: { type: "object", required: ["title"], properties: {
    title: { type: "string", maxLength: 300 }, details: { type: "string", maxLength: 5000 }, due_at: { type: "string", format: "date-time" }, next_review_at: { type: "string", format: "date-time" },
    priority_override: { type: "string", enum: ["low","normal","high","urgent"] }, inferred_priority: { type: "integer", minimum: 1, maximum: 5 }, inferred_reason: { type: "string", maxLength: 1000 }, inference_confidence: { type: "number", minimum: 0, maximum: 1 },
    contact_id: { type: "string", format: "uuid" }, company_id: { type: "string", format: "uuid" }, deal_id: { type: "string", format: "uuid" }, source_note_id: { type: "integer", minimum: 1 },
    source_type: { type: "string", enum: ["manual","note","gmail","calendar","linkedin","whatsapp","meeting","other"] }, source_external_id: { type: "string" }, source_url: { type: "string" }, context: { type: "object" }
  } } },
  { name: "list_reminders", description: "List the user's reminders with linked CRM context. Read-only.", inputSchema: { type: "object", properties: { status: { type: "string", enum: ["open","snoozed","completed","cancelled"] }, due_before: { type: "string", format: "date-time" }, limit: { type: "integer", minimum: 1, maximum: 200 } } } },
  { name: "list_reminders_for_review", description: "List active reminders whose next review time has arrived, including CRM context. Read-only; importance should be interpreted from the full reminder and context rather than dates alone.", inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 200 } } } },
  { name: "assess_reminder", description: "Record the agent's current interpreted importance, confidence, explanation, and next reconsideration time. This is advisory metadata, not a user priority override.", inputSchema: { type: "object", required: ["reminder_id","inferred_priority","inferred_reason","next_review_at"], properties: { reminder_id: { type: "string", format: "uuid" }, inferred_priority: { type: "integer", minimum: 1, maximum: 5 }, inferred_reason: { type: "string" }, inference_confidence: { type: "number", minimum: 0, maximum: 1 }, next_review_at: { type: "string", format: "date-time" } } } },
  { name: "record_reminder_review", description: "Record that a reminder was surfaced to the user or deliberately deferred, and set when it should be reconsidered. Does not complete or cancel it.", inputSchema: { type: "object", required: ["reminder_id","outcome","next_review_at"], properties: { reminder_id: { type: "string", format: "uuid" }, outcome: { type: "string", enum: ["surfaced","deferred"] }, next_review_at: { type: "string", format: "date-time" }, reason: { type: "string" } } } },
  { name: "snooze_reminder", description: "Snooze one reminder until an explicit future time.", inputSchema: { type: "object", required: ["reminder_id","until"], properties: { reminder_id: { type: "string", format: "uuid" }, until: { type: "string", format: "date-time" }, reason: { type: "string" } } } },
  { name: "complete_reminder", description: "Complete one exact reminder after explicit user confirmation.", inputSchema: { type: "object", required: ["reminder_id","confirmed"], properties: { reminder_id: { type: "string", format: "uuid" }, confirmed: { type: "boolean", const: true }, reason: { type: "string" } } } },
  { name: "cancel_reminder", description: "Cancel one exact reminder after explicit user confirmation.", inputSchema: { type: "object", required: ["reminder_id","confirmed"], properties: { reminder_id: { type: "string", format: "uuid" }, confirmed: { type: "boolean", const: true }, reason: { type: "string" } } } },
  { name: "reopen_reminder", description: "Reopen one completed or cancelled reminder after explicit user confirmation.", inputSchema: { type: "object", required: ["reminder_id","confirmed"], properties: { reminder_id: { type: "string", format: "uuid" }, confirmed: { type: "boolean", const: true }, reason: { type: "string" } } } },
];

const allowedToolNames = new Set(["create_company","create_contact","create_interaction","update_interaction","update_contact","update_deal","list_recent_interactions","search_contacts","get_contact_context","get_company_context","get_crm_email_status","list_campaign_email_contacts","prepare_crm_email","send_crm_email","get_crm_email"]);
const tools = allTools.filter((tool) => allowedToolNames.has(tool.name));
const emailService = createEmailService({ db, env: (name: string) => Deno.env.get(name) });

async function callTool(name: string, args: any, user: any) {
  if (emailTools.some((tool) => tool.name === name)) return emailService.call(name, args || {}, user.id);
  if (!allowedToolNames.has(name)) throw new Error(`unknown tool: ${name}`);
  if (name === "create_company") return createCompany(args || {}, user.id);
  if (name === "create_contact") return createContact(args || {}, user.id);
  if (name === "create_interaction") return createInteraction(args || {}, user.id);
  if (name === "update_interaction") return updateInteraction(args || {}, user.id);
  if (name === "update_contact") return updateContact(args || {}, user.id);
  if (name === "update_deal") return updateDeal(args || {}, user.id);
  if (name === "update_reminder") return updateReminder(args || {}, user.id);
  if (name === "list_recent_interactions") return listRecentInteractions(args || {}, user.id);
  if (name === "search_contacts") return searchContacts(args || {}, user.id);
  if (name === "get_contact_context") return getContactContext(args || {}, user.id);
  if (name === "get_company_context") return getCompanyContext(args || {}, user.id);
  if (name === "create_reminder") return createReminder(args || {}, user.id);
  if (name === "list_reminders") return listReminders(args || {}, user.id);
  if (name === "list_reminders_for_review") return listReminders(args || {}, user.id, true);
  if (name === "assess_reminder") return assessReminder(args || {}, user.id);
  if (name === "record_reminder_review") return recordReview(args || {}, user.id);
  if (name === "snooze_reminder") return snoozeReminder(args || {}, user.id);
  if (name === "complete_reminder") return decideReminder(args || {}, user.id, "complete");
  if (name === "cancel_reminder") return decideReminder(args || {}, user.id, "cancel");
  if (name === "reopen_reminder") return decideReminder(args || {}, user.id, "reopen");
  throw new Error(`unknown tool: ${name}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/.well-known/oauth-protected-resource")) {
    return json({ resource: MCP_URL, authorization_servers: [AUTH_SERVER], scopes_supported: ["email"], bearer_methods_supported: ["header"] });
  }
  if (req.method === "GET") return json({ name: "LEF CRM MCP", status: "authentication_required", resource: MCP_URL, authorization_servers: [AUTH_SERVER], scopes_supported: ["email"], bearer_methods_supported: ["header"], resource_metadata: `${MCP_URL}/.well-known/oauth-protected-resource` });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const user = await authenticate(req);
  if (!user) return oauthChallenge();
  let body: any;
  try { body = await req.json(); } catch { return rpcError(null, -32700, "Parse error"); }
  const { id, method, params } = body || {};
  if (method === "initialize") return rpcResult(id, { protocolVersion: params?.protocolVersion || "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "lef-crm", version: "1.0.0" } });
  if (method === "notifications/initialized") return new Response(null, { status: 202, headers: cors });
  if (method === "ping") return rpcResult(id, {});
  if (method === "tools/list") return rpcResult(id, { tools });
  if (method === "tools/call") {
    try { return rpcResult(id, toolText(await callTool(params?.name, params?.arguments || {}, user))); }
    catch (error) { return rpcResult(id, toolText({ error: error instanceof Error ? error.message : String(error) }, true)); }
  }
  return rpcError(id ?? null, -32601, "Method not found");
});
