import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const MCP_URL = `${PROJECT_URL}/functions/v1/lef-unified-mcp`;
const AUTH_SERVER = `${PROJECT_URL}/auth/v1`;
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

const domains = [
  ["administration", "lef-administration-mcp"],
  ["assistant", "lef-assistant-mcp"],
  ["crm", "lef-crm-mcp"],
  ["projects", "lef-projects-mcp"],
  ["reminders", "lef-reminders-mcp"],
  ["microsoft365", "lef-microsoft365-oauth"],
] as const;

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json", ...extra } });
}
function rpcResult(id: unknown, result: unknown) { return json({ jsonrpc: "2.0", id, result }); }
function rpcError(id: unknown, code: number, message: string) { return json({ jsonrpc: "2.0", id, error: { code, message } }); }
function oauthChallenge() {
  return json({ error: "authentication_required" }, 401, {
    "www-authenticate": `Bearer resource_metadata="${MCP_URL}/.well-known/oauth-protected-resource"`,
  });
}

async function authenticate(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const response = await fetch(`${AUTH_SERVER}/user`, {
    headers: { apikey: ANON_KEY, authorization: auth },
  });
  return response.ok ? await response.json() : null;
}

function forwardedHeaders(req: Request) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  for (const name of ["authorization", "mcp-protocol-version", "mcp-session-id"]) {
    const value = req.headers.get(name);
    if (value) headers[name] = value;
  }
  return headers;
}

async function callDomain(slug: string, req: Request, body: unknown) {
  const response = await fetch(`${PROJECT_URL}/functions/v1/${slug}`, {
    method: "POST",
    headers: forwardedHeaders(req),
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${slug} returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function catalog(req: Request) {
  const requests = domains.map(async ([domain, slug], index) => {
    const response = await callDomain(slug, req, {
      jsonrpc: "2.0",
      id: `catalog-${index}`,
      method: "tools/list",
      params: {},
    });
    if (response?.error) throw new Error(`${slug}: ${response.error.message || "tool discovery failed"}`);
    return (response?.result?.tools || []).map((tool: Record<string, unknown>) => ({ domain, slug, tool }));
  });
  const entries = (await Promise.all(requests)).flat();
  const byName = new Map<string, { domain: string; slug: string; tool: Record<string, unknown> }>();
  for (const entry of entries) {
    const name = String(entry.tool.name || "");
    if (!name) throw new Error(`${entry.slug} returned a tool without a name`);
    const existing = byName.get(name);
    if (existing) throw new Error(`duplicate tool name '${name}' in ${existing.slug} and ${entry.slug}`);
    byName.set(name, entry);
  }
  return byName;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/.well-known/oauth-protected-resource")) {
    return json({ resource: MCP_URL, authorization_servers: [AUTH_SERVER], scopes_supported: ["email"], bearer_methods_supported: ["header"] });
  }
  if (req.method === "GET") {
    return json({ name: "LEF Assistant", status: "authentication_required", resource: MCP_URL, authorization_servers: [AUTH_SERVER], scopes_supported: ["email"], bearer_methods_supported: ["header"], resource_metadata: `${MCP_URL}/.well-known/oauth-protected-resource` });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!await authenticate(req)) return oauthChallenge();

  let body: any;
  try { body = await req.json(); } catch { return rpcError(null, -32700, "Parse error"); }
  const { id, method, params } = body || {};
  if (method === "initialize") return rpcResult(id, { protocolVersion: params?.protocolVersion || "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "lef-assistant-unified", version: "1.0.0" } });
  if (method === "notifications/initialized") return new Response(null, { status: 202, headers: cors });
  if (method === "ping") return rpcResult(id, {});

  try {
    const tools = await catalog(req);
    if (method === "tools/list") return rpcResult(id, { tools: [...tools.values()].map((entry) => entry.tool) });
    if (method === "tools/call") {
      const entry = tools.get(String(params?.name || ""));
      if (!entry) return rpcError(id, -32602, `Unknown LEF tool: ${String(params?.name || "")}`);
      const downstream = await callDomain(entry.slug, req, body);
      return json(downstream);
    }
    return rpcError(id ?? null, -32601, "Method not found");
  } catch (error) {
    return rpcError(id ?? null, -32603, error instanceof Error ? error.message : String(error));
  }
});
