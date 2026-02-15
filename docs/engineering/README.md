# LEF LinkedIn Invite Generator – Engineering Documentation

This document defines the rule hierarchy and how documentation should be interpreted.

---

## Rule Hierarchy (Highest Authority First)

1. architecture.md  
2. security-and-api.md  
3. ui-spec.md  
4. conventions.md  
5. This README

If two documents conflict, the one higher in the list prevails.

---

## Current Scope

Chrome Extension (Manifest v3):

- Extract LinkedIn profile data (content script)
- Generate invite via OpenAI (background)
- Persist to Supabase (background)
- Generate first message
- Manage invitation lifecycle status
- Copy invitation to clipboard via user gesture (popup)

---

## Implementation Status Philosophy

Documentation reflects:

- ✅ Current implementation (accurate)
- 🚧 Planned improvements (clearly marked)

We avoid describing aspirational architecture as if already implemented.
