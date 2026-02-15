# api standards

this document defines how external communication and networking must be implemented in this chrome mv3 extension.

if any rule conflicts with architecture.md, architecture.md wins.

---

## core principle

all external http communication must go through the background service worker.

popup and content scripts must never directly call external apis.

---

## networking location

allowed location for external http:
- src/background/network.js (or background.js if not yet modularized)

not allowed:
- fetch calls inside content.js
- fetch calls inside popup.js (unless explicitly approved and documented)

reason:
- centralizes error handling
- centralizes retry policy
- prevents token leakage
- keeps architecture clean

---

## request flow

canonical flow for invite generation:

1. popup sends:
   { type: INVITE_GENERATE_REQUEST, request_id, payload }

2. background receives request
3. background performs fetch to openai or proxy
4. background normalizes response
5. background sends:
   { type: INVITE_GENERATE_RESULT, request_id, payload }

popup never calls openai directly.

---

## payload minimization

rules:
- never send raw html to the api
- send only structured profile_context fields
- do not include unnecessary linkedin metadata
- redact emails or phone numbers if detected

example allowed payload:

{
  full_name: "john doe",
  headline: "software engineer",
  company: "acme",
  about: "...",
  recent_experience: ["..."]
}

---

## error normalization

all api errors must be normalized to this structure:

{
  code: string,
  message: string,
  details?: object
}

example:

{
  code: "NETWORK_TIMEOUT",
  message: "request timed out",
  details: { timeout_ms: 10000 }
}

rules:
- do not return raw fetch errors to popup
- do not expose api keys in error details
- error codes must follow naming.md

---

## timeout policy

rules:
- all external requests must define a timeout
- default timeout: 10 seconds
- use abortcontroller for fetch cancellation

example policy:
- if timeout occurs, return NETWORK_TIMEOUT
- do not silently retry more than once

---

## retry policy

rules:
- retry only on transient errors (network, 5xx)
- maximum 1 retry
- no retry on 4xx (bad request, unauthorized)

---

## rate limiting

if api usage increases:

- implement simple in-memory throttling in background
- do not throttle in popup
- do not block ui thread

---

## secrets handling

rules:
- api keys must not be hardcoded in source
- if stored, use chrome.storage (never localStorage)
- do not log secrets
- do not expose secrets to content scripts

---

## response validation

rules:
- validate api response shape before sending to popup
- ensure generated invite is a string
- enforce max length before returning to popup

example validation:

- typeof result === "string"
- result.length <= MAX_INVITE_LENGTH

if invalid:
- return GENERATION_FAILED
