# state management

this document defines how state must be handled in the popup ui of this chrome mv3 extension.

this project does not use react, redux, or zustand.
state must remain simple, predictable, and explicit.

if any rule conflicts with architecture.md, architecture.md wins.

---

## scope

state management applies only to:

- popup ui (popup.js and related modules)

content and background should avoid persistent state except where strictly required (e.g., tokens in background).

---

## core principle

there must be a single source of truth for popup state.

do not scatter state across multiple unrelated variables and dom nodes.

---

## canonical popup state shape

state should be a single object:

{
  status: string,
  is_loading: boolean,
  error: string,
  profile_context: object | null,
  generated_invite: string
}

rules:
- do not store dom elements inside state
- do not store functions inside state
- prefer empty string "" instead of null for text fields
- profile_context may be null before extraction

---

## state ownership

popup.js (or state.js if modularized) owns state.

allowed:
- setState(...)
- getState()

not allowed:
- mutating state from multiple files without a defined setter
- directly manipulating dom as a substitute for state

---

## state updates

state updates must be explicit and atomic.

preferred pattern:

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

rules:
- never mutate nested objects silently
- always trigger render() after state update
- avoid partial UI updates without updating state

---

## render function

all dom updates must go through a single render() function.

rules:
- render reads from state only
- render must not modify state
- render must not contain business logic
- render must not perform async operations

---

## loading policy

rules:
- is_loading must be true during extraction or generation
- disable generate button while loading
- disable copy button if generated_invite is empty

status must reflect real state transitions:

extracting → generating → ready
or
error

---

## error handling

rules:
- error messages shown to user must come from state.error
- internal error details must not be exposed directly
- clear error on new valid action

example:

setState({
  error: "",
  is_loading: true,
  status: "generating..."
})

---

## forbidden patterns

- storing data in hidden dom elements
- deriving state from dom text content
- relying on implicit global variables
- updating ui without updating state

---

## future scalability

if popup complexity grows:

- move state logic into src/popup/state.js
- define reducer-style functions
- keep render() pure

do not introduce heavy state libraries unless complexity truly requires it.
