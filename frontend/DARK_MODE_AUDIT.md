# Dark Mode Audit Notes

Use these commands from `frontend/` to detect classes that usually break dark mode:

```bash
rg --pcre2 -n "bg-white(?![^\"]*dark:bg-)" src
rg --pcre2 -n "bg-slate-(50|100|200)(?![^\"]*dark:bg-)" src
rg --pcre2 -n "border-slate-(200|300)(?![^\"]*dark:border-)" src
rg --pcre2 -n "text-slate-(900|800|700|600|500)(?![^\"]*dark:text-)" src
rg -n "bg-\[#|text-\[#|border-\[#|style=\{\{[^\n]*#[0-9A-Fa-f]{3,8}" src
```

Recommended replacements:

- Surfaces:
  - light: `bg-white` / `bg-slate-50`
  - dark: `dark:bg-surface-1` / `dark:bg-surface-2`
- Borders:
  - light: `border-slate-200`
  - dark: `dark:border-borderDark`
- Text:
  - primary: `text-slate-900 dark:text-slate-100`
  - secondary: `text-slate-500 dark:text-slate-300`
- Hover/focus:
  - `hover:bg-slate-50 dark:hover:bg-surface-2`
  - `focus:ring-brand-500/40`

Rules for this codebase:

- Prefer `dark:` classes over JS theme branching.
- Avoid hex colors in component classes; use design tokens (`brand`, `surface`, `borderDark`).
- Keep API/contracts unchanged in dark mode refactors (UI-only).
