/* eslint-disable */

import type {ReadStream} from "fs";
import type {ReadTokens} from "../index.ts";

import {SaxParser, SaxHandler} from "../../src/index.ts";

class Handler implements SaxHandler {
  comments = 0;
  processingInstructions = 0;
  startTags = 0;
  endTags = 0;
  textNodes = 0;
  attributes = 0;

  entityRef(_entityName: string): boolean {
    return true;
  }
  comment(_text: string): void {
    ++this.comments;
  }
  processingInstruction(_target: string, _content: string): void {
    ++this.processingInstructions;
  }
  startTag(_name: string, _attributes: ReadonlyMap<string, string>): void {
    ++this.startTags;
    this.attributes += _attributes.size;
  }
  endTag(_name: string): void {
    ++this.endTags;
  }
  text(_text: string): void {
    ++this.textNodes;
  }
}

export function saxe(
  readable: ReadStream,
  callback: (tokens: ReadTokens | undefined, error?: unknown) => void,
  ignoreDtd?: boolean,
) {
  const handler = new Handler();
  const parser = new SaxParser(handler, {
    // maxAttributes: 20_000_000,
    maxNameLength: 10_000_000,
    maxTextLength: 10_000_010,
    dtd: ignoreDtd ? "ignore" : undefined,
    // maxEntityDepth: Infinity,
    // maxEntityLength: Infinity,
    entityProvider: {
      // some test files use entities without declaring them
      getEntity(_entityName: string): string | undefined {
        return "";
      },
    },
  });

  readable.setEncoding("utf-8");
  readable.on("data", (data) => {
    try {
      parser.parse(data as string, {stream: true});
    } catch (error) {
      callback(undefined, error);
    }
  });
  readable.on("end", () => {
    try {
      parser.parse();
    } catch (error) {
      callback(undefined, error);
      return;
    }
    callback(handler);
  });
}
