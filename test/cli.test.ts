import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { formatJson, formatPretty } from "../src/cli/report.js";
import { run, type RunResult } from "../src/cli/run.js";

process.env.NO_COLOR = "1";

const FIXTURE = join(import.meta.dirname, "fixtures", "next-app");
const FILES = ["app/page.tsx", "components/Card.tsx", "app/globals.css", "messages/fa.json", "lib/format.ts", "app/layout.tsx"];

/** A fresh copy of the fixture app (outside this repo, so no node_modules above it). */
function copyFixture(extra: Record<string, string> = {}): string {
  const dir = join(mkdtempSync(join(tmpdir(), "rtl-doctor-")), "app");
  cpSync(FIXTURE, dir, { recursive: true });
  // Ignored by the fixture's .gitignore, so it must never be reported or fixed.
  mkdirSync(join(dir, "generated"));
  writeFileSync(join(dir, "generated", "Ignored.tsx"), 'export const Ignored = () => <div className="ml-4" />;\n');
  for (const [file, content] of Object.entries(extra)) writeFileSync(join(dir, file), content);
  return dir;
}

const count = (result: RunResult) =>
  result.findings.reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.ruleId]: (acc[f.ruleId] ?? 0) + 1 }), {});

describe("rtl-doctor on a Persian Next.js + Tailwind 4 app", () => {
  let dir: string;
  let report: RunResult;

  beforeAll(async () => {
    dir = copyFixture();
    report = await run({ cwd: dir });
  });

  it("detects the project", () => {
    expect(report.persian).toBe(true);
    expect(report.project.persianReason).toBe('app/layout.tsx sets lang="fa"');
    expect(report.direction).toBe("rtl");
    expect(report.project.directionReason).toBe('app/layout.tsx sets dir="rtl"');
    expect(report.project.tailwind).toEqual({ major: 4, minor: 3 });
    expect(report.locale).toBe("fa-IR");
    expect(report.layout).toBe(true);
    expect(report.filesChecked).toBe(7);
  });

  it("reports every bug and nothing direction-neutral", () => {
    expect(count(report)).toEqual({
      "tailwind-logical": 12,
      "persian-chars": 7,
      "intl-locale": 4,
      "css-logical": 4,
      "css-shorthand": 1,
    });
    const page = report.findings.filter((f) => f.file === "app/page.tsx").map((f) => `${f.line}:${f.column} ${f.ruleId}`);
    // Line 5 has the symmetric pl-6 pr-6, line 11 the centring idiom, line 12 ltr:/rtl: variants.
    expect(page.some((f) => f.startsWith("5:") || f.startsWith("12:"))).toBe(false);
    expect(page.filter((f) => f.startsWith("11:"))).toEqual(["11:67 persian-chars"]);
    expect(report.findings.some((f) => f.file.startsWith("generated/"))).toBe(false);
  });

  it("prints a stable report", async () => {
    await expect(formatPretty(report, { version: "test" })).toMatchFileSnapshot("__snapshots__/next-app.report.txt");
    const json = JSON.parse(formatJson(report, "test"));
    expect(json.project).toMatchObject({ persian: true, tailwind: "4.3", locale: "fa-IR", layout: true });
    expect(json.findings).toHaveLength(report.findings.length);
  });

  it("does not touch files without --fix", () => {
    for (const file of FILES) expect(readFileSync(join(dir, file), "utf8")).toBe(readFileSync(join(FIXTURE, file), "utf8"));
  });
});

describe("rtl-doctor --fix", () => {
  let dir: string;
  let fixed: RunResult;

  beforeAll(async () => {
    dir = copyFixture();
    fixed = await run({ cwd: dir, fix: true });
  });

  it("fixes the safe problems and leaves the judgement calls", () => {
    expect(fixed.fixedProblems).toBe(23);
    expect(fixed.fixedFiles).toEqual(["app/globals.css", "app/page.tsx", "components/Card.tsx", "messages/fa.json"]);
    expect(count(fixed)).toEqual({ "intl-locale": 4, "css-shorthand": 1 });
    expect(fixed.findings.filter((f) => f.ruleId === "intl-locale").every((f) => f.suggestion && !f.fixable)).toBe(true);
  });

  it.each(["app/page.tsx", "components/Card.tsx", "app/globals.css", "messages/fa.json"])("writes the expected %s", async (file) => {
    await expect(readFileSync(join(dir, file), "utf8")).toMatchFileSnapshot(`__snapshots__/next-app.fixed/${file}`);
  });

  it("leaves untouched files and ignored files alone", () => {
    for (const file of ["lib/format.ts", "app/layout.tsx", "lib/cn.ts"]) {
      expect(readFileSync(join(dir, file), "utf8")).toBe(readFileSync(join(FIXTURE, file), "utf8"));
    }
    expect(readFileSync(join(dir, "generated", "Ignored.tsx"), "utf8")).toContain("ml-4");
  });

  it("is idempotent", async () => {
    const again = await run({ cwd: dir, fix: true });
    expect(again.fixedProblems).toBe(0);
    expect(again.fixedFiles).toEqual([]);
    expect(again.findings).toHaveLength(fixed.findings.length);
  });

  it("prints what it fixed", () => {
    const text = formatPretty(fixed, { version: "test", fix: true });
    expect(text).toContain("Fixed 23 problems in 4 files.");
    expect(text).toContain("5 problems (0 errors, 5 warnings)");
  });
});

describe("options and detection", () => {
  it("--no-persian keeps only the layout rules", async () => {
    const result = await run({ cwd: copyFixture(), persian: false });
    expect(result.persian).toBe(false);
    expect(Object.keys(count(result)).sort()).toEqual(["css-logical", "css-shorthand", "tailwind-logical"]);
  });

  it("--locale ar-SA checks locales but not Persian letters", async () => {
    const result = await run({ cwd: copyFixture(), locale: "ar-SA" });
    expect(result.persian).toBe(false);
    expect(count(result)["persian-chars"]).toBeUndefined();
    expect(result.findings.find((f) => f.ruleId === "intl-locale")?.message).toContain("'ar-SA'");
  });

  it("--tailwind 3.4 switches the space-x advice", async () => {
    const result = await run({ cwd: copyFixture(), tailwind: "3.4", paths: ["components/Card.tsx", "app/page.tsx"] });
    const messages = result.findings.filter((f) => f.ruleId === "tailwind-logical").map((f) => f.message);
    expect(messages.some((m) => m.includes("add `rtl:divide-x-reverse`"))).toBe(true);
    expect(messages.some((m) => m.includes("undoes the RTL flip"))).toBe(false);
  });

  it("turns layout checks off for projects that flip CSS with rtlcss", async () => {
    const pkg = JSON.parse(readFileSync(join(FIXTURE, "package.json"), "utf8"));
    pkg.devDependencies["postcss-rtlcss"] = "^5.0.0";
    const dir = copyFixture({ "package.json": JSON.stringify(pkg) });
    const off = await run({ cwd: dir });
    expect(off.layout).toBe(false);
    expect(off.project.rtlcss).toBe("postcss-rtlcss");
    expect(Object.keys(count(off)).sort()).toEqual(["intl-locale", "persian-chars"]);
    expect(formatPretty(off, { version: "test" })).toContain("Layout checks are off: postcss-rtlcss flips physical CSS");
    const on = await run({ cwd: dir, layout: true });
    expect(count(on)["tailwind-logical"]).toBe(12);
  });

  it("skips files it cannot parse instead of failing", async () => {
    const dir = copyFixture({ "components/Broken.tsx": "export const X = () => <div className=\"ml-2\">;\n", "app/broken.css": ".a { margin-left: 1px" });
    const result = await run({ cwd: dir });
    expect(result.skipped.map((s) => s.file).sort()).toEqual(["app/broken.css", "components/Broken.tsx"]);
    expect(result.findings.some((f) => f.file === "components/Broken.tsx")).toBe(false);
  });

  it("detects Persian from i18n config and message files", async () => {
    const layout = 'export default function L({ children }) { return <html lang={locale}>{children}</html>; }\n';
    const dir = copyFixture({ "app/layout.tsx": layout });
    expect((await run({ cwd: dir, paths: ["lib"] })).project.persianReason).toBe("messages/fa.json exists");
    writeFileSync(join(dir, "next.config.mjs"), 'export default { i18n: { locales: ["en", "fa"], defaultLocale: "en" } };\n');
    expect((await run({ cwd: dir, paths: ["lib"] })).project.persianReason).toBe("next.config.mjs lists the fa locale");
  });

  it("does not treat an app without Persian signals as Persian", async () => {
    const dir = copyFixture({ "app/layout.tsx": 'export default function L({ children }) { return <html lang="ar">{children}</html>; }\n' });
    const { rmSync } = await import("node:fs");
    rmSync(join(dir, "messages"), { recursive: true });
    const result = await run({ cwd: dir });
    expect(result.persian).toBe(false);
    expect(formatPretty(result, { version: "test" })).toContain("not detected as Persian");
  });

  it("checks just the paths it is given and rejects missing ones", async () => {
    const dir = copyFixture();
    const result = await run({ cwd: dir, paths: ["app/globals.css"] });
    expect(new Set(result.findings.map((f) => f.file))).toEqual(new Set(["app/globals.css"]));
    await expect(run({ cwd: dir, paths: ["nope"] })).rejects.toThrow("No such file or folder");
  });
});
