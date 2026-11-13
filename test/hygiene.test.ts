import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import rtlDoctor from "../src/index.js";

const root = join(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", "dist", "coverage", ".git", "fixtures", "__snapshots__"]);

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return /\.(ts|js|mjs|md|json|yml)$/.test(entry.name) && entry.name !== "pnpm-lock.yaml" ? [path] : [];
  });
}

const all = files(root);
const readme = readFileSync(join(root, "README.md"), "utf8");

describe("repository hygiene", () => {
  it("uses no em or en dashes anywhere", () => {
    const offenders = all.filter((file) => /[\u2013\u2014]/.test(readFileSync(file, "utf8"))).map((f) => relative(root, f));
    expect(offenders).toEqual([]);
  });

  it("writes Arabic look-alikes and invisible characters in sources as escapes", () => {
    const pattern = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\u064A\u0643\u0649\u0660-\u0669]/;
    const offenders = all.filter((f) => f.endsWith(".ts") && pattern.test(readFileSync(f, "utf8"))).map((f) => relative(root, f));
    expect(offenders).toEqual([]);
  });

  it("documents every ESLint rule and CLI check in the README", () => {
    for (const id of [...Object.keys(rtlDoctor.rules), "css-logical", "css-shorthand"]) expect(readme, id).toContain(`\`${id}\``);
  });

  it("keeps the CHANGELOG in step with package.json", () => {
    const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(readFileSync(join(root, "CHANGELOG.md"), "utf8")).toContain(`## ${version}`);
  });
});
