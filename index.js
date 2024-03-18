var Encoding = /* @__PURE__ */ ((Encoding2) => {
  Encoding2[Encoding2["Unknown"] = 0] = "Unknown";
  Encoding2[Encoding2["Default"] = 1] = "Default";
  Encoding2[Encoding2["Utf8"] = 2] = "Utf8";
  Encoding2[Encoding2["Utf16Le"] = 3] = "Utf16Le";
  Encoding2[Encoding2["Utf16Be"] = 4] = "Utf16Be";
  return Encoding2;
})(Encoding || {});
var State = /* @__PURE__ */ ((State2) => {
  State2[State2["Start"] = 0] = "Start";
  return State2;
})(State || {});
function toEncoding(encoding) {
  switch (encoding) {
    case void 0:
      return 0 /* Unknown */;
    case "utf-8":
      return 2 /* Utf8 */;
    case "utf-16le":
      return 3 /* Utf16Le */;
    case "utf-16be":
      return 4 /* Utf16Be */;
    default:
      throw new TypeError("Unknown encoding");
  }
}
function getEncodingString(encoding) {
  switch (encoding) {
    case 1 /* Default */:
    case 2 /* Utf8 */:
      return "utf-8";
    case 3 /* Utf16Le */:
      return "utf-16le";
    case 4 /* Utf16Be */:
      return "utf-16be";
    default:
      throw new TypeError("Unknown encoding");
  }
}
const textDecoderOptions = {
  fatal: true,
  // Ignore Byte Order Mark as the parser interprets it by itself.
  ignoreBOM: true
};
class Parser {
  constructor(reader, options) {
    // Only UTF-8 and UTF-16 are supported as they are the only ones explicitly
    // required by the XML standard.
    this.a = 0 /* Unknown */;
    this.e = 0;
    this.f = 0;
    this.g = 0;
    this.c = 0;
    this.i = "";
    this.b = 0;
    this.j = 0;
    this.k = 0 /* Start */;
    this.h = new TextDecoder("utf-8", textDecoderOptions);
    this.d = reader;
  }
  feed(data) {
    if (this.j === 0) {
      if (this.c < 3) {
        this.e = data[0];
        this.f = data[1];
        this.g = data[2];
        this.c += data.length;
      }
      if (this.c >= 3) {
        let b0 = this.e;
        let b1 = this.f;
        let b2 = this.g;
        if (b0 === 255 && b1 === 254) {
          this.b = 2;
          this.a = 3 /* Utf16Le */;
        } else if (b0 == 254 && b1 === 255) {
          this.b = 2;
          this.a = 4 /* Utf16Be */;
        } else if (b0 === 239 && b1 === 187 && b2 === 191) {
          this.b = 3;
          this.a = 2 /* Utf8 */;
        } else {
          this.a = 1 /* Default */;
        }
      }
    }
    if (this.a !== 0 /* Unknown */ && this.a !== 1 /* Default */ && this.h === void 0) {
      this.h = new TextDecoder(
        getEncodingString(this.a),
        textDecoderOptions
      );
    }
  }
  eof() {
  }
  l() {
    return this.i.codePointAt(this.b);
  }
}
DEV:
  Parser.prototype.toString = function() {
    return `Parser {
reader = ${// @ts-expect-error
    this.d};
encoding = ${{
      [0 /* Unknown */]: "unknown",
      [1 /* Default */]: "utf-8",
      [2 /* Utf8 */]: "utf-8",
      [3 /* Utf16Le */]: "utf-16le",
      [4 /* Utf16Be */]: "utf-16be"
      // @ts-expect-error
    }[this.a]};
}`;
  };
export {
  Parser
};
