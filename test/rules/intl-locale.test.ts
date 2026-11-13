import { rules } from "../../src/plugin.js";
import { ruleTester } from "../helpers.js";

const rule = rules["intl-locale"];

const one = (output: string, locale = "fa-IR") => [{ messageId: "missingLocale", suggestions: [{ messageId: "addLocale", data: { locale }, output }] }];

ruleTester().run("intl-locale", rule, {
  valid: [
    `n.toLocaleString("fa-IR");`,
    `n.toLocaleString(locale);`,
    `d.toLocaleDateString(navigator.language, { month: "long" });`,
    `new Intl.NumberFormat("en-US");`,
    `Intl.DateTimeFormat(["fa-IR", "en"]);`,
    `a.localeCompare(b, "fa");`,
    `const f = n.toLocaleString;`,
    `Intl.supportedValuesOf("calendar");`,
    `x.toString();`,
    `n.toLocaleString(...args);`,
    // No compare string at all is broken code, not a locale problem.
    `a.localeCompare();`,
  ],
  invalid: [
    { code: `n.toLocaleString();`, errors: one(`n.toLocaleString('fa-IR');`) },
    { code: `price?.toLocaleString();`, errors: one(`price?.toLocaleString('fa-IR');`) },
    {
      code: `d.toLocaleDateString(undefined, { month: "long" });`,
      errors: one(`d.toLocaleDateString('fa-IR', { month: "long" });`),
    },
    { code: `d.toLocaleTimeString([]);`, errors: one(`d.toLocaleTimeString('fa-IR');`) },
    { code: `new Intl.NumberFormat();`, errors: one(`new Intl.NumberFormat('fa-IR');`) },
    { code: `new Intl.DateTimeFormat;`, errors: one(`new Intl.DateTimeFormat('fa-IR');`) },
    { code: `const c = Intl.Collator().compare;`, errors: one(`const c = Intl.Collator('fa-IR').compare;`) },
    {
      code: `new Intl.RelativeTimeFormat(void 0, { numeric: "auto" });`,
      errors: one(`new Intl.RelativeTimeFormat('fa-IR', { numeric: "auto" });`),
    },
    {
      // Without a locale, Persian letters sort by code point: پ چ ژ گ ک ی land after the Arabic ones.
      code: `names.sort((a, b) => a.localeCompare(b));`,
      errors: one(`names.sort((a, b) => a.localeCompare(b, 'fa-IR'));`),
    },
    { code: `a.localeCompare(b, undefined, { numeric: true });`, errors: one(`a.localeCompare(b, 'fa-IR', { numeric: true });`) },
    { code: `n.toLocaleString();`, options: [{ locale: "ar-EG" }], errors: one(`n.toLocaleString('ar-EG');`, "ar-EG") },
    {
      code: `n.toLocaleString();`,
      settings: { rtlDoctor: { locale: "he-IL" } },
      errors: one(`n.toLocaleString('he-IL');`, "he-IL"),
    },
  ],
});
