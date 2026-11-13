import { readFileSync } from "node:fs";
import type { ESLint, Linter, Rule } from "eslint";
import { intlLocale } from "./rules/intl-locale.js";
import { persianChars } from "./rules/persian-chars.js";
import { tailwindLogical } from "./rules/tailwind-logical.js";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

export const rules = {
  "tailwind-logical": tailwindLogical as unknown as Rule.RuleModule,
  "persian-chars": persianChars as unknown as Rule.RuleModule,
  "intl-locale": intlLocale as unknown as Rule.RuleModule,
};

export interface RtlDoctorPlugin extends ESLint.Plugin {
  meta: { name: string; version: string; namespace: string };
  rules: typeof rules;
  configs: {
    /** Layout rules for any right-to-left app (Persian, Arabic, Hebrew, Urdu...). */
    recommended: Linter.Config;
    /** `recommended` plus the Persian text rules: Arabic letters and digits, and a fa-IR locale. */
    persian: Linter.Config;
  };
}

export const plugin: RtlDoctorPlugin = {
  meta: { name: "rtl-doctor", version, namespace: "rtl-doctor" },
  rules,
  configs: {} as RtlDoctorPlugin["configs"],
};

plugin.configs.recommended = {
  name: "rtl-doctor/recommended",
  plugins: { "rtl-doctor": plugin },
  rules: {
    "rtl-doctor/tailwind-logical": "error",
  },
};

plugin.configs.persian = {
  name: "rtl-doctor/persian",
  plugins: { "rtl-doctor": plugin },
  rules: {
    "rtl-doctor/tailwind-logical": "error",
    "rtl-doctor/persian-chars": ["error", { assumePersian: true }],
    // A suggestion, not an autofix: adding fa-IR changes digits and switches dates to Jalali.
    "rtl-doctor/intl-locale": ["warn", { locale: "fa-IR" }],
  },
};
