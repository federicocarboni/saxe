/** */
// This file requires the TextDecoder DOM API, Web, Node.js, Deno, Cloudflare
// Worker runtime support it.
/// <reference lib="dom" />

import {Chars, isWhitespace} from "./chars.ts";
import {createSaxError} from "./error.ts";
import {SaxParser} from "./index.ts";

const S = "[\t\n\r ]";
const ENC_NAME = "[A-Za-z][A-Za-z0-9._-]*";
const ENCODING_DECL_RE = /* @__PURE__ */ new RegExp(
  `${S}+encoding${S}*=${S}*("(${ENC_NAME})"|'(${ENC_NAME})')`,
);

export class SaxDecoder {
  // @internal
  private textDecoder_: TextDecoder | undefined = undefined;
  // @internal
  private firstChunk_: Uint8Array | undefined = undefined;
  constructor(public parser: SaxParser) {
  }
  write(input: Uint8Array) {
    if (this.textDecoder_ === undefined) {
      if (this.firstChunk_ === undefined) {
        this.firstChunk_ = input;
      } else {
        const oldChunk = this.firstChunk_;
        this.firstChunk_ = new Uint8Array(oldChunk.length + input.length);
        this.firstChunk_.set(oldChunk);
        this.firstChunk_.set(input, oldChunk.length);
      }
      this.detectEncoding_();
    } else {
      this.handleChunk_(input, {stream: true});
    }
  }
  end() {
    if (this.textDecoder_ === undefined) {
      this.setTextDecoder_();
    }
    // decode pending characters on the stream
    this.handleChunk_();
    this.parser.end();
  }
  // @internal
  private handleChunk_(input?: Uint8Array, options?: TextDecodeOptions) {
    try {
      return this.parser.write(this.textDecoder_!.decode(input, options));
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
        fatal: true,
        ignoreBOM: true,
      });
    } catch {
      throw createSaxError("ENCODING_NOT_SUPPORTED", {encoding: encoding!});
    }
  }
  // This function does no validation, it assumes the XML declaration (if
  // present) is valid and encoding is also valid.
  // chunk should be at least 4 bytes long
  // @internal
  private detectEncoding_() {
    // https://www.w3.org/TR/2008/REC-xml-20081126/#sec-guessing
    let encoding: string | undefined;
    let start = 0;
    const b0 = this.firstChunk_![0]!;
    const b1 = this.firstChunk_![1]!;
    const b2 = this.firstChunk_![2]!;
    const b3 = this.firstChunk_![3]!;
    if (b0 === 0xEF && b1 === 0xBB && b2 === 0xBF) {
      // UTF-8 BOM
      start = 3;
      encoding = "utf-8";
    } else if (b0 === 0xFF && b1 === 0xFE && (b2 | b3) !== 0x00) {
      // UTF-16 BOM little-endian (byte 2 and 3 must not be zero to avoid UTF-32)
      start = 2;
      encoding = "utf-16le";
    } else if (b0 === 0xFE && b1 === 0xFF) {
      // UTF-16 BOM big-endian
      start = 2;
      encoding = "utf-16be";
    }
    // No BOM, check if it has an XMLDecl or TextDecl "<?xml "
    if (
      this.firstChunk_![0] === Chars.LT &&
      this.firstChunk_![1] === Chars.QUESTION &&
      this.firstChunk_![2] === Chars.LOWER_X &&
      this.firstChunk_![3] === Chars.LOWER_M &&
      this.firstChunk_![4] === Chars.LOWER_L &&
      isWhitespace(this.firstChunk_![5]!)
    ) {
      // Ensure the XMLDecl has ended before parsing the encoding part
      const question = this.firstChunk_!.indexOf(Chars.QUESTION, 6);
      if (question === -1) {
        return;
      }
      // Crude but compact way to check the encoding declaration
      const xmlDecl = String.fromCharCode(
        ...this.firstChunk_!.subarray(5, question),
      );
      const match = xmlDecl.match(ENCODING_DECL_RE);
      if (match !== null && match.index! < question) {
        // If a file has both BOM and encoding declaration make sure the values
        // match, but only after resolving possible aliases.
        // TextDecoder does it for us.
        this.setTextDecoder_(match[2]!);
        // The encoding property in TextDecoder contains the canonical name for
        // each encoding.
        if (
          encoding !== undefined && this.textDecoder_!.encoding !== encoding
        ) {
          // BOM does not match declared encoding.
          // It is a fatal error for an entity including an encoding declaration
          // to be presented to the XML processor in an encoding other than that
          // named in the declaration.
          throw createSaxError("ENCODING_INVALID_DATA", {encoding});
        }
      }
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
    if (this.textDecoder_ === undefined) {
      this.setTextDecoder_(encoding);
    }
    this.firstChunk_ = this.firstChunk_!.subarray(start);
    this.handleChunk_(this.firstChunk_, {stream: true});
    this.firstChunk_ = undefined;
  }
}
