# Conventions

This document defines coding conventions and structural guidelines for the current codebase.

The goal is to reflect the CURRENT implementation accurately while defining optional future targets without forcing refactors.

---

## Naming (D – Maintain Current Convention)

We maintain the current naming patterns and do NOT refactor at this time.

Functions  
- camelCase

Constants  
- UPPER_SNAKE_CASE

Message types  
- UPPER_SNAKE_CASE strings

Profile fields (CURRENT accepted contract)

- A small set of single-word keys is intentionally kept in simple lower form:
  - url
  - name
  - headline
  - company
  - location
  - about

- Multi-word fields use snake_case:
  - first_name
  - recent_experience
  - excerpt_fallback
  - profile_url
  - linkedin_url
  - full_name

This mixed style is the CURRENT accepted contract and does not require refactoring.

Notes:

- `url` represents the extracted URL from the page.
- `profile_url` / `linkedin_url` may be used in normalized or downstream contexts.
- Duplication of URL-style fields is acceptable under the current contract.

Target (optional future upgrade, not required now):

- Full normalization to all-snake_case profile keys.
- Eliminate overlapping URL fields after schema consolidation.

Compliant CURRENT example:

{
  "url": "https://www.linkedin.com/in/example-person/",
  "name": "Example Person",
  "first_name": "Example",
  "headline": "Head of Operations",
  "company": "Acme",
  "location": "Sao Paulo, Brasil",
  "about": "Operations and supply chain leadership.",
  "recent_experience": "Head of Operations at Acme",
  "excerpt_fallback": "Sanitized fallback excerpt text...",
  "profile_url": "https://www.linkedin.com/in/example-person/",
  "linkedin_url": "https://www.linkedin.com/in/example-person/",
  "full_name": "Example Person"
}

---

## Folder Structure (Current)

Flat structure:

- manifest.json
- background.js
- content.js
- popup.js
- popup.html
- popup.css

This structure is intentional for current scope.

Future modularization may occur if complexity increases.

No structural refactor required at this stage.

---

## State Management (F)

### Current

Popup implementation uses:

- Local variables
- Direct DOM updates
- No centralized state module

This is acceptable due to small scope and limited UI complexity.

### Recommendation (Future)

If popup logic grows significantly:

- Introduce a single state object
- Introduce setState() + render() pattern
- Avoid scattered DOM mutations

No change required now.

---

## Theming and Styles (G – Implemented)

All styling must be centralized in popup.css.

Rules:

- No inline <style> blocks
- No inline style attributes
- popup.html must link popup.css

This improves maintainability without changing UI behavior.

---

## User-Facing Text Centralization (G – Implemented)

All user-visible strings controlled by JavaScript must be stored in a single object inside popup.js.

Example:

const UI_TEXT = {
  configSaved: "Config saved.",
  copied: "Copied to clipboard.",
  generating: "Calling OpenAI..."
};

Rules:

- Do not scatter user-facing string literals across logic.
- Use UI_TEXT keys when setting statusEl.textContent or messageStatusEl.textContent.
- HTML static labels are not affected by this rule.

No separate text.js module is required at this stage.

---

## Complexity Threshold Rule

Modularization should only occur when:

- A file exceeds ~800 lines
- Logic becomes reused across modules
- Testing surface grows significantly
- Concurrency or architectural complexity increases

Until then, the flat and simple structure is preferred.
