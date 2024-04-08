import {
  Chars,
  isAsciiDigit,
  isChar,
  isEncodingName,
  isNameChar,
  isNameStartChar,
  isWhitespace,
  parseDec,
  parseHex,
} from "./chars.js";
import {createSaxError, SaxError} from "./error.js";

export {isSaxError, type SaxError, type SaxErrorCode} from "./error.js";

/**
 * XML Declaration (XMLDecl)
 *
 * ```xml
 * <?xml version="1.0" encoding="UTF-8" standalone="no" ?>
 * ```
 *
 * @since 1.0.0
 */
export interface XmlDeclaration {
  /**
   * Version declared in the XML Declaration.
   * @since 1.0.0
   */
  version: string;
  /**
   * Encoding declared in the XML Declaration, or `undefined` when unspecified.
   * @since 1.0.0
   */
  encoding?: string | undefined;
  /**
   * Standalone value declared in the XML Declaration. `true` when set to `yes`,
   * `false` when set to `no`, or `undefined` when unspecified (should be
   * treated as a `false`).
   * @since 1.0.0
   */
  standalone?: boolean | undefined;
}

export interface Doctype {
  name: string;
  publicId?: string | undefined;
  systemId?: string | undefined;
}

/**
 * A processing instruction.
 *
 * ```xml
 * <?target content?>
 * ```
 * @since 1.0.0
 */
export interface Pi {
  /** Target name of the processing instruction. */
  target: string;
  /**
   * Content of the processing instruction or `undefined` if omitted.
   *
   * Empty and omitted content is subtly different:
   *
   * ```xml
   * <?target?><!-- omitted, content = undefined -->
   * <?target ?><!-- empty, content = "" -->
   * ```
   */
  content?: string | undefined;
}

interface SaxDtdHandler {
  start(
    name: string,
    publicId?: string | undefined,
    systemId?: string | undefined,
  ): void;
}

/** */
export interface SaxReader {
  /**
   * Resolve an entity reference by name. Users are expected to handle `<!ENTITY ...>`
   * declarations in the DTD where applicable or have a hard coded set of
   * possible ones.
   *
   * @param entity
   * @returns resolved entity contents or `undefined` if not found.
   * @since 1.0.0
   */
  resolveEntityRef?(entity: string): string | undefined;
  /**
   * @param declaration
   * @since 1.0.0
   */
  xml?(declaration: XmlDeclaration): void;
  /**
   * To improve performance, if processing instructions are not required do not
   * define this handler.
   * @param doctype
   * @since 1.0.0
   */
  doctype?(doctype: Doctype): void;
  /**
   * A processing instruction `<?target content?>`. To improve performance, if
   * processing instructions are not required do not define this handler.
   * @param pi
   * @since 1.0.0
   */
  pi?(pi: Pi): void;
  /**
   * A comment `<!-- text -->`. To improve performance, if comments are not
   * required do not define this handler.
   * @since 1.0.0
   */
  comment?(text: string): void;
  /**
   * Start tag `<element attr="value">`. Attributes are passed to
   * @param name
   * @param attributes
   * @since 1.0.0
   */
  start(name: string, attributes: ReadonlyMap<string, string>): void;
  /**
   * An empty element `<element attr="value" />`.
   * @param name
   * @param attributes
   * @since 1.0.0
   */
  empty(name: string, attributes: ReadonlyMap<string, string>): void;
  /**
   * An end tag `</element>`.
   * @param name
   * @since 1.0.0
   */
  end(name: string): void;
  /**
   * Text content of an element, `<element>text &amp; content</element>`
   * would produce text `"text & content"`.
   * @param text - Unescaped text content of the last start element.
   * @since 1.0.0
   */
  text(text: string): void;
}

export interface SaxOptions {
  /**
   *
   */
  comments?: boolean | undefined;
  /**
   * @defaultValue 3
   */
  maxNestedEntityRef?: number | undefined;
}

const PREDEFINED_ENTITIES = {
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
  XML_DECL_S,
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
  PI_TARGET_START,
  PI_TARGET,
  PI_CONTENT,
  PI_CONTENT_S,
  PI_EMPTY,
  OPEN_ANGLE_BRACKET,
  OPEN_ANGLE_BRACKET_BANG,
  START_TAG_NAME,
  START_TAG,
  START_TAG_ATTR,
  START_TAG_ATTR_EQ,
  START_TAG_ATTR_VALUE,
  START_TAG_ATTR_VALUE_S,
  START_TAG_ATTR_VALUE_D,
  CONTENT,
  END_TAG_START,
  END_TAG,
  END_TAG_END,
  CDATA,
}

const enum Flags {
  INIT = 0,
  SEEN_XML_DECL = 1 << 0,
  SEEN_DOCTYPE = 1 << 1,
  SEEN_ROOT = 1 << 2,

  CARRIAGE_RETURN = 1 << 8,

  XML_VERSION = 1 << 3,
  XML_ENCODING = 1 << 4,
  XML_STANDALONE = 1 << 5,
  XML_ALL = Flags.XML_VERSION | Flags.XML_ENCODING | Flags.XML_STANDALONE,

  DOCTYPE_PUBLIC_ID = 1 << 6,
  DOCTYPE_DTD = 1 << 7,

  CAPTURE_COMMENT = 1 << 16,
  CAPTURE_DOCTYPE = 1 << 17,
  CAPTURE_PI = 1 << 18,
}

// Normalize XML line endings.
function normalize(s: string) {
  // Yet to find a method faster than a simple replace.
  return s.replace(/\r\n?/g, "\n");
}

/** */
export class SaxParser {
  // @internal
  private reader_: SaxReader;

  // State
  // @internal
  private chunk_ = "";
  // @internal
  private index_ = 0;
  // @internal
  private char_ = 0;
  // @internal
  private state_ = State.INIT;
  // @internal
  private flags_ = Flags.INIT;

  // Accumulators

  // Generic accumulator
  // @internal
  private accumulator_ = "";
  // Current attribute name (or XML Decl attribute value)
  // @internal
  private attributeName_ = "";
  // Current attribute value (or XML Decl attribute value)
  // @internal
  private attributeValue_ = "";
  // Current element name
  // @internal
  private element_ = "";
  // Current text content, contains decoded and normalized content
  // @internal
  private content_ = "";
  // Current attributes, this parser enforces well-formedness so an attribute
  // list cannot be avoided. To improve lookup times it uses a Map instead of a
  // plain object.
  // @internal
  private attributes_ = new Map<string, string>();
  // Current stack of XML elements, required to validate open and end tags.
  // @internal
  private stack_: string[] = [];

  // XML Declaration attributes
  // @internal
  private version_: string | undefined = undefined;
  // @internal
  private encoding_: string | undefined = undefined;
  // @internal
  private standalone_: boolean | undefined = undefined;

  constructor(reader: SaxReader, options: SaxOptions | undefined = undefined) {
    this.reader_ = reader;
    // Avoid capturing information that will be ignored
    if (this.reader_.comment != null) this.flags_ |= Flags.CAPTURE_COMMENT;
    if (this.reader_.doctype != null) this.flags_ |= Flags.CAPTURE_DOCTYPE;
    if (this.reader_.pi != null) this.flags_ |= Flags.CAPTURE_PI;
  }

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
    while (this.index_ < this.chunk_.length && this.runStateMachine_());
    // if (!this.run_()) {
    //   this.chunk_ = "";
    //   this.index_ = 0;
    // }

    // Chunk may not have been consumed completely
    this.chunk_ = this.chunk_.slice(this.index_);
    this.index_ = 0;
  }

  /**
   * Signal to the parser that the source has ended.
   * @throws {@link SaxError}
   * @since 1.0.0
   */
  end() {
    // if (this.run_()) throw createSaxError("TRUNCATED");
  }

  // Main parsing method
  // @internal
  private runStateMachine_() {
    switch (this.state_) {
      case State.INIT:
        // No well-formed XML Document can have less than 6 characters.
        if (this.chunk_.length < 6) return false;
        if (
          this.chunk_.slice(0, 5) === "<?xml" &&
          isWhitespace(this.chunk_.charCodeAt(5))
        ) {
          this.skipTo_(6);
          this.state_ = State.XML_DECL;
        } else {
          this.state_ = State.MISC;
        }
        break;
      case State.PROLOG:
        break;
      case State.XML_DECL:
        if (!this.skipWhitespace_()) return false;
        if (this.char_ === Chars.QUESTION) {
          this.advance_();
          this.state_ = State.XML_DECL_END;
        } else if (this.collectXmlAttrName_()) {
          this.state_ = State.XML_DECL_VALUE;
        }
        break;
      case State.XML_DECL_S:
        if (this.char_ === Chars.QUESTION) {
          this.advance_();
          this.state_ = State.XML_DECL_END;
        } else if (isWhitespace(this.char_)) {
          this.advance_();
          this.state_ = State.XML_DECL;
        } else {
          this.error_(createSaxError("INVALID_XML_DECL"));
        }
        break;
      case State.XML_DECL_VALUE:
        if (!this.skipWhitespace_()) return false;
        if (this.char_ === Chars.APOSTROPHE) {
          this.state_ = State.XML_DECL_VALUE_S;
        } else if (this.char_ === Chars.QUOTE) {
          this.state_ = State.XML_DECL_VALUE_D;
        } else {
          this.error_(createSaxError("INVALID_XML_DECL"));
        }
        this.advance_();
        break;
      case State.XML_DECL_VALUE_S:
      case State.XML_DECL_VALUE_D:
        if (this.readQuotedValue_(this.state_ === State.XML_DECL_VALUE_S)) {
          this.handleXmlDeclAttr_();
          this.state_ = State.XML_DECL_S;
        }
        break;
      case State.XML_DECL_END:
        if (this.char_ !== Chars.GT || this.version_ === undefined) {
          this.error_(createSaxError("INVALID_XML_DECL"));
        }
        this.advance_();
        this.reader_.xml?.({
          version: this.version_,
          encoding: this.encoding_,
          standalone: this.standalone_,
        });
        this.state_ = State.MISC;
        break;
      case State.DOCTYPE_DECL:
      case State.DOCTYPE_NAME_S:
      case State.DOCTYPE_NAME:
      case State.DOCTYPE_EXTERNAL_ID:
      case State.DOCTYPE_SYSTEM_ID:
      case State.DOCTYPE_SYSTEM_ID_S:
      case State.DOCTYPE_SYSTEM_ID_D:
      case State.DOCTYPE_PUBLIC_ID:
      case State.DOCTYPE_MAYBE_DTD:
      case State.DOCTYPE_DTD:
      case State.DOCTYPE_END:
        throw new Error("not implemented");
      case State.MISC:
        if (!this.skipWhitespace_()) return false;
        if (this.char_ === Chars.LT) {
          this.state_ = State.OPEN_ANGLE_BRACKET;
        } else {
          this.error_(createSaxError("INVALID_START_TAG"));
        }
        this.advance_();
        break;
      case State.COMMENT:
        this.readComment_();
        break;
      case State.COMMENT_END:
        if (this.char_ !== Chars.GT) {
          this.error_(createSaxError("INVALID_COMMENT"));
        }
        this.advance_();
        this.state_ = this.stack_.length === 0 ? State.MISC : State.CONTENT;
        if (this.flags_ & Flags.CAPTURE_COMMENT) {
          this.reader_.comment?.(normalize(this.content_));
        }
        this.content_ = "";
        break;
      case State.PI_TARGET_START:
        if (!isNameStartChar(this.char_)) {
          this.error_(createSaxError("INVALID_PI"));
        }
        if (this.flags_ & Flags.CAPTURE_PI) {
          this.element_ = String.fromCodePoint(this.char_);
        }
        this.advance_();
        this.state_ = State.PI_TARGET;
        break;
      case State.PI_TARGET: {
        const start = this.index_;
        while (this.index_ < this.chunk_.length) {
          if (isWhitespace(this.char_)) {
            this.state_ = State.PI_CONTENT_S;
            break;
          } else if (this.char_ === Chars.QUESTION) {
            this.state_ = State.PI_EMPTY;
            break;
          } else if (!isNameChar(this.char_)) {
            this.error_(createSaxError("INVALID_PI"));
          }
          this.advance_();
        }
        if (this.flags_ & Flags.CAPTURE_PI) {
          this.element_ += this.chunk_.slice(start, this.index_);
        }
        break;
      }
      case State.PI_CONTENT:
        this.readPi_();
        break;
      case State.PI_CONTENT_S:
        if (!this.skipWhitespace_()) return false;
        this.state_ = State.PI_CONTENT;
        break;
      case State.PI_EMPTY:
        if (this.char_ !== Chars.GT) {
          this.error_(createSaxError("INVALID_PI"));
        }
        this.advance_();
        this.state_ = State.MISC;
        this.reader_.pi?.({
          target: this.element_,
          content: undefined,
        });
        this.element_ = "";
        break;
      case State.OPEN_ANGLE_BRACKET: {
        const char = this.char_;
        this.advance_();
        if (char === Chars.SLASH) {
          this.state_ = State.END_TAG_START;
        } else if (char === Chars.BANG) {
          this.state_ = State.OPEN_ANGLE_BRACKET_BANG;
        } else if (char === Chars.QUESTION) {
          this.state_ = State.PI_TARGET_START;
        } else if (isNameStartChar(char)) {
          this.state_ = State.START_TAG_NAME;
          this.element_ = String.fromCodePoint(char);
        } else {
          this.error_(createSaxError("INVALID_START_TAG"));
        }
        break;
      }
      case State.OPEN_ANGLE_BRACKET_BANG: {
        if (this.chunk_.slice(this.index_, this.index_ + 7) === "[CDATA[") {
          this.skipTo_(this.index_ + 7);
          this.state_ = State.CDATA;
        } else if (
          this.chunk_.slice(this.index_, this.index_ + 7) === "DOCTYPE"
        ) {
          if (
            this.flags_ & Flags.SEEN_DOCTYPE ||
            this.flags_ & Flags.SEEN_ROOT
          ) {
            this.error_(createSaxError("INVALID_DOCTYPE"));
          }
          this.skipTo_(this.index_ + 7);
          this.state_ = State.DOCTYPE_DECL;
        } else if (this.chunk_.slice(this.index_, this.index_ + 2) === "--") {
          this.skipTo_(this.index_ + 2);
          this.state_ = State.COMMENT;
        } else if (this.chunk_.length - this.index_ < 7) {
          return false;
        } else {
          this.error_(createSaxError("INVALID_START_TAG"));
        }
        break;
      }
      case State.START_TAG_NAME:
      case State.START_TAG:
      case State.START_TAG_ATTR:
      case State.START_TAG_ATTR_EQ:
      case State.START_TAG_ATTR_VALUE:
      case State.START_TAG_ATTR_VALUE_S:
      case State.START_TAG_ATTR_VALUE_D:
      case State.CONTENT:
      case State.END_TAG_START:
      case State.END_TAG:
      case State.END_TAG_END:
      case State.CDATA:
    }
    return true;
  }

  // @internal
  private error_(error: SaxError): never {
    throw error;
  }

  // Skips the specified number of code points. Assumes all skipped code points
  // are not in the surrogate range and are not carriage returns or line feeds.
  // @internal
  private skip_(units: number) {
    this.index_ += units;
    this.char_ = this.chunk_.codePointAt(this.index_)!;
  }

  // @internal
  private skipTo_(index: number) {
    this.index_ = index;
    this.char_ = this.chunk_.codePointAt(this.index_)!;
  }

  // @internal
  private advance_() {
    this.index_ += 1 + +(this.char_ > 0xffff);
    this.char_ = this.chunk_.codePointAt(this.index_)!;

    // Previous chunk ended in CR, may be waiting on a following LF in the next chunk.
    // if (this.flags_ & Flags.CARRIAGE_RETURN) {
    //   if (this.char_ === Chars.LF) {
    //     this.advance_();
    //     return;
    //   }
    //   this.flags_ ^= Flags.CARRIAGE_RETURN;
    // }

    // TODO: is this actually needed
    // Normalize line endings
    // https://www.w3.org/TR/xml/#sec-line-ends
    // if (this.char_ === Chars.CR) {
    // if (this.chunk_.charCodeAt(this.index_ + 1) === Chars.LF) {
    // this.index_ += 1;
    // } else if (this.index_ >= this.chunk_.length) {
    // this.flags_ |= Flags.CARRIAGE_RETURN;
    // }
    // this.char_ = Chars.LF;
    // }
  }

  // @internal
  private collectXmlAttrName_() {
    const index = this.chunk_.indexOf("=", this.index_);
    let end = index;
    if (end === -1) {
      end = this.chunk_.length;
    } else {
      // Remove whitespace from the end
      while (isWhitespace(this.chunk_.charCodeAt(--end)));
      end++;
    }
    this.attributeName_ += this.chunk_.slice(this.index_, end);
    this.skipTo_(end + 1);
    return index !== -1;
  }

  // @internal
  private readComment_() {
    // indexOf is highly optimized native code, so we can skip over a (probably)
    // large number of code points without having to read them manually.
    // This also means that we have no way to track line and column info, and
    // not even character offsets (JavaScript charCodes are not characters).
    // Comments end at --
    const index = this.chunk_.indexOf("--", this.index_);
    const end = index === -1 ? this.chunk_.length - 1 : index;
    if (this.flags_ & Flags.CAPTURE_COMMENT) {
      this.content_ += this.chunk_.slice(this.index_, end);
    }
    this.skipTo_(end + 2);
    if (index !== -1) this.state_ = State.COMMENT_END;
  }

  // @internal
  private readPi_() {
    const index = this.chunk_.indexOf("?>", this.index_);
    const end = index === -1 ? this.chunk_.length - 1 : index;
    if (this.flags_ & Flags.CAPTURE_PI) {
      this.content_ += this.chunk_.slice(this.index_, end);
    }
    this.skipTo_(end + 2);
    if (index !== -1) {
      this.state_ = State.MISC;
      // Only line endings are normalized in PI content. Anything else,
      // entity references char references etc... is just passed through.
      this.reader_.pi?.({
        target: this.element_,
        content: normalize(this.content_),
      });
      this.element_ = "";
      this.content_ = "";
    }
  }

  // Collect characters into accumulator until sequence is found and advance
  // cursor into the current buffer. Returns true if the sequence was found in
  // the current chunk.
  // @internal
  private collectUntil_(sequence: string) {
    // indexOf is much faster than any other method
    const indexOfSequence = this.chunk_.indexOf(sequence, this.index_);
    // ex. sequence == "--"
    // chunk == "hello world-"
    // next chunk == "-"
    // can't ignore all the chunk just because it didn't contain all the
    // sequence
    const end = indexOfSequence === -1
      ? this.chunk_.length - sequence.length + 1
      : indexOfSequence;
    this.accumulator_ += this.chunk_.slice(this.index_, end);
    this.skipTo_(end);
    return indexOfSequence !== -1;
  }

  // Read a quoted attribute value into attributeValue.
  // @internal
  private readQuotedValue_(isSingleQuote: boolean) {
    const quote = this.chunk_.indexOf(isSingleQuote ? "'" : '"', this.index_);
    const end = quote === -1 ? this.chunk_.length : quote;
    this.attributeValue_ += this.chunk_.slice(this.index_, end);
    this.skipTo_(end + 1);
    return quote !== -1;
  }

  // @internal
  private resolveEntity_(entity: string) {
    // https://www.w3.org/TR/REC-xml/#sec-predefined-ent
    // Even if predefined entities are declared somewhere in a DTD they MUST
    // have replacement text equal to the predefined ones.
    switch (entity) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "apos":
        return "'";
      case "quot":
        return '"';
    }
    const entityValue = this.reader_.resolveEntityRef?.(entity);
    if (entityValue == null) {
      throw createSaxError("UNRESOLVED_ENTITY", {entity});
    }
    return entityValue;
  }

  // @internal
  private handleXmlDeclAttr_() {
    // XMLDecl must also validate the order of attributes
    switch (this.attributeName_) {
      case "version":
        if (
          (this.flags_ & Flags.XML_ALL) !== Flags.INIT ||
          this.attributeValue_.length !== 3 ||
          this.attributeValue_.slice(0, 2) !== "1." ||
          !isAsciiDigit(this.attributeValue_.charCodeAt(2))
        ) {
          throw createSaxError("INVALID_XML_DECL");
        }
        this.version_ = this.attributeValue_;
        this.flags_ |= Flags.XML_VERSION;
        break;
      case "encoding":
        if (
          (this.flags_ & Flags.XML_ALL) !== Flags.XML_VERSION ||
          !isEncodingName(this.attributeValue_)
        ) {
          this.error_(createSaxError("INVALID_XML_DECL"));
        }
        this.encoding_ = this.attributeValue_.toLowerCase();
        this.flags_ |= Flags.XML_ENCODING;
        break;
      case "standalone":
        if (
          (this.flags_ & Flags.XML_VERSION) === 0 ||
          (this.flags_ & Flags.XML_STANDALONE) !== 0 ||
          (this.attributeValue_ !== "yes" && this.attributeValue_ !== "no")
        ) {
          this.error_(createSaxError("INVALID_XML_DECL"));
        }
        this.standalone_ = this.attributeValue_ === "yes";
        this.flags_ |= Flags.XML_STANDALONE;
        break;
      default:
        this.error_(createSaxError("INVALID_XML_DECL"));
    }
    this.attributeName_ = "";
    this.attributeValue_ = "";
  }

  // @internal
  private skipWhitespace_() {
    while (this.index_ < this.chunk_.length) {
      if (!isWhitespace(this.char_)) break;
      this.advance_();
    }
    return this.index_ !== this.chunk_.length;
  }
}
