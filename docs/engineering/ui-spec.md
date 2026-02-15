# ui spec (popup) — linkedin ai invitation extension

this document is the single source of truth for how the popup ui works: tabs, fields, button behavior, persistence, and data flow.

if any document conflicts with this one, this one wins for ui behavior. architecture.md still governs technical boundaries (content/popup/background), but this document defines *what the ui must do*.

---

## overview

the popup must contain exactly **three tabs**:

1) **invitation**
2) **message**
3) **configuration**

the popup is a thin ui layer:
- it renders extracted profile context
- it triggers generation requests (background does networking)
- it triggers db writes (background performs http)
- it never performs external http calls directly

---

## shared concepts

### extracted profile context

the popup maintains an in-memory object `profile_context` (per active linkedin profile) containing minimal structured fields plus an optional excerpt fallback.

minimum keys:

- url (linkedin profile url)
- name
- first_name
- headline (may be empty)
- company (may be empty)
- location (may be empty)
- about (may be empty)
- recent_experience (may be empty)
- excerpt_fallback (sanitized, max 800 chars; may be empty)

rules:
- `excerpt_fallback` must never be stored in the database.
- `profile_context` is refreshed when the popup opens on a profile page.
- `profile_context` must be displayed in the ui (debug/visibility) so the user knows what is being sent to the llm.

### statuses

the database record associated with a profile is keyed by `linkedin_url` (same as `profile_context.url`).

status values used by this extension include:
- generated
- invited
- accepted
- first message sent

(note: more statuses may exist in db, but the ui only sets the ones above unless specified.)

---

## tab: invitation

### purpose  
generate a linkedin connection invitation and manage its lifecycle (generated → invited → accepted).

the profile context is automatically loaded when the popup opens on a linkedin profile page.  
it is pre-constructed and displayed in the “profile context sent to ai” section before generation.

---

### sections in this tab

#### 1) profile context sent to ai (read-only)

- shows the exact structured `profile_context` object that will be sent to the llm.
- includes:
  - url
  - name
  - first_name
  - headline
  - company
  - location
  - about
  - recent_experience
  - excerpt_fallback (sanitized)
- this block is informational only and not editable.

---

#### 2) specific focus (optional)

- single-line input field.
- placeholder example:  
  `e.g. S&OP + Slimstock + SAP S/4HANA go-live`
- purpose:
  - allows the user to steer the invitation toward a specific topic or theme.
- behavior:
  - if non-empty, this value must be included in the payload sent to the llm.
  - if empty, generation proceeds normally without additional focus constraint.

---

#### 3) generate invite (button)

on click:

1. send to background:
   - hardcoded invitation instruction (system prompt)
   - profile_context (exact object shown in ui)
   - specific_focus (if filled)

2. background:
   - calls llm
   - receives:
     - invite_text
     - company
     - headline
   - writes to database:
     - linkedin_url
     - invitation text
     - invitation_generated_at = now
     - company (prefer llm-enriched if non-empty)
     - headline (prefer llm-enriched if non-empty)
     - status = "generated"

3. popup:
   - displays generated invite in preview
   - updates status section

---

#### 4) status

- shows the current invitation state.
- possible values:
  - not generated
  - generated
  - invited
  - accepted

- after successful generation:
  - status = "Generated. Click Copy."

---

#### 5) preview

- read-only display of the generated invitation text.
- always reflects the latest llm output.
- does not auto-copy.

---

#### 6) copy (button)

- copies the preview text to clipboard.
- must only show success if clipboard write succeeds.

---

#### 7) invitation sent (button)

on click:
- updates database:
  - status = "invited"
  - invited_at = now
- updates status display accordingly.

---

#### 8) invitation accepted (button)

on click:
- updates database:
  - status = "accepted"
  - accepted_at = now
- updates status display accordingly.

---

### database write rules (invitation tab)

on generation:
- store:
  - linkedin_url
  - invitation text
  - invitation_generated_at
  - company
  - headline
  - status = "generated"

on invitation sent:
- update:
  - status = "invited"
  - invited_at

on invitation accepted:
- update:
  - status = "accepted"
  - accepted_at

never store:
- excerpt_fallback
- raw html
- api keys
- specific focus text (only used for generation, not persisted)

---

## tab: message

### purpose
generate the first post-acceptance message and track its lifecycle (generated → sent) in the database.

this tab is used only after the invitation has been accepted.  
its objective is to open a lightweight conversation and move the relationship forward.

---

### fields

- **message prompt** (textarea)
  - user-editable prompt that controls the tone, direction, and focus of the first message.
  - default value is provided by the app when no saved prompt exists.
  - persisted in `chrome.storage.sync` under key:
    - `firstMessagePrompt`
  - behavior:
    - when the user modifies the prompt, a **Save prompt** button becomes enabled.
    - the prompt is not auto-saved silently; it must be explicitly saved.
    - clicking **Save prompt** stores the current textarea value in `chrome.storage.sync`.
    - a small status message confirms successful save.

- **profile context preview** (read-only pre/json)
  - shows the exact `profile_context` payload that will be sent for message generation.
  - informational only; not editable.

- **generated first message preview** (read-only textarea or pre)
  - displays the generated first message text.
  - always reflects the latest successful generation.

---

### buttons

1) **save prompt**
   - enabled only when the current textarea content differs from the last saved value.
   - on click:
     - persists the prompt to `chrome.storage.sync`.
     - updates internal state to reflect saved version.
     - shows confirmation status.

2) **generate first message**
   - enabled only when:
     - `profile_context.url` is present.
   - on click:
     - reads the current textarea value (saved or unsaved).
     - sends message to background:
       - payload includes:
         - `profile_context`
         - `message_prompt` (current textarea value)
         - optionally `strategy_core` if implemented.
     - ui shows loading state until response.
   - on success:
     - displays generated message in preview.
     - triggers db update:
       - field_first_message = generated text
       - first_message_generated_at = now
     - must not store excerpt_fallback.
   - on failure:
     - show normalized error message.

3) **copy**
   - copies the generated first message to clipboard.
   - must only show success if clipboard write succeeds.
   - does not change database state.

4) **message sent**
   - enabled only when:
     - `profile_context.url` is present.
     - a generated first message exists (non-empty) OR one exists in db state.
   - on click:
     - triggers db update:
       - status = "first message sent"
       - first_message_sent_at = now.
   - ui reflects success/failure.

---

### message db writes

on generation:
- store only:
  - first_message
  - first_message_generated_at

on message sent:
- update:
  - status = "first message sent"
  - first_message_sent_at

never store:
- message prompt text
- excerpt_fallback
- raw html
- api keys

## tab: configuration

### purpose
configure secrets, endpoints, and defaults. configuration must be explicit and persisted.

### fields (minimum)
1) **openai api key**
- storage: `chrome.storage.local` (never sync)
- masked input in ui if possible
- never logged

2) **openai model**
- storage: `chrome.storage.sync`
- default to current stable model used by the project

3) **webhook base url** (supabase url)
- storage: `chrome.storage.sync`

4) **webhook secret / anon key**
- storage: `chrome.storage.local` (never sync)
- never logged

### buttons
- **save configuration**
  - persists values to correct storage scopes (local vs sync)
  - shows success/failure state

---

## popup initialization behavior

when the popup opens:

1) determine active tab
2) if active tab is a linkedin profile url (`/in/`):
   - request profile extraction from content script
   - store `profile_context` in memory
   - update profile context preview in invitation and message tabs
3) if not on linkedin profile:
   - show status: "open a linkedin profile page to extract context"
   - disable generate buttons

notes:
- popup must handle the case where the content script is not injected (show a clear error)
- extraction must not require clicking generate

---

## error and status display rules

- all async operations must surface success/failure explicitly (no silent failures)
- do not show "copied" unless clipboard write succeeded
- errors must display `error.message` if provided, otherwise a safe fallback
- no raw html/raw excerpt dumps in logs; in ui previews, show only the structured `profile_context`

---

## persistence rules summary

chrome.storage.sync:
- strategy_core
- firstMessagePrompt
- openai model
- webhook base url
- debug mode

chrome.storage.local:
- openai api key
- webhook secret / anon key

database (supabase):
- linkedin_url (key)
- company/headline (if captured)
- invitation text + invitation_generated_at
- status + invited_at + accepted_at
- field_first_message + first_message_generated_at
- first_message_sent_at

forbidden:
- store excerpt_fallback in db
- store api keys anywhere except chrome.storage.local
- store prompt text in db

---

## intentional non-features

- no auto-copy after generation
- no automatic sending of linkedin messages (manual action only)
- no background dom scraping
- no storing full profile text or html
