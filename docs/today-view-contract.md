# Today view behavioral contract

Status: Initial read-only implementation contract

The Today view gives a concise picture of attention items already represented by current CRM and reminder data. It does not create new task semantics or claim access to Outlook, projects, ideas, memories, website leads, or unrecorded communication.

## Sources

- active persisted reminders from `DB_LIST_REMINDERS`;
- unarchived notes/interactions from `DB_LIST_NOTES`;
- deals from `DB_LIST_DEALS`.

## Current behavior

- Reminders show active open/snoozed items. Attention time is `snoozed_until`, then `due_at`, then `next_review_at`.
- Planned work shows notes with status `planned` dated before the end of the current local day. Past items are labeled overdue.
- Deals needing attention show active phases `identification`, `confirmed`, `first_meeting`, `follow`, and `negotiation`.
- Counts and source limitations are visible even when sections are empty.
- The view is read-only and does not alter reminders, notes, deals, or authentication behavior.
- A refresh reloads all three existing sources.

## Evidence limits

Missing rows do not prove that work or communication did not occur. Outlook Calendar, Outlook Mail, projects, ideas, memories, prospecting time, and website-lead attribution are not available in this version.

## Failure behavior

If one source fails, its section reports that it is unavailable while the other sources remain usable. No empty result should be presented as confirmed non-performance when loading failed.
