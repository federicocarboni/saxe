import {parseError} from "./error";

export {type SaxError, type SaxErrorCode, isSaxError} from "./error";

export type SaxReader = {
  start(name: string, attributes: Map<string, string>): void;
  empty(name: string, attributes: Map<string, string>): void;
  end(name: string): void;
  text(text: string): void;
  cdata(cdata: string): void;
  entity(entity: string): void;
  xmlDeclaration(
    version: string,
    encoding?: string,
    standalone?: boolean,
  ): void;
  doctype(): void;
};

// These enums are erased at compile time for better size and speed.
const enum Encoding {
  DEFAULT,
  UTF8,
  UTF16LE,
  UTF16BE,
}

const enum State {
  INIT,
  PROLOG,
  XML_DECL,
  XML_DECL_ATTR,
  XML_DECL_ATTR_EQ,
  XML_DECL_VALUE,
  XML_DECL_VALUE_S,
  XML_DECL_VALUE_D,
  XML_DECL_END,
  DOCTYPE_DECL,
}

const enum XmlDeclState {
  INIT,
  VERSION,
  ENCODING,
  STANDALONE,
}

export type Options = {
  // Encoding is not necessary, encodings other than UTF-8 and UTF-16 are not supported.
  // and since the XML specifications require the BOM in UTF-16 files we don't need any
  // hints about the file's encoding.
  // encoding?: "utf-8" | "utf-16le" | "utf-16be";
};

function getEncodingString(encoding: Encoding) {
  switch (encoding) {
    case Encoding.DEFAULT:
    case Encoding.UTF8:
      return "utf-8";
    case Encoding.UTF16LE:
      return "utf-16le";
    case Encoding.UTF16BE:
      return "utf-16be";
  }
}

const TEXT_DECODER_FATAL: TextDecoderOptions = {
  // Cannot ignore decoding errors.
  fatal: true,
  // Don't skip the Byte Order Mark as the parser skips it already.
  ignoreBOM: true,
};

const TEXT_DECODER_REPLACEMENT: TextDecoderOptions = {ignoreBOM: true};

const TEXT_DECODE_STREAM: TextDecodeOptions = {stream: true};

function isWhitespace(c: number) {
  // SP TAB LF CR
  return c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d;
}

function isAsciiDigit(c: number) {
  return 0x30 <= c && c <= 0x39;
}

export class SaxParser {
  /** @internal */
  private _reader: SaxReader;
  // Only UTF-8 and UTF-16 are supported as they are the only ones explicitly
  // required by the XML standard. All other encodings are considered legacy and
  // are not supported by this parser.
  /** @internal */
  private _encoding = Encoding.DEFAULT;
  /** @internal */
  private _rawChunk: Uint8Array | undefined = undefined;
  /** @internal */
  private _rawChunkLen = 0;
  // Index in the current chunk
  /** @internal */
  private _index = 0;
  /** @internal */
  private _chunk = "";
  /** @internal */
  private _content = "";
  /** @internal */
  private _state = State.INIT;
  /** @internal */
  private _xmlDeclState = XmlDeclState.INIT;
  /** @internal */
  private _version: string | undefined = undefined;
  /** @internal */
  private _xmlDeclEncoding: string | undefined = undefined;
  /** @internal */
  private _standalone: boolean | undefined = undefined;
  //
  /** @internal */
  private _xmlDeclAttr = "";
  /** @internal */
  private _xmlDeclValue = "";
  // Default decoder is UTF-8 but non-fatal, meaning it will accept malformed
  // content.
  /** @internal */
  private _textDecoder = new TextDecoder("utf-8", TEXT_DECODER_REPLACEMENT);
  /** @internal */
  private _char = 0;
  // Using a Map because it has more efficient lookups than an object and is
  // guaranteed to retain order of defined values like an array.
  /** @internal */
  private _attributes = new Map<string, string>();

  constructor(reader: SaxReader, options?: Options) {
    this._reader = reader;
  }

  /** @internal */
  encoding() {
    return getEncodingString(this._encoding);
  }
  feed(data: Uint8Array) {
    if (this._state === State.INIT) {
      // Before the data can be decoded, we have to detect the encoding of the
      // file, until the byte order mark or XMLDecl is read the encoding is
      // DEFAULT. Ensure at least 256 bytes are read, buffers smaller than that
      // really don't make sense.
      if (this._rawChunkLen === 0 && data.length > 255) {
        this._rawChunk = data;
        this._rawChunkLen = data.length;
      } else {
        if (this._rawChunk === undefined) this._rawChunk = new Uint8Array(256);
        this._rawChunk.set(data, this._rawChunkLen);
        this._rawChunkLen += data.length;
      }
      // The Byte Order Mark must be read because it's required for UTF-16
      // documents.
      if (this._rawChunkLen > 255) this._init();
      return;
    } else {
      this._decodeChunk(data, TEXT_DECODE_STREAM);
    }
    this._parse();
  }

  eof() {
    if (this._state === State.INIT) {
      this._init();
      this._parse();
    } else this._decodeChunk();
  }

  /** @internal */
  private _advance() {
    // Advance two places if the character is not BMP
    this._index += +(this._char > 0xffff) + 1;
    this._char = this._chunk.codePointAt(this._index)!;
  }

  /** @internal */
  private _decodeChunk(data?: Uint8Array, options?: TextDecodeOptions) {
    try {
      this._chunk = this._textDecoder.decode(data, options);
    } catch {
      // The decoder will usually be in fatal mode, handle the error. `decode`
      // can only fail with a TypeError in fatal mode.
      throw parseError("INVALID_ENCODED_DATA", 0, 0, this.encoding());
    }
    this._index = 0;
    if (this._chunk.length !== 0) this._char = this._chunk.codePointAt(0)!;
  }

  /** @internal */
  private _setEncoding() {
    // Validate and set declared encoding
    if (this._xmlDeclEncoding !== undefined) {
      const encoding = this._xmlDeclEncoding.toLowerCase();
      if (encoding === "utf-8") {
        this._encoding = Encoding.UTF8;
      } else if (
        (this._encoding !== Encoding.DEFAULT &&
          encoding === "utf-16le" &&
          this._encoding !== Encoding.UTF16LE) ||
        (encoding === "utf-16be" && this._encoding !== Encoding.UTF16BE) ||
        (encoding === "utf-16" &&
          this._encoding !== Encoding.UTF16LE &&
          this._encoding !== Encoding.UTF16BE)
      ) {
        throw parseError("INVALID_UTF16_BOM", 0, 0);
      } else {
        // TODO: legacy encodings
        throw parseError("ENCODING_NOT_SUPPORTED", 0, 0, encoding);
      }
    }
    if (this._encoding === Encoding.DEFAULT) this._encoding = Encoding.UTF8;
    this._textDecoder = new TextDecoder(
      getEncodingString(this._encoding),
      TEXT_DECODER_FATAL,
    );
    // Validate first chunk and
    this._decodeRawChunk();
    this._rawChunk = undefined;
    this._rawChunkLen = 0;
  }

  /** @internal */
  private _parse() {
    while (this._index < this._chunk.length)
      switch (this._state) {
        case State.PROLOG:
          // XML Declaration is optional, if the first characters don't match, abort parsing
          // the declaration altogether.
          if (this._chunk.slice(0, 5) === "<?xml") {
            this._state = State.XML_DECL;
            this._index = 4;
            this._advance();
          } else {
            // Default encoding is UTF-8, since the XML Declaration was not specified,
            // encoding MUST be UTF-8.
            this._setEncoding();
            this._textDecoder = new TextDecoder("utf-8", TEXT_DECODER_FATAL);
            // Ensure the first chunk decodes correctly.
            this._decodeRawChunk();
            this._state = State.DOCTYPE_DECL;
          }
          break;
        case State.XML_DECL:
          while (this._index < this._chunk.length) {
            if (this._char === 0x3f /* ? */) {
              this._state = State.XML_DECL_END;
              break;
            } else if (!isWhitespace(this._char)) {
              this._state = State.XML_DECL_ATTR;
              break;
            }
            this._advance();
          }
          break;
        case State.XML_DECL_ATTR: {
          const begin = this._index;
          while (this._index < this._chunk.length) {
            if (this._char === 0x3d /* = */ || isWhitespace(this._char)) {
              this._state = State.XML_DECL_ATTR_EQ;
              break;
            }
            this._advance();
          }
          this._xmlDeclAttr += this._chunk.slice(begin, this._index);
          break;
        }
        case State.XML_DECL_ATTR_EQ:
          while (this._index < this._chunk.length) {
            const b = this._char;
            if (b === 0x3d /* = */) {
              this._state = State.XML_DECL_VALUE;
              this._advance();
              break;
            } else if (!isWhitespace(b)) {
              throw parseError("INVALID_XML_DECL");
            }
            this._advance();
          }
          break;
        case State.XML_DECL_VALUE:
          while (this._index < this._chunk.length) {
            const b = this._char;
            this._advance();
            if (b === 0x27 /* ' */) {
              this._state = State.XML_DECL_VALUE_S;
              break;
            } else if (b === 0x22 /* " */) {
              this._state = State.XML_DECL_VALUE_D;
              break;
            } else if (!isWhitespace(b)) {
              throw parseError("INVALID_XML_DECL");
            }
          }
          break;
        case State.XML_DECL_VALUE_S:
        case State.XML_DECL_VALUE_D: {
          let quote = this._chunk.indexOf(
            this._state === State.XML_DECL_VALUE_S ? "'" : '"',
            this._index,
          );
          if (quote === -1) {
            quote = this._chunk.length;
          } else {
            this._state = State.XML_DECL;
          }
          this._xmlDeclValue += this._chunk.slice(this._index, quote);
          this._index = quote;
          this._advance();
          if (this._state === State.XML_DECL) this._parseXmlDeclAttr();
          break;
        }
        case State.XML_DECL_END:
          this._advance();
          if (this._char !== 0x3e /* > */)
            throw parseError("UNTERMINATED_XML_DECL");
          this._state = State.DOCTYPE_DECL;
          this._setEncoding();
          break;
        case State.DOCTYPE_DECL:
          return;
        default:
      }
  }

  /** @internal */
  private _parseXmlDeclAttr() {
    switch (this._xmlDeclAttr) {
      case "version":
        if (
          this._xmlDeclState !== XmlDeclState.INIT ||
          this._xmlDeclValue.length !== 3 ||
          this._xmlDeclValue.slice(0, 2) !== "1." ||
          !isAsciiDigit(this._xmlDeclValue.charCodeAt(2))
        )
          throw parseError("INVALID_XML_DECL");
        this._version = this._xmlDeclValue;
        this._xmlDeclState = XmlDeclState.VERSION;
        break;
      case "encoding":
        if (this._xmlDeclState !== XmlDeclState.VERSION)
          throw parseError("INVALID_XML_DECL");
        this._xmlDeclEncoding = this._xmlDeclValue;
        this._xmlDeclState = XmlDeclState.ENCODING;
        break;
      case "standalone":
        if (
          (this._xmlDeclState !== XmlDeclState.VERSION &&
            this._xmlDeclState !== XmlDeclState.ENCODING) ||
          (this._xmlDeclValue !== "yes" && this._xmlDeclValue !== "no")
        )
          throw parseError("INVALID_XML_DECL");
        this._standalone = this._xmlDeclValue === "yes";
        this._xmlDeclState = XmlDeclState.STANDALONE;
        break;
      default:
        throw parseError("INVALID_XML_DECL");
    }
    this._xmlDeclAttr = "";
    this._xmlDeclValue = "";
  }

  /** @internal */
  private _decodeRawChunk() {
    this._chunk = this._textDecoder.decode(
      this._rawChunk!.subarray(this._index, this._rawChunkLen),
      TEXT_DECODE_STREAM,
    );
  }

  /** @internal */
  private _init() {
    // Read the Byte Order Mark, if specified it must be correct.
    const b0 = this._rawChunk![0];
    const b1 = this._rawChunk![1];
    const b2 = this._rawChunk![2];
    if (b0 === 0xff && b1 === 0xfe) {
      this._index = 2;
      this._encoding = Encoding.UTF16LE;
    } else if (b0 == 0xfe && b1 === 0xff) {
      this._index = 2;
      this._encoding = Encoding.UTF16BE;
    } else if (b0 === 0xef && b1 === 0xbb && b2 === 0xbf) {
      this._index = 3;
      this._encoding = Encoding.UTF8;
    }
    if (this._encoding !== Encoding.DEFAULT)
      this._textDecoder = new TextDecoder(
        getEncodingString(this._encoding),
        TEXT_DECODER_FATAL,
      );
    // Default value is UTF-8 but XML Declaration may change it to any other
    // 8-bit encoding, so we are technically still not sure it's UTF-8.
    this._state = State.PROLOG;
    this._decodeRawChunk();
    this._index = 0;
    // Assert: _chunk is at least 256 bytes long
    this._char = this._chunk.codePointAt(0)!;
  }

  // For debugging
  /** @internal */
  toString() {
    return `Parser {
  reader = ${this._reader};
  version = ${this._version};
  encoding = "${
    {
      [Encoding.DEFAULT]: undefined,
      [Encoding.UTF8]: "utf-8",
      [Encoding.UTF16LE]: "utf-16le",
      [Encoding.UTF16BE]: "utf-16be",
    }[this._encoding]
  }";
  }`;
  }
}
