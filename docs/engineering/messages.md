# message contracts (cross-context communication)

this document defines how communication between popup, content, and background must be structured.

chrome mv3 uses message passing between contexts.
this document ensures messages remain predictable and maintainable.

if any rule conflicts with architecture.md, architecture.md wins.

---

## core principle

all cross-context communication must use a structured envelope.

never send raw untyped objects without a message type.

---

## canonical message envelope

all messages must follow this structure:

{
  type: string,
  request_id: string,
  payload?: object,
  error?: {
    code: string,
    message: string,
    details?: object
  }
}

rules:
- every request must include request_id
- every response must echo the same request_id
- either payload or error must be present (not both)
- error must follow api-standards.md

---

## message type naming

style: UPPER_SNAKE_CASE

allowed types:

PROFILE_EXTRACT_REQUEST
PROFILE_EXTRACT_RESULT

INVITE_GENERATE_REQUEST
INVITE_GENERATE_RESULT

CLIPBOARD_COPY_REQUEST
CLIPBOARD_COPY_RESULT

ERROR

rules:
- message types must be unique
- never inline string literals in multiple files
- centralize message types when project scales (e.g., src/shared/messages.js)

---

## request flow examples

### profile extraction

popup → content

{
  type: "PROFILE_EXTRACT_REQUEST",
  request_id: "uuid",
  payload: {}
}

content → popup

{
  type: "PROFILE_EXTRACT_RESULT",
  request_id: "uuid",
  payload: {
    profile_context: { ... }
  }
}

---

### invite generation

popup → background

{
  type: "INVITE_GENERATE_REQUEST",
  request_id: "uuid",
  payload: {
    profile_context: { ... }
  }
}

background → popup

{
  type: "INVITE_GENERATE_RESULT",
  request_id: "uuid",
  payload: {
    invite_text: "..."
  }
}

---

### clipboard copy (optional centralized pattern)

popup → background

{
  type: "CLIPBOARD_COPY_REQUEST",
  request_id: "uuid",
  payload: {
    text: "..."
  }
}

background → popup

{
  type: "CLIPBOARD_COPY_RESULT",
  request_id: "uuid",
  payload: {
    success: true
  }
}

---

## error handling in messages

if an operation fails:

{
  type: "ERROR",
  request_id: "uuid",
  error: {
    code: "GENERATION_FAILED",
    message: "failed to generate invite"
  }
}

rules:
- do not throw unhandled exceptions across contexts
- always normalize errors
- never include secrets in error details

---

## timeout handling

if a request does not respond within expected time:

- return an ERROR with code: REQUEST_TIMEOUT
- do not leave popup in loading state indefinitely
- popup must clear loading state on timeout

---

## logging policy

rules:
- log message type and request_id for debugging
- do not log full payloads containing personal data
- redact sensitive fields when logging

example safe log:

console.debug("[msg]", type, request_id);

---

## forbidden patterns

- sending dom nodes through messages
- sending full page html
- sending functions in payload
- omitting request_id
