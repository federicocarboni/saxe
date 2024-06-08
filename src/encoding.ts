/** */
// This file requires the TextDecoder DOM API, Web, Node.js, Deno and the
// Cloudflare Worker runtime support it.
/// <reference lib="dom" />

import {Chars, isWhiteSpace} from "./chars.ts";
import {createSaxError} from "./error.ts";
import {SaxParser} from "./index.ts";
import {parseXmlDecl} from "./xml_decl.ts";

// const enum State {
//   BOM,
//   XML_DECL,
//   DOCUMENT,
// }

export class SaxDecoder {
  // @internal
  private textDecoder_: TextDecoder | undefined = undefined;
  // @internal
  private encodingDetected_ = false;
  // BOM (max 3 bytes) + "<?xml " (max 12 bytes)
  // @internal
  private chunk_: Uint8Array | undefined = undefined;
  // @internal
  private xmlDecl_: string | undefined = undefined;
  // @internal
  private isXmlDeclEnd_ = false;
  // @internal
  private readonly parser_: SaxParser;
  constructor(parser: SaxParser) {
    this.parser_ = parser;
  }
  get encoding() {
    return this.encodingDetected_ ? this.textDecoder_!.encoding : undefined;
  }
  /**
   * @param input
   * @throws {import("./error.ts").SaxError}
   */
  write(input: Uint8Array) {
    if (this.encodingDetected_) {
      this.parser_.write(this.decodeChunk_(input, {stream: true}));
    } else if (input.length === 0) {
      // empty input, ignored
    } else if (this.textDecoder_ === undefined) {
      if (this.chunk_ !== undefined) {
        // In the unlikely case the first chunk is less than 16 bytes long
        const chunk = this.chunk_;
        this.chunk_ = new Uint8Array(chunk.length + input.length);
        this.chunk_.set(chunk);
        this.chunk_.set(input, chunk.length);
      } else {
        this.chunk_ = input;
      }
      if (this.chunk_.length > 15) {
        this.detectEncoding_();
      }
    } else if (this.xmlDecl_ !== undefined) {
      this.handleXmlDecl_(input, 0);
    }
  }
  end() {
    if (!this.encodingDetected_) {
      this.setTextDecoder_();
    }
    // decode pending characters on the stream
    this.parser_.write(this.decodeChunk_());
    this.parser_.end();
  }
  // @internal
  private handleXmlDecl_(input: Uint8Array, offset: number) {
    // Decode a single character (> or error) when the ? has already been seen
    const question = this.isXmlDeclEnd_
      ? 1
      : input.indexOf(Chars.QUESTION, offset);
    this.xmlDecl_ += this.decodeChunk_(
      input.subarray(0, question === -1 ? input.length : question + 2),
      {stream: true},
    );
    if (question !== -1) {
      if (this.isXmlDeclEnd_ || question !== input.length - 1) {
        const {encoding} = parseXmlDecl(this.xmlDecl_!, false);
        this.setTextDecoder_(encoding);
        this.parser_.write(this.xmlDecl_!);
        this.xmlDecl_ = undefined;
        this.parser_.write(this.decodeChunk_(input.subarray(question + 2)));
      }
      this.isXmlDeclEnd_ = true;
    }
  }
  // @internal
  private decodeChunk_(input?: Uint8Array, options?: TextDecodeOptions) {
    try {
      return this.textDecoder_!.decode(input, options);
    } catch {
      throw createSaxError("ENCODING_INVALID_DATA", {
        encoding: this.textDecoder_!.encoding,
      });
    }
  }
  // @internal
  private setTextDecoder_(encoding?: string) {
    try {
      this.textDecoder_ = new TextDecoder(encoding, {
        // It is a fatal error if an XML entity is determined (via default,
        // encoding declaration, or higher-level protocol) to be in a certain
        // encoding but contains byte sequences that are not legal in that
        // encoding.
        fatal: true,
        // BOM is handled below.
        ignoreBOM: true,
      });
    } catch {
      throw createSaxError("ENCODING_NOT_SUPPORTED", {encoding: encoding!});
    }
    this.encodingDetected_ = true;
  }
  // This function does no validation, it assumes the XML declaration (if
  // present) is valid and encoding is also valid.
  // chunk should be at least 4 bytes long
  // @internal
  private detectEncoding_() {
    // https://www.w3.org/TR/2008/REC-xml-20081126/#sec-guessing
    let encoding: string | undefined;
    let start = 0;
    let chunk = this.chunk_!;
    // Ensure chunk can be garbage collected
    this.chunk_ = undefined;
    const b0 = chunk[0]!;
    const b1 = chunk[1]!;
    const b2 = chunk[2]!;
    const b3 = chunk[3]!;
    if (b0 === 0xEF && b1 === 0xBB && b2 === 0xBF) {
      // UTF-8 BOM
      start = 3;
      encoding = "utf-8";
    } else if (b0 === 0xFF && b1 === 0xFE && (b2 | b3) !== 0x00) {
      // UTF-16 BOM little-endian (byte 2 and 3 must not be zero to avoid
      // UTF-32) even if it were a UTF-16 file, NUL characters are not allowed
      // in XML.
      start = 2;
      encoding = "utf-16le";
    } else if (b0 === 0xFE && b1 === 0xFF) {
      // UTF-16 BOM big-endian
      start = 2;
      encoding = "utf-16be";
    } else if (
      // UTF-32 BOM
      (b0 | b1) === 0x00 && b2 === 0xFE && b3 === 0xFF ||
      b0 === 0xFF && b1 === 0xFE && (b2 | b3) === 0x00 ||
      // UTF-32 < character (NUL characters are not allowed in XML so it won't
      // change behavior)
      (b0 | b1 | b2) === 0x00 && b3 === Chars.LT ||
      b0 === Chars.LT && (b1 | b2 | b3) === 0x00
    ) {
      // Late check for UTF-32; it is not supported by the encoding standard so
      // TextDecoder is not able to handle it and decoding it is out of the
      // scope of this library so the following is only for nicer error reports.
      // The standard name is UTF-32 not UCS-4 or ISO-10646-UCS-4
      // TextDecoder will throw a range error on UTF-32
      encoding = "utf-32";
    }
    chunk = chunk.subarray(start);
    if (
      chunk[0] === Chars.LT && chunk[1] === Chars.QUESTION &&
      chunk[2] === Chars.LOWER_X && chunk[3] === Chars.LOWER_M &&
      chunk[4] === Chars.LOWER_L && isWhiteSpace(chunk[5]!)
    ) {
      // UTF-8 decoder
      this.textDecoder_ = new TextDecoder(undefined, {
        ignoreBOM: true,
      });
      this.xmlDecl_ = "";
      this.handleXmlDecl_(chunk, 2);
      return;
    } else {
      if (this.textDecoder_ === undefined) {
        this.setTextDecoder_(encoding);
      }
      this.parser_.write(this.decodeChunk_(chunk, {stream: true}));
    }
  }
}
