# LEF browser extension

CRM email setup and deployment status: [Resend integration](docs/crm-email-resend.md).

This repository contains the current working LEF browser client. It began as the LEF LinkedIn Invite Generator and has expanded to support CRM workflows, browser integrations, and contextual reminders.

## Current development direction

The browser extension remains functional and may continue to receive incremental GUI capabilities while the wider LEF Assistant ecosystem evolves.

For now, this repository remains separate from `D:\development\Personal assistant`:

- this repository owns the working browser-extension implementation and its Git history;
- `Personal assistant` holds the brownfield ecosystem baseline, architecture documentation, and ADRs;
- existing Supabase, RPC, browser-message, and user-facing behavioral contracts must be preserved;
- new GUI work should integrate with existing domain owners instead of silently duplicating domain logic;
- a web-based client may be considered later, but no web migration is currently authorized.

The governing decision is `D:\development\Personal assistant\docs\adr\0001-browser-extension-remains-current-client.md`.

The agreed product behavior—including accountability style, memory policy, notification windows, sales reviews, Microsoft 365 requirements, and communication approval—is documented in `D:\development\Personal assistant\docs\product\operating-model.md`. That document states desired behavior; it is not evidence that every capability is already implemented.

## Before changing behavior

1. Read `docs/current-system-handoff.md` and the applicable files under `docs/engineering/`.
2. Check the current-state documentation and Accepted ADRs in `D:\development\Personal assistant`.
3. Determine which existing Supabase, MCP, or domain contract the change touches.
4. Protect existing extension workflows and authenticated data access.
5. Record unknowns rather than guessing and use an ADR for material architectural changes.

Repository consolidation or a web-client migration requires a later explicit decision. Do not infer either from the existence of the architecture workspace.
