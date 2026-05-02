# Architecture

This document defines the runtime architecture, boundaries, and responsibilities of the system.

The goal is to:
- Keep responsibilities strictly separated
- Support the modular popup refactor
- Maintain current behavior while enabling future scalability

---

## High-Level Flow

LinkedIn Page (content.js)  
↓  
Popup UI (popup.js + modules)  
↓  
Background (background.js)  
↓  
External APIs  
- OpenAI Responses API  
- Supabase REST  

---

## Runtime Boundaries (Strict)

### content.js
- Reads DOM only
- No network calls
- No storage access
- Returns structured profile object

---

### popup (UI Layer)

Current:
- popup.js (monolithic)

Refactored:
- popup.js (orchestrator)
- popup-tabs.js
- popup-person.js
- popup-messages.js
- popup-prompts.js
- popup-config.js

Responsibilities:
- Handles user interaction
- Renders UI
- Sends messages to background.js
- Manages local UI state

Rules:
- No direct HTTP calls
- No business logic duplication from background
- Clipboard only inside user-triggered actions

---

### background.js
- Owns all external HTTP calls
- Acts as backend layer

Responsibilities:
- OpenAI API calls
- Supabase API calls
- Retry logic (OpenAI only)
- Timeout handling
- JSON validation
- Error normalization

Rules:
- No DOM access
- No UI logic
- Always return normalized response shape

---

## Module Responsibilities (Popup)

### popup-tabs.js
- Tab switching only
- No business logic

### popup-person.js
- Profile context rendering
- Invitation generation
- Lifecycle state handling
- DB sync for invitations

### popup-messages.js
- First message generation
- Follow-up generation
- Chat history extraction
- Message lifecycle state

### popup-prompts.js
- Prompt editing
- Prompt persistence
- Prompt UI state

### popup-config.js
- API key management
- Model selection
- Supabase configuration
- Load and save settings

---

## Communication Model

All communication flows through background.js.

### Pattern

popup → background:
