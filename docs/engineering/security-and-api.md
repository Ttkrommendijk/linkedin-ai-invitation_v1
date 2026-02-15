# Security and API Standards

This document defines rules for external calls, error handling, and message contracts.

---

# External HTTP Rules

Only background.js may perform network calls.

Popup and content scripts must never call external APIs directly.

---

# Timeout Policy (B – Implemented)

All fetch calls in background must:

- Use AbortController
- Timeout after 15 seconds
- Surface normalized error to popup

---

# Retry Policy (B – Implemented)

OpenAI calls:
- 1 automatic retry allowed
- Only for:
  - Network failures
  - 5xx responses
- Never retry 4xx errors

Supabase:
- No retry (idempotent but intentional minimal behavior)

---

# Payload Minimization

- Send only necessary profile fields to OpenAI
- Excerpt fallback capped at 800 characters
- Redact emails and phone numbers
- Never send raw full page DOM

---

# Error Normalization

Background must return:

{
ok: false,
error: {
code: string,
message: string,
details?: object
}
}


Popup must display user-safe error message only.

Never expose raw stack traces.

---

# MESSAGE CONTRACTS (C)

## CURRENT Minimal Contract

Messages currently implemented:

From popup → background:

- GENERATE_INVITE
- GENERATE_FIRST_MESSAGE
- DB_UPSERT_GENERATED
- DB_UPDATE_FIRST_MESSAGE
- DB_MARK_STATUS

From content → popup:

- EXTRACT_PROFILE_CONTEXT

All responses follow:

{ ok: true, ...payload }


or

{ ok: false, error: {...} }


No request_id currently used.

This is intentional for simplicity.

---

## TARGET Envelope Contract (Future Upgrade)

Future scalable format:

{
type: string,
request_id: string,
payload: object
}


Response:

{
request_id: string,
ok: boolean,
payload?: object,
error?: object
}


This will prevent concurrency mismatches if parallel requests are introduced.
