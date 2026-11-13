import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { analyzeClassList, type ClassSegment, type Direction } from "../core/tailwind.js";
import { detectTailwindVersion, parseTailwindVersion } from "../core/tailwind-version.js";
import { tailwindMessage } from "../core/messages.js";
import { docsUrl, quasiRanges, settingsOf } from "./utils.js";

export interface TailwindLogicalOptions {
  /** Attribute names that hold classes, as a regex source. */
  attributes?: string;
  /** Function names whose string arguments are classes. */
  callees?: string[];
  /** Tagged template names whose text is classes (`tw\`...\``). */
  tags?: string[];
  /** Variable names that hold classes, as a regex source. */
  variables?: string;
  /** Tailwind v3 `prefix`, for example "tw-". */
  prefix?: string;
  /** Overrides the detected Tailwind version, for example "3.4" or "4.2". */
  tailwindVersion?: string;
  /** The direction the UI renders in today; overrides `settings.rtlDoctor.direction`. Default "ltr". */
  direction?: Direction;
}

type MessageId = "physical" | "physicalNoFix" | "spaceReverseMissing" | "spaceReverseHarmful";

const DEFAULTS = {
  attributes: "^(class|className|[A-Za-z]+ClassName|classNames)$",
  callees: ["cn", "clsx", "classnames", "classNames", "cx", "twMerge", "twJoin", "cva", "tv"],
  tags: ["tw"],
  variables: "(class|classes|className|classNames)$",
};

export const tailwindLogical: TSESLint.RuleModule<MessageId, [TailwindLogicalOptions?]> = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description: "Use logical Tailwind classes (ms-*, ps-*, start-*, text-start...) that flip in RTL",
      url: docsUrl("tailwind-logical"),
    },
    schema: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          attributes: { type: "string" },
          callees: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } },
          variables: { type: "string" },
          prefix: { type: "string" },
          tailwindVersion: { type: "string" },
          direction: { type: "string", enum: ["ltr", "rtl", "both"] },
        },
      },
    ],
    messages: {
      physical: "{{message}}",
      physicalNoFix: "{{message}}",
      spaceReverseMissing: "{{message}}",
      spaceReverseHarmful: "{{message}}",
    },
  },
  defaultOptions: [{}],
  create(context) {
    const option = context.options[0] ?? {};
    const settings = settingsOf(context);
    const version =
      parseTailwindVersion(option.tailwindVersion ?? settings.tailwindVersion) ?? detectTailwindVersion(context.cwd);
    const prefix = option.prefix ?? "";
    const appDirection: Direction = option.direction ?? settings.direction ?? "ltr";
    const attributes = new RegExp(option.attributes ?? DEFAULTS.attributes);
    const callees = new Set(option.callees ?? DEFAULTS.callees);
    const tags = new Set(option.tags ?? DEFAULTS.tags);
    const variables = new RegExp(option.variables ?? DEFAULTS.variables, "i");
    const sourceCode = context.sourceCode;
    const text = sourceCode.text;

    /** Collects class text from an expression. Helper calls are skipped: they get their own visit. */
    function collect(node: TSESTree.Node | null, out: ClassSegment[], inHelper: boolean): void {
      if (!node) return;
      switch (node.type) {
        case "Literal":
          if (typeof node.value === "string") out.push({ text: text.slice(node.range[0] + 1, node.range[1] - 1), offset: node.range[0] + 1 });
          return;
        case "TemplateLiteral": {
          const ranges = quasiRanges(node, text);
          ranges.forEach((range, i) => {
            const raw = text.slice(range.start, range.end);
            out.push({
              text: raw,
              offset: range.start,
              partialStart: i > 0 && !/^\s/.test(raw),
              partialEnd: i < ranges.length - 1 && !/\s$/.test(raw),
            });
          });
          for (const expression of node.expressions) collect(expression, out, inHelper);
          return;
        }
        case "ConditionalExpression":
          collect(node.consequent, out, inHelper);
          collect(node.alternate, out, inHelper);
          return;
        case "LogicalExpression":
          collect(node.left, out, inHelper);
          collect(node.right, out, inHelper);
          return;
        case "BinaryExpression": {
          if (node.operator !== "+") return;
          const left: ClassSegment[] = [];
          const right: ClassSegment[] = [];
          collect(node.left, left, inHelper);
          collect(node.right, right, inHelper);
          const lastLeft = left.at(-1);
          if (lastLeft && !/\s$/.test(lastLeft.text)) lastLeft.partialEnd = true;
          const firstRight = right[0];
          if (firstRight && !/^\s/.test(firstRight.text)) firstRight.partialStart = true;
          out.push(...left, ...right);
          return;
        }
        case "ArrayExpression":
          for (const element of node.elements) collect(element, out, inHelper);
          return;
        case "ObjectExpression":
          for (const property of node.properties) {
            if (property.type === "SpreadElement") {
              collect(property.argument, out, inHelper);
              continue;
            }
            // clsx({ "ml-2": active }) uses keys; cva/tv configs use values.
            if (property.key.type === "Literal" || property.key.type === "TemplateLiteral") collect(property.key, out, inHelper);
            if (inHelper) collect(property.value, out, inHelper);
          }
          return;
        case "SpreadElement":
          collect(node.argument, out, inHelper);
          return;
        case "TSAsExpression":
        case "TSSatisfiesExpression":
        case "TSNonNullExpression":
          collect(node.expression, out, inHelper);
          return;
        default:
          return;
      }
    }

    /** A static `dir` on a JSX element: "ltr" / "rtl", "both" for `auto` or a dynamic value, undefined when absent. */
    function dirOf(element: TSESTree.JSXOpeningElement): Direction | undefined {
      for (const attribute of element.attributes) {
        if (attribute.type !== "JSXAttribute" || attribute.name.type !== "JSXIdentifier" || attribute.name.name !== "dir") continue;
        let value: TSESTree.Node | null = attribute.value;
        if (value?.type === "JSXExpressionContainer") value = value.expression;
        if (value?.type === "Literal" && (value.value === "ltr" || value.value === "rtl")) return value.value;
        return "both";
      }
      return undefined;
    }

    /** The direction a node renders in: the nearest JSX `dir` around it, else the app's. */
    function directionAt(node: TSESTree.Node): Direction {
      for (let n: TSESTree.Node | undefined = node; n; n = n.parent) {
        if (n.type === "JSXElement") {
          const dir = dirOf(n.openingElement);
          if (dir) return dir;
        }
      }
      return appDirection;
    }

    function check(segments: ClassSegment[], at: TSESTree.Node) {
      if (segments.length === 0) return;
      for (const finding of analyzeClassList(segments, { version, prefix, direction: directionAt(at) })) {
        const { start, end } = finding.token;
        const loc = { start: sourceCode.getLocFromIndex(start), end: sourceCode.getLocFromIndex(end) };
        const data = { message: tailwindMessage(finding) };
        if (finding.kind === "physical") {
          const replacement = finding.replacement;
          if (replacement === null) context.report({ loc, messageId: "physicalNoFix", data });
          else context.report({ loc, messageId: "physical", data, fix: (fixer) => fixer.replaceTextRange([start, end], replacement) });
        } else if (finding.kind === "space-reverse-missing") {
          context.report({
            loc,
            messageId: "spaceReverseMissing",
            data,
            fix: (fixer) => fixer.insertTextAfterRange([start, end], ` ${finding.insert}`),
          });
        } else {
          context.report({ loc, messageId: "spaceReverseHarmful", data, fix: (fixer) => fixer.removeRange(removalRange(start, end)) });
        }
      }
    }

    /** The token plus one run of whitespace next to it, so no double spaces are left behind. */
    function removalRange(start: number, end: number): [number, number] {
      let before = start;
      while (/[ \t]/.test(text[before - 1] ?? "")) before--;
      if (before < start) return [before, end];
      let after = end;
      while (/[ \t]/.test(text[after] ?? "")) after++;
      return [start, after];
    }

    const nameOf = (node: TSESTree.JSXAttribute) =>
      node.name.type === "JSXIdentifier" ? node.name.name : `${node.name.namespace.name}:${node.name.name.name}`;

    const isTag = (tag: TSESTree.Node): boolean =>
      (tag.type === "Identifier" && tags.has(tag.name)) ||
      (tag.type === "MemberExpression" && isTag(tag.object)) ||
      (tag.type === "CallExpression" && isTag(tag.callee));

    return {
      JSXAttribute(node) {
        if (!node.value || !attributes.test(nameOf(node))) return;
        const segments: ClassSegment[] = [];
        if (node.value.type === "Literal") collect(node.value, segments, false);
        else if (node.value.type === "JSXExpressionContainer" && node.value.expression.type !== "JSXEmptyExpression") {
          collect(node.value.expression, segments, false);
        }
        check(segments, node);
      },
      CallExpression(node) {
        if (node.callee.type !== "Identifier" || !callees.has(node.callee.name)) return;
        const segments: ClassSegment[] = [];
        for (const argument of node.arguments) collect(argument, segments, true);
        check(segments, node);
      },
      TaggedTemplateExpression(node) {
        if (!isTag(node.tag)) return;
        const segments: ClassSegment[] = [];
        collect(node.quasi, segments, false);
        check(segments, node);
      },
      VariableDeclarator(node) {
        if (node.id.type !== "Identifier" || !variables.test(node.id.name) || !node.init) return;
        const segments: ClassSegment[] = [];
        collect(node.init, segments, false);
        check(segments, node);
      },
    };
  },
};
