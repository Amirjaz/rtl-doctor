import { describeArabicChars, findArabicChars, fixArabicChars, type PersianOptions } from "./persian.js";

export interface JsonFinding {
  ruleId: "persian-chars";
  message: string;
  line: number;
  column: number;
  fixable: true;
}

export interface JsonResult {
  findings: JsonFinding[];
  output: string;
  fixed: number;
}

/** `fa.json`, `fa-IR.json`, `fa_IR.json`, or any `.json` inside a `fa` / `fa-IR` folder. */
export function isPersianMessageFile(path: string): boolean {
  const parts = path.split(/[\\/]/);
  const name = parts.at(-1) ?? "";
  if (!name.endsWith(".json")) return false;
  const isFa = (s: string) => /^fa([-_][a-z]{2})?$/i.test(s);
  return isFa(name.slice(0, -5)) || parts.slice(0, -1).some(isFa);
}

/**
 * Finds Arabic yeh, kaf and digits in the string values of a Persian message file and
 * fixes them in place, without reformatting the file. Keys are left alone.
 */
export function checkJson(source: string, options: { fix?: boolean } & Pick<PersianOptions, "digits"> = {}): JsonResult {
  const persian: PersianOptions = { assumePersian: true, digits: options.digits };
  const findings: JsonFinding[] = [];
  let output = "";
  let fixed = 0;
  let last = 0;

  for (let i = 0; i < source.length; i++) {
    if (source[i] !== '"') continue;
    let end = i + 1;
    while (end < source.length && source[end] !== '"') end += source[end] === "\\" ? 2 : 1;
    const raw = source.slice(i + 1, end);
    let after = end + 1;
    while (/\s/.test(source[after] ?? "")) after++;
    const isKey = source[after] === ":";
    const found = isKey ? [] : findArabicChars(raw, persian);
    if (found.length > 0) {
      const { line, column } = position(source, i + 1 + found[0]!.index);
      findings.push({
        ruleId: "persian-chars",
        message: `Persian text uses ${describeArabicChars(found)}; search and sorting treat them as different letters.`,
        line,
        column,
        fixable: true,
      });
      if (options.fix) {
        output += source.slice(last, i + 1) + fixArabicChars(raw, persian);
        last = end;
        fixed++;
      }
    }
    i = end;
  }

  return { findings, output: fixed > 0 ? output + source.slice(last) : source, fixed };
}

function position(source: string, index: number): { line: number; column: number } {
  const before = source.slice(0, index);
  const line = before.split("\n").length;
  return { line, column: index - before.lastIndexOf("\n") };
}
