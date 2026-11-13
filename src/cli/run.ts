import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import tsParser from "@typescript-eslint/parser";
import { ESLint, type Linter } from "eslint";
import ignore from "ignore";
import { globSync } from "tinyglobby";
import { checkCss } from "../core/css.js";
import { detectProject, type ProjectInfo } from "../core/detect.js";
import { checkJson, isPersianMessageFile } from "../core/json.js";
import type { Direction } from "../core/tailwind.js";
import { formatTailwindVersion, parseTailwindVersion } from "../core/tailwind-version.js";
import { plugin } from "../plugin.js";

export interface RunOptions {
  cwd?: string;
  /** Files or folders; defaults to the current folder. */
  paths?: string[];
  fix?: boolean;
  /** Forces the locale rules on with this locale; a `fa` locale also turns on the Persian text rules. */
  locale?: string;
  /** false turns the Persian rules off even when the project looks Persian. */
  persian?: boolean;
  /** Overrides the detected Tailwind version. */
  tailwind?: string;
  /** Runs layout checks even when the project flips CSS with rtlcss. */
  layout?: boolean;
  /** The direction the app renders in today; overrides detection. */
  direction?: Direction;
}

export interface Finding {
  /** Path relative to the project root, with forward slashes. */
  file: string;
  line: number;
  column: number;
  ruleId: string;
  message: string;
  severity: "error" | "warning";
  /** `--fix` can fix it. */
  fixable: boolean;
  /** An editor suggestion exists (not applied by `--fix`). */
  suggestion: boolean;
}

export interface RunResult {
  project: ProjectInfo;
  /** The settings actually used, after flags and detection. */
  persian: boolean;
  locale?: string;
  layout: boolean;
  /** The direction fixes were calculated for. */
  direction: Direction;
  filesChecked: number;
  /** Problems left after fixing (all problems without `--fix`). */
  findings: Finding[];
  fixedProblems: number;
  fixedFiles: string[];
  /** Files that could not be parsed; they are skipped, not counted as problems. */
  skipped: { file: string; message: string }[];
}

const SCRIPT = ["js", "jsx", "ts", "tsx", "mjs", "cjs", "mts", "cts"];
const STYLE = ["css", "scss"];
const DEFAULT_IGNORES = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.next/**",
  "**/.turbo/**",
  "**/.vercel/**",
  "**/dist/**",
  "**/build/**",
  "**/out/**",
  "**/coverage/**",
  "**/*.min.{js,css}",
  "**/*.d.ts",
];

const SEVERITY: Record<string, Finding["severity"]> = {
  "tailwind-logical": "error",
  "persian-chars": "error",
  "intl-locale": "warning",
  "css-logical": "error",
  "css-shorthand": "warning",
};

export async function run(options: RunOptions = {}): Promise<RunResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const targets = (options.paths?.length ? options.paths : ["."]).map((p) => (isAbsolute(p) ? p : resolve(cwd, p)));
  for (const target of targets) {
    if (!existsSync(target)) throw new Error(`No such file or folder: ${target}`);
  }
  const first = targets[0]!;
  const project = detectProject(statSync(first).isDirectory() ? first : resolve(first, ".."));
  const root = project.root;

  const tailwind = parseTailwindVersion(options.tailwind) ?? project.tailwind;
  const localeIsPersian = options.locale ? /^fa\b/i.test(options.locale) : undefined;
  const persian = options.persian !== false && (localeIsPersian ?? project.persian);
  const locale = options.locale ?? (persian ? "fa-IR" : undefined);
  const layout = options.layout === true || !project.rtlcss;
  const direction = options.direction ?? project.direction;

  const files = listFiles(targets, root);
  const scripts = files.filter((f) => SCRIPT.includes(ext(f)));
  const styles = layout ? files.filter((f) => STYLE.includes(ext(f))) : [];
  const messages = persian ? files.filter((f) => ext(f) === "json" && isPersianMessageFile(relative(root, f))) : [];

  const result: RunResult = {
    project: { ...project, tailwind },
    persian,
    locale,
    layout,
    direction,
    filesChecked: scripts.length + styles.length + messages.length,
    findings: [],
    fixedProblems: 0,
    fixedFiles: [],
    skipped: [],
  };
  const show = (file: string) => relative(root, file).split("\\").join("/");

  // Scripts: ESLint with only rtl-doctor rules, ignoring the project's own ESLint config.
  const rules: Linter.RulesRecord = {};
  if (layout) rules["rtl-doctor/tailwind-logical"] = "error";
  if (persian) rules["rtl-doctor/persian-chars"] = ["error", { assumePersian: true }];
  if (locale) rules["rtl-doctor/intl-locale"] = ["warn", { locale }];

  if (scripts.length > 0 && Object.keys(rules).length > 0) {
    const config: Linter.Config[] = [
      {
        files: [`**/*.{${SCRIPT.join(",")}}`],
        plugins: { "rtl-doctor": plugin },
        languageOptions: {
          parser: tsParser as Linter.Parser,
          parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: "latest", sourceType: "module" },
        },
        // Only rtl-doctor rules run, so disable comments for other rules would all look unused.
        linterOptions: { reportUnusedDisableDirectives: "off" },
        settings: { rtlDoctor: { tailwindVersion: tailwind ? formatTailwindVersion(tailwind) : undefined, direction } },
        rules,
      },
    ];
    const make = (fix: boolean) =>
      new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: config, fix, ignore: false, errorOnUnmatchedPattern: false });

    let before = 0;
    if (options.fix) {
      before = countProblems(await make(false).lintFiles(scripts));
    }
    const results = await make(options.fix === true).lintFiles(scripts);
    if (options.fix) {
      await ESLint.outputFixes(results);
      for (const r of results) if (r.output !== undefined) result.fixedFiles.push(show(r.filePath));
    }
    for (const r of results) {
      for (const m of r.messages) {
        if (m.fatal || !m.ruleId) {
          result.skipped.push({ file: show(r.filePath), message: m.message });
          continue;
        }
        const ruleId = m.ruleId.replace(/^rtl-doctor\//, "");
        result.findings.push({
          file: show(r.filePath),
          line: m.line,
          column: m.column,
          ruleId,
          message: m.message,
          severity: SEVERITY[ruleId] ?? "error",
          fixable: m.fix !== undefined,
          suggestion: (m.suggestions?.length ?? 0) > 0,
        });
      }
    }
    if (options.fix) result.fixedProblems += before - countProblems(results);
  }

  // Stylesheets: PostCSS.
  for (const file of styles) {
    const source = readFileSync(file, "utf8");
    let checked;
    try {
      checked = checkCss(source, { filename: file, fix: options.fix, direction, tailwind: { version: tailwind } });
    } catch (error) {
      result.skipped.push({ file: show(file), message: (error as Error).message });
      continue;
    }
    if (options.fix && checked.fixed > 0) {
      writeFileSync(file, checked.output);
      result.fixedFiles.push(show(file));
      result.fixedProblems += checked.fixed;
    }
    // After fixing, report what is left by checking the new text again.
    const remaining =
      options.fix && checked.fixed > 0 ? checkCss(checked.output, { filename: file, direction, tailwind: { version: tailwind } }) : checked;
    for (const f of remaining.findings) {
      result.findings.push({ file: show(file), ...f, severity: SEVERITY[f.ruleId] ?? "error", suggestion: false });
    }
  }

  // Persian message files.
  for (const file of messages) {
    const source = readFileSync(file, "utf8");
    const checked = checkJson(source, { fix: options.fix });
    if (options.fix && checked.fixed > 0) {
      writeFileSync(file, checked.output);
      result.fixedFiles.push(show(file));
      result.fixedProblems += checked.fixed;
      continue;
    }
    for (const f of checked.findings) {
      result.findings.push({ file: show(file), ...f, severity: "error", suggestion: false });
    }
  }

  result.findings.sort((a, b) => a.file.localeCompare(b.file, "en") || a.line - b.line || a.column - b.column);
  result.fixedFiles.sort();
  return result;
}

const ext = (file: string) => extname(file).slice(1).toLowerCase();

const countProblems = (results: ESLint.LintResult[]) =>
  results.reduce((sum, r) => sum + r.messages.filter((m) => !m.fatal && m.ruleId).length, 0);

/** Files under the targets, minus build output, dependencies and anything in the root .gitignore. */
function listFiles(targets: string[], root: string): string[] {
  const gitignore = ignore();
  const ignoreFile = join(root, ".gitignore");
  if (existsSync(ignoreFile)) gitignore.add(readFileSync(ignoreFile, "utf8"));
  const exts = [...SCRIPT, ...STYLE, "json"].join(",");
  const files = new Set<string>();
  for (const target of targets) {
    if (statSync(target).isFile()) {
      files.add(target);
      continue;
    }
    for (const file of globSync([`**/*.{${exts}}`], { cwd: target, absolute: true, ignore: DEFAULT_IGNORES, dot: false })) {
      const rel = relative(root, file).split("\\").join("/");
      if (!rel.startsWith("..") && rel && gitignore.ignores(rel)) continue;
      files.add(resolve(file));
    }
  }
  return [...files].sort();
}
