import type {SaxOptions} from "../src/index.ts";
import {SaxParser} from "../src/index.ts";
import {CanonicalXmlWriter} from "./canonical_xml.ts";

export function toCanonicalOpt(chunks: string[], options?: SaxOptions) {
  const handler = new CanonicalXmlWriter();
  const parser = new SaxParser(handler, {dtd: "process", ...options});
  for (const chunk of chunks) {
    parser.parse(chunk, {stream: true});
  }
  parser.parse();
  return handler.output;
}

export function toCanonical(...chunks: string[]) {
  return toCanonicalOpt(chunks);
}
