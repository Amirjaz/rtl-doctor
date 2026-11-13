/**
 * rtl-doctor: an ESLint plugin (the default export) plus the checkers the CLI uses.
 *
 *   import rtlDoctor from "rtl-doctor";
 *   export default [rtlDoctor.configs.recommended]; // or rtlDoctor.configs.persian
 */
import { plugin } from "./plugin.js";

export default plugin;
export type { RtlDoctorPlugin } from "./plugin.js";

export { run, type RunOptions, type RunResult, type Finding } from "./cli/run.js";
export { checkCss, type CssOptions, type CssResult, type CssFinding, PHYSICAL_PROPERTIES, PHYSICAL_VALUES } from "./core/css.js";
export { checkJson, isPersianMessageFile, type JsonResult } from "./core/json.js";
export { detectProject, type ProjectInfo } from "./core/detect.js";
export { analyzeClassList, logicalUtility, type ClassSegment, type TailwindFinding } from "./core/tailwind.js";
export { detectTailwindVersion, parseTailwindVersion, type TailwindVersion } from "./core/tailwind-version.js";
export { findArabicChars, fixArabicChars, isPersianText } from "./core/persian.js";
