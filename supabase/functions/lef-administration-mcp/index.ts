import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { zipSync, strToU8 } from "npm:fflate@0.8.2";
import { extractText, getDocumentProxy } from "npm:unpdf@1.8.1";
import { creditCardSummary, parseCoraCreditCardText, type ParsedCoraCreditCardStatement } from "./cora-credit-card.ts";
import { scoreDocumentMatch } from "./matching.ts";
import { resolveLinkedPdf } from "./linked-document.ts";

const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TENANT_ID = Deno.env.get("MS_TENANT_ID")!;
const CLIENT_ID = Deno.env.get("MS_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("MS_CLIENT_SECRET")!;
const WORKSPACE_ID = "88915f72-302b-4383-80af-b16f41a84cb6";
const MCP_URL = `${PROJECT_URL}/functions/v1/lef-administration-mcp`;
const AUTH_SERVER = `${PROJECT_URL}/auth/v1`;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json", ...extra },
  });
}

function oauthChallenge() {
  return json({ error: "authentication_required" }, 401, {
    "www-authenticate": `Bearer resource_metadata="${MCP_URL}/.well-known/oauth-protected-resource"`,
  });
}

function rpcResult(id: unknown, value: unknown) {
  return json({ jsonrpc: "2.0", id, result: value });
}

function rpcError(id: unknown, code: number, message: string) {
  return json({ jsonrpc: "2.0", id, error: { code, message } });
}

function toolText(data: unknown, isError = false) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], isError };
}

function validPeriod(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new Error("period must use YYYY-MM format");
  }
  return value;
}

function safeFilename(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("filename is required");
  const clean = value.normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/^\.+/, "").trim();
  if (!clean || clean.length > 180) throw new Error("filename is invalid or too long");
  return clean;
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
  const text = await response.text();
  if (!response.ok) throw new Error(`database request failed (${response.status}): ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
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
  const rows = await db(`admin_workspaces?id=eq.${WORKSPACE_ID}&owner_user_id=eq.${user.id}&select=id,name,sharepoint_drive_id`);
  if (!rows?.length) return null;
  return { id: user.id as string, email: user.email as string, workspace: rows[0] };
}

async function graphToken() {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const response = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`Microsoft token request failed (${response.status})`);
  return (await response.json()).access_token as string;
}

async function graph(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`SharePoint request failed (${response.status}): ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function graphFileBytes(driveId: string, itemId: string, token: string) {
  const response = await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`SharePoint download failed (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

async function sha256Hex(bytes: Uint8Array) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

function decodeText(bytes: Uint8Array) {
  const ascii = new TextDecoder("windows-1252").decode(bytes.slice(0, Math.min(bytes.length, 1024)));
  const charset = /CHARSET\s*:\s*([^\r\n]+)/i.exec(ascii)?.[1]?.trim().toLowerCase() || "";
  const encoding = charset.includes("1252") || charset.includes("latin") || charset === "iso-8859-1"
    ? "windows-1252"
    : "utf-8";
  return new TextDecoder(encoding).decode(bytes).replace(/^\uFEFF/, "");
}

function xmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function tagValue(source: string, tag: string) {
  const match = new RegExp(`<${tag}\\b[^>]*>\\s*([^<\\r\\n]*)`, "i").exec(source);
  return match ? xmlEntities(match[1].trim()) : null;
}

function ofxDate(value: string | null) {
  if (!value) return null;
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return null;
  return date;
}

function decimal(value: string | null) {
  if (!value) return null;
  const normalized = value.trim().replace(/\s/g, "");
  const candidate = normalized.includes(",") && normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized.replace(/,/g, "");
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function classifyBankTransaction(type: string | null, amount: number) {
  const normalized = (type || "").toUpperCase();
  if (normalized === "FEE" || normalized === "SRVCHG") return "fee";
  if (normalized.includes("XFER")) return "transfer";
  if (normalized === "PAYMENT") return "payment";
  if (normalized === "REFUND") return "refund";
  return amount < 0 ? "expense" : amount > 0 ? "income" : "unknown";
}

type ParsedBankTransaction = {
  sourceRowKey: string;
  transactionDate: string;
  postedDate: string | null;
  description: string;
  counterpartyName: string | null;
  amount: number;
  currency: string;
  transactionKind: string;
  rawData: Record<string, unknown>;
};

type ParsedOfx = {
  bankId: string | null;
  branchId: string | null;
  accountId: string | null;
  accountType: string | null;
  currency: string;
  periodFrom: string | null;
  periodTo: string | null;
  availableBalance: number | null;
  closingBalance: number | null;
  transactions: ParsedBankTransaction[];
  warnings: string[];
};

export async function parseOfx(bytes: Uint8Array): Promise<ParsedOfx> {
  const source = decodeText(bytes);
  if (!/<OFX[\s>]/i.test(source)) throw new Error("document is not a recognizable OFX file");
  const currency = (tagValue(source, "CURDEF") || "BRL").toUpperCase();
  const blocks = source.match(/<STMTTRN\b[^>]*>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN\b|<\/BANKTRANLIST>|$)/gi) || [];
  const transactions: ParsedBankTransaction[] = [];
  const warnings: string[] = [];

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    const amount = decimal(tagValue(block, "TRNAMT"));
    const postedDate = ofxDate(tagValue(block, "DTPOSTED"));
    const userDate = ofxDate(tagValue(block, "DTUSER"));
    const transactionDate = userDate || postedDate;
    if (amount === null || !transactionDate) {
      warnings.push(`Skipped OFX transaction ${index + 1}: missing valid date or amount.`);
      continue;
    }
    const type = tagValue(block, "TRNTYPE");
    const fitId = tagValue(block, "FITID");
    const name = tagValue(block, "NAME");
    const memo = tagValue(block, "MEMO");
    const description = [name, memo].filter((value, position, values) => value && values.indexOf(value) === position).join(" — ") || type || "Bank transaction";
    const fallbackKey = await sha256Hex(new TextEncoder().encode([
      transactionDate, postedDate || "", amount.toFixed(2), type || "", name || "", memo || "",
    ].join("|")));
    transactions.push({
      sourceRowKey: fitId ? `fitid:${fitId}` : `fingerprint:${fallbackKey}`,
      transactionDate,
      postedDate,
      description,
      counterpartyName: name,
      amount,
      currency,
      transactionKind: classifyBankTransaction(type, amount),
      rawData: {
        trntype: type,
        fitid: fitId,
        name,
        memo,
        checknum: tagValue(block, "CHECKNUM"),
        refnum: tagValue(block, "REFNUM"),
      },
    });
  }
  if (!transactions.length) throw new Error("OFX contains no importable transactions");
  return {
    bankId: tagValue(source, "BANKID"),
    branchId: tagValue(source, "BRANCHID"),
    accountId: tagValue(source, "ACCTID"),
    accountType: tagValue(source, "ACCTTYPE"),
    currency,
    periodFrom: ofxDate(tagValue(source, "DTSTART")),
    periodTo: ofxDate(tagValue(source, "DTEND")),
    availableBalance: decimal(tagValue(source, "AVAILBAL")),
    closingBalance: decimal(tagValue(source, "BALAMT")),
    transactions,
    warnings,
  };
}

function parseCsvRows(source: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function csvSummary(bytes: Uint8Array) {
  const source = decodeText(bytes);
  const firstLine = source.split(/\r?\n/, 1)[0] || "";
  const delimiters = [";", ",", "\t"];
  const delimiter = delimiters.sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = parseCsvRows(source, delimiter);
  if (rows.length < 2) throw new Error("CSV contains no data rows");
  const headers = rows[0].map(normalizeText);
  const amountAliases = ["valor", "amount", "valor_lancamento", "valor_transacao", "quantia"];
  const dateAliases = ["data", "date", "data_lancamento", "data_transacao"];
  const amountIndex = headers.findIndex((header) => amountAliases.includes(header));
  const dateIndex = headers.findIndex((header) => dateAliases.includes(header));
  if (amountIndex < 0) throw new Error(`CSV amount column was not recognized; headers: ${headers.join(", ")}`);
  let count = 0;
  let total = 0;
  let debits = 0;
  let credits = 0;
  const warnings: string[] = [];
  for (let index = 1; index < rows.length; index++) {
    const amount = decimal(rows[index][amountIndex] || null);
    if (amount === null) {
      warnings.push(`Skipped CSV row ${index + 1}: invalid amount.`);
      continue;
    }
    count++;
    total += amount;
    if (amount < 0) debits += amount;
    if (amount > 0) credits += amount;
  }
  return { count, total, debits, credits, hasDateColumn: dateIndex >= 0, headers, warnings };
}

function graphPath(parts: string[]) {
  return parts.map((part) => encodeURIComponent(part)).join("/");
}

async function ensureFolder(token: string, driveId: string, parts: string[]) {
  let parent = "root";
  let item: any = null;
  const current: string[] = [];
  for (const name of parts) {
    current.push(name);
    const lookup = await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${graphPath(current)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (lookup.ok) {
      item = await lookup.json();
      parent = item.id;
      continue;
    }
    if (lookup.status !== 404) throw new Error(`SharePoint folder lookup failed (${lookup.status})`);
    item = await graph(`/drives/${driveId}/items/${parent}/children`, token, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
    });
    parent = item.id;
  }
  return item;
}

async function findMatchingSharePointFile(
  token: string,
  driveId: string,
  folderParts: string[],
  originalFilename: string,
  expectedSize: number,
  expectedDigest: string,
) {
  const folder = await ensureFolder(token, driveId, folderParts);
  const children = await graph(`/drives/${driveId}/items/${folder.id}/children?$select=id,name,size,webUrl,file&$top=200`, token);
  const candidates = (children?.value || []).filter((item: any) =>
    item.file && item.size === expectedSize &&
    (item.name === originalFilename || item.name.endsWith(`_${originalFilename}`))
  );
  for (const candidate of candidates) {
    const candidateBytes = await graphFileBytes(driveId, candidate.id, token);
    if (await sha256Hex(candidateBytes) === expectedDigest) return candidate;
  }
  return null;
}

async function ensureMonth(periodValue: unknown) {
  const period = validPeriod(periodValue);
  const [year] = period.split("-");
  let rows = await db(`admin_periods?workspace_id=eq.${WORKSPACE_ID}&period_start=eq.${period}-01&select=*`);
  let month = rows?.[0];
  if (!month) {
    rows = await db("admin_periods", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ workspace_id: WORKSPACE_ID, period_start: `${period}-01` }),
    });
    month = rows[0];
  }
  const workspace = (await db(`admin_workspaces?id=eq.${WORKSPACE_ID}&select=sharepoint_drive_id`))[0];
  const token = await graphToken();
  const root = ["Administration", year, period];
  const folder = await ensureFolder(token, workspace.sharepoint_drive_id, root);
  for (const child of ["Bank statement", "Credit card statement", "Bank expense documents", "Credit card expense documents", "Exports"]) {
    await ensureFolder(token, workspace.sharepoint_drive_id, [...root, child]);
  }
  if (month.sharepoint_folder_id !== folder.id) {
    const updated = await db(`admin_periods?id=eq.${month.id}`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ sharepoint_folder_id: folder.id, sharepoint_folder_url: folder.webUrl, updated_at: new Date().toISOString() }),
    });
    month = updated[0];
  }
  return { period: month, driveId: workspace.sharepoint_drive_id, token, root };
}

async function audit(userId: string, action: string, entityType: string, entityId?: string, after?: unknown) {
  await db("admin_audit_events", {
    method: "POST",
    body: JSON.stringify({ workspace_id: WORKSPACE_ID, actor_type: "agent", actor_user_id: userId, action, entity_type: entityType, entity_id: entityId || null, after_data: after || null }),
  });
}

async function getStatus(periodArg?: unknown) {
  const period = periodArg ? validPeriod(periodArg) : new Date().toISOString().slice(0, 7);
  const months = await db(`admin_periods?workspace_id=eq.${WORKSPACE_ID}&period_start=eq.${period}-01&select=*`);
  if (!months.length) return { period, status: "not_created", documents: 0, transactions: 0, unmatched: 0, open_issues: 0 };
  const id = months[0].id;
  const [documents, transactions, unmatched, issues] = await Promise.all([
    db(`admin_documents?period_id=eq.${id}&select=id`),
    db(`admin_transactions?period_id=eq.${id}&select=id`),
    db(`admin_transactions?period_id=eq.${id}&reconciliation_status=in.(unmatched,missing_document)&select=id`),
    db(`admin_issues?period_id=eq.${id}&status=eq.open&select=id`),
  ]);
  return { period, status: months[0].status, sharepoint_folder_url: months[0].sharepoint_folder_url, documents: documents.length, transactions: transactions.length, unmatched: unmatched.length, open_issues: issues.length };
}

async function registerEmail(args: any, userId: string) {
  if (!args.gmail_message_id || !args.sender_address || !args.received_at) throw new Error("gmail_message_id, sender_address, and received_at are required");
  let rows = await db(`admin_source_emails?workspace_id=eq.${WORKSPACE_ID}&gmail_message_id=eq.${encodeURIComponent(args.gmail_message_id)}&select=*`);
  if (rows.length) return { email: rows[0], already_registered: true };
  rows = await db("admin_source_emails", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ workspace_id: WORKSPACE_ID, gmail_message_id: args.gmail_message_id, gmail_thread_id: args.gmail_thread_id || null, sender_address: args.sender_address, sender_name: args.sender_name || null, subject: args.subject || null, received_at: args.received_at, classification: args.classification || "unclassified", metadata: args.metadata || {} }),
  });
  await audit(userId, "register_email", "source_email", rows[0].id, { gmail_message_id: args.gmail_message_id });
  return { email: rows[0], already_registered: false };
}

function decodeBase64(input: unknown) {
  if (typeof input !== "string" || !input) throw new Error("content_base64 is required");
  const normalized = input.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
  const binary = atob(normalized);
  if (binary.length > MAX_FILE_BYTES) throw new Error("file exceeds the 10 MB upload limit");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeBase64(bytes: Uint8Array) {
  let result = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(result);
}

async function storeDocument(args: any, userId: string) {
  const allowedTypes = ["bank_statement", "credit_card_statement", "supplier_invoice", "sales_invoice", "receipt", "tax_document", "payment_proof", "contract", "other"];
  if (!allowedTypes.includes(args.document_type)) throw new Error("unsupported document_type");
  const directionMap: Record<string, string> = {
    received: "incoming",
    issued: "outgoing",
    unknown: "unknown",
  };
  const direction = directionMap[args.direction || "received"];
  if (!direction) throw new Error("unsupported direction");
  const filename = safeFilename(args.filename);
  const bytes = decodeBase64(args.content_base64);
  const digest = await sha256Hex(bytes);
  const { period, driveId, token, root } = await ensureMonth(args.period);
  const folder = args.document_type === "bank_statement" ? "Bank statement"
    : args.document_type === "credit_card_statement" ? "Credit card statement"
    : args.expense_channel === "credit_card" ? "Credit card expense documents"
    : args.document_type === "sales_invoice" ? "Exports" : "Bank expense documents";
  let sourceEmailId = args.source_email_id || null;
  if (!sourceEmailId && args.email) sourceEmailId = (await registerEmail(args.email, userId)).email.id;

  // Reserve the unique digest before touching SharePoint. This makes retries and
  // concurrent calls converge on one database row and one deterministic file path.
  let rows = await db("admin_documents?on_conflict=workspace_id,sha256", {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ workspace_id: WORKSPACE_ID, source_email_id: sourceEmailId, period_id: period.id, document_type: args.document_type, direction, original_filename: filename, mime_type: args.mime_type || null, file_size_bytes: bytes.length, sha256: digest, sharepoint_drive_id: driveId, issue_date: args.issue_date || null, due_date: args.due_date || null, counterparty_name: args.counterparty_name || null, counterparty_tax_id: args.counterparty_tax_id || null, document_number: args.document_number || null, total_amount: args.total_amount ?? null, currency: args.currency || "BRL", extraction_status: "pending", extracted_data: args.extracted_data || {} }),
  });
  const createdReservation = rows.length > 0;
  if (!createdReservation) {
    rows = await db(`admin_documents?workspace_id=eq.${WORKSPACE_ID}&sha256=eq.${digest}&select=*`);
  }
  let document = rows[0];
  if (!document) throw new Error("could not reserve document upload");
  if (document.sharepoint_item_id) return { document, already_registered: true };

  const documentFilename = safeFilename(document.original_filename);
  let item = await findMatchingSharePointFile(token, driveId, [...root, folder], documentFilename, bytes.length, digest);
  const reusedExistingUpload = Boolean(item);
  if (!item) {
    const storedName = `${digest.slice(0, 16)}_${documentFilename}`;
    const path = graphPath([...root, folder, storedName]);
    item = await graph(`/drives/${driveId}/root:/${path}:/content`, token, {
      method: "PUT",
      headers: { "content-type": args.mime_type || "application/octet-stream" },
      body: bytes,
    });
  }
  rows = await db(`admin_documents?id=eq.${document.id}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      sharepoint_item_id: item.id,
      sharepoint_web_url: item.webUrl,
      extraction_status: args.extracted_data ? "extracted" : "stored",
      updated_at: new Date().toISOString(),
    }),
  });
  document = rows[0];
  await audit(userId, "store_document", "document", document.id, { filename, document_type: args.document_type, sharepoint_web_url: item.webUrl });
  return { document, already_registered: false, resumed_pending_upload: !createdReservation, reused_existing_sharepoint_file: reusedExistingUpload };
}

async function retrieveLinkedDocument(args: any, userId: string) {
  if (!["none_found", "no_usable_financial_attachment"].includes(args.attachment_check)) {
    throw new Error("attachment_check must confirm that no usable financial attachment was found");
  }
  const period = validPeriod(args.period);
  const sourceEmailId = validUuid(args.source_email_id, "source_email_id");
  const sourceEmails = await db(`admin_source_emails?id=eq.${sourceEmailId}&workspace_id=eq.${WORKSPACE_ID}&select=id,gmail_message_id`);
  if (!sourceEmails.length) throw new Error("registered source email was not found");
  const resolved = await resolveLinkedPdf(args.source_url);
  const documentNumber = typeof args.document_number === "string" && args.document_number.trim() ? args.document_number.trim() : null;
  const filename = safeFilename(args.filename || `NFSe-${documentNumber || "linked-document"}.pdf`);
  const extractedData = {
    ...(args.extracted_data || {}),
    retrieval: {
      source: "email_link",
      original_url: args.source_url,
      final_host: new URL(resolved.finalUrl).hostname,
      retrieved_at: new Date().toISOString(),
    },
  };
  const result = await storeDocument({
    period,
    document_type: args.document_type || "tax_document",
    expense_channel: args.expense_channel,
    direction: args.direction || "received",
    filename,
    mime_type: "application/pdf",
    content_base64: encodeBase64(resolved.bytes),
    issue_date: args.issue_date,
    due_date: args.due_date,
    counterparty_name: args.counterparty_name,
    counterparty_tax_id: args.counterparty_tax_id,
    document_number: documentNumber,
    total_amount: args.total_amount,
    currency: args.currency || "BRL",
    extracted_data: extractedData,
    source_email_id: sourceEmailId,
  }, userId);
  await audit(userId, "retrieve_linked_document", "document", result.document.id, {
    source_email_id: sourceEmailId,
    final_host: new URL(resolved.finalUrl).hostname,
    already_registered: result.already_registered,
  });
  return {
    ...result,
    retrieval: { status: result.already_registered ? "already_registered" : "stored", final_host: new URL(resolved.finalUrl).hostname },
  };
}

function validUuid(value: unknown, field = "id") {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${field} must be a valid UUID`);
  }
  return value;
}

async function bankStatementDocument(documentIdValue: unknown) {
  const documentId = validUuid(documentIdValue, "document_id");
  const rows = await db(`admin_documents?id=eq.${documentId}&workspace_id=eq.${WORKSPACE_ID}&document_type=eq.bank_statement&select=*`);
  const document = rows?.[0];
  if (!document) throw new Error("bank-statement document was not found");
  if (!document.sharepoint_drive_id || !document.sharepoint_item_id) throw new Error("bank-statement document is not stored in SharePoint");
  return document;
}

async function creditCardStatementDocument(documentIdValue: unknown) {
  const documentId = validUuid(documentIdValue, "document_id");
  const rows = await db(`admin_documents?id=eq.${documentId}&workspace_id=eq.${WORKSPACE_ID}&document_type=eq.credit_card_statement&select=*`);
  const document = rows?.[0];
  if (!document) throw new Error("credit-card-statement document was not found");
  if (!document.sharepoint_drive_id || !document.sharepoint_item_id) throw new Error("credit-card-statement document is not stored in SharePoint");
  return document;
}

async function loadDocumentBytes(document: any, token?: string) {
  return graphFileBytes(document.sharepoint_drive_id, document.sharepoint_item_id, token || await graphToken());
}

function rounded(value: number) {
  return Number(value.toFixed(2));
}

async function extractPdfText(bytes: Uint8Array) {
  if (bytes.length < 5 || new TextDecoder("ascii").decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new Error("document is not a recognizable PDF file");
  }
  const pdf = await getDocumentProxy(bytes, { maxImageSize: 16_777_216 });
  try {
    if (pdf.numPages > 20) throw new Error("credit-card PDF exceeds the 20-page processing limit");
    const extraction = extractText(pdf, { mergePages: true });
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("credit-card PDF text extraction timed out")), 20_000));
    const result = await Promise.race([extraction, timeout]);
    if (typeof result.text !== "string" || !result.text.trim()) throw new Error("credit-card PDF contains no machine-readable text");
    return result.text;
  } finally {
    // unpdf's serverless proxy does not expose destroy() in every runtime/build.
    // Cleanup is best-effort and must never turn a successful extraction into a failure.
    if (typeof (pdf as any).destroy === "function") await (pdf as any).destroy();
  }
}

async function parseCreditCardDocument(document: any) {
  if (!/\.pdf$/i.test(document.original_filename || "") && !/application\/pdf/i.test(document.mime_type || "")) {
    throw new Error("credit-card statement must be a PDF document");
  }
  return parseCoraCreditCardText(await extractPdfText(await loadDocumentBytes(document)));
}

async function previewCreditCardStatement(args: any) {
  const document = await creditCardStatementDocument(args.document_id);
  const parsed = await parseCreditCardDocument(document);
  const periods = await db(`admin_periods?id=eq.${document.period_id}&workspace_id=eq.${WORKSPACE_ID}&select=period_start`);
  const registeredPeriod = periods[0]?.period_start?.slice(0, 7) || null;
  return {
    document_id: document.id,
    filename: document.original_filename,
    registered_period: registeredPeriod,
    period_matches: registeredPeriod === parsed.accountingPeriod,
    ...creditCardSummary(parsed),
  };
}

async function resolveCreditCardAccount(parsed: ParsedCoraCreditCardStatement, requestedAccountId?: unknown) {
  if (requestedAccountId) {
    const accountId = validUuid(requestedAccountId, "account_id");
    const rows = await db(`admin_financial_accounts?id=eq.${accountId}&workspace_id=eq.${WORKSPACE_ID}&account_type=eq.credit_card&active=eq.true&select=*`);
    if (!rows.length) throw new Error("active credit-card account was not found in this workspace");
    return { account: rows[0], created: false };
  }
  const holderReference = (parsed.accountHolderTaxId || parsed.accountHolder || "lef-brasil").replace(/\D/g, "") || normalizeText(parsed.accountHolder || "lef-brasil");
  const reference = `cora:credit-card:${holderReference}`;
  let rows = await db(`admin_financial_accounts?workspace_id=eq.${WORKSPACE_ID}&account_reference=eq.${encodeURIComponent(reference)}&select=*`);
  if (rows.length) return { account: rows[0], created: false };
  const onlyCard = parsed.cardLastFours.length === 1 ? parsed.cardLastFours[0] : null;
  let displayName = `Cora credit card${onlyCard ? ` ••••${onlyCard}` : ""}`;
  const sameName = await db(`admin_financial_accounts?workspace_id=eq.${WORKSPACE_ID}&display_name=eq.${encodeURIComponent(displayName)}&select=id,account_reference`);
  if (sameName.length) displayName = `${displayName} ${(await sha256Hex(new TextEncoder().encode(reference))).slice(0, 6)}`;
  rows = await db("admin_financial_accounts", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      workspace_id: WORKSPACE_ID,
      account_type: "credit_card",
      institution_name: "Cora",
      display_name: displayName,
      account_reference: reference,
      last_four: onlyCard,
      currency: parsed.currency,
      active: true,
    }),
  });
  return { account: rows[0], created: true };
}

async function importCreditCardStatement(args: any, userId: string) {
  const document = await creditCardStatementDocument(args.document_id);
  const parsed = await parseCreditCardDocument(document);
  const periods = await db(`admin_periods?id=eq.${document.period_id}&workspace_id=eq.${WORKSPACE_ID}&select=period_start`);
  const registeredPeriod = periods[0]?.period_start?.slice(0, 7);
  if (!registeredPeriod) throw new Error("registered administration period was not found");
  if (parsed.accountingPeriod !== registeredPeriod) {
    throw new Error(`credit-card period ${parsed.accountingPeriod} does not match registered period ${registeredPeriod}`);
  }
  const { account, created: accountCreated } = await resolveCreditCardAccount(parsed, args.account_id);
  let statementRows = await db("admin_statements?on_conflict=document_id", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      workspace_id: WORKSPACE_ID,
      period_id: document.period_id,
      account_id: account.id,
      document_id: document.id,
      statement_type: "credit_card",
      period_from: parsed.periodFrom,
      period_to: parsed.periodTo,
      closing_date: parsed.closingDate,
      due_date: parsed.dueDate,
      opening_balance: null,
      closing_balance: null,
      declared_total: parsed.declaredTotal,
      import_status: "importing",
      source_format: "cora_pdf_v1",
      updated_at: new Date().toISOString(),
    }),
  });
  const statement = statementRows[0];
  if (!statement) throw new Error("could not create or update credit-card statement");

  try {
    const payload = parsed.transactions.map((row) => ({
      workspace_id: WORKSPACE_ID,
      period_id: document.period_id,
      statement_id: statement.id,
      account_id: account.id,
      source_row_key: row.sourceRowKey,
      transaction_date: row.transactionDate,
      posted_date: null,
      description: row.description,
      counterparty_name: row.counterpartyName,
      normalized_counterparty: normalizeText(row.counterpartyName).replace(/_/g, " "),
      amount: row.amount,
      currency: row.currency,
      transaction_kind: row.transactionKind,
      installment_number: row.installmentNumber,
      installment_count: row.installmentCount,
      reconciliation_status: "unmatched",
      raw_data: { ...row.rawData, card_last_four: row.cardLastFour },
    }));
    const inserted = await db("admin_transactions?on_conflict=statement_id,source_row_key", {
      method: "POST",
      headers: { prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(payload),
    });
    const importedAt = new Date().toISOString();
    const status = parsed.warnings.length ? "needs_review" : "imported";
    statementRows = await db(`admin_statements?id=eq.${statement.id}`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ import_status: status, imported_at: importedAt, updated_at: importedAt }),
    });
    await db(`admin_documents?id=eq.${document.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        issue_date: parsed.closingDate,
        due_date: parsed.dueDate,
        total_amount: parsed.declaredTotal,
        extraction_status: status === "imported" ? "extracted" : "needs_review",
        extracted_data: { parser: "cora-credit-card-pdf-v1", ...creditCardSummary(parsed) },
        updated_at: importedAt,
      }),
    });
    await audit(userId, "import_credit_card_statement", "statement", statement.id, {
      document_id: document.id,
      account_id: account.id,
      imported: inserted.length,
      duplicates: parsed.transactions.length - inserted.length,
      warnings: parsed.warnings,
    });
    return {
      statement: statementRows[0],
      account: { id: account.id, display_name: account.display_name, created: accountCreated },
      summary: creditCardSummary(parsed),
      imported: inserted.length,
      duplicates: parsed.transactions.length - inserted.length,
      status,
    };
  } catch (error) {
    await db(`admin_statements?id=eq.${statement.id}`, {
      method: "PATCH",
      body: JSON.stringify({ import_status: "failed", updated_at: new Date().toISOString() }),
    });
    throw error;
  }
}

async function listCreditCardTransactions(args: any) {
  const period = validPeriod(args.period);
  const periods = await db(`admin_periods?workspace_id=eq.${WORKSPACE_ID}&period_start=eq.${period}-01&select=id`);
  if (!periods.length) return { period, transactions: [], count: 0 };
  const limit = Math.min(Math.max(Number(args.limit || 100), 1), 500);
  const offset = Math.max(Number(args.offset || 0), 0);
  const statements = await db(`admin_statements?workspace_id=eq.${WORKSPACE_ID}&period_id=eq.${periods[0].id}&statement_type=eq.credit_card&select=id`);
  if (!statements.length) return { period, transactions: [], count: 0, limit, offset };
  const statementIds = statements.map((statement: any) => statement.id).join(",");
  const rows = await db(`admin_transactions?workspace_id=eq.${WORKSPACE_ID}&period_id=eq.${periods[0].id}&statement_id=in.(${statementIds})&select=id,statement_id,account_id,source_row_key,transaction_date,description,counterparty_name,amount,currency,transaction_kind,installment_number,installment_count,reconciliation_status,raw_data&order=transaction_date.asc,id.asc&limit=${limit}&offset=${offset}`);
  return { period, transactions: rows, count: rows.length, limit, offset };
}

async function periodRecord(periodValue: unknown) {
  const period = validPeriod(periodValue);
  const rows = await db(`admin_periods?workspace_id=eq.${WORKSPACE_ID}&period_start=eq.${period}-01&select=id,period_start,status`);
  return { period, record: rows[0] || null };
}

async function proposeDocumentMatches(args: any, userId: string) {
  const { period, record } = await periodRecord(args.period);
  if (!record) return { period, proposed: [], count: 0, message: "administration period was not found" };
  const minimum = args.minimum_confidence === undefined ? 0.55 : Number(args.minimum_confidence);
  if (!Number.isFinite(minimum) || minimum < 0 || minimum > 1) throw new Error("minimum_confidence must be between 0 and 1");
  const maxPerTransaction = Math.min(Math.max(Number(args.max_per_transaction || 5), 1), 10);
  const documentPeriodWindow = args.document_period_window === undefined ? 1 : Number(args.document_period_window);
  if (!Number.isInteger(documentPeriodWindow) || documentPeriodWindow < 0 || documentPeriodWindow > 3) {
    throw new Error("document_period_window must be an integer between 0 and 3");
  }
  const transactionFilter = args.transaction_id ? `&id=eq.${validUuid(args.transaction_id, "transaction_id")}` : "";
  const documentId = args.document_id ? validUuid(args.document_id, "document_id") : null;
  const allPeriods = await db(`admin_periods?workspace_id=eq.${WORKSPACE_ID}&select=id,period_start`);
  const [targetYear, targetMonth] = period.split("-").map(Number);
  const targetIndex = targetYear * 12 + targetMonth - 1;
  const eligiblePeriods = allPeriods.filter((row: any) => {
    const [year, month] = String(row.period_start).slice(0, 7).split("-").map(Number);
    return Math.abs(year * 12 + month - 1 - targetIndex) <= documentPeriodWindow;
  });
  const eligiblePeriodIds = eligiblePeriods.map((row: any) => row.id);
  const periodById = new Map(allPeriods.map((row: any) => [row.id, String(row.period_start).slice(0, 7)]));
  const documentScope = documentId
    ? `id=eq.${documentId}`
    : `period_id=in.(${eligiblePeriodIds.join(",") || "00000000-0000-0000-0000-000000000000"})`;
  const [transactions, documents, existingMatches] = await Promise.all([
    db(`admin_transactions?workspace_id=eq.${WORKSPACE_ID}&period_id=eq.${record.id}${transactionFilter}&select=id,period_id,transaction_date,description,counterparty_name,amount,currency,transaction_kind,reconciliation_status,raw_data&order=transaction_date.asc,id.asc`),
    db(`admin_documents?workspace_id=eq.${WORKSPACE_ID}&${documentScope}&direction=eq.incoming&document_type=in.(supplier_invoice,receipt,tax_document,payment_proof,other)&select=id,period_id,document_type,original_filename,issue_date,due_date,counterparty_name,document_number,total_amount,currency,extracted_data,sharepoint_web_url&order=issue_date.asc,id.asc`),
    db(`admin_document_matches?workspace_id=eq.${WORKSPACE_ID}&select=id,transaction_id,document_id,status,confidence,reasons`),
  ]);
  if (args.transaction_id && !transactions.length) throw new Error("transaction was not found in this administration period");
  if (documentId && !documents.length) throw new Error("eligible incoming document was not found in this workspace");

  const existingPairs = new Set(existingMatches.map((match: any) => `${match.transaction_id}:${match.document_id}`));
  const candidates: any[] = [];
  for (const transaction of transactions) {
    const scored = documents
      .map((document: any) => ({ transaction, document, score: scoreDocumentMatch(transaction, document) }))
      .filter((candidate: any) => candidate.score.confidence >= minimum)
      .sort((left: any, right: any) => right.score.confidence - left.score.confidence)
      .slice(0, maxPerTransaction);
    candidates.push(...scored);
  }

  const newCandidates = candidates.filter((candidate) => !existingPairs.has(`${candidate.transaction.id}:${candidate.document.id}`));
  let inserted: any[] = [];
  if (newCandidates.length) {
    inserted = await db("admin_document_matches?on_conflict=transaction_id,document_id", {
      method: "POST",
      headers: { prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(newCandidates.map((candidate) => ({
        workspace_id: WORKSPACE_ID,
        transaction_id: candidate.transaction.id,
        document_id: candidate.document.id,
        status: "proposed",
        match_method: "automatic",
        confidence: candidate.score.confidence,
        reasons: candidate.score.reasons,
      }))),
    });
    const transactionIds = [...new Set(inserted.map((match: any) => match.transaction_id))];
    if (transactionIds.length) {
      await db(`admin_transactions?id=in.(${transactionIds.join(",")})&workspace_id=eq.${WORKSPACE_ID}&reconciliation_status=eq.unmatched`, {
        method: "PATCH",
        body: JSON.stringify({ reconciliation_status: "proposed", updated_at: new Date().toISOString() }),
      });
    }
  }

  const candidateByPair = new Map(candidates.map((candidate) => [`${candidate.transaction.id}:${candidate.document.id}`, candidate]));
  const visibleMatches = await db(`admin_document_matches?workspace_id=eq.${WORKSPACE_ID}&transaction_id=in.(${transactions.map((transaction: any) => transaction.id).join(",") || "00000000-0000-0000-0000-000000000000"})&status=in.(proposed,confirmed)&select=id,transaction_id,document_id,status,match_method,confidence,reasons,decided_at&order=confidence.desc,created_at.asc`);
  const proposed = visibleMatches.map((match: any) => {
    const candidate = candidateByPair.get(`${match.transaction_id}:${match.document_id}`) as any;
    const transaction = candidate?.transaction || transactions.find((row: any) => row.id === match.transaction_id);
    const document = candidate?.document || documents.find((row: any) => row.id === match.document_id);
    return {
      ...match,
      transaction: transaction ? { id: transaction.id, period, date: transaction.transaction_date, description: transaction.description, amount: transaction.amount, currency: transaction.currency } : null,
      document: document ? { id: document.id, period: periodById.get(document.period_id) || null, type: document.document_type, filename: document.original_filename, supplier: document.counterparty_name, number: document.document_number, amount: document.total_amount, currency: document.currency } : null,
    };
  });
  await audit(userId, "propose_document_matches", "period", record.id, { period, candidates: candidates.length, inserted: inserted.length, minimum_confidence: minimum });
  return { period, proposed, count: proposed.length, newly_created: inserted.length, minimum_confidence: minimum, document_period_window: documentPeriodWindow };
}

async function decideDocumentMatch(args: any, userId: string, decision: "confirm" | "reject") {
  const transactionId = validUuid(args.transaction_id, "transaction_id");
  const documentId = validUuid(args.document_id, "document_id");
  const functionName = decision === "confirm" ? "admin_confirm_document_match" : "admin_reject_document_match";
  const result = await db(`rpc/${functionName}`, {
    method: "POST",
    body: JSON.stringify({ p_workspace_id: WORKSPACE_ID, p_transaction_id: transactionId, p_document_id: documentId, p_user_id: userId }),
  });
  await audit(userId, `${decision}_document_match`, "document_match", result?.match?.id, { transaction_id: transactionId, document_id: documentId, reconciliation_status: result?.reconciliation_status });
  return result;
}

async function listReconciliationStatus(args: any) {
  const { period, record } = await periodRecord(args.period);
  if (!record) return { period, status: "not_created", summary: { total: 0, unmatched: 0, proposed: 0, matched: 0, missing_document: 0, ignored: 0 }, transactions: [] };
  const limit = Math.min(Math.max(Number(args.limit || 200), 1), 500);
  const offset = Math.max(Number(args.offset || 0), 0);
  const transactions = await db(`admin_transactions?workspace_id=eq.${WORKSPACE_ID}&period_id=eq.${record.id}&select=id,transaction_date,description,counterparty_name,amount,currency,transaction_kind,reconciliation_status,raw_data&order=transaction_date.asc,id.asc&limit=${limit}&offset=${offset}`);
  const transactionIds = transactions.map((transaction: any) => transaction.id);
  const matches = transactionIds.length ? await db(`admin_document_matches?workspace_id=eq.${WORKSPACE_ID}&transaction_id=in.(${transactionIds.join(",")})&status=in.(proposed,confirmed)&select=id,transaction_id,document_id,status,match_method,confidence,reasons,decided_at&order=confidence.desc,created_at.asc`) : [];
  const documentIds = [...new Set(matches.map((match: any) => match.document_id))];
  const documents = documentIds.length ? await db(`admin_documents?workspace_id=eq.${WORKSPACE_ID}&id=in.(${documentIds.join(",")})&select=id,document_type,original_filename,counterparty_name,document_number,total_amount,currency,sharepoint_web_url`) : [];
  const documentById = new Map(documents.map((document: any) => [document.id, document]));
  const rows = transactions.map((transaction: any) => ({
    ...transaction,
    matches: matches.filter((match: any) => match.transaction_id === transaction.id).map((match: any) => ({ ...match, document: documentById.get(match.document_id) || null })),
  }));
  const summary = { total: transactions.length, unmatched: 0, proposed: 0, matched: 0, missing_document: 0, ignored: 0 } as Record<string, number>;
  for (const transaction of transactions) summary[transaction.reconciliation_status] = (summary[transaction.reconciliation_status] || 0) + 1;
  return { period, status: record.status, summary, transactions: rows, limit, offset };
}

function ofxSummary(parsed: ParsedOfx) {
  const debits = parsed.transactions.filter((row) => row.amount < 0).reduce((sum, row) => sum + row.amount, 0);
  const credits = parsed.transactions.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0);
  return {
    account: parsed.accountId ? `••••${parsed.accountId.slice(-4)}` : null,
    bank_id: parsed.bankId,
    account_type: parsed.accountType,
    currency: parsed.currency,
    period_from: parsed.periodFrom,
    period_to: parsed.periodTo,
    closing_balance: parsed.closingBalance,
    available_balance: parsed.availableBalance,
    transaction_count: parsed.transactions.length,
    debit_total: rounded(debits),
    credit_total: rounded(credits),
    net_total: rounded(debits + credits),
    warnings: parsed.warnings,
  };
}

async function previewBankStatement(args: any) {
  const document = await bankStatementDocument(args.document_id);
  if (!/\.ofx$/i.test(document.original_filename || "") && !/ofx/i.test(document.mime_type || "")) {
    throw new Error("preview_bank_statement currently requires an OFX document");
  }
  const parsed = await parseOfx(await loadDocumentBytes(document));
  const periods = await db(`admin_periods?id=eq.${document.period_id}&workspace_id=eq.${WORKSPACE_ID}&select=period_start`);
  return {
    document_id: document.id,
    filename: document.original_filename,
    registered_period: periods[0]?.period_start?.slice(0, 7) || null,
    ...ofxSummary(parsed),
  };
}

async function resolveBankAccount(parsed: ParsedOfx, requestedAccountId?: unknown) {
  if (requestedAccountId) {
    const accountId = validUuid(requestedAccountId, "account_id");
    const rows = await db(`admin_financial_accounts?id=eq.${accountId}&workspace_id=eq.${WORKSPACE_ID}&account_type=eq.bank&active=eq.true&select=*`);
    if (!rows.length) throw new Error("active bank account was not found in this workspace");
    return { account: rows[0], created: false };
  }
  if (!parsed.accountId) throw new Error("OFX does not identify the bank account; provide account_id");
  const reference = ["ofx", parsed.bankId || "", parsed.branchId || "", parsed.accountId].join(":");
  let rows = await db(`admin_financial_accounts?workspace_id=eq.${WORKSPACE_ID}&account_reference=eq.${encodeURIComponent(reference)}&select=*`);
  if (rows.length) return { account: rows[0], created: false };
  const lastFour = /\d{4}$/.exec(parsed.accountId)?.[0] || null;
  const institution = parsed.bankId ? `Bank ${parsed.bankId}` : "Bank";
  let displayName = `${institution} ${lastFour ? `••••${lastFour}` : parsed.accountId.slice(-8)}`;
  const sameName = await db(`admin_financial_accounts?workspace_id=eq.${WORKSPACE_ID}&display_name=eq.${encodeURIComponent(displayName)}&select=id,account_reference`);
  if (sameName.length) displayName = `${displayName} ${(await sha256Hex(new TextEncoder().encode(reference))).slice(0, 6)}`;
  rows = await db("admin_financial_accounts", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      workspace_id: WORKSPACE_ID,
      account_type: "bank",
      institution_name: institution,
      display_name: displayName,
      account_reference: reference,
      last_four: lastFour,
      currency: parsed.currency,
      active: true,
    }),
  });
  return { account: rows[0], created: true };
}

async function importBankStatement(args: any, userId: string) {
  const document = await bankStatementDocument(args.document_id);
  if (!/\.ofx$/i.test(document.original_filename || "") && !/ofx/i.test(document.mime_type || "")) {
    throw new Error("import_bank_statement currently requires an OFX document");
  }
  const parsed = await parseOfx(await loadDocumentBytes(document));
  const periods = await db(`admin_periods?id=eq.${document.period_id}&workspace_id=eq.${WORKSPACE_ID}&select=period_start`);
  const registeredPeriod = periods[0]?.period_start?.slice(0, 7);
  if (!registeredPeriod) throw new Error("registered administration period was not found");
  const sourcePeriod = parsed.periodFrom?.slice(0, 7) || parsed.transactions[0]?.transactionDate.slice(0, 7);
  if (sourcePeriod !== registeredPeriod) {
    throw new Error(`OFX period ${sourcePeriod || "unknown"} does not match registered period ${registeredPeriod}`);
  }
  const { account, created: accountCreated } = await resolveBankAccount(parsed, args.account_id);
  let statementRows = await db("admin_statements?on_conflict=document_id", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      workspace_id: WORKSPACE_ID,
      period_id: document.period_id,
      account_id: account.id,
      document_id: document.id,
      statement_type: "bank",
      period_from: parsed.periodFrom,
      period_to: parsed.periodTo,
      opening_balance: null,
      closing_balance: parsed.closingBalance,
      declared_total: rounded(parsed.transactions.reduce((sum, row) => sum + row.amount, 0)),
      import_status: "importing",
      source_format: "ofx",
      updated_at: new Date().toISOString(),
    }),
  });
  const statement = statementRows[0];
  if (!statement) throw new Error("could not create or update bank statement");

  try {
    const payload = parsed.transactions.map((row) => ({
      workspace_id: WORKSPACE_ID,
      period_id: document.period_id,
      statement_id: statement.id,
      account_id: account.id,
      source_row_key: row.sourceRowKey,
      transaction_date: row.transactionDate,
      posted_date: row.postedDate,
      description: row.description,
      counterparty_name: row.counterpartyName,
      normalized_counterparty: row.counterpartyName ? normalizeText(row.counterpartyName).replace(/_/g, " ") : null,
      amount: row.amount,
      currency: row.currency,
      transaction_kind: row.transactionKind,
      reconciliation_status: "unmatched",
      raw_data: row.rawData,
    }));
    const inserted = await db("admin_transactions?on_conflict=statement_id,source_row_key", {
      method: "POST",
      headers: { prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(payload),
    });
    const importedAt = new Date().toISOString();
    statementRows = await db(`admin_statements?id=eq.${statement.id}`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ import_status: parsed.warnings.length ? "needs_review" : "imported", imported_at: importedAt, updated_at: importedAt }),
    });
    await db(`admin_documents?id=eq.${document.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        extraction_status: parsed.warnings.length ? "needs_review" : "extracted",
        extracted_data: { parser: "ofx-v1", ...ofxSummary(parsed) },
        updated_at: importedAt,
      }),
    });
    await audit(userId, "import_bank_statement", "statement", statement.id, {
      document_id: document.id,
      account_id: account.id,
      imported: inserted.length,
      duplicates: parsed.transactions.length - inserted.length,
      warnings: parsed.warnings,
    });
    return {
      statement: statementRows[0],
      account: { id: account.id, display_name: account.display_name, created: accountCreated },
      summary: ofxSummary(parsed),
      imported: inserted.length,
      duplicates: parsed.transactions.length - inserted.length,
      status: parsed.warnings.length ? "needs_review" : "imported",
    };
  } catch (error) {
    await db(`admin_statements?id=eq.${statement.id}`, {
      method: "PATCH",
      body: JSON.stringify({ import_status: "failed", updated_at: new Date().toISOString() }),
    });
    throw error;
  }
}

async function listBankTransactions(args: any) {
  const period = validPeriod(args.period);
  const periods = await db(`admin_periods?workspace_id=eq.${WORKSPACE_ID}&period_start=eq.${period}-01&select=id`);
  if (!periods.length) return { period, transactions: [], count: 0 };
  const limit = Math.min(Math.max(Number(args.limit || 100), 1), 500);
  const offset = Math.max(Number(args.offset || 0), 0);
  const rows = await db(`admin_transactions?workspace_id=eq.${WORKSPACE_ID}&period_id=eq.${periods[0].id}&select=id,statement_id,account_id,source_row_key,transaction_date,posted_date,description,counterparty_name,amount,currency,transaction_kind,reconciliation_status&order=transaction_date.asc,id.asc&limit=${limit}&offset=${offset}`);
  return { period, transactions: rows, count: rows.length, limit, offset };
}

async function compareStatementSources(args: any) {
  const ofxDocument = await bankStatementDocument(args.ofx_document_id);
  const csvDocument = await bankStatementDocument(args.csv_document_id);
  if (!/\.ofx$/i.test(ofxDocument.original_filename || "")) throw new Error("ofx_document_id must identify an OFX file");
  if (!/\.csv$/i.test(csvDocument.original_filename || "")) throw new Error("csv_document_id must identify a CSV file");
  if (ofxDocument.period_id !== csvDocument.period_id) throw new Error("OFX and CSV documents belong to different administration periods");
  const token = await graphToken();
  const [ofxBytes, csvBytes] = await Promise.all([
    loadDocumentBytes(ofxDocument, token),
    loadDocumentBytes(csvDocument, token),
  ]);
  const [ofx, csv] = await Promise.all([parseOfx(ofxBytes), Promise.resolve(csvSummary(csvBytes))]);
  const ofxTotals = ofxSummary(ofx);
  return {
    ofx: { document_id: ofxDocument.id, filename: ofxDocument.original_filename, count: ofxTotals.transaction_count, total: ofxTotals.net_total },
    csv: { document_id: csvDocument.id, filename: csvDocument.original_filename, count: csv.count, total: rounded(csv.total), warnings: csv.warnings },
    comparison: {
      count_difference: ofxTotals.transaction_count - csv.count,
      total_difference: rounded(ofxTotals.net_total - csv.total),
      matches: ofxTotals.transaction_count === csv.count && Math.abs(ofxTotals.net_total - csv.total) < 0.01,
    },
  };
}

async function saveSenderRule(args: any, userId: string) {
  if (!args.sender_pattern || !["process", "ignore", "review"].includes(args.action)) throw new Error("sender_pattern and a valid action are required");
  const rows = await db("admin_sender_rules", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ workspace_id: WORKSPACE_ID, sender_pattern: args.sender_pattern, subject_pattern: args.subject_pattern || null, action: args.action, document_type: args.document_type || null, priority: args.priority ?? 100, notes: args.notes || null, created_by: userId }),
  });
  await audit(userId, "save_sender_rule", "sender_rule", rows[0].id, rows[0]);
  return rows[0];
}

async function retrieveDocumentContent(args: any, userId: string) {
  const documentId = typeof args?.document_id === "string" ? args.document_id.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(documentId)) {
    throw new Error("document_id must be a valid UUID");
  }

  const rows = await db(
    `admin_documents?id=eq.${documentId}&workspace_id=eq.${WORKSPACE_ID}&select=id,period_id,document_type,direction,original_filename,mime_type,file_size_bytes,sha256,sharepoint_drive_id,sharepoint_item_id,sharepoint_web_url,document_number,issue_date,total_amount,currency`
  );
  if (!rows?.length) throw new Error("document not found in this workspace");

  const document = rows[0];
  if (!document.sharepoint_drive_id || !document.sharepoint_item_id) {
    throw new Error("document has no registered SharePoint file");
  }
  if (Number(document.file_size_bytes || 0) > MAX_FILE_BYTES) {
    throw new Error("document exceeds the 10 MB delivery limit");
  }

  const token = await graphToken();
  const bytes = await graphFileBytes(document.sharepoint_drive_id, document.sharepoint_item_id, token);
  if (bytes.length > MAX_FILE_BYTES) throw new Error("document exceeds the 10 MB delivery limit");
  if (document.file_size_bytes !== null && Number(document.file_size_bytes) !== bytes.length) {
    throw new Error("SharePoint file size does not match the registered document");
  }

  const digest = await sha256Hex(bytes);
  if (document.sha256 && digest !== document.sha256) {
    throw new Error("SharePoint file digest does not match the registered document");
  }

  await audit(userId, "retrieve_document_content", "document", document.id, {
    filename: document.original_filename,
    file_size_bytes: bytes.length,
    sha256_verified: Boolean(document.sha256),
  });

  return {
    document_id: document.id,
    period_id: document.period_id,
    document_type: document.document_type,
    direction: document.direction,
    filename: document.original_filename,
    mime_type: document.mime_type || "application/octet-stream",
    file_size_bytes: bytes.length,
    sha256: digest,
    sharepoint_web_url: document.sharepoint_web_url,
    document_number: document.document_number,
    issue_date: document.issue_date,
    total_amount: document.total_amount,
    currency: document.currency,
    content_base64: encodeBase64(bytes),
  };
}

function spreadsheetCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function spreadsheetAmount(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error("transaction amount is invalid");
  return number.toFixed(2).replace(".", ",");
}

async function paymentsReceiptsReport(periodValue: unknown) {
  const period = validPeriod(periodValue);
  const periodRows = await db(`admin_periods?workspace_id=eq.${WORKSPACE_ID}&period_start=eq.${period}-01&select=id`);
  if (!periodRows.length) throw new Error(`administration period ${period} does not exist`);
  const periodId = periodRows[0].id;
  const statements = await db(`admin_statements?workspace_id=eq.${WORKSPACE_ID}&period_id=eq.${periodId}&statement_type=eq.bank&select=id`);
  const statementIds = (statements || []).map((statement: any) => statement.id);
  if (!statementIds.length) throw new Error(`no imported bank statement was found for ${period}`);
  const transactions = await db(`admin_transactions?workspace_id=eq.${WORKSPACE_ID}&period_id=eq.${periodId}&statement_id=in.(${statementIds.join(",")})&select=id,transaction_date,posted_date,description,counterparty_name,amount,currency,transaction_kind,reconciliation_status&order=transaction_date.asc,id.asc`);
  if (!transactions.length) throw new Error(`the bank statement for ${period} has no imported transactions`);
  if (transactions.length > 5000) throw new Error("report exceeds the 5,000 transaction safety limit");
  const transactionIds = transactions.map((transaction: any) => transaction.id);
  const matches = await db(`admin_document_matches?workspace_id=eq.${WORKSPACE_ID}&transaction_id=in.(${transactionIds.join(",")})&status=eq.confirmed&select=transaction_id,document_id&order=created_at.asc`);
  const documentIds = [...new Set((matches || []).map((match: any) => match.document_id))];
  const documents = documentIds.length
    ? await db(`admin_documents?workspace_id=eq.${WORKSPACE_ID}&id=in.(${documentIds.join(",")})&select=id,document_number,original_filename,document_type,direction,sha256`)
    : [];
  const documentById = new Map((documents || []).map((document: any) => [document.id, document]));
  const rows = transactions.map((transaction: any) => {
    const confirmedDocuments = (matches || [])
      .filter((match: any) => match.transaction_id === transaction.id)
      .map((match: any) => documentById.get(match.document_id))
      .filter(Boolean)
      .sort((left: any, right: any) => String(left.id).localeCompare(String(right.id)));
    return {
      date: transaction.transaction_date,
      posted_date: transaction.posted_date || "",
      description: transaction.description,
      counterparty: transaction.counterparty_name || "",
      direction: Number(transaction.amount) < 0 ? "payment" : Number(transaction.amount) > 0 ? "receipt" : "neutral",
      amount: Number(transaction.amount),
      currency: transaction.currency,
      transaction_kind: transaction.transaction_kind,
      bank_transaction_id: transaction.id,
      reconciliation_status: transaction.reconciliation_status,
      document_count: confirmedDocuments.length,
      document_references: confirmedDocuments.map((document: any) => document.document_number || document.original_filename).join(" | "),
      document_filenames: confirmedDocuments.map((document: any) => document.original_filename).join(" | "),
      document_ids: confirmedDocuments.map((document: any) => document.id).join(" | "),
      notes: confirmedDocuments.length ? "" : "No confirmed supporting document",
      documents: confirmedDocuments.map((document: any) => ({ id: document.id, number: document.document_number, filename: document.original_filename, type: document.document_type, direction: document.direction, sha256: document.sha256 })),
    };
  });
  const snapshot = rows.map(({ documents, ...row }: any) => ({ ...row, documents }));
  const snapshotSha256 = await sha256Hex(new TextEncoder().encode(JSON.stringify(snapshot)));
  const header = ["date", "posted_date", "description", "counterparty", "direction", "amount", "currency", "transaction_kind", "bank_transaction_id", "reconciliation_status", "document_count", "document_references", "document_filenames", "document_ids", "notes"];
  const csvRows = rows.map((row: any) => [row.date, row.posted_date, row.description, row.counterparty, row.direction, spreadsheetAmount(row.amount), row.currency, row.transaction_kind, row.bank_transaction_id, row.reconciliation_status, row.document_count, row.document_references, row.document_filenames, row.document_ids, row.notes]);
  const csv = "\uFEFF" + [header, ...csvRows].map((row) => row.map(spreadsheetCell).join(";")).join("\r\n") + "\r\n";
  const bytes = new TextEncoder().encode(csv);
  return {
    period,
    periodId,
    rows,
    bytes,
    sha256: await sha256Hex(bytes),
    snapshot_sha256: snapshotSha256,
    summary: {
      transactions: rows.length,
      payments: rows.filter((row: any) => row.direction === "payment").length,
      receipts: rows.filter((row: any) => row.direction === "receipt").length,
      with_confirmed_documents: rows.filter((row: any) => row.document_count > 0).length,
      without_confirmed_documents: rows.filter((row: any) => row.document_count === 0).length,
    },
  };
}

async function previewPaymentsReceiptsCsv(args: any) {
  const report = await paymentsReceiptsReport(args?.period);
  return { period: report.period, summary: report.summary, snapshot_sha256: report.snapshot_sha256, sample: report.rows.slice(0, 10).map(({ documents, ...row }: any) => row), write_performed: false };
}

async function generatePaymentsReceiptsCsv(args: any, userId: string) {
  const report = await paymentsReceiptsReport(args?.period);
  let documents = await db(`admin_documents?workspace_id=eq.${WORKSPACE_ID}&sha256=eq.${report.sha256}&select=*`);
  let document = documents?.[0];
  if (document?.sharepoint_item_id) {
    await audit(userId, "generate_payments_receipts_csv", "document", document.id, { period: report.period, reused: true, snapshot_sha256: report.snapshot_sha256 });
    return { document, summary: report.summary, snapshot_sha256: report.snapshot_sha256, already_registered: true };
  }
  const { driveId, token, root } = await ensureMonth(report.period);
  const filename = safeFilename(`payments-and-receipts-${report.period}-${report.sha256.slice(0, 8)}.csv`);
  if (!document) {
    document = (await db("admin_documents?on_conflict=workspace_id,sha256", {
      method: "POST",
      headers: { prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({
        workspace_id: WORKSPACE_ID,
        period_id: report.periodId,
        document_type: "other",
        direction: "unknown",
        original_filename: filename,
        mime_type: "text/csv",
        file_size_bytes: report.bytes.length,
        sha256: report.sha256,
        sharepoint_drive_id: driveId,
        currency: "BRL",
        extraction_status: "stored",
        extracted_data: { generated_report: { type: "payments_receipts_spreadsheet", period: report.period, snapshot_sha256: report.snapshot_sha256, format_version: 1, delimiter: ";", encoding: "UTF-8-BOM", summary: report.summary } },
      }),
    }))?.[0];
    if (!document) document = (await db(`admin_documents?workspace_id=eq.${WORKSPACE_ID}&sha256=eq.${report.sha256}&select=*`))?.[0];
  }
  if (!document) throw new Error("could not reserve the generated CSV document");
  const existing = await findMatchingSharePointFile(token, driveId, root, filename, report.bytes.length, report.sha256);
  const item = existing || await graph(`/drives/${driveId}/root:/${graphPath([...root, filename])}:/content`, token, { method: "PUT", headers: { "content-type": "text/csv; charset=utf-8" }, body: report.bytes });
  document = (await db(`admin_documents?id=eq.${document.id}&workspace_id=eq.${WORKSPACE_ID}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ sharepoint_item_id: item.id, sharepoint_web_url: item.webUrl, extraction_status: "stored", updated_at: new Date().toISOString() }),
  }))?.[0];
  await audit(userId, "generate_payments_receipts_csv", "document", document.id, { period: report.period, reused_sharepoint_file: Boolean(existing), snapshot_sha256: report.snapshot_sha256, summary: report.summary });
  return { document, summary: report.summary, snapshot_sha256: report.snapshot_sha256, already_registered: false, reused_existing_sharepoint_file: Boolean(existing) };
}

async function assertCurrentPaymentsReceiptsCsv(document: any, period: string) {
  const metadata = document?.extracted_data?.generated_report;
  if (metadata?.type !== "payments_receipts_spreadsheet" || metadata?.period !== period || !metadata?.snapshot_sha256) {
    throw new Error("payments_receipts_spreadsheet must use a CSV generated by this MCP for the requested period");
  }
  const current = await paymentsReceiptsReport(period);
  if (current.snapshot_sha256 !== metadata.snapshot_sha256) {
    throw new Error("payments and receipts CSV is stale because transactions or confirmed document matches changed; generate it again before creating the Gestta package");
  }
}


type GesttaRequestKind = "accounting" | "fiscal";

const GESTTA_CATEGORIES: Record<GesttaRequestKind, Record<string, string>> = {
  accounting: {
    accounting_other: "Outros arquivos que não foram listados anteriormente",
    tax_payment_proofs: "Comprovantes de pagamentos de impostos",
    payments_receipts_spreadsheet: "Planilha com identificação dos pagamentos e recebimentos",
    bank_statement: "Extrato bancário no formato pdf ou excel (conta corrente)",
    financial_investments: "Aplicação financeira",
    rental_contract: "Contrato de locação",
    rent_receipt: "Recibo de aluguel",
  },
  fiscal: {
    sales_invoices: "Notas Fiscais de Venda (NF-e / NFC-e / NFS-e)",
    fiscal_receipts: "Cupons Fiscais (se houver PDV/ECF)",
    service_invoices_received: "Notas de Serviços Tomados",
    purchase_invoices: "Notas Fiscais de Compras",
    returns_cancellations: "Notas de Devolução ou Cancelamentos",
    fiscal_other: "Outros arquivos que não foram listados anteriormente",
  },
};

function gesttaKind(value: unknown): GesttaRequestKind {
  if (value !== "accounting" && value !== "fiscal") throw new Error("request_kind must be accounting or fiscal");
  return value;
}

async function parseGesttaRequest(value: unknown, kindValue: unknown) {
  if (typeof value !== "string" || value.length > 2500) throw new Error("request_url is required or too long");
  const kind = gesttaKind(kindValue);
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("request_url is invalid"); }
  if (url.protocol !== "https:" || url.hostname !== "app.gestta.com.br" || url.pathname !== "/lonely-pages/") {
    throw new Error("request_url must use the approved Gestta upload page");
  }
  const marker = "#/document-request/file-upload?";
  if (!url.hash.startsWith(marker)) throw new Error("request_url is not a Gestta document-request upload link");
  const encoded = new URLSearchParams(url.hash.slice(marker.length)).get("options");
  if (!encoded || encoded.length > 1500) throw new Error("Gestta request options are missing or invalid");
  let options: any;
  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    options = JSON.parse(atob(padded));
  } catch {
    throw new Error("Gestta request options could not be decoded");
  }
  for (const key of ["customerTaskId", "customerUserId", "documentRequestHash"]) {
    if (typeof options?.[key] !== "string" || !/^[A-Za-z0-9-]{8,200}$/.test(options[key])) {
      throw new Error(`Gestta request option ${key} is invalid`);
    }
  }
  return {
    request_kind: kind,
    external_task_id: options.customerTaskId as string,
    request_url: value,
    request_url_sha256: await sha256Hex(new TextEncoder().encode(value)),
  };
}

async function gesttaPeriodRecord(periodValue: unknown) {
  const period = validPeriod(periodValue);
  const rows = await db(`admin_periods?workspace_id=eq.${WORKSPACE_ID}&period_start=eq.${period}-01&select=*`);
  if (!rows?.length) throw new Error(`administration period ${period} does not exist`);
  return { period, row: rows[0] };
}

function gesttaDocumentSuggestion(document: any) {
  if (document?.extracted_data?.generated_report?.type === "payments_receipts_spreadsheet") {
    return { request_kind: "accounting", category_code: "payments_receipts_spreadsheet", confidence: "high", reason: "MCP-generated bank payments and receipts reconciliation CSV." };
  }
  if (document.document_type === "sales_invoice" && document.direction === "outgoing") {
    return { request_kind: "fiscal", category_code: "sales_invoices", confidence: "high", reason: "Outgoing sales invoice." };
  }
  const spreadsheetMime = ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
  if (document.document_type === "bank_statement" && (document.mime_type === "application/pdf" || spreadsheetMime.includes(document.mime_type))) {
    return { request_kind: "accounting", category_code: "bank_statement", confidence: "high", reason: "Bank statement in a Gestta-supported PDF or spreadsheet format." };
  }
  return null;
}

async function previewGesttaDelivery(args: any) {
  const { period, row: periodRow } = await gesttaPeriodRecord(args?.period);
  if (!Array.isArray(args?.requests) || !args.requests.length || args.requests.length > 2) throw new Error("requests must contain one or two Gestta request links");
  const parsedRequests = await Promise.all(args.requests.map((item: any) => parseGesttaRequest(item?.request_url, item?.request_kind)));
  if (new Set(parsedRequests.map((item) => item.request_kind)).size !== parsedRequests.length) throw new Error("only one Gestta request per request_kind is allowed");

  const documents = await db(`admin_documents?workspace_id=eq.${WORKSPACE_ID}&period_id=eq.${periodRow.id}&select=id,document_type,direction,original_filename,mime_type,file_size_bytes,issue_date,document_number,total_amount,currency,sharepoint_item_id,extracted_data&order=created_at.asc`);
  const externalIds = parsedRequests.map((item) => item.external_task_id);
  const knownRequests = await db(`admin_delivery_requests?workspace_id=eq.${WORKSPACE_ID}&provider=eq.gestta&external_task_id=in.(${externalIds.join(",")})&select=id,request_kind,external_task_id,status`);
  const knownRequestIds = (knownRequests || []).map((item: any) => item.id);
  const existingActions = knownRequestIds.length
    ? await db(`admin_delivery_actions?workspace_id=eq.${WORKSPACE_ID}&request_id=in.(${knownRequestIds.join(",")})&select=id,request_id,document_id,category_code,category_label,action_type,status,attempt_count,completed_at,confirmation`)
    : [];
  const requestIdByExternal = new Map((knownRequests || []).map((item: any) => [item.external_task_id, item.id]));
  const suggestions: any[] = [];
  const needsReview: any[] = [];
  for (const document of documents || []) {
    const suggestion = gesttaDocumentSuggestion(document);
    if (suggestion && parsedRequests.some((request) => request.request_kind === suggestion.request_kind)) {
      const request = parsedRequests.find((item) => item.request_kind === suggestion.request_kind)!;
      const requestId = requestIdByExternal.get(request.external_task_id);
      const existing = (existingActions || []).find((action: any) => requestId && action.request_id === requestId && action.document_id === document.id && action.category_code === suggestion.category_code && action.status !== "cancelled");
      suggestions.push({ document, ...suggestion, category_label: GESTTA_CATEGORIES[suggestion.request_kind as GesttaRequestKind][suggestion.category_code], existing_delivery: existing || null });
    } else {
      needsReview.push({ document, reason: "No safe automatic Gestta category mapping is available." });
    }
  }
  const categoryStatus = parsedRequests.map((request) => {
    const requestId = requestIdByExternal.get(request.external_task_id);
    return {
      request_kind: request.request_kind,
      external_task_id: request.external_task_id,
      categories: Object.entries(GESTTA_CATEGORIES[request.request_kind]).map(([category_code, category_label]) => ({
        category_code,
        category_label,
        existing_actions: (existingActions || []).filter((action: any) => requestId && action.request_id === requestId && action.category_code === category_code && action.status !== "cancelled"),
      })),
    };
  });
  return {
    period,
    requests: parsedRequests.map(({ request_url, ...safe }) => safe),
    suggested_uploads: suggestions,
    documents_requiring_review: needsReview,
    category_status: categoryStatus,
    rules: {
      all_categories_must_be_resolved_before_approval: true,
      not_applicable_is_never_inferred_from_missing_documents: true,
      interrupted_or_failed_actions_require_remote_verification_before_retry: true,
    },
  };
}

async function upsertGesttaRequests(parsedRequests: any[], periodRow: any, sourceEmailId?: string | null) {
  const rows: any[] = [];
  for (const request of parsedRequests) {
    const result = await db("admin_delivery_requests?on_conflict=workspace_id,provider,external_task_id", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        workspace_id: WORKSPACE_ID,
        period_id: periodRow.id,
        source_email_id: sourceEmailId || null,
        provider: "gestta",
        request_kind: request.request_kind,
        external_task_id: request.external_task_id,
        request_url: request.request_url,
        request_url_sha256: request.request_url_sha256,
        task_name: request.request_kind === "fiscal" ? "Cobrança Documentos - Fiscal" : "Cobrança Documentos - Contábil",
        competence: periodRow.period_start.slice(0, 7),
        status: "open",
        updated_at: new Date().toISOString(),
      }),
    });
    rows.push(result[0]);
  }
  return rows;
}

async function createGesttaPackage(args: any, userId: string) {
  const { period, row: periodRow } = await gesttaPeriodRecord(args?.period);
  if (!Array.isArray(args?.requests) || !args.requests.length || args.requests.length > 2) throw new Error("requests must contain one or two Gestta request links");
  if (!Array.isArray(args?.actions) || !args.actions.length || args.actions.length > 100) throw new Error("actions must contain the reviewed Gestta category decisions");
  const parsedRequests = await Promise.all(args.requests.map((item: any) => parseGesttaRequest(item?.request_url, item?.request_kind)));
  if (new Set(parsedRequests.map((item) => item.request_kind)).size !== parsedRequests.length) throw new Error("only one Gestta request per request_kind is allowed");
  const sourceEmailId = args?.source_email_id ? validUuid(args.source_email_id, "source_email_id") : null;
  if (sourceEmailId) {
    const emailRows = await db(`admin_source_emails?id=eq.${sourceEmailId}&workspace_id=eq.${WORKSPACE_ID}&select=id`);
    if (!emailRows?.length) throw new Error("source_email_id was not found in this workspace");
  }

  const requestRows = await upsertGesttaRequests(parsedRequests, periodRow, sourceEmailId);
  const requestByKind = new Map(requestRows.map((row: any) => [row.request_kind, row]));
  const documents = await db(`admin_documents?workspace_id=eq.${WORKSPACE_ID}&select=id,period_id,document_type,direction,original_filename,mime_type,file_size_bytes,sha256,sharepoint_drive_id,sharepoint_item_id,extracted_data`);
  const documentById = new Map((documents || []).map((document: any) => [document.id, document]));

  let packageRows = await db(`admin_packages?workspace_id=eq.${WORKSPACE_ID}&period_id=eq.${periodRow.id}&select=*`);
  let packageRow = packageRows?.[0];
  if (packageRow && ["approved", "sent"].includes(packageRow.status)) throw new Error("the existing monthly package is already approved or sent and cannot be replaced");
  if (!packageRow) {
    packageRows = await db("admin_packages", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify({ workspace_id: WORKSPACE_ID, period_id: periodRow.id, status: "draft", contents: {} }) });
    packageRow = packageRows[0];
  }

  const normalizedActions: any[] = [];
  const inputKeys = new Set<string>();
  for (const input of args.actions) {
    const requestKind = gesttaKind(input?.request_kind);
    const request = requestByKind.get(requestKind);
    if (!request) throw new Error(`no ${requestKind} request link was supplied`);
    const categoryCode = typeof input?.category_code === "string" ? input.category_code : "";
    const categoryLabel = GESTTA_CATEGORIES[requestKind][categoryCode];
    if (!categoryLabel) throw new Error(`unsupported ${requestKind} Gestta category: ${categoryCode}`);
    const actionType = input?.action_type;
    if (actionType !== "upload" && actionType !== "not_applicable") throw new Error("action_type must be upload or not_applicable");
    let documentId: string | null = null;
    let document: any = null;
    if (actionType === "upload") {
      documentId = validUuid(input?.document_id, "document_id");
      document = documentById.get(documentId);
      if (!document) throw new Error(`document ${documentId} was not found in this workspace`);
      if (document.period_id !== periodRow.id) {
        const matches = await db(`admin_document_matches?workspace_id=eq.${WORKSPACE_ID}&document_id=eq.${documentId}&status=eq.confirmed&select=transaction_id`);
        const transactionIds = (matches || []).map((match: any) => validUuid(match.transaction_id, "transaction_id"));
        if (!transactionIds.length) {
          throw new Error(`document ${documentId} belongs to another period and has no confirmed transaction match`);
        }
        const linkedTransactions = await db(`admin_transactions?workspace_id=eq.${WORKSPACE_ID}&period_id=eq.${periodRow.id}&id=in.(${transactionIds.join(",")})&select=id`);
        if (!linkedTransactions?.length) {
          throw new Error(`document ${documentId} belongs to another period and is not confirmed against a transaction in ${period}`);
        }
      }
      if (!document.sharepoint_drive_id || !document.sharepoint_item_id || !document.sha256) throw new Error(`document ${documentId} is not ready for delivery`);
      if (requestKind === "accounting" && categoryCode === "payments_receipts_spreadsheet") {
        await assertCurrentPaymentsReceiptsCsv(document, period);
      }
    } else if (input?.document_id) {
      throw new Error("not_applicable actions cannot include a document_id");
    }
    const idempotencyKey = await sha256Hex(new TextEncoder().encode(["gestta", request.external_task_id, categoryCode, actionType, documentId || "none"].join("|")));
    if (inputKeys.has(idempotencyKey)) throw new Error("duplicate Gestta delivery action");
    inputKeys.add(idempotencyKey);
    normalizedActions.push({ workspace_id: WORKSPACE_ID, period_id: periodRow.id, package_id: packageRow.id, request_id: request.id, document_id: documentId, category_code: categoryCode, category_label: categoryLabel, action_type: actionType, status: "proposed", idempotency_key: idempotencyKey, document });
  }

  const existingCompleted = await db(`admin_delivery_actions?workspace_id=eq.${WORKSPACE_ID}&period_id=eq.${periodRow.id}&status=eq.completed&select=*`);
  const coverageActions = [...normalizedActions, ...(existingCompleted || []).filter((action: any) => requestRows.some((request: any) => request.id === action.request_id))];
  for (const request of requestRows) {
    for (const categoryCode of Object.keys(GESTTA_CATEGORIES[request.request_kind as GesttaRequestKind])) {
      const categoryActions = coverageActions.filter((action: any) => action.request_id === request.id && action.category_code === categoryCode);
      if (!categoryActions.length) throw new Error(`category ${categoryCode} is unresolved for the ${request.request_kind} request`);
      if (categoryActions.some((action: any) => action.action_type === "not_applicable") && categoryActions.length > 1) throw new Error(`category ${categoryCode} cannot mix not_applicable with uploads`);
    }
  }

  const currentActions = await db(`admin_delivery_actions?workspace_id=eq.${WORKSPACE_ID}&package_id=eq.${packageRow.id}&select=*`);
  const keptKeys = new Set([...normalizedActions.map((action) => action.idempotency_key), ...(existingCompleted || []).map((action: any) => action.idempotency_key)]);
  for (const action of currentActions || []) {
    if (!keptKeys.has(action.idempotency_key) && ["proposed", "approved", "failed"].includes(action.status)) {
      await db(`admin_delivery_actions?id=eq.${action.id}&workspace_id=eq.${WORKSPACE_ID}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled", updated_at: new Date().toISOString() }) });
    }
  }
  for (const action of normalizedActions) {
    const existing = (currentActions || []).find((item: any) => item.idempotency_key === action.idempotency_key);
    if (!existing) {
      const { document, ...insertRow } = action;
      await db("admin_delivery_actions", { method: "POST", body: JSON.stringify(insertRow) });
    } else if (!["reserved", "completed"].includes(existing.status)) {
      await db(`admin_delivery_actions?id=eq.${existing.id}&workspace_id=eq.${WORKSPACE_ID}`, { method: "PATCH", body: JSON.stringify({ package_id: packageRow.id, request_id: action.request_id, category_label: action.category_label, status: "proposed", approved_by: null, approved_at: null, error_message: null, updated_at: new Date().toISOString() }) });
    }
  }

  const finalActions = await db(`admin_delivery_actions?workspace_id=eq.${WORKSPACE_ID}&package_id=eq.${packageRow.id}&status=not.eq.cancelled&select=id,request_id,document_id,category_code,category_label,action_type,status,idempotency_key,attempt_count,completed_at&order=created_at.asc`);
  const contents = { provider: "gestta", period, request_ids: requestRows.map((request: any) => request.id), actions: finalActions, prepared_at: new Date().toISOString() };
  const updatedPackages = await db(`admin_packages?id=eq.${packageRow.id}&workspace_id=eq.${WORKSPACE_ID}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ status: "ready_for_review", contents, prepared_at: new Date().toISOString(), approved_by: null, approved_at: null, sent_at: null, updated_at: new Date().toISOString() }),
  });
  await audit(userId, "create_gestta_package", "package", packageRow.id, { period, request_ids: requestRows.map((request: any) => request.id), action_count: finalActions.length });
  return { package: updatedPackages[0], requests: requestRows.map(({ request_url, ...safe }: any) => safe), actions: finalActions };
}

async function approveGesttaPackage(args: any, userId: string) {
  const packageId = validUuid(args?.package_id, "package_id");
  if (args?.approved !== true) throw new Error("approved must be true after explicit user approval");
  const rows = await db(`admin_packages?id=eq.${packageId}&workspace_id=eq.${WORKSPACE_ID}&select=*`);
  if (!rows?.length) throw new Error("package not found in this workspace");
  const packageRow = rows[0];
  if (packageRow.status === "approved") return { package: packageRow, already_approved: true };
  if (packageRow.status !== "ready_for_review") throw new Error("package is not ready for approval");
  const actions = await db(`admin_delivery_actions?workspace_id=eq.${WORKSPACE_ID}&package_id=eq.${packageId}&status=not.eq.cancelled&select=*`);
  if (!actions?.length) throw new Error("package has no delivery actions");
  if (actions.some((action: any) => !["proposed", "completed"].includes(action.status))) throw new Error("package contains actions that are not reviewable");
  const now = new Date().toISOString();
  await db(`admin_delivery_actions?workspace_id=eq.${WORKSPACE_ID}&package_id=eq.${packageId}&status=eq.proposed`, { method: "PATCH", body: JSON.stringify({ status: "approved", approved_by: userId, approved_at: now, updated_at: now }) });
  const updated = await db(`admin_packages?id=eq.${packageId}&workspace_id=eq.${WORKSPACE_ID}`, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify({ status: "approved", approved_by: userId, approved_at: now, updated_at: now }) });
  await audit(userId, "approve_gestta_package", "package", packageId, { approved_at: now });
  return { package: updated[0], already_approved: false };
}

async function prepareGesttaDeliveryAction(args: any, userId: string) {
  const actionId = validUuid(args?.action_id, "action_id");
  const rows = await db(`admin_delivery_actions?id=eq.${actionId}&workspace_id=eq.${WORKSPACE_ID}&select=*`);
  if (!rows?.length) throw new Error("delivery action not found in this workspace");
  const action = rows[0];
  if (action.status === "completed") return { delivery_action_id: action.id, already_completed: true, confirmation: action.confirmation };
  const packageRows = await db(`admin_packages?id=eq.${action.package_id}&workspace_id=eq.${WORKSPACE_ID}&select=id,status,approved_by,approved_at`);
  if (!packageRows?.length || packageRows[0].status !== "approved") throw new Error("monthly package has not been approved");
  const requestRows = await db(`admin_delivery_requests?id=eq.${action.request_id}&workspace_id=eq.${WORKSPACE_ID}&select=*`);
  if (!requestRows?.length || requestRows[0].status !== "open") throw new Error("Gestta request is not open");
  if (action.action_type === "upload" && action.category_code === "payments_receipts_spreadsheet") {
    const reportDocuments = await db(`admin_documents?id=eq.${action.document_id}&workspace_id=eq.${WORKSPACE_ID}&select=id,extracted_data`);
    if (!reportDocuments?.length) throw new Error("payments and receipts CSV document was not found");
    await assertCurrentPaymentsReceiptsCsv(reportDocuments[0], requestRows[0].competence);
  }
  if (["reserved", "failed"].includes(action.status) && args?.remote_absence_confirmed !== true) {
    return {
      delivery_action_id: action.id,
      requires_remote_check: true,
      reason: "A previous attempt may have reached Gestta. Inspect the category for the exact filename or marked state before retrying.",
      request_kind: requestRows[0].request_kind,
      category_code: action.category_code,
      category_label: action.category_label,
      expected_filename: action.document_id ? (await db(`admin_documents?id=eq.${action.document_id}&workspace_id=eq.${WORKSPACE_ID}&select=original_filename`))?.[0]?.original_filename : null,
    };
  }
  if (!["approved", "reserved", "failed"].includes(action.status)) throw new Error(`delivery action cannot be prepared from status ${action.status}`);
  const now = new Date().toISOString();
  const nextAttempt = Number(action.attempt_count || 0) + 1;
  await db(`admin_delivery_actions?id=eq.${action.id}&workspace_id=eq.${WORKSPACE_ID}`, { method: "PATCH", body: JSON.stringify({ status: "reserved", attempt_count: nextAttempt, reserved_at: now, error_message: null, updated_at: now }) });
  try {
    let documentContent: any = null;
    if (action.action_type === "upload") documentContent = await retrieveDocumentContent({ document_id: action.document_id }, userId);
    await audit(userId, "prepare_gestta_delivery_action", "delivery_action", action.id, { attempt_count: nextAttempt, action_type: action.action_type, category_code: action.category_code });
    return {
      delivery_action_id: action.id,
      action_type: action.action_type,
      request_kind: requestRows[0].request_kind,
      request_url: requestRows[0].request_url,
      category_code: action.category_code,
      category_label: action.category_label,
      attempt_count: nextAttempt,
      remote_absence_was_confirmed: args?.remote_absence_confirmed === true,
      document: documentContent,
      instruction: action.action_type === "upload" ? "Upload only this verified file to the exact category. Then record the visible Gestta result." : "Mark only this exact category as Não se aplica. Then record the visible Gestta result.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db(`admin_delivery_actions?id=eq.${action.id}&workspace_id=eq.${WORKSPACE_ID}`, { method: "PATCH", body: JSON.stringify({ status: "failed", error_message: message.slice(0, 1000), updated_at: new Date().toISOString() }) });
    throw error;
  }
}

async function completeGesttaDeliveryAction(args: any, userId: string) {
  const actionId = validUuid(args?.action_id, "action_id");
  const outcome = args?.outcome;
  const allowed = ["uploaded", "reused_existing", "marked_not_applicable", "failed"];
  if (!allowed.includes(outcome)) throw new Error(`outcome must be one of: ${allowed.join(", ")}`);
  const rows = await db(`admin_delivery_actions?id=eq.${actionId}&workspace_id=eq.${WORKSPACE_ID}&select=*`);
  if (!rows?.length) throw new Error("delivery action not found in this workspace");
  const action = rows[0];
  if (action.status === "completed") return { delivery_action: action, already_completed: true };
  if (action.status !== "reserved") throw new Error("only a reserved delivery action can be completed or failed");
  if (action.action_type === "upload" && outcome === "marked_not_applicable") throw new Error("upload actions cannot be completed as not_applicable");
  if (action.action_type === "not_applicable" && !["marked_not_applicable", "failed"].includes(outcome)) throw new Error("not_applicable actions require marked_not_applicable or failed");
  const confirmation = args?.confirmation && typeof args.confirmation === "object" && !Array.isArray(args.confirmation) ? args.confirmation : {};
  const now = new Date().toISOString();
  const failed = outcome === "failed";
  const updatedRows = await db(`admin_delivery_actions?id=eq.${action.id}&workspace_id=eq.${WORKSPACE_ID}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ status: failed ? "failed" : "completed", completed_at: failed ? null : now, confirmation: { ...confirmation, outcome, recorded_at: now }, error_message: failed ? String(args?.error || "Gestta delivery failed").slice(0, 1000) : null, updated_at: now }),
  });
  if (!failed) {
    const requestActions = await db(`admin_delivery_actions?workspace_id=eq.${WORKSPACE_ID}&package_id=eq.${action.package_id}&request_id=eq.${action.request_id}&status=not.eq.cancelled&select=status`);
    if (requestActions.length && requestActions.every((item: any) => item.status === "completed")) await db(`admin_delivery_requests?id=eq.${action.request_id}&workspace_id=eq.${WORKSPACE_ID}`, { method: "PATCH", body: JSON.stringify({ status: "completed", updated_at: now }) });
    const packageActions = await db(`admin_delivery_actions?workspace_id=eq.${WORKSPACE_ID}&package_id=eq.${action.package_id}&status=not.eq.cancelled&select=status`);
    if (packageActions.length && packageActions.every((item: any) => item.status === "completed")) await db(`admin_packages?id=eq.${action.package_id}&workspace_id=eq.${WORKSPACE_ID}`, { method: "PATCH", body: JSON.stringify({ status: "sent", sent_at: now, updated_at: now }) });
  }
  await audit(userId, failed ? "fail_gestta_delivery_action" : "complete_gestta_delivery_action", "delivery_action", action.id, { outcome, category_code: action.category_code });
  return { delivery_action: updatedRows[0], already_completed: false };
}

async function listGesttaDeliveryStatus(args: any) {
  const { period, row: periodRow } = await gesttaPeriodRecord(args?.period);
  const packages = await db(`admin_packages?workspace_id=eq.${WORKSPACE_ID}&period_id=eq.${periodRow.id}&select=id,status,contents,prepared_at,approved_by,approved_at,sent_at,updated_at`);
  const requests = await db(`admin_delivery_requests?workspace_id=eq.${WORKSPACE_ID}&period_id=eq.${periodRow.id}&select=id,request_kind,external_task_id,task_name,competence,status,created_at,updated_at&order=request_kind.asc`);
  const actions = await db(`admin_delivery_actions?workspace_id=eq.${WORKSPACE_ID}&period_id=eq.${periodRow.id}&select=id,package_id,request_id,document_id,category_code,category_label,action_type,status,attempt_count,approved_at,reserved_at,completed_at,confirmation,error_message&order=created_at.asc`);
  return {
    period,
    package: packages?.[0] || null,
    requests,
    actions,
    counts: {
      total: actions.length,
      proposed: actions.filter((item: any) => item.status === "proposed").length,
      approved: actions.filter((item: any) => item.status === "approved").length,
      uncertain: actions.filter((item: any) => item.status === "reserved").length,
      completed: actions.filter((item: any) => item.status === "completed").length,
      failed: actions.filter((item: any) => item.status === "failed").length,
    },
  };
}

function reimbursementAmount(v: unknown, field = "amount") { const n=Number(v); if(!Number.isFinite(n)||n<=0||n>100000000) throw new Error(`${field} must be a positive amount`); return Math.round(n*100)/100; }
function reimbursementDate(v: unknown, field: string) { if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new Error(`${field} must use YYYY-MM-DD`); return v; }
function reimbursementCsv(v: unknown) { const x=v==null?"":String(v); return `"${x.replace(/"/g,'""')}"`; }

async function storePersonalExpense(args: any, userId: string) {
  const expenseDate = reimbursementDate(args?.expense_date, "expense_date");
  const expensePeriod = expenseDate.slice(0, 7);
  const amount = reimbursementAmount(args?.amount);
  const filename = safeFilename(args?.filename);
  const bytes = decodeBase64(args?.content_base64);
  const digest = await sha256Hex(bytes);
  const allowedTypes = ["supplier_invoice", "receipt", "tax_document", "payment_proof", "other"];
  const documentType = args?.document_type || "receipt";
  if (!allowedTypes.includes(documentType)) throw new Error("unsupported personal-expense document_type");
  const currency = typeof args?.currency === "string" && args.currency.trim() ? args.currency.trim().toUpperCase() : "BRL";
  let sourceEmailId = args?.source_email_id ? validUuid(args.source_email_id, "source_email_id") : null;
  if (!sourceEmailId && args?.email) sourceEmailId = (await registerEmail(args.email, userId)).email.id;
  if (sourceEmailId) {
    const emails = await db(`admin_source_emails?id=eq.${sourceEmailId}&workspace_id=eq.${WORKSPACE_ID}&select=id`);
    if (!emails.length) throw new Error("source_email_id was not found in this workspace");
  }

  let periods = await db(`admin_periods?workspace_id=eq.${WORKSPACE_ID}&period_start=eq.${expensePeriod}-01&select=id`);
  if (!periods.length) {
    periods = await db("admin_periods", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ workspace_id: WORKSPACE_ID, period_start: `${expensePeriod}-01` }),
    });
  }
  const workspace = (await db(`admin_workspaces?id=eq.${WORKSPACE_ID}&select=sharepoint_drive_id`))[0];
  if (!workspace?.sharepoint_drive_id) throw new Error("workspace SharePoint drive is not configured");

  let documents = await db("admin_documents?on_conflict=workspace_id,sha256", {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({
      workspace_id: WORKSPACE_ID,
      source_email_id: sourceEmailId,
      period_id: periods[0].id,
      document_type: documentType,
      direction: "incoming",
      original_filename: filename,
      mime_type: args?.mime_type || "application/octet-stream",
      file_size_bytes: bytes.length,
      sha256: digest,
      sharepoint_drive_id: workspace.sharepoint_drive_id,
      issue_date: args?.issue_date || null,
      counterparty_name: args?.supplier || null,
      document_number: args?.document_number || null,
      total_amount: amount,
      currency,
      extraction_status: "pending",
      extracted_data: { ...(args?.extracted_data || {}), storage_scope: "personal_expense_not_reimbursed", expense_date: expenseDate, expense_period: expensePeriod },
    }),
  });
  const createdReservation = documents.length > 0;
  if (!createdReservation) documents = await db(`admin_documents?workspace_id=eq.${WORKSPACE_ID}&sha256=eq.${digest}&select=*`);
  let document = documents[0];
  if (!document) throw new Error("could not reserve the personal-expense document");

  if (!document.sharepoint_item_id) {
    const token = await graphToken();
    const folderParts = ["Administration", "Personal expenses", "Not reimbursed"];
    const storedName = safeFilename(`${digest.slice(0, 16)}_${filename}`);
    const existing = await findMatchingSharePointFile(token, workspace.sharepoint_drive_id, folderParts, filename, bytes.length, digest);
    const item = existing || await graph(`/drives/${workspace.sharepoint_drive_id}/root:/${graphPath([...folderParts, storedName])}:/content`, token, {
      method: "PUT",
      headers: { "content-type": args?.mime_type || "application/octet-stream" },
      body: bytes,
    });
    document = (await db(`admin_documents?id=eq.${document.id}&workspace_id=eq.${WORKSPACE_ID}`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ sharepoint_item_id: item.id, sharepoint_web_url: item.webUrl, extraction_status: args?.extracted_data ? "extracted" : "stored", updated_at: new Date().toISOString() }),
    }))[0];
  }

  const expense = await registerPersonalExpense({ document_id: document.id, expense_date: expenseDate, amount, supplier: args?.supplier, description: args?.description }, userId);
  await audit(userId, "store_personal_expense", "personal_expense", expense.id, { document_id: document.id, expense_period: expensePeriod, storage_scope: "general_not_reimbursed", reused_document: !createdReservation });
  return {
    expense,
    document,
    expense_period: expensePeriod,
    sharepoint_scope: "general_personal_expenses_not_reimbursed",
    sharepoint_path: "Administration/Personal expenses/Not reimbursed",
    new_upload_stored_under_month_folder: false,
    reused_existing_document: !createdReservation,
    general_pending_copy_confirmed: true,
    original_storage_scope: document.extracted_data?.storage_scope || "legacy_or_other",
    already_registered: !createdReservation,
  };
}

async function registerPersonalExpense(args:any,userId:string){
 const documentId=validUuid(args?.document_id,"document_id");
 const docs=await db(`admin_documents?id=eq.${documentId}&workspace_id=eq.${WORKSPACE_ID}&select=*`); const d=docs?.[0]; if(!d)throw new Error("document was not found");
 const amount=reimbursementAmount(args?.amount??d.total_amount), expenseDate=reimbursementDate(args?.expense_date??d.issue_date,"expense_date");
 const description=(typeof args?.description==="string"&&args.description.trim()?args.description.trim():d.counterparty_name||d.original_filename).slice(0,500);
 let rows=await db(`admin_personal_expenses?workspace_id=eq.${WORKSPACE_ID}&document_id=eq.${documentId}&select=*`); const reused=!!rows?.length;
 if(!reused) rows=await db("admin_personal_expenses",{method:"POST",headers:{prefer:"return=representation"},body:JSON.stringify({workspace_id:WORKSPACE_ID,document_id:documentId,expense_date:expenseDate,supplier:args?.supplier||d.counterparty_name||null,description,amount,currency:d.currency||"BRL",status:"awaiting_reimbursement",submitted_by:userId,metadata:{source_marker:"#personal-expense"}})});
 const e=rows[0];
 if(!e.metadata?.personal_copy_item_id){
  if(!d.sharepoint_drive_id||!d.sharepoint_item_id||!d.sha256)throw new Error("document is not safely stored");
  if(d.extracted_data?.storage_scope==="personal_expense_not_reimbursed"){
   e.metadata={...(e.metadata||{}),personal_copy_item_id:d.sharepoint_item_id,personal_copy_web_url:d.sharepoint_web_url,personal_copy_filename:d.original_filename,original_stored_in_general_pending_folder:true};
  }else{
   const token=await graphToken(), bytes=await graphFileBytes(d.sharepoint_drive_id,d.sharepoint_item_id,token); if(await sha256Hex(bytes)!==d.sha256)throw new Error("document SHA-256 mismatch");
   const folder=await ensureFolder(token,d.sharepoint_drive_id,["Administration","Personal expenses","Not reimbursed"]); const name=safeFilename(`${e.id}_${d.original_filename}`);
   const item=await graph(`/drives/${d.sharepoint_drive_id}/items/${folder.id}:/${encodeURIComponent(name)}:/content`,token,{method:"PUT",headers:{"content-type":d.mime_type||"application/octet-stream"},body:bytes});
   e.metadata={...(e.metadata||{}),personal_copy_item_id:item.id,personal_copy_web_url:item.webUrl,personal_copy_filename:name,legacy_month_document_copied_to_general_pending_folder:true};
  }
  await db(`admin_personal_expenses?id=eq.${e.id}&workspace_id=eq.${WORKSPACE_ID}`,{method:"PATCH",body:JSON.stringify({metadata:e.metadata,updated_at:new Date().toISOString()})});
 }
 const originalInGeneral=d.extracted_data?.storage_scope==="personal_expense_not_reimbursed";
 await audit(userId,"register_personal_expense","personal_expense",e.id,{document_id:documentId,amount,reused}); return {...e,reused,expense_period:expenseDate.slice(0,7),sharepoint_scope:"general_personal_expenses_not_reimbursed",sharepoint_path:"Administration/Personal expenses/Not reimbursed",general_pending_copy_confirmed:true,original_stored_in_general_pending_folder:originalInGeneral,legacy_source_document_preserved:!originalInGeneral};
}
async function listPersonalExpenses(args:any){
 const status=args?.status||"outstanding"; let f="";
 if(status==="outstanding")f="&status=in.(review,awaiting_reimbursement,scheduled)"; else if(["review","awaiting_reimbursement","scheduled","reimbursed","cancelled"].includes(status))f=`&status=eq.${status}`; else if(status!=="all")throw new Error("unsupported status");
 const expenses=await db(`admin_personal_expenses?workspace_id=eq.${WORKSPACE_ID}${f}&select=id,document_id,expense_date,supplier,description,amount,currency,status,reimbursed_at&order=expense_date.asc`);
 return {expenses,available_total:expenses.filter((e:any)=>e.status==="awaiting_reimbursement").reduce((n:number,e:any)=>n+Number(e.amount),0)};
}
async function suggestReimbursement(args:any){
 const target=reimbursementAmount(args?.target_amount,"target_amount"), tolerance=args?.tolerance==null?Math.max(25,target*.15):reimbursementAmount(args.tolerance,"tolerance");
 const rows=await db(`admin_personal_expenses?workspace_id=eq.${WORKSPACE_ID}&status=eq.awaiting_reimbursement&currency=eq.BRL&select=id,document_id,expense_date,supplier,description,amount,currency&order=expense_date.asc&limit=100`);
 const tc=Math.round(target*100), max=Math.round((target+tolerance)*100); let states=new Map<number,number[]>([[0,[]]]);
 rows.forEach((e:any,i:number)=>{const c=Math.round(Number(e.amount)*100),next=new Map(states);for(const [sum,ids] of states){const x=sum+c;if(x<=max&&!next.has(x))next.set(x,[...ids,i]);}states=next.size>5000?new Map([...next].sort((a,b)=>Math.abs(a[0]-tc)-Math.abs(b[0]-tc)).slice(0,5000)):next;});
 const best=[...states].filter(([x])=>x>0).sort((a,b)=>Math.abs(a[0]-tc)-Math.abs(b[0]-tc)||a[1].length-b[1].length)[0]; if(!best)return{target_amount:target,suggestion:[],total:0,difference:-target};
 return{target_amount:target,tolerance,suggestion:best[1].map(i=>rows[i]),total:best[0]/100,difference:(best[0]-tc)/100};
}
async function createReimbursementBatch(args:any,userId:string){
 if(args?.confirmed!==true)throw new Error("confirmed must be true after accepting the exact selection"); const period=validPeriod(args?.payment_month);
 const ps=await db(`admin_periods?workspace_id=eq.${WORKSPACE_ID}&period_start=eq.${period}-01&select=id`);if(!ps.length)throw new Error("payment month does not exist");
 if(!Array.isArray(args?.personal_expense_ids)||!args.personal_expense_ids.length||args.personal_expense_ids.length>100)throw new Error("select 1 to 100 expenses");
 const ids=[...new Set(args.personal_expense_ids.map((x:unknown)=>validUuid(x,"personal_expense_id")))];if(ids.length!==args.personal_expense_ids.length)throw new Error("duplicate expense selection");
 const expenses=await db(`admin_personal_expenses?workspace_id=eq.${WORKSPACE_ID}&id=in.(${ids.join(",")})&status=eq.awaiting_reimbursement&select=*`);if(expenses.length!==ids.length)throw new Error("an expense is unavailable or already assigned");
 const currencies=new Set(expenses.map((e:any)=>e.currency));if(currencies.size!==1)throw new Error("mixed currencies are not allowed");const total=Math.round(expenses.reduce((n:number,e:any)=>n+Number(e.amount),0)*100)/100;
 const ref=`Reimbursement-${period}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;let batch:any;
 try{batch=(await db("admin_reimbursement_batches",{method:"POST",headers:{prefer:"return=representation"},body:JSON.stringify({workspace_id:WORKSPACE_ID,payment_period_id:ps[0].id,reference:ref,status:"draft",total_amount:total,currency:[...currencies][0]})}))[0];
 await db("admin_reimbursement_items",{method:"POST",body:JSON.stringify(expenses.map((e:any)=>({workspace_id:WORKSPACE_ID,batch_id:batch.id,personal_expense_id:e.id,amount_snapshot:e.amount})))});
 for(const e of expenses)await db(`admin_personal_expenses?id=eq.${e.id}&workspace_id=eq.${WORKSPACE_ID}`,{method:"PATCH",body:JSON.stringify({status:"scheduled",updated_at:new Date().toISOString()})});}
 catch(error){if(batch?.id)await db(`admin_reimbursement_batches?id=eq.${batch.id}&workspace_id=eq.${WORKSPACE_ID}`,{method:"DELETE"}).catch(()=>null);throw error;}
 await audit(userId,"create_reimbursement_batch","reimbursement_batch",batch.id,{total,expense_count:expenses.length});return{batch,expenses};
}
async function approveReimbursementBatch(args:any,userId:string){
 if(args?.approved!==true)throw new Error("approved must be true after explicit approval");const id=validUuid(args?.batch_id,"batch_id");
 const b=(await db(`admin_reimbursement_batches?id=eq.${id}&workspace_id=eq.${WORKSPACE_ID}&select=*`))?.[0];if(!b)throw new Error("batch not found");if(b.status==="approved")return{batch:b,already_approved:true};if(b.status!=="draft")throw new Error(`cannot approve ${b.status} batch`);
 const items=await db(`admin_reimbursement_items?workspace_id=eq.${WORKSPACE_ID}&batch_id=eq.${id}&select=amount_snapshot`);const total=Math.round(items.reduce((n:number,x:any)=>n+Number(x.amount_snapshot),0)*100)/100;if(!items.length||total!==Number(b.total_amount))throw new Error("batch items do not match total");
 const out=(await db(`admin_reimbursement_batches?id=eq.${id}&workspace_id=eq.${WORKSPACE_ID}`,{method:"PATCH",headers:{prefer:"return=representation"},body:JSON.stringify({status:"approved",approved_by:userId,approved_at:new Date().toISOString(),updated_at:new Date().toISOString()})}))[0];await audit(userId,"approve_reimbursement_batch","reimbursement_batch",id,{total});return{batch:out,already_approved:false};
}
async function listReimbursementMatches(args:any){
 const period=validPeriod(args?.period),p=(await db(`admin_periods?workspace_id=eq.${WORKSPACE_ID}&period_start=eq.${period}-01&select=id`))?.[0];if(!p)return{period,candidates:[]};
 const bs=await db(`admin_reimbursement_batches?workspace_id=eq.${WORKSPACE_ID}&status=eq.approved&select=id,reference,total_amount,currency,approved_at`),ts=await db(`admin_transactions?workspace_id=eq.${WORKSPACE_ID}&period_id=eq.${p.id}&select=id,transaction_date,description,counterparty_name,amount,currency`);
 const candidates=[];for(const b of bs)for(const t of ts)if(b.currency===t.currency&&Math.abs(Number(t.amount))===Number(b.total_amount)){const used=await db(`admin_reimbursement_batches?workspace_id=eq.${WORKSPACE_ID}&payment_transaction_id=eq.${t.id}&select=id`);if(!used.length)candidates.push({batch:b,transaction:t,requires_confirmation:true});}return{period,candidates};
}
async function confirmReimbursementPayment(args:any,userId:string){
 if(args?.confirmed!==true)throw new Error("confirmed must be true");const id=validUuid(args?.batch_id,"batch_id"),tid=validUuid(args?.transaction_id,"transaction_id");
 const b=(await db(`admin_reimbursement_batches?id=eq.${id}&workspace_id=eq.${WORKSPACE_ID}&select=*`))?.[0];if(!b)throw new Error("batch not found");if(["paid","archived"].includes(b.status)){if(b.payment_transaction_id!==tid)throw new Error("batch settled by another transaction");return{batch:b,already_confirmed:true};}if(b.status!=="approved")throw new Error("batch must be approved");
 const t=(await db(`admin_transactions?id=eq.${tid}&workspace_id=eq.${WORKSPACE_ID}&select=*`))?.[0];if(!t)throw new Error("transaction not found");if(t.currency!==b.currency||Math.abs(Number(t.amount))!==Number(b.total_amount))throw new Error("transaction amount or currency does not match");
 const now=new Date().toISOString(),out=(await db(`admin_reimbursement_batches?id=eq.${id}&workspace_id=eq.${WORKSPACE_ID}`,{method:"PATCH",headers:{prefer:"return=representation"},body:JSON.stringify({status:"paid",payment_transaction_id:tid,paid_at:now,updated_at:now})}))[0];
 const items=await db(`admin_reimbursement_items?workspace_id=eq.${WORKSPACE_ID}&batch_id=eq.${id}&select=personal_expense_id`);for(const x of items)await db(`admin_personal_expenses?id=eq.${x.personal_expense_id}&workspace_id=eq.${WORKSPACE_ID}`,{method:"PATCH",body:JSON.stringify({status:"reimbursed",reimbursed_at:now,updated_at:now})});
 await audit(userId,"confirm_reimbursement_payment","reimbursement_batch",id,{transaction_id:tid});return{batch:out,transaction:t,already_confirmed:false};
}
async function buildReimbursementArchive(args:any,userId:string){
 const id=validUuid(args?.batch_id,"batch_id"),b=(await db(`admin_reimbursement_batches?id=eq.${id}&workspace_id=eq.${WORKSPACE_ID}&select=*`))?.[0];if(!b)throw new Error("batch not found");if(b.status==="archived"&&b.archive_document_id)return{batch:b,already_archived:true};if(b.status!=="paid"||!b.payment_transaction_id)throw new Error("payment must be confirmed first");
 const items=await db(`admin_reimbursement_items?workspace_id=eq.${WORKSPACE_ID}&batch_id=eq.${id}&select=*`),ws=(await db(`admin_workspaces?id=eq.${WORKSPACE_ID}&select=sharepoint_drive_id`))[0],token=await graphToken(),files:Record<string,Uint8Array>={},rows:any[]=[];let size=0;
 for(const item of items){const e=(await db(`admin_personal_expenses?id=eq.${item.personal_expense_id}&workspace_id=eq.${WORKSPACE_ID}&select=*`))[0],d=(await db(`admin_documents?id=eq.${e.document_id}&workspace_id=eq.${WORKSPACE_ID}&select=*`))[0],bytes=await graphFileBytes(d.sharepoint_drive_id,d.sharepoint_item_id,token);if(await sha256Hex(bytes)!==d.sha256)throw new Error(`SHA-256 failed for ${d.original_filename}`);size+=bytes.length;if(size>50*1024*1024)throw new Error("archive exceeds 50 MB");files[`receipts/${e.id}_${safeFilename(d.original_filename)}`]=bytes;rows.push({...e,filename:d.original_filename,amount_snapshot:item.amount_snapshot});}
 const p=(await db(`admin_periods?id=eq.${b.payment_period_id}&workspace_id=eq.${WORKSPACE_ID}&select=period_start`))[0],period=p.period_start.slice(0,7);
 const csv=[["expense_id","document_filename","expense_date","supplier","description","amount","currency","document_id","reimbursement_reference"],...rows.map(e=>[e.id,e.filename,e.expense_date,e.supplier,e.description,Number(e.amount_snapshot).toFixed(2),e.currency,e.document_id,b.reference])].map(r=>r.map(reimbursementCsv).join(",")).join("\r\n")+"\r\n";
 const readme=`Personal expense reimbursement\r\nReference: ${b.reference}\r\nPayment month: ${period}\r\nTotal: ${b.currency} ${Number(b.total_amount).toFixed(2)}\r\nPayment transaction ID: ${b.payment_transaction_id}\r\n\r\nThese are company expenses initially paid from a personal account. The linked bank transaction is reimbursement and not a second expense.\r\n`;
 files[`reimbursement-${period}.csv`]=strToU8(csv);files["README.txt"]=strToU8(readme);const zip=zipSync(files,{level:6}),hash=await sha256Hex(zip),folder=await ensureFolder(token,ws.sharepoint_drive_id,["Administration",period.slice(0,4),period,"Exports","Reimbursements",b.reference]);
 const zipName=safeFilename(`${b.reference}.zip`),item=await graph(`/drives/${ws.sharepoint_drive_id}/items/${folder.id}:/${encodeURIComponent(zipName)}:/content`,token,{method:"PUT",headers:{"content-type":"application/zip"},body:zip});
 let docs=await db(`admin_documents?workspace_id=eq.${WORKSPACE_ID}&sha256=eq.${hash}&select=*`),archive=docs?.[0];if(!archive)archive=(await db("admin_documents",{method:"POST",headers:{prefer:"return=representation"},body:JSON.stringify({workspace_id:WORKSPACE_ID,period_id:b.payment_period_id,document_type:"other",direction:"unknown",original_filename:zipName,mime_type:"application/zip",file_size_bytes:zip.length,sha256:hash,sharepoint_drive_id:ws.sharepoint_drive_id,sharepoint_item_id:item.id,sharepoint_web_url:item.webUrl,total_amount:b.total_amount,currency:b.currency,extraction_status:"stored",extracted_data:{reimbursement_batch_id:id}})}))[0];
 const matches=await db(`admin_document_matches?workspace_id=eq.${WORKSPACE_ID}&transaction_id=eq.${b.payment_transaction_id}&document_id=eq.${archive.id}&select=id`);if(!matches.length)await db("admin_document_matches",{method:"POST",body:JSON.stringify({workspace_id:WORKSPACE_ID,transaction_id:b.payment_transaction_id,document_id:archive.id,status:"confirmed",match_method:"manual",confidence:1,reasons:[{reimbursement_batch_id:id}],decided_by:userId,decided_at:new Date().toISOString()})});
 await db(`admin_transactions?id=eq.${b.payment_transaction_id}&workspace_id=eq.${WORKSPACE_ID}`,{method:"PATCH",body:JSON.stringify({reconciliation_status:"matched",updated_at:new Date().toISOString()})});
 const out=(await db(`admin_reimbursement_batches?id=eq.${id}&workspace_id=eq.${WORKSPACE_ID}`,{method:"PATCH",headers:{prefer:"return=representation"},body:JSON.stringify({status:"archived",archive_document_id:archive.id,archived_at:new Date().toISOString(),updated_at:new Date().toISOString()})}))[0];await audit(userId,"build_reimbursement_archive","reimbursement_batch",id,{archive_document_id:archive.id});return{batch:out,archive_document:archive,folder_url:folder.webUrl,already_archived:false};
}

const tools = [

  { name: "store_personal_expense", description: "Store a new personal-expense original directly in the general Administration/Personal expenses/Not reimbursed SharePoint folder and register its expense period only as Supabase metadata. Never stores the file below a monthly SharePoint folder.", inputSchema: { type: "object", required: ["expense_date","amount","filename","content_base64"], properties: { expense_date: { type: "string", format: "date", description: "Actual expense date; determines the Supabase expense period, not the SharePoint folder." }, amount: { type: "number", exclusiveMinimum: 0 }, supplier: { type: "string" }, description: { type: "string" }, document_type: { type: "string", enum: ["supplier_invoice","receipt","tax_document","payment_proof","other"], default: "receipt" }, filename: { type: "string" }, mime_type: { type: "string" }, content_base64: { type: "string", description: "Base64 file content, maximum decoded size 10 MB." }, issue_date: { type: "string", format: "date" }, document_number: { type: "string" }, currency: { type: "string" }, extracted_data: { type: "object" }, source_email_id: { type: "string", format: "uuid" }, email: { type: "object" } } } },
  { name: "register_personal_expense", description: "Legacy conversion for a document already stored elsewhere: register it as a personal expense and ensure a verified copy exists in the general Administration/Personal expenses/Not reimbursed folder. New Gmail attachments should use store_personal_expense instead.", inputSchema: { type: "object", required: ["document_id"], properties: { document_id: { type: "string", format: "uuid" }, expense_date: { type: "string", format: "date" }, amount: { type: "number", exclusiveMinimum: 0 }, supplier: { type: "string" }, description: { type: "string" } } } },
  { name: "list_personal_expenses", description: "List personal expenses and outstanding total.", inputSchema: { type: "object", properties: { status: { type: "string", enum: ["outstanding","review","awaiting_reimbursement","scheduled","reimbursed","cancelled","all"] } } } },
  { name: "suggest_reimbursement", description: "Read-only suggestion closest to a target amount.", inputSchema: { type: "object", required: ["target_amount"], properties: { target_amount: { type: "number", exclusiveMinimum: 0 }, tolerance: { type: "number", exclusiveMinimum: 0 } } } },
  { name: "create_reimbursement_batch", description: "Create a draft after confirmation of exact expenses.", inputSchema: { type: "object", required: ["payment_month","personal_expense_ids","confirmed"], properties: { payment_month: { type: "string" }, personal_expense_ids: { type: "array", minItems: 1, maxItems: 100, uniqueItems: true, items: { type: "string", format: "uuid" } }, confirmed: { type: "boolean", const: true } } } },
  { name: "approve_reimbursement_batch", description: "Approve a complete reimbursement batch after explicit approval.", inputSchema: { type: "object", required: ["batch_id","approved"], properties: { batch_id: { type: "string", format: "uuid" }, approved: { type: "boolean", const: true } } } },
  { name: "list_reimbursement_matches", description: "Read-only exact-amount bank candidates for approved batches.", inputSchema: { type: "object", required: ["period"], properties: { period: { type: "string" } } } },
  { name: "confirm_reimbursement_payment", description: "Confirm one bank transaction settled one approved batch.", inputSchema: { type: "object", required: ["batch_id","transaction_id","confirmed"], properties: { batch_id: { type: "string", format: "uuid" }, transaction_id: { type: "string", format: "uuid" }, confirmed: { type: "boolean", const: true } } } },
  { name: "build_reimbursement_archive", description: "Idempotently create and store the ZIP after payment confirmation and link it to the bank transaction.", inputSchema: { type: "object", required: ["batch_id"], properties: { batch_id: { type: "string", format: "uuid" } } } },
  { name: "administration_status", description: "Get the reconciliation status and counts for one administration month.", inputSchema: { type: "object", properties: { period: { type: "string", description: "Month in YYYY-MM format; defaults to current month." } } } },
  { name: "preview_payments_receipts_csv", description: "Preview the monthly bank payments and receipts CSV without writing a file. Includes only confirmed document references and reports unmatched lines.", inputSchema: { type: "object", required: ["period"], properties: { period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" } } } },
  { name: "generate_payments_receipts_csv", description: "Idempotently generate the monthly bank payments and receipts CSV from Supabase, store it in the SharePoint month root, and register it for Gestta delivery.", inputSchema: { type: "object", required: ["period"], properties: { period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" } } } },
  { name: "ensure_month", description: "Create or verify the fixed SharePoint folder structure and Supabase period for a month.", inputSchema: { type: "object", required: ["period"], properties: { period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" } } } },
  { name: "register_email", description: "Idempotently register a relevant Gmail message as an administration source.", inputSchema: { type: "object", required: ["gmail_message_id", "sender_address", "received_at"], properties: { gmail_message_id: { type: "string" }, gmail_thread_id: { type: "string" }, sender_address: { type: "string" }, sender_name: { type: "string" }, subject: { type: "string" }, received_at: { type: "string" }, classification: { type: "string", enum: ["unclassified", "relevant", "ignored", "needs_review"] }, metadata: { type: "object" } } } },
  { name: "store_document", description: "Store one financial document in the fixed SharePoint site and register its metadata in Supabase. Duplicate file content is detected by SHA-256.", inputSchema: { type: "object", required: ["period", "document_type", "filename", "content_base64"], properties: { period: { type: "string" }, document_type: { type: "string", enum: ["bank_statement", "credit_card_statement", "supplier_invoice", "sales_invoice", "receipt", "tax_document", "payment_proof", "contract", "other"] }, expense_channel: { type: "string", enum: ["bank", "credit_card"] }, direction: { type: "string", enum: ["received", "issued", "unknown"] }, filename: { type: "string" }, mime_type: { type: "string" }, content_base64: { type: "string", description: "Base64 file content, maximum decoded size 10 MB." }, issue_date: { type: "string" }, due_date: { type: "string" }, counterparty_name: { type: "string" }, counterparty_tax_id: { type: "string" }, document_number: { type: "string" }, total_amount: { type: "number" }, currency: { type: "string" }, extracted_data: { type: "object" }, source_email_id: { type: "string" }, email: { type: "object" } } } },

  { name: "preview_gestta_delivery", description: "Read-only preview of documents, safe category suggestions, unresolved documents, and existing Gestta delivery state for one month.", inputSchema: { type: "object", required: ["period", "requests"], properties: { period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" }, requests: { type: "array", minItems: 1, maxItems: 2, items: { type: "object", required: ["request_kind", "request_url"], properties: { request_kind: { type: "string", enum: ["accounting", "fiscal"] }, request_url: { type: "string", format: "uri" } } } } } } },
  { name: "create_gestta_package", description: "Create a reviewed monthly Gestta delivery package. Every category in each supplied request must be resolved by uploads or an explicit not_applicable action.", inputSchema: { type: "object", required: ["period", "requests", "actions"], properties: { period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" }, source_email_id: { type: "string", format: "uuid" }, requests: { type: "array", minItems: 1, maxItems: 2, items: { type: "object", required: ["request_kind", "request_url"], properties: { request_kind: { type: "string", enum: ["accounting", "fiscal"] }, request_url: { type: "string", format: "uri" } } } }, actions: { type: "array", minItems: 1, maxItems: 100, items: { type: "object", required: ["request_kind", "category_code", "action_type"], properties: { request_kind: { type: "string", enum: ["accounting", "fiscal"] }, category_code: { type: "string" }, action_type: { type: "string", enum: ["upload", "not_applicable"] }, document_id: { type: "string", format: "uuid" } } } } } } },
  { name: "approve_gestta_package", description: "Approve one fully reviewed Gestta package after explicit user approval. Approval is recorded with user and timestamp.", inputSchema: { type: "object", required: ["package_id", "approved"], properties: { package_id: { type: "string", format: "uuid" }, approved: { type: "boolean", const: true } } } },
  { name: "prepare_gestta_delivery_action", description: "Reserve one approved Gestta action and retrieve verified file content when required. Interrupted or failed attempts return a remote-check requirement before retry.", inputSchema: { type: "object", required: ["action_id"], properties: { action_id: { type: "string", format: "uuid" }, remote_absence_confirmed: { type: "boolean", description: "Set true only after inspecting Gestta and confirming the expected file or marked state is absent." } } } },
  { name: "complete_gestta_delivery_action", description: "Record the visible Gestta result for one reserved action. Completed actions are idempotent and cannot be uploaded again.", inputSchema: { type: "object", required: ["action_id", "outcome"], properties: { action_id: { type: "string", format: "uuid" }, outcome: { type: "string", enum: ["uploaded", "reused_existing", "marked_not_applicable", "failed"] }, confirmation: { type: "object" }, error: { type: "string" } } } },
  { name: "list_gestta_delivery_status", description: "List monthly Gestta package, requests, actions, attempts, uncertain states, failures, and confirmations.", inputSchema: { type: "object", required: ["period"], properties: { period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" } } } },
  { name: "retrieve_document_content", description: "Retrieve one registered SharePoint document for an explicitly approved external delivery. Verifies workspace ownership, file size, and SHA-256 before returning base64 content.", inputSchema: { type: "object", required: ["document_id"], properties: { document_id: { type: "string", format: "uuid", description: "Supabase ID of the registered document." } } } },
  { name: "retrieve_linked_document", description: "After Gmail attachment inspection finds no usable financial attachment, safely retrieve an allowlisted linked NFSe PDF and store it idempotently in SharePoint and Supabase.", inputSchema: { type: "object", required: ["period", "source_email_id", "source_url", "attachment_check"], properties: { period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" }, source_email_id: { type: "string", format: "uuid" }, source_url: { type: "string", format: "uri" }, attachment_check: { type: "string", enum: ["none_found", "no_usable_financial_attachment"] }, document_type: { type: "string", enum: ["supplier_invoice", "tax_document", "receipt", "payment_proof", "other"], default: "tax_document" }, expense_channel: { type: "string", enum: ["bank", "credit_card"] }, direction: { type: "string", enum: ["received", "issued", "unknown"], default: "received" }, filename: { type: "string" }, issue_date: { type: "string" }, due_date: { type: "string" }, counterparty_name: { type: "string" }, counterparty_tax_id: { type: "string" }, document_number: { type: "string" }, total_amount: { type: "number" }, currency: { type: "string" }, extracted_data: { type: "object" } } } },
  { name: "preview_bank_statement", description: "Read and validate a stored OFX bank statement without writing transactions. Returns its period, masked account, balances, counts, totals, and warnings.", inputSchema: { type: "object", required: ["document_id"], properties: { document_id: { type: "string", format: "uuid", description: "Supabase ID of the stored OFX bank-statement document." } } } },
  { name: "import_bank_statement", description: "Idempotently parse a stored OFX bank statement and import its transactions into Supabase. Re-importing the same statement does not duplicate transaction rows.", inputSchema: { type: "object", required: ["document_id"], properties: { document_id: { type: "string", format: "uuid", description: "Supabase ID of the stored OFX bank-statement document." }, account_id: { type: "string", format: "uuid", description: "Optional existing bank-account ID. If omitted, the account is resolved or created from OFX account metadata." } } } },
  { name: "list_bank_transactions", description: "List imported bank transactions for one administration month.", inputSchema: { type: "object", required: ["period"], properties: { period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" }, limit: { type: "integer", minimum: 1, maximum: 500 }, offset: { type: "integer", minimum: 0 } } } },
  { name: "compare_statement_sources", description: "Compare a stored OFX statement with its CSV companion using transaction count and signed totals. This operation is read-only.", inputSchema: { type: "object", required: ["ofx_document_id", "csv_document_id"], properties: { ofx_document_id: { type: "string", format: "uuid" }, csv_document_id: { type: "string", format: "uuid" } } } },
  { name: "preview_credit_card_statement", description: "Read and validate a stored Cora credit-card PDF without writing transactions. Returns its accounting period, masked cards, dates, totals, transaction count, and warnings.", inputSchema: { type: "object", required: ["document_id"], properties: { document_id: { type: "string", format: "uuid", description: "Supabase ID of the stored credit-card-statement PDF." } } } },
  { name: "import_credit_card_statement", description: "Idempotently parse a stored Cora credit-card PDF and import its expense lines into Supabase. Re-importing the same statement does not duplicate transaction rows.", inputSchema: { type: "object", required: ["document_id"], properties: { document_id: { type: "string", format: "uuid", description: "Supabase ID of the stored credit-card-statement PDF." }, account_id: { type: "string", format: "uuid", description: "Optional existing credit-card account ID. If omitted, a Cora credit-card account is resolved or created from the PDF." } } } },
  { name: "list_credit_card_transactions", description: "List imported credit-card transactions for one administration month.", inputSchema: { type: "object", required: ["period"], properties: { period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" }, limit: { type: "integer", minimum: 1, maximum: 500 }, offset: { type: "integer", minimum: 0 } } } },
  { name: "propose_document_matches", description: "Score eligible incoming documents against transactions in one month and store reviewable match proposals. Documents may come from adjacent administration periods and may support multiple transactions. This never confirms a match automatically.", inputSchema: { type: "object", required: ["period"], properties: { period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" }, transaction_id: { type: "string", format: "uuid", description: "Optional transaction to score." }, document_id: { type: "string", format: "uuid", description: "Optional eligible document from any period in this workspace." }, minimum_confidence: { type: "number", minimum: 0, maximum: 1, default: 0.55 }, max_per_transaction: { type: "integer", minimum: 1, maximum: 10, default: 5 }, document_period_window: { type: "integer", minimum: 0, maximum: 3, default: 1, description: "Months before and after the transaction period to search for supporting documents." } } } },
  { name: "confirm_document_match", description: "Explicitly confirm one transaction-to-document match and atomically mark the transaction as matched.", inputSchema: { type: "object", required: ["transaction_id", "document_id"], properties: { transaction_id: { type: "string", format: "uuid" }, document_id: { type: "string", format: "uuid" } } } },
  { name: "reject_document_match", description: "Explicitly reject one proposed transaction-to-document match and atomically recalculate the transaction reconciliation status.", inputSchema: { type: "object", required: ["transaction_id", "document_id"], properties: { transaction_id: { type: "string", format: "uuid" }, document_id: { type: "string", format: "uuid" } } } },
  { name: "list_reconciliation_status", description: "List transactions, proposed or confirmed document matches, and reconciliation counts for one administration month.", inputSchema: { type: "object", required: ["period"], properties: { period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" }, limit: { type: "integer", minimum: 1, maximum: 500 }, offset: { type: "integer", minimum: 0 } } } },
  { name: "list_open_issues", description: "List unresolved administration issues, optionally for one month.", inputSchema: { type: "object", properties: { period: { type: "string" } } } },
  { name: "list_unmatched_transactions", description: "List statement lines that still need a supporting document, optionally for one month.", inputSchema: { type: "object", properties: { period: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 200 } } } },
  { name: "save_sender_rule", description: "Save a reusable process, ignore, or manual-review rule for recurring email senders and subjects.", inputSchema: { type: "object", required: ["sender_pattern", "action"], properties: { sender_pattern: { type: "string" }, subject_pattern: { type: "string" }, action: { type: "string", enum: ["process", "ignore", "review"] }, document_type: { type: "string" }, priority: { type: "integer" }, notes: { type: "string" } } } },
  { name: "list_sender_rules", description: "List active email classification rules in priority order.", inputSchema: { type: "object", properties: {} } },
];

async function callTool(name: string, args: any, user: any) {

  if (name === "store_personal_expense") return storePersonalExpense(args || {}, user.id);
  if (name === "register_personal_expense") return registerPersonalExpense(args || {}, user.id);
  if (name === "list_personal_expenses") return listPersonalExpenses(args || {});
  if (name === "suggest_reimbursement") return suggestReimbursement(args || {});
  if (name === "create_reimbursement_batch") return createReimbursementBatch(args || {}, user.id);
  if (name === "approve_reimbursement_batch") return approveReimbursementBatch(args || {}, user.id);
  if (name === "list_reimbursement_matches") return listReimbursementMatches(args || {});
  if (name === "confirm_reimbursement_payment") return confirmReimbursementPayment(args || {}, user.id);
  if (name === "build_reimbursement_archive") return buildReimbursementArchive(args || {}, user.id);
  if (name === "administration_status") return getStatus(args?.period);
  if (name === "preview_payments_receipts_csv") return previewPaymentsReceiptsCsv(args || {});
  if (name === "generate_payments_receipts_csv") return generatePaymentsReceiptsCsv(args || {}, user.id);
  if (name === "ensure_month") {
    const result = await ensureMonth(args?.period);
    await audit(user.id, "ensure_month", "period", result.period.id, { period: args.period, sharepoint_folder_url: result.period.sharepoint_folder_url });
    return { period: result.period };
  }
  if (name === "register_email") return registerEmail(args || {}, user.id);
  if (name === "store_document") return storeDocument(args || {}, user.id);
  if (name === "preview_gestta_delivery") return previewGesttaDelivery(args || {});
  if (name === "create_gestta_package") return createGesttaPackage(args || {}, user.id);
  if (name === "approve_gestta_package") return approveGesttaPackage(args || {}, user.id);
  if (name === "prepare_gestta_delivery_action") return prepareGesttaDeliveryAction(args || {}, user.id);
  if (name === "complete_gestta_delivery_action") return completeGesttaDeliveryAction(args || {}, user.id);
  if (name === "list_gestta_delivery_status") return listGesttaDeliveryStatus(args || {});
  if (name === "retrieve_document_content") return retrieveDocumentContent(args || {}, user.id);
  if (name === "retrieve_linked_document") return retrieveLinkedDocument(args || {}, user.id);
  if (name === "preview_bank_statement") return previewBankStatement(args || {});
  if (name === "import_bank_statement") return importBankStatement(args || {}, user.id);
  if (name === "list_bank_transactions") return listBankTransactions(args || {});
  if (name === "compare_statement_sources") return compareStatementSources(args || {});
  if (name === "preview_credit_card_statement") return previewCreditCardStatement(args || {});
  if (name === "import_credit_card_statement") return importCreditCardStatement(args || {}, user.id);
  if (name === "list_credit_card_transactions") return listCreditCardTransactions(args || {});
  if (name === "propose_document_matches") return proposeDocumentMatches(args || {}, user.id);
  if (name === "confirm_document_match") return decideDocumentMatch(args || {}, user.id, "confirm");
  if (name === "reject_document_match") return decideDocumentMatch(args || {}, user.id, "reject");
  if (name === "list_reconciliation_status") return listReconciliationStatus(args || {});
  if (name === "save_sender_rule") return saveSenderRule(args || {}, user.id);
  if (name === "list_sender_rules") return db(`admin_sender_rules?workspace_id=eq.${WORKSPACE_ID}&active=eq.true&select=id,sender_pattern,subject_pattern,action,document_type,priority,notes&order=priority.asc`);
  if (name === "list_open_issues" || name === "list_unmatched_transactions") {
    let periodId = "";
    if (args?.period) {
      const period = validPeriod(args.period);
      const rows = await db(`admin_periods?workspace_id=eq.${WORKSPACE_ID}&period_start=eq.${period}-01&select=id`);
      if (!rows.length) return [];
      periodId = `&period_id=eq.${rows[0].id}`;
    }
    if (name === "list_open_issues") return db(`admin_issues?workspace_id=eq.${WORKSPACE_ID}&status=eq.open${periodId}&select=id,period_id,issue_type,severity,title,details,created_at&order=severity.desc,created_at.asc`);
    const limit = Math.min(Math.max(Number(args?.limit || 100), 1), 200);
    return db(`admin_transactions?workspace_id=eq.${WORKSPACE_ID}&reconciliation_status=in.(unmatched,missing_document)${periodId}&select=id,period_id,account_id,transaction_date,posted_date,description,counterparty_name,amount,currency,reconciliation_status&order=transaction_date.asc&limit=${limit}`);
  }
  throw new Error(`unknown tool: ${name}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/.well-known/oauth-protected-resource")) {
    return json({ resource: MCP_URL, authorization_servers: [AUTH_SERVER], scopes_supported: ["email"], bearer_methods_supported: ["header"] });
  }
  if (req.method === "GET") return json({ name: "LEF Administration MCP", status: "authentication_required", resource_metadata: `${MCP_URL}/.well-known/oauth-protected-resource` });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const user = await authenticate(req);
  if (!user) return oauthChallenge();
  let body: any;
  try { body = await req.json(); } catch { return rpcError(null, -32700, "Parse error"); }
  const { id, method, params } = body || {};
  if (method === "initialize") return rpcResult(id, { protocolVersion: params?.protocolVersion || "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "lef-administration", version: "1.9.1" } });
  if (method === "notifications/initialized") return new Response(null, { status: 202, headers: cors });
  if (method === "ping") return rpcResult(id, {});
  if (method === "tools/list") return rpcResult(id, { tools });
  if (method === "tools/call") {
    try {
      return rpcResult(id, toolText(await callTool(params?.name, params?.arguments || {}, user)));
    } catch (error) {
      return rpcResult(id, toolText({ error: error instanceof Error ? error.message : String(error) }, true));
    }
  }
  return rpcError(id ?? null, -32601, "Method not found");
});
