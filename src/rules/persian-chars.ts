import type { TSESLint } from "@typescript-eslint/utils";
import { describeArabicChars, findArabicChars, fixArabicChars, isPersianText, type PersianOptions } from "../core/persian.js";
import { docsUrl, isNonTextString, literalRange, quasiRanges, type TextRange } from "./utils.js";

export interface PersianCharsOptions extends PersianOptions {
  /** Regex sources; strings matching any of them are skipped (Quran verses, Arabic names). */
  ignore?: string[];
}

export const persianChars: TSESLint.RuleModule<"arabicChars", [PersianCharsOptions?]> = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description: "Use Persian ی and ک (and Persian digits) instead of their Arabic look-alikes in Persian text",
      url: docsUrl("persian-chars"),
    },
    schema: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          assumePersian: { type: "boolean" },
          digits: { type: "boolean" },
          ignore: { type: "array", items: { type: "string" } },
        },
      },
    ],
    messages: {
      arabicChars: "Persian text uses {{chars}}; search and sorting treat them as different letters.",
    },
  },
  defaultOptions: [{}],
  create(context) {
    const option = context.options[0] ?? {};
    const base: PersianOptions = { assumePersian: option.assumePersian ?? false, digits: option.digits ?? true };
    const ignore = (option.ignore ?? []).map((source) => new RegExp(source, "u"));
    const sourceCode = context.sourceCode;
    const text = sourceCode.text;

    function check(range: TextRange, options: PersianOptions) {
      const raw = text.slice(range.start, range.end);
      if (ignore.some((pattern) => pattern.test(raw))) return;
      const found = findArabicChars(raw, options);
      if (found.length === 0) return;
      const at = range.start + found[0]!.index;
      context.report({
        loc: { start: sourceCode.getLocFromIndex(at), end: sourceCode.getLocFromIndex(at + 1) },
        messageId: "arabicChars",
        data: { chars: describeArabicChars(found) },
        fix: (fixer) => fixer.replaceTextRange([range.start, range.end], fixArabicChars(raw, options)),
      });
    }

    return {
      Literal(node) {
        if (typeof node.value !== "string" || isNonTextString(node)) return;
        check(literalRange(node), base);
      },
      TemplateLiteral(node) {
        const ranges = quasiRanges(node, text);
        // A Persian word in one part makes the whole template Persian: `عل\u064A ${x} پسر`.
        const whole = ranges.map((r) => text.slice(r.start, r.end)).join(" ");
        const options = { ...base, assumePersian: base.assumePersian || isPersianText(whole) };
        for (const range of ranges) check(range, options);
      },
      JSXText(node) {
        check({ start: node.range[0], end: node.range[1] }, base);
      },
    };
  },
};
