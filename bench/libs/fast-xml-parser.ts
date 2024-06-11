import {XMLParser} from "fast-xml-parser";
import type {ReadStream} from "fs";
import type {ReadTokens} from "../index.ts";

export function fast_xml_parser(
  readable: ReadStream,
  callback: (tokens: ReadTokens | undefined, error?: unknown) => void,
) {
  const parser = new XMLParser();
  // const bufs: Buffer[] = [];
  let s = ""
  readable.on("data", function(d) {
    s += d;
  });
  readable.on("end", function() {
    // const buf = Buffer.concat(bufs);
    try {
      parser.parse(s);
    } catch (error) {
      callback(undefined, error);
      return;
    }
    callback({
      comments: 0,
      processingInstructions: 0,
      startTags: 0,
      emptyTags: 0,
      endTags: 0,
      textNodes: 0,
    });
  });
}
