# Internationalization (i18n) Standards

> **Load when**: introducing or refactoring user-facing text that must support multiple locales, regional formats, or right-to-left scripts. **Unload after** the locale strategy is wired and verification passes.

## Library Choice (Default)

- **`next-intl`** for App Router (preferred): server- and client-component compatible, message format ICU MessageFormat, type-safe with TypeScript.
- Alternatives: `react-intl`, `i18next`. Pick once per project — never mix.

## Non-Negotiables

1. **No hardcoded user-facing strings** in components. Every visible string must come from a translation file.
2. **No string concatenation** for translations. Use ICU placeholders: `t('greeting', { name })` not `'Hello ' + name`.
3. **One source of truth** — `apps/web/messages/{locale}.json`. Never duplicate strings across files.
4. **Type-safe keys** — use `next-intl`'s generated types or a typed wrapper. Missing keys must fail TypeScript build, not runtime.
5. **Locale fallback chain** — every locale falls back to `en`. Never display the raw key in production.
6. **Server-component aware** — use `getTranslations()` in server components, `useTranslations()` in client components.
7. **Plural / gender / select** — use ICU MessageFormat plurals, never string switching in code.

## Folder Layout

```
apps/web/
├── messages/
│   ├── en.json        # source of truth — always complete
│   ├── ja.json        # may be incomplete, falls back to en
│   └── zh-CN.json
├── src/i18n/
│   ├── config.ts      # supported locales, default, formats
│   └── request.ts     # next-intl request config
└── middleware.ts      # locale detection / cookie / header
```

## Message Key Conventions

```jsonc
{
  "common": {
    "submit": "Submit",
    "cancel": "Cancel"
  },
  "form": {
    "validation": {
      "required": "{field} is required",
      "tooLong": "{field} must be at most {max} characters"
    }
  },
  "page": {
    "dashboard": {
      "title": "Dashboard",
      "greeting": "Welcome, {name}"
    }
  }
}
```

- Namespace by feature (`page.dashboard.*`) not by component.
- Reuse from `common.*` for buttons, labels, status words.
- Validation messages live under `form.validation.*` and accept `{field}` placeholder.

## Formatting

| Concern | Use | Never use |
| --- | --- | --- |
| Dates | `Intl.DateTimeFormat` via `next-intl`'s `formatDate()` | `new Date().toLocaleString()` ad-hoc |
| Numbers | `Intl.NumberFormat` via `formatNumber()` | manual decimals/commas |
| Currency | `formatNumber(value, { style: 'currency', currency })` | `'$' + value` |
| Plurals | ICU `{count, plural, one {...} other {...}}` | `count === 1 ? 'item' : 'items'` |
| Relative time | `formatRelativeTime()` | manual diff math |

## Right-to-Left (RTL) Support

- Set `dir="rtl"` on `<html>` for RTL locales (`ar`, `he`, `fa`).
- Use logical CSS properties: `margin-inline-start` over `margin-left`, `padding-inline-end` over `padding-right`.
- Tailwind RTL plugin or `:dir(rtl)` selectors for layout flips.
- Test every page in RTL mode in Storybook (the 8th standard story group covers this).

## Testing

- **Unit**: render component with `NextIntlClientProvider` and a fixture `messages` object. Assert against rendered translated text.
- **E2E**: Playwright runs at least one suite under a non-default locale. Assert dynamic strings via the message catalog, never against hardcoded English.
- **Lint**: ESLint rule (or pre-commit hook) flags any `>[A-Z][a-z]+ ` JSX text node outside known whitelisted children — forces translation lookup.

## Security & Privacy

- Never include user-controlled HTML in messages. ICU values are escaped by default — keep it that way.
- Never load translation files based on user input path traversal. Use a closed enum of supported locales.
- Translation strings are not secrets but are user-visible — apply the same review rigor as UI copy.

## Token Optimization

- **Load when**: introducing i18n; refactoring hardcoded strings; adding a new locale.
- **Load only**: this standard + `frontend-standards.md` + the relevant Next.js/next-intl docs via Context7 MCP.
- **Unload after**: locales register cleanly, fallback works, lint rule passes, RTL Storybook group passes.

## Cross-References

- Frontend standards: `@.claude/standards/frontend-standards.md`
- UX writing standards: `@.claude/standards/ux-writing-standards.md`
- Storybook standards: `@.claude/standards/storybook-standards.md`
- Accessibility standards: `@.claude/standards/accessibility-standards.md`
- Component usage: `@.claude/standards/component-usage.md`
