/* eslint-disable */

import type { ReadStream } from "fs";
import type { ReadTokens } from "../index.ts";

import { SaxParser, SaxReader } from "saxe";

class Reader implements SaxReader {
  comments = 0;
  processingInstructions = 0;
  startTags = 0;
  emptyTags = 0;
  endTags = 0;
  textNodes = 0;
  // some test files use entities without declaring them
  getGeneralEntity(entityName: string): string | undefined {
    return "";
  }
  entityRef(entityName: string): void {}
  comment(_text: string): void {
    ++this.comments;
  }
  processingInstruction(_target: string, _content: string): void {
    ++this.processingInstructions;
  }
  start(_name: string, _attributes: ReadonlyMap<string, string>): void {
    ++this.startTags;
  }
  empty(_name: string, _attributes: ReadonlyMap<string, string>): void {
    ++this.emptyTags;
  }
  end(_name: string): void {
    ++this.endTags;
  }
  text(_text: string): void {
    ++this.textNodes;
  }
}

export function saxe(
  readable: ReadStream,
  callback: (tokens: ReadTokens | undefined, error?: unknown) => void,
  ignoreDtd?: boolean
) {
  const reader = new Reader();
  const parser = new SaxParser(reader, {
    maxAttributes: 20_000_000,
    maxNameLength: 20_000_000,
    maxTextLength: 20_000_000,
    dtd: ignoreDtd ? "ignore" : undefined,
    // maxEntityDepth: Infinity,
    // maxEntityLength: Infinity,
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
    callback(reader);
  });
}
