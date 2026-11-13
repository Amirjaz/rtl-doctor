import { formatTailwindVersion } from "../core/tailwind-version.js";
import type { RunResult } from "./run.js";

/** Colour on a terminal; NO_COLOR turns it off, FORCE_COLOR (CI logs) turns it on. */
const useColor = () => {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR !== undefined) return process.env.FORCE_COLOR !== "0";
  return process.stdout.isTTY === true;
};
const paint = (code: number) => (text: string) => (useColor() ? `\u001b[${code}m${text}\u001b[0m` : text);
const bold = paint(1);
const dim = paint(2);
const red = paint(31);
const yellow = paint(33);
const green = paint(32);
const underline = paint(4);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The human-readable report, in the same shape as ESLint's stylish formatter. */
export function formatPretty(result: RunResult, options: { fix?: boolean; version: string }): string {
  const lines: string[] = [];
  const { project } = result;
  const direction =
    result.direction === "both"
      ? `direction set at runtime (${project.directionReason ?? "--direction both"}), so layout fixes need a human`
      : `${result.direction === "rtl" ? "right-to-left" : "left-to-right"} (${project.directionReason ?? `--direction ${result.direction}`})`;
  const facts = [
    result.persian ? `Persian (${project.persianReason ?? `--locale ${result.locale}`})` : "not detected as Persian (pass --locale fa-IR to force)",
    direction,
    `Tailwind ${formatTailwindVersion(project.tailwind)}`,
    plural(result.filesChecked, "file"),
  ];
  lines.push(`${bold(`rtl-doctor ${options.version}`)}  ${dim(facts.join(", "))}`);
  if (!result.layout) {
    lines.push(
      yellow(`Layout checks are off: ${project.rtlcss} flips physical CSS at build time, so left/right is intentional here. Pass --layout to run them anyway.`),
    );
  }
  lines.push("");

  let current = "";
  for (const f of result.findings) {
    if (f.file !== current) {
      if (current) lines.push("");
      lines.push(underline(f.file));
      current = f.file;
    }
    const level = f.severity === "error" ? red("error  ") : yellow("warning");
    const tag = f.fixable ? green(" [fix]") : f.suggestion ? dim(" [suggestion]") : "";
    lines.push(`  ${dim(`${f.line}:${f.column}`.padEnd(8))} ${level}  ${f.message}  ${dim(f.ruleId)}${tag}`);
  }
  if (result.findings.length > 0) lines.push("");

  for (const s of result.skipped) lines.push(yellow(`Skipped ${s.file}: ${s.message}`));
  if (result.skipped.length > 0) lines.push("");

  if (options.fix && result.fixedProblems > 0) {
    lines.push(green(`Fixed ${plural(result.fixedProblems, "problem")} in ${plural(result.fixedFiles.length, "file")}.`));
  }
  const errors = result.findings.filter((f) => f.severity === "error").length;
  const warnings = result.findings.length - errors;
  const fixable = result.findings.filter((f) => f.fixable).length;
  if (result.findings.length === 0) {
    lines.push(green(options.fix && result.fixedProblems > 0 ? "Nothing left to fix." : "No RTL problems found."));
  } else {
    const parts = [plural(result.findings.length, "problem"), `${plural(errors, "error")}, ${plural(warnings, "warning")}`];
    lines.push(bold((errors > 0 ? red : yellow)(`${parts[0]} (${parts[1]})`)));
    if (fixable > 0) lines.push(`${fixable} can be fixed with ${bold("rtl-doctor --fix")}.`);
    const manual = result.findings.length - fixable;
    if (manual > 0) lines.push(`${manual} need a human decision (suggestions show up in your editor with the ESLint plugin).`);
  }
  return lines.join("\n");
}

export function formatJson(result: RunResult, version: string): string {
  const { project } = result;
  return JSON.stringify(
    {
      version,
      project: {
        root: project.root,
        persian: result.persian,
        persianReason: project.persianReason ?? null,
        locale: result.locale ?? null,
        tailwind: project.tailwind ? formatTailwindVersion(project.tailwind) : null,
        rtlcss: project.rtlcss ?? null,
        layout: result.layout,
        direction: result.direction,
        directionReason: project.directionReason ?? null,
      },
      filesChecked: result.filesChecked,
      fixedProblems: result.fixedProblems,
      fixedFiles: result.fixedFiles,
      skipped: result.skipped,
      findings: result.findings,
    },
    null,
    2,
  );
}
