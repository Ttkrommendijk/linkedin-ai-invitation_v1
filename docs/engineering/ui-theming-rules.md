# ui theming rules (popup)

this document defines ui and styling rules for the popup interface of the chrome mv3 extension.

the goal is visual consistency, simplicity, and maintainability.

if any rule conflicts with architecture.md, architecture.md wins.

---

## core principle

visual styling must be centralized and minimal.

no scattered inline styles.
no hardcoded colors inside javascript.

---

## styling location

all styles must live in:

src/popup/popup.css

rules:
- popup.js must not inject style attributes dynamically
- avoid inline style attributes in popup.html
- prefer css classes over element styling

---

## css structure

popup.css should follow this structure:

:root {
  --color-bg: #ffffff;
  --color-primary: #0a66c2;
  --color-text: #1f1f1f;
  --color-muted: #6f6f6f;
  --color-error: #c62828;

  --radius: 6px;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
}

rules:
- define design tokens in :root
- reuse css variables instead of duplicating values
- no random color codes in component classes

---

## layout rules

- keep popup width fixed and predictable
- avoid dynamic resizing unless explicitly required
- use flexbox for layout
- avoid deeply nested div structures

recommended layout pattern:

.container
  .header
  .content
  .actions
  .status

---

## typography

rules:
- use system fonts (no external font loading)
- maximum two font sizes for body text
- maximum one accent font size for headers
- avoid bold overuse

---

## button rules

- primary button: one per view (e.g., generate)
- secondary button: copy
- disabled state must be visually distinct
- hover state must not shift layout

rules:
- disable generate while loading
- disable copy if generated_invite is empty

---

## status and feedback

status text must:

- be subtle but readable
- use color only as secondary indicator (not sole indicator)
- use --color-error for errors
- not animate excessively

no spinners unless necessary.
if used, spinner must not block ui interaction unless required.

---

## accessibility

rules:
- buttons must have accessible labels
- do not rely on color alone to communicate state
- ensure sufficient color contrast
- avoid flashing or fast animation

---

## forbidden patterns

- inline styles in html
- css inside javascript template strings
- duplicated color definitions
- layout dependent on hardcoded pixel hacks

---

## future theming

if themes are introduced:

- add data-theme attribute to root container
- define alternative variables under [data-theme="dark"]
- do not conditionally change styles in javascript
