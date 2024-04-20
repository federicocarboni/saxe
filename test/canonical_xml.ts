// This module implements a SaxReader which produces the Canonical XML
// representation of the parsed document.
// This was written to test the parser using the W3C XML Test Suite but is also
// a good SaxReader example and may be used as a practical reference on how to
// use SaxParser.

import {SaxReader} from "../src/index.ts";

function escapeDataChars(value: string) {
  return value.replace(/[&<>"\t\n\r]/g, (val) => {
    switch (val) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "\t":
        return "&#9;";
      case "\n":
        return "&#10;";
      case "\r":
        return "&#13;";
    }
    return "";
  });
}

export class CanonicalXmlWriter implements SaxReader {
  public output = "";
  // No XML or DOCTYPE declarations in Canonical XML
  // xml?(declaration: XmlDeclaration): void {
  //   throw new Error("Method not implemented.");
  // }
  doctype(): void {
  }
  pi(target: string, content: string): void {
    this.output += `<?${target} ${content}?>`;
  }
  // There are no comments in Canonical XML
  comment(): void {
  }
  // Parser will throw if it finds a non-predefined entity in an attribute value
  replaceEntityRef(): string | undefined {
    throw new Error("Entities are not supported");
  }
  // Cannot read entities from DTD so can't do anything with them
  entityRef(): void {
    throw new Error("Entities are not supported");
  }
  start(name: string, attributes: ReadonlyMap<string, string>): void {
    this.output += `<${name}`;
    // As per canonical XML rule lexicographically sort attributes
    const attribs = [...attributes].sort(([a], [b]) => a < b ? -1 : 1);
    for (const [attribute, value] of attribs) {
      this.output += ` ${attribute}="${escapeDataChars(value)}"`;
    }
    this.output += ">";
  }
  empty(name: string, attributes: ReadonlyMap<string, string>): void {
    this.start(name, attributes);
    this.end(name);
  }
  end(name: string): void {
    this.output += `</${name}>`;
  }
  text(text: string): void {
    this.output += escapeDataChars(text);
  }
}
