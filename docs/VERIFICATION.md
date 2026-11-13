# Verification on a real site

The claim behind `--fix` is that it changes code, not pixels: every fix is relative to the
direction the element renders in today, so the page looks exactly the same afterwards and
mirrors correctly when the direction changes. This page records how that was checked on a
production site, and what the usual "mirror every class" mapping would have done instead.

## The site

- A production Persian website (a dental clinic), checked at its last commit on 2026-11-13
- Next.js 16.4.3, React 19.2, Tailwind CSS 4.3.3
- `<html lang="fa" dir="rtl">`, with `dir="ltr"` islands for phone and email inputs, Latin
  publication titles and photo credits
- 53 files checked (TSX, TS, CSS); the site was written right-to-left first, by hand

The real repository was never touched: the check ran on a copy made with `git archive`.

## What rtl-doctor found

`npx rtl-doctor .` reported 20 problems:

| Rule | Count | Where |
|------|-------|-------|
| `tailwind-logical` | 18 | 12 in right-to-left context (table alignment, list bullets and their padding, a divider, the hero image), 6 inside `dir="ltr"` islands |
| `intl-locale` | 2 | `localeCompare()` without a locale, sorting Persian titles |

All 20 were read by hand. Each is a real physical class or a locale-less call, so there
were no false positives in the sense of "the rule misread the code". One of them is
deliberate: the hero image is pinned `left-0` on purpose, with a comment explaining why.
The fix keeps its position (`inset-e-0` in RTL), so nothing breaks, but deciding which
physical placements are intentional is exactly the judgement call left to v0.2.

`--fix` applied the 18 layout fixes and left the 2 locale suggestions for a human.

## Method

1. Build the site at its last commit (`next build`), serve it, and record every rendered
   element on 9 pages at two viewports (1280 x 900 and 390 x 844): its box (x, y, width,
   height) and its text alignment resolved to a physical side (`end` in an RTL element is
   `left`). Animations are frozen; `<script>` and other non-rendered elements are skipped.
2. Run `rtl-doctor --fix`, rebuild, serve, record again.
3. Compare the two recordings element by element.
4. For the counterfactual, start again from the original code, fix with the mirror mapping
   that LTR-first tools use (`rtl-doctor --fix --direction ltr`), and record a third time.

The pages: `/`, `/about`, `/installments`, `/services`, `/services/implant`,
`/services/laminate`, `/reserve`, `/contact`, and one article. Together they render every
file that had a fix.

## Results

| Fix mapping | Element boxes changed | Pages affected |
|-------------|-----------------------|----------------|
| rtl-doctor (keep today's look) | **0 of 6,058** | none |
| Mirror every class (LTR-first tools) | **402 of 6,058** | 5 of 9 |

Under the mirror mapping the installments tables flip their text alignment (162 boxes per
viewport), the bullets on the service pages jump to the other side of their list items
(on mobile, a bullet moves from x = 367 to x = 16), and the home page hero image moves.

The build succeeded in all three runs.

## Reproduce

```bash
# In a copy of the site, with its dependencies installed:
next build && next start -p 3001 &
node path/to/rtl-doctor/scripts/layout-diff.mjs measure http://localhost:3001 before.json / /about /services
# stop the server
npx rtl-doctor . --fix
next build && next start -p 3001 &
node path/to/rtl-doctor/scripts/layout-diff.mjs measure http://localhost:3001 after.json / /about /services
node path/to/rtl-doctor/scripts/layout-diff.mjs compare before.json after.json
```

`layout-diff.mjs` needs Playwright; set `LAYOUT_DIFF_CHANNEL=msedge` (or `chrome`) to use
a browser that is already installed. It exits with 1 when any box changed.

## What this does not show

- It covers one site. The v0.3 evaluation measures precision and recall over 10 to 20
  open-source apps and seeded bugs.
- Pixel equality says the fixes are safe today. It does not say the code is now correct in
  LTR; that holds by construction (logical properties mirror) and is covered by the
  two-direction equivalence test in `test/tailwind-compile.test.ts`.
- Layouts that were copied from LTR code and look wrong in RTL still look wrong after
  `--fix`, by design. Finding those needs the v0.2 triage.
