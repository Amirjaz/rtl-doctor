import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import { describe, it } from "vitest";

// Vitest runs without globals, so hand RuleTester its test functions.
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

/**
 * A RuleTester for TSX with a pinned Tailwind version and an LTR page, so results never
 * depend on what is installed. RTL and unknown directions are tested explicitly.
 */
export function ruleTester(tailwindVersion = "4.3") {
  return new RuleTester({
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { rtlDoctor: { tailwindVersion, direction: "ltr" } },
  });
}

/**
 * Breaks Persian text the way an Arabic keyboard or a bad conversion does:
 * FARSI YEH -> ARABIC YEH and KEHEH -> ARABIC KAF. Tests write correct Persian and
 * call ar() for the broken input, because the pairs look the same on screen.
 */
export const ar = (text: string) => text.replace(/\u06CC/g, "\u064A").replace(/\u06A9/g, "\u0643");
