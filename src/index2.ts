import {SaxError} from "./error";

export {isSaxError, type SaxError, type SaxErrorCode} from "./error";

export interface XmlDeclaration {
  version: string;
  encoding?: string | undefined;
  standalone?: boolean | undefined;
}

export interface Doctype {
  name: string;
  publicId?: string | undefined;
  systemId?: string | undefined;
}

export interface Pi {
  target: string;
  content: string;
}

export interface Attributes {
  has(key: string): boolean;
  get(key: string): string | undefined;
  entries(): IterableIterator<[string, string]>;
  keys(): IterableIterator<string>;
  values(): IterableIterator<string>;
}

export interface SaxReader {
  xml?(decl: XmlDeclaration): void;
  /**
   * To improve performance, if processing instructions are not required do not
   * define this handler.
   * @param doctype
   */
  doctype?(doctype: Doctype): void;
  /**
   * Resolve an entity by name.
   * @param entity
   */
  resolveEntity?(entity: string): string | undefined;
  /**
   * A processing instruction `<?target content?>`. To improve performance, if
   * processing instructions are not required do not define this handler.
   * @param pi
   */
  pi?(pi: Pi): void;
  /**
   * A comment `<!-- text -->`. To improve performance, if comments are not
   * required do not define this handler.
   */
  comment?(text: string): void;
  /**
   * Start tag `<element attr="value">`.
   * @param name
   * @param attributes
   */
  start(name: string, attributes: Attributes): void;
  /**
   * An empty element `<element attr="value" />`.
   * @param name
   * @param attributes
   */
  empty(name: string, attributes: Attributes): void;
  /**
   * An end tag `</element>`.
   * @param name
   */
  end(name: string): void;
  /**
   * Text content of an element, `<element>text &amp; content</element>`
   * would produce text `"text & content"`.
   * @param text - Unescaped text content of the last start element.
   */
  text(text: string): void;
}

const DEFAULT_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  apos: "'",
  quot: '"',
} as const;

// These enums are erased at compile time for better size and speed.
const enum Encoding {
  UTF8 = "utf-8",
  UTF16LE = "utf-16le",
  UTF16BE = "utf-16be",
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
  DOCTYPE_NAME_S,
  DOCTYPE_NAME,
  DOCTYPE_EXTERNAL_ID,
  DOCTYPE_SYSTEM_ID,
  DOCTYPE_SYSTEM_ID_S,
  DOCTYPE_SYSTEM_ID_D,
  DOCTYPE_PUBLIC_ID,
  DOCTYPE_MAYBE_DTD,
  DOCTYPE_DTD,
  DOCTYPE_DTD_END,
  MISC,
  COMMENT,
  COMMENT_END,
  PI,
  START_TAG,
}

const enum Decls {
  INIT = 0,
  XML_VERSION = 1 << 0,
  XML_ENCODING = 1 << 1,
  XML_STANDALONE = 1 << 2,
  XML = Decls.XML_VERSION | Decls.XML_ENCODING | Decls.XML_STANDALONE,
  DOCTYPE = 1 << 3,
  DOCTYPE_PUBLIC_ID = 1 << 4,
  DOCTYPE_DTD = 1 << 5,
}

const enum CaptureFlag {
  NONE = 0,
  DOCTYPE = 1 << 0,
  COMMENT = 1 << 1,
  PI = 1 << 2,
}

export type SaxOptions = {
  // Encoding is not necessary, encodings other than UTF-8 and UTF-16 are not supported.
  // and since the XML specifications require the BOM in UTF-16 files we don't need any
  // hints about the file's encoding.
  encoding?: string | undefined;
};

const TEXT_DECODER_FATAL: TextDecoderOptions = {
  // Cannot ignore decoding errors.
  fatal: true,
  // Don't skip the Byte Order Mark as the parser handles it.
  ignoreBOM: true,
};

const TEXT_DECODER_REPLACEMENT: TextDecoderOptions = {ignoreBOM: true};

const TEXT_DECODE_STREAM: TextDecodeOptions = {stream: true};

// https://www.w3.org/TR/REC-xml/#NT-S
// § White Space
function isWhitespace(c: number) {
  return c === 0x20 /* SP */ || c === 0x09 /* TAB */ || c === 0x0A /* LF */ || c === 0x0D /* CR */;
}

function isAsciiDigit(c: number) {
  return 0x30 <= c && c <= 0x39;
}

function isAsciiHexAlpha(c: number) {
  return (
    0x61 /* a */ <= c && c <= 0x66 /* f */ ||
    0x41 /* A */ <= c && c <= 0x46 /* F */
  );
}

function isAlpha(c: number) {
  return (
    0x61 /* a */ <= c && c <= 0x7a /* z */ ||
    0x41 /* A */ <= c && c <= 0x5a /* Z */
  );
}

function isEncodingName(value: string) {
  if (!isAlpha(value.charCodeAt(0))) return false;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (
      !isAlpha(c) &&
      !isAsciiDigit(c) &&
      c !== 0x2e && /* . */
      c !== 0x5f && /* _ */
      c !== 0x2d /* - */
    ) {
      return false;
    }
  }
  return true;
}

function parseDec(dec: string): number | undefined {
  let n = 0;
  const length = dec.length;
  for (let i = 0; i < length; i++) {
    const digit = (dec.charCodeAt(i) - 0x30) >>> 0;
    if (digit > 9) return undefined;
    n = (n << 3) + (n << 1) + digit;
  }
  return n;
}

function parseHex(dec: string): number | undefined {
  let n = 0;
  const length = dec.length;
  for (let i = 0; i < length; i++) {
    const c = dec.charCodeAt(i);
    let digit;
    if (isAsciiDigit(c)) {
      digit = c - 0x30;
    } else if (isAsciiHexAlpha(c)) {
      digit = (c | 0x20) - 0x57;
    } else {
      return undefined;
    }
    n = (n << 4) | digit;
  }
  return n;
}

// https://www.w3.org/TR/REC-xml/#NT-Char
// § Character Range
function isChar(c: number) {
  return (
    c === 0x9 ||
    c === 0xa ||
    c === 0xd ||
    (0x20 <= c && c <= 0xD7FF) ||
    (0xE000 <= c && c <= 0xFFFD) ||
    (0x10000 <= c && c <= 0x10FFFF)
  );
}

// https://www.w3.org/TR/REC-xml/#NT-NameStartChar
function isNameStartChar(c: number) {
  return isAlpha(c) || c === 0x3a /* : */ || c === 0x5f /* _ */ ||
    0xC0 <= c && c <= 0xD6 ||
    0xD8 <= c && c <= 0xF6 || 0xF8 <= c && c <= 0x2FF ||
    0x370 <= c && c <= 0x37D || 0x37F <= c && c <= 0x1FFF ||
    0x200C <= c && c <= 0x200D || 0x2070 <= c && c <= 0x218F ||
    0x2C00 <= c && c <= 0x2FEF || 0x3001 <= c && c <= 0xD7FF ||
    0xF900 <= c && c <= 0xFDCF || 0xFDF0 <= c && c <= 0xFFFD ||
    0x10000 <= c && c <= 0xEFFFF;
}

// https://www.w3.org/TR/REC-xml/#NT-NameChar
function isNameChar(c: number) {
  return isNameStartChar(c) || c === 0x2D /* - */ || c === 0x2E /* . */ ||
    isAsciiDigit(c) || c === 0xB7 || 0x0300 <= c && c <= 0x036F ||
    0x203F <= c && c <= 0x2040;
}

/** */
export class SaxParser {
  /** @internal */
  private _reader: SaxReader;
  /** @internal */
  private _capture = CaptureFlag.NONE;
  // Accumulator for the very first bytes of the XML Document.
  /** @internal */
  private _rawChunk: Uint8Array | undefined = undefined;
  /** @internal */
  private _rawChunkLen = 0;
  /** @internal */
  private _excess: Uint8Array | undefined = undefined;
  /** @internal */
  private _encoding: string | undefined = undefined;
  // Default decoder is UTF-8 but non-fatal, meaning it should accept non UTF-8
  // encodings (by producing garbage on invalid data).
  /** @internal */
  private _textDecoder = new TextDecoder("utf-8", TEXT_DECODER_REPLACEMENT);
  /** @internal */
  private _char = 0;
  // Index in the current chunk
  /** @internal */
  private _index = 0;
  // Accumulator for the decoded string contents of the XML Document.
  /** @internal */
  private _chunk = "";
  // Decoded and unescaped text content
  /** @internal */
  private _content = "";
  /** @internal */
  private _state = State.INIT;
  // XMLDecl and DOCTYPE state, this is a bitflag.
  /** @internal */
  private _decls = Decls.INIT;
  /** @internal */
  private _version: string | undefined = undefined;
  /** @internal */
  private _xmlDeclEncoding: string | undefined = undefined;
  /** @internal */
  private _standalone: boolean | undefined = undefined;
  /** @internal */
  private _element = "";
  /** @internal */
  private _attribute = "";
  /** @internal */
  private _value = "";
  // Using a Map because it has more efficient lookups than an object and is
  // guaranteed to retain order of defined values like an array.
  /** @internal */
  private _attributes = new Map<string, string>();
  /** @internal */
  private _stack: string[] = [];

  constructor(reader: SaxReader, options?: SaxOptions) {
    this._reader = reader;
    // Avoid capturing information that will be ignored, (except for the DOCTYPE, they will still be validated).
    if (this._reader.doctype != null) this._capture |= CaptureFlag.DOCTYPE;
    if (this._reader.comment != null) this._capture |= CaptureFlag.COMMENT;
    if (this._reader.pi != null) this._capture |= CaptureFlag.PI;
  }

  write(data: Uint8Array) {
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
        const offset = this._rawChunkLen;
        this._rawChunk.set(data, offset);
        this._rawChunkLen += data.length;
        if (this._rawChunkLen > this._rawChunk.length) {
          this._excess = data.subarray(this._rawChunk.length - offset);
          this._rawChunkLen = this._rawChunk.length;
        }
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
    } else {
      this._decodeChunk();
    }
  }

  /** @internal */
  private _advance() {
    // Advance two places if the character is represented as a surrogate pair.
    this._index += +(this._char > 0xffff) + 1;
    this._char = this._chunk.codePointAt(this._index)!;
  }

  /** @internal */
  private _decodeChunk(data?: Uint8Array, options?: TextDecodeOptions) {
    if (this._index >= this._chunk.length) {
      this._chunk = "";
      this._index = 0;
    }
    try {
      this._chunk += this._textDecoder.decode(data, options);
    } catch {
      // The decoder will usually be in fatal mode, handle the error. `decode`
      // can only fail with a TypeError in fatal mode.
      throw SaxError("INVALID_ENCODED_DATA", this._encoding!);
    }
    if (this._chunk.length !== 0) {
      this._char = this._chunk.codePointAt(this._index)!;
    }
  }

  /** @internal */
  private _setEncoding() {
    // Validate and set declared encoding
    if (this._xmlDeclEncoding !== undefined) {
      const encoding = this._xmlDeclEncoding;
      if (encoding === "utf-8") {
        this._encoding = Encoding.UTF8;
      } else if (
        this._encoding !== undefined &&
        ((encoding === "utf-16le" && this._encoding !== Encoding.UTF16LE) ||
          (encoding === "utf-16be" && this._encoding !== Encoding.UTF16BE) ||
          (encoding === "utf-16" &&
            this._encoding !== Encoding.UTF16LE &&
            this._encoding !== Encoding.UTF16BE))
      ) {
        // TODO: this is too strict
        throw SaxError("INVALID_UTF16_BOM");
      } else {
        // TODO: legacy encodings
        throw SaxError("ENCODING_NOT_SUPPORTED", encoding);
      }
    }
    // Encoding is set by default.
    if (this._encoding === undefined) this._encoding = Encoding.UTF8;
    this._textDecoder = new TextDecoder(this._encoding, TEXT_DECODER_FATAL);
    // Validate first chunk and clean it up
    this._decodeRawChunk();
    this._rawChunk = undefined;
    this._rawChunkLen = 0;
  }

  /** @internal */
  private _parse() {
    while (this._index < this._chunk.length) {
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
          // Too long, unknown XMLDecl attribute
          if (this._attribute.length + (this._index - begin) > 10) {
            throw SaxError("INVALID_XML_DECL");
          }
          this._attribute += this._chunk.slice(begin, this._index);
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
              throw SaxError("INVALID_XML_DECL");
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
              throw SaxError("INVALID_XML_DECL");
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
          this._value += this._chunk.slice(this._index, quote);
          this._index = quote;
          this._advance();
          if (this._state === State.XML_DECL) this._parseXmlDeclAttr();
          break;
        }
        case State.XML_DECL_END:
          this._advance();
          if (
            this._char !== 0x3e /* > */ ||
            // version is required
            (this._decls & Decls.XML_VERSION) === 0
          ) {
            throw SaxError("INVALID_XML_DECL");
          }
          this._setEncoding();
          this._state = State.DOCTYPE_DECL;
          this._reader.xml?.({
            version: this._version!,
            encoding: this._xmlDeclEncoding,
            standalone: this._standalone,
          });
          break;
        case State.MISC:
        case State.DOCTYPE_DECL:
          if (!this._skipWhitespace() || this._chunk.length - this._index < 9) return;
          if (
            this._state === State.DOCTYPE_DECL &&
            this._chunk.slice(this._index, this._index + 9) === "<!DOCTYPE"
          ) {
            this._index += 8;
            this._advance();
            this._state = State.DOCTYPE_NAME_S;
          } else if (
            this._chunk.slice(this._index, this._index + 4) === "<!--"
          ) {
            this._index += 3;
            this._advance();
            this._state = State.COMMENT;
          } else if (this._chunk.slice(this._index, this._index + 2) === "<?") {
            this._index += 1;
            this._advance();
            this._state = State.PI;
          } else if (this._state === State.MISC) {
            if (this._char !== 0x3C /* < */) {
              throw SaxError("INVALID_START_TAG");
            }
            this._advance();
            this._state = State.START_TAG;
          } else {
            throw SaxError("INVALID_DOCTYPE");
          }
          break;
        case State.DOCTYPE_NAME_S:
          while (this._index < this._chunk.length) {
            const c = this._char;
            this._advance();
            if (isNameStartChar(c)) {
              this._state = State.DOCTYPE_NAME;
              break;
            } else if (!isWhitespace(c)) {
              throw SaxError("INVALID_DOCTYPE");
            }
          }
          break;
        case State.DOCTYPE_NAME: {
          const begin = this._index;
          while (this._index < this._chunk.length) {
            if (isWhitespace(this._char)) {
              this._state = State.DOCTYPE_EXTERNAL_ID;
              break;
            } else if (!isNameChar(this._char)) {
              throw SaxError("INVALID_DOCTYPE");
            }
            this._advance();
          }
          if (this._capture & CaptureFlag.DOCTYPE) {
            this._element += this._chunk.slice(begin, this._index);
          }
          break;
        }
        case State.DOCTYPE_EXTERNAL_ID:
          while (this._index < this._chunk.length) {
            if (!isWhitespace(this._char)) break;
            this._advance();
          }
          if (this._chunk.length - this._index < 7) return;
          if (
            this._chunk.slice(this._index, this._index + 6) === "SYSTEM" &&
            isWhitespace(this._chunk.charCodeAt(this._index + 6))
          ) {
            this._index += 6;
            this._advance();
            this._state = State.DOCTYPE_SYSTEM_ID;
          } else if (
            this._chunk.slice(this._index, this._index + 6) === "PUBLIC" &&
            isWhitespace(this._chunk.charCodeAt(this._index + 6))
          ) {
            this._index += 6;
            this._advance();
            this._state = State.DOCTYPE_PUBLIC_ID;
            this._decls |= Decls.DOCTYPE_PUBLIC_ID;
          } else if (this._char === 0x5B /* [ */) {
            this._advance();
            this._state = State.DOCTYPE_DTD;
            this._decls |= Decls.DOCTYPE_DTD;
          } else {
            throw SaxError("INVALID_DOCTYPE");
          }
          break;
        case State.DOCTYPE_SYSTEM_ID:
          if (!this._skipWhitespace()) return;
          if (this._char === 0x27 /* " */) {
            this._state = State.DOCTYPE_SYSTEM_ID_D;
          } else if (this._char === 0x22 /* ' */) {
            this._state = State.DOCTYPE_SYSTEM_ID_S;
          } else {
            throw SaxError("INVALID_DOCTYPE");
          }
          this._advance();
          break;
        case State.DOCTYPE_SYSTEM_ID_D:
        case State.DOCTYPE_SYSTEM_ID_S: {
          const systemId = this._readQuoted(
            this._state === State.DOCTYPE_SYSTEM_ID_S,
            State.DOCTYPE_MAYBE_DTD,
          );
          if (this._capture & CaptureFlag.DOCTYPE) {
            this._attribute += systemId;
          }
          break;
        }
        case State.DOCTYPE_MAYBE_DTD:
          if (!this._skipWhitespace()) return;
          if (this._char === 0x5B /* [ */) {
            this._advance();
            this._state = State.DOCTYPE_DTD;
            this._decls |= Decls.DOCTYPE_DTD;
          } else if (this._char === 0x3E /* > */) {
            this._advance();
            this._state = State.MISC;
          } else {
            throw SaxError("INVALID_DOCTYPE");
          }
          break;
        case State.DOCTYPE_DTD: {
          let index = this._chunk.indexOf("]");
          if (index === -1) {
            this._state = State.DOCTYPE_DTD_END;
            index = this._chunk.length;
          }
          this._content += this._chunk.slice(0, index);
          this._index = index;
          this._advance();
          break;
        }
        case State.DOCTYPE_DTD_END:
          if (!this._skipWhitespace()) return;
          if (this._char !== 0x3E /* > */) {
            throw SaxError("INVALID_DOCTYPE");
          }
          this._advance();
          this._state = State.MISC;
          this._decls |= Decls.DOCTYPE;
          this._attribute = "";
          this._value = "";
          this._content = "";
          break;
        case State.MISC:
      }
    }
  }

  private _handleDoctype() {
    if ((this._capture & CaptureFlag.DOCTYPE) === 0) return;
  }

  /** @internal */
  private _skipWhitespace() {
    while (this._index < this._chunk.length) {
      if (!isWhitespace(this._char)) return true;
      this._advance();
    }
    return false;
  }

  /** @internal */
  private _readQuoted(single: boolean, nextState: State) {
    let quote = this._chunk.indexOf(
      single ? "'" : '"',
      this._index,
    );
    if (quote === -1) {
      quote = this._chunk.length;
    } else {
      this._state = nextState;
    }
    const chunk = this._chunk.slice(this._index, quote);
    this._index = quote;
    this._advance();
    return chunk;
  }

  /** @internal */
  private _parseXmlDeclAttr() {
    switch (this._attribute) {
      case "version":
        if (
          (this._decls & Decls.XML) !== Decls.INIT ||
          this._value.length !== 3 ||
          this._value.slice(0, 2) !== "1." ||
          !isAsciiDigit(this._value.charCodeAt(2))
        ) {
          throw SaxError("INVALID_XML_DECL");
        }
        this._version = this._value;
        this._decls |= Decls.XML_VERSION;
        break;
      case "encoding":
        if (
          (this._decls & Decls.XML) === Decls.XML_VERSION ||
          !isEncodingName(this._value)
        ) {
          throw SaxError("INVALID_XML_DECL");
        }
        this._xmlDeclEncoding = this._value.toLowerCase();
        this._decls |= Decls.XML_ENCODING;
        break;
      case "standalone":
        if (
          (this._decls & Decls.XML_VERSION) === 0 ||
          (this._decls & Decls.XML_STANDALONE) !== 0 ||
          (this._value !== "yes" && this._value !== "no")
        ) {
          throw SaxError("INVALID_XML_DECL");
        }
        this._standalone = this._value === "yes";
        this._decls |= Decls.XML_STANDALONE;
        break;
      default:
        throw SaxError("INVALID_XML_DECL");
    }
    this._attribute = "";
    this._value = "";
  }

  /** @internal */
  private _decodeRawChunk() {
    this._chunk = this._textDecoder.decode(
      this._rawChunk!.subarray(this._index, this._rawChunkLen),
      TEXT_DECODE_STREAM,
    );
    if (this._excess !== undefined) {
      this._chunk += this._textDecoder.decode(this._excess, TEXT_DECODE_STREAM);
    }
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
    if (this._encoding !== undefined) {
      this._textDecoder = new TextDecoder(this._encoding, TEXT_DECODER_FATAL);
    }
    // Default value is UTF-8 but XML Declaration may change it to any other
    // 8-bit encoding, so we are technically still not sure it's UTF-8.
    this._state = State.PROLOG;
    this._decodeRawChunk();
    this._index = 0;
    // Assert: _chunk is at least 256 bytes long
    this._char = this._chunk.codePointAt(0)!;
  }
}
