export type Reader = {
  start(name: string, attributes: Record<string, string>): void;
  empty(name: string, attributes: Record<string, string>): void;
  end(name: string): void;
  text(text: string): void;
  cdata(cdata: string): void;
  entity(entity: string): void;
};

const enum Encoding {
  Unknown,
  Default,
  Utf8,
  Utf16Le,
  Utf16Be,
}

// Erased enum
const enum State {
  Start,
}

export type Options = {
  // encoding?: "utf-8" | "utf-16le" | "utf-16be";
};

function toEncoding(encoding: string | undefined) {
  switch (encoding) {
    case undefined:
      return Encoding.Unknown;
    case "utf-8":
      return Encoding.Utf8;
    case "utf-16le":
      return Encoding.Utf16Le;
    case "utf-16be":
      return Encoding.Utf16Be;
    default:
      throw new TypeError("Unknown encoding");
  }
}

function getEncodingString(encoding: Encoding) {
  switch (encoding) {
    case Encoding.Default:
    case Encoding.Utf8:
      return "utf-8";
    case Encoding.Utf16Le:
      return "utf-16le";
    case Encoding.Utf16Be:
      return "utf-16be";
    default:
      throw new TypeError("Unknown encoding");
  }
}

const textDecoderOptions: TextDecoderOptions = {
  //
  fatal: true,
  // Ignore Byte Order Mark as the parser skips it already.
  ignoreBOM: true,
};

export class Parser {
  private reader_: Reader;
  // Only UTF-8 and UTF-16 are supported as they are the only ones explicitly
  // required by the XML standard.
  private encoding_ = Encoding.Unknown;
  private bom0_ = 0;
  private bom1_ = 0;
  private bom2_ = 0;
  private bomLength_ = 0;
  private buffer_ = "";
  private index_ = 0;
  private offset_ = 0;
  private state_ = State.Start;
  private textDecoder_ = new TextDecoder("utf-8", textDecoderOptions);

  constructor(reader: Reader, options?: Options) {
    this.reader_ = reader;
    // TODO: should it toLowerCase()?
    // this.encoding_ = toEncoding(options?.encoding);
  }

  feed(data: Uint8Array) {
    if (this.offset_ === 0) {
      // Before setting the encoding at least get enough bytes for the BOM.
      if (this.bomLength_ < 3) {
        this.bom0_ = data[0];
        this.bom1_ = data[1];
        this.bom2_ = data[2];
        this.bomLength_ += data.length;
      }
      if (this.bomLength_ >= 3) {
        let b0 = this.bom0_;
        let b1 = this.bom1_;
        let b2 = this.bom2_;
        // Sniff the byte order mark
        if (b0 === 0xff && b1 === 0xfe) {
          this.index_ = 2;
          this.encoding_ = Encoding.Utf16Le;
        } else if (b0 == 0xfe && b1 === 0xff) {
          this.index_ = 2;
          this.encoding_ = Encoding.Utf16Be;
        } else if (b0 === 0xef && b1 === 0xbb && b2 === 0xbf) {
          this.index_ = 3;
          this.encoding_ = Encoding.Utf8;
        } else {
          // Default value is UTF-8 but XML Declaration may change it to any other
          // 8-bit encoding, so we are technically still not sure it's UTF-8.
          this.encoding_ = Encoding.Default;
        }
        if (this.encoding_ !== Encoding.Default) {
          this.textDecoder_ = new TextDecoder(
            getEncodingString(this.encoding_),
            textDecoderOptions,
          );
        }
      }
    }
    //
  }

  eof() {}

  private getChar_() {
    return this.buffer_.codePointAt(this.index_);
  }
}

// Leaving this here for now
DEV: Parser.prototype.toString = function () {
  return `Parser {
reader = ${
    // @ts-expect-error
    this.reader_
  };
encoding = ${
    {
      [Encoding.Unknown]: "unknown",
      [Encoding.Default]: "utf-8",
      [Encoding.Utf8]: "utf-8",
      [Encoding.Utf16Le]: "utf-16le",
      [Encoding.Utf16Be]: "utf-16be",
      // @ts-expect-error
    }[this.encoding_]
  };
}`;
};
