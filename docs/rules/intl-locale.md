# `intl-locale`

`toLocaleString()` and the `Intl` formatters without a locale use whatever locale the
runtime has. In a server-rendered React app that is the server's locale (usually
`en-US`) during SSR and the browser's on the client, so:

- the HTML and the hydrated page disagree, and React reports a hydration mismatch;
- a Persian page shows Latin digits and Gregorian dates for most users;
- `a.localeCompare(b)` sorts Persian by code point, so `پ چ ژ گ ک ی` land after the Arabic letters.

- Type: problem
- Autofix: no. It offers an editor suggestion, because adding `'fa-IR'` changes the output:
  digits become `۰` to `۹` and dates switch to the Jalali calendar. Decide per call.
- In configs: `persian` (as a warning, locale `fa-IR`)

## What it checks

| Call | Locale argument |
|------|-----------------|
| `x.toLocaleString()`, `x.toLocaleDateString()`, `x.toLocaleTimeString()` | first |
| `a.localeCompare(b)` | second |
| `Intl.NumberFormat`, `DateTimeFormat`, `RelativeTimeFormat`, `PluralRules`, `ListFormat`, `Collator`, `DisplayNames`, `Segmenter`, `DurationFormat` (with or without `new`) | first |

The locale counts as missing when the argument is absent, `undefined`, `void 0` or `[]`.
Any other expression (`locale`, `navigator.language`, `"en-US"`) is accepted as a decision.

```js
n.toLocaleString();                     // reported, suggests n.toLocaleString('fa-IR')
d.toLocaleDateString(undefined, opts);  // reported, suggests d.toLocaleDateString('fa-IR', opts)
names.sort((a, b) => a.localeCompare(b)); // reported, suggests a.localeCompare(b, 'fa-IR')
new Intl.NumberFormat("en-US");         // fine: an explicit choice
```

## Options

```js
"rtl-doctor/intl-locale": ["warn", { locale: "fa-IR" }]
```

The locale defaults to the rule option, then `settings.rtlDoctor.locale`, then `fa-IR`.
