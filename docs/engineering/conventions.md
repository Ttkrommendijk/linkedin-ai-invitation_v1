# Conventions

This document defines coding conventions and structure.

---

# Naming (D – Maintain Current Convention)

We maintain current naming patterns:

Functions: camelCase  
Constants: UPPER_SNAKE_CASE  
Message types: UPPER_SNAKE_CASE strings  
Profile fields: snake_case  

We do NOT refactor naming at this time.

---

# Folder Structure (Current)

Flat structure:

- manifest.json
- background.js
- content.js
- popup.js
- popup.html
- popup.css

Future modularization may occur if complexity increases.

No change required.

---

# State Management (F)

## Current

Popup uses:
- Local variables
- Direct DOM updates
- No central state module

This is acceptable due to small scope.

## Recommendation (Future)

If popup logic grows:
- Introduce single state object
- Introduce setState() + render()
- Avoid scattered DOM mutations

No change required now.

---

# Theming and Styles (G – Implemented)

Inline styles have been moved to popup.css.

Rules:
- No inline <style> blocks
- No inline style attributes
- All styling centralized in popup.css

This improves maintainability without changing UI.

---

# User-Facing Text Centralization (G – Implemented)

User-visible strings are now stored in a single object in popup.js:

Example:

const UI_TEXT = {
configSaved: "Config saved.",
copied: "Copied to clipboard.",
generating: "Calling OpenAI…",
...
}


This:
- Reduces duplication
- Prepares for i18n
- Improves maintainability

No text.js module required yet.

---

# Complexity Threshold Rule

We only modularize when:
- A file exceeds ~800 lines
- Logic becomes reused across modules
- Testing surface grows significantly

Until then, simplicity prevails.
