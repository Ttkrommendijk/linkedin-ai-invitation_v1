import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { TEAMS_SCOPE, teamsTools, createTeamsReader, targetFor, scopesFor } from "./teams-channel-read.mjs";

const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TENANT_ID = Deno.env.get("MS_ASSISTANT_TENANT_ID")!;
const CLIENT_ID = Deno.env.get("MS_ASSISTANT_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("MS_ASSISTANT_CLIENT_SECRET")!;
const FUNCTION_URL = `${PROJECT_URL}/functions/v1/lef-microsoft365-oauth`;
const CALLBACK_URL = `${FUNCTION_URL}/callback`;
const AUTH_SERVER = `${PROJECT_URL}/auth/v1`;
const GRAPH_SCOPES = "openid profile email offline_access User.Read Calendars.Read Calendars.ReadWrite Mail.Read Mail.ReadWrite";
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type, mcp-protocol-version, mcp-session-id", "access-control-allow-methods": "GET, POST, OPTIONS" };

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

function json(body: unknown, status = 200, extra: Record<string, string> = {}) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json", ...extra } }); }
function rpcResult(id: unknown, value: unknown) { return json({ jsonrpc: "2.0", id, result: value }); }
function rpcError(id: unknown, code: number, message: string) { return json({ jsonrpc: "2.0", id, error: { code, message } }); }
function toolText(data: unknown, isError = false) { return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], isError }; }
function oauthChallenge() { return json({ error: "authentication_required" }, 401, { "www-authenticate": `Bearer resource_metadata="${FUNCTION_URL}/.well-known/oauth-protected-resource"` }); }
function html(title: string, message: string, ok = true) { return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head><body style="font-family:system-ui;margin:3rem;max-width:44rem"><h1>${title}</h1><p>${message}</p><p>${ok ? "You can close this window and return to LEF Assistant." : "Return to LEF Assistant and try connecting again."}</p></body></html>`, { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } }); }

async function db(path: string, init: RequestInit = {}) {
  const response = await fetch(`${PROJECT_URL}/rest/v1/${path}`, { ...init, headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json", ...(init.headers || {}) } });
  const body = await response.text();
  if (!response.ok) throw new Error(`database request failed (${response.status}): ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : null;
}

async function authenticate(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const response = await fetch(`${PROJECT_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, authorization: `Bearer ${auth.slice(7)}` } });
  if (!response.ok) return null;
  const user = await response.json();
  return { id: user.id as string, email: user.email as string };
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
function base64url(bytes: Uint8Array) { let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
function base64(bytes: Uint8Array) { let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
function unbase64(value: string) { const binary = atob(value); return Uint8Array.from(binary, (c) => c.charCodeAt(0)); }
async function sha256(value: string) { return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))); }
async function stateHash(value: string) { return Array.from(await sha256(value), (b) => b.toString(16).padStart(2, "0")).join(""); }
async function encryptionKey() { return crypto.subtle.importKey("raw", await sha256(CLIENT_SECRET), "AES-GCM", false, ["encrypt", "decrypt"]); }
async function encryptToken(token: string) { const iv = crypto.getRandomValues(new Uint8Array(12)); const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), encoder.encode(token)); return { encrypted_refresh_token: base64(new Uint8Array(encrypted)), encryption_iv: base64(iv) }; }
async function decryptToken(ciphertext: string, iv: string) { const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unbase64(iv) }, await encryptionKey(), unbase64(ciphertext)); return decoder.decode(plain); }

function confirmed(args: any) { if (args?.confirmed !== true) throw new Error("explicit user confirmation is required"); }
function timestamp(value: unknown, field: string) { if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${field} must be an ISO timestamp`); return new Date(value).toISOString(); }

async function beginConnection(userId: string, teamsRead = false) {
  const current = await ownConnection(userId);
  if (teamsRead) targetFor(userId, current);
  const requestedScopes = scopesFor(GRAPH_SCOPES, current, teamsRead);
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) throw new Error("Microsoft 365 Assistant credentials are not configured");
  const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)));
  const challenge = base64url(await sha256(verifier));
  await db(`microsoft365_oauth_states?owner_user_id=eq.${userId}&used_at=is.null`, { method: "DELETE" });
  await db("microsoft365_oauth_states", { method: "POST", body: JSON.stringify({ state_hash: await stateHash(state), owner_user_id: userId, code_verifier: verifier, redirect_uri: CALLBACK_URL, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() }) });
  const url = new URL("https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize");
  url.searchParams.set("client_id", CLIENT_ID); url.searchParams.set("response_type", "code"); url.searchParams.set("redirect_uri", CALLBACK_URL); url.searchParams.set("response_mode", "query"); url.searchParams.set("scope", requestedScopes); url.searchParams.set("state", state); url.searchParams.set("code_challenge", challenge); url.searchParams.set("code_challenge_method", "S256"); url.searchParams.set("prompt", "select_account");
  return { authorization_url: url.toString(), expires_in_minutes: 10, requested_access: teamsRead ? "Read Teams channel messages accessible to your Microsoft account. LEF restricts reading to the configured HDI channel. Retain existing Outlook permissions. No Teams sending or editing." : "Read the signed-in user's Outlook mail and calendar, and create confirmed calendar planning blocks." };
}

async function tokenRequest(values: Record<string, string>) {
  const form = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...values });
  const response = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(`Microsoft token request failed: ${data.error_description || data.error || response.status}`);
  return data;
}

async function graph(path: string, token: string, timezone = "America/Sao_Paulo") {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, { headers: { authorization: `Bearer ${token}`, Prefer: `outlook.timezone="${timezone}"` } });
  const data = await response.json();
  if (!response.ok) throw new Error(`Microsoft Graph request failed (${response.status}): ${data?.error?.message || "unknown error"}`);
  return data;
}

async function graphEvent(eventId: string, token: string) {
  const select = "id,subject,start,end,isAllDay,isCancelled,webLink,lastModifiedDateTime";
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}?$select=${select}`, { headers: { authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' } });
  if (response.status === 404) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(`Microsoft Graph event read failed (${response.status}): ${data?.error?.message || "unknown error"}`);
  return data;
}
function graphInstant(value: any, field: string) {
  if (!value?.dateTime) throw new Error(`calendar event ${field} is missing`);
  const raw = String(value.dateTime); const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(raw) ? raw : `${raw}Z`;
  if (Number.isNaN(Date.parse(normalized))) throw new Error(`calendar event ${field} is invalid`);
  return new Date(normalized).toISOString();
}

async function graphWrite(path: string, token: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`Microsoft Graph calendar write failed (${response.status}): ${data?.error?.message || "unknown error"}`);
  return data;
}

async function callback(url: URL) {
  const code = url.searchParams.get("code"); const state = url.searchParams.get("state"); const error = url.searchParams.get("error");
  if (error) return html("Microsoft 365 connection cancelled", url.searchParams.get("error_description") || error, false);
  if (!code || !state) return html("Microsoft 365 connection failed", "The authorization response was incomplete.", false);
  try {
    const hash = await stateHash(state);
    const states = await db(`microsoft365_oauth_states?state_hash=eq.${hash}&used_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*`);
    if (!states.length) throw new Error("The authorization request expired or was already used");
    const used = await db(`microsoft365_oauth_states?state_hash=eq.${hash}&used_at=is.null&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ used_at: new Date().toISOString() }) });
    if (!used.length) throw new Error("The authorization request was already used");
    const stateRow = states[0];
    const tokens = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: stateRow.redirect_uri, code_verifier: stateRow.code_verifier });
    if (!tokens.refresh_token) throw new Error("Microsoft did not return offline access");
    const profile = await graph("/me?$select=id,displayName,mail,userPrincipalName", tokens.access_token);
    const existing = await db(`microsoft365_connections?owner_user_id=eq.${stateRow.owner_user_id}&provider=eq.microsoft365&select=*`);
    const metadata = { tenant_id: TENANT_ID, microsoft_user_id: profile.id, email: profile.mail || profile.userPrincipalName || null, display_name: profile.displayName || null, granted_scopes: String(tokens.scope || "").split(" ").filter(Boolean), status: "active", connected_at: new Date().toISOString(), last_refreshed_at: new Date().toISOString(), last_verified_at: new Date().toISOString(), revoked_at: null };
    if (metadata.granted_scopes.includes(TEAMS_SCOPE)) targetFor(stateRow.owner_user_id, { ...metadata, status: "active" });
    let connection;
    if (existing.length) connection = (await db(`microsoft365_connections?id=eq.${existing[0].id}&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(metadata) }))[0];
    else connection = (await db("microsoft365_connections?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...metadata, owner_user_id: stateRow.owner_user_id }) }))[0];
    const encrypted = await encryptToken(tokens.refresh_token);
    await db("microsoft365_connection_secrets?on_conflict=connection_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ connection_id: connection.id, owner_user_id: stateRow.owner_user_id, ...encrypted }) });
    return html("Microsoft 365 connected", "LEF Assistant is connected to the Microsoft 365 account you selected with the delegated permissions you approved.");
  } catch (e) { return html("Microsoft 365 connection failed", e instanceof Error ? e.message : String(e), false); }
}

async function ownConnection(userId: string) { const rows = await db(`microsoft365_connections?owner_user_id=eq.${userId}&provider=eq.microsoft365&select=*`); return rows[0] || null; }
async function connectionStatus(userId: string) { const row = await ownConnection(userId); if (!row) return { connected: false }; const { id, owner_user_id, ...safe } = row; return { connected: row.status === "active", connection: safe }; }

async function accessToken(userId: string) {
  const connection = await ownConnection(userId); if (!connection || connection.status !== "active") throw new Error("Microsoft 365 calendar is not connected");
  const secrets = await db(`microsoft365_connection_secrets?connection_id=eq.${connection.id}&owner_user_id=eq.${userId}&select=*`); if (!secrets.length) throw new Error("Microsoft 365 connection credentials are missing");
  try {
    const refresh = await decryptToken(secrets[0].encrypted_refresh_token, secrets[0].encryption_iv);
    const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh, scope: scopesFor(GRAPH_SCOPES, connection) });
    const encrypted = await encryptToken(tokens.refresh_token || refresh);
    await db(`microsoft365_connection_secrets?connection_id=eq.${connection.id}&owner_user_id=eq.${userId}`, { method: "PATCH", body: JSON.stringify(encrypted) });
    await db(`microsoft365_connections?id=eq.${connection.id}&owner_user_id=eq.${userId}`, { method: "PATCH", body: JSON.stringify({ last_refreshed_at: new Date().toISOString(), granted_scopes: String(tokens.scope || "").split(" ").filter(Boolean) }) });
    return tokens.access_token as string;
  } catch (e) {
    await db(`microsoft365_connections?id=eq.${connection.id}&owner_user_id=eq.${userId}`, { method: "PATCH", body: JSON.stringify({ status: "reauthorization_required" }) });
    throw e;
  }
}

async function listEvents(args: any, userId: string) {
  const start = timestamp(args.start_at, "start_at"); const end = timestamp(args.end_at, "end_at");
  if (new Date(end).valueOf() <= new Date(start).valueOf()) throw new Error("end_at must be after start_at");
  if (new Date(end).valueOf() - new Date(start).valueOf() > 31 * 86400000) throw new Error("calendar range cannot exceed 31 days");
  const tz = typeof args.timezone === "string" && args.timezone.length <= 100 ? args.timezone : "America/Sao_Paulo";
  const token = await accessToken(userId);
  const select = "id,subject,start,end,isAllDay,showAs,location,organizer,attendees,isCancelled,webLink,lastModifiedDateTime";
  const path = `/me/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}&$select=${select}&$orderby=start/dateTime&$top=100`;
  const data = await graph(path, token, tz);
  const events = (data.value || []).map((e: any) => ({ id: e.id, subject: e.subject, start: e.start, end: e.end, is_all_day: e.isAllDay, availability: e.showAs, location: e.location?.displayName || null, organizer: e.organizer?.emailAddress || null, attendees: (e.attendees || []).map((a: any) => ({ name: a.emailAddress?.name || null, address: a.emailAddress?.address || null, type: a.type, response: a.status?.response || null })), is_cancelled: e.isCancelled, web_url: e.webLink, last_modified_at: e.lastModifiedDateTime }));
  const connection = await ownConnection(userId); if (connection) await db(`microsoft365_connections?id=eq.${connection.id}&owner_user_id=eq.${userId}`, { method: "PATCH", body: JSON.stringify({ last_verified_at: new Date().toISOString() }) });
  return { range: { start_at: start, end_at: end, timezone: tz }, events, truncated: Boolean(data["@odata.nextLink"]) };
}

function mailRange(args: any) {
  const start = timestamp(args.start_at, "start_at");
  const end = timestamp(args.end_at, "end_at");
  if (new Date(end).valueOf() <= new Date(start).valueOf()) throw new Error("end_at must be after start_at");
  if (new Date(end).valueOf() - new Date(start).valueOf() > 31 * 86400000) throw new Error("mail review range cannot exceed 31 days");
  return { start, end };
}

function mailAddress(value: any) { return value?.emailAddress ? { name: value.emailAddress.name || null, address: value.emailAddress.address || null } : null; }
function mailAddresses(values: any) { return Array.isArray(values) ? values.map(mailAddress).filter(Boolean) : []; }
function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
function textAsHtml(value: string) { return value.split(/\r?\n/).map((line) => line ? escapeHtml(line) : "<br>").join("<br>"); }

function validateSignatureHtml(value: unknown) {
  const html = blockText(value, "html_content", 100000, true)!;
  const lowered = html.toLowerCase();
  const forbidden = [/<script\b/, /<form\b/, /<iframe\b/, /<object\b/, /<embed\b/, /<link\b/, /<style\b/, /<svg\b/, /\son[a-z]+\s*=/, /javascript\s*:/, /url\s*\(/, /<meta[^>]+http-equiv\s*=\s*["']?refresh/];
  if (forbidden.some((pattern) => pattern.test(lowered))) throw new Error("signature HTML contains prohibited active or remote content");
  const allowedTags = new Set(["meta", "div", "table", "tbody", "tr", "td", "img", "span", "a", "u", "br"]);
  for (const match of html.matchAll(/<\/?\s*([a-z0-9]+)/gi)) if (!allowedTags.has(match[1].toLowerCase())) throw new Error(`signature HTML contains unsupported tag: ${match[1]}`);
  for (const match of html.matchAll(/\bsrc\s*=\s*["']([^"']+)["']/gi)) if (!/^data:image\/png;base64,[a-z0-9+/=\s]+$/i.test(match[1])) throw new Error("signature images must be embedded PNG data");
  for (const match of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) if (!/^mailto:[^\s@]+@[^\s@]+$/i.test(match[1]) && !/^https:\/\/lef\.tec\.br\/?$/i.test(match[1])) throw new Error("signature contains an unapproved link");
  return html;
}

async function activeSignature(userId: string) { const rows = await db(`assistant_email_signatures?owner_user_id=eq.${userId}&status=eq.active&select=*&limit=1`); return rows[0] || null; }
async function renderDraftBody(text: string, userId: string) { const signature = await activeSignature(userId); if (!signature) return { contentType: "Text", content: text }; return { contentType: "HTML", content: `<div>${textAsHtml(text)}</div><br><!-- lef-standard-signature:${signature.version} -->${signature.html_content}` }; }

async function getStandardSignature(userId: string) {
  const signature = await activeSignature(userId);
  if (!signature) return { configured: false };
  return { configured: true, signature: { id: signature.id, name: signature.name, text_fallback: signature.text_fallback, version: signature.version, status: signature.status, created_at: signature.created_at, updated_at: signature.updated_at } };
}

async function saveStandardSignature(args: any, userId: string) {
  confirmed(args);
  const html = validateSignatureHtml(args.html_content);
  const textFallback = blockText(args.text_fallback, "text_fallback", 10000, true)!;
  const name = blockText(args.name, "name", 200) || "Standard";
  const existing = await activeSignature(userId);
  const version = existing ? Number(existing.version) + 1 : 1;
  const rows = existing
    ? await db(`assistant_email_signatures?id=eq.${existing.id}&owner_user_id=eq.${userId}&select=id,name,text_fallback,version,status,created_at,updated_at`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ name, html_content: html, text_fallback: textFallback, version }) })
    : await db("assistant_email_signatures?select=id,name,text_fallback,version,status,created_at,updated_at", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ owner_user_id: userId, name, html_content: html, text_fallback: textFallback, version, status: "active" }) });
  return { signature: rows[0], saved: true };
}

async function removeStandardSignature(args: any, userId: string) {
  confirmed(args); const signature = await activeSignature(userId); if (!signature) return { removed: true, already_absent: true };
  await db(`assistant_email_signatures?id=eq.${signature.id}&owner_user_id=eq.${userId}`, { method: "PATCH", body: JSON.stringify({ status: "inactive" }) });
  return { removed: true };
}

async function listMailMessages(args: any, userId: string) {
  const range = mailRange(args);
  const limit = Math.min(Math.max(Number(args.limit || 25), 1), 50);
  const query = typeof args.query === "string" ? args.query.trim().toLocaleLowerCase().slice(0, 200) : "";
  const focusedOnly = args.focused_only !== false;
  const select = "id,conversationId,parentFolderId,subject,sender,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,bodyPreview,importance,hasAttachments,isRead,inferenceClassification,webLink";
  const filter = `receivedDateTime ge ${range.start} and receivedDateTime lt ${range.end}`;
  const path = `/me/messages?$select=${select}&$filter=${encodeURIComponent(filter)}&$orderby=receivedDateTime desc&$top=50`;
  const data = await graph(path, await accessToken(userId));
  const mapped = (data.value || []).map((message: any) => ({
    id: message.id,
    conversation_id: message.conversationId || null,
    parent_folder_id: message.parentFolderId || null,
    subject: message.subject || "",
    sender: mailAddress(message.sender),
    from: mailAddress(message.from),
    to: mailAddresses(message.toRecipients),
    cc: mailAddresses(message.ccRecipients),
    received_at: message.receivedDateTime || null,
    sent_at: message.sentDateTime || null,
    preview: message.bodyPreview || "",
    importance: message.importance || "normal",
    has_attachments: Boolean(message.hasAttachments),
    is_read: Boolean(message.isRead),
    inference_classification: message.inferenceClassification || null,
    web_url: message.webLink || null,
  }));
  const focused = focusedOnly ? mapped.filter((message: any) => message.inference_classification === "focused") : mapped;
  const filtered = query ? focused.filter((message: any) => JSON.stringify({ subject: message.subject, sender: message.sender, from: message.from, to: message.to, cc: message.cc, preview: message.preview }).toLocaleLowerCase().includes(query)) : focused;
  return { range: { start_at: range.start, end_at: range.end }, query: query || null, focused_only: focusedOnly, messages: filtered.slice(0, limit), scanned_count: mapped.length, matched_count: filtered.length, truncated: Boolean(data["@odata.nextLink"]) || filtered.length > limit };
}

async function readMailMessage(args: any, userId: string) {
  const id = blockText(args.message_id, "message_id", 2000, true)!;
  const select = "id,conversationId,parentFolderId,subject,sender,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,body,uniqueBody,importance,hasAttachments,isRead,internetMessageId,webLink";
  const token = await accessToken(userId);
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(id)}?$select=${select}`, { headers: { authorization: `Bearer ${token}`, Prefer: 'outlook.body-content-type="text"' } });
  const message = await response.json();
  if (!response.ok) throw new Error(`Microsoft Graph mail read failed (${response.status}): ${message?.error?.message || "unknown error"}`);
  const content = String(message.uniqueBody?.content || message.body?.content || "");
  const maxContent = 20000;
  return {
    message: {
      id: message.id,
      conversation_id: message.conversationId || null,
      parent_folder_id: message.parentFolderId || null,
      internet_message_id: message.internetMessageId || null,
      subject: message.subject || "",
      sender: mailAddress(message.sender),
      from: mailAddress(message.from),
      to: mailAddresses(message.toRecipients),
      cc: mailAddresses(message.ccRecipients),
      received_at: message.receivedDateTime || null,
      sent_at: message.sentDateTime || null,
      importance: message.importance || "normal",
      has_attachments: Boolean(message.hasAttachments),
      is_read: Boolean(message.isRead),
      body_text: content.slice(0, maxContent),
      body_truncated: content.length > maxContent,
      web_url: message.webLink || null,
    },
  };
}

async function listReplyDrafts(args: any, userId: string) {
  const limit = Math.min(Math.max(Number(args.limit || 25), 1), 100);
  const rows = await db(`microsoft365_reply_drafts?owner_user_id=eq.${userId}&select=id,source_message_id,conversation_id,subject,status,created_at,updated_at,last_verified_at&order=created_at.desc&limit=${limit}`);
  return { drafts: rows };
}

async function createReplyDraft(args: any, userId: string) {
  confirmed(args);
  const connection = await ownConnection(userId); if (!connection || connection.status !== "active") throw new Error("Microsoft 365 is not connected");
  const sourceMessageId = blockText(args.source_message_id, "source_message_id", 2000, true)!;
  const content = blockText(args.body_text, "body_text", 20000, true)!;
  const key = blockText(args.idempotency_key, "idempotency_key", 200, true)!;
  const prior = await db(`microsoft365_reply_drafts?owner_user_id=eq.${userId}&transaction_key=eq.${encodeURIComponent(key)}&select=*`);
  if (prior.length) return { draft: prior[0], reused: true };
  const token = await accessToken(userId);
  const source = await graph(`/me/messages/${encodeURIComponent(sourceMessageId)}?$select=id,conversationId,isDraft,subject`, token);
  if (source.isDraft) throw new Error("source_message_id must identify a non-draft Outlook message");
  const draftBody = await renderDraftBody(content, userId);
  const draft = await graphWrite(`/me/messages/${encodeURIComponent(sourceMessageId)}/createReply`, token, "POST", { message: { body: draftBody } });
  if (!draft?.id || draft.isDraft !== true) throw new Error("Microsoft did not return a reply draft");
  try {
    const rows = await db("microsoft365_reply_drafts?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ owner_user_id: userId, connection_id: connection.id, source_message_id: sourceMessageId, external_draft_id: draft.id, conversation_id: draft.conversationId || source.conversationId || null, subject: draft.subject || source.subject || null, transaction_key: key, last_verified_at: new Date().toISOString() }) });
    return { draft: rows[0], outlook_web_url: draft.webLink || null, outlook_draft_created: true };
  } catch (e) {
    try { await graphWrite(`/me/messages/${encodeURIComponent(draft.id)}`, token, "DELETE"); } catch { /* best-effort compensation */ }
    throw e;
  }
}

async function updateReplyDraft(args: any, userId: string) {
  confirmed(args);
  const id = blockText(args.draft_id, "draft_id", 100, true)!;
  const content = blockText(args.body_text, "body_text", 20000, true)!;
  const rows = await db(`microsoft365_reply_drafts?id=eq.${encodeURIComponent(id)}&owner_user_id=eq.${userId}&status=eq.draft&select=*`);
  if (!rows.length) throw new Error("LEF-created Outlook reply draft was not found");
  const mapping = rows[0]; const token = await accessToken(userId);
  const remote = await graph(`/me/messages/${encodeURIComponent(mapping.external_draft_id)}?$select=id,isDraft,webLink`, token);
  if (remote.isDraft !== true) {
    await db(`microsoft365_reply_drafts?id=eq.${mapping.id}&owner_user_id=eq.${userId}`, { method: "PATCH", body: JSON.stringify({ status: "no_longer_draft", last_verified_at: new Date().toISOString() }) });
    throw new Error("the mapped Outlook message is no longer a draft");
  }
  const updatedRemote = await graphWrite(`/me/messages/${encodeURIComponent(mapping.external_draft_id)}`, token, "PATCH", { body: await renderDraftBody(content, userId) });
  const updated = await db(`microsoft365_reply_drafts?id=eq.${mapping.id}&owner_user_id=eq.${userId}&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ last_verified_at: new Date().toISOString() }) });
  return { draft: updated[0], outlook_web_url: updatedRemote?.webLink || remote.webLink || null, outlook_draft_updated: true };
}

async function disconnect(args: any, userId: string) { confirmed(args); const connection = await ownConnection(userId); if (!connection) return { disconnected: true, already_disconnected: true }; await db(`microsoft365_connections?id=eq.${connection.id}&owner_user_id=eq.${userId}`, { method: "DELETE" }); return { disconnected: true }; }

function blockText(value: unknown, field: string, max: number, required = false) { if (value == null && !required) return null; if (typeof value !== "string" || (required && !value.trim())) throw new Error(`${field} is invalid`); const result = value.trim(); if (result.length > max) throw new Error(`${field} is too long`); return result || null; }
function blockRange(args: any) { const start = timestamp(args.starts_at, "starts_at"); const end = timestamp(args.ends_at, "ends_at"); if (new Date(end).valueOf() <= new Date(start).valueOf()) throw new Error("ends_at must be after starts_at"); if (new Date(end).valueOf() - new Date(start).valueOf() > 24 * 60 * 60 * 1000) throw new Error("a planning block cannot exceed 24 hours"); return { start, end }; }
function eventOptions(args: any) {
  const location = blockText(args.location, "location", 500);
  const requested = args.attendees == null ? [] : args.attendees;
  if (!Array.isArray(requested) || requested.length > 100) throw new Error("attendees must contain at most 100 entries");
  const seen = new Set<string>();
  const attendees = requested.map((entry: any) => {
    const address = blockText(entry?.email, "attendee email", 320, true)!.toLowerCase();
    if (address.includes(" ") || address.indexOf("@") < 1 || address.lastIndexOf(".") < address.indexOf("@") + 2 || seen.has(address)) throw new Error("attendee email is invalid or duplicated");
    seen.add(address);
    const name = blockText(entry.name, "attendee name", 300);
    return { emailAddress: { address, ...(name ? { name } : {}) }, type: entry.optional === true ? "optional" : "required" };
  });
  return { location, attendees, graph: { ...(location ? { location: { displayName: location } } : {}), attendees, responseRequested: attendees.length > 0, ...(args.is_online_meeting === true ? { isOnlineMeeting: true, onlineMeetingProvider: "teamsForBusiness" } : {}) } };
}
async function listBlocks(args: any, userId: string) { const take = Math.min(Math.max(Number(args.limit || 50), 1), 100); const rows = await db(`assistant_calendar_blocks?owner_user_id=eq.${userId}&select=id,title,purpose,starts_at,ends_at,timezone,status,recurrence,check_in_id,created_at,updated_at&order=starts_at.asc&limit=${take}`); return { blocks: rows }; }

async function createBlock(args: any, userId: string) {
  confirmed(args);
  const connection = await ownConnection(userId); if (!connection || connection.status !== "active") throw new Error("Microsoft 365 calendar is not connected");
  const title = blockText(args.title, "title", 500, true)!; const purpose = blockText(args.purpose, "purpose", 2000); const key = blockText(args.idempotency_key, "idempotency_key", 200, true)!; const range = blockRange(args); const timezone = blockText(args.timezone, "timezone", 100) || "America/Sao_Paulo"; const options = eventOptions(args);
  const prior = await db(`assistant_calendar_blocks?owner_user_id=eq.${userId}&transaction_key=eq.${encodeURIComponent(key)}&select=*`); if (prior.length) return { block: prior[0], reused: true };
  const checkInId = args.check_in_id == null ? null : String(args.check_in_id);
  if (checkInId) { const check = await db(`assistant_check_ins?id=eq.${encodeURIComponent(checkInId)}&owner_user_id=eq.${userId}&select=id`); if (!check.length) throw new Error("check_in_id was not found"); }
  const token = await accessToken(userId);
  const event = await graphWrite("/me/events", token, "POST", { subject: title, body: { contentType: "text", content: purpose || "Planned with LEF Assistant" }, start: { dateTime: new Date(range.start).toISOString(), timeZone: "UTC" }, end: { dateTime: new Date(range.end).toISOString(), timeZone: "UTC" }, ...options.graph, showAs: "busy", sensitivity: "normal", isReminderOn: false, categories: ["LEF Assistant"], transactionId: key });
  try {
    const rows = await db("assistant_calendar_blocks?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ owner_user_id: userId, connection_id: connection.id, check_in_id: checkInId, external_event_id: event.id, external_ical_uid: event.iCalUId || null, title, purpose, starts_at: range.start, ends_at: range.end, timezone, transaction_key: key }) });
    return { block: rows[0], calendar_event_created: true, invitations_sent: options.attendees.length > 0, teams_join_url: event.onlineMeeting?.joinUrl || null, location: options.location };
  } catch (e) {
    try { await graphWrite(`/me/events/${encodeURIComponent(event.id)}`, token, "DELETE"); } catch { /* best-effort compensation */ }
    throw e;
  }
}

function dateInTimezone(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function recurringSpec(args: any, range: { start: string; end: string }, timezone: string) {
  const requested = blockText(args.recurrence_type, "recurrence_type", 30, true)!;
  const interval = Math.trunc(Number(args.interval || 1));
  if (!Number.isInteger(interval) || interval < 1 || interval > 52) throw new Error("interval must be between one and 52");
  const allowedDays = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
  let pattern: any;
  if (requested === "daily") pattern = { type: "daily", interval };
  else if (requested === "weekdays") pattern = { type: "weekly", interval: 1, daysOfWeek: allowedDays.slice(0, 5), firstDayOfWeek: "monday" };
  else if (requested === "weekly") {
    const days = Array.isArray(args.days_of_week) ? [...new Set(args.days_of_week.map((day: unknown) => String(day).toLowerCase()))] : [];
    if (!days.length || days.some((day) => !allowedDays.includes(day))) throw new Error("weekly recurrence requires valid days_of_week");
    pattern = { type: "weekly", interval, daysOfWeek: days, firstDayOfWeek: "monday" };
  } else if (requested === "monthly") {
    const day = Math.trunc(Number(args.day_of_month));
    if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error("monthly recurrence requires day_of_month between one and 31");
    pattern = { type: "absoluteMonthly", interval, dayOfMonth: day };
  } else throw new Error("recurrence_type is unsupported");
  const startDate = dateInTimezone(range.start, timezone);
  let recurrenceRange: any;
  if (args.number_of_occurrences != null) {
    const count = Math.trunc(Number(args.number_of_occurrences));
    if (!Number.isInteger(count) || count < 2 || count > 365) throw new Error("number_of_occurrences must be between two and 365");
    recurrenceRange = { type: "numbered", startDate, numberOfOccurrences: count, recurrenceTimeZone: timezone };
  } else {
    const endDate = blockText(args.end_date, "end_date", 10, true)!;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) throw new Error("end_date must be on or after the first occurrence");
    recurrenceRange = { type: "endDate", startDate, endDate, recurrenceTimeZone: timezone };
  }
  return { pattern, range: recurrenceRange };
}
async function createRecurringBlock(args: any, userId: string) {
  confirmed(args);
  const connection = await ownConnection(userId); if (!connection || connection.status !== "active") throw new Error("Microsoft 365 calendar is not connected");
  const title = blockText(args.title, "title", 500, true)!; const purpose = blockText(args.purpose, "purpose", 2000); const key = blockText(args.idempotency_key, "idempotency_key", 200, true)!; const range = blockRange(args); const timezone = blockText(args.timezone, "timezone", 100) || "America/Sao_Paulo"; const options = eventOptions(args);
  const recurrence = recurringSpec(args, range, timezone);
  const prior = await db(`assistant_calendar_blocks?owner_user_id=eq.${userId}&transaction_key=eq.${encodeURIComponent(key)}&select=*`); if (prior.length) return { block: prior[0], reused: true };
  const token = await accessToken(userId);
  const event = await graphWrite("/me/events", token, "POST", { subject: title, body: { contentType: "text", content: purpose || "Planned with LEF Assistant" }, start: { dateTime: new Date(range.start).toISOString(), timeZone: "UTC" }, end: { dateTime: new Date(range.end).toISOString(), timeZone: "UTC" }, recurrence, ...options.graph, showAs: "busy", sensitivity: "normal", isReminderOn: false, categories: ["LEF Assistant"], transactionId: key });
  try {
    const rows = await db("assistant_calendar_blocks?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ owner_user_id: userId, connection_id: connection.id, external_event_id: event.id, external_ical_uid: event.iCalUId || null, title, purpose, starts_at: range.start, ends_at: range.end, timezone, recurrence, transaction_key: key }) });
    return { block: rows[0], calendar_series_created: true, invitations_sent: options.attendees.length > 0, teams_join_url: event.onlineMeeting?.joinUrl || null, location: options.location };
  } catch (error) {
    try { await graphWrite(`/me/events/${encodeURIComponent(event.id)}`, token, "DELETE"); } catch { /* best-effort compensation */ }
    throw error;
  }
}
async function cancelBlock(args: any, userId: string) {
  confirmed(args); const id = blockText(args.block_id, "block_id", 100, true)!;
  const rows = await db(`assistant_calendar_blocks?id=eq.${encodeURIComponent(id)}&owner_user_id=eq.${userId}&status=eq.scheduled&select=*`);
  if (rows.length !== 1) throw new Error("LEF calendar block was not found");
  const token = await accessToken(userId);
  await graphWrite(`/me/events/${encodeURIComponent(rows[0].external_event_id)}`, token, "DELETE");
  const updated = await db(`assistant_calendar_blocks?id=eq.${id}&owner_user_id=eq.${userId}&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "cancelled" }) });
  return { block: updated[0], calendar_event_or_series_cancelled: true };
}

async function rescheduleBlock(args: any, userId: string) {
  confirmed(args); const id = String(args.block_id || "");
  const rows = await db(`assistant_calendar_blocks?id=eq.${encodeURIComponent(id)}&owner_user_id=eq.${userId}&status=eq.scheduled&select=*`); if (!rows.length) throw new Error("LEF calendar block was not found");
  const block = rows[0]; const range = blockRange(args); const timezone = blockText(args.timezone, "timezone", 100) || block.timezone;
  const token = await accessToken(userId);
  await graphWrite(`/me/events/${encodeURIComponent(block.external_event_id)}`, token, "PATCH", { start: { dateTime: new Date(range.start).toISOString(), timeZone: "UTC" }, end: { dateTime: new Date(range.end).toISOString(), timeZone: "UTC" }, sensitivity: "normal" });
  const updated = await db(`assistant_calendar_blocks?id=eq.${block.id}&owner_user_id=eq.${userId}&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ starts_at: range.start, ends_at: range.end, timezone, last_rescheduled_at: new Date().toISOString() }) });
  return { block: updated[0], calendar_event_rescheduled: true };
}

async function reconcileCalendarSchedule(schedule: any, token: string, now = new Date()) {
  const event = await graphEvent(schedule.source_external_id, token);
  const pendingPath = `assistant_scheduled_deliveries?schedule_id=eq.${schedule.id}&owner_user_id=eq.${schedule.owner_user_id}&status=in.(queued,claimed)&select=*`;
  const pending = await db(pendingPath);
  const record = async (eventType: string, details: Record<string, unknown> = {}, previous?: string | null, next?: string | null, deliveryId?: string | null) => {
    await db("assistant_schedule_reconciliation_events", { method: "POST", body: JSON.stringify({ owner_user_id: schedule.owner_user_id, schedule_id: schedule.id, delivery_id: deliveryId || null, event_type: eventType, previous_deliver_at: previous || null, new_deliver_at: next || null, reason: details.reason || null, details }) });
  };
  const cancelPending = async (reason: string, eventType: string) => {
    for (const delivery of pending) {
      await db(`assistant_scheduled_deliveries?id=eq.${delivery.id}&owner_user_id=eq.${schedule.owner_user_id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled", claimed_at: null, claimed_by: null, last_error: reason }) });
      await record(eventType, { reason }, delivery.deliver_at, null, delivery.id);
    }
  };
  if (!event || event.isCancelled === true) {
    const reason = event ? "authoritative calendar event was cancelled" : "authoritative calendar event is no longer available";
    await cancelPending(reason, event ? "cancelled" : "source_unavailable");
    await db(`assistant_attention_schedules?id=eq.${schedule.id}&owner_user_id=eq.${schedule.owner_user_id}`, { method: "PATCH", body: JSON.stringify({ status: "paused", last_evaluated_at: now.toISOString(), next_run_at: null }) });
    return { schedule_id: schedule.id, result: event ? "cancelled" : "source_unavailable" };
  }
  if (event.isAllDay === true) {
    await cancelPending("all-day calendar entries are not eligible for exact-time alerts", "cancelled");
    await db(`assistant_attention_schedules?id=eq.${schedule.id}&owner_user_id=eq.${schedule.owner_user_id}`, { method: "PATCH", body: JSON.stringify({ status: "paused", last_evaluated_at: now.toISOString(), next_run_at: null }) });
    return { schedule_id: schedule.id, result: "ineligible" };
  }
  const startsAt = graphInstant(event.start, "start");
  const offset = Number(schedule.offset_minutes || 0);
  const deliverAt = new Date(new Date(startsAt).valueOf() + offset * 60000).toISOString();
  const sourceVersion = `${startsAt}|${offset}`;
  const deliveryKey = `calendar:${event.id}:offset:${offset}:start:${Math.floor(new Date(startsAt).valueOf() / 1000)}`;
  const current = pending.find((row: any) => row.delivery_key === deliveryKey && row.source_version === sourceVersion);
  for (const delivery of pending.filter((row: any) => row.id !== current?.id)) {
    await db(`assistant_scheduled_deliveries?id=eq.${delivery.id}&owner_user_id=eq.${schedule.owner_user_id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled", claimed_at: null, claimed_by: null, last_error: "authoritative calendar timing changed" }) });
    await record("rescheduled", { reason: "authoritative calendar timing changed" }, delivery.deliver_at, deliverAt, delivery.id);
  }
  let created = false;
  if (!current && new Date(deliverAt).valueOf() >= now.valueOf()) {
    const rows = await db("assistant_scheduled_deliveries?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ owner_user_id: schedule.owner_user_id, schedule_id: schedule.id, delivery_key: deliveryKey, delivery_channel: "teams", status: "queued", deliver_at: deliverAt, available_at: deliverAt, expires_at: new Date(new Date(startsAt).valueOf() + 60 * 60000).toISOString(), source_authority: "outlook_calendar", source_record_type: "calendar_event_alert", source_external_id: event.id, source_version: sourceVersion, rendered_title: event.subject || "Upcoming meeting", rendered_body: `This selected Outlook meeting starts in ${Math.abs(offset)} minutes.`, discussion_target: { authority: "outlook_calendar", record_type: "event", record_id: event.id }, payload: { starts_at: startsAt, web_url: event.webLink || null, offset_minutes: offset } }) });
    await record("created", { reason: "selected calendar event is eligible for an exact-time alert" }, null, deliverAt, rows[0]?.id || null);
    created = true;
  }
  await db(`assistant_attention_schedules?id=eq.${schedule.id}&owner_user_id=eq.${schedule.owner_user_id}`, { method: "PATCH", body: JSON.stringify({ last_evaluated_at: now.toISOString(), next_run_at: new Date(startsAt).valueOf() > now.valueOf() ? deliverAt : null }) });
  return { schedule_id: schedule.id, result: current ? "unchanged" : created ? "queued" : "past" };
}

async function reconcileCalendarAlerts() {
  const schedules = await db("assistant_attention_schedules?schedule_type=eq.calendar_offset&source_authority=eq.outlook_calendar&source_record_type=eq.calendar_event&status=eq.active&select=*&limit=100");
  const tokens = new Map<string, string>(); const results = [];
  for (const schedule of schedules) {
    try {
      let token = tokens.get(schedule.owner_user_id);
      if (!token) { token = await accessToken(schedule.owner_user_id); tokens.set(schedule.owner_user_id, token); }
      results.push(await reconcileCalendarSchedule(schedule, token));
    } catch (error) {
      await db("assistant_schedule_reconciliation_events", { method: "POST", body: JSON.stringify({ owner_user_id: schedule.owner_user_id, schedule_id: schedule.id, event_type: "source_unavailable", reason: error instanceof Error ? error.message.slice(0, 1000) : "calendar reconciliation failed", details: {} }) });
      results.push({ schedule_id: schedule.id, result: "failed" });
    }
  }
  return { evaluated: schedules.length, results };
}

async function setCalendarEventAlert(args: any, userId: string) {
  confirmed(args);
  const eventId = blockText(args.event_id, "event_id", 2000, true)!;
  const minutes = Math.trunc(Number(args.minutes_before ?? 5));
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 10080) throw new Error("minutes_before must be between zero and 10080");
  const token = await accessToken(userId); const event = await graphEvent(eventId, token);
  if (!event || event.isCancelled === true) throw new Error("the selected Outlook event is unavailable or cancelled");
  if (event.isAllDay === true) throw new Error("all-day calendar entries are not eligible for exact-time alerts");
  const startsAt = graphInstant(event.start, "start"); const deliverAt = new Date(new Date(startsAt).valueOf() - minutes * 60000);
  if (deliverAt.valueOf() <= Date.now()) throw new Error("the selected alert time has already passed");
  const existing = await db(`assistant_attention_schedules?owner_user_id=eq.${userId}&schedule_type=eq.calendar_offset&source_authority=eq.outlook_calendar&source_record_type=eq.calendar_event&source_external_id=eq.${encodeURIComponent(eventId)}&status=neq.cancelled&select=*`);
  const body = { name: `Calendar alert: ${event.subject || "Upcoming meeting"}`, schedule_type: "calendar_offset", status: "active", timezone: blockText(args.timezone, "timezone", 100) || "America/Sao_Paulo", schedule_expression: null, next_run_at: deliverAt.toISOString(), offset_minutes: -minutes, source_authority: "outlook_calendar", source_record_type: "calendar_event", source_external_id: eventId, eligibility_policy: { selected_by_user: true, minutes_before: minutes } };
  const schedule = existing.length ? (await db(`assistant_attention_schedules?id=eq.${existing[0].id}&owner_user_id=eq.${userId}&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) }))[0] : (await db("assistant_attention_schedules?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ owner_user_id: userId, ...body }) }))[0];
  const reconciliation = await reconcileCalendarSchedule(schedule, token);
  return { schedule, reconciliation, selected_event: { id: event.id, subject: event.subject || null, starts_at: startsAt }, updated: existing.length > 0 };
}

async function cancelCalendarEventAlert(args: any, userId: string) {
  confirmed(args); const scheduleId = blockText(args.schedule_id, "schedule_id", 100, true)!;
  const rows = await db(`assistant_attention_schedules?id=eq.${encodeURIComponent(scheduleId)}&owner_user_id=eq.${userId}&schedule_type=eq.calendar_offset&source_authority=eq.outlook_calendar&select=*`);
  if (!rows.length) throw new Error("calendar alert schedule was not found");
  await db(`assistant_scheduled_deliveries?schedule_id=eq.${scheduleId}&owner_user_id=eq.${userId}&status=in.(queued,claimed)`, { method: "PATCH", body: JSON.stringify({ status: "cancelled", claimed_at: null, claimed_by: null, last_error: "calendar alert cancelled by user" }) });
  const updated = await db(`assistant_attention_schedules?id=eq.${scheduleId}&owner_user_id=eq.${userId}&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "cancelled", next_run_at: null, last_evaluated_at: new Date().toISOString() }) });
  return { schedule: updated[0], cancelled: true };
}

const teamsReader = createTeamsReader({ getConnection: ownConnection, getToken: accessToken });

const tools = [
  ...teamsTools,
  { name: "begin_calendar_connection", description: "Create a Microsoft sign-in link for the existing Outlook integration. Optional include_teams_channel_read requests Teams reading only with confirmed:true; omission preserves existing access.", inputSchema: { type: "object", properties: { include_teams_channel_read: { type: "boolean", default: false }, confirmed: { type: "boolean", const: true } } } },
  { name: "get_calendar_connection", description: "Check whether the authenticated user has an active Microsoft 365 calendar connection. Never returns tokens.", inputSchema: { type: "object", properties: {} } },
  { name: "list_calendar_events", description: "Read calendar events for an explicit range of at most 31 days. Calendar remains authoritative; events are not copied into LEF.", inputSchema: { type: "object", required: ["start_at", "end_at"], properties: { start_at: { type: "string", format: "date-time" }, end_at: { type: "string", format: "date-time" }, timezone: { type: "string", maxLength: 100 } } } },
  { name: "disconnect_calendar", description: "Delete the stored Microsoft calendar connection and encrypted refresh token after explicit user confirmation.", inputSchema: { type: "object", required: ["confirmed"], properties: { confirmed: { type: "boolean", const: true } } } },
  { name: "list_calendar_blocks", description: "List planning blocks previously created by LEF Assistant. Does not list or expose arbitrary calendar events.", inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 100 } } } },
  { name: "create_calendar_block", description: "Create one confirmed normal-visibility Outlook event. Optional attendees authorize Outlook invitations; an optional Teams meeting and location may be included. Use a stable idempotency key.", inputSchema: { type: "object", required: ["title", "starts_at", "ends_at", "idempotency_key", "confirmed"], properties: { title: { type: "string", maxLength: 500 }, purpose: { type: "string", maxLength: 2000 }, location: { type: "string", maxLength: 500 }, attendees: { type: "array", maxItems: 100, items: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email", maxLength: 320 }, name: { type: "string", maxLength: 300 }, optional: { type: "boolean" } }, additionalProperties: false } }, is_online_meeting: { type: "boolean", default: false }, starts_at: { type: "string", format: "date-time" }, ends_at: { type: "string", format: "date-time" }, timezone: { type: "string", maxLength: 100 }, idempotency_key: { type: "string", maxLength: 200 }, check_in_id: { type: "string", format: "uuid" }, confirmed: { type: "boolean", const: true } } } },
  { name: "create_recurring_calendar_block", description: "Create one confirmed bounded recurring Outlook series, optionally with location, attendees, and a Teams meeting. Supports daily, weekdays, weekly, and monthly patterns.", inputSchema: { type: "object", required: ["title", "starts_at", "ends_at", "recurrence_type", "idempotency_key", "confirmed"], oneOf: [{ required: ["end_date"] }, { required: ["number_of_occurrences"] }], properties: { title: { type: "string", maxLength: 500 }, purpose: { type: "string", maxLength: 2000 }, location: { type: "string", maxLength: 500 }, attendees: { type: "array", maxItems: 100, items: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email", maxLength: 320 }, name: { type: "string", maxLength: 300 }, optional: { type: "boolean" } }, additionalProperties: false } }, is_online_meeting: { type: "boolean", default: false }, starts_at: { type: "string", format: "date-time" }, ends_at: { type: "string", format: "date-time" }, timezone: { type: "string", maxLength: 100 }, recurrence_type: { type: "string", enum: ["daily","weekdays","weekly","monthly"] }, interval: { type: "integer", minimum: 1, maximum: 52, default: 1 }, days_of_week: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string", enum: ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] } }, day_of_month: { type: "integer", minimum: 1, maximum: 31 }, end_date: { type: "string", format: "date" }, number_of_occurrences: { type: "integer", minimum: 2, maximum: 365 }, idempotency_key: { type: "string", maxLength: 200 }, confirmed: { type: "boolean", const: true } } } },
  { name: "reschedule_calendar_block", description: "Reschedule an exact mapped LEF-created planning block after immediate explicit user confirmation. Arbitrary Outlook events cannot be targeted.", inputSchema: { type: "object", required: ["block_id", "starts_at", "ends_at", "confirmed"], properties: { block_id: { type: "string", format: "uuid" }, starts_at: { type: "string", format: "date-time" }, ends_at: { type: "string", format: "date-time" }, timezone: { type: "string", maxLength: 100 }, confirmed: { type: "boolean", const: true } } } },
  { name: "cancel_calendar_block", description: "Cancel one exact LEF-created Outlook block or its whole recurring series after explicit confirmation. Occurrence-only cancellation is not supported.", inputSchema: { type: "object", required: ["block_id", "confirmed"], properties: { block_id: { type: "string", format: "uuid" }, confirmed: { type: "boolean", const: true } } } },
  { name: "set_calendar_event_alert", description: "Create or update an exact-time Teams alert for one explicitly selected Outlook event after confirmation. The default is five minutes before; alerts are never enabled for every meeting implicitly.", inputSchema: { type: "object", required: ["event_id", "confirmed"], properties: { event_id: { type: "string", maxLength: 2000 }, minutes_before: { type: "integer", minimum: 0, maximum: 10080, default: 5 }, timezone: { type: "string", maxLength: 100 }, confirmed: { type: "boolean", const: true } } } },
  { name: "cancel_calendar_event_alert", description: "Cancel one exact calendar-alert schedule and its undelivered Teams notification after explicit confirmation.", inputSchema: { type: "object", required: ["schedule_id", "confirmed"], properties: { schedule_id: { type: "string", format: "uuid" }, confirmed: { type: "boolean", const: true } } } },
  { name: "list_mail_messages", description: "Read Outlook message metadata and previews within an explicit range of at most 31 days. Returns Outlook Focused messages by default; set focused_only=false only when the user asks to include Other. Optionally applies a bounded local relevance query. Does not change mailbox state or persist messages.", inputSchema: { type: "object", required: ["start_at", "end_at"], properties: { start_at: { type: "string", format: "date-time" }, end_at: { type: "string", format: "date-time" }, query: { type: "string", maxLength: 200 }, focused_only: { type: "boolean", default: true }, limit: { type: "integer", minimum: 1, maximum: 50 } } } },
  { name: "read_mail_message", description: "Read the text content of one Outlook message selected from a bounded triage result. Content is capped and is not persisted by this tool.", inputSchema: { type: "object", required: ["message_id"], properties: { message_id: { type: "string", maxLength: 2000 } } } },
  { name: "list_reply_drafts", description: "List minimal mappings for reply drafts previously created by LEF Assistant. Does not expose draft bodies or arbitrary Outlook drafts.", inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 100 } } } },
  { name: "create_reply_draft", description: "Create an Outlook reply-to-sender draft for one selected source message after immediate explicit user confirmation. Never sends mail. Use a stable idempotency key.", inputSchema: { type: "object", required: ["source_message_id", "body_text", "idempotency_key", "confirmed"], properties: { source_message_id: { type: "string", maxLength: 2000 }, body_text: { type: "string", maxLength: 20000 }, idempotency_key: { type: "string", maxLength: 200 }, confirmed: { type: "boolean", const: true } } } },
  { name: "update_reply_draft", description: "Replace the body of an exact mapped LEF-created Outlook reply draft after immediate explicit user confirmation. The remote message must still be a draft. Never sends mail or changes recipients.", inputSchema: { type: "object", required: ["draft_id", "body_text", "confirmed"], properties: { draft_id: { type: "string", format: "uuid" }, body_text: { type: "string", maxLength: 20000 }, confirmed: { type: "boolean", const: true } } } },
  { name: "get_standard_signature", description: "Read the configured standard-signature metadata and plain-text fallback. Does not expose embedded image data.", inputSchema: { type: "object", properties: {} } },
  { name: "save_standard_signature", description: "Save one explicitly approved standard Outlook signature after strict HTML validation. Images must be embedded PNG data and links are restricted.", inputSchema: { type: "object", required: ["html_content", "text_fallback", "confirmed"], properties: { name: { type: "string", maxLength: 200 }, html_content: { type: "string", maxLength: 100000 }, text_fallback: { type: "string", maxLength: 10000 }, confirmed: { type: "boolean", const: true } } } },
  { name: "remove_standard_signature", description: "Deactivate the standard signature after explicit confirmation. Existing drafts are not rewritten.", inputSchema: { type: "object", required: ["confirmed"], properties: { confirmed: { type: "boolean", const: true } } } },
];

async function callTool(name: string, args: any, user: any) {
  if (name === "get_teams_channel_connection") return teamsReader.status(user.id);
  if (name === "begin_teams_channel_connection") { confirmed(args); return toolText(await beginConnection(user.id, true)); }
  if (name === "list_teams_channel_posts") return teamsReader.posts(user.id, args || {});
  if (name === "read_teams_channel_thread") return teamsReader.thread(user.id, args || {});
  if (name === "list_teams_channel_media") return teamsReader.mediaList(user.id, args || {});
  if (name === "read_teams_channel_media") return teamsReader.media(user.id, args || {});
 if (name === "begin_calendar_connection") { if (args?.include_teams_channel_read === true) confirmed(args); return beginConnection(user.id, args?.include_teams_channel_read === true); } if (name === "get_calendar_connection") return connectionStatus(user.id); if (name === "list_calendar_events") return listEvents(args || {}, user.id); if (name === "disconnect_calendar") return disconnect(args || {}, user.id); if (name === "list_calendar_blocks") return listBlocks(args || {}, user.id); if (name === "create_calendar_block") return createBlock(args || {}, user.id); if (name === "create_recurring_calendar_block") return createRecurringBlock(args || {}, user.id); if (name === "reschedule_calendar_block") return rescheduleBlock(args || {}, user.id); if (name === "cancel_calendar_block") return cancelBlock(args || {}, user.id); if (name === "set_calendar_event_alert") return setCalendarEventAlert(args || {}, user.id); if (name === "cancel_calendar_event_alert") return cancelCalendarEventAlert(args || {}, user.id); if (name === "list_mail_messages") return listMailMessages(args || {}, user.id); if (name === "read_mail_message") return readMailMessage(args || {}, user.id); if (name === "list_reply_drafts") return listReplyDrafts(args || {}, user.id); if (name === "create_reply_draft") return createReplyDraft(args || {}, user.id); if (name === "update_reply_draft") return updateReplyDraft(args || {}, user.id); if (name === "get_standard_signature") return getStandardSignature(user.id); if (name === "save_standard_signature") return saveStandardSignature(args || {}, user.id); if (name === "remove_standard_signature") return removeStandardSignature(args || {}, user.id); throw new Error(`unknown tool: ${name}`); }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const url = new URL(req.url); const metadata = { resource: FUNCTION_URL, authorization_servers: [AUTH_SERVER], scopes_supported: ["email"], bearer_methods_supported: ["header"] };
  if (req.method === "GET" && url.pathname.endsWith("/callback")) return callback(url);
  if (req.method === "GET" && url.pathname.endsWith("/.well-known/oauth-protected-resource")) return json(metadata);
  if (req.method === "GET") return json({ name: "LEF Microsoft 365 MCP", status: "authentication_required", ...metadata, resource_metadata: `${FUNCTION_URL}/.well-known/oauth-protected-resource` });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (url.pathname.endsWith("/reconcile-calendar-alerts")) {
    const expected = automationKey(); const supplied = req.headers.get("apikey") || "";
    if (!expected || !safeEqual(supplied, expected)) return json({ error: "unauthorized" }, 401);
    try { return json(await reconcileCalendarAlerts()); } catch (error) { return json({ error: error instanceof Error ? error.message : String(error) }, 500); }
  }
  if (url.pathname.endsWith("/internal/create-confirmed-teams-block")) {
    const expected = automationKey(); const supplied = req.headers.get("apikey") || "";
    if (!expected || !safeEqual(supplied, expected)) return json({ error: "unauthorized" }, 401);
    try {
      const body = await req.json();
      const receiptId = blockText(body?.teams_action_receipt_id, "teams_action_receipt_id", 100, true)!;
      const receipts = await db(`assistant_teams_action_receipts?id=eq.${encodeURIComponent(receiptId)}&action_name=eq.schedule&select=id,owner_user_id,delivery_id`);
      if (receipts.length !== 1) throw new Error("confirmed Teams schedule action was not found");
      const deliveries = await db(`assistant_scheduled_deliveries?id=eq.${receipts[0].delivery_id}&owner_user_id=eq.${receipts[0].owner_user_id}&select=rendered_title`);
      if (deliveries.length !== 1) throw new Error("linked Teams delivery was not found");
      return json(await createBlock({
        title: `Focus: ${deliveries[0].rendered_title}`,
        purpose: "Scheduled from the user's final confirmation in the LEF Teams card.",
        starts_at: body?.starts_at,
        ends_at: body?.ends_at,
        timezone: "America/Sao_Paulo",
        idempotency_key: `teams-schedule-${receiptId}`,
        confirmed: true,
      }, receipts[0].owner_user_id));
    } catch (error) { return json({ error: error instanceof Error ? error.message : String(error) }, 400); }
  }
  const user = await authenticate(req); if (!user) return oauthChallenge();
  let body: any; try { body = await req.json(); } catch { return rpcError(null, -32700, "Parse error"); }
  const { id, method, params } = body || {};
  if (method === "initialize") return rpcResult(id, { protocolVersion: params?.protocolVersion || "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "lef-microsoft365", version: "1.0.0" } });
  if (method === "notifications/initialized") return new Response(null, { status: 202, headers: cors });
  if (method === "ping") return rpcResult(id, {}); if (method === "tools/list") return rpcResult(id, { tools });
  if (method === "tools/call") { try { const result = await callTool(params?.name, params?.arguments || {}, user); return rpcResult(id, teamsTools.some((tool: any) => tool.name === params?.name) ? result : toolText(result)); } catch (e) { return rpcResult(id, toolText({ error: e instanceof Error ? e.message : String(e) }, true)); } }
  return rpcError(id ?? null, -32601, "Method not found");
});
