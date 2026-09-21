import {
  LEF_DIAGNOSTICS_TOOL,
  safeClientMode,
  safeComparisonLabel,
  safeFingerprint,
  validateToolCatalog,
} from "./lef-mcp-observability.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test("fingerprints are stable, namespaced, and do not expose input", async () => {
  const first = await safeFingerprint("session", "secret-session-id");
  const second = await safeFingerprint("session", "secret-session-id");
  const other = await safeFingerprint("client", "secret-session-id");
  assert(first === second, "fingerprint must be stable");
  assert(first !== other, "fingerprints must be namespaced");
  assert(!first.includes("secret-session-id"), "fingerprint exposed raw input");
  assert(
    await safeFingerprint("session", null) === "not-provided",
    "missing values must be explicit",
  );
});

Deno.test("catalog validation detects malformed and duplicate tools", () => {
  assert(
    validateToolCatalog([LEF_DIAGNOSTICS_TOOL]).length === 0,
    "diagnostic tool must be valid",
  );
  const errors = validateToolCatalog([
    LEF_DIAGNOSTICS_TOOL,
    LEF_DIAGNOSTICS_TOOL,
    { name: "bad" },
  ]);
  assert(
    errors.some((value) => value.includes("duplicate")),
    "duplicate was not detected",
  );
  assert(
    errors.some((value) => value.includes("description")),
    "missing description was not detected",
  );
  assert(
    errors.some((value) => value.includes("inputSchema")),
    "missing schema was not detected",
  );
});

Deno.test("explicit comparison metadata is constrained", () => {
  assert(safeClientMode("voice") === "voice", "voice mode was not accepted");
  assert(
    safeComparisonLabel("voice-20260906:1") === "voice-20260906:1",
    "safe label was not accepted",
  );
  let rejected = false;
  try {
    safeComparisonLabel("contains spaces or content");
  } catch {
    rejected = true;
  }
  assert(rejected, "unsafe comparison label was accepted");
});
