const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_HOSTS = new Set([
  "click.omie.com",
  "click.omie.com.br",
  "nfe.prefeitura.sp.gov.br",
]);

function decodeHtml(value: string) {
  return value.replace(/&amp;/gi, "&").replace(/&#38;/g, "&").replace(/&quot;/gi, '"');
}

export function validateLinkedDocumentUrl(value: string, base?: string) {
  let url: URL;
  try {
    url = new URL(decodeHtml(value), base);
  } catch {
    throw new Error("linked document URL is invalid");
  }
  if (!["https:", "http:"].includes(url.protocol) || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(`linked document host is not allowed: ${url.hostname || "unknown"}`);
  }
  url.username = "";
  url.password = "";
  return url;
}

function htmlCandidates(html: string, base: string) {
  const candidates: URL[] = [];
  const pattern = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      const candidate = validateLinkedDocumentUrl(match[1], base);
      if (!candidates.some((item) => item.href === candidate.href)) candidates.push(candidate);
    } catch {
      // Ignore unrelated links and assets. Only allowlisted document routes survive.
    }
  }
  return candidates;
}

export function selectLinkedDocumentCandidate(html: string, base: string) {
  const candidates = htmlCandidates(html, base);
  return candidates.find((url) => /notaprintpdf\.aspx/i.test(url.pathname))
    || candidates.find((url) => url.hostname === "nfe.prefeitura.sp.gov.br" && /notaprint\.aspx/i.test(url.pathname))
    || null;
}

async function boundedBytes(response: Response) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_DOWNLOAD_BYTES) throw new Error("linked document exceeds the 10 MB download limit");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_DOWNLOAD_BYTES) throw new Error("linked document exceeds the 10 MB download limit");
  return bytes;
}

export async function resolveLinkedPdf(sourceValue: string) {
  let current = validateLinkedDocumentUrl(sourceValue);
  const visited: string[] = [];

  for (let step = 0; step < 6; step++) {
    visited.push(current.href);
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": "LEF-Administration/1.0", accept: "application/pdf,text/html;q=0.9" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("linked document redirect has no destination");
      current = validateLinkedDocumentUrl(location, current.href);
      continue;
    }
    if (!response.ok) throw new Error(`linked document request failed (${response.status})`);

    const bytes = await boundedBytes(response);
    const signature = new TextDecoder("ascii").decode(bytes.slice(0, 5));
    if (signature === "%PDF-") return { bytes, finalUrl: current.href, visited };

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) throw new Error("linked document response is neither HTML nor PDF");
    const html = new TextDecoder("utf-8").decode(bytes);
    const next = selectLinkedDocumentCandidate(html, current.href);
    if (!next) {
      if (/documento\s+protegido|primeiros\s+digitos|captcha/i.test(html)) {
        throw new Error("linked document requires user action");
      }
      throw new Error("no downloadable PDF was found on the linked page");
    }
    current = next;
  }
  throw new Error("linked document exceeded the redirect/page limit");
}
