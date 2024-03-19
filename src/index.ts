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

const TEXT_DECODE_STREAM: TextDecodeOptions = {
  stream: true,
};

function isWhitespace(c: number) {
  // SP TAB LF CR
  return c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d;
}

function equals10(
  a: Uint8Array,
  b0: number,
  b1: number,
  b2: number,
  b3: number,
  b4: number,
  b5: number,
  b6: number,
  b7: number,
  b8: number,
  b9: number,
) {
  return (
    a[0] === b0 &&
    a[1] === b1 &&
    a[2] === b2 &&
    a[3] === b3 &&
    a[4] === b4 &&
    a[5] === b5 &&
    a[6] === b6 &&
    a[7] === b7 &&
    a[8] === b8 &&
    a[9] === b9
  );
}

export class SaxParser {
  private _reader: SaxReader;
  // Only UTF-8 and UTF-16 are supported as they are the only ones explicitly
  // required by the XML standard. All other encodings are considered legacy and
  // are not supported by this parser.
  private _encoding = Encoding.DEFAULT;
  private _rawChunk: Uint8Array | undefined = undefined;
  private _rawChunkLen = 0;
  // Index in the current chunk
  private _index = 0;
  private _chunk = "";
  private _content = "";
  private _state = State.INIT;
  private _version = "1.0";
  private _xmlDeclEncoding = "utf-8";
  private _xmlDeclStandalone = false;
  //
  private _xmlDeclAttr = "";
  private _xmlDeclValue = "";
  // Default decoder is UTF-8 but non-fatal, meaning it will accept malformed
  // content.
  private _textDecoder = new TextDecoder("utf-8", TEXT_DECODER_REPLACEMENT);
  private _char = 0;
  // Using a Map because it has more efficient lookups than an object and is
  // guaranteed to retain order of defined values like an array.
  private _attributes = new Map<string, string>();

  constructor(reader: SaxReader, options?: Options) {
    this._reader = reader;
    // TODO: should it toLowerCase()?
    // this.encoding_ = toEncoding(options?.encoding);
  }

  // get encoding() {
  //   return getEncodingString(this._encoding);
  // }

  private _handleRawChunk(data: Uint8Array) {}

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
        this._rawChunk!.set(data, this._rawChunkLen);
        this._rawChunkLen += data.length;
      }
      // The Byte Order Mark must be read because it's required for UTF-16
      // documents.
      if (this._rawChunkLen > 255) this._init();
      return;
    } else {
      this._chunk = this._textDecoder.decode(data, TEXT_DECODE_STREAM);
    }
  }

  feedString(data: string) {}

  eof() {
    this._textDecoder!.decode();
  }

  private _run() {
    switch (this._state) {
      case State.PROLOG:
        // XML Declaration is optional, if the first characters don't match, abort parsing
        // the declaration altogether.
        if (this._chunk.slice(0, 5) === "<?xml") {
          this._state = State.XML_DECL;
        } else {
          // Default encoding is UTF-8, since the XML Declaration was not specified,
          // encoding MUST be UTF-8.
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
          if (this._char === 0x3d /* = */) {
            this._state = State.XML_DECL_VALUE;
            break;
          } else if (isWhitespace(this._char)) {
            this._state = State.XML_DECL_ATTR_EQ;
            break;
          }
          this._advance();
        }
        this._xmlDeclAttr += this._chunk.slice(begin, this._index);
        break;
      }
      case State.XML_DECL_ATTR_EQ:
        for (this._index++; this._index < this._rawChunkLen; this._index++) {
          const b = this._rawChunk![this._index];
          if (b === 0x3d /* = */) {
            this._state = State.XML_DECL_VALUE;
            break;
          } else if (!isWhitespace(b)) {
            throw "parse error";
          }
        }
        break;
      case State.XML_DECL_VALUE:
        for (; this._index < this._rawChunkLen; this._index++) {
          const b = this._rawChunk![this._index];
          if (b === 0x27 /* ' */) {
            this._state = State.XML_DECL_VALUE_S;
            break;
          } else if (b === 0x22 /* " */) {
            this._state = State.XML_DECL_VALUE_D;
            break;
          } else if (!isWhitespace(b)) {
            throw "parse error";
          }
        }
        break;
      default:
    }
  }

  private _decodeRawChunk() {
    this._chunk = this._textDecoder.decode(
      this._rawChunk!.subarray(this._index),
      TEXT_DECODE_STREAM,
    );
  }

  // length must be greater than 16
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

  private _advance() {
    // Advance two places if the character is not BMP
    this._index += +(this._char > 0xffff) + 1;
    this._char = this._chunk.codePointAt(this._index)!;
  }

  // For debugging
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
