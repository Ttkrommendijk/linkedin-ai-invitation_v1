import { teamsTools } from "../supabase/functions/lef-microsoft365-oauth/teams-channel-read.mjs";
import ts from "npm:typescript@5.7.3";
import Ajv from "npm:ajv@8.17.1";
import addFormats from "npm:ajv-formats@3.0.1";
import { LEF_DIAGNOSTICS_TOOL } from "../supabase/functions/_shared/lef-mcp-observability.ts";

const root = new URL("../", import.meta.url);
const sources = [
  ["administration", "supabase/functions/lef-administration-mcp/index.ts"],
  ["assistant", "supabase/functions/lef-assistant-mcp/index.ts"],
  ["crm", "supabase/functions/lef-crm-mcp/index.ts"],
  ["projects", "supabase/functions/lef-projects-mcp/index.ts"],
  ["reminders", "supabase/functions/lef-reminders-mcp/index.ts"],
  ["microsoft365", "supabase/functions/lef-microsoft365-oauth/index.ts"],
] as const;

type JsonValue = null | boolean | number | string | JsonValue[] | {
  [key: string]: JsonValue;
};
type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, JsonValue>;
};

function propertyName(node: ts.PropertyName): string {
  if (
    ts.isIdentifier(node) || ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node)
  ) return node.text;
  throw new Error(`Unsupported property name: ${node.getText()}`);
}

function extractTools(path: string): Tool[] {
  const text = Deno.readTextFileSync(new URL(path, root));
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const declarations = new Map<string, ts.Expression>();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        declarations.set(declaration.name.text, declaration.initializer);
      }
    }
  }

  const resolving = new Set<string>();
  const evaluate = (node: ts.Expression): JsonValue | undefined => {
    while (
      ts.isAsExpression(node) || ts.isSatisfiesExpression(node) ||
      ts.isParenthesizedExpression(node)
    ) node = node.expression;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      return node.text;
    }
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) {
      const value = Number(node.operand.text);
      return node.operator === ts.SyntaxKind.MinusToken ? -value : value;
    }
    if (ts.isIdentifier(node)) {
      if (node.text === "undefined") return undefined;
      if (node.text === "teamsTools" && path === "supabase/functions/lef-microsoft365-oauth/index.ts") return JSON.parse(JSON.stringify(teamsTools)) as JsonValue;
      const initializer = declarations.get(node.text);
      if (!initializer) {
        throw new Error(`Unresolved identifier ${node.text} in ${path}`);
      }
      if (resolving.has(node.text)) {
        throw new Error(`Circular constant ${node.text} in ${path}`);
      }
      resolving.add(node.text);
      const value = evaluate(initializer);
      resolving.delete(node.text);
      return value;
    }
    if (ts.isArrayLiteralExpression(node)) {
      const result: JsonValue[] = [];
      for (const element of node.elements) {
        if (ts.isSpreadElement(element)) {
          const value = evaluate(element.expression);
          if (!Array.isArray(value)) {
            throw new Error(`Array spread is not an array in ${path}`);
          }
          result.push(...value);
        } else {
          const value = evaluate(element);
          if (value !== undefined) result.push(value);
        }
      }
      return result;
    }
    if (ts.isObjectLiteralExpression(node)) {
      const result: Record<string, JsonValue> = {};
      for (const property of node.properties) {
        if (ts.isPropertyAssignment(property)) {
          const value = evaluate(property.initializer);
          if (value !== undefined) result[propertyName(property.name)] = value;
        } else if (ts.isShorthandPropertyAssignment(property)) {
          const value = evaluate(property.name);
          if (value !== undefined) result[property.name.text] = value;
        } else if (ts.isSpreadAssignment(property)) {
          const value = evaluate(property.expression);
          if (!value || Array.isArray(value) || typeof value !== "object") {
            throw new Error(`Object spread is not an object in ${path}`);
          }
          Object.assign(result, value);
        } else {
          throw new Error(
            `Unsupported object member ${property.getText()} in ${path}`,
          );
        }
      }
      return result;
    }
    throw new Error(
      `Unsupported expression ${
        ts.SyntaxKind[node.kind]
      }: ${node.getText()} in ${path}`,
    );
  };

  const toolsExpression = declarations.get("tools");
  if (!toolsExpression) {
    throw new Error(`No top-level tools declaration in ${path}`);
  }
  let tools: JsonValue | undefined;
  if (
    ts.isCallExpression(toolsExpression) &&
    ts.isPropertyAccessExpression(toolsExpression.expression) &&
    toolsExpression.expression.name.text === "filter" &&
    ts.isIdentifier(toolsExpression.expression.expression)
  ) {
    const sourceTools = evaluate(toolsExpression.expression.expression);
    const allowedExpression = declarations.get("allowedToolNames");
    if (
      !Array.isArray(sourceTools) ||
      !allowedExpression ||
      !ts.isNewExpression(allowedExpression) ||
      !allowedExpression.arguments?.[0]
    ) {
      throw new Error(`Unsupported filtered tools declaration in ${path}`);
    }
    const allowed = evaluate(allowedExpression.arguments[0]);
    if (!Array.isArray(allowed)) {
      throw new Error(`allowedToolNames is not an array in ${path}`);
    }
    const allowedNames = new Set(
      allowed.filter((value): value is string => typeof value === "string"),
    );
    tools = sourceTools.filter((value) => {
      return Boolean(
        value && !Array.isArray(value) && typeof value === "object" &&
          allowedNames.has(String(value.name)),
      );
    });
  } else {
    tools = evaluate(toolsExpression);
  }
  if (!Array.isArray(tools)) {
    throw new Error(`tools is not an array in ${path}`);
  }
  return tools as unknown as Tool[];
}

const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: true });
addFormats(ajv);
const encoder = new TextEncoder();
const names = new Map<string, string>();
const errors: string[] = [];
const domains = [];
let allTools: Array<Tool & { domain: string }> = [];

for (const [domain, path] of sources) {
  const tools = extractTools(path);
  for (const tool of tools) {
    if (
      !tool || typeof tool.name !== "string" ||
      typeof tool.description !== "string" || !tool.inputSchema
    ) {
      errors.push(`${domain}: malformed tool envelope`);
      continue;
    }
    const prior = names.get(tool.name);
    if (prior) {
      errors.push(`duplicate tool '${tool.name}' in ${prior} and ${domain}`);
    }
    names.set(tool.name, domain);
    if (!ajv.validateSchema(tool.inputSchema)) {
      errors.push(`${domain}.${tool.name}: ${ajv.errorsText(ajv.errors)}`);
    }
  }
  const bytes = encoder.encode(JSON.stringify(tools)).length;
  const schemaBytes = tools.reduce(
    (sum, tool) =>
      sum + encoder.encode(JSON.stringify(tool.inputSchema)).length,
    0,
  );
  const descriptionChars = tools.reduce(
    (sum, tool) => sum + tool.description.length,
    0,
  );
  domains.push({
    domain,
    tool_count: tools.length,
    catalog_bytes: bytes,
    schema_bytes: schemaBytes,
    description_chars: descriptionChars,
  });
  allTools = allTools.concat(tools.map((tool) => ({ ...tool, domain })));
}

const gatewayTools = [LEF_DIAGNOSTICS_TOOL as Tool];
for (const tool of gatewayTools) {
  const prior = names.get(tool.name);
  if (prior) {
    errors.push(
      `duplicate tool '${tool.name}' in ${prior} and unified_gateway`,
    );
  }
  names.set(tool.name, "unified_gateway");
  if (!ajv.validateSchema(tool.inputSchema)) {
    errors.push(`unified_gateway.${tool.name}: ${ajv.errorsText(ajv.errors)}`);
  }
}
domains.push({
  domain: "unified_gateway",
  tool_count: gatewayTools.length,
  catalog_bytes: encoder.encode(JSON.stringify(gatewayTools)).length,
  schema_bytes: gatewayTools.reduce(
    (sum, tool) =>
      sum + encoder.encode(JSON.stringify(tool.inputSchema)).length,
    0,
  ),
  description_chars: gatewayTools.reduce(
    (sum, tool) => sum + tool.description.length,
    0,
  ),
});
allTools = allTools.concat(
  gatewayTools.map((tool) => ({ ...tool, domain: "unified_gateway" })),
);

const largest = [...allTools]
  .map((tool) => ({
    domain: tool.domain,
    name: tool.name,
    bytes: encoder.encode(JSON.stringify(tool)).length,
  }))
  .sort((a, b) => b.bytes - a.bytes)
  .slice(0, 10);

const result = {
  valid: errors.length === 0,
  errors,
  total_tool_count: allTools.length,
  total_catalog_bytes: encoder.encode(
    JSON.stringify(allTools.map(({ domain: _domain, ...tool }) => tool)),
  ).length,
  total_schema_bytes: domains.reduce((sum, item) => sum + item.schema_bytes, 0),
  total_description_chars: domains.reduce(
    (sum, item) => sum + item.description_chars,
    0,
  ),
  domains,
  largest_tools: largest,
  tool_names: allTools.map((tool) => tool.name),
};

console.log(JSON.stringify(result, null, 2));
if (errors.length) Deno.exit(1);
