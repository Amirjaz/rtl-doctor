import postcss, { type AtRule, type ChildNode, type Container, type Declaration, type Root } from "postcss";
import postcssScss from "postcss-scss";
import { analyzeClassList, type Direction, type TailwindOptions } from "./tailwind.js";
import { physicalMessage, tailwindMessage } from "./messages.js";

/** Physical properties and their logical twins. */
export const PHYSICAL_PROPERTIES: Readonly<Record<string, string>> = {
  "margin-left": "margin-inline-start",
  "margin-right": "margin-inline-end",
  "padding-left": "padding-inline-start",
  "padding-right": "padding-inline-end",
  left: "inset-inline-start",
  right: "inset-inline-end",
  "border-left": "border-inline-start",
  "border-right": "border-inline-end",
  "border-left-width": "border-inline-start-width",
  "border-right-width": "border-inline-end-width",
  "border-left-style": "border-inline-start-style",
  "border-right-style": "border-inline-end-style",
  "border-left-color": "border-inline-start-color",
  "border-right-color": "border-inline-end-color",
  "border-top-left-radius": "border-start-start-radius",
  "border-top-right-radius": "border-start-end-radius",
  "border-bottom-left-radius": "border-end-start-radius",
  "border-bottom-right-radius": "border-end-end-radius",
  "scroll-margin-left": "scroll-margin-inline-start",
  "scroll-margin-right": "scroll-margin-inline-end",
  "scroll-padding-left": "scroll-padding-inline-start",
  "scroll-padding-right": "scroll-padding-inline-end",
};

/** Properties whose `left` / `right` keyword values have logical twins. */
export const PHYSICAL_VALUES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "text-align": { left: "start", right: "end" },
  float: { left: "inline-start", right: "inline-end" },
  clear: { left: "inline-start", right: "inline-end" },
};

const mirrorOf = (prop: string) =>
  prop.includes("left") ? prop.replace("left", "right") : prop.includes("right") ? prop.replace("right", "left") : prop;

export type CssRuleId = "css-logical" | "css-shorthand" | "tailwind-logical";

export interface CssFinding {
  ruleId: CssRuleId;
  message: string;
  line: number;
  column: number;
  fixable: boolean;
}

export interface CssResult {
  findings: CssFinding[];
  /** The fixed source when `fix` is on and something changed, otherwise the input. */
  output: string;
  fixed: number;
}

export interface CssOptions {
  /** Used to pick the SCSS parser for `.scss` files. */
  filename?: string;
  fix?: boolean;
  /** Report asymmetric `margin: 0 8px 0 0` style shorthands. Default true. */
  shorthand?: boolean;
  /** Check `@apply` class lists. */
  tailwind?: TailwindOptions;
  /**
   * The direction the page renders in today (default "ltr"). Fixes keep today's look, so
   * in "rtl" `margin-left` becomes `margin-inline-end`. A `direction` declaration in the
   * rule or an enclosing rule wins over this.
   */
  direction?: Direction;
}

// `.ltr` and `.rtl` as whole class names only: `.ltr-island` is an ordinary class.
const DIRECTION_SELECTOR = /\[dir\b|:dir\(|\.(rtl|ltr)(?![\w-])/i;

/**
 * Finds physical CSS properties and values (and physical Tailwind classes in `@apply`)
 * with PostCSS, and rewrites them to logical ones when `fix` is on. Formatting and
 * comments are preserved because PostCSS keeps every node's raw whitespace.
 */
export function checkCss(source: string, options: CssOptions = {}): CssResult {
  const scss = /\.scss$/i.test(options.filename ?? "");
  const root: Root = scss ? postcssScss.parse(source) : postcss.parse(source);
  const findings: CssFinding[] = [];
  let fixed = 0;
  const ignored = collectIgnored(root);

  const report = (node: ChildNode, ruleId: CssRuleId, message: string, fixable: boolean) => {
    const start = node.source?.start;
    findings.push({ ruleId, message, line: start?.line ?? 1, column: start?.column ?? 1, fixable });
  };

  root.walk((node) => {
    if (isIgnored(node, ignored) || inKeyframes(node) || underDirectionSelector(node)) return;

    if (node.type === "atrule" && node.name === "apply" && options.tailwind) {
      checkApply(node, options, report, () => fixed++);
      return;
    }
    if (node.type !== "decl") return;
    const decl = node;
    const prop = decl.prop.toLowerCase();
    const siblings = declarationsOf(decl.parent);
    const direction = directionOf(decl, options.direction ?? "ltr");

    if (Object.hasOwn(PHYSICAL_PROPERTIES, prop)) {
      if (isSymmetric(decl, siblings) || isCentred(decl, siblings) || hasDirective(decl)) return;
      const ltr = PHYSICAL_PROPERTIES[prop]!;
      const rtl = PHYSICAL_PROPERTIES[mirrorOf(prop)]!;
      const replacement = direction === "both" ? null : direction === "rtl" ? rtl : ltr;
      const subject = `\`${decl.prop}\` is physical`;
      report(decl, "css-logical", physicalMessage({ subject, direction, replacement, alternatives: { ltr, rtl } }), replacement !== null);
      if (options.fix && replacement) {
        decl.prop = replacement;
        fixed++;
      }
      return;
    }

    const values = Object.hasOwn(PHYSICAL_VALUES, prop) ? PHYSICAL_VALUES[prop] : undefined;
    const value = decl.value.trim().toLowerCase();
    if (values && Object.hasOwn(values, value)) {
      if (hasDirective(decl)) return;
      const ltr = `${decl.prop}: ${values[value]}`;
      const rtl = `${decl.prop}: ${values[value === "left" ? "right" : "left"]}`;
      const replacement = direction === "both" ? null : direction === "rtl" ? rtl : ltr;
      const subject = `\`${decl.prop}: ${value}\` is physical`;
      report(decl, "css-logical", physicalMessage({ subject, direction, replacement, alternatives: { ltr, rtl } }), replacement !== null);
      if (options.fix && replacement) {
        decl.value = replacement.slice(replacement.indexOf(":") + 2);
        fixed++;
      }
      return;
    }

    if (options.shorthand ?? true) {
      const suggestion = asymmetricShorthand(prop, decl.value, direction);
      if (suggestion) report(decl, "css-shorthand", suggestion, false);
    }
  });

  const output = options.fix && fixed > 0 ? root.toString(scss ? postcssScss.stringify : undefined) : source;
  return { findings, output, fixed };
}

function checkApply(
  node: AtRule,
  options: CssOptions,
  report: (node: ChildNode, ruleId: CssRuleId, message: string, fixable: boolean) => void,
  onFix: () => void,
) {
  const params = node.params;
  const found = analyzeClassList([{ text: params, offset: 0 }], {
    ...options.tailwind,
    direction: directionOf(node, options.direction ?? "ltr"),
  });
  const fixable = (f: (typeof found)[number]) => (f.kind === "physical" ? f.replacement !== null : true);
  for (const finding of found) report(node, "tailwind-logical", tailwindMessage(finding), fixable(finding));
  if (!options.fix) return;
  let next = params;
  // Apply right to left so earlier offsets stay valid.
  for (const finding of [...found].reverse()) {
    if (!fixable(finding)) continue;
    const { start, end } = finding.token;
    if (finding.kind === "physical") next = next.slice(0, start) + finding.replacement + next.slice(end);
    else if (finding.kind === "space-reverse-missing") next = `${next.slice(0, end)} ${finding.insert}${next.slice(end)}`;
    else next = (next.slice(0, start) + next.slice(end)).replace(/\s{2,}/g, " ").trim();
    onFix();
  }
  if (next !== params) node.params = next;
}

function declarationsOf(parent: Container | Root["parent"] | undefined): Declaration[] {
  const nodes = (parent as Container | undefined)?.nodes;
  if (!nodes) return [];
  return nodes.filter((n): n is Declaration => n.type === "decl");
}

/** `margin-left: 8px; margin-right: 8px` sets both sides alike, so it is direction-neutral. */
function isSymmetric(decl: Declaration, siblings: Declaration[]): boolean {
  const mirror = mirrorOf(decl.prop.toLowerCase());
  return siblings.some((s) => s !== decl && s.prop.toLowerCase() === mirror && normalise(s.value) === normalise(decl.value));
}

/** `left: 50%` with `transform: translateX(-50%)` centres the element in either direction. */
function isCentred(decl: Declaration, siblings: Declaration[]): boolean {
  const prop = decl.prop.toLowerCase();
  if (prop !== "left" && prop !== "right") return false;
  return siblings.some((s) => {
    const p = s.prop.toLowerCase();
    return p === "translate" || (p === "transform" && /translate(x|3d)?\(/i.test(s.value));
  });
}

/** RTLCSS value directives such as `left: 10px /* rtl:20px *\/` mean the author handled RTL already. */
function hasDirective(decl: Declaration): boolean {
  const raw = (decl.raws as { value?: { raw?: string } }).value?.raw ?? "";
  return /\/\*\s*!?\s*rtl:/i.test(raw) || /rtl:/i.test(decl.raws.important ?? "");
}

/** The loose shape shared by every PostCSS node, enough to walk up the tree. */
interface TreeNode {
  type: string;
  parent?: TreeNode;
  name?: string;
  selector?: string;
}

const ancestors = function* (node: ChildNode): Generator<TreeNode> {
  for (let p = (node as TreeNode).parent; p; p = p.parent) yield p;
};

function inKeyframes(node: ChildNode): boolean {
  for (const p of ancestors(node)) if (p.type === "atrule" && /keyframes$/i.test(p.name ?? "")) return true;
  return false;
}

function underDirectionSelector(node: ChildNode): boolean {
  for (const p of ancestors(node)) if (p.type === "rule" && DIRECTION_SELECTOR.test(p.selector ?? "")) return true;
  return false;
}

/** A `direction: ltr | rtl` declaration in the node's rule or an enclosing rule, else the fallback. */
function directionOf(node: ChildNode, fallback: Direction): Direction {
  for (const p of ancestors(node)) {
    for (const child of (p as unknown as Container).nodes ?? []) {
      if (child.type !== "decl" || child.prop.toLowerCase() !== "direction") continue;
      const value = child.value.trim().toLowerCase();
      if (value === "ltr" || value === "rtl") return value;
    }
  }
  return fallback;
}

/**
 * Nodes switched off by RTLCSS-style comments (also accepted with an `rtl-doctor-` prefix):
 * `/* rtl:ignore *\/` before a rule or declaration, and `/* rtl:begin:ignore *\/ ... /* rtl:end:ignore *\/`.
 */
function collectIgnored(root: Root): Set<ChildNode> {
  const ignored = new Set<ChildNode>();
  let inRange = false;
  root.walk((node) => {
    if (node.type === "comment") {
      const text = node.text.trim().replace(/^!\s*/, "").toLowerCase();
      if (/^(rtl|rtl-doctor):begin:ignore$/.test(text)) inRange = true;
      else if (/^(rtl|rtl-doctor):end:ignore$/.test(text)) inRange = false;
      else if (/^(rtl|rtl-doctor):ignore$/.test(text)) {
        let next = node.next();
        while (next?.type === "comment") next = next.next();
        if (next) ignored.add(next);
      }
      return;
    }
    if (inRange) ignored.add(node);
  });
  return ignored;
}

function isIgnored(node: ChildNode, ignored: Set<ChildNode>): boolean {
  if (ignored.has(node)) return true;
  for (const p of ancestors(node)) if (ignored.has(p as unknown as ChildNode)) return true;
  return false;
}

/** Splits a value on top-level whitespace, keeping `calc(1px + 2px)` together. */
export function splitValue(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value.trim()) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (current) parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

const normalise = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[-+]?0(\.0+)?[a-z%]*$/, "0");

const BOX_SHORTHANDS: Readonly<Record<string, [string, string]>> = {
  margin: ["margin-block", "margin-inline"],
  padding: ["padding-block", "padding-inline"],
  inset: ["inset-block", "inset-inline"],
  "border-width": ["border-block-width", "border-inline-width"],
  "border-style": ["border-block-style", "border-inline-style"],
  "border-color": ["border-block-color", "border-inline-color"],
  "scroll-margin": ["scroll-margin-block", "scroll-margin-inline"],
  "scroll-padding": ["scroll-padding-block", "scroll-padding-inline"],
};

const pair = (a: string, b: string) => (normalise(a) === normalise(b) ? a : `${a} ${b}`);

/** A report-only message for a four-value shorthand whose left and right differ, or null. */
export function asymmetricShorthand(prop: string, value: string, direction: Direction = "ltr"): string | null {
  if (/!important/i.test(value)) value = value.replace(/!important/i, "");
  const parts = splitValue(value);
  // In RTL the inline-start side is the right one, so the logical values swap.
  const rtl = direction === "rtl";
  const designed = direction === "both" ? ", if it was designed left-to-right" : "";
  const box = Object.hasOwn(BOX_SHORTHANDS, prop) ? BOX_SHORTHANDS[prop] : undefined;
  if (box) {
    if (parts.length !== 4) return null;
    const [top, right, bottom, left] = parts as [string, string, string, string];
    if (normalise(right) === normalise(left)) return null;
    const inline = rtl ? `${right} ${left}` : `${left} ${right}`;
    return `\`${prop}: ${parts.join(" ")}\` sets left and right differently, so it does not mirror with the text direction; use \`${box[0]}: ${pair(top, bottom)}; ${box[1]}: ${inline}\`${designed}.`;
  }
  if (prop === "border-radius") {
    if (value.includes("/") || parts.length < 2) return null;
    const [tl, tr, br, bl] =
      parts.length === 2
        ? [parts[0]!, parts[1]!, parts[0]!, parts[1]!]
        : parts.length === 3
          ? [parts[0]!, parts[1]!, parts[2]!, parts[1]!]
          : (parts as [string, string, string, string]);
    if (normalise(tl) === normalise(tr) && normalise(bl) === normalise(br)) return null;
    const [ss, se, ee, es] = rtl ? [tr, tl, bl, br] : [tl, tr, br, bl];
    return `\`border-radius: ${parts.join(" ")}\` rounds left and right corners differently, so it does not mirror with the text direction; use \`border-start-start-radius: ${ss}; border-start-end-radius: ${se}; border-end-end-radius: ${ee}; border-end-start-radius: ${es}\`${designed}.`;
  }
  return null;
}
