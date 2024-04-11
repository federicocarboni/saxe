/** @internal */
export const enum Chars {
  TAB = 0x9,
  LF = 0xA,
  CR = 0xD,
  SP = 0x20,
  AMP = 0x26,
  APOSTROPHE = 0x27,
  BANG = 0x21,
  QUOTE = 0x22,
  HASH = 0x23,
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
/** @internal */
export function isWhitespace(c: number) {
  return c === Chars.SP || c === Chars.TAB || c === Chars.LF || c === Chars.CR;
}

export function isWhitespaceNonSP(c: number) {
  return c === Chars.TAB || c === Chars.LF || c === Chars.CR;
}

/** @internal */
export function isAsciiDigit(c: number) {
  return 0x30 <= c && c <= 0x39;
}

/** @internal */
export function isAsciiHexAlpha(c: number) {
  return (
    (0x61 /* a */ <= c && c <= 0x66) /* f */ ||
    (0x41 /* A */ <= c && c <= 0x46) /* F */
  );
}

/** @internal */
export function isAlpha(c: number) {
  return (
    (0x61 /* a */ <= c && c <= 0x7a) /* z */ ||
    (0x41 /* A */ <= c && c <= 0x5a) /* Z */
  );
}

/** @internal */
export function isEncodingName(value: string) {
  if (!isAlpha(value.charCodeAt(0))) return false;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (
      !isAlpha(c) &&
      !isAsciiDigit(c) &&
      c !== 0x2e /* . */ &&
      c !== 0x5f /* _ */ &&
      c !== 0x2d /* - */
    ) {
      return false;
    }
  }
  return true;
}

/** @internal */
export function parseDecCharRef(dec: string): number | undefined {
  let n = 0;
  const length = dec.length;
  if (length === 0) return undefined;
  for (let i = 0; i < length; i++) {
    const digit = (dec.charCodeAt(i) - 0x30) >>> 0;
    if (digit > 9) return undefined;
    n = n * 10 + digit;
  }
  return n;
}

/** @internal */
export function parseHex(dec: string): number | undefined {
  let n = 0;
  const length = dec.length;
  if (length === 0) return undefined;
  for (let i = 0; i < length; i++) {
    const c = dec.charCodeAt(i);
    let digit;
    if (isAsciiDigit(c)) {
      digit = c - 0x30;
    } else if (isAsciiHexAlpha(c)) {
      digit = (c | 0x20) - 0x57;
    } else {
      return undefined;
    }
    n = n * 16 + digit;
  }
  return n;
}

// https://www.w3.org/TR/REC-xml/#NT-Char
// § Character Range
/** @internal */
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
/** @internal */
export function isNameStartChar(c: number) {
  return (
    isAlpha(c) ||
    c === 0x3A /* : */ ||
    c === 0x5F /* _ */ ||
    (0xc0 <= c && c <= 0xd6) ||
    (0xd8 <= c && c <= 0xf6) ||
    (0xf8 <= c && c <= 0x2ff) ||
    (0x370 <= c && c <= 0x37d) ||
    (0x37f <= c && c <= 0x1fff) ||
    (0x200c <= c && c <= 0x200d) ||
    (0x2070 <= c && c <= 0x218f) ||
    (0x2c00 <= c && c <= 0x2fef) ||
    (0x3001 <= c && c <= 0xd7ff) ||
    (0xf900 <= c && c <= 0xfdcf) ||
    (0xfdf0 <= c && c <= 0xfffd) ||
    (0x10000 <= c && c <= 0xeffff)
  );
}

// https://www.w3.org/TR/REC-xml/#NT-NameChar
/** @internal */
export function isNameChar(c: number) {
  return (
    isNameStartChar(c) ||
    c === 0x2d /* - */ ||
    c === 0x2e /* . */ ||
    isAsciiDigit(c) ||
    c === 0xb7 ||
    (0x0300 <= c && c <= 0x036f) ||
    (0x203f <= c && c <= 0x2040)
  );
}
