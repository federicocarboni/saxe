/** */
// This file requires the TextDecoder DOM API, Web, Node.js, Deno and the
// Cloudflare Worker runtime support it.
/// <reference lib="dom" />

import {Chars, isWhiteSpace} from "./chars.ts";
import {SaxError} from "./error.ts";
import {SaxParser} from "./index.ts";
import {parseXmlDecl} from "./xml_decl.ts";

const enum State {
  // Not enough data was seen yet.
  INIT,
  // Document has no BOM and starts with "<?xml" so it is using an
  // ASCII-compatible encoding.
  ASCII_XML_DECL,
  // Document has a BOM or is UTF-16 and starts with "<?xml".
  XML_DECL,
  // Encoding has been detected.
  DOCUMENT,
}

const NON_FATAL_DECODER = new TextDecoder();

const TEXT_DECODER_OPTIONS: TextDecoderOptions = {
  // It is a fatal error if an XML entity is determined (via default,
  // encoding declaration, or higher-level protocol) to be in a certain
  // encoding but contains byte sequences that are not legal in that
  // encoding.
  fatal: true,
  // BOM is handled below.
  ignoreBOM: true,
};

export class SaxDecoder {
  // @internal
  private textDecoder_: TextDecoder | undefined = undefined;
  // @internal
  private chunk_: Uint8Array | undefined = undefined;
  // @internal
  private xmlDecl_ = "";
  // @internal
  private state_ = State.INIT;
  // @internal
  private readonly parser_: SaxParser;
  constructor(parser: SaxParser) {
    this.parser_ = parser;
  }
  /**
   * Returns the name of the encoding of the document, lowercased, like the
   * `encoding` property of `TextDecoder`. Returns `undefined` until the
   * encoding is detected or set by default.
   */
  get encoding(): string | undefined {
    return this.state_ === State.DOCUMENT
      ? this.textDecoder_!.encoding
      : undefined;
  }
  /**
   * @param input
   * @throws {import("./error.ts").SaxError}
   */
  write(input: Uint8Array) {
    if (this.state_ === State.DOCUMENT) {
      this.parser_.write(this.decodeChunk_(input, {stream: true}));
    } else if (this.state_ === State.XML_DECL) {
      this.handleXmlDecl_(this.decodeChunk_(input, {stream: true}));
    } else {
      this.detectEncoding_(input);
    }
  }
  end() {
    if (this.textDecoder_ === undefined) {
      this.setTextDecoder_();
    }
    // Decode any pending data.
    this.parser_.write(this.decodeChunk_(this.chunk_));
    this.parser_.end();
  }
  // @internal
  private decodeChunk_(input?: Uint8Array, options?: TextDecodeOptions) {
    try {
      const text = this.textDecoder_!.decode(input, options);
      console.log(JSON.stringify(text));
      return text;
    } catch (cause) {
      throw new SaxError("ENCODING_INVALID_DATA", {
        encoding: this.textDecoder_!.encoding,
        cause,
      });
    }
  }
  // @internal
  private setTextDecoder_(encoding?: string) {
    try {
      this.textDecoder_ = new TextDecoder(encoding, TEXT_DECODER_OPTIONS);
    } catch (cause) {
      throw new SaxError("ENCODING_NOT_SUPPORTED", {
        encoding,
        cause,
      });
    }
  }
  // @internal
  private handleXmlDecl_(input: string) {
    let end;
    if (this.xmlDecl_.charCodeAt(this.xmlDecl_.length - 1) === Chars.QUESTION) {
      if (input.charCodeAt(0) !== Chars.GT) {
        throw new SaxError("INVALID_XML_DECL");
      }
      end = 1;
      this.xmlDecl_ += ">";
    } else {
      const question = input.indexOf("?>");
      end = question === -1 ? this.xmlDecl_.length : question + 2;
      const chunk = input.slice(0, end);
      if (this.xmlDecl_.length + end + 1 > 2000) {
        throw new SaxError("LIMIT_EXCEEDED");
      }
      this.xmlDecl_ += chunk;
      if (question === -1) {
        return;
      }
    }
    const {encoding} = parseXmlDecl(this.xmlDecl_);
    let normalizedEncoding;
    try {
      // Let TextDecoder resolve any aliases
      normalizedEncoding = new TextDecoder(encoding).encoding;
    } catch {
      // Intentionally empty
    }
    if (normalizedEncoding !== this.textDecoder_!.encoding) {
      throw new SaxError("ENCODING_INVALID_DATA", {encoding});
    }
    this.state_ = State.DOCUMENT;
    this.parser_.write(this.xmlDecl_);
    this.parser_.write(input.slice(end));
    this.xmlDecl_ = "";
  }
  // @internal
  private handleAsciiXmlDecl_() {
    const question = this.chunk_!.indexOf(Chars.QUESTION, 6);
    if (question === -1 || question + 1 === this.chunk_!.length) {
      return;
    }
    const xmlDecl = NON_FATAL_DECODER.decode(
      this.chunk_!.subarray(0, question + 2),
    );
    const {encoding} = parseXmlDecl(xmlDecl);
    this.setTextDecoder_(encoding);
    this.state_ = State.DOCUMENT;
    this.write(this.chunk_!);
    this.chunk_ = undefined;
  }
  // This function does no validation, it assumes the XML declaration (if
  // present) is valid and encoding is also valid.
  // chunk should be at least 4 bytes long
  // @internal
  private detectEncoding_(input: Uint8Array) {
    if (this.chunk_ === undefined) {
      this.chunk_ = input;
    } else {
      const chunk = this.chunk_;
      const size = chunk.length + input.length;
      this.chunk_ = new Uint8Array(size);
      this.chunk_.set(chunk);
      this.chunk_.set(input, chunk.length);
    }
    if (this.state_ === State.ASCII_XML_DECL) {
      return this.handleAsciiXmlDecl_();
    }
    // https://www.w3.org/TR/2008/REC-xml-20081126/#sec-guessing
    let encoding: string | undefined;
    let start = 0;
    const chunk = this.chunk_!;
    if (chunk.length < 4) {
      return;
    }
    const b0 = chunk[0]!;
    const b1 = chunk[1]!;
    const b2 = chunk[2]!;
    const b3 = chunk[3]!;
    let be;
    let bom;
    if (b0 === 0xef && b1 === 0xbb && b2 === 0xbf) {
      // UTF-8 BOM
      start = 3;
      encoding = "utf-8";
    } else if (
      ((bom = (be = b0 === 0xfe && b1 === 0xff) ||
        (b0 === 0xff && b1 === 0xfe)) ||
        (be = b0 === 0x00 && b1 === Chars.LT) ||
        (b0 === Chars.LT && b1 === 0x00)) &&
      (b2 | b3) !== 0x00
    ) {
      start = bom ? 2 : 0;
      encoding = be ? "utf-16be" : "utf-16le";
    } else if (
      // UTF-32 BOM
      (be = b0 === 0x00 && b1 === 0x00 && b2 === 0xfe && b3 === 0xff) ||
      (b0 === 0xff && b1 === 0xfe && b2 === 0x00 && b3 === 0x00) ||
      // UTF-32 < character (NUL characters are not allowed in XML so it won't
      // change behavior)
      (be = b0 === 0x00 && b1 === 0x00 && b2 === 0x00 && b3 === Chars.LT) ||
      (b0 === Chars.LT && b1 === 0x00 && b2 === 0x00 && b3 === 0x00)
    ) {
      // Late check for UTF-32; it is not supported by the encoding standard so
      // TextDecoder is not able to handle it and decoding it is out of the
      // scope of this library so the following is only for nicer error reports.
      // The standard names for these encoding schemes is UTF-32BE and UTF-32LE.
      throw new SaxError("ENCODING_NOT_SUPPORTED", {
        encoding: be ? "utf-32be" : "utf-32le",
      });
    }
    if (encoding !== undefined) {
      this.setTextDecoder_(encoding);
      const xmlDecl = this.decodeChunk_(chunk.subarray(start), {
        stream: true,
      });
      if (
        xmlDecl.slice(0, 5) === "<?xml" &&
        isWhiteSpace(xmlDecl.charCodeAt(5))
      ) {
        this.state_ = State.XML_DECL;
        this.handleXmlDecl_(xmlDecl);
        this.chunk_ = undefined;
      } else if (xmlDecl.length >= 6) {
        this.state_ = State.DOCUMENT;
        this.chunk_ = undefined;
      }
      // not enough content, retry on next chunk
    } else if (chunk.length >= 6) {
      if (
        chunk[0] === Chars.LT &&
        chunk[1] === Chars.QUESTION &&
        chunk[2] === Chars.LOWER_X &&
        chunk[3] === Chars.LOWER_M &&
        chunk[4] === Chars.LOWER_L &&
        isWhiteSpace(chunk[5]!)
      ) {
        this.state_ = State.ASCII_XML_DECL;
        this.handleAsciiXmlDecl_();
      } else {
        this.setTextDecoder_();
        this.state_ = State.DOCUMENT;
        this.write(chunk);
        this.chunk_ = undefined;
      }
    }
  }
}
