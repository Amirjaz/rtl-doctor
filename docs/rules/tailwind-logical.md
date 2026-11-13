# `tailwind-logical`

Physical Tailwind classes set `left` and `right`, so they stay put when the page is
right-to-left. Their logical twins (`ms-*`, `ps-*`, `start-*` / `inset-s-*`,
`text-start`...) follow `dir` and flip on their own.

- Type: problem
- Autofix: yes (`--fix`, or "fix all" in the editor)
- In configs: `recommended`, `persian`

## What it rewrites

| Physical | Logical | Needs Tailwind |
|----------|---------|----------------|
| `ml-*` `mr-*` | `ms-*` `me-*` | 3.3 |
| `pl-*` `pr-*` | `ps-*` `pe-*` | 3.3 |
| `scroll-ml-*` `scroll-mr-*` `scroll-pl-*` `scroll-pr-*` | `scroll-ms-*` `scroll-me-*` `scroll-ps-*` `scroll-pe-*` | 3.3 |
| `left-*` `right-*` | `start-*` `end-*` before 4.2, `inset-s-*` `inset-e-*` from 4.2 | 3.3 |
| `border-l*` `border-r*` (width and colour) | `border-s*` `border-e*` | 3.3 |
| `rounded-l*` `rounded-r*` | `rounded-s*` `rounded-e*` | 3.3 |
| `rounded-tl*` `rounded-tr*` `rounded-bl*` `rounded-br*` | `rounded-ss*` `rounded-se*` `rounded-es*` `rounded-ee*` | 3.3 |
| `text-left` `text-right` | `text-start` `text-end` | 3.0 |
| `float-left` `float-right` | `float-start` `float-end` | 3.4 |
| `clear-left` `clear-right` | `clear-start` `clear-end` | 3.4 |

Variants, `!` (v3 prefix or v4 suffix), negative values and arbitrary values are kept:
`md:hover:-ml-4` becomes `md:hover:-ms-4`, `pr-[3px]!` becomes `pe-[3px]!`. Below the
"Needs" version the class is still reported, without a fix.

`test/tailwind-compile.test.ts` compiles every pair above with real Tailwind 3.4 and
4.3 and checks that the logical class sets exactly the logical twins of the physical
class's properties.

## `space-x` and `divide-x` depend on the Tailwind version

| Tailwind | `space-x-*`, `divide-x-*` use | rtl-doctor |
|----------|-------------------------------|------------|
| 3.x | `margin-left`, `border-left-width` (physical) | adds `rtl:space-x-reverse` / `rtl:divide-x-reverse` when missing |
| 4.x | `margin-inline-*`, `border-inline-*` (logical) | removes `rtl:space-x-reverse` / `rtl:divide-x-reverse`, which now undo the flip |

The version comes from the installed `tailwindcss` package, then the range in the
nearest `package.json`. Set it explicitly with `settings.rtlDoctor.tailwindVersion` or
the `tailwindVersion` option. When it is unknown, `left-*` fixes to `start-*` (valid
from 3.3 through 4.x) and the `space-x` checks are skipped.

## What it leaves alone

Direction-neutral or deliberate code is not reported:

- symmetric pairs in one string: `pl-4 pr-4`, `left-0 right-0`, `md:ml-2 md:mr-2`
- the centring idiom: `left-1/2 -translate-x-1/2` (any `translate-x-*` next to `left-*` / `right-*`)
- classes under a direction variant: `rtl:mr-2`, `ltr:ml-2`, `[dir=rtl]:ml-2`, `in-[[dir=ltr]]:pl-4`
- partial classes built at runtime: `` `ml-${size}` ``, `"pl-" + n`

## Where it looks

- JSX attributes named `class`, `className`, `classNames` or `*ClassName`
- calls to `cn`, `clsx`, `classnames`, `classNames`, `cx`, `twMerge`, `twJoin`, `cva`, `tv`
  (strings, template literals, conditionals, `&&`, arrays, object keys, and object values for `cva` / `tv` configs)
- tagged templates `tw\`...\`` and `tw.div\`...\``
- variables whose name ends in `class`, `classes`, `className` or `classNames`

## Options

```js
"rtl-doctor/tailwind-logical": ["error", {
  attributes: "^(class|className|[A-Za-z]+ClassName|classNames)$", // regex source
  callees: ["cn", "clsx", "classnames", "classNames", "cx", "twMerge", "twJoin", "cva", "tv"],
  tags: ["tw"],
  variables: "(class|classes|className|classNames)$", // regex source, case-insensitive
  prefix: "",            // Tailwind v3 prefix, for example "tw-"
  tailwindVersion: "4.3" // overrides detection
}]
```
