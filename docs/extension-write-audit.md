# Extension write audit — 2026-09-21

Scope: manifest-loaded browser extension CRM writes, including create/update operations commonly called upserts. Reviewed the runtime router and adapters for people, companies, notes, reminder-note RPCs, deals, campaigns, membership links and prompts. Supabase Auth and separate MCP/Resend work are outside this audit. Historical `background-main-*` copies are not the manifest entry point.

## Note investigation and fixes

- The latest note for the inspected owner was note 36, associated with Manuella Aguiar. Both title and description were null. No record was modified during inspection.
- The editor sends `note_title`; the adapter writes `note_title`; both notes views select the same column. The live note table has no user-defined triggers. No field-name mismatch or title-removing trigger was found.
- Confirmed client defect: `renderNotes()` cleared the list and recreated the open editor from its original values during refresh, losing unsaved input. Automatic profile refresh invokes note refresh. This is a plausible explanation for the reported loss, not proof of the exact browser event sequence.
- Fixed: preserve the same open editor across refreshes for the same person/company, filter and note; reject saves with neither title nor description; require exactly one identified note in create/update responses.
- Verification: `node scripts/test-note-persistence.cjs` covers title serialization, empty response rejection, same-context draft preservation, blank-save prevention and context separation with mocked HTTP/DOM. Live browser behavior remains to be verified. The missing title cannot be reconstructed from the database.

## Remaining findings

| Area | Record matching and field handling | Finding |
| --- | --- | --- |
| Person upsert (`supabaseUpsertInvitation`) | Canonical URL, `on_conflict=linkedin_url`; merges supplied fields | Legacy URLs with different host/slash can create duplicate people. It does not first resolve the existing ID. Response is minimal, so returned identity is not checked. |
| Person profile save and status actions | Database ID; URL-only callers resolve existing record first | Fixed in the preceding changes. Exactly one returned ID is required. |
| Person first-message text, enrichment, message counters and archive | Exact canonical URL | Still subject to the demonstrated URL mismatch. Counter increment is a read then write and can lose concurrent increments. No affected-row check. |
| Company quick-link | Exact canonical person URL | Separate from profile edit/save; still subject to URL mismatch and zero-row success. |
| Company upsert | Canonical URL, `on_conflict=linkedin_id` | Same legacy URL duplicate risk. All mapped fields are included, including empty values for omitted inputs, which can erase existing enrichment if a partial payload is sent. Empty response becomes null without an error. |
| Company update by ID | Stable ID; discards empty strings | Cannot intentionally clear fields. Empty response becomes null. Runtime route then calls unexported `LEFSupabaseCompany.normalizeProfileField` and `normalizeLinkedinCompanyUrl` for logging: a successful database update can be reported as a failure. |
| Notes create/update | Title and description mapped correctly; stable note ID for edits | Draft-loss and result checks fixed in this audit. Relationships are intentionally omitted from update. Clearing duration omits the field, so existing duration is retained. Invalid dates silently become now. |
| Notes archive/delete | Stable note ID | Minimal response, no affected-row verification. |
| Reminder-note workflows | Existing atomic RPCs, correctly named `p_note_title`/`p_note_description` | No title mapping mismatch found in adapter or checked-in SQL. Router accepts a missing note as success. RPCs were not executed in production during audit. |
| Deals create/update | Stable deal ID; name, description, phase, company, main contact mapped | Empty returned result can be accepted as success. Invalid numeric value becomes JSON null through `Number()` and serialization. |
| Campaign create/update/archive | Stable campaign ID | Empty result becomes null and can be reported as success. Blank name/color are ignored on update. |
| Person-campaign membership | Person and campaign IDs | Insert checks for existence before writing; concurrent callers can race. Unlink has no affected-row check. |
| Prompt create/update/rename | Stable prompt ID; UI names mapped to prompt columns | No field-name mismatch found. Empty result becomes null and can be reported as success. |

The live `archived` columns on both people and companies are boolean. Existing archive adapters serialize numeric 0/1; these should be made explicitly boolean and verified against the Data API. This audit did not test whether the deployed API currently coerces numeric JSON values.

## Follow-up order

1. Resolve all remaining person writes and URL upserts to existing IDs, retaining authenticated requests and checking returned identity. Avoid automatic data merging or URL migration.
2. Fix the company route's logging exception and confirm create/update responses across adapters.
3. Make partial-update and clear-field semantics explicit for company fields and note duration; add focused regression coverage before changing those semantics.

These remaining findings are not represented as fixed by the note changes. Production mutations, schema changes and bulk data corrections were not performed.
