import {SaxOptions, SaxParser} from "../src/index.ts";
import {CanonicalXmlWriter} from "./canonical_xml.ts";

export function toCanonical(xml: string, options?: SaxOptions) {
  const reader = new CanonicalXmlWriter();
  const parser = new SaxParser(reader, options);
  for (const c of xml) {
    parser.write(c);
  }
  parser.end();
  return reader.output;
}
