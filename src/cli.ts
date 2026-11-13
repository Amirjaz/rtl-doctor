#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { formatJson, formatPretty } from "./cli/report.js";
import { run } from "./cli/run.js";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

const HELP = `rtl-doctor ${version}
Find and fix right-to-left bugs in React, Tailwind and CSS code.

Usage
  npx rtl-doctor [paths...] [options]

Options
  --fix               Apply the safe fixes (layout classes, CSS properties, Arabic letters)
  --format <name>     pretty (default) or json
  --locale <tag>      Locale for toLocaleString/Intl checks; a fa locale also turns on
                      the Persian text rules (default: detected)
  --no-persian        Turn the Persian text rules off even if the app looks Persian
  --tailwind <ver>    Tailwind version to target, for example 3.4 or 4.2 (default: detected)
  --direction <dir>   The direction the app renders in today: ltr, rtl or both
                      (default: detected from the HTML root's dir). Fixes keep today's
                      look, so in an RTL app pl-4 becomes pe-4, not ps-4
  --layout            Run layout checks even when the project uses rtlcss
  -h, --help          Show this help
  -v, --version       Show the version

Exit code 0 when no errors remain, 1 when errors remain, 2 on a usage or runtime error.
Docs: https://github.com/Amirjaz/rtl-doctor#readme`;

async function main(): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        fix: { type: "boolean" },
        format: { type: "string" },
        locale: { type: "string" },
        "no-persian": { type: "boolean" },
        tailwind: { type: "string" },
        direction: { type: "string" },
        layout: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch (error) {
    console.error(`${(error as Error).message}\n\nRun rtl-doctor --help for usage.`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    console.log(HELP);
    return 0;
  }
  if (values.version) {
    console.log(version);
    return 0;
  }
  const format = values.format ?? "pretty";
  if (format !== "pretty" && format !== "json") {
    console.error(`Unknown format "${format}"; use pretty or json.`);
    return 2;
  }

  const direction = values.direction;
  if (direction !== undefined && direction !== "ltr" && direction !== "rtl" && direction !== "both") {
    console.error(`Unknown direction "${direction}"; use ltr, rtl or both.`);
    return 2;
  }

  const result = await run({
    paths: positionals,
    fix: values.fix,
    locale: values.locale,
    persian: values["no-persian"] ? false : undefined,
    tailwind: values.tailwind,
    direction,
    layout: values.layout,
  });
  console.log(format === "json" ? formatJson(result, version) : formatPretty(result, { fix: values.fix, version }));
  return result.findings.some((f) => f.severity === "error") ? 1 : 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(`rtl-doctor: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  },
);
