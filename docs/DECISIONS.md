# Decision log

Every decision below was signed off by the maintainer (Amirjaz) unless it is marked
"default". Defaults are small calls made during implementation; change them by
editing this file and the code together.

## 2026-11-13: v0.1 scope interview

| # | Question | Decision | Why |
|---|----------|----------|-----|
| 1 | Where does the repo live? | `E:\Projects\rtl-doctor`, its own git repo | Next to persian-ui and Shamsi-Calendar. `E:\Projects` is a git repo that ignores every folder except DrMirKeshavarz, so a nested repo stays independent. |
| 2 | npm packaging | One unscoped package, `rtl-doctor`, holding both the CLI and the ESLint plugin | `npx rtl-doctor .` works as written. Flat config does not need the `eslint-plugin-` prefix. `rtl-doctor`, `eslint-plugin-rtl-doctor` and `@amirjaz/rtl-doctor` were all free on 2026-11-13. |
| 3 | ESLint config formats | Flat config only, ESLint 9 and 10 | ESLint 10 removed `.eslintrc`; ESLint 8 is end-of-life. |
| 4 | License | MIT | Same as persian-ui and Shamsi-Calendar. |
| 5 | Tailwind versions | Detect the installed version and adapt | Compiling Tailwind 3.4.19 and 4.3.5 showed that v4 already writes `space-x-*` and `divide-x-*` with `margin-inline-*` / `border-inline-*`, so the brief's "space-x without rtl:space-x-reverse" check is right for v3 only, and in v4 `rtl:space-x-reverse` actively breaks spacing. Tailwind 4.2 deprecated `start-*` / `end-*` in favour of `inset-s-*` / `inset-e-*`. So: v3 requires `rtl:space-x-reverse`, v4 flags it; `left-*` fixes to `start-*` before 4.2 and `inset-s-*` from 4.2. |
| 6 | Autofix policy | Layout fixes and Arabic-to-Persian character fixes are autofixes; adding a locale is an editor suggestion that `--fix` does not apply | `ي` and `ك` in Persian UI text are always typos. Adding `'fa-IR'` switches dates to the Jalali calendar and digits to `۰-۹`, which may not be what the author wanted. |
| 7 | How rtl-doctor knows the app is Persian | Two configs (`recommended` for any RTL language, `persian` adds the character and locale rules) plus CLI auto-detection; `--locale` overrides | An Arabic app uses `ي` and `ك` correctly, so those rules must not run everywhere. |
| 8 | CLI default | Read-only report, exit code 1 on findings, `--fix` writes, `--format json` | Same contract as ESLint; CI friendly; safe on a dirty working tree. |
| 9 | Extras in v0.1 | All three: Arabic-Indic digits (`٤٥٦` to `۴۵۶`), Persian JSON message files, asymmetric CSS shorthands (report only) | Small, deterministic, and common in real Persian apps. |
| 10 | Build | ESM only, Node 20.19+ | ESLint 10 needs Node 20.19+ anyway, and `require(esm)` works there, so CommonJS ESLint configs can still load the plugin. |
| 11 | Stack and tests | TypeScript (pinned 6.0 like persian-ui), pnpm, PostCSS + postcss-scss, Vitest with ESLint's RuleTester, fixture tests for CLI `--fix` output, a test that compiles every replacement class in real Tailwind 3.4 and 4.3, GitHub Actions on Node 20/22/24 | Matches persian-ui; the compile test proves the fixes exist in Tailwind instead of trusting a hand-written table. |
| 12 | Real-repo verification | DrMirKeshavarz (Next 16.4, Tailwind 4.3.3), run on a copy in a temp folder | Real Persian site the maintainer can judge; the real repo is never touched. |

## Defaults chosen during implementation

| # | Decision | Why |
|---|----------|-----|
| D1 | Rule ids: `tailwind-logical`, `persian-chars`, `intl-locale` (ESLint); `css-logical`, `css-shorthand` (CLI, PostCSS) | Short, say what they check. |
| D2 | Direction-neutral code is not reported: symmetric pairs in one class string or CSS rule (`pl-4 pr-4`, `left: 0; right: 0`), the centring idiom (`left-1/2 -translate-x-1/2`, `left: 50%` with `translateX(-50%)`), classes under `rtl:` / `ltr:` variants, CSS under `[dir]`, `:dir()`, `.rtl`, `.ltr` selectors or inside `@keyframes`, and RTLCSS `/*rtl:ignore*/` comments | Precision first: a finding that is not a bug costs trust. These cases are where the v0.2 LLM triage takes over. |
| D3 | The CLI skips CSS checks when the project depends on `rtlcss`, `postcss-rtlcss` or `stylis-plugin-rtl` | Those tools flip physical CSS at build time, so physical properties are intentional there. |
| D4 | `eslint` and `@typescript-eslint/parser` are regular dependencies | The CLI needs both; the plugin's rules never import them, so a project on ESLint 9 can load the plugin while the CLI uses its own ESLint 10. |
| D5 | The CLI turns off ESLint's "unused disable directive" report | It runs only rtl-doctor rules, so every `eslint-disable` for another rule would look unused. |
| D6 | `localeCompare` without a locale is part of `intl-locale` | Without `'fa'`, Persian strings sort by code point, so `پ چ ژ گ ک ی` land after the Arabic letters. |
| D7 | Persian text is recognised by Persian-only letters (`پ چ ژ گ ک ی`) or Persian digits; in the `persian` config any Arabic-script string without `ة` counts as Persian | Keeps Arabic quotations in a Persian app from being rewritten. |
