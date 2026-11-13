# `css-logical` and `css-shorthand` (CLI)

The CLI checks `.css` and `.scss` files with PostCSS. These checks are not ESLint rules;
use them through `npx rtl-doctor` or the exported `checkCss()` function.

## `css-logical`

- Autofix: yes. PostCSS keeps every node's whitespace and comments, so only the
  property or value changes.

| Physical | Logical |
|----------|---------|
| `margin-left` / `margin-right` | `margin-inline-start` / `margin-inline-end` |
| `padding-left` / `padding-right` | `padding-inline-start` / `padding-inline-end` |
| `left` / `right` | `inset-inline-start` / `inset-inline-end` |
| `border-left` / `border-right` (and `-width`, `-style`, `-color`) | `border-inline-start` / `border-inline-end` (and the same suffixes) |
| `border-top-left-radius`, `border-top-right-radius`, `border-bottom-left-radius`, `border-bottom-right-radius` | `border-start-start-radius`, `border-start-end-radius`, `border-end-start-radius`, `border-end-end-radius` |
| `scroll-margin-left` / `-right`, `scroll-padding-left` / `-right` | `scroll-margin-inline-start` / `-end`, `scroll-padding-inline-start` / `-end` |
| `text-align: left` / `right` | `text-align: start` / `end` |
| `float: left` / `right`, `clear: left` / `right` | `inline-start` / `inline-end` |

It also checks Tailwind classes inside `@apply` with the same logic as
[`tailwind-logical`](tailwind-logical.md).

### Not reported

- symmetric pairs in one rule: `margin-left: 8px; margin-right: 8px`, `left: 0; right: 0`
- `left` / `right` next to a `transform: translate...` or `translate` (the centring idiom)
- rules under `[dir=...]`, `:dir()`, `.rtl` or `.ltr` selectors, and anything inside `@keyframes`
- RTLCSS directives: `/* rtl:ignore */` before a rule or declaration,
  `/* rtl:begin:ignore */ ... /* rtl:end:ignore */`, and value directives such as
  `left: 10px /* rtl:20px */`; the same comments with an `rtl-doctor:` prefix work too
- the whole project when it depends on `rtlcss`, `postcss-rtlcss`, `postcss-rtl` or
  `rtlcss-webpack-plugin`, which flip physical CSS at build time (`--layout` forces the checks)

## `css-shorthand`

- Autofix: no (report only). The message spells out the logical replacement.

Four-value `margin`, `padding`, `inset`, `border-width`, `border-style`,
`border-color`, `scroll-margin` and `scroll-padding` whose left and right values differ,
and `border-radius` whose left and right corners differ:

```css
.a { margin: 0 8px 0 0; }
/* `margin: 0 8px 0 0` sets left and right differently, so it does not flip in RTL;
   use `margin-block: 0; margin-inline: 0 8px`. */
```
