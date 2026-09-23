# LEF Windows launcher

## Launch

Double-click `D:\development\linkedin ai invitation_v1\dist\LEF\LEF.exe`.
Keep the entire `dist\LEF` directory together, including `_internal`. Python,
Node and an installed Chrome are not needed to run this build. This is one LEF
entry point; the controls and existing CRM UI are extension pages in Chromium.
The executable is a local unsigned build, not a signed installer or auto-updater.

1. Open **Settings** to sign in to LEF. Use **Show LinkedIn** to check the
   LinkedIn account signed in to the launcher's dedicated browser.
2. In **Recipients**, select a campaign and refine filters/sorting in Persons.
   **Load recipients** saves all matching profiles in grid order. Existing saved
   batches are resumed rather than replaced when grid filters change.
3. For a new batch only, **Resume from a profile** optionally excludes that URL
   and all preceding profiles. An absent URL is an error, not a restart at the top.
4. Leave **Dry-run** checked and press **Start dry-run** to inspect profiles without
   invitation clicks or CRM writes. Review **Progress & results** and the activity log.
5. Under **Review and recovery**, requeue dry-run checks if needed. Turn dry-run off
   and press **Start invitations**. Review the exact recipient list and click
   **Approve batch and start** once. There are no per-person prompts in this run.
   Approval covers at most the displayed count, without notes, for one hour. Pause,
   restart, processing error, session/account change or expiry requires a fresh
   approval for the remaining eligible list. Opening the dialog does not start work.

The standard toolbar popup and **Open side panel** remain available. The launcher
tab must remain open while the runner is active; closing it stops the process and
the bundled browser. Use Pause before doing unrelated work in the profile tab.

## Workflow and recovery

- Pending/Pendente profiles skip with no send. Explicitly connected profiles are
  marked invited and connected (`accepted=true`) in LEF in live mode, without sending.
  Existing dates and later message lifecycle states are preserved. Missing invitation/
  acceptance dates use the observation time, not a claim about the historical send date.
  Dry-run logs this proposed reconciliation without writing. Existing
  CRM invitation/acceptance activity also skips, conservatively preventing duplicates.
- Eligible people are looked up through `DB_GET_INVITATION`. Missing people use
  the existing scraper and `DB_UPSERT_GENERATED` without inventing an invitation
  or generated timestamp. Existing company links are verified. Otherwise a unique
  company link in the profile header is resolved through existing company messages;
  a missing company is read from its LinkedIn page, saved and linked through LEF.
  Possible name-only duplicates or multiple employers require manual linking.
- The runner uses Chromium mouse input for Connect, More and final Send. It does
  not move the Windows cursor, call private LinkedIn APIs, or use DOM `click()`.
  It scrolls down/back when visiting profiles and moves the pointer in multiple steps.
  Every possible invitation action (Connect and final Send) reserves a persisted
  random 1–10 second cooldown, extended from completion of the mouse action. Slow
  pages and recipient approval can make the interval longer; this is a minimum
  spacing safeguard, not a promised throughput or a way to bypass LinkedIn limits.
- A durable intent precedes Connect. Only a subsequent Pending/Pendente state in
  the same profile header, with the dialog closed, counts as LinkedIn confirmation.
  CRM invited status is written afterward and read back for verification.
- **Pause** cancels approval and stops subsequent clicks. Commands queued during
  slow reads are checked again before clicks. An already-dispatched click cannot
  be undone. **Skip current** preserves any existing send-attempt block.
- A crash, timeout or pause after send intent without confirmation is **ambiguous**.
  It is never automatically retried, including after restarting or requeuing dry-runs.
  Inspect that person's live LinkedIn state and reconcile manually in LEF.
- **Retry pre-send errors** is only for failures before any Connect/send attempt,
  for example after correcting a company link or signing in. It cannot reset ambiguity.
- **Sync confirmed sends to LEF** retries only CRM recording for locally confirmed
  sends. It never clicks LinkedIn and never downgrades an accepted/later CRM state.
  Turn dry-run off explicitly before using it.

State lives at `%LOCALAPPDATA%\LEF\Launcher\progress.sqlite3`; browser sessions
live beside it in `browser-profile`. Errors appear in the activity journal; startup
failures are in `launcher-error.log`. Keep this directory across upgrades. Do not
delete the journal to retry a send. Back it up only with LEF closed, including any
SQLite WAL/SHM files. These files contain profile URLs and browser credentials and
are not included in Git or the executable bundle.

Only one process can use a given data directory. There is no distributed lock
across computers, different data directories or manual invitation activity.
The batch uses existing offset pagination with a URL tie-breaker for equal sort
values and checks total/duplicates/completeness;
it is not a transactional database snapshot. Avoid editing campaign membership or
sort fields during loading. Ambiguous/non-advancing results fail closed.

## Verified and unverified

Verified locally on Windows with Chromium 145.0.7632.6:

- Built a dry-run executable first; launched it successfully with its bundled browser.
- Existing extension worker, embedded Contacts/Persons and popup Configuration load.
- The real Chrome action popup and native side panel open through extension APIs.
- Dry-run defaults on. The native side-panel context is confirmed by Chrome runtime.
- 35 offline Python/browser tests cover selected-campaign loading, preservation of
  Persons filters/order, rejection of an unselected campaign, state checks, simulated mouse clicks,
  confirmation-before-CRM, company creation/linking contract calls, wrong recipient,
  redirects, unexpected notes, email requirement, pause/skip, expiry, owner changes,
  crash recovery, ambiguity, and CRM-only reconciliation.
- Existing person URL lookup, company scraping and note persistence regressions pass.
  `scripts/test-launcher-crm-contracts.cjs` verifies tied-date pagination and the
  optional connected-reconciliation contract, including historical date preservation.

Live LinkedIn invitations were **not sent**. The Pending confirmations in automated
tests are synthetic fixtures. The new dedicated browser has no imported LEF/LinkedIn
session. Authenticated campaign loading, actual company/person writes, real LinkedIn
markup/localization, actual delivery confirmation, login challenges and production
CRM synchronization remain unverified. The UI can show the extension's existing
unauthenticated list error until login; successful rendering does not prove live data.

The recognizer deliberately requires a visible `main h1` inside the profile header
section and unique scoped controls. Unsupported layouts stop for review; it never
uses a recommendation card's Connect/Pending state. Other page languages or unusual
dialogs may require selector updates after a signed-in dry-run. No paid AI extraction
or credentials outside the existing extension are introduced.

Unattended batch-send approval is **not enabled**. Proposed ADR 0024 in
`D:\development\Personal assistant\docs\adr` specifies a possible bounded-batch
approval change. The current operating model's per-recipient immediate approval
remains implemented.

## Rebuild and test

From the repository in PowerShell with Python 3.13:

```powershell
python -m venv .venv-launcher
./.venv-launcher/Scripts/python.exe -m pip install -r launcher/requirements-lock.txt
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD/.launcher-browsers"
./.venv-launcher/Scripts/python.exe -m playwright install chromium
./.venv-launcher/Scripts/python.exe -m unittest discover -s launcher -p test_launcher.py -v
node scripts/test-person-url-lookup.cjs
node scripts/test-company-scraping.cjs
node scripts/test-note-persistence.cjs
./launcher/build.ps1
./dist/LEF/LEF.exe --smoke-test --data-dir build/smoke-release
```

The windowed EXE returns control to PowerShell immediately; inspect
`build/smoke-release/smoke-result.json` after the test browser closes. Smoke mode
uses an isolated profile, never clicks an invitation and writes a screenshot plus
explicit verification flags. Normal operation uses the stable default data directory.

PyInstaller packages only extension runtime assets and pinned Playwright Chromium.
The source tree, backend `.env`, local profiles and execution journal are excluded.
The distribution is a folder to avoid extracting hundreds of MB on every launch.
See [Playwright's extension loading documentation](https://playwright.dev/python/docs/chrome-extensions).

Rollback: close the launcher and use the normal existing extension. No database,
MCP, RLS, authentication or browser-message contract migration needs undoing.

### Batch snapshot correction (2026-09-21)

Batch loading now requests up to 10,000 rows in one call through the existing
DB_LIST_INVITATIONS_OVERVIEW message, preserving the selected Persons filters and
sort order. It requires the response length to equal the exact total before saving.
If the server caps the response, narrow the grid filters; partial batches are never
saved. Duplicate raw URLs stop with an accurate error rather than claiming the user
changed the list. Count/query diagnostics are local journal metadata.

Verified: 38 Python tests; actual Chromium runtime/background/overview adapter route
with fixture HTTP (`scripts/test-launcher-browser-batch.py`); packaged popup/panel
smoke. Live read-only SQL found 189 distinct campaign URLs, but the user's authenticated
batch load and real LinkedIn actions still require live verification. The precise
cause of the previous repeated rows was not established; one-response loading
removes the cross-request pagination path entirely.

### Visible profile loading correction (2026-09-21)

The profile tab is brought forward before navigation. Profile-heading readiness is
polled for up to 45 seconds after navigation instead of blocking on a 15-second
locator wait; Pause/Skip can be handled during this readiness stage. Login/security
redirects and closed tabs now have explicit recovery messages. A missing heading
still stops; selectors have not been broadened without evidence of the live layout.
The tab stays open for inspection. Navigation itself retains its 30-second timeout.
Fixture tests cover loading/pause, timeout, closed tab and login redirect; the user's
live heading/layout remains unverified. No invitations were sent during verification.

### Live profile diagnosis and verified limits (2026-09-21)

The user's Luis Gustavo Milani profile uses an h2 top-card title and an anchor for
Conectar. Added scoped support using the observed top-card photo marker and its
nearest section (including nested outer sections), while retaining legacy h1 support.
Read-only live verification recognized the correct name, scrolled, classified Connect,
and resolved the exact visible Conectar anchor. No invitation was clicked.

An isolated one-profile dry run then stopped at the company prerequisite: no company
was linked in LEF and the profile header exposed no direct company-page URL. Thus
profile loading/inspection is live-verified; this person's complete CRM preparation
and sending remain unverified. The user's batch was not modified by this diagnostic.

The prior installation failed copying an in-use DLL; the old executable remained.
For this Python-only correction, replace only LEF.exe after the launcher exits, verify
its hash against the tested build, and retain the existing dependencies/extension path.
Saved-batch status now reports waiting/error counts; it no longer describes a failed
profile as successfully processed. Tests: 43 Python cases.

Installed executable hash verified: 7404659D0DBF907140EA1F8826827ADDB38A141FD656D612DAC9A77CCF809E77. Installed-path popup/side-panel smoke passed. Processing errors now return focus to LEF so the stop reason is visible. Normal launcher reopened with existing profile and journal.

### Experience employer navigation (2026-09-21)

Modern top-card employer controls are navigation buttons. The launcher now uses
simulated mouse input to activate the first named organization control, then matches
that exact employer name against company anchors scoped to the Experience section.
Education, feed, recommendations and previous employers cannot supply the match.
An ambiguous or missing match still stops. The profile header is restored afterward.
Numeric company-page redirects may resolve to a slug only after extraction verifies
the page URL and the exact employer name; the resolved URL is looked up before any
creation, preserving existing CRM operations and duplicate checks.

Live read-only verification on Alessandra Steyding completed a full isolated dry run:
Experience resolved company/914294/, and the existing LEF company Compwire Inform?tica
Ltda was found. The dry-run reached ready without a send attempt or CRM writes.
The user's batch was not modified by the diagnostic. Real invitation sending and
actual company creation/link writes were not performed; fixture tests cover linking
and creation. This supersedes the earlier company-resolution limitation for this
observed layout and profile, not every LinkedIn layout.

Experience fix validation: 46 Python tests passed; installed executable popup and side-panel smoke passed. Executable SHA256 AFCD13B49C85F5D06611C149BC79507B05447B2435334ED107270F8500217C92 verified after replacement. Normal LEF reopened with existing data.

### Single-position Experience entries (2026-09-21)

Ricardo Pontes' employer link contains a job title followed by the company name and
an employment-type suffix separated by a middle dot. The matcher now checks each
line and strips that suffix before an exact normalized employer-name comparison.
It retains Experience-section scope, unique URL checks, and rejection of similarly
prefixed company names. Live isolated dry-run verification resolved Sem Parar Corpay
and reached ready without invitation clicks or CRM writes. The saved user batch was
not altered by this verification. Real sending remains unverified.

Suffix fix validation: 48 Python tests passed; installed executable popup/side-panel smoke passed; executable hash verified against the build. Live Ricardo dry-run found company/1014839/, followed its verified redirect to company/sempararcorpay/, and would create/link the company. No matching company was returned by the existing CRM operations. LEF reopened with the saved batch unchanged.

### Variable visible review (2026-09-21)

Each profile now has a fresh review plan: a 2?4 second header pause, 2?4 downward
scrolls of 140?320 pixels with 1?2.5 second pauses, a return sequence with 0.6?1.4
second pauses, and a final 1?2 second header pause. Cursor positions and movement
steps vary within the page. Total planned pauses are approximately 6?22 seconds;
loading, reads and input movement add time. Review waits run through the main state
machine so Pause/Skip remain responsive. Invitation click pacing, state checks,
per-recipient approvals and ambiguity protection are unchanged. This is visible
pacing, not a claim of bypassing LinkedIn automation detection.

Random-review validation: all 50 Python tests passed, including varied plan bounds and pause before invitation. Packaged popup and side-panel smoke passed. Executable-only updater is staged to install after LEF closes; live LinkedIn execution of this pacing change remains unverified.

### Oldest active Experience role (2026-09-21 user decision)

When resolving an unlinked employer, read Experience before trusting the top-card
organization (which may be a school). Open the full Experience list when available.
Among roles explicitly dated Present/o momento, select the earliest month/year.
Grouped company tenure and ended roles do not determine the winner. Exact earliest
month ties between different employers, unreadable active dates, and active entries
without company links stop for review instead of selecting another employer.

The activity log records employer and active role start month. Existing verified
CRM company links are preserved. Live isolated dry-run on Juliano Kawamoto selected
Random Wear (January 2025), resolved company/106333556/ to company/random-wear/, and
reached ready. It would create/link through existing LEF operations; no writes or
invitations were made. CVC and Bauk current roles start in November 2025; the former
Bauk CEO role is excluded because it ended. The random review pacing update is
included in this executable.

Validation: 54 tests passed; packaged popup/side-panel smoke passed; final live isolated Juliano dry-run reached ready with oldest-role selection. Installed executable hash verified against the build; LEF reopened with the existing user batch.

### Grouped role without employment type (2026-09-21)

Humberto Luiz Fadul's Dasa entry groups positions under the company heading. The
current role has title then dates, without an employment-type line. The parser now
uses the group company name in that case and rejects missing group identity instead
of treating the role title as a company. Six targeted employer-selection tests pass,
including the captured Dasa structure, ended-role exclusion and date ambiguity cases.

Humberto live isolated dry-run reached ready: Dasa selected since 2023-10 and existing LEF company found. No invitation or CRM writes. Installed executable hash verified, popup/side-panel smoke passed, and normal LEF reopened with existing progress.

### Authorized single-profile live test: Thiago Muraro (2026-09-21)

User explicitly authorized exactly thiago-muraro-de-araujo-a9682147, company creation
if missing, linking Compwire and one connection invitation. No other profiles were
processed. Existing Compwire Inform?tica Ltda was reused. The first pre-send check
exposed a legacy URL mismatch: linking used exact canonical URL, while the stored
person URL lacked a trailing slash. The existing company-link operation now resolves
the person via the existing URL-variant lookup, updates by ID, and requires a returned
row confirming the company ID. Browser message inputs/outputs, auth and RLS remain
unchanged. Node tests cover slash variants, ID targeting and rejected zero-row/wrong
company updates. Explicit extension reload required developer mode enabled in the
bundled Chromium; runtime source was checked before the live retry.

After that pre-send fix, live linking succeeded and was independently read back:
Thiago links to existing Compwire company 79b55f8d-79cb-41b2-b86b-e9903644eb51.
Connect opened the correct recipient dialog with Enviar sem nota. The final mouse
operation stopped before clicking because hit testing reported another element over
the button. The ledger conservatively records ambiguous send_intent, confirmed=0;
no automatic retry was made. CRM remains generated, invited_at null. This does NOT
verify successful invitation delivery or invited-status synchronization. Screenshot
and result are in local build/thiago-one-live-test (excluded from source control).
A new live attempt needs explicit user direction because prior send intent is blocked.

### Explicitly authorized Thiago retry succeeded (2026-09-21)

After the user explicitly requested a retry, a fresh live read showed Connect and no
CRM invitation. Only Thiago was unblocked for that authorized attempt; previous
attempt events were retained. The final invitation dialog was inside LinkedIn's open
interop shadow root. Document-level elementFromPoint returned its host, falsely
flagging an obstruction. Hit testing now descends open shadow roots to verify the
actual button/descendant; a genuine overlay still blocks. Two targeted browser tests
verify both cases. The same verified recipient dialog was continued once after the
fix, clicking Enviar sem nota by mouse.

Observed live: Thiago Muraro de Araujo changed to Pendente and the dialog closed.
Then existing CRM operations set status invited and invited_at
2026-09-21T22:49:06.264+00:00; read-back confirmed company_id
79b55f8d-79cb-41b2-b86b-e9903644eb51 (existing Compwire Inform?tica Ltda), status invited,
and accepted false. Ledger confirmed=1/outcome invited. No other profiles processed.
Result/screenshot in build/thiago-authorized-retry. This supersedes the earlier failed
single-profile test; it verifies this live send and CRM synchronization, not every
LinkedIn layout. Automatic retries of ambiguous sends remain blocked.

## Focused outreach interface (2026-09-21)

See [launcher GUI specification](launcher-gui.md) for the action, recipients,
results and settings workflow. The launcher now exposes Persons and configuration
without the full extension navigation. Saved progress is shown in a results table.
Invitation approval, dry-run and duplicate protection remain unchanged.

### First-degree connection detection (2026-09-21)

Karina Menegazzo's live top card rendered a visible plain paragraph `· 1º` beside
its verified-name wrapper, without legacy distance-badge classes. The inspector now
recognizes an exact visible first-degree token in that name row, while retaining
legacy badge support and excluding suggested profiles and hidden degree text.

One explicitly requested reconciliation used existing DB_SET_ACCEPTED_AT_NOW with
reconcile_existing_connection, after two live connected-state checks. Read-back:
status accepted, accepted true, invited_at and accepted_at
2026-09-21T23:17:48.914+00:00. These previously missing dates record observation time,
not the unknown original invitation/acceptance dates. No invitation click occurred.
The local journal records connected_reconciled and send_attempted=0. Evidence is
under build/karina-connected. Tests cover modern and legacy first-degree recognition,
hidden/unrelated degree exclusion, and dry-run leaving CRM unchanged.

Batch-approval verification: offline tests confirmed two recipients proceed with
one approval, Pause/restart revoke it, changed selection/session or expiry blocks
execution, and ambiguous sends remain excluded. The GUI test verified exact-list
rendering and approval command binding. The installed executable passed popup,
side-panel and focused-GUI smoke checks. A read-only signed-in preview displayed
117 eligible saved recipients and verified Cancel; no batch was approved or started.
Local artifacts: build/batch-approval-smoke.

### Verified-name wrapper variant: Kenia (2026-09-21)

Kenia Cristina da Silva's live top card placed an extra wrapper above the verified
name, leaving `· 1º` one level beyond the Karina-specific selector. Detection now
walks only name-only ancestors until the visible degree row, stopping at other text
or the profile header boundary. It does not scan the whole header or recommendations.
Five targeted checks passed, including extra wrappers, unrelated/hidden degree text,
connected reconciliation and no-write dry-run.

The explicitly requested live reconciliation verified connected state and used the
existing accepted operation. Read-back: status accepted, accepted true, invited_at
and accepted_at 2026-09-21T23:32:13.322+00:00 (observation time for missing dates).
Journal outcome connected_reconciled, send_attempted=0. No invitation was sent.
Evidence: build/kenia-connected/result.json and connected.png.

Lower top-card Connect prompt: supported by the existing header-scoped action
lookup, including Follow/Message/More above it. A regression fixture confirmed
Connect is chosen from that lower prompt and recommended profiles stay excluded.
Eduardo Gorges' saved run recorded Observed connect on 2026-09-21, then stopped in
company selection because active employers tied for earliest start month. No send
was attempted. This evidence does not attribute LinkedIn's layout to bot detection.

### Employer priority superseded by user instruction (2026-09-21)

Current selection order for an unlinked person:
1. Use the company shown in the profile header. Direct /company/ links are used
   first; scroll/navigation labels are resolved against company links in Experience.
   Education/school entries are not selected merely because they appear in the header.
2. If no header company can be resolved, choose active Experience entries.
3. Choose the oldest active start date; if dates tie, keep the topmost displayed entry.

This supersedes the earlier Experience-first and stop-on-equal-date behavior. Existing
verified CRM company links remain intact. Company lookup/create/link contracts are
unchanged. The log now states whether the company came from the profile header or
Experience. No invitations or CRM writes are part of rule-verification runs.

Verification: the full 71-test suite passed before the final Experience-preview
fallback; all 13 relevant employer tests passed after it, including same-profile
full-page fallback and numeric company redirect reuse. Read-only live checks resolved
Thiago Caserta to Magalu Cloud (101359923) and Eduardo Gorges to Grupo GSH (2194320),
both from their profile-header employer labels. Neither lookup wrote CRM or sent an
invitation. Evidence: build/header-company-priority/result.json.

### Primary-employment filtering (2026-09-21)

Header company remains the first choice. Only when it is unavailable, Experience
ranking now excludes explicitly freelance, self-employed, part-time, advisory,
board, membership and volunteer roles. It prefers current full-time employment,
then current roles with unspecified employment type. Founder/owner titles are not
excluded automatically, and acquisition wording alone is not treated as a side job.
Within the same rank, oldest active start date wins; exact date ties keep the
uppermost displayed entry. Group-level employment type is inherited unless the role
specifies its own type. Ended roles remain ineligible.

If only secondary roles exist, stop for manual primary-company selection instead of
silently using one. The chosen role's classification and excluded secondary roles
are included in the activity log. These are explicit-label heuristics, not a claim
that LinkedIn reliably identifies every side project. Existing verified CRM links
and header-company priority remain intact. This change does not fix Thibor's separate
company-URL validation error or send invitations during verification.

### Continue when a company cannot be found (2026-09-21)

Company absence no longer blocks an invitation. If the inspected Experience has
an active role without a company-page link, no active employer, or no matching
header/Experience company, the launcher logs `company_unavailable` and continues
with the existing person, leaving the company unlinked. This supersedes the earlier
requirement to stop on active roles without company links. It does not invent a
company or clear an existing link. Browser/loading errors, uncertain identity,
unreadable ranking dates and failed CRM operations still stop for review.

The final pre-send check still requires the CRM person and preserves verification
of an existing linked company. Pending/connected checks, batch authorization,
durable send intent and observed confirmation before marking invited are unchanged.
Use Retry pre-send errors to requeue affected profiles; ambiguous sends remain blocked.

CRM status `invited` is checked before opening each LinkedIn profile. Such people
are recorded as `skipped_crm` in dry-run and live mode, even when `invited_at` or
the company link is missing. Existing later checks remain in place for CRM updates
made while a profile is being processed.

### Manual company Save (2026-09-21)

The popup and side panel now save the displayed company fields through the existing
company upsert/update operations without requiring another scrape or AI extraction.
A company name is required. Explicit AI enrichment remains separate. Save errors
remain visible and keep editing open. This fixes the mandatory AI dependency; the
specific cause of the reported MovigoO failure and a live database save remain
unverified. Regression coverage: `node scripts/test-company-save.cjs`.


### Executable schedule and activity budgets (2026-09-22)

In LEF.exe, open Settings > Executable schedule. Default limits: 10 invitation
attempts, 30 profile loads and 10 company loads per rolling 24 hours; minimum
30 minutes between people; Monday-Friday 09:00-17:00 Sao Paulo (UTC-03:00).
The minimum spacing is configurable upward. Scheduling applies to dry-run browsing
too. An already-invited CRM person is skipped before navigation and consumes no
browsing/send allowance. Existing verified CRM company links remain reused.

Counters and settings are local to this executable's persistent SQLite journal.
They survive restarts, retries and settings changes. Failed navigations and ambiguous
send attempts consume allowance. Old invitation intents are imported once; past
browsing was not recorded and cannot be reconstructed. Only launcher-initiated
profile/company navigation is metered: manual browsing, automatic redirects and
other browser/device activity are outside these counters.

The run bar shows used allowances and the next eligible time. Waiting yields to
Pause/Skip. Keep LEF.exe open; there is no background Windows service. Restart
starts paused with dry-run on, and missed time never creates a catch-up burst.
Live approval covers the displayed snapshot until the end of today's work window.
It expires at closing time even if the queue is waiting for tomorrow's allowance.
A new day needs fresh approval. This is documented in Accepted ADR 0024's amendment.

Known English/Portuguese restriction text and login/checkpoint paths stop the queue
and persist a hold. Review the actual LinkedIn notice, resolve it, then acknowledge
it in executable Settings. Acknowledging does not send or resume. Unknown warnings
may still be missed. After intent, unresolved outcomes remain blocked from retry.

No scheduling settings were added to the regular extension popup or side panel.
No live invitations were used to validate this feature. Limits do not guarantee
that LinkedIn will not restrict an account.

Verification: 88 existing/browser/scheduler tests passed together; the four additional
runner integration cases plus eight scheduler tests passed separately. Executable
GUI controls, unsaved edits, running locks and absence from the popup were verified
in Chromium. Bundled popup and native side panel smoke checks passed. No live
LinkedIn send or account-unrestriction claim is made.


### Relaxed review derived from schedule (2026-09-22)

The executable derives a per-person time allowance from working-window duration
and daily invitation limit, never below the configured minimum spacing. Profile
review uses 5% of this allowance (45-180 seconds), distributed across header reading,
small scrolls and returning to the header. Experience reading/scrolling and mouse
clicks pause 1.5-5 seconds per step; company pages receive 8-30 seconds of reading.
At defaults this means 144 seconds of profile review, 4.8-second steps, and 24 seconds
reading a company page. Settings displays these derived values. Budgets and the
minimum interval remain enforced independently; this is not a detection guarantee.
Longer reading waits process Pause/Skip, check working hours and recognized warnings,
and do not navigate back from Experience after the user interrupts. Send confirmation
and ambiguity rules remain unchanged. Extension popup/side-panel behavior is unchanged.


### Configurable activity window (Accepted 2026-09-22)

The user requested an executable-only Activity window selector: 12 or 24 hours.
It applies jointly to invitation attempts, profile loads and company loads. The
existing default remains 24 hours, including older saved configurations. Changing
the window while paused recalculates usage and eligibility from retained timestamps;
it does not clear history. Switching back to 24 hours includes older events again.
Working hours, minimum spacing, warning holds and approval revocation on settings
changes remain in force. Save, then Start for fresh approval; saving never sends.
Validation: 11 scheduler tests and Chromium GUI checks passed, including persistent
window selection, exact expiry boundaries, invalid values and retained history.


### Immediate window updates and start estimate (2026-09-22)

Changing Activity window in executable Settings now saves the valid form while
paused, without requiring another Save click. It does not start the runner. The
rolling usage label/counts update from the persisted selected window. Other form
edits can still be saved using Save executable schedule.

The run bar previews earliest profile-start eligibility before Start is pressed,
using working hours, profile/invitation budgets, minimum spacing and warning holds.
Dry-run ignores invitation budget, but still respects browsing limits and spacing.
Company budget is not a prerequisite to opening a person: it is checked if a company
navigation is needed. This is a schedule estimate, not a promise of sending: CRM,
LinkedIn checks and live approval still apply. Tests cover 12-hour recalculation,
no counter mutations, warning holds, automatic saving and immediate mode switching.


### OpenAI connection modes (2026-09-22)

General configuration is now OpenAI. Use API key preserves the existing background
OpenAI requests and stored key. Use Codex login selects person/company enrichment
through the local executable, using official Codex CLI 0.155.1 and Sign in with
ChatGPT. This mode never falls back to API billing. Other AI text-generation actions
report that API mode is required; LinkedIn invitations without notes are unchanged.

Sign in opens the official Codex browser login. Finish it, then Refresh status.
Sign out affects only LEF's isolated Codex account, not the user's normal Codex app.
Credentials live in LOCALAPPDATA/LEF/Launcher/codex-account, owned by Codex. No
passwords/tokens are rendered, stored in browser storage or passed to CRM. The
standalone browser add-in displays the Codex option disabled with a LEF.exe notice.

Enrichment uses the existing prompts and exact person/company fields. URL identity
and database operations remain with LEF. Structured output is validated before
returning to the existing controllers. Execution uses an isolated working directory,
read-only sandbox, disabled shell tools/web search, and no inherited API credentials.
Usage consumes the signed-in account's allowance; subscription/credit limits apply.

Build dependency: npm install --prefix build/lef-codex --ignore-scripts --no-audit
--no-fund @openai/codex@0.155.1; LEF.spec bundles the Windows x64 runtime and license.
Tests cover provider switching, credential isolation, missing login, failed inference,
output fields and no API fallback. Actual user login and live Codex model output
remain unverified until the user signs in; no model request was made during testing.

#### Native popup/side-panel connection fix (2026-09-22)

The initial tests displayed popup HTML as ordinary tabs. Actual Chrome extension
views do not receive the executable's Playwright binding. Their Codex requests now
travel over the `lef-codex` runtime port to the launcher tab, with sender ID/URL
validation and no retry or API fallback. Keep the launcher tab open. The shared
error formatter now preserves string errors rather than replacing them with
"Unexpected error."

`scripts/test-codex-native-views.py` tests actual Chrome action-popup and native
side-panel targets, including enrichment success and readable failure messages.
The user's existing login was verified as connected and a live Codex enrichment
request using synthetic person data returned correct fields. This supersedes the
earlier unverified-login/model status above. No live LinkedIn-to-CRM enrichment,
CRM writes, or invitation sends were performed for this fix.

#### Model and reasoning selection (2026-09-22)

OpenAI settings retain the existing API `model` key and add separate `codexModel`,
`apiReasoning` and `codexReasoning` preferences. Save config persists them. Selecting
another connection does not overwrite its model. Blank Codex model or reasoning
uses the runtime/model default. API reasoning should remain Model default for
non-reasoning models such as GPT-4.1. The launcher now shows the API model field too.

The Prompts tab has Model for this generation and Reasoning for this generation.
Blank values use the selected provider's saved settings. Overrides are temporary,
not changes to saved defaults or CRM prompt templates. Existing prompts, language,
profile/strategy inclusion and the 1,200-character preview limit are reused.
Codex now supports this Generate-to-Preview action, with a validated text response;
it does not send the generated message. Other legacy generation actions remain
API-only. The API request budget allows reasoning tokens for GPT-5/6 and o-series
models; default GPT-4.1 request behavior remains unchanged.

Validation includes separate saved preferences, temporary override routing, real
Chrome popup/side-panel Generate clicks with fixture responses, CLI arguments,
API request bodies, excluded context and no credential/API fallback. No CRM schema,
authentication contract or invitation automation behavior changed.
The rebuilt executable passed popup/side-panel smoke checks. A live synthetic
prompt request explicitly selecting `gpt-5.6-sol` with `low` reasoning returned
the expected text. API routing was verified with mocked HTTP, not a paid API call.
