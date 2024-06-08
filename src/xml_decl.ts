import {Chars, isWhiteSpace} from "./chars.ts";
import {createSaxError} from "./error.ts";

// @ts-expect-error -- TypeScript not able to prove the signature is correct
export function parseXmlDecl(
  xmlDecl: string,
  isTextDecl: false,
): {
  version: string;
  encoding?: string | undefined;
  standalone?: boolean | undefined;
};
export function parseXmlDecl(
  xmlDecl: string,
  isTextDecl: true,
): {
  version?: string | undefined;
  encoding?: string | undefined;
  standalone?: boolean | undefined;
};
export function parseXmlDecl(xmlDecl: string, isTextDecl: false) {
  if (xmlDecl.slice(0, 5) !== "<?xml") {
    throw createSaxError("INVALID_XML_DECL");
  }
  let version: string | undefined;
  let encoding: string | undefined;
  let standalone: boolean | undefined;
  let index = 5;
  while (xmlDecl.charCodeAt(index) !== Chars.QUESTION) {
    if (!isWhiteSpace(xmlDecl.charCodeAt(index))) {
      throw createSaxError("INVALID_XML_DECL");
    }
    while (isWhiteSpace(xmlDecl.charCodeAt(index))) {
      ++index;
    }
    if (xmlDecl.charCodeAt(index) === Chars.QUESTION) {
      break;
    }
    const eq = xmlDecl.indexOf("=", index);
    let nameEnd = eq;
    while (isWhiteSpace(xmlDecl.charCodeAt(--nameEnd)));
    ++nameEnd;
    const name = xmlDecl.slice(index, nameEnd);
    index = eq + 1;
    while (isWhiteSpace(xmlDecl.charCodeAt(index))) {
      ++index;
    }
    const quote = xmlDecl.charAt(index);
    if (eq === -1 || quote !== '"' && quote !== "'") {
      throw createSaxError("INVALID_XML_DECL");
    }
    ++index;
    const end = xmlDecl.indexOf(quote, index);
    const value = xmlDecl.slice(index, end);
    if (value.length > 2_000) {
      throw createSaxError("LIMIT_EXCEEDED");
    }
    index = end + 1;
    let isError = false;
    switch (name) {
      case "version":
        if (version !== undefined || !/^1\.[0-9]$/.test(value)) {
          isError = true;
        }
        version = value;
        break;
      case "encoding":
        if (
          version === undefined && !isTextDecl || encoding !== undefined ||
          standalone !== undefined || !/^[A-Za-z][A-Za-z0-9._-]*$/.test(value)
        ) {
          isError = true;
        }
        encoding = value.toLowerCase();
        break;
      case "standalone":
        if (
          version === undefined || isTextDecl || standalone !== undefined ||
          value !== "yes" && value !== "no"
        ) {
          isError = true;
        }
        standalone = value === "yes";
        break;
      default:
        isError = true;
    }
    if (isError) {
      throw createSaxError("INVALID_XML_DECL");
    }
  }
  if (
    xmlDecl.charCodeAt(++index) !== Chars.GT ||
    version === undefined && !isTextDecl
  ) {
    throw createSaxError("INVALID_XML_DECL");
  }
  return {version, encoding, standalone};
}
