import {SaxOptions, SaxParser} from "../src/index.ts";
import {CanonicalXmlWriter} from "./canonical_xml.ts";

export function toCanonicalOpt(chunks: string[], options?: SaxOptions) {
  const reader = new CanonicalXmlWriter();
  const parser = new SaxParser(reader, options);
  for (const chunk of chunks) {
    parser.write(chunk);
  }
  parser.end();
  return reader.output;
}

export function toCanonical(...chunks: string[]) {
  return toCanonicalOpt(chunks);
}
