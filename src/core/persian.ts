/**
 * Arabic code points that look like (or are typed instead of) Persian ones.
 * Written as escapes because the pairs are hard to tell apart on screen.
 */
export const REPLACEMENTS: Readonly<Record<string, string>> = {
  "\u064A": "\u06CC", // ARABIC LETTER YEH -> ARABIC LETTER FARSI YEH
  "\u0649": "\u06CC", // ARABIC LETTER ALEF MAKSURA -> ARABIC LETTER FARSI YEH
  "\u0643": "\u06A9", // ARABIC LETTER KAF -> ARABIC LETTER KEHEH
};

/** ARABIC-INDIC DIGIT ZERO..NINE -> EXTENDED ARABIC-INDIC (Persian) DIGIT ZERO..NINE. */
const ARABIC_DIGITS = /[\u0660-\u0669]/;
const toPersianDigit = (ch: string) => String.fromCharCode(ch.charCodeAt(0) - 0x0660 + 0x06f0);

/** Letters and digits that exist in Persian but not in Arabic: peh, tcheh, jeh, gaf, keheh, farsi yeh, Persian digits. */
const PERSIAN_ONLY = /[\u067E\u0686\u0698\u06AF\u06A9\u06CC\u06F0-\u06F9]/;
const ARABIC_SCRIPT = /[\u0600-\u06FF]/;
/** Teh marbuta is common in Arabic and rare in Persian, so a string with it is left alone. */
const ARABIC_MARKER = /\u0629/;

export interface PersianOptions {
  /** Treat every Arabic-script string as Persian (the app is known to be Persian). */
  assumePersian?: boolean;
  /** Also replace Arabic-Indic digits. Default true. */
  digits?: boolean;
}

export function isPersianText(text: string, assumePersian = false): boolean {
  if (PERSIAN_ONLY.test(text)) return true;
  return assumePersian && ARABIC_SCRIPT.test(text) && !ARABIC_MARKER.test(text);
}

export interface ArabicChar {
  index: number;
  char: string;
  replacement: string;
}

/** Arabic look-alikes in a Persian string, with their Persian replacements. Empty for non-Persian text. */
export function findArabicChars(text: string, options: PersianOptions = {}): ArabicChar[] {
  if (!isPersianText(text, options.assumePersian)) return [];
  const digits = options.digits ?? true;
  const found: ArabicChar[] = [];
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    const replacement = REPLACEMENTS[char] ?? (digits && ARABIC_DIGITS.test(char) ? toPersianDigit(char) : undefined);
    if (replacement) found.push({ index, char, replacement });
  }
  return found;
}

export function fixArabicChars(text: string, options: PersianOptions = {}): string {
  const found = findArabicChars(text, options);
  if (found.length === 0) return text;
  // Indexes are UTF-16 code units on both sides, so surrogate pairs (emoji) survive the round trip.
  const out = text.split("");
  for (const { index, replacement } of found) out[index] = replacement;
  return out.join("");
}

const NAMES: Record<string, string> = {
  "\u064A": "Arabic yeh \u064A (U+064A) instead of Persian \u06CC (U+06CC)",
  "\u0649": "alef maksura \u0649 (U+0649) instead of Persian \u06CC (U+06CC)",
  "\u0643": "Arabic kaf \u0643 (U+0643) instead of Persian \u06A9 (U+06A9)",
};
const DIGITS = "Arabic-Indic digits (U+0660-U+0669) instead of Persian digits (U+06F0-U+06F9)";

/** "Arabic yeh ... instead of Persian ... and Arabic-Indic digits ..." summary for messages. */
export function describeArabicChars(found: readonly ArabicChar[]): string {
  const names = new Set<string>();
  for (const { char } of found) names.add(NAMES[char] ?? DIGITS);
  const list = [...names];
  return list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
}
