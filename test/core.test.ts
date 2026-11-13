import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkJson, isPersianMessageFile } from "../src/core/json.js";
import { describeArabicChars, findArabicChars, fixArabicChars, isPersianText } from "../src/core/persian.js";
import { analyzeClassList, logicalUtility, matchPhysical, parseClass, tokenize } from "../src/core/tailwind.js";
import { detectTailwindVersion, parseTailwindVersion } from "../src/core/tailwind-version.js";
import { ar } from "./helpers.js";

const v = (s: string) => parseTailwindVersion(s)!;

describe("parseClass", () => {
  it.each([
    ["ml-4", { variants: [], negative: false, important: "", utility: "ml-4" }],
    ["md:hover:-ml-4", { variants: ["md", "hover"], negative: true, important: "", utility: "ml-4" }],
    ["!pl-2", { variants: [], negative: false, important: "prefix", utility: "pl-2" }],
    ["pl-2!", { variants: [], negative: false, important: "suffix", utility: "pl-2" }],
    ["[&>*]:ml-[calc(1px+2px)]", { variants: ["[&>*]"], negative: false, important: "", utility: "ml-[calc(1px+2px)]" }],
    ["group-hover/item:mr-(--gap)", { variants: ["group-hover/item"], negative: false, important: "", utility: "mr-(--gap)" }],
  ])("parses %s", (cls, expected) => {
    expect(parseClass(cls)).toEqual(expected);
  });

  it("handles a v3 prefix and rejects classes without it", () => {
    expect(parseClass("-tw-ml-2", "tw-")).toMatchObject({ negative: true, utility: "ml-2" });
    expect(parseClass("ml-2", "tw-")).toBeNull();
  });

  it("rejects unbalanced brackets and empty utilities", () => {
    expect(parseClass("ml-[4px")).toBeNull();
    expect(parseClass("md:")).toBeNull();
  });
});

describe("matchPhysical", () => {
  it.each(["rounded-lg", "border-lime-500", "prose", "place-items-center", "pl", "ml-", "text-left-foo", "leftover", "constructor", "toString"])(
    "does not match %s",
    (utility) => expect(matchPhysical(utility)).toBeNull(),
  );
});

describe("logicalUtility", () => {
  it.each([
    ["ml-4", "3.2", null],
    ["ml-4", "3.3", "ms-4"],
    ["text-left", "3.0", "text-start"],
    ["float-left", "3.3", null],
    ["float-left", "3.4", "float-start"],
    ["left-4", "4.1", "start-4"],
    ["left-4", "4.2", "inset-s-4"],
    ["right-1/2", "4.3", "inset-e-1/2"],
    ["rounded-tl", "4.3", "rounded-ss"],
    ["border-r-[3px]", "4.3", "border-e-[3px]"],
  ])("%s in Tailwind %s is %s", (utility, version, expected) => {
    expect(logicalUtility(utility, v(version))).toBe(expected);
  });

  it("uses start-* when the version is unknown, since it works from 3.3 to 4.x", () => {
    expect(logicalUtility("left-0")).toBe("start-0");
  });
});

describe("tokenize and analyzeClassList", () => {
  it("drops tokens cut by interpolation", () => {
    const tokens = tokenize([{ text: "ml-2 p-4 x", offset: 10, partialStart: true, partialEnd: true }]);
    expect(tokens.map((t) => t.value)).toEqual(["p-4"]);
    expect(tokens[0]).toMatchObject({ start: 15, end: 18 });
  });

  it("does not report anything when the version is unknown for space-x", () => {
    expect(analyzeClassList([{ text: "flex space-x-4 rtl:space-x-reverse", offset: 0 }])).toEqual([]);
  });

  it("only treats pairs in the same string as symmetric", () => {
    const findings = analyzeClassList([
      { text: "ml-2", offset: 0 },
      { text: "mr-2", offset: 10 },
    ]);
    expect(findings).toHaveLength(2);
  });
});

describe("tailwind version detection", () => {
  it.each([
    ["4.3.3", { major: 4, minor: 3 }],
    ["^4.1.0", { major: 4, minor: 1 }],
    ["~3.4", { major: 3, minor: 4 }],
    ["4", { major: 4, minor: 0 }],
    ["latest", undefined],
  ])("parses %s", (input, expected) => {
    expect(parseTailwindVersion(input)).toEqual(expected);
  });

  it("finds the installed package (this repo has Tailwind 4.3 as a dev dependency)", () => {
    expect(detectTailwindVersion(process.cwd())).toEqual({ major: 4, minor: 3 });
  });

  it("falls back to the range in package.json, then to undefined", () => {
    const dir = mkdtempSync(join(tmpdir(), "rtl-doctor-tw-"));
    mkdirSync(join(dir, "app"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ devDependencies: { tailwindcss: "^3.4.1" } }));
    expect(detectTailwindVersion(join(dir, "app"))).toEqual({ major: 3, minor: 4 });
    const empty = mkdtempSync(join(tmpdir(), "rtl-doctor-none-"));
    expect(detectTailwindVersion(empty)).toBeUndefined();
  });
});

describe("persian text", () => {
  it("recognises Persian by its own letters and digits", () => {
    expect(isPersianText("پیام")).toBe(true);
    expect(isPersianText("۱۲")).toBe(true);
    expect(isPersianText(ar("علی"))).toBe(false);
    expect(isPersianText(ar("علی"), true)).toBe(true);
    expect(isPersianText("مدرسة", true)).toBe(false);
    expect(isPersianText("hello", true)).toBe(false);
  });

  it("fixes letters and digits and keeps emoji intact", () => {
    const broken = `${ar("پیک")} \u0664\u0665 \u{1F600} \u0649`;
    expect(fixArabicChars(broken)).toBe("پیک ۴۵ \u{1F600} ی");
    expect(fixArabicChars(broken, { digits: false })).toBe("پیک \u0664\u0665 \u{1F600} ی");
    expect(fixArabicChars("plain")).toBe("plain");
  });

  it("describes what it found", () => {
    expect(describeArabicChars(findArabicChars(ar("پیک")))).toBe("Arabic yeh \u064A (U+064A) instead of Persian \u06CC (U+06CC) and Arabic kaf \u0643 (U+0643) instead of Persian \u06A9 (U+06A9)");
    expect(describeArabicChars(findArabicChars("پ \u0664"))).toBe("Arabic-Indic digits (U+0660-U+0669) instead of Persian digits (U+06F0-U+06F9)");
  });
});

describe("Persian message files", () => {
  it.each([
    ["messages/fa.json", true],
    ["locales/fa-IR.json", true],
    ["src/i18n/fa_IR.json", true],
    ["public/locales/fa/common.json", true],
    ["messages/en.json", false],
    ["faq.json", false],
    ["package.json", false],
    ["messages/fa.ts", false],
  ])("%s is a Persian message file: %s", (path, expected) => {
    expect(isPersianMessageFile(path)).toBe(expected);
  });

  it("fixes values, leaves keys and formatting alone", () => {
    const source = `{\n  "nav": {\n    "${ar("کلید")}": "${ar("کتاب")}",\n    "home": "خانه",\n    "quote": "a \\" ${ar("یک")}"\n  }\n}\n`;
    const result = checkJson(source, { fix: true });
    expect(result.fixed).toBe(2);
    expect(result.output).toBe(`{\n  "nav": {\n    "${ar("کلید")}": "کتاب",\n    "home": "خانه",\n    "quote": "a \\" یک"\n  }\n}\n`);
    expect(checkJson(source).findings).toMatchObject([
      { ruleId: "persian-chars", line: 3, column: 14 },
      { ruleId: "persian-chars", line: 5 },
    ]);
  });

  it("returns the input untouched when nothing is wrong", () => {
    const source = '{ "a": "خانه" }';
    expect(checkJson(source, { fix: true })).toEqual({ findings: [], output: source, fixed: 0 });
  });
});
