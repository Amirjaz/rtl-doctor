import { atLeast, type TailwindVersion } from "./tailwind-version.js";

/**
 * A run of class names in source code. `offset` is the absolute position of `text[0]`
 * in the file, so findings map straight back to source ranges.
 */
export interface ClassSegment {
  text: string;
  offset: number;
  /** The first token touches an interpolation (`${x}ml-2`), so it is not a whole class. */
  partialStart?: boolean;
  /** The last token touches an interpolation or concatenation (`ml-${x}`). */
  partialEnd?: boolean;
}

export interface ClassToken {
  value: string;
  /** Absolute start and end in the file. */
  start: number;
  end: number;
  segment: number;
}

export interface ParsedClass {
  variants: string[];
  negative: boolean;
  important: "" | "prefix" | "suffix";
  utility: string;
}

/**
 * The direction code renders in today. Fixes keep today's look: in "rtl", `ml-4` (the
 * left side, which is inline-end there) becomes `me-4`. "both" means the direction is
 * dynamic, so no single fix keeps the look and findings are reported without one.
 */
export type Direction = "ltr" | "rtl" | "both";

export interface TailwindOptions {
  version?: TailwindVersion;
  /** Tailwind v3 `prefix` option, for example "tw-". (v4 prefixes look like variants and need no option.) */
  prefix?: string;
  /** Default "ltr". */
  direction?: Direction;
}

export type TailwindFinding =
  | {
      kind: "physical";
      token: ClassToken;
      direction: Direction;
      /** The logical class, or null when there is no single safe fix (old Tailwind, or direction "both"). */
      replacement: string | null;
      /** For direction "both": the fix for each design direction. */
      alternatives?: { ltr: string; rtl: string };
      /** The CSS property the class sets, for messages. */
      property: string;
      logicalProperty: string;
      minVersion: string;
      /** The installed Tailwind is older than `minVersion`. */
      tooOld: boolean;
    }
  | { kind: "space-reverse-missing"; token: ClassToken; insert: string }
  | { kind: "space-reverse-harmful"; token: ClassToken };

/** Splits class text into whitespace-separated tokens with absolute ranges. */
export function tokenize(segments: readonly ClassSegment[]): ClassToken[] {
  const tokens: ClassToken[] = [];
  segments.forEach((segment, index) => {
    const found = [...segment.text.matchAll(/\S+/g)];
    found.forEach((match, i) => {
      const start = match.index;
      const end = start + match[0].length;
      if (i === 0 && start === 0 && segment.partialStart) return;
      if (i === found.length - 1 && end === segment.text.length && segment.partialEnd) return;
      tokens.push({ value: match[0], start: segment.offset + start, end: segment.offset + end, segment: index });
    });
  });
  return tokens;
}

/** Splits `md:hover:!-ml-4` into variants, flags and the bare utility. */
export function parseClass(cls: string, prefix = ""): ParsedClass | null {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of cls) {
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth--;
    if (ch === ":" && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (depth !== 0) return null;
  let utility = current;
  let important: ParsedClass["important"] = "";
  if (utility.startsWith("!")) {
    important = "prefix";
    utility = utility.slice(1);
  } else if (utility.endsWith("!")) {
    important = "suffix";
    utility = utility.slice(0, -1);
  }
  let negative = false;
  if (utility.startsWith("-")) {
    negative = true;
    utility = utility.slice(1);
  }
  if (prefix) {
    if (!utility.startsWith(prefix)) return null;
    utility = utility.slice(prefix.length);
  }
  if (!utility) return null;
  return { variants: parts, negative, important, utility };
}

export function formatClass(parsed: ParsedClass, prefix = ""): string {
  const head = parsed.variants.map((variant) => `${variant}:`).join("");
  const bang = parsed.important === "prefix" ? "!" : "";
  const tail = parsed.important === "suffix" ? "!" : "";
  return `${head}${bang}${parsed.negative ? "-" : ""}${prefix}${parsed.utility}${tail}`;
}

/** `rtl:`, `ltr:`, `[dir=rtl]:`, `[[dir=rtl]_&]:`, `in-[[dir=rtl]]:` and friends. */
export function hasDirectionVariant(variants: readonly string[]): boolean {
  return variants.some((variant) => /^(rtl|ltr)$/.test(variant) || /dir[=(]/.test(variant));
}

interface PrefixRule {
  /** Physical utility root, for example "ml" or "rounded-tl". */
  root: string;
  logical: (version: TailwindVersion | undefined) => string;
  mirror: string;
  /** Whether the utility needs a value after the root (`ml-4`, not `ml`). */
  needsValue: boolean;
  property: string;
  logicalProperty: string;
  since: [number, number];
}

const fixed = (name: string) => () => name;
const inset = (start: boolean) => (version: TailwindVersion | undefined) =>
  // Tailwind 4.2 deprecated start-*/end-* in favour of inset-s-*/inset-e-*.
  version && atLeast(version, 4, 2) ? (start ? "inset-s" : "inset-e") : start ? "start" : "end";

const PREFIX_RULES: PrefixRule[] = [
  { root: "ml", logical: fixed("ms"), mirror: "mr", needsValue: true, property: "margin-left", logicalProperty: "margin-inline-start", since: [3, 3] },
  { root: "mr", logical: fixed("me"), mirror: "ml", needsValue: true, property: "margin-right", logicalProperty: "margin-inline-end", since: [3, 3] },
  { root: "pl", logical: fixed("ps"), mirror: "pr", needsValue: true, property: "padding-left", logicalProperty: "padding-inline-start", since: [3, 3] },
  { root: "pr", logical: fixed("pe"), mirror: "pl", needsValue: true, property: "padding-right", logicalProperty: "padding-inline-end", since: [3, 3] },
  { root: "scroll-ml", logical: fixed("scroll-ms"), mirror: "scroll-mr", needsValue: true, property: "scroll-margin-left", logicalProperty: "scroll-margin-inline-start", since: [3, 3] },
  { root: "scroll-mr", logical: fixed("scroll-me"), mirror: "scroll-ml", needsValue: true, property: "scroll-margin-right", logicalProperty: "scroll-margin-inline-end", since: [3, 3] },
  { root: "scroll-pl", logical: fixed("scroll-ps"), mirror: "scroll-pr", needsValue: true, property: "scroll-padding-left", logicalProperty: "scroll-padding-inline-start", since: [3, 3] },
  { root: "scroll-pr", logical: fixed("scroll-pe"), mirror: "scroll-pl", needsValue: true, property: "scroll-padding-right", logicalProperty: "scroll-padding-inline-end", since: [3, 3] },
  { root: "left", logical: inset(true), mirror: "right", needsValue: true, property: "left", logicalProperty: "inset-inline-start", since: [3, 3] },
  { root: "right", logical: inset(false), mirror: "left", needsValue: true, property: "right", logicalProperty: "inset-inline-end", since: [3, 3] },
  { root: "border-l", logical: fixed("border-s"), mirror: "border-r", needsValue: false, property: "the left border", logicalProperty: "border-inline-start", since: [3, 3] },
  { root: "border-r", logical: fixed("border-e"), mirror: "border-l", needsValue: false, property: "the right border", logicalProperty: "border-inline-end", since: [3, 3] },
  { root: "rounded-l", logical: fixed("rounded-s"), mirror: "rounded-r", needsValue: false, property: "the left corner radii", logicalProperty: "border-start-start-radius and border-end-start-radius", since: [3, 3] },
  { root: "rounded-r", logical: fixed("rounded-e"), mirror: "rounded-l", needsValue: false, property: "the right corner radii", logicalProperty: "border-start-end-radius and border-end-end-radius", since: [3, 3] },
  { root: "rounded-tl", logical: fixed("rounded-ss"), mirror: "rounded-tr", needsValue: false, property: "border-top-left-radius", logicalProperty: "border-start-start-radius", since: [3, 3] },
  { root: "rounded-tr", logical: fixed("rounded-se"), mirror: "rounded-tl", needsValue: false, property: "border-top-right-radius", logicalProperty: "border-start-end-radius", since: [3, 3] },
  { root: "rounded-bl", logical: fixed("rounded-es"), mirror: "rounded-br", needsValue: false, property: "border-bottom-left-radius", logicalProperty: "border-end-start-radius", since: [3, 3] },
  { root: "rounded-br", logical: fixed("rounded-ee"), mirror: "rounded-bl", needsValue: false, property: "border-bottom-right-radius", logicalProperty: "border-end-end-radius", since: [3, 3] },
];

interface ExactRule {
  logical: string;
  mirror: string;
  property: string;
  logicalProperty: string;
  since: [number, number];
}

const EXACT_RULES: Record<string, ExactRule> = {
  "text-left": { logical: "text-start", mirror: "text-right", property: "text-align: left", logicalProperty: "text-align: start", since: [3, 0] },
  "text-right": { logical: "text-end", mirror: "text-left", property: "text-align: right", logicalProperty: "text-align: end", since: [3, 0] },
  "float-left": { logical: "float-start", mirror: "float-right", property: "float: left", logicalProperty: "float: inline-start", since: [3, 4] },
  "float-right": { logical: "float-end", mirror: "float-left", property: "float: right", logicalProperty: "float: inline-end", since: [3, 4] },
  "clear-left": { logical: "clear-start", mirror: "clear-right", property: "clear: left", logicalProperty: "clear: inline-start", since: [3, 4] },
  "clear-right": { logical: "clear-end", mirror: "clear-left", property: "clear: right", logicalProperty: "clear: inline-end", since: [3, 4] },
};

// Longest roots first so "scroll-ml" wins over "ml" and "rounded-tl" over "rounded-l".
const SORTED_PREFIX_RULES = [...PREFIX_RULES].sort((a, b) => b.root.length - a.root.length);

interface PhysicalMatch {
  rule: PrefixRule | null;
  exact: ExactRule | null;
  /** "-4", "-[13px]", "" ... */
  suffix: string;
}

export function matchPhysical(utility: string): PhysicalMatch | null {
  const exact = Object.hasOwn(EXACT_RULES, utility) ? EXACT_RULES[utility] : undefined;
  if (exact) return { rule: null, exact, suffix: "" };
  for (const rule of SORTED_PREFIX_RULES) {
    if (utility === rule.root && !rule.needsValue) return { rule, exact: null, suffix: "" };
    if (utility.startsWith(`${rule.root}-`) && utility.length > rule.root.length + 1) {
      return { rule, exact: null, suffix: utility.slice(rule.root.length) };
    }
  }
  return null;
}

interface Twin {
  utility: string;
  logicalProperty: string;
}

const RULE_BY_ROOT = new Map(PREFIX_RULES.map((rule) => [rule.root, rule]));

/**
 * The logical twin that keeps today's look. In "ltr" the left side is inline-start; in
 * "rtl" it is inline-end, so the twin comes from the mirrored rule (`ml` takes `mr`'s `me`).
 */
function twin(match: PhysicalMatch, version: TailwindVersion | undefined, direction: "ltr" | "rtl"): Twin {
  if (match.exact) {
    const exact = direction === "rtl" ? EXACT_RULES[match.exact.mirror]! : match.exact;
    return { utility: exact.logical, logicalProperty: exact.logicalProperty };
  }
  const rule = direction === "rtl" ? RULE_BY_ROOT.get(match.rule!.mirror)! : match.rule!;
  return { utility: rule.logical(version) + match.suffix, logicalProperty: rule.logicalProperty };
}

const sinceOf = (match: PhysicalMatch) => (match.exact ? match.exact.since : match.rule!.since);

/**
 * The logical twin of a physical utility for this Tailwind version and the direction the
 * code renders in today, or null if this Tailwind has none.
 */
export function logicalUtility(utility: string, version?: TailwindVersion, direction: "ltr" | "rtl" = "ltr"): string | null {
  const match = matchPhysical(utility);
  if (!match) return null;
  const since = sinceOf(match);
  if (version && !atLeast(version, since[0], since[1])) return null;
  return twin(match, version, direction).utility;
}

const SPACE_X = /^(space-x|divide-x)(-.+)?$/;
const REVERSE = /^(space-x|divide-x)-reverse$/;

/**
 * Finds physical utilities and `space-x` direction problems in one class list (one
 * attribute, one helper call). Direction-neutral code is not reported: classes under a
 * direction variant, symmetric pairs in the same string, and `left-1/2 -translate-x-1/2`.
 */
export function analyzeClassList(segments: readonly ClassSegment[], options: TailwindOptions = {}): TailwindFinding[] {
  const { version, prefix = "", direction = "ltr" } = options;
  const tokens = tokenize(segments);
  const parsed = tokens.map((token) => parseClass(token.value, prefix));
  const findings: TailwindFinding[] = [];

  const hasTranslateX = parsed.some((p) => p && /^translate-x-/.test(p.utility));

  // Symmetric pairs: same variants and flags, mirrored root, same suffix, same string.
  const keyOf = (p: ParsedClass, segment: number, root: string, suffix: string) =>
    [segment, p.variants.join(":"), p.negative, p.important, root, suffix].join("|");
  const present = new Set<string>();
  parsed.forEach((p, i) => {
    if (!p) return;
    const match = matchPhysical(p.utility);
    if (match?.rule) present.add(keyOf(p, tokens[i]!.segment, match.rule.root, match.suffix));
  });

  parsed.forEach((p, i) => {
    const token = tokens[i]!;
    if (!p || hasDirectionVariant(p.variants)) return;
    const match = matchPhysical(p.utility);
    if (!match) return;
    if (match.rule) {
      if (present.has(keyOf(p, token.segment, match.rule.mirror, match.suffix))) return;
      if ((match.rule.root === "left" || match.rule.root === "right") && hasTranslateX) return;
    }
    const since = sinceOf(match);
    const tooOld = version !== undefined && !atLeast(version, since[0], since[1]);
    const format = (d: "ltr" | "rtl") => formatClass({ ...p, utility: twin(match, version, d).utility }, prefix);
    const chosen = twin(match, version, direction === "rtl" ? "rtl" : "ltr");
    findings.push({
      kind: "physical",
      token,
      direction,
      replacement: tooOld || direction === "both" ? null : format(direction),
      alternatives: direction === "both" && !tooOld ? { ltr: format("ltr"), rtl: format("rtl") } : undefined,
      property: match.exact ? match.exact.property : match.rule!.property,
      logicalProperty: chosen.logicalProperty,
      minVersion: `${since[0]}.${since[1]}`,
      tooOld,
    });
  });

  if (version?.major === 3) {
    // v3 writes space-x / divide-x with margin-left / border-left-width.
    for (const kind of ["space-x", "divide-x"] as const) {
      const hasReverse = parsed.some((p) => p?.utility === `${kind}-reverse`);
      if (hasReverse) continue;
      const index = parsed.findIndex(
        (p) =>
          p &&
          !hasDirectionVariant(p.variants) &&
          SPACE_X.test(p.utility) &&
          !REVERSE.test(p.utility) &&
          p.utility.startsWith(kind) &&
          !p.utility.endsWith("-0"),
      );
      if (index === -1) continue;
      findings.push({ kind: "space-reverse-missing", token: tokens[index]!, insert: `rtl:${prefix}${kind}-reverse` });
    }
  } else if (version && version.major >= 4) {
    // v4 writes space-x / divide-x with margin-inline-*, so reversing them under rtl undoes
    // the flip. A reversed flex row still needs the reverse, so leave those alone.
    if (parsed.some((p) => p?.utility === "flex-row-reverse")) return findings.sort((a, b) => a.token.start - b.token.start);
    parsed.forEach((p, i) => {
      if (p && REVERSE.test(p.utility) && p.variants.includes("rtl")) {
        findings.push({ kind: "space-reverse-harmful", token: tokens[i]! });
      }
    });
  }

  return findings.sort((a, b) => a.token.start - b.token.start);
}
