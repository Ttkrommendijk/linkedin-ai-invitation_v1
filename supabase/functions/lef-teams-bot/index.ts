import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { decodeProtectedHeader, importJWK, jwtVerify } from "npm:jose@5.9.6";

const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("LEF_TEAMS_CLIENT_ID")!;
const TENANT_ID = Deno.env.get("LEF_TEAMS_TENANT_ID")!;
const CLIENT_SECRET = Deno.env.get("LEF_TEAMS_CLIENT_SECRET")!;
const OPENID = "https://login.botframework.com/v1/.well-known/openidconfiguration";

function automationKey() {
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").automations as string | undefined; }
  catch { return undefined; }
}
function safeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left); const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let difference = 0; for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }
async function db(path: string, init: RequestInit = {}) {
  const res = await fetch(`${PROJECT_URL}/rest/v1/${path}`, { ...init, headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json", ...(init.headers || {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`database request failed (${res.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

let cachedKeys: { expires: number; keys: any[] } | null = null;
async function signingKeys() {
  if (cachedKeys && cachedKeys.expires > Date.now()) return cachedKeys.keys;
  const metadata = await fetch(OPENID).then((r) => r.json());
  const document = await fetch(metadata.jwks_uri).then((r) => r.json());
  cachedKeys = { expires: Date.now() + 23 * 60 * 60 * 1000, keys: document.keys || [] };
  return cachedKeys.keys;
}
async function verifyBotFramework(req: Request, activity: any) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Error("missing Bot Framework authorization");
  const token = auth.slice(7);
  const header = decodeProtectedHeader(token);
  const jwk = (await signingKeys()).find((item) => item.kid === header.kid);
  if (!jwk) throw new Error("unknown Bot Framework signing key");
  if (Array.isArray(jwk.endorsements) && !jwk.endorsements.includes("msteams")) throw new Error("signing key is not endorsed for Teams");
  const key = await importJWK(jwk, "RS256");
  const verified = await jwtVerify(token, key, { audience: CLIENT_ID, issuer: "https://api.botframework.com", algorithms: ["RS256"], clockTolerance: 300 });
  if (verified.payload.serviceurl !== activity.serviceUrl) throw new Error("Bot Framework service URL mismatch");
  if (activity.channelId !== "msteams") throw new Error("unsupported channel");
}

async function captureConversation(activity: any) {
  const tenantId = activity.channelData?.tenant?.id;
  const aadObjectId = activity.from?.aadObjectId;
  if (!tenantId || !aadObjectId || tenantId !== TENANT_ID) throw new Error("Teams tenant or user binding is missing");
  const owners = await db(`microsoft365_connections?tenant_id=eq.${encodeURIComponent(tenantId)}&microsoft_user_id=eq.${encodeURIComponent(aadObjectId)}&status=eq.active&select=owner_user_id`);
  if (owners.length !== 1) throw new Error("Teams identity is not linked to exactly one LEF owner");
  const rows = await db("assistant_teams_connections?on_conflict=owner_user_id&select=*", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ owner_user_id: owners[0].owner_user_id, tenant_id: tenantId, teams_user_id: activity.from.id, teams_aad_object_id: aadObjectId, conversation_id: activity.conversation?.id, service_url: activity.serviceUrl, bot_id: activity.recipient?.id, bot_name: activity.recipient?.name || null, user_name: activity.from?.name || null, status: "active", last_seen_at: new Date().toISOString(), revoked_at: null }) });
  return rows[0];
}
async function botToken() {
  const form = new URLSearchParams({ grant_type: "client_credentials", client_id: CLIENT_ID, client_secret: CLIENT_SECRET, scope: "https://api.botframework.com/.default" });
  const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(`Teams bot token failed (${res.status})`);
  return data.access_token as string;
}
async function sendActivity(connection: any, title: string, body: string, payload: Record<string, unknown> = {}) {
  const token = await botToken();
  const url = `${String(connection.service_url).replace(/\/$/, "")}/v3/conversations/${encodeURIComponent(connection.conversation_id)}/activities`;
  const deliveryId = typeof payload.delivery_id === "string" ? payload.delivery_id : null;
  const actions = deliveryId ? [
    { type: "Action.Submit", title: "Done", data: { lef_action: "done", delivery_id: deliveryId } },
    { type: "Action.ShowCard", title: "Snooze", card: { type: "AdaptiveCard", body: [{ type: "Input.ChoiceSet", id: "snooze_minutes", label: "Bring it back", value: "60", choices: [{ title: "In 1 hour", value: "60" }, { title: "Tomorrow", value: "tomorrow" }] }], actions: [{ type: "Action.Submit", title: "Confirm snooze", data: { lef_action: "snooze", delivery_id: deliveryId } }] } },
    { type: "Action.ShowCard", title: "Schedule", card: { type: "AdaptiveCard", body: [{ type: "Input.Date", id: "schedule_date", label: "Date", isRequired: true, errorMessage: "Choose a date." }, { type: "Input.Time", id: "schedule_time", label: "Time", isRequired: true, errorMessage: "Choose a time." }, { type: "Input.ChoiceSet", id: "duration_minutes", label: "Duration", value: "30", style: "expanded", choices: [{ title: "15 minutes", value: "15" }, { title: "30 minutes", value: "30" }, { title: "1 hour", value: "60" }] }], actions: [{ type: "Action.Submit", title: "Confirm calendar block", data: { lef_action: "schedule", delivery_id: deliveryId } }] } },
    { type: "Action.ShowCard", title: "Blocked", card: { type: "AdaptiveCard", body: [{ type: "Input.Text", id: "blocked_reason", label: "What is blocking this?", isMultiline: true }], actions: [{ type: "Action.Submit", title: "Save reason", data: { lef_action: "blocked", delivery_id: deliveryId } }] } },
    { type: "Action.Submit", title: "Discuss", data: { lef_action: "discuss", delivery_id: deliveryId } },
  ] : [];
  const content = deliveryId ? { type: "AdaptiveCard", version: "1.5", body: [{ type: "TextBlock", size: "Medium", weight: "Bolder", text: title, wrap: true }, { type: "TextBlock", text: body, wrap: true }], actions } : null;
  const message = content ? { type: "message", from: { id: connection.bot_id, name: connection.bot_name || "LEF Assistant" }, recipient: { id: connection.teams_user_id, name: connection.user_name || undefined }, conversation: { id: connection.conversation_id }, attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", content }], channelData: { lef: payload } } : { type: "message", from: { id: connection.bot_id, name: connection.bot_name || "LEF Assistant" }, recipient: { id: connection.teams_user_id, name: connection.user_name || undefined }, conversation: { id: connection.conversation_id }, textFormat: "markdown", text: `**${title}**\n\n${body}`, channelData: { lef: payload } };
  const res = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(message) });
  const text = await res.text();
  if (!res.ok) throw new Error(`Teams delivery failed (${res.status}): ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}
async function handleAction(connection: any, activity: any) {
  const value = activity.value || {};
  const action = String(value.lef_action || "");
  const deliveryId = String(value.delivery_id || "");
  if (!["done","snooze","schedule","blocked","discuss"].includes(action) || !deliveryId) throw new Error("unsupported Teams action");
  const deliveries = await db(`assistant_scheduled_deliveries?id=eq.${encodeURIComponent(deliveryId)}&owner_user_id=eq.${connection.owner_user_id}&select=*`);
  if (deliveries.length !== 1) throw new Error("delivery is not owned by this Teams user");
  const delivery = deliveries[0];
  const idempotencyKey = `${delivery.id}:${action}`;
  const claimed = await db("assistant_teams_action_receipts?on_conflict=owner_user_id,idempotency_key&select=*", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ owner_user_id: connection.owner_user_id, teams_activity_id: activity.id, delivery_id: delivery.id, action_name: action, idempotency_key: idempotencyKey, result: { status: "processing" } }) });
  if (!claimed.length) return sendActivity(connection, "Already handled", "That action was already applied to this item.");
  let reply = "";
  if (action === "done") {
    if (delivery.source_authority === "reminders") {
      const records = await db(`crm_reminders?id=eq.${encodeURIComponent(delivery.source_external_id)}&owner_user_id=eq.${connection.owner_user_id}&select=title`);
      if (records.length !== 1) throw new Error("linked reminder was not found");
      await db(`crm_reminders?id=eq.${encodeURIComponent(delivery.source_external_id)}&owner_user_id=eq.${connection.owner_user_id}`, { method: "PATCH", body: JSON.stringify({ status: "://completed".slice(3), completed_at: new Date().toISOString(), snoozed_until: null }) });
      reply = `Marked “${records[0].title}” as done.`;
    } else if (delivery.source_authority === "projects" && delivery.source_record_type === "project_action") {
      const records = await db(`project_actions?id=eq.${encodeURIComponent(delivery.source_external_id)}&owner_user_id=eq.${connection.owner_user_id}&select=title`);
      if (records.length !== 1) throw new Error("linked project action was not found");
      await db(`project_actions?id=eq.${encodeURIComponent(delivery.source_external_id)}&owner_user_id=eq.${connection.owner_user_id}`, { method: "PATCH", body: JSON.stringify({ status: "completed", completed_at: new Date().toISOString() }) });
      reply = `Marked “${records[0].title}” as done.`;
    } else reply = "This item needs discussion before its owning system can be changed.";
  } else if (action === "snooze") {
    const until = value.snooze_minutes === "tomorrow" ? new Date(Date.now() + 24 * 60 * 60 * 1000) : new Date(Date.now() + Math.max(15, Number(value.snooze_minutes) || 60) * 60000);
    if (delivery.source_authority === "reminders") {
      const records = await db(`crm_reminders?id=eq.${encodeURIComponent(delivery.source_external_id)}&owner_user_id=eq.${connection.owner_user_id}&select=title`);
      if (records.length !== 1) throw new Error("linked reminder was not found");
      await db(`crm_reminders?id=eq.${encodeURIComponent(delivery.source_external_id)}&owner_user_id=eq.${connection.owner_user_id}`, { method: "PATCH", body: JSON.stringify({ status: "snoozed", snoozed_until: until.toISOString(), next_review_at: until.toISOString() }) });
      reply = `Snoozed “${records[0].title}” until ${until.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })}.`;
    } else if (delivery.source_authority === "projects" && delivery.source_record_type === "project_action") {
      const records = await db(`project_actions?id=eq.${encodeURIComponent(delivery.source_external_id)}&owner_user_id=eq.${connection.owner_user_id}&select=title,reminder_id`);
      if (records.length !== 1) throw new Error("linked project action was not found");
      if (records[0].reminder_id) await db(`crm_reminders?id=eq.${records[0].reminder_id}&owner_user_id=eq.${connection.owner_user_id}`, { method: "PATCH", body: JSON.stringify({ status: "snoozed", snoozed_until: until.toISOString(), next_review_at: until.toISOString() }) });
      reply = `Snoozed attention for “${records[0].title}” until ${until.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })}; its project due date was not changed.`;
    } else reply = "This item needs discussion before its owning system can be snoozed.";
  } else if (action === "blocked") {
    const reason = String(value.blocked_reason || "").trim().slice(0, 1000);
    if (!reason) throw new Error("a blocked reason is required");
    if (delivery.intervention_id) await db(`assistant_interventions?id=eq.${delivery.intervention_id}&owner_user_id=eq.${connection.owner_user_id}`, { method: "PATCH", body: JSON.stringify({ status: "blocked", outcome_note: reason }) });
    const reviewAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (delivery.source_authority === "reminders") {
      const records = await db(`crm_reminders?id=eq.${encodeURIComponent(delivery.source_external_id)}&owner_user_id=eq.${connection.owner_user_id}&select=title,context`);
      if (records.length !== 1) throw new Error("linked reminder was not found");
      await db(`crm_reminders?id=eq.${encodeURIComponent(delivery.source_external_id)}&owner_user_id=eq.${connection.owner_user_id}`, { method: "PATCH", body: JSON.stringify({ status: "snoozed", snoozed_until: reviewAt.toISOString(), next_review_at: reviewAt.toISOString(), context: { ...(records[0].context || {}), blocked_reason: reason, blocked_at: new Date().toISOString() } }) });
      reply = `Recorded “${records[0].title}” as blocked: ${reason}. I’ll review it again tomorrow.`;
    } else if (delivery.source_authority === "projects" && delivery.source_record_type === "project_action") {
      const records = await db(`project_actions?id=eq.${encodeURIComponent(delivery.source_external_id)}&owner_user_id=eq.${connection.owner_user_id}&select=title,reminder_id`);
      if (records.length !== 1) throw new Error("linked project action was not found");
      if (records[0].reminder_id) {
        const reminders = await db(`crm_reminders?id=eq.${records[0].reminder_id}&owner_user_id=eq.${connection.owner_user_id}&select=context`);
        await db(`crm_reminders?id=eq.${records[0].reminder_id}&owner_user_id=eq.${connection.owner_user_id}`, { method: "PATCH", body: JSON.stringify({ status: "snoozed", snoozed_until: reviewAt.toISOString(), next_review_at: reviewAt.toISOString(), context: { ...(reminders[0]?.context || {}), blocked_reason: reason, blocked_at: new Date().toISOString() } }) });
      }
      reply = `Recorded “${records[0].title}” as blocked: ${reason}. Its project status and due date were not changed.`;
    } else reply = `Blocked reason recorded for “${delivery.rendered_title}”: ${reason}`;
  } else if (action === "schedule") {
    if (!value.schedule_date || !value.schedule_time) throw new Error("date and time are required");
    const duration = Math.max(15, Math.min(60, Number(value.duration_minutes) || 30));
    const startsAt = new Date(`${value.schedule_date}T${value.schedule_time}:00-03:00`);
    if (Number.isNaN(startsAt.valueOf()) || startsAt.valueOf() <= Date.now()) throw new Error("the selected calendar time must be in the future");
    const endsAt = new Date(startsAt.valueOf() + duration * 60000);
    const key = automationKey();
    if (!key) throw new Error("calendar scheduling credential is unavailable");
    const scheduled = await fetch(`${PROJECT_URL}/functions/v1/lef-microsoft365-oauth/internal/create-confirmed-teams-block`, { method: "POST", headers: { apikey: key, "content-type": "application/json" }, body: JSON.stringify({ teams_action_receipt_id: claimed[0].id, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() }) });
    const scheduledBody = await scheduled.json();
    if (!scheduled.ok) throw new Error(scheduledBody?.error || "calendar block creation failed");
    reply = `Scheduled “${delivery.rendered_title}” for ${startsAt.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })}, for ${duration} minutes.`;
  } else {
    reply = `Let’s discuss: ${delivery.rendered_title}\n\n${delivery.rendered_body}`;
  }
  await db(`assistant_teams_action_receipts?id=eq.${claimed[0].id}&owner_user_id=eq.${connection.owner_user_id}`, { method: "PATCH", body: JSON.stringify({ result: { status: "completed", reply } }) });
  await sendActivity(connection, "LEF Assistant", reply);
}
async function handleIncoming(req: Request) {
  const activity = await req.json();
  await verifyBotFramework(req, activity);
  const connection = await captureConversation(activity);
  if (activity.type === "message" && activity.value?.lef_action) await handleAction(connection, activity);
  else if (activity.type === "message") await sendActivity(connection, "LEF Assistant", "LEF Assistant is connected. Future notifications and their text follow-up can happen in this personal chat.");
  return response({ accepted: true });
}

async function handleDispatch(req: Request) {
  const expected = automationKey();
  const supplied = req.headers.get("apikey") || "";
  if (!expected || !safeEqual(supplied, expected)) return response({ error: "unauthorized" }, 401);
  const claimed = await db("rpc/claim_due_assistant_deliveries", { method: "POST", body: JSON.stringify({ p_worker_id: "lef-teams-bot", p_batch_size: 10, p_claim_timeout: "00:05:00" }) });
  const results = [];
  for (const delivery of claimed) {
    const started = new Date().toISOString();
    try {
      if (delivery.delivery_channel !== "teams") throw new Error("unsupported delivery channel");
      const connections = await db(`assistant_teams_connections?owner_user_id=eq.${delivery.owner_user_id}&status=eq.active&select=*`);
      if (connections.length !== 1) throw new Error("active Teams personal-chat connection is missing");
      const sent = await sendActivity(connections[0], delivery.rendered_title, delivery.rendered_body, { ...(delivery.payload || {}), delivery_id: delivery.id, intervention_id: delivery.intervention_id });
      await db(`assistant_scheduled_deliveries?id=eq.${delivery.id}&owner_user_id=eq.${delivery.owner_user_id}`, { method: "PATCH", body: JSON.stringify({ status: "delivered", delivered_at: new Date().toISOString(), last_error: null }) });
      await db("assistant_delivery_attempts", { method: "POST", body: JSON.stringify({ owner_user_id: delivery.owner_user_id, delivery_id: delivery.id, attempt_number: delivery.attempt_count, result: "delivered", provider: "teams", provider_reference: sent.id || null, response_metadata: {} }) });
      results.push({ delivery_id: delivery.id, status: "delivered" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const terminal = Number(delivery.attempt_count) >= Number(delivery.max_attempts);
      await db(`assistant_scheduled_deliveries?id=eq.${delivery.id}&owner_user_id=eq.${delivery.owner_user_id}`, { method: "PATCH", body: JSON.stringify({ status: terminal ? "failed" : "queued", available_at: terminal ? delivery.available_at : new Date(Date.now() + Math.min(30, 2 ** Number(delivery.attempt_count)) * 60000).toISOString(), claimed_at: null, claimed_by: null, last_error: message.slice(0, 2000) }) });
      await db("assistant_delivery_attempts", { method: "POST", body: JSON.stringify({ owner_user_id: delivery.owner_user_id, delivery_id: delivery.id, attempt_number: delivery.attempt_count, result: "failed", provider: "teams", error_code: "delivery_failed", error_message: message.slice(0, 2000), response_metadata: { attempted_at: started } }) });
      results.push({ delivery_id: delivery.id, status: terminal ? "failed" : "retry_scheduled" });
    }
  }
  return response({ claimed: claimed.length, results });
}

Deno.serve(async (req) => {
  try {
    const pathname = new URL(req.url).pathname;
    const path = pathname.includes("/lef-teams-bot") ? pathname.replace(/^.*\/lef-teams-bot/, "") || "/" : pathname;
    if (req.method === "GET" && path === "/health") return response({ service: "LEF Teams delivery", status: "ok" });
    if (req.method === "POST" && (path === "/api/messages" || path === "/")) return await handleIncoming(req);
    if (req.method === "POST" && path === "/dispatch") return await handleDispatch(req);
    return response({ error: "not_found" }, 404);
  } catch (error) { console.error(error); return response({ error: "request_failed" }, 401); }
});
