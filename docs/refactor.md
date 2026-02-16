# refactor.md — Quality + Safety Refactor Playbook (No Behavior Change)

## How to use
When the user says: **"execute refactor.md"**, follow **only** the instructions in this file and ignore other chat context, unless the user explicitly adds new constraints for this run.

---

## Objective
Perform a **quality + safety refactor** that:
- removes duplicated logic (reuse shared helpers where possible)
- improves separation of concerns (UI vs scraping vs background/API)
- fixes GUI inconsistencies (spacing, alignment, truncation, disabled states)
- mitigates security hazards
- **must not change addon behavior** in any way (same flows, same UI, same API calls, same storage keys, same message types)

---

## Hard constraints (non-negotiable)
- **No feature changes.**
- **No behavior changes.**
- No endpoint/headers/query/body changes for network calls.
- No changes to message passing contracts (type names, required payload fields).
  - Adding **optional** fields is allowed if it does not break existing handlers.
- No changes to user-facing copy unless fixing a clear typo/duplicate label.
- Do not remove logs used for debugging; remove only clearly dead/unreachable noise.
- Never render scraped/untrusted content with `innerHTML`.

---

## Scope
Refactor only these files (plus sidepanel files if present):
- `popup.js`
- `content.js`
- `background.js`
- `popup.html`
- `popup.css`

---

## Required process (do in order)

### 1) Inventory and duplicate detection
Identify duplicated logic across files, especially:
- string normalization / whitespace collapsing
- safe DOM querying + trimming
- log prefixing with reqId
- building stable keys
- chrome.runtime.sendMessage wrappers + error normalization
- UI render helpers used both in popup + sidepanel

### 2) Extract shared helpers
Create **one** shared helper module:
- `shared/utils.js` (or similar)
- Must be small, dependency-free, and easy to audit.
Replace duplicates with calls to shared helpers.

### 3) Separation of concerns
Enforce boundaries:
- `content.js`: DOM scraping only, returns structured data
- `popup.js`: UI state, event listeners, rendering only
- `background.js`: API calls, storage, orchestration only

Organize each file with consistent sections:
- constants
- DOM bindings
- event listeners
- messaging
- rendering
- helpers

### 4) GUI consistency audit + fixes (no behavior change)
Fix purely-presentational inconsistencies:
- consistent spacing/alignment
- consistent button size + padding
- one-line truncation with ellipsis where intended
- fixed row heights where intended
- checkbox/label alignment
- ensure broad CSS selectors do not leak into unrelated UI

### 5) Security hazards audit + mitigations
Mitigate without behavior change:
- DOM injection: no `innerHTML` for untrusted/scraped content
- clipboard: ensure copy occurs only from user gesture path (keep behavior)
- logging: never log secrets/tokens
- message passing: validate message types; avoid responding with excess data
- URL opening: validate URLs (only expected host) before opening

### 6) Remove dead/unused code
Remove:
- unused variables/functions
- unreachable branches
- unused CSS classes
- duplicated event handlers
**Only when confidently unused.**

### 7) Final sanity pass
- No missing imports
- No syntax errors
- Popup & sidepanel still load
- Message extraction still works
- Debug logs still work

---

## Output format (strict)
After applying changes:
- Output **only** a brief bullet list (max 8 bullets) of what changed.
- **No diffs.**
- **No full file dumps.**
