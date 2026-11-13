import { rules } from "../../src/plugin.js";
import { ar, ruleTester } from "../helpers.js";

const rule = rules["persian-chars"];

ruleTester().run("persian-chars", rule, {
  valid: [
    `const s = "سلام دنیا، کتاب پیک";`,
    `<p>کتاب\u200Cهای فارسی</p>`,
    // Only shared letters: Persian or Arabic? Without assumePersian, leave it.
    `const s = "${ar("علی")}";`,
    // Arabic text in an Arabic app (no Persian-only letters).
    `const s = "${ar("کتاب")} ${ar("عربی")}";`,
    // Teh marbuta marks Arabic even when the app is Persian.
    { code: `const s = "مدرسة ${ar("کبیرة")}";`, options: [{ assumePersian: true }] },
    // Module specifiers and directives are not text.
    { code: `import x from "./${ar("کتاب")}.js"; export * from "./${ar("کتاب")}";`, options: [{ assumePersian: true }] },
    { code: `const m = require("${ar("کتاب")}");`, options: [{ assumePersian: true }] },
    // Ignored on request.
    { code: `const verse = "${ar("پیکر")}";`, options: [{ ignore: ["^پ"] }] },
    // Digits only when asked.
    { code: `const price = "قیمت \u0664\u0665\u0660";`, options: [{ digits: false }] },
    `const n = 42; const re = /\u064A/;`,
  ],
  invalid: [
    {
      code: `const s = "${ar("کتاب پیک")}";`,
      output: `const s = "کتاب پیک";`,
      errors: [{ messageId: "arabicChars", line: 1, column: 12 }],
    },
    {
      code: `<p>${ar("کارگر خوب")}</p>`,
      output: `<p>کارگر خوب</p>`,
      errors: 1,
    },
    {
      code: `<input placeholder="${ar("پیام خود را بنویسید")}" />`,
      output: `<input placeholder="پیام خود را بنویسید" />`,
      errors: 1,
    },
    {
      // The Persian word in the second part makes the whole template Persian.
      code: `const s = \`${ar("کیف")} \${x} پول\`;`,
      output: `const s = \`کیف \${x} پول\`;`,
      errors: 1,
    },
    {
      code: `const s = "${ar("کتاب")}";`,
      output: `const s = "کتاب";`,
      options: [{ assumePersian: true }],
      errors: 1,
    },
    {
      // Arabic-Indic digits look different from Persian ones for 4, 5 and 6.
      code: `const price = "قیمت \u0664\u0665\u0660 تومان";`,
      output: `const price = "قیمت ۴۵۰ تومان";`,
      errors: 1,
    },
    {
      // Alef maksura at the end of a word, from copy-pasted Arabic text.
      code: `const name = "آقای مصطف\u0649";`,
      output: `const name = "آقای مصطفی";`,
      errors: 1,
    },
    {
      code: `const t = { "${ar("کلید")}": "${ar("پیک")}" };`,
      output: `const t = { "${ar("کلید")}": "پیک" };`,
      errors: 1,
    },
  ],
});
