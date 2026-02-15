# architecture contract (chrome mv3 extension)

this project is a chrome extension (manifest v3) with three runtime contexts:

- content script (`content.js`)
- popup ui (`popup.html` + `popup.js`)
- service worker (`background.js`)

the purpose of this document is to define strict boundaries so development remains consistent, testable, and reliable.

## boundaries and responsibilities

### content script (content)
allowed:
- read and parse the linkedin profile page dom
- return a structured `profile_context` object
- perform light text normalization and heuristics for extraction

not allowed:
- any network calls (`fetch`, openai, etc)
- writing to clipboard
- storing secrets or tokens
- storing long-lived user data
- logging raw dom/html content

### popup (ui)
allowed:
- render status and preview
- trigger extraction (request profile data from content)
- request invite generation (call background to perform network)
- handle copy action from a direct user gesture (copy button)

not allowed:
- direct openai/external http calls (must go through background)
- injecting scripts into tabs for core logic (allowed only for isolated dom reads when content cannot)

### background (service worker)
allowed:
- external http calls (openai api or a proxy)
- token storage (chrome.storage) if needed
- orchestration and routing of messages
- offscreen document management (if used for clipboard)
- centralized error normalization and retry policy

not allowed:
- interacting with the dom
- storing raw profile page html
- logging secrets

## data flow

the canonical flow:

1. popup requests profile extraction
2. content script extracts structured data and returns `profile_context`
3. popup requests invite generation from background (sends only `profile_context`)
4. background performs http request and returns generated invite text
5. popup renders the invite
6. user clicks copy and popup performs clipboard write

## clipboard policy

clipboard is security-sensitive and user-gesture gated.

rules:
- default: clipboard write must occur directly from the copy button handler
- do not auto-copy after async operations (extraction/generation), unless an approved offscreen clipboard pattern is implemented
- do not show "copied" status unless the clipboard write succeeded

## extraction policy (linkedin dom)

linkedin changes frequently; extraction must be resilient.

rules:
- prefer structured sources in this order:
  1) explicit dom selectors (top card, company links, etc)
  2) ld+json (application/ld+json)
  3) section-based parsing (experience section)
  4) raw text fallback (last resort)
- each extractor should be isolated and testable (pure functions where possible)
- selectors must be centralized (do not scatter selectors across the codebase)

## privacy and minimization

rules:
- never send raw page html to the llm
- send only minimal structured fields required for generation
- do not store extracted profiles or generated invites unless the user explicitly opts in (future feature)
- redact emails/phones if detected in extracted text before sending to background

## error handling and observability

rules:
- no silent failures
- every async entrypoint must `try/catch` and return a normalized error
- debug logging must be gated behind a `DEBUG` flag
- never log api keys, tokens, or raw page html

## rule precedence

if any other document conflicts with this one, this document wins.
