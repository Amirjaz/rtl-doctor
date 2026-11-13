import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

export const docsUrl = (name: string) => `https://github.com/Amirjaz/rtl-doctor/blob/main/docs/rules/${name}.md`;

/** Shared settings: `settings: { rtlDoctor: { tailwindVersion, locale } }` in an ESLint config. */
export interface RtlDoctorSettings {
  tailwindVersion?: string | number;
  locale?: string;
  /**
   * The direction the UI renders in today: "ltr", "rtl", or "both" when it switches at
   * runtime. Unset is treated as "both": findings are reported with both fixes, neither applied.
   */
  direction?: "ltr" | "rtl" | "both";
}

export function settingsOf(context: Readonly<TSESLint.RuleContext<string, readonly unknown[]>>): RtlDoctorSettings {
  const settings = context.settings as { rtlDoctor?: RtlDoctorSettings } | undefined;
  return settings?.rtlDoctor ?? {};
}

export interface TextRange {
  start: number;
  end: number;
}

/**
 * Source ranges of a template literal's raw text parts, without the backticks and `${ }`.
 * Computed from the surrounding expressions so it works the same with every parser.
 */
export function quasiRanges(node: TSESTree.TemplateLiteral, text: string): TextRange[] {
  return node.quasis.map((quasi, i) => {
    const start = i === 0 ? node.range[0] + 1 : text.indexOf("}", node.expressions[i - 1]!.range[1]) + 1;
    return { start, end: start + quasi.value.raw.length };
  });
}

/** The text between a string literal's quotes. */
export function literalRange(node: TSESTree.Node): TextRange {
  return { start: node.range[0] + 1, end: node.range[1] - 1 };
}

/** Strings that are module specifiers or directives rather than text. */
export function isNonTextString(node: TSESTree.Literal): boolean {
  const parent = node.parent;
  if (!parent) return false;
  switch (parent.type) {
    case "ImportDeclaration":
    case "ExportAllDeclaration":
    case "ExportNamedDeclaration":
    case "ImportExpression":
    case "TSExternalModuleReference":
    case "TSImportType":
      return true;
    case "ExpressionStatement":
      return "directive" in parent && typeof parent.directive === "string";
    case "CallExpression":
      return parent.callee.type === "Identifier" && parent.callee.name === "require";
    default:
      return false;
  }
}
