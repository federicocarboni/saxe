/* eslint-disable */

import type {ReadStream} from "fs";
import type {ReadTokens} from "../index.ts";

import sax1 from "sax";

// @ts-ignore
sax1.MAX_BUFFER_LENGTH = 20_000_000;

export function sax(
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
  const parser = new sax1.SAXParser();

  parser.oncomment = () => {
    ++comments;
  };

  parser.onprocessinginstruction = () => {
    ++processingInstructions;
  };

  parser.onopentagstart = (tag) => {
    if (tag.isSelfClosing) {
      ++emptyTags;
    } else {
      ++startTags;
    }
  };

  parser.onclosetag = () => {
    ++endTags;
  };

  parser.ontext = () => {
    ++textNodes;
  };

  // A little help for CDATA
  parser.onopencdata = () => {
    ++textNodes;
  };

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
      parser.end();
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
