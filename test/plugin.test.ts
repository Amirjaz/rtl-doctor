import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import tsParser from "@typescript-eslint/parser";
import { ESLint, type Linter } from "eslint";
import { describe, expect, it } from "vitest";
import rtlDoctor, { checkCss, run } from "../src/index.js";
import { ar } from "./helpers.js";

const root = join(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

/** Lints TSX text the way a user's eslint.config.js would, with one of our configs. */
async function lint(config: Linter.Config, code: string) {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      { files: ["**/*.tsx"], languageOptions: { parser: tsParser as Linter.Parser, parserOptions: { ecmaFeatures: { jsx: true } } } },
      config,
      { settings: { rtlDoctor: { tailwindVersion: "4.3" } } },
    ],
  });
  const [result] = await eslint.lintText(code, { filePath: "page.tsx" });
  return result!.messages.map((m) => m.ruleId);
}

describe("the ESLint plugin", () => {
  it("names itself and matches package.json", () => {
    expect(rtlDoctor.meta).toEqual({ name: "rtl-doctor", version: pkg.version, namespace: "rtl-doctor" });
    expect(Object.keys(rtlDoctor.rules).sort()).toEqual(["intl-locale", "persian-chars", "tailwind-logical"]);
  });

  it("links every rule to a docs page that exists", () => {
    for (const [name, rule] of Object.entries(rtlDoctor.rules)) {
      expect(rule.meta?.docs?.url).toBe(`https://github.com/Amirjaz/rtl-doctor/blob/main/docs/rules/${name}.md`);
      expect(existsSync(join(root, "docs", "rules", `${name}.md`)), name).toBe(true);
    }
  });

  it("recommended runs the layout rule only", async () => {
    const code = `export const A = () => <p className="ml-2">${ar("پیک")} {n.toLocaleString()}</p>;`;
    expect(await lint(rtlDoctor.configs.recommended, code)).toEqual(["rtl-doctor/tailwind-logical"]);
  });

  it("persian adds the text and locale rules", async () => {
    const code = `export const A = () => <p className="ml-2">${ar("کتاب")} {n.toLocaleString()}</p>;`;
    expect(await lint(rtlDoctor.configs.persian, code)).toEqual([
      "rtl-doctor/tailwind-logical",
      "rtl-doctor/persian-chars",
      "rtl-doctor/intl-locale",
    ]);
  });

  it("persian fixes keep a right-to-left look, and user settings still merge in", async () => {
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      fix: true,
      overrideConfig: [
        { files: ["**/*.tsx"], languageOptions: { parser: tsParser as Linter.Parser, parserOptions: { ecmaFeatures: { jsx: true } } } },
        rtlDoctor.configs.persian,
        { settings: { rtlDoctor: { tailwindVersion: "4.3" } } },
      ],
    });
    const [result] = await eslint.lintText('export const A = () => <p className="pl-2 left-0" />;', { filePath: "a.tsx" });
    // inset-e-* needs both the persian direction and the user's Tailwind 4.3.
    expect(result!.output).toBe('export const A = () => <p className="pe-2 inset-e-0" />;');
  });

  it("recommended never guesses a direction: it names both fixes and applies neither", async () => {
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      fix: true,
      overrideConfig: [
        { files: ["**/*.tsx"], languageOptions: { parser: tsParser as Linter.Parser, parserOptions: { ecmaFeatures: { jsx: true } } } },
        rtlDoctor.configs.recommended,
      ],
    });
    const code = 'export const A = () => <p className="pl-2" />;';
    const [result] = await eslint.lintText(code, { filePath: "a.tsx" });
    expect(result!.output).toBeUndefined();
    expect(result!.messages[0]!.message).toContain("use `ps-2` if it was designed left-to-right or `pe-2` if right-to-left");
  });

  it("exports the programmatic API", () => {
    expect(typeof run).toBe("function");
    expect(checkCss(".a { margin-left: 1px }").findings).toHaveLength(1);
  });
});
