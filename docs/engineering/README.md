# engineering docs

these documents define the engineering standards for this chrome mv3 extension.

## rule hierarchy

if rules conflict, apply them in this order:

1. architecture contract (`architecture.md`)
2. folder structure (`folder-structure.md`)
3. message contracts (`messages.md`)
4. api standards (`api-standards.md`)
5. naming (`naming.md`)
6. state management (`state-management.md`)
7. text content (`text-content.md`)
8. ui theming (`ui-theming-rules.md`)

## how to use this in development

- before implementing a change, identify which context it touches:
  - content script (dom extraction only)
  - popup (ui + orchestration)
  - background service worker (storage/network/permissions)
- keep responsibilities separated as defined in `architecture.md`
- if you add a new behavior that affects a contract (messages, folder structure, api), update these docs in the same change

## default principles

- minimal surface area: prefer small, composable modules
- structured-first extraction: prefer dom + structured data, then fallback heuristics
- no silent failures: errors must be visible in devtools and mapped to user-friendly status text
- privacy by default: do not log or persist secrets and do not send raw page html to llm
