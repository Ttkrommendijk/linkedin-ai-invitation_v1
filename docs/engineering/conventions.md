# Conventions

This document defines coding conventions and structural guidelines for the codebase.

The goal is to:
- Reflect the CURRENT implementation accurately
- Support the planned refactoring (UI + modular JS split)
- Avoid unnecessary or premature refactors
- Keep behavior stable while improving structure

---

## Naming (Current Standard)

We maintain existing naming patterns. No refactor required.

### Functions
- camelCase

### Constants
- UPPER_SNAKE_CASE

### Message Types
- UPPER_SNAKE_CASE (string values)

---

## Profile Field Contract (Current)

The profile object intentionally uses a mixed naming style.

### Single-word fields (simple lowercase)
- url
- name
- headline
- company
- location
- about

### Multi-word fields (snake_case)
- first_name
- recent_experience
- excerpt_fallback
- profile_url
- linkedin_url
- full_name

This is the accepted current contract. No normalization required.

### Notes

- url represents the raw extracted URL from the page
- profile_url and linkedin_url are used for normalized or downstream contexts
- Duplicate URL fields are intentionally allowed

---

## Example (Current Compliant)

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

## UI Structure (Refactored Model)

The popup is organized by domain, not by feature mixing.

### Top-Level Tabs

- Person
- Company
- Prompts
- Configuration

---

## Responsibilities

### Person
- Profile context
- Invitation generation
- Invitation lifecycle
- First message trigger
- Follow-up trigger

### Company
- Company context extraction
- Company-level data
- Future enrichment logic

### Prompts
- Invitation strategy
- First message prompt
- Follow-up prompt

### Configuration
- OpenAI settings
- Supabase settings

---

## Folder Structure

### Current (Flat)

manifest.json  
background.js  
content.js  
popup.js  
popup.html  
popup.css  

---

### Target (Modular, Incremental)

popup.html  
popup.css  
popup.js  

js/  
  popup-tabs.js  
  popup-person.js  
  popup-messages.js  
  popup-prompts.js  
  popup-config.js  

css/  
  popup-layout.css  
  popup-tabs.css  
  popup-forms.css  

---

### Rules

- Do not move everything at once
- Extract by responsibility
- Keep popup.js as orchestrator initially
- Preserve all existing ids and message types

---

## State Management

### Current
- Local variables
- Direct DOM manipulation
- No centralized state

This is acceptable for current scope.

---

### Target (When Needed)

Introduce:
- Central state object
- setState()
- render()

Goal:
- Reduce scattered DOM updates
- Make UI predictable

Not required yet.

---

## Module Boundaries

Each module must have a clear responsibility.

### popup-tabs.js
- Tab switching only

### popup-person.js
- Profile extraction
- Invitation generation
- Lifecycle UI

### popup-messages.js
- First message
- Follow-up
- Chat history

### popup-prompts.js
- Prompt editing
- Prompt storage

### popup-config.js
- API key
- Model
- Supabase config

---

### Rules

- No cross-module side effects
- Share only minimal globals
- Do not duplicate logic

---

## Styling Rules

All styling must be centralized.

### Rules
- Use popup.css (or split CSS later)
- No inline style blocks
- No inline style attributes

---

## User-Facing Text

All dynamic UI text must be centralized.

### Pattern

const UI_TEXT = {
  configSaved: "Config saved.",
  copied: "Copied to clipboard.",
  generating: "Calling OpenAI..."
};

---

### Rules

- Do not scatter string literals
- Always use UI_TEXT for:
  - statusEl.textContent
  - messageStatusEl.textContent

Static HTML labels are allowed.

---

## Refactoring Strategy

Refactoring must be incremental.

### Rules

- Never change behavior and structure at the same time
- Extract one concern at a time:
  1. Tabs
  2. Config
  3. Prompts
  4. Person logic
  5. Message logic

- After each step:
  - UI must still work
  - No console errors
  - No API behavior changes

---

## Complexity Threshold Rule

Only refactor structure when justified.

### Trigger conditions

- File exceeds ~800 lines
- Logic becomes reused
- UI becomes harder to reason about
- Bugs increase due to coupling

---

### Otherwise

- Prefer simple structure
- Avoid premature abstraction
- Optimize for speed of iteration

---

## Guiding Principle

Keep logic stable.  
Improve structure gradually.  
Optimize for clarity and iteration speed, not theoretical purity.
