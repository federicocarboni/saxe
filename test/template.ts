import {SaxParser} from "../src/index.ts";
import {CanonicalXmlWriter} from "./canonical_xml.ts";

export function toCanonical(...chunks: string[]) {
  const reader = new CanonicalXmlWriter();
  const parser = new SaxParser(reader);
  for (const chunk of chunks) {
    parser.write(chunk);
  }
  parser.end();
  return reader.output;
}
