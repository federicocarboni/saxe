// https://www.w3.org/TR/REC-xml/#NT-S
// § White Space
export function isWhitespace(c: number) {
  return c === 0x20 /* SP */ || c === 0x09 /* TAB */ || c === 0x0A /* LF */ || c === 0x0D /* CR */;
}

export function isAsciiDigit(c: number) {
  return 0x30 <= c && c <= 0x39;
}

export function isAsciiHexAlpha(c: number) {
  return (
    0x61 /* a */ <= c && c <= 0x66 /* f */ ||
    0x41 /* A */ <= c && c <= 0x46 /* F */
  );
}

export function isAlpha(c: number) {
  return (
    0x61 /* a */ <= c && c <= 0x7a /* z */ ||
    0x41 /* A */ <= c && c <= 0x5a /* Z */
  );
}

export function isEncodingName(value: string) {
  if (!isAlpha(value.charCodeAt(0))) return false;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (
      !isAlpha(c) &&
      !isAsciiDigit(c) &&
      c !== 0x2e && /* . */
      c !== 0x5f && /* _ */
      c !== 0x2d /* - */
    ) {
      return false;
    }
  }
  return true;
}

export function parseDec(dec: string): number | undefined {
  let n = 0;
  const length = dec.length;
  for (let i = 0; i < length; i++) {
    const digit = (dec.charCodeAt(i) - 0x30) >>> 0;
    if (digit > 9) return undefined;
    n = (n << 3) + (n << 1) + digit;
  }
  return n;
}

export function parseHex(dec: string): number | undefined {
  let n = 0;
  const length = dec.length;
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
    n = (n << 4) | digit;
  }
  return n;
}

// https://www.w3.org/TR/REC-xml/#NT-Char
// § Character Range
export function isChar(c: number) {
  return (
    c === 0x9 ||
    c === 0xa ||
    c === 0xd ||
    (0x20 <= c && c <= 0xD7FF) ||
    (0xE000 <= c && c <= 0xFFFD) ||
    (0x10000 <= c && c <= 0x10FFFF)
  );
}

// https://www.w3.org/TR/REC-xml/#NT-NameStartChar
export function isNameStartChar(c: number) {
  return isAlpha(c) || c === 0x3a /* : */ || c === 0x5f /* _ */ ||
    0xC0 <= c && c <= 0xD6 ||
    0xD8 <= c && c <= 0xF6 || 0xF8 <= c && c <= 0x2FF ||
    0x370 <= c && c <= 0x37D || 0x37F <= c && c <= 0x1FFF ||
    0x200C <= c && c <= 0x200D || 0x2070 <= c && c <= 0x218F ||
    0x2C00 <= c && c <= 0x2FEF || 0x3001 <= c && c <= 0xD7FF ||
    0xF900 <= c && c <= 0xFDCF || 0xFDF0 <= c && c <= 0xFFFD ||
    0x10000 <= c && c <= 0xEFFFF;
}

// https://www.w3.org/TR/REC-xml/#NT-NameChar
export function isNameChar(c: number) {
  return isNameStartChar(c) || c === 0x2D /* - */ || c === 0x2E /* . */ ||
    isAsciiDigit(c) || c === 0xB7 || 0x0300 <= c && c <= 0x036F ||
    0x203F <= c && c <= 0x2040;
}
