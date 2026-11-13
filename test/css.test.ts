import { describe, expect, it } from "vitest";
import { asymmetricShorthand, checkCss, PHYSICAL_PROPERTIES, PHYSICAL_VALUES } from "../src/core/css.js";
import { parseTailwindVersion } from "../src/core/tailwind-version.js";

const fix = (css: string, filename = "a.css") => checkCss(css, { fix: true, filename, tailwind: { version: parseTailwindVersion("4.3") } });
const ids = (css: string, filename = "a.css") => checkCss(css, { filename, tailwind: { version: parseTailwindVersion("4.3") } }).findings.map((f) => f.ruleId);

describe("css-logical", () => {
  it.each(Object.entries(PHYSICAL_PROPERTIES))("rewrites %s to %s", (physical, logical) => {
    const result = fix(`.a { ${physical}: 1px; }`);
    expect(result.output).toBe(`.a { ${logical}: 1px; }`);
    expect(result.fixed).toBe(1);
    expect(result.findings).toMatchObject([{ ruleId: "css-logical", line: 1, column: 6, fixable: true }]);
  });

  const values = Object.entries(PHYSICAL_VALUES).flatMap(([prop, map]) => Object.entries(map).map(([from, to]) => [prop, from, to]));
  it.each(values)("rewrites %s: %s to %s", (prop, from, to) => {
    expect(fix(`.a { ${prop}: ${from}; }`).output).toBe(`.a { ${prop}: ${to}; }`);
  });

  it("is case-insensitive and keeps !important, comments and formatting", () => {
    const css = `/* card */\n.card {\n  Margin-Left: 8px !important; /* gap */\n  text-align:LEFT;\n}\n`;
    expect(fix(css).output).toBe(`/* card */\n.card {\n  margin-inline-start: 8px !important; /* gap */\n  text-align:start;\n}\n`);
  });

  it("does not change the source without fix", () => {
    const css = ".a { margin-left: 1px }";
    const result = checkCss(css);
    expect(result.output).toBe(css);
    expect(result.fixed).toBe(0);
    expect(result.findings).toHaveLength(1);
  });

  it("leaves direction-neutral and deliberate code alone", () => {
    const neutral = [
      ".a { margin-left: 8px; margin-right: 8px; }",
      ".a { left: 0; right: 0px; }",
      ".a { position: absolute; left: 50%; transform: translateX(-50%); }",
      ".a { left: 50%; translate: -50% 0; }",
      '[dir="rtl"] .a { margin-left: 4px; }',
      ".a:dir(rtl) { padding-right: 2px; }",
      ".rtl .a { float: right; }",
      ".ltr > .a { margin-left: 4px; }",
      "@keyframes slide { from { left: 0 } to { left: 100% } }",
      ".a { /* rtl:ignore */ margin-left: 4px; }",
      "/* rtl:ignore */ .a { margin-left: 4px; padding-left: 2px; }",
      "/*! rtl:begin:ignore */ .a { margin-left: 4px; } .b { left: 0; } /*! rtl:end:ignore */",
      ".a { left: 10px /* rtl:20px */; }",
      "/* rtl-doctor:ignore */ .a { text-align: left; }",
      ".a { margin-inline-start: 4px; text-align: start; inset-inline-end: 0; }",
      ".a { constructor: left; toString: right; }",
    ];
    for (const css of neutral) expect(ids(css), css).toEqual([]);
  });

  it("checks again after an end:ignore", () => {
    expect(ids("/* rtl:begin:ignore */ .a { left: 0 } /* rtl:end:ignore */ .b { left: 0 }")).toEqual(["css-logical"]);
  });

  it("parses nested SCSS with // comments and variables", () => {
    const scss = `$side: left;\n.a {\n  // note\n  &:hover { margin-left: $gap; }\n  .b { text-align: right; }\n}\n`;
    const result = fix(scss, "a.scss");
    expect(result.output).toBe(`$side: left;\n.a {\n  // note\n  &:hover { margin-inline-start: $gap; }\n  .b { text-align: end; }\n}\n`);
  });

  it("checks Tailwind classes in @apply", () => {
    const result = fix(".btn { @apply ml-2 text-left px-4; }");
    expect(result.output).toBe(".btn { @apply ms-2 text-start px-4; }");
    expect(result.findings.map((f) => f.ruleId)).toEqual(["tailwind-logical", "tailwind-logical"]);
  });

  it("skips @apply when no Tailwind options are given", () => {
    expect(checkCss(".btn { @apply ml-2; }").findings).toEqual([]);
  });

  it("removes rtl:space-x-reverse in @apply for Tailwind v4", () => {
    expect(fix(".row { @apply flex space-x-2 rtl:space-x-reverse; }").output).toBe(".row { @apply flex space-x-2; }");
  });

  it("adds rtl:space-x-reverse in @apply for Tailwind v3", () => {
    const result = checkCss(".row { @apply flex space-x-2; }", { fix: true, tailwind: { version: parseTailwindVersion("3.4") } });
    expect(result.output).toBe(".row { @apply flex space-x-2 rtl:space-x-reverse; }");
  });

  it("throws on CSS that cannot be parsed, so the CLI can skip the file", () => {
    expect(() => checkCss(".a { margin-left: 1px")).toThrow();
  });
});

describe("css-shorthand", () => {
  it("reports four-value shorthands whose left and right differ, without fixing", () => {
    const result = fix(".a { margin: 0 8px 0 0; }");
    expect(result.output).toBe(".a { margin: 0 8px 0 0; }");
    expect(result.findings).toMatchObject([{ ruleId: "css-shorthand", fixable: false }]);
    expect(result.findings[0]!.message).toContain("`margin-block: 0; margin-inline: 0 8px`");
  });

  it.each([
    ["padding", "1px 2px 3px 4px", "padding-block: 1px 3px; padding-inline: 4px 2px"],
    ["inset", "0 auto auto 0", "inset-block: 0 auto; inset-inline: 0 auto"],
    ["border-width", "0 1px 0 2px", "border-block-width: 0; border-inline-width: 2px 1px"],
    ["scroll-margin", "0 calc(1rem + 2px) 0 0", "scroll-margin-block: 0; scroll-margin-inline: 0 calc(1rem + 2px)"],
  ])("suggests logical longhands for %s: %s", (prop, value, suggestion) => {
    expect(asymmetricShorthand(prop, value)).toContain(suggestion);
  });

  it.each([
    ["margin", "0 8px"],
    ["margin", "1px 2px 3px"],
    ["padding", "1px 2px 3px 2px"],
    ["margin", "0 0px 0 0"],
    ["margin", "var(--a)"],
    ["border-radius", "4px"],
    ["border-radius", "4px 4px 0 0"],
    ["border-radius", "4px / 2px"],
    ["color", "red green blue"],
  ])("leaves symmetric %s: %s alone", (prop, value) => {
    expect(asymmetricShorthand(prop, value)).toBeNull();
  });

  it.each([
    ["4px 0 0 4px", "border-start-start-radius: 4px; border-start-end-radius: 0; border-end-end-radius: 0; border-end-start-radius: 4px"],
    ["4px 0", "border-start-start-radius: 4px; border-start-end-radius: 0; border-end-end-radius: 4px; border-end-start-radius: 0"],
    ["1px 2px 3px", "border-start-start-radius: 1px; border-start-end-radius: 2px; border-end-end-radius: 3px; border-end-start-radius: 2px"],
  ])("reports border-radius: %s", (value, suggestion) => {
    expect(asymmetricShorthand("border-radius", value)).toContain(suggestion);
  });

  it("can be turned off", () => {
    expect(checkCss(".a { margin: 0 8px 0 0 }", { shorthand: false }).findings).toEqual([]);
  });
});

describe("direction", () => {
  const rtl = (css: string) => checkCss(css, { fix: true, direction: "rtl" });

  it("keeps today's look in a right-to-left page", () => {
    expect(rtl(".a { margin-left: 8px; }").output).toBe(".a { margin-inline-end: 8px; }");
    expect(rtl(".a { padding-right: 8px; }").output).toBe(".a { padding-inline-start: 8px; }");
    expect(rtl(".a { left: 0; }").output).toBe(".a { inset-inline-end: 0; }");
    expect(rtl(".a { text-align: left; }").output).toBe(".a { text-align: end; }");
    expect(rtl(".a { float: right; }").output).toBe(".a { float: inline-start; }");
    expect(rtl(".a { border-top-left-radius: 4px; }").output).toBe(".a { border-start-end-radius: 4px; }");
  });

  it("says which side it used", () => {
    const [finding] = rtl(".a { margin-left: 8px; }").findings;
    expect(finding!.message).toContain("use `margin-inline-end`, which looks the same in this right-to-left layout");
  });

  it("follows a direction declaration in the rule, over the page default", () => {
    const css = ".ltr-island { direction: ltr; text-align: left; }";
    expect(rtl(css).output).toBe(".ltr-island { direction: ltr; text-align: start; }");
    const nested = "@media print { .a { direction: rtl; margin-left: 2px } }";
    expect(checkCss(nested, { fix: true, filename: "a.scss" }).output).toBe("@media print { .a { direction: rtl; margin-inline-end: 2px } }");
  });

  it("reports without a fix when the direction is dynamic", () => {
    const result = checkCss(".a { margin-left: 8px; }", { fix: true, direction: "both" });
    expect(result.fixed).toBe(0);
    expect(result.findings).toMatchObject([{ fixable: false }]);
    expect(result.findings[0]!.message).toBe(
      "`margin-left` is physical, which is wrong in one of the directions this renders in; use `margin-inline-start` if it was designed left-to-right or `margin-inline-end` if right-to-left.",
    );
  });

  it("mirrors shorthand suggestions too", () => {
    expect(asymmetricShorthand("margin", "0 8px 0 0", "rtl")).toContain("margin-inline: 8px 0");
    expect(asymmetricShorthand("border-radius", "4px 0 0 4px", "rtl")).toContain(
      "border-start-start-radius: 0; border-start-end-radius: 4px; border-end-end-radius: 4px; border-end-start-radius: 0",
    );
    expect(asymmetricShorthand("margin", "0 8px 0 0", "both")).toContain("if it was designed left-to-right");
  });

  it("passes the direction into @apply", () => {
    const result = checkCss(".btn { @apply pl-4; }", { fix: true, direction: "rtl", tailwind: { version: parseTailwindVersion("4.3") } });
    expect(result.output).toBe(".btn { @apply pe-4; }");
  });
});

describe("selector precision", () => {
  it("does not mistake an ordinary class for a direction selector", () => {
    expect(ids(".ltr-island { margin-left: 4px }")).toEqual(["css-logical"]);
    expect(ids(".rtl-only-thing { left: 0 }")).toEqual(["css-logical"]);
  });
});
