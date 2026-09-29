# UX Writing Standards

> **Load when**: writing or reviewing user-facing copy — labels, buttons, errors, empty states, toasts, emails, microcopy. **Unload after** the copy is approved.

UX writing is part of the product, not decoration. Inconsistent or unclear copy
costs more than a misaligned pixel.

## Voice & Tone

| Dimension | Default |
| --- | --- |
| Voice | Clear, direct, helpful, professional |
| Tone | Calm under errors; confident under success; respectful always |
| Person | Second person ("you", "your") |
| Tense | Present |
| Pronouns | Avoid "we" except in confirmation/system messages |
| Jargon | Avoid; explain or replace |

**Adjust tone by surface**: error messages stay calm + actionable; onboarding can be slightly warmer; legal/audit copy stays formal.

## Universal Rules

1. **Lead with the user's goal.** Not what the system did.
   - ✅ "Save your changes to continue"
   - ❌ "The form was not submitted because validation failed"
2. **Be specific.** Vague copy = user confusion.
   - ✅ "Email must include @ and a domain"
   - ❌ "Invalid email"
3. **Always provide the next step.** Errors must say what to do, not just what failed.
   - ✅ "Couldn't save. Check your connection and try again."
   - ❌ "Save failed."
4. **Avoid blame.** Never "you did X wrong"; describe what's needed.
   - ✅ "Password must be at least 8 characters"
   - ❌ "Your password is too short"
5. **No hedging.** "Please" rarely helps; commands are clearer than requests.
6. **One idea per sentence.** Long sentences hide actions.
7. **Match data formats.** Dates / currency / numbers via `Intl.*` — see `internationalization-standards.md`.

## Surface-by-Surface Rules

### Buttons & Actions

- **Verb-first**: "Save changes", "Delete file", "Continue", "Send invite".
- **No "Submit" alone** — say what gets submitted: "Submit request" / "Send report".
- **Destructive verbs explicit**: "Delete", "Remove", "Discard" — never "OK" for destructive.
- **Loading state**: "Saving…" not "Loading…" — describe the verb, not the activity.
- **Disabled state copy**: explain WHY (tooltip): "Add at least one item to continue."

### Form Field Labels

- **Title-case noun**: "Email address", "Date of birth", "Account name".
- **Mark optional, not required.** Required is the default in this framework. Add `(optional)` only to optional fields.
- **Helper text** under the label, not as placeholder. Placeholders disappear; helper text stays.
- **No colons after labels** in this framework.

### Form Validation Messages

- **Inline at the field**, not a banner above.
- **Trigger on blur (or first submit), not on every keystroke** — see `form-validation-pattern.md`.
- **Format**: `{Field} {constraint}.` — single sentence, period.
  - "Email must include @ and a domain."
  - "Password must be at least 8 characters."
  - "Date must be in the future."
- **Server errors merge** to the same field via React Hook Form's `setError`.

### Empty States

- **Three lines**: short headline / one-sentence description / primary action.
- Headline names what's missing ("No files yet"), not the screen ("Files").
- Action is the verb to fix it ("Upload your first file").
- For permission-gated empties: explain who can populate it ("Ask an admin to add team members.").

### Error / System Messages

- **What happened + what to do.**
- **Reserve "error"** for blockers; use "warning" for recoverable, "info" for informational.
- **Reference correlation ID** for support: "Code: 8f3a-2b7e — share this with support if it persists."
- **No stack traces in user UI.** Logged server-side per `observability-standards.md`.
- **Pair with toast vs modal correctly**: toast for transient/non-blocking, modal for required acknowledgement.

### Confirmation / Destructive Dialogs

- **Title is a question or imperative**: "Delete this request?", "Confirm withdrawal".
- **Body explains consequence**: what will be removed, whether reversible.
- **Confirm button uses the verb** of the action: "Delete request", not "OK".
- **Cancel is always present and labeled "Cancel"**.

### Toasts & Notifications

- **Past-tense success**: "Request saved", "Invite sent".
- **Auto-dismiss success after 4–5s**; errors persist until dismissed.
- **Never stack > 3 toasts** — collapse.
- **No hyperlinks inside transient toasts** unless the action is the only resolution path.

### Modals

- **Title is a noun phrase**: "New request", "Edit profile".
- **Single primary action** at bottom-right.
- **Esc closes; click-outside closes** unless work would be lost.

### Tables & Lists

- **Column headers are nouns**, sentence-case: "Created", "Status", "Owner".
- **Empty cells**: en-dash (`–`), not "N/A" or blank — improves scannability.
- **Status pills**: short, not sentences ("Pending", "Resolved").

### Onboarding & Help

- Show, don't tell. Demonstrate via a 1-action exercise where possible.
- Never block first paint with a tour. Provide a dismissible Help/Tour entry.

## Numbers, Dates, Times

- Currency, dates, large numbers go through `Intl.*` — see `internationalization-standards.md`.
- Relative time for ≤ 7 days ("3 hours ago"), absolute date for older.
- Time zone: show user's local time; mark UTC explicitly only on audit/log surfaces.

## Forbidden / Common Pitfalls

- ❌ "Oops!", "Whoops!", "Uh-oh" — sounds dismissive on real errors.
- ❌ "Please" in commands — usually filler.
- ❌ "Sorry" in error copy — apologise only when system is at fault and user needs reassurance.
- ❌ Marketing hyperbole in product UI ("Amazing!", "Awesome!").
- ❌ Title-Case Sentences ("Your File Was Saved").
- ❌ Acronyms without first-use expansion.

## Review Checklist

- [ ] Does it tell the user what to do next?
- [ ] Is it specific enough that two readers would do the same thing?
- [ ] Sentence-case used (except for proper nouns)?
- [ ] No "please", no "sorry", no "oops"?
- [ ] Action verbs used in buttons?
- [ ] Optional fields explicitly marked, required ones unmarked?
- [ ] All strings in translation file (no hardcoded English)?
- [ ] Length acceptable on smallest target viewport?

## Token Optimization

- **Load when**: writing or reviewing user-facing copy; running `/ui-review` or `/ui-improve` with copy concerns; reviewing PR copy diffs.
- **Load only**: this standard + `accessibility-standards.md` (for screen reader text) + `internationalization-standards.md` (when localized).
- **Unload after**: copy approved and tests / Storybook updated.

## Cross-References

- Accessibility standards: `@.claude/standards/accessibility-standards.md`
- Frontend standards: `@.claude/standards/frontend-standards.md`
- UI design standards: `@.claude/standards/ui-design-standards.md`
- Internationalization: `@.claude/standards/internationalization-standards.md`
- Form validation pattern: `@.claude/patterns/form-validation-pattern.md`
- Error handling pattern: `@.claude/patterns/error-handling-pattern.md`
