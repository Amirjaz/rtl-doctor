import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export interface TailwindVersion {
  major: number;
  minor: number;
}

/** Parses "4.3.3", "^4.1.0", "~3.4", "4", "v3.4.1" and similar. */
export function parseTailwindVersion(input: string | number | undefined): TailwindVersion | undefined {
  if (input === undefined) return undefined;
  const match = /(\d+)(?:\.(\d+))?/.exec(String(input));
  if (!match) return undefined;
  return { major: Number(match[1]), minor: Number(match[2] ?? 0) };
}

export function atLeast(version: TailwindVersion, major: number, minor: number): boolean {
  return version.major > major || (version.major === major && version.minor >= minor);
}

export function formatTailwindVersion(version: TailwindVersion | undefined): string {
  return version ? `${version.major}.${version.minor}` : "unknown";
}

const cache = new Map<string, TailwindVersion | undefined>();

/**
 * Finds the Tailwind version a project uses: the installed `tailwindcss` package first,
 * then the range declared in the nearest package.json. Returns undefined when neither exists.
 */
export function detectTailwindVersion(cwd: string): TailwindVersion | undefined {
  if (cache.has(cwd)) return cache.get(cwd);
  const version = fromInstalled(cwd) ?? fromManifest(cwd);
  cache.set(cwd, version);
  return version;
}

function fromInstalled(cwd: string): TailwindVersion | undefined {
  try {
    const require = createRequire(join(cwd, "noop.js"));
    const manifest = require.resolve("tailwindcss/package.json");
    return parseTailwindVersion(JSON.parse(readFileSync(manifest, "utf8")).version);
  } catch {
    return undefined;
  }
}

function fromManifest(cwd: string): TailwindVersion | undefined {
  let dir = cwd;
  for (;;) {
    const file = join(dir, "package.json");
    if (existsSync(file)) {
      try {
        const pkg = JSON.parse(readFileSync(file, "utf8"));
        const range = pkg.dependencies?.tailwindcss ?? pkg.devDependencies?.tailwindcss;
        if (range) return parseTailwindVersion(range);
      } catch {
        // An unreadable manifest is the same as no manifest.
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
