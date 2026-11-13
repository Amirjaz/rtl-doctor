import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { globSync } from "tinyglobby";
import type { Direction } from "./tailwind.js";
import { detectTailwindVersion, type TailwindVersion } from "./tailwind-version.js";

export interface ProjectInfo {
  /** The folder holding the nearest package.json (or the start folder when there is none). */
  root: string;
  persian: boolean;
  /** Why the project counts as Persian, for the CLI header: `app/layout.tsx sets lang="fa"`. */
  persianReason?: string;
  tailwind?: TailwindVersion;
  /** A dependency that flips physical CSS at build time, which makes physical CSS intentional. */
  rtlcss?: string;
  /**
   * The direction the app renders in today, from the HTML root's `dir`: "rtl" for a
   * right-to-left app, "both" when `dir` is set from a variable, "ltr" otherwise.
   * Fixes keep today's look, so this decides which logical side they use.
   */
  direction: Direction;
  /** Why, for the CLI header: `app/layout.tsx sets dir="rtl"`. */
  directionReason?: string;
}

/** Packages that generate the RTL stylesheet by flipping physical properties. */
const RTLCSS_PACKAGES = ["rtlcss", "postcss-rtlcss", "postcss-rtl", "rtlcss-webpack-plugin"];

const IGNORE = ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/dist/**", "**/build/**", "**/out/**", "**/coverage/**"];

export function findProjectRoot(start: string): string {
  for (let dir = start; ; dir = dirname(dir)) {
    if (existsSync(join(dir, "package.json"))) return dir;
    if (dirname(dir) === dir) return start;
  }
}

const LANG_FA = /\blang\s*[=:]\s*\{?\s*["'`]fa(?:[-_][A-Za-z]{2})?["'`]/;
const LOCALES_FA = /\b(?:locales|defaultLocale)\s*:\s*(?:\[[^\]]*)?["'`]fa(?:[-_][A-Za-z]{2})?["'`]/;
/** A `dir` on the HTML root: a literal value in group 1, or a dynamic one (no group 1). */
const DIR_ATTRIBUTE = /\bdir\s*=\s*(?:["'](ltr|rtl|auto)["']|\{\s*["'`](?:(ltr|rtl|auto))?["'`]?\s*\}|\{)/i;

/** Files that hold the HTML root element. */
const ROOT_FILES = ["{src/,}app/**/layout.{js,jsx,ts,tsx}", "{src/,}pages/_document.{js,jsx,ts,tsx}", "{public/,}index.html"];

/** Looks at the HTML root, i18n config and message files to tell what kind of app this is. */
export function detectProject(start: string): ProjectInfo {
  const root = findProjectRoot(start);
  const info: ProjectInfo = { root, persian: false, direction: "ltr", tailwind: detectTailwindVersion(root) };

  const pkg = readJson(join(root, "package.json"));
  const deps: Record<string, unknown> = {
    ...(pkg?.dependencies as Record<string, unknown> | undefined),
    ...(pkg?.devDependencies as Record<string, unknown> | undefined),
  };
  info.rtlcss = RTLCSS_PACKAGES.find((name) => name in deps);

  const read = (patterns: string[]) => globSync(patterns, { cwd: root, ignore: IGNORE, absolute: true }).sort();
  const show = (file: string) => relative(root, file).split("\\").join("/");
  const rootFiles = read(ROOT_FILES).map((file) => [file, readFileSync(file, "utf8")] as const);

  for (const [file, source] of rootFiles) {
    const match = DIR_ATTRIBUTE.exec(source);
    if (!match) continue;
    const value = (match[1] ?? match[2])?.toLowerCase();
    // `dir={locale === "fa" ? "rtl" : "ltr"}` and `dir="auto"` both mean "it depends".
    info.direction = value === "rtl" || value === "ltr" ? value : "both";
    info.directionReason = value ? `${show(file)} sets dir="${value}"` : `${show(file)} sets dir from a variable`;
    break;
  }

  const persian = (reason: string): ProjectInfo => ({ ...info, persian: true, persianReason: reason });
  for (const [file, source] of rootFiles) {
    const match = LANG_FA.exec(source);
    if (match) return persian(`${show(file)} sets ${match[0].replace(/\s+/g, "")}`);
  }
  for (const file of read(["{src/,}i18n/**/*.{js,ts}", "{src/,}{i18n,routing,middleware,proxy}.{js,ts}", "next.config.{js,mjs,cjs,ts}", "{src/,}i18n/routing.{js,ts}"])) {
    if (LOCALES_FA.test(readFileSync(file, "utf8"))) return persian(`${show(file)} lists the fa locale`);
  }
  const messages = read(["**/{fa,fa-IR,fa_IR}.json", "**/{fa,fa-IR,fa_IR}/*.json"]);
  if (messages[0]) return persian(`${show(messages[0])} exists`);

  return info;
}

function readJson(file: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}
