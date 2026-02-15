# naming conventions

this document defines naming standards for the chrome mv3 extension.

consistency in naming improves readability, maintainability, and llm-assisted development quality.

if any naming rule conflicts with architecture.md, architecture.md wins.

## general principles

- prefer clarity over brevity
- avoid abbreviations unless widely understood (e.g., api, dom)
- avoid ambiguous names like data, utils, helper
- names must reflect responsibility, not implementation detail

---

## folders

style: kebab-case

examples:
- background
- content
- popup
- extractors
- shared

forbidden:
- camelCase folders
- generic folders like misc, stuff, helpers

---

## files

style: kebab-case.js

examples:
- background.js
- content.js
- selectors.js
- offscreen-clipboard.js
- message-router.js
- profile-extractor.js

rules:
- filename should describe the primary responsibility
- avoid multiple unrelated responsibilities in one file

---

## functions

style: camelCase

examples:
- extractProfile()
- extractCompany()
- normalizeText()
- generateInvite()
- copyToClipboard()

rules:
- function names must start with a verb
- avoid vague names like handle(), process(), doStuff()
- extraction functions must start with extract

---

## constants

style: UPPER_SNAKE_CASE

examples:
- MAX_INVITE_LENGTH
- DEBUG
- MESSAGE_TIMEOUT_MS

rules:
- constants must be immutable
- configuration constants should be centralized (constants.js)

---

## message types

style: UPPER_SNAKE_CASE

examples:
- PROFILE_EXTRACT_REQUEST
- PROFILE_EXTRACT_RESULT
- INVITE_GENERATE_REQUEST
- INVITE_GENERATE_RESULT
- CLIPBOARD_COPY_REQUEST
- CLIPBOARD_COPY_RESULT
- ERROR

rules:
- message types must be unique
- never hardcode string literals inline in multiple places
- define message types in a shared location when the project scales

---

## data objects

style: snake_case keys

example profile_context:

{
  full_name: string,
  headline: string,
  company: string,
  location: string,
  about: string,
  recent_experience: string[],
  profile_url: string
}

rules:
- avoid mixing camelCase and snake_case in the same object
- do not use null unless explicitly required
- prefer empty string "" or empty array []

---

## boolean naming

style:
- is*
- has*
- can*
- should*

examples:
- isLoading
- hasError
- canCopy
- shouldRetry

forbidden:
- flags like flag1, state2

---

## dom selectors

selectors must:
- be centralized in selectors.js
- be named descriptively

example:

const SELECTOR_TOP_CARD_COMPANY = 'main a[href*="/company/"]';

forbidden:
- inline long selectors inside business logic
- duplicating selectors across files

---

## error codes

style: UPPER_SNAKE_CASE

examples:
- EXTRACTION_FAILED
- GENERATION_FAILED
- CLIPBOARD_FAILED
- NETWORK_TIMEOUT

rules:
- error codes are stable identifiers
- error messages may change, codes should not
