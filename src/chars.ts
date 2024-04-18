/** @internal */
export const enum Chars {
  TAB = 0x9,
  LF = 0xA,
  CR = 0xD,
  SP = 0x20,
  AMPERSAND = 0x26,
  APOSTROPHE = 0x27,
  BANG = 0x21,
  QUOTE = 0x22,
  HASH = 0x23,
  HYPHEN = 0x2D,
  SLASH = 0x2F,
  SEMICOLON = 0x3B,
  LT = 0x3C,
  EQ = 0x3D,
  GT = 0x3E,
  QUESTION = 0x3F,
  OPEN_BRACKET = 0x5B,
  CLOSE_BRACKET = 0x5D,
  LOWER_L = 0x6C,
  LOWER_M = 0x6D,
  LOWER_X = 0x78,
}

// https://www.w3.org/TR/REC-xml/#NT-S
// § White Space
// @internal
export function isWhitespace(c: number) {
  return c === Chars.SP || c === Chars.TAB || c === Chars.LF || c === Chars.CR;
}

// @internal
export function isAsciiDigit(c: number) {
  return 0x30 <= c && c <= 0x39;
}

// @internal
export function isAsciiHexAlpha(c: number) {
  return (
    (0x61 /* a */ <= c && c <= 0x66) /* f */ ||
    (0x41 /* A */ <= c && c <= 0x46) /* F */
  );
}

// https://www.w3.org/TR/REC-xml/#NT-Char
// § Character Range
// @internal
export function isChar(c: number) {
  return (
    c === 0x9 ||
    c === 0xA ||
    c === 0xD ||
    (0x20 <= c && c <= 0xD7FF) ||
    (0xE000 <= c && c <= 0xFFFD) ||
    (0x10000 <= c && c <= 0x10FFFF)
  );
}

// https://www.w3.org/TR/REC-xml/#NT-NameStartChar
// @internal
export function isNameStartChar(c: number) {
  return (
    0x61 /* a */ <= c && c <= 0x7A /* z */ ||
    0x41 /* A */ <= c && c <= 0x5A /* Z */ ||
    c === 0x3A /* : */ || c === 0x5F /* _ */ ||
    0xC0 <= c && c <= 0xD6 || 0xD8 <= c && c <= 0xF6 ||
    0xF8 <= c && c <= 0x2FF || 0x370 <= c && c <= 0x37D ||
    0x37F <= c && c <= 0x1FFF || 0x200C <= c && c <= 0x200D ||
    0x2070 <= c && c <= 0x218F || 0x2C00 <= c && c <= 0x2FEF ||
    0x3001 <= c && c <= 0xD7FF || 0xF900 <= c && c <= 0xFDCF ||
    0xFDF0 <= c && c <= 0xFFFD || 0x10000 <= c && c <= 0xEFFFF
  );
}

// https://www.w3.org/TR/REC-xml/#NT-NameChar
// @internal
export function isNameChar(c: number) {
  return (
    isNameStartChar(c) || c === 0x2D /* - */ || c === 0x2E /* . */ ||
    isAsciiDigit(c) || c === 0xB7 || 0x0300 <= c && c <= 0x036F ||
    0x203F <= c && c <= 0x2040
  );
}

// @internal
export function hasInvalidChar(s: string) {
  // Astral characters are not considered because enabling Unicode support on
  // regexes is a performance hit and we assume strings are well-formed.
  return /[^\t\n\r\x20-\uFFFD]/.test(s);
}
