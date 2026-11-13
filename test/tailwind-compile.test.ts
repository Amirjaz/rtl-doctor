/**
 * Proves the Tailwind mapping against real Tailwind instead of trusting the table:
 * every replacement class must exist in Tailwind 3.4 and 4.3, and must set exactly the
 * logical twins (per the CSS rule's own property table) of what the physical class sets.
 */
import { createRequire } from "node:module";
import { compile } from "@tailwindcss/node";
import postcss from "postcss";
import { beforeAll, describe, expect, it } from "vitest";
import { PHYSICAL_PROPERTIES, PHYSICAL_VALUES } from "../src/core/css.js";
import { formatClass, logicalUtility, parseClass } from "../src/core/tailwind.js";
import { parseTailwindVersion, type TailwindVersion } from "../src/core/tailwind-version.js";

const require = createRequire(import.meta.url);

const SAMPLES = [
  "ml-4", "mr-4", "-ml-4", "ml-auto", "ml-[13px]",
  "pl-2", "pr-2", "pr-[3px]",
  "scroll-ml-4", "scroll-mr-4", "scroll-pl-4", "scroll-pr-4",
  "left-0", "right-2", "-left-2", "left-1/2", "left-[13px]", "right-full",
  "border-l", "border-r-2", "border-l-red-500",
  "rounded-l-md", "rounded-r", "rounded-tl-lg", "rounded-tr-lg", "rounded-bl-lg", "rounded-br-lg",
  "text-left", "text-right", "float-left", "float-right", "clear-left", "clear-right",
];

type Decls = Map<string, string>;
type Compiled = Map<string, Decls>;

/** Class name -> its declarations (custom properties dropped), from compiled CSS. */
function collect(css: string): Compiled {
  const out: Compiled = new Map();
  postcss.parse(css).walkRules((rule) => {
    const match = /\.((?:\\.|[\w-])+)/.exec(rule.selector);
    if (!match) return;
    const name = match[1]!.replace(/\\(.)/g, "$1");
    const decls = out.get(name) ?? new Map<string, string>();
    rule.walkDecls((decl) => {
      if (!decl.prop.startsWith("--")) decls.set(decl.prop, decl.value.trim());
    });
    out.set(name, decls);
  });
  return out;
}

async function compileV4(classes: string[]): Promise<Compiled> {
  const compiler = await compile('@import "tailwindcss/theme.css" theme(reference); @import "tailwindcss/utilities.css";', {
    base: process.cwd(),
    onDependency() {},
  });
  return collect(compiler.build(classes));
}

async function compileV3(classes: string[]): Promise<Compiled> {
  const tailwind = require("tailwindcss3");
  const result = await postcss([
    tailwind({ content: [{ raw: classes.join(" "), extension: "html" }], corePlugins: { preflight: false } }),
  ]).process("@tailwind utilities;", { from: undefined });
  return collect(result.css);
}

/** Logical property and value names, resolved to the physical ones for one direction. */
const LOGICAL_TO_PHYSICAL: Readonly<Record<"ltr" | "rtl", Readonly<Record<string, string>>>> = {
  ltr: Object.fromEntries(Object.entries(PHYSICAL_PROPERTIES).map(([physical, logical]) => [logical, physical])),
  // In RTL the inline start is the right side, so each logical name maps to its mirror.
  rtl: Object.fromEntries(
    Object.entries(PHYSICAL_PROPERTIES).map(([physical, logical]) => [
      logical,
      physical.includes("left") ? physical.replace("left", "right") : physical.replace("right", "left"),
    ]),
  ),
};

const LOGICAL_VALUES: Readonly<Record<"ltr" | "rtl", Readonly<Record<string, string>>>> = {
  ltr: { start: "left", end: "right", "inline-start": "left", "inline-end": "right" },
  rtl: { start: "right", end: "left", "inline-start": "right", "inline-end": "left" },
};

/**
 * The physical sides a class actually paints in one direction: a comparable shape for a
 * physical class (where it is the declaration itself) and for a logical one (resolved).
 */
function physicalShape(decls: Decls, direction: "ltr" | "rtl"): string[] {
  return [...decls]
    .map(([prop, value]) => {
      const property = LOGICAL_TO_PHYSICAL[direction][prop] ?? prop;
      const resolved = LOGICAL_VALUES[direction][value] ?? value;
      // Keep the value only for the keyword properties, where the value carries the side.
      return Object.hasOwn(PHYSICAL_VALUES, property) ? `${property}: ${resolved}` : property;
    })
    .sort();
}

describe.each([
  ["3.4", compileV3],
  ["4.3", compileV4],
] as const)("Tailwind %s", (label, compileWith) => {
  const version = parseTailwindVersion(label) as TailwindVersion;
  const twin = (cls: string, direction: "ltr" | "rtl") => {
    const parsed = parseClass(cls)!;
    const utility = logicalUtility(parsed.utility, version, direction);
    return utility ? formatClass({ ...parsed, utility }) : null;
  };
  const pairs = SAMPLES.map((cls) => [cls, twin(cls, "ltr")] as const);
  const rtlPairs = SAMPLES.map((cls) => [cls, twin(cls, "rtl")] as const);
  let compiled: Compiled;

  beforeAll(async () => {
    const all = [
      ...[...pairs, ...rtlPairs].flatMap(([a, b]) => (b ? [a, b] : [a])),
      "space-x-4",
      "divide-x",
      "rtl:space-x-reverse",
    ];
    compiled = await compileWith(all);
  });

  /**
   * The heart of the fix contract: the replacement, resolved for the direction the code
   * renders in, must paint exactly the sides the class it replaced painted.
   */
  it.each([...pairs.map((p) => ["ltr", ...p] as const), ...rtlPairs.map((p) => ["rtl", ...p] as const)])(
    "in %s, %s -> %s keeps the same sides",
    (direction, physical, logical) => {
      expect(logical, `no logical twin for ${physical}`).not.toBeNull();
      const before = compiled.get(physical);
      const after = compiled.get(logical!);
      expect(before, `${physical} does not compile`).toBeDefined();
      expect(after, `${logical} does not compile`).toBeDefined();
      expect(before!.size).toBeGreaterThan(0);
      expect(physicalShape(after!, direction)).toEqual(physicalShape(before!, direction));
    },
  );

  it("writes space-x the way the version check assumes", () => {
    const props = [...(compiled.get("space-x-4")?.keys() ?? [])];
    if (version.major === 3) expect(props).toEqual(expect.arrayContaining(["margin-left", "margin-right"]));
    else expect(props).toEqual(expect.arrayContaining(["margin-inline-start", "margin-inline-end"]));
    const divide = [...(compiled.get("divide-x")?.keys() ?? [])];
    if (version.major === 3) expect(divide).toEqual(expect.arrayContaining(["border-left-width"]));
    else expect(divide).toEqual(expect.arrayContaining(["border-inline-start-width"]));
  });

  it("has rtl:space-x-reverse", () => {
    expect(compiled.has("rtl:space-x-reverse")).toBe(true);
  });
});
