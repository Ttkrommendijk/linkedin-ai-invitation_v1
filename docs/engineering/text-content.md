# text content standards

this document defines how user-facing text must be handled in the popup ui.

the goal is consistency, maintainability, and llm-assisted development clarity.

if any rule conflicts with architecture.md, architecture.md wins.

---

## core principle

no user-facing text should be hardcoded inside business logic.

all visible strings must be centralized.

---

## text location

all popup user-facing text must live in:

src/popup/text.js

example:

export const text = {
  status_idle: "ready",
  status_extracting: "extracting profile…",
  status_generating: "generating invite…",
  status_ready: "generated. click copy.",
  status_copy_success: "copied to clipboard.",
  error_extraction_failed: "failed to extract profile.",
  error_generation_failed: "failed to generate invite.",
  error_clipboard_failed: "failed to copy to clipboard."
};

rules:
- popup.js must not contain inline user-visible strings
- do not duplicate the same string in multiple places
- use semantic keys, not UI-based keys

good:
  status_generating

bad:
  greenTextUnderButton

---

## status text policy

status text must reflect real state transitions.

allowed statuses:
- idle
- extracting
- generating
- ready
- error

rules:
- do not show success messages unless operation actually succeeded
- do not show "copied" unless clipboard operation returned success
- error text must not expose internal stack traces

---

## invite generation text constraints

generated invites must follow constraints:

- concise
- professional tone
- no emojis unless explicitly configured
- no hashtags
- no markdown formatting
- plain text only

max length:
- enforce MAX_INVITE_LENGTH in background before returning to popup

---

## future internationalization

if i18n is introduced:

- text.js becomes structured per language:

export const text = {
  en: { ... },
  pt: { ... }
}

- do not hardcode language-specific logic in popup.js
- language selection must be explicit and centralized

---

## logging vs user text

rules:
- console logs are not user-facing text
- user-facing errors must be sanitized
- never log api keys or raw profile html

---

## forbidden patterns

- hardcoding status text inside click handlers
- building large user-facing text inline in popup.js
- mixing logic and presentation strings
