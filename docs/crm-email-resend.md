# CRM email through Resend

## Current state — 2026-09-21

The additive backend is deployed to CRM project `nkhujuqjnbzsfqyqfndc`:

- `lef-crm-mcp` version 17: five additional authenticated email tools and Vault support.
- `lef-crm-email-events` version 1: signed webhook and token-based unsubscribe handling.
- Migration `crm_resend_email_delivery`: settings, drafts/delivery records,
  suppressions, minimal events, and atomic creation of existing CRM email notes.
- Live unified discovery returns 130 tools, including the five new CRM operations.

**Sending verified:** Resend accepted the authorized owner test email, provider ID
`01a0c43f-8ad3-70bc-837f-c1c1e1c9ef65`, at 2026-09-21 13:54:53 UTC.
The existing Vault key is now supported through a service-role-only RPC; no key
copy is required. The environment key takes precedence when present. The private
Vault reader checks the service-role JWT claim and exposes only RESEND_API_KEY.
Both anonymous and authenticated client roles lack execute permission.
**Delivery webhook verified:** the user created the webhook in Resend and saved
`RESEND_WEBHOOK_SECRET` in Vault. Its value was copied server-side into the existing
owner's isolated webhook settings without displaying the secret. On rotation, copy
the updated Vault value into that settings row again; this is a configured snapshot.
The fresh owner test `01a0c446-ecd7-7560-b8a1-d495d17fa4bc` received real signed
`email.sent` and `email.delivered` callbacks. Delivery occurred at 14:03:01 UTC on
2026-09-21. This confirms delivery to the recipient mail server, not inbox placement.
The sending-only API key remains sufficient; no broader key is required.
No HDI email was sent.

Configured owner: the existing Supabase user with email `tiago@lef.tec.br`.
From: `Tiago — LEF <tiago@mail.lef.tec.br>`.
Reply-To and authorized setup-test recipient: `tiago@lef.tec.br`.
No browser composer, bulk sender, automatic sequence or diagnostic-completion
integration was added. Existing browser/Microsoft 365 behavior is unchanged.

## Tools and workflow

1. `get_crm_email_status` reports safe configuration status.
2. `list_campaign_email_contacts` reads owned active campaign contacts in pages;
   follow `next_after` until null. Addresses and suppressions are reported, but
   membership never establishes permission to email or booth attendance.
3. `prepare_crm_email` saves an immutable recipient/content snapshot. Specify a
   stable message key for each intended message. Customer preparation requires
   an owned contact and explicit `permission_to_email: true` based on evidence.
   Optional campaign membership must already exist. Test mode allows only the
   configured owner test address and cannot link customer records.
4. Show the complete draft to the user. `send_crm_email` requires immediate
   approval (`confirmed: true`) and the exact email ID. One call sends to one
   recipient; there is no unattended bulk processing.
5. `get_crm_email` reports the saved content and independent delivery/failure/click
   timestamps. Accepted means submitted, not delivered or read.

The unique owner/message-key/recipient tuple prevents repeated preparation from
creating duplicates. A conditional state update claims a draft once. Each provider
request uses `crm-email/<email-id>` as its Resend idempotency key. Ambiguous outcomes
are never automatically retried, including after the provider's 24-hour window.
Operators must investigate `sending` or `uncertain` records against Resend evidence;
do not work around them by creating another key and resending blindly.

Resend acceptance records one CRM note atomically with the provider ID. Delivery
events are linked to that ID and deduplicated by their signed event IDs. Out-of-order
events cannot turn a bounce into delivery: timestamps remain separate evidence.
Unsubscribe links show confirmation on GET and suppress on POST, supporting
one-click unsubscribe headers without allowing link scanners' GETs to unsubscribe.

## Finish setup

`RESEND_API_KEY` can be stored in Vault or Edge Function secrets. Full account API permission is
needed to register the webhook automatically; a sending-only key cannot do that.
If registration returns `restricted_api_key`, create the webhook in Resend and configure its
signing secret through an authorized server-side path. Never place keys in browser
storage, source, tool output, or chat.

Webhook URL:
`https://nkhujuqjnbzsfqyqfndc.supabase.co/functions/v1/lef-crm-email-events`

Events: `email.sent`, `email.delivered`, `email.bounced`, `email.complained`,
`email.clicked`, `email.failed`, `email.suppressed`.

`scripts/resend-setup-probe.ts` is a temporary operator deployment template.
Inject a fresh random token's SHA-256 hash and a short absolute expiry into its
placeholders; never commit the token or injected source. It supports only status,
webhook registration for this endpoint, and the fixed authorized owner setup test.
It uses the same email module as CRM. After use, disable the temporary function
immediately. The probe is disabled after each setup session, using a JWT-protected
HTTP 410 stub with no credentials or operations.

After configuring the webhook, send the fixed setup test, inspect signed delivery
evidence, and verify the actual inbox separately. Refresh the LEF app's cached tool
catalog before conversational email use. HDI customer sends still need approved
recipients, permission evidence, copy, diagnostic URL and footer details.

## Verification

- 21 Node tests pass: six existing CRM lookup regressions and fifteen email tests.
- Deno checks pass for the changed CRM and webhook entrypoints and setup template.
- Unified catalog validation passes for 130 unique tools; live diagnostics agrees.
- Transactional live SQL test verifies one note per accepted email; rolled back.
- All four new tables have RLS enabled, no anon SELECT and no authenticated INSERT.
- Unauthenticated live CRM requests and unsigned webhook requests return HTTP 401.
- Security advisor reports informational RLS-without-policy notices for the four
  intentionally server-only tables. No client grants are present. See
  https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy.

Provider acceptance and real signed delivery callbacks are verified. A separate
signed synthetic ignored event returned HTTP 200 without creating delivery facts.
Tracking DNS readiness, real click events and actual inbox placement remain unverified.
The temporary setup probe was disabled again (version 8).

## Architecture and rollback

Governed by `D:/development/Personal assistant/docs/adr/0023-confirmed-crm-email-resend.md`.
Disable `crm_email_settings.enabled` to stop sends. Restore CRM version 15 if the
new tools must be removed. Retain unsubscribe handling, history and existing notes.
No customer data is deleted on rollback.
