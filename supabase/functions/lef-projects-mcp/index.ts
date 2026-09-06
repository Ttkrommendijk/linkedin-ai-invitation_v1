import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MCP_URL = `${PROJECT_URL}/functions/v1/lef-projects-mcp`;
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
  const response = await fetch(`${PROJECT_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return { id: user.id as string, email: user.email as string };
}

const encoded = (value: unknown) => encodeURIComponent(String(value));

function uuid(value: unknown, field: string) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${field} must be a UUID`);
  }
  return value;
}

function text(value: unknown, field: string, max: number, required = false) {
  if (value == null && !required) return null;
  if (typeof value !== "string" || (required && !value.trim())) throw new Error(`${field} is invalid`);
  const result = value.trim();
  if (result.length > max) throw new Error(`${field} is too long`);
  return result || null;
}

function timestamp(value: unknown, field: string) {
  if (value == null) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${field} must be an ISO timestamp`);
  return new Date(value).toISOString();
}
function calendarDate(value: unknown, field: string) {
  if (value == null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${field} must be YYYY-MM-DD`);
  return value;
}

function confirmation(args: any) {
  if (args?.confirmed !== true) throw new Error("explicit user confirmation is required");
}

function oneOf(value: unknown, field: string, values: string[]) {
  if (typeof value !== "string" || !values.includes(value)) throw new Error(`${field} must be one of: ${values.join(", ")}`);
  return value;
}

function confidence(value: unknown) {
  if (value == null) return null;
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0 || result > 1) throw new Error("confidence must be between 0 and 1");
  return result;
}

async function ownItem(userId: string, value: unknown, kind?: "idea" | "project") {
  const id = uuid(value, "project_item_id");
  const kindFilter = kind ? `&kind=eq.${kind}` : "";
  const rows = await db(`project_items?id=eq.${id}&owner_user_id=eq.${userId}${kindFilter}&select=*`);
  if (!rows.length) throw new Error(`${kind || "project item"} was not found`);
  return rows[0];
}

async function ownAction(userId: string, value: unknown) {
  const id = uuid(value, "action_id");
  const rows = await db(`project_actions?id=eq.${id}&owner_user_id=eq.${userId}&select=*`);
  if (!rows.length) throw new Error("project action was not found");
  return rows[0];
}

async function ownMemory(userId: string, value: unknown) {
  const id = uuid(value, "memory_id");
  const rows = await db(`project_progress_memories?id=eq.${id}&owner_user_id=eq.${userId}&select=*`);
  if (!rows.length) throw new Error("project progress memory was not found");
  return rows[0];
}

async function listProjectItems(args: any, userId: string) {
  const limit = Math.min(Math.max(Number(args.limit || 50), 1), 100);
  let path = `project_items?owner_user_id=eq.${userId}&select=*&order=updated_at.desc&limit=${limit}`;
  if (args.kind) path += `&kind=eq.${oneOf(args.kind, "kind", ["idea", "project"])}`;
  if (args.project_status) path += `&project_status=eq.${oneOf(args.project_status, "project_status", ["active", "paused", "completed", "cancelled"])}`;
  if (args.parent_project_id) path += `&parent_project_id=eq.${uuid(args.parent_project_id, "parent_project_id")}`;
  if (args.query) path += `&title=ilike.*${encoded(text(args.query, "query", 200, true))}*`;
  return { items: await db(path) };
}

async function getProjectContext(args: any, userId: string) {
  const item = await ownItem(userId, args.project_item_id);
  const id = item.id;
  const [children, actions, memories, events] = await Promise.all([
    db(`project_items?owner_user_id=eq.${userId}&parent_project_id=eq.${id}&select=*&order=updated_at.desc`),
    item.kind === "project" ? db(`project_actions?owner_user_id=eq.${userId}&project_id=eq.${id}&select=*&order=status.asc,due_at.asc.nullslast,created_at.asc`) : [],
    item.kind === "project" ? db(`project_progress_memories?owner_user_id=eq.${userId}&project_id=eq.${id}&select=*&order=recorded_at.desc&limit=50`) : [],
    db(`project_events?owner_user_id=eq.${userId}&project_item_id=eq.${id}&select=*&order=created_at.desc&limit=50`),
  ]);
  return { item, children, actions, progress_memories: memories, events };
}

async function createItem(args: any, userId: string, kind: "idea" | "project") {
  confirmation(args);
  const parent = args.parent_project_id ? await ownItem(userId, args.parent_project_id, "project") : null;
  const body = {
    owner_user_id: userId,
    kind,
    parent_project_id: parent?.id || null,
    title: text(args.title, "title", 500, true),
    details: text(args.details, "details", 10000),
    project_status: kind === "project" ? "active" : null,
  };
  const rows = await db("project_items?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
  return { item: rows[0] };
}

async function updateItem(args: any, userId: string) {
  confirmation(args);
  const item = await ownItem(userId, args.project_item_id);
  const update: Record<string, unknown> = {};
  if (Object.hasOwn(args, "title")) update.title = text(args.title, "title", 500, true);
  if (Object.hasOwn(args, "details")) update.details = text(args.details, "details", 10000);
  if (Object.hasOwn(args, "parent_project_id")) {
    update.parent_project_id = args.parent_project_id ? (await ownItem(userId, args.parent_project_id, "project")).id : null;
  }
  if (Object.hasOwn(args, "project_status")) {
    if (item.kind !== "project") throw new Error("ideas do not have a project status");
    update.project_status = oneOf(args.project_status, "project_status", ["active", "paused", "completed", "cancelled"]);
  }
  if (!Object.keys(update).length) throw new Error("no supported changes were supplied");
  const rows = await db(`project_items?id=eq.${item.id}&owner_user_id=eq.${userId}&select=*`, {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(update),
  });
  return { item: rows[0] };
}

async function changeKind(args: any, userId: string, direction: "promote" | "demote") {
  confirmation(args);
  const item = await ownItem(userId, args.project_item_id, direction === "promote" ? "idea" : "project");
  const update = direction === "promote"
    ? { kind: "project", project_status: "active" }
    : { kind: "idea", project_status: null };
  const rows = await db(`project_items?id=eq.${item.id}&owner_user_id=eq.${userId}&select=*`, {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(update),
  });
  return { item: rows[0] };
}

async function createAction(args: any, userId: string) {
  confirmation(args);
  if (args.due_at && args.due_on) throw new Error("due_at and due_on are mutually exclusive");
  const project = await ownItem(userId, args.project_id, "project");
  const body = {
    owner_user_id: userId,
    project_id: project.id,
    title: text(args.title, "title", 500, true),
    details: text(args.details, "details", 10000),
    due_at: timestamp(args.due_at, "due_at"),
    due_on: calendarDate(args.due_on, "due_on"),
  };
  const rows = await db("project_actions?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
  return { action: rows[0], reminder_created: Boolean(rows[0]?.reminder_id) };
}

async function updateAction(args: any, userId: string) {
  confirmation(args);
  const action = await ownAction(userId, args.action_id);
  const update: Record<string, unknown> = {};
  if (Object.hasOwn(args, "title")) update.title = text(args.title, "title", 500, true);
  if (Object.hasOwn(args, "details")) update.details = text(args.details, "details", 10000);
  if (Object.hasOwn(args, "due_at")) { update.due_at = timestamp(args.due_at, "due_at"); if (update.due_at) update.due_on = null; }
  if (Object.hasOwn(args, "due_on")) { update.due_on = calendarDate(args.due_on, "due_on"); if (update.due_on) update.due_at = null; }
  if (update.due_at && update.due_on) throw new Error("due_at and due_on are mutually exclusive");
  if (Object.hasOwn(args, "status")) update.status = oneOf(args.status, "status", ["open", "completed", "cancelled"]);
  if (Object.hasOwn(args, "project_id")) update.project_id = (await ownItem(userId, args.project_id, "project")).id;
  if (!Object.keys(update).length) throw new Error("no supported changes were supplied");
  const rows = await db(`project_actions?id=eq.${action.id}&owner_user_id=eq.${userId}&select=*`, {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(update),
  });
  return { action: rows[0], reminder_linked: Boolean(rows[0]?.reminder_id) };
}

async function addMemory(args: any, userId: string) {
  const project = await ownItem(userId, args.project_id, "project");
  const sourceType = args.source_type ? oneOf(args.source_type, "source_type", ["conversation", "check_in", "manual"]) : "conversation";
  if (sourceType === "manual") confirmation(args);
  const body = {
    owner_user_id: userId,
    project_id: project.id,
    summary: text(args.summary, "summary", 10000, true),
    source_type: sourceType,
    source_external_id: text(args.source_external_id, "source_external_id", 500),
    confidence: confidence(args.confidence),
    expires_at: timestamp(args.expires_at, "expires_at"),
  };
  const rows = await db("project_progress_memories?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
  return { memory: rows[0], notice: "Recorded project memory can be corrected or removed." };
}

async function updateMemory(args: any, userId: string) {
  confirmation(args);
  const memory = await ownMemory(userId, args.memory_id);
  const update: Record<string, unknown> = { corrected_at: new Date().toISOString() };
  if (Object.hasOwn(args, "summary")) update.summary = text(args.summary, "summary", 10000, true);
  if (Object.hasOwn(args, "confidence")) update.confidence = confidence(args.confidence);
  if (Object.hasOwn(args, "expires_at")) update.expires_at = timestamp(args.expires_at, "expires_at");
  const rows = await db(`project_progress_memories?id=eq.${memory.id}&owner_user_id=eq.${userId}&select=*`, {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(update),
  });
  return { memory: rows[0] };
}

async function deleteMemory(args: any, userId: string) {
  confirmation(args);
  const memory = await ownMemory(userId, args.memory_id);
  await db(`project_progress_memories?id=eq.${memory.id}&owner_user_id=eq.${userId}`, { method: "DELETE" });
  return { deleted: true, memory_id: memory.id };
}

const confirmed = { confirmed: { type: "boolean", const: true, description: "True only after explicit user confirmation." } };
const tools = [
  { name: "list_project_items", description: "List the authenticated user's projects and ideas. Use this before assuming an item or parent identity.", inputSchema: { type: "object", properties: { kind: { type: "string", enum: ["idea", "project"] }, project_status: { type: "string", enum: ["active", "paused", "completed", "cancelled"] }, parent_project_id: { type: "string", format: "uuid" }, query: { type: "string", maxLength: 200 }, limit: { type: "integer", minimum: 1, maximum: 100 } } } },
  { name: "get_project_context", description: "Get one project or idea with its children, actions, progress memories, and recent lifecycle events.", inputSchema: { type: "object", required: ["project_item_id"], properties: { project_item_id: { type: "string", format: "uuid" } } } },
  { name: "create_project", description: "Create an active project after explicit user confirmation. A parent creates a second-level subproject.", inputSchema: { type: "object", required: ["title", "confirmed"], properties: { title: { type: "string", maxLength: 500 }, details: { type: "string", maxLength: 10000 }, parent_project_id: { type: "string", format: "uuid" }, ...confirmed } } },
  { name: "create_idea", description: "Capture an idea at the top level or under a project after explicit user confirmation.", inputSchema: { type: "object", required: ["title", "confirmed"], properties: { title: { type: "string", maxLength: 500 }, details: { type: "string", maxLength: 10000 }, parent_project_id: { type: "string", format: "uuid" }, ...confirmed } } },
  { name: "update_project_item", description: "Update an exact project or idea after explicit user confirmation. Promotion and demotion use their dedicated tools.", inputSchema: { type: "object", required: ["project_item_id", "confirmed"], properties: { project_item_id: { type: "string", format: "uuid" }, title: { type: "string", maxLength: 500 }, details: { type: ["string", "null"], maxLength: 10000 }, parent_project_id: { type: ["string", "null"], format: "uuid" }, project_status: { type: "string", enum: ["active", "paused", "completed", "cancelled"] }, ...confirmed } } },
  { name: "promote_idea", description: "Promote an exact idea to an active project after explicit user confirmation.", inputSchema: { type: "object", required: ["project_item_id", "confirmed"], properties: { project_item_id: { type: "string", format: "uuid" }, ...confirmed } } },
  { name: "demote_project", description: "Return an exact project to the idea pipeline after explicit user confirmation. Open actions and their reminders are cancelled by the database contract.", inputSchema: { type: "object", required: ["project_item_id", "confirmed"], properties: { project_item_id: { type: "string", format: "uuid" }, ...confirmed } } },
  { name: "create_project_action", description: "Create a lightweight action under a project after explicit user confirmation. Use due_on for a day-only obligation and due_at only when an exact time matters; either creates a persisted LEF reminder.", inputSchema: { type: "object", required: ["project_id", "title", "confirmed"], properties: { project_id: { type: "string", format: "uuid" }, title: { type: "string", maxLength: 500 }, details: { type: "string", maxLength: 10000 }, due_at: { type: "string", format: "date-time" }, due_on: { type: "string", format: "date" }, ...confirmed } } },
  { name: "update_project_action", description: "Update, complete, cancel, reopen, move, or reschedule an exact project action after explicit user confirmation. Use due_on for a date-only obligation or due_at for an exact time. Its persisted reminder stays synchronized.", inputSchema: { type: "object", required: ["action_id", "confirmed"], properties: { action_id: { type: "string", format: "uuid" }, project_id: { type: "string", format: "uuid" }, title: { type: "string", maxLength: 500 }, details: { type: ["string", "null"], maxLength: 10000 }, due_at: { type: ["string", "null"], format: "date-time" }, due_on: { type: ["string", "null"], format: "date" }, status: { type: "string", enum: ["open", "completed", "cancelled"] }, ...confirmed } } },
  { name: "add_project_progress_memory", description: "Record a concise, attributable project progress memory from the current conversation or check-in. Show the user what was recorded. Manual entries require explicit confirmation.", inputSchema: { type: "object", required: ["project_id", "summary"], properties: { project_id: { type: "string", format: "uuid" }, summary: { type: "string", maxLength: 10000 }, source_type: { type: "string", enum: ["conversation", "check_in", "manual"] }, source_external_id: { type: "string", maxLength: 500 }, confidence: { type: "number", minimum: 0, maximum: 1 }, expires_at: { type: "string", format: "date-time" }, ...confirmed } } },
  { name: "update_project_progress_memory", description: "Correct an exact project progress memory after explicit user confirmation.", inputSchema: { type: "object", required: ["memory_id", "confirmed"], properties: { memory_id: { type: "string", format: "uuid" }, summary: { type: "string", maxLength: 10000 }, confidence: { type: ["number", "null"], minimum: 0, maximum: 1 }, expires_at: { type: ["string", "null"], format: "date-time" }, ...confirmed } } },
  { name: "delete_project_progress_memory", description: "Permanently remove an exact project progress memory after explicit user confirmation.", inputSchema: { type: "object", required: ["memory_id", "confirmed"], properties: { memory_id: { type: "string", format: "uuid" }, ...confirmed } } },
];

async function callTool(name: string, args: any, user: any) {
  if (name === "list_project_items") return listProjectItems(args || {}, user.id);
  if (name === "get_project_context") return getProjectContext(args || {}, user.id);
  if (name === "create_project") return createItem(args || {}, user.id, "project");
  if (name === "create_idea") return createItem(args || {}, user.id, "idea");
  if (name === "update_project_item") return updateItem(args || {}, user.id);
  if (name === "promote_idea") return changeKind(args || {}, user.id, "promote");
  if (name === "demote_project") return changeKind(args || {}, user.id, "demote");
  if (name === "create_project_action") return createAction(args || {}, user.id);
  if (name === "update_project_action") return updateAction(args || {}, user.id);
  if (name === "add_project_progress_memory") return addMemory(args || {}, user.id);
  if (name === "update_project_progress_memory") return updateMemory(args || {}, user.id);
  if (name === "delete_project_progress_memory") return deleteMemory(args || {}, user.id);
  throw new Error(`unknown tool: ${name}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/.well-known/oauth-protected-resource")) {
    return json({ resource: MCP_URL, authorization_servers: [AUTH_SERVER], scopes_supported: ["email"], bearer_methods_supported: ["header"] });
  }
  if (req.method === "GET") return json({ name: "LEF Projects MCP", status: "authentication_required", resource: MCP_URL, authorization_servers: [AUTH_SERVER], scopes_supported: ["email"], bearer_methods_supported: ["header"], resource_metadata: `${MCP_URL}/.well-known/oauth-protected-resource` });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const user = await authenticate(req);
  if (!user) return oauthChallenge();
  let body: any;
  try { body = await req.json(); } catch { return rpcError(null, -32700, "Parse error"); }
  const { id, method, params } = body || {};
  if (method === "initialize") return rpcResult(id, { protocolVersion: params?.protocolVersion || "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "lef-projects", version: "1.0.0" } });
  if (method === "notifications/initialized") return new Response(null, { status: 202, headers: cors });
  if (method === "ping") return rpcResult(id, {});
  if (method === "tools/list") return rpcResult(id, { tools });
  if (method === "tools/call") {
    try { return rpcResult(id, toolText(await callTool(params?.name, params?.arguments || {}, user))); }
    catch (error) { return rpcResult(id, toolText({ error: error instanceof Error ? error.message : String(error) }, true)); }
  }
  return rpcError(id ?? null, -32601, "Method not found");
});
