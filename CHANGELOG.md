# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## 0.1.0 (2026-11-13)

First release: deterministic rules with autofix, an ESLint plugin and a zero-config CLI.

### Added

- Fixes keep today's look: the logical side comes from the direction an element renders
  in now (nearest JSX `dir`, a CSS `direction` declaration, the app's `<html dir>`, or
  `settings.rtlDoctor.direction`), so `pl-4` becomes `pe-4` in an RTL app and `ps-4` in
  an LTR one. Unknown or dynamic directions are reported with both options and not fixed.
  Verified on a production site: 0 of 6,058 element boxes moved (`docs/VERIFICATION.md`).
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
- `npx rtl-doctor [paths] [--fix] [--format json] [--locale] [--no-persian] [--tailwind] [--direction] [--layout]`,
  with detection of Persian apps (`lang="fa"`, i18n config, message files), the app's
  direction (`dir` on the HTML root), the Tailwind version, and RTLCSS-based projects.
- `scripts/layout-diff.mjs`: records every rendered element's box on a set of pages and
  compares two recordings, to check that a fix moved nothing.
- Colour output follows `NO_COLOR` and `FORCE_COLOR` (for CI logs).
- Direction-neutral code is not reported: symmetric pairs, the `left-1/2 -translate-x-1/2`
  centring idiom, `rtl:` / `ltr:` variants, `[dir]` selectors, `@keyframes`, and RTLCSS
  `/* rtl:ignore */` comments.
