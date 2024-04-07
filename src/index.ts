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

/** */
export interface Pi {
  target: string;
  content: string;
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
   * Resolve an entity by name. Users are expected to handle `<!ENTITY ...>`
   * declarations in the DTD where applicable or have a hard coded set of
   * possible ones.
   *
   * @param entity
   * @since 1.0.0
   */
  resolveEntity?(entity: string): string | undefined;
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
   * Start tag `<element attr="value">`.
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
  comments?: boolean | undefined;
  entities?: boolean | undefined;
}

// https://www.w3.org/TR/REC-xml/#sec-predefined-ent
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
  PI,
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
  OPEN_ANGLE_BRACKET,
  CDATA,
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
  MAYBE_CEND = 1 << 10,
  SINGLE_QUOTE = 1 << 11,

  CAPTURE_COMMENT = 1 << 16,
  CAPTURE_DOCTYPE = 1 << 17,
  CAPTURE_PI = 1 << 18,
}

function normalize(s: string) {
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
          this.state_ = State.PROLOG;
        }
        break;
      case State.PROLOG:
        break;
      case State.XML_DECL:
        if (!this.skipWhitespace_()) return false;
        if (this.collectXmlAttrName_()) {
          this.state_ = State.XML_DECL_VALUE;
        }
        break;
      case State.XML_DECL_S:
        if (!isWhitespace(this.char_)) {
          this.error_(createSaxError("INVALID_XML_DECL"));
        }
        this.advance_();
        this.state_ = State.XML_DECL;
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

        }
        break;
      case State.XML_DECL_END:
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
      case State.MISC:
      case State.COMMENT:
      case State.COMMENT_END:
      case State.PI:
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
      case State.OPEN_ANGLE_BRACKET:
      case State.CDATA:
    }
    return true;
  }

  // @internal
  private error_(error: SaxError) {
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

    // Normalize line endings
    // https://www.w3.org/TR/xml/#sec-line-ends
    if (this.char_ === 0xD /* CR */) {
      if (this.chunk_.charCodeAt(this.index_ + 1) === 0xA /* LF */) {
        this.index_ += 1;
      } else if (this.index_ >= this.chunk_.length) {
        this.flags_ |= Flags.CARRIAGE_RETURN;
      }
      this.char_ = 0xA /* LF */;
    }
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
    this.skipTo_(end);
    return quote !== -1;
  }

  // @internal
  private resolveEntity_(entity: string) {
    // Even if predefined entities are declared somewhere in a DTD they MUST
    // have replacement text equal to
    if (PREDEFINED_ENTITIES.hasOwnProperty(entity)) {
      return PREDEFINED_ENTITIES[entity as keyof typeof PREDEFINED_ENTITIES];
    }
    const entityValue = this.reader_.resolveEntity?.(entity);
    if (entityValue == null) {
      throw createSaxError("UNRESOLVED_ENTITY", {entity});
    }
    return entityValue;
  }

  // @internal
  private handleXmlDeclAttr_() {
    switch (this.attributeName_) {
      case "version":
        if (
          (this.flags_ & Flags.XML) !== Flags.INIT ||
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
          (this.flags_ & Flags.XML) !== Flags.XML_VERSION ||
          !isEncodingName(this.attributeValue_)
        ) {
          throw createSaxError("INVALID_XML_DECL");
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
          throw createSaxError("INVALID_XML_DECL");
        }
        this.standalone_ = this.attributeValue_ === "yes";
        this.flags_ |= Flags.XML_STANDALONE;
        break;
      default:
        throw createSaxError("INVALID_XML_DECL");
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
