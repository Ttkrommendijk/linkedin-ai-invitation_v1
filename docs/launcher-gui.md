# Focused LEF launcher GUI

Agreed and implemented: 2026-09-21.

## Product intent

One LEF executable opens visible Chromium with the existing LEF extension. The launcher answers three questions: what action to perform, which people it applies to, and what happened to each person. The full extension remains available through its native browser surfaces; its unrelated Detail, Today, To Do and Companies screens are not launcher navigation.

## Current interface

1. Action: LinkedIn invitations without a note is selected. LinkedIn messages and WhatsApp messages are visibly unavailable; neither has a launcher sending implementation.
2. Recipients: reuse the existing Persons grid, campaign/filter controls, sorting and pagination. Loading takes all matching people in grid order, not merely the visible page. A specific campaign is still required by the existing loader. Review the saved queue before Start. Selection is by filters, not per-row checkboxes in this increment.
3. Progress & results: show every saved profile in order, readable outcome, current step and explanation. Filter to waiting, processed or needs attention. Dry-run checks are explicitly not sent invitations. Existing connections and pending invitations are distinguished from confirmed sends.
4. Settings: reuse existing Supabase account/login/URL and OpenAI API-key controls and Save operation. Hide strategy/model/navigation settings in the launcher only. Existing configuration persistence, authentication and service contracts are unchanged, including the historical Supabase URL override limitation documented in the handoff.

Start, Pause, Skip current, dry-run, current activity and recipient approval remain visible in a sticky run-control area. Show LinkedIn focuses the processing tab or opens LinkedIn if no processing tab exists. The activity log remains expandable. Recovery controls live under Progress & results: requeue dry-run checks, requeue pre-send errors, and synchronize confirmed sends with CRM.

## Persistence and truthfulness

The existing SQLite journal owns operational progress; CRM remains authoritative for people and companies. The table reads that journal, including prior runs. New snapshots save optional display names from the existing overview response; older snapshots show the profile URL slug. No parallel person/company model is introduced.

An existing batch is resumed, not replaced when filters change. This is stated next to Load and above the queue. A first-batch resume URL remains available under a disclosure. Recovery buttons prepare work; Start initiates it. Ambiguous send attempts stay blocked.

Dry-run remains on by default. Live invitations now require one up-front review and approval of the exact batch under Accepted ADR 0024; this does not authorize messages or WhatsApp. Confirmed invitations, CRM synchronization failures and uncertain sends must never share a success label. This implementation changes presentation and exposes existing state, not invitation/company-resolution rules.

## Implementation boundary

The launcher owns its HTML/CSS/JS shell and scopes a presentation stylesheet to its embedded popup document. It invokes existing tab controllers internally to expose only Persons or Configuration. Standalone popup and native side panel are unchanged. The runner adds rows/current-profile/campaign to its local render payload and a Show LinkedIn navigation command. Existing extension messages, Supabase operations, browser sessions and authentication remain intact. No architectural/domain ownership change or database migration is needed under ADR 0001.

## Verification and limitations

Check the packaged executable in visible Chromium: Persons filters and sorting, Settings/API key/login visibility, absence of unrelated launcher tabs, queue order, dry-run vs sent labels, uncertain-send warnings, run-control enabled states, result filters and native popup/side panel. Use fixture state for outcomes without sending customer communication. Recheck batch-order and invitation safety regressions after runner render changes.

This GUI work does not send invitations or prove new LinkedIn layouts. The separate recorded Thiago live test remains the evidence for confirmed invitation delivery. WhatsApp and LinkedIn message sending, per-row recipient selection and replacing a saved batch are future work.

Verified 2026-09-21: all 58 launcher tests passed; the dedicated GUI browser check
passed (scoped Persons, Settings, safe result labels, ordering, filters and controls).
The installed executable passed its smoke checks for native popup, native side panel,
Persons/Settings and default dry-run with no page errors. A separate read-only check
loaded the authenticated Persons grid and displayed the existing saved batch,
including Thiago's confirmed invitation, without issuing any processing commands.
Artifacts are under build/gui-verification and build/focused-gui-smoke (local only).

Column widths: drag the right edge of a header in either Persons or Progress &
results. Persons keeps the extension's existing shared width preferences. Results
stores its own local display preferences and also supports Left/Right arrow keys
on a focused resize handle. Widths survive reloads and restarts. Chromium checks
verified mouse resizing and reload persistence in both grids, plus keyboard resizing
in Results. The hidden Actions column is collapsed at the colgroup level to preserve
alignment of the remaining Persons columns.


## One approval per invitation batch (2026-09-21)

Turn off dry-run and press Start invitations. Review the exact ordered recipient list
and click Approve batch and start once. LEF then proceeds without per-person approval
prompts, for up to one hour and no more than the displayed recipient count. Approval
is tied to the current LEF owner and signed-in LinkedIn browser session. Pause,
restart, session changes, expiry or an error requires fresh approval for remaining
work. Cancel leaves the batch paused. No invitation is sent merely by loading a batch
or opening its approval dialog. Connected/pending checks and ambiguous-send blocks
remain unchanged. Implementation tests use offline fixtures; no live batch was sent
as part of this authorization change.

## Queue columns and manual exclusions (2026-09-22)

Progress & results shows separate Name and Company columns. Loading or resuming
a batch refreshes its display metadata through existing DB_GET_INVITATION and
DB_GET_COMPANY_BY_ID reads (four concurrent lookups, company reads cached per load).
Linked company name takes precedence over the registered company. Lookup failures
retain saved display data and identify it in the company tooltip. No CRM writes or
new CRM schema are introduced. Refresh does not change the saved URLs or order.

While paused, Skip person excludes one eligible row. Skip company excludes eligible
people sharing the linked company ID; where a link is missing, the displayed company
name is matched exactly ignoring case and outer whitespace. Restore returns a manually
excluded person to their previous checkpoint. These actions affect only this saved
batch and persist across restarts. CRM records and the last processed URL are unchanged.
Attempted/confirmed sends and other existing skip outcomes cannot be reset through
these controls. Any queue edit invalidates the previous batch approval.

All seven result columns remain resizable. Existing five-column widths migrate to
the expanded layout, preserving the widths of the original columns.

Startup display repair: older operational queues contain URLs without name/company
metadata. The launcher now reads CRM details on startup after verifying the saved
LEF account, without requiring another Load/resume click. It stays paused and does
not change invitation checkpoints. Missing authentication or failed reads are
reported in the status and Company column, rather than implying no company exists.
Load/resume remains available to refresh after sign-in. Tests recreate a legacy
queue with no metadata and verify linked-company precedence, registered-company
fallback and preserved manual exclusions.

Generated text in the Prompts tab preserves paragraph breaks in API and Codex
mode. Generation requests ask for short paragraphs separated by blank lines.
Preview and Copy retain those newlines, within the existing length limit. The
shared clamp helper keeps its previous single-line default for other callers.
Native popup/side-panel tests verify multiline output through the Copy handler;
the installed extension assets include this change. Previously generated flattened
text needs to be regenerated.

Generate clears the previous preview immediately and disables duplicate generation
while work is pending. The footer remains Generating message despite unrelated
background status updates. A local, persistent status reports completion or failure
beside the generation controls; failure leaves the preview empty and re-enables
Generate. Native-view tests cover delayed responses, unrelated Ready updates,
successful copy and failed-generation recovery.
