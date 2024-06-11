/* eslint-disable */

import type {ReadStream} from "fs";
import type {ReadTokens} from "../index.ts";

import {SaxesParser} from "saxes";

export function saxes(
  readable: ReadStream,
  callback: (tokens: ReadTokens | undefined, error?: unknown) => void,
) {
  let comments = 0;
  let processingInstructions = 0;
  let startTags = 0;
  let emptyTags = 0;
  let endTags = 0;
  let textNodes = 0;

  // Kept on default configuration, strict mode is not compliant anyway.
  const parser = new SaxesParser();

  parser.on("comment", () => {
    ++comments;
  });

  parser.on("processinginstruction", () => {
    ++processingInstructions;
  });

  parser.on("opentag", (tag) => {
    if (tag.isSelfClosing) {
      ++emptyTags;
    } else {
      ++startTags;
    }
  });

  parser.on("closetag", () => {
    ++endTags;
  });

  parser.on("text", () => {
    ++textNodes;
  });

  // A little help for CDATA
  parser.on("cdata", () => {
    ++textNodes;
  });

  // Catch-all for entities
  parser.ENTITIES = new Proxy({}, {
    get(_target, p) {
      return "";
    },
  });

  readable.setEncoding("utf-8");
  readable.on("data", (data) => {
    try {
      parser.write(data as unknown as string);
    } catch (error) {
      callback(undefined, error);
    }
  });
  readable.on("end", () => {
    try {
      parser.close();
    } catch (error) {
      callback(undefined, error);
      return;
    }
    callback({
      comments,
      processingInstructions,
      startTags,
      emptyTags,
      endTags,
      textNodes,
    });
  });
}
