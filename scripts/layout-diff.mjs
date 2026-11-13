// Proves that `rtl-doctor --fix` did not move anything: records the box and resolved text
// alignment of every rendered element on a set of pages, then compares two recordings.
//
//   node scripts/layout-diff.mjs measure http://localhost:3000 before.json / /about /pricing
//   node scripts/layout-diff.mjs compare before.json after.json
//
// Needs Playwright (`npm i -D playwright`, or run with NODE_PATH pointing at one).
// Set LAYOUT_DIFF_CHANNEL=msedge or chrome to use an installed browser instead of a download.
import { readFileSync, writeFileSync } from "node:fs";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

async function measure(base, out, paths) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("layout-diff needs Playwright: npm i -D playwright");
    process.exit(2);
  }
  const browser = await chromium.launch({ channel: process.env.LAYOUT_DIFF_CHANNEL, headless: true });
  const result = {};
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    for (const path of paths) {
      await page.goto(base + path, { waitUntil: "networkidle" });
      // Measure at rest.
      await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
      await page.waitForTimeout(300);
      result[`${viewport.name} ${path}`] = await page.evaluate(() => {
        /* global document, getComputedStyle */
        // Not rendered, and frameworks stream a build-dependent number of script chunks.
        const SKIP = new Set(["SCRIPT", "STYLE", "LINK", "META", "TEMPLATE", "NOSCRIPT", "NEXT-ROUTE-ANNOUNCER"]);
        const rows = [];
        const walk = (el, at) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          // start/end name a side only together with the direction, so record the side.
          const rtl = s.direction === "rtl";
          const align = { start: rtl ? "right" : "left", end: rtl ? "left" : "right" }[s.textAlign] ?? s.textAlign;
          rows.push([at, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), align].join(" "));
          [...el.children]
            .filter((c) => !SKIP.has(c.tagName))
            .forEach((child, i) => walk(child, `${at}/${child.tagName.toLowerCase()}${i}`));
        };
        walk(document.body, "body");
        return rows;
      });
    }
    await context.close();
  }
  await browser.close();
  writeFileSync(out, JSON.stringify(result));
  const elements = Object.values(result).reduce((n, rows) => n + rows.length, 0);
  console.log(`measured ${Object.keys(result).length} page views, ${elements} elements`);
}

function compare(beforeFile, afterFile) {
  const before = JSON.parse(readFileSync(beforeFile, "utf8"));
  const after = JSON.parse(readFileSync(afterFile, "utf8"));
  let total = 0;
  let changed = 0;
  for (const [view, rows] of Object.entries(before)) {
    const other = after[view] ?? [];
    total += rows.length;
    if (rows.length !== other.length) {
      console.log(`${view}: ${rows.length} elements before, ${other.length} after`);
      changed += Math.abs(rows.length - other.length);
      continue;
    }
    let here = 0;
    rows.forEach((row, i) => {
      if (row === other[i]) return;
      if (here++ < 3) console.log(`${view}\n  before: ${row}\n  after:  ${other[i]}`);
      changed++;
    });
    if (here > 3) console.log(`${view}: ${here} elements changed`);
  }
  console.log(`${changed} of ${total} element boxes changed`);
  process.exitCode = changed === 0 ? 0 : 1;
}

const [command, ...rest] = process.argv.slice(2);
if (command === "measure" && rest.length >= 2) await measure(rest[0], rest[1], rest.length > 2 ? rest.slice(2) : ["/"]);
else if (command === "compare" && rest.length === 2) compare(rest[0], rest[1]);
else {
  console.error("usage: layout-diff.mjs measure <baseUrl> <out.json> [paths...] | compare <before.json> <after.json>");
  process.exitCode = 2;
}
