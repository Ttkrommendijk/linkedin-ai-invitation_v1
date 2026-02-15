# Architecture

## High-Level Flow

LinkedIn Page (content.js)
    ↓
Popup (popup.js)
    ↓
Background (background.js)
    ↓
External APIs:
    - OpenAI Responses API
    - Supabase REST

---

# Strict Runtime Boundaries

## content.js
- Reads DOM only
- No network calls
- Returns structured profile object

## popup.js
- Handles user interaction
- Calls background via chrome.runtime.sendMessage
- Clipboard operations only occur inside explicit user gesture handlers
- Direct DOM updates (see Current State section)

## background.js
- Owns all external HTTP calls
- Implements:
  - OpenAI calls
  - Supabase writes
  - Timeout policy
  - Retry policy (OpenAI only)
  - JSON schema validation
- Normalizes errors before returning to popup

---

# Clipboard Policy

- Clipboard must only execute inside direct user gesture
- UI must never show "Copied" unless copy promise resolves

---

# Data Minimization

- Only structured fields + sanitized excerpt are sent to OpenAI
- Emails and phone numbers redacted in excerpt_fallback
- Only required DB fields persisted

---

# CURRENT STATE vs TARGET STATE  (A)

## CURRENT IMPLEMENTATION

- Selectors are defined inline in content.js
- Extraction logic is monolithic but contained
- Popup uses direct DOM updates and local variables for state
- Message envelope is minimal (no request_id)

This is intentional for simplicity and small scope.

## TARGET (Future Refactor)

If complexity increases:
- Centralize selectors into a selector module
- Split extraction into pure extractors
- Introduce request_id-based message envelope
- Introduce lightweight state module in popup

Current implementation is compliant by design.
