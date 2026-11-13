import type { Direction, TailwindFinding } from "./tailwind.js";

/**
 * Why a physical property or class is a problem, worded for the direction the code
 * renders in today, and what to use instead. Shared by Tailwind and CSS findings.
 */
export function physicalMessage(input: {
  subject: string;
  direction: Direction;
  replacement: string | null;
  alternatives?: { ltr: string; rtl: string };
  logical?: string;
}): string {
  const { subject, direction, replacement, alternatives, logical } = input;
  const detail = logical ? ` (${logical})` : "";
  if (direction === "both") {
    const options = alternatives ? `; use \`${alternatives.ltr}\` if it was designed left-to-right or \`${alternatives.rtl}\` if right-to-left` : "";
    return `${subject}, which is wrong in one of the directions this renders in${options}.`;
  }
  if (!replacement) return `${subject}, which does not mirror with the text direction.`;
  if (direction === "rtl") {
    return `${subject}, which does not mirror with the text direction; use \`${replacement}\`${detail}, which looks the same in this right-to-left layout.`;
  }
  return `${subject}, which does not flip in RTL; use \`${replacement}\`${detail}.`;
}

/** One wording for Tailwind findings, shared by the ESLint rule and CSS `@apply` checks. */
export function tailwindMessage(finding: TailwindFinding): string {
  const cls = finding.token.value;
  switch (finding.kind) {
    case "physical":
      if (finding.tooOld) {
        return `\`${cls}\` sets ${finding.property}, which does not mirror with the text direction; its logical twin needs Tailwind ${finding.minVersion} or newer.`;
      }
      return physicalMessage({
        subject: `\`${cls}\` sets ${finding.property}`,
        direction: finding.direction,
        replacement: finding.replacement,
        alternatives: finding.alternatives,
        logical: finding.logicalProperty,
      });
    case "space-reverse-missing":
      return `\`${cls}\` puts the gap on the left in Tailwind v3, which is wrong in RTL; add \`${finding.insert}\`.`;
    case "space-reverse-harmful":
      return `\`${cls}\` undoes the RTL flip in Tailwind v4, where space-x and divide-x already use logical properties; remove it.`;
  }
}
