# Agent guide

This is the working repository for the current LEF browser extension. Keep it functional and evolve its GUI incrementally.

The broader LEF ecosystem is brownfield. Before changing behavior, read this repository's documentation and the current-state documents and Accepted ADRs in `D:\development\Personal assistant`.

Product-facing work must also follow `D:\development\Personal assistant\docs\product\operating-model.md`, while preserving its distinction between desired behavior and current capability.

- Preserve existing browser, Supabase, PostgREST/RPC, authentication, and message contracts.
- Do not rebuild domain capabilities already owned by LEF Administration, CRM, Reminders, or another existing service.
- Treat direct database behavior and RLS assumptions as compatibility-sensitive.
- Keep new GUI work separate from domain ownership decisions.
- Record material architectural changes in an ADR in the `Personal assistant` repository.
- Record unknowns rather than silently inventing details.
- Do not begin repository consolidation or a web migration without a later Accepted ADR.

ADR 0001 establishes that this extension remains the current client in its own repository for now; a future web client is possible but not yet designed.
