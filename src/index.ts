import {isAsciiDigit, isEncodingName, isNameChar, isNameStartChar, isWhitespace} from "./chars.js";
import {SaxError} from "./error.js";

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
  DOCTYPE_DTD_END,
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
  private _reader: SaxReader;

  // State
  /** @internal */
  private _chunk = "";
  /** @internal */
  private _index = 0;
  /** @internal */
  private _char = 0;
  /** @internal */
  private _state = State.INIT;
  /** @internal */
  private _flags = Flags.INIT;

  // Accumulators
  /** Used for attribute names, XML Decl attributes @internal */
  private _name = "";
  /** Used for attribute values, XML Decl attribute values @internal */
  private _value = "";
  /** @internal */
  private _element = "";
  /** @internal */
  private _content = "";
  /** @internal */
  private _attributes = new Map<string, string>();

  // XML Declaration
  /** @internal */
  private _version: string | undefined = undefined;
  /** @internal */
  private _encoding: string | undefined = undefined;
  /** @internal */
  private _standalone: boolean | undefined = undefined;

  constructor(reader: SaxReader) {
    this._reader = reader;
    // Avoid capturing information that will be ignored, (except for the DOCTYPE, they will still be
    // validated).
    if (this._reader.comment != null) this._flags |= Flags.CAPTURE_COMMENT;
    if (this._reader.doctype != null) this._flags |= Flags.CAPTURE_DOCTYPE;
    if (this._reader.pi != null) this._flags |= Flags.CAPTURE_PI;
  }

  // getEncoding() {
  //   return this._encoding;
  // }

  write(input: string) {
    this._chunk += input;
    if (this._chunk.length !== 0) {
      this._char = input.codePointAt(this._index)!;
    }
    if (!this._run()) {
      this._chunk = "";
      this._index = 0;
    }
  }

  end() {
    this._run()
  }

  /**
   * Skips the specified number of code points. Assumes all skipped code points are not in the
   * surrogate range and are not carriage returns or line feeds.
   * @internal
   */
  private _advanceBy(units: number) {
    this._index += units;
    this._char = this._chunk.codePointAt(this._index)!;
  }

  /** @internal */
  private _advance() {
    this._index += 1 + +(this._char > 0xFFFF);
    this._char = this._chunk.codePointAt(this._index)!;
    // Normalize line endings
    // https://www.w3.org/TR/xml/#sec-line-ends
    if (this._char === 0x0D /* CR */) {
      if (this._chunk.charCodeAt(this._index + 1) === 0x0A /* LF */) {
        this._index += 1;
      } else if (this._index >= this._chunk.length) {
        this._flags |= Flags.CARRIAGE_RETURN;
      }
      this._char = 0x0A /* LF */;
    }
  }

  /**
   * Returns true if the parser needs more data before parsing the chunk.
   * @internal
   */
  private _run(): boolean {
    while (this._index < this._chunk.length) {
      switch (this._state) {
        case State.INIT:
        case State.PROLOG:
          if (this._chunk.slice(0, 5) === "<?xml") {
            this._state = State.XML_DECL;
            this._advanceBy(5);
          } else {
            this._state = State.DOCTYPE_DECL;
          }
          break;
        case State.XML_DECL:
          while (this._index < this._chunk.length) {
            const b = this._char;
            if (b === 0x3f /* ? */) {
              this._state = State.XML_DECL_END;
              this._advance();
              break;
            } else if (!isWhitespace(b)) {
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
          if (this._name.length + (this._index - begin) > 10) {
            throw SaxError("INVALID_XML_DECL");
          }
          this._name += this._chunk.slice(begin, this._index);
          break;
        }
        case State.XML_DECL_ATTR_EQ:
          while (this._index < this._chunk.length) {
            const b = this._char;
            this._advance();
            if (b === 0x3d /* = */) {
              this._state = State.XML_DECL_VALUE;
              break;
            } else if (!isWhitespace(b)) {
              throw SaxError("INVALID_XML_DECL");
            }
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
        case State.XML_DECL_VALUE_D:
          this._value += this._readQuoted(this._state === State.XML_DECL_VALUE_S, State.XML_DECL);
          // @ts-ignore
          if (this._state === State.XML_DECL) this._parseXmlDeclAttr();
          break;
        case State.XML_DECL_END:
          if (
            this._char !== 0x3e /* > */ ||
            // version is required
            (this._flags & Flags.XML_VERSION) === 0
          ) {
            throw SaxError("INVALID_XML_DECL");
          }
          this._state = State.DOCTYPE_DECL;
          this._reader.xml?.({
            version: this._version!,
            encoding: this._encoding,
            standalone: this._standalone,
          });
          break;
        case State.MISC:
        case State.DOCTYPE_DECL:
          if (!this._skipWhitespace() || this._chunk.length - this._index < 9) return true;
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
            if (!isNameStartChar(this._char)) {
              throw SaxError("INVALID_START_TAG");
            }
            this._element = this._chunk.slice(this._index, this._index + 1);
            this._advance();
            this._state = State.START_TAG_NAME;
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
          if (this._flags & Flags.SEEN_DOCTYPE) {
            this._element += this._chunk.slice(begin, this._index);
          }
          break;
        }
        case State.DOCTYPE_EXTERNAL_ID:
          while (this._index < this._chunk.length) {
            if (!isWhitespace(this._char)) break;
            this._advance();
          }
          if (this._chunk.length - this._index < 7) return true;
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
            this._flags |= Flags.DOCTYPE_PUBLIC_ID;
          } else if (this._char === 0x5B /* [ */) {
            this._advance();
            this._state = State.DOCTYPE_DTD;
            this._flags |= Flags.DOCTYPE_DTD;
          } else {
            throw SaxError("INVALID_DOCTYPE");
          }
          break;
        case State.DOCTYPE_SYSTEM_ID:
          if (!this._skipWhitespace()) return true;
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
          if (this._flags & Flags.CAPTURE_DOCTYPE) {
            this._name += systemId;
          }
          break;
        }
        case State.DOCTYPE_MAYBE_DTD:
          if (!this._skipWhitespace()) return true;
          if (this._char === 0x5B /* [ */) {
            this._advance();
            this._state = State.DOCTYPE_DTD;
            this._flags |= Flags.DOCTYPE_DTD;
          } else if (this._char === 0x3E /* > */) {
            this._advance();
            this._state = State.MISC;
          } else {
            throw SaxError("INVALID_DOCTYPE");
          }
          break;
        case State.DOCTYPE_DTD: {
          let index = this._chunk.indexOf("]", this._index);
          if (index === -1) {
            this._state = State.DOCTYPE_DTD_END;
            index = this._chunk.length;
          }
          this._content += this._chunk.slice(0, index);
          this._advanceBy(index - this._index);
          break;
        }
        case State.DOCTYPE_DTD_END:
          if (!this._skipWhitespace()) return true;
          if (this._char !== 0x3E /* > */) {
            throw SaxError("INVALID_DOCTYPE");
          }
          this._advance();
          this._state = State.MISC;
          this._flags |= Flags.SEEN_DOCTYPE;
          this._name = "";
          this._value = "";
          this._content = "";
          break;
        case State.COMMENT:
          if (this._flags & Flags.MAYBE_COMMENT_END && this._char === 0x2D /* - */) {
            this._state = State.COMMENT_END;
            this._advance();
          } else {
            let end = this._chunk.indexOf("--", this._index);
            if (end === -1) {
              end = this._chunk.length;
              if (this._chunk.endsWith("-")) {
                this._flags |= Flags.MAYBE_COMMENT_END;
                end -= 1;
              }
            } else {
              this._state = State.COMMENT_END;
            }
            if (this._flags & Flags.CAPTURE_COMMENT) {
              this._content += this._chunk.slice(this._index, end);
            }
            this._advanceBy(end - this._index);
          }
          break;
        case State.COMMENT_END:
          if (this._char !== 0x3E /* > */) {
            throw SaxError("INVALID_COMMENT");
          }
          this._advance();
          this._reader.comment?.(this._content);
          this._content = "";
          if (this._flags & Flags.SEEN_DOCTYPE) {
            this._state = State.MISC;
          } else {
            this._state = State.DOCTYPE_DECL;
          }
          break;
        case State.PI:
          throw SaxError("UNIMPLEMENTED");
        case State.START_TAG_NAME: {
          const start = this._index;
          while (this._index < this._chunk.length) {
            const b = this._char;
            this._advance();
            if (isWhitespace(b)) {
              this._state = State.START_TAG;
              break;
            } else if (b === 0x3E /* > */) {
              this._state = State.CONTENT;
              break;
            } else if (!isNameChar(b)) {
              throw SaxError("INVALID_START_TAG");
            }
          }
          this._element += this._chunk.slice(start, this._index);
          break;
        }
        case State.START_TAG:
          while (this._index < this._chunk.length) {
            if (this._char === 0x3E /* > */) {
              this._state = State.CONTENT;
              this._advance();
              break;
            } else if (isNameStartChar(this._char)) {
              this._state = State.START_TAG_ATTR;
              break;
            } else if (!isWhitespace(this._char)) {
              throw SaxError("INVALID_START_TAG");
            }
            this._advance();
          }
          break;
        case State.START_TAG_ATTR: {
          const start = this._index;
          while (this._index < this._chunk.length) {
            const b = this._char;
            this._advance();
            if (b === 0x3D /* = */) {
              this._state = State.START_TAG_ATTR_VALUE;
              break;
            } else if (isWhitespace(b)) {
              this._state = State.START_TAG_ATTR_EQ;
              break;
            } else if (!isNameChar(b)) {
              throw SaxError("INVALID_START_TAG");
            }
          }
          this._name += this._chunk.slice(start, this._index);
          break;
        }
        case State.START_TAG_ATTR_EQ:
          if (!this._skipWhitespace()) return true;
          if (this._char !== 0x3D /* = */) {
            throw SaxError("INVALID_START_TAG");
          }
          this._advance();
          this._state = State.START_TAG_ATTR_VALUE;
          break;
        case State.START_TAG_ATTR_VALUE:
          if (!this._skipWhitespace()) return true;
          if (this._char === 0x22 /* " */) {
            this._state = State.START_TAG_ATTR_VALUE_D;
          } else if (this._char === 0x27 /* ' */) {
            this._state = State.START_TAG_ATTR_VALUE_S;
          } else {
            throw SaxError("INVALID_START_TAG");
          }
          break;
        case State.START_TAG_ATTR_VALUE_D:
        case State.START_TAG_ATTR_VALUE_S:
          this._value += this._readQuoted(
            this._state === State.START_TAG_ATTR_VALUE_S,
            State.START_TAG,
          );
          // @ts-ignore
          if (this._state === State.START_TAG) {
            this._attributes.set(this._name, this._value);
            this._name = "";
            this._value = "";
          }
          break;
        case State.CONTENT: {
          let end = this._chunk.indexOf("<", this._index);
          if (end === -1) {
            end = this._chunk.length;
          } else {
            this._state = State.OPEN_ANGLE_BRACKET;
          }
          const chunk = this._chunk.slice(this._index, end);
          this._content += chunk;
          if (this._state === State.OPEN_ANGLE_BRACKET) {
            if (this._content.indexOf("]]>") !== -1) {
              throw SaxError("INVALID_CDATA");
            }
            this._reader.text(this._unescape(this._content));
            this._content = "";
          }
          break;
        }
        default:
          throw new Error("unreachable");
      }
    }
    return this._index < this._chunk.length - 1;
  }

  /** @internal */
  private _unescape(content: string) {
    let index = 0;
    let unescaped = "";
    while (true) {
      let end = content.indexOf("&", index);
      if (end === -1) break;
      unescaped += content.slice(index, end);
      index = end;
      let c = content.codePointAt(index)!;
      if (c === 0x23 /* # */) {

      }
      if (!isNameStartChar(c)) {
        throw SaxError("INVALID_ENTITY");
      }
      do {
        index += 1 + +(c > 0xFFFF);
        c = content.codePointAt(index)!
      } while (isNameChar(c));
      if (c !== 0x3B /* ; */) {
        throw SaxError("INVALID_ENTITY");
      }
      const entity = content.slice(end, index);
      unescaped += this._resolveEntity(entity);
    }
    unescaped += content.slice(index);
    // XML normalizes line endings to be UNIX style even if they not litterally the same in the
    // document
    unescaped = unescaped.replace(/\r\n?/g, "\n");
    return unescaped;
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
    switch (this._name) {
      case "version":
        if (
          (this._flags & Flags.XML) !== Flags.INIT ||
          this._value.length !== 3 ||
          this._value.slice(0, 2) !== "1." ||
          !isAsciiDigit(this._value.charCodeAt(2))
        ) {
          throw SaxError("INVALID_XML_DECL");
        }
        this._version = this._value;
        this._flags |= Flags.XML_VERSION;
        break;
      case "encoding":
        if (
          (this._flags & Flags.XML) !== Flags.XML_VERSION ||
          !isEncodingName(this._value)
        ) {
          throw SaxError("INVALID_XML_DECL");
        }
        this._encoding = this._value.toLowerCase();
        this._flags |= Flags.XML_ENCODING;
        break;
      case "standalone":
        if (
          (this._flags & Flags.XML_VERSION) === 0 ||
          (this._flags & Flags.XML_STANDALONE) !== 0 ||
          (this._value !== "yes" && this._value !== "no")
        ) {
          throw SaxError("INVALID_XML_DECL");
        }
        this._standalone = this._value === "yes";
        this._flags |= Flags.XML_STANDALONE;
        break;
      default:
        throw SaxError("INVALID_XML_DECL");
    }
    this._name = "";
    this._value = "";
  }

  /** @internal */
  private _skipWhitespace() {
    while (this._index < this._chunk.length) {
      if (!isWhitespace(this._char)) break;
      this._advance();
    }
    return this._index >= this._chunk.length;
  }

  /** @internal */
  private _resolveEntity(entity: string): string {
    if (DEFAULT_ENTITIES.hasOwnProperty(entity)) {
      return DEFAULT_ENTITIES[entity as keyof typeof DEFAULT_ENTITIES];
    }
    const entity2 = this._reader.resolveEntity?.(entity);
    if (entity2 == null) throw SaxError("UNRESOLVED_ENTITY", entity);
    return entity2;
  }
}
