/* eslint-disable */

import type {ReadStream} from "fs";
import type {BenchOptions, ReadTokens} from "../index.ts";

import {
  Doctype,
  NamespaceAttributes,
  NamespaceResolver,
  QName,
  SaxHandler,
  SaxNamespaceHandler,
  SaxNamespaceParser,
  SaxParser,
  XmlDeclaration,
} from "../../src/index.ts";

class Handler implements SaxNamespaceHandler {
  comments = 0;
  processingInstructions = 0;
  startTags = 0;
  endTags = 0;
  textNodes = 0;
  attributes = 0;

  comment(_content: string): void {
    ++this.comments;
  }
  processingInstruction(_target: string, _content: string): void {
    ++this.processingInstructions;
  }
  startTag(
    _name: any,
    _attributes: {readonly size: number},
  ): void {
    ++this.startTags;
    this.attributes += _attributes.size;
  }
  endTag(_name: any): void {
    ++this.endTags;
  }
  text(
    _content: string,
    _isCDataSection: boolean,
  ): void {
    ++this.textNodes;
  }
}

export function saxe(
  readable: ReadStream,
  callback: (tokens: ReadTokens | undefined, error?: unknown) => void,
  options?: BenchOptions,
) {
  const handler = new Handler();
  const saxOptions = {
    dtd: options?.dtd,
    maxNameLength: 10_000_000,
    maxTextLength: 10_000_010,
    maxAttributesLength: 10_000_100,
    entityProvider: {
      // some test files use entities without declaring them
      getEntity(_entityName: string): string | undefined {
        return "";
      },
    },
    incompleteTextNodes: true,
  };
  const parser = options?.namespaces
    ? new SaxNamespaceParser(handler, saxOptions)
    : new SaxParser(handler, saxOptions);

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
