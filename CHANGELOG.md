# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## 0.1.0 (unreleased)

First release: deterministic rules with autofix, an ESLint plugin and a zero-config CLI.

### Added

- `tailwind-logical` ESLint rule: physical Tailwind classes (`ml-*`, `pr-*`, `left-*`,
  `text-left`, `rounded-l*`, `border-l*`, `float-left`, `scroll-ml-*`...) to their logical
  twins, version-aware (`start-*` before Tailwind 4.2, `inset-s-*` from 4.2), plus
  `space-x` / `divide-x`: adds `rtl:space-x-reverse` in Tailwind 3, removes it in Tailwind 4.
- `persian-chars` ESLint rule: Arabic yeh, alef maksura, kaf and Arabic-Indic digits in
  Persian strings, JSX text and attributes, fixed to their Persian forms.
- `intl-locale` ESLint rule: `toLocaleString()`, `localeCompare()` and `Intl.*` without a
  locale, with a one-click `'fa-IR'` suggestion.
- `css-logical` and `css-shorthand` CLI checks (PostCSS, `.css` and `.scss`): physical
  properties and values to logical ones, `@apply` classes, and report-only asymmetric shorthands.
- Persian message files (`fa.json`, `locales/fa/*.json`) checked by the CLI.
- `configs.recommended` (layout rules for any RTL app) and `configs.persian`.
- `npx rtl-doctor [paths] [--fix] [--format json] [--locale] [--no-persian] [--tailwind] [--layout]`,
  with detection of Persian apps (`lang="fa"`, i18n config, message files), the Tailwind
  version, and RTLCSS-based projects.
- Direction-neutral code is not reported: symmetric pairs, the `left-1/2 -translate-x-1/2`
  centring idiom, `rtl:` / `ltr:` variants, `[dir]` selectors, `@keyframes`, and RTLCSS
  `/* rtl:ignore */` comments.
