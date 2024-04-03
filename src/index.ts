import {
  isAsciiDigit,
  isEncodingName,
  isNameChar,
  isNameStartChar,
  isWhitespace,
  parseDec,
  parseHex,
} from "./chars.js";
import {SaxError, makeError} from "./error.js";

export {isSaxError, type SaxError, type SaxErrorCode} from "./error.js";

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
  DOCTYPE_END,
  MISC,
  COMMENT,
  COMMENT_END,
  PI,
  START_TAG_NAME,
  START_TAG,
  START_TAG_ATTR,
  START_TAG_ATTR_EQ,
  START_TAG_ATTR_VALUE,
  START_TAG_ATTR_VALUE_S,
  START_TAG_ATTR_VALUE_D,
  CONTENT,
  END_TAG,
  OPEN_ANGLE_BRACKET,
}

const enum Flags {
  INIT = 0,
  SEEN_XML_DECL = 1 << 0,
  XML_VERSION = 1 << 1,
  XML_ENCODING = 1 << 2,
  XML_STANDALONE = 1 << 3,
  SEEN_DOCTYPE = 1 << 4,
  DOCTYPE_PUBLIC_ID = 1 << 5,
  DOCTYPE_DTD = 1 << 6,
  XML = Flags.XML_VERSION | Flags.XML_ENCODING | Flags.XML_STANDALONE,

  CARRIAGE_RETURN = 1 << 7,
  SEEN_ROOT = 1 << 8,
  MAYBE_COMMENT_END = 1 << 9,

  CAPTURE_COMMENT = 1 << 16,
  CAPTURE_DOCTYPE = 1 << 17,
  CAPTURE_PI = 1 << 18,
}

export class SaxParser {
  /** @internal */
  private reader_: SaxReader;

  // State
  /** @internal */
  private chunk_ = "";
  /** @internal */
  private index_ = 0;
  /** @internal */
  private char_ = 0;
  /** @internal */
  private state_ = State.INIT;
  /** @internal */
  private flags_ = Flags.INIT;

  // Accumulators
  /** Used for attribute names, XML Decl attributes @internal */
  private name_ = "";
  /** Used for attribute values, XML Decl attribute values @internal */
  private value_ = "";
  /** @internal */
  private element_ = "";
  /** @internal */
  private content_ = "";
  /** @internal */
  private attributes_ = new Map<string, string>();

  // XML Declaration
  /** @internal */
  private version_: string | undefined = undefined;
  /** @internal */
  private encoding_: string | undefined = undefined;
  /** @internal */
  private standalone_: boolean | undefined = undefined;

  constructor(reader: SaxReader) {
    this.reader_ = reader;
    // Avoid capturing information that will be ignored, (except for the DOCTYPE, they will still be
    // validated).
    if (this.reader_.comment != null) this.flags_ |= Flags.CAPTURE_COMMENT;
    if (this.reader_.doctype != null) this.flags_ |= Flags.CAPTURE_DOCTYPE;
    if (this.reader_.pi != null) this.flags_ |= Flags.CAPTURE_PI;
  }

  /**
   * Returns the encoding declared in the XML Declaration.
   * @internal
   */
  get encoding() {
    return this.encoding_;
  }

  // getEncoding() {
  //   return this._encoding;
  // }

  /**
   * Add more data for the parser to process. May be called repeatedly to parse a streaming source.
   * @param input - string contents to parse
   * @throws {@link SaxError}
   * @since 1.0.0
   */
  write(input: string) {
    this.chunk_ += input;
    if (this.chunk_.length !== 0) {
      this.char_ = input.codePointAt(this.index_)!;
    }
    if (!this.run_()) {
      this.chunk_ = "";
      this.index_ = 0;
    }
  }

  /**
   * Signal to the parser that the source has ended.
   * @throws {@link SaxError}
   * @since 1.0.0
   */
  end() {
    if (this.run_()) throw makeError("TRUNCATED");
  }

  /**
   * Skips the specified number of code points. Assumes all skipped code points are not in the
   * surrogate range and are not carriage returns or line feeds.
   * @internal
   */
  private advanceBy_(units: number) {
    this.index_ += units;
    this.char_ = this.chunk_.codePointAt(this.index_)!;
  }

  /** @internal */
  private advance_() {
    this.index_ += 1 + +(this.char_ > 0xffff);
    this.char_ = this.chunk_.codePointAt(this.index_)!;
    // Normalize line endings
    // https://www.w3.org/TR/xml/#sec-line-ends
    if (this.char_ === 0x0d /* CR */) {
      if (this.chunk_.charCodeAt(this.index_ + 1) === 0x0a /* LF */) {
        this.index_ += 1;
      } else if (this.index_ >= this.chunk_.length) {
        this.flags_ |= Flags.CARRIAGE_RETURN;
      }
      this.char_ = 0x0a /* LF */;
    }
  }

  /**
   * Returns true if the parser needs more data before parsing the chunk.
   * @internal
   */
  private run_(): boolean {
    while (this.index_ < this.chunk_.length) {
      switch (this.state_) {
        case State.INIT:
        case State.PROLOG:
          if (this.chunk_.slice(0, 5) === "<?xml") {
            this.state_ = State.XML_DECL;
            this.advanceBy_(5);
          } else {
            this.state_ = State.DOCTYPE_DECL;
          }
          break;
        case State.XML_DECL:
          while (this.index_ < this.chunk_.length) {
            const b = this.char_;
            if (b === 0x3f /* ? */) {
              this.state_ = State.XML_DECL_END;
              this.advance_();
              break;
            } else if (!isWhitespace(b)) {
              this.state_ = State.XML_DECL_ATTR;
              break;
            }
            this.advance_();
          }
          break;
        case State.XML_DECL_ATTR: {
          const begin = this.index_;
          while (this.index_ < this.chunk_.length) {
            if (this.char_ === 0x3d /* = */ || isWhitespace(this.char_)) {
              this.state_ = State.XML_DECL_ATTR_EQ;
              break;
            }
            this.advance_();
          }
          // Too long, unknown XMLDecl attribute
          if (this.name_.length + (this.index_ - begin) > 10) {
            throw makeError("INVALID_XML_DECL");
          }
          this.name_ += this.chunk_.slice(begin, this.index_);
          break;
        }
        case State.XML_DECL_ATTR_EQ:
          while (this.index_ < this.chunk_.length) {
            const b = this.char_;
            this.advance_();
            if (b === 0x3d /* = */) {
              this.state_ = State.XML_DECL_VALUE;
              break;
            } else if (!isWhitespace(b)) {
              throw makeError("INVALID_XML_DECL");
            }
          }
          break;
        case State.XML_DECL_VALUE:
          while (this.index_ < this.chunk_.length) {
            const b = this.char_;
            this.advance_();
            if (b === 0x27 /* ' */) {
              this.state_ = State.XML_DECL_VALUE_S;
              break;
            } else if (b === 0x22 /* " */) {
              this.state_ = State.XML_DECL_VALUE_D;
              break;
            } else if (!isWhitespace(b)) {
              throw makeError("INVALID_XML_DECL");
            }
          }
          break;
        case State.XML_DECL_VALUE_S:
        case State.XML_DECL_VALUE_D:
          this.value_ += this.readQuoted_(
            this.state_ === State.XML_DECL_VALUE_S,
            State.XML_DECL,
          );
          // @ts-ignore
          if (this.state_ === State.XML_DECL) this.parseXmlDeclAttr_();
          break;
        case State.XML_DECL_END:
          if (
            this.char_ !== 0x3e /* > */ ||
            // version is required
            (this.flags_ & Flags.XML_VERSION) === 0
          ) {
            throw makeError("INVALID_XML_DECL");
          }
          this.advance_();
          this.state_ = State.DOCTYPE_DECL;
          this.reader_.xml?.({
            version: this.version_!,
            encoding: this.encoding_,
            standalone: this.standalone_,
          });
          break;
        case State.MISC:
        case State.DOCTYPE_DECL:
          if (this.skipWhitespace_() || this.chunk_.length - this.index_ < 9) {
            return true;
          }
          if (
            this.state_ === State.DOCTYPE_DECL &&
            this.chunk_.slice(this.index_, this.index_ + 9) === "<!DOCTYPE"
          ) {
            this.index_ += 8;
            this.advance_();
            this.state_ = State.DOCTYPE_NAME_S;
          } else if (
            this.chunk_.slice(this.index_, this.index_ + 4) === "<!--"
          ) {
            this.index_ += 3;
            this.advance_();
            this.state_ = State.COMMENT;
          } else if (this.chunk_.slice(this.index_, this.index_ + 2) === "<?") {
            this.index_ += 1;
            this.advance_();
            this.state_ = State.PI;
          } else if (this.state_ === State.MISC) {
            if (this.char_ !== 0x3c /* < */) {
              throw makeError("INVALID_START_TAG");
            }
            this.advance_();
            if (!isNameStartChar(this.char_)) {
              throw makeError("INVALID_START_TAG");
            }
            this.element_ = this.chunk_.slice(this.index_, this.index_ + 1);
            this.advance_();
            this.state_ = State.START_TAG_NAME;
          } else {
            throw makeError("INVALID_DOCTYPE");
          }
          break;
        case State.DOCTYPE_NAME_S:
          while (this.index_ < this.chunk_.length) {
            const c = this.char_;
            this.advance_();
            if (isNameStartChar(c)) {
              this.state_ = State.DOCTYPE_NAME;
              break;
            } else if (!isWhitespace(c)) {
              throw makeError("INVALID_DOCTYPE");
            }
          }
          break;
        case State.DOCTYPE_NAME: {
          const begin = this.index_;
          while (this.index_ < this.chunk_.length) {
            if (isWhitespace(this.char_)) {
              this.state_ = State.DOCTYPE_EXTERNAL_ID;
              break;
            } else if (this.char_ === 0x3e /* > */) {
              this.state_ = State.DOCTYPE_END;
              break;
            } else if (!isNameChar(this.char_)) {
              throw makeError("INVALID_DOCTYPE");
            }
            this.advance_();
          }
          if (this.flags_ & Flags.SEEN_DOCTYPE) {
            this.element_ += this.chunk_.slice(begin, this.index_);
          }
          break;
        }
        case State.DOCTYPE_EXTERNAL_ID:
          while (this.index_ < this.chunk_.length) {
            if (!isWhitespace(this.char_)) break;
            this.advance_();
          }
          if (this.chunk_.length - this.index_ < 7) return true;
          if (
            this.chunk_.slice(this.index_, this.index_ + 6) === "SYSTEM" &&
            isWhitespace(this.chunk_.charCodeAt(this.index_ + 6))
          ) {
            this.advanceBy_(7);
            this.state_ = State.DOCTYPE_SYSTEM_ID;
          } else if (
            this.chunk_.slice(this.index_, this.index_ + 6) === "PUBLIC" &&
            isWhitespace(this.chunk_.charCodeAt(this.index_ + 6))
          ) {
            this.advanceBy_(7);
            this.state_ = State.DOCTYPE_PUBLIC_ID;
            this.flags_ |= Flags.DOCTYPE_PUBLIC_ID;
          } else if (this.char_ === 0x5b /* [ */) {
            this.advance_();
            this.state_ = State.DOCTYPE_DTD;
            this.flags_ |= Flags.DOCTYPE_DTD;
          } else {
            throw makeError("INVALID_DOCTYPE");
          }
          break;
        case State.DOCTYPE_SYSTEM_ID:
          if (!this.skipWhitespace_()) return true;
          if (this.char_ === 0x27 /* " */) {
            this.state_ = State.DOCTYPE_SYSTEM_ID_D;
          } else if (this.char_ === 0x22 /* ' */) {
            this.state_ = State.DOCTYPE_SYSTEM_ID_S;
          } else {
            throw makeError("INVALID_DOCTYPE");
          }
          this.advance_();
          break;
        case State.DOCTYPE_SYSTEM_ID_D:
        case State.DOCTYPE_SYSTEM_ID_S: {
          const systemId = this.readQuoted_(
            this.state_ === State.DOCTYPE_SYSTEM_ID_S,
            State.DOCTYPE_MAYBE_DTD,
          );
          if (this.flags_ & Flags.CAPTURE_DOCTYPE) {
            this.name_ += systemId;
          }
          break;
        }
        case State.DOCTYPE_MAYBE_DTD:
          if (!this.skipWhitespace_()) return true;
          if (this.char_ === 0x5b /* [ */) {
            this.advance_();
            this.state_ = State.DOCTYPE_DTD;
            this.flags_ |= Flags.DOCTYPE_DTD;
          } else if (this.char_ === 0x3e /* > */) {
            this.advance_();
            this.state_ = State.MISC;
          } else {
            throw makeError("INVALID_DOCTYPE");
          }
          break;
        case State.DOCTYPE_DTD: {
          let index = this.chunk_.indexOf("]", this.index_);
          if (index === -1) {
            this.state_ = State.DOCTYPE_END;
            index = this.chunk_.length;
          }
          this.content_ += this.chunk_.slice(0, index);
          this.advanceBy_(index - this.index_);
          break;
        }
        case State.DOCTYPE_END:
          if (this.skipWhitespace_()) return true;
          if (this.char_ !== 0x3e /* > */) {
            throw makeError("INVALID_DOCTYPE");
          }
          this.advance_();
          this.state_ = State.MISC;
          this.flags_ |= Flags.SEEN_DOCTYPE;
          this.name_ = "";
          this.value_ = "";
          this.content_ = "";
          break;
        case State.COMMENT:
          if (
            this.flags_ & Flags.MAYBE_COMMENT_END &&
            this.char_ === 0x2d /* - */
          ) {
            this.state_ = State.COMMENT_END;
            this.advance_();
          } else {
            let end = this.chunk_.indexOf("--", this.index_);
            if (end === -1) {
              end = this.chunk_.length;
              if (this.chunk_.endsWith("-")) {
                this.flags_ |= Flags.MAYBE_COMMENT_END;
                end -= 1;
              }
            } else {
              this.state_ = State.COMMENT_END;
            }
            if (this.flags_ & Flags.CAPTURE_COMMENT) {
              this.content_ += this.chunk_.slice(this.index_, end);
            }
            this.advanceBy_(end - this.index_);
          }
          break;
        case State.COMMENT_END:
          if (this.char_ !== 0x3e /* > */) {
            throw makeError("INVALID_COMMENT");
          }
          this.advance_();
          this.reader_.comment?.(this.content_);
          this.content_ = "";
          if (this.flags_ & Flags.SEEN_DOCTYPE) {
            this.state_ = State.MISC;
          } else {
            this.state_ = State.DOCTYPE_DECL;
          }
          break;
        case State.PI:
          throw makeError("UNIMPLEMENTED");
        case State.START_TAG_NAME: {
          const start = this.index_;
          while (this.index_ < this.chunk_.length) {
            if (isWhitespace(this.char_) || this.char_ === 0x3e /* > */) {
              this.state_ = State.START_TAG;
              break;
            } else if (!isNameChar(this.char_)) {
              throw makeError("INVALID_START_TAG");
            }
            this.advance_();
          }
          this.element_ += this.chunk_.slice(start, this.index_);
          break;
        }
        case State.START_TAG:
          while (this.index_ < this.chunk_.length) {
            if (this.char_ === 0x3e /* > */) {
              this.state_ = State.CONTENT;
              this.advance_();
              this.reader_.start(this.element_, this.attributes_);
              this.attributes_.clear();
              break;
            } else if (isNameStartChar(this.char_)) {
              this.state_ = State.START_TAG_ATTR;
              break;
            } else if (!isWhitespace(this.char_)) {
              throw makeError("INVALID_START_TAG");
            }
            this.advance_();
          }
          break;
        case State.START_TAG_ATTR: {
          const start = this.index_;
          while (this.index_ < this.chunk_.length) {
            const b = this.char_;
            this.advance_();
            if (b === 0x3d /* = */) {
              this.state_ = State.START_TAG_ATTR_VALUE;
              break;
            } else if (isWhitespace(b)) {
              this.state_ = State.START_TAG_ATTR_EQ;
              break;
            } else if (!isNameChar(b)) {
              throw makeError("INVALID_START_TAG");
            }
          }
          this.name_ += this.chunk_.slice(start, this.index_);
          break;
        }
        case State.START_TAG_ATTR_EQ:
          if (!this.skipWhitespace_()) return true;
          if (this.char_ !== 0x3d /* = */) {
            throw makeError("INVALID_START_TAG");
          }
          this.advance_();
          this.state_ = State.START_TAG_ATTR_VALUE;
          break;
        case State.START_TAG_ATTR_VALUE:
          if (!this.skipWhitespace_()) return true;
          if (this.char_ === 0x22 /* " */) {
            this.state_ = State.START_TAG_ATTR_VALUE_D;
          } else if (this.char_ === 0x27 /* ' */) {
            this.state_ = State.START_TAG_ATTR_VALUE_S;
          } else {
            throw makeError("INVALID_START_TAG");
          }
          break;
        case State.START_TAG_ATTR_VALUE_D:
        case State.START_TAG_ATTR_VALUE_S:
          this.value_ += this.readQuoted_(
            this.state_ === State.START_TAG_ATTR_VALUE_S,
            State.START_TAG,
          );
          // @ts-ignore
          if (this.state_ === State.START_TAG) {
            this.attributes_.set(this.name_, this.unescape_(this.value_));
            this.name_ = "";
            this.value_ = "";
          }
          break;
        case State.CONTENT: {
          let end = this.chunk_.indexOf("<", this.index_);
          if (end === -1) {
            end = this.chunk_.length;
          } else {
            this.state_ = State.OPEN_ANGLE_BRACKET;
          }
          const chunk = this.chunk_.slice(this.index_, end);
          this.content_ += chunk;
          if (this.state_ === State.OPEN_ANGLE_BRACKET) {
            if (this.content_.indexOf("]]>") !== -1) {
              throw makeError("INVALID_CDATA");
            }
            this.reader_.text(this.unescape_(this.content_));
            this.content_ = "";
          }
          break;
        }
        case State.OPEN_ANGLE_BRACKET:
          if (this.chunk_.length - this.index_ < 3) return true;
          if (this.char_ === 0x2f /* / */) {
            this.state_ = State.END_TAG;
          } else if (
            this.chunk_.slice(this.index_, this.index_ + 3) === "!--"
          ) {
            this.advanceBy_(3);
            this.state_ = State.COMMENT;
          } else if (isNameStartChar(this.char_)) {
            this.state_ = State.START_TAG_NAME;
          } else {
            throw makeError("INVALID_START_TAG");
          }
          break;
        case State.END_TAG:
          break;
      }
    }
    return this.index_ < this.chunk_.length - 1;
  }

  /** @internal */
  private unescape_(content: string) {
    let index = 0;
    let unescaped = "";
    while (true) {
      // Replace entity references
      let amp = content.indexOf("&", index);
      if (amp === -1) break;
      unescaped += content.slice(index, amp);
      index = amp;
      let c = content.codePointAt(index)!;
      let replacement;
      if (c === 0x23 /* # */) {
        let end = content.indexOf(";", index);
        const codePoint = content.slice(index, index + 2) === "#x"
          ? parseHex(content.slice(index + 2, end))
          : parseDec(content.slice(index + 1, end));
        if (end === -1 || codePoint === undefined || codePoint >= 0x10ffff) {
          throw makeError("INVALID_CHAR_REF");
        }
        replacement = String.fromCodePoint(codePoint);
      } else {
        if (!isNameStartChar(c)) {
          throw makeError("INVALID_ENTITY_REF");
        }
        do {
          index += 1 + +(c > 0xffff);
          c = content.codePointAt(index)!;
        } while (isNameChar(c));
        replacement = this.resolveEntity_(content.slice(amp, index));
        if (c !== 0x3b /* ; */) {
          throw makeError("INVALID_ENTITY_REF");
        }
      }
      unescaped += replacement;
    }
    // Last chunk
    unescaped += content.slice(index);
    // XML normalizes line endings to be UNIX style even if they not litterally the same in the
    // document
    unescaped = unescaped.replace(/\r\n?/g, "\n");
    return unescaped;
  }

  /** @internal */
  private readQuoted_(single: boolean, nextState: State) {
    let quote = this.chunk_.indexOf(single ? "'" : '"', this.index_);
    if (quote === -1) {
      quote = this.chunk_.length;
    } else {
      this.state_ = nextState;
    }
    const chunk = this.chunk_.slice(this.index_, quote);
    this.index_ = quote;
    this.advance_();
    return chunk;
  }

  /** @internal */
  private parseXmlDeclAttr_() {
    switch (this.name_) {
      case "version":
        if (
          (this.flags_ & Flags.XML) !== Flags.INIT ||
          this.value_.length !== 3 ||
          this.value_.slice(0, 2) !== "1." ||
          !isAsciiDigit(this.value_.charCodeAt(2))
        ) {
          throw makeError("INVALID_XML_DECL");
        }
        this.version_ = this.value_;
        this.flags_ |= Flags.XML_VERSION;
        break;
      case "encoding":
        if (
          (this.flags_ & Flags.XML) !== Flags.XML_VERSION ||
          !isEncodingName(this.value_)
        ) {
          throw makeError("INVALID_XML_DECL");
        }
        this.encoding_ = this.value_.toLowerCase();
        this.flags_ |= Flags.XML_ENCODING;
        break;
      case "standalone":
        if (
          (this.flags_ & Flags.XML_VERSION) === 0 ||
          (this.flags_ & Flags.XML_STANDALONE) !== 0 ||
          (this.value_ !== "yes" && this.value_ !== "no")
        ) {
          throw makeError("INVALID_XML_DECL");
        }
        this.standalone_ = this.value_ === "yes";
        this.flags_ |= Flags.XML_STANDALONE;
        break;
      default:
        throw makeError("INVALID_XML_DECL");
    }
    this.name_ = "";
    this.value_ = "";
  }

  /** @internal */
  private skipWhitespace_() {
    while (this.index_ < this.chunk_.length) {
      if (!isWhitespace(this.char_)) break;
      this.advance_();
    }
    return this.index_ >= this.chunk_.length;
  }

  /** @internal */
  private resolveEntity_(entity: string) {
    // Default entities always have priority
    if (DEFAULT_ENTITIES.hasOwnProperty(entity)) {
      return DEFAULT_ENTITIES[entity as keyof typeof DEFAULT_ENTITIES];
    }
    const entity2 = this.reader_.resolveEntity?.(entity);
    if (entity2 == null) throw makeError("UNRESOLVED_ENTITY", entity);
    return entity2;
  }
}
