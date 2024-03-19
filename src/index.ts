export type SaxReader = {
  start(name: string, attributes: Map<string, string>): void;
  empty(name: string, attributes: Map<string, string>): void;
  end(name: string): void;
  text(text: string): void;
  cdata(cdata: string): void;
  entity(entity: string): void;
};

// These enums are erased at compile time for better size and speed.
const enum Encoding {
  UNKNOWN,
  DEFAULT,
  UTF8,
  UTF16LE,
  UTF16BE,
}

// Erased enum
const enum State {
  INIT,
  INIT1,
  PROLOG,
  XML_DECL,
  XML_DECL_VERSION,
  XML_DECL_VERSION_EQ,
  XML_DECL_VERSION_VAL0,
  XML_DECL_VERSION_VAL1,
  XML_DECL_ENCODING,
  DOCTYPE_DECL,
}

export type Options = {
  // Encoding is not necessary, encodings other than UTF-8 and UTF-16 are not supported.
  // and since the XML specifications require the BOM in UTF-16 files don't need any hints
  // about the file's encoding.
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

const TEXT_DECODER_OPTIONS: TextDecoderOptions = {
  //
  fatal: true,
  // Don't skip the Byte Order Mark as the parser skips it already.
  ignoreBOM: false,
};

const DEFAULT_TEXT_DECODER_OPTIONS: TextDecoderOptions = {
  fatal: false,
  ignoreBOM: false,
};

const TEXT_DECODE_OPTIONS: TextDecodeOptions = {
  stream: true,
};

function isWhitespace(c: number) {
  // SP TAB LF CR
  return c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d;
}

export class SaxParser {
  private _reader: SaxReader;
  // Only UTF-8 and UTF-16 are supported as they are the only ones explicitly
  // required by the XML standard. All other encodings are considered legacy and
  // are not supported by this parser.
  private _encoding = Encoding.UNKNOWN;
  // A buffer large enough store all information we need.
  private _rawChunk = new Uint8Array(256);
  private _chunkSize = 0;
  // Index in the current chunk
  private _index = 0;
  private _chunk = "";
  private _content = "";
  private _state = State.INIT;
  private _xmlDeclVersion = "1.0";
  private _xmlDeclEncoding = "utf-8";
  private _xmlDeclStandalone = false;
  private _textDecoder: TextDecoder | undefined = undefined;
  // Using a Map because it has more efficient lookups than an array and is guaranteed to
  // retain order of defined values.
  private _attributes = new Map<string, string>();

  constructor(reader: SaxReader, options?: Options) {
    this._reader = reader;
    // TODO: should it toLowerCase()?
    // this.encoding_ = toEncoding(options?.encoding);
  }

  get encoding() {
    return getEncodingString(this._encoding);
  }

  feed(data: Uint8Array) {
    switch (this._state) {
      // absolute start of the file, including BOM
      case State.INIT:
        // short buffers are stupid
        if (data.length > 255) {
          this._rawChunk = data;
          this._chunkSize = data.length;
          this._init();
        } else {
          this._rawChunk.set(data);
          this._chunkSize = data.length;
          this._state = State.INIT1;
        }
        break;
      case State.INIT1:
        this._rawChunk.set(data, this._chunkSize);
        this._chunkSize += data.length;
        if (this._chunkSize > 255) {
          this._init();
        }
        break;
      case State.PROLOG:
        // XML Declaration is optional, if the first characters don't match, abort parsing
        // the declaration altogether.
        if (
          this._rawChunk[this._index + 0] === 0x3c &&
          this._rawChunk[this._index + 1] === 0x3f &&
          this._rawChunk[this._index + 2] === 0x78 &&
          this._rawChunk[this._index + 3] === 0x6d &&
          this._rawChunk[this._index + 4] === 0x6c
        ) {
          this._state = State.XML_DECL;
        } else {
          // Default encoding is UTF-8
          if (this._encoding === Encoding.DEFAULT)
            this._textDecoder = new TextDecoder("utf-8", TEXT_DECODER_OPTIONS);
          this._state = State.DOCTYPE_DECL;
        }
        break;
      case State.XML_DECL:
        while (this._index < this._chunkSize) {
          if (
            this._rawChunk[this._index++] === 0x3f /* ? */ &&
            this._rawChunk[this._index] === 0x3e /* > */
          ) {
            this._index++;
            this._state = State.DOCTYPE_DECL;
          }
        }
        break;
      case State.DOCTYPE_DECL:
    }
    // Encoding detection logic
    if (this._index === 0) {
      if (data.length < 3) {
        this._rawChunk.set(data, this._chunkSize);
        this._chunkSize += data.length;
        data = this._rawChunk;
      }
      if (data.length >= 3) {
      }
    }
    switch (this._state) {
      case State.PROLOG:
        // XML declaration is always at the start <?xml
        if (
          this._rawChunk[0] === 0x3c &&
          this._rawChunk[1] === 0x3f &&
          this._rawChunk[2] === 0x78 &&
          this._rawChunk[3] === 0x6d &&
          this._rawChunk[4] === 0x6c
        ) {
          this._index = 5;
          this._state = State.XML_DECLARATION_VERSION0;
        } else if (this._chunkSize < 5) {
          return;
        } else {
          throw new Error();
        }
        break;
      case State.XML_DECLARATION_VERSION0:
        if (isWhitespace(this._rawChunk[this._index])) {
          this._index++;
        } else {
          this._state = State.XML_DECL;
        }
        break;
      case State.XML_DECL:
        // version
        if (
          this._rawChunk[this._index + 0] === 0x76 &&
          this._rawChunk[this._index + 1] === 0x65 &&
          this._rawChunk[this._index + 2] === 0x72 &&
          this._rawChunk[this._index + 3] === 0x73 &&
          this._rawChunk[this._index + 4] === 0x69 &&
          this._rawChunk[this._index + 5] === 0x6f &&
          this._rawChunk[this._index + 6] === 0x6e
        ) {
        }
        break;
        // case State.XML_DECLARATION_VERSION1:
        if (isWhitespace(this._rawChunk[this._index])) {
          this._index++;
        } else {
          this._state = State.XML_DECL;
        }
        break;
    }
  }

  eof() {
    this._textDecoder!.decode();
  }

  // length must be greater than 16
  private _init() {
    // Read the Byte Order Mark, if specified it must be correct.
    const b0 = this._rawChunk[0];
    const b1 = this._rawChunk[1];
    const b2 = this._rawChunk[2];
    if (b0 === 0xff && b1 === 0xfe) {
      this._index = 2;
      this._encoding = Encoding.UTF16LE;
    } else if (b0 == 0xfe && b1 === 0xff) {
      this._index = 2;
      this._encoding = Encoding.UTF16BE;
    } else if (b0 === 0xef && b1 === 0xbb && b2 === 0xbf) {
      this._index = 3;
      this._encoding = Encoding.UTF8;
    } else {
      // Default value is UTF-8 but XML Declaration may change it to any other
      // 8-bit encoding, so we are technically still not sure it's UTF-8.
      this._encoding = Encoding.DEFAULT;
    }
    if (this._encoding !== Encoding.DEFAULT) {
      this._textDecoder = new TextDecoder(
        getEncodingString(this._encoding),
        TEXT_DECODER_OPTIONS,
      );
    }
    this._state = State.PROLOG;
  }

  private _nextChar() {
    return this._rawChunk[this._index++];
  }

  // For debugging
  toString() {
    return `Parser {
  reader = ${this._reader};
  encoding = ${
    {
      [Encoding.UNKNOWN]: "unknown",
      [Encoding.DEFAULT]: "utf-8",
      [Encoding.UTF8]: "utf-8",
      [Encoding.UTF16LE]: "utf-16le",
      [Encoding.UTF16BE]: "utf-16be",
    }[this._encoding]
  };
  }`;
  }
}
