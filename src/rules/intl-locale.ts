import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { docsUrl, settingsOf } from "./utils.js";

export interface IntlLocaleOptions {
  /** The locale to suggest. Defaults to `settings.rtlDoctor.locale`, then "fa-IR". */
  locale?: string;
}

/** Method name -> index of its `locales` argument. */
const METHODS: Readonly<Record<string, number>> = {
  toLocaleString: 0,
  toLocaleDateString: 0,
  toLocaleTimeString: 0,
  localeCompare: 1,
};

const INTL = new Set([
  "NumberFormat",
  "DateTimeFormat",
  "RelativeTimeFormat",
  "PluralRules",
  "ListFormat",
  "Collator",
  "DisplayNames",
  "Segmenter",
  "DurationFormat",
]);

type Call = TSESTree.CallExpression | TSESTree.NewExpression;

function propertyName(node: TSESTree.MemberExpression): string | undefined {
  if (!node.computed && node.property.type === "Identifier") return node.property.name;
  if (node.computed && node.property.type === "Literal" && typeof node.property.value === "string") return node.property.value;
  return undefined;
}

/** What is being called and where its locale argument goes, or undefined for unrelated calls. */
function target(node: Call): { name: string; index: number } | undefined {
  const callee = node.callee;
  if (callee.type !== "MemberExpression") return undefined;
  const name = propertyName(callee);
  if (!name) return undefined;
  if (callee.object.type === "Identifier" && callee.object.name === "Intl" && INTL.has(name)) return { name: `Intl.${name}`, index: 0 };
  if (node.type === "CallExpression" && Object.hasOwn(METHODS, name)) return { name, index: METHODS[name]! };
  return undefined;
}

const isMissing = (arg: TSESTree.Node | undefined) =>
  !arg ||
  (arg.type === "Identifier" && arg.name === "undefined") ||
  (arg.type === "UnaryExpression" && arg.operator === "void") ||
  (arg.type === "ArrayExpression" && arg.elements.length === 0);

export const intlLocale: TSESLint.RuleModule<"missingLocale" | "addLocale", [IntlLocaleOptions?]> = {
  meta: {
    type: "problem",
    hasSuggestions: true,
    docs: {
      description: "Pass an explicit locale to toLocaleString, localeCompare and Intl formatters",
      url: docsUrl("intl-locale"),
    },
    schema: [{ type: "object", additionalProperties: false, properties: { locale: { type: "string" } } }],
    messages: {
      missingLocale:
        "`{{name}}` without a locale uses the server's locale during SSR and the browser's on the client (hydration mismatch, Latin digits, wrong Persian sort order); pass '{{locale}}'.",
      addLocale: "Pass '{{locale}}' (changes digits to Persian and dates to the Jalali calendar).",
    },
  },
  defaultOptions: [{}],
  create(context) {
    const locale = context.options[0]?.locale ?? settingsOf(context).locale ?? "fa-IR";
    const sourceCode = context.sourceCode;
    const literal = `'${locale.replace(/'/g, "\\'")}'`;

    function check(node: Call) {
      const found = target(node);
      if (!found) return;
      const { name, index } = found;
      const args = node.arguments;
      // localeCompare() with no compare string is broken code, not a locale problem.
      if (args.length < index) return;
      const arg = args[index];
      if (!isMissing(arg)) return;
      // A spread could supply the locale.
      if (args.some((a) => a.type === "SpreadElement")) return;

      const fix = (fixer: TSESLint.RuleFixer): TSESLint.RuleFix | null => {
        if (arg) return fixer.replaceText(arg, literal);
        if (index > 0) return fixer.insertTextAfter(args[index - 1]!, `, ${literal}`);
        const last = sourceCode.getLastToken(node);
        if (!last) return null;
        // `new Intl.NumberFormat` without parentheses.
        if (last.value !== ")") return fixer.insertTextAfter(node, `(${literal})`);
        return fixer.insertTextBefore(last, literal);
      };

      context.report({
        node,
        messageId: "missingLocale",
        data: { name: name.startsWith("Intl.") ? name : `${name}()`, locale },
        suggest: [{ messageId: "addLocale", data: { locale }, fix }],
      });
    }

    return { CallExpression: check, NewExpression: check };
  },
};
