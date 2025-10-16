export type {SaxErrorName, SaxErrorOptions} from "./error.ts";
export {SaxError} from "./error.ts";
export type {
  NamespaceAttributes,
  NamespaceResolver,
  QName,
  SaxNamespaceOptions,
  SaxNamespaceReader,
} from "./namespace.ts";
export {
  SaxNamespaceParser,
  XML_NAMESPACE,
  XMLNS_NAMESPACE,
} from "./namespace.ts";
export type {
  Attributes,
  Doctype,
  EntityProvider,
  SaxOptions,
  SaxParseOptions,
  SaxReader,
  XmlDeclaration,
} from "./parser.ts";
export {SaxParser} from "./parser.ts";

/**
 * @param c - A string containing a single character to escape.
 * @returns - Returns a new string containing a predefined entity reference or
 * decimal character reference corresponding to the specified character.
 */
export function xmlEscapeChar(c: string): string {
  switch (c.charAt(0)) {
    case "&":
      return "&amp;";
    case "<":
      return "&lt;";
    case ">":
      return "&gt;";
    case "'":
      return "&apos;";
    case '"':
      return "&quot;";
    case "\t":
      return "&#9;";
    case "\n":
      return "&#10;";
    case "\r":
      return "&#13;";
    case "":
      return "";
    default:
      return `&#${c.codePointAt(0)};`;
  }
}

/**
 * Escapes a string by replacing each instance of XML markup characters by their
 * predefined entity or decimal character reference, so that they are
 * interpreted literally in text content or attributes.
 *
 * Each of the following characters is replaced by the corresponding sequence:
 *
 * - `&` → `&amp;`
 * - `<` → `&lt;`
 * - `>` → `&gt;`
 * - `'` → `&apos;`
 * - `"` → `&quot;`
 * - `\t` → `&#9;` (TAB)
 * - `\n` → `&#10;` (LF)
 * - `\r` → `&#13;` (CR)
 *
 * @param s - A string to be escaped as XML content.
 * @returns - Returns a new string where each XML markup character is replaced
 * by their escape sequence.
 *
 * @example
 * ```ts
 * xmlEscape("<div>Fish & chips</div>");
 * // "&lt;div&gt;Fish &amp; chips&lt;/div&gt;"
 * ```
 */
export function xmlEscape(s: string) {
  return s.replace(/[&<>'"\t\n\r]/g, xmlEscapeChar);
}
