export type SafeTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export const LEF_DIAGNOSTICS_TOOL: SafeTool = {
  name: "lef_diagnostics",
  description:
    "Verify live access to the unified LEF Assistant MCP for this exact turn. Returns safe session, catalog, database, and Microsoft 365 connection diagnostics plus recent MCP lifecycle traces. Use this instead of inferring tool availability from conversation history.",
  inputSchema: {
    type: "object",
    properties: {
      client_mode: {
        type: "string",
        enum: ["text", "voice", "unknown"],
        description:
          "Optional explicit label supplied by the user for a text-versus-Voice comparison. The server does not guess the mode.",
      },
      comparison_label: {
        type: "string",
        maxLength: 100,
        pattern: "^[A-Za-z0-9_.:-]+$",
        description:
          "Optional non-sensitive label used to correlate a manual text/Voice reproduction pair.",
      },
      recent_event_limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        description:
          "Maximum number of recent owner-scoped diagnostic lifecycle events to return. Defaults to 20.",
      },
    },
    additionalProperties: false,
  },
};

export async function safeFingerprint(
  namespace: string,
  value: string | null | undefined,
): Promise<string> {
  if (!value) return "not-provided";
  const bytes = new TextEncoder().encode(`${namespace}:${value}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return `sha256:${
    Array.from(digest.slice(0, 12)).map((byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("")
  }`;
}

export function validateToolCatalog(tools: unknown[]): string[] {
  const errors: string[] = [];
  const names = new Set<string>();
  for (const [index, value] of tools.entries()) {
    if (!value || Array.isArray(value) || typeof value !== "object") {
      errors.push(`tool[${index}] is not an object`);
      continue;
    }
    const tool = value as Record<string, unknown>;
    if (typeof tool.name !== "string" || !tool.name) {
      errors.push(`tool[${index}] has no name`);
    } else if (names.has(tool.name)) {
      errors.push(`duplicate tool name '${tool.name}'`);
    } else names.add(tool.name);
    if (typeof tool.description !== "string" || !tool.description) {
      errors.push(
        `${String(tool.name || `tool[${index}]`)} has no description`,
      );
    }
    if (
      !tool.inputSchema || Array.isArray(tool.inputSchema) ||
      typeof tool.inputSchema !== "object"
    ) {
      errors.push(
        `${String(tool.name || `tool[${index}]`)} has no object inputSchema`,
      );
    }
  }
  return errors;
}

export function safeComparisonLabel(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (
    typeof value !== "string" || value.length > 100 ||
    !/^[A-Za-z0-9_.:-]+$/.test(value)
  ) {
    throw new Error(
      "comparison_label must contain only letters, numbers, dot, colon, underscore, or hyphen and be at most 100 characters",
    );
  }
  return value;
}

export function safeClientMode(value: unknown): "text" | "voice" | "unknown" {
  if (value == null) return "unknown";
  if (value === "text" || value === "voice" || value === "unknown") {
    return value;
  }
  throw new Error("client_mode must be text, voice, or unknown");
}
