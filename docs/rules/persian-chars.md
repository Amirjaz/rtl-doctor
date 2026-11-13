# `persian-chars`

Arabic keyboards, copy-pasted text and old databases put Arabic letters into Persian
text. They look almost the same, but search, sorting, `===` and some fonts treat them
as different characters: a user who types `کتاب` never finds `كتاب`.

- Type: problem
- Autofix: yes
- In configs: `persian` (with `assumePersian: true`)
- Also run by the CLI on Persian message files (`fa.json`, `fa-IR.json`, `locales/fa/*.json`)

| Found | Replaced with |
|-------|---------------|
| `ي` ARABIC LETTER YEH (U+064A) | `ی` ARABIC LETTER FARSI YEH (U+06CC) |
| `ى` ARABIC LETTER ALEF MAKSURA (U+0649) | `ی` (U+06CC) |
| `ك` ARABIC LETTER KAF (U+0643) | `ک` ARABIC LETTER KEHEH (U+06A9) |
| `٠١٢٣٤٥٦٧٨٩` ARABIC-INDIC DIGITS (U+0660 to U+0669) | `۰۱۲۳۴۵۶۷۸۹` EXTENDED ARABIC-INDIC DIGITS (U+06F0 to U+06F9) |

The digits matter because 4, 5 and 6 have different shapes (`٤٥٦` against `۴۵۶`).

## Which strings count as Persian

An Arabic app uses `ي` and `ك` correctly, so the rule only touches Persian text:

- a string with a Persian-only letter or digit (`پ چ ژ گ ک ی`, `۰` to `۹`) is Persian;
- with `assumePersian: true` (the `persian` config, or the CLI in a Persian app) any
  Arabic-script string counts, unless it contains `ة` (teh marbuta), which marks Arabic;
- a template literal is judged as a whole, so `` `علي ${x} پسر` `` is Persian.

It checks string literals, template literals, JSX text and JSX attribute values. Module
specifiers (`import`, `export ... from`, `require`) and directives are skipped.

## Options

```js
"rtl-doctor/persian-chars": ["error", {
  assumePersian: false, // treat every Arabic-script string as Persian
  digits: true,         // also replace Arabic-Indic digits
  ignore: ["^بسم"]      // regex sources; matching strings are skipped (Quran verses, Arabic names)
}]
```
