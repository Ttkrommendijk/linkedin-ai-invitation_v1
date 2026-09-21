import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  LEF_DIAGNOSTICS_TOOL,
  safeClientMode,
  safeComparisonLabel,
  safeFingerprint,
  validateToolCatalog,
} from "../_shared/lef-mcp-observability.ts";

const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MCP_URL = `${PROJECT_URL}/functions/v1/lef-unified-mcp`;
const AUTH_SERVER = `${PROJECT_URL}/auth/v1`;
const SERVER_VERSION = "1.1.0";
const SERVER_INSTANCE_ID = crypto.randomUUID();
const SERVER_INSTRUCTIONS =
  "When the user asks to review the day, review today, review the LEF workspace, or asks what needs attention now, call start_review_session with review_type workspace_review. Treat empty continuity as no saved conversational history, never as an empty workspace. Continue with fresh owner-scoped reads from Reminders, Projects, CRM, Administration, Outlook Calendar, and Outlook Mail; identify unavailable domains instead of treating them as empty. Conduct a prioritized, fluent conversation rather than a checklist. Treat every answer as progress within the review, reflect briefly, and continue with the natural follow-up or next important thread. Progressively save the minimal structured digest. Before finalizing, summarize and ask an open-ended question such as 'Is there anything else on your mind that we should include?', then wait. Finalize only after the user explicitly indicates the whole review is finished; confirmation of one item is never whole-review confirmation. If interrupted, save progress and leave the review open. Domain facts remain authoritative in their owning services, and mutations retain their confirmation requirements. Never present conversation recollection or inference as live LEF data. Describe information as retrieved from LEF only after a successful LEF tools/call in the current turn; otherwise label it explicitly as conversation context. When access is uncertain, call lef_diagnostics.";
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, content-type, mcp-protocol-version, mcp-session-id",
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

type DiagnosticContext = {
  ownerUserId: string;
  authenticatedUserFingerprint: string;
  requestId: string;
  serverInstanceId: string;
  sessionFingerprint: string;
  protocolVersion: string | null;
  clientFingerprint: string;
  rpcMethod: string | null;
};

type CatalogEntry = {
  domain: string;
  slug: string;
  tool: Record<string, unknown>;
};
type CatalogResult = {
  byName: Map<string, CatalogEntry>;
  domainCounts: Record<string, number>;
};

class DownstreamCallError extends Error {
  constructor(
    readonly domainSlug: string,
    readonly failureKind: "http" | "rpc",
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = "DownstreamCallError";
  }
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json", ...extra },
  });
}
function rpcResult(id: unknown, result: unknown) {
  return json({ jsonrpc: "2.0", id, result });
}
function rpcError(id: unknown, code: number, message: string) {
  return json({ jsonrpc: "2.0", id, error: { code, message } });
}
function oauthChallenge() {
  return json({ error: "authentication_required" }, 401, {
    "www-authenticate":
      `Bearer resource_metadata="${MCP_URL}/.well-known/oauth-protected-resource"`,
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

async function traceContext(
  req: Request,
  user: Record<string, unknown>,
  rpcMethod: unknown,
): Promise<DiagnosticContext> {
  return {
    ownerUserId: String(user.id),
    authenticatedUserFingerprint: await safeFingerprint(
      "user",
      String(user.id),
    ),
    requestId: crypto.randomUUID(),
    serverInstanceId: SERVER_INSTANCE_ID,
    sessionFingerprint: await safeFingerprint(
      "mcp-session",
      req.headers.get("mcp-session-id"),
    ),
    protocolVersion: req.headers.get("mcp-protocol-version"),
    clientFingerprint: await safeFingerprint(
      "client",
      req.headers.get("user-agent"),
    ),
    rpcMethod: typeof rpcMethod === "string" ? rpcMethod : null,
  };
}

function diagnosticRow(
  context: DiagnosticContext,
  eventType: string,
  options: {
    toolName?: string | null;
    toolDomain?: string | null;
    success?: boolean | null;
    details?: Record<string, unknown>;
  } = {},
) {
  return {
    owner_user_id: context.ownerUserId,
    request_id: context.requestId,
    event_type: eventType,
    rpc_method: context.rpcMethod,
    tool_name: options.toolName || null,
    tool_domain: options.toolDomain || null,
    server_instance_id: context.serverInstanceId,
    session_fingerprint: context.sessionFingerprint,
    protocol_version: context.protocolVersion,
    client_fingerprint: context.clientFingerprint,
    auth_ok: true,
    success: options.success ?? null,
    details: options.details || {},
  };
}

async function recordDiagnostic(
  context: DiagnosticContext,
  eventType: string,
  options: {
    toolName?: string | null;
    toolDomain?: string | null;
    success?: boolean | null;
    details?: Record<string, unknown>;
  } = {},
) {
  const row = diagnosticRow(context, eventType, options);
  console.log(JSON.stringify({
    component: "lef-unified-mcp",
    diagnostic_event: eventType,
    request_id: row.request_id,
    server_instance_id: row.server_instance_id,
    session_fingerprint: row.session_fingerprint,
    protocol_version: row.protocol_version,
    client_fingerprint: row.client_fingerprint,
    authenticated_user_identifier: context.authenticatedUserFingerprint,
    rpc_method: row.rpc_method,
    tool_name: row.tool_name,
    tool_domain: row.tool_domain,
    success: row.success,
    details: row.details,
  }));
  try {
    const response = await fetch(
      `${PROJECT_URL}/rest/v1/assistant_mcp_diagnostic_events`,
      {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          authorization: `Bearer ${SERVICE_KEY}`,
          "content-type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(row),
      },
    );
    if (!response.ok) {
      console.error(
        JSON.stringify({
          component: "lef-unified-mcp",
          diagnostic_persistence_failed: response.status,
          request_id: context.requestId,
        }),
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        component: "lef-unified-mcp",
        diagnostic_persistence_failed: error instanceof Error
          ? error.name
          : "unknown",
        request_id: context.requestId,
      }),
    );
  }
}

async function databaseOk(userId: string) {
  const response = await fetch(
    `${PROJECT_URL}/rest/v1/assistant_check_ins?owner_user_id=eq.${
      encodeURIComponent(userId)
    }&select=id&limit=1`,
    {
      headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
    },
  );
  return response.ok;
}

async function recentDiagnostics(userId: string, requestedLimit: unknown) {
  const parsed =
    typeof requestedLimit === "number" && Number.isInteger(requestedLimit)
      ? requestedLimit
      : 20;
  const limit = Math.max(1, Math.min(50, parsed));
  const select =
    "occurred_at,request_id,event_type,rpc_method,tool_name,tool_domain,server_instance_id,session_fingerprint,protocol_version,client_fingerprint,auth_ok,success,details";
  const response = await fetch(
    `${PROJECT_URL}/rest/v1/assistant_mcp_diagnostic_events?owner_user_id=eq.${
      encodeURIComponent(userId)
    }&select=${select}&order=occurred_at.desc&limit=${limit}`,
    {
      headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
    },
  );
  if (!response.ok) return [];
  return await response.json();
}

function forwardedHeaders(req: Request) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  for (
    const name of ["authorization", "mcp-protocol-version", "mcp-session-id"]
  ) {
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
  if (!response.ok) {
    throw new DownstreamCallError(
      slug,
      "http",
      response.status,
      `${slug} returned ${response.status}: ${text.slice(0, 500)}`,
    );
  }
  return text ? JSON.parse(text) : null;
}

async function catalog(
  req: Request,
  context: DiagnosticContext,
): Promise<CatalogResult> {
  const requests = domains.map(async ([domain, slug], index) => {
    const response = await callDomain(slug, req, {
      jsonrpc: "2.0",
      id: `catalog-${index}`,
      method: "tools/list",
      params: {},
    });
    if (response?.error) {
      throw new DownstreamCallError(
        slug,
        "rpc",
        null,
        `${slug}: ${response.error.message || "tool discovery failed"}`,
      );
    }
    return (response?.result?.tools || []).map((
      tool: Record<string, unknown>,
    ) => ({ domain, slug, tool }));
  });
  const entries = (await Promise.all(requests)).flat();
  const byName = new Map<string, CatalogEntry>();
  const domainCounts: Record<string, number> = {};
  for (const entry of entries) {
    const name = String(entry.tool.name || "");
    if (!name) throw new Error(`${entry.slug} returned a tool without a name`);
    const existing = byName.get(name);
    if (existing) {
      throw new Error(
        `duplicate tool name '${name}' in ${existing.slug} and ${entry.slug}`,
      );
    }
    byName.set(name, entry);
    domainCounts[entry.domain] = (domainCounts[entry.domain] || 0) + 1;
  }
  const schemaErrors = validateToolCatalog(entries.map((entry) => entry.tool));
  if (schemaErrors.length) {
    throw new Error(
      `invalid downstream tool catalog: ${schemaErrors.slice(0, 5).join("; ")}`,
    );
  }
  await recordDiagnostic(context, "catalog", {
    success: true,
    details: {
      downstream_tool_count: byName.size,
      unified_tool_count: byName.size + 1,
      domain_counts: domainCounts,
      tool_names: [...byName.keys(), LEF_DIAGNOSTICS_TOOL.name],
      schema_envelopes_valid: true,
    },
  });
  return { byName, domainCounts };
}

function parseMcpTextResult(response: any) {
  const text = response?.result?.content?.find((item: any) =>
    item?.type === "text"
  )?.text;
  if (typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function microsoft365Capability(req: Request) {
  const response = await callDomain("lef-microsoft365-oauth", req, {
    jsonrpc: "2.0",
    id: `diagnostics-${crypto.randomUUID()}`,
    method: "tools/call",
    params: { name: "get_calendar_connection", arguments: {} },
  });
  if (response?.error) return { connected: false, scopes: [] as string[] };
  const parsed = parseMcpTextResult(response);
  const scopes = Array.isArray(parsed?.connection?.granted_scopes)
    ? parsed.connection.granted_scopes.filter((
      scope: unknown,
    ): scope is string => typeof scope === "string")
    : [];
  return { connected: parsed?.connected === true, scopes };
}

async function runDiagnostics(
  args: Record<string, unknown>,
  req: Request,
  context: DiagnosticContext,
  catalogResult: CatalogResult,
) {
  const clientMode = safeClientMode(args.client_mode);
  const comparisonLabel = safeComparisonLabel(args.comparison_label);
  const [database, microsoft365, recentEvents] = await Promise.all([
    databaseOk(context.ownerUserId),
    microsoft365Capability(req),
    recentDiagnostics(context.ownerUserId, args.recent_event_limit),
  ]);
  const normalizedScopes = microsoft365.scopes.map((scope) =>
    scope.toLowerCase()
  );
  const calendarOk = microsoft365.connected &&
    normalizedScopes.some((scope) =>
      scope === "calendars.read" || scope === "calendars.readwrite"
    );
  const mailOk = microsoft365.connected &&
    normalizedScopes.some((scope) =>
      scope === "mail.read" || scope === "mail.readwrite"
    );
  return {
    provenance: {
      source: "live_lef_unified_mcp",
      retrieved_in_this_turn: true,
      statement:
        "This result was produced by a live authenticated lef_diagnostics tool call, not conversation recollection.",
    },
    server_version: SERVER_VERSION,
    server_instance_id: context.serverInstanceId,
    request_id: context.requestId,
    connection_or_session_id: context.sessionFingerprint,
    authenticated_user_identifier: context.authenticatedUserFingerprint,
    explicit_client_mode: clientMode,
    comparison_label: comparisonLabel,
    enabled_modules: domains.map(([domain]) => domain),
    tool_count: catalogResult.byName.size + 1,
    tool_names: [...catalogResult.byName.keys(), LEF_DIAGNOSTICS_TOOL.name],
    domain_tool_counts: { ...catalogResult.domainCounts, unified_gateway: 1 },
    database_ok: database,
    outlook_mail_ok: mailOk,
    outlook_calendar_ok: calendarOk,
    outlook_probe_kind: "active_connection_and_granted_scope",
    graph_content_probe_performed: false,
    mcp_session_header_present: context.sessionFingerprint !== "not-provided",
    protocol_version_header: context.protocolVersion,
    recent_events: recentEvents,
    timestamp: new Date().toISOString(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  const url = new URL(req.url);
  if (
    req.method === "GET" &&
    url.pathname.endsWith("/.well-known/oauth-protected-resource")
  ) {
    return json({
      resource: MCP_URL,
      authorization_servers: [AUTH_SERVER],
      scopes_supported: ["email"],
      bearer_methods_supported: ["header"],
    });
  }
  if (req.method === "GET") {
    return json({
      name: "LEF Assistant",
      status: "authentication_required",
      resource: MCP_URL,
      authorization_servers: [AUTH_SERVER],
      scopes_supported: ["email"],
      bearer_methods_supported: ["header"],
      resource_metadata: `${MCP_URL}/.well-known/oauth-protected-resource`,
    });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const user = await authenticate(req);
  if (!user) {
    console.warn(JSON.stringify({
      component: "lef-unified-mcp",
      diagnostic_event: "authentication_failed",
      request_id: crypto.randomUUID(),
      server_instance_id: SERVER_INSTANCE_ID,
      session_fingerprint: await safeFingerprint(
        "mcp-session",
        req.headers.get("mcp-session-id"),
      ),
      client_fingerprint: await safeFingerprint(
        "client",
        req.headers.get("user-agent"),
      ),
      protocol_version: req.headers.get("mcp-protocol-version"),
    }));
    return oauthChallenge();
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    const context = await traceContext(req, user, null);
    await recordDiagnostic(context, "request_error", {
      success: false,
      details: { stage: "parse", error_kind: "invalid_json" },
    });
    return rpcError(null, -32700, "Parse error");
  }
  const { id, method, params } = body || {};
  const context = await traceContext(req, user, method);
  if (method === "initialize") {
    await recordDiagnostic(context, "initialize", {
      success: true,
      details: {
        requested_protocol_version: typeof params?.protocolVersion === "string"
          ? params.protocolVersion
          : null,
      },
    });
    return rpcResult(id, {
      protocolVersion: params?.protocolVersion || "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "lef-assistant-unified", version: SERVER_VERSION },
      instructions: SERVER_INSTRUCTIONS,
    });
  }
  if (method === "notifications/initialized") {
    await recordDiagnostic(context, "initialized_notification", {
      success: true,
    });
    return new Response(null, { status: 202, headers: cors });
  }
  if (method === "ping") {
    await recordDiagnostic(context, "ping", { success: true });
    return rpcResult(id, {});
  }

  try {
    if (method !== "tools/list" && method !== "tools/call") {
      return rpcError(id ?? null, -32601, "Method not found");
    }
    const catalogResult = await catalog(req, context);
    const tools = catalogResult.byName;
    if (method === "tools/list") {
      const listedTools = [...tools.values()].map((entry) => entry.tool).concat(
        [LEF_DIAGNOSTICS_TOOL],
      );
      await recordDiagnostic(context, "tools_list", {
        success: true,
        details: {
          tool_count: listedTools.length,
          tool_names: listedTools.map((tool) => tool.name),
        },
      });
      return rpcResult(id, { tools: listedTools });
    }
    if (method === "tools/call") {
      const toolName = String(params?.name || "");
      const entry = tools.get(toolName);
      const toolDomain = toolName === LEF_DIAGNOSTICS_TOOL.name
        ? "unified_gateway"
        : entry?.domain || null;
      await recordDiagnostic(context, "tools_call", {
        toolName,
        toolDomain,
        success: entry != null || toolName === LEF_DIAGNOSTICS_TOOL.name,
      });
      if (toolName === LEF_DIAGNOSTICS_TOOL.name) {
        const result = await runDiagnostics(
          params?.arguments || {},
          req,
          context,
          catalogResult,
        );
        await recordDiagnostic(context, "tool_result", {
          toolName,
          toolDomain,
          success: true,
        });
        return rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(result) }],
        });
      }
      if (!entry) {
        await recordDiagnostic(context, "tool_result", {
          toolName,
          toolDomain,
          success: false,
          details: { error_kind: "unknown_tool" },
        });
        return rpcError(id, -32602, `Unknown LEF tool: ${toolName}`);
      }
      const downstream = await callDomain(entry.slug, req, body);
      const success = !downstream?.error;
      await recordDiagnostic(context, "tool_result", {
        toolName,
        toolDomain,
        success,
        details: success ? {} : { error_kind: "downstream_rpc_error" },
      });
      return json(downstream);
    }
  } catch (error) {
    await recordDiagnostic(context, "request_error", {
      success: false,
      details: {
        error_kind: error instanceof Error ? error.name : "unknown",
        stage: method === "tools/list"
          ? "discovery"
          : "tool_routing_or_execution",
        failed_domain: error instanceof DownstreamCallError
          ? error.domainSlug
          : null,
        downstream_failure_kind: error instanceof DownstreamCallError
          ? error.failureKind
          : null,
        downstream_status: error instanceof DownstreamCallError
          ? error.status
          : null,
      },
    });
    return rpcError(
      id ?? null,
      -32603,
      error instanceof Error ? error.message : String(error),
    );
  }
});
