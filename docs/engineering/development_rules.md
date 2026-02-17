# development_rules.md — Core Development Rules for Zed

## How to use

When the user says:

> execute development_rules.md

Zed must follow **only** the rules defined in this file as global constraints for the current task.

These rules apply on top of the specific task instructions.

---

# 1. Scope Discipline (Most Important Rule)

- Implement **only** the explicitly requested functionality.
- Do **not** improve, refactor, optimize, rename, reorganize, or “clean up” unrelated parts.
- Do **not** modify behavior outside the requested scope.
- If something looks suboptimal but was not requested to change — **leave it unchanged**.
- If unsure whether something is in scope → assume it is **out of scope**.

---

# 2. Minimal Change Principle

- Never rewrite entire files.
- Modify **only the smallest necessary code section**.
- Prefer surgical edits over structural rewrites.
- Do not reformat entire files.
- Do not reorder code unless strictly required.
- Preserve existing indentation style and formatting.

---

# 3. Reuse Over Reinvent

Before creating new logic:

- Check if similar functionality already exists.
- Reuse existing helper functions where possible.
- Extend existing functions instead of duplicating logic.
- Avoid introducing parallel implementations of similar behavior.

Never duplicate:
- DOM selection helpers
- Logging helpers
- Message passing logic
- API call wrappers
- Data formatting helpers

If reuse is not possible, explain briefly why in summary.

---

# 4. Naming Conventions

- Follow existing naming conventions exactly.
- Do not introduce new naming patterns.
- Match:
  - camelCase for variables/functions (if used)
  - UPPER_CASE for constants (if used)
  - Existing message type naming (e.g., `DB_GET_INVITATION`)
- Do not rename existing variables unless strictly required for the requested change.

---

# 5. No Implicit Refactors

Unless explicitly requested:

- Do not refactor for "cleanliness"
- Do not extract new helper files
- Do not reorganize folder structure
- Do not consolidate CSS
- Do not convert function styles
- Do not modernize syntax
- Do not introduce TypeScript
- Do not introduce new libraries

---

# 6. GUI Safety Rules

- Do not change layout unless explicitly requested.
- Do not modify CSS unrelated to the requested change.
- Do not change spacing, fonts, or colors unless explicitly requested.
- Do not modify tab behavior unless requested.

---

# 7. Security & Stability Constraints

Always:

- Avoid `innerHTML` for dynamic content.
- Avoid exposing secrets in logs.
- Avoid broad query selectors that affect unrelated DOM.
- Keep message passing contracts intact.
- Do not change API endpoints or payload shapes unless requested.

But:

- Do not perform a security refactor unless explicitly asked.
- Do not introduce new validation layers unless requested.

---

# 8. Logging Rules

- Do not remove existing logs unless clearly obsolete.
- Do not add excessive new logs unless debugging is requested.
- Keep log prefix conventions consistent (e.g., `[LEF][chat]`).

---

# 9. Behavior Preservation Guarantee

After changes:

- Existing flows must behave exactly the same.
- UI must behave exactly the same.
- Network calls must behave exactly the same.
- Storage keys must remain unchanged.
- Background/content message contracts must remain unchanged.

If a requested change risks breaking existing behavior:
- Implement the safest possible version.
- Do not expand scope.

---

# 10. Output Format Rules

When executing under development_rules.md:

- Apply changes directly in-place.
- Do not output full rewritten files.
- Do not output diffs.
- Provide only a brief summary (max 6 bullet points).

---

# 11. Conflict Resolution

If task instructions conflict with these rules:

- Follow the task instructions.
- But still apply Minimal Change Principle.
- Never broaden scope beyond the task.

---

# 12. Golden Rule

> Precision over creativity.
> Minimalism over refactoring.
> Explicit scope over assumptions.

Zed must behave like a senior engineer performing a controlled patch — not a refactor initiative.
